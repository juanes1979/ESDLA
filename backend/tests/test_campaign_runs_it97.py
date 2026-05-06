"""
Campaign Runs (Fase 2) regression tests — generation + status machine +
content cloning + permissions.
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
DJ_EMAIL = "runtest_dj@example.com"
DJ_PASS = "abcd"
TEST_PREFIX = "RunTest_It97_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        # Find adventures + their runs
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
        ):
            if run_ids:
                await c[coll].delete_many({"campaign_run_id": {"$in": run_ids}})
        if run_ids:
            await c.campaign_runs.delete_many({"id": {"$in": run_ids}})
        if adv_ids:
            await c.adventures.delete_many({"id": {"$in": adv_ids}})
        await c.users.delete_many({"email": DJ_EMAIL})
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


def _create_adventure(tok, **extra):
    payload = {
        "name": f"{TEST_PREFIX}adv",
        "max_players": 4,
        "is_public": False,
        **extra,
    }
    r = requests.post(f"{BASE}/api/adventures", json=payload, headers=_h(tok), timeout=10)
    assert r.status_code == 201, r.text
    return r.json()


# ============================================================================
# Tests
# ============================================================================
def test_generate_run_clones_content_and_creates_code():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = _create_adventure(
        tok,
        environments=[{"title": "Bosque", "description": "Oscuro"}],
        npcs=[{"name": "Lobo Jefe"}],
        intrigues=[{"description": "Espía oculto"}],
    )
    r = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["status"] == "draft"
    assert len(run["campaign_code"]) == 8
    # No ambiguous chars in code
    assert not any(c in run["campaign_code"] for c in "0O1IL")
    assert run["adventure_id"] == adv["id"]

    # Content is cloned, not shared
    c = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/content", headers=_h(tok), timeout=10
    ).json()
    assert len(c["environments"]) == 1
    assert len(c["npcs"]) == 1
    assert len(c["intrigues"]) == 1
    # Cloned items have NEW ids
    assert c["environments"][0]["id"] != adv["environments"][0]["id"]
    assert c["environments"][0]["campaign_run_id"] == run["id"]


def test_status_machine_draft_to_finished():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = _create_adventure(tok)
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(tok),
        timeout=10,
    ).json()

    # draft → active
    r = requests.post(f"{BASE}/api/campaign-runs/{run['id']}/activate", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "active"
    assert r.json()["activated_at"]

    # active → paused
    r = requests.post(f"{BASE}/api/campaign-runs/{run['id']}/pause", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "paused"

    # paused → active (resume)
    r = requests.post(f"{BASE}/api/campaign-runs/{run['id']}/activate", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "active"

    # active → finished
    r = requests.post(f"{BASE}/api/campaign-runs/{run['id']}/finish", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "finished"
    assert r.json()["finished_at"]

    # Cannot resurrect from finished
    r = requests.post(f"{BASE}/api/campaign-runs/{run['id']}/activate", headers=_h(tok), timeout=10)
    assert r.status_code == 400


def test_invalid_transitions_rejected():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = _create_adventure(tok)
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(tok),
        timeout=10,
    ).json()

    # draft → paused (not allowed)
    r = requests.post(f"{BASE}/api/campaign-runs/{run['id']}/pause", headers=_h(tok), timeout=10)
    assert r.status_code == 400


def test_unique_codes_across_runs():
    """Generating multiple runs gives different codes."""
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = _create_adventure(tok)
    codes = set()
    for _ in range(3):
        r = requests.post(
            f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
            headers=_h(tok),
            timeout=10,
        )
        assert r.status_code == 201
        codes.add(r.json()["campaign_code"])
    assert len(codes) == 3


def test_dj_cannot_view_other_dj_run():
    """A DJ that doesn't own a run cannot GET it (403)."""
    # Register/approve a second DJ
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": DJ_EMAIL, "password": DJ_PASS, "name": "OtroDJ"},
        timeout=10,
    )
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users", headers=_h(maestro_tok), timeout=10
    ).json()
    target = next(u for u in users if u["email"] == DJ_EMAIL)
    requests.patch(
        f"{BASE}/api/auth/users/{target['id']}",
        json={"role": "director_de_juego", "status": "aprobado"},
        headers=_h(maestro_tok),
        timeout=10,
    )

    # Maestro creates an adventure + run
    adv = _create_adventure(maestro_tok)
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(maestro_tok),
        timeout=10,
    ).json()

    # Other DJ cannot view it
    dj_tok = _login(DJ_EMAIL, DJ_PASS)
    r = requests.get(f"{BASE}/api/campaign-runs/{run['id']}", headers=_h(dj_tok), timeout=10)
    assert r.status_code == 403


def test_log_records_creation_and_transitions():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = _create_adventure(tok)
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(tok),
        timeout=10,
    ).json()
    requests.post(f"{BASE}/api/campaign-runs/{run['id']}/activate", headers=_h(tok), timeout=10)
    requests.post(f"{BASE}/api/campaign-runs/{run['id']}/pause", headers=_h(tok), timeout=10)

    log = requests.get(f"{BASE}/api/campaign-runs/{run['id']}/log", headers=_h(tok), timeout=10).json()
    types = [e["event_type"] for e in log]
    assert "run_created" in types
    assert "status_active" in types
    assert "status_paused" in types


def test_delete_run_cleans_content():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = _create_adventure(
        tok,
        environments=[{"title": "X", "description": "Y"}],
    )
    run = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(tok),
        timeout=10,
    ).json()

    r = requests.delete(f"{BASE}/api/campaign-runs/{run['id']}", headers=_h(tok), timeout=10)
    assert r.status_code == 200

    # Subsequent GET → 404
    r = requests.get(f"{BASE}/api/campaign-runs/{run['id']}", headers=_h(tok), timeout=10)
    assert r.status_code == 404


def test_player_cannot_generate_run():
    """Just confirming the role gate."""
    # Register a player
    PLAYER_EMAIL_LOCAL = "runtest_player_it97@example.com"
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": PLAYER_EMAIL_LOCAL, "password": "abcd", "name": "P"},
        timeout=10,
    )
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users", headers=_h(maestro_tok), timeout=10
    ).json()
    target = next(u for u in users if u["email"] == PLAYER_EMAIL_LOCAL)
    requests.patch(
        f"{BASE}/api/auth/users/{target['id']}",
        json={"role": "jugador", "status": "aprobado"},
        headers=_h(maestro_tok),
        timeout=10,
    )

    adv = _create_adventure(maestro_tok, is_public=True)
    player_tok = _login(PLAYER_EMAIL_LOCAL, "abcd")
    r = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv['id']}",
        headers=_h(player_tok),
        timeout=10,
    )
    assert r.status_code == 403

    # cleanup user
    async def _cleanup_player():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.users.delete_many({"email": PLAYER_EMAIL_LOCAL})
    asyncio.new_event_loop().run_until_complete(_cleanup_player())
