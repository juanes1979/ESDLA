"""
Iteration 61 backend test: PATCH /api/characters/{id} accepts and persists
the field 'notas_privadas_jugador'.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://journey-roller.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def character_id():
    """Find existing 'Regred Maggot' or fallback to first character."""
    r = requests.get(f"{BASE_URL}/api/characters", timeout=20)
    assert r.status_code == 200, f"List characters failed: {r.status_code} {r.text[:200]}"
    payload = r.json()
    chars = payload.get("characters") if isinstance(payload, dict) else payload
    assert isinstance(chars, list) and len(chars) > 0, "No characters found in DB"
    target = next((c for c in chars if (c.get('nombre') or '').strip().lower() == 'regred maggot'), None)
    if target is None:
        target = chars[0]
    cid = target.get('id')
    assert cid, f"Character missing id: {target}"
    return cid


def test_patch_private_notes_persists(character_id):
    """PATCH with notas_privadas_jugador → response reflects change AND GET returns it."""
    test_value = "TEST_it61: el DJ susurra al jugador que el anillo cambia de peso bajo la luna nueva."

    r = requests.patch(
        f"{BASE_URL}/api/characters/{character_id}",
        json={"notas_privadas_jugador": test_value},
        timeout=20,
    )
    assert r.status_code == 200, f"PATCH failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("notas_privadas_jugador") == test_value, \
        f"PATCH response did not echo notas: got {body.get('notas_privadas_jugador')!r}"

    # GET to verify persistence
    g = requests.get(f"{BASE_URL}/api/characters/{character_id}", timeout=20)
    assert g.status_code == 200, f"GET failed: {g.status_code} {g.text[:200]}"
    fetched = g.json()
    assert fetched.get("notas_privadas_jugador") == test_value, \
        f"Persistence mismatch. Got: {fetched.get('notas_privadas_jugador')!r}"


def test_patch_private_notes_empty_clears(character_id):
    """PATCH with empty string should clear notes."""
    # First set something
    requests.patch(f"{BASE_URL}/api/characters/{character_id}",
                   json={"notas_privadas_jugador": "TEST_it61 to be cleared"}, timeout=20)
    # Now clear
    r = requests.patch(
        f"{BASE_URL}/api/characters/{character_id}",
        json={"notas_privadas_jugador": ""},
        timeout=20,
    )
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/characters/{character_id}", timeout=20).json()
    assert g.get("notas_privadas_jugador", "") == "", \
        f"Empty value not persisted: {g.get('notas_privadas_jugador')!r}"


def test_patch_unrelated_field_does_not_break_notes(character_id):
    """Setting another field should not erase the private notes."""
    notes = "TEST_it61 notes that must survive patches to other fields"
    r1 = requests.patch(f"{BASE_URL}/api/characters/{character_id}",
                        json={"notas_privadas_jugador": notes}, timeout=20)
    assert r1.status_code == 200
    # Patch something else (notes field). If 'notas' key is allowed, use it; else use a small no-op like fatiga.
    r2 = requests.patch(f"{BASE_URL}/api/characters/{character_id}",
                        json={"fatiga": 0}, timeout=20)
    assert r2.status_code == 200, f"Unrelated PATCH failed: {r2.status_code} {r2.text[:200]}"
    g = requests.get(f"{BASE_URL}/api/characters/{character_id}", timeout=20).json()
    assert g.get("notas_privadas_jugador") == notes, \
        "Private notes were lost after unrelated PATCH"


def test_no_mongo_id_in_response(character_id):
    """Response should NOT include MongoDB's _id field."""
    g = requests.get(f"{BASE_URL}/api/characters/{character_id}", timeout=20)
    assert g.status_code == 200
    body = g.json()
    assert "_id" not in body, "Response leaks MongoDB _id field"
