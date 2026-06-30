"""
Infraestructura de tiempo real para la Pantalla del DJ.

Patrón: fan-out a nivel de aplicación con un ConnectionManager en memoria
(dict campaign_run_id → {conexiones}). Cada conexión guarda si es DJ/Maestro
o jugador, para enviar el payload completo o el SANEADO según rol.

Endpoint: WS /api/ws/campaign/{run_id}?token=<jwt>
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from auth import decode_token

logger = logging.getLogger(__name__)

ws_router = APIRouter()


@dataclass(eq=False)
class Connection:
    ws: WebSocket
    user_id: str
    is_dm: bool


class ConnectionManager:
    """Salas por campaña. Difunde estado a todos los clientes conectados,
    sanitizando para jugadores."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[Connection]] = defaultdict(set)

    async def connect(self, run_id: str, ws: WebSocket, user_id: str, is_dm: bool) -> Connection:
        await ws.accept()
        conn = Connection(ws=ws, user_id=user_id, is_dm=is_dm)
        self._rooms[run_id].add(conn)
        return conn

    def disconnect(self, run_id: str, conn: Connection) -> None:
        room = self._rooms.get(run_id)
        if room and conn in room:
            room.discard(conn)
            if not room:
                self._rooms.pop(run_id, None)

    def count(self, run_id: str) -> int:
        return len(self._rooms.get(run_id, ()))

    async def broadcast(
        self,
        run_id: str,
        message_full: dict,
        message_player: Optional[dict] = None,
    ) -> None:
        """Envía `message_full` a DJ/Maestro y `message_player` (o el full si no
        se aporta) a los jugadores. Limpia conexiones muertas."""
        room = list(self._rooms.get(run_id, ()))
        dead: list[Connection] = []
        for conn in room:
            payload = message_full if conn.is_dm else (message_player or message_full)
            try:
                await conn.ws.send_json(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(run_id, conn)


    async def broadcast_chat(self, run_id: str, channel: str, message: dict) -> None:
        """Difunde un mensaje de chat respetando el canal: 'group' a todos;
        'private:<uid>' solo al DJ y a ese jugador."""
        room = list(self._rooms.get(run_id, ()))
        target_uid = channel.split(":", 1)[1] if channel.startswith("private:") else None
        payload = {"type": "chat", "channel": channel, "message": message}
        dead: list[Connection] = []
        for conn in room:
            allowed = (target_uid is None) or conn.is_dm or (conn.user_id == target_uid)
            if not allowed:
                continue
            try:
                await conn.ws.send_json(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(run_id, conn)


manager = ConnectionManager()


async def _is_member(db, run_id: str, user: dict) -> tuple[bool, bool]:
    """Devuelve (es_miembro, es_dm)."""
    run = await db.campaign_runs.find_one({"id": run_id})
    if not run:
        return False, False
    is_dm = user.get("role") == "maestro" or run.get("dm_id") == user.get("id")
    if is_dm:
        return True, True
    player = await db.campaign_players.find_one({
        "campaign_run_id": run_id,
        "user_id": user.get("id"),
        "status": "accepted",
    })
    return (bool(player), False)


@ws_router.websocket("/api/ws/campaign/{run_id}")
async def campaign_ws(websocket: WebSocket, run_id: str, token: str = Query(...)):
    # Autenticación por token (query param: los WS de navegador no envían headers).
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    from server import db
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user or user.get("status") != "aprobado":
        await websocket.close(code=4401)
        return

    is_member, is_dm = await _is_member(db, run_id, user)
    if not is_member:
        await websocket.close(code=4403)
        return

    conn = await manager.connect(run_id, websocket, user.get("id"), is_dm)
    # Saludo inicial: confirma conexión y rol.
    await websocket.send_json({
        "type": "connected",
        "run_id": run_id,
        "is_dm": is_dm,
        "peers": manager.count(run_id),
    })
    try:
        while True:
            # Mantenemos viva la conexión; respondemos a "ping" con "pong".
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.info("WS cerrado (%s): %s", run_id, e)
    finally:
        manager.disconnect(run_id, conn)
