"""
Iter100 backend tests for the virtue system bug fixes:
- BUG P0: +1 virtue characteristic must apply when draft uses `caracteristicas`
         field (real wizard flow), NOT atributos_finales.
- P1 Perfeccionamiento: +2/one or +1/two, tope 20 respected.
- P1 Maestría: virtud_pericia_elegida persists and shows in pericia_elegida.
- P1 Editor de Virtudes: PUT /api/data/virtudes/{id} updates description.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
EMAIL = 'elanillounico_tlotr@proton.me'
PASSWORD = '123456'

CULTURE_HOMBRES_BREE_ID = '3ea83f21-2e16-4d65-bf5c-33ef16e50160'


@pytest.fixture(scope='module')
def headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD},
                      timeout=30)
    assert r.status_code == 200, r.text
    token = r.json().get('access_token') or r.json().get('token')
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _list_virtues_for_culture(headers, culture_id):
    r = requests.get(f"{BASE_URL}/api/data/cultures/{culture_id}/virtues",
                     headers=headers, timeout=30)
    if r.status_code != 200:
        return []
    return r.json().get('virtues', [])


def _bg_and_occ(headers, culture_name):
    r = requests.get(f"{BASE_URL}/api/data/backgrounds", headers=headers, timeout=30)
    bgs = r.json().get('backgrounds', [])
    bg = next((b for b in bgs if (b.get('cultura') or '').lower() == culture_name.lower()), bgs[0])
    r = requests.get(f"{BASE_URL}/api/data/occupations", headers=headers, timeout=30)
    occ = r.json().get('occupations', [])[0]
    return bg, occ


def _finalize_and_cleanup(headers, draft_id):
    for step, payload in [
        ("step6", {"habilidades": []}),
        ("step7", {"inventario": [], "dinero": {"mp": 0, "mo": 0, "me": 0, "mc": 0}}),
        ("step8", {"patron_id": None}),
        ("step9", {"rasgo_distintivo": "", "rasgo_distintivo_2": "", "motivacion": "", "historia": ""}),
    ]:
        requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/{step}",
                       headers=headers, json=payload, timeout=30)
    r = requests.post(f"{BASE_URL}/api/characters/draft/{draft_id}/finalize",
                     headers=headers, timeout=30)
    return r


def _make_step1_bree(cul_id, caracteristicas):
    return {
        "nombre": f"TEST_Iter100_{uuid.uuid4().hex[:6]}",
        "jugador": "tester",
        "cultura_id": cul_id,
        "genero": "hombre",
        "edad": 30, "altura_cm": 175, "peso_kg": 75,
        "ojos": "marrones", "piel": "clara", "pelo": "castaño",
        "caracteristicas": caracteristicas,
        "tiene_virtud_inicial": True,
    }


# ---------------------------------------------------------------------------
# TEST 1: BUG P0 - +1 chosen characteristic must apply when starting from
# `caracteristicas` (real wizard) even without step4.
# ---------------------------------------------------------------------------
def test_virtud_plus1_applies_from_caracteristicas(headers):
    virtues = _list_virtues_for_culture(headers, CULTURE_HOMBRES_BREE_ID)
    assert virtues, "No virtues returned for Hombres de Bree"

    # Prefer a virtue with caracteristicas_elegir including INTELIGENCIA/SABIDURIA
    v = None
    for cand in virtues:
        opts = [str(x).upper() for x in (cand.get('caracteristicas_elegir') or [])]
        if 'INTELIGENCIA' in opts or 'SABIDURÍA' in opts or 'SABIDURIA' in opts:
            v = cand
            break
    if v is None:
        v = next((c for c in virtues if c.get('caracteristicas_elegir')), None)
    assert v, "No virtue with caracteristicas_elegir for Hombres de Bree"

    chosen = 'INTELIGENCIA' if 'INTELIGENCIA' in [x.upper() for x in v['caracteristicas_elegir']] else v['caracteristicas_elegir'][0]

    # Get culture info for name
    rc = requests.get(f"{BASE_URL}/api/data/cultures", headers=headers, timeout=30)
    cul = next(c for c in rc.json()['cultures'] if c['id'] == CULTURE_HOMBRES_BREE_ID)
    bg, occ = _bg_and_occ(headers, cul['nombre'])

    # Create draft
    r = requests.post(f"{BASE_URL}/api/characters/draft", headers=headers, timeout=30)
    draft_id = r.json()['id']

    # Step1 with caracteristicas int=11
    caracteristicas = {"fuerza": 10, "destreza": 10, "constitucion": 10,
                       "inteligencia": 11, "sabiduria": 11, "carisma": 10}
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1",
                       headers=headers, json=_make_step1_bree(CULTURE_HOMBRES_BREE_ID, caracteristicas), timeout=30)
    assert r.status_code == 200, r.text

    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", headers=headers,
                   json={"trasfondo_id": bg['id']}, timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", headers=headers,
                   json={"ocupacion_id": occ['id'], "habilidades_elegidas": [], "herramientas_elegidas": [],
                         "pericia_elegida": [], "equipo_ocupacion": [], "armadura_elegida": None}, timeout=30)

    # NOTE: no step4 — real wizard skips it. Go straight to step5.
    step5 = {
        "virtud_id": v['_id'] if '_id' in v else v['id'],
        "virtud_nombre": v.get('nombre'),
        "virtud_descripcion": v.get('descripcion'),
        "virtud_rasgos": v.get('rasgos_virtud'),
        "virtud_caracteristicas_fijas": v.get('caracteristicas_fijas') or {},
        "virtud_caracteristicas_elegir": [chosen],
        "virtud_salvaciones_elegir": [],
        "virtud_pg_extra": v.get('puntos_golpe_extra') or 0,
        "virtud_comunidad_extra": v.get('puntos_comunidad_extra') or 0,
        "virtud_ca_extra": v.get('clase_armadura_extra') or 0,
        "virtud_habilidades_elegir": [],
        "virtud_herramientas_elegir": [],
    }
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5",
                       headers=headers, json=step5, timeout=30)
    assert r.status_code == 200, r.text
    atr_finales = r.json().get('atributos_finales', {})
    key_map = {'INTELIGENCIA': 'inteligencia', 'SABIDURÍA': 'sabiduria', 'SABIDURIA': 'sabiduria',
               'FUERZA': 'fuerza', 'DESTREZA': 'destreza', 'CONSTITUCIÓN': 'constitucion',
               'CONSTITUCION': 'constitucion', 'CARISMA': 'carisma'}
    key = key_map[chosen.upper()]
    base_val = caracteristicas[key]
    fijas = v.get('caracteristicas_fijas') or {}
    expected = base_val + int(fijas.get(key, 0)) + 1
    assert atr_finales.get(key) == expected, \
        f"step5 atributos_finales[{key}]={atr_finales.get(key)} expected {expected} (base {base_val} + fijas {fijas.get(key, 0)} + 1)"

    # Finalize
    r = _finalize_and_cleanup(headers, draft_id)
    assert r.status_code == 200, r.text
    ch = r.json()
    char_id = ch['id']
    try:
        assert ch['atributos'][key] == expected, \
            f"Final character atributos[{key}]={ch['atributos'][key]} expected {expected}"
        assert ch.get('virtud_caracteristica_elegida') == chosen
    finally:
        requests.delete(f"{BASE_URL}/api/characters/{char_id}", headers=headers, timeout=30)


# ---------------------------------------------------------------------------
# TEST 2: PERFECCIONAMIENTO tope 20 (fuerza=19 + 2 => 20 not 21)
# ---------------------------------------------------------------------------
def test_perfeccionamiento_tope_20(headers):
    # Find Perfeccionamiento virtue (common virtue, must be selectable for cultures with virtudes_comunes)
    r = requests.get(f"{BASE_URL}/api/data/virtudes", headers=headers, timeout=30)
    assert r.status_code == 200
    vlist = r.json().get('virtudes', [])
    perf = next((v for v in vlist if 'perfeccion' in (v.get('nombre', '').lower())), None)
    if not perf:
        pytest.skip("Perfeccionamiento virtue not present")

    rc = requests.get(f"{BASE_URL}/api/data/cultures", headers=headers, timeout=30)
    cul = next(c for c in rc.json()['cultures'] if c['id'] == CULTURE_HOMBRES_BREE_ID)
    bg, occ = _bg_and_occ(headers, cul['nombre'])

    r = requests.post(f"{BASE_URL}/api/characters/draft", headers=headers, timeout=30)
    draft_id = r.json()['id']

    caracteristicas = {"fuerza": 19, "destreza": 10, "constitucion": 10,
                       "inteligencia": 10, "sabiduria": 10, "carisma": 10}
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", headers=headers,
                   json=_make_step1_bree(CULTURE_HOMBRES_BREE_ID, caracteristicas), timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", headers=headers,
                   json={"trasfondo_id": bg['id']}, timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", headers=headers,
                   json={"ocupacion_id": occ['id'], "habilidades_elegidas": [], "herramientas_elegidas": [],
                         "pericia_elegida": [], "equipo_ocupacion": [], "armadura_elegida": None}, timeout=30)

    step5 = {
        "virtud_id": perf.get('_id') or perf.get('id'),
        "virtud_nombre": perf.get('nombre'),
        "virtud_caracteristicas_fijas": {},
        "virtud_caracteristicas_elegir": [],
        "virtud_perfeccionamiento": {"fuerza": 2},
    }
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5",
                       headers=headers, json=step5, timeout=30)
    assert r.status_code == 200, r.text
    atr = r.json().get('atributos_finales', {})
    assert atr.get('fuerza') == 20, f"Expected fuerza=20 (tope), got {atr.get('fuerza')}"

    # Test the +1/+1 mode with respect too
    step5b = {
        "virtud_id": perf.get('_id') or perf.get('id'),
        "virtud_nombre": perf.get('nombre'),
        "virtud_caracteristicas_fijas": {},
        "virtud_caracteristicas_elegir": [],
        "virtud_perfeccionamiento": {"fuerza": 1, "destreza": 1},
    }
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5",
                       headers=headers, json=step5b, timeout=30)
    assert r.status_code == 200, r.text
    atr2 = r.json().get('atributos_finales', {})
    # Recalculated from caracteristicas base
    assert atr2.get('fuerza') == 20, f"fuerza should cap at 20, got {atr2.get('fuerza')}"
    assert atr2.get('destreza') == 11, f"destreza should be 11 (10+1), got {atr2.get('destreza')}"

    r = _finalize_and_cleanup(headers, draft_id)
    if r.status_code == 200:
        requests.delete(f"{BASE_URL}/api/characters/{r.json()['id']}", headers=headers, timeout=30)
    else:
        requests.delete(f"{BASE_URL}/api/characters/draft/{draft_id}", headers=headers, timeout=30)


# ---------------------------------------------------------------------------
# TEST 3: MAESTRÍA — virtud_pericia_elegida persisted and added to pericia_elegida
# ---------------------------------------------------------------------------
def test_maestria_pericia_persists(headers):
    r = requests.get(f"{BASE_URL}/api/data/virtudes", headers=headers, timeout=30)
    vlist = r.json().get('virtudes', [])
    maestria = next((v for v in vlist if 'maestr' in (v.get('nombre', '').lower())), None)
    if not maestria:
        pytest.skip("Maestría virtue not present")

    rc = requests.get(f"{BASE_URL}/api/data/cultures", headers=headers, timeout=30)
    cul = next(c for c in rc.json()['cultures'] if c['id'] == CULTURE_HOMBRES_BREE_ID)
    bg, occ = _bg_and_occ(headers, cul['nombre'])

    r = requests.post(f"{BASE_URL}/api/characters/draft", headers=headers, timeout=30)
    draft_id = r.json()['id']
    caracteristicas = {"fuerza": 10, "destreza": 10, "constitucion": 10,
                       "inteligencia": 10, "sabiduria": 10, "carisma": 10}
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step1", headers=headers,
                   json=_make_step1_bree(CULTURE_HOMBRES_BREE_ID, caracteristicas), timeout=30)
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step2", headers=headers,
                   json={"trasfondo_id": bg['id']}, timeout=30)
    # Give the character a known skill so Maestría can be applied to it
    known_skill = "Percepción"
    requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step3", headers=headers,
                   json={"ocupacion_id": occ['id'], "habilidades_elegidas": [known_skill],
                         "herramientas_elegidas": [], "pericia_elegida": [],
                         "equipo_ocupacion": [], "armadura_elegida": None}, timeout=30)

    step5 = {
        "virtud_id": maestria.get('_id') or maestria.get('id'),
        "virtud_nombre": maestria.get('nombre'),
        "virtud_caracteristicas_fijas": {},
        "virtud_caracteristicas_elegir": ["FUERZA"],
        "virtud_pericia_elegida": known_skill,
    }
    r = requests.patch(f"{BASE_URL}/api/characters/draft/{draft_id}/step5",
                       headers=headers, json=step5, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get('virtud_pericia_elegida') == known_skill, d.get('virtud_pericia_elegida')

    r = _finalize_and_cleanup(headers, draft_id)
    assert r.status_code == 200, r.text
    ch = r.json()
    cid = ch['id']
    try:
        assert known_skill in (ch.get('pericia_elegida') or []), \
            f"Maestría pericia not merged into pericia_elegida: {ch.get('pericia_elegida')}"
    finally:
        requests.delete(f"{BASE_URL}/api/characters/{cid}", headers=headers, timeout=30)


# ---------------------------------------------------------------------------
# TEST 4: PUT /api/data/virtudes/{id} updates description and persists
# ---------------------------------------------------------------------------
def test_edit_virtud_persists(headers):
    r = requests.get(f"{BASE_URL}/api/data/virtudes", headers=headers, timeout=30)
    assert r.status_code == 200
    vlist = r.json().get('virtudes', [])
    assert vlist, "No virtues in DB"
    v = vlist[0]
    vid = v.get('_id') or v.get('id')
    original_desc = v.get('descripcion') or ''
    marker = f"__TEST_ITER100_{uuid.uuid4().hex[:6]}__"
    new_desc = (original_desc + " " + marker).strip()
    # Build a payload preserving fields but changing description
    payload = {**{k: val for k, val in v.items() if k not in ('_id', 'id', 'created_at', 'updated_at')},
               "descripcion": new_desc}
    r = requests.put(f"{BASE_URL}/api/data/virtudes/{vid}", headers=headers,
                     json=payload, timeout=30)
    assert r.status_code == 200, r.text
    # Verify
    r = requests.get(f"{BASE_URL}/api/data/virtudes", headers=headers, timeout=30)
    updated = next((x for x in r.json().get('virtudes', []) if (x.get('_id') or x.get('id')) == vid), None)
    try:
        assert updated is not None
        assert marker in (updated.get('descripcion') or ''), \
            f"description not updated: {updated.get('descripcion')}"
    finally:
        # Restore original description
        restore = {**payload, "descripcion": original_desc}
        requests.put(f"{BASE_URL}/api/data/virtudes/{vid}", headers=headers,
                     json=restore, timeout=30)
