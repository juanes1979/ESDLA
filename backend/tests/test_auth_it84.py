"""
Auth regression tests (Iter 84) — register / login (with pending approval gate) /
token verification / role-protected endpoints / brute-force lockout.

Tests run against the LIVE backend (REACT_APP_BACKEND_URL) using `requests`,
matching the pattern of the other tests in this directory.
"""
import os
import asyncio
import time

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"
TEST_PREFIX = "auth_test_it84_"


def _cleanup_test_users():
    async def _do():
        c = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
        await c.users.delete_many({"email": {"$regex": f"^{TEST_PREFIX}"}})
        await c.login_attempts.delete_many({"email": {"$regex": f"^{TEST_PREFIX}"}})
    asyncio.new_event_loop().run_until_complete(_do())


@pytest.fixture(autouse=True)
def _cleanup():
    _cleanup_test_users()
    yield
    _cleanup_test_users()


def _login_maestro():
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": MAESTRO_EMAIL, "password": MAESTRO_PASS, "remember_me": False,
    }, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_login_maestro_returns_token():
    r = requests.post(f"{BASE}/api/auth/login", json={
        "email": MAESTRO_EMAIL, "password": MAESTRO_PASS, "remember_me": False,
    }, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body
    assert body["user"]["role"] == "maestro"
    assert body["user"]["status"] == "aprobado"


def test_register_creates_pending_and_blocks_login():
    email = f"{TEST_PREFIX}pending@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": "Pending Joe", "password": "password123",
    }, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pendiente"
    r2 = requests.post(f"{BASE}/api/auth/login", json={
        "email": email, "password": "password123", "remember_me": False,
    }, timeout=10)
    assert r2.status_code == 403, r2.text


def test_approve_then_login_works():
    email = f"{TEST_PREFIX}approve@example.com"
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": "Approve Me", "password": "secret123",
    }, timeout=10)
    user_id = r.json()["id"]
    headers = {"Authorization": f"Bearer {_login_maestro()}"}
    upd = requests.patch(f"{BASE}/api/auth/users/{user_id}", json={
        "status": "aprobado", "role": "director_de_juego",
    }, headers=headers, timeout=10)
    assert upd.status_code == 200, upd.text
    assert upd.json()["role"] == "director_de_juego"
    login = requests.post(f"{BASE}/api/auth/login", json={
        "email": email, "password": "secret123", "remember_me": True,
    }, timeout=10)
    assert login.status_code == 200, login.text
    assert login.json()["user"]["role"] == "director_de_juego"
    assert login.json()["remember_me"] is True


def test_users_list_requires_maestro():
    email = f"{TEST_PREFIX}player@example.com"
    requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": "Player Joe", "password": "secret123",
    }, timeout=10)
    maestro_headers = {"Authorization": f"Bearer {_login_maestro()}"}
    users = requests.get(f"{BASE}/api/auth/users", headers=maestro_headers, timeout=10).json()
    user_id = next(u["id"] for u in users if u["email"] == email)
    requests.patch(f"{BASE}/api/auth/users/{user_id}", json={"status": "aprobado", "role": "jugador"},
                   headers=maestro_headers, timeout=10)
    p = requests.post(f"{BASE}/api/auth/login", json={
        "email": email, "password": "secret123", "remember_me": False,
    }, timeout=10)
    player_token = p.json()["token"]
    forbidden = requests.get(f"{BASE}/api/auth/users",
                             headers={"Authorization": f"Bearer {player_token}"}, timeout=10)
    assert forbidden.status_code == 403, forbidden.text


def test_invalid_password_eventually_locks_out():
    email = f"{TEST_PREFIX}lockout@example.com"
    requests.post(f"{BASE}/api/auth/register", json={
        "email": email, "name": "Locky", "password": "correct123",
    }, timeout=10)
    maestro_headers = {"Authorization": f"Bearer {_login_maestro()}"}
    users = requests.get(f"{BASE}/api/auth/users", headers=maestro_headers, timeout=10).json()
    user_id = next(u["id"] for u in users if u["email"] == email)
    requests.patch(f"{BASE}/api/auth/users/{user_id}", json={"status": "aprobado"},
                   headers=maestro_headers, timeout=10)
    for _ in range(5):
        r = requests.post(f"{BASE}/api/auth/login", json={
            "email": email, "password": "wrong", "remember_me": False,
        }, timeout=10)
        assert r.status_code == 401, r.text
    r6 = requests.post(f"{BASE}/api/auth/login", json={
        "email": email, "password": "wrong", "remember_me": False,
    }, timeout=10)
    assert r6.status_code == 429, r6.text


def test_me_endpoint_with_valid_token():
    token = _login_maestro()
    r = requests.get(f"{BASE}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["email"] == MAESTRO_EMAIL


def test_me_without_token_returns_401():
    r = requests.get(f"{BASE}/api/auth/me", timeout=10)
    assert r.status_code == 401
