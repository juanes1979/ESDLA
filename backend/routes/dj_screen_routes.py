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
from realtime import manager
from routes.eye_routes import (
    _load_state as _eye_load,
    _calc_threshold as _eye_threshold,
    increment as _eye_increment_route,
    IncrementRequest as _EyeIncrementRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dj-screen"])


async def _broadcast_state(run_id: str, screen: dict) -> None:
    """Difunde el estado del rastreador por WS: completo a DJ, saneado a jugadores."""
    full = _serialize(screen)
    player = _sanitize_for_player(screen)
    try:
        await manager.broadcast(
            run_id,
            {"type": "dj_screen_state", "state": full},
            {"type": "dj_screen_state", "state": player},
        )
    except Exception as e:
        logger.info("broadcast dj_screen falló (%s): %s", run_id, e)


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
    atk_bonus: int = 0
    dmg: str = "1d6"
    init_bonus: int = 0


class DjScreenState(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scene_image_file_id: Optional[str] = None
    notes_private: str = ""
    combatants: List[Combatant] = Field(default_factory=list)
    current_turn_index: int = 0
    round_number: int = 1
    combat_active: bool = False


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


def _mod(score: int) -> int:
    return (int(score or 10) - 10) // 2


def _prof_bonus(nivel: int) -> int:
    return 2 + ((int(nivel or 1) - 1) // 4)


def _char_combat_stats(char: dict) -> tuple[int, str]:
    """Deriva (atk_bonus, dmg) de la ficha: mod del mejor atributo (FUE/DES,
    aproximación de finura) + competencia; daño = dados del arma equipada + mod."""
    attrs = char.get("atributos") or {}
    mod_fue = _mod(attrs.get("fuerza", 10))
    mod_des = _mod(attrs.get("destreza", 10))
    best = max(mod_fue, mod_des)
    prof = _prof_bonus(char.get("nivel", 1))
    atk_bonus = best + prof
    # Arma equipada: primer arma con dados de daño, si la hay.
    dmg_dice = "1d6"
    for w in (char.get("armas") or []):
        if isinstance(w, dict) and (w.get("dano") or w.get("daño")):
            dmg_dice = str(w.get("dano") or w.get("daño"))
            break
    sign = "+" if best >= 0 else "-"
    dmg = f"{dmg_dice}{sign}{abs(best)}" if best != 0 else dmg_dice
    return atk_bonus, dmg


def _roll_d20(mode: str) -> tuple[int, list[int]]:
    """Devuelve (valor_usado, dados_tirados) según normal/ventaja/desventaja."""
    import random
    if mode == "advantage":
        a, b = random.randint(1, 20), random.randint(1, 20)
        return max(a, b), [a, b]
    if mode == "disadvantage":
        a, b = random.randint(1, 20), random.randint(1, 20)
        return min(a, b), [a, b]
    a = random.randint(1, 20)
    return a, [a]


def _roll_damage(dmg: str, crit: bool) -> tuple[int, str]:
    """Parsea 'NdM+K' (o variantes) y tira el daño. Crítico duplica los DADOS."""
    import random
    import re
    s = (dmg or "1d6").replace(" ", "").lower()
    total = 0
    parts_desc = []
    # bloques NdM
    for n_str, m_str in re.findall(r"(\d*)d(\d+)", s):
        n = int(n_str) if n_str else 1
        m = int(m_str)
        rolls_n = n * 2 if crit else n
        rolls = [random.randint(1, m) for _ in range(rolls_n)]
        total += sum(rolls)
        parts_desc.append(f"{rolls_n}d{m}({','.join(map(str, rolls))})")
    # modificadores planos +K / -K
    s_wo_dice = re.sub(r"\d*d\d+", "", s)
    for sign, num in re.findall(r"([+-])(\d+)", s_wo_dice):
        val = int(num) * (1 if sign == "+" else -1)
        total += val
        parts_desc.append(f"{sign}{num}")
    if not parts_desc:  # daño plano sin dados
        try:
            total = int(s)
            parts_desc.append(s)
        except ValueError:
            total = 1
    return max(0, total), " ".join(parts_desc)


class AttackBody(BaseModel):
    attacker_id: str
    defender_id: str
    mode: Literal["normal", "advantage", "disadvantage"] = "normal"


# Lista CERRADA de condiciones (claves en minúscula) y sus efectos en combate.
CONDITION_KEYS = [
    "cansado", "inspirado", "aturdido", "tumbado",
    "apresado", "asustado", "envenenado", "inconsciente",
]
# El combatiente no puede atacar si tiene alguna de estas.
CANT_ACT = {"aturdido", "inconsciente"}
# Como ATACANTE: desventaja en sus ataques.
ATTACKER_DISADV = {"cansado", "asustado", "envenenado"}
# Como DEFENSOR: los ataques contra él tienen ventaja.
DEFENDER_GRANTS_ADV = {"tumbado", "aturdido", "inconsciente"}


def _conds(c: dict) -> set:
    return {str(x).strip().lower() for x in (c.get("conditions") or [])}


def _effective_mode(base_mode: str, attacker: dict, defender: dict) -> str:
    """Combina el modo elegido por el DJ con las condiciones (5e: ventaja y
    desventaja simultáneas se cancelan a normal). Inspirado da ventaja."""
    a, d = _conds(attacker), _conds(defender)
    adv = base_mode == "advantage" or ("inspirado" in a) or bool(d & DEFENDER_GRANTS_ADV)
    dis = base_mode == "disadvantage" or bool(a & ATTACKER_DISADV)
    if adv and not dis:
        return "advantage"
    if dis and not adv:
        return "disadvantage"
    return "normal"


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
    await _broadcast_state(run_id, screen)
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
        atk_bonus, dmg = _char_combat_stats(char)
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
            "atk_bonus": atk_bonus,
            "dmg": dmg,
            "init_bonus": int(char.get("iniciativa_bonus") or 0),
        })
        existing_char_ids.add(char.get("_id"))
        added += 1

    now = datetime.now(timezone.utc).isoformat()
    await db.dj_screens.update_one(
        {"campaign_run_id": run_id},
        {"$set": {"combatants": combatants, "updated_at": now}},
    )
    screen = await db.dj_screens.find_one({"campaign_run_id": run_id})
    await _broadcast_state(run_id, screen)
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


def _eye_band(ratio: float) -> str:
    """Banda runica del Ojo para la vista de jugador (sin números)."""
    if ratio < 0.25:
        return "Ojo dormido"
    if ratio < 0.5:
        return "Ojo entreabierto"
    if ratio < 0.75:
        return "Ojo vigilante"
    if ratio < 1.0:
        return "Ojo parpadeando"
    return "La Mirada"


@router.get("/campaign-runs/{run_id}/eye")
async def get_campaign_eye(run_id: str, user: dict = Depends(get_current_user)):
    """Ojo de Mordor ligado a la campaña (state_id = campaign_run_id).
    DJ/Maestro: estado completo. Jugador aceptado: banda runica saneada."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    state = await _eye_load(run_id)
    threshold = _eye_threshold(
        state.get("last_region_id"),
        state.get("region_overrides", {}),
        state.get("threshold_modifiers", 0),
    )
    total = state.get("attention_total", 0)
    ratio = (total / threshold["threshold"]) if threshold["threshold"] > 0 else 0

    if _is_dm(run, user):
        return {
            "can_edit": True,
            "attention_total": total,
            "threshold_info": threshold,
            "ratio": ratio,
            "will_trigger": total >= threshold["threshold"],
            "band": _eye_band(ratio),
            "history": state.get("history", [])[-30:],
        }
    if await _is_accepted_player(db, run_id, user):
        # Saneado: solo la banda runica, sin números ni umbrales.
        return {"can_edit": False, "band": _eye_band(ratio)}
    raise HTTPException(status_code=403, detail="Sin permiso")


@router.post("/campaign-runs/{run_id}/dj-screen/attack")
async def attack(run_id: str, body: AttackBody, user: dict = Depends(get_current_user)):
    """Motor de ataque d20: tirada (normal/ventaja/desventaja) + atk_bonus vs CA,
    aplica daño automático, persiste, narra en chat y difunde por WS. DM/Maestro."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    screen = await _ensure_screen(db, run)
    combatants = screen.get("combatants", [])
    atk = next((c for c in combatants if c.get("id") == body.attacker_id), None)
    dfn = next((c for c in combatants if c.get("id") == body.defender_id), None)
    if not atk or not dfn:
        raise HTTPException(status_code=404, detail="Atacante o defensor no encontrado")

    # El atacante debe poder actuar.
    if int(atk.get("hp_current", 0)) <= 0:
        raise HTTPException(status_code=400, detail=f"{atk['name']} está caído y no puede atacar")
    blocking = _conds(atk) & CANT_ACT
    if blocking:
        raise HTTPException(status_code=400, detail=f"{atk['name']} no puede actuar ({', '.join(blocking)})")

    # Modo efectivo según condiciones de atacante/defensor.
    eff_mode = _effective_mode(body.mode, atk, dfn)
    d20, dice = _roll_d20(eff_mode)
    atk_bonus = int(atk.get("atk_bonus", 0))
    total_atk = d20 + atk_bonus
    ac = int(dfn.get("ac", 10))
    crit = d20 == 20 or ("inconsciente" in _conds(dfn))  # golpe a inconsciente = crítico
    fumble = d20 == 1
    hit = (not fumble) and (crit or total_atk >= ac)

    # Consumir "Inspirado" del atacante (se gasta al atacar).
    consumed_inspired = False
    if "inspirado" in _conds(atk):
        atk["conditions"] = [x for x in (atk.get("conditions") or []) if str(x).strip().lower() != "inspirado"]
        consumed_inspired = True

    dmg_total = 0
    dmg_desc = ""
    if hit:
        dmg_total, dmg_desc = _roll_damage(atk.get("dmg", "1d6"), crit)
        new_hp = max(0, int(dfn.get("hp_current", 0)) - dmg_total)
        for c in combatants:
            if c.get("id") == dfn.get("id"):
                c["hp_current"] = new_hp
                # A 0 PG: queda inconsciente automáticamente.
                if new_hp == 0 and "inconsciente" not in _conds(c):
                    c["conditions"] = (c.get("conditions") or []) + ["inconsciente"]
                break
        if dfn.get("type") == "player" and dfn.get("character_id"):
            await db.characters.update_one(
                {"_id": dfn["character_id"]},
                {"$set": {"puntos_golpe_actual": new_hp}},
            )

    # Persistir SIEMPRE (puede haberse consumido Inspirado aunque falle).
    now = datetime.now(timezone.utc).isoformat()
    await db.dj_screens.update_one(
        {"campaign_run_id": run_id},
        {"$set": {"combatants": combatants, "updated_at": now}},
    )
    screen = await db.dj_screens.find_one({"campaign_run_id": run_id})

    # Narrativa para el chat de grupo.
    mode_txt = {"advantage": " con ventaja", "disadvantage": " con desventaja"}.get(eff_mode, "")
    if eff_mode != body.mode:
        mode_txt += " (por condiciones)"
    dice_txt = f"{'/'.join(map(str, dice))}→{d20}" if len(dice) > 1 else str(d20)
    bonus_txt = f"{'+' if atk_bonus >= 0 else ''}{atk_bonus}"
    if fumble:
        narr = f"⚔️ {atk['name']} ataca a {dfn['name']}: d20({dice_txt}){mode_txt} → ¡Pifia! Fallo automático."
    elif not hit:
        narr = f"⚔️ {atk['name']} ataca a {dfn['name']}: d20({dice_txt}){bonus_txt} = {total_atk} vs CA {ac} → Falla."
    else:
        crit_txt = " ¡CRÍTICO!" if crit else ""
        narr = (f"⚔️ {atk['name']} ataca a {dfn['name']}: d20({dice_txt}){bonus_txt} = {total_atk} "
                f"vs CA {ac} → ¡Impacta!{crit_txt} Daño: {dmg_desc} = {dmg_total}. "
                f"{dfn['name']}: {dfn['hp_current'] + dmg_total}→{dfn['hp_current']} PG.")

    msg = {
        "id": str(uuid.uuid4()),
        "campaign_run_id": run_id,
        "channel": "group",
        "sender_id": "system",
        "sender_name": "Combate",
        "sender_role": "system",
        "text": narr,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.dj_chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)

    # Difusión en vivo.
    await _broadcast_state(run_id, screen)
    try:
        await manager.broadcast_chat(run_id, "group", _serialize(msg))
    except Exception:
        pass

    return {
        "hit": hit,
        "crit": crit,
        "fumble": fumble,
        "d20": d20,
        "dice": dice,
        "atk_bonus": atk_bonus,
        "total_atk": total_atk,
        "ac": ac,
        "damage": dmg_total,
        "damage_desc": dmg_desc,
        "narrative": narr,
        "state": _serialize(screen),
    }


@router.post("/campaign-runs/{run_id}/dj-screen/roll-initiative")
async def roll_initiative(run_id: str, user: dict = Depends(get_current_user)):
    """Tira iniciativa (1d20 + init_bonus) para TODOS los combatientes, ordena
    descendente e inicia el combate. Solo al inicio (no cada turno)."""
    import random
    from server import db
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    screen = await _ensure_screen(db, run)
    combatants = screen.get("combatants", [])
    if not combatants:
        raise HTTPException(status_code=400, detail="No hay combatientes")

    lines = []
    for c in combatants:
        bonus = int(c.get("init_bonus", c.get("initiative", 0)) or 0)
        c["init_bonus"] = bonus
        roll = random.randint(1, 20)
        c["initiative"] = roll + bonus
        lines.append(f"{c['name']}: {roll}+{bonus}={c['initiative']}")
    combatants.sort(key=lambda x: x.get("initiative", 0), reverse=True)

    now = datetime.now(timezone.utc).isoformat()
    await db.dj_screens.update_one(
        {"campaign_run_id": run_id},
        {"$set": {
            "combatants": combatants, "current_turn_index": 0,
            "round_number": 1, "combat_active": True, "updated_at": now,
        }},
    )
    screen = await db.dj_screens.find_one({"campaign_run_id": run_id})

    msg = {
        "id": str(uuid.uuid4()), "campaign_run_id": run_id, "channel": "group",
        "sender_id": "system", "sender_name": "Combate", "sender_role": "system",
        "text": "🎲 Iniciativa: " + " · ".join(lines),
        "created_at": now,
    }
    await db.dj_chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)
    await _broadcast_state(run_id, screen)
    try:
        await manager.broadcast_chat(run_id, "group", _serialize(msg))
    except Exception:
        pass
    return _serialize(screen)


@router.post("/campaign-runs/{run_id}/dj-screen/travel-event")
async def travel_event(
    run_id: str,
    tipo_tierra: str = "tierras_salvajes",
    terreno: str = "campo_abierto",
    estacion: str = "verano",
    tipo_via: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Genera un acontecimiento de viaje (reutiliza el motor de viajes) y lo
    narra en el chat de grupo. DM/Maestro."""
    from server import db
    from routes.travel_routes import generate_event as _gen_event
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    result = await _gen_event(tipo_tierra=tipo_tierra, terreno=terreno, estacion=estacion, tipo_via=tipo_via)
    ev = result.get("evento", {})
    obj = result.get("objetivo", {})
    sombra = ev.get("puntos_sombra", 0)
    narr = (f"🧭 Acontecimiento de viaje: «{ev.get('nombre')}». "
            f"Encargado: {obj.get('papel')} — prueba de {obj.get('prueba')} "
            f"({obj.get('atributo')}/{obj.get('habilidad')}) CD {result.get('cd_prueba')}.")
    if sombra:
        narr += f" ⚫ Sombra: +{sombra} si falla."
    if ev.get("fatigue_cd_increase"):
        narr += f" 💤 CD de cansancio +{ev.get('fatigue_cd_increase')}."

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()), "campaign_run_id": run_id, "channel": "group",
        "sender_id": "system", "sender_name": "Viaje", "sender_role": "system",
        "text": narr, "created_at": now,
    }
    await db.dj_chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)
    try:
        await manager.broadcast_chat(run_id, "group", _serialize(msg))
    except Exception:
        pass
    return result


class ApplyShadowBody(BaseModel):
    amount: int
    reason: Optional[str] = None


class EyeIncrementBody(BaseModel):
    delta: int = 1
    descripcion: str = ""


async def _broadcast_eye(run_id: str) -> None:
    """Difunde el estado del Ojo: completo a DJ, banda runica a jugadores."""
    state = await _eye_load(run_id)
    threshold = _eye_threshold(
        state.get("last_region_id"),
        state.get("region_overrides", {}),
        state.get("threshold_modifiers", 0),
    )
    total = state.get("attention_total", 0)
    ratio = (total / threshold["threshold"]) if threshold["threshold"] > 0 else 0
    band = _eye_band(ratio)
    try:
        await manager.broadcast(
            run_id,
            {"type": "eye_update", "attention_total": total, "threshold_info": threshold,
             "ratio": ratio, "band": band, "will_trigger": total >= threshold["threshold"]},
            {"type": "eye_update", "band": band},
        )
    except Exception as e:
        logger.info("broadcast eye falló (%s): %s", run_id, e)


@router.post("/campaign-runs/{run_id}/dj-screen/apply-shadow")
async def apply_shadow(run_id: str, body: ApplyShadowBody, user: dict = Depends(get_current_user)):
    """Suma (o resta) Puntos de Sombra a TODOS los personajes aceptados de la
    campaña de un clic. Narra en el chat y difunde. DM/Maestro."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")

    affected = []
    cursor = db.campaign_players.find({"campaign_run_id": run_id, "status": "accepted"})
    seen = set()
    async for p in cursor:
        cid = p.get("character_id")
        if not cid or cid in seen:
            continue
        seen.add(cid)
        char = await db.characters.find_one({"_id": cid})
        if not char:
            continue
        new_shadow = max(0, int(char.get("puntos_sombra", 0)) + body.amount)
        await db.characters.update_one(
            {"_id": cid},
            {"$set": {"puntos_sombra": new_shadow, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        affected.append({"character_id": cid, "name": char.get("nombre"), "puntos_sombra": new_shadow})

    sign = "+" if body.amount >= 0 else ""
    reason_txt = f" ({body.reason})" if body.reason else ""
    narr = f"⚫ Sombra {sign}{body.amount} a la Compañía{reason_txt}: " + ", ".join(
        f"{a['name']} ({a['puntos_sombra']})" for a in affected) if affected else "⚫ Sin héroes a los que aplicar Sombra."
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()), "campaign_run_id": run_id, "channel": "group",
        "sender_id": "system", "sender_name": "Sombra", "sender_role": "system",
        "text": narr, "created_at": now,
    }
    await db.dj_chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)
    try:
        await manager.broadcast_chat(run_id, "group", _serialize(msg))
        await manager.broadcast(run_id, {"type": "shadow_applied", "affected": affected}, {"type": "shadow_applied"})
    except Exception:
        pass
    return {"affected": affected}


@router.post("/campaign-runs/{run_id}/dj-screen/eye-increment")
async def eye_increment(run_id: str, body: EyeIncrementBody, user: dict = Depends(get_current_user)):
    """Incrementa el Ojo de Mordor de la campaña (state_id = run_id). DM/Maestro."""
    from server import db
    run = await _get_run_or_404(db, run_id)
    if not _is_dm(run, user):
        raise HTTPException(status_code=403, detail="Sin permiso")
    req = _EyeIncrementRequest(source="manual", delta=body.delta, descripcion=body.descripcion or "DJ")
    result = await _eye_increment_route(req, state_id=run_id)
    await _broadcast_eye(run_id)
    return result


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
    msg = _serialize(doc)
    try:
        await manager.broadcast_chat(run_id, payload.channel, msg)
    except Exception:
        pass
    return msg


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
