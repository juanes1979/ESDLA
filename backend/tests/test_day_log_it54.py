"""
Iteration 54 backend tests: Unified Journey Diary.

Focus — POST /api/travel/generate-day-log (DayLogRequest)
- Full payload: returns {success:true, dia, narrative:non-empty paragraph >100 chars}
- Minimal payload (just dia_numero + terreno): still returns a narrative
- Organic weather integration: when clima is provided with rain/mud terms,
  the returned Spanish narrative must reference rain/mud/wet naturally.

Note: regression for fatigue-save / generate-narrative / journey/start /
journey/{id}/camp / PUT /characters/{id}/fatigue is covered by the existing
tests in test_travel_rules_it53.py, test_camp_fatigue.py, and
test_travel_regression_it52.py which are run together in the full suite.
"""
import os

import pytest
import requests

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or "https://middle-earth-gm.preview.emergentagent.com"
).rstrip("/")

SPANISH_RAIN_WORDS = (
    "lluvia", "mojad", "barro", "embarr", "humed", "llov", "fango", "empap",
    "agua", "charco", "chubasco", "cala",  # 'calado' (soaked) etc.
)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestGenerateDayLog:
    """POST /api/travel/generate-day-log"""

    def test_full_payload_returns_non_empty_narrative(self, api):
        payload = {
            "dia_numero": 2,
            "dias_totales": 5,
            "terreno": "bosque",
            "tipo_tierra": "tierras_salvajes",
            "origen": "Rivendel",
            "destino": "Bree",
            "personajes": [
                {"nombre": "Aragorn", "papel": "guia"},
                {"nombre": "Frodo", "papel": "explorador"},
            ],
            "orientacion": {
                "d20": 12,
                "total": 14,
                "exito": False,
                "detalle": "El guía se desvía ligeramente del sendero.",
                "gm_notes": "Un zorro cruza el camino justo antes de la tirada.",
            },
            "eventos": [
                {
                    "nombre": "Tormenta inesperada",
                    "tirada": 17,
                    "cd": 15,
                    "exito": True,
                    "personaje": "explorador",
                    "gm_notes": "Truenos lejanos asustan a los caballos.",
                    "narrativa": "El grupo se cobija bajo un roble hasta que escampa.",
                }
            ],
            "tiradas_fatiga": [
                {
                    "personaje": "Frodo",
                    "tirada": {"d20": 7, "total": 9},
                    "cd": 15,
                    "resultado": "fallo",
                    "niveles_cansancio": 1,
                }
            ],
            "clima": "Lluvia persistente y viento frío del norte",
            "notas_maestro_dia": "El grupo marcha cerca del río Mitheithel.",
            "dia_anterior_resumen": "Cruzaron un vado estrecho al atardecer.",
        }
        r = api.post(f"{BASE_URL}/api/travel/generate-day-log", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, data
        assert data.get("dia") == 2
        narrative = data.get("narrative") or ""
        assert isinstance(narrative, str)
        assert len(narrative) > 100, f"narrative too short: {narrative!r}"
        # Sanity — no emojis per the system prompt and not starting with "Día X"
        assert not narrative.lstrip().lower().startswith("día "), narrative[:60]

    def test_minimal_payload_still_returns_narrative(self, api):
        payload = {"dia_numero": 1, "terreno": "campo_abierto"}
        r = api.post(f"{BASE_URL}/api/travel/generate-day-log", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, data
        assert data.get("dia") == 1
        narrative = data.get("narrative") or ""
        assert isinstance(narrative, str) and len(narrative) > 50, narrative

    def test_clima_integrated_organically(self, api):
        """When clima describes rain + mud, narrative MUST reference it in Spanish."""
        payload = {
            "dia_numero": 3,
            "dias_totales": 6,
            "terreno": "camino",
            "tipo_tierra": "tierras_fronterizas",
            "personajes": [{"nombre": "Boromir", "papel": "cazador"}],
            "clima": "Lluvia persistente, suelo embarrado y viento frío",
            "notas_maestro_dia": "Llevan horas bajo la tormenta.",
        }
        r = api.post(f"{BASE_URL}/api/travel/generate-day-log", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, data
        narrative_lower = (data.get("narrative") or "").lower()
        assert len(narrative_lower) > 100, narrative_lower
        assert any(w in narrative_lower for w in SPANISH_RAIN_WORDS), (
            f"Narrative should reference weather organically (one of "
            f"{SPANISH_RAIN_WORDS}). Got: {narrative_lower[:500]}"
        )

    def test_no_clima_still_produces_valid_narrative(self, api):
        """Sanity: when clima is omitted, narrative still flows (no weather required)."""
        payload = {
            "dia_numero": 4,
            "dias_totales": 7,
            "terreno": "montanas",
            "personajes": [{"nombre": "Gimli", "papel": "centinela"}],
        }
        r = api.post(f"{BASE_URL}/api/travel/generate-day-log", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True, data
        assert len(data.get("narrative") or "") > 50
