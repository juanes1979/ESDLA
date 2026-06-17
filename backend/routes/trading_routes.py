"""
Trading System Routes
Handles buy/sell transactions, NPC generation, relationships, and merchant profiles
"""
from fastapi import APIRouter, HTTPException, Body
from datetime import datetime, timezone
import random
import uuid
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

def now_utc():
    return datetime.now(timezone.utc)

# ============================================================================
# DEFAULT CONFIGURATIONS
# ============================================================================

# Relationship levels and their trading modifiers
DEFAULT_RELATIONSHIP_LEVELS = {
    "hostil": {"nombre": "Hostil", "orden": 1, "mod_compra": 25, "mod_venta": -25, "bono_tirada": -20},
    "desconocido": {"nombre": "Desconocido", "orden": 2, "mod_compra": 10, "mod_venta": -10, "bono_tirada": -5},
    "neutral": {"nombre": "Neutral", "orden": 3, "mod_compra": 0, "mod_venta": 0, "bono_tirada": 0},
    "cordial": {"nombre": "Cordial", "orden": 4, "mod_compra": -10, "mod_venta": 10, "bono_tirada": 5},
    "amigo": {"nombre": "Amigo", "orden": 5, "mod_compra": -20, "mod_venta": 20, "bono_tirada": 15},
    "hermandad": {"nombre": "Hermandad", "orden": 6, "mod_compra": -30, "mod_venta": 30, "bono_tirada": 25}
}

# Blessing/reward modifiers
DEFAULT_BLESSING_MODIFIERS = {
    "ninguna": {"nombre": "Ninguna", "modificador": 0},
    "bendicion_menor": {"nombre": "Bendición Menor", "modificador": 15},
    "bendicion_mayor": {"nombre": "Bendición Mayor", "modificador": 30},
    "objeto_legendario": {"nombre": "Objeto Legendario", "modificador": 50},
    "reliquia_regional": {"nombre": "Reliquia Regional", "modificador": 40}
}

# Merchant profiles
DEFAULT_MERCHANT_PROFILES = {
    "normal": {
        "nombre": "Normal",
        "descripcion": "Un comerciante común sin rasgos distintivos.",
        "umbral_enfado": 30,
        "margen_contraoferta": 0.5,
        "probabilidad_engano": 0,
        "mod_precio_base": 0
    },
    "codicioso": {
        "nombre": "Codicioso",
        "descripcion": "Solo le importa el dinero. Nunca da un buen precio.",
        "umbral_enfado": 20,
        "margen_contraoferta": 0.3,
        "probabilidad_engano": 15,
        "mod_precio_base": 10
    },
    "honorable": {
        "nombre": "Honorable",
        "descripcion": "Comerciante justo que valora la honestidad.",
        "umbral_enfado": 40,
        "margen_contraoferta": 0.6,
        "probabilidad_engano": 0,
        "mod_precio_base": -5
    },
    "desesperado": {
        "nombre": "Desesperado",
        "descripcion": "Necesita vender urgentemente. Acepta casi cualquier oferta.",
        "umbral_enfado": 50,
        "margen_contraoferta": 0.8,
        "probabilidad_engano": 5,
        "mod_precio_base": -15
    },
    "mercader_experto": {
        "nombre": "Mercader Experto",
        "descripcion": "Conoce el valor exacto de todo. Difícil de engañar.",
        "umbral_enfado": 25,
        "margen_contraoferta": 0.4,
        "probabilidad_engano": 0,
        "mod_precio_base": 5
    },
    "contrabandista": {
        "nombre": "Contrabandista",
        "descripcion": "Vende objetos ilegales o robados. Precios variables.",
        "umbral_enfado": 15,
        "margen_contraoferta": 0.35,
        "probabilidad_engano": 25,
        "mod_precio_base": -20
    }
}

# Historical contexts
DEFAULT_HISTORICAL_CONTEXTS = {
    "paz_prolongada": {
        "nombre": "Paz Prolongada",
        "descripcion": "La región ha disfrutado de paz durante años.",
        "mod_armas": -15,
        "mod_lujo": 0,
        "mod_comida": -5,
        "mod_general": 0,
        "bono_tirada": 5
    },
    "guerra_activa": {
        "nombre": "Guerra Activa",
        "descripcion": "Conflicto armado en la región.",
        "mod_armas": 40,
        "mod_lujo": -30,
        "mod_comida": 20,
        "mod_general": 10,
        "bono_tirada": -10
    },
    "hambruna": {
        "nombre": "Hambruna",
        "descripcion": "Escasez severa de alimentos.",
        "mod_armas": 0,
        "mod_lujo": -20,
        "mod_comida": 50,
        "mod_general": 15,
        "bono_tirada": -5
    },
    "ruta_comercial_activa": {
        "nombre": "Ruta Comercial Activa",
        "descripcion": "Flujo constante de mercancías.",
        "mod_armas": -5,
        "mod_lujo": -10,
        "mod_comida": -10,
        "mod_general": -10,
        "bono_tirada": 10
    },
    "epidemia": {
        "nombre": "Epidemia",
        "descripcion": "Enfermedad azotando la población.",
        "mod_armas": 0,
        "mod_lujo": -40,
        "mod_comida": 10,
        "mod_general": 20,
        "bono_tirada": -15
    },
    "festividad": {
        "nombre": "Festividad",
        "descripcion": "Celebración o feria comercial.",
        "mod_armas": 0,
        "mod_lujo": 15,
        "mod_comida": 5,
        "mod_general": -5,
        "bono_tirada": 15
    },
    "ocupacion_enemiga": {
        "nombre": "Ocupación Enemiga",
        "descripcion": "Territorio bajo control hostil.",
        "mod_armas": 60,
        "mod_lujo": -50,
        "mod_comida": 30,
        "mod_general": 25,
        "bono_tirada": -20
    },
    "prosperidad": {
        "nombre": "Prosperidad",
        "descripcion": "Época de abundancia económica.",
        "mod_armas": -10,
        "mod_lujo": 10,
        "mod_comida": -15,
        "mod_general": -10,
        "bono_tirada": 10
    }
}

# Trading reaction thresholds
DEFAULT_TRADING_THRESHOLDS = {
    "compra": {
        "zona_aceptacion_auto": 0,  # >= precio_justo
        "zona_negociable_min": -5,
        "zona_negociable_max": -15,
        "zona_riesgo_min": -15,
        "zona_riesgo_max": -30,
        "zona_enfado": -30,
        "prob_acepta_buena_oferta": 80,
        "prob_contraoferta_buena": 20,
        "tirada_acepta_negociable": 60,
        "tirada_contraoferta_negociable": 30,
        "tirada_contraoferta_riesgo": 75,
        "tirada_rechaza_riesgo": 40,
        "prob_enfado_muy_baja": 70
    },
    "venta": {
        "zona_aceptacion_auto": 0,
        "zona_negociable_min": 5,
        "zona_negociable_max": 15,
        "zona_riesgo_min": 15,
        "zona_riesgo_max": 30,
        "zona_enfado": 30,
        "prob_acepta_buena_oferta": 75,
        "prob_contraoferta_buena": 25,
        "tirada_acepta_negociable": 55,
        "tirada_contraoferta_negociable": 25,
        "tirada_contraoferta_riesgo": 70,
        "tirada_rechaza_riesgo": 35,
        "prob_enfado_muy_alta": 65
    }
}

# Contraoferta factors by relationship
DEFAULT_CONTRAOFERTA_FACTORS = {
    "hostil": 0.2,
    "desconocido": 0.35,
    "neutral": 0.5,
    "cordial": 0.6,
    "amigo": 0.7,
    "hermandad": 0.85
}

# Anger consequences
DEFAULT_ANGER_CONSEQUENCES = {
    "leve": {
        "nombre": "Enfado Leve",
        "cambio_relacion": -1,
        "penalizacion_precio": 5,
        "dias_sin_comercio": 0
    },
    "moderado": {
        "nombre": "Enfado Moderado", 
        "cambio_relacion": -1,
        "penalizacion_precio": 10,
        "dias_sin_comercio": 3
    },
    "severo": {
        "nombre": "Enfado Severo",
        "cambio_relacion": -2,
        "penalizacion_precio": 20,
        "dias_sin_comercio": 7
    }
}


# ============================================================================
# TRADING CONFIG ENDPOINTS
# ============================================================================

@router.get("/trading/config")
async def get_trading_config(db=None):
    """Get all trading configuration"""
    from server import db as database
    from routes.trading_npc_data import (
        PROFESIONES, RASGOS_POSITIVOS, RASGOS_NEGATIVOS, MODOS_HABLA,
        EXCLUSION_TAGS_RAZA, EXCLUSION_TAGS_PROFESION,
        ALINEAMIENTOS, STAT_BLOCKS_POR_PROFESION,
    )
    db = database

    config = await db.trading_config.find_one({"_id": "main"}) or {}

    return {
        "relationship_levels": config.get("relationship_levels", DEFAULT_RELATIONSHIP_LEVELS),
        "blessing_modifiers": config.get("blessing_modifiers", DEFAULT_BLESSING_MODIFIERS),
        "merchant_profiles": config.get("merchant_profiles", DEFAULT_MERCHANT_PROFILES),
        "historical_contexts": config.get("historical_contexts", DEFAULT_HISTORICAL_CONTEXTS),
        "trading_thresholds": config.get("trading_thresholds", DEFAULT_TRADING_THRESHOLDS),
        "contraoferta_factors": config.get("contraoferta_factors", DEFAULT_CONTRAOFERTA_FACTORS),
        "anger_consequences": config.get("anger_consequences", DEFAULT_ANGER_CONSEQUENCES),
        # --- Listas editables de creación de PNJ comerciante ---
        "npc_profesiones": config.get("npc_profesiones", PROFESIONES),
        "npc_rasgos_positivos": config.get("npc_rasgos_positivos", RASGOS_POSITIVOS),
        "npc_rasgos_negativos": config.get("npc_rasgos_negativos", RASGOS_NEGATIVOS),
        "npc_modos_habla": config.get("npc_modos_habla", MODOS_HABLA),
        "npc_exclusion_raza": config.get("npc_exclusion_raza", EXCLUSION_TAGS_RAZA),
        "npc_exclusion_profesion": config.get("npc_exclusion_profesion", EXCLUSION_TAGS_PROFESION),
        "npc_alineamientos": config.get("npc_alineamientos", ALINEAMIENTOS),
        "npc_stat_blocks": config.get("npc_stat_blocks", STAT_BLOCKS_POR_PROFESION),
        "updated_at": config.get("updated_at"),
    }


@router.put("/trading/config")
async def update_trading_config(config: dict = Body(...)):
    """Update trading configuration"""
    from server import db
    from routes.trading_npc_data import (
        PROFESIONES, RASGOS_POSITIVOS, RASGOS_NEGATIVOS, MODOS_HABLA,
        EXCLUSION_TAGS_RAZA, EXCLUSION_TAGS_PROFESION,
        ALINEAMIENTOS, STAT_BLOCKS_POR_PROFESION,
    )

    update_data = {
        "relationship_levels": config.get("relationship_levels", DEFAULT_RELATIONSHIP_LEVELS),
        "blessing_modifiers": config.get("blessing_modifiers", DEFAULT_BLESSING_MODIFIERS),
        "merchant_profiles": config.get("merchant_profiles", DEFAULT_MERCHANT_PROFILES),
        "historical_contexts": config.get("historical_contexts", DEFAULT_HISTORICAL_CONTEXTS),
        "trading_thresholds": config.get("trading_thresholds", DEFAULT_TRADING_THRESHOLDS),
        "contraoferta_factors": config.get("contraoferta_factors", DEFAULT_CONTRAOFERTA_FACTORS),
        "anger_consequences": config.get("anger_consequences", DEFAULT_ANGER_CONSEQUENCES),
        "npc_profesiones": config.get("npc_profesiones", PROFESIONES),
        "npc_rasgos_positivos": config.get("npc_rasgos_positivos", RASGOS_POSITIVOS),
        "npc_rasgos_negativos": config.get("npc_rasgos_negativos", RASGOS_NEGATIVOS),
        "npc_modos_habla": config.get("npc_modos_habla", MODOS_HABLA),
        "npc_exclusion_raza": config.get("npc_exclusion_raza", EXCLUSION_TAGS_RAZA),
        "npc_exclusion_profesion": config.get("npc_exclusion_profesion", EXCLUSION_TAGS_PROFESION),
        "npc_alineamientos": config.get("npc_alineamientos", ALINEAMIENTOS),
        "npc_stat_blocks": config.get("npc_stat_blocks", STAT_BLOCKS_POR_PROFESION),
        "updated_at": now_utc()
    }
    
    await db.trading_config.update_one(
        {"_id": "main"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Configuración guardada"}


@router.put("/trading/config/merchant-profiles")
async def update_merchant_profiles(profiles: dict = Body(...)):
    """Update merchant profiles"""
    from server import db
    
    await db.trading_config.update_one(
        {"_id": "main"},
        {"$set": {"merchant_profiles": profiles, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Perfiles actualizados"}


@router.put("/trading/config/historical-contexts")
async def update_historical_contexts(contexts: dict = Body(...)):
    """Update historical contexts"""
    from server import db
    
    await db.trading_config.update_one(
        {"_id": "main"},
        {"$set": {"historical_contexts": contexts, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Contextos actualizados"}


@router.post("/trading/config/reset")
async def reset_trading_config():
    """Reset trading config to defaults"""
    from server import db
    
    await db.trading_config.update_one(
        {"_id": "main"},
        {"$set": {
            "relationship_levels": DEFAULT_RELATIONSHIP_LEVELS,
            "blessing_modifiers": DEFAULT_BLESSING_MODIFIERS,
            "merchant_profiles": DEFAULT_MERCHANT_PROFILES,
            "historical_contexts": DEFAULT_HISTORICAL_CONTEXTS,
            "trading_thresholds": DEFAULT_TRADING_THRESHOLDS,
            "contraoferta_factors": DEFAULT_CONTRAOFERTA_FACTORS,
            "anger_consequences": DEFAULT_ANGER_CONSEQUENCES,
            "updated_at": now_utc()
        }},
        upsert=True
    )
    return {"message": "Configuración restablecida"}


# ============================================================================
# MATRICES DE RELACIÓN (Subculturas y Oficio×Ocupación)
# ============================================================================

async def _subculturas_actuales():
    """Lista [{nombre, raza}] de todas las subculturas (db.cultures)."""
    from server import db
    out = []
    async for c in db.cultures.find({}, {"nombre": 1, "raza": 1, "categoria": 1}):
        nombre = (c.get("nombre") or "").strip()
        if not nombre:
            continue
        raza = (c.get("raza") or c.get("categoria") or "Otros").strip()
        out.append({"nombre": nombre, "raza": raza})
    out.sort(key=lambda x: (x["raza"], x["nombre"]))
    return out


async def _ocupaciones_actuales():
    """Lista de nombres de ocupaciones de aventurero (db.occupations), sin TEST_*."""
    from server import db
    out = []
    async for o in db.occupations.find({}, {"vocacion": 1}):
        v = (o.get("vocacion") or "").strip()
        if v and not v.upper().startswith("TEST"):
            out.append(v)
    out.sort()
    return out


@router.get("/trading/config/matrices")
async def get_relationship_matrices():
    """Devuelve las matrices de relación, fusionando lo guardado con los valores
    por defecto para cualquier subcultura/ocupación/profesión nueva (auto-amplía)."""
    from server import db
    from routes.trading_npc_data import (
        default_subcultura_mod, default_oficio_ocupacion_mod,
    )
    cfg = await get_trading_config()
    profesiones = cfg.get("npc_profesiones", [])
    subculturas = await _subculturas_actuales()
    ocupaciones = await _ocupaciones_actuales()

    config = await db.trading_config.find_one({"_id": "main"}) or {}
    stored_sub = config.get("subcultura_matrix", {}) or {}
    stored_ofi = config.get("oficio_ocupacion_matrix", {}) or {}

    # Matriz subcultura × subcultura (PNJ filas, personaje columnas).
    raza_de = {s["nombre"]: s["raza"] for s in subculturas}
    sub_matrix = {}
    for a in subculturas:
        fila = stored_sub.get(a["nombre"], {})
        nueva = {}
        for b in subculturas:
            if b["nombre"] in fila and fila[b["nombre"]] is not None:
                nueva[b["nombre"]] = int(fila[b["nombre"]])
            else:
                nueva[b["nombre"]] = default_subcultura_mod(
                    a["raza"], a["nombre"], b["raza"], b["nombre"])
        sub_matrix[a["nombre"]] = nueva

    # Matriz oficio (profesión PNJ) × ocupación aventurero.
    ofi_matrix = {}
    for p in profesiones:
        fila = stored_ofi.get(p, {})
        nueva = {}
        for o in ocupaciones:
            if o in fila and fila[o] is not None:
                nueva[o] = int(fila[o])
            else:
                nueva[o] = default_oficio_ocupacion_mod(p, o)
        ofi_matrix[p] = nueva

    return {
        "subculturas": subculturas,
        "ocupaciones": ocupaciones,
        "profesiones": profesiones,
        "subcultura_matrix": sub_matrix,
        "oficio_ocupacion_matrix": ofi_matrix,
    }


@router.put("/trading/config/matrices")
async def update_relationship_matrices(payload: dict = Body(...)):
    """Guarda las matrices editadas."""
    from server import db
    update = {"updated_at": now_utc()}
    if "subcultura_matrix" in payload:
        sm = payload["subcultura_matrix"] or {}
        update["subcultura_matrix"] = {
            str(a): {str(b): int(v) for b, v in (fila or {}).items()}
            for a, fila in sm.items()
        }
    if "oficio_ocupacion_matrix" in payload:
        om = payload["oficio_ocupacion_matrix"] or {}
        update["oficio_ocupacion_matrix"] = {
            str(p): {str(o): int(v) for o, v in (fila or {}).items()}
            for p, fila in om.items()
        }
    await db.trading_config.update_one(
        {"_id": "main"}, {"$set": update}, upsert=True,
    )
    return {"message": "Matrices guardadas"}


@router.post("/trading/config/matrices/reset")
async def reset_relationship_matrices():
    """Borra las matrices guardadas para volver a los valores por defecto."""
    from server import db
    await db.trading_config.update_one(
        {"_id": "main"},
        {"$unset": {"subcultura_matrix": "", "oficio_ocupacion_matrix": ""},
         "$set": {"updated_at": now_utc()}},
        upsert=True,
    )
    return {"message": "Matrices restablecidas a los valores por defecto"}



# ============================================================================
# NPC TEMPLATES (for random generation)
# ============================================================================

DEFAULT_NPC_TEMPLATES = {
    "ocupaciones": [
        "Herrero del lugar", "Posadero del lugar", "Panadero del lugar", "Pastor del lugar",
        "Cazador del lugar", "Pescador del lugar", "Jardinero del lugar", "Guardabosques del lugar",
        "Maestro/a de escuela del lugar", "Sacerdote del lugar", "Mercader ambulante del lugar",
        "Curtidor del lugar", "Alfarero del lugar", "Cazador del lugar", "Capintero del lugar",
        "Médico del lugar", "Juglar del lugar"
    ],
    "apariencias": [
        "Tiene una cicatriz prominente en la mejilla", "Siempre lleva ropas limpias y elegantes",
        "Le faltan varios dientes", "Luce el cabello trenzado", "Es corpulento con apariencia fuerte",
        "Lleva bisutería de latón", "Es muy flexible", "Es un mercenario", "Tiene aspecto de extranjero",
        "Tiene un color de piel inusual", "Tiene tatuajes en los brazos", "Tiene arrugas en los ojos",
        "Tiene una nariz característica", "Le faltan algunos dedos", "Lleva pendientes y pulseras",
        "Es extremadamente hermoso", "Lleva pendientes y colgantes"
    ],
    "rasgos_positivos": [
        "Es fuerte como un oso", "Es muy persuasivo", "Es muy saludable", "Es muy perspicaz",
        "Es algo cobarde", "Pero es algo débil", "Pero es un poco manazas", "Aunque tiene un aspecto publicitario",
        "Es muy sano", "Puede estar enterándose", "Pero es poca amenaza", "Aunque siempre suele estar enfermizo",
        "Es muy robustez", "Es muy saludable"
    ],
    "rasgos_negativos": [
        "Sin embargo, es sarcástico/torpe, como un carpintero experto", "Pero resulta algo seco",
        "Pero resulta algo seco", "Pero a veces está demasiado", "Pero es un poco manazas",
        "Aunque suele estar enfermizo", "Pero a veces resulta aburrido", "Aunque suele estar enfermizo",
        "Pero resulta un poco/algo", "Pero es un poco manazas", "Aunque suele estar enfermizo"
    ],
    "habilidades_especiales": [
        "Sabe trabajar la madera especialmente fuerte", "Tiene un gran aguante para el alcohol",
        "Es un cocinero experto. Habla a menudo de vinos", "Se le cae bien a los animales",
        "Es un carpintero y una experta", "Es un buen rastreador y se orienta", "Es un carpintero o una experta",
        "Se le caen bien los animales. Es decepción", "Suele hablar gritando para el alcohol",
        "Tiene una terrera perfecta", "Tiene a tener predicciones proféticas",
        "Hablar sin dinero complicados", "Teme al altar una palabra incorrecta",
        "Es un estilador con expertos", "Se le caen bien los animales", "Habla a menudo de vinos",
        "Tiende a corre a si mismo no me fía", "Sabe cursar a una enfermedad"
    ],
    "modos_hablar": [
        "Suele hablar con voz especialmente fuerte", "Siempre está hablando con bromas",
        "Habla a menudo de vinos", "Suele moverse caro pro decoro bajo reto",
        "Es de ciudad informa", "Es caritoso", "Es ambicioso", "Es decente",
        "Es callado/a", "Es nervioso", "Brusca es toma casa", "Es pesimista",
        "Es ambiciosos", "Es caritoso", "Es decente", "Es nervioso", "Es ingenuo/a"
    ],
    "personalidades": [
        "Es una persona muy ambiciosa", "Conoce que se compra armas de confianza en la ciudad",
        "Sabe cual es el mejor hospicador para esconderse en la posada",
        "Conoce una lista/cifra que conocen los cazadores de las nieblas",
        "Sabe cargó secretos con los elfos", "Conoce un paseo oculto en la taberna",
        "Sabe cual es el mejor cazador en el mayor caña/vino de otro reto",
        "Conoce un paseo oculto en la taberna", "Sabe dónde se hace una oportunidad fuerte en la taberna",
        "Sabe cuál es el más/mejor cultor o en otra reto"
    ],
    "vinculos": [
        "Siente un gran/amor/riesgo de sentimiento/protección hacia sus compañeros",
        "Es amistoso con su familia cercana", "Desea un paseo de placeres y descubrir algo",
        "Busca la solución", "Protege a sus compañeros más débiles", "Perturbe unas provisiones amoladoras",
        "Pase consciencia/mal de animales", "Desea el riesgo o paseos descubrientes"
    ],
    "defectos_secretos": [
        "Se interesa por las personas", "Busca el mayor riesgo", "Piensa ser por/así en frío/a los demás",
        "Deseo de placeres", "Busca el conocimiento", "Busca el bien más mayor", "Piensa con demasiado/a",
        "Resistentes a la bélica", "Deseo del honor. Valora la libertad", "Decir en la justicia. Y honrado a la crueldad"
    ],
    "alineamientos_moral": ["Neutral", "Bueno", "Malvado"],
    "alineamientos_etico": ["Legal", "Neutral", "Caótico"],
    "profesiones_comerciante": [
        "Herrero", "Posadero", "Mercader de telas", "Boticario", "Armero", "Joyero",
        "Vendedor de provisiones", "Curtidor", "Carpintero", "Alfarero", "Pescadero",
        "Carnicero", "Panadero", "Tabernero", "Herborista", "Comerciante de pieles"
    ]
}


@router.get("/trading/npc-templates")
async def get_npc_templates():
    """Get NPC generation templates"""
    from server import db
    
    templates = await db.npc_templates.find_one({"_id": "main"})
    
    if not templates:
        return DEFAULT_NPC_TEMPLATES
    
    return {k: v for k, v in templates.items() if k != "_id"}


@router.put("/trading/npc-templates")
async def update_npc_templates(templates: dict = Body(...)):
    """Update NPC generation templates"""
    from server import db
    
    templates["updated_at"] = now_utc()
    
    await db.npc_templates.update_one(
        {"_id": "main"},
        {"$set": templates},
        upsert=True
    )
    return {"message": "Plantillas actualizadas"}


# ============================================================================
# NPC MANAGEMENT
# ============================================================================

@router.get("/trading/npcs")
async def get_npcs(location: str = None):
    """Get all NPCs or filter by location"""
    from server import db
    from routes.trading_npc_data import generar_caracteristicas, generar_pg

    query = {}
    if location:
        query["ubicacion"] = location
    
    npcs = await db.trading_npcs.find(query).to_list(1000)
    
    # Convert ObjectId to string + relleno perezoso de características/CA/PG.
    for npc in npcs:
        npc["_id"] = str(npc["_id"])
        patch = {}
        if not npc.get("caracteristicas"):
            patch["caracteristicas"] = generar_caracteristicas(npc.get("profesion", ""))
        if not npc.get("ca"):
            patch["ca"] = 10
        if not npc.get("pg"):
            patch["pg"] = generar_pg()
        if patch:
            npc.update(patch)
            await db.trading_npcs.update_one({"_id": npc["_id"]}, {"$set": patch})
    
    return {"npcs": npcs, "total": len(npcs)}


@router.post("/trading/npcs")
async def create_npc(npc_data: dict = Body(...)):
    """Create a new merchant NPC (con autorrelleno de nombre, rasgo, modo de habla y edad)."""
    from server import db
    cfg = await get_trading_config()

    raza = npc_data.get("raza", "")
    subcultura = npc_data.get("subcultura", "")
    profesion = npc_data.get("profesion", "") or npc_data.get("profesion_comerciante", "")
    sexo = npc_data.get("sexo", "Masculino")

    # --- Nombre: autogenerar si está vacío ---
    nombre = (npc_data.get("nombre") or "").strip()
    if not nombre:
        try:
            gen = await generate_npc_merchant_name({
                "raza": raza, "subcultura": subcultura, "sexo": sexo, "profesion": profesion,
            })
            nombre = gen.get("nombre") or f"PNJ-{random.randint(1000, 9999)}"
        except Exception:
            nombre = f"PNJ-{random.randint(1000, 9999)}"

    # --- Rasgo único: aleatorio coherente si está vacío ---
    rasgo = (npc_data.get("rasgo") or "").strip()
    rasgo_tipo = npc_data.get("rasgo_tipo", "")
    rasgo_desc = npc_data.get("rasgo_descripcion", "")
    if not rasgo:
        elegido = _elegir_rasgo_db(cfg, raza, profesion)
        rasgo, rasgo_tipo, rasgo_desc = elegido["nombre"], elegido["tipo"], elegido["descripcion"]
    elif not rasgo_desc:
        desc, tipo = _descripcion_rasgo_db(cfg, rasgo)
        rasgo_desc = desc or ""
        rasgo_tipo = rasgo_tipo or (tipo or "")

    # --- Modo de hablar: automático si está vacío ---
    modo_hablar = (npc_data.get("modo_hablar") or "").strip()
    modo_hablar_desc = npc_data.get("modo_hablar_desc", "")
    if not modo_hablar:
        mh = _elegir_modo_db(cfg)
        modo_hablar, modo_hablar_desc = mh["nombre"], mh["descripcion"]

    # --- Edad: calcular si está vacía ---
    edad = npc_data.get("edad")
    if not edad:
        cultura = await _get_culture_by_name(subcultura)
        edad = _calcular_edad(cultura, profesion)

    # --- Alineamiento (nota secreta del DJ): aleatorio si está vacío ---
    from routes.trading_npc_data import elegir_alineamiento_aleatorio, elegir_stats_aleatorios
    alineamiento = (npc_data.get("alineamiento") or "").strip()
    if not alineamiento:
        alineamiento = elegir_alineamiento_aleatorio(cfg.get("npc_alineamientos"))

    # --- Bloques de estadísticas: aleatorios por profesión si están vacíos ---
    from routes.trading_npc_data import generar_caracteristicas, generar_pg
    stat_blocks_cfg = cfg.get("npc_stat_blocks", {})
    habilidades = npc_data.get("habilidades") or []
    herramientas = npc_data.get("herramientas") or []
    sentidos = npc_data.get("sentidos") or []
    idiomas = npc_data.get("idiomas") or []
    if not (habilidades or herramientas or sentidos or idiomas):
        stats = elegir_stats_aleatorios(stat_blocks_cfg, profesion)
        habilidades = stats["habilidades"]
        herramientas = stats["herramientas"]
        sentidos = stats["sentidos"]
        idiomas = stats["idiomas"]

    # --- Características (6 atributos) + CA + PG ---
    caracteristicas = npc_data.get("caracteristicas") or generar_caracteristicas(profesion)
    ca = npc_data.get("ca") or 10
    pg = npc_data.get("pg") or generar_pg()

    npc = {
        "_id": str(uuid.uuid4()),
        "codigo_npc": _generate_codigo_npc(nombre),
        "nombre": nombre,
        "apodo": npc_data.get("apodo", ""),
        "raza": raza,
        "subcultura": subcultura,
        "sexo": sexo,
        "edad": edad,
        "profesion": profesion,
        "profesion_comerciante": profesion,
        "ocupacion": npc_data.get("ocupacion", profesion),
        "apariencia": npc_data.get("apariencia", ""),
        "rasgo": rasgo,
        "rasgo_tipo": rasgo_tipo,
        "rasgo_descripcion": rasgo_desc,
        "modo_hablar": modo_hablar,
        "modo_hablar_desc": modo_hablar_desc,
        "alineamiento": alineamiento,
        "habilidades": habilidades,
        "herramientas": herramientas,
        "sentidos": sentidos,
        "idiomas": idiomas,
        "caracteristicas": caracteristicas,
        "ca": ca,
        "pg": pg,
        "historia": npc_data.get("historia", ""),
        "retrato_file_id": npc_data.get("retrato_file_id"),
        "perfil_comerciante": npc_data.get("perfil_comerciante", "normal"),
        "ubicacion": npc_data.get("ubicacion", ""),
        "ubicacion_id": npc_data.get("ubicacion_id", ""),
        "region": npc_data.get("region", ""),
        "inventario": npc_data.get("inventario", ""),
        "notas": npc_data.get("notas", ""),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    await db.trading_npcs.insert_one(npc)
    return {"message": "PNJ creado", "npc_id": npc["_id"], "npc": npc}


@router.post("/trading/npcs/generate")
async def generate_random_npc(params: dict = Body(...)):
    """Generate a random NPC based on templates"""
    from server import db
    
    # Get templates
    templates = await db.npc_templates.find_one({"_id": "main"})
    if not templates:
        templates = DEFAULT_NPC_TEMPLATES
    
    # Generate random NPC
    npc = {
        "_id": str(uuid.uuid4()),
        "nombre": params.get("nombre", f"PNJ-{random.randint(1000, 9999)}"),
        "apodo": "",
        "ocupacion": random.choice(templates.get("ocupaciones", ["Comerciante"])),
        "profesion_comerciante": random.choice(templates.get("profesiones_comerciante", ["Mercader"])),
        "apariencia": random.choice(templates.get("apariencias", ["Sin descripción"])),
        "rasgo_positivo": random.choice(templates.get("rasgos_positivos", [""])),
        "rasgo_negativo": random.choice(templates.get("rasgos_negativos", [""])),
        "habilidad_especial": random.choice(templates.get("habilidades_especiales", [""])),
        "modo_hablar": random.choice(templates.get("modos_hablar", [""])),
        "personalidad": random.choice(templates.get("personalidades", [""])),
        "conocimiento_util": "",
        "vinculo": random.choice(templates.get("vinculos", [""])),
        "defecto_secreto": random.choice(templates.get("defectos_secretos", [""])),
        "alineamiento_moral": random.choice(templates.get("alineamientos_moral", ["Neutral"])),
        "alineamiento_etico": random.choice(templates.get("alineamientos_etico", ["Neutral"])),
        "perfil_comerciante": params.get("perfil", random.choice(list(DEFAULT_MERCHANT_PROFILES.keys()))),
        "ubicacion": params.get("ubicacion", ""),
        "region": params.get("region", ""),
        "inventario": "",
        "notas": "",
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
    
    # Save if requested
    if params.get("guardar", False):
        await db.trading_npcs.insert_one(npc)
    
    return {"npc": npc}


@router.put("/trading/npcs/{npc_id}")
async def update_npc(npc_id: str, npc_data: dict = Body(...)):
    """Update an NPC"""
    from server import db
    
    npc_data["updated_at"] = now_utc()
    
    result = await db.trading_npcs.update_one(
        {"_id": npc_id},
        {"$set": npc_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="PNJ no encontrado")
    
    return {"message": "PNJ actualizado"}


@router.delete("/trading/npcs/{npc_id}")
async def delete_npc(npc_id: str):
    """Delete an NPC"""
    from server import db
    
    result = await db.trading_npcs.delete_one({"_id": npc_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PNJ no encontrado")
    
    return {"message": "PNJ eliminado"}


# ============================================================================
# NPC MERCHANT CREATION — meta, traits coherence, name/age/profile generation
# ============================================================================
import unicodedata as _unicodedata
import time as _time

PORTRAIT_PROMPT_PREFIX = (
    "Boceto a lápiz de grafito tradicional, estilo fantasía realista, "
    "sombreado detallado, retrato de personaje sobre fondo blanco roto. "
)


def _strip_accents_alnum(text: str) -> str:
    """Quita acentos/caracteres especiales y deja solo letras/números (minúsculas)."""
    norm = _unicodedata.normalize("NFD", text or "")
    cleaned = "".join(c for c in norm if _unicodedata.category(c) != "Mn")
    return "".join(c for c in cleaned if c.isalnum()).lower()


def _generate_codigo_npc(nombre: str) -> str:
    """ID interno único: semilla de tiempo + primer nombre (sin apellidos ni símbolos)."""
    primer = (nombre or "pnj").strip().split(" ")[0]
    base = _strip_accents_alnum(primer) or "pnj"
    return f"{int(_time.time())}_{base}"


# Sesgo de edad por profesión (fracción dentro del rango edad_min..edad_max).
_PROF_EDAD_JOVEN = {"Campesino", "Leñador", "Peón de construcción", "Mozo de cuadra",
                    "Herrero aprendiz", "Cazador", "Barquero / Remero"}
_PROF_EDAD_MAYOR = {"Maestro de escuela", "Capitán de la guardia", "Caballero de Gondor",
                    "Señor de una aldea", "Príncipe o noble", "Enano Herrero",
                    "Elfo Artesano", "Mago Errante", "Sanador / Herbalista", "Posadero",
                    "Hobbit Posadero", "Mercader"}


def _calcular_edad(cultura: dict, profesion: str) -> int:
    """Edad coherente según el rango de la subcultura y la veteranía de la profesión."""
    emin = int((cultura or {}).get("edad_min") or 18)
    emax = int((cultura or {}).get("edad_max") or 70)
    if emax <= emin:
        emax = emin + 40
    if profesion in _PROF_EDAD_JOVEN:
        lo, hi = 0.05, 0.30
    elif profesion in _PROF_EDAD_MAYOR:
        lo, hi = 0.45, 0.85
    else:
        lo, hi = 0.25, 0.55
    frac = random.uniform(lo, hi)
    return int(round(emin + frac * (emax - emin)))


async def _cultures_grouped():
    """Agrupa las culturas por raza: {raza: [{nombre, edad_min, edad_max}]}."""
    from server import db
    grouped = {}
    async for c in db.cultures.find({}, {"nombre": 1, "raza": 1, "edad_min": 1, "edad_max": 1}):
        raza = (c.get("raza") or "Otros").strip()
        grouped.setdefault(raza, []).append({
            "nombre": c.get("nombre"),
            "edad_min": c.get("edad_min"),
            "edad_max": c.get("edad_max"),
        })
    return grouped


async def _get_culture_by_name(nombre: str):
    from server import db
    if not nombre:
        return None
    return await db.cultures.find_one({"nombre": nombre})


@router.get("/trading/npc-meta")
async def get_npc_meta():
    """Metadatos para crear PNJ comerciante: profesiones, modos de habla, razas/subculturas."""
    cfg = await get_trading_config()
    razas = await _cultures_grouped()
    return {
        "profesiones": cfg.get("npc_profesiones", []),
        "modos_habla": cfg.get("npc_modos_habla", []),
        "razas": razas,
        "sexos": ["Masculino", "Femenino"],
        "merchant_profiles": cfg.get("merchant_profiles", DEFAULT_MERCHANT_PROFILES),
        "alineamientos": cfg.get("npc_alineamientos", []),
        "stat_blocks": cfg.get("npc_stat_blocks", {}),
    }


def _forbidden_tags_db(cfg: dict, raza: str, profesion: str) -> set:
    from routes.trading_npc_data import PROFESIONES_CRIMINALES
    tags = set()
    tags.update(cfg.get("npc_exclusion_raza", {}).get((raza or "").strip(), []))
    tags.update(cfg.get("npc_exclusion_profesion", {}).get((profesion or "").strip(), []))
    if (profesion or "").strip() in PROFESIONES_CRIMINALES:
        tags.add("santo")
    return tags


def _rasgos_validos_db(cfg: dict, raza: str, profesion: str) -> dict:
    forbidden = _forbidden_tags_db(cfg, raza, profesion)

    def _ok(r):
        return not (set(r.get("tags", [])) & forbidden)

    return {
        "positivos": [r for r in cfg.get("npc_rasgos_positivos", []) if _ok(r)],
        "negativos": [r for r in cfg.get("npc_rasgos_negativos", []) if _ok(r)],
    }


def _elegir_rasgo_db(cfg: dict, raza: str, profesion: str) -> dict:
    v = _rasgos_validos_db(cfg, raza, profesion)
    tipo = random.choice(["positivo", "negativo"])
    pool = v["positivos"] if tipo == "positivo" else v["negativos"]
    if not pool:
        pool = v["negativos"] or v["positivos"]
        tipo = "negativo" if pool is v["negativos"] else "positivo"
    if not pool:
        return {"nombre": "", "descripcion": "", "tipo": "positivo"}
    e = random.choice(pool)
    return {"nombre": e["nombre"], "descripcion": e.get("descripcion", ""), "tipo": tipo}


def _elegir_modo_db(cfg: dict) -> dict:
    if random.random() < 0.5:
        return {"nombre": "Normal", "descripcion": "Habla de forma normal, sin rasgos distintivos."}
    modos = cfg.get("npc_modos_habla", [])
    return dict(random.choice(modos)) if modos else {"nombre": "Normal", "descripcion": ""}


def _descripcion_rasgo_db(cfg: dict, nombre: str):
    for r in cfg.get("npc_rasgos_positivos", []):
        if r.get("nombre") == nombre:
            return r.get("descripcion", ""), "positivo"
    for r in cfg.get("npc_rasgos_negativos", []):
        if r.get("nombre") == nombre:
            return r.get("descripcion", ""), "negativo"
    return None, None


@router.post("/trading/npc-meta/rasgos")
async def get_valid_rasgos(payload: dict = Body(...)):
    """Devuelve los rasgos (positivos/negativos) compatibles con la raza y profesión."""
    cfg = await get_trading_config()
    return _rasgos_validos_db(cfg, payload.get("raza", ""), payload.get("profesion", ""))


@router.post("/trading/npc-meta/stats")
async def roll_stat_blocks(payload: dict = Body(...)):
    """Elige al azar habilidades/herramientas/sentidos/idiomas para una profesión."""
    from routes.trading_npc_data import elegir_stats_aleatorios
    cfg = await get_trading_config()
    return elegir_stats_aleatorios(cfg.get("npc_stat_blocks", {}), payload.get("profesion", ""))


@router.post("/trading/npc-meta/caracteristicas")
async def roll_caracteristicas(payload: dict = Body(...)):
    """Genera las 6 características (array por profesión), CA=10 y PG aleatorios."""
    from routes.trading_npc_data import generar_caracteristicas, generar_pg
    return {
        "caracteristicas": generar_caracteristicas(payload.get("profesion", "")),
        "ca": 10,
        "pg": generar_pg(),
    }


@router.post("/trading/npcs/generate-name")
async def generate_npc_merchant_name(payload: dict = Body(...)):
    """Genera un nombre coherente con la raza/subcultura/sexo/profesión (IA, con fallback)."""
    raza = payload.get("raza", "")
    subcultura = payload.get("subcultura", "")
    sexo = payload.get("sexo", "Masculino")
    profesion = payload.get("profesion", "")
    sex_label = "masculino" if str(sexo).lower().startswith("m") else "femenino"
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY no configurada")
        prompt = (
            f"Inventa UN solo nombre {sex_label} para un PNJ de la Tierra Media.\n"
            f"Raza: {raza or 'desconocida'}\n"
            f"Cultura/Subcultura: {subcultura or 'desconocida'}\n"
            f"Profesión: {profesion or 'sin definir'}\n\n"
            "Reglas:\n"
            "- Devuelve SOLO el nombre (puede incluir un apellido), sin texto adicional ni comillas.\n"
            "- Respeta la fonética de la cultura (sindarin, khuzdul, rohírrico, hobbit, gondoriano…).\n"
            "- Máximo 3 palabras."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"npc_name_{uuid.uuid4().hex[:8]}",
            system_message="Eres un experto en onomástica de la Tierra Media. Generas nombres breves y evocadores.",
        ).with_model("openai", "gpt-4o-mini")
        resp = await chat.send_message(UserMessage(text=prompt))
        name = (resp or "").strip().strip('"').strip("'").split("\n")[0].strip()
        if not name:
            raise RuntimeError("Respuesta vacía")
        return {"nombre": name}
    except Exception as e:
        logger.warning("Fallback nombre PNJ: %s", e)
        seed = _strip_accents_alnum(subcultura or raza or "anon")[:5].capitalize() or "Anor"
        suf = "ion" if sex_label == "masculino" else "iel"
        return {"nombre": f"{seed}{suf}", "fallback": True}


@router.post("/trading/npcs/generate-profile")
async def generate_npc_profile(payload: dict = Body(...)):
    """FASE 2: redacta trasfondo unificado (texto) y genera el retrato (imagen)."""
    import io, base64
    npc = payload or {}
    nombre = npc.get("nombre") or "el comerciante"
    raza = npc.get("raza", "")
    subcultura = npc.get("subcultura", "")
    sexo = npc.get("sexo", "")
    edad = npc.get("edad", "")
    profesion = npc.get("profesion", "")
    ubicacion = npc.get("ubicacion", "")
    region = npc.get("region", "")
    rasgo = npc.get("rasgo", "")
    rasgo_desc = npc.get("rasgo_descripcion", "")
    modo_hablar = npc.get("modo_hablar", "")
    apariencia = npc.get("apariencia", "")  # detalles físicos libres del usuario

    historia = None
    image_base64 = None
    retrato_file_id = None
    errors = []

    # --- 1) Trasfondo narrativo unificado ---
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY no configurada")
        prompt = (
            "Redacta un trasfondo narrativo breve (2-3 párrafos) para un PNJ comerciante de la "
            "Tierra Media, integrando de forma natural todos estos datos:\n"
            f"- Nombre: {nombre}\n- Raza: {raza}\n- Cultura: {subcultura}\n- Sexo: {sexo}\n"
            f"- Edad: {edad}\n- Profesión: {profesion}\n- Ubicación: {ubicacion} ({region})\n"
            f"- Rasgo de carácter: {rasgo} — {rasgo_desc}\n"
            f"- Modo de hablar: {modo_hablar}\n"
            f"- Detalles físicos indicados por el DJ: {apariencia or 'ninguno'}\n\n"
            "El texto debe ser inmersivo, en español de España, coherente con el tono de El Señor "
            "de los Anillos, y reflejar su rasgo y forma de hablar. No uses encabezados ni listas."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"npc_bio_{uuid.uuid4().hex[:8]}",
            system_message="Eres un escritor de ambientación de la Tierra Media. Redactas trasfondos breves y evocadores.",
        ).with_model("openai", "gpt-4o")
        resp = await chat.send_message(UserMessage(text=prompt))
        historia = (resp or "").strip()
    except Exception as e:
        logger.warning("Trasfondo PNJ falló: %s", e)
        errors.append(f"trasfondo: {e}")

    # --- 2) Retrato (imagen) con prefijo obligatorio ---
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY no configurada")
        detalles = (
            f"{sexo} {raza} ({subcultura}), {edad} años, {profesion}, en {ubicacion}. "
            f"{apariencia}".strip()
        )
        prompt = PORTRAIT_PROMPT_PREFIX + detalles
        image_gen = OpenAIImageGeneration(api_key=api_key)
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if images:
            img_bytes = images[0]
            image_base64 = base64.b64encode(img_bytes).decode("utf-8")
            # Persistir en GridFS para servirlo luego
            try:
                from server import db
                from routes.storage_routes import get_gridfs_bucket
                bucket = get_gridfs_bucket(db)
                fname = f"npc-portraits/{uuid.uuid4().hex}.png"
                file_id = await bucket.upload_from_stream(
                    filename=fname, source=io.BytesIO(img_bytes),
                    metadata={"content_type": "image/png", "folder": "npc-portraits",
                              "tags": ["npc", "merchant", "portrait"], "path": fname},
                )
                retrato_file_id = str(file_id)
            except Exception as e_store:
                logger.warning("No se pudo persistir retrato: %s", e_store)
    except Exception as e:
        logger.warning("Retrato PNJ falló: %s", e)
        errors.append(f"retrato: {e}")

    return {
        "historia": historia,
        "image_base64": image_base64,
        "retrato_file_id": retrato_file_id,
        "errors": errors,
    }


@router.get("/trading/npcs/{npc_id}/portrait")
async def get_npc_portrait(npc_id: str):
    """Sirve el retrato del PNJ (público, para usar en <img>)."""
    import io
    from fastapi.responses import StreamingResponse
    from server import db
    npc = await db.trading_npcs.find_one({"_id": npc_id})
    if not npc or not npc.get("retrato_file_id"):
        raise HTTPException(status_code=404, detail="Sin retrato")
    try:
        from bson import ObjectId
        from routes.storage_routes import get_gridfs_bucket
        bucket = get_gridfs_bucket(db)
        stream = await bucket.open_download_stream(ObjectId(npc["retrato_file_id"]))
        data = await stream.read()
        return StreamingResponse(io.BytesIO(data), media_type="image/png")
    except Exception as e:
        logger.warning("Error sirviendo retrato %s: %s", npc_id, e)
        raise HTTPException(status_code=404, detail="Retrato no disponible")


# ============================================================================
# FASE 3 — Historial de interacción y despedida
# ============================================================================

@router.post("/trading/npcs/{npc_id}/interaction")
async def record_interaction(npc_id: str, payload: dict = Body(...)):
    """Registra una interacción estructurada en el historial de la relación PNJ↔jugador.

    payload: { character_id, interaccion, impacto_modificador }
    (La MATEMÁTICA del modificador se programará en la siguiente actualización.)
    """
    from server import db
    character_id = payload.get("character_id")
    if not character_id:
        raise HTTPException(status_code=400, detail="character_id requerido")

    entry = {
        "tipo": "interaccion",
        "character_id": character_id,
        "interaccion": payload.get("interaccion", ""),
        "impacto_modificador": payload.get("impacto_modificador", 0),
        "fecha": now_utc().isoformat(),
    }

    rel = await db.npc_relationships.find_one({"character_id": character_id, "npc_id": npc_id})
    if rel:
        await db.npc_relationships.update_one(
            {"_id": rel["_id"]},
            {"$push": {"historial": entry}, "$set": {"updated_at": now_utc()}},
        )
        rel_id = str(rel["_id"])
    else:
        rel_id = str(uuid.uuid4())
        await db.npc_relationships.insert_one({
            "_id": rel_id, "character_id": character_id, "npc_id": npc_id,
            "nivel": "desconocido", "penalizacion_precio": 0, "dias_sin_comercio": 0,
            "historial": [entry], "created_at": now_utc(), "updated_at": now_utc(),
        })
    return {"ok": True, "relationship_id": rel_id, "entry": entry}


@router.post("/trading/npcs/{npc_id}/farewell")
async def npc_farewell(npc_id: str, payload: dict = Body(...)):
    """Genera un texto de despedida acorde al modificador acumulado y al historial."""
    from server import db
    character_id = payload.get("character_id")
    npc = await db.trading_npcs.find_one({"_id": npc_id})
    if not npc:
        raise HTTPException(status_code=404, detail="PNJ no encontrado")

    rel = None
    if character_id:
        rel = await db.npc_relationships.find_one({"character_id": character_id, "npc_id": npc_id})
    historial = (rel or {}).get("historial", [])
    # Modificador acumulado de las interacciones registradas.
    modificador = sum(float(h.get("impacto_modificador", 0) or 0)
                      for h in historial if h.get("tipo") == "interaccion")
    nivel = (rel or {}).get("nivel", "neutral")

    if modificador > 2 or nivel in ("amigo", "hermandad", "cordial"):
        tono = "buena (cordial, agradecido)"
    elif modificador < -2 or nivel in ("hostil", "desconocido"):
        tono = "mala (frío, molesto o desconfiado)"
    else:
        tono = "neutra (correcto pero sin afecto)"

    despedida = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise RuntimeError("EMERGENT_LLM_KEY no configurada")
        prompt = (
            f"El comerciante {npc.get('nombre')} ({npc.get('profesion','comerciante')}, "
            f"{npc.get('subcultura','')}) se despide del cliente al terminar de comerciar.\n"
            f"Rasgo: {npc.get('rasgo','')} — {npc.get('rasgo_descripcion','')}\n"
            f"Modo de hablar: {npc.get('modo_hablar','')} ({npc.get('modo_hablar_desc','')})\n"
            f"Relación final: {tono}.\n\n"
            "Genera UNA despedida breve (1-2 frases), en español de España, coherente con su rasgo "
            "y su modo de hablar y con el tono de la relación. Solo el diálogo, sin comillas."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"npc_bye_{uuid.uuid4().hex[:8]}",
            system_message="Eres un generador de diálogos para PNJs de la Tierra Media.",
        ).with_model("openai", "gpt-4o-mini")
        resp = await chat.send_message(UserMessage(text=prompt))
        despedida = (resp or "").strip().strip('"')
    except Exception as e:
        logger.warning("Despedida PNJ fallback: %s", e)
        fallback = {
            "buena (cordial, agradecido)": "Ha sido un placer. ¡Que los caminos te sean propicios!",
            "mala (frío, molesto o desconfiado)": "Hmpf. La puerta está por ahí.",
            "neutra (correcto pero sin afecto)": "Buen viaje. Vuelve cuando lo necesites.",
        }
        despedida = fallback.get(tono, "Buen viaje.")

    return {"despedida": despedida, "tono": tono, "modificador_acumulado": modificador, "nivel": nivel}




# ============================================================================
# RELATIONSHIPS
# ============================================================================

@router.get("/trading/relationships")
async def get_relationships(character_id: str = None, npc_id: str = None):
    """
    Get relationships between characters and NPCs.

    Auto-cleanup: deletes any relationship whose `character_id` no longer
    matches an existing character (`db.characters.id`) or whose `npc_id`
    no longer matches an existing NPC (`db.trading_npcs._id`). This keeps
    the Relaciones tab free of orphan rows pointing to deleted entities.
    """
    from server import db

    query = {}
    if character_id:
        query["character_id"] = character_id
    if npc_id:
        query["npc_id"] = npc_id

    relationships = await db.npc_relationships.find(query).to_list(1000)

    # Build sets of valid IDs to detect orphans.
    valid_char_ids = set()
    async for c in db.characters.find({}, {"_id": 0, "id": 1}):
        if c.get("id"):
            valid_char_ids.add(c["id"])
    valid_npc_ids = set()
    async for n in db.trading_npcs.find({}, {"_id": 1}):
        if n.get("_id"):
            valid_npc_ids.add(str(n["_id"]))

    orphan_ids = []
    valid_relationships = []
    for rel in relationships:
        cid = rel.get("character_id")
        nid = rel.get("npc_id")
        is_orphan = (cid not in valid_char_ids) or (nid not in valid_npc_ids)
        if is_orphan:
            orphan_ids.append(rel["_id"])
            continue
        rel["_id"] = str(rel["_id"])
        valid_relationships.append(rel)

    if orphan_ids:
        await db.npc_relationships.delete_many({"_id": {"$in": orphan_ids}})

    return {
        "relationships": valid_relationships,
        "total": len(valid_relationships),
        "purged_orphans": len(orphan_ids),
    }


@router.delete("/trading/relationships/{rel_id}")
async def delete_relationship(rel_id: str):
    """Delete a single relationship by its `_id`."""
    from server import db
    res = await db.npc_relationships.delete_one({"_id": rel_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Relación no encontrada")
    return {"ok": True, "deleted": rel_id}


@router.post("/trading/relationships")
async def create_or_update_relationship(data: dict = Body(...)):
    """Create or update a relationship"""
    from server import db
    
    character_id = data.get("character_id")
    npc_id = data.get("npc_id")
    
    if not character_id or not npc_id:
        raise HTTPException(status_code=400, detail="character_id y npc_id son requeridos")
    
    existing = await db.npc_relationships.find_one({
        "character_id": character_id,
        "npc_id": npc_id
    })
    
    if existing:
        # Update existing
        rel_val = data.get("relacion_actual", existing.get("relacion_actual", 0))
        try:
            rel_val = max(-100, min(100, int(rel_val)))
        except (TypeError, ValueError):
            rel_val = existing.get("relacion_actual", 0) or 0
        from routes.trading_npc_data import nivel_desde_relacion
        update_data = {
            "relacion_actual": rel_val,
            "nivel": data.get("nivel", nivel_desde_relacion(rel_val)),
            "penalizacion_precio": data.get("penalizacion_precio", existing.get("penalizacion_precio", 0)),
            "dias_sin_comercio": data.get("dias_sin_comercio", existing.get("dias_sin_comercio", 0)),
            "historial": existing.get("historial", []),
            "updated_at": now_utc()
        }
        
        # Add new transaction to history if provided
        if data.get("nueva_transaccion"):
            update_data["historial"].append({
                **data["nueva_transaccion"],
                "fecha": now_utc().isoformat()
            })
        
        await db.npc_relationships.update_one(
            {"_id": existing["_id"]},
            {"$set": update_data}
        )
        
        return {"message": "Relación actualizada", "relationship_id": str(existing["_id"])}
    else:
        # Create new
        from routes.trading_npc_data import nivel_desde_relacion
        rel_val = data.get("relacion_actual", 0)
        try:
            rel_val = max(-100, min(100, int(rel_val)))
        except (TypeError, ValueError):
            rel_val = 0
        relationship = {
            "_id": str(uuid.uuid4()),
            "character_id": character_id,
            "npc_id": npc_id,
            "relacion_actual": rel_val,
            "nivel": data.get("nivel", nivel_desde_relacion(rel_val)),
            "penalizacion_precio": 0,
            "dias_sin_comercio": 0,
            "historial": [],
            "created_at": now_utc(),
            "updated_at": now_utc()
        }
        
        await db.npc_relationships.insert_one(relationship)
        
        return {"message": "Relación creada", "relationship_id": relationship["_id"]}


@router.put("/trading/relationships/{rel_id}/change-level")
async def change_relationship_level(rel_id: str, data: dict = Body(...)):
    """Change relationship level"""
    from server import db
    
    cambio = data.get("cambio", 0)  # positive or negative
    razon = data.get("razon", "")
    
    relationship = await db.npc_relationships.find_one({"_id": rel_id})
    if not relationship:
        raise HTTPException(status_code=404, detail="Relación no encontrada")
    
    # Get config
    config = await db.trading_config.find_one({"_id": "main"})
    levels = config.get("relationship_levels", DEFAULT_RELATIONSHIP_LEVELS) if config else DEFAULT_RELATIONSHIP_LEVELS
    
    # Find current level order
    current_level = relationship.get("nivel", "neutral")
    current_order = levels.get(current_level, {}).get("orden", 3)
    
    # Calculate new order
    new_order = max(1, min(6, current_order + cambio))
    
    # Find level with that order
    new_level = current_level
    for key, val in levels.items():
        if val.get("orden") == new_order:
            new_level = key
            break
    
    # Update
    await db.npc_relationships.update_one(
        {"_id": rel_id},
        {
            "$set": {
                "nivel": new_level,
                "updated_at": now_utc()
            },
            "$push": {
                "historial": {
                    "tipo": "cambio_relacion",
                    "de": current_level,
                    "a": new_level,
                    "razon": razon,
                    "fecha": now_utc().isoformat()
                }
            }
        }
    )
    
    return {
        "message": "Nivel de relación actualizado",
        "nivel_anterior": current_level,
        "nivel_nuevo": new_level
    }


# ============================================================================
# TRADING CALCULATOR
# ============================================================================

@router.post("/trading/calculate")
async def calculate_trade(params: dict = Body(...)):
    """
    Calculate a trade transaction
    
    Params:
        - articulo: dict with nombre, precio_base, categoria, bendicion
        - region: str
        - tipo_asentamiento: str
        - contexto_historico: str
        - relacion: str (relationship level key)
        - oferta: float (player's offer)
        - modo: "compra" or "venta"
        - perfil_comerciante: str (merchant profile key)
    """
    from server import db
    
    # Get config
    config = await db.trading_config.find_one({"_id": "main"})
    if not config:
        config = {
            "relationship_levels": DEFAULT_RELATIONSHIP_LEVELS,
            "blessing_modifiers": DEFAULT_BLESSING_MODIFIERS,
            "merchant_profiles": DEFAULT_MERCHANT_PROFILES,
            "historical_contexts": DEFAULT_HISTORICAL_CONTEXTS,
            "trading_thresholds": DEFAULT_TRADING_THRESHOLDS,
            "contraoferta_factors": DEFAULT_CONTRAOFERTA_FACTORS,
            "anger_consequences": DEFAULT_ANGER_CONSEQUENCES
        }
    
    # Extract params
    articulo = params.get("articulo", {})
    precio_base = articulo.get("precio_base", 0)
    bendicion = articulo.get("bendicion", "ninguna")
    categoria = articulo.get("categoria", "general")
    
    region_mod = params.get("modificador_region", 0)
    asentamiento_mod = params.get("modificador_asentamiento", 0)
    contexto_key = params.get("contexto_historico", "")
    relacion_key = params.get("relacion", "neutral")
    oferta = params.get("oferta", 0)
    modo = params.get("modo", "compra")
    perfil_key = params.get("perfil_comerciante", "normal")
    
    # Step 1: Apply blessing modifier
    blessing_config = config["blessing_modifiers"].get(bendicion, {"modificador": 0})
    precio_con_bendicion = precio_base * (1 + blessing_config["modificador"] / 100)
    
    # Step 2: Apply context modifier
    contexto_config = config["historical_contexts"].get(contexto_key, {})
    contexto_mod = contexto_config.get(f"mod_{categoria}", contexto_config.get("mod_general", 0))
    bono_contexto = contexto_config.get("bono_tirada", 0)
    
    # Step 3: Apply region and settlement modifiers (multiplicative)
    factor_region = 1 + (region_mod / 100)
    factor_asentamiento = 1 + (asentamiento_mod / 100)
    factor_contexto = 1 + (contexto_mod / 100)
    
    precio_mercado = precio_con_bendicion * factor_region * factor_asentamiento * factor_contexto
    
    # Step 4: Apply relationship modifier
    relacion_config = config["relationship_levels"].get(relacion_key, {"mod_compra": 0, "mod_venta": 0, "bono_tirada": 0})
    if modo == "compra":
        factor_relacion = 1 + (relacion_config["mod_compra"] / 100)
    else:
        factor_relacion = 1 + (relacion_config["mod_venta"] / 100)
    bono_relacion = relacion_config["bono_tirada"]
    
    # Step 5: Apply merchant profile modifier
    perfil_config = config["merchant_profiles"].get(perfil_key, {"mod_precio_base": 0, "umbral_enfado": 30})
    factor_perfil = 1 + (perfil_config.get("mod_precio_base", 0) / 100)
    
    precio_justo = precio_mercado * factor_relacion * factor_perfil
    
    # Step 6: Calculate offer difference
    if precio_justo > 0:
        diferencia_porcentual = ((oferta - precio_justo) / precio_justo) * 100
    else:
        diferencia_porcentual = 0
    
    # Step 7: Reaction calculation
    tirada_base = random.randint(1, 100)
    tirada_modificada = tirada_base + bono_relacion + bono_contexto
    
    thresholds = config["trading_thresholds"].get(modo, DEFAULT_TRADING_THRESHOLDS["compra"])
    contraoferta_factor = config["contraoferta_factors"].get(relacion_key, 0.5)
    
    # Determine result
    resultado = calculate_trade_result(
        modo=modo,
        diferencia=diferencia_porcentual,
        tirada=tirada_modificada,
        thresholds=thresholds,
        precio_justo=precio_justo,
        oferta=oferta,
        contraoferta_factor=contraoferta_factor,
        umbral_enfado=perfil_config.get("umbral_enfado", 30)
    )
    
    return {
        "desglose": {
            "precio_base": round(precio_base, 2),
            "precio_con_bendicion": round(precio_con_bendicion, 2),
            "factor_region": factor_region,
            "factor_asentamiento": factor_asentamiento,
            "factor_contexto": factor_contexto,
            "precio_mercado": round(precio_mercado, 2),
            "factor_relacion": factor_relacion,
            "factor_perfil": factor_perfil,
            "precio_justo": round(precio_justo, 2)
        },
        "oferta": oferta,
        "diferencia_porcentual": round(diferencia_porcentual, 2),
        "tirada": {
            "base": tirada_base,
            "bono_relacion": bono_relacion,
            "bono_contexto": bono_contexto,
            "total": tirada_modificada
        },
        "resultado": resultado
    }


def calculate_trade_result(modo, diferencia, tirada, thresholds, precio_justo, oferta, contraoferta_factor, umbral_enfado):
    """Calculate the trade result based on thresholds and dice roll"""
    
    resultado = {
        "tipo": "rechaza",
        "contraoferta": None,
        "cambio_relacion": 0,
        "enfado": None
    }
    
    if modo == "compra":
        # Player is buying - wants to pay less
        if diferencia >= thresholds["zona_aceptacion_auto"]:
            # Good offer - high chance to accept
            if random.randint(1, 100) <= thresholds["prob_acepta_buena_oferta"]:
                resultado["tipo"] = "acepta"
            else:
                # Small counter-offer
                resultado["tipo"] = "contraoferta"
                resultado["contraoferta"] = round(oferta * 1.05, 2)
        
        elif diferencia >= thresholds["zona_negociable_max"]:
            # Negotiable zone
            if tirada > thresholds["tirada_acepta_negociable"]:
                resultado["tipo"] = "acepta"
            elif tirada > thresholds["tirada_contraoferta_negociable"]:
                resultado["tipo"] = "contraoferta"
                resultado["contraoferta"] = round(precio_justo + (oferta - precio_justo) * contraoferta_factor, 2)
            else:
                resultado["tipo"] = "rechaza"
        
        elif diferencia >= thresholds["zona_riesgo_max"]:
            # Risk zone
            if tirada > thresholds["tirada_contraoferta_riesgo"]:
                resultado["tipo"] = "contraoferta"
                resultado["contraoferta"] = round(precio_justo + (oferta - precio_justo) * contraoferta_factor * 0.5, 2)
            elif tirada > thresholds["tirada_rechaza_riesgo"]:
                resultado["tipo"] = "rechaza"
            else:
                resultado["tipo"] = "enfado"
                resultado["enfado"] = "leve"
                resultado["cambio_relacion"] = -1
        
        else:
            # Insult zone
            if random.randint(1, 100) <= thresholds["prob_enfado_muy_baja"]:
                if tirada < umbral_enfado:
                    resultado["tipo"] = "enfado"
                    resultado["enfado"] = "severo"
                    resultado["cambio_relacion"] = -2
                else:
                    resultado["tipo"] = "enfado"
                    resultado["enfado"] = "moderado"
                    resultado["cambio_relacion"] = -1
            else:
                resultado["tipo"] = "rechaza"
    
    else:
        # Player is selling - wants to get more
        if diferencia <= thresholds["zona_aceptacion_auto"]:
            # Good price for NPC
            if random.randint(1, 100) <= thresholds["prob_acepta_buena_oferta"]:
                resultado["tipo"] = "acepta"
            else:
                resultado["tipo"] = "contraoferta"
                resultado["contraoferta"] = round(oferta * 0.95, 2)
        
        elif diferencia <= thresholds["zona_negociable_max"]:
            if tirada > thresholds["tirada_acepta_negociable"]:
                resultado["tipo"] = "acepta"
            elif tirada > thresholds["tirada_contraoferta_negociable"]:
                resultado["tipo"] = "contraoferta"
                resultado["contraoferta"] = round(precio_justo + (oferta - precio_justo) * contraoferta_factor, 2)
            else:
                resultado["tipo"] = "rechaza"
        
        elif diferencia <= thresholds["zona_riesgo_max"]:
            if tirada > thresholds["tirada_contraoferta_riesgo"]:
                resultado["tipo"] = "contraoferta"
                resultado["contraoferta"] = round(precio_justo + (oferta - precio_justo) * contraoferta_factor * 0.5, 2)
            elif tirada > thresholds["tirada_rechaza_riesgo"]:
                resultado["tipo"] = "rechaza"
            else:
                resultado["tipo"] = "enfado"
                resultado["enfado"] = "leve"
                resultado["cambio_relacion"] = -1
        
        else:
            if random.randint(1, 100) <= thresholds.get("prob_enfado_muy_alta", 65):
                if tirada < umbral_enfado:
                    resultado["tipo"] = "enfado"
                    resultado["enfado"] = "severo"
                    resultado["cambio_relacion"] = -2
                else:
                    resultado["tipo"] = "enfado"
                    resultado["enfado"] = "moderado"
                    resultado["cambio_relacion"] = -1
            else:
                resultado["tipo"] = "rechaza"
    
    return resultado



# ============================================================================
# LLM DIALOGUE GENERATION
# ============================================================================

async def generate_npc_dialogue_llm(
    npc: dict,
    resultado: dict,
    modo: str,
    articulo: dict,
    precio_justo: float,
    oferta: float,
    relacion: str
) -> str:
    """Generate NPC dialogue using LLM"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            logger.warning("EMERGENT_LLM_KEY not found, using fallback dialogue")
            return None
        
        # Build context for the LLM
        perfil = npc.get("perfil_comerciante", "normal")
        rasgo = npc.get("rasgo", "") or npc.get("personalidad", "")
        rasgo_desc = npc.get("rasgo_descripcion", "")
        modo_hablar = npc.get("modo_hablar", "")
        modo_hablar_desc = npc.get("modo_hablar_desc", "")
        ocupacion = npc.get("profesion") or npc.get("ocupacion", "comerciante")
        subcultura = npc.get("subcultura", "")
        edad = npc.get("edad", "")
        historia = (npc.get("historia") or "")[:600]
        
        resultado_tipo = resultado.get("tipo", "rechaza")
        enfado = resultado.get("enfado", None)
        contraoferta = resultado.get("contraoferta", None)
        
        accion = "comprar" if modo == "compra" else "vender"
        item_nombre = articulo.get("nombre", "el artículo")
        
        # Create prompt
        prompt = f"""Eres un PNJ comerciante en un juego de rol de El Señor de los Anillos.

DATOS DEL PNJ:
- Ocupación: {ocupacion}
- Cultura/Subcultura: {subcultura}
- Edad: {edad}
- Perfil de comerciante: {perfil}
- Rasgo de carácter: {rasgo} — {rasgo_desc}
- Modo de hablar: {modo_hablar} ({modo_hablar_desc})
- Trasfondo: {historia}

SITUACIÓN:
- El jugador quiere {accion} "{item_nombre}"
- Precio justo: {precio_justo:.2f} monedas
- Oferta del jugador: {oferta:.2f} monedas
- Relación con el jugador: {relacion}

RESULTADO DE LA NEGOCIACIÓN:
- Decisión: {resultado_tipo}
{f'- Nivel de enfado: {enfado}' if enfado else ''}
{f'- Contraoferta propuesta: {contraoferta:.2f} monedas' if contraoferta else ''}

INSTRUCCIONES:
Genera UNA SOLA frase corta (máximo 2 oraciones) que el PNJ diría en esta situación, reflejando SU RASGO de carácter y SU MODO DE HABLAR concreto, además del resultado.
- Si acepta: muestra satisfacción o resignación según el precio
- Si rechaza: explica brevemente por qué no le interesa
- Si hace contraoferta: propone el nuevo precio de forma natural
- Si está enfadado: muestra su molestia según la severidad

Responde SOLO con el diálogo del PNJ, sin comillas ni acotaciones."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"trade-{uuid.uuid4().hex[:8]}",
            system_message="Eres un generador de diálogos para NPCs de un juego de rol ambientado en la Tierra Media. Genera diálogos breves, inmersivos y acordes al tono del Señor de los Anillos."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return response.strip() if response else None
        
    except Exception as e:
        logger.error(f"Error generating NPC dialogue: {e}")
        return None


def generate_fallback_dialogue(resultado: dict, modo: str, npc: dict) -> str:
    """Generate fallback dialogue without LLM"""
    tipo = resultado.get("tipo", "rechaza")
    enfado = resultado.get("enfado", None)
    contraoferta = resultado.get("contraoferta", None)
    perfil = npc.get("perfil_comerciante", "normal")
    
    dialogos = {
        "acepta": {
            "normal": ["Trato hecho.", "Me parece justo.", "De acuerdo, es un buen precio."],
            "codicioso": ["Hmm... supongo que está bien.", "Acepto, aunque me deja poco margen."],
            "honorable": ["Es un trato justo. Que los Valar bendigan nuestro comercio.", "Acepto con gusto."],
            "desesperado": ["¡Sí, sí, acepto!", "Gracias, de verdad lo necesito."],
            "mercader_experto": ["Reconozco una buena oferta. Acepto.", "Bien jugado. Trato hecho."],
            "contrabandista": ["Rápido, antes de que cambie de opinión.", "Hecho. Y no me viste."]
        },
        "rechaza": {
            "normal": ["No, gracias.", "No me interesa a ese precio.", "Vuelve cuando tengas una oferta seria."],
            "codicioso": ["¿Eso es todo? No me hagas perder el tiempo.", "Ni lo sueñes."],
            "honorable": ["Me temo que no puedo aceptar eso.", "No sería un trato justo."],
            "desesperado": ["Incluso yo tengo límites...", "Lo siento, no puedo bajar tanto."],
            "mercader_experto": ["Eso está muy lejos del valor real.", "Veo que no conoces el mercado."],
            "contrabandista": ["¿Me tomas por tonto?", "Busca a otro primo."]
        },
        "contraoferta": {
            "normal": [f"¿Qué te parece {contraoferta:.2f}?", f"Podríamos acordar {contraoferta:.2f}."],
            "codicioso": [f"Lo mínimo que aceptaría es {contraoferta:.2f}.", f"{contraoferta:.2f}, ni una moneda menos."],
            "honorable": [f"Un precio justo sería {contraoferta:.2f}.", f"Te propongo {contraoferta:.2f} y ambos salimos ganando."],
            "desesperado": [f"¿Y si lo dejamos en {contraoferta:.2f}?", f"Mira, te lo dejo en {contraoferta:.2f}."],
            "mercader_experto": [f"El precio justo es {contraoferta:.2f}.", f"Basándome en el mercado: {contraoferta:.2f}."],
            "contrabandista": [f"{contraoferta:.2f}, tómalo o déjalo.", f"Mi última oferta: {contraoferta:.2f}."]
        },
        "enfado": {
            "leve": {
                "normal": ["Me estás haciendo perder la paciencia.", "Eso es insultante."],
                "codicioso": ["¡Fuera de mi tienda!", "¡No me hagas enfadar!"],
                "honorable": ["Eso ofende mi honor.", "Esperaba más de ti."],
                "desesperado": ["Incluso en mi situación, eso es demasiado poco.", "Me hieres con esa oferta."],
                "mercader_experto": ["Me decepciona tu falta de conocimiento.", "Eso es ridículo."],
                "contrabandista": ["No me vengas con esas.", "Te estás buscando problemas."]
            },
            "moderado": {
                "normal": ["¡No vuelvas hasta que aprendas a negociar!", "¡Largo de aquí!"],
                "codicioso": ["¡FUERA! ¡No quiero verte más!", "¡Me tomas por idiota!"],
                "honorable": ["Has deshonrado nuestro trato. Vete.", "Esto termina aquí."],
                "desesperado": ["¡Por muy desesperado que esté, no soy estúpido!", "¡Vete!"],
                "mercader_experto": ["Claramente no mereces mi tiempo.", "Nuestro negocio ha terminado."],
                "contrabandista": ["Acabas de hacer un enemigo.", "Vas a arrepentirte de esto."]
            },
            "severo": {
                "normal": ["¡Guardias! ¡Echad a este sinvergüenza!", "¡Jamás vuelvas a pisar mi tienda!"],
                "codicioso": ["¡Te voy a hacer la vida imposible en esta ciudad!", "¡Me las pagarás!"],
                "honorable": ["Has demostrado ser indigno de confianza. Nunca más.", "Que los Valar sean testigos de tu deshonra."],
                "desesperado": ["¡Maldito seas! ¡Aléjate de mí!", "¡Nunca olvidaré esta afrenta!"],
                "mercader_experto": ["Tu reputación quedará arruinada en todo el mercado.", "Todos sabrán lo que has hecho."],
                "contrabandista": ["Acabas de firmarte tu sentencia.", "Mis contactos sabrán de esto."]
            }
        }
    }
    
    if tipo == "enfado" and enfado:
        opciones = dialogos.get("enfado", {}).get(enfado, {}).get(perfil, ["¡Fuera!"])
    else:
        opciones = dialogos.get(tipo, {}).get(perfil, ["..."])
    
    return random.choice(opciones) if opciones else "..."


@router.post("/trading/calculate-with-dialogue")
async def calculate_trade_with_dialogue(params: dict = Body(...)):
    """
    Calculate a trade transaction AND generate NPC dialogue
    """
    from server import db
    
    # First, do the normal calculation
    result = await calculate_trade(params)
    
    # Get NPC data if provided
    npc_id = params.get("npc_id")
    npc = None
    
    if npc_id:
        npc = await db.trading_npcs.find_one({"_id": npc_id})
    
    if not npc:
        npc = {
            "perfil_comerciante": params.get("perfil_comerciante", "normal"),
            "personalidad": "",
            "modo_hablar": "",
            "ocupacion": "comerciante"
        }
    
    # Try to generate LLM dialogue
    articulo = params.get("articulo", {})
    llm_dialogue = await generate_npc_dialogue_llm(
        npc=npc,
        resultado=result["resultado"],
        modo=params.get("modo", "compra"),
        articulo=articulo,
        precio_justo=result["desglose"]["precio_justo"],
        oferta=params.get("oferta", 0),
        relacion=params.get("relacion", "neutral")
    )
    
    # Use fallback if LLM failed
    if llm_dialogue:
        result["dialogo"] = llm_dialogue
        result["dialogo_fuente"] = "llm"
    else:
        result["dialogo"] = generate_fallback_dialogue(
            result["resultado"], 
            params.get("modo", "compra"),
            npc
        )
        result["dialogo_fuente"] = "fallback"
    
    return result


# ============================================================================
# CONFIRM TRANSACTION — applies the trade to the character (inventory + money)
# ============================================================================

def _norm(s: str) -> str:
    import unicodedata as _ud
    return ''.join(c for c in _ud.normalize('NFD', (s or '').lower()) if _ud.category(c) != 'Mn').strip()


def _has_saddlebags(character: dict) -> bool:
    """True si alguna montura del personaje lleva alforjas."""
    for m in (character.get("monturas") or []):
        for it in (m.get("equipo") or []):
            nombre = it.get("nombre") if isinstance(it, dict) else it
            if "alforja" in _norm(nombre):
                return True
    return False


@router.post("/trading/confirm-transaction")
async def confirm_transaction(payload: dict = Body(...)):
    """Aplica una transacción de compra/venta YA negociada al personaje.

    - COMPRA: descuenta el dinero acordado y añade el artículo al personaje.
    - VENTA: elimina el artículo del personaje y suma el dinero acordado.

    Devuelve avisos (mochila/petate, montura, sobrecarga) y el resumen de peso
    recalculado.
    """
    from server import db
    from routes.character.equipment import (
        add_equipment_to_character,
        remove_equipment_from_character,
        _compute_weight_summary,
    )
    from routes.character._common import (
        AddEquipmentRequest, convert_to_base, convert_from_base, price_to_base,
    )

    character_id = payload.get("character_id")
    modo = payload.get("modo", "compra")
    articulo = payload.get("articulo") or {}
    cantidad = max(1, int(payload.get("cantidad") or 1))
    precio_total = float(payload.get("precio_total") or 0)
    moneda = payload.get("moneda") or "mp"

    if not character_id:
        raise HTTPException(status_code=400, detail="character_id es requerido")
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    nombre = (articulo.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El artículo no tiene nombre")
    categoria = articulo.get("categoria_catalogo") or articulo.get("_categoria") or "general"
    is_mount = (categoria == "monturas")
    lower = _norm(nombre)

    dinero_actual = character.get("dinero", {"mo": 0, "mp": 0, "me": 0, "mc": 0})
    dinero_base = convert_to_base(dinero_actual)
    precio_base_total = price_to_base(precio_total, moneda)

    warnings = []
    now_iso = datetime.now(timezone.utc).isoformat()

    if modo == "compra":
        if dinero_base < precio_base_total:
            raise HTTPException(
                status_code=400,
                detail=f"Dinero insuficiente: el coste es {precio_total} {moneda} y el personaje no tiene suficiente.",
            )
        # 1) Descontar dinero
        await db.characters.update_one(
            {"_id": character_id},
            {"$set": {"dinero": convert_from_base(dinero_base - precio_base_total), "updated_at": now_iso}},
        )
        # 2) Colocar el artículo (sin coste, ya descontado arriba)
        req = AddEquipmentRequest(
            item_name=nombre,
            item_category=categoria,
            cantidad=cantidad,
            is_purchase=False,
            peso_kg=articulo.get("peso_kg"),
            capacidad_carga=articulo.get("capacidad_carga"),
        )
        await add_equipment_to_character(character_id, req)
        message = f"Compra confirmada: {nombre} ×{cantidad} por {precio_total} {moneda}."
        if is_mount:
            warnings.append(
                "Recuerda equipar la montura: necesita silla de montar, arnés/bocado y bridas. "
                "Para cargar peso necesita alforjas. Sin silla, solo los Elfos pueden montar con soltura."
            )
    else:  # venta
        mount_equipo_moved = 0
        if is_mount:
            monturas = list(character.get("monturas") or [])
            idx = next(
                (i for i, m in enumerate(monturas)
                 if _norm(m.get("nombre_original") or m.get("nombre")) == lower
                 or _norm(m.get("nombre_personalizado")) == lower),
                None,
            )
            if idx is not None:
                mequipo = list(monturas[idx].get("equipo") or [])
                if mequipo:
                    inv = list(character.get("inventario") or [])
                    for it in mequipo:
                        if isinstance(it, dict):
                            it = {**it, "portado_por": "personaje", "mount_id": None}
                        inv.append(it)
                    await db.characters.update_one(
                        {"_id": character_id},
                        {"$set": {"inventario": inv, "updated_at": now_iso}},
                    )
                    mount_equipo_moved = len(mequipo)
        # Eliminar el artículo (lanza 404 si no lo tiene)
        try:
            await remove_equipment_from_character(
                character_id, item_name=nombre, item_category=categoria, cantidad=cantidad
            )
        except HTTPException as e:
            if e.status_code == 404:
                raise HTTPException(status_code=404, detail=f"El personaje no posee '{nombre}' para vender.")
            raise
        # Sumar el dinero acordado
        char_after = await db.characters.find_one({"_id": character_id})
        dinero_base_after = convert_to_base(char_after.get("dinero", {"mo": 0, "mp": 0, "me": 0, "mc": 0}))
        await db.characters.update_one(
            {"_id": character_id},
            {"$set": {"dinero": convert_from_base(dinero_base_after + precio_base_total), "updated_at": now_iso}},
        )
        message = f"Venta confirmada: {nombre} ×{cantidad} por {precio_total} {moneda}."
        if is_mount:
            if mount_equipo_moved:
                warnings.append(f"La carga de la montura ({mount_equipo_moved} objeto/s) pasa ahora al personaje.")
            warnings.append("Al vender la montura, todo su peso recae sobre el personaje. Revisa el estado de carga.")
        if "mochila" in lower or "petate" in lower:
            if not _has_saddlebags(character):
                warnings.append(
                    "Sin mochila/petate y sin alforjas en una montura, el personaje solo puede portar lo que lleva "
                    "equipado. El resto del equipo debería dejarse atrás."
                )

    # Resumen de peso recalculado + avisos de sobrecarga
    updated = await db.characters.find_one({"_id": character_id})
    ws = await _compute_weight_summary(updated)
    estado = ws.get("estado_carga")
    peso = ws.get("peso_personaje", 0)
    if estado == "muy_cargado":
        warnings.append(
            f"⚠️ El personaje queda MUY CARGADO ({peso} / {ws.get('limite_muy_cargado')} kg): "
            "velocidad reducida y desventaja en pruebas/salvaciones de fuerza y destreza."
        )
    elif estado == "cargado":
        warnings.append(f"El personaje queda Cargado ({peso} / {ws.get('limite_cargado')} kg): velocidad reducida.")
    cap_max = ws.get("capacidad_personaje", 0)
    if cap_max and peso > cap_max:
        warnings.append(
            f"🛑 El peso transportado ({peso} kg) supera la capacidad máxima ({cap_max} kg): "
            "el personaje NO puede moverse hasta soltar carga."
        )
    if ws.get("montura_sobrecargada"):
        warnings.append("⚠️ La montura está sobrecargada: no puede cargar más peso.")

    from routes.character._common import serialize_doc
    return {
        "message": message,
        "character": serialize_doc(updated),
        "weight_summary": ws,
        "dinero": updated.get("dinero"),
        "warnings": warnings,
    }
