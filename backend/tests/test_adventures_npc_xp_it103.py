"""Iteración 103 — xp_pool y special_text por arma."""
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
DJ_EMAIL = "advd_dj@example.com"
DJ_PASS = "abcd"
PREFIX = "AdvIt103_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.adventures.delete_many({"name": {"$regex": f"^{PREFIX}"}})
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
    assert r.status_code == 200
    return r.json()["token"]


def _approved_dj():
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": DJ_EMAIL, "password": DJ_PASS, "name": "advd"},
        timeout=10,
    )
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users", headers={"Authorization": f"Bearer {mtok}"}, timeout=10
    ).json()
    target = next(u for u in users if u["email"] == DJ_EMAIL)
    requests.patch(
        f"{BASE}/api/auth/users/{target['id']}",
        json={"role": "director_de_juego", "status": "aprobado"},
        headers={"Authorization": f"Bearer {mtok}"},
        timeout=10,
    )
    return _login(DJ_EMAIL, DJ_PASS)


def test_xp_pool_persisted():
    tok = _approved_dj()
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}xp", "max_players": 4, "xp_pool": 1500},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["xp_pool"] == 1500

    # Update to null
    r = requests.patch(
        f"{BASE}/api/adventures/{a['id']}",
        json={"xp_pool": None},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 200
    # Negative not allowed
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}xp_neg", "max_players": 4, "xp_pool": -5},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 422


def test_npc_custom_stats_with_special_text_per_attack():
    tok = _approved_dj()
    npc = {
        "name": "Traca el perro guardián",
        "bestiary_categoria": "animales",
        "custom_stats": {
            "tipo": "Bestia Mediana",
            "tamanio": "Mediano",
            "clase_armadura": 13,
            "puntos_golpe": 11,
            "velocidad": 12,
            "atributos": {"fuerza": 14, "destreza": 15, "constitucion": 13, "inteligencia": 3, "sabiduria": 12, "carisma": 7},
            "armas": [
                {
                    "nombre": "Mordisco",
                    "dano": "1d6 + 2 perforante",
                    "alcance": "5 pies",
                    "special_text": "Si el objetivo es Mediano o menor, prueba TS DES CD 11 o caer derribado.",
                }
            ],
        },
    }
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}custom", "max_players": 4, "npcs": [npc]},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert len(a["npcs"]) == 1
    saved = a["npcs"][0]
    assert saved["custom_stats"]["armas"][0]["special_text"].startswith("Si el objetivo")
    assert saved["custom_stats"]["atributos"]["destreza"] == 15
