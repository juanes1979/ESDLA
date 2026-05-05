"""
iter83e — Tests del nuevo flujo "pendientes + guardar" en jerarquía.

Verifica que el endpoint /move sigue siendo el mismo (el nuevo flujo
en frontend acumula varias movidas y las dispara al pulsar Guardar,
pero a nivel API es el mismo PATCH de siempre).
"""
import os
import requests
import asyncio
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


def _async(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.region_nodes.delete_many({"name": {"$regex": "^TESTPEND-"}})
    _async(_do())


@pytest.fixture
def clean():
    _cleanup()
    yield
    _cleanup()


def test_batch_de_3_moves_ok(clean):
    """Simula que el frontend hace 3 PATCHes seguidos (al pulsar "Guardar")."""
    a = requests.post(f"{BASE}/api/regions/node", json={"name": "TESTPEND-A"}).json()
    b = requests.post(f"{BASE}/api/regions/node", json={"name": "TESTPEND-B"}).json()
    c = requests.post(f"{BASE}/api/regions/node", json={"name": "TESTPEND-C"}).json()

    # Mover B → A, C → B
    r1 = requests.patch(f"{BASE}/api/regions/node/{b['id']}/move", json={"parent_id": a["id"]})
    r2 = requests.patch(f"{BASE}/api/regions/node/{c['id']}/move", json={"parent_id": b["id"]})
    assert r1.status_code == 200
    assert r2.status_code == 200

    # Verifica jerarquía
    tree = requests.get(f"{BASE}/api/regions/tree").json()["tree"]
    a_node = next(n for n in tree if n["name"] == "TESTPEND-A")
    assert len(a_node["children"]) == 1
    assert a_node["children"][0]["name"] == "TESTPEND-B"
    assert len(a_node["children"][0]["children"]) == 1
    assert a_node["children"][0]["children"][0]["name"] == "TESTPEND-C"


def test_move_a_root_setea_parent_null(clean):
    parent = requests.post(f"{BASE}/api/regions/node", json={"name": "TESTPEND-P"}).json()
    child = requests.post(f"{BASE}/api/regions/node", json={"name": "TESTPEND-Hijo", "parent_id": parent["id"]}).json()

    # Mover hijo a raíz
    r = requests.patch(f"{BASE}/api/regions/node/{child['id']}/move", json={"parent_id": None})
    assert r.status_code == 200
    assert r.json()["parent_id"] is None
