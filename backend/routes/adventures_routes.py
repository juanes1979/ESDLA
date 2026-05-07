"""
Adventures routes — Fase 1 del Sistema Aventuras & Campañas.

An "Adventure" is a STATIC reusable template (a module/scenario document)
created by Maestro or DJ. It does NOT host live players or state; its sole
purpose is to be cloned into a `campaign_run` (live instance) when the DJ
decides to play it. Tabs in the UI map to the wizard sections.

Permissions:
  - Maestro Supremo: full access to any adventure.
  - DJ creator: full access to their own adventure (private or public).
  - Other DJs / players: can READ public adventures and CLONE them into a
    new private adventure owned by the cloner. They cannot edit the original.

Adventure cloning is different from "generate campaign run" (Fase 2): cloning
duplicates the adventure document so the cloner can edit/customize it BEFORE
running it; "generate campaign run" creates a separate `campaign_runs`
document that mirrors the adventure into per-run collections.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/adventures", tags=["adventures"])


# ============================================================================
# Pydantic models
# ============================================================================
class EnvironmentImage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_id: str
    path: Optional[str] = None
    description: Optional[str] = None


class EnvironmentItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    order_index: int = 0
    images: List[EnvironmentImage] = Field(default_factory=list)  # max 5 — validated below


class IntrigueItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    linked_plot: Optional[str] = None


class TravelEvent(BaseModel):
    """A discrete travel event in the adventure (replaces the single
    `travel_events_text` textarea)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    description: str = ""
    player_notes: str = ""  # notas que el DJ puede mostrar a los jugadores


class TravelStop(BaseModel):
    """Intermediate stop of the planned route. Either a real location id or
    a free-text custom point picked on the map. Up to 5 stops."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_id: Optional[str] = None  # null when picked from the map
    location_name: Optional[str] = None
    region: Optional[str] = None
    map_x: Optional[float] = None
    map_y: Optional[float] = None
    note: Optional[str] = None


class AdventureNPC(BaseModel):
    """An NPC entry attached to the adventure. `bestiary_id` is the npcs._id
    when picked from the bestiary; otherwise free-text, optionally with a
    full custom stat block in `custom_stats` (used directly during combat in
    a campaign run)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bestiary_id: Optional[str] = None
    bestiary_categoria: Optional[str] = None  # "malignos" | "pnj" | "animales" | "especiales"
    history: Optional[str] = None
    special: Optional[str] = None
    custom_stats: Optional[dict] = None  # NPCCreate-shaped dict if created from scratch


class AdventureMap(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_id: str  # GridFS id from /storage/upload
    path: Optional[str] = None
    description: Optional[str] = None


class AdventureBase(BaseModel):
    """Core fields editable through the wizard. Most fields are optional at
    creation time to support save-as-draft from any wizard step. The two
    truly required fields are `name` and `max_players`; everything else can
    be filled in iteratively."""
    model_config = ConfigDict(extra="ignore")

    # Step 1 — Basic
    name: str = Field(..., min_length=3, max_length=80)
    image_file_id: Optional[str] = None  # GridFS id (cover image, ≤0.5 MB)
    image_path: Optional[str] = None
    year: Optional[int] = None  # year T.E.
    season: Optional[Literal["primavera", "verano", "otono", "invierno"]] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)
    day: Optional[int] = Field(default=None, ge=1, le=31)
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    region: Optional[str] = None

    # Step 2 — Premise
    description: Optional[str] = None  # ¿Qué? — gancho/estado del mundo
    motivation_text: Optional[str] = None  # ¿Por qué? — presentación
    patron_id: Optional[str] = None  # mecenas (npc id)
    patron_name: Optional[str] = None
    presenter_text: Optional[str] = None  # quién presenta si no hay mecenas
    rumor: Optional[str] = None
    presentation_text: Optional[str] = None  # Texto para presentar a los personajes (DJ → jugadores)
    ancient_lore_difficulty: Optional[int] = Field(default=None, ge=5, le=30)
    ancient_lore_text: Optional[str] = None

    # Step 3 — Background & travel
    background: Optional[str] = None
    travel_events_text: Optional[str] = None  # legacy single-textarea (kept for backward compatibility)
    travel_events: List[TravelEvent] = Field(default_factory=list)
    travel_route: List[TravelStop] = Field(default_factory=list)  # legacy — moved to travel generator

    # Step 5/6 — Lists
    environments: List[EnvironmentItem] = Field(default_factory=list)
    intrigues: List[IntrigueItem] = Field(default_factory=list)
    npcs: List[AdventureNPC] = Field(default_factory=list)
    maps: List[AdventureMap] = Field(default_factory=list)

    # Step 8 — Configuration
    max_players: int = Field(..., ge=1, le=20)
    allow_multi_characters: bool = False
    max_characters_per_player: Optional[int] = Field(default=None, ge=1, le=20)
    recommended_level_min: Optional[int] = Field(default=None, ge=1, le=20)
    recommended_level_max: Optional[int] = Field(default=None, ge=1, le=20)
    # Restricciones de cultura — lista de slugs/ids de cultura permitidas. Vacío = sin restricción.
    allowed_culture_ids: List[str] = Field(default_factory=list)
    allowed_subcultures: List[str] = Field(default_factory=list)
    xp_pool: Optional[int] = Field(default=None, ge=0)  # PX a repartir entre los personajes
    is_public: bool = False

    @field_validator("max_characters_per_player")
    @classmethod
    def _multi_char_consistency(cls, v, info):
        # Will be revalidated post-build via custom rule below.
        return v


class AdventureCreate(AdventureBase):
    pass


class AdventureUpdate(BaseModel):
    """All fields optional — partial update."""
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = Field(default=None, min_length=3, max_length=80)
    image_file_id: Optional[str] = None
    image_path: Optional[str] = None
    year: Optional[int] = None
    season: Optional[Literal["primavera", "verano", "otono", "invierno"]] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)
    day: Optional[int] = Field(default=None, ge=1, le=31)
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    region: Optional[str] = None
    description: Optional[str] = None
    motivation_text: Optional[str] = None
    patron_id: Optional[str] = None
    patron_name: Optional[str] = None
    presenter_text: Optional[str] = None
    rumor: Optional[str] = None
    presentation_text: Optional[str] = None
    ancient_lore_difficulty: Optional[int] = Field(default=None, ge=5, le=30)
    ancient_lore_text: Optional[str] = None
    background: Optional[str] = None
    travel_events_text: Optional[str] = None
    travel_events: Optional[List[TravelEvent]] = None
    travel_route: Optional[List[TravelStop]] = None
    environments: Optional[List[EnvironmentItem]] = None
    intrigues: Optional[List[IntrigueItem]] = None
    npcs: Optional[List[AdventureNPC]] = None
    maps: Optional[List[AdventureMap]] = None
    max_players: Optional[int] = Field(default=None, ge=1, le=20)
    allow_multi_characters: Optional[bool] = None
    max_characters_per_player: Optional[int] = Field(default=None, ge=1, le=20)
    recommended_level_min: Optional[int] = Field(default=None, ge=1, le=20)
    recommended_level_max: Optional[int] = Field(default=None, ge=1, le=20)
    allowed_culture_ids: Optional[List[str]] = None
    allowed_subcultures: Optional[List[str]] = None
    xp_pool: Optional[int] = Field(default=None, ge=0)
    is_public: Optional[bool] = None


class AdventureOut(AdventureBase):
    id: str
    creator_dm_id: str
    creator_name: Optional[str] = None
    cloned_from: Optional[str] = None
    created_at: str
    updated_at: str


# ============================================================================
# Helpers
# ============================================================================
def _is_maestro(user: dict) -> bool:
    return user.get("role") == "maestro"


def _can_edit(adv: dict, user: dict) -> bool:
    if _is_maestro(user):
        return True
    return adv.get("creator_dm_id") == user.get("id")


def _can_view(adv: dict, user: dict) -> bool:
    if _is_maestro(user):
        return True
    if adv.get("creator_dm_id") == user.get("id"):
        return True
    return bool(adv.get("is_public"))


def _validate_multichar(payload: dict):
    if payload.get("allow_multi_characters"):
        m = payload.get("max_characters_per_player")
        if not m or m < 2:
            raise HTTPException(
                status_code=422,
                detail="Si permites múltiples personajes por jugador, max_characters_per_player debe ser ≥ 2",
            )
        max_p = payload.get("max_players")
        if max_p and m > max_p:
            raise HTTPException(
                status_code=422,
                detail="max_characters_per_player no puede superar max_players",
            )


def _validate_travel_route(payload: dict):
    route = payload.get("travel_route") or []
    if len(route) > 5:
        raise HTTPException(status_code=422, detail="La ruta admite hasta 5 paradas intermedias")


def _validate_env_images(payload: dict):
    for env in payload.get("environments") or []:
        imgs = env.get("images") or []
        if len(imgs) > 5:
            raise HTTPException(
                status_code=422,
                detail=f"Cada entorno admite hasta 5 imágenes (entorno '{env.get('title') or '?'}')",
            )


def _derive_season(month):
    """Derive Spanish-named season from a month number (1-12). Hemisferio
    norte (Tierra Media)."""
    if not month:
        return None
    try:
        m = int(month)
    except (TypeError, ValueError):
        return None
    if m in (3, 4, 5):
        return "primavera"
    if m in (6, 7, 8):
        return "verano"
    if m in (9, 10, 11):
        return "otono"
    if m in (12, 1, 2):
        return "invierno"
    return None


def _serialize(doc: dict) -> dict:
    """Strip _id and ensure datetimes are ISO strings."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    for k in ("created_at", "updated_at"):
        if isinstance(out.get(k), datetime):
            out[k] = out[k].isoformat()
    return out


# ============================================================================
# Endpoints
# ============================================================================
@router.post("", response_model=AdventureOut, status_code=201)
async def create_adventure(
    payload: AdventureCreate, user: dict = Depends(get_current_user)
):
    """Create a new Adventure. Only DJ or Maestro may create."""
    if user.get("role") not in ("maestro", "director_de_juego"):
        raise HTTPException(status_code=403, detail="Sólo Maestro o DJ pueden crear aventuras")
    from server import db

    body = payload.model_dump()
    _validate_multichar(body)
    _validate_travel_route(body)
    _validate_env_images(body)

    # Auto-derive season from month if season not provided
    if not body.get("season") and body.get("month"):
        body["season"] = _derive_season(body.get("month"))

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **body,
        "id": str(uuid.uuid4()),
        "creator_dm_id": user.get("id"),
        "creator_name": user.get("nombre") or user.get("email"),
        "cloned_from": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.adventures.insert_one(doc)
    return _serialize(doc)


@router.get("", response_model=List[AdventureOut])
async def list_adventures(
    scope: Literal["mine", "public", "all"] = "all",
    user: dict = Depends(get_current_user),
):
    """List adventures.

    scope=mine    → adventures created by the current user
    scope=public  → public adventures (any creator)
    scope=all     → mine ∪ public (default for DJ/players);
                     Maestro sees absolutely everything.
    """
    from server import db

    if _is_maestro(user) and scope == "all":
        query: dict = {}
    elif scope == "mine":
        query = {"creator_dm_id": user.get("id")}
    elif scope == "public":
        query = {"is_public": True}
    else:  # all (non-maestro)
        query = {"$or": [{"creator_dm_id": user.get("id")}, {"is_public": True}]}

    cursor = db.adventures.find(query).sort("updated_at", -1)
    return [_serialize(d) async for d in cursor]


@router.get("/{adventure_id}", response_model=AdventureOut)
async def get_adventure(adventure_id: str, user: dict = Depends(get_current_user)):
    from server import db
    adv = await db.adventures.find_one({"id": adventure_id})
    if not adv:
        raise HTTPException(status_code=404, detail="Aventura no encontrada")
    if not _can_view(adv, user):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta aventura")
    return _serialize(adv)


@router.patch("/{adventure_id}", response_model=AdventureOut)
async def update_adventure(
    adventure_id: str,
    payload: AdventureUpdate,
    user: dict = Depends(get_current_user),
):
    from server import db
    adv = await db.adventures.find_one({"id": adventure_id})
    if not adv:
        raise HTTPException(status_code=404, detail="Aventura no encontrada")
    if not _can_edit(adv, user):
        raise HTTPException(status_code=403, detail="No puedes modificar esta aventura")

    update_fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_fields:
        return _serialize(adv)

    merged = {**adv, **update_fields}
    _validate_multichar(merged)
    _validate_travel_route(merged)
    _validate_env_images(merged)

    # Auto-derive season when month changes and season was not explicitly set
    if "month" in update_fields and not update_fields.get("season") and not merged.get("season"):
        derived = _derive_season(update_fields.get("month"))
        if derived:
            update_fields["season"] = derived

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.adventures.update_one({"id": adventure_id}, {"$set": update_fields})
    new_doc = await db.adventures.find_one({"id": adventure_id})
    return _serialize(new_doc)


@router.delete("/{adventure_id}")
async def delete_adventure(adventure_id: str, user: dict = Depends(get_current_user)):
    from server import db
    adv = await db.adventures.find_one({"id": adventure_id})
    if not adv:
        raise HTTPException(status_code=404, detail="Aventura no encontrada")
    if not _can_edit(adv, user):
        raise HTTPException(status_code=403, detail="No puedes eliminar esta aventura")

    # TODO Fase 2: refuse delete if there are active campaign_runs based on it.
    await db.adventures.delete_one({"id": adventure_id})
    return {"deleted": True, "id": adventure_id}


@router.post("/{adventure_id}/clone", response_model=AdventureOut, status_code=201)
async def clone_adventure(adventure_id: str, user: dict = Depends(get_current_user)):
    """Clone a public (or own) adventure into a new private adventure owned
    by the current user. The clone keeps `cloned_from` for traceability."""
    if user.get("role") not in ("maestro", "director_de_juego"):
        raise HTTPException(status_code=403, detail="Sólo Maestro o DJ pueden clonar aventuras")
    from server import db

    src = await db.adventures.find_one({"id": adventure_id})
    if not src:
        raise HTTPException(status_code=404, detail="Aventura no encontrada")
    if not _can_view(src, user):
        raise HTTPException(status_code=403, detail="No puedes clonar esta aventura")

    now = datetime.now(timezone.utc).isoformat()
    base = {k: v for k, v in src.items() if k not in ("_id", "id", "creator_dm_id", "creator_name", "created_at", "updated_at", "cloned_from")}
    # Force new ids for nested lists to avoid collisions
    for key in ("environments", "intrigues", "npcs", "maps", "travel_events", "travel_route"):
        if base.get(key):
            base[key] = [{**item, "id": str(uuid.uuid4())} for item in base[key]]
    # Environment images also need new ids
    for env in base.get("environments") or []:
        if env.get("images"):
            env["images"] = [{**img, "id": str(uuid.uuid4())} for img in env["images"]]

    doc = {
        **base,
        "id": str(uuid.uuid4()),
        "name": f"{src.get('name')} (copia)",
        "is_public": False,  # clones start private
        "creator_dm_id": user.get("id"),
        "creator_name": user.get("nombre") or user.get("email"),
        "cloned_from": adventure_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.adventures.insert_one(doc)
    return _serialize(doc)
