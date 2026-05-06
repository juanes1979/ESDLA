"""
Campaign Experience routes — Fase 4 del Sistema Aventuras & Campañas.

Sistema de PX pendientes:
  - Durante la campaña, el DJ otorga PX que se acumulan en
    `campaign_players.xp_pending_total` y se persisten como entradas en
    `campaign_experience` (auditable).
  - Al "Finalizar campaña", los PX pendientes de cada personaje aceptado se
    consolidan en `characters.experiencia` y se crea una entrada en
    `character_campaign_history` con result='success'.
  - Si un personaje se desvincula antes (reject/expel/abandon), pierde sus
    PX pendientes y queda en el histórico con result correspondiente.

Endpoints:
  - POST   /api/campaign-runs/{run_id}/award-xp     (DJ)
  - GET    /api/campaign-runs/{run_id}/experience   (DJ — auditoría)
  - GET    /api/characters/{char_id}/campaign-history (owner / Maestro)

Nota: este módulo no maneja `finish` directamente — esa transición vive en
`campaign_routes.finish_run` y llama a `consolidate_xp_on_finish` desde aquí.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campaign-experience"])


# ============================================================================
# Models
# ============================================================================
class AwardXPBody(BaseModel):
    character_id: str
    xp_amount: int = Field(..., ge=1, le=10000)
    reason: Optional[str] = None
    session_number: Optional[int] = Field(default=None, ge=1)


class ExperienceEntryOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    campaign_run_id: str
    character_id: str
    character_name: Optional[str] = None
    xp_amount: int
    reason: Optional[str] = None
    session_number: Optional[int] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_at: str


class HistoryEntryOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    character_id: str
    campaign_run_id: str
    adventure_id: Optional[str] = None
    adventure_name: Optional[str] = None
    xp_earned: int
    result: str  # success / death / abandon / expelled / rejected
    history_log: Optional[str] = None
    created_at: str


# ============================================================================
# Helpers
# ============================================================================
def _is_maestro(user: dict) -> bool:
    return user.get("role") == "maestro"


def _serialize(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


async def _ensure_indexes(db):
    try:
        await db.campaign_experience.create_index("campaign_run_id")
        await db.campaign_experience.create_index("character_id")
        await db.character_campaign_history.create_index("character_id")
        await db.character_campaign_history.create_index("campaign_run_id")
    except Exception as e:
        logger.warning("xp/history indexes: %s", e)


# ============================================================================
# Award XP — DJ otorga PX a un personaje aceptado
# ============================================================================
@router.post("/campaign-runs/{run_id}/award-xp", response_model=ExperienceEntryOut, status_code=201)
async def award_xp(
    run_id: str, payload: AwardXPBody, user: dict = Depends(get_current_user)
):
    from server import db
    await _ensure_indexes(db)

    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not (_is_maestro(user) or run.get("dm_id") == user.get("id")):
        raise HTTPException(status_code=403, detail="Sólo el DJ o Maestro pueden otorgar PX")
    if run.get("status") not in ("active", "paused"):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede otorgar PX en estado '{run.get('status')}'",
        )

    # Find the player entry (must be accepted)
    player = await db.campaign_players.find_one({
        "campaign_run_id": run_id,
        "character_id": payload.character_id,
        "status": "accepted",
    })
    if not player:
        raise HTTPException(
            status_code=404,
            detail="Ese personaje no está aceptado en la campaña",
        )

    char = await db.characters.find_one({"_id": payload.character_id})
    char_name = char.get("nombre") if char else None
    now = datetime.now(timezone.utc).isoformat()

    entry = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": run_id,
        "character_id": payload.character_id,
        "character_name": char_name,
        "xp_amount": payload.xp_amount,
        "reason": payload.reason,
        "session_number": payload.session_number,
        "created_by": user.get("id"),
        "created_by_name": user.get("nombre") or user.get("email"),
        "created_at": now,
    }
    await db.campaign_experience.insert_one(entry)

    # Update aggregated total on the player row (fast lookup for hub)
    await db.campaign_players.update_one(
        {"id": player["id"]},
        {"$inc": {"xp_pending_total": payload.xp_amount}},
    )

    # Visible log for the DJ
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": run_id,
        "event_type": "xp_awarded",
        "description": f"+{payload.xp_amount} PX → {char_name}{f' ({payload.reason})' if payload.reason else ''}",
        "created_at": now,
    })

    return entry


@router.get("/campaign-runs/{run_id}/experience", response_model=List[ExperienceEntryOut])
async def list_experience(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not (_is_maestro(user) or run.get("dm_id") == user.get("id")):
        raise HTTPException(status_code=403, detail="Sin permiso")

    cursor = db.campaign_experience.find({"campaign_run_id": run_id}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]


# ============================================================================
# Character history — visible para owner / Maestro
# ============================================================================
@router.get("/characters/{char_id}/campaign-history", response_model=List[HistoryEntryOut])
async def character_campaign_history(char_id: str, user: dict = Depends(get_current_user)):
    from server import db
    char = await db.characters.find_one({"_id": char_id})
    if not char:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    if not _is_maestro(user) and char.get("owner_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Sin permiso")

    cursor = db.character_campaign_history.find({"character_id": char_id}).sort("created_at", -1)
    return [_serialize(d) async for d in cursor]


# ============================================================================
# Helpers used externally by campaign_routes / campaign_players_routes
# ============================================================================
async def consolidate_xp_on_finish(db, run: dict) -> List[dict]:
    """Called from finish_run. For each ACCEPTED player:
      - sum their xp_pending_total to character.experiencia (and .xp legacy);
      - mark player status='finished';
      - create character_campaign_history entry with result='success'.

    Returns list of dicts {character_id, character_name, xp_earned} for the
    UI animation.
    """
    now = datetime.now(timezone.utc).isoformat()
    results = []
    accepted_cursor = db.campaign_players.find({
        "campaign_run_id": run["id"],
        "status": "accepted",
    })
    async for p in accepted_cursor:
        xp = int(p.get("xp_pending_total") or 0)
        char = await db.characters.find_one({"_id": p["character_id"]})
        char_name = char.get("nombre") if char else None

        if char and xp > 0:
            await db.characters.update_one(
                {"_id": p["character_id"]},
                {
                    "$inc": {"experiencia": xp, "xp": xp},
                    "$set": {"updated_at": now, "active_campaign_run_id": None},
                },
            )
        elif char:
            await db.characters.update_one(
                {"_id": p["character_id"]},
                {"$set": {"updated_at": now, "active_campaign_run_id": None}},
            )

        await db.campaign_players.update_one(
            {"id": p["id"]},
            {"$set": {"status": "finished", "closed_at": now}},
        )

        await db.character_campaign_history.insert_one({
            "id": str(uuid.uuid4()),
            "character_id": p["character_id"],
            "campaign_run_id": run["id"],
            "adventure_id": run.get("adventure_id"),
            "adventure_name": run.get("adventure_name"),
            "xp_earned": xp,
            "result": "success",
            "history_log": f"Campaña finalizada — {xp} PX consolidados",
            "created_at": now,
        })
        results.append({
            "character_id": p["character_id"],
            "character_name": char_name,
            "xp_earned": xp,
        })

    return results


async def record_history_on_close(db, player: dict, run: dict, result: str):
    """Called when a player is rejected/expelled/abandons. xp_earned=0
    (loses pending XP). Don't touch the character's experiencia."""
    now = datetime.now(timezone.utc).isoformat()
    await db.character_campaign_history.insert_one({
        "id": str(uuid.uuid4()),
        "character_id": player["character_id"],
        "campaign_run_id": run["id"],
        "adventure_id": run.get("adventure_id"),
        "adventure_name": run.get("adventure_name"),
        "xp_earned": 0,
        "result": result,
        "history_log": f"Vínculo cerrado — PX pendientes perdidos: {player.get('xp_pending_total', 0)}",
        "created_at": now,
    })
    # Reset pending so it doesn't re-consolidate by mistake
    await db.campaign_players.update_one(
        {"id": player["id"]},
        {"$set": {"xp_pending_total": 0}},
    )
