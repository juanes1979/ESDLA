"""Tests del log de XP en historia del personaje al completar viaje (it82)."""
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
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture()
def char(mongo_db):
    cid = f"TEST_xpHistoria_{uuid.uuid4().hex[:8]}"
    mongo_db.characters.insert_one({
        "_id": cid,
        "nombre": "Folgo",
        "experiencia": 100,
        "xp": 100,
        "historia": "Folgo nació en la Comarca.",
    })
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


def test_apply_px_appends_history_entry(char, mongo_db):
    res = requests.post(
        f"{API}/travel/apply-px-individual",
        json={
            "characters": [{"character_id": char, "character_name": "Folgo", "px_amount": 50}],
            "journey_origen": "Bree",
            "journey_destino": "Rivendel",
            "anio_te": 2941,
            "journey_summary": (
                "El viaje fue largo y agotador. La lluvia caló las capas durante días. "
                "El grupo llegó cojeando pero entero a las puertas de la Última Casa Hospitalaria."
            ),
        },
        timeout=10,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert data["results"][0]["history_appended"] is True

    updated = mongo_db.characters.find_one({"_id": char})
    historia = updated.get("historia") or ""
    assert "Folgo nació en la Comarca." in historia  # se preserva la previa
    assert "En el año 2941 T.E., Folgo viajó desde Bree a Rivendel" in historia
    assert "Esto le otorgó 50px." in historia


def test_apply_px_without_origen_does_not_append(char, mongo_db):
    res = requests.post(
        f"{API}/travel/apply-px-individual",
        json={
            "characters": [{"character_id": char, "character_name": "Folgo", "px_amount": 25}],
        },
        timeout=10,
    )
    assert res.status_code == 200, res.text
    assert res.json()["results"][0].get("history_appended") in (False, None)
    updated = mongo_db.characters.find_one({"_id": char})
    assert "viajó desde" not in (updated.get("historia") or "")
    # Pero el XP sí se actualiza
    assert updated.get("experiencia") == 125
