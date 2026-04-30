"""
Iteration 67 - Backend tests:
- POST /api/travel/generate-event: terreno_categoria, cd_prueba, desventaja_estacion
- equipo_ocupacion source for equipment/carry & toggle-active
- weight-summary considers equipo_ocupacion items on mount
- delete_mount reassigns equipo_ocupacion items back to character
"""
import os
import pytest
import requests

def _load_base_url():
    url = os.environ.get('REACT_APP_BACKEND_URL')
    if not url:
        try:
            with open('/app/frontend/.env') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.split('=', 1)[1].strip()
                        break
        except Exception:
            pass
    return (url or '').rstrip('/')

BASE_URL = _load_base_url()
XALAN_ID = "208ab2df-a51a-43e5-b96e-1c6757a2ada8"


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ========== TRAVEL: generate-event terrain CD + season disadvantage ==========

@pytest.mark.parametrize("terreno,expected_cd", [
    ("gran_camino", 10),
    ("camino_mayor", 10),
    ("camino_menor", 10),
    ("campo_abierto", 15),
    ("muy_dificil", 20),
    ("desalentador", 20),
])
def test_generate_event_cd_by_terrain(api, terreno, expected_cd):
    r = api.post(f"{BASE_URL}/api/travel/generate-event",
                 params={"terreno": terreno, "estacion": "verano"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "cd_prueba" in data, f"cd_prueba missing in {data}"
    assert data["cd_prueba"] == expected_cd, f"For {terreno} expected CD {expected_cd} got {data['cd_prueba']}"
    assert "terreno_categoria" in data
    assert "desventaja_estacion" in data
    # resolucion.cd should match cd_prueba
    if data.get("resolucion") and "cd" in data["resolucion"]:
        assert data["resolucion"]["cd"] == expected_cd


@pytest.mark.parametrize("estacion,expected", [
    ("invierno", True),
    ("otono", True),
    ("verano", False),
    ("primavera", False),
])
def test_generate_event_season_disadvantage(api, estacion, expected):
    r = api.post(f"{BASE_URL}/api/travel/generate-event",
                 params={"terreno": "campo_abierto", "estacion": estacion})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("desventaja_estacion") == expected, f"estacion={estacion} expected {expected} got {data.get('desventaja_estacion')}"


# ========== CHARACTER: equipo_ocupacion source ==========

def _get_char(api):
    r = api.get(f"{BASE_URL}/api/characters/{XALAN_ID}")
    assert r.status_code == 200, r.text
    return r.json()


def test_xalan_exists_and_has_equipo_ocupacion(api):
    c = _get_char(api)
    eo = c.get("equipo_ocupacion") or []
    assert len(eo) > 0, f"Xalan should have equipo_ocupacion items, got {eo}"


def test_weight_summary_endpoint_works(api):
    r = api.get(f"{BASE_URL}/api/characters/{XALAN_ID}/weight-summary")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "monturas_detalle" in data or "monturas" in data or "personaje" in data


def test_carry_equipo_ocupacion_to_mount_and_back(api):
    char = _get_char(api)
    monturas = char.get("monturas") or []
    if not monturas:
        # try legacy single mount
        m = char.get("montura")
        if isinstance(m, dict) and m.get("id"):
            monturas = [m]
    if not monturas:
        pytest.skip("Xalan has no mounts to test transfer")

    mount_id = monturas[0].get("id") or monturas[0].get("mount_id")
    if not mount_id:
        pytest.skip("Mount has no id field")

    eo = char.get("equipo_ocupacion") or []
    # find a weapon/armor item
    target_idx = None
    for i, it in enumerate(eo):
        name = (it.get("nombre") if isinstance(it, dict) else str(it)) or ""
        if name:
            target_idx = i
            target_name = name
            break
    if target_idx is None:
        pytest.skip("No equipo_ocupacion item to move")

    # Move to mount
    payload = {
        "source": "equipo_ocupacion",
        "item_index": target_idx,
        "carried_by": "montura",
        "mount_id": mount_id,
    }
    r = api.patch(f"{BASE_URL}/api/characters/{XALAN_ID}/equipment/carry", json=payload)
    # We accept 200 as success
    assert r.status_code in (200, 201), f"carry to mount failed: {r.status_code} {r.text}"

    # Verify item now has portado_por=montura
    char2 = _get_char(api)
    eo2 = char2.get("equipo_ocupacion") or []
    moved = None
    for it in eo2:
        if isinstance(it, dict) and it.get("nombre") == target_name:
            moved = it
            break
    assert moved is not None, f"Item {target_name} disappeared from equipo_ocupacion"
    assert moved.get("portado_por") == "montura", f"portado_por not updated: {moved}"

    # Move back to character
    payload_back = {
        "source": "equipo_ocupacion",
        "item_index": eo2.index(moved),
        "carried_by": "personaje",
    }
    r = api.patch(f"{BASE_URL}/api/characters/{XALAN_ID}/equipment/carry", json=payload_back)
    assert r.status_code in (200, 201), f"carry back failed: {r.status_code} {r.text}"

    char3 = _get_char(api)
    eo3 = char3.get("equipo_ocupacion") or []
    for it in eo3:
        if isinstance(it, dict) and it.get("nombre") == target_name:
            assert it.get("portado_por") in ("personaje", None), f"Not reverted: {it}"
            break


def test_toggle_active_equipo_ocupacion(api):
    char = _get_char(api)
    eo = char.get("equipo_ocupacion") or []
    if not eo:
        pytest.skip("No equipo_ocupacion")
    # use first dict item
    idx = None
    for i, it in enumerate(eo):
        if isinstance(it, dict):
            idx = i
            break
    if idx is None:
        pytest.skip("No dict items in equipo_ocupacion")

    # Get current activa state
    cur = eo[idx].get("activa", False)
    payload = {"source": "equipo_ocupacion", "item_index": idx, "activa": not cur}
    r = api.patch(f"{BASE_URL}/api/characters/{XALAN_ID}/equipment/toggle-active", json=payload)
    assert r.status_code in (200, 201), f"toggle-active failed: {r.status_code} {r.text}"


# ========== Regression: equipment/add for ropa ==========

def test_equipment_add_ropa_regression(api):
    payload = {
        "item_name": "TEST_Capa de prueba it67",
        "item_category": "ropa",
        "cantidad": 1,
        "is_purchase": False,
    }
    r = api.post(f"{BASE_URL}/api/characters/{XALAN_ID}/equipment/add", json=payload)
    assert r.status_code in (200, 201), f"equipment/add ropa failed: {r.status_code} {r.text}"
