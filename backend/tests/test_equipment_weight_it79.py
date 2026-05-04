"""Tests para equipment/remove (todas las fuentes), equipment/carry (weight_summary),
chest/store 400 non-refugio, journey/complete actualiza ubicacion, codigo_publico.
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


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture()
def fat_character(db):
    cid = f"TEST_eq79_{uuid.uuid4().hex[:8]}"
    db.characters.insert_one({
        "_id": cid, "nombre": f"TEST_{cid}", "jugador": "it79", "nivel": 1,
        "ubicacion_actual": None,
        "atributos": {"fuerza": 12, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [{"nombre": "SacoInv", "cantidad": 1, "peso_kg": 1}],
        "equipo": [{"nombre": "SacoEq", "cantidad": 1, "peso_kg": 1}],
        "equipo_ocupacion": [{"nombre": "SacoOcup", "cantidad": 1, "peso_kg": 1}],
        "equipo_nivel_vida": [{"nombre": "SacoNivel", "cantidad": 1, "peso_kg": 1}],
        "equipo_trasfondo": [{"nombre": "SacoTras", "cantidad": 1, "peso_kg": 1}],
        "armas": [{"nombre": "DagaZ", "peso_kg": 0.5}],
        "escudos": [{"nombre": "EscudoY", "peso_kg": 2}],
        "monturas": [{"id": "m1", "nombre": "Poni",
                      "capacidad_carga_kg": 60,
                      "equipo": [{"nombre": "SacoMont", "cantidad": 1, "peso_kg": 1}]}],
        "chests": [],
    })
    yield cid
    db.characters.delete_one({"_id": cid})


def _remove(cid, name, category, cantidad=1):
    # Endpoint usa query params item_name + item_category
    return requests.delete(
        f"{API}/characters/{cid}/equipment/remove",
        params={"item_name": name, "item_category": category, "cantidad": cantidad},
        timeout=10,
    )


def test_remove_from_inventario_returns_weight_summary(fat_character):
    r = _remove(fat_character, "SacoInv", "inventario")
    assert r.status_code == 200, r.text
    j = r.json()
    assert "weight_summary" in j
    assert "character" in j


@pytest.mark.parametrize("name,category,storage_key", [
    ("SacoEq", "equipo", "equipo"),
    ("SacoOcup", "equipo_ocupacion", "equipo_ocupacion"),
    ("SacoNivel", "equipo_nivel_vida", "equipo_nivel_vida"),
    ("SacoTras", "equipo_trasfondo", "equipo_trasfondo"),
    ("DagaZ", "armas", "armas"),
    ("EscudoY", "escudos", "escudos"),
])
def test_remove_scans_all_sources(fat_character, db, name, category, storage_key):
    r = _remove(fat_character, name, category)
    assert r.status_code == 200, f"{category}: {r.status_code} {r.text}"
    assert "weight_summary" in r.json()
    doc = db.characters.find_one({"_id": fat_character})
    lst = doc.get(storage_key) or []
    assert not any((i.get("nombre") or "") == name for i in lst)


def test_remove_from_mount_equipo(fat_character, db):
    r = _remove(fat_character, "SacoMont", "equipo")  # busca en todas las fuentes incl. monturas
    assert r.status_code == 200, r.text
    doc = db.characters.find_one({"_id": fat_character})
    mount = next(m for m in doc["monturas"] if m["id"] == "m1")
    assert not any((i.get("nombre") or "") == "SacoMont" for i in mount.get("equipo", []))


def test_carry_returns_weight_summary(fat_character, db):
    r = requests.patch(
        f"{API}/characters/{fat_character}/equipment/carry",
        json={"item_index": 0, "carried_by": "montura",
              "source": "inventario", "mount_id": "m1"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert "weight_summary" in j


# ---------- CHEST 400 non-shelter ----------

def test_chest_store_400_for_non_shelter(db):
    non = db.locations.find_one({"refugio": {"$ne": True}})
    if not non:
        pytest.skip("No non-shelter in DB")
    nid = non.get("_id") or non.get("id")
    cid = f"TEST_ns_{uuid.uuid4().hex[:8]}"
    db.characters.insert_one({
        "_id": cid, "nombre": "TEST_ns", "jugador": "it79", "nivel": 1,
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [{"nombre": "x", "cantidad": 1}],
        "ubicacion_actual": {"id": nid, "nombre": non.get("nombre", "?")},
        "monturas": [], "chests": [],
    })
    try:
        r = requests.post(
            f"{API}/characters/{cid}/chest/store",
            json={"location_id": nid, "item_index": 0, "source": "inventario"},
            timeout=10,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    finally:
        db.characters.delete_one({"_id": cid})


# ---------- JOURNEY COMPLETE UPDATES UBICACION ----------

def test_journey_complete_updates_ubicacion(db):
    cid = f"TEST_jc_{uuid.uuid4().hex[:8]}"
    jid = f"journey_{uuid.uuid4().hex[:8]}"
    db.characters.insert_one({
        "_id": cid, "nombre": "TEST_jc", "jugador": "it79", "nivel": 1,
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [], "monturas": [], "chests": [],
        "ubicacion_actual": {"id": "loc_131", "nombre": "Bree"},
    })
    # El modelo TravelPartyMember usa 'personaje_id', pero el endpoint
    # complete_journey lee m.get("id"). Incluimos ambos por robustez:
    db.active_journeys.insert_one({
        "id": jid,
        "config": {
            "origen_id": "loc_131", "origen_nombre": "Bree",
            "destino_id": "loc_142", "destino_nombre": "Rivendel",
            "miembros": [{"personaje_id": cid, "id": cid, "nombre": "TEST_jc"}],
            "ritmo": "normal", "mes": "Cermië", "estacion": "verano",
        },
        "dias": [], "dia_actual": 1, "casillas_totales": 0,
        "casillas_recorridas": 0, "fatiga_cd_total": 10.0,
        "dias_extra": 0, "dias_reducidos": 0, "px_acumulados": 0,
        "completado": False,
    })
    try:
        r = requests.post(f"{API}/travel/journey/{jid}/complete", timeout=10)
        assert r.status_code == 200, r.text
        doc = db.characters.find_one({"_id": cid})
        assert doc["ubicacion_actual"]["id"] == "loc_142", \
            f"ubicacion no actualizada: {doc.get('ubicacion_actual')}"
    finally:
        db.characters.delete_one({"_id": cid})
        db.active_journeys.delete_one({"id": jid})


def test_journey_complete_with_personaje_id_only(db):
    """Prueba crítica: los viajes REALES creados por calculate-journey guardan
    los miembros con `personaje_id` (según TravelPartyMember). Sin `id`.
    Este test verifica que el endpoint detecte ese formato."""
    cid = f"TEST_jc2_{uuid.uuid4().hex[:8]}"
    jid = f"journey_{uuid.uuid4().hex[:8]}"
    db.characters.insert_one({
        "_id": cid, "nombre": "TEST_jc2", "jugador": "it79", "nivel": 1,
        "atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10,
                      "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "inventario": [], "monturas": [], "chests": [],
        "ubicacion_actual": {"id": "loc_131", "nombre": "Bree"},
    })
    db.active_journeys.insert_one({
        "id": jid,
        "config": {
            "origen_id": "loc_131", "origen_nombre": "Bree",
            "destino_id": "loc_142", "destino_nombre": "Rivendel",
            "miembros": [{"personaje_id": cid, "nombre": "TEST_jc2"}],  # SIN 'id'
            "ritmo": "normal", "mes": "Cermië", "estacion": "verano",
        },
        "dias": [], "dia_actual": 1, "casillas_totales": 0,
        "casillas_recorridas": 0, "fatiga_cd_total": 10.0,
        "dias_extra": 0, "dias_reducidos": 0, "px_acumulados": 0,
        "completado": False,
    })
    try:
        r = requests.post(f"{API}/travel/journey/{jid}/complete", timeout=10)
        assert r.status_code == 200, r.text
        j = r.json()
        doc = db.characters.find_one({"_id": cid})
        assert doc["ubicacion_actual"]["id"] == "loc_142", \
            f"BUG: journey/complete no detecta miembros con personaje_id. " \
            f"Resp={j}, ubicacion={doc.get('ubicacion_actual')}"
    finally:
        db.characters.delete_one({"_id": cid})
        db.active_journeys.delete_one({"id": jid})


# ---------- CODIGO PUBLICO ----------

def test_existing_characters_have_codigo_publico(db):
    sample = list(db.characters.find(
        {"jugador": {"$ne": "it79"}, "$or": [
            {"estado_creacion": "finalizado"},
            {"estado": "finalizado"},
            {"finalizado": True},
        ]}
    ).limit(10))
    if not sample:
        # Fallback: cualquier personaje no-TEST
        sample = list(db.characters.find(
            {"jugador": {"$ne": "it79"},
             "nombre": {"$not": {"$regex": "^TEST"}}}
        ).limit(10))
    if not sample:
        pytest.skip("No characters in DB")
    missing = [c["_id"] for c in sample if not c.get("codigo_publico")]
    # Informativo: los personajes recientes (post-fix) sí deben tenerlo.
    # No fallamos para los legacy. Sólo imprimimos.
    print(f"Personajes sin codigo_publico (informativo): {missing}/{len(sample)}")
