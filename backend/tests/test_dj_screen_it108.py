"""DJ Screen backend tests (P0 portrait + DJ dashboard feature, iteration 108).

Covers:
  - GET dj-screen as Maestro/DM (200 + can_edit true)
  - PUT dj-screen as Maestro (200, persisted)
  - sync-players (200, idempotent)
  - chat post + list (group), peers
  - 403 for non-member (a fresh approved jugador NOT joined to the run)
  - 403 for PUT from non-DM
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

DM_EMAIL = "elanillounico_tlotr@proton.me"
DM_PASS = "123456"
RUN_ID = "fdc6fc7d-0a17-4392-a398-a8c4b634bfb6"
CHAR_ID = "c16a362d-9841-4954-8f70-0dfe02dfe303"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password, "remember_me": True}, timeout=15)
    if r.status_code != 200:
        return None
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def dm_token():
    t = _login(DM_EMAIL, DM_PASS)
    assert t, "Login Maestro failed"
    return t


@pytest.fixture(scope="module")
def dm_headers(dm_token):
    return {"Authorization": f"Bearer {dm_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def stranger_token():
    """Register + auto-approve via Maestro a brand-new user who is NOT a member of the run."""
    suffix = uuid.uuid4().hex[:8]
    email = f"qa_stranger_{suffix}@example.com"
    pwd = "Stranger123!"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pwd,
        "nombre": f"Stranger {suffix}", "name": f"Stranger {suffix}"
    }, timeout=15)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    # Approve via Maestro
    dm = _login(DM_EMAIL, DM_PASS)
    h = {"Authorization": f"Bearer {dm}"}
    # Find user id
    ulist = requests.get(f"{API}/auth/users", headers=h, timeout=15)
    assert ulist.status_code == 200, ulist.text
    target = next((u for u in ulist.json() if u.get("email") == email), None)
    assert target, f"User {email} not in /auth/users"
    uid_ = target["id"]
    # Approve
    pr = requests.patch(f"{API}/auth/users/{uid_}", json={"status": "aprobado", "role": "jugador"}, headers=h, timeout=15)
    assert pr.status_code == 200, f"approval failed: {pr.status_code} {pr.text}"
    # Login as stranger
    tok = _login(email, pwd)
    assert tok, "Stranger login failed"
    return tok


# -------------------- DM/Maestro flows --------------------
class TestDJScreenAsMaestro:
    def test_get_dj_screen(self, dm_headers):
        r = requests.get(f"{API}/campaign-runs/{RUN_ID}/dj-screen", headers=dm_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["can_edit"] is True
        assert d["is_player"] is False
        assert "state" in d
        assert "combatants" in d["state"]
        assert "notes_private" in d["state"]

    def test_put_dj_screen_persists(self, dm_headers):
        marker = f"QA notes {uuid.uuid4().hex[:6]}"
        payload = {
            "scene_image_file_id": None,
            "notes_private": marker,
            "combatants": [],
            "current_turn_index": 0,
            "round_number": 1,
        }
        r = requests.put(f"{API}/campaign-runs/{RUN_ID}/dj-screen", json=payload, headers=dm_headers, timeout=15)
        assert r.status_code == 200, r.text
        # Verify via GET
        r2 = requests.get(f"{API}/campaign-runs/{RUN_ID}/dj-screen", headers=dm_headers, timeout=15)
        assert r2.json()["state"]["notes_private"] == marker

    def test_sync_players_idempotent(self, dm_headers):
        r1 = requests.post(f"{API}/campaign-runs/{RUN_ID}/dj-screen/sync-players", headers=dm_headers, timeout=20)
        assert r1.status_code == 200, r1.text
        added1 = r1.json().get("added", 0)
        # second call should add 0
        r2 = requests.post(f"{API}/campaign-runs/{RUN_ID}/dj-screen/sync-players", headers=dm_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("added", 0) == 0, "sync-players is not idempotent"
        # combatants should include at least 1 player after first sync (if not already)
        state = r2.json().get("state", {})
        players = [c for c in state.get("combatants", []) if c.get("type") == "player"]
        assert len(players) >= 1 or added1 == 0  # ok if was already synced

    def test_chat_group_post_and_get(self, dm_headers):
        marker = f"hola mundo {uuid.uuid4().hex[:6]}"
        rp = requests.post(f"{API}/campaign-runs/{RUN_ID}/chat",
                           json={"channel": "group", "text": marker},
                           headers=dm_headers, timeout=15)
        assert rp.status_code == 201, rp.text
        rg = requests.get(f"{API}/campaign-runs/{RUN_ID}/chat?channel=group", headers=dm_headers, timeout=15)
        assert rg.status_code == 200, rg.text
        msgs = rg.json()
        assert any(m.get("text") == marker for m in msgs), "Posted msg not retrieved"

    def test_chat_peers_as_dm(self, dm_headers):
        r = requests.get(f"{API}/campaign-runs/{RUN_ID}/chat/peers", headers=dm_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_dm"] is True
        assert isinstance(d["peers"], list)

    def test_portrait_endpoint(self, dm_headers):
        r = requests.get(f"{API}/campaign-runs/{RUN_ID}/dj-screen/portrait/{CHAR_ID}",
                         headers=dm_headers, timeout=15)
        # Either 200 (image bytes) or 404 (sin retrato) — both are valid auth-wise.
        assert r.status_code in (200, 404), r.text


# -------------------- Forbidden access (non-member) --------------------
class TestDJScreenForbidden:
    def test_get_403_for_stranger(self, stranger_token):
        h = {"Authorization": f"Bearer {stranger_token}"}
        r = requests.get(f"{API}/campaign-runs/{RUN_ID}/dj-screen", headers=h, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_put_403_for_stranger(self, stranger_token):
        h = {"Authorization": f"Bearer {stranger_token}", "Content-Type": "application/json"}
        payload = {"scene_image_file_id": None, "notes_private": "x",
                   "combatants": [], "current_turn_index": 0, "round_number": 1}
        r = requests.put(f"{API}/campaign-runs/{RUN_ID}/dj-screen", json=payload, headers=h, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_chat_post_403_for_stranger(self, stranger_token):
        h = {"Authorization": f"Bearer {stranger_token}", "Content-Type": "application/json"}
        r = requests.post(f"{API}/campaign-runs/{RUN_ID}/chat",
                          json={"channel": "group", "text": "intruder"}, headers=h, timeout=15)
        assert r.status_code == 403
