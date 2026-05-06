"""
iter83 — Validación: cuando un personaje viaja MONTADO, la velocidad
del grupo debe ser la de la montura (no la base del personaje).

Bug original: Xalan Fuenteoscura (vel 9m) montado en Poni (vel 12m) → el
sistema mostraba 22.5 km/día (9m × 2.5) en vez de 30 km/día (12m × 2.5).
"""
from routes.travel_routes import TravelPartyMember


def _member(*, vel_base, mount_speed=0, has_mount=False):
    return TravelPartyMember(
        personaje_id="x",
        nombre="Xalan",
        velocidad_base=vel_base,
        tiene_montura=has_mount,
        montura_velocidad=mount_speed,
    )


def test_pie_devuelve_velocidad_personaje():
    m = _member(vel_base=9)
    info = m.velocidad_efectiva()
    assert info["velocidad"] == 9
    assert info["monta"] is False


def test_montado_en_poni_usa_velocidad_montura():
    m = _member(vel_base=9, mount_speed=12, has_mount=True)
    info = m.velocidad_efectiva()
    assert info["velocidad"] == 12
    assert info["monta"] is True


def test_montado_en_caballo_caminos_usa_14m():
    m = _member(vel_base=9, mount_speed=14, has_mount=True)
    info = m.velocidad_efectiva()
    assert info["velocidad"] == 14


def test_montado_pero_terreno_no_lo_permite_usa_pie():
    m = _member(vel_base=9, mount_speed=12, has_mount=True)
    info = m.velocidad_efectiva(mount_allowed=False)
    # Si el terreno no permite montura → vuelve a pie
    assert info["velocidad"] == 9
    assert info["monta"] is False


def test_km_dia_acordes_para_poni():
    """22.5 km/día es la base del humano. Con poni (12m) debe ser 30."""
    m = _member(vel_base=9, mount_speed=12, has_mount=True)
    vel = m.velocidad_efectiva()["velocidad"]
    KM_PER_METER = 2.5
    assert vel * KM_PER_METER == 30


def test_km_dia_acordes_para_caballo_caminos():
    m = _member(vel_base=9, mount_speed=14, has_mount=True)
    vel = m.velocidad_efectiva()["velocidad"]
    KM_PER_METER = 2.5
    assert vel * KM_PER_METER == 35


def test_montura_sobrecargada_aplica_minus_33_pct():
    m = TravelPartyMember(
        personaje_id="x",
        nombre="X",
        velocidad_base=9,
        tiene_montura=True,
        montura_velocidad=12,
        montura_capacidad_kg=100,
        montura_carga_actual_kg=150,  # supera capacidad
    )
    info = m.velocidad_efectiva()
    assert info["montura_sobrecargada"] is True
    # 12 * 0.67 = 8.04
    assert abs(info["velocidad"] - (12 * 0.67)) < 0.01
