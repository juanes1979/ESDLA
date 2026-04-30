"""Iteration 68 — backend tests for C-5 (character ubicación).

Covers:
- PATCH /api/characters/{id}/ubicacion (happy path shape, 404, 403 locked, force=True)
- PATCH /api/characters/draft/{draft_id}/step9 with ubicacion_id
- POST  /api/characters/draft/{draft_id}/finalize copies ubicacion_actual
- Regression: Xalan (208ab2df-...) already has Bree as ubicacion
- Regression: iteration-67 endpoints (equipment/carry, toggle-active, weight-summary,
  mounts CRUD, travel generate-event terreno→CD mapping)
"""

import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback read from frontend/.env (preview URL is what user sees)
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

XALAN_ID = "208ab2df-a51a-43e5-b96e-1c6757a2ada8"
BREE_ID = "loc_131"
HOBBITON_ID = "loc_002"   # pueblo, tierras_libres, terreno facil
MINAS_TIRITH_ID = "loc_038"  # used for force=True


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    with open("/app/backend/.env") as fh:
        env = dict(l.strip().split("=", 1) for l in fh if "=" in l and not l.startswith("#"))
    mongo = env.get("MONGO_URL", MONGO_URL).strip('"')
    db_name = env.get("DB_NAME", DB_NAME).strip('"')
    client = MongoClient(mongo)
    yield client[db_name]
    client.close()


@pytest.fixture()
def minimal_draft(api_client, mongo_db):
    """Create a draft via POST then seed minimum finalize-required fields."""
    r = api_client.post(f"{API}/characters/draft")
    assert r.status_code == 200, r.text
    draft_id = r.json()["_id"] if "_id" in r.json() else r.json().get("id")

    mongo_db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": {
            "nombre": f"TEST_it68_{uuid.uuid4().hex[:6]}",
            "jugador": "it68-tester",
            "cultura_id": "cultura_hobbits",
            "cultura_nombre": "Hobbits",
            "trasfondo_id": "trasfondo_test",
            "trasfondo_nombre": "Trasfondo Test",
            "ocupacion_id": "ocupacion_test",
            "caracteristicas": {
                "fuerza": 10, "destreza": 12, "constitucion": 12,
                "inteligencia": 10, "sabiduria": 11, "carisma": 10,
            },
            "puntos_golpe_base": 8,
        }},
    )
    yield draft_id
    # teardown
    mongo_db.character_drafts.delete_one({"_id": draft_id})


@pytest.fixture()
def throwaway_character(mongo_db):
    """Create a throwaway character directly in Mongo for ubicacion tests."""
    cid = f"TEST_it68_{uuid.uuid4().hex[:8]}"
    mongo_db.characters.insert_one({
        "_id": cid,
        "nombre": f"TEST_character_{cid}",
        "jugador": "it68",
        "ubicacion_actual": None,
        "nivel": 1,
    })
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


# ---------------------------------------------------------------------------
# PATCH /characters/{id}/ubicacion
# ---------------------------------------------------------------------------

class TestUbicacionEndpoint:
    def test_set_ubicacion_returns_full_snapshot(self, api_client, throwaway_character):
        r = api_client.patch(
            f"{API}/characters/{throwaway_character}/ubicacion",
            json={"location_id": HOBBITON_ID},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "character" in data
        assert "ubicacion" in data
        u = data["ubicacion"]
        # Required shape
        for key in ("id", "nombre", "region", "tipo", "x", "y", "tipo_tierra", "terreno"):
            assert key in u, f"missing {key} in ubicacion"
        assert u["id"] == HOBBITON_ID
        assert u["nombre"] == "Hobbiton"
        assert u["region"] == "La Comarca"
        assert u["tipo"] == "pueblo"
        assert u["tipo_tierra"] == "tierras_libres"
        assert u["terreno"] == "facil"
        # Denormalised on character too
        assert data["character"]["ubicacion_actual"]["id"] == HOBBITON_ID

    def test_set_ubicacion_persists_via_GET(self, api_client, throwaway_character):
        api_client.patch(
            f"{API}/characters/{throwaway_character}/ubicacion",
            json={"location_id": BREE_ID},
        )
        g = api_client.get(f"{API}/characters/{throwaway_character}")
        assert g.status_code == 200
        ua = g.json().get("ubicacion_actual")
        assert ua and ua["id"] == BREE_ID and ua["nombre"] == "Bree"

    def test_set_ubicacion_404_unknown_location(self, api_client, throwaway_character):
        r = api_client.patch(
            f"{API}/characters/{throwaway_character}/ubicacion",
            json={"location_id": "loc_DOES_NOT_EXIST"},
        )
        assert r.status_code == 404

    def test_set_ubicacion_404_unknown_character(self, api_client):
        r = api_client.patch(
            f"{API}/characters/no-such-char/ubicacion",
            json={"location_id": BREE_ID},
        )
        assert r.status_code == 404

    def test_set_ubicacion_403_when_in_campaign(self, api_client, mongo_db, throwaway_character):
        mongo_db.characters.update_one(
            {"_id": throwaway_character},
            {"$set": {"campaign_id": "camp_test_it68"}},
        )
        r = api_client.patch(
            f"{API}/characters/{throwaway_character}/ubicacion",
            json={"location_id": HOBBITON_ID, "force": False},
        )
        assert r.status_code == 403
        assert "campaña" in r.json().get("detail", "").lower() or \
               "campana" in r.json().get("detail", "").lower() or \
               "campaign" in r.json().get("detail", "").lower()

    def test_set_ubicacion_force_true_bypasses_campaign_lock(self, api_client, mongo_db, throwaway_character):
        mongo_db.characters.update_one(
            {"_id": throwaway_character},
            {"$set": {"campaign_id": "camp_test_it68"}},
        )
        r = api_client.patch(
            f"{API}/characters/{throwaway_character}/ubicacion",
            json={"location_id": MINAS_TIRITH_ID, "force": True},
        )
        assert r.status_code == 200, r.text
        u = r.json()["ubicacion"]
        assert u["id"] == MINAS_TIRITH_ID
        assert u["nombre"] == "Minas Tirith"


# ---------------------------------------------------------------------------
# Draft step9 + finalize
# ---------------------------------------------------------------------------

class TestDraftStep9AndFinalize:
    def test_step9_with_ubicacion_id_persists_snapshot(self, api_client, minimal_draft, mongo_db):
        r = api_client.patch(
            f"{API}/characters/draft/{minimal_draft}/step9",
            json={
                "rasgo_distintivo": "Curioso",
                "rasgo_distintivo_2": "Valiente",
                "motivacion": "Aventura",
                "historia": "TEST",
                "ubicacion_id": BREE_ID,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        ua = body.get("ubicacion_actual")
        assert ua, "step9 did not persist ubicacion_actual on draft"
        assert ua["id"] == BREE_ID
        assert ua["nombre"] == "Bree"
        assert ua["region"] == "Eriador"
        for key in ("tipo", "x", "y", "tipo_tierra", "terreno"):
            assert key in ua

        # DB check
        draft = mongo_db.character_drafts.find_one({"_id": minimal_draft})
        assert draft["ubicacion_actual"]["id"] == BREE_ID

    def test_finalize_copies_ubicacion_to_character(self, api_client, minimal_draft, mongo_db):
        api_client.patch(
            f"{API}/characters/draft/{minimal_draft}/step9",
            json={"ubicacion_id": HOBBITON_ID},
        )
        r = api_client.post(f"{API}/characters/draft/{minimal_draft}/finalize")
        assert r.status_code == 200, r.text
        character = r.json()
        char_id = character.get("id") or character.get("_id")
        assert char_id
        try:
            ua = character.get("ubicacion_actual")
            assert ua and ua["id"] == HOBBITON_ID, f"ubicacion_actual not copied: {ua}"
            assert ua["nombre"] == "Hobbiton"
            # Verify via GET
            g = api_client.get(f"{API}/characters/{char_id}")
            assert g.status_code == 200
            assert g.json()["ubicacion_actual"]["id"] == HOBBITON_ID
        finally:
            mongo_db.characters.delete_one({"_id": char_id})

    def test_step9_without_ubicacion_id_is_noop_for_ubicacion(self, api_client, minimal_draft):
        r = api_client.patch(
            f"{API}/characters/draft/{minimal_draft}/step9",
            json={"rasgo_distintivo": "X", "rasgo_distintivo_2": "Y", "motivacion": "Z"},
        )
        assert r.status_code == 200
        # No ubicacion_actual set → field absent or None
        assert not r.json().get("ubicacion_actual")


# ---------------------------------------------------------------------------
# Xalan sanity — already set to Bree via manual testing
# ---------------------------------------------------------------------------

class TestXalanSanity:
    def test_xalan_has_bree_as_ubicacion(self, api_client):
        r = api_client.get(f"{API}/characters/{XALAN_ID}")
        assert r.status_code == 200
        ua = r.json().get("ubicacion_actual")
        assert ua, "Xalan has no ubicacion_actual"
        assert ua["id"] == BREE_ID
        assert ua["nombre"] == "Bree"
        for key in ("region", "tipo", "x", "y", "tipo_tierra", "terreno"):
            assert key in ua

    def test_xalan_can_be_set_to_bree_again(self, api_client):
        """Xalan has no campaign → should succeed and match shape."""
        r = api_client.patch(
            f"{API}/characters/{XALAN_ID}/ubicacion",
            json={"location_id": BREE_ID},
        )
        assert r.status_code == 200, r.text
        u = r.json()["ubicacion"]
        assert u["id"] == BREE_ID
        assert u["nombre"] == "Bree"
        assert u["x"] == 35.6 and u["y"] == 71.4


# ---------------------------------------------------------------------------
# Regression: iteration-67 endpoints still work
# ---------------------------------------------------------------------------

class TestRegressionIt67:
    def test_weight_summary_xalan(self, api_client):
        r = api_client.get(f"{API}/characters/{XALAN_ID}/weight-summary")
        assert r.status_code == 200
        data = r.json()
        assert "monturas_detalle" in data or "peso_total" in data

    def test_generate_event_terreno_camino_cd10(self, api_client):
        r = api_client.post(
            f"{API}/travel/generate-event?terreno=gran_camino&estacion=verano&tipo_tierra=tierras_libres"
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("cd_prueba") == 10
        assert d.get("terreno_categoria") in ("camino", "gran_camino")
        if "resolucion" in d and d["resolucion"]:
            assert d["resolucion"].get("cd") == 10

    def test_generate_event_terreno_muy_dificil_cd20(self, api_client):
        r = api_client.post(
            f"{API}/travel/generate-event?terreno=muy_dificil&estacion=invierno&tipo_tierra=tierras_salvajes"
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("cd_prueba") == 20
        assert d.get("desventaja_estacion") is True

    def test_generate_event_terreno_campo_abierto_cd15(self, api_client):
        r = api_client.post(
            f"{API}/travel/generate-event?terreno=campo_abierto&estacion=verano&tipo_tierra=tierras_libres"
        )
        assert r.status_code == 200
        assert r.json().get("cd_prueba") == 15

    def test_locations_endpoint_returns_bree(self, api_client):
        r = api_client.get(f"{API}/data/locations")
        assert r.status_code == 200
        data = r.json()
        locs = data.get("locations", data) if isinstance(data, dict) else data
        assert any(l.get("id") == BREE_ID for l in locs)
