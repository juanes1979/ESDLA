"""
Campaign Experience (Fase 4) regression tests — award XP, consolidation on
finish, history records, abandon/expel zeroes pending XP.
"""
import asyncio
import os

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
PLAYER_EMAIL = "xptest_player_it99@example.com"
PLAYER_PASS = "abcd"
TEST_PREFIX = "XPTest_It99_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        advs = [a async for a in c.adventures.find({"name": {"$regex": f"^{TEST_PREFIX}"}})]
        adv_ids = [a["id"] for a in advs]
        runs = []
        if adv_ids:
            runs = [r async for r in c.campaign_runs.find({"adventure_id": {"$in": adv_ids}})]
        run_ids = [r["id"] for r in runs]
        for coll in (
            "campaign_environments", "campaign_intrigues", "campaign_npcs",
            "campaign_maps", "campaign_log", "campaign_players",
            "campaign_experience",
        ):
            if run_ids:
                await c[coll].delete_many({"campaign_run_id": {"$in": run_ids}})
        if run_ids:
            await c.campaign_runs.delete_many({"id": {"$in": run_ids}})
            await c.character_campaign_history.delete_many({"campaign_run_id": {"$in": run_ids}})
            await c.characters.update_many(
                {"active_campaign_run_id": {"$in": run_ids}},
                {"$set": {"active_campaign_run_id": None}},
            )
        if adv_ids:
            await c.adventures.delete_many({"id": {"$in": adv_ids}})
        # Test characters
        test_chars = [ch async for ch in c.characters.find({"nombre": {"$regex": f"^{TEST_PREFIX}"}})]
        char_ids = [ch["_id"] for ch in test_chars]
        if char_ids:
            await c.character_campaign_history.delete_many({"character_id": {"$in": char_ids}})
            await c.characters.delete_many({"_id": {"$in": char_ids}})
        await c.users.delete_many({"email": PLAYER_EMAIL})
    asyncio.new_event_loop().run_until_complete(_do())


@pytest.fixture(autouse=True)
def _auto_cleanup():
    _cleanup()
    yield
    _cleanup()


def _login(email, password):
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": email, "password": password, "remember_me": False},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _register_and_approve(email, password, role="jugador"):
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": email, "password": password, "name": email.split("@")[0]},
        timeout=10,
    )
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users", headers=_h(maestro_tok), timeout=10
    ).json()
    target = next(u for u in users if u["email"] == email)
    requests.patch(
        f"{BASE}/api/auth/users/{target['id']}",
        json={"role": role, "status": "aprobado"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    return target["id"]


async def _create_test_character(user_id: str, name: str, experiencia: int = 100):
    import uuid as _uuid
    from datetime import datetime, timezone as _tz
    c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    char_id = str(_uuid.uuid4())
    await c.characters.insert_one({
        "_id": char_id,
        "nombre": name,
        "owner_id": user_id,
        "estado": "activo",
        "nivel": 3,
        "experiencia": experiencia,
        "xp": experiencia,
        "cultura_nombre": "Pueblo de Bardo",
        "categoria_cultura": "Hombres",
        "active_campaign_run_id": None,
        "created_at": datetime.now(_tz.utc).isoformat(),
    })
    return char_id


def _create_char(user_id, name, experiencia=100):
    return asyncio.new_event_loop().run_until_complete(
        _create_test_character(user_id, name, experiencia)
    )


def _setup(maestro_tok, player_user_id, char_name=f"{TEST_PREFIX}Hero", experiencia=100):
    char_id = _create_char(player_user_id, char_name, experiencia)
    adv = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_PREFIX}adv", "max_players": 4},
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/activate",
        headers=_h(maestro_tok),
        timeout=10,
    )
    return char_id, run


def _join_and_accept(maestro_tok, p_tok, run, char_id):
    join = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    ).json()
    requests.patch(
        f"{BASE}/api/campaign-players/{join['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    return join["id"]


def _get_char(tok, char_id):
    return requests.get(f"{BASE}/api/characters/{char_id}", headers=_h(tok), timeout=10).json()


# ============================================================================
# Tests
# ============================================================================
def test_award_xp_increments_pending_only():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    _join_and_accept(maestro_tok, p_tok, run, char_id)

    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 75, "reason": "Combate"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 201, r.text

    # Pending updated
    players = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/players", headers=_h(maestro_tok), timeout=10
    ).json()
    assert players[0]["xp_pending_total"] == 75

    # Character experiencia NOT yet incremented
    char = _get_char(maestro_tok, char_id)
    assert char["experiencia"] == 100  # unchanged from setup


def test_award_xp_validation():
    """xp_amount must be positive."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    _join_and_accept(maestro_tok, p_tok, run, char_id)

    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 0},
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 422


def test_award_xp_only_for_accepted():
    """Cannot award XP to a character that's not accepted."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid)

    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 50},
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 404


def test_finish_consolidates_xp_into_character():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid, experiencia=100)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    _join_and_accept(maestro_tok, p_tok, run, char_id)

    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 250},
        headers=_h(maestro_tok),
        timeout=10,
    )

    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/finish",
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert "xp_consolidation" in body
    assert body["xp_consolidation"][0]["xp_earned"] == 250

    char = _get_char(maestro_tok, char_id)
    assert char["experiencia"] == 350  # 100 + 250


def test_history_entry_created_on_finish():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    _join_and_accept(maestro_tok, p_tok, run, char_id)

    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 80},
        headers=_h(maestro_tok),
        timeout=10,
    )
    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/finish",
        headers=_h(maestro_tok),
        timeout=10,
    )

    history = requests.get(
        f"{BASE}/api/characters/{char_id}/campaign-history",
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    assert len(history) == 1
    assert history[0]["result"] == "success"
    assert history[0]["xp_earned"] == 80
    assert history[0]["adventure_name"] == f"{TEST_PREFIX}adv"


def test_expel_loses_pending_xp():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid, experiencia=100)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    pid_player = _join_and_accept(maestro_tok, p_tok, run, char_id)

    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 100},
        headers=_h(maestro_tok),
        timeout=10,
    )
    # Expel before finish
    requests.patch(
        f"{BASE}/api/campaign-players/{pid_player}",
        json={"status": "expelled"},
        headers=_h(maestro_tok),
        timeout=10,
    )

    # Char experiencia not increased
    char = _get_char(maestro_tok, char_id)
    assert char["experiencia"] == 100

    # History entry with result=expelled, xp_earned=0
    history = requests.get(
        f"{BASE}/api/characters/{char_id}/campaign-history",
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    assert len(history) == 1
    assert history[0]["result"] == "expelled"
    assert history[0]["xp_earned"] == 0


def test_voluntary_leave_loses_pending_xp():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid, experiencia=200)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    pid_player = _join_and_accept(maestro_tok, p_tok, run, char_id)

    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 60},
        headers=_h(maestro_tok),
        timeout=10,
    )
    requests.post(
        f"{BASE}/api/campaign-players/{pid_player}/leave",
        headers=_h(p_tok),
        timeout=10,
    )

    char = _get_char(maestro_tok, char_id)
    assert char["experiencia"] == 200  # unchanged

    history = requests.get(
        f"{BASE}/api/characters/{char_id}/campaign-history",
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    assert len(history) == 1
    assert history[0]["result"] == "abandon"
    assert history[0]["xp_earned"] == 0


def test_player_cannot_award_xp():
    """Only DJ/Maestro can award XP."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    char_id, run = _setup(maestro_tok, pid)
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    _join_and_accept(maestro_tok, p_tok, run, char_id)

    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 50},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 403
