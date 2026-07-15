"""
Iteration 112 — PNJ Forge unificado:
(A) Backend GET /trading/npcs devuelve adversarios con desafio/experiencia (chip Desafío del front usa xpToCr).
(C) POST /trading/npcs con es_adversario=true guarda en trading_npcs y aparece con filtro tipo=adversario.
(B) PATCH /data/npcs/{id} persiste modo_raza/razas_permitidas/tipos_criatura.
(D) GET /trading/npcs devuelve el adversario recién creado.
Regresión: POST /trading/npcs (comerciante) sigue funcionando.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def maestro_token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "elanillounico_tlotr@proton.me",
        "password": "123456",
        "remember_me": True,
    }, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(maestro_token):
    return {"Authorization": f"Bearer {maestro_token}"}


# ------------------------------------------------------------
# (A) Bestiario adversarios: experiencia debe estar presente para chip Desafío
# ------------------------------------------------------------
def test_bestiario_adversarios_have_experiencia_or_desafio(auth_headers):
    r = requests.get(f"{API}/data/npcs?categoria=malignos", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    grouped = r.json()
    lst = grouped.get("malignos") or []
    assert isinstance(lst, list) and len(lst) > 0, "Debe haber adversarios malignos"
    con_xp = [n for n in lst if n.get("experiencia") not in (None, "", 0)]
    assert len(con_xp) > 0, "Ningún maligno tiene 'experiencia' para derivar CR"


# ------------------------------------------------------------
# (C) POST /trading/npcs con es_adversario=true
# ------------------------------------------------------------
_created_ids = []


def test_create_adversario_concreto_via_trading_npcs(auth_headers):
    payload = {
        "es_adversario": True,
        "nombre": f"TEST_QA_adv_it112_{uuid.uuid4().hex[:6]}",
        "ubicacion": "Aglarond",
        "region": "Folde Oeste",
        "raza": "Uruk-hai",
        "tipo_adversario": "Uruk-hai Guerrero",
        "experiencia": 450,
        "desafio": "2 (450 PX)",
        "ca": 15,
        "pg": 30,
        "caracteristicas": [16, 12, 14, 8, 10, 8],
    }
    r = requests.post(f"{API}/trading/npcs", json=payload, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("npc_id"), body
    assert body["npc"].get("es_adversario") is True
    assert body["npc"].get("ubicacion") == "Aglarond"
    _created_ids.append(body["npc_id"])


def test_created_adversario_shows_in_trading_npcs():
    r = requests.get(f"{API}/trading/npcs", timeout=15)
    assert r.status_code == 200
    lst = r.json()["npcs"]
    ids = {n["_id"] for n in lst}
    for cid in _created_ids:
        assert cid in ids, f"Adversario {cid} no aparece en /trading/npcs"
    # Verifica que el adversario tenga el flag
    adv = next(n for n in lst if n["_id"] == _created_ids[0])
    assert adv.get("es_adversario") is True
    assert adv.get("nombre", "").startswith("TEST_QA_adv_it112_")


# ------------------------------------------------------------
# (B) PATCH /data/npcs/{id} persiste modo_raza/razas_permitidas/tipos_criatura
# ------------------------------------------------------------
def test_patch_npc_persists_razas_permitidas(auth_headers):
    r = requests.get(f"{API}/data/npcs?categoria=malignos", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    lst = r.json().get("malignos") or []
    assert len(lst) > 0
    npc = lst[0]
    npc_id = npc.get("id") or npc.get("_id")
    original_modo = npc.get("modo_raza")

    patch = {
        "modo_raza": "racial",
        "razas_permitidas": ["Uruk-hai", "Hombres"],
        "tipos_criatura": [],
    }
    r = requests.patch(f"{API}/data/npcs/{npc_id}", json=patch, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("modo_raza") == "racial", f"modo_raza no persistido: {body.get('modo_raza')}"
    assert set(body.get("razas_permitidas", [])) == {"Uruk-hai", "Hombres"}, (
        f"razas_permitidas no persistidas: {body.get('razas_permitidas')}")

    # Verificar en GET individual
    r = requests.get(f"{API}/data/npcs/{npc_id}", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    got = r.json()
    assert got.get("modo_raza") == "racial"
    assert set(got.get("razas_permitidas", [])) == {"Uruk-hai", "Hombres"}

    # Cambiar a sin_raza
    patch2 = {
        "modo_raza": "sin_raza",
        "razas_permitidas": [],
        "tipos_criatura": ["orco", "troll"],
    }
    r = requests.patch(f"{API}/data/npcs/{npc_id}", json=patch2, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    got = r.json()
    assert got.get("modo_raza") == "sin_raza"
    assert set(got.get("tipos_criatura", [])) == {"orco", "troll"}

    # Restaurar estado original
    restore = {
        "modo_raza": original_modo or "racial",
        "razas_permitidas": npc.get("razas_permitidas") or [],
        "tipos_criatura": npc.get("tipos_criatura") or [],
    }
    requests.patch(f"{API}/data/npcs/{npc_id}", json=restore, headers=auth_headers, timeout=15)


# ------------------------------------------------------------
# Regresión: crear PNJ comerciante sigue funcionando
# ------------------------------------------------------------
def test_regression_create_merchant_npc(auth_headers):
    payload = {
        "nombre": f"TEST_QA_com_it112_{uuid.uuid4().hex[:6]}",
        "raza": "Enanos",
        "subcultura": "Enanos de la Montaña Solitaria",
        "sexo": "Masculino",
        "profesion": "Enano Herrero",
        "ubicacion": "Aglarond",
        "region": "Folde Oeste",
    }
    r = requests.post(f"{API}/trading/npcs", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["npc"].get("es_adversario") is not True
    assert body["npc"].get("profesion") == "Enano Herrero"
    _created_ids.append(body["npc_id"])


# ------------------------------------------------------------
# Meta / creature-types
# ------------------------------------------------------------
def test_creature_types_endpoint_available(auth_headers):
    r = requests.get(f"{API}/npc-generator/creature-types", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    body = r.json()
    tipos = body.get("tipos") or body
    assert isinstance(tipos, list) and len(tipos) > 0
    # Cada tipo debe tener id/label
    assert all("id" in t and "label" in t for t in tipos)


# ------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------
def test_cleanup_created_test_npcs(auth_headers):
    for cid in list(_created_ids):
        r = requests.delete(f"{API}/trading/npcs/{cid}", headers=auth_headers, timeout=10)
        assert r.status_code in (200, 204, 404), r.text
