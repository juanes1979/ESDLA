"""Iteration 70 — Rationing system + robust move-item endpoint.

Validates:
  • TravelRulesConfig now exposes new rationing/forced-march fields with sane defaults.
  • POST/PUT /api/data/equipment-catalog/move-item is case-insensitive,
    Unicode-normalised AND tolerates a renamed item (prefix fallback).
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"


# ---------------------------- Travel Rules ----------------------------

def test_travel_rules_includes_rationing_defaults():
    res = requests.get(f"{API}/travel/config/rules", timeout=10)
    assert res.status_code == 200, res.text
    rules = res.json().get('rules', {})

    # New fatigue rule
    assert rules.get('fatigue_fail_by_less_than_5_levels') == 1

    # Rationing defaults
    assert rules.get('consumo_comida_lento') == 1.0
    assert rules.get('consumo_comida_normal') == 1.0
    assert rules.get('consumo_comida_rapido') == 1.25
    assert rules.get('consumo_agua_lento') == 2.0
    assert rules.get('consumo_agua_normal') == 2.0
    assert rules.get('consumo_agua_rapido') == 2.5

    # Forced-march modifier array (consumo only — velocity is NOT modified)
    assert rules.get('marcha_forzada_consumo_pct') == [10.0, 20.0, 35.0, 50.0]


def test_travel_rules_can_persist_rationing_overrides():
    # Get current values
    cur = requests.get(f"{API}/travel/config/rules", timeout=10).json()['rules']
    body = {**cur,
            'consumo_comida_rapido': 1.5,
            'marcha_forzada_consumo_pct': [12, 25, 40, 60]}
    body.pop('updated_at', None)  # let backend stamp

    res = requests.put(f"{API}/travel/config/rules", json=body, timeout=10)
    assert res.status_code == 200, res.text
    saved = res.json().get('rules', {})
    assert saved['consumo_comida_rapido'] == 1.5
    assert saved['marcha_forzada_consumo_pct'] == [12, 25, 40, 60]

    # Restore defaults
    requests.put(f"{API}/travel/config/rules",
                 json={**cur,
                       'consumo_comida_rapido': 1.25,
                       'marcha_forzada_consumo_pct': [10.0, 20.0, 35.0, 50.0]},
                 timeout=10)


# ---------------------------- Move-item robustness ----------------------------

@pytest.fixture
def temp_catalog_item():
    """Insert a synthetic item to move around, then clean up."""
    name = "TEST RACIONES (1 día) (Paquete de 10)"
    payload = {"categoria": "equipo_general",
               "nombre": name,
               "precio": 1.0,
               "moneda": "mp",
               "peso_kg": 0.05}
    r = requests.post(f"{API}/data/equipment", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    yield name
    # Cleanup: try in equipo_general AND consumibles (in case it was moved)
    for cat in ("equipo_general", "consumibles"):
        for n in (name, "TEST RACIONES (1 día)", "test raciones (1 día) (paquete de 10)"):
            requests.delete(f"{API}/data/equipment/{cat}/{n}", timeout=10)


def test_move_item_case_insensitive(temp_catalog_item):
    """Moving an item should work even when name is in lowercase."""
    body = {
        "from_categoria": "equipo_general",
        "to_categoria": "consumibles",
        "nombre": temp_catalog_item.lower(),  # lowercase intentionally
        "item_data": {"nombre": temp_catalog_item, "precio": 1.0, "peso_kg": 0.05},
        "replace": True,
    }
    res = requests.put(f"{API}/data/equipment-catalog/move-item", json=body, timeout=10)
    assert res.status_code == 200, res.text
    # Move it back to keep DB clean for the next test run
    body_back = {**body,
                 "from_categoria": "consumibles",
                 "to_categoria": "equipo_general"}
    requests.put(f"{API}/data/equipment-catalog/move-item", json=body_back, timeout=10)


def test_move_item_prefix_fallback(temp_catalog_item):
    """If the user renamed in the editor without saving, the original name
    has a prefix matching the new (shorter) name. Backend should still find
    it via prefix fallback."""
    short_name = "TEST RACIONES (1 día)"  # the "(Paquete de 10)" suffix was removed in the editor
    body = {
        "from_categoria": "equipo_general",
        "to_categoria": "consumibles",
        "nombre": short_name,
        "item_data": {"nombre": short_name, "precio": 1.0, "peso_kg": 0.05},
        "replace": True,
    }
    res = requests.put(f"{API}/data/equipment-catalog/move-item", json=body, timeout=10)
    assert res.status_code == 200, res.text


def test_move_item_returns_helpful_error_when_not_found():
    """If the item really doesn't exist, the error message lists candidates."""
    body = {
        "from_categoria": "equipo_general",
        "to_categoria": "consumibles",
        "nombre": "Esto-no-existe-xyz-12345",
        "item_data": {"nombre": "x"},
        "replace": True,
    }
    res = requests.put(f"{API}/data/equipment-catalog/move-item", json=body, timeout=10)
    assert res.status_code == 404
    detail = res.json().get('detail', '')
    assert 'no encontrado' in detail.lower()
    assert 'Pista' in detail or 'pista' in detail.lower()
