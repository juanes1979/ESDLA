"""
Climate System Routes
Granular weather data per region × month with location-level overrides.
- 18 climate regions (loaded from /app/memory/clima_data.json)
- Each region has 12 months × 16 fields
- Locations can override individual fields/months on top of their parent region.
- Resolution: location.region (string) -> matched climate_region -> base data + location override.
"""
from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import json
import unicodedata
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')
MEMORY_DIR = Path('/app/memory')

router = APIRouter(prefix="/climate", tags=["Climate System"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


# === CONSTANTS ===

# Canonical month order (matches Excel keys: "Ene".."Dic")
MONTH_KEYS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

# Numeric fields that can be overridden at location level
NUMERIC_FIELDS = [
    "temp_min", "temp_max", "temp_media",
    "ext_min", "ext_max",
    "viento_kmh", "lluvias_mm", "horas_sol",
    "pct_lluvia", "pct_tormenta", "pct_calima", "pct_nieve_helada", "pct_niebla",
]
TEXT_FIELDS = ["dir_viento", "notas_extremas", "mes", "equiv"]
ALL_FIELDS = NUMERIC_FIELDS + TEXT_FIELDS


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


# Map Eldarin month names to abbreviated keys (accepted for symmetry)
ELDARIN_TO_ABBREV = {
    "Nénimë": "Ene", "Súlimë": "Feb", "Coiviennë": "Mar", "Víressë": "Abr",
    "Lótessë": "May", "Nárië": "Jun", "Cermië": "Jul", "Urimë": "Ago",
    "Yavannië": "Sep", "Narquelië": "Oct", "Hísimë": "Nov", "Ringarë": "Dic",
}


def _normalize_month(mes: Optional[str]) -> Optional[str]:
    """Accept either abbreviated ('Ene') or Eldarin ('Nénimë') forms."""
    if not mes:
        return None
    if mes in MONTH_KEYS:
        return mes
    if mes in ELDARIN_TO_ABBREV:
        return ELDARIN_TO_ABBREV[mes]
    # Fallback: first 3 chars
    candidate = mes[:3]
    return candidate if candidate in MONTH_KEYS else None


def serialize_doc(doc: dict) -> dict:
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != '_id'}
    result['id'] = str(doc['_id'])
    return result


def _normalize(s: str) -> str:
    """Lowercase + strip accents for keyword matching."""
    if not s:
        return ""
    nfkd = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


# === PYDANTIC MODELS ===

class MonthData(BaseModel):
    mes: Optional[str] = None
    equiv: Optional[str] = None
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    temp_media: Optional[float] = None
    ext_min: Optional[float] = None
    ext_max: Optional[float] = None
    viento_kmh: Optional[float] = None
    dir_viento: Optional[str] = None
    lluvias_mm: Optional[float] = None
    pct_lluvia: Optional[float] = None
    pct_tormenta: Optional[float] = None
    horas_sol: Optional[float] = None
    pct_calima: Optional[float] = None
    pct_nieve_helada: Optional[float] = None
    pct_niebla: Optional[float] = None
    notas_extremas: Optional[str] = None


class ClimateRegionUpdate(BaseModel):
    nombre_display: Optional[str] = None
    parent_id: Optional[str] = None
    match_keywords: Optional[List[str]] = None
    orden: Optional[int] = None
    meses: Optional[Dict[str, MonthData]] = None


class ClimateRegionCreate(BaseModel):
    nombre: str
    nombre_display: Optional[str] = None
    parent_id: Optional[str] = None
    match_keywords: Optional[List[str]] = []
    orden: Optional[int] = 99
    meses: Optional[Dict[str, MonthData]] = None


class LocationOverrideUpdate(BaseModel):
    overrides: Dict[str, Dict[str, Any]]  # { "Ene": {temp_max: 25}, ... }


# === SEED ===

@router.post("/seed")
async def seed_climate(force: bool = False):
    """
    Load /app/memory/clima_data.json + clima_region_mapping.json into MongoDB.
    Idempotent: refuses to seed if data already exists, unless force=true (wipes first).
    """
    existing = await db.climate_regions.count_documents({})
    if existing > 0 and not force:
        return {
            "status": "skipped",
            "message": f"Climate already seeded ({existing} regions). Use ?force=true to overwrite.",
            "count": existing
        }

    if force:
        await db.climate_regions.delete_many({})
        await db.climate_location_overrides.delete_many({})

    clima_path = MEMORY_DIR / "clima_data.json"
    mapping_path = MEMORY_DIR / "clima_region_mapping.json"
    if not clima_path.exists() or not mapping_path.exists():
        raise HTTPException(status_code=500, detail="Climate seed files not found in /app/memory/")

    with open(clima_path, 'r', encoding='utf-8') as f:
        clima_data = json.load(f)
    with open(mapping_path, 'r', encoding='utf-8') as f:
        mapping = json.load(f)

    direct_match = mapping.get("direct_match_with_bd_locations", {})
    subregion_inh = mapping.get("subregion_inheritance", {})

    # First pass: create main climate regions
    name_to_id: Dict[str, str] = {}
    orden = 0
    for region_name, months_list in clima_data.items():
        region_id = f"clim_{str(uuid.uuid4())[:8]}"
        # Convert months_list (array of 12) -> dict by "Ene".."Dic"
        meses_dict: Dict[str, dict] = {}
        for month_obj in months_list:
            key = month_obj.get("equiv")  # "Ene", "Feb", ...
            if key:
                meses_dict[key] = {k: v for k, v in month_obj.items()}

        # Determine parent_id: subregion_inheritance lookup
        parent_climate_name = None
        sub_info = subregion_inh.get(region_name)
        if isinstance(sub_info, str):
            parent_climate_name = sub_info  # e.g. "RHOVANION"
        elif isinstance(sub_info, dict):
            parent_climate_name = sub_info.get("parent")  # ERED NIMRAIS -> GONDOR

        # Match keywords from direct_match table (use parent's keywords if this is a sub)
        keywords = direct_match.get(region_name, [])

        doc = {
            "_id": region_id,
            "nombre": region_name,  # canonical key, uppercase from Excel
            "nombre_display": region_name.title(),  # nicer for UI
            "parent_climate_name": parent_climate_name,  # resolved later
            "parent_id": None,  # will be filled after first pass
            "match_keywords": keywords,
            "orden": orden,
            "is_seeded": True,
            "meses": meses_dict,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.climate_regions.insert_one(doc)
        name_to_id[region_name] = region_id
        orden += 1

    # Second pass: resolve parent_id from parent_climate_name
    async for r in db.climate_regions.find({}):
        pname = r.get("parent_climate_name")
        if pname and pname in name_to_id:
            await db.climate_regions.update_one(
                {"_id": r["_id"]},
                {"$set": {"parent_id": name_to_id[pname]}}
            )

    count = await db.climate_regions.count_documents({})
    return {
        "status": "seeded",
        "count": count,
        "message": f"Seeded {count} climate regions from clima_data.json"
    }


# === REGIONS CRUD ===

@router.get("/regions")
async def list_climate_regions():
    """List all climate regions with hierarchy info."""
    regions = await db.climate_regions.find({}).sort("orden", 1).to_list(200)
    return {"regions": [serialize_doc(r) for r in regions], "total": len(regions)}


@router.get("/regions/{region_id}")
async def get_climate_region(region_id: str):
    region = await db.climate_regions.find_one({"_id": region_id})
    if not region:
        raise HTTPException(status_code=404, detail="Climate region not found")
    return serialize_doc(region)


@router.post("/regions")
async def create_climate_region(payload: ClimateRegionCreate):
    region_id = f"clim_{str(uuid.uuid4())[:8]}"
    meses_dict = {}
    if payload.meses:
        for k, v in payload.meses.items():
            meses_dict[k] = {kk: vv for kk, vv in v.dict().items() if vv is not None}
    doc = {
        "_id": region_id,
        "nombre": payload.nombre,
        "nombre_display": payload.nombre_display or payload.nombre.title(),
        "parent_id": payload.parent_id,
        "parent_climate_name": None,
        "match_keywords": payload.match_keywords or [],
        "orden": payload.orden or 99,
        "is_seeded": False,
        "meses": meses_dict,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.climate_regions.insert_one(doc)
    return {"id": region_id, "message": "Climate region created"}


@router.put("/regions/{region_id}")
async def update_climate_region(region_id: str, payload: ClimateRegionUpdate):
    update_data: Dict[str, Any] = {}
    if payload.nombre_display is not None:
        update_data["nombre_display"] = payload.nombre_display
    if payload.parent_id is not None:
        update_data["parent_id"] = payload.parent_id
    if payload.match_keywords is not None:
        update_data["match_keywords"] = payload.match_keywords
    if payload.orden is not None:
        update_data["orden"] = payload.orden
    if payload.meses is not None:
        # Merge: preserve existing months not present in payload
        current = await db.climate_regions.find_one({"_id": region_id})
        if not current:
            raise HTTPException(status_code=404, detail="Climate region not found")
        new_meses = dict(current.get("meses") or {})
        for k, v in payload.meses.items():
            cleaned = {kk: vv for kk, vv in v.dict().items() if vv is not None}
            existing_month = new_meses.get(k, {})
            existing_month.update(cleaned)
            new_meses[k] = existing_month
        update_data["meses"] = new_meses

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = now_utc()
    result = await db.climate_regions.update_one({"_id": region_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Climate region not found")
    return {"message": "Climate region updated"}


@router.put("/regions/{region_id}/months/{mes}")
async def update_climate_region_month(region_id: str, mes: str, payload: MonthData):
    """Update a single month's fields (partial — only non-null fields are written)."""
    if mes not in MONTH_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid month '{mes}'. Use {MONTH_KEYS}")

    cleaned = {kk: vv for kk, vv in payload.dict().items() if vv is not None}
    if not cleaned:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Use $set with dotted path for granular field update
    set_doc = {f"meses.{mes}.{k}": v for k, v in cleaned.items()}
    set_doc["updated_at"] = now_utc()
    result = await db.climate_regions.update_one({"_id": region_id}, {"$set": set_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Climate region not found")
    return {"message": f"Month {mes} updated", "fields_updated": list(cleaned.keys())}


@router.delete("/regions/{region_id}")
async def delete_climate_region(region_id: str):
    region = await db.climate_regions.find_one({"_id": region_id})
    if not region:
        raise HTTPException(status_code=404, detail="Climate region not found")
    if region.get("is_seeded"):
        raise HTTPException(status_code=403, detail="Cannot delete seeded region. Update its data instead.")
    await db.climate_regions.delete_one({"_id": region_id})
    return {"message": "Climate region deleted"}


# === LOCATION OVERRIDES ===

@router.get("/locations/{location_id}/override")
async def get_location_override(location_id: str):
    """Return raw override doc for a location (or empty if none)."""
    override = await db.climate_location_overrides.find_one({"location_id": location_id})
    if not override:
        return {"location_id": location_id, "overrides": {}, "exists": False}
    return {
        "location_id": location_id,
        "overrides": override.get("overrides") or {},
        "exists": True,
        "updated_at": override.get("updated_at"),
    }


@router.put("/locations/{location_id}/override")
async def set_location_override(location_id: str, payload: LocationOverrideUpdate):
    """Replace the entire override map for a location (granular per month/field)."""
    # Validate location exists
    loc = await db.locations.find_one({"id": location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    # Validate month keys
    cleaned: Dict[str, Dict[str, Any]] = {}
    for mes, fields in (payload.overrides or {}).items():
        if mes not in MONTH_KEYS:
            raise HTTPException(status_code=400, detail=f"Invalid month '{mes}' in overrides")
        if not isinstance(fields, dict):
            raise HTTPException(status_code=400, detail=f"Override for '{mes}' must be a dict")
        # Strip empty/None values so they fall back to inheritance
        cleaned_fields = {k: v for k, v in fields.items() if v is not None and v != ""}
        if cleaned_fields:
            cleaned[mes] = cleaned_fields

    doc = {
        "location_id": location_id,
        "overrides": cleaned,
        "updated_at": now_utc(),
    }
    await db.climate_location_overrides.update_one(
        {"location_id": location_id},
        {"$set": doc, "$setOnInsert": {"created_at": now_utc()}},
        upsert=True,
    )
    return {"message": "Override saved", "fields": cleaned}


@router.delete("/locations/{location_id}/override")
async def clear_location_override(location_id: str):
    """Remove all overrides for a location (revert to region inheritance)."""
    result = await db.climate_location_overrides.delete_one({"location_id": location_id})
    return {"message": "Override cleared", "deleted": result.deleted_count}


@router.delete("/locations/{location_id}/override/{mes}/{field}")
async def clear_location_override_field(location_id: str, mes: str, field: str):
    """Clear a single overridden field (revert to inheritance for that one cell)."""
    if mes not in MONTH_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid month '{mes}'")
    result = await db.climate_location_overrides.update_one(
        {"location_id": location_id},
        {"$unset": {f"overrides.{mes}.{field}": ""}, "$set": {"updated_at": now_utc()}},
    )
    return {"message": "Field override cleared", "matched": result.matched_count}


# === RESOLUTION ===

async def _find_climate_region_for_location(location: dict) -> Optional[dict]:
    """
    Match a location to its climate region by checking the location's `region` field
    against each climate_region's match_keywords (normalized).
    Most-specific (deepest in hierarchy) match wins.
    """
    loc_region = _normalize(location.get("region", ""))
    loc_subregion = _normalize(location.get("subregion", ""))
    if not loc_region:
        return None

    candidates = await db.climate_regions.find({}).to_list(200)
    matched: List[dict] = []
    for cr in candidates:
        for kw in cr.get("match_keywords") or []:
            kn = _normalize(kw)
            if not kn:
                continue
            if kn == loc_region or kn == loc_subregion:
                matched.append(cr)
                break
            # Substring fallback for things like "valles del anduin"
            if kn in loc_region or loc_region in kn:
                matched.append(cr)
                break

    if not matched:
        return None
    # Prefer climate regions that have a parent_id (more specific) over those that don't
    matched.sort(key=lambda c: (0 if c.get("parent_id") else 1, c.get("orden", 99)))
    return matched[0]


def _icon_for_month(month_data: dict) -> Dict[str, str]:
    """Pick a single representative weather icon for a month based on percentages."""
    if not month_data:
        return {"icon": "❓", "label": "Sin datos"}
    nieve = float(month_data.get("pct_nieve_helada") or 0)
    lluvia = float(month_data.get("pct_lluvia") or 0)
    tormenta = float(month_data.get("pct_tormenta") or 0)
    calima = float(month_data.get("pct_calima") or 0)
    niebla = float(month_data.get("pct_niebla") or 0)
    horas_sol = float(month_data.get("horas_sol") or 0)
    temp_max = month_data.get("temp_max")
    temp_max_v = float(temp_max) if temp_max is not None else 99

    # Priorities: nieve > tormenta > lluvia > calima > niebla > sol > nubes
    if nieve >= 30 or temp_max_v < 0:
        return {"icon": "❄️", "label": "Nieve"}
    if tormenta >= 25:
        return {"icon": "⛈️", "label": "Tormenta"}
    if (lluvia + tormenta) >= 40:
        return {"icon": "🌧️", "label": "Lluvia"}
    if calima >= 30:
        return {"icon": "🌫️", "label": "Calima"}
    if niebla >= 35:
        return {"icon": "🌫️", "label": "Niebla"}
    if horas_sol >= 9 and lluvia < 25 and niebla < 20:
        return {"icon": "☀️", "label": "Despejado"}
    return {"icon": "☁️", "label": "Nublado"}


def _sample_icon_from_distribution(month_data: dict, location_id: str = "", mes: str = "", dia: Optional[int] = None) -> Dict[str, str]:
    """Sample a weather state from the region/month base probability distribution.

    This avoids the deterministic-collapse problem where most regions in winter
    always show 'Nublado' / 'Lluvia'. Uses a deterministic seed based on
    (location_id + mes + dia) so the same location+day always shows the same
    icon, but varies across days and locations.
    """
    if not month_data:
        return {"icon": "❓", "label": "Sin datos"}

    import random as _r
    pct_lluvia = float(month_data.get("pct_lluvia") or 0)
    pct_tormenta = float(month_data.get("pct_tormenta") or 0)
    pct_nieve = float(month_data.get("pct_nieve_helada") or 0)
    pct_niebla = float(month_data.get("pct_niebla") or 0)
    pct_calima = float(month_data.get("pct_calima") or 0)
    horas_sol = float(month_data.get("horas_sol") or 8)
    temp_max = month_data.get("temp_max")
    temp_max_v = float(temp_max) if temp_max is not None else 99

    # Build distribution
    used = pct_lluvia + pct_tormenta + pct_nieve + pct_niebla + pct_calima
    remaining = max(0.0, 100.0 - used)
    horas_factor = max(0.0, min(1.0, horas_sol / 12.0))
    despejado = remaining * horas_factor
    nublado = remaining * (1.0 - horas_factor)

    # If too cold, rain becomes snow
    if temp_max_v <= 0:
        pct_nieve = pct_nieve + pct_lluvia + pct_tormenta
        pct_lluvia = 0
        pct_tormenta = 0

    candidates = [
        ("☀️", "Despejado", despejado),
        ("⛅", "Nublado", nublado),
        ("🌫️", "Niebla", pct_niebla),
        ("🌫️", "Calima", pct_calima),
        ("🌦️", "Lluvia", pct_lluvia),
        ("⛈️", "Tormenta", pct_tormenta),
        ("❄️", "Nieve", pct_nieve),
    ]
    total = sum(c[2] for c in candidates)
    if total <= 0:
        return {"icon": "⛅", "label": "Nublado"}

    # Deterministic seed
    seed_str = f"{location_id}|{mes}|{dia or 0}"
    seed = sum(ord(c) for c in seed_str)
    rng = _r.Random(seed)
    r = rng.random() * total
    cum = 0.0
    for icon, label, w in candidates:
        cum += w
        if r <= cum:
            return {"icon": icon, "label": label}
    return {"icon": "⛅", "label": "Nublado"}


@router.get("/effective/{location_id}")
async def get_effective_climate_for_location(location_id: str, mes: Optional[str] = None):
    """
    Return the resolved climate for a location:
    base region data + per-location overrides (field-level) + computed icon per month.
    If `mes` is provided, also include a single-month convenience block.
    """
    loc = await db.locations.find_one({"id": location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    cr = await _find_climate_region_for_location(loc)
    override_doc = await db.climate_location_overrides.find_one({"location_id": location_id})
    overrides = (override_doc or {}).get("overrides") or {}

    base_meses: Dict[str, dict] = (cr or {}).get("meses") or {}
    effective_meses: Dict[str, dict] = {}
    for k in MONTH_KEYS:
        base = dict(base_meses.get(k) or {})
        ov = dict(overrides.get(k) or {})
        merged = {**base, **ov}
        merged["_overridden_fields"] = list(ov.keys())
        merged["_icon"] = _icon_for_month(merged)
        effective_meses[k] = merged

    response = {
        "location": {
            "id": loc.get("id"),
            "nombre": loc.get("nombre"),
            "region": loc.get("region"),
        },
        "climate_region": serialize_doc(cr) if cr else None,
        "has_override": bool(overrides),
        "overrides": overrides,
        "effective": effective_meses,
    }

    if mes:
        mes_norm = _normalize_month(mes)
        if not mes_norm:
            raise HTTPException(status_code=400, detail=f"Invalid month '{mes}'")
        response["mes_actual"] = mes_norm
        response["clima_mes"] = effective_meses.get(mes_norm)

    return response


@router.get("/effective/region/{region_id}")
async def get_effective_for_region(region_id: str, mes: Optional[str] = None):
    """Get a climate region's data with computed icons (no overrides applied — pure base)."""
    cr = await db.climate_regions.find_one({"_id": region_id})
    if not cr:
        raise HTTPException(status_code=404, detail="Climate region not found")
    base_meses = cr.get("meses") or {}
    effective: Dict[str, dict] = {}
    for k in MONTH_KEYS:
        m = dict(base_meses.get(k) or {})
        m["_icon"] = _icon_for_month(m)
        effective[k] = m

    return {
        "climate_region": serialize_doc(cr),
        "effective": effective,
        "clima_mes": effective.get(mes) if mes else None,
    }


@router.get("/icon/location/{location_id}")
async def get_icon_for_location_month(location_id: str, mes: str, dia: Optional[int] = None):
    """Lightweight endpoint for the travel UI: returns just the icon + key stats for a given month.
    `dia` is accepted for future per-day variation (currently uses month aggregate).
    Accepts both abbreviated ('Ene') and Eldarin ('Nénimë') month forms.

    The icon is sampled probabilistically from the region/month base distribution,
    so different locations / different days don't always show the dominant 'nublado'.
    A deterministic seed (location_id + mes + dia) keeps the result stable across
    reloads while showing variety across days/locations.
    """
    mes_norm = _normalize_month(mes)
    if not mes_norm:
        raise HTTPException(status_code=400, detail=f"Invalid month '{mes}'")
    mes = mes_norm
    loc = await db.locations.find_one({"id": location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    cr = await _find_climate_region_for_location(loc)
    override_doc = await db.climate_location_overrides.find_one({"location_id": location_id})
    overrides = ((override_doc or {}).get("overrides") or {}).get(mes) or {}
    base = ((cr or {}).get("meses") or {}).get(mes) or {}
    merged = {**base, **overrides}

    # Sample a representative state (instead of always picking the dominant one).
    # Uses a deterministic seed so reloads are stable; varies across location/day.
    icon = _sample_icon_from_distribution(merged, location_id, mes, dia)

    return {
        "location_id": location_id,
        "mes": mes,
        "icon": icon["icon"],
        "label": icon["label"],
        "temp_min": merged.get("temp_min"),
        "temp_max": merged.get("temp_max"),
        "temp_media": merged.get("temp_media"),
        "viento_kmh": merged.get("viento_kmh"),
        "dir_viento": merged.get("dir_viento"),
        "pct_lluvia": merged.get("pct_lluvia"),
        "pct_nieve_helada": merged.get("pct_nieve_helada"),
        "pct_niebla": merged.get("pct_niebla"),
        "notas": merged.get("notas_extremas"),
        "climate_region": (cr or {}).get("nombre_display") if cr else None,
    }


@router.get("/months")
async def get_months_metadata():
    """Returns the canonical 12 months + field metadata for UI rendering."""
    return {
        "months": MONTH_KEYS,
        "numeric_fields": NUMERIC_FIELDS,
        "text_fields": TEXT_FIELDS,
        "field_labels": {
            "temp_min": "Temp. Mín (°C)",
            "temp_max": "Temp. Máx (°C)",
            "temp_media": "Temp. Media (°C)",
            "ext_min": "Extremo Mín",
            "ext_max": "Extremo Máx",
            "viento_kmh": "Viento (km/h)",
            "dir_viento": "Dir. Viento",
            "lluvias_mm": "Lluvia (mm)",
            "pct_lluvia": "% Lluvia",
            "pct_tormenta": "% Tormenta",
            "horas_sol": "Horas Sol",
            "pct_calima": "% Calima",
            "pct_nieve_helada": "% Nieve/Helada",
            "pct_niebla": "% Niebla",
            "notas_extremas": "Notas",
        },
    }
