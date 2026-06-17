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
    # ── BLOQUE A · Negociación normal ──────────────────────────────────────
    "venta_ratio": 0.5,               # al VENDER, el PNJ parte de pagar el 50% del catálogo
    "tolerancia_base": 8,             # % de desviación tolerada sin enfadar
    "tolerancia_por_relacion": 0.15,  # +tolerancia por punto de relación efectiva
    "anger_factor": 1.5,              # cuánto sube el enfado por % de desviación abusiva
    "anger_umbral": 100,              # barra 0..100; al alcanzarla el PNJ corta el trato
    "d100_base_aceptacion": 50,       # probabilidad base de aceptar una oferta justa
    "aceptacion_por_relacion": 0.4,   # +prob aceptación por punto de relación efectiva
    "aceptacion_por_desviacion": 1.2, # -prob por cada % de desviación
    "relacion_delta_exito": 2,        # cambio de relación al cerrar un buen trato
    "relacion_delta_enfado": -4,      # cambio de relación si el PNJ se enfada
    # ── BLOQUE A-2 · Contraoferta balanceada (descuento por fidelidad) ──────
    "descuento_base_relacion": 0.05,      # 5% fijo de salida si la relación > 0
    "descuento_por_punto_relacion": 0.01, # +1% por cada punto positivo de relación
    "descuento_maximo": 0.40,             # tope del descuento total (evita regalar)
    # ── BLOQUE B · Tirada enfrentada ────────────────────────────────────────
    "divisor_desviacion": 10,         # la desviación% se suma al PNJ dividida entre esto
    "mod_rel_hostil": -4,             # modificador de relación (se RESTA a la tirada del PNJ)
    "mod_rel_receloso": -2,
    "mod_rel_neutral": 0,
    "mod_rel_cordial": 1,
    "mod_rel_amigo": 2,
    "mod_rel_hermandad": 4,
    # ── BLOQUE C · Resultado de la tirada enfrentada ────────────────────────
    "umbral_pillado": 6,              # diff a partir del cual es "Pillado" en vez de "Duda"
    "enfado_duda": 15,                # enfado que suma una "Duda"
    "enfado_pillado": 40,             # enfado que suma un "Pillado"
    "relacion_pillado": -15,          # cambio de relación en un "Pillado"
    # ── BLOQUE D · Subida de precio si gana el PNJ (automática) ─────────────
    "subida_precio_duda": 0.0,        # % que sube el precio en una "Duda"
    "subida_precio_pillado": 0.0,     # % que sube el precio en un "Pillado"
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


def _mod_contexto_pct(categoria: str, ctx: dict) -> float:
    """Mod_Contexto para la contraoferta: contexto que ENCARECE (mod +) → menos descuento.
    Devuelve un % (fracción): crisis/escasez negativo, bonanza positivo."""
    if not ctx:
        return 0.0
    raw = ctx.get(f"mod_{categoria}", ctx.get("mod_general", 0)) or 0
    return round(-raw / 100.0, 4)


def _afinidad_raza_pct(npc_raza: str, pj_raza: str) -> float:
    """Mod_Afinidad_Raza (fracción): se deriva de las relaciones de raza existentes.
    Misma raza → +5% de descuento; otras razas → puntos/100 (puede ser negativo)."""
    from routes.trading_npc_data import RELACIONES_RAZA
    if not npc_raza or not pj_raza:
        return 0.0
    if npc_raza == pj_raza:
        return 0.05
    pts = RELACIONES_RAZA.get((npc_raza, pj_raza), 0)
    return round(pts / 100.0, 4)


def _mod_relacion_nivel(relacion: int, eng: dict) -> int:
    """Modificador discreto por nivel de relación (se RESTA a la tirada del PNJ)."""
    v = relacion
    if v <= -60:
        return int(eng["mod_rel_hostil"])
    if v <= -20:
        return int(eng["mod_rel_receloso"])
    if v < 20:
        return int(eng["mod_rel_neutral"])
    if v < 50:
        return int(eng["mod_rel_cordial"])
    if v < 80:
        return int(eng["mod_rel_amigo"])
    return int(eng["mod_rel_hermandad"])


async def _char_raza(char_subcultura: str) -> str:
    from server import db
    if not char_subcultura:
        return ""
    c = await db.cultures.find_one({"nombre": char_subcultura})
    return (c or {}).get("raza", "")


def _descuento_fidelidad(eng: dict, relacion: int, mod_contexto: float, mod_afinidad: float) -> dict:
    """Calcula el % de descuento/incremento de la contraoferta balanceada."""
    if relacion > 0:
        desc_rel = float(eng["descuento_base_relacion"]) + relacion * float(eng["descuento_por_punto_relacion"])
    else:
        desc_rel = 0.0
    tope = float(eng["descuento_maximo"])
    total = desc_rel + mod_contexto + mod_afinidad
    total = max(-tope, min(tope, total))
    return {
        "descuento_relacion": round(desc_rel, 4),
        "mod_contexto": round(mod_contexto, 4),
        "mod_afinidad_raza": round(mod_afinidad, 4),
        "descuento_total": round(total, 4),
    }


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

    # 1) Relación efectiva
    relacion = await _relacion_actual(character_id, npc_id) if character_id else 0
    sub_mod, ofi_mod = await _matrix_mods(npc, char_subcultura, char_ocupacion)
    relacion_efectiva = max(-100, min(100, relacion + sub_mod + ofi_mod))

    # 2) Precio objetivo del PNJ (SIN contexto; el contexto entra en la contraoferta).
    if modo == "venta":
        precio_ref = round(precio_base * float(eng["venta_ratio"]), 2)
    else:
        precio_ref = round(precio_base, 2)

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
                  + relacion_efectiva * float(eng["tolerancia_por_relacion"]))
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
            - max(0.0, desviacion) * float(eng["aceptacion_por_desviacion"]))
    prob = int(round(max(5.0, min(95.0, prob))))
    tirada = random.randint(1, 100)

    desglose_contra = None
    if tirada <= prob:
        resultado = "acepta"
        contraoferta = None
        relacion_delta = int(eng["relacion_delta_exito"]) if desviacion <= tolerancia else 0
    else:
        resultado = "contraoferta"
        # Contraoferta BALANCEADA: el PNJ parte de SU precio objetivo y aplica un
        # descuento por fidelidad (relación + contexto + afinidad de raza).
        cfg = await db.trading_config.find_one({"_id": "main"}) or {}
        contextos = cfg.get("historical_contexts", DEFAULT_HISTORICAL_CONTEXTS)
        ctx = contextos.get(payload.get("contexto_historico", ""), {})
        mod_contexto = _mod_contexto_pct(categoria, ctx)
        pj_raza = await _char_raza(char_subcultura)
        mod_afinidad = _afinidad_raza_pct(npc.get("raza", ""), pj_raza)
        desglose_contra = _descuento_fidelidad(eng, relacion, mod_contexto, mod_afinidad)
        pct = desglose_contra["descuento_total"]
        if modo == "venta":
            # Al vender, mejor relación → el PNJ paga MÁS (sube su pago).
            contraoferta = round(precio_ref * (1 + pct), 2)
        else:
            # Al comprar, mejor relación → el PNJ rebaja su precio.
            contraoferta = round(precio_ref * (1 - pct), 2)
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
        "contraoferta_desglose": desglose_contra,
        "oferta": oferta,
        "relacion_delta": relacion_delta,
        "modo": modo,
    }


# ============================================================================
# FASE 4 — Tirada de habilidad ENFRENTADA + narrativa IA
# ============================================================================
@router.post("/trading/d100/opposed-roll")
async def d100_opposed_roll(payload: dict = Body(...)):
    """
    Tirada enfrentada OPCIONAL (Engaño/Persuasión/Intimidación vs Perspicacia).
    Resuelve en UNA tirada si la oferta del jugador "cuela".

      PJ:  1d20 + mod_jugador
      PNJ: 1d20 + mod_perspicacia − mod_relacion_nivel + mod_desviacion_precio

    Bandas (diff = total_PNJ − total_PJ):
      diff < 0           → Éxito  : el PNJ acepta el precio ofertado.
      0 ≤ diff < umbral  → Duda   : oferta rechazada, +enfado, posible subida de precio.
      diff ≥ umbral      → Pillado: +enfado fuerte, −relación, posible subida de precio.

    payload:
      npc_id, character_id (opc), intencion, habilidad, mod_jugador,
      precio_base, modo, oferta, categoria, anger_actual
    """
    from server import db
    eng = await _get_d100_config()
    npc_id = payload.get("npc_id")
    npc = await _get_npc(npc_id)

    character_id = payload.get("character_id")
    char = await _get_character(character_id) if character_id else None
    char_subcultura = (char or {}).get("cultura_nombre", "") if char else ""

    habilidad = payload.get("habilidad", "Engaño")
    habilidad_pnj = payload.get("habilidad_pnj", "Perspicacia")
    intencion = payload.get("intencion", "")
    modo = payload.get("modo", "compra")
    oferta = float(payload.get("oferta", 0) or 0)
    precio_base = float(payload.get("precio_base", 0) or 0)
    anger_actual = float(payload.get("anger_actual", 0) or 0)

    # Precio objetivo + desviación (misma base que la negociación, sin contexto).
    if modo == "venta":
        precio_ref = round(precio_base * float(eng["venta_ratio"]), 2)
    else:
        precio_ref = round(precio_base, 2)
    if precio_ref > 0:
        if modo == "compra":
            desviacion = ((precio_ref - oferta) / precio_ref) * 100.0
        else:
            desviacion = ((oferta - precio_ref) / precio_ref) * 100.0
    else:
        desviacion = 0.0
    desviacion = round(desviacion, 2)

    # Modificadores de la tirada.
    mod_jugador = int(payload.get("mod_jugador", 0) or 0)
    from routes.trading_npc_data import modificador_de_habilidad_en_pnj
    mod_pnj = modificador_de_habilidad_en_pnj(npc, habilidad_pnj)  # 0 si no la tiene
    relacion = await _relacion_actual(character_id, npc_id) if character_id else 0
    mod_relacion = _mod_relacion_nivel(relacion, eng)
    # La oferta desorbitada (a favor del jugador) sube la tirada del PNJ.
    mod_desviacion = round(max(0.0, desviacion) / float(eng["divisor_desviacion"]), 2)

    d_jugador = random.randint(1, 20)
    d_pnj = random.randint(1, 20)
    total_jugador = d_jugador + mod_jugador
    total_pnj = d_pnj + mod_pnj - mod_relacion + mod_desviacion
    total_pnj = round(total_pnj, 2)
    diff = round(total_pnj - total_jugador, 2)
    gana_jugador = total_jugador > total_pnj

    umbral = float(eng["umbral_pillado"])
    if gana_jugador:
        banda = "exito"
        anger_inc = 0.0
        relacion_delta = int(eng["relacion_delta_exito"])
        subida_pct = 0.0
        precio_resultante = round(oferta, 2)  # el PNJ acepta el precio ofertado
    elif diff < umbral:
        banda = "duda"
        anger_inc = float(eng["enfado_duda"])
        relacion_delta = 0
        subida_pct = float(eng["subida_precio_duda"]) / 100.0
        precio_resultante = None
    else:
        banda = "pillado"
        anger_inc = float(eng["enfado_pillado"])
        relacion_delta = int(eng["relacion_pillado"])
        subida_pct = float(eng["subida_precio_pillado"]) / 100.0
        precio_resultante = None

    # Subida automática del precio cuando gana el PNJ (Bloque D).
    if not gana_jugador and subida_pct > 0 and precio_ref > 0:
        if modo == "venta":
            precio_resultante = round(precio_ref * (1 - subida_pct), 2)  # paga menos al PJ
        else:
            precio_resultante = round(precio_ref * (1 + subida_pct), 2)  # cobra más al PJ

    new_anger = round(min(100.0, anger_actual + anger_inc), 1)

    narrativa = await _generate_opposed_narrative(
        npc, habilidad, habilidad_pnj, intencion, gana_jugador, -diff, banda)

    return {
        "habilidad": habilidad,
        "habilidad_pnj": habilidad_pnj,
        "intencion": intencion,
        "tirada_jugador": {"d20": d_jugador, "mod": mod_jugador, "total": total_jugador},
        "tirada_pnj": {
            "d20": d_pnj, "mod_perspicacia": mod_pnj, "mod_relacion": mod_relacion,
            "mod_desviacion": mod_desviacion, "total": total_pnj,
        },
        "gana_jugador": gana_jugador,
        "resultado": banda,
        "diff": diff,
        "desviacion_pct": desviacion,
        "precio_referencia": precio_ref,
        "precio_resultante": precio_resultante,
        "subida_pct": round(subida_pct * 100, 2),
        "anger_actual": anger_actual,
        "anger_incremento": anger_inc,
        "anger_nuevo": new_anger,
        "relacion_delta": relacion_delta,
        "narrativa": narrativa,
    }


async def _generate_opposed_narrative(npc, habilidad, habilidad_pnj, intencion, gana_jugador, ventaja, banda="exito"):
    """Narra el resultado de la tirada enfrentada con gpt-4o-mini (con fallback)."""
    import uuid
    banda_txt = {
        "exito": "ÉXITO del jugador: el comerciante se lo cree y acepta el precio ofertado.",
        "duda": "DUDA: el comerciante no se fía, rechaza la oferta pero sigue regateando.",
        "pillado": "PILLADO: el comerciante descubre el engaño, se ofende y se pone hostil.",
    }.get(banda, "ÉXITO del jugador")
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
            f"Resultado de la tirada enfrentada: {banda_txt}\n\n"
            "Narra en 2-3 frases, en español de España y en tercera persona, cómo reacciona el "
            "comerciante según ese resultado. Refleja su rasgo y su forma de hablar. "
            "No uses comillas de apertura."
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
        if banda == "exito":
            return (f"{npc.get('nombre')} entrecierra los ojos un instante, pero termina asintiendo: "
                    f"se ha tragado el farol y acepta tu precio.")
        if banda == "duda":
            return (f"{npc.get('nombre')} no se fía del todo. Niega con la cabeza y mantiene su postura, "
                    f"aunque sigue dispuesto a regatear.")
        return (f"{npc.get('nombre')} te ha pillado. Su mirada se endurece, golpea el mostrador y "
                f"el trato se vuelve hostil.")


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
