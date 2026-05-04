"""Tests it79b — regresión de bugs encontrados por testing agent.

- complete_journey debe leer `personaje_id` (no sólo `id`) de los miembros
  para actualizar la ubicación al destino.
- equipment/remove debe eliminar también desde `escudos`.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

BREE_ID = "loc_131"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture()
def chest_test_character(mongo_db):
    cid = f"TEST_it79b_{uuid.uuid4().hex[:8]}"
    mongo_db.characters.insert_one({
        "_id": cid,
        "nombre": f"TEST_it79b_{cid}",
        "ubicacion_actual": None,
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "monturas": [], "inventario": [], "chests": [],
        "escudos": [{"nombre": "Broquel TEST", "peso_kg": 2.5}],
    })
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


def test_complete_journey_uses_personaje_id(mongo_db, chest_test_character):
    """complete_journey debe leer personaje_id (modelo TravelPartyMember real)."""
    journey_id = f"TEST_J_{uuid.uuid4().hex[:8]}"
    mongo_db.active_journeys.insert_one({
        "_id": journey_id,
        "id": journey_id,
        "config": {
            "miembros": [{"personaje_id": chest_test_character, "nombre": "T", "papel": "guia"}],
            "destino_id": BREE_ID,
            "destino_nombre": "Bree",
        },
        "completado": False,
        "dia_actual": 3,
    })
    try:
        r = requests.post(f"{API}/travel/journey/{journey_id}/complete", timeout=10)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ubicacion_actualizada") is True
        assert chest_test_character in j.get("personajes_movidos", [])

        ch = mongo_db.characters.find_one({"_id": chest_test_character})
        assert ch.get("ubicacion_actual", {}).get("id") == BREE_ID
    finally:
        mongo_db.active_journeys.delete_one({"_id": journey_id})


def test_equipment_remove_escudos(chest_test_character, mongo_db):
    """equipment/remove debe limpiar el ítem desde `escudos`."""
    r = requests.delete(
        f"{API}/characters/{chest_test_character}/equipment/remove",
        params={"item_name": "Broquel TEST", "item_category": "escudos"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "weight_summary" in body
    ch = mongo_db.characters.find_one({"_id": chest_test_character})
    assert ch.get("escudos") == []


def test_complete_journey_back_compat_id_field(mongo_db, chest_test_character):
    """Los journeys legacy con `id` en los miembros también deben funcionar."""
    journey_id = f"TEST_J2_{uuid.uuid4().hex[:8]}"
    mongo_db.active_journeys.insert_one({
        "_id": journey_id,
        "id": journey_id,
        "config": {
            "miembros": [{"id": chest_test_character, "nombre": "T", "papel": "guia"}],
            "destino_id": BREE_ID,
            "destino_nombre": "Bree",
        },
        "completado": False,
        "dia_actual": 3,
    })
    try:
        r = requests.post(f"{API}/travel/journey/{journey_id}/complete", timeout=10)
        assert r.status_code == 200
        assert chest_test_character in r.json().get("personajes_movidos", [])
    finally:
        mongo_db.active_journeys.delete_one({"_id": journey_id})
