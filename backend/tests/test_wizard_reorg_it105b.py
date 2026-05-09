"""
Iteration 105b — Wizard reorganization: env-linked travel events,
per-env location, and adventure-level map_x/map_y.

Cubre:
  - environment.location_id/location_name/region/map_x/map_y persistido.
  - environment.travel_events lista persistida.
  - adventure.map_x/map_y persistido a nivel raíz.
  - clone_adventure regenera ids para travel_events anidados de envs.
"""
import os
import uuid

import pytest
import requests

BASE = (os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001').rstrip('/')

MAESTRO_EMAIL = "elanillounico_tlotr@proton.me"
MAESTRO_PASS = "123456"


def _login(email, password):
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": email, "password": password, "remember_me": False},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_env_with_location_and_nested_events_persisted():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    payload = {
        "name": f"It105b_EnvEvents_{uuid.uuid4().hex[:6]}",
        "max_players": 4,
        "map_x": 31.6,
        "map_y": 65.6,
        "environments": [
            {
                "title": "Bosque Negro",
                "description": "Telarañas y voces.",
                "location_id": None,
                "location_name": "Punto en el mapa",
                "region": "Bosque Negro",
                "map_x": 70.5,
                "map_y": 40.0,
                "travel_events": [
                    {
                        "title": "Telaraña gigante",
                        "description": "Una emboscada de arañas.",
                        "player_notes": "Oís un sonido pegajoso entre los árboles.",
                    },
                    {
                        "title": "Voces en sindarin",
                        "description": "Eco élfico antiguo.",
                        "player_notes": "",
                    },
                ],
            }
        ],
    }
    r = requests.post(f"{BASE}/api/adventures", json=payload, headers=_h(tok), timeout=10)
    assert r.status_code == 201, r.text
    adv = r.json()
    assert adv["map_x"] == 31.6
    assert adv["map_y"] == 65.6
    assert len(adv["environments"]) == 1
    env = adv["environments"][0]
    assert env["map_x"] == 70.5
    assert env["region"] == "Bosque Negro"
    assert len(env["travel_events"]) == 2
    assert env["travel_events"][0]["title"] == "Telaraña gigante"
    assert env["travel_events"][0]["player_notes"].startswith("Oís")
    # cleanup
    requests.delete(f"{BASE}/api/adventures/{adv['id']}", headers=_h(tok), timeout=10)


def test_clone_regenerates_env_event_ids():
    tok = _login(MAESTRO_EMAIL, MAESTRO_PASS)
    payload = {
        "name": f"It105b_Clone_{uuid.uuid4().hex[:6]}",
        "max_players": 4,
        "is_public": True,
        "environments": [
            {
                "title": "Aldea",
                "travel_events": [{"title": "Encuentro 1"}, {"title": "Encuentro 2"}],
            }
        ],
    }
    r = requests.post(f"{BASE}/api/adventures", json=payload, headers=_h(tok), timeout=10)
    assert r.status_code == 201
    adv = r.json()
    src_event_ids = [ev["id"] for ev in adv["environments"][0]["travel_events"]]
    # Clone
    r2 = requests.post(f"{BASE}/api/adventures/{adv['id']}/clone", headers=_h(tok), timeout=10)
    assert r2.status_code in (200, 201), r2.text
    cloned = r2.json()
    cloned_event_ids = [ev["id"] for ev in cloned["environments"][0]["travel_events"]]
    # All ids must be different from source
    assert set(cloned_event_ids).isdisjoint(set(src_event_ids))
    # Cleanup
    requests.delete(f"{BASE}/api/adventures/{adv['id']}", headers=_h(tok), timeout=10)
    requests.delete(f"{BASE}/api/adventures/{cloned['id']}", headers=_h(tok), timeout=10)
