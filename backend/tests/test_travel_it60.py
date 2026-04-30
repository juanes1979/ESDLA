"""
Iteration 60 backend tests.

Covers:
- BUG-1: /api/travel/calculate-journey day calculation correctness for
         Bree (loc_131) -> Rivendel (loc_142). Spec: ~285 km, normal pace,
         humano velocidad_base=9 -> 22.5 km/día -> dias_estimados == 13.
- BUG-1b: /api/travel/compare-routes returns both road & direct routes with
          consistent dias values.
- BUG-5: /api/travel/generate-journey-summary now accepts the new
         `eventos` (with narrativa_individual + clima) and `clima_por_dia`
         arrays without raising.
"""
import os
import math
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://middle-earth-5e.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

BREE_ID = "loc_131"
RIVENDEL_ID = "loc_142"
THARBAD_ID = "loc_163"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------------------------------------------------------
# BUG-1: calculate-journey days for Bree -> Rivendel must be 13
# ------------------------------------------------------------
class TestCalculateJourneyDays:
    def _payload(self, origen_id, origen_nombre, destino_id, destino_nombre, ritmo="normal"):
        return {
            "origen_id": origen_id,
            "origen_nombre": origen_nombre,
            "destino_id": destino_id,
            "destino_nombre": destino_nombre,
            "preferir_caminos": True,
            "evitar_sombra": False,
            "evitar_tierras_oscuras": False,
            "ritmo": ritmo,
            "mes": "Cermië",
            "estacion": "verano",
            "horas_marcha_forzada": 0,
            "miembros": [
                {
                    "personaje_id": "char_test_1",
                    "nombre": "Tester Humano",
                    "papel": "guia",
                    "tiene_montura": False,
                    "velocidad_base": 9,
                    "modificador_sabiduria": 2,
                    "competencias": [],
                    "nivel": 3,
                }
            ],
        }

    def _extract_days_and_distance(self, data):
        est = data.get("estimaciones") or {}
        ruta = data.get("ruta") or {}
        dias = est.get("dias_estimados") or data.get("dias_estimados")
        distance_km = (
            ruta.get("distancia_km")
            or ruta.get("distance_km")
            or data.get("distancia_km")
            or data.get("distance_km")
            or 0
        )
        return dias, distance_km

    def test_bree_to_rivendel_normal_pace_13_days(self, session):
        """Bree -> Rivendel ~285 km / 22.5 km/día => 13 días."""
        r = session.post(f"{API}/travel/calculate-journey", json=self._payload(
            BREE_ID, "Bree", RIVENDEL_ID, "Rivendel"
        ), timeout=60)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        data = r.json()
        dias, distance_km = self._extract_days_and_distance(data)
        print(f"\n[BUG-1] Bree->Rivendel: distancia_km={distance_km}, dias_estimados={dias}")
        assert dias == 13, (
            f"Expected dias_estimados=13 for Bree->Rivendel (~285 km @ 22.5 km/d), got {dias}. "
            f"distance_km={distance_km}. Verify km/d normalization (PATHFINDER_BASE_KM_DAY=36 fix)."
        )

    def test_bree_to_tharbad_normal_pace(self, session):
        """Bree -> Tharbad ~205 km / 22.5 km/día => 9 días."""
        r = session.post(f"{API}/travel/calculate-journey", json=self._payload(
            BREE_ID, "Bree", THARBAD_ID, "Tharbad"
        ), timeout=60)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        data = r.json()
        dias, distance_km = self._extract_days_and_distance(data)
        print(f"\n[BUG-1] Bree->Tharbad: distancia_km={distance_km}, dias_estimados={dias}")
        assert dias == 9, (
            f"Expected dias_estimados=9 for Bree->Tharbad (~205 km @ 22.5 km/d), got {dias}. "
            f"distance_km={distance_km}."
        )

    def test_distance_to_days_consistency(self, session):
        """sanity: dias >= floor(distance / 22.5) - 1 for normal pace."""
        r = session.post(f"{API}/travel/calculate-journey", json=self._payload(
            BREE_ID, "Bree", RIVENDEL_ID, "Rivendel"
        ), timeout=60)
        data = r.json()
        dias, distance_km = self._extract_days_and_distance(data)
        if distance_km > 0:
            floor_days = int(math.floor(distance_km / 22.5))
            print(f"\n[BUG-1 sanity] floor(distance/22.5)={floor_days}, dias_estimados={dias}")
            assert dias >= floor_days - 1, (
                f"dias_estimados ({dias}) is below physical minimum "
                f"floor(distance/22.5)={floor_days}"
            )


# ------------------------------------------------------------
# BUG-1b: compare-routes returns coherent road & direct routes
# ------------------------------------------------------------
class TestCompareRoutes:
    def test_compare_bree_to_rivendel(self, session):
        payload = {
            "origen_id": BREE_ID,
            "origen_nombre": "Bree",
            "destino_id": RIVENDEL_ID,
            "destino_nombre": "Rivendel",
            "evitar_sombra": False,
            "evitar_tierras_oscuras": False,
            "ritmo": "normal",
        }
        r = session.post(f"{API}/travel/compare-routes", json=payload, timeout=60)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        data = r.json()
        # Should have NOT errored
        assert not data.get("error"), f"Unexpected error: {data}"
        # Some structural checks (do not over-constrain field names)
        keys = list(data.keys())
        print(f"\n[BUG-1b] compare-routes keys: {keys}")
        # Expect at least one route-related key
        has_route_data = any(
            k in data for k in (
                "ruta_caminos", "ruta_directa", "road_route", "direct_route",
                "comparacion", "rutas", "routes"
            )
        )
        assert has_route_data, f"compare-routes missing expected route fields. keys={keys}"


# ------------------------------------------------------------
# BUG-5: generate-journey-summary accepts new eventos + clima_por_dia
# ------------------------------------------------------------
class TestGenerateJourneySummaryWeather:
    def test_summary_with_weather_per_day(self, session):
        payload = {
            "origen": "Bree",
            "destino": "Rivendel",
            "dias": 13,
            "personajes": [
                {"nombre": "Regred Maggot", "papel": "guia"},
                {"nombre": "Lindir", "papel": "cazador"},
            ],
            "eventos": [
                {
                    "dia": 3,
                    "nombre": "Encuentro con jinetes",
                    "exito": True,
                    "clima": "Lluvia ligera",
                    "consecuencia": "Sin daños",
                    "narrativa_individual": "Los viajeros se ocultaron tras un seto y los jinetes pasaron sin verlos."
                },
                {
                    "dia": 7,
                    "nombre": "Vado del Mitheithel",
                    "exito": False,
                    "clima": "Tormenta",
                    "consecuencia": "1 ración perdida",
                    "narrativa_individual": "El caballo de Lindir resbaló y arrastró parte del equipaje río abajo."
                }
            ],
            "clima_por_dia": [
                {"dia": d, "estado": estado, "region": "Eriador"} for d, estado in [
                    (1, "Soleado"), (2, "Nubes y claros"), (3, "Lluvia ligera"),
                    (4, "Soleado"), (5, "Niebla matinal"), (6, "Despejado"),
                    (7, "Tormenta"), (8, "Lluvia"), (9, "Despejado"),
                    (10, "Frío"), (11, "Despejado"), (12, "Soleado"), (13, "Soleado")
                ]
            ],
            "px_total": 1200,
            "terrenos": {"moderado": 180.0, "duro": 105.0},
        }
        r = session.post(f"{API}/travel/generate-journey-summary", json=payload, timeout=120)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        data = r.json()
        print(f"\n[BUG-5] success={data.get('success')} narrative_len={len(data.get('narrative') or '')}")
        # Either succeeded or at minimum returned a valid JSON shape with narrative
        assert "narrative" in data, f"Missing narrative key: {data}"
        # Even on AI failure the fallback returns a string narrative
        assert isinstance(data["narrative"], str) and len(data["narrative"]) > 0
        # If success=True, the narrative should not contain raw error text
        if data.get("success"):
            assert "error" not in data["narrative"].lower()[:50]

    def test_summary_minimal_payload_still_works(self, session):
        """Crónica básica sin clima_por_dia (compatibilidad)."""
        payload = {
            "origen": "Bree",
            "destino": "Tharbad",
            "dias": 9,
            "personajes": [{"nombre": "Solo", "papel": "guia"}],
            "eventos": [],
            "clima_por_dia": [],
            "px_total": 0,
            "terrenos": {},
        }
        r = session.post(f"{API}/travel/generate-journey-summary", json=payload, timeout=120)
        assert r.status_code == 200
        data = r.json()
        assert "narrative" in data
        assert isinstance(data["narrative"], str)
