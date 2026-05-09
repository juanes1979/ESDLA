"""
Iteration 106 — NPC Generator backend (stats + AI name).

Cubre:
  - GET /occupations devuelve lista combinada (creator + salarios + archetypes)
  - POST /generate produce stat block coherente:
    · Saqueador (nivel 1) tiene DES alto, cuero, cimitarra, arco corto.
    · Guerrero (nivel 1) tiene FUE alto, cota, espada larga, escudo.
    · Niveles superiores aumentan HP correctamente.
  - POST /name devuelve un nombre no vacío.
  - RBAC: jugador no puede generar.
"""
import os
import uuid

import pytest
import requests

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
PLAYER_EMAIL = "it106_player@example.com"
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


def test_occupations_list_combined():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.get(f"{BASE}/api/npc-generator/occupations", headers=_h(tok), timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "occupations" in d and "archetypes" in d
    assert len(d["occupations"]) >= 20
    sources = {o["source"] for o in d["occupations"]}
    assert any(s.startswith("creator") for s in sources)
    assert any(s.startswith("salarios:") for s in sources)
    assert "archetype" in sources
    # Creator-sourced have ts populated; salarios sourced are empty
    creator_items = [o for o in d["occupations"] if o["source"] == "creator"]
    assert any(o["tiradas_salvacion"] for o in creator_items)
    sal_items = [o for o in d["occupations"] if o["source"].startswith("salarios:")]
    assert all(not o["tiradas_salvacion"] for o in sal_items)


def test_generate_saqueador_stats():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    payload = {"occupation": "Saqueador", "sex": "M", "level": 1, "mode": "especial"}
    r = requests.post(
        f"{BASE}/api/npc-generator/generate",
        json=payload,
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["archetype"] == "saqueador"
    assert d["atributos"]["destreza"]["valor"] == 14  # priority slot
    # Coleto de cuero + cimitarra + arco corto
    assert "Coleto de cuero" in d["equipo"]
    assert any("Cimitarra" in w for w in d["equipo"])
    assert d["tiradas_salvacion"] == ["DES", "INT"]
    assert d["experiencia"] == 200  # CR1 ≈ 200xp


def test_generate_guerrero_stats_and_shield():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.post(
        f"{BASE}/api/npc-generator/generate",
        json={"occupation": "Guerrero", "sex": "F", "level": 3},
        headers=_h(tok),
        timeout=10,
    )
    assert r.status_code == 200
    d = r.json()
    assert d["archetype"] == "guerrero"
    assert d["atributos"]["fuerza"]["valor"] == 14
    assert d["has_shield"] is True
    assert d["armor_label"] == "Cota de malla"
    # CA = 10 + 6 (cota) + min(DEX, 2) + 2 shield = 18 (with 13 DEX → +1, capped 2 → +1)
    assert d["ca"] >= 17
    # HP at level 3 is higher than level 1
    r1 = requests.post(
        f"{BASE}/api/npc-generator/generate",
        json={"occupation": "Guerrero", "sex": "F", "level": 1},
        headers=_h(tok),
        timeout=10,
    )
    assert r1.json()["hp"] < d["hp"]


def test_generate_player_forbidden():
    ptok, _ = _approved(PLAYER_EMAIL, "jugador")
    r = requests.post(
        f"{BASE}/api/npc-generator/generate",
        json={"occupation": "Saqueador", "sex": "M", "level": 1},
        headers=_h(ptok),
        timeout=10,
    )
    assert r.status_code == 403


def test_ai_name_returns_string():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    r = requests.post(
        f"{BASE}/api/npc-generator/name",
        json={"sex": "M", "occupation": "saqueador", "subculture_name": "Sureños"},
        headers=_h(tok),
        timeout=30,
    )
    assert r.status_code == 200
    name = r.json().get("name", "").strip()
    assert len(name) >= 2
    assert len(name) < 80
