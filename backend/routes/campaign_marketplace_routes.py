"""
Campaign Marketplace routes — Fase 5 del Sistema Aventuras & Campañas.

Tablón híbrido:
  - DJ publica una `campaign_run` activa → aparece en el tablón público.
  - Jugadores solicitan unirse desde el listing (`join_origin=listing`).
  - DJ ve "jugadores disponibles" (`player_availability`) e invita
    directamente (`join_origin=invitation`).
  - Player acepta/rechaza la invitación.

Reglas críticas:
  - Listing nunca expone `campaign_code` ni datos sensibles del run.
  - Sólo runs en estado `active` se publican efectivamente. Si pasa a
    paused/finished, el listing queda `closed` automáticamente
    (validado en backend, también en filtros del listado).
  - `slots_available` se calcula on-the-fly = max_players - count(accepted).
  - `listing_status=full` cuando slots_available == 0; rechaza nuevas solicitudes.
  - Personaje con `active_campaign_run_id` no puede solicitar.
  - Banner seed derivado del run id → escudo de armas determinista en frontend.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campaign-marketplace"])

ListingStatus = Literal["open", "full", "in_progress", "closed"]


# ============================================================================
# Models
# ============================================================================
class ListingCreateBody(BaseModel):
    campaign_run_id: str
    listing_description: Optional[str] = Field(default=None, max_length=500)
    recommended_level_min: Optional[int] = Field(default=None, ge=1, le=20)
    recommended_level_max: Optional[int] = Field(default=None, ge=1, le=20)


class ListingUpdateBody(BaseModel):
    is_listed: Optional[bool] = None
    listing_description: Optional[str] = Field(default=None, max_length=500)
    recommended_level_min: Optional[int] = Field(default=None, ge=1, le=20)
    recommended_level_max: Optional[int] = Field(default=None, ge=1, le=20)
    listing_status: Optional[ListingStatus] = None


class ListingOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    campaign_run_id: str
    dm_id: str
    dm_name: Optional[str] = None
    adventure_name: Optional[str] = None
    is_listed: bool
    listing_description: Optional[str] = None
    recommended_level_min: Optional[int] = None
    recommended_level_max: Optional[int] = None
    listing_status: ListingStatus
    region: Optional[str] = None
    location_name: Optional[str] = None
    max_players: int
    slots_available: int
    banner_seed: str  # used by the frontend to render a deterministic crest
    created_at: str
    updated_at: str


class PlayerAvailabilityBody(BaseModel):
    character_id: str
    is_available: bool
    preferences_text: Optional[str] = Field(default=None, max_length=300)
    preferred_level_min: Optional[int] = Field(default=None, ge=1, le=20)
    preferred_level_max: Optional[int] = Field(default=None, ge=1, le=20)


class PlayerAvailabilityOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: Optional[str] = None
    character_id: str
    character_name: Optional[str] = None
    character_level: Optional[int] = None
    character_culture: Optional[str] = None
    is_available: bool
    preferences_text: Optional[str] = None
    preferred_level_min: Optional[int] = None
    preferred_level_max: Optional[int] = None
    updated_at: str


class InvitationCreateBody(BaseModel):
    campaign_run_id: str
    target_user_id: str
    character_id: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=300)
    expires_in_days: int = Field(default=7, ge=1, le=30)


class InvitationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    campaign_run_id: str
    adventure_name: Optional[str] = None
    dm_id: str
    dm_name: Optional[str] = None
    target_user_id: str
    target_user_name: Optional[str] = None
    character_id: Optional[str] = None
    character_name: Optional[str] = None
    status: Literal["pending", "accepted", "rejected", "expired"]
    message: Optional[str] = None
    created_at: str
    expires_at: Optional[str] = None


class InvitationRespondBody(BaseModel):
    status: Literal["accepted", "rejected"]
    character_id: Optional[str] = None  # required if status=accepted and no preset


class JoinFromListingBody(BaseModel):
    character_id: str


# ============================================================================
# Helpers
# ============================================================================
def _is_maestro(user: dict) -> bool:
    return user.get("role") == "maestro"


def _serialize(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


async def _ensure_indexes(db):
    try:
        await db.campaign_listings.create_index("campaign_run_id", unique=True)
        await db.campaign_listings.create_index("listing_status")
        await db.player_availability.create_index([("user_id", 1), ("character_id", 1)], unique=True)
        await db.player_availability.create_index("is_available")
        await db.campaign_invitations.create_index("target_user_id")
        await db.campaign_invitations.create_index("dm_id")
        await db.campaign_invitations.create_index("status")
    except Exception as e:
        logger.warning("marketplace indexes: %s", e)


async def _compute_slots(db, run_id: str, max_players: int) -> int:
    accepted = await db.campaign_players.count_documents({
        "campaign_run_id": run_id,
        "status": "accepted",
    })
    return max(0, max_players - accepted)


async def _enrich_listing(db, listing: dict) -> dict:
    """Attach run-derived fields (max_players, region, slots_available)."""
    out = _serialize(listing)
    run = await db.campaign_runs.find_one({"id": listing["campaign_run_id"]})
    if run:
        out["adventure_name"] = run.get("adventure_name")
        out["region"] = run.get("region")
        out["location_name"] = run.get("location_name")
        out["max_players"] = run.get("max_players", 4)
        out["slots_available"] = await _compute_slots(db, listing["campaign_run_id"], run.get("max_players", 4))
        out["dm_name"] = run.get("dm_name")
        # Auto-close listings when run is no longer active
        if run.get("status") not in ("active",) and listing.get("listing_status") not in ("closed",):
            out["listing_status"] = "closed"
        elif out["slots_available"] == 0 and listing.get("listing_status") == "open":
            out["listing_status"] = "full"
    else:
        out["max_players"] = 0
        out["slots_available"] = 0
    return out


def _make_banner_seed(run_id: str) -> str:
    """Stable seed derived from run id — frontend uses it for the auto-crest."""
    return run_id[:8]


async def _has_active_character(db, user_id: str, character_id: str) -> bool:
    """Returns True if the character is locked in any other run."""
    char = await db.characters.find_one({"_id": character_id})
    if not char:
        return False
    return bool(char.get("active_campaign_run_id"))


# ============================================================================
# DJ — manage own listing
# ============================================================================
@router.post("/campaign-listings", response_model=ListingOut, status_code=201)
async def create_listing(payload: ListingCreateBody, user: dict = Depends(get_current_user)):
    """DJ publishes their run. One listing per run (unique index)."""
    from server import db
    await _ensure_indexes(db)

    run = await db.campaign_runs.find_one({"id": payload.campaign_run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not (_is_maestro(user) or run.get("dm_id") == user.get("id")):
        raise HTTPException(status_code=403, detail="Sólo el DJ puede publicar su campaña")
    if run.get("status") != "active":
        raise HTTPException(
            status_code=400,
            detail="La campaña debe estar activa para publicarla",
        )

    existing = await db.campaign_listings.find_one({"campaign_run_id": payload.campaign_run_id})
    if existing:
        raise HTTPException(status_code=400, detail="Esta campaña ya está publicada")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": payload.campaign_run_id,
        "dm_id": run["dm_id"],
        "is_listed": True,
        "listing_description": payload.listing_description,
        "recommended_level_min": payload.recommended_level_min or run.get("recommended_level_min"),
        "recommended_level_max": payload.recommended_level_max or run.get("recommended_level_max"),
        "listing_status": "open",
        "banner_seed": _make_banner_seed(payload.campaign_run_id),
        "created_at": now,
        "updated_at": now,
    }
    await db.campaign_listings.insert_one(doc)
    return await _enrich_listing(db, doc)


@router.get("/campaign-listings", response_model=List[ListingOut])
async def list_listings(
    region: Optional[str] = None,
    level_min: Optional[int] = None,
    level_max: Optional[int] = None,
    only_open: bool = True,
    user: dict = Depends(get_current_user),
):
    """Public-ish listing — any authenticated user can browse.

    Filters out closed listings by default (only_open=True). Excludes
    listings whose run is no longer active.
    """
    from server import db
    await _ensure_indexes(db)

    query: dict = {"is_listed": True}
    if only_open:
        query["listing_status"] = {"$in": ["open", "full", "in_progress"]}
    if level_min is not None:
        query["recommended_level_max"] = {"$gte": level_min}
    if level_max is not None:
        query["recommended_level_min"] = {"$lte": level_max}

    cursor = db.campaign_listings.find(query).sort("updated_at", -1)
    out = []
    async for d in cursor:
        enriched = await _enrich_listing(db, d)
        # Apply region filter post-enrichment (region comes from the run)
        if region and (enriched.get("region") or "").lower() != region.lower():
            continue
        # Skip listings auto-closed by run.status != active
        if only_open and enriched.get("listing_status") == "closed":
            continue
        out.append(enriched)
    return out


@router.get("/campaign-listings/{listing_id}", response_model=ListingOut)
async def get_listing(listing_id: str, user: dict = Depends(get_current_user)):
    from server import db
    listing = await db.campaign_listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listado no encontrado")
    return await _enrich_listing(db, listing)


@router.patch("/campaign-listings/{listing_id}", response_model=ListingOut)
async def update_listing(
    listing_id: str, payload: ListingUpdateBody, user: dict = Depends(get_current_user)
):
    from server import db
    listing = await db.campaign_listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listado no encontrado")
    if not (_is_maestro(user) or listing.get("dm_id") == user.get("id")):
        raise HTTPException(status_code=403, detail="Sin permiso")

    upd = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if upd:
        upd["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.campaign_listings.update_one({"id": listing_id}, {"$set": upd})
    new_doc = await db.campaign_listings.find_one({"id": listing_id})
    return await _enrich_listing(db, new_doc)


@router.delete("/campaign-listings/{listing_id}")
async def delete_listing(listing_id: str, user: dict = Depends(get_current_user)):
    from server import db
    listing = await db.campaign_listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listado no encontrado")
    if not (_is_maestro(user) or listing.get("dm_id") == user.get("id")):
        raise HTTPException(status_code=403, detail="Sin permiso")
    await db.campaign_listings.delete_one({"id": listing_id})
    return {"deleted": True, "id": listing_id}


@router.post("/campaign-listings/{listing_id}/request-join", status_code=201)
async def request_join_from_listing(
    listing_id: str,
    payload: JoinFromListingBody,
    user: dict = Depends(get_current_user),
):
    """Player applies to a listing with one of their characters. Same checks
    as `join-by-code` but with join_origin='listing'."""
    from server import db
    listing = await db.campaign_listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listado no encontrado")

    run = await db.campaign_runs.find_one({"id": listing["campaign_run_id"]})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if run.get("status") != "active":
        raise HTTPException(status_code=400, detail="La campaña no está activa")

    enriched = await _enrich_listing(db, listing)
    if enriched["listing_status"] in ("closed", "full"):
        raise HTTPException(status_code=400, detail=f"El listado está {enriched['listing_status']}")

    char = await db.characters.find_one({"_id": payload.character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    if not _is_maestro(user) and char.get("owner_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="No es tu personaje")
    if char.get("active_campaign_run_id") and char["active_campaign_run_id"] != run["id"]:
        raise HTTPException(status_code=400, detail="Personaje ya en otra campaña activa")

    # Reuse same multi-character validation as join-by-code
    same_user_active = await db.campaign_players.count_documents({
        "campaign_run_id": run["id"],
        "user_id": user.get("id"),
        "status": {"$in": ["pending", "accepted"]},
    })
    if not run.get("allow_multi_characters") and same_user_active >= 1:
        raise HTTPException(status_code=400, detail="No se permite multi-personaje")
    if run.get("allow_multi_characters"):
        cap = run.get("max_characters_per_player") or 1
        if same_user_active >= cap:
            raise HTTPException(status_code=400, detail=f"Máximo {cap} personajes")

    existing = await db.campaign_players.find_one({
        "campaign_run_id": run["id"],
        "character_id": payload.character_id,
        "status": {"$in": ["pending", "accepted"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes solicitud con este personaje")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": run["id"],
        "user_id": user.get("id"),
        "character_id": payload.character_id,
        "status": "pending",
        "join_origin": "listing",
        "xp_pending_total": 0,
        "joined_at": now,
        "accepted_at": None,
        "closed_at": None,
    }
    await db.campaign_players.insert_one(doc)
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": run["id"],
        "event_type": "player_request_listing",
        "description": f"Solicitud por tablón: {char.get('nombre')} ({user.get('email')})",
        "created_at": now,
    })
    return doc


# ============================================================================
# Player availability
# ============================================================================
@router.put("/player-availability", response_model=PlayerAvailabilityOut)
async def upsert_player_availability(
    payload: PlayerAvailabilityBody, user: dict = Depends(get_current_user)
):
    """Player marks one of their characters as available (or not). Idempotent
    upsert keyed by (user_id, character_id)."""
    from server import db
    await _ensure_indexes(db)

    char = await db.characters.find_one({"_id": payload.character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    if not _is_maestro(user) and char.get("owner_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="No es tu personaje")
    # If the character is locked in a run, force is_available=False
    is_avail = payload.is_available and not char.get("active_campaign_run_id")

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "user_id": user.get("id"),
        "character_id": payload.character_id,
        "is_available": is_avail,
        "preferences_text": payload.preferences_text,
        "preferred_level_min": payload.preferred_level_min,
        "preferred_level_max": payload.preferred_level_max,
        "updated_at": now,
    }
    res = await db.player_availability.update_one(  # noqa: F841
        {"user_id": user.get("id"), "character_id": payload.character_id},
        {"$set": update, "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )
    doc = await db.player_availability.find_one({
        "user_id": user.get("id"),
        "character_id": payload.character_id,
    })

    out = _serialize(doc)
    out["character_name"] = char.get("nombre")
    out["character_level"] = char.get("nivel")
    out["character_culture"] = char.get("cultura_nombre") or char.get("cultura")
    u = await db.users.find_one({"id": user.get("id")})
    if u:
        out["user_name"] = u.get("nombre") or u.get("name") or u.get("email")
    return out


@router.get("/player-availability/mine", response_model=List[PlayerAvailabilityOut])
async def my_availability(user: dict = Depends(get_current_user)):
    from server import db
    cursor = db.player_availability.find({"user_id": user.get("id")})
    out = []
    async for d in cursor:
        char = await db.characters.find_one({"_id": d["character_id"]})
        item = _serialize(d)
        if char:
            item["character_name"] = char.get("nombre")
            item["character_level"] = char.get("nivel")
            item["character_culture"] = char.get("cultura_nombre") or char.get("cultura")
        out.append(item)
    return out


@router.get("/player-availability", response_model=List[PlayerAvailabilityOut])
async def list_available_players(user: dict = Depends(get_current_user)):
    """DJ-side view: characters whose owner has marked them available."""
    if user.get("role") not in ("maestro", "director_de_juego"):
        raise HTTPException(status_code=403, detail="Sólo DJ o Maestro")
    from server import db

    cursor = db.player_availability.find({"is_available": True}).sort("updated_at", -1)
    out = []
    async for d in cursor:
        char = await db.characters.find_one({"_id": d["character_id"]})
        # If the character got locked since they marked themselves available, skip
        if not char or char.get("active_campaign_run_id"):
            continue
        item = _serialize(d)
        item["character_name"] = char.get("nombre")
        item["character_level"] = char.get("nivel")
        item["character_culture"] = char.get("cultura_nombre") or char.get("cultura")
        u = await db.users.find_one({"id": d["user_id"]})
        if u:
            item["user_name"] = u.get("nombre") or u.get("name") or u.get("email")
        out.append(item)
    return out


# ============================================================================
# Invitations (DJ → player)
# ============================================================================
@router.get("/campaign-runs/{run_id}/maestro-candidates")
async def maestro_candidates(
    run_id: str, search: Optional[str] = None, user: dict = Depends(get_current_user)
):
    """Maestro-only: list ALL characters to invite for testing campaigns,
    regardless of availability. Excludes characters already in this run."""
    if not _is_maestro(user):
        raise HTTPException(status_code=403, detail="Sólo el Maestro")
    from server import db

    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    in_run = set()
    async for p in db.campaign_players.find(
        {"campaign_run_id": run_id, "status": {"$in": ["pending", "accepted"]}}
    ):
        in_run.add(p.get("character_id"))
    invited = set()
    async for i in db.campaign_invitations.find(
        {"campaign_run_id": run_id, "status": "pending"}
    ):
        invited.add(i.get("character_id"))

    query: dict = {}
    if search:
        query["nombre"] = {"$regex": search, "$options": "i"}

    out = []
    async for ch in db.characters.find(query).limit(300):
        if ch["_id"] in in_run:
            continue
        u = await db.users.find_one({"id": ch.get("owner_id")})
        out.append({
            "character_id": ch["_id"],
            "character_name": ch.get("nombre"),
            "character_level": ch.get("nivel"),
            "character_culture": ch.get("cultura_nombre") or ch.get("cultura"),
            "user_id": ch.get("owner_id"),
            "user_name": (u.get("nombre") or u.get("name") or u.get("email")) if u else None,
            "locked": bool(ch.get("active_campaign_run_id")),
            "invited": ch["_id"] in invited,
        })
    out.sort(key=lambda x: (x["invited"], x["locked"], (x["character_name"] or "").lower()))
    return out


@router.post("/campaign-invitations", response_model=InvitationOut, status_code=201)
async def create_invitation(
    payload: InvitationCreateBody, user: dict = Depends(get_current_user)
):
    from server import db
    await _ensure_indexes(db)

    run = await db.campaign_runs.find_one({"id": payload.campaign_run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not (_is_maestro(user) or run.get("dm_id") == user.get("id")):
        raise HTTPException(status_code=403, detail="Sólo el DJ puede invitar")
    if run.get("status") != "active":
        raise HTTPException(status_code=400, detail="La campaña no está activa")

    target = await db.users.find_one({"id": payload.target_user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Avoid duplicate pending invitations for the same character in this run.
    if payload.character_id:
        dup = await db.campaign_invitations.find_one({
            "campaign_run_id": payload.campaign_run_id,
            "character_id": payload.character_id,
            "status": "pending",
        })
        if dup:
            raise HTTPException(status_code=400, detail="Ya existe una invitación pendiente para ese personaje")

    char_name = None
    if payload.character_id:
        char = await db.characters.find_one({"_id": payload.character_id})
        if not char:
            raise HTTPException(status_code=404, detail="Personaje no encontrado")
        char_name = char.get("nombre")

    now = datetime.now(timezone.utc)
    expires = (now + timedelta(days=payload.expires_in_days)).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": payload.campaign_run_id,
        "adventure_name": run.get("adventure_name"),
        "dm_id": run["dm_id"],
        "dm_name": run.get("dm_name"),
        "target_user_id": payload.target_user_id,
        "target_user_name": target.get("nombre") or target.get("name") or target.get("email"),
        "character_id": payload.character_id,
        "character_name": char_name,
        "status": "pending",
        "message": payload.message,
        "created_at": now.isoformat(),
        "expires_at": expires,
    }
    await db.campaign_invitations.insert_one(doc)
    return doc


def _is_expired(invitation: dict) -> bool:
    exp = invitation.get("expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp) < datetime.now(timezone.utc)
    except ValueError:
        return False


@router.get("/campaign-invitations/mine", response_model=List[InvitationOut])
async def my_invitations(user: dict = Depends(get_current_user)):
    """Player view — invitations targeted at me."""
    from server import db
    cursor = db.campaign_invitations.find({"target_user_id": user.get("id")}).sort("created_at", -1)
    out = []
    async for d in cursor:
        if d.get("status") == "pending" and _is_expired(d):
            await db.campaign_invitations.update_one(
                {"id": d["id"]}, {"$set": {"status": "expired"}}
            )
            d["status"] = "expired"
        out.append(_serialize(d))
    return out


@router.get("/campaign-invitations/sent", response_model=List[InvitationOut])
async def my_sent_invitations(user: dict = Depends(get_current_user)):
    """DJ view — invitations I have sent."""
    from server import db
    cursor = db.campaign_invitations.find({"dm_id": user.get("id")}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]


@router.patch("/campaign-invitations/{inv_id}/respond", response_model=InvitationOut)
async def respond_invitation(
    inv_id: str, payload: InvitationRespondBody, user: dict = Depends(get_current_user)
):
    """Player accepts or rejects a pending invitation. If accepted, creates
    a `campaign_players` row with status=pending and join_origin=invitation
    so the DJ still has the final say (consistency with code/listing flow)."""
    from server import db
    inv = await db.campaign_invitations.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv["target_user_id"] != user.get("id") and not _is_maestro(user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    if inv["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invitación ya {inv['status']}")
    if _is_expired(inv):
        await db.campaign_invitations.update_one({"id": inv_id}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invitación expirada")

    now = datetime.now(timezone.utc).isoformat()
    if payload.status == "rejected":
        await db.campaign_invitations.update_one({"id": inv_id}, {"$set": {"status": "rejected"}})
    else:
        # Accept → require character_id (use preset if supplied at creation time)
        char_id = payload.character_id or inv.get("character_id")
        if not char_id:
            raise HTTPException(status_code=400, detail="Selecciona un personaje")

        char = await db.characters.find_one({"_id": char_id})
        if not char:
            raise HTTPException(status_code=404, detail="Personaje no encontrado")
        if not _is_maestro(user) and char.get("owner_id") != user.get("id"):
            raise HTTPException(status_code=403, detail="No es tu personaje")
        if char.get("active_campaign_run_id"):
            raise HTTPException(status_code=400, detail="Personaje ocupado en otra campaña")

        run = await db.campaign_runs.find_one({"id": inv["campaign_run_id"]})
        if not run or run.get("status") != "active":
            raise HTTPException(status_code=400, detail="Campaña ya no está activa")

        await db.campaign_players.insert_one({
            "id": str(uuid.uuid4()),
            "campaign_run_id": inv["campaign_run_id"],
            "user_id": user.get("id"),
            "character_id": char_id,
            "status": "pending",
            "join_origin": "invitation",
            "xp_pending_total": 0,
            "joined_at": now,
            "accepted_at": None,
            "closed_at": None,
        })
        await db.campaign_invitations.update_one(
            {"id": inv_id}, {"$set": {"status": "accepted", "character_id": char_id}}
        )
        await db.campaign_log.insert_one({
            "id": str(uuid.uuid4()),
            "campaign_run_id": inv["campaign_run_id"],
            "event_type": "invitation_accepted",
            "description": f"Invitación aceptada por {char.get('nombre')}",
            "created_at": now,
        })

    new_doc = await db.campaign_invitations.find_one({"id": inv_id})
    return _serialize(new_doc)


@router.delete("/campaign-invitations/{inv_id}")
async def cancel_invitation(inv_id: str, user: dict = Depends(get_current_user)):
    """DJ cancels an invitation they sent."""
    from server import db
    inv = await db.campaign_invitations.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv["dm_id"] != user.get("id") and not _is_maestro(user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    await db.campaign_invitations.delete_one({"id": inv_id})
    return {"deleted": True, "id": inv_id}
