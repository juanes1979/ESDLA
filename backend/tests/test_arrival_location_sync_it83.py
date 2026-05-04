"""
iter83 — Regression test: ubicación se actualiza al terminar viaje.

Fix verificado: tras viaje en modo Global (Crónica), la ubicación del
personaje se sincroniza al destino vía `POST /api/travel/arrival`.
"""
import os
import pytest
import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

TEST_CID = "test-arrival-it83-pers"


def _setup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.characters.delete_one({"_id": TEST_CID})
        await c.characters.insert_one({
            "_id": TEST_CID,
            "nombre": "TestArrivalIt83",
            "cultura_nombre": "Hombres de Bree",
            "ubicacion_actual": {"id": "loc_131", "nombre": "Bree", "x": 35.6, "y": 71.4},
        })
    asyncio.new_event_loop().run_until_complete(_do())


def _teardown():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.characters.delete_one({"_id": TEST_CID})
    asyncio.new_event_loop().run_until_complete(_do())


def _get_char():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        return await c.characters.find_one({"_id": TEST_CID})
    return asyncio.new_event_loop().run_until_complete(_do())


@pytest.fixture(autouse=True)
def fixture_char():
    _setup()
    yield
    _teardown()


def test_arrival_actualiza_ubicacion():
    r = requests.post(f"{BASE}/api/travel/arrival", json={
        "character_ids": [TEST_CID],
        "destination_id": "loc_002",
        "destination_nombre": "Hobbiton",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert TEST_CID in body["personajes_movidos"]
    assert body["ubicacion"]["nombre"] == "Hobbiton"

    char = _get_char()
    assert char["ubicacion_actual"]["nombre"] == "Hobbiton"
    assert char["ubicacion_actual"]["x"] == 29.3


def test_arrival_destino_custom_sin_id():
    r = requests.post(f"{BASE}/api/travel/arrival", json={
        "character_ids": [TEST_CID],
        "destination_id": None,
        "destination_nombre": "Claro del Bosque",
        "destination_x": 50.0,
        "destination_y": 50.0,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ubicacion"]["nombre"] == "Claro del Bosque"
    assert body["ubicacion"]["x"] == 50.0


def test_arrival_lista_vacia_no_falla():
    r = requests.post(f"{BASE}/api/travel/arrival", json={
        "character_ids": [],
        "destination_nombre": "X",
    })
    assert r.status_code == 200
    assert r.json()["personajes_movidos"] == []


def test_arrival_destino_no_resoluble_da_400():
    r = requests.post(f"{BASE}/api/travel/arrival", json={
        "character_ids": [TEST_CID],
        "destination_id": None,
        "destination_nombre": None,
    })
    assert r.status_code == 400
