"""
NPC Generator routes — generates NPC stat blocks, names and portraits
based on subculture / sex / occupation.

Endpoints under `/api/npc-generator`:
  GET  /occupations                 — listado de ocupaciones de "enemigo"
                                      (combina ocupaciones del creador + Reglas → Salarios)
  POST /generate                    — genera bloque de stats completo
  POST /name                        — genera nombre IA por subcultura/sexo/ocupación
  POST /portrait                    — genera retrato B&N carboncillo

Architectural notes:
  - El generador usa el array estándar (14, 13, 12, 10, 10, 9) repartido según el
    arquetipo de la ocupación (priorizando atributos clave).
  - HP = dado_de_golpe + mod CON (nivel 1). Para niveles superiores se promedia.
  - CA = 10 + DES_mod + armor_bonus (limitado por DEX cap de la armadura).
  - Las ocupaciones del creador de personajes traen sus tiradas de salvación;
    las ocupaciones de Salarios sólo nombre (sin TS reglamentadas).
"""
from __future__ import annotations

import os
import random
import logging
import uuid
import io
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from auth import get_current_user, require_role


ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/npc-generator", tags=["npc-generator"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# ============================================================================
# Stat-generation rules
# ============================================================================

STANDARD_ARRAY = [14, 13, 12, 10, 10, 9]
ATTR_KEYS = ["FUE", "DES", "CON", "INT", "SAB", "CAR"]

# Each archetype defines:
#   stats_priority — orden en el que se asignan los valores del array.
#   hp_die — dado de golpe (6, 8, 10, 12).
#   armor — ['ninguna','tela','cuero','cuero_tach','cota_anillas','cota','placas']
#   weapons — armas por defecto.
#   languages — idiomas por defecto (slugs); además se añade el de la cultura.
#   has_shield — bool.
ARCHETYPES: Dict[str, Dict[str, Any]] = {
    "guerrero": {
        "stats_priority": ["FUE", "CON", "DES", "CAR", "SAB", "INT"],
        "hp_die": 10,
        "armor": "cota",
        "weapons": ["Espada larga", "Daga"],
        "has_shield": True,
        "ts": ["FUE", "CON"],
        "skills": ["Atletismo", "Intimidación"],
    },
    "campeon": {
        "stats_priority": ["FUE", "DES", "CON", "CAR", "SAB", "INT"],
        "hp_die": 10,
        "armor": "cota",
        "weapons": ["Hacha de guerra"],
        "has_shield": True,
        "ts": ["FUE", "CON"],
        "skills": ["Atletismo", "Percepción"],
    },
    "capitan": {
        "stats_priority": ["FUE", "CAR", "CON", "DES", "SAB", "INT"],
        "hp_die": 10,
        "armor": "cota",
        "weapons": ["Espada larga"],
        "has_shield": True,
        "ts": ["CON", "CAR"],
        "skills": ["Persuasión", "Intimidación"],
    },
    "saqueador": {
        "stats_priority": ["DES", "CON", "FUE", "CAR", "SAB", "INT"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Cimitarra", "Arco corto"],
        "has_shield": False,
        "ts": ["DES", "INT"],
        "skills": ["Sigilo", "Juego de manos"],
    },
    "cazador": {
        "stats_priority": ["DES", "SAB", "CON", "FUE", "CAR", "INT"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Arco largo", "Daga"],
        "has_shield": False,
        "ts": ["FUE", "DES"],
        "skills": ["Cazar", "Sigilo", "Percepción"],
    },
    "explorador": {
        "stats_priority": ["DES", "SAB", "CON", "FUE", "INT", "CAR"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Espada corta", "Arco largo"],
        "has_shield": False,
        "ts": ["FUE", "DES"],
        "skills": ["Naturaleza", "Sigilo", "Viajar"],
    },
    "espia": {
        "stats_priority": ["DES", "INT", "CAR", "CON", "SAB", "FUE"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Daga", "Ballesta de mano"],
        "has_shield": False,
        "ts": ["DES", "INT"],
        "skills": ["Engaño", "Sigilo", "Perspicacia"],
    },
    "asesino": {
        "stats_priority": ["DES", "INT", "CON", "CAR", "SAB", "FUE"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Daga", "Daga"],
        "has_shield": False,
        "ts": ["DES", "INT"],
        "skills": ["Sigilo", "Acrobacias"],
    },
    "hechicero": {
        "stats_priority": ["CAR", "CON", "INT", "SAB", "DES", "FUE"],
        "hp_die": 6,
        "armor": "ninguna",
        "weapons": ["Bastón", "Daga"],
        "has_shield": False,
        "ts": ["CON", "CAR"],
        "skills": ["Engaño", "Persuasión"],
    },
    "mago": {
        "stats_priority": ["INT", "CON", "SAB", "DES", "CAR", "FUE"],
        "hp_die": 6,
        "armor": "ninguna",
        "weapons": ["Bastón", "Daga"],
        "has_shield": False,
        "ts": ["INT", "SAB"],
        "skills": ["Saber antiguo", "Investigación"],
    },
    "sacerdote_oscuro": {
        "stats_priority": ["SAB", "CON", "CAR", "INT", "FUE", "DES"],
        "hp_die": 8,
        "armor": "cota_anillas",
        "weapons": ["Maza"],
        "has_shield": True,
        "ts": ["SAB", "CAR"],
        "skills": ["Religión", "Intimidación"],
    },
    "erudito": {
        "stats_priority": ["INT", "SAB", "CON", "CAR", "DES", "FUE"],
        "hp_die": 6,
        "armor": "tela",
        "weapons": ["Daga"],
        "has_shield": False,
        "ts": ["INT", "SAB"],
        "skills": ["Saber antiguo", "Investigación", "Acertijos"],
    },
    "campesino": {
        "stats_priority": ["CON", "FUE", "SAB", "DES", "CAR", "INT"],
        "hp_die": 6,
        "armor": "ninguna",
        "weapons": ["Garrote"],
        "has_shield": False,
        "ts": [],
        "skills": ["Atletismo"],
    },
    "artesano": {
        "stats_priority": ["DES", "CON", "INT", "SAB", "FUE", "CAR"],
        "hp_die": 6,
        "armor": "cuero",
        "weapons": ["Martillo", "Daga"],
        "has_shield": False,
        "ts": [],
        "skills": ["Naturaleza"],
    },
    "noble": {
        "stats_priority": ["CAR", "INT", "DES", "CON", "SAB", "FUE"],
        "hp_die": 8,
        "armor": "cuero_tach",
        "weapons": ["Estoque"],
        "has_shield": False,
        "ts": [],
        "skills": ["Persuasión", "Engaño"],
    },
    "lider": {
        "stats_priority": ["CAR", "FUE", "CON", "DES", "SAB", "INT"],
        "hp_die": 10,
        "armor": "cota",
        "weapons": ["Espada larga"],
        "has_shield": True,
        "ts": ["CON", "CAR"],
        "skills": ["Persuasión", "Intimidación"],
    },
    "buscador_tesoros": {
        "stats_priority": ["DES", "INT", "CON", "CAR", "SAB", "FUE"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Espada corta", "Arco corto"],
        "has_shield": False,
        "ts": ["DES", "INT"],
        "skills": ["Sigilo", "Investigación"],
    },
    "tesorero": {
        "stats_priority": ["DES", "INT", "CON", "CAR", "SAB", "FUE"],
        "hp_die": 8,
        "armor": "cuero",
        "weapons": ["Espada corta"],
        "has_shield": False,
        "ts": ["DES", "INT"],
        "skills": ["Investigación", "Engaño"],
    },
    "mensajero": {
        "stats_priority": ["DES", "CAR", "CON", "INT", "SAB", "FUE"],
        "hp_die": 6,
        "armor": "cuero",
        "weapons": ["Espada corta"],
        "has_shield": False,
        "ts": [],
        "skills": ["Persuasión", "Acrobacias"],
    },
}

# Friendly labels for UI dropdowns
ARCHETYPE_LABELS = {
    "guerrero": "Guerrero",
    "campeon": "Campeón",
    "capitan": "Capitán",
    "saqueador": "Saqueador",
    "cazador": "Cazador",
    "explorador": "Explorador",
    "espia": "Espía",
    "asesino": "Asesino",
    "hechicero": "Hechicero",
    "mago": "Mago",
    "sacerdote_oscuro": "Sacerdote oscuro",
    "erudito": "Erudito",
    "campesino": "Campesino",
    "artesano": "Artesano",
    "noble": "Noble",
    "lider": "Líder",
    "buscador_tesoros": "Buscador de tesoros",
    "tesorero": "Tesorero",
    "mensajero": "Mensajero",
}

# Mapping from common occupation names (creator + salarios) → archetype slug
NAME_TO_ARCHETYPE = {
    # Creator (player) occupations
    "campeón": "campeon",
    "campeon": "campeon",
    "capitán": "capitan",
    "capitan": "capitan",
    "buscador de tesoros": "buscador_tesoros",
    "cazador": "cazador",
    "explorador": "explorador",
    "guerrero": "guerrero",
    "erudito": "erudito",
    "embaucador": "saqueador",
    # Salarios occupations
    "campesino": "campesino",
    "leñador": "campesino",
    "lenador": "campesino",
    "peón de construcción": "campesino",
    "peon de construccion": "campesino",
    "herrero": "artesano",
    "carpintero": "artesano",
    "albañil": "artesano",
    "albanil": "artesano",
    "tabernero": "campesino",
    "panadero": "artesano",
    "pescador": "campesino",
    "tejedor": "artesano",
    "marinero": "campesino",
    "alfarero": "artesano",
    "capitán de la guardia": "capitan",
    "capitan de la guardia": "capitan",
    "caballero de gondor": "guerrero",
    "mercenario": "guerrero",
    "asesino a sueldo": "asesino",
    "espía": "espia",
    "espia": "espia",
    "enano herrero": "artesano",
    "elfo artesano": "artesano",
    "mago errante": "mago",
    "noble": "noble",
}

ARMOR_DATA: Dict[str, Dict[str, Any]] = {
    "ninguna": {"base": 0, "dex_cap": 99, "label": "Sin armadura"},
    "tela": {"base": 1, "dex_cap": 99, "label": "Vestiduras"},
    "cuero": {"base": 1, "dex_cap": 99, "label": "Coleto de cuero"},
    "cuero_tach": {"base": 2, "dex_cap": 99, "label": "Cuero tachonado"},
    "cota_anillas": {"base": 4, "dex_cap": 2, "label": "Cota de anillas"},
    "cota": {"base": 6, "dex_cap": 2, "label": "Cota de malla"},
    "placas": {"base": 8, "dex_cap": 0, "label": "Placas"},
}


def _attr_mod(value: int) -> int:
    return (value - 10) // 2


def _resolve_archetype(occupation_name: str, fallback: str = "campesino") -> str:
    if not occupation_name:
        return fallback
    key = occupation_name.strip().lower()
    # Direct archetype key match (e.g. "saqueador" → "saqueador")
    if key in ARCHETYPES:
        return key
    # Direct archetype label match (e.g. "Saqueador" → "saqueador")
    for slug, label in ARCHETYPE_LABELS.items():
        if label.strip().lower() == key:
            return slug
    return NAME_TO_ARCHETYPE.get(key, fallback)


def _generate_stats(archetype: str) -> Dict[str, int]:
    """Distribute the standard array (14,13,12,10,10,9) by archetype priority,
    swapping a couple of the mid values randomly so siblings of same archetype
    aren't carbon copies."""
    arch = ARCHETYPES.get(archetype, ARCHETYPES["campesino"])
    array = STANDARD_ARRAY.copy()
    # Light randomness on the bottom three (10/10/9) to avoid stale clones
    bottom = array[3:]  # 10, 10, 9
    random.shuffle(bottom)
    array = array[:3] + bottom
    stats = {}
    for i, attr in enumerate(arch["stats_priority"]):
        stats[attr] = array[i]
    # Defensive: ensure all keys are present
    for k in ATTR_KEYS:
        stats.setdefault(k, 10)
    return stats


def _hp_for_level(hp_die: int, con_mod: int, level: int) -> int:
    """Lvl 1 = full die + CON. Following levels = avg(die)+CON each."""
    avg = (hp_die // 2) + 1
    if level <= 1:
        return max(1, hp_die + con_mod)
    return max(1, hp_die + con_mod + (level - 1) * (avg + con_mod))


def _ca_for(armor: str, dex_mod: int, has_shield: bool) -> int:
    a = ARMOR_DATA.get(armor, ARMOR_DATA["ninguna"])
    capped_dex = min(dex_mod, a["dex_cap"])
    ca = 10 + a["base"] + capped_dex
    if has_shield:
        ca += 2
    return ca


# ============================================================================
# Pydantic models
# ============================================================================

class GenerateRequest(BaseModel):
    subculture_id: Optional[str] = None
    subculture_name: Optional[str] = None
    sex: Optional[str] = "M"  # 'M' | 'F'
    occupation: str = "campesino"
    level: int = Field(default=1, ge=1, le=20)
    mode: str = "especial"  # 'generico' | 'especial'


class NameRequest(BaseModel):
    subculture_id: Optional[str] = None
    subculture_name: Optional[str] = None
    sex: Optional[str] = "M"
    occupation: Optional[str] = ""


class PortraitRequest(BaseModel):
    subculture_id: Optional[str] = None
    subculture_name: Optional[str] = None
    sex: Optional[str] = "M"
    occupation: Optional[str] = ""
    age: Optional[str] = ""
    eyes: Optional[str] = ""
    hair: Optional[str] = ""
    extra: Optional[str] = ""
    full_body: Optional[bool] = True


# ============================================================================
# Helpers — load subculture data
# ============================================================================
async def _load_subculture(subculture_id: Optional[str], subculture_name: Optional[str]) -> Optional[dict]:
    """Find a subculture across all `cultures` documents."""
    cursor = db.cultures.find({}, {"_id": 0})
    async for cul in cursor:
        for sub in (cul.get("subculturas") or cul.get("subcultures") or []):
            sname = sub.get("nombre") or sub.get("name") or ""
            if subculture_id and sub.get("id") == subculture_id:
                return {"culture": cul, "subculture": sub}
            if subculture_name and sname.strip().lower() == subculture_name.strip().lower():
                return {"culture": cul, "subculture": sub}
    return None


# ============================================================================
# /occupations — combined occupations list
# ============================================================================
@router.get("/occupations")
async def list_occupations(user: dict = Depends(get_current_user)):
    """Return a combined list of NPC enemy occupations: creator vocations
    (with TS) + salarios occupations (no TS)."""
    items: List[dict] = []
    seen = set()

    # 1) Creator occupations (vocaciones) — bring tiradas_salvacion
    cursor = db.occupations.find({}, {"_id": 0})
    async for oc in cursor:
        name = (oc.get("vocacion") or "").strip()
        if not name:
            continue
        archetype = _resolve_archetype(name, fallback="guerrero")
        items.append({
            "name": name,
            "source": "creator",
            "archetype": archetype,
            "tiradas_salvacion": oc.get("tiradas_salvacion") or [],
            "has_saving_throws": True,
            "dado_golpe": oc.get("dado_golpe") or "",
        })
        seen.add(name.strip().lower())

    # 2) Salarios occupations — names only (no TS)
    sal_doc = await db.salarios.find_one({"_id": "main"}, {"_id": 0})
    if sal_doc:
        for cat_key, cat_items in (sal_doc.get("categorias") or {}).items():
            if not isinstance(cat_items, list):
                continue
            for it in cat_items:
                name = (it.get("ocupacion") or it.get("nombre") or "").strip()
                if not name or name.lower() in seen:
                    continue
                archetype = _resolve_archetype(name, fallback="campesino")
                items.append({
                    "name": name,
                    "source": f"salarios:{cat_key}",
                    "archetype": archetype,
                    "tiradas_salvacion": [],
                    "has_saving_throws": False,
                    "dado_golpe": "",
                })
                seen.add(name.lower())

    # 3) Built-in archetypes that may not appear elsewhere
    for slug, label in ARCHETYPE_LABELS.items():
        if label.strip().lower() in seen:
            continue
        items.append({
            "name": label,
            "source": "archetype",
            "archetype": slug,
            "tiradas_salvacion": ARCHETYPES[slug].get("ts", []),
            "has_saving_throws": bool(ARCHETYPES[slug].get("ts")),
            "dado_golpe": f"1d{ARCHETYPES[slug]['hp_die']}",
        })
        seen.add(label.strip().lower())

    # Sort alphabetically
    items.sort(key=lambda x: x["name"].lower())
    return {"occupations": items, "archetypes": ARCHETYPE_LABELS}


# ============================================================================
# /generate — full stat block
# ============================================================================
@router.post("/generate")
async def generate_npc(payload: GenerateRequest, user: dict = Depends(get_current_user)):
    require_role(user, "maestro", "director_de_juego")
    archetype = _resolve_archetype(payload.occupation)
    arch = ARCHETYPES.get(archetype, ARCHETYPES["campesino"])

    sub_data = await _load_subculture(payload.subculture_id, payload.subculture_name)
    culture_name = (sub_data["culture"].get("nombre") if sub_data else None) or ""
    subculture_name = (
        (sub_data["subculture"].get("nombre") or sub_data["subculture"].get("name"))
        if sub_data else (payload.subculture_name or "")
    )

    stats = _generate_stats(archetype)
    mods = {k: _attr_mod(v) for k, v in stats.items()}
    hp = _hp_for_level(arch["hp_die"], mods["CON"], payload.level)
    ca = _ca_for(arch["armor"], mods["DES"], arch.get("has_shield", False))

    armor_label = ARMOR_DATA[arch["armor"]]["label"]
    equipment = list(arch["weapons"])
    if arch["armor"] != "ninguna":
        equipment.insert(0, armor_label)
    if arch.get("has_shield"):
        equipment.insert(1 if arch["armor"] != "ninguna" else 0, "Escudo")

    # Default languages: Oestron + cultural language (best-effort)
    default_langs = ["Oestron (Lengua Común)"]
    if sub_data:
        cul_lang = sub_data["culture"].get("idioma_principal") or sub_data["culture"].get("lengua")
        if cul_lang and cul_lang not in default_langs:
            default_langs.append(cul_lang)

    # Construct stat block
    block = {
        "archetype": archetype,
        "archetype_label": ARCHETYPE_LABELS.get(archetype, archetype.title()),
        "occupation_name": payload.occupation,
        "culture_name": culture_name,
        "subculture_name": subculture_name,
        "sex": payload.sex,
        "level": payload.level,
        "mode": payload.mode,  # 'generico' | 'especial'
        # Combat block
        "ca": ca,
        "armor_label": armor_label,
        "has_shield": arch.get("has_shield", False),
        "hp": hp,
        "hp_die": arch["hp_die"],
        "hp_formula": f"{payload.level}d{arch['hp_die']}{'+' if mods['CON'] >= 0 else ''}{mods['CON'] * payload.level}",
        "speed_m": 9,  # 30ft = 9m
        # Stats
        "atributos": {
            "fuerza": {"valor": stats["FUE"], "modificador": mods["FUE"]},
            "destreza": {"valor": stats["DES"], "modificador": mods["DES"]},
            "constitucion": {"valor": stats["CON"], "modificador": mods["CON"]},
            "inteligencia": {"valor": stats["INT"], "modificador": mods["INT"]},
            "sabiduria": {"valor": stats["SAB"], "modificador": mods["SAB"]},
            "carisma": {"valor": stats["CAR"], "modificador": mods["CAR"]},
        },
        "tiradas_salvacion": arch.get("ts", []),
        "habilidades": arch.get("skills", []),
        "sentidos": ["Percepción pasiva 10"],
        "idiomas": default_langs,
        "equipo": equipment,
        "ataques": [
            {
                "nombre": equipment[0] if equipment else "Puñetazo",
                "bono": max(mods["FUE"], mods["DES"]) + 2,  # +2 prof at low levels
                "dano": "1d6",
                "tipo": "cortante" if "Espada" in (equipment[0] if equipment else "") else "contundente",
            }
        ],
        # Display
        "rasgos": [],
        "experiencia": _xp_for_level(payload.level),
    }
    return block


def _xp_for_level(level: int) -> int:
    """Approximate XP value of an NPC at given level (5e CR≈level)."""
    XP_TABLE = {
        1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
        9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
        16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    }
    return XP_TABLE.get(level, 200)


# ============================================================================
# /name — AI name generation
# ============================================================================
@router.post("/name")
async def generate_npc_name(payload: NameRequest, user: dict = Depends(get_current_user)):
    require_role(user, "maestro", "director_de_juego")
    sub_data = await _load_subculture(payload.subculture_id, payload.subculture_name)
    culture_name = sub_data["culture"].get("nombre") if sub_data else ""
    sub = sub_data["subculture"] if sub_data else {}
    sub_name = (sub.get("nombre") or sub.get("name") or payload.subculture_name or "").strip()

    sex_label = "masculino" if (payload.sex or "M").upper().startswith("M") else "femenino"

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(500, "EMERGENT_LLM_KEY no configurada")

        prompt = (
            f"Inventa UN solo nombre {sex_label} para un PNJ de la Tierra Media.\n"
            f"Cultura: {culture_name or 'desconocida'}\n"
            f"Subcultura: {sub_name or 'desconocida'}\n"
            f"Ocupación: {payload.occupation or 'sin definir'}\n\n"
            "Reglas:\n"
            "- Devuelve SOLO el nombre, sin texto adicional, comillas ni introducción.\n"
            "- Si la subcultura tiene fonética propia (sindarin, rohírrico, dunlendino, sureño…), respétala.\n"
            "- Puede llevar un epíteto corto (\"el Tuerto\", \"la Sigilosa\") si es coherente con la ocupación.\n"
            "- Máximo 4 palabras."
        )
        chat = LlmChat(
            api_key=api_key,
            session_id=f"npc_name_{uuid.uuid4().hex[:8]}",
            system_message="Eres un experto en onomástica de la Tierra Media. Generas nombres breves y evocadores.",
        ).with_model("openai", "gpt-4o-mini")
        resp = await chat.send_message(UserMessage(text=prompt))
        name = (resp or "").strip().strip('"').strip("'")
        # Trim if it has line breaks or commentary
        name = name.split("\n")[0].strip()
        if not name:
            raise RuntimeError("Empty response from LLM")
        return {"name": name}
    except Exception as e:
        logger.exception("NPC name AI failed: %s", e)
        # Fallback: deterministic name
        seed = (sub_name or culture_name or payload.occupation or "anon")[:6]
        suffix = "ar" if sex_label == "masculino" else "el"
        return {"name": f"{seed.capitalize()}-{suffix}", "fallback": True, "error": str(e)}


# ============================================================================
# /portrait — AI black & white charcoal portrait
# ============================================================================
@router.post("/portrait")
async def generate_npc_portrait(payload: PortraitRequest, user: dict = Depends(get_current_user)):
    require_role(user, "maestro", "director_de_juego")
    sub_data = await _load_subculture(payload.subculture_id, payload.subculture_name)
    culture_name = sub_data["culture"].get("nombre") if sub_data else ""
    sub = sub_data["subculture"] if sub_data else {}
    sub_name = (sub.get("nombre") or sub.get("name") or payload.subculture_name or "").strip()
    sex_label = "male" if (payload.sex or "M").upper().startswith("M") else "female"

    descriptors: List[str] = []
    if payload.age:
        descriptors.append(payload.age)
    descriptors.append(f"{sex_label} character")
    if culture_name:
        descriptors.append(f"of {culture_name} culture")
    if sub_name:
        descriptors.append(f"({sub_name})")
    if payload.occupation:
        descriptors.append(f"working as {payload.occupation}")
    if payload.eyes:
        descriptors.append(f"{payload.eyes} eyes")
    if payload.hair:
        descriptors.append(f"{payload.hair} hair")
    # Allow culture-defined image prompt
    custom = (sub.get("texto_imagen_ia") or sub.get("image_ai_text") or "").strip()
    if custom:
        descriptors.append(custom)
    if payload.extra:
        descriptors.append(payload.extra)

    composicion = (
        "full body shot, full-length standing pose, the ENTIRE body visible from the top of the head to the feet, "
        "nothing cropped, head and feet fully inside the frame, some empty margin above the head and below the feet"
        if payload.full_body else "head and shoulders portrait"
    )
    prompt = (
        "hyper-realistic graphite pencil drawing, masterful hand-drawn portrait, extremely detailed realistic pencil rendering, "
        "visible fine pencil strokes and cross-hatching shading, it clearly looks like a hand-made drawing on paper (NOT a photograph), "
        f"{composicion}, "
        "Tolkien Middle-earth style character, dramatic lighting, rich tonal range, realistic anatomy, "
        "monochrome grayscale, no color, on textured paper, cinematic composition. "
        "Subject: " + ", ".join(descriptors) + "."
    )

    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(500, "EMERGENT_LLM_KEY no configurada")
        image_gen = OpenAIImageGeneration(api_key=api_key)
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if not images:
            raise RuntimeError("No image returned")
        img_bytes = images[0]
        b64 = base64.b64encode(img_bytes).decode("utf-8")

        # Persist to GridFS for later reuse
        try:
            from routes.storage_routes import get_gridfs_bucket
            bucket = get_gridfs_bucket(db)
            fname = f"npc-portraits/{user.get('id', 'anon')}/{uuid.uuid4().hex}.png"
            metadata = {
                "original_filename": "npc-portrait.png",
                "content_type": "image/png",
                "path": fname,
                "owner_id": user.get("id"),
                "owner_email": user.get("email"),
                "folder": "npc-portraits",
                "tags": ["npc", "portrait", "ai-generated"],
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "size_bytes": len(img_bytes),
                "prompt": prompt[:500],
            }
            file_id = await bucket.upload_from_stream(
                filename=fname, source=io.BytesIO(img_bytes), metadata=metadata
            )
            return {"file_id": str(file_id), "image_base64": b64, "prompt": prompt[:500]}
        except Exception as e_store:
            logger.warning("Could not persist portrait, returning base64 only: %s", e_store)
            return {"image_base64": b64, "prompt": prompt[:500]}

    except Exception as e:
        logger.exception("Portrait AI failed: %s", e)
        raise HTTPException(500, f"Error generando retrato: {e}")



# ============================================================================
# Generador de nombres de criaturas sin raza (Orco/Trol/Huargo)
# ============================================================================
from routes.npc_creature_names import (  # noqa: E402
    CREATURE_NAME_DATA, generate_creature_name, list_creature_types,
)


async def _get_creature_catalog() -> dict:
    """Lee el catálogo de nombres desde BD (Fase B) o usa los valores por defecto."""
    try:
        doc = await db.npc_creature_name_config.find_one({"_id": "default"})
        if doc and doc.get("data"):
            return doc["data"]
    except Exception:
        pass
    return CREATURE_NAME_DATA


class CreatureNameRequest(BaseModel):
    tipo: str
    sexo: Optional[str] = None


@router.get("/creature-types")
async def get_creature_types(user: dict = Depends(get_current_user)):
    require_role(user, "maestro", "director_de_juego")
    catalog = await _get_creature_catalog()
    return {"tipos": list_creature_types(catalog)}


@router.post("/creature-name")
async def creature_name(payload: CreatureNameRequest, user: dict = Depends(get_current_user)):
    require_role(user, "maestro", "director_de_juego")
    catalog = await _get_creature_catalog()
    try:
        return generate_creature_name(payload.tipo, payload.sexo, catalog)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class CreatureConfigBody(BaseModel):
    data: Dict[str, Any]


@router.get("/creature-name-config")
async def get_creature_name_config(user: dict = Depends(get_current_user)):
    """Devuelve el catálogo editable de diccionarios de nombres (BD o por defecto)."""
    require_role(user, "maestro")
    catalog = await _get_creature_catalog()
    return {"data": catalog}


@router.put("/creature-name-config")
async def put_creature_name_config(body: CreatureConfigBody, user: dict = Depends(get_current_user)):
    """Guarda el catálogo editable. Maestro."""
    require_role(user, "maestro")
    if not isinstance(body.data, dict) or not body.data:
        raise HTTPException(status_code=400, detail="Catálogo vacío o inválido")
    for tipo, d in body.data.items():
        if not d.get("ataque"):
            raise HTTPException(status_code=400, detail=f"«{tipo}» necesita al menos una sílaba de Ataque")
    from datetime import datetime, timezone
    await db.npc_creature_name_config.update_one(
        {"_id": "default"},
        {"$set": {"data": body.data, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "tipos": list(body.data.keys())}


class StoryRequest(BaseModel):
    nombre: str
    contexto: Optional[str] = ""


@router.post("/story")
async def generate_npc_story(payload: StoryRequest, user: dict = Depends(get_current_user)):
    """Genera un trasfondo breve con IA (GPT-4o) para un PNJ. Maestro/DJ."""
    require_role(user, "maestro", "director_de_juego")
    import os
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY no configurada")
    system = ("Eres un cronista de El Señor de los Anillos 5e. Escribes en ESPAÑOL DE ESPAÑA, "
              "tono evocador y conciso. No inventes reglas ni estadísticas.")
    prompt = (
        f"Escribe un trasfondo breve (60-110 palabras) para el PNJ «{payload.nombre}». "
        f"Contexto: {payload.contexto or 'sin datos adicionales'}. "
        "Incluye origen, motivación y un rasgo memorable. Devuelve SOLO el texto, sin encabezados."
    )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=api_key, session_id=f"npc-story-{uuid.uuid4().hex[:8]}", system_message=system).with_model("openai", "gpt-4o")
        resp = await chat.send_message(UserMessage(text=prompt))
        return {"historia": resp.strip() if isinstance(resp, str) else str(resp).strip()}
    except Exception as e:
        logger.warning("historia IA falló: %s", e)
        raise HTTPException(status_code=502, detail="No se pudo generar la historia")


# ============================================================================
# Rasgos y formas de hablar de ADVERSARIOS (Orcos/Trolls/Huargos/Espectros)
# ============================================================================
import random as _random  # noqa: E402
from routes.adversary_traits_data import (  # noqa: E402
    DEFAULT_ADVERSARY_TRAITS, DEFAULT_FORMAS_HABLA, GRUPOS, GRUPO_LABELS, FAMILIAS_CON_HABLA,
)


async def _get_adversary_traits_config() -> dict:
    """Lee la config editable de rasgos/formas de hablar (BD o por defecto)."""
    try:
        doc = await db.npc_adversary_traits_config.find_one({"_id": "default"})
        if doc:
            return {
                "traits": doc.get("traits") or DEFAULT_ADVERSARY_TRAITS,
                "formas_habla": doc.get("formas_habla") or DEFAULT_FORMAS_HABLA,
            }
    except Exception:
        pass
    return {"traits": DEFAULT_ADVERSARY_TRAITS, "formas_habla": DEFAULT_FORMAS_HABLA}


class AdversaryTraitsRequest(BaseModel):
    familia: str  # orcos | trolls | huargos | espectros


@router.post("/adversary-traits")
async def adversary_traits(payload: AdversaryTraitsRequest, user: dict = Depends(get_current_user)):
    """Devuelve 5 rasgos (1 aleatorio por grupo) y una forma de hablar (orcos/trolls)."""
    require_role(user, "maestro", "director_de_juego")
    cfg = await _get_adversary_traits_config()
    familia = (payload.familia or "").lower().strip()
    traits = cfg["traits"].get(familia)
    if not traits:
        raise HTTPException(status_code=400, detail=f"Familia de rasgos desconocida: «{payload.familia}»")
    rasgos = []
    for g in GRUPOS:
        opciones = traits.get(g) or []
        if opciones:
            rasgos.append(f"{GRUPO_LABELS.get(g, g)}: {_random.choice(opciones)}")
    modo_hablar = None
    if familia in FAMILIAS_CON_HABLA and cfg["formas_habla"]:
        modo_hablar = _random.choice(cfg["formas_habla"])
    return {"familia": familia, "rasgos": rasgos, "modo_hablar": modo_hablar}


@router.get("/adversary-traits-config")
async def get_adversary_traits_config(user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    return await _get_adversary_traits_config()


class AdversaryTraitsConfigBody(BaseModel):
    traits: Dict[str, Any]
    formas_habla: List[str]


@router.put("/adversary-traits-config")
async def put_adversary_traits_config(body: AdversaryTraitsConfigBody, user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    if not isinstance(body.traits, dict) or not body.traits:
        raise HTTPException(status_code=400, detail="Rasgos vacíos o inválidos")
    from datetime import datetime, timezone
    await db.npc_adversary_traits_config.update_one(
        {"_id": "default"},
        {"$set": {"traits": body.traits, "formas_habla": body.formas_habla,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}
