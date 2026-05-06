"""
Tests del Sistema Ojo de Mordor — Fase 1 (núcleo, sin LLM).
"""
import pytest
from routes.eye_routes import (
    _classify_race,
    _calc_threshold,
    _resolve_region_type,
    SOURCE_DEFAULT_DELTA,
    THRESHOLD_BY_TYPE,
    REGION_DEFAULT_TYPE,
)


# ============== CLASIFICACIÓN DE RAZAS ==============
class TestClassifyRace:
    def test_hobbit_es_0(self):
        assert _classify_race("Hobbits de la Comarca") == 0

    def test_hombres_es_0(self):
        assert _classify_race("Hombres de Bree") == 0

    def test_enanos_es_1(self):
        assert _classify_race("Enanos de las Colinas de Hierro") == 1

    def test_dunedain_es_2(self):
        assert _classify_race("Dúnedain del Norte") == 2

    def test_elfos_es_2(self):
        assert _classify_race("Elfos de Lothlorien") == 2

    def test_alto_elfo_es_3(self):
        # Coincide primero con "altos elfos" (3) antes que "elfo"
        assert _classify_race("Altos Elfos de Rivendel") == 3

    def test_desconocido_es_0(self):
        assert _classify_race("Olifante Salvaje") == 0

    def test_vacio_es_0(self):
        assert _classify_race("") == 0


# ============== CLASIFICACIÓN DE REGIÓN ==============
class TestRegionClassification:
    def test_eriador_fronteriza(self):
        assert _resolve_region_type("ERIADOR", {}) == "fronteriza"

    def test_mordor_oscura(self):
        assert _resolve_region_type("MORDOR", {}) == "oscura"

    def test_rhovanion_salvaje(self):
        assert _resolve_region_type("RHOVANION", {}) == "salvaje"

    def test_overrides_aplican(self):
        # El admin marca MORDOR como fronteriza (caso especial)
        assert _resolve_region_type("MORDOR", {"MORDOR": "fronteriza"}) == "fronteriza"

    def test_region_desconocida_es_salvaje(self):
        assert _resolve_region_type("VALINOR", {}) == "salvaje"

    def test_lowercase_no_coincide(self):
        # Las claves se guardan en MAYÚSCULAS y _resolve_region_type
        # hace .upper() del input, pero el dict de overrides debe
        # almacenar siempre en upper.
        assert _resolve_region_type("eriador", {}) == "fronteriza"


# ============== UMBRAL ==============
class TestThreshold:
    def test_fronteriza_18(self):
        info = _calc_threshold("ERIADOR", {}, 0)
        assert info["threshold"] == 18
        assert info["region_type"] == "fronteriza"

    def test_salvaje_16(self):
        info = _calc_threshold("RHOVANION", {}, 0)
        assert info["threshold"] == 16

    def test_oscura_14(self):
        info = _calc_threshold("MORDOR", {}, 0)
        assert info["threshold"] == 14

    def test_modifiers_protector_poderoso_4(self):
        info = _calc_threshold("MORDOR", {}, 4)
        assert info["threshold"] == 18

    def test_modifiers_enemigo_conoce_minus_4(self):
        info = _calc_threshold("ERIADOR", {}, -4)
        assert info["threshold"] == 14

    def test_threshold_minimo_1(self):
        info = _calc_threshold("MORDOR", {}, -100)
        assert info["threshold"] == 1


# ============== DEFAULTS DE INCREMENTO ==============
class TestSourceDeltas:
    def test_nat1_es_1(self):
        assert SOURCE_DEFAULT_DELTA["nat1"] == 1

    def test_magia_menor_1_mayor_2_poderosa_3(self):
        assert SOURCE_DEFAULT_DELTA["magic_minor"] == 1
        assert SOURCE_DEFAULT_DELTA["magic_major"] == 2
        assert SOURCE_DEFAULT_DELTA["magic_powerful"] == 3

    def test_objeto_famoso_2(self):
        assert SOURCE_DEFAULT_DELTA["object"] == 2


# ============== INVARIANTES DE LAS 18 REGIONES ==============
class TestRegions18:
    def test_18_regiones_clasificadas(self):
        # El sistema climático tiene 18 regiones — deben estar todas mapeadas
        assert len(REGION_DEFAULT_TYPE) == 18

    def test_todas_clasificacion_valida(self):
        for region, tipo in REGION_DEFAULT_TYPE.items():
            assert tipo in THRESHOLD_BY_TYPE, f"{region} → {tipo} no es tipo válido"

    def test_thresholds_segun_spec(self):
        assert THRESHOLD_BY_TYPE["fronteriza"] == 18
        assert THRESHOLD_BY_TYPE["salvaje"] == 16
        assert THRESHOLD_BY_TYPE["oscura"] == 14


# ============== INCREMENT A TRAVÉS DE API ==============
@pytest.mark.asyncio
class TestIncrementFlow:
    async def test_increment_nat1_aplica_delta_1(self, monkeypatch):
        from routes import eye_routes as er

        # Mock DB
        store = {}

        class FakeColl:
            async def find_one(self, q, proj=None):
                return store.get(q.get("id"))

            async def update_one(self, q, upd, upsert=False):
                _id = q.get("id")
                store[_id] = {**store.get(_id, {}), **upd.get("$set", {})}
                return type("R", (), {"matched_count": 1, "upserted_id": _id})

            async def insert_one(self, doc):
                store[doc["id"]] = doc
                return type("R", (), {"inserted_id": doc["id"]})

        class FakeDB:
            eye_state = FakeColl()
            characters = FakeColl()

        monkeypatch.setattr(er, "_get_db", lambda: FakeDB())

        # init estado
        state0 = await er._load_state("test1")
        assert state0["attention_total"] == 0

        # incrementa nat1
        req = er.IncrementRequest(source="nat1", character_name="X")
        result = await er.increment(req, state_id="test1")
        assert result["delta_applied"] == 1
        assert result["state"]["attention_total"] == 1
        assert len(result["state"]["history"]) == 1

    async def test_trigger_episode_resetea_a_initial(self, monkeypatch):
        from routes import eye_routes as er

        store = {
            "test2": {
                "id": "test2",
                "party_member_ids": [],
                "attention_total": 20,
                "initial_value": 3,
                "history": [],
                "region_overrides": {},
                "threshold_modifiers": 0,
            }
        }

        class FakeColl:
            async def find_one(self, q, proj=None):
                return store.get(q.get("id"))

            async def update_one(self, q, upd, upsert=False):
                _id = q.get("id")
                store[_id] = {**store.get(_id, {}), **upd.get("$set", {})}
                return type("R", (), {"matched_count": 1, "upserted_id": _id})

        class FakeDB:
            eye_state = FakeColl()

        monkeypatch.setattr(er, "_get_db", lambda: FakeDB())

        result = await er.trigger_episode(state_id="test2")
        assert result["previous_attention"] == 20
        assert result["state"]["attention_total"] == 3
