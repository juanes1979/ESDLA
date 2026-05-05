"""
iter83c — Tests:
  • _calculate_initial usa _id (no id) para query characters.
  • Endpoints de jerarquía de regiones (CRUD + move + cascade).
"""
import os
import asyncio
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import pytest

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


def _async(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# ============== EYE INIT — DÚNEDAIN ==============
TEST_DUNEDAIN_ID = "test-dunedain-it83c"


@pytest.fixture
def dunedain_char():
    async def _setup():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.characters.delete_one({"_id": TEST_DUNEDAIN_ID})
        await c.characters.insert_one({
            "_id": TEST_DUNEDAIN_ID,
            "nombre": "TestMithion",
            "cultura_nombre": "Dunedain",
            "nivel": 1,
        })
    _async(_setup())
    yield
    async def _td():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.characters.delete_one({"_id": TEST_DUNEDAIN_ID})
    _async(_td())


def test_eye_init_dunedain_suma_2(dunedain_char):
    requests.post(f"{BASE}/api/eye/reset")
    r = requests.post(f"{BASE}/api/eye/init", json={
        "party_member_ids": [TEST_DUNEDAIN_ID],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"]["attention_total"] == 2
    assert body["state"]["initial_value"] == 2
    assert any("Mithion" in (d.get("concepto") or "") or "Dunedain" in (d.get("concepto") or "") or "race" in (d.get("concepto") or "").lower()
               for d in body.get("desglose", []))


# ============== JERARQUÍA DE REGIONES ==============
def _cleanup_regions():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.region_nodes.delete_many({"name": {"$regex": "^TEST-"}})
    _async(_do())


@pytest.fixture
def clean_regions():
    _cleanup_regions()
    yield
    _cleanup_regions()


def test_create_node_y_subnode(clean_regions):
    # Padre
    r = requests.post(f"{BASE}/api/regions/node", json={
        "name": "TEST-Eriador", "tipo_tierra": "tierras_libres", "dificultad": "facil",
    })
    assert r.status_code == 200
    parent_id = r.json()["id"]

    # Hijo
    r2 = requests.post(f"{BASE}/api/regions/node", json={
        "name": "TEST-Angmar", "parent_id": parent_id, "tipo_tierra": "tierras_oscuras", "dificultad": "muy_dificil",
    })
    assert r2.status_code == 200
    child_id = r2.json()["id"]
    assert r2.json()["parent_id"] == parent_id


def test_no_se_pueden_crear_duplicados(clean_regions):
    requests.post(f"{BASE}/api/regions/node", json={"name": "TEST-Dup"})
    r = requests.post(f"{BASE}/api/regions/node", json={"name": "TEST-Dup"})
    assert r.status_code == 409


def test_move_no_permite_ciclos(clean_regions):
    a = requests.post(f"{BASE}/api/regions/node", json={"name": "TEST-A"}).json()
    b = requests.post(f"{BASE}/api/regions/node", json={"name": "TEST-B", "parent_id": a["id"]}).json()
    # Intentar poner A como hijo de B (B está dentro de A) → ciclo
    r = requests.patch(f"{BASE}/api/regions/node/{a['id']}/move", json={"parent_id": b["id"]})
    assert r.status_code == 400


def test_cascade_respeta_overrides(clean_regions):
    # Padre con tierras_libres + facil
    parent = requests.post(f"{BASE}/api/regions/node", json={
        "name": "TEST-Padre", "tipo_tierra": "tierras_libres", "dificultad": "facil",
    }).json()
    # Hijo SIN override (debería heredar)
    child_a = requests.post(f"{BASE}/api/regions/node", json={
        "name": "TEST-HijoSinOverride", "parent_id": parent["id"],
    }).json()
    # Hijo CON override (no debe sobreescribirse)
    child_b = requests.post(f"{BASE}/api/regions/node", json={
        "name": "TEST-HijoConOverride", "parent_id": parent["id"],
    }).json()
    # Forzar override en child_b vía PATCH
    requests.patch(f"{BASE}/api/regions/node/{child_b['id']}", json={
        "tipo_tierra": "tierras_oscuras", "dificultad": "desalentador",
    })

    # Cascada
    r = requests.post(f"{BASE}/api/regions/node/{parent['id']}/cascade", json={
        "fields": ["tipo_tierra", "dificultad"],
        "apply_to_locations": False,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["nodes_updated"] == 1  # sólo child_a se actualiza

    # Verifica
    async def _check():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        a = await c.region_nodes.find_one({"id": child_a["id"]}, {"_id": 0})
        b = await c.region_nodes.find_one({"id": child_b["id"]}, {"_id": 0})
        return a, b
    a, b = _async(_check())
    assert a["tipo_tierra"] == "tierras_libres"  # heredado
    assert b["tipo_tierra"] == "tierras_oscuras"  # respeta su override


def test_seed_es_idempotente(clean_regions):
    r1 = requests.post(f"{BASE}/api/regions/seed-from-locations").json()
    r2 = requests.post(f"{BASE}/api/regions/seed-from-locations").json()
    # Primera puede crear N, segunda no debe crear ninguno
    assert r2["total"] == 0
