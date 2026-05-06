"""
Iteración 77 — Bug fix: las monturas compradas en Step7 del creador
quedaban atrapadas en `inventario` en vez de promocionarse a `monturas[]`.

Tests:
1. `POST /equipment/add` con `item_category='monturas'` mete la montura en
   `monturas[]` (regresión del flujo post-creación).
2. Draft con una montura en inventario → tras `finalize`, la montura queda
   en `character.monturas[]` y fuera de `character.inventario`.
3. Draft con el legacy `montura` (virtud Poni de Bree) → tras `finalize`,
   se expone también en `monturas[]`.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://middle-earth-quest-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _insert_minimal_character(db, nombre="TestMountChar"):
    cid = str(uuid.uuid4())
    db.characters.insert_one({
        "_id": cid, "nombre": nombre,
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [], "monturas": [],
        "dinero": {"mo": 100, "mp": 0, "me": 0, "mc": 0},
        "puntos_golpe_max": 10, "puntos_golpe_actual": 10, "nivel": 1,
    })
    return cid


def _insert_minimal_draft(db, with_mount_in_inventory=False, with_legacy_mount=False):
    did = str(uuid.uuid4())
    draft = {
        "_id": did,
        "nombre": f"DraftMount-{did[:6]}",
        "cultura_id": "cultura-test", "cultura_nombre": "Test Culture",
        "trasfondo_id": "trasfondo-test", "trasfondo_nombre": "Test Trasfondo",
        "ocupacion_id": "ocupacion-test",
        "caracteristicas": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                            "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [], "dinero": {"mp": 0, "mo": 0, "me": 0, "mc": 0},
        "paso_actual": 9,
    }
    if with_mount_in_inventory:
        draft["inventario"] = [
            {"item_id": "compra-caballo", "nombre": "Caballo de caminos",
             "cantidad": 1, "categoria": "monturas"},
            {"item_id": "compra-sombrero", "nombre": "Sombrero",
             "cantidad": 1, "categoria": "equipo_general"},
        ]
    if with_legacy_mount:
        draft["montura"] = {
            "nombre": "Poni de Bree", "capacidad_carga": 101,
            "velocidad": 12, "constitucion": "11 (+0)",
        }
    db.character_drafts.insert_one(draft)
    return did


def test_equipment_add_mounts_goes_to_monturas_array(session, db):
    cid = _insert_minimal_character(db)
    try:
        r = session.post(f"{API}/characters/{cid}/equipment/add", json={
            "item_name": "Caballo de caminos",
            "item_category": "monturas",
            "cantidad": 1, "is_purchase": False,
        }, timeout=30)
        assert r.status_code == 200, r.text
        ch = r.json()["character"]
        assert len(ch.get("monturas", [])) == 1
        assert ch["monturas"][0]["nombre_original"] == "Caballo de caminos"
        for it in ch.get("inventario", []):
            assert "caballo" not in (it.get("nombre") or "").lower(), \
                "Mount should not appear in inventario"
    finally:
        db.characters.delete_one({"_id": cid})


def test_finalize_promotes_mount_from_inventory_to_monturas(session, db):
    did = _insert_minimal_draft(db, with_mount_in_inventory=True)
    created_cid = None
    try:
        r = session.post(f"{API}/characters/draft/{did}/finalize", timeout=30)
        assert r.status_code == 200, r.text
        ch = r.json()
        created_cid = ch.get("_id") or ch.get("id")
        assert len(ch.get("monturas", [])) == 1, \
            f"Expected 1 mount promoted, got {ch.get('monturas', [])}"
        assert ch["monturas"][0]["nombre_original"] == "Caballo de caminos"
        # Velocity pulled from catalog (Caballo de caminos → 14)
        assert ch["monturas"][0]["velocidad"] == 14
        inv_names = [i.get("nombre") for i in ch.get("inventario", [])]
        assert "Caballo de caminos" not in inv_names
        assert "Sombrero" in inv_names
        assert ch.get("montura", {}).get("nombre") == "Caballo de caminos"
    finally:
        if created_cid:
            db.characters.delete_one({"_id": created_cid})
        db.character_drafts.delete_one({"_id": did})


def test_finalize_promotes_legacy_montura_to_monturas_list(session, db):
    did = _insert_minimal_draft(db, with_legacy_mount=True)
    created_cid = None
    try:
        r = session.post(f"{API}/characters/draft/{did}/finalize", timeout=30)
        assert r.status_code == 200, r.text
        ch = r.json()
        created_cid = ch.get("_id") or ch.get("id")
        assert len(ch.get("monturas", [])) == 1, \
            f"Expected Poni de Bree promoted, got {ch.get('monturas', [])}"
        assert ch["monturas"][0]["nombre_original"] == "Poni de Bree"
        assert ch["monturas"][0]["capacidad_carga"] == 101
    finally:
        if created_cid:
            db.characters.delete_one({"_id": created_cid})
        db.character_drafts.delete_one({"_id": did})
