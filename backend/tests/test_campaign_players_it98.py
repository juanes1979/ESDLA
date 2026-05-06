"""
Campaign Players (Fase 3) regression tests — join-by-code, accept/reject/expel,
character locking, multi-character caps, my campaigns view.
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
PLAYER_EMAIL = "joinplayer_it98@example.com"
PLAYER_PASS = "abcd"
PLAYER2_EMAIL = "joinplayer2_it98@example.com"
PLAYER2_PASS = "abcd"
TEST_PREFIX = "JoinTest_It98_"


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
            "campaign_environments",
            "campaign_intrigues",
            "campaign_npcs",
            "campaign_maps",
            "campaign_log",
            "campaign_players",
        ):
            if run_ids:
                await c[coll].delete_many({"campaign_run_id": {"$in": run_ids}})
        if run_ids:
            await c.campaign_runs.delete_many({"id": {"$in": run_ids}})
        if adv_ids:
            await c.adventures.delete_many({"id": {"$in": adv_ids}})
        # Release any characters that were locked
        if run_ids:
            await c.characters.update_many(
                {"active_campaign_run_id": {"$in": run_ids}},
                {"$set": {"active_campaign_run_id": None}},
            )
        # Also clean test characters by name prefix
        await c.characters.delete_many({"nombre": {"$regex": f"^{TEST_PREFIX}"}})
        await c.users.delete_many({"email": {"$in": [PLAYER_EMAIL, PLAYER2_EMAIL]}})
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


async def _create_test_character(user_id: str, name: str):
    """Insert a minimal character directly in DB for testing."""
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
        "cultura_nombre": "Pueblo de Bardo",
        "categoria_cultura": "Hombres",
        "created_at": datetime.now(_tz.utc).isoformat(),
        "active_campaign_run_id": None,
    })
    return char_id


def _create_char(user_id: str, name: str) -> str:
    return asyncio.new_event_loop().run_until_complete(_create_test_character(user_id, name))


def _setup_active_run(maestro_tok, *, allow_multi=False, max_players=4, max_chars_per_player=None):
    body = {
        "name": f"{TEST_PREFIX}adv",
        "max_players": max_players,
        "allow_multi_characters": allow_multi,
    }
    if allow_multi and max_chars_per_player:
        body["max_characters_per_player"] = max_chars_per_player
    adv = requests.post(f"{BASE}/api/adventures", json=body, headers=_h(maestro_tok), timeout=10).json()
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}", headers=_h(maestro_tok), timeout=10
    ).json()
    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/activate", headers=_h(maestro_tok), timeout=10
    )
    return run


# ============================================================================
# Tests
# ============================================================================
def test_join_by_code_creates_pending_request():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Bilbo")

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"].lower(), "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["join_origin"] == "code"
    assert body["character_id"] == char_id


def test_join_invalid_code_404():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Frodo")
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": "FAKEFAKE", "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 404


def test_cannot_join_inactive_run():
    """Run in 'draft' should reject joins."""
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_PREFIX}draft_adv", "max_players": 4},
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    # Don't activate it!

    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Sam")
    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 400
    assert "draft" in r.text


def test_cannot_use_someone_elses_character():
    """Player tries to use a character that belongs to another user → 403."""
    p1 = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    p2 = _register_and_approve(PLAYER2_EMAIL, PLAYER2_PASS)
    char_p1 = _create_char(p1, f"{TEST_PREFIX}P1Char")

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p2_tok = _login(PLAYER2_EMAIL, PLAYER2_PASS)
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_p1},
        headers=_h(p2_tok),
        timeout=10,
    )
    assert r.status_code == 403


def test_accept_locks_character_to_run():
    """When DJ accepts a request, character.active_campaign_run_id must be set."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Pippin")

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    join = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    ).json()

    # Maestro accepts
    r = requests.patch(
        f"{BASE}/api/campaign-players/{join['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"

    # Verify character is now locked
    char = requests.get(f"{BASE}/api/characters/{char_id}", headers=_h(maestro_tok), timeout=10).json()
    assert char.get("active_campaign_run_id") == run["id"]


def test_cannot_join_other_run_with_locked_character():
    """Once a character is in run A, joining run B with same character fails."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Boromir")

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run_a = _setup_active_run(maestro_tok)
    run_b = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    join_a = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run_a["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    ).json()
    requests.patch(
        f"{BASE}/api/campaign-players/{join_a['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )

    # Try to join run_b with the same character
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run_b["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 400
    assert "otra campaña" in r.text


def test_multi_char_disabled_blocks_second():
    """allow_multi_characters=False — same player can't request a 2nd character."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char1 = _create_char(pid, f"{TEST_PREFIX}A")
    char2 = _create_char(pid, f"{TEST_PREFIX}B")

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok, allow_multi=False)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char1},
        headers=_h(p_tok),
        timeout=10,
    )
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char2},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 400


def test_multi_char_cap_enforced():
    """allow_multi_characters=True with cap=2 — third request fails."""
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    chars = [_create_char(pid, f"{TEST_PREFIX}M{i}") for i in range(3)]

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok, allow_multi=True, max_chars_per_player=2)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    for i in range(2):
        r = requests.post(
            f"{BASE}/api/campaign-runs/join-by-code",
            json={"code": run["campaign_code"], "character_id": chars[i]},
            headers=_h(p_tok),
            timeout=10,
        )
        assert r.status_code == 201, r.text

    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": chars[2]},
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 400
    assert "máximo" in r.text.lower() or "maximo" in r.text.lower()


def test_max_players_capacity_on_accept():
    """Run with max_players=1 — second accept fails."""
    p1 = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    p2 = _register_and_approve(PLAYER2_EMAIL, PLAYER2_PASS)
    char1 = _create_char(p1, f"{TEST_PREFIX}P1")
    char2 = _create_char(p2, f"{TEST_PREFIX}P2")

    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok, max_players=1)

    p1_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    p2_tok = _login(PLAYER2_EMAIL, PLAYER2_PASS)

    j1 = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char1},
        headers=_h(p1_tok),
        timeout=10,
    ).json()
    j2 = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char2},
        headers=_h(p2_tok),
        timeout=10,
    ).json()

    requests.patch(
        f"{BASE}/api/campaign-players/{j1['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    r = requests.patch(
        f"{BASE}/api/campaign-players/{j2['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 400
    assert "llena" in r.text.lower()


def test_expel_releases_character():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Merry")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    j = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    ).json()
    requests.patch(
        f"{BASE}/api/campaign-players/{j['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    # Expel
    r = requests.patch(
        f"{BASE}/api/campaign-players/{j['id']}",
        json={"status": "expelled"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    assert r.status_code == 200
    char = requests.get(f"{BASE}/api/characters/{char_id}", headers=_h(maestro_tok), timeout=10).json()
    assert char.get("active_campaign_run_id") is None


def test_my_campaigns_view():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}MyChar")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    )
    r = requests.get(f"{BASE}/api/my/campaigns", headers=_h(p_tok), timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["status"] == "pending"
    # Player should NOT see the campaign_code in `my/campaigns`
    assert data[0]["run"]["campaign_code"] is None


def test_finish_releases_locked_characters():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Eo")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    j = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    ).json()
    requests.patch(
        f"{BASE}/api/campaign-players/{j['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )
    # Finish
    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/finish", headers=_h(maestro_tok), timeout=10
    )
    char = requests.get(f"{BASE}/api/characters/{char_id}", headers=_h(maestro_tok), timeout=10).json()
    assert char.get("active_campaign_run_id") is None


def test_player_can_leave_voluntarily():
    pid = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS)
    char_id = _create_char(pid, f"{TEST_PREFIX}Voluntary")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    run = _setup_active_run(maestro_tok)

    p_tok = _login(PLAYER_EMAIL, PLAYER_PASS)
    j = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers=_h(p_tok),
        timeout=10,
    ).json()
    requests.patch(
        f"{BASE}/api/campaign-players/{j['id']}",
        json={"status": "accepted"},
        headers=_h(maestro_tok),
        timeout=10,
    )

    r = requests.post(
        f"{BASE}/api/campaign-players/{j['id']}/leave",
        headers=_h(p_tok),
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "abandon"
    char = requests.get(f"{BASE}/api/characters/{char_id}", headers=_h(maestro_tok), timeout=10).json()
    assert char.get("active_campaign_run_id") is None
