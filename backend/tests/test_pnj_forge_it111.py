"""Iteration 111 — PNJ Forge unified (profesion filter by race + config map)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={
        "email": "elanillounico_tlotr@proton.me", "password": "123456", "remember_me": True,
    }, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---- 1. npc-meta includes profesiones_por_raza ----
def test_npc_meta_has_profesiones_por_raza(client):
    r = client.get(f"{API}/trading/npc-meta", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "profesiones_por_raza" in data
    ppr = data["profesiones_por_raza"]
    assert isinstance(ppr, dict)
    # Defaults from trading_npc_data.py
    assert "Enano Herrero" in ppr
    assert "Enanos" in ppr["Enano Herrero"]
    assert "Elfo Artesano" in ppr
    assert "Elfos" in ppr["Elfo Artesano"]
    assert "profesiones" in data and len(data["profesiones"]) > 5


# ---- 2. trading/config includes npc_profesiones_por_raza and PUT roundtrip ----
def test_trading_config_profesiones_por_raza_roundtrip(client):
    r = client.get(f"{API}/trading/config", timeout=15)
    assert r.status_code == 200
    cfg = r.json()
    assert "npc_profesiones_por_raza" in cfg
    original = cfg["npc_profesiones_por_raza"]
    assert "Enano Herrero" in original

    # Modify: add a TEST_ entry
    modified = dict(original)
    modified["TEST_Curandero Élfico"] = ["Elfos"]
    put_payload = dict(cfg)
    put_payload["npc_profesiones_por_raza"] = modified
    put_payload.pop("updated_at", None)
    r2 = client.put(f"{API}/trading/config", json=put_payload, timeout=15)
    assert r2.status_code == 200, r2.text

    # Verify via GET
    r3 = client.get(f"{API}/trading/config", timeout=15)
    assert r3.status_code == 200
    assert "TEST_Curandero Élfico" in r3.json()["npc_profesiones_por_raza"]

    # Also visible in npc-meta
    r4 = client.get(f"{API}/trading/npc-meta", timeout=15)
    assert "TEST_Curandero Élfico" in r4.json()["profesiones_por_raza"]

    # Cleanup: restore
    put_payload["npc_profesiones_por_raza"] = original
    r5 = client.put(f"{API}/trading/config", json=put_payload, timeout=15)
    assert r5.status_code == 200


# ---- 3. Create NPC with ubicacion + raza=Enanos + Enano Herrero persists ----
CREATED_NPC_IDS = []


def test_create_npc_enano_herrero(client):
    payload = {
        "nombre": "TEST_Balin Yunquefirme",
        "raza": "Enanos",
        "subcultura": "",
        "sexo": "Masculino",
        "profesion": "Enano Herrero",
        "ubicacion": "TEST_Erebor",
        "region": "TEST_Montañas",
    }
    r = client.post(f"{API}/trading/npcs", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    npc_id = body.get("npc_id") or body.get("npc", {}).get("_id")
    assert npc_id
    CREATED_NPC_IDS.append(npc_id)
    npc = body["npc"]
    assert npc["raza"] == "Enanos"
    assert npc["profesion"] == "Enano Herrero"
    assert npc["ubicacion"] == "TEST_Erebor"
    assert npc["nombre"] == "TEST_Balin Yunquefirme"

    # Verify GET returns it
    r2 = client.get(f"{API}/trading/npcs?location=TEST_Erebor", timeout=15)
    assert r2.status_code == 200
    ids = [n["_id"] for n in r2.json()["npcs"]]
    assert npc_id in ids


# ---- 4. Filtering profesiones by raza using default map ----
def test_profesiones_por_raza_semantics(client):
    r = client.get(f"{API}/trading/npc-meta", timeout=15)
    data = r.json()
    profs = data["profesiones"]
    ppr = data["profesiones_por_raza"]

    def allowed_for(raza):
        return [p for p in profs
                if (ppr.get(p) is None) or (len(ppr.get(p, [])) == 0) or (raza in ppr[p])]

    elfos = allowed_for("Elfos")
    assert "Enano Herrero" not in elfos
    assert "Caballero de Gondor" not in elfos
    assert "Elfo Artesano" in elfos

    enanos = allowed_for("Enanos")
    assert "Enano Herrero" in enanos
    assert "Elfo Artesano" not in enanos

    hombres = allowed_for("Hombres")
    assert "Caballero de Gondor" in hombres
    assert "Enano Herrero" not in hombres


# ---- 5. Update/delete NPC ----
def test_update_and_delete_npc(client):
    if not CREATED_NPC_IDS:
        pytest.skip("No NPC created")
    npc_id = CREATED_NPC_IDS[0]
    r = client.put(f"{API}/trading/npcs/{npc_id}",
                   json={"nombre": "TEST_Balin Yunquefirme (Editado)"}, timeout=15)
    assert r.status_code == 200
    # Verify persistence
    r2 = client.get(f"{API}/trading/npcs", timeout=15)
    npc = next((n for n in r2.json()["npcs"] if n["_id"] == npc_id), None)
    assert npc and npc["nombre"] == "TEST_Balin Yunquefirme (Editado)"
    # Delete
    r3 = client.delete(f"{API}/trading/npcs/{npc_id}", timeout=15)
    assert r3.status_code == 200
    # 404 on second delete
    r4 = client.delete(f"{API}/trading/npcs/{npc_id}", timeout=15)
    assert r4.status_code == 404
