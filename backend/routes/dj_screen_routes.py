"""
Pantalla del DJ — Dashboard en vivo de una `campaign_run`.

Zonas:
  - Lienzo central (imagen de escena, file_id en GridFS).
  - Rastreador de iniciativa (combatientes: jugadores + PNJs/enemigos manuales).
  - Cartas de héroes (derivadas de los personajes aceptados).
  - Notas privadas del DJ.
  - Chat de grupo + chats privados DJ↔jugador.

Persistencia:
  - `dj_screens`        (1 doc por campaign_run_id).
  - `dj_chat_messages`  (mensajes por canal).

Acceso:
  - DJ (dueño del run) y Maestro: vista completa + edición.
  - Jugador ACEPTADO: vista de jugador (sin datos privados: notas del DJ,
    PG/CA exactos de enemigos, notas de combatiente). Solo lectura.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dj-screen"])


# ============================================================================
# Models
# ============================================================================
class Combatant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: Literal["player", "enemy"] = "enemy"
    character_id: Optional[str] = None
    initiative: int = 0
    hp_current: int = 0
    hp_max: int = 0
    ac: int = 10
    conditions: List[str] = Field(default_factory=list)
    notes: Optional[str] = None  # private (DJ only)
    has_portrait: bool = False


class DjScreenState(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scene_image_file_id: Optional[str] = None
    notes_private: str = ""
    combatants: List[Combatant] = Field(default_factory=list)
    current_turn_index: int = 0
    round_number: int = 1


class ChatPostBody(BaseModel):
    channel: str = Field(..., min_length=1, max_length=80)
    text: str = Field(..., min_length=1, max_length=2000)


# ============================================================================
# Helpers
# ============================================================================
def _is_maestro(user: dict) -> bool:
    return user.get("role") == "maestro"


def _serialize(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


async def _get_run_or_404(db, run_id: str) -> dict:
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return run


def _is_dm(run: dict, user: dict) -> bool:
    return _is_maestro(user) or run.get("dm_id") == user.get("id")


async def _is_accepted_player(db, run_id: str, user: dict) -> bool:
    p = await db.campaign_players.find_one({
        "campaign_run_id": run_id,
        "user_id": user.get("id"),
        "status": "accepted",
    })
    return bool(p)


async def _ensure_screen(db, run: dict) -> dict:
    """Fetch (or lazily create) the dj_screen doc for a run."""
    screen = await db.dj_screens.find_one({"campaign_run_id": run["id"]})
    if screen:
        return screen
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": run["id"],
        "dm_id": run.get("dm_id"),
        "scene_image_file_id": None,
        "notes_private": "",
        "combatants": [],
        "current_turn_index": 0,
        "round_number": 1,
        "created_at": now,
        "updated_at": now,
    }
    await db.dj_screens.insert_one(doc)
    return doc


def _hp_band(cur: int, mx: int) -> str:
    if mx <= 0:
        return "desconocido"
    pct = cur / mx
    if cur <= 0:
        return "caído"
    if pct > 0.75:
        return "ileso"
    if pct > 0.5:
        return "herido leve"
    if pct > 0.25:
        return "herido"
    return "malherido"


def _sanitize_for_player(screen: dict) -> dict:
    """Strip DJ-private data: notes, enemy exact HP/AC, combatant notes."""
    out = {
        "scene_image_file_id": screen.get("scene_image_file_id"),
        "current_turn_index": screen.get("current_turn_index", 0),
        "round_number": screen.get("round_number", 1),
        "combatants": [],
    }
    for c in screen.get("combatants", []):
        c = dict(c)
        base = {
            "id": c.get("id"),
            "name": c.get("name"),
            "type": c.get("type", "enemy"),
            "character_id": c.get("character_id"),
            "initiative": c.get("initiative", 0),
            "conditions": c.get("conditions", []),
            "has_portrait": c.get("has_portrait", False),
        }
        if c.get("type") == "player":
            # Party data is shared at the table.
            base.update({
                "hp_current": c.get("hp_current", 0),
                "hp_max": c.get("hp_max", 0),
                "ac": c.get("ac", 10),
            })
        else:
            # Enemy: hide exact numbers, show qualitative band only.
            base["hp_band"] = _hp_band(c.get("hp_current", 0), c.get("hp_max", 0))
        out["combatants"].append(base)
    return out


# ============================================================================
# DJ Screen state
# ============================================================================
@router.get("/campaign-runs/{run_id}/dj-screen")
async def get_dj_screen(run_id: str, user: dict = Depends(get_current_user)):
    """Return the screen state with role-aware visibility.

    DM/Maestro → full state + can_edit. Accepted player → sanitized + read-only."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    screen = await _ensure_screen(db, run)

    if _is_dm(run, user):
        return {
            "can_edit": True,
            "is_player": False,
            "run": {
                "id": run["id"],
                "adventure_name": run.get("adventure_name"),
                "status": run.get("status"),
                "campaign_code": run.get("campaign_code"),
            },
            "state": _serialize(screen),
        }

    if await _is_accepted_player(db, run_id, user):
        return {
            "can_edit": False,
            "is_player": True,
            "run": {
                "id": run["id"],
                "adventure_name": run.get("adventure_name"),
                "status": run.get("status"),
            },
            "state": _sanitize_for_player(screen),
        }

    raise HTTPException(status_code=403, detail="Sin permiso")


@router.put("/campaign-runs/{run_id}/dj-screen")
async def update_dj_screen(
    run_id: str, payload: DjScreenState, user: dict = Depends(get_current_user)
):
    """Save the full screen state. DM/Maestro only."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    await _ensure_screen(db, run)

    now = datetime.now(timezone.utc).isoformat()
    update = payload.model_dump()
    update["updated_at"] = now
    await db.dj_screens.update_one(
        {"campaign_run_id": run_id}, {"$set": update}
    )
    screen = await db.dj_screens.find_one({"campaign_run_id": run_id})
    return _serialize(screen)


@router.post("/campaign-runs/{run_id}/dj-screen/sync-players")
async def sync_players(run_id: str, user: dict = Depends(get_current_user)):
    """Add accepted players' characters to the initiative tracker (idempotent:
    only adds those not already present by character_id)."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    screen = await _ensure_screen(db, run)

    combatants = list(screen.get("combatants", []))
    existing_char_ids = {c.get("character_id") for c in combatants if c.get("character_id")}

    accepted = db.campaign_players.find({
        "campaign_run_id": run_id, "status": "accepted",
    })
    added = 0
    async for p in accepted:
        char = await db.characters.find_one({"_id": p.get("character_id")})
        if not char or char.get("_id") in existing_char_ids:
            continue
        pg_max = int(char.get("puntos_golpe_max") or 0)
        pg_cur = char.get("puntos_golpe_actual")
        pg_cur = int(pg_cur) if pg_cur is not None else pg_max
        combatants.append({
            "id": str(uuid.uuid4()),
            "name": char.get("nombre") or "Personaje",
            "type": "player",
            "character_id": char.get("_id"),
            "initiative": int(char.get("iniciativa_bonus") or 0),
            "hp_current": pg_cur,
            "hp_max": pg_max,
            "ac": int(char.get("clase_armadura") or 10),
            "conditions": [],
            "notes": None,
            "has_portrait": bool(char.get("portrait_image")),
        })
        existing_char_ids.add(char.get("_id"))
        added += 1

    now = datetime.now(timezone.utc).isoformat()
    await db.dj_screens.update_one(
        {"campaign_run_id": run_id},
        {"$set": {"combatants": combatants, "updated_at": now}},
    )
    screen = await db.dj_screens.find_one({"campaign_run_id": run_id})
    return {"added": added, "state": _serialize(screen)}


@router.get("/campaign-runs/{run_id}/dj-screen/portrait/{character_id}")
async def get_combatant_portrait(
    run_id: str, character_id: str, user: dict = Depends(get_current_user)
):
    """Serve a player-character portrait (base64 PNG) for the tracker cards."""
    from server import db
    from fastapi.responses import Response
    import base64

    run = await _get_run_or_404(db, run_id)
    if not (_is_dm(run, user) or await _is_accepted_player(db, run_id, user)):
        raise HTTPException(status_code=403, detail="Sin permiso")
    char = await db.characters.find_one({"_id": character_id})
    img = char.get("portrait_image") if char else None
    if not img:
        raise HTTPException(status_code=404, detail="Sin retrato")
    try:
        raw = base64.b64decode(img)
    except Exception:
        raise HTTPException(status_code=404, detail="Retrato inválido")
    return Response(content=raw, media_type="image/png")


# ============================================================================
# Chat — group + DJ↔player private channels
# ============================================================================
def _can_access_channel(run: dict, user: dict, channel: str, is_player: bool) -> bool:
    """group: any member. private:<uid>: DM/Maestro OR that player."""
    if channel == "group":
        return _is_dm(run, user) or is_player
    if channel.startswith("private:"):
        target_uid = channel.split(":", 1)[1]
        if _is_dm(run, user):
            return True
        return is_player and target_uid == user.get("id")
    return False


@router.get("/campaign-runs/{run_id}/chat")
async def get_chat(
    run_id: str,
    channel: str = Query("group"),
    after: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    from server import db
    run = await _get_run_or_404(db, run_id)
    is_player = await _is_accepted_player(db, run_id, user)
    if not (_is_dm(run, user) or is_player):
        raise HTTPException(status_code=403, detail="Sin permiso")
    if not _can_access_channel(run, user, channel, is_player):
        raise HTTPException(status_code=403, detail="Canal no permitido")

    query: dict = {"campaign_run_id": run_id, "channel": channel}
    if after:
        query["created_at"] = {"$gt": after}
    cursor = db.dj_chat_messages.find(query).sort("created_at", 1).limit(200)
    return [_serialize(d) async for d in cursor]


@router.post("/campaign-runs/{run_id}/chat", status_code=201)
async def post_chat(
    run_id: str, payload: ChatPostBody, user: dict = Depends(get_current_user)
):
    from server import db
    run = await _get_run_or_404(db, run_id)
    is_player = await _is_accepted_player(db, run_id, user)
    if not (_is_dm(run, user) or is_player):
        raise HTTPException(status_code=403, detail="Sin permiso")
    if not _can_access_channel(run, user, payload.channel, is_player):
        raise HTTPException(status_code=403, detail="Canal no permitido")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": run_id,
        "channel": payload.channel,
        "sender_id": user.get("id"),
        "sender_name": user.get("nombre") or user.get("email") or "Anónimo",
        "sender_role": "dj" if _is_dm(run, user) else "player",
        "text": payload.text.strip(),
        "created_at": now,
    }
    await db.dj_chat_messages.insert_one(doc)
    return _serialize(doc)


@router.get("/campaign-runs/{run_id}/chat/peers")
async def chat_peers(run_id: str, user: dict = Depends(get_current_user)):
    """DM/Maestro → list of accepted players to open private chats.
    Player → empty (they only get group + their own DJ channel)."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    is_player = await _is_accepted_player(db, run_id, user)
    if not (_is_dm(run, user) or is_player):
        raise HTTPException(status_code=403, detail="Sin permiso")

    if not _is_dm(run, user):
        return {"is_dm": False, "peers": []}

    peers = []
    seen = set()
    cursor = db.campaign_players.find({"campaign_run_id": run_id, "status": "accepted"})
    async for p in cursor:
        uid = p.get("user_id")
        if uid in seen:
            continue
        seen.add(uid)
        u = await db.users.find_one({"id": uid})
        char = await db.characters.find_one({"_id": p.get("character_id")})
        peers.append({
            "user_id": uid,
            "user_name": (u.get("nombre") or u.get("email")) if u else "Jugador",
            "character_name": char.get("nombre") if char else None,
            "channel": f"private:{uid}",
        })
    return {"is_dm": True, "peers": peers}
