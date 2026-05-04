"""
EYE OF MORDOR — Phase 1 (núcleo, sin LLM)

Sistema de Atención del Enemigo: contador persistente por party que se
incrementa con eventos del viaje (1 natural, sombra ganada, magia visible
declarada por el DJ, objetos famosos en el grupo). Cuando supera el
umbral de la región actual, dispara un Episodio de Revelación.

Decisiones (iter83):
- El Ojo es ÚNICO por party (todos los personajes en la misma campaña),
  no por viaje. Persiste entre viajes hasta que se dispara un episodio.
- Sólo se cuentan los puntos de Sombra GANADOS durante la aventura, no
  el `puntos_sombra` ya acumulado en la ficha al inicializar.
- Hasta que exista sistema de Campañas, hay UN solo eye_state global
  (id="default") que el DJ administra. Migración trivial cuando se
  añadan campañas.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/eye", tags=["eye-of-mordor"])

# ----------- DB handle (lazy) -----------
_client = None
_db = None

def _get_db():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ['MONGO_URL'])
        _db = _client[os.environ['DB_NAME']]
    return _db


# ============== AUTO-MAPEO DE REGIONES ==============
# Las 18 regiones climáticas se clasifican en tres categorías de umbral.
# El admin puede sobreescribir cualquier región mediante region_overrides.
REGION_DEFAULT_TYPE: Dict[str, str] = {
    # Fronteriza — umbral 18 (zonas civilizadas, vigilancia indirecta)
    "ERIADOR": "fronteriza",
    "LINDON": "fronteriza",
    "ROHAN": "fronteriza",
    "GONDOR": "fronteriza",
    "ERED LUIN (MONTAÑAS AZULES)": "fronteriza",
    # Salvaje — umbral 16 (tierras agrestes, peligros frecuentes)
    "FORODWAITH": "salvaje",
    "RHOVANION": "salvaje",
    "BOSQUE NEGRO": "salvaje",
    "COLINAS DE HIERRO": "salvaje",
    "RHUN": "salvaje",
    "NAN ANDUIN (VALLES DEL ANDUIN)": "salvaje",
    "NEN BELFALAS (BAHÍA DE BELFALAS)": "salvaje",
    "ERED NIMRAIS (MONTAÑAS BLANCAS)": "salvaje",
    "GAER RHÚNEN (MAR DE RHÜN)": "salvaje",
    # Oscura — umbral 14 (territorios bajo influencia directa de la Sombra)
    "MORDOR": "oscura",
    "ERED LITHUI (MONTAÑAS DE LA CENIZA)": "oscura",
    "KHAND": "oscura",
    "HARAD": "oscura",
}

THRESHOLD_BY_TYPE: Dict[str, int] = {
    "fronteriza": 18,
    "salvaje": 16,
    "oscura": 14,
}


# ============== RAZAS BASE ==============
# El máximo (no la suma) de la party determina la base por raza.
RACE_BASE_ATTENTION: Dict[str, int] = {
    "hobbits": 0,
    "hobbit": 0,
    "hombres": 0,
    "hombre": 0,
    "enanos": 1,
    "enano": 1,
    "dunedain": 2,
    "dúnedain": 2,
    "dúnadan": 2,
    "dunadan": 2,
    "elfos": 2,
    "elfo": 2,
    "altos elfos": 3,
    "alto elfo": 3,
}


# ============== MODELOS ==============
class EyeIncrementSource(BaseModel):
    """Una sola entrada del historial de incrementos."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ts: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source: str  # "nat1", "shadow_gain", "magic_minor", "magic_major", "magic_powerful", "manual", "object", "init"
    delta: int
    character_id: Optional[str] = None
    character_name: Optional[str] = None
    descripcion: str = ""


class EyeStateBase(BaseModel):
    """State ÚNICO por campaña/party."""
    model_config = ConfigDict(extra="ignore")
    id: str = "default"
    party_member_ids: List[str] = []
    attention_total: int = 0
    initial_value: int = 0  # valor al que se vuelve tras un episodio
    last_region_id: Optional[str] = None
    last_episode_at: Optional[str] = None
    region_overrides: Dict[str, str] = {}  # region_name -> "fronteriza"|"salvaje"|"oscura"
    threshold_modifiers: int = 0  # +/- ajuste manual del DJ (figura poderosa, viaje discreto, fama, enemigo conoce)
    history: List[Dict[str, Any]] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class IncrementRequest(BaseModel):
    source: str  # "nat1", "shadow_gain", "magic_minor", "magic_major", "magic_powerful", "manual", "object"
    delta: Optional[int] = None  # si no se da, se infiere por source
    character_id: Optional[str] = None
    character_name: Optional[str] = None
    descripcion: str = ""


class PartyConfigRequest(BaseModel):
    party_member_ids: List[str]


class RegionOverrideRequest(BaseModel):
    region_name: str
    region_type: str  # "fronteriza" | "salvaje" | "oscura"


class ThresholdModifierRequest(BaseModel):
    threshold_modifiers: int  # diff total. Ej: +4 protección, -2 fama


SOURCE_DEFAULT_DELTA: Dict[str, int] = {
    "nat1": 1,
    "shadow_gain": 1,  # se ajusta con el delta real
    "magic_minor": 1,
    "magic_major": 2,
    "magic_powerful": 3,
    "manual": 1,
    "object": 2,
    "init": 0,
}


# ============== HELPERS ==============
async def _load_state(state_id: str = "default") -> Dict[str, Any]:
    db = _get_db()
    doc = await db.eye_state.find_one({"id": state_id}, {"_id": 0})
    if not doc:
        # Lazy init: crea un estado vacío.
        new_state = EyeStateBase(id=state_id).model_dump()
        await db.eye_state.insert_one({**new_state})
        return new_state
    return doc


async def _save_state(state: Dict[str, Any]) -> Dict[str, Any]:
    db = _get_db()
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    state.pop("_id", None)
    await db.eye_state.update_one({"id": state["id"]}, {"$set": state}, upsert=True)
    return state


def _classify_race(raza_str: str) -> int:
    """Devuelve la base de Atención inicial por raza/cultura."""
    if not raza_str:
        return 0
    s = raza_str.strip().lower()
    # Buscamos coincidencias parciales (ej. "Hombres de Bree" → "hombres").
    # Iteramos por longitud DESCENDENTE para que "altos elfos" coincida
    # antes que "elfos".
    for key in sorted(RACE_BASE_ATTENTION.keys(), key=len, reverse=True):
        if key in s:
            return RACE_BASE_ATTENTION[key]
    return 0


def _is_proficiency_high(char: Dict[str, Any]) -> bool:
    """+1 por personaje con bonus de competencia >= +4 (nivel >= 9)."""
    nivel = int(char.get('nivel', 1) or 1)
    bonus = 2 + ((nivel - 1) // 4)  # 5e bono de competencia
    return bonus >= 4


def _count_famous_objects(char: Dict[str, Any]) -> int:
    """+2 por cada arma o armadura famosa en el inventario."""
    count = 0
    inv = char.get('inventario') or []
    for it in inv:
        if not isinstance(it, dict):
            continue
        if it.get('famoso') or it.get('legendario') or it.get('es_famoso'):
            count += 1
    armas = char.get('armas') or []
    for a in armas:
        if isinstance(a, dict) and (a.get('famoso') or a.get('legendario')):
            count += 1
    armaduras = char.get('armaduras') or []
    for a in armaduras:
        if isinstance(a, dict) and (a.get('famoso') or a.get('legendario')):
            count += 1
    return count


async def _calculate_initial(party_member_ids: List[str]) -> Dict[str, Any]:
    """Calcula EyeAttention inicial. Devuelve {valor, desglose[]}."""
    db = _get_db()
    desglose: List[Dict[str, Any]] = []
    if not party_member_ids:
        return {"valor": 0, "desglose": []}

    chars = await db.characters.find({"id": {"$in": party_member_ids}}, {"_id": 0}).to_list(100)

    # Base por raza: SÓLO la más alta de la party.
    max_race_base = 0
    max_race_name = None
    for ch in chars:
        raza = ch.get('cultura_nombre') or ch.get('cultura') or ch.get('raza') or ''
        b = _classify_race(raza)
        if b > max_race_base:
            max_race_base = b
            max_race_name = ch.get('nombre')
    if max_race_base > 0:
        desglose.append({
            "concepto": f"Base por raza más prominente ({max_race_name})",
            "delta": max_race_base,
        })

    # +1 por cada personaje con proficiency >= +4
    high_prof = [ch.get('nombre') for ch in chars if _is_proficiency_high(ch)]
    if high_prof:
        desglose.append({
            "concepto": f"Heroes con proficiency ≥ +4 ({', '.join(high_prof)})",
            "delta": len(high_prof),
        })

    # +2 por cada objeto famoso
    obj_total = 0
    for ch in chars:
        n = _count_famous_objects(ch)
        if n > 0:
            obj_total += n
            desglose.append({
                "concepto": f"{ch.get('nombre')}: {n} objeto(s) notable(s)",
                "delta": n * 2,
            })

    valor = max_race_base + len(high_prof) + (obj_total * 2)
    return {"valor": valor, "desglose": desglose}


def _resolve_region_type(region_name: Optional[str], overrides: Dict[str, str]) -> str:
    if not region_name:
        return "salvaje"  # default conservador
    upper = region_name.strip().upper()
    if upper in overrides:
        return overrides[upper]
    return REGION_DEFAULT_TYPE.get(upper, "salvaje")


def _calc_threshold(region_name: Optional[str], overrides: Dict[str, str], modifiers: int) -> Dict[str, Any]:
    rtype = _resolve_region_type(region_name, overrides)
    base = THRESHOLD_BY_TYPE.get(rtype, 16)
    return {
        "region_type": rtype,
        "base": base,
        "modifiers": modifiers,
        "threshold": max(1, base + modifiers),
    }


# ============== ENDPOINTS ==============
@router.get("/state")
async def get_state(state_id: str = "default"):
    state = await _load_state(state_id)
    threshold = _calc_threshold(
        state.get('last_region_id'),
        state.get('region_overrides', {}),
        state.get('threshold_modifiers', 0),
    )
    return {
        **state,
        "threshold_info": threshold,
        "ratio": (state.get('attention_total', 0) / threshold['threshold']) if threshold['threshold'] > 0 else 0,
        "will_trigger": state.get('attention_total', 0) >= threshold['threshold'],
    }


@router.post("/init")
async def init_state(req: PartyConfigRequest, state_id: str = "default"):
    """Calcula EyeAttention inicial a partir de la party y la guarda."""
    calc = await _calculate_initial(req.party_member_ids)
    state = await _load_state(state_id)
    state['party_member_ids'] = req.party_member_ids
    state['initial_value'] = calc['valor']
    state['attention_total'] = calc['valor']
    state['history'] = state.get('history', []) + [{
        **EyeIncrementSource(
            source="init",
            delta=calc['valor'],
            descripcion=f"Inicialización: {len(req.party_member_ids)} personajes",
        ).model_dump(),
    }]
    await _save_state(state)
    return {"state": state, "desglose": calc['desglose']}


@router.post("/party")
async def update_party(req: PartyConfigRequest, state_id: str = "default"):
    state = await _load_state(state_id)
    state['party_member_ids'] = req.party_member_ids
    await _save_state(state)
    return state


@router.post("/region-override")
async def set_region_override(req: RegionOverrideRequest, state_id: str = "default"):
    if req.region_type not in THRESHOLD_BY_TYPE:
        raise HTTPException(400, f"region_type debe ser uno de {list(THRESHOLD_BY_TYPE.keys())}")
    state = await _load_state(state_id)
    overrides = state.get('region_overrides', {})
    overrides[req.region_name.strip().upper()] = req.region_type
    state['region_overrides'] = overrides
    await _save_state(state)
    return state


@router.post("/threshold-modifiers")
async def set_threshold_modifiers(req: ThresholdModifierRequest, state_id: str = "default"):
    state = await _load_state(state_id)
    state['threshold_modifiers'] = int(req.threshold_modifiers)
    await _save_state(state)
    return state


@router.post("/region")
async def set_current_region(region_name: str, state_id: str = "default"):
    """Marca la región actual del grupo (ej: cuando entran a una nueva tile)."""
    state = await _load_state(state_id)
    state['last_region_id'] = region_name
    await _save_state(state)
    threshold = _calc_threshold(region_name, state.get('region_overrides', {}), state.get('threshold_modifiers', 0))
    return {"state": state, "threshold_info": threshold}


@router.post("/increment")
async def increment(req: IncrementRequest, state_id: str = "default"):
    """Suma puntos al Ojo. Devuelve estado actualizado y si dispara episodio."""
    state = await _load_state(state_id)
    delta = req.delta if req.delta is not None else SOURCE_DEFAULT_DELTA.get(req.source, 1)
    if delta < 0:
        raise HTTPException(400, "delta debe ser >= 0")
    state['attention_total'] = int(state.get('attention_total', 0)) + delta
    entry = EyeIncrementSource(
        source=req.source,
        delta=delta,
        character_id=req.character_id,
        character_name=req.character_name,
        descripcion=req.descripcion,
    ).model_dump()
    state['history'] = (state.get('history', []) + [entry])[-200:]  # cap a 200 entradas
    await _save_state(state)
    threshold = _calc_threshold(state.get('last_region_id'), state.get('region_overrides', {}), state.get('threshold_modifiers', 0))
    will_trigger = state['attention_total'] >= threshold['threshold']
    return {
        "state": state,
        "threshold_info": threshold,
        "delta_applied": delta,
        "will_trigger": will_trigger,
        "ratio": state['attention_total'] / threshold['threshold'] if threshold['threshold'] > 0 else 0,
    }


@router.post("/trigger-episode")
async def trigger_episode(state_id: str = "default"):
    """
    Marca que se ha disparado un episodio. Reseteamos a `initial_value`
    (no a 0) y registramos en el historial. La narrativa/efecto del
    episodio se generan en Fase 2 (LLM).
    """
    state = await _load_state(state_id)
    pre = state.get('attention_total', 0)
    state['attention_total'] = state.get('initial_value', 0)
    state['last_episode_at'] = datetime.now(timezone.utc).isoformat()
    entry = EyeIncrementSource(
        source="episode_reset",
        delta=-(pre - state['attention_total']),
        descripcion=f"Episodio de Revelación disparado (pre={pre} → post={state['attention_total']})",
    ).model_dump()
    state['history'] = (state.get('history', []) + [entry])[-200:]
    await _save_state(state)
    return {"state": state, "previous_attention": pre}


@router.post("/reset")
async def reset(state_id: str = "default"):
    """Resetea el Ojo por completo (admin). NO reinicializa party."""
    state = await _load_state(state_id)
    state['attention_total'] = 0
    state['initial_value'] = 0
    state['history'] = []
    state['last_episode_at'] = None
    state['last_region_id'] = None
    state['threshold_modifiers'] = 0
    await _save_state(state)
    return state


@router.get("/regions/classification")
async def get_region_classification(state_id: str = "default"):
    """Devuelve la clasificación efectiva de las 18 regiones (con overrides)."""
    state = await _load_state(state_id)
    overrides = state.get('region_overrides', {})
    out = []
    for region, default_type in REGION_DEFAULT_TYPE.items():
        effective = overrides.get(region, default_type)
        out.append({
            "region": region,
            "default_type": default_type,
            "effective_type": effective,
            "is_overridden": region in overrides,
            "threshold": THRESHOLD_BY_TYPE[effective],
        })
    return {"regions": out, "thresholds_by_type": THRESHOLD_BY_TYPE}
