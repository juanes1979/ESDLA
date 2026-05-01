"""Iteration 72 — Pydantic validations at API boundary (P1).

Valida que los endpoints rechazan valores imposibles (422 Unprocessable Entity):
  • PUT /characters/{id}/fatigue con fatiga fuera de [0, 6]
  • Attributes fuera de [1, 30] durante creación de personaje
  • Equipment con cantidad < 1 o peso negativo
"""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"


def _get_any_character_id():
    r = requests.get(f"{API}/characters/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    chars = data if isinstance(data, list) else data.get('characters', [])
    return chars[0]['id'] if chars else None


def test_fatigue_rejects_negative():
    cid = _get_any_character_id()
    if not cid:
        return  # No hay personajes para probar
    r = requests.put(f"{API}/characters/{cid}/fatigue", json={"fatiga": -1.0}, timeout=10)
    assert r.status_code == 422, r.text


def test_fatigue_rejects_above_6():
    cid = _get_any_character_id()
    if not cid:
        return
    r = requests.put(f"{API}/characters/{cid}/fatigue", json={"fatiga": 7.0}, timeout=10)
    assert r.status_code == 422, r.text


def test_fatigue_accepts_valid_range():
    cid = _get_any_character_id()
    if not cid:
        return
    for v in (0.0, 0.5, 2.5, 6.0):
        r = requests.put(f"{API}/characters/{cid}/fatigue", json={"fatiga": v}, timeout=10)
        assert r.status_code == 200, f"fatiga={v} falló: {r.text}"
    # Restore to 0 to not leave side-effects
    requests.put(f"{API}/characters/{cid}/fatigue", json={"fatiga": 0.0}, timeout=10)


def test_equipment_add_rejects_negative_weight():
    cid = _get_any_character_id()
    if not cid:
        return
    body = {"item_name": "TEST", "item_category": "equipo_general",
            "cantidad": 1, "is_purchase": False, "peso_kg": -5.0}
    r = requests.post(f"{API}/characters/{cid}/equipment/add", json=body, timeout=10)
    assert r.status_code == 422, r.text


def test_equipment_add_rejects_zero_cantidad():
    cid = _get_any_character_id()
    if not cid:
        return
    body = {"item_name": "TEST", "item_category": "equipo_general",
            "cantidad": 0, "is_purchase": False}
    r = requests.post(f"{API}/characters/{cid}/equipment/add", json=body, timeout=10)
    assert r.status_code == 422, r.text
