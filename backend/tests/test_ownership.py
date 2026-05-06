"""
Auth & ownership regression tests (Iter 85+):
- Maestro Supremo (semilla MAESTRO_EMAIL) protegido (no puede borrarse ni
  cambiarse de rol).
- API jamás permite asignar rol "maestro".
- requested_role en registro se guarda y se devuelve.
- Aislamiento de personajes/storage por owner_id (Maestro ve todo;
  Jugador y DJ sólo lo suyo).
"""
import os
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
TEST_PREFIX = "ownership_test_"


def _cleanup():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.users.delete_many({"email": {"$regex": f"^{TEST_PREFIX}"}})
        await c.login_attempts.delete_many({"email": {"$regex": f"^{TEST_PREFIX}"}})
        await c.character_drafts.delete_many({"owner_email": {"$regex": f"^{TEST_PREFIX}"}})
        await c.characters.delete_many({"owner_email": {"$regex": f"^{TEST_PREFIX}"}})
    asyncio.new_event_loop().run_until_complete(_do())


@pytest.fixture(autouse=True)
def _wrap():
    _cleanup()
    yield
    _cleanup()


def _maestro_token():
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": MAESTRO_EMAIL, "password": MAESTRO_PASS, "remember_me": False,
    }, timeout=10)
    return r.json()["token"]


def _create_player(email_local: str, role: str = "jugador") -> dict:
    """Register + approve a user. Returns {token, id, email, password}."""
    email = f"{TEST_PREFIX}{email_local}@example.com"
    pwd = "test1234"
    reg = requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": email_local, "password": pwd,
        "requested_role": role,
    }, timeout=10)
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["id"]
    h = {"Authorization": f"Bearer {_maestro_token()}"}
    requests.patch(f"{BASE}/api/auth/users/{user_id}", json={
        "status": "aprobado", "role": role,
    }, headers=h, timeout=10)
    login = requests.post(f"{BASE}/api/auth/login", json={
        "email": email, "password": pwd, "remember_me": False,
    }, timeout=10)
    return {
        "id": user_id,
        "email": email,
        "token": login.json()["token"],
    }


# ----- Maestro Supremo protegido -----

def test_maestro_supremo_is_marked_protected():
    h = {"Authorization": f"Bearer {_maestro_token()}"}
    r = requests.get(f"{BASE}/api/auth/users", headers=h, timeout=10)
    me = next(u for u in r.json() if u["email"] == MAESTRO_EMAIL)
    assert me["is_protected"] is True
    other = next((u for u in r.json() if u["email"] != MAESTRO_EMAIL), None)
    if other:
        assert other["is_protected"] is False


def test_maestro_supremo_role_cannot_be_changed():
    h = {"Authorization": f"Bearer {_maestro_token()}"}
    users = requests.get(f"{BASE}/api/auth/users", headers=h, timeout=10).json()
    me_id = next(u["id"] for u in users if u["email"] == MAESTRO_EMAIL)
    r = requests.patch(f"{BASE}/api/auth/users/{me_id}", json={"role": "jugador"},
                       headers=h, timeout=10)
    # 403 (protegido) — el require_role(target=maestro) acepta entrar y luego
    # el bloqueo de email-semilla devuelve 403.
    assert r.status_code == 403, r.text


# ----- API nunca asigna rol "maestro" -----

def test_api_rejects_role_maestro_assignment():
    p = _create_player("noupgrade")
    h = {"Authorization": f"Bearer {_maestro_token()}"}
    r = requests.patch(f"{BASE}/api/auth/users/{p['id']}",
                       json={"role": "maestro"}, headers=h, timeout=10)
    assert r.status_code == 400, r.text


# ----- requested_role en registro -----

def test_requested_role_dj_is_stored():
    email = f"{TEST_PREFIX}wantdj@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": "Want DJ", "password": "test1234",
        "requested_role": "director_de_juego",
    }, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["requested_role"] == "director_de_juego"
    # role asignado por el sistema sigue siendo "jugador" hasta aprobación.
    assert body["role"] == "jugador"


def test_requested_role_invalid_falls_back_to_jugador():
    email = f"{TEST_PREFIX}badreq@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": "Bad Req", "password": "test1234",
        "requested_role": "maestro",  # ← prohibido
    }, timeout=10)
    assert r.status_code == 200
    assert r.json()["requested_role"] == "jugador"


# ----- Aislamiento de personajes -----

def test_player_only_sees_own_characters():
    a = _create_player("alice")
    b = _create_player("bob")
    # Alice crea draft + step1 mínimo + finalize NO posible sin datos completos,
    # así que sólo verificamos el listado de drafts y characters.
    da = requests.post(f"{BASE}/api/characters/draft",
                       headers={"Authorization": f"Bearer {a['token']}"}, timeout=10)
    assert da.status_code == 200, da.text
    # Bob no debe ver el draft de Alice.
    drafts_b = requests.get(f"{BASE}/api/characters/drafts",
                            headers={"Authorization": f"Bearer {b['token']}"}, timeout=10).json()
    assert all(d.get("owner_email") != a["email"] for d in drafts_b.get("drafts", []))
    # Alice ve su propio draft.
    drafts_a = requests.get(f"{BASE}/api/characters/drafts",
                            headers={"Authorization": f"Bearer {a['token']}"}, timeout=10).json()
    assert any(d.get("owner_email") == a["email"] for d in drafts_a.get("drafts", []))


def test_maestro_sees_all_characters():
    h_maestro = {"Authorization": f"Bearer {_maestro_token()}"}
    a = _create_player("forall")
    da = requests.post(f"{BASE}/api/characters/draft",
                       headers={"Authorization": f"Bearer {a['token']}"}, timeout=10)
    assert da.status_code == 200
    # Maestro debe ver el draft de Alice también.
    drafts_m = requests.get(f"{BASE}/api/characters/drafts",
                            headers=h_maestro, timeout=10).json()
    assert any(d.get("owner_email") == a["email"] for d in drafts_m.get("drafts", []))


def test_player_cannot_get_other_player_draft():
    a = _create_player("alpha")
    b = _create_player("beta")
    da = requests.post(f"{BASE}/api/characters/draft",
                       headers={"Authorization": f"Bearer {a['token']}"}, timeout=10).json()
    a_draft_id = da["id"]
    forbidden = requests.get(f"{BASE}/api/characters/draft/{a_draft_id}",
                             headers={"Authorization": f"Bearer {b['token']}"}, timeout=10)
    assert forbidden.status_code == 403, forbidden.text


# ----- Aislamiento de storage -----

def test_player_only_sees_own_storage_files():
    a = _create_player("storageA")
    files = requests.get(f"{BASE}/api/storage/list",
                         headers={"Authorization": f"Bearer {a['token']}"}, timeout=10).json()
    assert files.get("count", 0) == 0


def test_storage_endpoints_require_auth():
    r = requests.get(f"{BASE}/api/storage/list", timeout=10)
    assert r.status_code == 401
