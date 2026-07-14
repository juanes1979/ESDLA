"""
Iteration 110 — PNJ Forge unified creator (backend).

Cubre:
  - GET /api/npc-generator/creature-types
  - POST /api/npc-generator/creature-name (orco M/F, troll, huargo, tipo inválido → 400)
  - GET/PUT /api/npc-generator/creature-name-config (persistencia + uso en generador)
  - POST /api/npc-generator/story (historia con IA en español)
  - POST /api/npc-generator/portrait (base64 + file_id)
  - PATCH /api/data/npcs/{id} (modo_raza/razas_excluidas/tipos_criatura) + GET expone
  - POST /api/campaign-runs/{run_id}/dj-screen/add-combatant
  - POST /api/trading/npcs (autorrelleno)
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
RUN_ID = "750ac72b-f208-4c9e-b897-204b2faccf59"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": MAESTRO_EMAIL, "password": MAESTRO_PASS, "remember_me": True},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


# ── creature-types / creature-name ─────────────────────────────────────────────
def test_creature_types_list(h):
    r = requests.get(f"{BASE}/api/npc-generator/creature-types", headers=h, timeout=10)
    assert r.status_code == 200
    tipos = r.json().get("tipos", [])
    ids = {t["id"] for t in tipos}
    assert {"orco", "troll", "huargo"}.issubset(ids)


@pytest.mark.parametrize("tipo,sexo", [("orco", "M"), ("orco", "F"), ("troll", None), ("huargo", None)])
def test_creature_name_valid(h, tipo, sexo):
    body = {"tipo": tipo}
    if sexo:
        body["sexo"] = sexo
    r = requests.post(f"{BASE}/api/npc-generator/creature-name", json=body, headers=h, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    nm = data.get("name") or data.get("nombre") or ""
    assert isinstance(nm, str) and len(nm) >= 2, data


def test_creature_name_invalid_type(h):
    r = requests.post(
        f"{BASE}/api/npc-generator/creature-name",
        json={"tipo": "no_existe_zzz"},
        headers=h,
        timeout=10,
    )
    assert r.status_code == 400


# ── creature-name-config (GET/PUT + persistencia usada por generador) ──────────
def test_creature_name_config_roundtrip(h):
    # Snapshot actual (baseline)
    g = requests.get(f"{BASE}/api/npc-generator/creature-name-config", headers=h, timeout=10)
    assert g.status_code == 200
    original = g.json().get("data") or {}
    assert "orco" in original

    # Añade un tipo nuevo
    new_data = dict(original)
    new_data["qatest"] = {
        "label": "QA Test",
        "usa_sexo": False,
        "ataque": ["Ka", "Zo"],
        "cuerpo": ["mor", "gul"],
        "final_m": ["ak"],
        "final_f": ["ak"],
        "final": ["ak"],
    }
    put = requests.put(
        f"{BASE}/api/npc-generator/creature-name-config",
        json={"data": new_data},
        headers=h,
        timeout=10,
    )
    assert put.status_code == 200, put.text
    assert "qatest" in put.json().get("tipos", [])

    # El generador reconoce el nuevo tipo
    gen = requests.post(
        f"{BASE}/api/npc-generator/creature-name",
        json={"tipo": "qatest"},
        headers=h,
        timeout=10,
    )
    assert gen.status_code == 200, gen.text
    assert (gen.json().get("name") or "").strip()

    # Restaurar el catálogo original (limpieza)
    restore = requests.put(
        f"{BASE}/api/npc-generator/creature-name-config",
        json={"data": original},
        headers=h,
        timeout=10,
    )
    assert restore.status_code == 200


# ── story + portrait (IA) ──────────────────────────────────────────────────────
def test_story_generates_spanish_text(h):
    r = requests.post(
        f"{BASE}/api/npc-generator/story",
        json={"nombre": "Uzgur el Corvo", "contexto": "orco jefe con cicatriz"},
        headers=h,
        timeout=60,
    )
    assert r.status_code == 200, r.text
    hist = r.json().get("historia", "")
    assert isinstance(hist, str) and len(hist) > 30


def test_portrait_returns_base64(h):
    r = requests.post(
        f"{BASE}/api/npc-generator/portrait",
        json={"occupation": "Gran Orco", "sex": "M", "extra": "monstruoso, cicatrices"},
        headers=h,
        timeout=90,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("image_base64"), "image_base64 missing"
    assert isinstance(d["image_base64"], str) and len(d["image_base64"]) > 500
    # file_id may or may not be present depending on impl, but usually is
    assert "file_id" in d


# ── PATCH /data/npcs/{id} + GET lista agrupada ─────────────────────────────────
def test_patch_npc_modo_raza_persists(h):
    # Elige un maligno existente
    lst = requests.get(f"{BASE}/api/data/npcs", headers=h, timeout=10)
    assert lst.status_code == 200
    malignos = lst.json().get("malignos") or []
    assert malignos, "No malignos found in bestiary"
    npc = malignos[0]
    npc_id = npc.get("_id") or npc.get("id")
    original_modo = npc.get("modo_raza")
    original_razas = list(npc.get("razas_excluidas") or [])
    original_tipos = list(npc.get("tipos_criatura") or [])

    payload = {
        "modo_raza": "sin_raza",
        "razas_excluidas": ["Elfos"],
        "tipos_criatura": ["orco", "troll"],
    }
    p = requests.patch(f"{BASE}/api/data/npcs/{npc_id}", json=payload, headers=h, timeout=10)
    assert p.status_code == 200, p.text

    # Verificar via GET agrupada
    lst2 = requests.get(f"{BASE}/api/data/npcs", headers=h, timeout=10)
    m2 = next(x for x in (lst2.json().get("malignos") or []) if (x.get("_id") or x.get("id")) == npc_id)
    assert m2.get("modo_raza") == "sin_raza"
    assert "Elfos" in (m2.get("razas_excluidas") or [])
    assert set(m2.get("tipos_criatura") or []) >= {"orco", "troll"}

    # Restaurar
    requests.patch(
        f"{BASE}/api/data/npcs/{npc_id}",
        json={
            "modo_raza": original_modo,
            "razas_excluidas": original_razas,
            "tipos_criatura": original_tipos,
        },
        headers=h,
        timeout=10,
    )


# ── add-combatant ──────────────────────────────────────────────────────────────
def test_add_combatant_from_npc(h):
    # Toma un maligno con estadísticas
    lst = requests.get(f"{BASE}/api/data/npcs", headers=h, timeout=10).json()
    malignos = lst.get("malignos") or []
    npc = next((x for x in malignos if x.get("puntos_golpe")), malignos[0])
    npc.pop("_id", None)
    r = requests.post(
        f"{BASE}/api/campaign-runs/{RUN_ID}/dj-screen/add-combatant",
        json={"npc": npc, "name": "TEST_QA_Orco", "count": 2},
        headers=h,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data.get("added", [])) == 2
    assert data.get("total_combatants", 0) >= 2
    # Los enemigos derivan de ca/hp/atk/dmg/init
    for c in data["added"]:
        assert c["type"] == "enemy"
        assert "ac" in c and "hp_max" in c and "dmg" in c


# ── trading POST /trading/npcs con autorrelleno ────────────────────────────────
def test_trading_npc_autofill():
    # Este endpoint NO requiere auth (Body-only)
    payload = {"profesion": "Herrero", "raza": "Hombres", "sexo": "Masculino"}
    r = requests.post(f"{BASE}/api/trading/npcs", json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    npc = d.get("npc") or d
    assert (npc.get("nombre") or "").strip(), "nombre autogenerado vacío"
    assert (npc.get("profesion") or npc.get("profesion_comerciante")) == "Herrero"
    assert (npc.get("rasgo") or "").strip(), "rasgo autogenerado vacío"
    assert (npc.get("modo_hablar") or "").strip(), "modo_hablar autogenerado vacío"
    assert npc.get("edad"), "edad autogenerada vacía"
