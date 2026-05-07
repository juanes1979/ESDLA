"""
Iteración 102 — refinamientos:
  - presentation_text en aventura (Step Premisa)
  - travel_events[].player_notes
  - allowed_culture_ids / allowed_subcultures (Step Configuración)
  - travel_route deja de mostrarse en wizard pero el campo sigue admitido
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
DJ_EMAIL = "advc_dj@example.com"
DJ_PASS = "abcd"
PREFIX = "AdvIt102_"


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
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _approved_dj():
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": DJ_EMAIL, "password": DJ_PASS, "name": "advc"},
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


def test_presentation_text_persisted():
    tok = _approved_dj()
    text = "Hace ya cinco generaciones que las gentes del valle hablan de la luz azul…"
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}pres", "max_players": 4, "presentation_text": text},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["presentation_text"] == text
    # Round-trip via GET
    r = requests.get(
        f"{BASE}/api/adventures/{a['id']}",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.json()["presentation_text"] == text


def test_player_notes_per_event():
    tok = _approved_dj()
    events = [
        {"title": "Emboscada", "description": "Trasgos en el vado", "player_notes": "—solo si fallan la prueba de Saber"},
        {"title": "Tormenta", "description": "Lluvia torrencial", "player_notes": ""},
    ]
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}events", "max_players": 4, "travel_events": events},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert len(a["travel_events"]) == 2
    assert a["travel_events"][0]["player_notes"] == "—solo si fallan la prueba de Saber"
    assert a["travel_events"][1]["player_notes"] == ""


def test_culture_restrictions_persisted():
    tok = _approved_dj()
    r = requests.post(
        f"{BASE}/api/adventures",
        json={
            "name": f"{PREFIX}cultres",
            "max_players": 4,
            "allowed_culture_ids": ["hobbit", "dunadan"],
            "allowed_subcultures": ["hobbit::Pies Peludos"],
        },
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["allowed_culture_ids"] == ["hobbit", "dunadan"]
    assert a["allowed_subcultures"] == ["hobbit::Pies Peludos"]

    # Update — clear
    r = requests.patch(
        f"{BASE}/api/adventures/{a['id']}",
        json={"allowed_culture_ids": [], "allowed_subcultures": []},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["allowed_culture_ids"] == []
    assert r.json()["allowed_subcultures"] == []


def test_travel_route_field_still_accepted_for_legacy():
    """Aunque la UI ya no pide paradas en la aventura (se movieron al
    Generador de Viajes), el modelo sigue aceptando el campo para
    aventuras existentes — sin truncar al guardar."""
    tok = _approved_dj()
    route = [{"location_name": "Bree"}, {"location_name": "Vado de Sarn"}]
    r = requests.post(
        f"{BASE}/api/adventures",
        json={"name": f"{PREFIX}route", "max_players": 4, "travel_route": route},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert len(a["travel_route"]) == 2
