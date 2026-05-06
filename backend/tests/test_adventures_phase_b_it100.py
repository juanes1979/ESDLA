"""
Adventures Fase B (it100) — new fields regression tests.

Covers:
  - Auto-derived season from month
  - travel_route validation (max 5 stops)
  - environment.images validation (max 5)
  - travel_events list (multiple events allowed)
  - Patron auto-relationship on player accept

Runs against the LIVE backend.
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
DJ_EMAIL = "advb_dj@example.com"
DJ_PASS = "abcd"
PLAYER_EMAIL = "advb_player@example.com"
PLAYER_PASS = "abcd"
TEST_PREFIX = "AdvB_It100_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        # Find adventures and runs we created so we can delete dependants
        advs = await c.adventures.find(
            {"name": {"$regex": f"^{TEST_PREFIX}"}}
        ).to_list(100)
        adv_ids = [a["id"] for a in advs]
        await c.adventures.delete_many({"id": {"$in": adv_ids}})
        runs = await c.campaign_runs.find(
            {"adventure_id": {"$in": adv_ids}}
        ).to_list(100)
        run_ids = [r["id"] for r in runs]
        await c.campaign_runs.delete_many({"id": {"$in": run_ids}})
        await c.campaign_players.delete_many({"campaign_run_id": {"$in": run_ids}})
        await c.campaign_log.delete_many({"campaign_run_id": {"$in": run_ids}})
        await c.npc_relationships.delete_many(
            {"campaign_run_id": {"$in": run_ids}}
        )
        # Unlock characters
        chars = await c.characters.find(
            {"active_campaign_run_id": {"$in": run_ids}}
        ).to_list(200)
        for ch in chars:
            await c.characters.update_one(
                {"_id": ch["_id"]}, {"$set": {"active_campaign_run_id": None}}
            )
        # Test users
        users = await c.users.find(
            {"email": {"$in": [DJ_EMAIL, PLAYER_EMAIL]}}
        ).to_list(10)
        user_ids = [u["id"] for u in users]
        await c.characters.delete_many({"owner_id": {"$in": user_ids}})
        await c.users.delete_many({"email": {"$in": [DJ_EMAIL, PLAYER_EMAIL]}})
        # Patron NPC fixture
        await c.npcs.delete_many({"_id": {"$regex": "^advb_patron_"}})

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


def _create_adv(token, **fields):
    payload = {
        "name": fields.pop("name", f"{TEST_PREFIX}base"),
        "max_players": fields.pop("max_players", 4),
        "is_public": False,
        **fields,
    }
    r = requests.post(
        f"{BASE}/api/adventures",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# 1. Estación auto-derivada
# ---------------------------------------------------------------------------
def test_season_auto_from_month():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    a = _create_adv(dj, name=f"{TEST_PREFIX}season", month=4)
    assert a["season"] == "primavera", a
    a2 = _create_adv(dj, name=f"{TEST_PREFIX}season-w", month=12)
    assert a2["season"] == "invierno", a2
    a3 = _create_adv(dj, name=f"{TEST_PREFIX}season-summer", month=7)
    assert a3["season"] == "verano", a3


def test_season_explicit_overrides_auto():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    a = _create_adv(dj, name=f"{TEST_PREFIX}season-explicit", month=4, season="invierno")
    # Explicit takes precedence
    assert a["season"] == "invierno"


# ---------------------------------------------------------------------------
# 2. travel_route validation
# ---------------------------------------------------------------------------
def test_travel_route_max_5():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    stops = [{"location_name": f"P{i}"} for i in range(6)]
    r = requests.post(
        f"{BASE}/api/adventures",
        json={
            "name": f"{TEST_PREFIX}route",
            "max_players": 4,
            "travel_route": stops,
        },
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 422, r.text
    assert "5 paradas" in r.json()["detail"]


def test_travel_route_under_limit_ok():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    stops = [{"location_name": f"P{i}"} for i in range(5)]
    a = _create_adv(dj, name=f"{TEST_PREFIX}route-ok", travel_route=stops)
    assert len(a["travel_route"]) == 5
    # Each stop should have an auto-generated id
    assert all(s.get("id") for s in a["travel_route"])


# ---------------------------------------------------------------------------
# 3. environment.images validation
# ---------------------------------------------------------------------------
def test_environment_max_5_images():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    envs = [
        {
            "title": "Ent A",
            "description": "",
            "images": [{"file_id": f"fake{i}"} for i in range(6)],
        }
    ]
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{TEST_PREFIX}env-img", "max_players": 4, "environments": envs},
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 422, r.text


# ---------------------------------------------------------------------------
# 4. travel_events list — multiple events
# ---------------------------------------------------------------------------
def test_multiple_travel_events():
    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    events = [
        {"title": "Emboscada", "description": "Trasgos en el vado"},
        {"title": "Tormenta", "description": "Lluvia torrencial"},
        {"title": "Encuentro", "description": "Mensajero"},
    ]
    a = _create_adv(dj, name=f"{TEST_PREFIX}events", travel_events=events)
    assert len(a["travel_events"]) == 3
    assert a["travel_events"][0]["title"] == "Emboscada"


# ---------------------------------------------------------------------------
# 5. Patron auto-relationship on accept
# ---------------------------------------------------------------------------
async def _seed_patron_npc():
    c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    npc_id = f"advb_patron_{uuid.uuid4().hex[:8]}"
    await c.npcs.insert_one(
        {
            "_id": npc_id,
            "nombre": "Aragorn (test)",
            "categoria": "pnj",
            "tipo": "Humanoide Mediano",
        }
    )
    return npc_id


async def _seed_character(owner_id, owner_email):
    c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    cid = str(uuid.uuid4())
    await c.characters.insert_one(
        {
            "_id": cid,
            "id": cid,
            "nombre": "Frodo Test",
            "owner_id": owner_id,
            "owner_email": owner_email,
            "nivel": 1,
            "cultura": "hobbit",
            "active_campaign_run_id": None,
        }
    )
    return cid


def test_patron_relationship_on_accept():
    loop = asyncio.new_event_loop()
    patron_id = loop.run_until_complete(_seed_patron_npc())

    dj = _register_and_approve(DJ_EMAIL, DJ_PASS, "director_de_juego")
    player_tok = _register_and_approve(PLAYER_EMAIL, PLAYER_PASS, "jugador")

    # Get player id
    me = requests.get(
        f"{BASE}/api/auth/me",
        headers={"Authorization": f"Bearer {player_tok}"},
        timeout=10,
    ).json()
    char_id = loop.run_until_complete(_seed_character(me["id"], me["email"]))

    # Create adv with patron
    a = _create_adv(dj, name=f"{TEST_PREFIX}patron", patron_id=patron_id, patron_name="Aragorn (test)")

    # Generate run
    r = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{a['id']}",
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    run = r.json()
    assert run.get("patron_id") == patron_id

    # Activate
    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/activate",
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text

    # Player joins
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers={"Authorization": f"Bearer {player_tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    player_entry = r.json()

    # DJ accepts → relationship should be auto-created
    r = requests.patch(
        f"{BASE}/api/campaign-players/{player_entry['id']}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text

    # Verify relationship exists
    async def _check():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        rel = await c.npc_relationships.find_one(
            {"character_id": char_id, "npc_id": patron_id}
        )
        return rel

    rel = loop.run_until_complete(_check())
    assert rel is not None, "Mecenas relationship should be auto-created"
    assert rel.get("is_patron") is True
    assert rel.get("nivel") == "neutral"
    assert rel.get("campaign_run_id") == run["id"]
