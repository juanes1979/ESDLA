"""
iter83d — Tests Fase 2 Ojo de Mordor:
  • Endpoints del prompt editable (GET / POST / RESET).
  • Generación de episodio (live, llama a GPT-4o).
  • Aplicar episodio: persiste en history y resetea attention.
"""
import os
import requests
import asyncio
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


def _async(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_get_prompt_devuelve_default():
    r = requests.get(f"{BASE}/api/eye/ai/prompt")
    assert r.status_code == 200
    body = r.json()
    assert "system_prompt" in body
    assert "Narrador del Mal" in body["system_prompt"]
    assert "default_prompt" in body


def test_post_prompt_persiste():
    custom = "Eres un narrador alternativo. Devuelve JSON {event_type, description, mechanical_effect, tone}."
    r = requests.post(f"{BASE}/api/eye/ai/prompt", json={"system_prompt": custom})
    assert r.status_code == 200
    assert r.json()["saved"] is True

    r2 = requests.get(f"{BASE}/api/eye/ai/prompt")
    assert r2.json()["system_prompt"] == custom

    # Reset al final para no romper otros tests
    requests.post(f"{BASE}/api/eye/ai/prompt/reset")


def test_post_prompt_vacio_da_400():
    r = requests.post(f"{BASE}/api/eye/ai/prompt", json={"system_prompt": "   "})
    assert r.status_code == 400


def test_episode_types_lista_8():
    r = requests.get(f"{BASE}/api/eye/ai/episode-types")
    assert r.status_code == 200
    types = r.json()["types"]
    ids = [t["id"] for t in types]
    expected = {"desventaja_global", "rechazo_social", "tentacion", "traicion",
                "fatiga_sobrenatural", "escape_imposible", "emboscada_inevitable", "buff_enemigo"}
    assert set(ids) == expected


def test_apply_episode_resetea_atencion():
    """Force atención alta, aplicar episodio, verificar reset a initial_value."""
    requests.post(f"{BASE}/api/eye/reset")
    # Simular un escenario con atención alta: sumar 20 puntos manuales
    for _ in range(20):
        requests.post(f"{BASE}/api/eye/increment", json={"source": "manual", "delta": 1, "descripcion": "test"})

    state_before = requests.get(f"{BASE}/api/eye/state").json()
    pre = state_before["attention_total"]
    initial = state_before["initial_value"]
    assert pre >= 20

    r = requests.post(f"{BASE}/api/eye/ai/apply-episode", json={
        "state_id": "default",
        "event_type": "desventaja_global",
        "description": "Una nube oscura cubre el sol.",
        "mechanical_effect": "Desventaja en todas las tiradas durante 10 min.",
        "tone": "ominous",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"]["attention_total"] == initial
    assert body["previous_attention"] == pre

    # El history debe tener una entrada con event_type
    hist = body["state"]["history"]
    last = hist[-1]
    assert last["source"] == "episode_applied"
    assert last["event_type"] == "desventaja_global"
    assert last["description"] == "Una nube oscura cubre el sol."

    # Cleanup
    requests.post(f"{BASE}/api/eye/reset")


@pytest.mark.skipif(not os.environ.get('RUN_LLM_TESTS'),
                     reason="LLM tests son costosos; setear RUN_LLM_TESTS=1 para ejecutar")
def test_propose_episode_llm_devuelve_estructura():
    """Test live: llama a GPT-4o realmente."""
    r = requests.post(f"{BASE}/api/eye/ai/propose-episode", json={
        "state_id": "default",
        "context": {
            "location": "Páramos al norte",
            "currentThreat": "patrulla enemiga",
            "partyState": {"fatigue": "Alta", "shadow": "Moderada", "goal": "Llegar a Rivendel"},
            "recentActions": ["Encendieron una hoguera"],
            "enemyInfluence": "high",
        },
    }, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "event_type" in body
    assert body["event_type"] in {
        "desventaja_global", "rechazo_social", "tentacion", "traicion",
        "fatiga_sobrenatural", "escape_imposible", "emboscada_inevitable", "buff_enemigo",
    }
    assert len(body["description"]) > 5
    assert len(body["mechanical_effect"]) > 5
