"""Tests para baúles por ubicación + arrival hook (it79).

Cubre:
- POST /api/characters/{id}/chest/store sólo si el personaje está en la ubicación
- POST /api/characters/{id}/chest/store sólo si la ubicación es refugio
- POST /api/characters/{id}/chest/retrieve sólo si está en la ubicación
- POST /api/travel/arrival actualiza ubicacion_actual
- GET  /api/characters/{id}/chests devuelve flag `accesible`
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

BREE_ID = "loc_131"          # refugio
RIVENDEL_ID = "loc_142"      # refugio


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture()
def throwaway_character(mongo_db):
    cid = f"TEST_it79_{uuid.uuid4().hex[:8]}"
    mongo_db.characters.insert_one({
        "_id": cid,
        "nombre": f"TEST_chest_{cid}",
        "jugador": "it79",
        "ubicacion_actual": None,
        "nivel": 1,
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [
            {"nombre": "Saco viejo", "cantidad": 1, "item_id": "test-saco"},
            {"nombre": "Linterna", "cantidad": 1, "item_id": "test-linterna"},
            {"nombre": "Raciones", "cantidad": 5, "item_id": "test-rac"},
        ],
        "monturas": [],
        "chests": [],
    })
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


# ---------- TRAVEL ARRIVAL ----------

def test_arrival_updates_ubicacion(throwaway_character):
    r = requests.post(
        f"{API}/travel/arrival",
        json={"character_ids": [throwaway_character], "destination_id": BREE_ID},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["success"] is True
    assert throwaway_character in j["personajes_movidos"]
    assert j["ubicacion"]["id"] == BREE_ID

    # Confirma persistencia
    g = requests.get(f"{API}/characters/{throwaway_character}", timeout=10).json()
    assert g.get("ubicacion_actual", {}).get("id") == BREE_ID


def test_arrival_fails_without_destination():
    r = requests.post(f"{API}/travel/arrival", json={"character_ids": ["x"]}, timeout=10)
    assert r.status_code == 400


# ---------- CHESTS ----------

def test_chest_store_requires_being_at_location(throwaway_character):
    # El personaje no tiene ubicación → store debe rechazar (403)
    r = requests.post(
        f"{API}/characters/{throwaway_character}/chest/store",
        json={"location_id": BREE_ID, "item_index": 0, "source": "inventario"},
        timeout=10,
    )
    assert r.status_code == 403


def test_chest_store_full_cycle(throwaway_character, mongo_db):
    # 1) llegar a Bree
    requests.post(
        f"{API}/travel/arrival",
        json={"character_ids": [throwaway_character], "destination_id": BREE_ID},
        timeout=10,
    )
    # 2) guardar el "Saco viejo"
    r = requests.post(
        f"{API}/characters/{throwaway_character}/chest/store",
        json={"location_id": BREE_ID, "item_index": 0, "source": "inventario"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["stored_item"]["nombre"] == "Saco viejo"
    assert j["character"]["chests"]
    assert j["character"]["chests"][0]["location_id"] == BREE_ID
    assert any(it["nombre"] == "Saco viejo"
               for it in j["character"]["chests"][0]["items"])
    # Inventario perdió el saco
    assert not any((i.get("nombre") or "").lower() == "saco viejo"
                   for i in j["character"]["inventario"])

    # 3) GET /chests con flag accesible=true
    g = requests.get(f"{API}/characters/{throwaway_character}/chests", timeout=10).json()
    assert g["chests"][0]["accesible"] is True

    # 4) Mover a Rivendel → baúl en Bree queda inaccesible
    requests.post(
        f"{API}/travel/arrival",
        json={"character_ids": [throwaway_character], "destination_id": RIVENDEL_ID},
        timeout=10,
    )
    g2 = requests.get(f"{API}/characters/{throwaway_character}/chests", timeout=10).json()
    assert g2["chests"][0]["accesible"] is False

    # 5) Retrieve desde Rivendel debe rechazar
    r2 = requests.post(
        f"{API}/characters/{throwaway_character}/chest/retrieve",
        json={"location_id": BREE_ID, "item_name": "Saco viejo",
              "target_carrier": "personaje"},
        timeout=10,
    )
    assert r2.status_code == 403

    # 6) Volver a Bree y retirar
    requests.post(
        f"{API}/travel/arrival",
        json={"character_ids": [throwaway_character], "destination_id": BREE_ID},
        timeout=10,
    )
    r3 = requests.post(
        f"{API}/characters/{throwaway_character}/chest/retrieve",
        json={"location_id": BREE_ID, "item_name": "Saco viejo",
              "target_carrier": "personaje"},
        timeout=10,
    )
    assert r3.status_code == 200, r3.text
    j3 = r3.json()
    assert j3["retrieved_item"]["nombre"] == "Saco viejo"
    # Baúl queda vacío y eliminado
    assert j3["character"].get("chests") in (None, [])
    # Item de vuelta en inventario
    inv_names = [(i.get("nombre") or "").lower()
                 for i in j3["character"].get("inventario", [])]
    assert "saco viejo" in inv_names


def test_chest_partial_quantity(throwaway_character):
    # Llegar al refugio
    requests.post(
        f"{API}/travel/arrival",
        json={"character_ids": [throwaway_character], "destination_id": BREE_ID},
        timeout=10,
    )
    # Guardar 2 raciones de las 5 (item_index 2 = Raciones)
    r = requests.post(
        f"{API}/characters/{throwaway_character}/chest/store",
        json={"location_id": BREE_ID, "item_index": 2, "source": "inventario", "cantidad": 2},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["stored_item"]["cantidad"] == 2
    rac_in_chest = next(it for it in j["character"]["chests"][0]["items"]
                        if it["nombre"] == "Raciones")
    assert rac_in_chest["cantidad"] == 2
    rac_in_inv = next(it for it in j["character"]["inventario"]
                      if it["nombre"] == "Raciones")
    assert rac_in_inv["cantidad"] == 3


def test_get_chests_endpoint_no_chests(throwaway_character):
    g = requests.get(f"{API}/characters/{throwaway_character}/chests", timeout=10).json()
    assert g["chests"] == []
    assert "ubicacion_actual" in g
