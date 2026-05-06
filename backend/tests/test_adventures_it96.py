"""
Adventures (Fase 1) regression tests — CRUD + permissions + clone.

Tests run against the LIVE backend using `requests`, mirroring
test_auth_it84.py conventions. Cleans up its own test data.
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
DJ_EMAIL = "advtest_dj@example.com"
DJ_PASS = "abcd"
PLAYER_EMAIL = "advtest_player@example.com"
PLAYER_PASS = "abcd"
TEST_NAME_PREFIX = "AdvTest_It96_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.adventures.delete_many({"name": {"$regex": f"^{TEST_NAME_PREFIX}"}})
        await c.users.delete_many({"email": {"$in": [DJ_EMAIL, PLAYER_EMAIL]}})
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


def _register_and_approve(email, password, role):
    """Register a new user and approve them as the given role using the maestro token."""
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": email, "password": password, "name": email.split("@")[0]},
        timeout=10,
    )
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users",
        headers={"Authorization": f"Bearer {maestro_tok}"},
        timeout=10,
    ).json()
    target = next((u for u in users if u["email"] == email), None)
    assert target, f"Just-registered user {email} not visible to maestro"
    requests.patch(
        f"{BASE}/api/auth/users/{target['id']}",
        json={"role": role, "status": "aprobado"},
        headers={"Authorization": f"Bearer {maestro_tok}"},
        timeout=10,
    )


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ============================================================================
# Tests
# ============================================================================
def test_create_minimum_payload():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}base", "max_players": 4},
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 201, r.text
    adv = r.json()
    assert adv["id"]
    assert adv["name"] == f"{TEST_NAME_PREFIX}base"
    assert adv["creator_dm_id"]
    assert adv["created_at"]


def test_validation_name_too_short():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": "ab", "max_players": 4},
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 422


def test_validation_multichar_consistency():
    """allow_multi_characters=True without max_characters_per_player → 422."""
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.post(
        f"{BASE}/api/adventures",
        json={
            "name": f"{TEST_NAME_PREFIX}multi",
            "max_players": 4,
            "allow_multi_characters": True,
        },
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 422
    assert "max_characters_per_player" in r.text


def test_patch_updates_partial_fields():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}patch", "max_players": 4},
        headers=_h(tok),
        timeout=10,
    ).json()

    r = requests.patch(
        f"{BASE}/api/adventures/{adv['id']}",
        json={"description": "New description", "year": 3019},
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["description"] == "New description"
    assert body["year"] == 3019
    assert body["name"] == adv["name"]  # untouched


def test_dj_cannot_edit_other_adventure():
    """A DJ cannot edit an adventure owned by someone else (even if public)."""
    _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    dj_tok = _login(DJ_EMAIL, DJ_PASS)

    # Maestro creates a PUBLIC adventure
    adv = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}other", "max_players": 4, "is_public": True},
        headers=_h(maestro_tok),
        timeout=10,
    ).json()

    # DJ tries to PATCH it → 403
    r = requests.patch(
        f"{BASE}/api/adventures/{adv['id']}",
        json={"description": "Hacked"},
        headers=_h(dj_tok),
        timeout=10,
    )
    assert r.status_code == 403


def test_player_cannot_create_adventure():
    _register_and_approve(PLAYER_EMAIL, PLAYER_PASS, "jugador")
    player_tok = _login(PLAYER_EMAIL, PLAYER_PASS)

    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}p", "max_players": 4},
        headers=_h(player_tok),
        timeout=10,
    )
    assert r.status_code == 403


def test_clone_public_adventure_creates_owned_copy():
    """Any DJ can clone a PUBLIC adventure into their own private copy."""
    _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    dj_tok = _login(DJ_EMAIL, DJ_PASS)

    adv = requests.post(
        f"{BASE}/api/adventures",
        json={
            "name": f"{TEST_NAME_PREFIX}original",
            "max_players": 4,
            "is_public": True,
            "description": "Original description",
            "environments": [{"title": "Bosque", "description": "Oscuro"}],
        },
        headers=_h(maestro_tok),
        timeout=10,
    ).json()

    r = requests.post(
        f"{BASE}/api/adventures/{adv['id']}/clone",
        headers=_h(dj_tok),
        timeout=10,
    )
    assert r.status_code == 201
    clone = r.json()
    assert clone["id"] != adv["id"]
    assert clone["cloned_from"] == adv["id"]
    assert clone["is_public"] is False  # clones start private
    assert clone["name"].endswith("(copia)")
    assert clone["description"] == "Original description"
    assert len(clone["environments"]) == 1
    # Cloned environment must have a NEW id
    assert clone["environments"][0]["id"] != adv["environments"][0]["id"]


def test_cannot_view_or_clone_private_other_adventure():
    """A DJ that doesn't own a PRIVATE adventure cannot view or clone it."""
    _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    dj_tok = _login(DJ_EMAIL, DJ_PASS)

    adv = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}private", "max_players": 4, "is_public": False},
        headers=_h(maestro_tok),
        timeout=10,
    ).json()

    # GET → 403
    r = requests.get(f"{BASE}/api/adventures/{adv['id']}", headers=_h(dj_tok), timeout=10)
    assert r.status_code == 403
    # CLONE → 403
    r = requests.post(
        f"{BASE}/api/adventures/{adv['id']}/clone", headers=_h(dj_tok), timeout=10
    )
    assert r.status_code == 403


def test_list_scope_filters():
    """`scope=mine` → only mine; `scope=public` → only public from any creator."""
    _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    maestro_tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    dj_tok = _login(DJ_EMAIL, DJ_PASS)

    # Maestro creates a public adventure
    pub = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}pub", "max_players": 4, "is_public": True},
        headers=_h(maestro_tok),
        timeout=10,
    ).json()
    # DJ creates their own private adventure
    mine = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}mine_dj", "max_players": 4, "is_public": False},
        headers=_h(dj_tok),
        timeout=10,
    ).json()

    # scope=mine for DJ → contains "mine_dj", NOT "pub"
    r = requests.get(
        f"{BASE}/api/adventures?scope=mine", headers=_h(dj_tok), timeout=10
    ).json()
    ids = [a["id"] for a in r]
    assert mine["id"] in ids
    assert pub["id"] not in ids

    # scope=public for DJ → contains "pub", NOT "mine_dj"
    r = requests.get(
        f"{BASE}/api/adventures?scope=public", headers=_h(dj_tok), timeout=10
    ).json()
    ids = [a["id"] for a in r]
    assert pub["id"] in ids
    assert mine["id"] not in ids


def test_delete_own_adventure():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    adv = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_NAME_PREFIX}del", "max_players": 4},
        headers=_h(tok),
        timeout=10,
    ).json()
    r = requests.delete(f"{BASE}/api/adventures/{adv['id']}", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    # GET should now 404
    r = requests.get(f"{BASE}/api/adventures/{adv['id']}", headers=_h(tok), timeout=10)
    assert r.status_code == 404
