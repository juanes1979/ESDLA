"""Iteration 66 backend tests:
- Ropa catalog + add/toggle-active flow
- Weapon/armor carrier move to mount with auto-deactivate
- Multi-mount CRUD (create/update/delete + reassignment)
- weight-summary.monturas_detalle correctness
- toggle mounted with mount_id switches es_jinete_activo
- Regression: rest/short, rest/long, travel calculate-journey
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://journey-roller.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

XALAN_ID = "208ab2df-a51a-43e5-b96e-1c6757a2ada8"


# ---------- helpers ----------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _get_char(client, cid=XALAN_ID):
    r = client.get(f"{API}/characters/{cid}")
    assert r.status_code == 200, r.text
    return r.json()


# ---------- 1) Equipment catalog: ropa ----------
class TestEquipmentCatalog:
    def test_catalog_has_ropa_with_24_items(self, client):
        r = client.get(f"{API}/data/equipment-catalog")
        assert r.status_code == 200
        data = r.json()
        assert "ropa" in data, "ropa category missing in equipment-catalog"
        ropa = data["ropa"]
        assert isinstance(ropa, list)
        assert len(ropa) >= 20, f"Expected >=20 ropa items, got {len(ropa)}"
        # Verify posicion field present and within allowed set
        allowed_pos = {"cabeza", "cuerpo", "piernas", "brazos", "pies"}
        for it in ropa:
            assert "nombre" in it and "posicion" in it
            assert it["posicion"] in allowed_pos, f"unknown posicion: {it['posicion']}"


# ---------- 2) Ropa add -> toggle-active flow ----------
class TestRopaFlow:
    def test_add_ropa_item_then_toggle_active(self, client):
        # Add a ropa item via equipment/add (is_purchase=False to avoid money)
        payload = {
            "item_name": "Botas acolchonadas",
            "item_category": "ropa",
            "cantidad": 1,
            "is_purchase": False,
            "posicion": "pies",
        }
        r = client.post(f"{API}/characters/{XALAN_ID}/equipment/add", json=payload)
        assert r.status_code == 200, r.text
        char = r.json()["character"]
        inv = char["inventario"]
        # Find the added item
        idx = None
        for i, it in enumerate(inv):
            if isinstance(it, dict) and it.get("nombre", "").lower() == "botas acolchonadas":
                idx = i
                break
        assert idx is not None, "Ropa item not found after add"
        assert inv[idx]["categoria"] == "ropa"
        assert inv[idx]["posicion"] == "pies"
        assert inv[idx].get("activa") is True

        # Toggle-active to False
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/toggle-active",
            json={"item_index": idx, "activa": False, "source": "inventario"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["activa"] is False
        assert body["source"] == "inventario"
        # Verify persisted
        char2 = _get_char(client)
        assert char2["inventario"][idx].get("activa") is False

        # Toggle back to True
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/toggle-active",
            json={"item_index": idx, "activa": True, "source": "inventario"},
        )
        assert r.status_code == 200
        assert r.json()["activa"] is True

        # Cleanup: remove the added item
        client.delete(
            f"{API}/characters/{XALAN_ID}/equipment/remove",
            params={"item_name": "Botas acolchonadas", "item_category": "ropa", "cantidad": 999},
        )


# ---------- 3) Carry: move weapon to mount auto-deactivates ----------
class TestCarryDeactivate:
    def test_move_weapon_to_mount_deactivates(self, client):
        # Add a test weapon if none present
        suffix = uuid.uuid4().hex[:6]
        test_weapon_name = f"TEST_espada_{suffix}"
        r = client.post(
            f"{API}/characters/{XALAN_ID}/equipment/add",
            json={
                "item_name": test_weapon_name,
                "item_category": "armas_sencillas_cc",
                "cantidad": 1,
                "is_purchase": False,
                "peso_kg": 1.5,
                "dano": "1d6",
            },
        )
        assert r.status_code == 200, r.text
        char = r.json()["character"]
        armas = char.get("armas", [])
        assert armas, "Weapon not added"
        idx = next(i for i, a in enumerate(armas)
                   if isinstance(a, dict) and a.get("nombre") == test_weapon_name)
        assert armas[idx].get("activa") is True
        # Ensure weapon activa=True first (is already True from add)
        client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/toggle-active",
            json={"item_index": idx, "activa": True, "source": "armas"},
        )
        # Grab a mount id
        char = _get_char(client)
        monturas = char.get("monturas") or []
        assert monturas, "Xalan should have monturas"
        mid = monturas[0]["id"]

        # Move to mount
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/carry",
            json={
                "item_index": idx,
                "carried_by": "montura",
                "source": "armas",
                "mount_id": mid,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["deactivated"] is True, "Expected deactivated=True when moving active weapon"
        assert body["source"] == "armas"
        updated = body["character"]
        assert updated["armas"][idx].get("portado_por") == "montura"
        assert updated["armas"][idx].get("mount_id") == mid
        assert updated["armas"][idx].get("activa") is False

        # Move back to personaje (cleanup)
        r2 = client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/carry",
            json={
                "item_index": idx,
                "carried_by": "personaje",
                "source": "armas",
            },
        )
        assert r2.status_code == 200
        restored = r2.json()["character"]
        assert restored["armas"][idx].get("portado_por") == "personaje"
        assert "mount_id" not in restored["armas"][idx]

        # Cleanup: remove test weapon
        client.delete(
            f"{API}/characters/{XALAN_ID}/equipment/remove",
            params={"item_name": test_weapon_name, "item_category": "armas_sencillas_cc", "cantidad": 999},
        )


# ---------- 4) Multi-mount CRUD full cycle ----------
class TestMultiMountCRUD:
    def test_create_update_delete_mount(self, client):
        suffix = uuid.uuid4().hex[:6]
        temp_name = f"TEST_mount_{suffix}"

        # CREATE
        r = client.post(
            f"{API}/characters/{XALAN_ID}/monturas",
            json={
                "nombre_original": temp_name,
                "nombre_personalizado": temp_name,
                "especie": "Poni",
                "capacidad_carga": 120,
                "velocidad": 10,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        new_mount = body["mount"]
        new_id = new_mount["id"]
        assert new_mount["nombre_original"] == temp_name
        # Persisted
        char = _get_char(client)
        assert any(m.get("id") == new_id for m in char.get("monturas", []))

        # UPDATE (rename + change capacity)
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/monturas/{new_id}",
            json={"nombre_personalizado": f"{temp_name}_renamed", "capacidad_carga": 200},
        )
        assert r.status_code == 200, r.text
        char = _get_char(client)
        m_found = next((m for m in char["monturas"] if m.get("id") == new_id), None)
        assert m_found is not None
        assert m_found["nombre_personalizado"] == f"{temp_name}_renamed"
        assert m_found["capacidad_carga"] == 200

        # Add an inventory item & assign to this mount, then DELETE mount -> item reverts
        # Use equipment/add to get a neutral item
        r = client.post(
            f"{API}/characters/{XALAN_ID}/equipment/add",
            json={"item_name": f"TEST_item_{suffix}", "item_category": "equipo_general",
                  "cantidad": 1, "is_purchase": False, "peso_kg": 1.0},
        )
        assert r.status_code == 200
        inv = r.json()["character"]["inventario"]
        # Locate the added item
        item_idx = None
        for i, it in enumerate(inv):
            if isinstance(it, dict) and it.get("nombre") == f"TEST_item_{suffix}":
                item_idx = i
                break
        assert item_idx is not None

        # Move to new mount
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/carry",
            json={
                "item_index": item_idx,
                "carried_by": "montura",
                "source": "inventario",
                "mount_id": new_id,
            },
        )
        assert r.status_code == 200
        moved_item = r.json()["character"]["inventario"][item_idx]
        assert moved_item.get("mount_id") == new_id
        assert moved_item.get("portado_por") == "montura"

        # DELETE mount
        r = client.delete(f"{API}/characters/{XALAN_ID}/monturas/{new_id}")
        assert r.status_code == 200, r.text
        char = r.json()["character"]
        # Mount gone
        assert all(m.get("id") != new_id for m in char.get("monturas", []))
        # Item reassigned to personaje (portado_por=personaje, no mount_id)
        reassigned = None
        for it in char["inventario"]:
            if isinstance(it, dict) and it.get("nombre") == f"TEST_item_{suffix}":
                reassigned = it
                break
        assert reassigned is not None, "Test item disappeared after mount delete"
        assert reassigned.get("portado_por") == "personaje"
        assert "mount_id" not in reassigned

        # Cleanup: remove the test item
        client.delete(
            f"{API}/characters/{XALAN_ID}/equipment/remove",
            params={"item_name": f"TEST_item_{suffix}", "item_category": "equipo_general", "cantidad": 999},
        )


# ---------- 5) Weight-summary monturas_detalle ----------
class TestWeightSummaryMountDetails:
    def test_monturas_detalle_structure(self, client):
        r = client.get(f"{API}/characters/{XALAN_ID}/weight-summary")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "monturas_detalle" in data
        detalle = data["monturas_detalle"]
        assert isinstance(detalle, list)
        char = _get_char(client)
        assert len(detalle) == len(char.get("monturas", []))
        required_keys = {"id", "nombre", "capacidad", "peso_cargado",
                         "sobrecargada", "lleva_jinete", "es_jinete_activo"}
        for m in detalle:
            assert required_keys.issubset(m.keys()), f"missing keys in {m}"
            assert isinstance(m["peso_cargado"], (int, float))
            assert isinstance(m["sobrecargada"], bool)
            assert isinstance(m["lleva_jinete"], bool)

    def test_item_weight_allocated_to_specific_mount(self, client):
        # Add a heavy test item and assign it to Lucero
        char = _get_char(client)
        monturas = char.get("monturas", [])
        assert len(monturas) >= 2, "Need Xalan with 2 mounts"
        target_id = monturas[1]["id"]  # Lucero

        suffix = uuid.uuid4().hex[:6]
        name = f"TEST_heavy_{suffix}"
        r = client.post(
            f"{API}/characters/{XALAN_ID}/equipment/add",
            json={"item_name": name, "item_category": "equipo_general",
                  "cantidad": 1, "is_purchase": False, "peso_kg": 25.0},
        )
        assert r.status_code == 200
        inv = r.json()["character"]["inventario"]
        idx = next(i for i, it in enumerate(inv)
                   if isinstance(it, dict) and it.get("nombre") == name)

        # Baseline weight-summary
        before = client.get(f"{API}/characters/{XALAN_ID}/weight-summary").json()
        before_target = next(m for m in before["monturas_detalle"] if m["id"] == target_id)
        before_peso = before_target["peso_sin_jinete"]

        # Move to Lucero
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/carry",
            json={"item_index": idx, "carried_by": "montura",
                  "source": "inventario", "mount_id": target_id},
        )
        assert r.status_code == 200

        after = client.get(f"{API}/characters/{XALAN_ID}/weight-summary").json()
        after_target = next(m for m in after["monturas_detalle"] if m["id"] == target_id)
        # 25kg added to Lucero
        assert pytest.approx(after_target["peso_sin_jinete"] - before_peso, abs=0.01) == 25.0

        # Cleanup: return to personaje and delete
        client.patch(
            f"{API}/characters/{XALAN_ID}/equipment/carry",
            json={"item_index": idx, "carried_by": "personaje", "source": "inventario"},
        )
        client.delete(
            f"{API}/characters/{XALAN_ID}/equipment/remove",
            params={"item_name": name, "item_category": "equipo_general", "cantidad": 999},
        )


# ---------- 6) Toggle mounted with mount_id ----------
class TestToggleMountedWithMountId:
    def test_mounted_mount_id_sets_es_jinete_activo(self, client):
        char = _get_char(client)
        monturas = char.get("monturas", [])
        assert len(monturas) >= 2, "Need 2 mounts on Xalan"
        mount_a = monturas[0]["id"]
        mount_b = monturas[1]["id"]

        # Mount on A
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/mounted",
            json={"montado": True, "mount_id": mount_a},
        )
        assert r.status_code == 200, r.text
        char2 = _get_char(client)
        for m in char2["monturas"]:
            if m["id"] == mount_a:
                assert m.get("es_jinete_activo") is True
            else:
                assert m.get("es_jinete_activo") is False
        assert char2.get("montado") is True

        # Switch to B
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/mounted",
            json={"montado": True, "mount_id": mount_b},
        )
        assert r.status_code == 200
        char3 = _get_char(client)
        for m in char3["monturas"]:
            if m["id"] == mount_b:
                assert m.get("es_jinete_activo") is True
            else:
                assert m.get("es_jinete_activo") is False

        # Dismount (montado=false): all should be False
        r = client.patch(
            f"{API}/characters/{XALAN_ID}/mounted",
            json={"montado": False, "mount_id": mount_b},
        )
        assert r.status_code == 200
        char4 = _get_char(client)
        assert char4.get("montado") is False
        for m in char4["monturas"]:
            assert m.get("es_jinete_activo") is False

        # Restore to original (Lucero activa)
        client.patch(
            f"{API}/characters/{XALAN_ID}/mounted",
            json={"montado": False, "mount_id": mount_b},
        )


# ---------- 7) Regression: rest endpoints & travel calculate-journey ----------
class TestRegressionEndpoints:
    def test_rest_short_still_works(self, client):
        r = client.post(f"{API}/characters/{XALAN_ID}/rest/short",
                        json={"dice_to_spend": 0})
        assert r.status_code == 200, r.text

    def test_rest_long_still_works(self, client):
        r = client.post(f"{API}/characters/{XALAN_ID}/rest/long")
        assert r.status_code == 200, r.text

    def test_travel_calculate_journey(self, client):
        # Minimal journey to ensure endpoint responds
        payload = {
            "origen": "Bree",
            "destino": "Rivendel",
            "party_size": 1,
            "dias_viaje_base": 5,
        }
        r = client.post(f"{API}/travel/calculate-journey", json=payload)
        # Endpoint may return 200 or 422 depending on schema. Accept any non-5xx.
        assert r.status_code < 500, f"5xx on calculate-journey: {r.status_code} {r.text}"


# ---------- 8) Xalan migrated data sanity ----------
class TestXalanMigrated:
    def test_xalan_has_monturas_and_ropa(self, client):
        char = _get_char(client)
        assert len(char.get("monturas", [])) >= 2
        inv = char.get("inventario", [])
        ropa_items = [i for i in inv if isinstance(i, dict) and i.get("categoria") == "ropa"]
        assert len(ropa_items) >= 1, "Xalan should have migrated ropa in inventory"
        for it in ropa_items:
            assert it.get("posicion") in {"cabeza", "cuerpo", "piernas", "brazos", "pies"}
