"""
iter83f — Tests del nuevo endpoint PATCH /data/regions/{id}/move.
"""
import os
import requests
import pytest
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


def _async(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _setup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.regions.delete_many({"_id": {"$regex": "^regtest-"}})
        await c.regions.insert_many([
            {"_id": "regtest-A", "id": "regtest-A", "nombre": "TestA", "parent_id": None},
            {"_id": "regtest-B", "id": "regtest-B", "nombre": "TestB", "parent_id": None},
            {"_id": "regtest-C", "id": "regtest-C", "nombre": "TestC", "parent_id": None},
        ])
    _async(_do())


def _teardown():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.regions.delete_many({"_id": {"$regex": "^regtest-"}})
    _async(_do())


@pytest.fixture
def regs():
    _setup()
    yield
    _teardown()


def test_move_a_un_padre(regs):
    r = requests.patch(f"{BASE}/api/data/regions/regtest-B/move",
                       json={"parent_id": "regtest-A"})
    assert r.status_code == 200
    assert r.json()["parent_id"] == "regtest-A"


def test_move_a_raiz_acepta_null(regs):
    # Primero pone B bajo A
    requests.patch(f"{BASE}/api/data/regions/regtest-B/move", json={"parent_id": "regtest-A"})
    # Ahora vuelve B a raíz
    r = requests.patch(f"{BASE}/api/data/regions/regtest-B/move", json={"parent_id": None})
    assert r.status_code == 200
    assert r.json()["parent_id"] is None


def test_move_evita_ciclo(regs):
    # B → A. Ahora intentar A → B crearía ciclo
    requests.patch(f"{BASE}/api/data/regions/regtest-B/move", json={"parent_id": "regtest-A"})
    r = requests.patch(f"{BASE}/api/data/regions/regtest-A/move", json={"parent_id": "regtest-B"})
    assert r.status_code == 400


def test_move_no_se_puede_padre_de_si_mismo(regs):
    r = requests.patch(f"{BASE}/api/data/regions/regtest-A/move", json={"parent_id": "regtest-A"})
    assert r.status_code == 400


def test_move_a_padre_inexistente_da_404(regs):
    r = requests.patch(f"{BASE}/api/data/regions/regtest-A/move", json={"parent_id": "no-existe-xyz"})
    assert r.status_code == 404
