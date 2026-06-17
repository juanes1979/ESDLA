"""Tests de regresión del motor D100 (partes deterministas, sin IA ni DB)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.trading_d100 import (
    DEFAULT_D100_CONFIG, _contexto_factor, _abil_mod,
)


def test_default_config_keys():
    for k in ("anger_umbral", "anger_factor", "tolerancia_base", "venta_ratio",
              "d100_base_aceptacion", "margen_contraoferta", "opposed_skill_factor"):
        assert k in DEFAULT_D100_CONFIG


def test_contexto_factor_neutral():
    assert _contexto_factor("compra", "general", {}) == 1.0


def test_contexto_factor_war_weapons():
    ctx = {"mod_armas": 40, "mod_general": 10}
    # categoria 'armas' usa mod_armas (40%) → factor 1.4
    assert abs(_contexto_factor("compra", "armas", ctx) - 1.4) < 1e-9
    # categoria desconocida → mod_general (10%) → 1.1
    assert abs(_contexto_factor("compra", "desconocida", ctx) - 1.1) < 1e-9


def test_abil_mod():
    assert _abil_mod(10) == 0
    assert _abil_mod(15) == 2
    assert _abil_mod(8) == -1
    assert _abil_mod(None) == 0
