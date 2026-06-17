"""
Motor de Comercio D100 (Iter 126) — Fases 2 a 5 del nuevo sistema de tienda.

Sustituye el sistema de umbrales discretos por un motor basado en:
  - Precio de referencia (según modo compra/venta + contexto histórico).
  - Desviación % entre la oferta del jugador y el precio de referencia.
  - Relación efectiva = relacion_actual (-100..100) + matriz subcultura + matriz oficio×ocupación.
  - Tolerancia de regateo derivada de la relación efectiva.
  - Barra de enfado (0..100) que sube con las ofertas abusivas.
  - Tirada D100 de aceptación con probabilidad modulada por relación y desviación.
  - Bucle de contraoferta.
  - Tirada de habilidad ENFRENTADA (p. ej. Engaño vs Perspicacia) con narrativa IA (gpt-4o-mini).
  - Impacto post-venta: delta de relación + aplicación real de oro/inventario (Fase 5, vía
    el endpoint existente /trading/confirm-transaction).

Todos los parámetros del motor son AJUSTABLES desde trading_config["d100_engine"].
"""
from fastapi import APIRouter, HTTPException, Body
from datetime import datetime, timezone
import random
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


def now_utc():
    return datetime.now(timezone.utc)


# ============================================================================
# CONFIG POR DEFECTO (ajustable desde Configuración → trading_config.d100_engine)
# ============================================================================
DEFAULT_D100_CONFIG = {
    "anger_umbral": 100,             # barra 0..100; al alcanzarla el PNJ corta el trato
    "anger_factor": 1.5,             # cuánto sube el enfado por cada % de desviación abusiva
    "tolerancia_base": 8,            # % de desviación tolerada sin enfadar (regateo normal)
    "tolerancia_por_relacion": 0.15, # +tolerancia por punto de relación efectiva
    "venta_ratio": 0.5,              # el PNJ compra al 50% del precio base por defecto
    "d100_base_aceptacion": 50,      # probabilidad base de aceptar una oferta justa
    "aceptacion_por_relacion": 0.4,  # +prob aceptación por punto de relación efectiva
    "aceptacion_por_desviacion": 1.2,# -prob por cada % de desviación
    "margen_contraoferta": 0.5,      # 0=precio justo · 1=oferta del jugador
    "opposed_skill_factor": 0.6,     # cada punto de ventaja en la tirada enfrentada → +tolerancia
    "relacion_delta_exito": 2,       # cambio de relación al cerrar un buen trato
    "relacion_delta_enfado": -4,     # cambio de relación si el PNJ se enfada
}


async def _get_d100_config():
    from server import db
    cfg = await db.trading_config.find_one({"_id": "main"}) or {}
    stored = cfg.get("d100_engine", {}) or {}
    merged = dict(DEFAULT_D100_CONFIG)
    merged.update({k: v for k, v in stored.items() if k in DEFAULT_D100_CONFIG})
    return merged


@router.get("/trading/d100/config")
async def get_d100_config():
    """Devuelve los parámetros del motor D100 (con valores por defecto fusionados)."""
    return await _get_d100_config()


@router.put("/trading/d100/config")
async def update_d100_config(payload: dict = Body(...)):
    """Actualiza los parámetros del motor D100 (solo claves conocidas)."""
    from server import db
    clean = {k: payload[k] for k in DEFAULT_D100_CONFIG if k in payload}
    await db.trading_config.update_one(
        {"_id": "main"},
        {"$set": {"d100_engine": {**DEFAULT_D100_CONFIG, **clean}, "updated_at": now_utc()}},
        upsert=True,
    )
    return {"message": "Configuración del motor D100 guardada", "d100_engine": {**DEFAULT_D100_CONFIG, **clean}}


# ============================================================================
# HELPERS
# ============================================================================
async def _get_npc(npc_id: str):
    from server import db
    npc = await db.trading_npcs.find_one({"_id": npc_id})
    if not npc:
        raise HTTPException(status_code=404, detail="PNJ no encontrado")
    npc["_id"] = str(npc["_id"])
    return npc


async def _get_character(character_id: str):
    from server import db
    if not character_id:
        return None
    return await db.characters.find_one({"_id": character_id})


async def _matrix_mods(npc: dict, char_subcultura: str, char_ocupacion: str):
    """Devuelve (sub_mod, ofi_mod) leyendo las matrices guardadas o los defaults."""
    from server import db
    from routes.trading_npc_data import default_subcultura_mod, default_oficio_ocupacion_mod
    cfg = await db.trading_config.find_one({"_id": "main"}) or {}
    stored_sub = cfg.get("subcultura_matrix", {}) or {}
    stored_ofi = cfg.get("oficio_ocupacion_matrix", {}) or {}

    npc_sub = (npc.get("subcultura") or "").strip()
    npc_raza = (npc.get("raza") or "").strip()
    npc_prof = (npc.get("profesion") or npc.get("profesion_comerciante") or "").strip()

    char_raza = ""
    if char_subcultura:
        c = await db.cultures.find_one({"nombre": char_subcultura})
        char_raza = (c or {}).get("raza", "")

    # Subcultura PNJ (fila) × subcultura personaje (columna)
    if npc_sub in stored_sub and stored_sub[npc_sub].get(char_subcultura) is not None:
        sub_mod = int(stored_sub[npc_sub][char_subcultura])
    else:
        sub_mod = default_subcultura_mod(npc_raza, npc_sub, char_raza, char_subcultura)

    # Oficio PNJ (fila) × ocupación personaje (columna)
    if npc_prof in stored_ofi and stored_ofi[npc_prof].get(char_ocupacion) is not None:
        ofi_mod = int(stored_ofi[npc_prof][char_ocupacion])
    else:
        ofi_mod = default_oficio_ocupacion_mod(npc_prof, char_ocupacion)

    return sub_mod, ofi_mod


async def _relacion_actual(character_id: str, npc_id: str) -> int:
    from server import db
    if not character_id:
        return 0
    rel = await db.npc_relationships.find_one({"character_id": character_id, "npc_id": npc_id})
    try:
        return int((rel or {}).get("relacion_actual", 0) or 0)
    except (TypeError, ValueError):
        return 0


def _contexto_factor(modo: str, categoria: str, contexto_cfg: dict) -> float:
    """Factor multiplicador del precio por contexto histórico (reutiliza mod_<categoria>)."""
    if not contexto_cfg:
        return 1.0
    mod = contexto_cfg.get(f"mod_{categoria}", contexto_cfg.get("mod_general", 0)) or 0
    return 1.0 + (mod / 100.0)


# ============================================================================
# FASE 2 — Tienda: PNJ disponibles en la ubicación del personaje
# ============================================================================
@router.get("/trading/d100/available-npcs")
async def available_npcs(character_id: str):
    """PNJ presentes físicamente en la ubicación actual del personaje (gate de presencia)."""
    from server import db
    char = await _get_character(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    ubic = char.get("ubicacion_actual") or {}
    ubic_id = ubic.get("id")
    ubic_nombre = ubic.get("nombre")
    region = ubic.get("region")

    npcs = await db.trading_npcs.find({}).to_list(2000)
    presentes = []
    for n in npcs:
        n["_id"] = str(n["_id"])
        same = False
        if ubic_id and n.get("ubicacion_id") and n.get("ubicacion_id") == ubic_id:
            same = True
        elif ubic_nombre and n.get("ubicacion") and n.get("ubicacion") == ubic_nombre:
            same = True
        if same:
            presentes.append(n)
    return {
        "character": {"id": character_id, "nombre": char.get("nombre"),
                      "ubicacion": ubic_nombre, "ubicacion_id": ubic_id, "region": region},
        "npcs": presentes,
        "total": len(presentes),
    }


# ============================================================================
# FASE 3 — Motor D100 de negociación
# ============================================================================
@router.post("/trading/d100/negotiate")
async def d100_negotiate(payload: dict = Body(...)):
    """
    Resuelve una ronda de negociación D100.

    payload:
      npc_id, character_id (opcional)
      precio_base (float)            # precio de catálogo del artículo
      categoria (str, opcional)      # para el contexto histórico (armas/lujo/comida/general)
      modo: "compra" | "venta"
      oferta (float)                 # lo que ofrece/pide el jugador
      contexto_historico (key, opc)
      anger_actual (0..100, def 0)
      opposed_bonus (def 0)          # ventaja de una tirada enfrentada previa
    """
    from server import db
    from routes.trading_routes import DEFAULT_HISTORICAL_CONTEXTS
    eng = await _get_d100_config()

    npc_id = payload.get("npc_id")
    if not npc_id:
        raise HTTPException(status_code=400, detail="npc_id requerido")
    npc = await _get_npc(npc_id)

    character_id = payload.get("character_id")
    char = await _get_character(character_id) if character_id else None
    char_subcultura = (char or {}).get("cultura_nombre", "") if char else ""
    char_ocupacion = (char or {}).get("vocacion_nombre", "") if char else ""

    precio_base = float(payload.get("precio_base", 0) or 0)
    modo = payload.get("modo", "compra")
    oferta = float(payload.get("oferta", 0) or 0)
    categoria = payload.get("categoria", "general") or "general"
    anger_actual = float(payload.get("anger_actual", 0) or 0)
    opposed_bonus = float(payload.get("opposed_bonus", 0) or 0)

    # 1) Relación efectiva
    relacion = await _relacion_actual(character_id, npc_id) if character_id else 0
    sub_mod, ofi_mod = await _matrix_mods(npc, char_subcultura, char_ocupacion)
    relacion_efectiva = max(-100, min(100, relacion + sub_mod + ofi_mod))

    # 2) Precio de referencia (con contexto histórico)
    cfg = await db.trading_config.find_one({"_id": "main"}) or {}
    contextos = cfg.get("historical_contexts", DEFAULT_HISTORICAL_CONTEXTS)
    ctx = contextos.get(payload.get("contexto_historico", ""), {})
    factor_ctx = _contexto_factor(modo, categoria, ctx)

    if modo == "venta":
        precio_ref = precio_base * float(eng["venta_ratio"]) * factor_ctx
    else:
        precio_ref = precio_base * factor_ctx
    precio_ref = round(precio_ref, 2)

    # 3) Desviación % (positiva = oferta desfavorable para el PNJ)
    if precio_ref > 0:
        if modo == "compra":
            desviacion = ((precio_ref - oferta) / precio_ref) * 100.0  # paga de menos
        else:
            desviacion = ((oferta - precio_ref) / precio_ref) * 100.0  # pide de más
    else:
        desviacion = 0.0
    desviacion = round(desviacion, 2)

    # 4) Tolerancia de regateo
    tolerancia = (float(eng["tolerancia_base"])
                  + relacion_efectiva * float(eng["tolerancia_por_relacion"])
                  + opposed_bonus)
    tolerancia = round(max(0.0, tolerancia), 2)

    # 5) Enfado por abuso
    desviacion_abusiva = max(0.0, desviacion - tolerancia)
    anger_inc = round(desviacion_abusiva * float(eng["anger_factor"]), 1)
    new_anger = round(min(100.0, anger_actual + anger_inc), 1)

    # 6) ¿Se rompe la negociación?
    if new_anger >= float(eng["anger_umbral"]):
        return {
            "resultado": "enfado",
            "precio_referencia": precio_ref,
            "desviacion_pct": desviacion,
            "tolerancia": tolerancia,
            "relacion": relacion,
            "sub_mod": sub_mod,
            "ofi_mod": ofi_mod,
            "relacion_efectiva": relacion_efectiva,
            "anger_actual": anger_actual,
            "anger_incremento": anger_inc,
            "anger_nuevo": new_anger,
            "tirada": None,
            "prob_aceptacion": None,
            "contraoferta": None,
            "relacion_delta": int(eng["relacion_delta_enfado"]),
            "mensaje": "El PNJ se ha enfadado y rompe la negociación.",
        }

    # 7) Tirada D100 de aceptación
    prob = (float(eng["d100_base_aceptacion"])
            + relacion_efectiva * float(eng["aceptacion_por_relacion"])
            - max(0.0, desviacion) * float(eng["aceptacion_por_desviacion"])
            + opposed_bonus)
    prob = int(round(max(5.0, min(95.0, prob))))
    tirada = random.randint(1, 100)

    if tirada <= prob:
        resultado = "acepta"
        contraoferta = None
        relacion_delta = int(eng["relacion_delta_exito"]) if desviacion <= tolerancia else 0
    else:
        resultado = "contraoferta"
        margen = float(eng["margen_contraoferta"])
        # La contraoferta se mueve desde el precio justo hacia la oferta del jugador.
        contraoferta = round(precio_ref + (oferta - precio_ref) * margen, 2)
        relacion_delta = 0

    return {
        "resultado": resultado,
        "precio_referencia": precio_ref,
        "desviacion_pct": desviacion,
        "tolerancia": tolerancia,
        "relacion": relacion,
        "sub_mod": sub_mod,
        "ofi_mod": ofi_mod,
        "relacion_efectiva": relacion_efectiva,
        "anger_actual": anger_actual,
        "anger_incremento": anger_inc,
        "anger_nuevo": new_anger,
        "tirada": tirada,
        "prob_aceptacion": prob,
        "contraoferta": contraoferta,
        "oferta": oferta,
        "relacion_delta": relacion_delta,
        "modo": modo,
    }


# ============================================================================
# FASE 4 — Tirada de habilidad ENFRENTADA + narrativa IA
# ============================================================================
def _abil_mod(valor):
    try:
        return (int(valor) - 10) // 2
    except (TypeError, ValueError):
        return 0


@router.post("/trading/d100/opposed-roll")
async def d100_opposed_roll(payload: dict = Body(...)):
    """
    Tirada enfrentada (p. ej. Engaño vs Perspicacia). 5e: d20 + modificador por bando.

    payload:
      npc_id, character_id (opc)
      intencion (str)            # qué intenta el jugador (lo narra el DJ)
      habilidad (str)            # "Engaño", "Persuasión", "Intimidación"…
      habilidad_pnj (str)        # "Perspicacia", "Perspicacia (pasiva)"…
      mod_jugador (int)          # bonificador de la habilidad del jugador
      mod_pnj (int, opc)         # si no se indica, se deriva de SAB/CAR del PNJ
    """
    eng = await _get_d100_config()
    npc_id = payload.get("npc_id")
    npc = await _get_npc(npc_id)

    habilidad = payload.get("habilidad", "Engaño")
    habilidad_pnj = payload.get("habilidad_pnj", "Perspicacia")
    intencion = payload.get("intencion", "")

    mod_jugador = int(payload.get("mod_jugador", 0) or 0)
    # Modificador del PNJ = el de su habilidad de defensa (Perspicacia). Si el PNJ
    # NO tiene esa habilidad definida, cuenta como 0 (no se deriva de SAB/INT).
    from routes.trading_npc_data import modificador_de_habilidad_en_pnj
    mod_pnj = modificador_de_habilidad_en_pnj(npc, habilidad_pnj)

    d_jugador = random.randint(1, 20)
    d_pnj = random.randint(1, 20)
    total_jugador = d_jugador + mod_jugador
    total_pnj = d_pnj + mod_pnj
    gana_jugador = total_jugador >= total_pnj
    ventaja = total_jugador - total_pnj  # puede ser negativa

    # Bono de la tirada → modifica la tolerancia en la siguiente ronda de negociación.
    opposed_bonus = round(ventaja * float(eng["opposed_skill_factor"]), 2)

    narrativa = await _generate_opposed_narrative(
        npc, habilidad, habilidad_pnj, intencion, gana_jugador, ventaja)

    return {
        "habilidad": habilidad,
        "habilidad_pnj": habilidad_pnj,
        "intencion": intencion,
        "tirada_jugador": {"d20": d_jugador, "mod": mod_jugador, "total": total_jugador},
        "tirada_pnj": {"d20": d_pnj, "mod": mod_pnj, "total": total_pnj},
        "gana_jugador": gana_jugador,
        "ventaja": ventaja,
        "opposed_bonus": opposed_bonus,
        "narrativa": narrativa,
    }


async def _generate_opposed_narrative(npc, habilidad, habilidad_pnj, intencion, gana_jugador, ventaja):
    """Narra el resultado de la tirada enfrentada con gpt-4o-mini (con fallback)."""
    import uuid
    resultado = "ÉXITO del jugador" if gana_jugador else "FRACASO del jugador (el PNJ lo detecta)"
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY no configurada")
        prompt = (
            f"El comerciante {npc.get('nombre')} ({npc.get('profesion', 'comerciante')}, "
            f"{npc.get('subcultura', '')}) está negociando.\n"
            f"Rasgo: {npc.get('rasgo', '')} — {npc.get('rasgo_descripcion', '')}\n"
            f"Modo de hablar: {npc.get('modo_hablar', '')} ({npc.get('modo_hablar_desc', '')})\n\n"
            f"El jugador intenta usar {habilidad} con esta intención: «{intencion or 'regatear'}».\n"
            f"El PNJ se defiende con {habilidad_pnj}.\n"
            f"Resultado de la tirada enfrentada: {resultado} (ventaja {ventaja}).\n\n"
            "Narra en 2-3 frases, en español de España y en tercera persona, cómo reacciona el "
            "comerciante: si el jugador gana, el PNJ se lo cree o cede terreno; si pierde, el PNJ "
            "sospecha o se ofende. Refleja su rasgo y su forma de hablar. No uses comillas de apertura."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"opposed_{uuid.uuid4().hex[:8]}",
            system_message="Eres un narrador de la Tierra Media para una mesa de rol. Narras breve y evocador.",
        ).with_model("openai", "gpt-4o-mini")
        resp = await chat.send_message(UserMessage(text=prompt))
        return (resp or "").strip()
    except Exception as e:
        logger.warning("Narrativa enfrentada fallback: %s", e)
        if gana_jugador:
            return (f"{npc.get('nombre')} entrecierra los ojos un instante, pero termina asintiendo: "
                    f"se ha tragado el farol y afloja su postura.")
        return (f"{npc.get('nombre')} no se deja engañar tan fácilmente. Su mirada se endurece y "
                f"aprieta el trato con más recelo.")


# ============================================================================
# FASE 5 — Cierre: persistir relación + (oro/inventario vía confirm-transaction)
# ============================================================================
@router.post("/trading/d100/close")
async def d100_close(payload: dict = Body(...)):
    """
    Cierra una negociación: aplica el delta de relación al par personaje↔PNJ y deja
    constancia en el historial. La transferencia real de oro/inventario se hace
    aparte con /trading/confirm-transaction (Fase 5).

    payload: { character_id, npc_id, relacion_delta, resumen }
    """
    from server import db
    from routes.trading_npc_data import nivel_desde_relacion
    character_id = payload.get("character_id")
    npc_id = payload.get("npc_id")
    if not character_id or not npc_id:
        raise HTTPException(status_code=400, detail="character_id y npc_id requeridos")
    delta = int(payload.get("relacion_delta", 0) or 0)
    resumen = payload.get("resumen", "")

    rel = await db.npc_relationships.find_one({"character_id": character_id, "npc_id": npc_id})
    actual = int((rel or {}).get("relacion_actual", 0) or 0)
    nuevo = max(-100, min(100, actual + delta))
    entry = {
        "tipo": "negociacion_d100",
        "delta": delta,
        "relacion_resultante": nuevo,
        "resumen": resumen,
        "fecha": now_utc().isoformat(),
    }
    if rel:
        await db.npc_relationships.update_one(
            {"_id": rel["_id"]},
            {"$set": {"relacion_actual": nuevo, "nivel": nivel_desde_relacion(nuevo),
                      "updated_at": now_utc()},
             "$push": {"historial": entry}},
        )
        rel_id = str(rel["_id"])
    else:
        import uuid
        rel_id = str(uuid.uuid4())
        await db.npc_relationships.insert_one({
            "_id": rel_id, "character_id": character_id, "npc_id": npc_id,
            "relacion_actual": nuevo, "nivel": nivel_desde_relacion(nuevo),
            "penalizacion_precio": 0, "dias_sin_comercio": 0,
            "historial": [entry], "created_at": now_utc(), "updated_at": now_utc(),
        })

    return {"ok": True, "relacion_anterior": actual, "relacion_actual": nuevo,
            "nivel": nivel_desde_relacion(nuevo), "relationship_id": rel_id}
