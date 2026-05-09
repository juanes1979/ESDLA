"""
Iteration 105 — Languages CRUD + Bestiary derive desafio.

Cubre:
  - Seed canónico de idiomas (>= 16 idiomas tras startup)
  - GET /api/data/languages devuelve array
  - POST /api/data/languages — crear (Maestro/DJ); jugador 403
  - PATCH /api/data/languages/{id} — editar
  - DELETE /api/data/languages/{id} — solo Maestro
  - Slug único: 400 al crear duplicado
"""
import os
import uuid

import pytest
import requests

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
DJ_EMAIL = "it105_dj@example.com"
PLAYER_EMAIL = "it105_pl@example.com"
PASS = "abcd"


def _login(email, password):
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": email, "password": password, "remember_me": False},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _approved(email, role):
    requests.post(
        f"{BASE}/api/auth/register",
        json={"email": email, "password": PASS, "name": email.split("@")[0]},
        timeout=10,
    )
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    users = requests.get(
        f"{BASE}/api/auth/users", headers={"Authorization": f"Bearer {mtok}"}, timeout=10
    ).json()
    target = next(u for u in users if u["email"] == email)
    if target.get("role") != role or target.get("status") != "aprobado":
        requests.patch(
            f"{BASE}/api/auth/users/{target['id']}",
            json={"role": role, "status": "aprobado"},
            headers={"Authorization": f"Bearer {mtok}"},
            timeout=10,
        )
    return _login(email, PASS), target["id"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_seed_canonical_languages_present():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.get(f"{BASE}/api/data/languages", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    langs = r.json()
    assert isinstance(langs, list)
    assert len(langs) >= 16
    # Canonical samples
    names = {l["nombre"] for l in langs}
    assert "Sindarin" in names
    assert "Khuzdul" in names
    assert any("Oestron" in n for n in names)


def test_jugador_cannot_create_language():
    ptok, _ = _approved(PLAYER_EMAIL, "jugador")
    r = requests.post(
        f"{BASE}/api/data/languages",
        json={"nombre": f"TestLang_{uuid.uuid4().hex[:6]}", "familia": "Otros"},
        headers=_h(ptok),
        timeout=10,
    )
    assert r.status_code == 403


def test_dj_can_create_and_update_language():
    djtok, _ = _approved(DJ_EMAIL, "director_de_juego")
    name = f"Idioma_{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE}/api/data/languages",
        json={"nombre": name, "familia": "Antiguos", "descripcion": "Test"},
        headers=_h(djtok),
        timeout=10,
    )
    assert r.status_code == 201, r.text
    lang = r.json()
    lid = lang["id"]
    assert lang["nombre"] == name
    assert lang["familia"] == "Antiguos"
    assert lang["slug"]
    # Update
    r2 = requests.patch(
        f"{BASE}/api/data/languages/{lid}",
        json={"familia": "Élficos", "descripcion": "Edited"},
        headers=_h(djtok),
        timeout=10,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["familia"] == "Élficos"
    assert r2.json()["descripcion"] == "Edited"
    # cleanup
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    requests.delete(f"{BASE}/api/data/languages/{lid}", headers=_h(mtok), timeout=10)


def test_slug_unique():
    djtok, _ = _approved(DJ_EMAIL, "director_de_juego")
    name = f"Slugtest_{uuid.uuid4().hex[:6]}"
    r1 = requests.post(
        f"{BASE}/api/data/languages",
        json={"nombre": name},
        headers=_h(djtok),
        timeout=10,
    )
    assert r1.status_code == 201
    lid1 = r1.json()["id"]
    # Same slug → conflict
    r2 = requests.post(
        f"{BASE}/api/data/languages",
        json={"nombre": name},
        headers=_h(djtok),
        timeout=10,
    )
    assert r2.status_code == 400
    # cleanup
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    requests.delete(f"{BASE}/api/data/languages/{lid1}", headers=_h(mtok), timeout=10)


def test_dj_cannot_delete_only_maestro_can():
    djtok, _ = _approved(DJ_EMAIL, "director_de_juego")
    r = requests.post(
        f"{BASE}/api/data/languages",
        json={"nombre": f"Deletable_{uuid.uuid4().hex[:6]}"},
        headers=_h(djtok),
        timeout=10,
    )
    assert r.status_code == 201
    lid = r.json()["id"]
    # DJ tries to delete
    r2 = requests.delete(f"{BASE}/api/data/languages/{lid}", headers=_h(djtok), timeout=10)
    assert r2.status_code == 403
    # Maestro deletes ok
    mtok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r3 = requests.delete(f"{BASE}/api/data/languages/{lid}", headers=_h(mtok), timeout=10)
    assert r3.status_code == 200
    # Now 404
    r4 = requests.delete(f"{BASE}/api/data/languages/{lid}", headers=_h(mtok), timeout=10)
    assert r4.status_code == 404
