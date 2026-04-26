"""
Tests for the Climate System (Iteración 56)
- POST /api/climate/seed?force=true loads JSON files
- GET /api/climate/regions returns 18 regions
- GET /api/climate/regions/{id} returns single region
- PUT /api/climate/regions/{id} updates monthly fields
- PUT /api/climate/regions/{id}/months/{mes} updates a single month partially
- PUT/DELETE /api/climate/locations/{loc_id}/override field-level granularity
- GET /api/climate/effective/{loc_id} resolves base + overrides + computes icon
- GET /api/climate/icon/location/{loc_id}?mes=Ene returns icon stats
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module")
def test_location_id(mongo):
    """Insert a test location pointing to ERIADOR climate via region 'La Comarca'."""
    lid = f"loc_test_climate_{uuid.uuid4().hex[:6]}"
    doc = {
        "_id": lid,
        "id": lid,
        "nombre": "TestClimaVilla",
        "region": "La Comarca",
        "tipo": "aldea",
        "x": 100,
        "y": 100,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mongo.locations.insert_one(doc)
    yield lid
    mongo.locations.delete_one({"_id": lid})
    mongo.climate_location_overrides.delete_one({"location_id": lid})


# -------- Tests --------

def test_seed_force(api):
    r = api.post(f"{API}/climate/seed?force=true")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "seeded"
    assert data["count"] == 18


def test_months_metadata(api):
    r = api.get(f"{API}/climate/months")
    assert r.status_code == 200
    d = r.json()
    assert d["months"] == ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    assert "temp_max" in d["numeric_fields"]


def test_list_regions(api):
    r = api.get(f"{API}/climate/regions")
    assert r.status_code == 200
    regions = r.json()["regions"]
    assert len(regions) == 18
    names = {x["nombre"] for x in regions}
    assert "ERIADOR" in names
    assert "FORODWAITH" in names
    assert "ERED NIMRAIS (MONTAÑAS BLANCAS)" in names


def test_hierarchy_parent_id(api):
    """ERED NIMRAIS should have parent_id pointing to GONDOR's id."""
    regions = api.get(f"{API}/climate/regions").json()["regions"]
    by_name = {r["nombre"]: r for r in regions}
    gondor = by_name["GONDOR"]
    ered = by_name["ERED NIMRAIS (MONTAÑAS BLANCAS)"]
    assert ered["parent_id"] == gondor["id"]
    # KHAND -> HARAD
    assert by_name["KHAND"]["parent_id"] == by_name["HARAD"]["id"]


def test_get_single_region(api):
    regions = api.get(f"{API}/climate/regions").json()["regions"]
    eriador = next(r for r in regions if r["nombre"] == "ERIADOR")
    r = api.get(f"{API}/climate/regions/{eriador['id']}")
    assert r.status_code == 200
    data = r.json()
    assert "Ene" in data["meses"]
    assert data["meses"]["Ene"]["temp_max"] is not None


def test_update_region_month_partial(api):
    """PUT a single month — only specified fields update; others remain."""
    regions = api.get(f"{API}/climate/regions").json()["regions"]
    rid = next(r for r in regions if r["nombre"] == "ERIADOR")["id"]
    # Capture original temp_min for Ene
    before = api.get(f"{API}/climate/regions/{rid}").json()["meses"]["Ene"]
    orig_min = before["temp_min"]
    r = api.put(f"{API}/climate/regions/{rid}/months/Ene", json={"temp_max": 99})
    assert r.status_code == 200, r.text
    after = api.get(f"{API}/climate/regions/{rid}").json()["meses"]["Ene"]
    assert after["temp_max"] == 99
    assert after["temp_min"] == orig_min  # unchanged
    # restore
    api.put(f"{API}/climate/regions/{rid}/months/Ene", json={"temp_max": before["temp_max"]})


def test_update_region_invalid_month(api):
    rid = api.get(f"{API}/climate/regions").json()["regions"][0]["id"]
    r = api.put(f"{API}/climate/regions/{rid}/months/XXX", json={"temp_max": 1})
    assert r.status_code == 400


def test_location_override_set_get_clear(api, test_location_id):
    # set
    payload = {"overrides": {"Ene": {"temp_max": 50, "notas_extremas": "TEST"}}}
    r = api.put(f"{API}/climate/locations/{test_location_id}/override", json=payload)
    assert r.status_code == 200, r.text
    # get
    r = api.get(f"{API}/climate/locations/{test_location_id}/override")
    assert r.status_code == 200
    d = r.json()
    assert d["exists"] is True
    assert d["overrides"]["Ene"]["temp_max"] == 50
    # clear single field
    r = api.delete(f"{API}/climate/locations/{test_location_id}/override/Ene/temp_max")
    assert r.status_code == 200
    after = api.get(f"{API}/climate/locations/{test_location_id}/override").json()
    assert "temp_max" not in (after["overrides"].get("Ene") or {})
    # clear all
    api.delete(f"{API}/climate/locations/{test_location_id}/override")
    after = api.get(f"{API}/climate/locations/{test_location_id}/override").json()
    assert after["exists"] is False


def test_effective_resolution(api, test_location_id):
    """Location 'La Comarca' should resolve to ERIADOR climate."""
    r = api.get(f"{API}/climate/effective/{test_location_id}?mes=Ene")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["climate_region"]["nombre"] == "ERIADOR"
    cm = d["clima_mes"]
    assert "_icon" in cm
    assert cm["_icon"]["icon"]
    assert cm["temp_min"] is not None


def test_effective_with_override(api, test_location_id):
    api.put(f"{API}/climate/locations/{test_location_id}/override",
            json={"overrides": {"Feb": {"temp_max": 99}}})
    r = api.get(f"{API}/climate/effective/{test_location_id}")
    d = r.json()
    feb = d["effective"]["Feb"]
    assert feb["temp_max"] == 99
    assert "temp_max" in feb["_overridden_fields"]
    api.delete(f"{API}/climate/locations/{test_location_id}/override")


def test_icon_endpoint(api, test_location_id):
    r = api.get(f"{API}/climate/icon/location/{test_location_id}?mes=Ene")
    assert r.status_code == 200
    d = r.json()
    assert d["icon"]
    assert d["label"]
    assert d["climate_region"] == "Eriador"  # display name


def test_icon_dominant_per_month(api, test_location_id):
    """In Eriador, Cermië (July) should yield 'Despejado' as dominant weather."""
    r = api.get(f"{API}/climate/icon/location/{test_location_id}?mes=Cermi%C3%AB")
    assert r.status_code == 200
    d = r.json()
    # July in Eriador shouldn't be a snow/storm month
    assert d["label"] not in ("Nieve", "Tormenta")


def test_icon_deterministic_same_request(api, test_location_id):
    """Same request always yields the same icon."""
    r1 = api.get(f"{API}/climate/icon/location/{test_location_id}?mes=Cermi%C3%AB&dia=5").json()
    r2 = api.get(f"{API}/climate/icon/location/{test_location_id}?mes=Cermi%C3%AB&dia=5").json()
    assert r1["icon"] == r2["icon"]
    assert r1["label"] == r2["label"]


def test_icon_invalid_month(api, test_location_id):
    r = api.get(f"{API}/climate/icon/location/{test_location_id}?mes=XXX")
    assert r.status_code == 400


def test_seed_idempotent_without_force(api):
    """Without force, seed should skip if already seeded."""
    r = api.post(f"{API}/climate/seed")
    assert r.status_code == 200
    assert r.json()["status"] == "skipped"


def test_create_and_delete_custom_region(api):
    payload = {
        "nombre": "TEST_CUSTOM_CLIM",
        "nombre_display": "Test Clima",
        "match_keywords": ["test"],
        "meses": {"Ene": {"temp_min": 0, "temp_max": 5, "pct_lluvia": 50}},
    }
    r = api.post(f"{API}/climate/regions", json=payload)
    assert r.status_code == 200
    rid = r.json()["id"]
    # delete should succeed (not seeded)
    r = api.delete(f"{API}/climate/regions/{rid}")
    assert r.status_code == 200


def test_cannot_delete_seeded_region(api):
    regions = api.get(f"{API}/climate/regions").json()["regions"]
    seeded = next(r for r in regions if r.get("is_seeded"))
    r = api.delete(f"{API}/climate/regions/{seeded['id']}")
    assert r.status_code == 403
