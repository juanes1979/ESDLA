"""
Backend regression tests for DJ Screen Phase 5 + 6:
- Roll dice endpoint (valid faces, invalid faces 400, shared -> group chat msg)
- Shadow event (random text + +1 sombra to all accepted heroes + group narration)
- apply-shadow (adds N shadow + narration)
- eye-increment (delta -> attention_total change, will_trigger)
- GET /campaign-runs/{run_id}/eye as DM
- PUT dj-screen persists tokens[] and actions_remaining; GET returns them
- Permission control: non-DM player can NOT call apply-shadow/eye-increment/shadow-event (403).
  roll-dice IS allowed for accepted players.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to canonical config location; test will hard-fail if missing
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASSWORD = "123456"
RUN_ID = "750ac72b-f208-4c9e-b897-204b2faccf59"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def maestro_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": MAESTRO_EMAIL, "password": MAESTRO_PASSWORD, "remember_me": True},
        timeout=20,
    )
    assert r.status_code == 200, f"Login maestro failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def maestro_headers(maestro_token):
    return {"Authorization": f"Bearer {maestro_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def stranger_headers():
    """Ephemeral 'jugador' user not member of the run — used for 403 tests."""
    email = f"qa_stranger_p56_{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "QA Stranger P56", "nombre": "QA Stranger P56"},
        timeout=20,
    )
    assert r.status_code in (200, 201), f"register: {r.status_code} {r.text}"

    # Maestro logs in and approves the pending user
    mr = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": MAESTRO_EMAIL, "password": MAESTRO_PASSWORD, "remember_me": True},
        timeout=20,
    ).json()
    mtok = mr["token"]
    users = requests.get(
        f"{BASE_URL}/api/auth/users", headers={"Authorization": f"Bearer {mtok}"}, timeout=20
    ).json()
    uid = None
    for u in users:
        if u.get("email") == email:
            uid = u.get("id")
            break
    if uid:
        ar = requests.patch(
            f"{BASE_URL}/api/auth/users/{uid}",
            headers={"Authorization": f"Bearer {mtok}", "Content-Type": "application/json"},
            json={"status": "aprobado", "role": "jugador"},
            timeout=20,
        )
        assert ar.status_code == 200, f"approval failed: {ar.status_code} {ar.text}"

    # Login as new user
    lr = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=20,
    )
    assert lr.status_code == 200, f"stranger login: {lr.status_code} {lr.text}"
    return {"Authorization": f"Bearer {lr.json()['token']}", "Content-Type": "application/json"}


# ---------- Roll dice ----------
class TestRollDice:
    def test_valid_d20_private(self, maestro_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/roll-dice",
            headers=maestro_headers,
            json={"faces": 20, "count": 1, "modifier": 2, "shared": False, "label": "Prueba"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["rolls"], list) and len(d["rolls"]) == 1
        assert 1 <= d["rolls"][0] <= 20
        assert d["total"] == d["rolls"][0] + 2
        assert d["notation"] == "1d20 +2"

    def test_multi_dice_and_modifier_negative(self, maestro_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/roll-dice",
            headers=maestro_headers,
            json={"faces": 6, "count": 3, "modifier": -1, "shared": False},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["rolls"]) == 3
        assert all(1 <= x <= 6 for x in d["rolls"])
        assert d["total"] == sum(d["rolls"]) - 1

    def test_invalid_faces_400(self, maestro_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/roll-dice",
            headers=maestro_headers,
            json={"faces": 7, "count": 1, "modifier": 0, "shared": False},
            timeout=20,
        )
        assert r.status_code == 400, r.text

    def test_shared_inserts_group_chat(self, maestro_headers):
        marker = f"QA-DICE-{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/roll-dice",
            headers=maestro_headers,
            json={"faces": 20, "count": 1, "modifier": 0, "shared": True, "label": marker},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        time.sleep(0.4)
        chat = requests.get(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/chat?channel=group",
            headers=maestro_headers, timeout=20,
        )
        assert chat.status_code == 200
        msgs = chat.json()
        assert any(marker in (m.get("text") or "") for m in msgs), "system dice msg missing in group chat"

    def test_stranger_403(self, stranger_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/roll-dice",
            headers=stranger_headers,
            json={"faces": 20, "count": 1, "modifier": 0, "shared": False},
            timeout=20,
        )
        assert r.status_code == 403, r.text


# ---------- Shadow event / apply-shadow ----------
class TestShadowAndEye:
    def _get_hero_shadow(self, headers):
        r = requests.get(f"{BASE_URL}/api/campaign-runs/{RUN_ID}", headers=headers, timeout=20)
        assert r.status_code == 200
        return r.json()

    def test_apply_shadow_and_narrates(self, maestro_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/apply-shadow",
            headers=maestro_headers,
            json={"amount": 1, "reason": "QA it109"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "affected" in data
        assert isinstance(data["affected"], list)
        assert len(data["affected"]) >= 1
        for a in data["affected"]:
            assert "puntos_sombra" in a and "name" in a
        # Narration in group chat
        time.sleep(0.4)
        chat = requests.get(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/chat?channel=group",
            headers=maestro_headers, timeout=20,
        ).json()
        assert any("Sombra" in (m.get("text") or "") and "QA it109" in (m.get("text") or "") for m in chat)

    def test_shadow_event_random_text(self, maestro_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/shadow-event",
            headers=maestro_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("texto")
        assert isinstance(data.get("affected"), list)

    def test_apply_shadow_stranger_403(self, stranger_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/apply-shadow",
            headers=stranger_headers,
            json={"amount": 1, "reason": "hack"},
            timeout=20,
        )
        assert r.status_code == 403, r.text

    def test_shadow_event_stranger_403(self, stranger_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/shadow-event",
            headers=stranger_headers,
            timeout=20,
        )
        assert r.status_code == 403, r.text

    def test_eye_get_as_dm(self, maestro_headers):
        r = requests.get(f"{BASE_URL}/api/campaign-runs/{RUN_ID}/eye", headers=maestro_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("attention_total", "threshold_info", "ratio", "will_trigger", "band"):
            assert k in d, f"missing {k} in eye payload: {d}"
        assert isinstance(d["attention_total"], int)
        assert isinstance(d["will_trigger"], bool)
        assert isinstance(d["band"], str)

    def test_eye_increment_delta_changes_total(self, maestro_headers):
        before = requests.get(f"{BASE_URL}/api/campaign-runs/{RUN_ID}/eye", headers=maestro_headers, timeout=20).json()
        prev_total = before["attention_total"]
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/eye-increment",
            headers=maestro_headers,
            json={"delta": 2, "descripcion": "QA test increment"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        after = requests.get(f"{BASE_URL}/api/campaign-runs/{RUN_ID}/eye", headers=maestro_headers, timeout=20).json()
        assert after["attention_total"] == prev_total + 2, (prev_total, after["attention_total"])

    def test_eye_increment_stranger_403(self, stranger_headers):
        r = requests.post(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen/eye-increment",
            headers=stranger_headers,
            json={"delta": 1, "descripcion": "hack"},
            timeout=20,
        )
        assert r.status_code == 403, r.text


# ---------- DjScreen State persistence for tokens + actions_remaining ----------
class TestScreenPersistence:
    def test_put_and_get_tokens_and_actions(self, maestro_headers):
        # First read current
        r0 = requests.get(f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen", headers=maestro_headers, timeout=20)
        assert r0.status_code == 200, r0.text
        cur = r0.json()
        prev = cur.get("state") or cur
        combatants = prev.get("combatants", [])

        tokens = [
            {"id": f"tk_{uuid.uuid4().hex[:6]}", "label": "Regred", "x": 0.42, "y": 0.51, "kind": "hero"},
            {"id": f"tk_{uuid.uuid4().hex[:6]}", "label": "Marca", "x": 0.7, "y": 0.7, "kind": "marker"},
        ]
        payload = {
            "combatants": combatants,
            "current_turn_index": prev.get("current_turn_index", 0),
            "round_number": prev.get("round_number", 1),
            "combat_active": prev.get("combat_active", False),
            "notes_private": prev.get("notes_private", ""),
            "actions_remaining": 5,
            "tokens": tokens,
        }
        r1 = requests.put(
            f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen",
            headers=maestro_headers,
            json=payload,
            timeout=20,
        )
        assert r1.status_code == 200, r1.text

        r2 = requests.get(f"{BASE_URL}/api/campaign-runs/{RUN_ID}/dj-screen", headers=maestro_headers, timeout=20)
        assert r2.status_code == 200
        st = r2.json()
        st = st.get("state") or st
        assert st.get("actions_remaining") == 5, st
        got_tokens = st.get("tokens") or []
        assert len(got_tokens) == 2, got_tokens
        got_ids = {t["id"] for t in got_tokens}
        assert got_ids == {t["id"] for t in tokens}
        # Coords roundtrip preserved
        by_id = {t["id"]: t for t in got_tokens}
        for t in tokens:
            assert abs(by_id[t["id"]]["x"] - t["x"]) < 1e-6
            assert abs(by_id[t["id"]]["y"] - t["y"]) < 1e-6
            assert by_id[t["id"]]["kind"] == t["kind"]
