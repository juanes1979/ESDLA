"""
Tests for the new Virtue selection system (iter105-ish):
- Step5 accepts a chosen +1 characteristic via virtud_caracteristicas_elegir
- Finalize applies +1 to attributes, adds skill/save/tool competencies, PG/CA/Comunidad extras
- Sheet-related fields (virtud_caracteristica_elegida) are stored on the character
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
EMAIL = 'elanillounico_tlotr@proton.me'
PASSWORD = '123456'


@pytest.fixture(scope='module')
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get('access_token') or r.json().get('token')


@pytest.fixture(scope='module')
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _pick_culture_and_virtue(headers):
    """Find a culture with tiene_virtud_inicial and a virtue with 2+ caracteristicas_elegir."""
    r = requests.get(f"{BASE_URL}/api/data/cultures", headers=headers, timeout=30)
    assert r.status_code == 200
    cultures = r.json().get('cultures', [])
    cultures_with_v = [c for c in cultures if c.get('tiene_virtud_inicial')]
    assert cultures_with_v, "No cultures with tiene_virtud_inicial=True"
    for cul in cultures_with_v:
        r2 = requests.get(f"{BASE_URL}/api/data/cultures/{cul['id']}/virtues", headers=headers, timeout=30)
        if r2.status_code != 200:
            continue
        vlist = r2.json().get('virtues', [])
        for v in vlist:
            chars = v.get('caracteristicas_elegir') or []
            if isinstance(chars, list) and len(chars) >= 2:
                return cul, v
    # Fallback: any virtue with a single option is still testable
    for cul in cultures_with_v:
        r2 = requests.get(f"{BASE_URL}/api/data/cultures/{cul['id']}/virtues", headers=headers, timeout=30)
        vlist = r2.json().get('virtues', [])
        for v in vlist:
            if v.get('caracteristicas_elegir'):
                return cul, v
    pytest.skip("No virtue with caracteristicas_elegir found")


def test_full_virtue_flow_applies_bonuses(headers):
    """End-to-end: create draft, walk step5 with chosen char, finalize, verify bonuses."""
    culture, virtue = _pick_culture_and_virtue(headers)
    chars_opt = virtue.get('caracteristicas_elegir') or []
    skills_opt = virtue.get('competencias_habilidades_elegir') or []
    saves_opt = virtue.get('salvaciones_elegir') or []
    tools_opt = virtue.get('competencias_herramientas_elegir') or []

    chosen_char = chars_opt[0] if chars_opt else None
    chosen_skill = skills_opt[0] if skills_opt else None
    chosen_save = saves_opt[0] if saves_opt else None
    chosen_tool = tools_opt[0] if tools_opt else None

    # Create draft
    r = requests.post(f"{BASE_URL}/api/characters/draft", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    draft_id = r.json()['id']

    # Get a background from this culture; fall back to first one
    r = requests.get(f"{BASE_URL}/api/data/backgrounds", headers=headers, timeout=30)
    bgs = r.json().get('backgrounds', [])
    bg = next((b for b in bgs if (b.get('cultura') or '').lower() == culture['nombre'].lower()), bgs[0])

    r = requests.get(f"{BASE_URL}/api/data/occupations", headers=headers, timeout=30)
    occ = r.json().get('occupations', [])[0]

    # Step 1
    step1 = {
        "nombre": "TEST_VirtudChoice",
        "jugador": "tester",
        "cultura_id": culture['id'],
        "genero": "hombre",
        "edad": 30, "altura_cm": 175, "peso_kg": 75,
        "ojos": "marrones", "piel": "clara", "pelo": "castaño",
        "caracteristicas": {"fuerza": 10, "destreza": 10, "constitucion": 10, "inteligencia": 10, "sabiduria": 10, "carisma": 10},
        "tiene_virtud_inicial": True,
    }
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", headers=headers, json=step1, timeout=30)
    assert r.status_code == 200, r.text

    # Step 2
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", headers=headers,
                       json={"trasfondo_id": bg['id']}, timeout=30)
    assert r.status_code == 200, r.text

    # Step 3
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", headers=headers,
                       json={"ocupacion_id": occ['id'], "habilidades_elegidas": [], "herramientas_elegidas": [],
                             "pericia_elegida": [], "equipo_ocupacion": [], "armadura_elegida": None}, timeout=30)
    assert r.status_code == 200, r.text

    # Step 4 - baseline attributes
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step4", headers=headers,
                       json={"atributos": {"fuerza": 10, "destreza": 10, "constitucion": 10, "inteligencia": 10, "sabiduria": 10, "carisma": 10},
                             "metodo_asignacion": "manual"}, timeout=30)
    assert r.status_code == 200, r.text
    draft_after_s4 = r.json()
    attrs_before = draft_after_s4.get('atributos_finales', {})

    # Step 5 - virtue with chosen char
    step5 = {
        "virtud_id": virtue['id'],
        "virtud_nombre": virtue['nombre'],
        "virtud_descripcion": virtue.get('descripcion'),
        "virtud_rasgos": virtue.get('rasgos_virtud'),
        "virtud_caracteristicas_fijas": virtue.get('caracteristicas_fijas') or {},
        "virtud_caracteristicas_elegir": [chosen_char] if chosen_char else [],
        "virtud_salvaciones_elegir": [chosen_save] if chosen_save else [],
        "virtud_pg_extra": virtue.get('puntos_golpe_extra') or 0,
        "virtud_comunidad_extra": virtue.get('puntos_comunidad_extra') or 0,
        "virtud_ca_extra": virtue.get('clase_armadura_extra') or 0,
        "virtud_habilidades_elegir": [chosen_skill] if chosen_skill else [],
        "virtud_herramientas_elegir": [chosen_tool] if chosen_tool else [],
    }
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5", headers=headers, json=step5, timeout=30)
    assert r.status_code == 200, r.text
    draft_after_s5 = r.json()
    attrs_after = draft_after_s5.get('atributos_finales', {})

    # Assertion: chosen char got +1
    if chosen_char:
        char_map = {'FUERZA': 'fuerza', 'DESTREZA': 'destreza', 'CONSTITUCIÓN': 'constitucion', 'CONSTITUCION': 'constitucion',
                    'INTELIGENCIA': 'inteligencia', 'SABIDURÍA': 'sabiduria', 'SABIDURIA': 'sabiduria', 'CARISMA': 'carisma'}
        key = char_map.get(chosen_char.upper())
        assert key, f"Unknown char option: {chosen_char}"
        assert attrs_after.get(key, 0) == attrs_before.get(key, 0) + 1, \
            f"Expected +1 to {key} ({attrs_before.get(key)}->{attrs_after.get(key)})"

    # Steps 6/7/8/9 (minimal)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step6", headers=headers,
                   json={"habilidades": []}, timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step7", headers=headers,
                   json={"inventario": [], "dinero": {"mp": 0, "mo": 0, "me": 0, "mc": 0}}, timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step8", headers=headers,
                   json={"patron_id": None}, timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step9", headers=headers,
                   json={"rasgo_distintivo": "", "rasgo_distintivo_2": "", "motivacion": "", "historia": ""}, timeout=30)

    # Finalize
    r = requests.post(f"{BASE_URL}/api/characters/draft/{draft_id}/finalize", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    character = r.json()
    char_id = character['id']

    try:
        # Verify chosen char is stored
        if chosen_char:
            assert character.get('virtud_caracteristica_elegida') == chosen_char, \
                f"virtud_caracteristica_elegida expected {chosen_char}, got {character.get('virtud_caracteristica_elegida')}"
            # atributos should reflect +1
            char_map = {'FUERZA': 'fuerza', 'DESTREZA': 'destreza', 'CONSTITUCIÓN': 'constitucion', 'CONSTITUCION': 'constitucion',
                        'INTELIGENCIA': 'inteligencia', 'SABIDURÍA': 'sabiduria', 'SABIDURIA': 'sabiduria', 'CARISMA': 'carisma'}
            key = char_map.get(chosen_char.upper())
            assert character['atributos'][key] == attrs_after[key], "Final char attribute mismatch"

        # Skill competency added
        if chosen_skill:
            hv = character.get('competencias', {}).get('habilidades_virtud', [])
            assert chosen_skill in hv, f"habilidades_virtud missing {chosen_skill}: {hv}"

        # Save competency added
        if chosen_save:
            ts = character.get('competencias', {}).get('tiradas_salvacion', [])
            assert chosen_save in ts, f"tiradas_salvacion missing {chosen_save}: {ts}"

        # Tool competency added
        if chosen_tool:
            herr = character.get('competencias', {}).get('herramientas', [])
            assert chosen_tool in herr, f"herramientas missing {chosen_tool}: {herr}"

        # Verify GET returns same
        r = requests.get(f"{BASE_URL}/api/characters/{char_id}", headers=headers, timeout=30)
        assert r.status_code == 200
        fetched = r.json()
        assert fetched.get('virtud_nombre') == virtue['nombre']
    finally:
        # Cleanup
        requests.delete(f"{BASE_URL}/api/characters/{char_id}", headers=headers, timeout=30)
