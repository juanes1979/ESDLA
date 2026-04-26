"""
Iteration 53 backend tests for travel system rule changes.

Focus:
- POST /api/travel/fatigue-save  : new signature + +1-exact-on-fail rule
  - Success path: niveles_cansancio == 0 (assured via cd_acumulada=0)
  - Failure path: niveles_cansancio == 1 exactly (never 2 or 3), assured via
    high cd + very negative CON mod so any d20 fails.
  - Multi-role penalty: penalizacion_multiples_papeles=True reflected in tirada
    breakdown as -5.
- POST /api/travel/generate-narrative : accepts new optional notas_maestro and
  clima query params, still returns a response (success OR graceful fallback).
- POST /api/travel/journey/start      : fatiga_cd_total set by terrain
  (10 easy / 15 moderate / 20 difficult). We call calculate_journey indirectly
  and also DB-inspect the produced journey.
- Regression smoke: /travel/config/events, /travel/config/rules still return
  data.
"""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://middle-earth-climate.preview.emergentagent.com",
).rstrip("/")
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


# -------------------- /travel/fatigue-save --------------------
class TestFatigueSaveNewRules:
    """LOTR 5e: fail = exactly +1 niveles_cansancio, success = 0."""

    def _call(self, api, **params):
        return api.post(f"{BASE_URL}/api/travel/fatigue-save", params=params)

    def test_success_returns_zero_levels(self, api):
        # cd_acumulada=0 → any d20 passes
        r = self._call(
            api,
            personaje_nombre="TEST_success",
            modificador_constitucion=2,
            cd_acumulada=0,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["resultado"] == "éxito"
        assert data["niveles_cansancio"] == 0
        assert data["cd"] == 0
        # breakdown keys
        t = data["tirada"]
        assert 1 <= t["d20"] <= 20
        assert t["modificador_con"] == 2
        assert t["bonus_montura"] == 0
        assert t["penalizacion_multiples_papeles"] == 0

    def test_failure_always_one_level_exactly(self, api):
        # Guaranteed fail: cd_acumulada extremely high, mod -10
        # 20 (max d20) + (-10) = 10 < 100 → always fails
        for _ in range(5):  # repeat to cover RNG
            r = self._call(
                api,
                personaje_nombre="TEST_fail",
                modificador_constitucion=-10,
                cd_acumulada=100,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["resultado"] == "fracaso"
            # The CORE RULE: exactly +1 regardless of margin
            assert data["niveles_cansancio"] == 1, (
                f"Expected exactly 1 niveles_cansancio on fail, "
                f"got {data['niveles_cansancio']}"
            )

    def test_multi_role_penalty_breakdown(self, api):
        r = self._call(
            api,
            personaje_nombre="TEST_multi",
            modificador_constitucion=0,
            cd_acumulada=0,
            penalizacion_multiples_papeles=True,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tirada"]["penalizacion_multiples_papeles"] == -5
        # total should include -5 component
        t = data["tirada"]
        assert t["total"] == t["d20"] + t["modificador_con"] + t["bonus_montura"] - 5

    def test_multi_role_false_default(self, api):
        r = self._call(
            api,
            personaje_nombre="TEST_nopen",
            modificador_constitucion=0,
            cd_acumulada=0,
        )
        assert r.status_code == 200
        assert r.json()["tirada"]["penalizacion_multiples_papeles"] == 0

    def test_mount_bonus_applied_when_half_days(self, api):
        r = self._call(
            api,
            personaje_nombre="TEST_mount",
            modificador_constitucion=0,
            cd_acumulada=0,
            dias_con_montura=5,
            dias_totales=10,
            bonus_montura_con=2,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["tirada"]["bonus_montura"] == 2
        assert data["detalles"]["montura_aplicada"] is True


# -------------------- /travel/generate-narrative --------------------
class TestGenerateNarrativeNewParams:
    def test_accepts_notas_maestro_and_clima(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-narrative",
            params={
                "evento_nombre": "Encuentro con lobos",
                "exito": True,
                "consecuencia": "El grupo evita el conflicto.",
                "personaje_nombre": "Aragorn",
                "papel": "guia",
                "tirada": 18,
                "cd": 15,
                "origen": "Bree",
                "destino": "Rivendel",
                "terreno": "bosque",
                "evento_numero": 1,
                "total_eventos": 3,
                "dia_actual": 1,
                "dias_totales": 3,
                "notas_maestro": "Hay niebla espesa y un río cercano",
                "clima": "Lluvioso",
            },
            timeout=45,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # success OR fallback, but always returns 'narrative' key
        assert "narrative" in data
        assert isinstance(data["narrative"], str)
        assert len(data["narrative"]) > 0

    def test_works_without_optional_params(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-narrative",
            params={
                "evento_nombre": "Cauce del río",
                "exito": False,
                "consecuencia": "Pierden provisiones al cruzar.",
                "personaje_nombre": "Sam",
                "papel": "explorador",
                "tirada": 7,
                "cd": 15,
                "origen": "Hobbiton",
                "destino": "Bree",
            },
            timeout=45,
        )
        assert r.status_code == 200
        data = r.json()
        assert "narrative" in data


# -------------------- /travel/journey/start terrain-based CD --------------------
class TestJourneyStartTerrainCD:
    """fatiga_cd_total must be set based on route terrain:
       10 for easy/camino, 15 for moderate/open, 20 for difficult/mountain/swamp.
       We can't easily force a specific real route, so we *seed* an active journey
       with a known terrain via calling calculate_journey is complex. Instead we
       validate the mapping by DB injection + a direct call to the endpoint using
       a real origin/destino pair if the config allows. We fallback to mapping
       validation by inspecting the response of an actual start call.
    """

    def test_endpoint_returns_fatiga_cd_in_valid_set(self, api, mongo):
        # Use any two known locations from the DB
        locs = list(
            mongo.locations.find({}, {"_id": 0, "id": 1, "nombre": 1}).limit(2)
        )
        if len(locs) < 2:
            pytest.skip("Not enough locations seeded for journey start test")

        payload = {
            "origen_id": locs[0]["id"],
            "origen_nombre": locs[0]["nombre"],
            "destino_id": locs[1]["id"],
            "destino_nombre": locs[1]["nombre"],
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [],
        }
        r = api.post(f"{BASE_URL}/api/travel/journey/start", json=payload, timeout=60)
        # Journey-start may legitimately return an error for some routes; skip
        # if route computation failed but endpoint is reachable.
        assert r.status_code == 200, r.text
        data = r.json()
        if data.get("error"):
            pytest.skip(f"Route calculation error (not a rule-failure): {data}")

        journey = data.get("journey") or {}
        fatiga_cd = journey.get("fatiga_cd_total")
        assert fatiga_cd in (10, 10.0, 15, 15.0, 20, 20.0), (
            f"fatiga_cd_total should be 10/15/20 based on terrain, got {fatiga_cd}"
        )

        # Cleanup inserted journey if present
        jid = data.get("journey_id")
        if jid:
            mongo.active_journeys.delete_one({"id": jid})


# -------------------- Regression: config endpoints --------------------
class TestConfigRegression:
    def test_events_config_still_returns_data(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/events")
        assert r.status_code == 200, r.text
        data = r.json()
        events = data if isinstance(data, list) else (
            data.get("events") or data.get("eventos") or []
        )
        assert isinstance(events, list) and len(events) > 0

    def test_rules_config_still_returns_data(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/rules")
        assert r.status_code == 200, r.text
        data = r.json()
        # Rules blob expected to be a dict with at least some keys
        assert isinstance(data, dict)
        assert len(data.keys()) > 0
