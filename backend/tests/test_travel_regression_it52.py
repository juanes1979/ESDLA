"""
Iteration 52 backend regression tests for travel system.
Verifies no regression in:
- GET  /api/travel/config/events
- POST /api/travel/orientation-check
- POST /api/travel/generate-event
- POST /api/travel/journey/{id}/camp (smoke, full suite in test_camp_fatigue.py)
- PUT  /api/characters/{id}/fatigue (smoke, full suite in test_camp_fatigue.py)
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://travel-chronicles-6.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    return MongoClient(MONGO_URL)[DB_NAME]


# --------- GET /api/travel/config/events ---------
class TestTravelEventsConfig:
    def test_events_endpoint_ok(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/events")
        assert r.status_code == 200, r.text
        data = r.json()
        events = data if isinstance(data, list) else (data.get("events") or data.get("eventos") or [])
        assert isinstance(events, list)
        assert len(events) >= 5  # default table has several events

    def test_event_structure(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/events")
        data = r.json()
        events = data if isinstance(data, list) else (data.get("events") or data.get("eventos") or [])
        first = events[0]
        # Expected keys based on models: id, d20_min, d20_max, nombre, ...
        assert "id" in first
        assert "d20_min" in first and "d20_max" in first
        assert "nombre" in first


# --------- POST /api/travel/orientation-check ---------
class TestOrientationCheck:
    def test_basic_roll(self, api):
        r = api.post(f"{BASE_URL}/api/travel/orientation-check",
                     json={"modificador_sabiduria": 2})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "d20" in data and 1 <= data["d20"] <= 20
        assert "modificador" in data
        assert "total" in data
        assert data["total"] == data["d20"] + data["modificador"]
        assert "cd" in data and data["cd"] == 15
        assert "exito" in data
        assert "casillas_hasta_evento" in data
        assert data["casillas_hasta_evento"] in [1, 2, 3, 4]
        assert "detalle" in data

    def test_with_competencia_viajar(self, api):
        r = api.post(f"{BASE_URL}/api/travel/orientation-check",
                     json={"modificador_sabiduria": 3,
                           "competencia_viajar": True,
                           "bonus_competencia": 2})
        assert r.status_code == 200
        data = r.json()
        # modifier should be at least sab (3) + comp (2) = 5
        assert data["modificador"] >= 5

    def test_penalty_multiples_papeles(self, api):
        r = api.post(f"{BASE_URL}/api/travel/orientation-check",
                     json={"modificador_sabiduria": 0,
                           "penalizacion_multiples_papeles": True})
        assert r.status_code == 200
        data = r.json()
        assert data["modificador"] == -5

    def test_journey_complete_when_casillas_small(self, api):
        r = api.post(f"{BASE_URL}/api/travel/orientation-check?casillas_restantes=1",
                     json={"modificador_sabiduria": 10})
        assert r.status_code == 200
        data = r.json()
        # with mod +10, casillas_hasta_evento >= 1 always, so viaje_completado should be True
        assert data["viaje_completado"] is True


# --------- POST /api/travel/generate-event ---------
class TestGenerateEvent:
    def test_generate_event_default(self, api):
        r = api.post(f"{BASE_URL}/api/travel/generate-event")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "tiradas" in data
        assert "d20" in data["tiradas"]
        assert 1 <= data["tiradas"]["d20"] <= 20
        assert "evento" in data
        assert "id" in data["evento"] and "nombre" in data["evento"]

    def test_generate_event_with_terrain(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-event"
            "?tipo_tierra=tierras_salvajes&terreno=campo_abierto&estacion=verano"
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True

    def test_generate_event_winter_season(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-event"
            "?tipo_tierra=tierras_salvajes&terreno=bosque&estacion=invierno"
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True


# --------- Smoke: camp + fatigue ---------
class TestCampAndFatigueSmoke:
    def test_camp_smoke(self, api, mongo):
        jid = f"TEST_it52_journey_{uuid.uuid4().hex[:8]}"
        doc = {
            "id": jid,
            "config": {"origen_id": "o", "origen_nombre": "O",
                       "destino_id": "d", "destino_nombre": "D", "miembros": []},
            "dias": [], "dia_actual": 1, "casillas_totales": 5,
            "casillas_recorridas": 0, "fatiga_cd_total": 12.0,
            "dias_extra": 0, "dias_reducidos": 0, "px_acumulados": 0,
            "completado": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        mongo.active_journeys.insert_one(doc)
        try:
            r = api.post(f"{BASE_URL}/api/travel/journey/{jid}/camp", json={})
            assert r.status_code == 200
            assert r.json()["fatiga_cd_nueva"] == 11.5
        finally:
            mongo.active_journeys.delete_one({"id": jid})

    def test_character_fatigue_float_smoke(self, api, mongo):
        cid = f"TEST_it52_char_{uuid.uuid4().hex[:8]}"
        mongo.characters.insert_one({
            "_id": cid, "nombre": "TEST_regression",
            "estado": "activo", "fatiga": 0,
            "puntos_golpe_max": 10, "puntos_golpe_actual": 10,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            r = api.put(f"{BASE_URL}/api/characters/{cid}/fatigue", json={"fatiga": 2.5})
            assert r.status_code == 200
            assert r.json()["fatiga"] == 2.5
        finally:
            mongo.characters.delete_one({"_id": cid})
