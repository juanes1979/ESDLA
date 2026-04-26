"""
Weather Simulation — Markov-chain weather rolling for journeys.

Generates a coherent day-by-day weather sequence:
- Each day's state depends on yesterday's state (inertia α=0.65) blended with
  the region/month base probabilities from the climate system.
- Region is determined per-day from the journey path (the region where the
  party spends most of that day's travel).
- Output includes both poetic narrative material and detailed log fields.

States: despejado | nublado | niebla | calima | lluvia_ligera | lluvia_fuerte |
        tormenta | nevada_ligera | nevada_fuerte | viento_fuerte
"""
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import unicodedata
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/weather", tags=["Weather Simulation"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# ── Constants ──
STATES = [
    "despejado", "nublado", "niebla", "calima",
    "lluvia_ligera", "lluvia_fuerte", "tormenta",
    "nevada_ligera", "nevada_fuerte", "viento_fuerte",
]

STATE_LABELS = {
    "despejado": "Despejado",
    "nublado": "Nublado",
    "niebla": "Niebla",
    "calima": "Calima",
    "lluvia_ligera": "Lluvia ligera",
    "lluvia_fuerte": "Lluvia fuerte",
    "tormenta": "Tormenta",
    "nevada_ligera": "Nevada ligera",
    "nevada_fuerte": "Nevada fuerte / ventisca",
    "viento_fuerte": "Viento fuerte",
}

STATE_ICONS = {
    "despejado": "☀️",
    "nublado": "⛅",
    "niebla": "🌫️",
    "calima": "🌫️",
    "lluvia_ligera": "🌦️",
    "lluvia_fuerte": "🌧️",
    "tormenta": "⛈️",
    "nevada_ligera": "🌨️",
    "nevada_fuerte": "❄️",
    "viento_fuerte": "💨",
}

# Markov transition probabilities — what tends to happen tomorrow given today
TRANSITION = {
    "despejado":     {"despejado": 0.60, "nublado": 0.30, "lluvia_ligera": 0.05, "niebla": 0.03, "calima": 0.01, "viento_fuerte": 0.01},
    "nublado":       {"despejado": 0.25, "nublado": 0.40, "lluvia_ligera": 0.20, "lluvia_fuerte": 0.05, "niebla": 0.05, "tormenta": 0.02, "viento_fuerte": 0.03},
    "niebla":        {"despejado": 0.30, "nublado": 0.35, "niebla": 0.15, "lluvia_ligera": 0.15, "calima": 0.05},
    "calima":        {"despejado": 0.30, "nublado": 0.20, "calima": 0.30, "lluvia_ligera": 0.10, "viento_fuerte": 0.10},
    "lluvia_ligera": {"despejado": 0.10, "nublado": 0.30, "lluvia_ligera": 0.35, "lluvia_fuerte": 0.15, "niebla": 0.05, "tormenta": 0.03, "viento_fuerte": 0.02},
    "lluvia_fuerte": {"nublado": 0.15, "lluvia_ligera": 0.30, "lluvia_fuerte": 0.30, "tormenta": 0.15, "viento_fuerte": 0.10},
    "tormenta":      {"nublado": 0.20, "lluvia_ligera": 0.25, "lluvia_fuerte": 0.30, "tormenta": 0.10, "viento_fuerte": 0.15},
    "nevada_ligera": {"despejado": 0.10, "nublado": 0.25, "nevada_ligera": 0.40, "nevada_fuerte": 0.15, "niebla": 0.10},
    "nevada_fuerte": {"nublado": 0.15, "nevada_ligera": 0.35, "nevada_fuerte": 0.40, "niebla": 0.10},
    "viento_fuerte": {"despejado": 0.30, "nublado": 0.30, "viento_fuerte": 0.20, "lluvia_ligera": 0.10, "tormenta": 0.05, "calima": 0.05},
}

INERTIA_ALPHA = 0.65
EXTREME_DAY_PROB = 0.05  # 5% chance of using ext_min/ext_max instead of normal range

MESES_ELDARIN_TO_ABBREV = {
    "Nénimë": "Ene", "Súlimë": "Feb", "Coiviennë": "Mar", "Víressë": "Abr",
    "Lótessë": "May", "Nárië": "Jun", "Cermië": "Jul", "Urimë": "Ago",
    "Yavannië": "Sep", "Narquelië": "Oct", "Hísimë": "Nov", "Ringarë": "Dic",
}
MESES_ABBREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def _norm_month(m: Optional[str]) -> Optional[str]:
    if not m:
        return None
    if m in MESES_ABBREV:
        return m
    if m in MESES_ELDARIN_TO_ABBREV:
        return MESES_ELDARIN_TO_ABBREV[m]
    cand = m[:3]
    return cand if cand in MESES_ABBREV else None


def _normalize(s: str) -> str:
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


# ── Base probability derivation from climate region/month ──
def _base_state_probs(month_data: dict) -> Dict[str, float]:
    """
    Convert region/month percentages into base probabilities for each state.
    Uses pct_lluvia, pct_tormenta, pct_nieve_helada, pct_niebla, pct_calima,
    horas_sol, viento_kmh, temp_min/temp_max as inputs.
    """
    if not month_data:
        return {s: 1.0 / len(STATES) for s in STATES}

    pct_lluvia = float(month_data.get("pct_lluvia") or 0)
    pct_tormenta = float(month_data.get("pct_tormenta") or 0)
    pct_nieve = float(month_data.get("pct_nieve_helada") or 0)
    pct_niebla = float(month_data.get("pct_niebla") or 0)
    pct_calima = float(month_data.get("pct_calima") or 0)
    horas_sol = float(month_data.get("horas_sol") or 8)
    viento_kmh = float(month_data.get("viento_kmh") or 10)
    temp_max = month_data.get("temp_max")
    temp_max_v = float(temp_max) if temp_max is not None else 99

    # Light vs heavy split for rain/snow (above 60% pct → heavy weighted higher)
    lluvia_ligera = pct_lluvia * (1.0 - min(0.5, pct_lluvia / 200.0))  # most of it
    lluvia_fuerte = pct_lluvia * (min(0.5, pct_lluvia / 200.0)) + pct_tormenta * 0.5
    tormenta = pct_tormenta * 0.6
    # If too cold: rain converts to snow
    if temp_max_v <= 0:
        nevada_fuerte = lluvia_fuerte + pct_nieve * 0.6 + tormenta
        nevada_ligera = lluvia_ligera + pct_nieve * 0.4
        lluvia_ligera, lluvia_fuerte, tormenta = 0.0, 0.0, 0.0
    elif temp_max_v < 4:
        # Mixed regime
        nevada_fuerte = pct_nieve * 0.6
        nevada_ligera = pct_nieve * 0.4
    else:
        nevada_ligera = pct_nieve * 0.4
        nevada_fuerte = pct_nieve * 0.6 if pct_nieve > 30 else pct_nieve * 0.3

    # Wind probability: derives a viento_fuerte share if viento >= 25 km/h
    viento_fuerte = max(0.0, (viento_kmh - 25) * 1.5)

    niebla = pct_niebla * 0.7
    calima = pct_calima * 0.7

    # Sum precipitation-derived
    used = (
        lluvia_ligera + lluvia_fuerte + tormenta +
        nevada_ligera + nevada_fuerte +
        niebla + calima + viento_fuerte
    )

    # Despejado vs nublado: split by horas_sol relative to 12h
    horas_factor = max(0.0, min(1.0, horas_sol / 12.0))
    remaining = max(0.0, 100.0 - used)
    despejado = remaining * horas_factor
    nublado = remaining * (1.0 - horas_factor)

    raw = {
        "despejado": despejado,
        "nublado": nublado,
        "niebla": niebla,
        "calima": calima,
        "lluvia_ligera": lluvia_ligera,
        "lluvia_fuerte": lluvia_fuerte,
        "tormenta": tormenta,
        "nevada_ligera": nevada_ligera,
        "nevada_fuerte": nevada_fuerte,
        "viento_fuerte": viento_fuerte,
    }
    # Normalize
    total = sum(raw.values())
    if total <= 0:
        return {s: 1.0 / len(STATES) for s in STATES}
    return {k: v / total for k, v in raw.items()}


def _blend_with_transition(prev_state: Optional[str], base_probs: Dict[str, float], alpha: float = INERTIA_ALPHA) -> Dict[str, float]:
    """Blend Markov transition (from yesterday) with base region/month probs."""
    if not prev_state:
        return base_probs
    trans = TRANSITION.get(prev_state, {})
    blended = {}
    for s in STATES:
        t = trans.get(s, 0.0)
        b = base_probs.get(s, 0.0)
        blended[s] = alpha * t + (1.0 - alpha) * b
    total = sum(blended.values())
    if total <= 0:
        return base_probs
    return {k: v / total for k, v in blended.items()}


def _sample_state(probs: Dict[str, float]) -> str:
    r = random.random()
    cum = 0.0
    for s in STATES:
        cum += probs.get(s, 0.0)
        if r <= cum:
            return s
    return "despejado"


def _temp_for_state(state: str, m: dict, extreme: bool = False) -> Dict[str, float]:
    if not m:
        return {"temp_min": 0, "temp_max": 0, "temp_dia": 0}
    tmin = float(m.get("temp_min") or 0)
    tmax = float(m.get("temp_max") or 0)
    tmedia = float(m.get("temp_media") or (tmin + tmax) / 2)
    if extreme:
        emin = float(m.get("ext_min") or tmin - 5)
        emax = float(m.get("ext_max") or tmax + 5)
        if state in ("nevada_ligera", "nevada_fuerte"):
            return {"temp_min": emin, "temp_max": tmin, "temp_dia": (emin + tmin) / 2, "anomalo": True}
        if state in ("tormenta", "lluvia_fuerte"):
            return {"temp_min": tmin, "temp_max": tmedia, "temp_dia": (tmin + tmedia) / 2, "anomalo": True}
        return {"temp_min": tmedia, "temp_max": emax, "temp_dia": (tmedia + emax) / 2, "anomalo": True}
    # Normal regime — anchor by state
    jitter = random.uniform(-1.5, 1.5)
    if state == "despejado":
        anchor = tmax - random.uniform(0, 2)
    elif state == "nublado":
        anchor = tmedia + random.uniform(-1, 1)
    elif state in ("lluvia_ligera", "niebla", "calima", "viento_fuerte"):
        anchor = tmedia
    elif state in ("lluvia_fuerte", "tormenta"):
        anchor = tmedia - 2.0
    elif state == "nevada_ligera":
        anchor = tmin + random.uniform(0, 2)
    elif state == "nevada_fuerte":
        anchor = tmin - random.uniform(0, 2)
    else:
        anchor = tmedia
    temp_dia = anchor + jitter
    return {
        "temp_min": round(temp_dia - random.uniform(2, 5), 1),
        "temp_max": round(temp_dia + random.uniform(2, 5), 1),
        "temp_dia": round(temp_dia, 1),
        "anomalo": False,
    }


# ── Region resolution helpers ──
async def _find_climate_region_for_region_name(region_name: str) -> Optional[dict]:
    """Match a region/subregion string against climate_regions.match_keywords."""
    if not region_name:
        return None
    target = _normalize(region_name)
    candidates = await db.climate_regions.find({}).to_list(200)
    matched: List[dict] = []
    for cr in candidates:
        for kw in cr.get("match_keywords") or []:
            kn = _normalize(kw)
            if not kn:
                continue
            if kn == target or kn in target or target in kn:
                matched.append(cr)
                break
    if not matched:
        return None
    matched.sort(key=lambda c: (0 if c.get("parent_id") else 1, c.get("orden", 99)))
    return matched[0]


async def _resolve_region_for_day(day_index: int, journey_path: List[dict]) -> Optional[str]:
    """
    Given a journey path (array of {casilla, region, x, y}) and a day index,
    return the region where the party spends most of that day.
    `journey_path` is expected to be `journeyCalc.ruta.casillas_detalle` from the FE
    or any sequence keyed by 'casilla'/'region'.
    """
    if not journey_path:
        return None
    # Simple model: each day == 1 casilla (the FE may pass per-casilla list)
    if day_index < len(journey_path):
        return journey_path[day_index].get("region")
    # Fall back to last region
    return journey_path[-1].get("region")


# ── Public model ──
class WeatherSimulateRequest(BaseModel):
    mes: str  # "Súlimë" or "Feb"
    dia_inicio: Optional[int] = 1  # day-of-month for narrative purposes
    num_dias: int  # how many days to roll
    # Sequence of regions per day (string region names). Length should match num_dias.
    # If shorter, the last region is repeated.
    regiones_por_dia: List[str]
    # Optional: previous state to continue chain (e.g. for incremental rolls between events)
    estado_previo: Optional[str] = None
    # Optional override location ids per day to apply per-location overrides
    override_location_ids: Optional[List[Optional[str]]] = None
    # Optional seed for reproducibility
    seed: Optional[int] = None


@router.post("/simulate")
async def simulate_weather_sequence(payload: WeatherSimulateRequest):
    """
    Roll a coherent day-by-day weather sequence using Markov chain + region inertia.
    Returns one entry per day with state, icon, temps, and a compact log line.
    """
    mes_norm = _norm_month(payload.mes)
    if not mes_norm:
        raise HTTPException(status_code=400, detail=f"Invalid month '{payload.mes}'")
    if payload.num_dias < 1 or payload.num_dias > 365:
        raise HTTPException(status_code=400, detail="num_dias must be 1..365")

    if payload.seed is not None:
        random.seed(payload.seed)

    # Pre-fetch all climate regions for fast lookup
    days_out: List[dict] = []
    prev_state = payload.estado_previo
    region_cache: Dict[str, dict] = {}
    override_cache: Dict[str, dict] = {}

    for d in range(payload.num_dias):
        region_today_name = (
            payload.regiones_por_dia[d]
            if d < len(payload.regiones_por_dia)
            else (payload.regiones_por_dia[-1] if payload.regiones_por_dia else None)
        )
        # Resolve climate region
        region_key = (region_today_name or "").strip()
        if region_key not in region_cache:
            region_cache[region_key] = await _find_climate_region_for_region_name(region_key) if region_key else None
        cr = region_cache[region_key]
        month_data = ((cr or {}).get("meses") or {}).get(mes_norm) or {}

        # Apply per-location override if provided
        loc_id = None
        if payload.override_location_ids and d < len(payload.override_location_ids):
            loc_id = payload.override_location_ids[d]
        if loc_id:
            if loc_id not in override_cache:
                ov = await db.climate_location_overrides.find_one({"location_id": loc_id})
                override_cache[loc_id] = ((ov or {}).get("overrides") or {}).get(mes_norm) or {}
            if override_cache[loc_id]:
                month_data = {**month_data, **override_cache[loc_id]}

        base = _base_state_probs(month_data)
        blended = _blend_with_transition(prev_state, base)
        state = _sample_state(blended)

        extreme = random.random() < EXTREME_DAY_PROB
        temps = _temp_for_state(state, month_data, extreme=extreme)
        viento_kmh = float(month_data.get("viento_kmh") or 10)
        if state == "viento_fuerte":
            viento_kmh = max(viento_kmh, 35) + random.uniform(0, 20)
        elif state == "tormenta":
            viento_kmh = max(viento_kmh, 30) + random.uniform(0, 25)

        precipitacion = 0.0
        if state == "lluvia_ligera":
            precipitacion = random.uniform(2, 8)
        elif state == "lluvia_fuerte":
            precipitacion = random.uniform(8, 25)
        elif state == "tormenta":
            precipitacion = random.uniform(15, 40)
        elif state == "nevada_ligera":
            precipitacion = random.uniform(2, 6)
        elif state == "nevada_fuerte":
            precipitacion = random.uniform(6, 20)

        horas_sol_efec = float(month_data.get("horas_sol") or 8)
        if state in ("nublado", "niebla"):
            horas_sol_efec *= 0.5
        elif state in ("lluvia_ligera", "calima", "viento_fuerte"):
            horas_sol_efec *= 0.6
        elif state in ("lluvia_fuerte", "nevada_ligera"):
            horas_sol_efec *= 0.3
        elif state in ("tormenta", "nevada_fuerte"):
            horas_sol_efec *= 0.1
        horas_sol_efec = round(horas_sol_efec, 1)

        # Mechanical effects suggestion (auto-applicable per user choice 4b)
        efectos = _suggest_effects(state, extreme)

        log_line = _format_log_line(
            d + 1, region_today_name, state, temps, viento_kmh,
            precipitacion, horas_sol_efec, extreme,
        )

        days_out.append({
            "dia": d + 1,
            "dia_mes": (payload.dia_inicio or 1) + d,
            "region": region_today_name,
            "climate_region": (cr or {}).get("nombre_display") if cr else None,
            "estado": state,
            "estado_label": STATE_LABELS[state],
            "icon": STATE_ICONS[state],
            "temp_min": temps["temp_min"],
            "temp_max": temps["temp_max"],
            "temp_dia": temps["temp_dia"],
            "viento_kmh": round(viento_kmh, 1),
            "dir_viento": month_data.get("dir_viento"),
            "precipitacion_mm": round(precipitacion, 1),
            "horas_sol_efectivas": horas_sol_efec,
            "anomalo": temps.get("anomalo", False) or extreme,
            "efectos": efectos,
            "log_line": log_line,
        })
        prev_state = state

    return {
        "mes": mes_norm,
        "num_dias": payload.num_dias,
        "estado_final": prev_state,
        "dias": days_out,
    }


def _suggest_effects(state: str, extreme: bool) -> Dict[str, Any]:
    """Auto-applicable mechanical effects based on weather state (user choice 4b)."""
    effects = {
        "fatiga_extra": 0.0,
        "ventaja": [],   # advantage on these rolls
        "desventaja": [],  # disadvantage on these rolls
        "vel_modificador": 1.0,
        "aviso": "",
    }
    if state == "niebla":
        effects["desventaja"].append("orientacion")
        effects["aviso"] = "Niebla densa: desventaja en orientación."
    elif state == "calima":
        effects["desventaja"].append("percepcion")
        effects["aviso"] = "Calima: desventaja en percepción a distancia."
    elif state == "lluvia_fuerte":
        effects["fatiga_extra"] = 0.5 if extreme else 0.0
        effects["vel_modificador"] = 0.85
        effects["aviso"] = "Lluvia fuerte: −15% velocidad."
    elif state == "tormenta":
        effects["fatiga_extra"] = 0.5
        effects["vel_modificador"] = 0.7
        effects["desventaja"].append("orientacion")
        effects["aviso"] = "Tormenta: +0.5 fatiga, −30% velocidad, desventaja en orientación."
    elif state == "nevada_ligera":
        effects["vel_modificador"] = 0.85
        effects["aviso"] = "Nevada ligera: −15% velocidad."
    elif state == "nevada_fuerte":
        effects["fatiga_extra"] = 0.5
        effects["vel_modificador"] = 0.6
        effects["desventaja"].append("orientacion")
        effects["aviso"] = "Ventisca: +0.5 fatiga, −40% velocidad, desventaja en orientación."
    elif state == "viento_fuerte":
        effects["desventaja"].append("disparo")
        effects["aviso"] = "Viento fuerte: desventaja en ataques a distancia."
    if extreme:
        effects["aviso"] = (effects["aviso"] + " ⚠️ Día anómalo.").strip()
    return effects


def _format_log_line(dia: int, region: Optional[str], state: str, temps: dict,
                      viento: float, precip: float, sol: float, extreme: bool) -> str:
    parts = [f"Día {dia}"]
    if region:
        parts.append(region)
    parts.append(f"{STATE_ICONS[state]} {STATE_LABELS[state]}")
    parts.append(f"{temps['temp_min']}°→{temps['temp_max']}°")
    if precip > 0:
        parts.append(f"{precip:.0f}mm")
    parts.append(f"viento {viento:.0f}km/h")
    parts.append(f"sol {sol:.1f}h")
    line = " · ".join(parts)
    if extreme:
        line += "  ⚠️ extremo"
    return line


@router.get("/states")
async def get_weather_states():
    """List of weather states with labels & icons (for FE rendering)."""
    return {
        "states": [
            {"id": s, "label": STATE_LABELS[s], "icon": STATE_ICONS[s]}
            for s in STATES
        ],
    }
