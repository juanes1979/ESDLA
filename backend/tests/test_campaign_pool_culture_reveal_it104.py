"""
Iteración 104 — XP pool, restricciones de cultura y reveal de textos.

Cubre:
  - Generación de run snapshotea xp_pool, allowed_culture_ids, allowed_subcultures, presentation_text
  - GET /api/campaign-runs/{id}/xp-stats
  - POST /api/campaign-runs/{id}/award-xp rechaza si excede el pool
  - POST /api/campaign-runs/join-by-code rechaza si la cultura no encaja
  - POST /api/campaign-runs/{id}/reveal toggle + GET /revealed para jugador y DJ
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
DJ_EMAIL = "it104_dj@example.com"
PLAYER_EMAIL = "it104_pl@example.com"
PLAYER2_EMAIL = "it104_pl2@example.com"
PASS = "abcd"
PREFIX = "It104_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        advs = await c.adventures.find({"name": {"$regex": f"^{PREFIX}"}}).to_list(50)
        adv_ids = [a["id"] for a in advs]
        runs = await c.campaign_runs.find({"adventure_id": {"$in": adv_ids}}).to_list(50)
        run_ids = [r["id"] for r in runs]
        await c.adventures.delete_many({"id": {"$in": adv_ids}})
        await c.campaign_runs.delete_many({"id": {"$in": run_ids}})
        await c.campaign_players.delete_many({"campaign_run_id": {"$in": run_ids}})
        await c.campaign_log.delete_many({"campaign_run_id": {"$in": run_ids}})
        await c.campaign_experience.delete_many({"campaign_run_id": {"$in": run_ids}})
        await c.campaign_travel_events.delete_many({"campaign_run_id": {"$in": run_ids}})
        await c.character_campaign_history.delete_many({"campaign_run_id": {"$in": run_ids}})
        # Unlock any test character
        chars = await c.characters.find({"active_campaign_run_id": {"$in": run_ids}}).to_list(50)
        for ch in chars:
            await c.characters.update_one({"_id": ch["_id"]}, {"$set": {"active_campaign_run_id": None}})
        users = await c.users.find({"email": {"$in": [DJ_EMAIL, PLAYER_EMAIL, PLAYER2_EMAIL]}}).to_list(10)
        uids = [u["id"] for u in users]
        await c.characters.delete_many({"owner_id": {"$in": uids}})
        await c.users.delete_many({"email": {"$in": [DJ_EMAIL, PLAYER_EMAIL, PLAYER2_EMAIL]}})

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


def _approved(email, role):
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": email, "password": PASS, "name": email.split("@")[0]},
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
    return _login(email, PASS), target["id"]


async def _seed_char(owner_id, owner_email, *, cultura="hobbit", subcultura=None, nombre="Frodo"):
    c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    cid = str(uuid.uuid4())
    await c.characters.insert_one({
        "_id": cid, "id": cid,
        "nombre": nombre,
        "owner_id": owner_id, "owner_email": owner_email,
        "nivel": 1,
        "cultura": cultura,
        "subcultura": subcultura,
        "active_campaign_run_id": None,
    })
    return cid


def _generate_active_run(dj_tok, adv_id):
    r = requests.post(
        f"{BASE}/api/campaign-runs/from-adventure/{adv_id}",
        headers={"Authorization": f"Bearer {dj_tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    run = r.json()
    requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/activate",
        headers={"Authorization": f"Bearer {dj_tok}"},
        timeout=10,
    )
    return run


# ---------------------------------------------------------------------------
def test_xp_pool_snapshot_and_stats():
    dj, _ = _approved(DJ_EMAIL, "director_de_juego")
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}xpA", "max_players": 4, "xp_pool": 600},
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    adv = r.json()
    run = _generate_active_run(dj, adv["id"])
    assert run.get("xp_pool") == 600

    r = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/xp-stats",
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["pool"] == 600
    assert s["used"] == 0
    assert s["remaining"] == 600


def test_award_xp_blocks_when_exceeds_pool():
    loop = asyncio.new_event_loop()
    dj, _ = _approved(DJ_EMAIL, "director_de_juego")
    pl, plid = _approved(PLAYER_EMAIL, "jugador")

    char_id = loop.run_until_complete(_seed_char(plid, PLAYER_EMAIL))

    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}xpB", "max_players": 4, "xp_pool": 100},
        headers={"Authorization": f"Bearer {dj}"},
        timeout=10,
    )
    assert r.status_code == 201
    adv = r.json()
    run = _generate_active_run(dj, adv["id"])

    # Player joins
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    assert r.status_code == 201
    pe = r.json()

    # DJ accepts
    r = requests.patch(
        f"{BASE}/api/campaign-players/{pe['id']}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 200

    # Award 80 — OK
    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 80, "reason": "test1"},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 201, r.text

    # Award 30 — would exceed (80 + 30 = 110 > 100)
    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/award-xp",
        json={"character_id": char_id, "xp_amount": 30, "reason": "test2"},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 400, r.text
    assert "Excede el bote" in r.json()["detail"]

    # Stats reflect 80 used
    r = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/xp-stats",
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    s = r.json()
    assert s["used"] == 80
    assert s["remaining"] == 20


def test_join_by_code_rejects_wrong_culture():
    loop = asyncio.new_event_loop()
    dj, _ = _approved(DJ_EMAIL, "director_de_juego")
    pl, plid = _approved(PLAYER_EMAIL, "jugador")
    pl2, pl2id = _approved(PLAYER2_EMAIL, "jugador")

    elf_id = loop.run_until_complete(_seed_char(plid, PLAYER_EMAIL, cultura="elfo", nombre="Legolas"))
    hobbit_id = loop.run_until_complete(_seed_char(pl2id, PLAYER2_EMAIL, cultura="hobbit", nombre="Bilbo"))

    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}cul", "max_players": 4, "allowed_culture_ids": ["hobbit"]},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    adv = r.json()
    run = _generate_active_run(dj, adv["id"])

    # Elf rejected
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": elf_id},
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    assert r.status_code == 403, r.text
    assert "restricciones" in r.json()["detail"]

    # Hobbit accepted
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": hobbit_id},
        headers={"Authorization": f"Bearer {pl2}"}, timeout=10,
    )
    assert r.status_code == 201, r.text


def test_reveal_text_flow():
    loop = asyncio.new_event_loop()
    dj, _ = _approved(DJ_EMAIL, "director_de_juego")
    pl, plid = _approved(PLAYER_EMAIL, "jugador")
    char_id = loop.run_until_complete(_seed_char(plid, PLAYER_EMAIL))

    pres = "Hace ya cinco generaciones que las gentes del valle hablan…"
    r = requests.post(
        f"{BASE}/api/adventures",
        json={
            "name": f"{PREFIX}rev",
            "max_players": 4,
            "presentation_text": pres,
            "travel_events": [
                {"title": "Emboscada", "description": "Trasgos", "player_notes": "Los hobbits oyen tambores"},
            ],
        },
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    adv = r.json()
    event_id = adv["travel_events"][0]["id"]

    run = _generate_active_run(dj, adv["id"])
    assert run.get("presentation_text") == pres
    # Player joins + accepted
    r = requests.post(
        f"{BASE}/api/campaign-runs/join-by-code",
        json={"code": run["campaign_code"], "character_id": char_id},
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    pe = r.json()
    requests.patch(
        f"{BASE}/api/campaign-players/{pe['id']}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )

    # Player initially sees nothing revealed
    r = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/revealed",
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["presentation_text"] is None
    assert data["events"] == []

    # DJ reveals presentation
    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/reveal",
        json={"key": "presentation", "revealed": True},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 200, r.text

    # The travel event id snapshotted in campaign_travel_events has a NEW id;
    # we need to fetch it from /content
    r = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/content",
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    content = r.json()
    assert len(content["travel_events"]) == 1
    snap_event_id = content["travel_events"][0]["id"]
    assert snap_event_id != event_id  # cloned id

    # DJ reveals event
    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/reveal",
        json={"key": f"event:{snap_event_id}", "revealed": True},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 200

    # Player now sees both
    r = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/revealed",
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    data = r.json()
    assert data["presentation_text"] == pres
    assert len(data["events"]) == 1
    assert data["events"][0]["player_notes"] == "Los hobbits oyen tambores"

    # Toggle off presentation
    r = requests.post(
        f"{BASE}/api/campaign-runs/{run['id']}/reveal",
        json={"key": "presentation", "revealed": False},
        headers={"Authorization": f"Bearer {dj}"}, timeout=10,
    )
    assert r.status_code == 200
    r = requests.get(
        f"{BASE}/api/campaign-runs/{run['id']}/revealed",
        headers={"Authorization": f"Bearer {pl}"}, timeout=10,
    )
    data = r.json()
    assert data["presentation_text"] is None
    # Event still revealed
    assert len(data["events"]) == 1
