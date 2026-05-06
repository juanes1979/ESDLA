"""
Tests for new Rest endpoints (Iteration 65):
- POST /api/characters/{id}/rest/short
- POST /api/characters/{id}/rest/long
Plus regression on:
- POST /api/travel/resolve-event
- PATCH /api/characters/{id}/hp
- PATCH /api/characters/{id}/shadow
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://travel-chronicles-6.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def character(session):
    """Pick the first character available."""
    r = session.get(f"{API}/characters/", timeout=30)
    assert r.status_code == 200, f"GET /api/characters/ failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    chars = data.get("characters") or data
    assert isinstance(chars, list) and len(chars) > 0, "No characters available"
    return chars[0]


@pytest.fixture(scope="module")
def character_id(character):
    cid = character.get("_id") or character.get("id")
    assert cid, f"Character has no id: {list(character.keys())[:10]}"
    return cid


def _get_character(session, cid):
    r = session.get(f"{API}/characters/{cid}", timeout=30)
    assert r.status_code == 200
    return r.json()


def _full_reset(session, cid):
    """Long rest restores HP to max, recovers dice, fatigue -1. Call until stable."""
    for _ in range(3):
        r = session.post(f"{API}/characters/{cid}/rest/long", timeout=30)
        assert r.status_code == 200
    return r.json()


def _set_hp_to(session, cid, target_hp):
    """Set HP using PATCH /hp by computing delta."""
    ch = _get_character(session, cid)
    cur = int(ch.get("puntos_golpe_actual", 0) or 0)
    delta = target_hp - cur
    if delta != 0:
        r = session.patch(f"{API}/characters/{cid}/hp",
                          json={"hp_change": delta}, timeout=30)
        assert r.status_code == 200


# ============== SHORT REST ==============

class TestShortRest:
    def test_short_rest_basic_heal(self, session, character_id):
        # Reset state via long rest, then damage HP
        _full_reset(session, character_id)
        ch = _get_character(session, character_id)
        nivel = max(1, int(ch.get("nivel", 1) or 1))
        pg_max = int(ch.get("puntos_golpe_max", 10) or 10)
        low_hp = max(1, pg_max - 5)
        _set_hp_to(session, character_id, low_hp)

        r = session.post(f"{API}/characters/{character_id}/rest/short",
                         json={"dice_to_spend": 1}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()

        assert data["tipo"] == "descanso_corto"
        assert data["dados_gastados"] == 1
        assert isinstance(data["rolls"], list) and len(data["rolls"]) == 1
        assert data["pg_anterior"] == low_hp
        assert data["pg_actual"] >= low_hp
        assert data["pg_actual"] <= pg_max
        assert data["dados_disponibles_restantes"] == nivel - 1

        ch2 = _get_character(session, character_id)
        assert ch2["puntos_golpe_actual"] == data["pg_actual"]
        assert ch2.get("dados_golpe_gastados", 0) == 1

    def test_short_rest_caps_at_max_hp(self, session, character_id):
        _full_reset(session, character_id)
        ch = _get_character(session, character_id)
        pg_max = int(ch.get("puntos_golpe_max", 10) or 10)
        # HP is at max after long rest
        r = session.post(f"{API}/characters/{character_id}/rest/short",
                         json={"dice_to_spend": 1}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["pg_actual"] == pg_max, "HP should not exceed max"
        assert data["pg_anterior"] == pg_max

    def test_short_rest_clamps_to_available(self, session, character_id):
        """If asking for more dice than available, it must clamp; never go negative."""
        _full_reset(session, character_id)
        ch = _get_character(session, character_id)
        nivel = max(1, int(ch.get("nivel", 1) or 1))
        # Spend all dice via short rest (clamped automatically)
        r0 = session.post(f"{API}/characters/{character_id}/rest/short",
                          json={"dice_to_spend": nivel}, timeout=30)
        assert r0.status_code == 200
        assert r0.json()["dados_disponibles_restantes"] == 0

        # Now attempt to spend more — must clamp to 0
        r = session.post(f"{API}/characters/{character_id}/rest/short",
                         json={"dice_to_spend": 999}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dados_gastados"] == 0, f"Expected 0 (no dice left), got {data['dados_gastados']}"
        assert data["dados_disponibles_restantes"] == 0
        assert data["rolls"] == []

        ch2 = _get_character(session, character_id)
        # Never negative or > level
        assert 0 <= ch2.get("dados_golpe_gastados", 0) <= nivel

    def test_short_rest_zero_dice_no_change(self, session, character_id):
        _full_reset(session, character_id)
        ch = _get_character(session, character_id)
        pg_max = int(ch.get("puntos_golpe_max", 10) or 10)
        _set_hp_to(session, character_id, max(1, pg_max - 3))
        before = _get_character(session, character_id)

        r = session.post(f"{API}/characters/{character_id}/rest/short",
                         json={"dice_to_spend": 0}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dados_gastados"] == 0
        assert data["curacion_total"] == 0
        assert data["rolls"] == []

        after = _get_character(session, character_id)
        assert after["puntos_golpe_actual"] == before["puntos_golpe_actual"]
        assert after.get("dados_golpe_gastados", 0) == before.get("dados_golpe_gastados", 0)

    def test_short_rest_negative_dice_clamps_to_zero(self, session, character_id):
        _full_reset(session, character_id)
        r = session.post(f"{API}/characters/{character_id}/rest/short",
                         json={"dice_to_spend": -5}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["dados_gastados"] == 0

    def test_short_rest_404_unknown_character(self, session):
        r = session.post(f"{API}/characters/non-existent-id-xyz/rest/short",
                         json={"dice_to_spend": 1}, timeout=30)
        assert r.status_code == 404


# ============== LONG REST ==============

class TestLongRest:
    def test_long_rest_full_heal_and_recovery(self, session, character_id):
        _full_reset(session, character_id)
        ch = _get_character(session, character_id)
        nivel = max(1, int(ch.get("nivel", 1) or 1))
        pg_max = int(ch.get("puntos_golpe_max", 10) or 10)

        # Spend dice (clamped) and damage HP
        r0 = session.post(f"{API}/characters/{character_id}/rest/short",
                          json={"dice_to_spend": nivel}, timeout=30)
        assert r0.status_code == 200
        spent_now = r0.json()["dados_gastados"]
        # Damage HP
        low_hp = max(1, pg_max // 2)
        _set_hp_to(session, character_id, low_hp)
        # Increase fatigue to 2 via PUT /fatigue
        rf = session.put(f"{API}/characters/{character_id}/fatigue",
                         json={"fatiga": 2.0}, timeout=30)
        assert rf.status_code == 200

        r = session.post(f"{API}/characters/{character_id}/rest/long", timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()

        assert data["tipo"] == "descanso_largo"
        assert data["pg_actual"] == pg_max, "Long rest must heal to full"
        assert data["pg_anterior"] == low_hp
        assert data["fatiga_anterior"] == 2.0
        assert data["fatiga_nueva"] == 1.0, "Fatigue should drop by 1"

        recuperar_esperado = max(1, nivel // 2)
        impl_expected = spent_now - max(0, spent_now - recuperar_esperado)
        assert data["dados_recuperados"] == impl_expected

        ch2 = _get_character(session, character_id)
        assert ch2["puntos_golpe_actual"] == pg_max
        assert ch2["fatiga"] == 1.0

    def test_long_rest_404_unknown_character(self, session):
        r = session.post(f"{API}/characters/non-existent-id-xyz/rest/long", timeout=30)
        assert r.status_code == 404


# ============== REGRESSION: PATCH hp / shadow ==============

class TestHpShadowRegression:
    def test_hp_negative_change(self, session, character_id):
        _full_reset(session, character_id)  # HP at max
        ch = _get_character(session, character_id)
        pg_max = int(ch.get("puntos_golpe_max", 10) or 10)
        r = session.patch(f"{API}/characters/{character_id}/hp",
                          json={"hp_change": -3}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["puntos_golpe_actual"] == max(0, pg_max - 3)

    def test_hp_clamp_floor_zero(self, session, character_id):
        _full_reset(session, character_id)
        r = session.patch(f"{API}/characters/{character_id}/hp",
                          json={"hp_change": -9999}, timeout=30)
        assert r.status_code == 200
        assert r.json()["puntos_golpe_actual"] == 0

    def test_shadow_positive_change(self, session, character_id):
        ch = _get_character(session, character_id)
        before = int(ch.get("puntos_sombra", 0) or 0)
        r = session.patch(f"{API}/characters/{character_id}/shadow",
                          json={"shadow_change": 1}, timeout=30)
        assert r.status_code == 200
        new = r.json()["puntos_sombra"]
        assert new == before + 1
        # restore
        session.patch(f"{API}/characters/{character_id}/shadow",
                      json={"shadow_change": -1}, timeout=30)


# ============== REGRESSION: travel/resolve-event ==============

class TestResolveEvent:
    """resolve-event uses query parameters (per route definition)."""

    def _post(self, session, params):
        return session.post(f"{API}/travel/resolve-event", params=params, timeout=30)

    def test_atajo_success_reduces_days(self, session):
        r = self._post(session, {
            "evento_id": "event_atajo",
            "tirada_resolucion": 20, "cd": 10, "exito": "true",
            "evento_nombre": "Atajo", "objetivo_papel": "guia", "personaje_nombre": "Test"
        })
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json()
        assert d.get("modificadores", {}).get("dias_reducidos") == 1

    def test_percance_failure_extra_days(self, session):
        r = self._post(session, {
            "evento_id": "event_percance",
            "tirada_resolucion": 1, "cd": 15, "exito": "false",
            "evento_nombre": "Percance"
        })
        assert r.status_code == 200
        d = r.json()
        mods = d.get("modificadores", {})
        assert mods.get("dias_extra") == 1
        assert mods.get("fatiga_cd_increase", 0) >= 2

    def test_desesperanza_failure_shadow(self, session):
        r = self._post(session, {
            "evento_id": "event_desesperanza",
            "tirada_resolucion": 1, "cd": 15, "exito": "false",
            "evento_nombre": "Desesperanza"
        })
        assert r.status_code == 200
        d = r.json()
        assert d.get("modificadores", {}).get("puntos_sombra", 0) >= 1

    def test_decisiones_failure_shadow(self, session):
        r = self._post(session, {
            "evento_id": "event_decisiones",
            "tirada_resolucion": 1, "cd": 15, "exito": "false",
            "evento_nombre": "Decisiones erroneas"
        })
        assert r.status_code == 200
        d = r.json()
        assert d.get("modificadores", {}).get("puntos_sombra", 0) >= 1

    def test_vista_success_inspiracion(self, session):
        r = self._post(session, {
            "evento_id": "event_vista",
            "tirada_resolucion": 20, "cd": 10, "exito": "true",
            "evento_nombre": "Vista agradable"
        })
        assert r.status_code == 200
        d = r.json()
        assert d.get("modificadores", {}).get("inspiracion") is True
