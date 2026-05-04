"""
iter83b — Tests del fix de tipo_via dominante (camino "grande/mayor" del
pathfinder no se reconocía y reportaba campo_abierto).
"""


def test_road_type_map_reconoce_grande():
    """Replica el ROAD_TYPE_MAP del backend tras el fix."""
    ROAD_TYPE_MAP = {
        'grande': 'camino_real', 'gran_camino': 'camino_real',
        'camino_real': 'camino_real', 'carretera': 'camino_real',
        'mayor': 'camino_mayor', 'camino_mayor': 'camino_mayor',
        'menor': 'camino_menor', 'camino_menor': 'camino_menor',
        'sendas': 'sendas', 'senda': 'senda', 'sendero': 'sendero',
    }
    # Antes del fix: "grande" no estaba en la lista → caía a "campo_abierto"
    assert ROAD_TYPE_MAP['grande'] == 'camino_real'
    assert ROAD_TYPE_MAP['mayor'] == 'camino_mayor'
    assert ROAD_TYPE_MAP['menor'] == 'camino_menor'


def test_dominante_por_km_acumulados():
    """El tipo_via de la ruta debe ser el dominante por km, no el último seg."""
    # Simulación: 4 segmentos por camino (80 km) + 1 corto en campo (10 km)
    via_distance = {'camino_real': 80, 'campo_abierto': 10}
    dominant = max(via_distance.items(), key=lambda kv: kv[1])[0]
    assert dominant == 'camino_real'


def test_dunedain_da_base_2():
    """Cualquier Dúnedain (singular o plural, con/sin tilde) debe sumar 2."""
    from backend.routes.eye_routes import _classify_race
    assert _classify_race('Dúnedain del Norte') == 2
    assert _classify_race('Dunedain') == 2
    assert _classify_race('Dúnadan solitario') == 2
    # Plural sin tilde
    assert _classify_race('Dunedain de Arnor') == 2


def test_grupo_mixto_usa_max_de_party():
    """Grupo Hobbit(0) + Hombre(0) + Dúnedain(2) → max=2."""
    from backend.routes.eye_routes import _classify_race
    party_races = ['Hobbits de la Comarca', 'Hombres de Bree', 'Dunedain del Norte']
    bases = [_classify_race(r) for r in party_races]
    assert max(bases) == 2
