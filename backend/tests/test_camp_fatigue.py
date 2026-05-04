"""
Tests for new camp + decimal-fatigue features
- PUT /api/characters/{id}/fatigue (float body, clamp 0-6, rounds to 0.5)
- POST /api/travel/journey/{id}/camp (reduces fatiga_cd_total by 0.5, min 10)
- GET /api/travel/config/events (sanity check)
- ActiveJourney.fatiga_cd_total accepts floats (11.5, 10.5)
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tavern-chronicles-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# -------- shared fixtures --------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def test_character_id(mongo):
    """Insert a minimal character directly in DB (avoids 9-step wizard)."""
    cid = f"TEST_char_{uuid.uuid4().hex[:8]}"
    doc = {
        "_id": cid,
        "nombre": "TEST_FatigueChar",
        "estado": "activo",
        "fatiga": 0,
        "puntos_golpe_max": 10,
        "puntos_golpe_actual": 10,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo.characters.insert_one(doc)
    yield cid
    mongo.characters.delete_one({"_id": cid})


@pytest.fixture(scope="module")
def test_journey_id(mongo):
    """Insert a minimal active journey directly for camp tests."""
    jid = f"TEST_journey_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": jid,
        "config": {
            "origen_id": "test_o", "origen_nombre": "Orig",
            "destino_id": "test_d", "destino_nombre": "Dest",
            "miembros": [],
        },
        "dias": [],
        "dia_actual": 1,
        "casillas_totales": 5,
        "casillas_recorridas": 0,
        "fatiga_cd_total": 12.0,
        "dias_extra": 0,
        "dias_reducidos": 0,
        "px_acumulados": 0,
        "completado": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo.active_journeys.insert_one(doc)
    yield jid
    mongo.active_journeys.delete_one({"id": jid})


# -------- PUT /api/characters/{id}/fatigue --------
class TestCharacterFatigueFloat:

    def test_fatigue_accepts_decimal_one_point_five(self, api, test_character_id, mongo):
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": 1.5})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["fatiga"] == 1.5
        # verify persisted in DB
        ch = mongo.characters.find_one({"_id": test_character_id})
        assert ch["fatiga"] == 1.5

    def test_fatigue_accepts_zero_point_five(self, api, test_character_id):
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": 0.5})
        assert r.status_code == 200
        assert r.json()["fatiga"] == 0.5

    def test_fatigue_rounds_to_nearest_half(self, api, test_character_id):
        # 1.3 -> round(2.6)/2 = 3/2 = 1.5
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": 1.3})
        assert r.status_code == 200
        assert r.json()["fatiga"] == 1.5

        # 1.2 -> round(2.4)/2 = 2/2 = 1.0
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": 1.2})
        assert r.status_code == 200
        assert r.json()["fatiga"] == 1.0

    def test_fatigue_clamps_above_six(self, api, test_character_id):
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": 10.0})
        assert r.status_code == 200
        assert r.json()["fatiga"] == 6.0

    def test_fatigue_clamps_below_zero(self, api, test_character_id):
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": -5.0})
        assert r.status_code == 200
        assert r.json()["fatiga"] == 0.0

    def test_fatigue_accepts_integer_value(self, api, test_character_id):
        r = api.put(f"{BASE_URL}/api/characters/{test_character_id}/fatigue",
                    json={"fatiga": 3})
        assert r.status_code == 200
        assert r.json()["fatiga"] == 3.0

    def test_fatigue_character_not_found(self, api):
        r = api.put(f"{BASE_URL}/api/characters/nonexistent_id_xxx/fatigue",
                    json={"fatiga": 1.0})
        assert r.status_code == 404


# -------- POST /api/travel/journey/{id}/camp --------
class TestCampJourney:

    def _get_cd(self, mongo, jid):
        return mongo.active_journeys.find_one({"id": jid})["fatiga_cd_total"]

    def test_camp_reduces_cd_by_half(self, api, test_journey_id, mongo):
        # starts at 12.0 -> 11.5
        r = api.post(f"{BASE_URL}/api/travel/journey/{test_journey_id}/camp", json={})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["fatiga_cd_anterior"] == 12.0
        assert body["fatiga_cd_nueva"] == 11.5
        assert body["decremento_aplicado"] == 0.5
        assert self._get_cd(mongo, test_journey_id) == 11.5

    def test_camp_again_goes_to_eleven(self, api, test_journey_id, mongo):
        # 11.5 -> 11.0
        r = api.post(f"{BASE_URL}/api/travel/journey/{test_journey_id}/camp", json={})
        assert r.status_code == 200
        assert r.json()["fatiga_cd_nueva"] == 11.0

    def test_camp_does_not_go_below_ten(self, api, test_journey_id, mongo):
        # Force cd to 10.0 and camp: should stay at 10.0
        mongo.active_journeys.update_one({"id": test_journey_id},
                                         {"$set": {"fatiga_cd_total": 10.0}})
        r = api.post(f"{BASE_URL}/api/travel/journey/{test_journey_id}/camp", json={})
        assert r.status_code == 200
        body = r.json()
        assert body["fatiga_cd_anterior"] == 10.0
        assert body["fatiga_cd_nueva"] == 10.0
        assert body["decremento_aplicado"] == 0.0
        assert self._get_cd(mongo, test_journey_id) == 10.0

    def test_camp_from_10_5_clamps_at_10(self, api, test_journey_id, mongo):
        mongo.active_journeys.update_one({"id": test_journey_id},
                                         {"$set": {"fatiga_cd_total": 10.5}})
        r = api.post(f"{BASE_URL}/api/travel/journey/{test_journey_id}/camp", json={})
        assert r.status_code == 200
        assert r.json()["fatiga_cd_nueva"] == 10.0

    def test_camp_custom_decrement(self, api, test_journey_id, mongo):
        mongo.active_journeys.update_one({"id": test_journey_id},
                                         {"$set": {"fatiga_cd_total": 13.0}})
        r = api.post(f"{BASE_URL}/api/travel/journey/{test_journey_id}/camp",
                     json={"fatiga_cd_decrement": 1.0})
        assert r.status_code == 200
        body = r.json()
        assert body["fatiga_cd_anterior"] == 13.0
        assert body["fatiga_cd_nueva"] == 12.0

    def test_camp_preserves_other_journey_fields(self, api, test_journey_id, mongo):
        # Ensure other fields untouched
        before = mongo.active_journeys.find_one({"id": test_journey_id})
        casillas_before = before["casillas_totales"]
        dia_before = before["dia_actual"]
        config_before = before["config"]

        api.post(f"{BASE_URL}/api/travel/journey/{test_journey_id}/camp", json={})

        after = mongo.active_journeys.find_one({"id": test_journey_id})
        assert after["casillas_totales"] == casillas_before
        assert after["dia_actual"] == dia_before
        assert after["config"] == config_before

    def test_camp_journey_not_found(self, api):
        r = api.post(f"{BASE_URL}/api/travel/journey/nonexistent_journey/camp", json={})
        assert r.status_code == 404


# -------- GET /api/travel/config/events --------
class TestTravelEvents:

    def test_events_endpoint_returns_list(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/events")
        assert r.status_code == 200
        data = r.json()
        # May return list or dict wrapping a list
        if isinstance(data, dict):
            events = data.get("events") or data.get("eventos") or []
        else:
            events = data
        assert isinstance(events, list)
        assert len(events) > 0


# -------- ActiveJourney float CD field --------
class TestActiveJourneyFloatCD:

    def test_get_journey_returns_float_cd(self, api, mongo):
        """Create journey doc with float CD and verify endpoint returns it as-is."""
        jid = f"TEST_journey_float_{uuid.uuid4().hex[:8]}"
        doc = {
            "id": jid,
            "config": {
                "origen_id": "o", "origen_nombre": "O",
                "destino_id": "d", "destino_nombre": "D", "miembros": [],
            },
            "dias": [], "dia_actual": 1, "casillas_totales": 5,
            "casillas_recorridas": 0, "fatiga_cd_total": 11.5,
            "dias_extra": 0, "dias_reducidos": 0, "px_acumulados": 0,
            "completado": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        mongo.active_journeys.insert_one(doc)
        try:
            r = api.get(f"{BASE_URL}/api/travel/journey/{jid}")
            assert r.status_code == 200
            data = r.json()
            assert data["fatiga_cd_total"] == 11.5

            # camp should take 11.5 -> 11.0
            r2 = api.post(f"{BASE_URL}/api/travel/journey/{jid}/camp", json={})
            assert r2.status_code == 200
            assert r2.json()["fatiga_cd_nueva"] == 11.0
        finally:
            mongo.active_journeys.delete_one({"id": jid})
