"""Regresión de la lógica de coherencia de rasgos de PNJ comerciante."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.trading_npc_data import (  # noqa: E402
    PROFESIONES, RASGOS_POSITIVOS, RASGOS_NEGATIVOS, MODOS_HABLA,
    rasgos_validos, elegir_rasgo_aleatorio, elegir_modo_hablar,
)


def _names(lst):
    return {r["nombre"] for r in lst}


def test_listas_completas():
    assert len(PROFESIONES) == 28
    assert len(MODOS_HABLA) == 20
    assert len(RASGOS_NEGATIVOS) >= 49
    assert len(RASGOS_POSITIVOS) >= 49


def test_elfo_artesano_excluye_suciedad_y_mala_artesania():
    v = rasgos_validos("Elfos", "Elfo Artesano")
    neg = _names(v["negativos"])
    assert "Higiene deplorable" not in neg
    assert "Churrero del metal" not in neg
    assert "Manos de grasa" not in neg


def test_mago_errante_excluye_antimagia_y_magia_falsa():
    v = rasgos_validos("Hombres", "Mago Errante")
    neg = _names(v["negativos"])
    assert "Aversión a la magia" not in neg
    assert "Falso experto en magia" not in neg


def test_profesion_criminal_excluye_rasgos_santos():
    v = rasgos_validos("Hombres", "Salteador de caminos")
    pos = _names(v["positivos"])
    assert "Filántropo discreto" not in pos
    assert "Compromiso comunitario" not in pos


def test_rasgo_aleatorio_es_valido():
    for _ in range(30):
        r = elegir_rasgo_aleatorio("Elfos", "Elfo Artesano")
        assert r["tipo"] in ("positivo", "negativo")
        # No debe devolver un rasgo prohibido para elfo artesano
        assert r["nombre"] not in {"Higiene deplorable", "Churrero del metal", "Manos de grasa"}


def test_modo_hablar_normal_o_valido():
    nombres = {m["nombre"] for m in MODOS_HABLA} | {"Normal"}
    for _ in range(30):
        assert elegir_modo_hablar()["nombre"] in nombres
