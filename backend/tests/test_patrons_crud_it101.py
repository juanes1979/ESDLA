"""
Patrons (Mecenas) CRUD — Iteración 101.

Cubre:
  - GET /api/data/patrons (autenticado)
  - POST/PATCH/DELETE con permisos
  - Seed idempotente de los 6 mecenas canónicos
  - Compatibilidad bidireccional display_name <-> nombre, community_bonus_static <-> puntos_comunidad
"""
import asyncio
import os
import uuid

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
DJ_EMAIL = "patcrud_dj@example.com"
DJ_PASS = "abcd"
PLAYER_EMAIL = "patcrud_pl@example.com"
PLAYER_PASS = "abcd"
TEST_PREFIX = "PatTest_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.patrons.delete_many({"display_name": {"$regex": f"^{TEST_PREFIX}"}})
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
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": email, "password": password, "name": email.split("@")[0]},
        timeout=10,
    )
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users", headers={"Authorization": f"Bearer {mtok}"}, timeout=10
    ).json()
    target = next(u for u in users if u["email"] == email)
    requests.patch(
        f"{BASE}/api/auth/users/{target['id']}",
        json={"role": role, "status": "aprobado"},
        headers={"Authorization": f"Bearer {mtok}"},
        timeout=10,
    )
    return _login(email, password)


# ---------------------------------------------------------------------------
def test_seed_canonical_patrons_present():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.get(f"{BASE}/api/data/patrons", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    slugs = {p.get("slug") for p in data if p.get("slug")}
    expected = {"balin", "bilbo", "cirdan", "gandalf", "gilraen", "tom_bombadil_goldberry"}
    assert expected.issubset(slugs), f"Missing slugs: {expected - slugs}"


def test_dj_can_create_patron_jugador_cannot():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    pl = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS, "jugador")

    payload = {
        "display_name": f"{TEST_PREFIX}Bart",
        "entity_type": "Hobbit",
        "community_bonus_static": 2,
        "ability": {
            "name": "Test ability",
            "cost_value": "1",
            "trigger": "after_attack_roll_before_resolution",
            "effect": "extra_d20_choose_one",
        },
    }

    # Player cannot
    r = requests.post(
        f"{BASE}/api/data/patrons", json=payload,
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    assert r.status_code == 403, r.text

    # DJ can
    r = requests.post(
        f"{BASE}/api/data/patrons", json=payload,
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["slug"]  # auto-derived
    assert p["nombre"] == p["display_name"]  # alias filled
    assert p["puntos_comunidad"] == 2  # alias filled


def test_update_and_delete_permissions():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)

    # Create as DJ
    r = requests.post(
        f"{BASE}/api/data/patrons",
        json={"display_name": f"{TEST_PREFIX}Tmp", "community_bonus_static": 0},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    # DJ updates
    r = requests.patch(
        f"{BASE}/api/data/patrons/{pid}",
        json={"community_bonus_static": 4},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["community_bonus_static"] == 4

    # DJ cannot delete
    r = requests.delete(
        f"{BASE}/api/data/patrons/{pid}",
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 403

    # Maestro can
    r = requests.delete(
        f"{BASE}/api/data/patrons/{pid}",
        headers={"Authorization": f"Bearer {mtok}"}, timeout=10,
    )
    assert r.status_code == 200


def test_slug_unique():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    payload = {"display_name": f"{TEST_PREFIX}A", "slug": f"{TEST_PREFIX.lower()}slug1"}
    r = requests.post(
        f"{BASE}/api/data/patrons", json=payload,
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 201
    # Second with same slug
    r = requests.post(
        f"{BASE}/api/data/patrons", json={**payload, "display_name": f"{TEST_PREFIX}B"},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 400


def test_legacy_patron_returns_with_aliases():
    """The 7 legacy patrons that only have `nombre`+`puntos_comunidad` should
    still appear in GET / with `display_name` and `community_bonus_static`
    auto-filled."""
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.get(f"{BASE}/api/data/patrons", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    data = r.json()
    legacy = [p for p in data if not p.get("slug")]  # no slug = legacy seed
    if legacy:
        sample = legacy[0]
        assert sample.get("display_name"), f"display_name not auto-filled for {sample}"
        # If it has puntos_comunidad set, community_bonus_static should mirror
        if sample.get("puntos_comunidad") is not None:
            assert sample.get("community_bonus_static") == sample["puntos_comunidad"]
