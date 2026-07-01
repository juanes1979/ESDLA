"""
Campaign Players routes — Fase 3 del Sistema Aventuras & Campañas.

Maneja la unión de personajes a una `campaign_run`:
  - POST /api/campaign-runs/join-by-code      (jugador introduce código)
  - GET  /api/campaign-runs/{id}/players       (DJ ve solicitudes)
  - PATCH /api/campaign-players/{id}           (DJ accept/reject/expel)
  - GET  /api/my/campaigns                     (jugador ve sus campañas)

Reglas críticas:
  - 1 personaje sólo puede estar ACEPTADO en 1 run a la vez
    (`character.active_campaign_run_id`).
  - Un personaje "abandonado/expulsado/rechazado" pierde su PX pendiente
    en esa run (Fase 4 lo aplicará; aquí ya marcamos el estado).
  - El run debe estar `active` para aceptar nuevas solicitudes.
  - Si `allow_multi_characters=False`, un mismo user solo puede tener 1
    personaje accepted en la run. Si True, hasta `max_characters_per_player`.
  - El total de accepted nunca puede superar `max_players`.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["campaign-players"])

JoinOrigin = Literal["code", "listing", "invitation"]
PlayerStatus = Literal["pending", "accepted", "rejected", "expelled", "abandon", "finished"]


# ============================================================================
# Models
# ============================================================================
class JoinByCodeBody(BaseModel):
    code: str = Field(..., min_length=4, max_length=16)
    character_id: str


class PatchPlayerBody(BaseModel):
    status: Literal["accepted", "rejected", "expelled"]
    note: Optional[str] = None


class CampaignPlayerOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    campaign_run_id: str
    user_id: str
    user_name: Optional[str] = None
    character_id: str
    character_name: Optional[str] = None
    character_level: Optional[int] = None
    character_culture: Optional[str] = None
    status: PlayerStatus
    join_origin: JoinOrigin
    xp_pending_total: int = 0
    joined_at: str
    accepted_at: Optional[str] = None
    closed_at: Optional[str] = None


# ============================================================================
# Helpers
# ============================================================================
def _is_maestro(user: dict) -> bool:
    return user.get("role") == "maestro"


def _serialize(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


async def _ensure_indexes(db):
    try:
        await db.campaign_players.create_index("campaign_run_id")
        await db.campaign_players.create_index("user_id")
        await db.campaign_players.create_index("character_id")
        await db.campaign_players.create_index([("campaign_run_id", 1), ("character_id", 1)])
    except Exception as e:
        logger.warning("campaign_players indexes: %s", e)


async def _get_character_or_403(db, character_id: str, user: dict):
    """Fetch character ensuring the current user owns it (or maestro)."""
    char = await db.characters.find_one({"_id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    if not _is_maestro(user) and char.get("owner_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="No es tu personaje")
    return char


async def _enrich_player(db, player: dict) -> dict:
    """Attach derived fields (character name/level/culture, user_name)."""
    out = _serialize(player)
    char = await db.characters.find_one({"_id": player.get("character_id")})
    if char:
        out["character_name"] = char.get("nombre")
        out["character_level"] = char.get("nivel")
        out["character_culture"] = char.get("cultura") or char.get("raza")
    user = await db.users.find_one({"id": player.get("user_id")})
    if user:
        out["user_name"] = user.get("nombre") or user.get("name") or user.get("email")
    return out


def _can_view_run(run: dict, user: dict) -> bool:
    if _is_maestro(user):
        return True
    return run.get("dm_id") == user.get("id")


# ============================================================================
# JOIN BY CODE — discreet entry point used by players
# ============================================================================
@router.post("/campaign-runs/join-by-code", response_model=CampaignPlayerOut, status_code=201)
async def join_by_code(payload: JoinByCodeBody, user: dict = Depends(get_current_user)):
    """A player submits a campaign code + character_id. Creates a request
    with status='pending'. The DJ then accepts/rejects from the hub."""
    from server import db
    await _ensure_indexes(db)

    code = payload.code.strip().upper().replace(" ", "")
    run = await db.campaign_runs.find_one({"campaign_code": code})
    if not run:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    if run.get("status") != "active":
        raise HTTPException(
            status_code=400,
            detail=f"La campaña no está activa (estado: {run.get('status')})",
        )

    char = await _get_character_or_403(db, payload.character_id, user)

    # Character cannot be already locked in another run
    if char.get("active_campaign_run_id") and char["active_campaign_run_id"] != run["id"]:
        raise HTTPException(
            status_code=400,
            detail="Este personaje ya está en otra campaña activa",
        )

    # Cultural restrictions — if the campaign limits cultures or subcultures,
    # reject characters that don't fit. Empty lists = no restriction.
    allowed_cul = run.get("allowed_culture_ids") or []
    allowed_sub = run.get("allowed_subcultures") or []
    if allowed_cul or allowed_sub:
        char_cul = char.get("cultura") or char.get("culture_id") or ""
        char_sub = char.get("subcultura") or char.get("subculture") or ""
        # Subcultures use the format `cultureId::subname` — match either by
        # culture id alone or by the composed key.
        sub_key = f"{char_cul}::{char_sub}" if char_cul and char_sub else None
        cul_ok = (not allowed_cul) or (char_cul in allowed_cul)
        sub_ok = (not allowed_sub) or (sub_key and sub_key in allowed_sub)
        # If both restrictions exist, character must satisfy BOTH:
        #   - belongs to an allowed culture (if list set)
        #   - and belongs to an allowed subculture (if list set)
        if not cul_ok or not sub_ok:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Tu personaje no cumple con las restricciones de raza/cultura "
                    "de esta campaña."
                ),
            )

    # Disallow duplicate request for same (run, character)
    existing = await db.campaign_players.find_one({
        "campaign_run_id": run["id"],
        "character_id": payload.character_id,
        "status": {"$in": ["pending", "accepted"]},
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya has enviado una solicitud con este personaje",
        )

    # Multi-character cap (only counts pending+accepted by same user)
    same_user_active = await db.campaign_players.count_documents({
        "campaign_run_id": run["id"],
        "user_id": user.get("id"),
        "status": {"$in": ["pending", "accepted"]},
    })
    if not run.get("allow_multi_characters") and same_user_active >= 1:
        raise HTTPException(
            status_code=400,
            detail="Esta campaña no permite múltiples personajes por jugador",
        )
    if run.get("allow_multi_characters"):
        cap = run.get("max_characters_per_player") or 1
        if same_user_active >= cap:
            raise HTTPException(
                status_code=400,
                detail=f"Has alcanzado el máximo de {cap} personajes en esta campaña",
            )

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": run["id"],
        "user_id": user.get("id"),
        "character_id": payload.character_id,
        "status": "pending",
        "join_origin": "code",
        "xp_pending_total": 0,
        "joined_at": now,
        "accepted_at": None,
        "closed_at": None,
    }
    await db.campaign_players.insert_one(doc)

    # Log entry visible to the DJ
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": run["id"],
        "event_type": "player_request",
        "description": f"Solicitud de unión: {char.get('nombre')} (jugador {user.get('email')})",
        "created_at": now,
    })

    return await _enrich_player(db, doc)


# ============================================================================
# DJ — list + transition player requests
# ============================================================================
@router.get("/campaign-runs/{run_id}/players", response_model=List[CampaignPlayerOut])
async def list_players(run_id: str, user: dict = Depends(get_current_user)):
    from server import db
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_view_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    cursor = db.campaign_players.find({"campaign_run_id": run_id}).sort("joined_at", -1)
    out = []
    async for p in cursor:
        out.append(await _enrich_player(db, p))
    return out


@router.patch("/campaign-players/{player_id}", response_model=CampaignPlayerOut)
async def update_player_status(
    player_id: str, payload: PatchPlayerBody, user: dict = Depends(get_current_user)
):
    """DJ (or Maestro) accepts/rejects/expels a player request."""
    from server import db
    p = await db.campaign_players.find_one({"id": player_id})
    if not p:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    run = await db.campaign_runs.find_one({"id": p["campaign_run_id"]})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_view_run(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    target = payload.status
    cur = p["status"]

    # Validate transition
    allowed = {
        "pending": {"accepted", "rejected"},
        "accepted": {"expelled"},
    }
    if target not in allowed.get(cur, set()):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede pasar de '{cur}' a '{target}'",
        )

    # On accept: enforce capacity & lock the character
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"status": target}
    if target == "accepted":
        accepted_count = await db.campaign_players.count_documents({
            "campaign_run_id": run["id"],
            "status": "accepted",
        })
        if accepted_count >= run.get("max_players", 1):
            raise HTTPException(
                status_code=400,
                detail="La campaña ya está llena",
            )

        # Re-check character is still free (someone else may have accepted them)
        char = await db.characters.find_one({"_id": p["character_id"]})
        if not char:
            raise HTTPException(status_code=404, detail="El personaje ya no existe")
        if char.get("active_campaign_run_id") and char["active_campaign_run_id"] != run["id"]:
            raise HTTPException(
                status_code=400,
                detail="Ese personaje ya entró en otra campaña activa",
            )

        await db.characters.update_one(
            {"_id": p["character_id"]},
            {"$set": {"active_campaign_run_id": run["id"], "updated_at": now}},
        )
        update["accepted_at"] = now
        log_event = "player_accepted"
        log_desc = f"{char.get('nombre')} aceptado en la campaña"

        # If the campaign has a patron NPC, auto-create a neutral relationship
        # between this character and the patron NPC. This makes the patron
        # show up in the character's "relations" panel from minute one.
        patron_id = run.get("patron_id")
        if patron_id:
            existing_rel = await db.npc_relationships.find_one({
                "character_id": p["character_id"],
                "npc_id": patron_id,
            })
            if not existing_rel:
                await db.npc_relationships.insert_one({
                    "_id": str(uuid.uuid4()),
                    "character_id": p["character_id"],
                    "npc_id": patron_id,
                    "nivel": "neutral",
                    "penalizacion_precio": 0,
                    "dias_sin_comercio": 0,
                    "historial": [{
                        "tipo": "mecenas",
                        "descripcion": f"Mecenas de la campaña «{run.get('adventure_name', '')}»",
                        "fecha": now,
                    }],
                    "is_patron": True,
                    "campaign_run_id": run["id"],
                    "created_at": now,
                    "updated_at": now,
                })

    elif target in ("rejected", "expelled"):
        # If the character was locked by THIS run, release it
        char = await db.characters.find_one({"_id": p["character_id"]})
        if char and char.get("active_campaign_run_id") == run["id"]:
            await db.characters.update_one(
                {"_id": p["character_id"]},
                {"$set": {"active_campaign_run_id": None, "updated_at": now}},
            )
        update["closed_at"] = now
        log_event = "player_rejected" if target == "rejected" else "player_expelled"
        log_desc = (
            f"Solicitud de {char.get('nombre') if char else 'personaje'} rechazada"
            if target == "rejected"
            else f"{char.get('nombre') if char else 'Personaje'} expulsado de la campaña"
        )
        # Fase 4: history entry + reset pending XP (only meaningful for previously accepted)
        if target == "expelled" or cur == "accepted":
            from routes.campaign_experience_routes import record_history_on_close
            await record_history_on_close(db, p, run, target)

    await db.campaign_players.update_one({"id": player_id}, {"$set": update})
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": run["id"],
        "event_type": log_event,
        "description": log_desc,
        "created_at": now,
    })

    new_doc = await db.campaign_players.find_one({"id": player_id})
    return await _enrich_player(db, new_doc)


# ============================================================================
# Player — list my campaigns
# ============================================================================
@router.get("/my/campaigns", response_model=List[dict])
async def my_campaigns(
    status: Optional[PlayerStatus] = None,
    user: dict = Depends(get_current_user),
):
    """Return campaigns the current user is a player in (any status)."""
    from server import db
    query = {"user_id": user.get("id")}
    if status:
        query["status"] = status

    out = []
    cursor = db.campaign_players.find(query).sort("joined_at", -1)
    async for p in cursor:
        run = await db.campaign_runs.find_one({"id": p["campaign_run_id"]})
        if not run:
            continue
        item = await _enrich_player(db, p)
        item["run"] = {
            "id": run["id"],
            "adventure_name": run.get("adventure_name"),
            "campaign_code": run.get("campaign_code") if run.get("dm_id") == user.get("id") else None,
            "status": run.get("status"),
            "dm_name": run.get("dm_name"),
            "year": run.get("year"),
            "season": run.get("season"),
            "location_name": run.get("location_name"),
            "shared_journal": run.get("shared_journal"),
        }
        out.append(item)
    return out


@router.post("/campaign-players/{player_id}/leave", response_model=CampaignPlayerOut)
async def leave_campaign(player_id: str, user: dict = Depends(get_current_user)):
    """A player voluntarily abandons a campaign with their character."""
    from server import db
    p = await db.campaign_players.find_one({"id": player_id})
    if not p:
        raise HTTPException(status_code=404, detail="No encontrado")
    if not _is_maestro(user) and p.get("user_id") != user.get("id"):
        raise HTTPException(status_code=403, detail="Sin permiso")
    if p["status"] not in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail=f"Ya cerrado: {p['status']}")

    now = datetime.now(timezone.utc).isoformat()
    # Release the character if locked
    char = await db.characters.find_one({"_id": p["character_id"]})
    if char and char.get("active_campaign_run_id") == p["campaign_run_id"]:
        await db.characters.update_one(
            {"_id": p["character_id"]},
            {"$set": {"active_campaign_run_id": None, "updated_at": now}},
        )

    # Fase 4: history entry (loses pending XP) only if was accepted
    run = await db.campaign_runs.find_one({"id": p["campaign_run_id"]})
    if run and p["status"] == "accepted":
        from routes.campaign_experience_routes import record_history_on_close
        await record_history_on_close(db, p, run, "abandon")

    await db.campaign_players.update_one(
        {"id": player_id},
        {"$set": {"status": "abandon", "closed_at": now}},
    )
    await db.campaign_log.insert_one({
        "id": str(uuid.uuid4()),
        "campaign_run_id": p["campaign_run_id"],
        "event_type": "player_abandoned",
        "description": f"{(char or {}).get('nombre', 'Personaje')} abandonó la campaña",
        "created_at": now,
    })
    new_doc = await db.campaign_players.find_one({"id": player_id})
    return await _enrich_player(db, new_doc)
