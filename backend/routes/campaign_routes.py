"""
Campaign Runs routes — Fase 2 del Sistema Aventuras & Campañas.

A `campaign_run` is a LIVE INSTANCE of an Adventure. When a DJ "generates a
run" from an adventure, we:
  1. CLONE the adventure content into per-run collections so the DJ can
     customize the execution without touching the original adventure.
  2. Generate a unique 8-character `campaign_code` (base36, no ambiguous
     O/0/I/1) — the discreet share-code that players will type to join.
  3. Persist the run with status='draft' until the DJ activates it.

Status machine:
    draft → active → paused → finished
    paused → active (resume)

NOTE: joining/players (Fase 3), pending XP (Fase 4), public listings (Fase 5)
are deliberately NOT in this module. Only generation + DJ hub + status
transitions live here.
"""
from __future__ import annotations

import logging
import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaign-runs", tags=["campaign-runs"])

# Base36 minus ambiguous chars (no 0/O/1/I/L). 32 chars total.
_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
_CODE_LENGTH = 8


# ============================================================================
# Models
# ============================================================================
class CampaignRunOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    adventure_id: str
    adventure_name: Optional[str] = None
    dm_id: str
    dm_name: Optional[str] = None
    campaign_code: str
    status: Literal["draft", "active", "paused", "finished"]
    created_at: str
    activated_at: Optional[str] = None
    finished_at: Optional[str] = None
    # Snapshot fields (so the hub doesn't need to re-fetch the adventure)
    description: Optional[str] = None
    motivation_text: Optional[str] = None
    image_file_id: Optional[str] = None
    year: Optional[int] = None
    season: Optional[str] = None
    location_name: Optional[str] = None
    region: Optional[str] = None
    max_players: int
    allow_multi_characters: bool = False
    max_characters_per_player: Optional[int] = None
    recommended_level_min: Optional[int] = None
    recommended_level_max: Optional[int] = None
    patron_id: Optional[str] = None
    patron_name: Optional[str] = None


class CampaignContentOut(BaseModel):
    """Lists of cloned content for the hub view."""
    model_config = ConfigDict(extra="ignore")
    environments: List[dict] = Field(default_factory=list)
    intrigues: List[dict] = Field(default_factory=list)
    npcs: List[dict] = Field(default_factory=list)
    maps: List[dict] = Field(default_factory=list)


# ============================================================================
# Helpers
# ============================================================================
def _is_maestro(user: dict) -> bool:
    return user.get("role") == "maestro"


async def _generate_unique_code(db) -> str:
    """Generate an 8-char campaign code that doesn't yet exist in DB."""
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        existing = await db.campaign_runs.find_one({"campaign_code": code})
        if not existing:
            return code
    # Should never happen with 32^8 ≈ 1.1×10^12 keyspace
    raise HTTPException(status_code=500, detail="No se pudo generar un código único")


async def _ensure_indexes(db):
    """Idempotent — call once at startup or first endpoint hit."""
    try:
        await db.campaign_runs.create_index("campaign_code", unique=True)
        await db.campaign_runs.create_index("dm_id")
        await db.campaign_runs.create_index("adventure_id")
    except Exception as e:
        logger.warning("campaign_runs indexes: %s", e)


def _serialize(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def _can_view_run(run: dict, user: dict) -> bool:
    if _is_maestro(user):
        return True
    return run.get("dm_id") == user.get("id")


def _can_edit_run(run: dict, user: dict) -> bool:
    return _can_view_run(run, user)


async def _clone_adventure_into_run(db, adventure: dict, run_id: str) -> None:
    """Copy environments/intrigues/npcs/maps from the adventure into per-run
    collections, generating fresh ids and tagging campaign_run_id."""
    now = datetime.now(timezone.utc).isoformat()

    targets = [
        ("environments", "campaign_environments"),
        ("intrigues", "campaign_intrigues"),
        ("npcs", "campaign_npcs"),
        ("maps", "campaign_maps"),
        ("travel_events", "campaign_travel_events"),
        ("travel_route", "campaign_travel_route"),
    ]
    for src_key, coll_name in targets:
        items = adventure.get(src_key) or []
        if not items:
            continue
        docs = []
        for item in items:
            d = {k: v for k, v in item.items() if k != "_id"}
            d["id"] = str(uuid.uuid4())
            d["campaign_run_id"] = run_id
            d["created_at"] = now
            # For environments, regenerate ids of nested images too
            if src_key == "environments" and isinstance(d.get("images"), list):
                d["images"] = [
                    {**img, "id": str(uuid.uuid4())} for img in d["images"]
                ]
            docs.append(d)
        if docs:
            await db[coll_name].insert_many(docs)


# ============================================================================
# Endpoints
# ============================================================================
@router.post("/from-adventure/{adventure_id}", response_model=CampaignRunOut, status_code=201)
async def generate_run_from_adventure(
    adventure_id: str, user: dict = Depends(get_current_user)
):
    """Clone an adventure into a new live `campaign_run`. The caller becomes
    the DM. The run starts in `draft` so the DJ can review the cloned content
    before activating it (and exposing the code)."""
    if user.get("role") not in ("maestro", "director_de_juego"):
        raise HTTPException(status_code=403, detail="Sólo Maestro o DJ pueden generar campañas")
    from server import db
    await _ensure_indexes(db)

    adv = await db.adventures.find_one({"id": adventure_id})
    if not adv:
        raise HTTPException(status_code=404, detail="Aventura no encontrada")
    # Read permission: maestro / owner / public
    if not (_is_maestro(user) or adv.get("creator_dm_id") == user.get("id") or adv.get("is_public")):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta aventura")

    code = await _generate_unique_code(db)
    now = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid.uuid4())

    run_doc = {
        "id": run_id,
        "adventure_id": adventure_id,
        "adventure_name": adv.get("name"),
        "dm_id": user.get("id"),
        "dm_name": user.get("nombre") or user.get("email"),
        "campaign_code": code,
        "status": "draft",
        "created_at": now,
        "activated_at": None,
        "finished_at": None,
        # Snapshot from adventure for fast hub render
        "description": adv.get("description"),
        "motivation_text": adv.get("motivation_text"),
        "image_file_id": adv.get("image_file_id"),
        "year": adv.get("year"),
        "season": adv.get("season"),
        "location_name": adv.get("location_name"),
        "region": adv.get("region"),
        "max_players": adv.get("max_players", 4),
        "allow_multi_characters": adv.get("allow_multi_characters", False),
        "max_characters_per_player": adv.get("max_characters_per_player"),
        "recommended_level_min": adv.get("recommended_level_min"),
        "recommended_level_max": adv.get("recommended_level_max"),
        # Patron snapshot — used at player accept to wire NPC↔character relationship
        "patron_id": adv.get("patron_id"),
        "patron_name": adv.get("patron_name"),
    }
    await db.campaign_runs.insert_one(run_doc)
    await _clone_adventure_into_run(db, adv, run_id)

    # Initial log entry
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": run_id,
        "event_type": "run_created",
        "description": f"Campaña creada desde la aventura «{adv.get('name')}»",
        "created_at": now,
    })

    return _serialize(run_doc)


@router.get("", response_model=List[CampaignRunOut])
async def list_runs(
    scope: Literal["mine", "all"] = "mine",
    status: Optional[Literal["draft", "active", "paused", "finished"]] = None,
    user: dict = Depends(get_current_user),
):
    """List campaign runs. Defaults to scope=mine (the DM's own runs).
    Maestro can pass scope=all to see absolutely everything."""
    from server import db

    query: dict = {}
    if scope == "all" and _is_maestro(user):
        pass  # no filter
    else:
        query["dm_id"] = user.get("id")
    if status:
        query["status"] = status

    cursor = db.campaign_runs.find(query).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]


@router.get("/{run_id}", response_model=CampaignRunOut)
async def get_run(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_view_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    return _serialize(run)


@router.get("/{run_id}/content", response_model=CampaignContentOut)
async def get_run_content(run_id: str, user: dict = Depends(get_current_user)):
    """Return all cloned content (npcs, environments, intrigues, maps) +
    log entries for the hub view."""
    from server import db
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_view_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    out = {}
    for key, coll in (
        ("environments", "campaign_environments"),
        ("intrigues", "campaign_intrigues"),
        ("npcs", "campaign_npcs"),
        ("maps", "campaign_maps"),
    ):
        cursor = db[coll].find({"campaign_run_id": run_id})
        out[key] = [_serialize(d) async for d in cursor]
    return out


@router.get("/{run_id}/log")
async def get_run_log(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_view_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    cursor = db.campaign_log.find({"campaign_run_id": run_id}).sort("created_at", 1)
    return [_serialize(d) async for d in cursor]


# ----- Status transitions -----
async def _transition(db, run_id: str, user: dict, new_status: str, *, allowed_from):
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_edit_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    cur = run.get("status")
    if cur not in allowed_from:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede pasar de '{cur}' a '{new_status}'",
        )

    now = datetime.now(timezone.utc).isoformat()
    update = {"status": new_status}
    if new_status == "active" and not run.get("activated_at"):
        update["activated_at"] = now
    if new_status == "finished":
        update["finished_at"] = now

    await db.campaign_runs.update_one({"id": run_id}, {"$set": update})
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": run_id,
        "event_type": f"status_{new_status}",
        "description": f"Campaña → {new_status}",
        "created_at": now,
    })

    # On finish: release locked characters + consolidate pending XP +
    # record history entries. The returned consolidation list is exposed
    # via the response so the frontend can play the "scroll reveal"
    # animation per character.
    consolidation = []
    if new_status == "finished":
        from routes.campaign_experience_routes import consolidate_xp_on_finish
        # Need the latest run document for adventure_id/name
        new_doc_for_finish = await db.campaign_runs.find_one({"id": run_id})
        consolidation = await consolidate_xp_on_finish(db, new_doc_for_finish)

    new_doc = await db.campaign_runs.find_one({"id": run_id})
    out = _serialize(new_doc)
    if consolidation:
        out["xp_consolidation"] = consolidation
    return out


@router.post("/{run_id}/activate", response_model=CampaignRunOut)
async def activate_run(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    return await _transition(db, run_id, user, "active", allowed_from={"draft", "paused"})


@router.post("/{run_id}/pause", response_model=CampaignRunOut)
async def pause_run(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    return await _transition(db, run_id, user, "paused", allowed_from={"active"})


@router.post("/{run_id}/finish")
async def finish_run(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    # Returns a dict that may include `xp_consolidation` (list of
    # {character_id, character_name, xp_earned}) for the UI animation.
    return await _transition(db, run_id, user, "finished", allowed_from={"active", "paused", "draft"})


@router.delete("/{run_id}")
async def delete_run(run_id: str, user: dict = Depends(get_current_user)):
    """Hard-delete a run + all its cloned content + log. Allowed only for the
    DM owner or Maestro. Use sparingly; prefer `finish`."""
    from server import db
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_edit_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    for coll in (
        "campaign_environments",
        "campaign_intrigues",
        "campaign_npcs",
        "campaign_maps",
        "campaign_log",
        "campaign_players",
    ):
        await db[coll].delete_many({"campaign_run_id": run_id})
    # Release any character still locked to this run
    await db.characters.update_many(
        {"active_campaign_run_id": run_id},
        {"$set": {"active_campaign_run_id": None}},
    )
    await db.campaign_runs.delete_one({"id": run_id})
    return {"deleted": True, "id": run_id}
