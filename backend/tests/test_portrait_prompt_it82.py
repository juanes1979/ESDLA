"""Tests prompt_imagen_ia editable por subcultura (it82)."""
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
def cultura_test(mongo_db):
    cid = f"test_cult_{uuid.uuid4().hex[:8]}"
    mongo_db.cultures.insert_one({
        "_id": cid,
        "id": cid,
        "nombre": f"TestCultura_{cid}",
        "raza": "Hobbits",
        "descripcion": "Cultura de test",
    })
    yield cid
    mongo_db.cultures.delete_one({"_id": cid})


def test_put_culture_persists_prompt_imagen_ia(cultura_test, mongo_db):
    custom = "a hobbit of the Marish, with broad bare feet and a wide grin"
    res = requests.put(
        f"{API}/data/cultures/{cultura_test}",
        json={"prompt_imagen_ia": custom},
        timeout=10,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data.get("prompt_imagen_ia") == custom

    doc = mongo_db.cultures.find_one({"_id": cultura_test})
    assert doc.get("prompt_imagen_ia") == custom


def test_build_portrait_prompt_uses_custom_culture():
    """Unit test sin red: usa la función directa con un prompt custom."""
    import sys
    sys.path.insert(0, "/app/backend")
    from routes.portrait_routes import build_portrait_prompt, PortraitRequest

    req = PortraitRequest(
        nombre="Folgo",
        cultura="Hobbits",
        vocacion="Erudito",
        edad=33,
        color_ojos="azules",
        color_pelo="castaño rizado",
    )
    custom = "a Hobbit of the Marish with bright eyes and a knowing smile"
    prompt = build_portrait_prompt(req, custom_culture_prompt=custom)
    assert custom in prompt
    # Y NO incluye la descripción hardcoded de Hobbit
    assert "curly hair, round face, large hairy feet" not in prompt
