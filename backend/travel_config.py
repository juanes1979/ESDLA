"""
Travel System Configuration for Middle-earth RPG

This module contains the terrain difficulty multipliers, danger modifiers,
and travel calculation logic based on the LOTR 5e rules.
"""

# =============================================================================
# TERRAIN DIFFICULTY - Affects travel time
# =============================================================================
# Multiplier applied to base travel time based on terrain difficulty
TERRAIN_MULTIPLIERS = {
    'facil': 1.0,           # Normal travel speed (roads, plains)
    'moderado': 1.25,       # Slightly slower (forests, hills)
    'dificil': 1.5,         # Slower travel (dense forest, rough terrain)
    'muy_dificil': 2.0,     # Very slow (mountains, swamps)
    'desalentador': 3.0,    # Extremely slow (volcanic, corrupted)
    'infranqueable': None,  # Cannot pass - must find alternative route
}

# Terrain names for display
TERRAIN_NAMES = {
    'facil': 'Fácil',
    'moderado': 'Moderado',
    'dificil': 'Difícil',
    'muy_dificil': 'Muy Difícil',
    'desalentador': 'Desalentador',
    'infranqueable': 'Infranqueable',
}

# Terrain descriptions
TERRAIN_DESCRIPTIONS = {
    'facil': 'Caminos bien mantenidos, llanuras abiertas, praderas.',
    'moderado': 'Colinas suaves, bosques claros, senderos secundarios.',
    'dificil': 'Bosques densos, terreno accidentado, páramos.',
    'muy_dificil': 'Montañas, pantanos, ciénagas profundas.',
    'desalentador': 'Tierras volcánicas, regiones malditas, desiertos extremos.',
    'infranqueable': 'Picos montañosos, acantilados, barreras naturales. Solo atravesables por pasos específicos.',
}

# =============================================================================
# REGION DANGER CLASS - Affects encounter probability and type
# =============================================================================
# Modifier for random encounter checks (higher = more dangerous)
DANGER_MODIFIERS = {
    'tierras_libres': 0,        # Safe lands - rare encounters
    'tierras_fronterizas': 2,   # Border regions - occasional threats
    'tierras_salvajes': 4,      # Wild lands - regular encounters
    'tierras_sombra': 6,        # Shadow lands - frequent danger
    'tierras_oscuras': 8,       # Dark lands - constant threat
}

# Danger class names
DANGER_NAMES = {
    'tierras_libres': 'Tierras Libres',
    'tierras_fronterizas': 'Tierras Fronterizas',
    'tierras_salvajes': 'Tierras Salvajes',
    'tierras_sombra': 'Tierras de la Sombra',
    'tierras_oscuras': 'Tierras Oscuras',
}

# Danger class descriptions
DANGER_DESCRIPTIONS = {
    'tierras_libres': 'Regiones civilizadas y seguras bajo la protección de los Pueblos Libres.',
    'tierras_fronterizas': 'Zonas en los límites de la civilización, donde el peligro acecha.',
    'tierras_salvajes': 'Tierras sin ley donde bestias y bandidos campan a sus anchas.',
    'tierras_sombra': 'Regiones bajo la influencia de Sauron o antiguos males.',
    'tierras_oscuras': 'Dominios del enemigo donde la oscuridad reina.',
}

# Encounter probability base (percentage per day of travel)
ENCOUNTER_BASE_CHANCE = {
    'tierras_libres': 5,        # 5% base chance
    'tierras_fronterizas': 15,  # 15% base chance
    'tierras_salvajes': 25,     # 25% base chance
    'tierras_sombra': 40,       # 40% base chance
    'tierras_oscuras': 60,      # 60% base chance
}

# =============================================================================
# TRAVEL CALCULATIONS
# =============================================================================

def calculate_travel_time(base_days: float, terrain: str) -> dict:
    """
    Calculate actual travel time based on terrain difficulty.
    
    Args:
        base_days: Base number of days for the journey on easy terrain
        terrain: Terrain type ('facil', 'moderado', etc.)
    
    Returns:
        dict with travel time info or None if infranqueable
    """
    multiplier = TERRAIN_MULTIPLIERS.get(terrain, 1.0)
    
    if multiplier is None:  # Infranqueable
        return {
            'passable': False,
            'message': 'Este terreno es infranqueable. Busca un paso de montaña o ruta alternativa.',
            'terrain_name': TERRAIN_NAMES.get(terrain, terrain),
        }
    
    actual_days = base_days * multiplier
    
    return {
        'passable': True,
        'base_days': base_days,
        'multiplier': multiplier,
        'actual_days': round(actual_days, 1),
        'terrain_name': TERRAIN_NAMES.get(terrain, terrain),
        'terrain_description': TERRAIN_DESCRIPTIONS.get(terrain, ''),
    }


def calculate_danger_level(region_class: str, terrain: str = None) -> dict:
    """
    Calculate danger level for a region.
    
    Args:
        region_class: Danger class ('tierras_libres', etc.)
        terrain: Optional terrain type for additional modifiers
    
    Returns:
        dict with danger information
    """
    base_modifier = DANGER_MODIFIERS.get(region_class, 0)
    encounter_chance = ENCOUNTER_BASE_CHANCE.get(region_class, 10)
    
    # Terrain can increase danger
    terrain_danger_bonus = {
        'facil': 0,
        'moderado': 0,
        'dificil': 5,
        'muy_dificil': 10,
        'desalentador': 15,
        'infranqueable': 20,
    }
    
    if terrain:
        encounter_chance += terrain_danger_bonus.get(terrain, 0)
    
    return {
        'region_class': region_class,
        'class_name': DANGER_NAMES.get(region_class, region_class),
        'class_description': DANGER_DESCRIPTIONS.get(region_class, ''),
        'danger_modifier': base_modifier,
        'encounter_chance': min(encounter_chance, 95),  # Cap at 95%
    }


def can_traverse(terrain: str, is_mountain_pass: bool = False) -> bool:
    """
    Check if terrain can be traversed.
    
    Args:
        terrain: Terrain type
        is_mountain_pass: Whether this location is a mountain pass
    
    Returns:
        True if traversable, False otherwise
    """
    if terrain == 'infranqueable':
        return is_mountain_pass  # Only passes can go through
    return True


def find_alternative_route(origin: dict, destination: dict, all_locations: list) -> list:
    """
    Find mountain passes or alternative routes when direct path is blocked.
    
    This is a simplified version - a full implementation would use
    pathfinding algorithms considering the actual map geometry.
    
    Args:
        origin: Origin location dict
        destination: Destination location dict  
        all_locations: List of all locations with terrain data
    
    Returns:
        List of suggested waypoints (mountain passes)
    """
    passes = [
        loc for loc in all_locations
        if loc.get('es_paso_montana') and loc.get('tipo_terreno') != 'infranqueable'
    ]
    
    # Sort by distance to origin (simplified - just by name for now)
    # A real implementation would calculate actual distances
    return passes


# =============================================================================
# TRAVEL SUMMARY
# =============================================================================

def calculate_journey_summary(segments: list) -> dict:
    """
    Calculate summary statistics for a multi-segment journey.
    
    Args:
        segments: List of journey segments with terrain and danger info
    
    Returns:
        dict with total time, average danger, warnings, etc.
    """
    total_days = 0
    max_danger = 0
    blocked_segments = []
    warnings = []
    
    for i, seg in enumerate(segments):
        if not seg.get('passable', True):
            blocked_segments.append({
                'index': i,
                'from': seg.get('from_name', ''),
                'to': seg.get('to_name', ''),
                'reason': seg.get('message', 'Terreno infranqueable'),
            })
            continue
            
        total_days += seg.get('actual_days', 0)
        danger = seg.get('danger_modifier', 0)
        if danger > max_danger:
            max_danger = danger
            
        # Add warnings for dangerous segments
        if seg.get('region_class') in ['tierras_sombra', 'tierras_oscuras']:
            warnings.append({
                'type': 'danger',
                'segment': i,
                'message': f"Cuidado: {seg.get('to_name', '')} está en {DANGER_NAMES.get(seg.get('region_class'), 'territorio peligroso')}",
            })
    
    return {
        'total_days': round(total_days, 1),
        'total_segments': len(segments),
        'passable_segments': len(segments) - len(blocked_segments),
        'blocked_segments': blocked_segments,
        'max_danger_level': max_danger,
        'warnings': warnings,
        'journey_possible': len(blocked_segments) == 0,
    }
