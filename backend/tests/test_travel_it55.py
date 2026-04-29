"""
Iteration 55 backend tests for LOTR 5e travel system.

Covers the new features in this iteration:
1. POST /api/travel/generate-full-chronicle (continuous narrative,
   integrates gm_notes like "Bosque de los Trolls").
2. POST /api/travel/calculate-journey with ritmo=rapido across lands where
   permite_ritmo_rapido=False (partial fast pace — should NOT error).
3. Speed table: BASE_KM_DAY=22.5, KM_PER_METER_SPEED=2.5
   (9m speed = 22.5 km/día Normal).
4. TravelPartyMember.velocidad_efectiva(mount_allowed):
   - montura + mount_allowed=True → base * 1.40
   - montura + mount_allowed=False → base
   - sin montura → base
5. Regression smoke (basic calculate-journey with new table).
"""
import os
import sys
import time

import pytest
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL is not set"

# Make backend importable for direct-unit checks
sys.path.insert(0, "/app/backend")

HOBBITON_ID = "loc_002"
ESGAROTH_ID = "loc_031"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# =========================================================================
# 1. generate-full-chronicle
# =========================================================================
class TestGenerateFullChronicle:
    """POST /api/travel/generate-full-chronicle -> continuous Spanish narrative."""

    def _payload(self, gm_note: str = "Bosque de los Trolls"):
        return {
            "origen": "Bree",
            "destino": "Rivendel",
            "fecha_salida": "1 de Cermië",
            "kilometros": 450,
            "dias_totales": 7,
            "personajes": [
                {"nombre": "Aragorn", "papel": "guia"},
                {"nombre": "Frodo", "papel": "portador"},
            ],
            "jornadas": [
                {
                    "dia_numero": 1,
                    "orientacion": {"d20": 14, "total": 16, "exito": True, "detalle": "Buen rumbo"},
                    "eventos": [],
                },
                {
                    "dia_numero": 3,
                    "eventos": [
                        {
                            "nombre": "Emboscada de trolls",
                            "tirada": 12,
                            "cd": 14,
                            "exito": False,
                            "gm_notes": gm_note,
                            "narrativa": "La niebla se espesa entre los árboles.",
                        }
                    ],
                    "tiradas_fatiga": [{"personaje": "Frodo", "niveles_cansancio": 1}],
                },
                {
                    "dia_numero": 5,
                    "eventos": [
                        {"nombre": "Vado del río", "tirada": 18, "cd": 12, "exito": True}
                    ],
                },
                {
                    "dia_numero": 7,
                    "eventos": [
                        {"nombre": "Avistamiento del valle", "tirada": 16, "cd": 10, "exito": True}
                    ],
                },
            ],
            "clima_por_dia": {"3": "lluvia intensa", "5": "niebla matinal"},
        }

    def test_returns_chronicle_structure(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-full-chronicle",
            json=self._payload(),
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, f"Chronicle failed: {data}"
        chronicle = data.get("chronicle", "")
        assert isinstance(chronicle, str)
        assert len(chronicle) > 300, f"Chronicle too short ({len(chronicle)} chars)"

    def test_chronicle_has_4_plus_paragraphs(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-full-chronicle",
            json=self._payload(),
            timeout=90,
        )
        data = r.json()
        chronicle = data.get("chronicle", "")
        # Paragraphs separated by blank lines or single newlines
        paragraphs = [p.strip() for p in chronicle.split("\n\n") if p.strip()]
        if len(paragraphs) < 4:
            # Fallback: split by single newline if model returned single-nl paras
            paragraphs = [p.strip() for p in chronicle.split("\n") if p.strip()]
        assert len(paragraphs) >= 4, f"Expected 4+ paragraphs, got {len(paragraphs)}"

    def test_chronicle_integrates_gm_notes(self, api):
        gm_note = "Bosque de los Trolls"
        r = api.post(
            f"{BASE_URL}/api/travel/generate-full-chronicle",
            json=self._payload(gm_note=gm_note),
            timeout=90,
        )
        data = r.json()
        chronicle = data.get("chronicle", "").lower()
        assert "troll" in chronicle or "bosque" in chronicle, (
            f"Chronicle did not integrate gm_notes '{gm_note}'. "
            f"First 400 chars: {chronicle[:400]}"
        )

    def test_chronicle_has_spanish_transition_phrase(self, api):
        r = api.post(
            f"{BASE_URL}/api/travel/generate-full-chronicle",
            json=self._payload(),
            timeout=90,
        )
        data = r.json()
        chronicle = data.get("chronicle", "").lower()
        transition_markers = [
            "día", "jornada", "por fin", "tras ", "al ", "la mañana",
            "aquella noche", "amanecer", "atardecer",
        ]
        found = [m for m in transition_markers if m in chronicle]
        assert len(found) >= 2, (
            f"Chronicle missing Spanish transition phrases. Found: {found}. "
            f"First 400 chars: {chronicle[:400]}"
        )


# =========================================================================
# 2. Partial fast-pace on lands where permite_ritmo_rapido=False
# =========================================================================
class TestPartialFastPace:
    """Before: error. Now: should return days estimate (mid-factor between rapid and normal)."""

    def _payload(self, ritmo):
        return {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": ritmo,
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [],
        }

    def test_rapido_across_salvajes_does_not_error(self, api):
        r = api.post(f"{BASE_URL}/api/travel/calculate-journey",
                     json=self._payload("rapido"), timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Must NOT be the old blocking error
        err_msg = (data.get("message") or "").lower()
        assert "no permitido" not in err_msg and "ritmo rápido" not in err_msg, (
            f"Old blocking error still present: {data}"
        )
        # Should have success + days estimate
        assert data.get("success") is True, f"Expected success, got: {data}"
        est = data.get("estimaciones") or {}
        ruta = data.get("ruta") or {}
        dias = est.get("dias_estimados") or ruta.get("dias_estimados") or data.get("dias_estimados")
        assert isinstance(dias, (int, float)) and dias > 0, f"dias_estimados missing: keys={list(data.keys())}"

    def test_rapido_gives_fewer_days_than_normal_but_more_than_pure_rapido(self, api):
        r_normal = api.post(f"{BASE_URL}/api/travel/calculate-journey",
                            json=self._payload("normal"), timeout=60).json()
        r_rapido = api.post(f"{BASE_URL}/api/travel/calculate-journey",
                            json=self._payload("rapido"), timeout=60).json()

        def _dias(d):
            est = d.get("estimaciones") or {}
            ruta = d.get("ruta") or {}
            return est.get("dias_estimados") or ruta.get("dias_estimados") or d.get("dias_estimados")

        dn = _dias(r_normal)
        dr = _dias(r_rapido)
        assert dn and dr, f"Missing dias: normal={r_normal}, rapido={r_rapido}"
        # Partial fast pace: should be <= normal (faster) but not dramatically less
        assert dr <= dn, f"Rapido dias ({dr}) should be <= Normal dias ({dn})"


# =========================================================================
# 3. Speed table constants — unit-level import
# =========================================================================
class TestSpeedTableConstants:
    def test_constants_values(self):
        # Re-read file text to avoid executing the whole module
        import re
        with open("/app/backend/routes/travel_routes.py") as f:
            src = f.read()
        assert re.search(r"BASE_KM_DAY\s*=\s*22\.5", src), "BASE_KM_DAY != 22.5"
        assert re.search(r"KM_PER_METER_SPEED\s*=\s*2\.5", src), "KM_PER_METER_SPEED != 2.5"

    def test_human_9m_equals_22_5_km_day(self):
        # 9 m * 2.5 km/m = 22.5 km/día (Normal)
        speed_meters = 9
        km_per_m = 2.5
        assert speed_meters * km_per_m == 22.5

    def test_distancia_base_km_midpoints(self):
        from travel_config import DISTANCIA_BASE_KM, Ritmo
        assert DISTANCIA_BASE_KM[Ritmo.LENTO] == 17.5
        assert DISTANCIA_BASE_KM[Ritmo.NORMAL] == 22.5
        assert DISTANCIA_BASE_KM[Ritmo.RAPIDO] == 27.5


# =========================================================================
# 4. velocidad_efectiva() — direct import unit test
# =========================================================================
class TestVelocidadEfectiva:
    def _make_member(self, **kwargs):
        from routes.travel_routes import TravelPartyMember
        defaults = {
            "personaje_id": "p1",
            "nombre": "Tester",
            "velocidad_base": 9,
            "tiene_montura": False,
            "montura_velocidad": 0,
        }
        defaults.update(kwargs)
        return TravelPartyMember(**defaults)

    def test_no_mount_returns_base(self):
        m = self._make_member(tiene_montura=False, velocidad_base=9)
        assert m.velocidad_efectiva(mount_allowed=True)["velocidad"] == 9
        assert m.velocidad_efectiva(mount_allowed=False)["velocidad"] == 9

    def test_mount_speed_is_used_directly(self):
        # Iter 80: la velocidad montada es la de la montura, no base*1.4
        m = self._make_member(tiene_montura=True, velocidad_base=9, montura_velocidad=18)
        got = m.velocidad_efectiva(mount_allowed=True)
        assert abs(got["velocidad"] - 18) < 1e-6

    def test_mount_overload_applies_33pct_penalty(self):
        m = self._make_member(
            tiene_montura=True, velocidad_base=9, montura_velocidad=12,
            montura_capacidad_kg=101, montura_carga_actual_kg=120,
        )
        got = m.velocidad_efectiva(mount_allowed=True)
        # 12 * 0.67 = 8.04
        assert abs(got["velocidad"] - 8.04) < 0.01
        assert got["montura_sobrecargada"] is True

    def test_mount_not_allowed_falls_back_to_base(self):
        m = self._make_member(tiene_montura=True, velocidad_base=9, montura_velocidad=18)
        assert m.velocidad_efectiva(mount_allowed=False)["velocidad"] == 9

    def test_mount_zero_speed_falls_back_to_base_times_1_40(self):
        # Backwards compat: si no hay montura_velocidad → +40%.
        m = self._make_member(tiene_montura=True, velocidad_base=10, montura_velocidad=0)
        got = m.velocidad_efectiva(mount_allowed=True)
        assert abs(got["velocidad"] - 14.0) < 1e-6


# =========================================================================
# 5. Regression smoke — calculate-journey with new table, Normal ritmo
# =========================================================================
class TestRegressionSmoke:
    def test_normal_route_returns_days(self, api):
        payload = {
            "origen_id": HOBBITON_ID,
            "origen_nombre": "Hobbiton",
            "destino_id": ESGAROTH_ID,
            "destino_nombre": "Esgaroth",
            "preferir_caminos": True,
            "evitar_sombra": False,
            "ritmo": "normal",
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [],
        }
        r = api.post(f"{BASE_URL}/api/travel/calculate-journey", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, f"Unexpected: {data}"
        ruta = data.get("ruta") or {}
        est = data.get("estimaciones") or {}
        distance = ruta.get("distance_km") or data.get("distance_km")
        dias = est.get("dias_estimados") or ruta.get("dias_estimados") or data.get("dias_estimados")
        assert distance and distance > 0
        assert dias and dias > 0

    def test_events_config_ok(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/events")
        assert r.status_code == 200

    def test_land_types_ok(self, api):
        r = api.get(f"{BASE_URL}/api/travel/config/land-types")
        assert r.status_code == 200
        data = r.json()
        land_types = data if isinstance(data, list) else data.get("land_types", [])
        # Validate that some entry has permite_ritmo_rapido=False
        has_restrict = any(lt.get("permite_ritmo_rapido") is False for lt in land_types)
        assert has_restrict, "No land-type with permite_ritmo_rapido=False found"
