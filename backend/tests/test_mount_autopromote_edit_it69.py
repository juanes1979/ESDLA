"""Iteration 69 — backend tests for:
    1) POST /api/characters/{id}/equipment/add (item_category='monturas')
       must populate character.monturas[] with full shape.
    2) PATCH /api/characters/{id}/equipment/carry — auto-detection +
       auto-promotion of a mount-like item from
       inventario / equipo_ocupacion / equipo_nivel_vida / equipo_trasfondo
       into character.monturas[]; the duplicate is removed from the source.
    3) PATCH /api/characters/{id}/equipment/edit-item — new endpoint
       (categoria/posicion/nombre re-classification) + validation errors.
    4) Regression: Xalan still works; mounts CRUD; toggle-active;
       weight-summary monturas_detalle; ubicacion endpoints (it68);
       generate-event terreno→CD (it67).
"""

import os
import uuid
import pytest
import requests
from pymongo import MongoClient

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

XALAN_ID = "208ab2df-a51a-43e5-b96e-1c6757a2ada8"
BREE_ID = "loc_131"
HOBBITON_ID = "loc_002"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    with open("/app/backend/.env") as fh:
        env = dict(l.strip().split("=", 1) for l in fh if "=" in l and not l.startswith("#"))
    mongo = env.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
    db_name = env.get("DB_NAME", "test_database").strip('"')
    client = MongoClient(mongo)
    yield client[db_name]
    client.close()


def _new_character(mongo_db, **extra):
    cid = f"TEST_it69_{uuid.uuid4().hex[:8]}"
    doc = {
        "_id": cid,
        "nombre": f"TEST_char_{cid}",
        "jugador": "it69",
        "nivel": 1,
        "fuerza": 10,
        "dinero": {"mo": 100, "mp": 100, "me": 100, "mc": 100},
        "inventario": [],
        "equipo": [],
        "equipo_ocupacion": [],
        "equipo_nivel_vida": [],
        "equipo_trasfondo": [],
        "armas": [],
        "armaduras": [],
        "armadura_piezas": [],
        "ropa": [],
        "monturas": [],
        "montura": {},
    }
    doc.update(extra)
    mongo_db.characters.insert_one(doc)
    return cid


@pytest.fixture()
def char_with_horse_in_ocupacion(mongo_db):
    """Synthetic character: one Caballo de caminos in equipo_ocupacion, monturas=[]."""
    cid = _new_character(
        mongo_db,
        equipo_ocupacion=[
            {"nombre": "Caballo de caminos", "cantidad": 1, "peso_kg": 0,
             "categoria": "monturas"},
            {"nombre": "Daga", "cantidad": 1, "peso_kg": 0.5,
             "categoria": "armas_sencillas_cc", "posicion": "personaje"},
        ],
        inventario=[
            {"nombre": "Antorcha", "cantidad": 2, "peso_kg": 0.5,
             "categoria": "equipo_general", "posicion": "personaje"},
        ],
    )
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


@pytest.fixture()
def char_with_horse_in_trasfondo(mongo_db):
    cid = _new_character(
        mongo_db,
        equipo_trasfondo=[
            {"nombre": "Pony resistente", "cantidad": 1, "peso_kg": 0,
             "categoria": "monturas"},
        ],
        inventario=[
            {"nombre": "Cuerda", "cantidad": 1, "peso_kg": 1.5,
             "categoria": "equipo_general", "posicion": "personaje"},
        ],
    )
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


@pytest.fixture()
def char_clean(mongo_db):
    cid = _new_character(
        mongo_db,
        inventario=[
            {"nombre": "Raciones (1 día) (Paquete de 10)", "cantidad": 1,
             "peso_kg": 1.0, "categoria": "equipo_general", "posicion": "personaje"},
            {"nombre": "Antorcha", "cantidad": 2, "peso_kg": 0.5,
             "categoria": "equipo_general", "posicion": "personaje"},
        ],
    )
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


@pytest.fixture()
def char_no_mount(mongo_db):
    cid = _new_character(
        mongo_db,
        inventario=[
            {"nombre": "Antorcha", "cantidad": 2, "peso_kg": 0.5,
             "categoria": "equipo_general", "posicion": "personaje"},
        ],
    )
    yield cid
    mongo_db.characters.delete_one({"_id": cid})


# ===========================================================================
# 1) POST /equipment/add — mount populates monturas[]
# ===========================================================================
class TestEquipmentAddMountPopulatesMonturas:
    def test_add_mount_populates_monturas_array(self, api_client, char_clean):
        r = api_client.post(
            f"{API}/characters/{char_clean}/equipment/add",
            json={
                "item_name": "Caballo de caminos",
                "item_category": "monturas",
                "cantidad": 1,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        char = body.get("character", body)
        monturas = char.get("monturas") or []
        assert len(monturas) == 1, f"expected exactly 1 mount, got {len(monturas)}: {monturas}"
        m = monturas[0]
        # Required new-shape fields
        for k in ("id", "nombre_original", "nombre_personalizado",
                  "capacidad_carga", "velocidad"):
            assert k in m, f"mount missing field {k}: {m}"
        assert m["nombre_original"] == "Caballo de caminos"
        # legacy mirror still present
        assert char.get("montura", {}).get("nombre") == "Caballo de caminos"

    def test_add_second_mount_appends(self, api_client, char_clean):
        api_client.post(
            f"{API}/characters/{char_clean}/equipment/add",
            json={"item_name": "Caballo de caminos", "item_category": "monturas", "cantidad": 1},
        )
        r = api_client.post(
            f"{API}/characters/{char_clean}/equipment/add",
            json={"item_name": "Pony resistente", "item_category": "monturas", "cantidad": 1},
        )
        assert r.status_code == 200, r.text
        char = r.json().get("character", r.json())
        assert len(char.get("monturas") or []) == 2


# ===========================================================================
# 2) PATCH /equipment/carry — auto-promotion across all sources
# ===========================================================================
class TestEquipmentCarryAutoPromotion:
    def test_carry_to_montura_autopromotes_horse_from_equipo_ocupacion(
        self, api_client, mongo_db, char_with_horse_in_ocupacion
    ):
        # Sanity: monturas is empty before
        before = mongo_db.characters.find_one({"_id": char_with_horse_in_ocupacion})
        assert before["monturas"] == []
        assert any(it["nombre"] == "Caballo de caminos"
                   for it in before["equipo_ocupacion"])

        # carry the Daga (item_index 1 in equipo_ocupacion) to the mount
        r = api_client.patch(
            f"{API}/characters/{char_with_horse_in_ocupacion}/equipment/carry",
            json={
                "item_index": 1,
                "carried_by": "montura",
                "source": "equipo_ocupacion",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        char = body.get("character", body)

        # 1) monturas[] populated with exactly one entry — the Caballo de caminos
        monturas = char.get("monturas") or []
        assert len(monturas) == 1, f"expected 1 mount, got {monturas}"
        m = monturas[0]
        assert m["nombre_original"] == "Caballo de caminos"
        for k in ("id", "nombre_personalizado", "capacidad_carga", "velocidad"):
            assert k in m

        # 2) the horse must be removed from equipo_ocupacion
        ocup = char.get("equipo_ocupacion") or []
        assert not any(
            (it.get("nombre") if isinstance(it, dict) else "") == "Caballo de caminos"
            for it in ocup
        ), f"horse not removed from equipo_ocupacion: {ocup}"

        # 3) the moved Daga has portado_por=montura
        # We previously had Daga at index 1; after horse removal it sits at index 0
        # but this is implementation-defined; check via name
        moved = next((it for it in ocup if it.get("nombre") == "Daga"), None)
        assert moved is not None, "Daga must still exist in equipo_ocupacion"
        assert moved.get("portado_por") == "montura"

    def test_carry_inventario_item_to_mount_with_horse_in_trasfondo(
        self, api_client, mongo_db, char_with_horse_in_trasfondo
    ):
        # Move the Cuerda (inventario index 0) to the pony (auto-detected from equipo_trasfondo)
        r = api_client.patch(
            f"{API}/characters/{char_with_horse_in_trasfondo}/equipment/carry",
            json={"item_index": 0, "carried_by": "montura", "source": "inventario"},
        )
        assert r.status_code == 200, r.text
        char = r.json().get("character", r.json())
        # promoted into monturas
        monturas = char.get("monturas") or []
        assert len(monturas) == 1
        assert monturas[0]["nombre_original"] == "Pony resistente"
        # removed from equipo_trasfondo
        tras = char.get("equipo_trasfondo") or []
        assert not any(
            it.get("nombre") == "Pony resistente" for it in tras
        ), f"pony not removed from equipo_trasfondo: {tras}"

    def test_carry_to_montura_400_when_no_mount_anywhere(self, api_client, char_no_mount):
        r = api_client.patch(
            f"{API}/characters/{char_no_mount}/equipment/carry",
            json={"item_index": 0, "carried_by": "montura", "source": "inventario"},
        )
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "montura" in detail.lower()

    def test_carry_back_to_personaje_works(self, api_client, char_with_horse_in_ocupacion):
        # First promote+carry the daga to montura
        api_client.patch(
            f"{API}/characters/{char_with_horse_in_ocupacion}/equipment/carry",
            json={"item_index": 1, "carried_by": "montura", "source": "equipo_ocupacion"},
        )
        # Locate the Daga's current index in equipo_ocupacion (independent of
        # whether horse was removed)
        r0 = api_client.get(f"{API}/characters/{char_with_horse_in_ocupacion}")
        ocup0 = r0.json().get("equipo_ocupacion") or []
        daga_idx = next(
            (i for i, it in enumerate(ocup0)
             if isinstance(it, dict) and it.get("nombre") == "Daga"),
            None,
        )
        assert daga_idx is not None, f"Daga not found in equipo_ocupacion: {ocup0}"
        # Now move it back to personaje
        r = api_client.patch(
            f"{API}/characters/{char_with_horse_in_ocupacion}/equipment/carry",
            json={"item_index": daga_idx, "carried_by": "personaje", "source": "equipo_ocupacion"},
        )
        assert r.status_code == 200, r.text
        char = r.json().get("character", r.json())
        ocup = char.get("equipo_ocupacion") or []
        daga = next((it for it in ocup if it.get("nombre") == "Daga"), None)
        assert daga is not None and daga.get("portado_por") == "personaje"


# ===========================================================================
# 3) PATCH /equipment/edit-item
# ===========================================================================
class TestEditItemEndpoint:
    def test_edit_item_changes_categoria_and_posicion(self, api_client, char_clean):
        r = api_client.patch(
            f"{API}/characters/{char_clean}/equipment/edit-item",
            json={
                "item_index": 0,
                "source": "inventario",
                "nueva_categoria": "consumibles",
                "nueva_posicion": "personaje",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        char = body.get("character", body)
        item = char["inventario"][0]
        assert item["categoria"] == "consumibles"
        assert item["posicion"] == "personaje"
        assert item["nombre"] == "Raciones (1 día) (Paquete de 10)"

    def test_edit_item_changes_nombre(self, api_client, char_clean):
        r = api_client.patch(
            f"{API}/characters/{char_clean}/equipment/edit-item",
            json={
                "item_index": 1,
                "source": "inventario",
                "nuevo_nombre": "Antorcha (renombrada)",
            },
        )
        assert r.status_code == 200, r.text
        char = r.json().get("character", r.json())
        assert char["inventario"][1]["nombre"] == "Antorcha (renombrada)"

    def test_edit_item_invalid_source_400(self, api_client, char_clean):
        r = api_client.patch(
            f"{API}/characters/{char_clean}/equipment/edit-item",
            json={"item_index": 0, "source": "armas", "nueva_categoria": "x"},
        )
        assert r.status_code == 400
        assert "source" in r.json().get("detail", "").lower() or \
               "soportad" in r.json().get("detail", "").lower()

    def test_edit_item_index_out_of_range_400(self, api_client, char_clean):
        r = api_client.patch(
            f"{API}/characters/{char_clean}/equipment/edit-item",
            json={"item_index": 99, "source": "inventario", "nueva_categoria": "x"},
        )
        assert r.status_code == 400
        assert "rango" in r.json().get("detail", "").lower() or \
               "range" in r.json().get("detail", "").lower()

    def test_edit_item_negative_index_400(self, api_client, char_clean):
        r = api_client.patch(
            f"{API}/characters/{char_clean}/equipment/edit-item",
            json={"item_index": -1, "source": "inventario", "nueva_categoria": "x"},
        )
        assert r.status_code == 400

    def test_edit_item_nonexistent_character_404(self, api_client):
        r = api_client.patch(
            f"{API}/characters/no-such-character-id/equipment/edit-item",
            json={"item_index": 0, "source": "inventario", "nueva_categoria": "x"},
        )
        assert r.status_code == 404


# ===========================================================================
# 4) Regression — Xalan + mount endpoints + ubicacion + travel event
# ===========================================================================
class TestRegression:
    def test_xalan_get_ok(self, api_client):
        r = api_client.get(f"{API}/characters/{XALAN_ID}")
        assert r.status_code == 200
        char = r.json()
        assert char.get("nombre")

    def test_xalan_weight_summary_has_monturas_detalle(self, api_client):
        r = api_client.get(f"{API}/characters/{XALAN_ID}/weight-summary")
        assert r.status_code == 200
        data = r.json()
        assert "monturas_detalle" in data

    def test_carry_with_existing_monturas_uses_first_mount(self, api_client, mongo_db):
        """Char already has monturas[]; carry should NOT auto-promote, just use existing."""
        cid = _new_character(
            mongo_db,
            monturas=[{
                "id": "m-existing",
                "nombre_original": "Pony existente",
                "nombre_personalizado": "Pony existente",
                "especie": "pony",
                "capacidad_carga": 150,
                "velocidad": 12,
                "constitucion": "",
                "equipo": [],
                "es_jinete_activo": True,
            }],
            inventario=[
                {"nombre": "Antorcha", "cantidad": 2, "peso_kg": 0.5,
                 "categoria": "equipo_general", "posicion": "personaje"},
            ],
        )
        try:
            r = api_client.patch(
                f"{API}/characters/{cid}/equipment/carry",
                json={"item_index": 0, "carried_by": "montura", "source": "inventario"},
            )
            assert r.status_code == 200, r.text
            char = r.json().get("character", r.json())
            assert len(char.get("monturas") or []) == 1
            assert char["monturas"][0]["id"] == "m-existing"
            # Item moved
            inv = char["inventario"]
            assert inv[0]["portado_por"] == "montura"
            assert inv[0].get("mount_id") == "m-existing"
        finally:
            mongo_db.characters.delete_one({"_id": cid})

    def test_mounts_post_and_patch_crud(self, api_client, mongo_db):
        cid = _new_character(mongo_db)
        try:
            r = api_client.post(
                f"{API}/characters/{cid}/monturas",
                json={"nombre_original": "Caballo de caminos",
                      "capacidad_carga": 200, "velocidad": 12},
            )
            assert r.status_code == 200, r.text
            body = r.json()
            mount_id = (body.get("mount") or {}).get("id")
            assert mount_id, f"no mount id in response: {body}"

            r = api_client.patch(
                f"{API}/characters/{cid}/monturas/{mount_id}",
                json={"nombre_personalizado": "Brisa", "capacidad_carga": 250},
            )
            assert r.status_code == 200, r.text
        finally:
            mongo_db.characters.delete_one({"_id": cid})

    # iter68 ubicacion regression
    def test_set_ubicacion_returns_full_snapshot(self, api_client, mongo_db):
        cid = _new_character(mongo_db)
        try:
            r = api_client.patch(
                f"{API}/characters/{cid}/ubicacion",
                json={"location_id": HOBBITON_ID},
            )
            assert r.status_code == 200, r.text
            u = r.json()["ubicacion"]
            for k in ("id", "nombre", "region", "tipo", "x", "y", "tipo_tierra", "terreno"):
                assert k in u
            assert u["id"] == HOBBITON_ID
        finally:
            mongo_db.characters.delete_one({"_id": cid})

    # iter67 travel event regression
    def test_generate_event_camino_cd10(self, api_client):
        r = api_client.post(
            f"{API}/travel/generate-event?terreno=gran_camino&estacion=verano"
            f"&tipo_tierra=tierras_libres"
        )
        assert r.status_code == 200, r.text
        assert r.json().get("cd_prueba") == 10

    def test_generate_event_muy_dificil_cd20(self, api_client):
        r = api_client.post(
            f"{API}/travel/generate-event?terreno=muy_dificil&estacion=invierno"
            f"&tipo_tierra=tierras_salvajes"
        )
        assert r.status_code == 200
        assert r.json().get("cd_prueba") == 20
