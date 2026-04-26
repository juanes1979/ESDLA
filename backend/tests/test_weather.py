"""
Tests for the Weather Simulation endpoints (Iteración 57)
- POST /api/weather/simulate rolls a coherent day-by-day sequence
- Markov inertia: same seed → same sequence
- Region change mid-journey is honoured
- Eldarin month names accepted
- Output includes log_line, icon, temps, effects suggestions
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_weather_states(api):
    r = api.get(f"{API}/weather/states")
    assert r.status_code == 200
    states = r.json()["states"]
    ids = {s["id"] for s in states}
    assert "despejado" in ids
    assert "tormenta" in ids
    assert "nevada_fuerte" in ids


def test_simulate_basic(api):
    payload = {
        "mes": "Feb",
        "dia_inicio": 1,
        "num_dias": 5,
        "regiones_por_dia": ["La Comarca"] * 5,
        "seed": 42,
    }
    r = api.post(f"{API}/weather/simulate", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["mes"] == "Feb"
    assert len(data["dias"]) == 5
    for d in data["dias"]:
        assert d["icon"]
        assert d["estado"] in [
            "despejado", "nublado", "niebla", "calima",
            "lluvia_ligera", "lluvia_fuerte", "tormenta",
            "nevada_ligera", "nevada_fuerte", "viento_fuerte",
        ]
        assert "log_line" in d
        assert "temp_min" in d
        assert "temp_max" in d


def test_simulate_seed_reproducibility(api):
    payload = {
        "mes": "Feb",
        "num_dias": 7,
        "regiones_por_dia": ["Eriador"] * 7,
        "seed": 1234,
    }
    r1 = api.post(f"{API}/weather/simulate", json=payload).json()
    r2 = api.post(f"{API}/weather/simulate", json=payload).json()
    states1 = [d["estado"] for d in r1["dias"]]
    states2 = [d["estado"] for d in r2["dias"]]
    assert states1 == states2


def test_simulate_eldarin_month(api):
    payload = {
        "mes": "Súlimë",  # eldarin form for Feb
        "num_dias": 3,
        "regiones_por_dia": ["Eriador"] * 3,
        "seed": 1,
    }
    r = api.post(f"{API}/weather/simulate", json=payload)
    assert r.status_code == 200
    assert r.json()["mes"] == "Feb"


def test_simulate_invalid_month(api):
    r = api.post(f"{API}/weather/simulate", json={
        "mes": "XXX",
        "num_dias": 1,
        "regiones_por_dia": ["Eriador"],
    })
    assert r.status_code == 400


def test_simulate_region_change(api):
    payload = {
        "mes": "Jul",
        "num_dias": 4,
        "regiones_por_dia": ["Eriador", "Eriador", "Mordor", "Mordor"],
        "seed": 7,
    }
    r = api.post(f"{API}/weather/simulate", json=payload).json()
    assert r["dias"][0]["region"] == "Eriador"
    assert r["dias"][2]["region"] == "Mordor"
    # Mordor in Jul tends to be hot — check that climate_region was found
    assert r["dias"][2]["climate_region"] is not None


def test_simulate_continuation_with_prev_state(api):
    """Pass estado_previo to continue a chain coherently."""
    payload = {
        "mes": "Jan",  # invalid → should 400 (Jan is not valid abbrev, only Ene)
    }
    # Actually use a valid one to continue
    p = {
        "mes": "Ene",
        "num_dias": 2,
        "regiones_por_dia": ["Eriador", "Eriador"],
        "estado_previo": "tormenta",
        "seed": 100,
    }
    r = api.post(f"{API}/weather/simulate", json=p)
    assert r.status_code == 200
    # First day should NOT be despejado most of the time (inertia from tormenta)
    # We just verify it runs and produces output
    assert len(r.json()["dias"]) == 2


def test_effects_in_output(api):
    """Verify effects field is present per day."""
    payload = {
        "mes": "Ene",
        "num_dias": 5,
        "regiones_por_dia": ["FORODWAITH"] * 5,  # cold → should produce nevada
        "seed": 5,
    }
    r = api.post(f"{API}/weather/simulate", json=payload).json()
    for d in r["dias"]:
        assert "efectos" in d
        assert "fatiga_extra" in d["efectos"]
        assert "vel_modificador" in d["efectos"]
