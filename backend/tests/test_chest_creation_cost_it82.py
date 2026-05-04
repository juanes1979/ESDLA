"""Tests for chest creation cost (1 mp) — Iteración 82.

- Crear baúl cuesta 1 mp (sólo la primera vez por ubicación).
- Sin fondos suficientes → 400.
- Guardar en baúl ya existente NO vuelve a cobrar.
- Endpoint explícito chest/create cobra y rechaza duplicados.
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

BREE_ID = "loc_131"  # refugio


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture()
def char_at_bree_with_5mp(mongo_db):
    cid = f"TEST_it82_{uuid.uuid4().hex[:8]}"
    bree = mongo_db.locations.find_one({"_id": BREE_ID}) or mongo_db.locations.find_one({"id": BREE_ID})
    assert bree, "Bree (loc_131) debe existir como ubicación de test"
    mongo_db.characters.insert_one({
        "_id": cid,
        "nombre": f"TEST_chest_cost_{cid}",
        "jugador": "it82",
        "nivel": 1,
        "ubicacion_actual": {
            "id": BREE_ID,
            "nombre": bree.get("nombre", "Bree"),
            "region": bree.get("region"),
        },
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "dinero": {"mo": 0, "mp": 5, "me": 0, "mc": 0},
        "inventario": [
            {"nombre": "Capa", "cantidad": 1, "peso_kg": 1.0, "item_id": "test-capa"},
            {"nombre": "Manta", "cantidad": 1, "peso_kg": 0.5, "item_id": "test-manta"},
        ],
        "monturas": [],
        "chests": [],
    })
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


def test_first_store_creates_chest_and_charges_1mp(char_at_bree_with_5mp):
    cid = char_at_bree_with_5mp
    res = requests.post(
        f"{API}/characters/{cid}/chest/store",
        json={"location_id": BREE_ID, "item_index": 0, "source": "inventario"},
        timeout=10,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["chest_created"] is True
    assert data["creation_cost"] == "1 mp"
    char = data["character"]
    assert char["dinero"]["mp"] == 4  # 5 - 1
    assert len(char["chests"]) == 1


def test_second_store_does_not_recharge(char_at_bree_with_5mp, mongo_db):
    cid = char_at_bree_with_5mp
    # 1ª guardada (cobra)
    requests.post(
        f"{API}/characters/{cid}/chest/store",
        json={"location_id": BREE_ID, "item_index": 0, "source": "inventario"},
        timeout=10,
    )
    # 2ª guardada (no cobra)
    res = requests.post(
        f"{API}/characters/{cid}/chest/store",
        json={"location_id": BREE_ID, "item_index": 0, "source": "inventario"},
        timeout=10,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["chest_created"] is False
    assert data["creation_cost"] is None
    assert data["character"]["dinero"]["mp"] == 4


def test_insufficient_funds_blocks_creation(char_at_bree_with_5mp, mongo_db):
    cid = char_at_bree_with_5mp
    # Vaciamos el dinero
    mongo_db.characters.update_one(
        {"_id": cid},
        {"$set": {"dinero": {"mo": 0, "mp": 0, "me": 5, "mc": 0}}},  # 5 me = 0.05 mp
    )
    res = requests.post(
        f"{API}/characters/{cid}/chest/store",
        json={"location_id": BREE_ID, "item_index": 0, "source": "inventario"},
        timeout=10,
    )
    assert res.status_code == 400, res.text
    assert "Fondos insuficientes" in res.json()["detail"]


def test_explicit_create_endpoint_charges_1mp(char_at_bree_with_5mp):
    cid = char_at_bree_with_5mp
    res = requests.post(
        f"{API}/characters/{cid}/chest/create",
        json={"location_id": BREE_ID},
        timeout=10,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["chest_created"] is True
    char = data["character"]
    assert char["dinero"]["mp"] == 4
    assert len(char["chests"]) == 1
    assert char["chests"][0]["items"] == []


def test_explicit_create_duplicate_returns_409(char_at_bree_with_5mp):
    cid = char_at_bree_with_5mp
    requests.post(
        f"{API}/characters/{cid}/chest/create",
        json={"location_id": BREE_ID},
        timeout=10,
    )
    res = requests.post(
        f"{API}/characters/{cid}/chest/create",
        json={"location_id": BREE_ID},
        timeout=10,
    )
    assert res.status_code == 409, res.text
