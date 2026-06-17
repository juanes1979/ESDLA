"""Tests de regresión del motor D100 (partes deterministas, sin IA ni DB)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.trading_d100 import (
    DEFAULT_D100_CONFIG, _contexto_factor, _mod_contexto_pct,
    _mod_relacion_nivel, _afinidad_raza_pct, _descuento_fidelidad,
)


def test_default_config_keys():
    for k in ("anger_umbral", "anger_factor", "tolerancia_base", "venta_ratio",
              "d100_base_aceptacion", "descuento_base_relacion", "descuento_maximo",
              "divisor_desviacion", "umbral_pillado", "enfado_duda", "enfado_pillado",
              "relacion_pillado", "mod_rel_amigo", "subida_precio_duda"):
        assert k in DEFAULT_D100_CONFIG


def test_mod_contexto_pct():
    # contexto que ENCARECE (mod +) → descuento negativo
    assert _mod_contexto_pct("armas", {"mod_armas": 5}) == -0.05
    # contexto que abarata (mod -) → más descuento
    assert _mod_contexto_pct("armas", {"mod_armas": -5}) == 0.05
    assert _mod_contexto_pct("armas", {}) == 0.0


def test_mod_relacion_nivel():
    eng = DEFAULT_D100_CONFIG
    assert _mod_relacion_nivel(-70, eng) == -4   # hostil
    assert _mod_relacion_nivel(-30, eng) == -2   # receloso
    assert _mod_relacion_nivel(0, eng) == 0      # neutral
    assert _mod_relacion_nivel(30, eng) == 1     # cordial
    assert _mod_relacion_nivel(60, eng) == 2     # amigo
    assert _mod_relacion_nivel(90, eng) == 4     # hermandad


def test_afinidad_raza_pct():
    assert _afinidad_raza_pct("Enanos", "Enanos") == 0.05   # misma raza
    assert _afinidad_raza_pct("Elfos", "Enanos") == -0.08   # -8 puntos / 100
    assert _afinidad_raza_pct("", "Enanos") == 0.0


def test_descuento_fidelidad_ejemplo():
    # Ejemplo del usuario: relación +7, contexto +0.02, raza -0.03 → 0.11
    eng = DEFAULT_D100_CONFIG
    res = _descuento_fidelidad(eng, 7, 0.02, -0.03)
    assert abs(res["descuento_relacion"] - 0.12) < 1e-9   # 0.05 + 7*0.01
    assert abs(res["descuento_total"] - 0.11) < 1e-9


def test_descuento_fidelidad_sin_relacion_positiva():
    eng = DEFAULT_D100_CONFIG
    res = _descuento_fidelidad(eng, 0, 0.0, 0.0)
    assert res["descuento_relacion"] == 0.0
    assert res["descuento_total"] == 0.0


def test_descuento_fidelidad_tope():
    eng = DEFAULT_D100_CONFIG
    res = _descuento_fidelidad(eng, 100, 0.0, 0.0)  # 0.05 + 1.0 = 1.05 → tope 0.40
    assert res["descuento_total"] == 0.40


def test_contexto_factor_neutral():
    assert _contexto_factor("compra", "general", {}) == 1.0
