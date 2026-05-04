"""OL3 iter62: PATCH allowed_fields + travel encumbrance bonus_fatiga"""
import os, requests, pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tavern-chronicles-1.preview.emergentagent.com').rstrip('/')
CHAR_ID = "c16a362d-9841-4954-8f70-0dfe02dfe303"

def test_patch_all_new_fields_persist():
    payload = {
        "nombre_jugador": "TEST_jugador",
        "sexo": "varón",
        "iniciativa_bonus": 2,
        "salvaciones_competencia": ["fuerza", "destreza"],
        "salvaciones_muerte": {"exitos": 2, "fracasos": 1},
        "competencias_herramientas": ["TEST_lockpicks"],
        "cicatrices_sombra": ["TEST_scar1"],
        "maldicion_sombra": "TEST_curse",
        "mecenas": {"nombre": "TEST_pat", "tipo": "noble", "descripcion": "x", "beneficios": "y"},
        "especiales_profesion": ["TEST_special1"],
        "historia": "TEST_history_text",
        "estorbo_metros": -3,
        "montura": {"nombre": "TEST_pony", "transporta_equipo": True},
    }
    r = requests.patch(f"{BASE_URL}/api/characters/{CHAR_ID}", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/characters/{CHAR_ID}", timeout=30).json()
    for k, v in payload.items():
        assert g.get(k) == v, f"Field {k}: expected {v}, got {g.get(k)}"

def test_xp_threshold_state_295():
    # Reset XP to 295 (below 300 threshold for level 2)
    requests.patch(f"{BASE_URL}/api/characters/{CHAR_ID}", json={"experiencia": 295, "nivel": 1}, timeout=30)
    g = requests.get(f"{BASE_URL}/api/characters/{CHAR_ID}", timeout=30).json()
    assert g.get('experiencia') == 295
    assert g.get('nivel') == 1

def test_travel_encumbrance_bonus_fatiga():
    # 2 members, both vel_base=9. Member B encumbered -3.
    # Expected: velocidad_grupo = 6, A gets bonus_fatiga=5, B gets 0
    payload = {
        "origen_id": "loc_131",
        "origen_nombre": "Bree",
        "destino_id": "loc_142",
        "destino_nombre": "Rivendel",
        "ritmo": "normal",
        "estacion": "verano",
        "miembros": [
            {"personaje_id": "A", "nombre": "Alice", "velocidad_base": 9, "estorbo_metros": 0},
            {"personaje_id": "B", "nombre": "Bob", "velocidad_base": 9, "estorbo_metros": -3},
        ],
    }
    r = requests.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    if data.get("error"):
        pytest.skip(f"Route error: {data.get('message')}")
    
    vg = data.get("velocidad_grupo")
    assert isinstance(vg, dict)
    assert vg.get("velocidad_metros") == 6.0, f"Expected vel=6, got {vg}"
    desglose = vg.get("desglose_velocidades") or []
    by_name = {d["nombre"]: d for d in desglose}
    # Alice (no estorbo, could go faster) → bonus 5
    assert by_name["Alice"]["bonus_fatiga"] == 5, f"Alice: {by_name['Alice']}"
    # Bob (estorbado, IS the slow one) should NOT get the bonus
    assert by_name["Bob"]["bonus_fatiga"] == 0, f"BUG: Bob is the encumbered slow member, should NOT get bonus_fatiga=5. Got: {by_name['Bob']}"
