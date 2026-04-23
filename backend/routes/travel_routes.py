"""
Travel System Routes - LOTR 5e RPG
Complete travel mechanics with editable rules and tables
"""
from fastapi import APIRouter, HTTPException, Body
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import random
import uuid

router = APIRouter(prefix="/travel", tags=["Travel System"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# ============== MODELS ==============

class TravelEvent(BaseModel):
    """Individual travel event from the table"""
    id: str = Field(default_factory=lambda: f"event_{uuid.uuid4().hex[:8]}")
    d20_min: int
    d20_max: int
    nombre: str
    nombre_en: Optional[str] = None
    fatigue_cd_increase: int
    consecuencias_exito: str
    consecuencias_fracaso: str
    requiere_salvacion_extra: bool = False
    tipo_salvacion_extra: Optional[str] = None  # "destreza", "carisma", "sabiduria"
    puntos_sombra: int = 0

class TravelEventTable(BaseModel):
    """Complete travel event table (editable)"""
    id: str = "travel_events_main"
    nombre: str = "Tabla de Acontecimientos de Viaje"
    eventos: List[TravelEvent]
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventObjective(BaseModel):
    """Event objective (who resolves it)"""
    id: str = Field(default_factory=lambda: f"obj_{uuid.uuid4().hex[:8]}")
    d3_value: int
    papel: str  # "explorador", "vigia", "cazador"
    prueba: str  # "Sabiduría (Explorar)", etc.
    atributo: str  # "sabiduria"
    habilidad: str  # "explorar", "percepcion", "cazar"

class TerrainDifficulty(BaseModel):
    """Terrain difficulty settings"""
    id: str = Field(default_factory=lambda: f"terrain_{uuid.uuid4().hex[:8]}")
    tipo: str  # "dificil", "camino", "campo_abierto"
    nombre: str
    cd_prueba: int
    modificador_velocidad: float = 1.0
    permite_montura: bool = True

class LandTypeConfig(BaseModel):
    """Land type configuration for PX and modifiers"""
    id: str = Field(default_factory=lambda: f"land_{uuid.uuid4().hex[:8]}")
    tipo: str  # "tierras_libres", "tierras_fronterizas", etc.
    nombre: str
    ventaja_acontecimientos: bool = False
    desventaja_acontecimientos: bool = False
    px_camino: int
    px_campo_abierto: int
    px_terreno_dificil: int
    permite_ritmo_rapido: bool = True

class TravelRulesConfig(BaseModel):
    """Main travel rules configuration (editable)"""
    id: str = "travel_rules_main"
    # Fatigue base
    fatigue_base_cd: int = 10
    fatigue_fail_by_5_levels: int = 2
    fatigue_fail_by_10_levels: int = 3
    # Orientation check
    orientation_cd: int = 15
    orientation_fail_distance: int = 2
    orientation_fail_by_5_distance: int = 1
    orientation_success_distance: int = 3
    orientation_success_by_5_distance: int = 4
    # Forced march
    forced_march_cd: int = 15
    forced_march_km_per_hour: float = 6.0
    # Speed settings (days per hex)
    speed_slow_threshold: int = 5  # feet
    speed_slow_days: int = 2
    speed_normal_days: int = 1
    speed_fast_threshold: int = 50  # feet
    speed_fast_days: float = 0.5  # 1 day per 2 hexes
    speed_very_fast_threshold: int = 80
    speed_very_fast_days: float = 0.33  # 1 day per 3 hexes
    # Season modifiers
    autumn_winter_disadvantage: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TravelPartyMember(BaseModel):
    """Party member for travel"""
    personaje_id: str
    nombre: str
    papel: Optional[str] = None  # guia, cazador, vigia, explorador
    tiene_montura: bool = False
    montura_nombre: Optional[str] = None
    montura_velocidad: float = 0  # Mount speed in METERS (0 if no mount). Horse ~18m
    montura_con_bonus: int = 0
    velocidad_base: float = 9  # Character base speed in METERS. Dúnedain=10, Elfos/Hombres=9, Enanos/Hobbits=7
    modificador_sabiduria: int = 0
    competencias: List[str] = []
    nivel: int = 1
    
    def velocidad_efectiva(self) -> float:
        """
        Get effective travel speed for this member in METERS.
        If mounted, use mount speed (if mount is faster).
        Otherwise use character base speed.
        """
        if self.tiene_montura and self.montura_velocidad > 0:
            return self.montura_velocidad
        return self.velocidad_base

class JourneyConfig(BaseModel):
    """Configuration for a journey"""
    origen_id: str
    origen_nombre: str
    destino_id: str
    destino_nombre: str
    evitar_sombra: bool = False  # Avoid shadow/dark lands
    evitar_tierras_oscuras: bool = False
    preferir_caminos: bool = True
    ritmo: str = "normal"  # lento, normal, rapido
    mes: str = "Cermië"
    estacion: str = "verano"
    horas_marcha_forzada: int = 0
    miembros: List[TravelPartyMember] = []

class JourneyDay(BaseModel):
    """Single day of journey (for day-by-day mode)"""
    dia: int
    casilla_actual: int
    terreno: str
    tipo_tierra: str
    distancia_recorrida_km: float
    eventos: List[Dict[str, Any]] = []
    fatiga_cd_acumulada: float = 0.0
    notas: str = ""

class OrientationCheckRequest(BaseModel):
    """Request for orientation check"""
    modificador_sabiduria: int = 0  # Guide's Wisdom modifier
    competencia_viajar: bool = False  # Proficiency in Survival/Travel
    competencia_cartografia: bool = False  # Proficiency in Cartographer's tools
    competencia_navegacion: bool = False  # Proficiency for sea travel
    tiene_mapa: bool = False  # Has a map of the route
    viaje_maritimo: bool = False  # Sea travel
    penalizacion_multiples_papeles: bool = False  # Guide has multiple roles (-5)
    bonus_competencia: int = 2  # Proficiency bonus

class OrientationCheckResult(BaseModel):
    """Result of an orientation check"""
    d20: int
    modificador: int
    total: int
    cd: int = 15  # DC is always 15
    exito: bool
    margen: int  # How much above/below DC
    casillas_hasta_evento: int  # 1, 2, 3, or 4 tiles until next event
    viaje_completado: bool = False  # True if check result >= remaining tiles
    detalle: str

class ActiveJourney(BaseModel):
    """Active journey state (for day-by-day mode)"""
    id: str = Field(default_factory=lambda: f"journey_{uuid.uuid4().hex[:8]}")
    config: JourneyConfig
    dias: List[JourneyDay] = []
    dia_actual: int = 1
    casillas_totales: int = 0
    casillas_recorridas: int = 0
    fatiga_cd_total: float = 10.0
    dias_extra: int = 0
    dias_reducidos: int = 0
    px_acumulados: int = 0
    completado: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== DEFAULT DATA ==============

DEFAULT_TRAVEL_EVENTS = [
    {
        "id": "event_terrible",
        "d20_min": 1,
        "d20_max": 2,
        "nombre": "Terrible desgracia",
        "nombre_en": "Terrible Misfortune",
        "fatigue_cd_increase": 3,
        "consecuencias_exito": "El peligro es evitado a tiempo.",
        "consecuencias_fracaso": "El objetivo debe realizar una tirada de salvación de Destreza. Si falla, queda reducido a 0 PG. Si tiene éxito, pierde la mitad de sus PG máximos.",
        "requiere_salvacion_extra": True,
        "tipo_salvacion_extra": "destreza",
        "puntos_sombra": 0
    },
    {
        "id": "event_desesperanza",
        "d20_min": 3,
        "d20_max": 4,
        "nombre": "Desesperanza",
        "nombre_en": "Despair",
        "fatigue_cd_increase": 2,
        "consecuencias_exito": "La compañía mantiene el ánimo.",
        "consecuencias_fracaso": "Todos los miembros de la compañía reciben 1d3 puntos de Sombra (tirada de salvación de Carisma para resistir).",
        "requiere_salvacion_extra": True,
        "tipo_salvacion_extra": "carisma",
        "puntos_sombra": 2
    },
    {
        "id": "event_decisiones",
        "d20_min": 5,
        "d20_max": 6,
        "nombre": "Decisiones erróneas",
        "nombre_en": "Wrong Decisions",
        "fatigue_cd_increase": 2,
        "consecuencias_exito": "Se toma el camino correcto.",
        "consecuencias_fracaso": "El objetivo recibe 1 punto de Sombra (tirada de salvación de Sabiduría para resistir).",
        "requiere_salvacion_extra": True,
        "tipo_salvacion_extra": "sabiduria",
        "puntos_sombra": 1
    },
    {
        "id": "event_percance",
        "d20_min": 7,
        "d20_max": 14,
        "nombre": "Percance",
        "nombre_en": "Mishap",
        "fatigue_cd_increase": 1,
        "consecuencias_exito": "El problema se resuelve sin mayores contratiempos.",
        "consecuencias_fracaso": "La CD aumenta en +2 adicional y la duración del viaje aumenta en 1 día.",
        "requiere_salvacion_extra": False,
        "tipo_salvacion_extra": None,
        "puntos_sombra": 0
    },
    {
        "id": "event_atajo",
        "d20_min": 15,
        "d20_max": 17,
        "nombre": "Atajo",
        "nombre_en": "Shortcut",
        "fatigue_cd_increase": 1,
        "consecuencias_exito": "Se encuentra un atajo. La duración del viaje se reduce en 1 día (mínimo 1).",
        "consecuencias_fracaso": "El atajo resulta ser un callejón sin salida.",
        "requiere_salvacion_extra": False,
        "tipo_salvacion_extra": None,
        "puntos_sombra": 0
    },
    {
        "id": "event_encuentro",
        "d20_min": 18,
        "d20_max": 19,
        "nombre": "Encuentro casual",
        "nombre_en": "Chance Encounter",
        "fatigue_cd_increase": 1,
        "consecuencias_exito": "Un encuentro favorable. La CD de fatiga no aumenta.",
        "consecuencias_fracaso": "El encuentro no resulta beneficioso.",
        "requiere_salvacion_extra": False,
        "tipo_salvacion_extra": None,
        "puntos_sombra": 0
    },
    {
        "id": "event_vista",
        "d20_min": 20,
        "d20_max": 20,
        "nombre": "Vista agradable",
        "nombre_en": "Pleasant Sight",
        "fatigue_cd_increase": 0,
        "consecuencias_exito": "Todos los integrantes de la compañía obtienen Inspiración.",
        "consecuencias_fracaso": "La vista es agradable pero no inspira tanto como podría.",
        "requiere_salvacion_extra": False,
        "tipo_salvacion_extra": None,
        "puntos_sombra": 0
    }
]

DEFAULT_EVENT_OBJECTIVES = [
    {"id": "obj_explorador", "d3_value": 1, "papel": "explorador", "prueba": "Sabiduría (Explorar)", "atributo": "sabiduria", "habilidad": "explorar"},
    {"id": "obj_vigia", "d3_value": 2, "papel": "vigia", "prueba": "Sabiduría (Percepción)", "atributo": "sabiduria", "habilidad": "percepcion"},
    {"id": "obj_cazador", "d3_value": 3, "papel": "cazador", "prueba": "Sabiduría (Caza)", "atributo": "sabiduria", "habilidad": "caza"}
]

# Terrain difficulties (dificultad del terreno - columna izquierda de la imagen)
DEFAULT_TERRAIN_DIFFICULTIES = [
    {"id": "terrain_facil", "tipo": "facil", "nombre": "Fácil", "cd_prueba": 10, "modificador_velocidad": 1.25, "permite_montura": True, "color": "#E8DCC4"},
    {"id": "terrain_moderado", "tipo": "moderado", "nombre": "Moderado", "cd_prueba": 12, "modificador_velocidad": 1.0, "permite_montura": True, "color": "#B5A642"},
    {"id": "terrain_dificil", "tipo": "dificil", "nombre": "Difícil", "cd_prueba": 15, "modificador_velocidad": 0.75, "permite_montura": True, "color": "#C4A35A"},
    {"id": "terrain_muy_dificil", "tipo": "muy_dificil", "nombre": "Muy Difícil", "cd_prueba": 18, "modificador_velocidad": 0.5, "permite_montura": False, "color": "#8B6914"},
    {"id": "terrain_desalentador", "tipo": "desalentador", "nombre": "Desalentador", "cd_prueba": 20, "modificador_velocidad": 0.25, "permite_montura": False, "color": "#CD5C5C"}
]

# Road types (tipos de camino)
DEFAULT_ROAD_TYPES = [
    {"id": "road_gran", "tipo": "gran_camino", "nombre": "Gran Camino", "cd_prueba": 8, "modificador_velocidad": 1.5, "permite_montura": True, "es_camino": True},
    {"id": "road_mayor", "tipo": "camino_mayor", "nombre": "Camino Mayor", "cd_prueba": 10, "modificador_velocidad": 1.25, "permite_montura": True, "es_camino": True},
    {"id": "road_menor", "tipo": "camino_menor", "nombre": "Camino Menor", "cd_prueba": 12, "modificador_velocidad": 1.1, "permite_montura": True, "es_camino": True},
    {"id": "road_sendas", "tipo": "sendas", "nombre": "Sendas", "cd_prueba": 14, "modificador_velocidad": 1.0, "permite_montura": False, "es_camino": True},
    {"id": "road_campo", "tipo": "campo_abierto", "nombre": "Campo Abierto", "cd_prueba": 15, "modificador_velocidad": 1.0, "permite_montura": True, "es_camino": False}
]

# Land types (tipos de tierra - columna derecha de la imagen)
# PX según la tabla del libro:
# - Camino: 0/10/25 PX según tipo de tierra
# - Campo abierto: 10/25/50 PX según tipo de tierra  
# - Terreno difícil: 25/50/100 PX según tipo de tierra
DEFAULT_LAND_TYPES = [
    {
        "id": "land_libres", 
        "tipo": "tierras_libres", 
        "nombre": "Tierras Libres", 
        "ventaja_acontecimientos": True, 
        "desventaja_acontecimientos": False, 
        "px_camino": 0, 
        "px_campo_abierto": 0, 
        "px_terreno_dificil": 0, 
        "permite_ritmo_rapido": True,
        "color": "#FFFFFF",
        "runa": "Ω"
    },
    {
        "id": "land_fronterizas", 
        "tipo": "tierras_fronterizas", 
        "nombre": "Tierras Fronterizas", 
        "ventaja_acontecimientos": True, 
        "desventaja_acontecimientos": False, 
        "px_camino": 0, 
        "px_campo_abierto": 10, 
        "px_terreno_dificil": 25, 
        "permite_ritmo_rapido": True,
        "color": "#FFFFFF",
        "runa": "ᛉ"
    },
    {
        "id": "land_salvajes", 
        "tipo": "tierras_salvajes", 
        "nombre": "Tierras Salvajes", 
        "ventaja_acontecimientos": False, 
        "desventaja_acontecimientos": False, 
        "px_camino": 10, 
        "px_campo_abierto": 25, 
        "px_terreno_dificil": 50, 
        "permite_ritmo_rapido": False,
        "color": "#FFFFFF",
        "runa": "ψ"
    },
    {
        "id": "land_sombra", 
        "tipo": "tierras_sombra", 
        "nombre": "Tierras de la Sombra", 
        "ventaja_acontecimientos": False, 
        "desventaja_acontecimientos": True, 
        "px_camino": 25, 
        "px_campo_abierto": 50, 
        "px_terreno_dificil": 100, 
        "permite_ritmo_rapido": False,
        "color": "#FFFFFF",
        "runa": "λ"
    },
    {
        "id": "land_oscuras", 
        "tipo": "tierras_oscuras", 
        "nombre": "Tierras Oscuras", 
        "ventaja_acontecimientos": False, 
        "desventaja_acontecimientos": True, 
        "px_camino": 25, 
        "px_campo_abierto": 50, 
        "px_terreno_dificil": 100, 
        "permite_ritmo_rapido": False,
        "color": "#FFFFFF",
        "runa": "Ω"
    }
]

# Complete PX Table (editable matrix)
# Combina: Tipo de Camino + Tipo de Tierra + Dificultad de Terreno
# Nota: Los Gran Caminos en tierras peligrosas son más rápidos
# pero más peligrosos (pueden estar vigilados). Las sendas suman PX extra.
DEFAULT_PX_TABLE = {
    "id": "px_table_main",
    "nombre": "Tabla de PX por Viaje",
    "descripcion": "Al cruzar un área peligrosa, cuenta un número de casillas igual a la puntuación de Peligro del área. Los caminos en tierras hostiles pueden estar vigilados.",
    "notas": [
        "Gran Camino: Rápido pero puede estar vigilado en tierras hostiles",
        "Camino Mayor/Menor: Más seguro pero añade PX extra por dificultad",
        "Los PX se calculan por casilla atravesada"
    ],
    # Tabla base por tipo de vía y tipo de tierra
    "filas": [
        {
            "tipo_via": "gran_camino",
            "nombre": "...Gran Camino",
            "tierras_libres": 0,
            "tierras_fronterizas": 0,
            "tierras_salvajes": 10,
            "tierras_sombra": 25,
            "tierras_oscuras": 25
        },
        {
            "tipo_via": "camino_mayor",
            "nombre": "...Camino Mayor",
            "tierras_libres": 0,
            "tierras_fronterizas": 5,
            "tierras_salvajes": 15,
            "tierras_sombra": 30,
            "tierras_oscuras": 30
        },
        {
            "tipo_via": "camino_menor",
            "nombre": "...Camino Menor",
            "tierras_libres": 0,
            "tierras_fronterizas": 5,
            "tierras_salvajes": 20,
            "tierras_sombra": 35,
            "tierras_oscuras": 35
        },
        {
            "tipo_via": "sendas",
            "nombre": "...Sendas",
            "tierras_libres": 0,
            "tierras_fronterizas": 10,
            "tierras_salvajes": 20,
            "tierras_sombra": 40,
            "tierras_oscuras": 40
        },
        {
            "tipo_via": "campo_abierto", 
            "nombre": "...Campo Abierto",
            "tierras_libres": 0,
            "tierras_fronterizas": 10,
            "tierras_salvajes": 25,
            "tierras_sombra": 50,
            "tierras_oscuras": 50
        },
        {
            "tipo_via": "terreno_dificil",
            "nombre": "...Terreno Difícil",
            "tierras_libres": 0,
            "tierras_fronterizas": 25,
            "tierras_salvajes": 50,
            "tierras_sombra": 100,
            "tierras_oscuras": 100
        }
    ],
    # Modificadores adicionales por dificultad del terreno
    "modificadores_terreno": {
        "facil": {"multiplicador": 1.0, "nombre": "Fácil", "bonus_px": 0},
        "moderado": {"multiplicador": 1.0, "nombre": "Moderado", "bonus_px": 0},
        "dificil": {"multiplicador": 1.25, "nombre": "Difícil", "bonus_px": 5},
        "muy_dificil": {"multiplicador": 1.5, "nombre": "Muy Difícil", "bonus_px": 10},
        "desalentador": {"multiplicador": 2.0, "nombre": "Desalentador", "bonus_px": 25}
    }
}

# ============== HELPER FUNCTIONS ==============

def roll_d20() -> int:
    return random.randint(1, 20)

def roll_d3() -> int:
    return random.randint(1, 3)

def roll_with_advantage() -> int:
    return max(roll_d20(), roll_d20())

def roll_with_disadvantage() -> int:
    return min(roll_d20(), roll_d20())

async def get_travel_events() -> List[dict]:
    """Get travel events from DB or return defaults"""
    events = await db.travel_events.find({}, {"_id": 0}).to_list(100)
    if not events:
        # Initialize with defaults
        for event in DEFAULT_TRAVEL_EVENTS:
            await db.travel_events.insert_one(event)
        return DEFAULT_TRAVEL_EVENTS
    return events

async def get_event_objectives() -> List[dict]:
    """Get event objectives from DB or return defaults"""
    objectives = await db.travel_objectives.find({}, {"_id": 0}).to_list(10)
    if not objectives:
        for obj in DEFAULT_EVENT_OBJECTIVES:
            await db.travel_objectives.insert_one(obj)
        return DEFAULT_EVENT_OBJECTIVES
    return objectives

async def get_terrain_difficulties() -> List[dict]:
    """Get terrain difficulties from DB or return defaults"""
    terrains = await db.travel_terrains.find({}, {"_id": 0}).to_list(10)
    if not terrains:
        for terrain in DEFAULT_TERRAIN_DIFFICULTIES:
            await db.travel_terrains.insert_one(terrain)
        return DEFAULT_TERRAIN_DIFFICULTIES
    return terrains

async def get_land_types() -> List[dict]:
    """Get land types from DB or return defaults"""
    lands = await db.travel_land_types.find({}, {"_id": 0}).to_list(10)
    if not lands:
        for land in DEFAULT_LAND_TYPES:
            await db.travel_land_types.insert_one(land)
        return DEFAULT_LAND_TYPES
    return lands

async def get_road_types() -> List[dict]:
    """Get road types from DB or return defaults"""
    roads = await db.travel_road_types.find({}, {"_id": 0}).to_list(10)
    if not roads:
        for road in DEFAULT_ROAD_TYPES:
            await db.travel_road_types.insert_one(road)
        return DEFAULT_ROAD_TYPES
    return roads

async def get_px_table() -> dict:
    """Get PX table from DB or return defaults"""
    px_table = await db.travel_px_table.find_one({"id": "px_table_main"}, {"_id": 0})
    if not px_table:
        await db.travel_px_table.insert_one(DEFAULT_PX_TABLE)
        return DEFAULT_PX_TABLE
    return px_table

async def get_travel_rules() -> dict:
    """Get travel rules config from DB or return defaults"""
    rules = await db.travel_rules.find_one({"id": "travel_rules_main"}, {"_id": 0})
    if not rules:
        rules = TravelRulesConfig().model_dump()
        rules['updated_at'] = rules['updated_at'].isoformat()
        await db.travel_rules.insert_one(rules)
    return rules

# Priority order for terrain difficulty (higher = more priority)
TERRAIN_PRIORITY = {
    'agua': 7,
    'infranqueable': 6,
    'desalentador': 5,
    'muy_dificil': 4,
    'dificil': 3,
    'moderado': 2,
    'facil': 1,
}

# Priority order for land types (higher = more priority)
LAND_TYPE_PRIORITY = {
    'tierras_oscuras': 5,
    'tierras_sombra': 4,
    'tierras_salvajes': 3,
    'tierras_fronterizas': 2,
    'tierras_libres': 1,
}

def point_in_polygon(x: float, y: float, polygon_points: list) -> bool:
    """
    Check if a point (x, y) is inside a polygon using ray casting algorithm.
    polygon_points is a list of {"x": float, "y": float} dicts.
    """
    n = len(polygon_points)
    if n < 3:
        return False
    
    inside = False
    j = n - 1
    
    for i in range(n):
        xi = polygon_points[i].get("x", 0)
        yi = polygon_points[i].get("y", 0)
        xj = polygon_points[j].get("x", 0)
        yj = polygon_points[j].get("y", 0)
        
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    
    return inside

async def get_terrain_polygons() -> list:
    """Get terrain polygons from database"""
    doc = await db.terrain_polygons.find_one({"_id": "terrain_polygons_data"})
    if not doc:
        return []
    return doc.get("polygons", [])

async def get_terrain_at_coordinate(x: float, y: float) -> Optional[dict]:
    """
    Get terrain difficulty at a specific coordinate from terrain polygons.
    x, y are in percentage coordinates (0-100).
    If multiple polygons overlap, returns the one with highest priority (most difficult).
    """
    polygons = await get_terrain_polygons()
    if not polygons:
        return None
    
    # Filter terrain polygons (not land type)
    terrain_types = set(TERRAIN_PRIORITY.keys())
    
    # Find all polygons that contain this point
    matching = []
    for poly in polygons:
        poly_type = poly.get("type", "")
        if poly_type not in terrain_types:
            continue
        
        points = poly.get("points", [])
        if point_in_polygon(x, y, points):
            matching.append({
                "type": poly_type,
                "priority": TERRAIN_PRIORITY.get(poly_type, 0),
                "polygon_id": poly.get("id")
            })
    
    if not matching:
        return None
    
    # Return the one with highest priority
    matching.sort(key=lambda m: m["priority"], reverse=True)
    return {
        "type": matching[0]["type"],
        "x": x,
        "y": y,
        "polygon_id": matching[0]["polygon_id"]
    }

async def get_land_type_at_coordinate(x: float, y: float) -> Optional[dict]:
    """
    Get land type at a specific coordinate from terrain polygons.
    x, y are in percentage coordinates (0-100).
    If multiple polygons overlap, returns the one with highest priority.
    Priority: Tierras Oscuras > Sombra > Salvajes > Fronterizas > Libres
    """
    polygons = await get_terrain_polygons()
    if not polygons:
        return None
    
    # Filter land type polygons
    land_types = set(LAND_TYPE_PRIORITY.keys())
    
    # Find all polygons that contain this point
    matching = []
    for poly in polygons:
        poly_type = poly.get("type", "")
        if poly_type not in land_types:
            continue
        
        points = poly.get("points", [])
        if point_in_polygon(x, y, points):
            matching.append({
                "type": poly_type,
                "priority": LAND_TYPE_PRIORITY.get(poly_type, 0),
                "polygon_id": poly.get("id")
            })
    
    if not matching:
        return None
    
    # Return the one with highest priority
    matching.sort(key=lambda m: m["priority"], reverse=True)
    return {
        "type": matching[0]["type"],
        "x": x,
        "y": y,
        "polygon_id": matching[0]["polygon_id"]
    }

async def get_terrain_and_land_at_coordinate(x: float, y: float) -> dict:
    """
    Get both terrain difficulty and land type at a coordinate.
    Returns combined info for pathfinding calculations.
    """
    terrain = await get_terrain_at_coordinate(x, y)
    land_type = await get_land_type_at_coordinate(x, y)
    
    return {
        "x": x,
        "y": y,
        "terrain": terrain.get("type") if terrain else "moderado",  # default
        "land_type": land_type.get("type") if land_type else "tierras_salvajes",  # default
        "terrain_priority": TERRAIN_PRIORITY.get(terrain.get("type") if terrain else "moderado", 2),
        "land_priority": LAND_TYPE_PRIORITY.get(land_type.get("type") if land_type else "tierras_salvajes", 3),
    }

# ============== CRUD ENDPOINTS FOR EDITABLE DATA ==============

@router.get("/config/events")
async def get_events_config():
    """Get all travel events (editable table)"""
    events = await get_travel_events()
    return {"events": events}

@router.put("/config/events/{event_id}")
async def update_event(event_id: str, event: TravelEvent):
    """Update a travel event"""
    event_dict = event.model_dump()
    result = await db.travel_events.update_one(
        {"id": event_id},
        {"$set": event_dict},
        upsert=True
    )
    return {"success": True, "modified": result.modified_count}

@router.post("/config/events")
async def create_event(event: TravelEvent):
    """Create a new travel event"""
    event_dict = event.model_dump()
    await db.travel_events.insert_one(event_dict)
    return {"success": True, "event": event_dict}

@router.delete("/config/events/{event_id}")
async def delete_event(event_id: str):
    """Delete a travel event"""
    result = await db.travel_events.delete_one({"id": event_id})
    return {"success": True, "deleted": result.deleted_count}

@router.get("/config/objectives")
async def get_objectives_config():
    """Get event objectives (who resolves events)"""
    objectives = await get_event_objectives()
    return {"objectives": objectives}

@router.put("/config/objectives/{obj_id}")
async def update_objective(obj_id: str, objective: EventObjective):
    """Update an event objective"""
    obj_dict = objective.model_dump()
    result = await db.travel_objectives.update_one(
        {"id": obj_id},
        {"$set": obj_dict},
        upsert=True
    )
    return {"success": True, "modified": result.modified_count}

@router.get("/config/terrains")
async def get_terrains_config():
    """Get terrain difficulties"""
    terrains = await get_terrain_difficulties()
    return {"terrains": terrains}

@router.put("/config/terrains/{terrain_id}")
async def update_terrain(terrain_id: str, terrain: TerrainDifficulty):
    """Update terrain difficulty"""
    terrain_dict = terrain.model_dump()
    result = await db.travel_terrains.update_one(
        {"id": terrain_id},
        {"$set": terrain_dict},
        upsert=True
    )
    return {"success": True, "modified": result.modified_count}

@router.get("/config/land-types")
async def get_land_types_config():
    """Get land types with PX values"""
    lands = await get_land_types()
    return {"land_types": lands}

@router.get("/terrain-at/{x}/{y}")
async def get_terrain_at_point(x: float, y: float):
    """Get terrain difficulty and land type at a specific coordinate (uses polygon data)"""
    result = await get_terrain_and_land_at_coordinate(x, y)
    return {
        "coordinate": {"x": x, "y": y},
        "terrain": result["terrain"],
        "land_type": result["land_type"],
        "terrain_priority": result["terrain_priority"],
        "land_priority": result["land_priority"]
    }

@router.put("/config/land-types/{land_id}")
async def update_land_type(land_id: str, land: LandTypeConfig):
    """Update land type configuration"""
    land_dict = land.model_dump()
    result = await db.travel_land_types.update_one(
        {"id": land_id},
        {"$set": land_dict},
        upsert=True
    )
    return {"success": True, "modified": result.modified_count}

@router.get("/config/rules")
async def get_rules_config():
    """Get main travel rules configuration"""
    rules = await get_travel_rules()
    return {"rules": rules}

@router.put("/config/rules")
async def update_rules_config(rules: TravelRulesConfig):
    """Update main travel rules"""
    rules_dict = rules.model_dump()
    rules_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = await db.travel_rules.update_one(
        {"id": "travel_rules_main"},
        {"$set": rules_dict},
        upsert=True
    )
    return {"success": True, "rules": rules_dict}

@router.get("/config/road-types")
async def get_road_types_config():
    """Get road types"""
    roads = await get_road_types()
    return {"road_types": roads}

@router.put("/config/road-types/{road_id}")
async def update_road_type(road_id: str, road: dict):
    """Update road type"""
    result = await db.travel_road_types.update_one(
        {"id": road_id},
        {"$set": road},
        upsert=True
    )
    return {"success": True, "modified": result.modified_count}

@router.get("/config/px-table")
async def get_px_table_config():
    """Get PX table (editable matrix)"""
    px_table = await get_px_table()
    return {"px_table": px_table}

@router.put("/config/px-table")
async def update_px_table_config(px_table: dict):
    """Update PX table"""
    px_table['id'] = "px_table_main"
    result = await db.travel_px_table.update_one(
        {"id": "px_table_main"},
        {"$set": px_table},
        upsert=True
    )
    return {"success": True}

# ============== PATHFINDING DEBUG ENDPOINT ==============

class PathDebugConfig(BaseModel):
    origen_nombre: str
    destino_nombre: str
    paso_km: float = 5.0  # Step size in km
    preferir_caminos: bool = True
    evitar_tierras_oscuras: bool = False
    evitar_tierras_sombra: bool = False
    max_pasos: int = 200  # Safety limit

@router.post("/debug-pathfinding")
async def debug_pathfinding(config: PathDebugConfig):
    """
    Debug pathfinding step by step.
    Returns detailed explanation of each decision made.
    """
    import math
    
    # Find origin and destination locations
    all_locations = await db.locations.find({}, {"_id": 0}).to_list(length=1000)
    
    origen = None
    destino = None
    
    for loc in all_locations:
        nombre = loc.get('nombre', '').lower()
        if config.origen_nombre.lower() in nombre or nombre in config.origen_nombre.lower():
            if not origen:
                origen = loc
        if config.destino_nombre.lower() in nombre or nombre in config.destino_nombre.lower():
            if not destino:
                destino = loc
    
    if not origen:
        return {"error": f"No se encontró ubicación de origen: {config.origen_nombre}", "sugerencias": [l['nombre'] for l in all_locations[:10]]}
    if not destino:
        return {"error": f"No se encontró ubicación de destino: {config.destino_nombre}", "sugerencias": [l['nombre'] for l in all_locations[:10]]}
    
    # Load roads
    roads = await db.roads.find({}, {"_id": 0}).to_list(length=500)
    
    # Load terrain polygons
    terrain_polygons = await get_terrain_polygons()
    
    # Start position
    current_x = origen.get('x', 0)
    current_y = origen.get('y', 0)
    dest_x = destino.get('x', 0)
    dest_y = destino.get('y', 0)
    
    # Constants
    KM_PER_PERCENT = 20  # Approximate km per 1% of map
    STEP_PERCENT = config.paso_km / KM_PER_PERCENT
    
    # Results
    pasos = []
    total_distance = 0
    
    def distance(x1, y1, x2, y2):
        return math.sqrt((x2-x1)**2 + (y2-y1)**2)
    
    def point_in_polygon(px, py, polygon_points):
        n = len(polygon_points)
        if n < 3:
            return False
        inside = False
        j = n - 1
        for i in range(n):
            xi = polygon_points[i].get("x", 0)
            yi = polygon_points[i].get("y", 0)
            xj = polygon_points[j].get("x", 0)
            yj = polygon_points[j].get("y", 0)
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside
    
    def get_terrain_at(x, y):
        for poly in terrain_polygons:
            if poly.get("type") in TERRAIN_PRIORITY:
                if point_in_polygon(x, y, poly.get("points", [])):
                    return poly.get("type")
        return "moderado"
    
    def get_land_type_at(x, y):
        for poly in terrain_polygons:
            if poly.get("type") in LAND_TYPE_PRIORITY:
                if point_in_polygon(x, y, poly.get("points", [])):
                    return poly.get("type")
        return "tierras_salvajes"
    
    def find_nearest_road_point(x, y, max_dist=10):
        """Find nearest point on any road"""
        nearest = None
        min_dist = max_dist
        road_name = None
        road_type = None
        
        for road in roads:
            # Support both 'path' and 'puntos' field names
            path = road.get('puntos', road.get('path', []))
            for i, point in enumerate(path):
                px = point[0] if isinstance(point, list) else point.get('x', 0)
                py = point[1] if isinstance(point, list) else point.get('y', 0)
                d = distance(x, y, px, py)
                if d < min_dist:
                    min_dist = d
                    nearest = (px, py)
                    road_name = road.get('nombre', 'Desconocido')
                    road_type = road.get('tipo', 'sendero')
        
        return nearest, min_dist, road_name, road_type
    
    def is_on_road(x, y, tolerance=0.5):
        """Check if point is on or very close to a road"""
        _, dist, name, road_type = find_nearest_road_point(x, y, max_dist=tolerance)
        return dist < tolerance, name, road_type
    
    def get_next_road_point_towards_dest(current_road_name, x, y, dest_x, dest_y):
        """Get next point on current road that's closer to destination"""
        for road in roads:
            if road.get('nombre') == current_road_name:
                # Support both 'path' and 'puntos' field names
                path = road.get('puntos', road.get('path', []))
                current_dist_to_dest = distance(x, y, dest_x, dest_y)
                
                # Find point on road that's closer to destination
                best_point = None
                best_improvement = 0
                
                for point in path:
                    px = point[0] if isinstance(point, list) else point.get('x', 0)
                    py = point[1] if isinstance(point, list) else point.get('y', 0)
                    
                    # Must be reachable (within step distance)
                    dist_from_current = distance(x, y, px, py)
                    if dist_from_current < 0.1 or dist_from_current > STEP_PERCENT * 2:
                        continue
                    
                    # Check if closer to destination
                    dist_to_dest = distance(px, py, dest_x, dest_y)
                    improvement = current_dist_to_dest - dist_to_dest
                    
                    if improvement > best_improvement:
                        best_improvement = improvement
                        best_point = (px, py)
                
                return best_point
        return None
    
    # Initial step
    pasos.append({
        "paso": 0,
        "posicion": {"x": round(current_x, 2), "y": round(current_y, 2)},
        "ubicacion": origen.get('nombre'),
        "terreno": get_terrain_at(current_x, current_y),
        "tipo_tierra": get_land_type_at(current_x, current_y),
        "distancia_destino_km": round(distance(current_x, current_y, dest_x, dest_y) * KM_PER_PERCENT, 1),
        "decision": "INICIO",
        "razon": f"Partimos de {origen.get('nombre')}"
    })
    
    # Track last road we were on to avoid oscillation
    last_road_exited = None
    steps_since_road_exit = 0
    
    # ANTI-LOOP: Track visited positions to detect and break loops
    visited_positions = set()
    visited_positions.add((round(current_x, 1), round(current_y, 1)))
    loop_detected = False
    
    for step in range(1, config.max_pasos + 1):
        dist_to_dest = distance(current_x, current_y, dest_x, dest_y)
        
        # Check if arrived
        if dist_to_dest * KM_PER_PERCENT < config.paso_km:
            pasos.append({
                "paso": step,
                "posicion": {"x": round(dest_x, 2), "y": round(dest_y, 2)},
                "ubicacion": destino.get('nombre'),
                "terreno": get_terrain_at(dest_x, dest_y),
                "tipo_tierra": get_land_type_at(dest_x, dest_y),
                "distancia_destino_km": 0,
                "decision": "LLEGADA",
                "razon": f"Hemos llegado a {destino.get('nombre')}"
            })
            break
        
        # Get current terrain info
        current_terrain = get_terrain_at(current_x, current_y)
        current_land = get_land_type_at(current_x, current_y)
        on_road, current_road, current_road_type = is_on_road(current_x, current_y)
        
        # Track road exit for anti-oscillation
        if on_road:
            last_road_exited = None
            steps_since_road_exit = 0
        elif last_road_exited:
            steps_since_road_exit += 1
        
        # Decision logic
        decision = None
        next_x, next_y = None, None
        razon = ""
        alternativas = []  # Track alternatives considered
        
        # ANTI-LOOP: Check if we're about to enter a loop
        # Only check after step 10 to allow initial movement
        pos_key = (round(current_x, 1), round(current_y, 1))
        if step > 10 and pos_key in visited_positions:
            loop_detected = True
            alternativas.append(f"¡BUCLE DETECTADO! Posición ({current_x:.1f}, {current_y:.1f}) ya visitada")
        
        # If loop detected, ignore road preferences and go directly to destination
        if loop_detected:
            direction_x = (dest_x - current_x)
            direction_y = (dest_y - current_y)
            length = math.sqrt(direction_x**2 + direction_y**2)
            if length > 0:
                next_x = current_x + (direction_x / length) * STEP_PERCENT
                next_y = current_y + (direction_y / length) * STEP_PERCENT
            decision = "DIRECTO_FORZADO"
            razon = f"Bucle detectado: ignoramos preferencias y vamos directo al destino"
        
        # Normal logic (only if not in loop mode)
        if decision is None:
            # Option 1: If on a road, try to continue on it
            if on_road and config.preferir_caminos:
                next_point = get_next_road_point_towards_dest(current_road, current_x, current_y, dest_x, dest_y)
                if next_point:
                    next_x, next_y = next_point
                    decision = "SEGUIR_CAMINO"
                    razon = f"Continuamos por {current_road} que nos acerca al destino"
                else:
                    # Road doesn't help, mark that we're leaving it
                    last_road_exited = current_road
                    steps_since_road_exit = 0
                    alternativas.append(f"El camino {current_road} no nos acerca más al destino")
            
            # Option 2: If not on road, look for nearest road (but avoid recently exited road)
            if decision is None and config.preferir_caminos:
                nearest_road, road_dist, road_name, road_type = find_nearest_road_point(current_x, current_y)
                
                # Avoid going back to a road we just exited (for 3 steps)
                should_avoid_road = (road_name == last_road_exited and steps_since_road_exit < 3)
                
                # Check if going to road is worth it
                if nearest_road and road_dist < 5 and not should_avoid_road:  # Within 5% (~100km)
                    # Check if road goes towards destination
                    road_x, road_y = nearest_road
                    current_dist_to_dest = distance(current_x, current_y, dest_x, dest_y)
                    road_dist_to_dest = distance(road_x, road_y, dest_x, dest_y)
                    
                    # Road is worth it if it doesn't add too much distance
                    detour = road_dist - (current_dist_to_dest - road_dist_to_dest)
                    
                    if detour < current_dist_to_dest * 0.3:  # Less than 30% detour
                        # Move towards road
                        direction_x = (road_x - current_x)
                        direction_y = (road_y - current_y)
                        length = math.sqrt(direction_x**2 + direction_y**2)
                        if length > 0:
                            next_x = current_x + (direction_x / length) * STEP_PERCENT
                            next_y = current_y + (direction_y / length) * STEP_PERCENT
                            decision = "IR_A_CAMINO"
                            razon = f"Nos desviamos hacia {road_name} (a {round(road_dist * KM_PER_PERCENT, 1)}km) porque nos beneficia"
                    else:
                        alternativas.append(f"Camino {road_name} descartado: desvío de {round(detour * KM_PER_PERCENT, 1)}km ({round(detour/current_dist_to_dest*100)}%)")
                elif should_avoid_road:
                    alternativas.append(f"Evitamos {road_name} (salimos hace {steps_since_road_exit} pasos)")
        
            # Option 3: Check for dangerous lands to avoid
            if decision is None:
                # Direct path towards destination
                direction_x = (dest_x - current_x)
                direction_y = (dest_y - current_y)
                length = math.sqrt(direction_x**2 + direction_y**2)
                
                if length > 0:
                    test_x = current_x + (direction_x / length) * STEP_PERCENT
                    test_y = current_y + (direction_y / length) * STEP_PERCENT
                    test_land = get_land_type_at(test_x, test_y)
                    test_terrain = get_terrain_at(test_x, test_y)
                    
                    # Check if we should avoid this terrain
                    avoid = False
                    avoid_reason = ""
                    
                    if config.evitar_tierras_oscuras and test_land == "tierras_oscuras":
                        avoid = True
                        avoid_reason = "Tierras Oscuras (muy peligrosas)"
                    elif config.evitar_tierras_sombra and test_land == "tierras_sombra":
                        avoid = True
                        avoid_reason = "Tierras de la Sombra (peligrosas)"
                    elif test_terrain in ["infranqueable", "agua"]:
                        avoid = True
                        avoid_reason = f"Terreno {test_terrain} (no se puede atravesar)"
                    
                    if avoid:
                        # Try to go around
                        # TODO: Implement avoidance logic
                        decision = "EVITAR"
                        razon = f"El camino directo pasa por {avoid_reason}, buscamos alternativa"
                        # For now, just go direct but note the issue
                        next_x, next_y = test_x, test_y
                    else:
                        next_x, next_y = test_x, test_y
                        decision = "CAMPO_TRAVES"
                        razon = f"Avanzamos campo a través hacia el destino (terreno: {test_terrain})"
        
        # Default: go direct
        if next_x is None:
            direction_x = (dest_x - current_x)
            direction_y = (dest_y - current_y)
            length = math.sqrt(direction_x**2 + direction_y**2)
            if length > 0:
                next_x = current_x + (direction_x / length) * STEP_PERCENT
                next_y = current_y + (direction_y / length) * STEP_PERCENT
            decision = decision or "DIRECTO"
            razon = razon or "Avanzamos en línea recta hacia el destino"
        
        # Calculate step distance
        step_dist = distance(current_x, current_y, next_x, next_y) * KM_PER_PERCENT
        total_distance += step_dist
        
        # Move
        current_x, current_y = next_x, next_y
        
        # ANTI-LOOP: Add new position to visited set
        new_pos_key = (round(current_x, 1), round(current_y, 1))
        visited_positions.add(new_pos_key)
        
        # Record step
        new_on_road, new_road_name, new_road_type = is_on_road(current_x, current_y)
        paso_data = {
            "paso": step,
            "posicion": {"x": round(current_x, 2), "y": round(current_y, 2)},
            "terreno": get_terrain_at(current_x, current_y),
            "tipo_tierra": get_land_type_at(current_x, current_y),
            "en_camino": new_road_name if new_on_road else None,
            "tipo_camino": new_road_type if new_on_road else None,
            "distancia_paso_km": round(step_dist, 1),
            "distancia_destino_km": round(distance(current_x, current_y, dest_x, dest_y) * KM_PER_PERCENT, 1),
            "distancia_total_km": round(total_distance, 1),
            "decision": decision,
            "razon": razon
        }
        if alternativas:
            paso_data["alternativas_descartadas"] = alternativas
        pasos.append(paso_data)
    
    return {
        "origen": origen.get('nombre'),
        "destino": destino.get('nombre'),
        "configuracion": {
            "paso_km": config.paso_km,
            "preferir_caminos": config.preferir_caminos,
            "evitar_tierras_oscuras": config.evitar_tierras_oscuras,
            "evitar_tierras_sombra": config.evitar_tierras_sombra
        },
        "resumen": {
            "total_pasos": len(pasos),
            "distancia_total_km": round(total_distance, 1),
            "distancia_linea_recta_km": round(distance(origen.get('x',0), origen.get('y',0), dest_x, dest_y) * KM_PER_PERCENT, 1)
        },
        "pasos": pasos
    }

# ============== JOURNEY CALCULATION ENDPOINTS ==============

@router.post("/calculate-journey")
async def calculate_journey(config: JourneyConfig):
    """
    Calculate a complete journey with route, events, and estimates.
    Uses pathfinding if available, otherwise direct calculation.
    Returns debug info for journey analysis.
    """
    # Debug info collection
    debug_info = {
        "timestamp": str(datetime.now()),
        "config": {
            "origen_id": config.origen_id,
            "destino_id": config.destino_id,
            "preferir_caminos": config.preferir_caminos,
            "evitar_sombra": config.evitar_sombra,
            "marcha_forzada": config.horas_marcha_forzada > 0,
            "estacion": config.estacion
        },
        "pathfinding": {
            "used": False,
            "success": False,
            "roads_found": 0,
            "barriers_found": 0,
            "locations_found": 0,
            "preference_multiplier": 0.3 if config.preferir_caminos else 1.0,
            "algorithm_steps": []
        },
        "route_decision": "",
        "errors": []
    }
    
    # Get configurations from DB
    events_table = await get_travel_events()
    land_types = await get_land_types()
    terrains = await get_terrain_difficulties()
    rules = await get_travel_rules()
    
    # Try to get route from pathfinding
    route_data = None
    path_points = []  # Full path for map display
    path_segments = []  # Detailed segments
    
    try:
        # Use our own db connection to get locations
        start_loc = await db.locations.find_one({"_id": config.origen_id})
        end_loc = await db.locations.find_one({"_id": config.destino_id})
        
        # Remove MongoDB _id for serialization
        if start_loc:
            start_loc['id'] = str(start_loc.pop('_id'))
            debug_info["config"]["origen_nombre"] = start_loc.get('nombre', 'Unknown')
            debug_info["config"]["origen_coords"] = {"x": start_loc.get('x'), "y": start_loc.get('y')}
        if end_loc:
            end_loc['id'] = str(end_loc.pop('_id'))
            debug_info["config"]["destino_nombre"] = end_loc.get('nombre', 'Unknown')
            debug_info["config"]["destino_coords"] = {"x": end_loc.get('x'), "y": end_loc.get('y')}
        
        if start_loc and end_loc:
            # Try to use pathfinding if map data exists
            roads = list(await db.roads.find({}, {"_id": 0}).to_list(length=1000))
            rivers = list(await db.rivers.find({}, {"_id": 0}).to_list(length=1000))
            barriers = list(await db.barriers.find({}, {"_id": 0}).to_list(length=1000))
            all_locations = list(await db.locations.find({}).to_list(length=1000))
            
            debug_info["pathfinding"]["roads_found"] = len(roads)
            debug_info["pathfinding"]["barriers_found"] = len(barriers)
            debug_info["pathfinding"]["locations_found"] = len(all_locations)
            
            # Log road names for debugging
            debug_info["pathfinding"]["available_roads"] = [r.get('nombre', 'Unknown') for r in roads]
            
            # Clean up locations for pathfinder
            for loc in all_locations:
                if '_id' in loc:
                    loc['id'] = str(loc.pop('_id'))
            
            if roads or barriers:
                debug_info["pathfinding"]["used"] = True
                # Use pathfinding
                from utils.pathfinding import MiddleEarthPathfinder
                
                # Load terrain polygons
                terrain_polygons = await get_terrain_polygons()
                debug_info["pathfinding"]["terrain_polygons_count"] = len(terrain_polygons)
                
                pathfinder = MiddleEarthPathfinder(
                    roads=roads,
                    rivers=rivers,
                    barriers=barriers,
                    locations=all_locations,
                    terrain_polygons=terrain_polygons,
                    prefer_roads=config.preferir_caminos,
                    avoid_shadow_lands=config.evitar_sombra,
                    avoid_dark_lands=config.evitar_tierras_oscuras
                )
                
                start_coords = (start_loc.get('x', 0), start_loc.get('y', 0))
                end_coords = (end_loc.get('x', 0), end_loc.get('y', 0))
                
                debug_info["pathfinding"]["start_coords"] = start_coords
                debug_info["pathfinding"]["end_coords"] = end_coords
                
                path_result = pathfinder.find_path(start_coords, end_coords)
                
                debug_info["pathfinding"]["success"] = path_result.success
                debug_info["pathfinding"]["total_distance_km"] = getattr(path_result, 'total_distance_km', 0)
                debug_info["pathfinding"]["total_travel_cost"] = getattr(path_result, 'total_travel_cost', 0)
                debug_info["pathfinding"]["estimated_days"] = getattr(path_result, 'estimated_days', 0)
                debug_info["pathfinding"]["segments_count"] = len(path_result.segments) if path_result.success else 0
                
                if path_result.success:
                    # Use pathfinding results
                    path_points = path_result.path
                    
                    # Get land type for each segment based on nearest location
                    def get_land_type_at_point(x, y):
                        """Get land type at a point based on nearest location"""
                        min_dist = float('inf')
                        land_type = 'tierras_salvajes'
                        for loc in all_locations:
                            dist = ((x - loc.get('x', 0))**2 + (y - loc.get('y', 0))**2) ** 0.5
                            if dist < min_dist:
                                min_dist = dist
                                land_type = loc.get('clase_region') or loc.get('tipo_tierra') or 'tierras_salvajes'
                        return land_type
                    
                    path_segments = []
                    for seg in path_result.segments:
                        # Get land type at segment midpoint
                        mid_x = (seg.start[0] + seg.end[0]) / 2
                        mid_y = (seg.start[1] + seg.end[1]) / 2
                        seg_land_type = get_land_type_at_point(mid_x, mid_y)
                        
                        path_segments.append({
                            "start": {"x": seg.start[0], "y": seg.start[1]},
                            "end": {"x": seg.end[0], "y": seg.end[1]},
                            "distance_km": seg.distance_km,
                            "terrain": seg.terrain,
                            "road_type": seg.road_type,
                            "river_crossing": seg.river_crossing,
                            "land_type": seg_land_type
                        })
                    
                    # Build land type summary
                    land_type_distances = {}
                    for seg in path_segments:
                        lt = seg.get('land_type', 'tierras_salvajes')
                        if lt not in land_type_distances:
                            land_type_distances[lt] = 0
                        land_type_distances[lt] += seg['distance_km']
                    
                    # Get dominant terrain/road from segments
                    terrain_summary = path_result.terrain_summary
                    dominant_terrain = max(terrain_summary.items(), key=lambda x: x[1])[0] if terrain_summary else 'moderado'
                    
                    # Dominant land type
                    dominant_land_type = max(land_type_distances.items(), key=lambda x: x[1])[0] if land_type_distances else 'tierras_salvajes'
                    
                    # Check road usage
                    has_road = len(path_result.roads_used) > 0
                    
                    route_data = {
                        "origen": start_loc,
                        "destino": end_loc,
                        "distance_km": round(path_result.total_distance_km, 1),
                        "casillas": max(1, round(path_result.total_distance_km / 16)),  # 1 casilla = 16km
                        "terreno": dominant_terrain,
                        "tipo_tierra": dominant_land_type,
                        "path": path_points,
                        "segments": path_segments,
                        "terrain_summary": terrain_summary,
                        "land_type_summary": {k: round(v, 1) for k, v in land_type_distances.items()},
                        "roads_used": list(path_result.roads_used),
                        "rivers_crossed": path_result.rivers_crossed,
                        "warnings": path_result.warnings,
                        # Use pathfinder's estimated days (based on terrain costs and 36 km/day base speed)
                        "estimated_days_pathfinder": path_result.estimated_days,
                        "total_travel_cost": path_result.total_travel_cost
                    }
            
            # Fallback to direct line if no pathfinding data or pathfinding failed
            if not route_data:
                # Calculate distance
                dx = end_loc.get('x', 0) - start_loc.get('x', 0)
                dy = end_loc.get('y', 0) - start_loc.get('y', 0)
                distance_units = (dx**2 + dy**2) ** 0.5
                
                # Convert to game units (1 unit = ~16km = 1 hex)
                KM_PER_UNIT = 16
                distance_km = distance_units * KM_PER_UNIT
                casillas = max(1, round(distance_units))
                
                # Get terrain info
                terreno = end_loc.get('terreno', 'moderado')
                tipo_tierra = end_loc.get('tipo_tierra', 'tierras_salvajes')
                
                # Simple direct path
                path_points = [
                    (start_loc.get('x', 0), start_loc.get('y', 0)),
                    (end_loc.get('x', 0), end_loc.get('y', 0))
                ]
                
                route_data = {
                    "origen": start_loc,
                    "destino": end_loc,
                    "distance_km": round(distance_km, 1),
                    "casillas": casillas,
                    "terreno": terreno,
                    "tipo_tierra": tipo_tierra,
                    "path": path_points,
                    "is_direct_line": True,
                    "warnings": ["Ruta directa calculada. El pathfinding detallado no está disponible."]
                }
    except Exception as e:
        print(f"Error getting route: {e}")
        import traceback
        traceback.print_exc()
    
    if not route_data:
        return {"error": True, "message": "No se pudo calcular la ruta. Verifica origen y destino."}
    
    # Get land type config
    land_config = next((l for l in land_types if l['tipo'] == route_data['tipo_tierra']), land_types[0])
    terrain_config = next((t for t in terrains if t['tipo'] == route_data['terreno']), terrains[1])
    
    # Check if route should be avoided
    if config.evitar_sombra and land_config['tipo'] in ['tierras_sombra', 'tierras_oscuras']:
        return {
            "error": True, 
            "message": f"La ruta atraviesa {land_config['nombre']}. Activa la opción para buscar ruta alternativa.",
            "ruta_alternativa_necesaria": True
        }
    
    # Calculate base days
    casillas = route_data['casillas']
    
    # ============ CALCULATE GROUP SPEED (METRIC SYSTEM) ============
    # The group travels at the speed of its slowest member
    # Speed is in METERS (e.g., Dúnedain=10m, Elfos/Hombres=9m, Enanos/Hobbits=7m)
    # Formula: km_por_dia = velocidad_metros * 4 (assuming 8h march at 0.5km/h per meter of speed)
    # Examples:
    #   - 9m (Elfos/Hombres) = 36 km/día
    #   - 10m (Dúnedain) = 40 km/día
    #   - 7m (Enanos/Hobbits) = 28 km/día
    #   - 18m (Caballo) = 72 km/día
    BASE_SPEED_METERS = 9  # Standard human speed
    BASE_KM_DAY = 36  # Corresponds to 9m speed
    KM_PER_METER_SPEED = 4  # 1m of speed = 4 km/day
    
    # Determine the slowest speed in the group
    tiene_monturas = sum(1 for m in config.miembros if m.tiene_montura)
    total_miembros = len(config.miembros) if config.miembros else 1
    porcentaje_monturas = tiene_monturas / total_miembros if total_miembros > 0 else 0
    
    if config.miembros:
        # Get effective speed for each member (considering mounts)
        velocidades = []
        for m in config.miembros:
            vel_efectiva = m.velocidad_efectiva()
            km_dia_miembro = vel_efectiva * KM_PER_METER_SPEED
            velocidades.append({
                "nombre": m.nombre,
                "velocidad_base": m.velocidad_base,
                "tiene_montura": m.tiene_montura,
                "montura_velocidad": m.montura_velocidad,
                "velocidad_efectiva": vel_efectiva,
                "km_por_dia": km_dia_miembro
            })
        
        # Group speed = slowest member
        velocidad_grupo = min(v["velocidad_efectiva"] for v in velocidades)
        miembro_mas_lento = next(v["nombre"] for v in velocidades if v["velocidad_efectiva"] == velocidad_grupo)
    else:
        # No members specified, assume standard human speed (9m = 36 km/day)
        velocidad_grupo = BASE_SPEED_METERS
        velocidades = []
        miembro_mas_lento = None
    
    # Calculate km/day for the group
    km_por_dia_grupo = velocidad_grupo * KM_PER_METER_SPEED
    
    # Check if mounts are allowed in this terrain
    if not terrain_config.get('permite_montura', True):
        # Force foot speed if mounts not allowed
        if config.miembros:
            velocidad_grupo = min(m.velocidad_base for m in config.miembros)
        else:
            velocidad_grupo = BASE_SPEED_METERS
        km_por_dia_grupo = velocidad_grupo * KM_PER_METER_SPEED
    
    # Use pathfinder's estimated days if available (already accounts for terrain costs)
    # The pathfinder uses BASE_SPEED_KM_DAY = 36 km/day and terrain multipliers
    # We need to adjust based on actual group speed
    
    # Speed ratio: how much faster/slower is the group compared to base 36 km/day
    ratio_velocidad = km_por_dia_grupo / BASE_KM_DAY  # e.g., 72/36 = 2.0 for mounted, 24/36 = 0.67 for slow
    
    if route_data.get('estimated_days_pathfinder'):
        # Pathfinder already calculated days based on terrain costs at 36 km/day
        # Adjust for actual group speed
        dias_base = route_data['estimated_days_pathfinder'] / ratio_velocidad
        
        # Apply rhythm modifier
        if config.ritmo == 'lento':
            dias_base = dias_base * 1.5
        elif config.ritmo == 'rapido':
            if not land_config.get('permite_ritmo_rapido', True):
                return {"error": True, "message": f"Ritmo rápido no permitido en {land_config['nombre']}"}
            dias_base = dias_base * 0.75
    else:
        # Fallback to distance-based calculation (for direct line paths)
        distance_km = route_data['distance_km']
        
        # Days = distance / km_per_day (adjusted for rhythm)
        if config.ritmo == 'lento':
            dias_base = distance_km / (km_por_dia_grupo * 0.67)  # Slow pace = 67% speed
        elif config.ritmo == 'rapido':
            if not land_config.get('permite_ritmo_rapido', True):
                return {"error": True, "message": f"Ritmo rápido no permitido en {land_config['nombre']}"}
            dias_base = distance_km / (km_por_dia_grupo * 1.33)  # Fast pace = 133% speed
        else:
            dias_base = distance_km / km_por_dia_grupo
    
    dias_estimados = max(1, round(dias_base))
    
    # Calculate PX for the journey using the complete PX table
    px_table = await get_px_table()
    terreno_tipo = route_data['terreno']
    tipo_tierra = route_data['tipo_tierra']
    
    # Map tipo_tierra to column name
    tierra_col_map = {
        'tierras_libres': 'tierras_libres',
        'tierras_fronterizas': 'tierras_fronterizas',
        'tierras_salvajes': 'tierras_salvajes',
        'tierras_sombra': 'tierras_sombra',
        'tierras_de_la_sombra': 'tierras_sombra',
        'tierras_oscuras': 'tierras_oscuras'
    }
    
    # ============== CALCULATE PX PER SEGMENT ==============
    # Now we calculate PX for each segment individually based on its terrain and land type
    segments = route_data.get('segments', [])
    
    px_total = 0
    px_breakdown = []
    
    if segments and px_table and px_table.get('filas'):
        terreno_mods = px_table.get('modificadores_terreno', {})
        
        for seg in segments:
            seg_distance_km = seg.get('distance_km', 0)
            seg_terrain = seg.get('terrain', 'moderado')
            seg_land_type = seg.get('land_type', 'tierras_salvajes')
            seg_road_type = seg.get('road_type', 'campo_abierto')
            
            # Determine via type based on road
            if seg_road_type in ['camino_real', 'carretera']:
                tipo_via = 'camino_real'
            elif seg_road_type in ['senda']:
                tipo_via = 'senda'
            elif seg_road_type in ['sendero']:
                tipo_via = 'sendero'
            elif seg_road_type in ['terreno_dificil', 'montaña', 'pantano']:
                tipo_via = 'terreno_dificil'
            else:
                tipo_via = 'campo_abierto'
            
            # Get land type column
            tierra_col = tierra_col_map.get(seg_land_type, 'tierras_salvajes')
            
            # Find PX per km for this via + land type combination
            px_per_km = 0
            for fila in px_table['filas']:
                if fila.get('tipo_via') == tipo_via:
                    px_per_km = fila.get(tierra_col, 0)
                    break
            
            # Apply terrain modifier
            terreno_mod = terreno_mods.get(seg_terrain, {'multiplicador': 1.0, 'bonus_px_km': 0})
            
            # Calculate PX for this segment
            # NOTA: Los valores de px_per_km son realmente "por casilla" (~16km)
            # Convertimos km a casillas dividiendo por 16
            seg_casillas = seg_distance_km / 16.0
            seg_px_base = px_per_km * seg_casillas
            seg_px_bonus = terreno_mod.get('bonus_px_km', 0) * seg_casillas
            seg_px_total = seg_px_base * terreno_mod.get('multiplicador', 1.0) + seg_px_bonus
            
            if seg_px_total > 0:
                px_breakdown.append({
                    "distancia_km": round(seg_distance_km, 1),
                    "terreno": seg_terrain,
                    "tipo_tierra": seg_land_type,
                    "tipo_via": tipo_via,
                    "px_base_km": px_per_km,
                    "px_segment": round(seg_px_total, 1)
                })
            
            px_total += seg_px_total
    else:
        # Fallback: old method using dominant terrain/land type
        tipo_tierra = route_data['tipo_tierra']
        tierra_col = tierra_col_map.get(tipo_tierra, 'tierras_salvajes')
        
        tipo_via = 'camino_real' if config.preferir_caminos else 'campo_abierto'
        
        px_per_casilla = 0
        if px_table and px_table.get('filas'):
            for fila in px_table['filas']:
                if fila.get('tipo_via') == tipo_via:
                    px_per_casilla = fila.get(tierra_col, 0)
                    break
        
        terreno_mods = px_table.get('modificadores_terreno', {}) if px_table else {}
        terreno_mod = terreno_mods.get(terreno_tipo, {'multiplicador': 1.0, 'bonus_px_km': 0})
        
        # Convertir km a casillas (~16 km por casilla)
        num_casillas = route_data['distance_km'] / 16.0
        px_base = px_per_casilla * num_casillas
        px_bonus = terreno_mod.get('bonus_px_km', 0) * num_casillas
        px_total = px_base * terreno_mod.get('multiplicador', 1.0) + px_bonus
    
    # Round PX total
    px_total = round(px_total)
    
    # Calculate number of expected events
    num_eventos_esperados = max(1, casillas // rules.get('orientation_success_distance', 3))
    
    # Determine advantage/disadvantage for events
    tiene_ventaja = land_config.get('ventaja_acontecimientos', False)
    tiene_desventaja = land_config.get('desventaja_acontecimientos', False)
    
    # Season modifier
    estacion = config.estacion
    es_invierno_otono = estacion in ['invierno', 'otono']
    
    # ============ DETECT SAFE HAVENS ALONG THE ROUTE ============
    # Find refuges that the path passes near (within ~30km / 1.5 coordinate units)
    refugios_en_ruta = []
    path_points = route_data.get('path', [])
    total_distance = route_data['distance_km']
    
    # Get all safe haven locations
    all_locations = await db.locations.find({"refugio": True}, {"_id": 0}).to_list(length=1000)
    
    if path_points and len(path_points) > 1:
        # Calculate cumulative distance at each path point
        cumulative_distances = [0]
        for i in range(1, len(path_points)):
            prev = path_points[i-1]
            curr = path_points[i]
            # Distance in coordinate units, convert to km
            dist = ((curr[0]-prev[0])**2 + (curr[1]-prev[1])**2)**0.5 * 20  # ~20km per unit
            cumulative_distances.append(cumulative_distances[-1] + dist)
        
        # Normalize to actual total distance
        if cumulative_distances[-1] > 0:
            scale = total_distance / cumulative_distances[-1]
            cumulative_distances = [d * scale for d in cumulative_distances]
        
        # Check each refuge
        for loc in all_locations:
            loc_x, loc_y = loc.get('x', 0), loc.get('y', 0)
            
            # Skip the destination (can't rest at final destination)
            if loc.get('nombre') == config.destino_nombre:
                continue
            
            # Find closest point on path and its distance
            min_dist_to_path = float('inf')
            km_at_refuge = 0
            
            for i, (px, py) in enumerate(path_points):
                dist = ((loc_x - px)**2 + (loc_y - py)**2)**0.5
                if dist < min_dist_to_path:
                    min_dist_to_path = dist
                    km_at_refuge = cumulative_distances[i] if i < len(cumulative_distances) else 0
            
            # If refuge is within 1.5 units (~30km) of path, include it
            if min_dist_to_path < 1.5:
                # Calculate which "casilla" (tile) this corresponds to
                casilla_refugio = int((km_at_refuge / total_distance) * casillas) if total_distance > 0 else 0
                
                # Only include if not at the very start or end
                if 1 <= casilla_refugio < casillas - 1:
                    refugios_en_ruta.append({
                        "nombre": loc.get('nombre'),
                        "casilla": casilla_refugio,
                        "km": round(km_at_refuge, 1),
                        "x": loc_x,
                        "y": loc_y
                    })
    
    # Sort refuges by their position in the journey
    refugios_en_ruta.sort(key=lambda r: r['casilla'])

    return {
        "success": True,
        "ruta": {
            "origen": config.origen_nombre,
            "destino": config.destino_nombre,
            "distance_km": route_data['distance_km'],
            "casillas": casillas,
            "terreno": route_data['terreno'],
            "terreno_nombre": terrain_config.get('nombre', terreno_tipo),
            "tipo_tierra": route_data['tipo_tierra'],
            "tipo_tierra_nombre": land_config['nombre'],
            "tipo_via": tipo_via,
            # Full path for map rendering
            "path": route_data.get('path', []),
            "segments": route_data.get('segments', []),
            "terrain_summary": route_data.get('terrain_summary', {}),
            "roads_used": route_data.get('roads_used', []),
            "rivers_crossed": route_data.get('rivers_crossed', []),
            "is_direct_line": route_data.get('is_direct_line', False),
            # Safe havens along the route (for rest opportunities)
            "refugios_en_ruta": refugios_en_ruta,
            # Coordinates for map rendering (start and end)
            "origen_coords": {
                "x": route_data['origen'].get('x', 0),
                "y": route_data['origen'].get('y', 0)
            },
            "destino_coords": {
                "x": route_data['destino'].get('x', 0),
                "y": route_data['destino'].get('y', 0)
            },
            "land_type_summary": route_data.get('land_type_summary', {})
        },
        "estimaciones": {
            "dias_base": round(dias_base, 1),
            "dias_estimados": dias_estimados,
            "eventos_esperados": num_eventos_esperados,
            "px_total": px_total,
            "px_por_personaje": px_total // total_miembros if total_miembros > 0 else px_total
        },
        "px_desglose": {
            "unidad": "km",
            "px_total": px_total,
            "distancia_total_km": route_data['distance_km'],
            "px_por_km_promedio": round(px_total / route_data['distance_km'], 2) if route_data['distance_km'] > 0 else 0,
            "segmentos_con_px": len(px_breakdown),
            "desglose_segmentos": px_breakdown[:10] if len(px_breakdown) > 10 else px_breakdown,  # Limit to 10 for readability
            "nota": f"PX calculados por {len(segments)} segmentos de ruta" if segments else "PX calculados con método simplificado"
        },
        "modificadores": {
            "tiene_ventaja_eventos": tiene_ventaja,
            "tiene_desventaja_eventos": tiene_desventaja,
            "desventaja_estacion": es_invierno_otono,
            "porcentaje_monturas": round(porcentaje_monturas * 100),
            "bonus_montura_fatiga": sum(m.montura_con_bonus for m in config.miembros if m.tiene_montura) // max(1, tiene_monturas) if tiene_monturas > 0 else 0
        },
        "velocidad_grupo": {
            "velocidad_metros": velocidad_grupo,  # Speed in meters (e.g., 9m for humans)
            "km_por_dia": round(km_por_dia_grupo, 1),
            "miembro_mas_lento": miembro_mas_lento,
            "desglose_velocidades": velocidades if velocidades else None,
            "monturas_permitidas": terrain_config.get('permite_montura', True)
        },
        "config": {
            "ritmo": config.ritmo,
            "evitar_sombra": config.evitar_sombra,
            "preferir_caminos": config.preferir_caminos,
            "horas_marcha_forzada": config.horas_marcha_forzada
        },
        "reglas": {
            "fatigue_base_cd": rules.get('fatigue_base_cd', 10),
            "cd_terreno": terrain_config.get('cd_prueba', 15)
        },
        "debug": debug_info
    }


# ============== ROUTE COMPARISON ==============

class RouteComparisonRequest(BaseModel):
    """Request for comparing two route strategies"""
    origen_id: str
    origen_nombre: str
    destino_id: str
    destino_nombre: str
    evitar_sombra: bool = False
    evitar_tierras_oscuras: bool = False
    ritmo: str = "normal"

@router.post("/compare-routes")
async def compare_routes(request: RouteComparisonRequest):
    """
    Compare two route strategies:
    1. Route preferring roads (safer, possibly longer)
    2. Direct cross-country route (shorter, but more dangerous)
    
    Both routes NEVER cross impassable terrain (infranqueable, agua).
    Both routes respect evitar_sombra and evitar_tierras_oscuras options.
    """
    from utils.pathfinding import MiddleEarthPathfinder
    
    # Get locations
    start_loc = await db.locations.find_one({"_id": request.origen_id})
    end_loc = await db.locations.find_one({"_id": request.destino_id})
    
    if not start_loc or not end_loc:
        return {"error": True, "message": "Ubicaciones no encontradas"}
    
    # Clean up _id
    start_loc['id'] = str(start_loc.pop('_id'))
    end_loc['id'] = str(end_loc.pop('_id'))
    
    # Get map data
    roads = list(await db.roads.find({}, {"_id": 0}).to_list(length=1000))
    rivers = list(await db.rivers.find({}, {"_id": 0}).to_list(length=1000))
    barriers = list(await db.barriers.find({}, {"_id": 0}).to_list(length=1000))
    all_locations = list(await db.locations.find({}).to_list(length=1000))
    terrain_polygons = await get_terrain_polygons()
    
    # Clean location IDs
    for loc in all_locations:
        if '_id' in loc:
            loc['id'] = str(loc.pop('_id'))
    
    start_coords = (start_loc.get('x', 0), start_loc.get('y', 0))
    end_coords = (end_loc.get('x', 0), end_loc.get('y', 0))
    
    # Calculate straight-line distance for reference
    import math
    COORD_TO_KM = 20.0
    straight_line_distance = math.sqrt(
        (end_coords[0] - start_coords[0])**2 + 
        (end_coords[1] - start_coords[1])**2
    ) * COORD_TO_KM
    straight_line_days = round(straight_line_distance / 36, 1)  # Base speed 36 km/day
    
    # Helper function to calculate route
    def calculate_route_data(path_result, route_type):
        if not path_result.success:
            return None
        
        # Get land type for each segment
        def get_land_type_at_point(x, y):
            min_dist = float('inf')
            land_type = 'tierras_salvajes'
            for loc in all_locations:
                dist = ((x - loc.get('x', 0))**2 + (y - loc.get('y', 0))**2) ** 0.5
                if dist < min_dist:
                    min_dist = dist
                    land_type = loc.get('clase_region') or loc.get('tipo_tierra') or 'tierras_salvajes'
            return land_type
        
        # Build segments with land type
        segments = []
        for seg in path_result.segments:
            mid_x = (seg.start[0] + seg.end[0]) / 2
            mid_y = (seg.start[1] + seg.end[1]) / 2
            segments.append({
                "start": {"x": seg.start[0], "y": seg.start[1]},
                "end": {"x": seg.end[0], "y": seg.end[1]},
                "distance_km": seg.distance_km,
                "terrain": seg.terrain,
                "road_type": seg.road_type,
                "land_type": get_land_type_at_point(mid_x, mid_y)
            })
        
        # Build land type summary
        land_type_distances = {}
        for seg in segments:
            lt = seg.get('land_type', 'tierras_salvajes')
            land_type_distances[lt] = land_type_distances.get(lt, 0) + seg['distance_km']
        
        # Calculate days based on rhythm
        dias_base = path_result.estimated_days
        if request.ritmo == 'lento':
            dias_base *= 1.5
        elif request.ritmo == 'rapido':
            dias_base *= 0.75
        
        return {
            "tipo": route_type,
            "distance_km": round(path_result.total_distance_km, 1),
            "dias_estimados": max(1, round(dias_base)),
            "casillas": max(1, round(path_result.total_distance_km / 16)),
            "path": path_result.path,
            "segments": segments,
            "terrain_summary": path_result.terrain_summary,
            "land_type_summary": {k: round(v, 1) for k, v in land_type_distances.items()},
            "roads_used": list(path_result.roads_used),
            "rivers_crossed": path_result.rivers_crossed,
            "warnings": path_result.warnings,
            "travel_cost": path_result.total_travel_cost
        }
    
    # Calculate ROUTE 1: Safe route (maximizes points - avoids dangerous lands)
    pathfinder_safe = MiddleEarthPathfinder(
        roads=roads,
        rivers=rivers,
        barriers=barriers,
        locations=all_locations,
        terrain_polygons=terrain_polygons,
        prefer_roads=True,  # Prefer roads
        avoid_shadow_lands=request.evitar_sombra,  # Respect user choice
        avoid_dark_lands=request.evitar_tierras_oscuras,  # Respect user choice
        direct_mode=False  # Use full scoring with land danger penalties
    )
    result_roads = pathfinder_safe.find_path(start_coords, end_coords)
    route_with_roads = calculate_route_data(result_roads, "segura")
    
    # Calculate ROUTE 2: Direct route (shortest path, ignores land danger)
    pathfinder_direct = MiddleEarthPathfinder(
        roads=roads,
        rivers=rivers,
        barriers=barriers,
        locations=all_locations,
        terrain_polygons=terrain_polygons,
        prefer_roads=False,  # No road preference
        avoid_shadow_lands=False,  # Direct route can go through shadow lands
        avoid_dark_lands=False,  # Direct route can go through dark lands
        direct_mode=True  # Ignores land danger penalties for shortest path
    )
    result_direct = pathfinder_direct.find_path(start_coords, end_coords)
    route_direct = calculate_route_data(result_direct, "directa")
    
    # Check for shadow/dark lands violations if options are enabled
    def check_land_violations(route_data):
        if not route_data:
            return []
        violations = []
        land_summary = route_data.get('land_type_summary', {})
        if request.evitar_sombra and land_summary.get('tierras_sombra', 0) > 0:
            violations.append(f"Atraviesa {round(land_summary['tierras_sombra'], 1)} km de Tierras de la Sombra")
        if request.evitar_tierras_oscuras and land_summary.get('tierras_oscuras', 0) > 0:
            violations.append(f"Atraviesa {round(land_summary['tierras_oscuras'], 1)} km de Tierras Oscuras")
        return violations
    
    # Add violation warnings
    if route_with_roads:
        violations = check_land_violations(route_with_roads)
        if violations:
            route_with_roads['warnings'] = route_with_roads.get('warnings', []) + violations
            route_with_roads['has_land_violations'] = True
    
    if route_direct:
        violations = check_land_violations(route_direct)
        if violations:
            route_direct['warnings'] = route_direct.get('warnings', []) + violations
            route_direct['has_land_violations'] = True
    
    # Calculate comparison metrics
    comparison = None
    if route_with_roads and route_direct:
        dist_diff = route_with_roads['distance_km'] - route_direct['distance_km']
        days_diff = route_with_roads['dias_estimados'] - route_direct['dias_estimados']
        
        # Determine which route is better
        if abs(dist_diff) < 1:  # Routes are essentially the same
            ruta_mas_corta = "igual"
            ruta_mas_rapida = "igual"
        else:
            ruta_mas_corta = "directo" if dist_diff > 0 else "caminos"
            ruta_mas_rapida = "directo" if days_diff > 0 else "caminos"
        
        comparison = {
            "distancia_diferencia_km": round(dist_diff, 1),
            "dias_diferencia": days_diff,
            "ruta_mas_corta": ruta_mas_corta,
            "ruta_mas_rapida": ruta_mas_rapida,
            "porcentaje_mas_largo": round(abs(dist_diff) / min(route_with_roads['distance_km'], route_direct['distance_km']) * 100, 1) if min(route_with_roads['distance_km'], route_direct['distance_km']) > 0 else 0,
            "rutas_identicas": abs(dist_diff) < 1
        }
    
    # Straight line reference data
    linea_recta = {
        "distance_km": round(straight_line_distance, 1),
        "dias_teoricos": straight_line_days,
        "descripcion": "Distancia en línea recta (teórica, sin obstáculos)"
    }
    
    # Add deviation info to routes
    if route_with_roads:
        route_with_roads['desvio_vs_recta_km'] = round(route_with_roads['distance_km'] - straight_line_distance, 1)
        route_with_roads['desvio_vs_recta_pct'] = round((route_with_roads['distance_km'] / straight_line_distance - 1) * 100, 1) if straight_line_distance > 0 else 0
    
    if route_direct:
        route_direct['desvio_vs_recta_km'] = round(route_direct['distance_km'] - straight_line_distance, 1)
        route_direct['desvio_vs_recta_pct'] = round((route_direct['distance_km'] / straight_line_distance - 1) * 100, 1) if straight_line_distance > 0 else 0
    
    return {
        "success": True,
        "origen": {
            "id": start_loc['id'],
            "nombre": start_loc.get('nombre'),
            "x": start_loc.get('x'),
            "y": start_loc.get('y')
        },
        "destino": {
            "id": end_loc['id'],
            "nombre": end_loc.get('nombre'),
            "x": end_loc.get('x'),
            "y": end_loc.get('y')
        },
        "linea_recta": linea_recta,
        "ruta_caminos": route_with_roads,
        "ruta_directa": route_direct,
        "comparacion": comparison,
        "opciones": {
            "evitar_sombra": request.evitar_sombra,
            "evitar_tierras_oscuras": request.evitar_tierras_oscuras,
            "ritmo": request.ritmo
        },
        "nota": "Ambas rutas evitan terreno infranqueable. Si las rutas son idénticas, significa que no hay un camino más directo disponible sin atravesar barreras."
    }



@router.post("/orientation-check")
async def orientation_check(request: OrientationCheckRequest, casillas_restantes: int = 100):
    """
    Perform an orientation check to determine distance to next event.
    
    Rules:
    - DC is always 15 (Wisdom/Travel check)
    - Guide can use Cartographer's tools if they have a map
    - Guide can use Navigator's tools for sea travel
    - -5 penalty if Guide has multiple roles
    
    Results:
    - Fail by 5+: Event at 1 tile
    - Fail: Event at 2 tiles
    - Success: Event at 3 tiles
    - Success by 5+: Event at 4 tiles
    
    Journey ends when check result >= remaining tiles
    """
    # Roll d20
    d20 = roll_d20()
    
    # Calculate modifier
    modificador = request.modificador_sabiduria
    
    # Add proficiency if applicable
    if request.viaje_maritimo and request.competencia_navegacion:
        modificador += request.bonus_competencia
    elif request.tiene_mapa and request.competencia_cartografia:
        modificador += request.bonus_competencia
    elif request.competencia_viajar:
        modificador += request.bonus_competencia
    
    # Apply penalty for multiple roles
    if request.penalizacion_multiples_papeles:
        modificador -= 5
    
    total = d20 + modificador
    cd = 15
    exito = total >= cd
    margen = total - cd
    
    # Determine tiles until next event
    if exito:
        if margen >= 5:
            casillas_hasta_evento = 4
            detalle = f"¡Éxito por 5 o más! Próximo acontecimiento a 4 casillas."
        else:
            casillas_hasta_evento = 3
            detalle = f"Éxito. Próximo acontecimiento a 3 casillas."
    else:
        if margen <= -5:
            casillas_hasta_evento = 1
            detalle = f"¡Fallo por 5 o más! Próximo acontecimiento a solo 1 casilla."
        else:
            casillas_hasta_evento = 2
            detalle = f"Fallo. Próximo acontecimiento a 2 casillas."
    
    # Check if journey is complete
    viaje_completado = casillas_hasta_evento >= casillas_restantes
    if viaje_completado:
        detalle = f"¡El viaje ha concluido! La tirada ({total}) iguala o supera las {casillas_restantes} casillas restantes."
    
    return {
        "success": True,
        "d20": d20,
        "modificador": modificador,
        "total": total,
        "cd": cd,
        "exito": exito,
        "margen": margen,
        "casillas_hasta_evento": casillas_hasta_evento,
        "viaje_completado": viaje_completado,
        "detalle": detalle,
        "desglose": {
            "d20": d20,
            "mod_sabiduria": request.modificador_sabiduria,
            "competencia": request.bonus_competencia if (request.competencia_viajar or (request.tiene_mapa and request.competencia_cartografia) or (request.viaje_maritimo and request.competencia_navegacion)) else 0,
            "penalizacion_roles": -5 if request.penalizacion_multiples_papeles else 0
        }
    }

@router.post("/generate-event")
async def generate_event(
    tipo_tierra: str = "tierras_salvajes",
    terreno: str = "campo_abierto", 
    estacion: str = "verano"
):
    """
    Generate a single travel event with dice rolls.
    Returns event type, objective, and CD for resolution.
    """
    events_table = await get_travel_events()
    objectives = await get_event_objectives()
    terrains = await get_terrain_difficulties()
    land_types = await get_land_types()
    
    # Get land type config for advantage/disadvantage
    land_config = next((l for l in land_types if l['tipo'] == tipo_tierra), None)
    
    # Roll for event type
    if land_config and land_config.get('ventaja_acontecimientos'):
        d20_roll = roll_with_advantage()
        roll_type = "ventaja"
    elif land_config and land_config.get('desventaja_acontecimientos'):
        d20_roll = roll_with_disadvantage()
        roll_type = "desventaja"
    else:
        d20_roll = roll_d20()
        roll_type = "normal"
    
    # Find matching event
    evento = None
    for e in events_table:
        if e['d20_min'] <= d20_roll <= e['d20_max']:
            evento = e
            break
    
    if not evento:
        evento = events_table[3]  # Default to Percance
    
    # Roll for objective
    d3_roll = roll_d3()
    objetivo = next((o for o in objectives if o['d3_value'] == d3_roll), objectives[0])
    
    # Get terrain CD
    terrain_config = next((t for t in terrains if t['tipo'] == terreno), terrains[1])
    cd_prueba = terrain_config.get('cd_prueba', 15)
    
    # Check season disadvantage for saves
    es_invierno_otono = estacion in ['invierno', 'otono']
    
    return {
        "success": True,
        "tiradas": {
            "d20": d20_roll,
            "d3": d3_roll,
            "tipo_tirada": roll_type
        },
        "evento": {
            "id": evento['id'],
            "nombre": evento['nombre'],
            "fatigue_cd_increase": evento['fatigue_cd_increase'],
            "consecuencias_exito": evento['consecuencias_exito'],
            "consecuencias_fracaso": evento['consecuencias_fracaso'],
            "requiere_salvacion_extra": evento.get('requiere_salvacion_extra', False),
            "tipo_salvacion_extra": evento.get('tipo_salvacion_extra'),
            "puntos_sombra": evento.get('puntos_sombra', 0)
        },
        "objetivo": {
            "papel": objetivo['papel'],
            "prueba": objetivo['prueba'],
            "atributo": objetivo['atributo'],
            "habilidad": objetivo['habilidad']
        },
        "resolucion": {
            "cd": cd_prueba,
            "desventaja_salvacion": es_invierno_otono,
            "terreno": terreno
        }
    }

@router.post("/resolve-event")
async def resolve_event(
    evento_id: str,
    tirada_resolucion: int,
    cd: int,
    exito: bool,
    evento_nombre: str = "",
    objetivo_papel: str = "",
    personaje_nombre: str = ""
):
    """
    Resolve an event and return consequences.
    """
    events_table = await get_travel_events()
    evento = next((e for e in events_table if e['id'] == evento_id), None)
    
    if not evento:
        return {"error": True, "message": "Evento no encontrado"}
    
    resultado = {
        "exito": exito,
        "evento": evento_nombre or evento['nombre'],
        "objetivo": objetivo_papel,
        "personaje": personaje_nombre,
        "tirada": tirada_resolucion,
        "cd": cd,
        "consecuencias": [],
        "modificadores": {
            "fatiga_cd_increase": evento['fatigue_cd_increase'],
            "dias_extra": 0,
            "dias_reducidos": 0,
            "puntos_sombra": 0,
            "inspiracion": False
        }
    }
    
    if exito:
        resultado["consecuencias"].append(evento['consecuencias_exito'])
        
        # Special success effects
        if evento['id'] == 'event_atajo':
            resultado["modificadores"]["dias_reducidos"] = 1
            resultado["consecuencias"].append("La duración del viaje se reduce en 1 día.")
        elif evento['id'] == 'event_encuentro':
            resultado["modificadores"]["fatiga_cd_increase"] = 0
            resultado["consecuencias"].append("La CD de fatiga no aumenta por este evento.")
        elif evento['id'] == 'event_vista':
            resultado["modificadores"]["inspiracion"] = True
            resultado["consecuencias"].append("Todos obtienen Inspiración.")
    else:
        resultado["consecuencias"].append(evento['consecuencias_fracaso'])
        
        # Special failure effects
        if evento['id'] == 'event_percance':
            resultado["modificadores"]["fatiga_cd_increase"] += 2
            resultado["modificadores"]["dias_extra"] = 1
            resultado["consecuencias"].append("La CD de fatiga aumenta +2 adicional.")
            resultado["consecuencias"].append("La duración del viaje aumenta en 1 día.")
        elif evento['id'] in ['event_desesperanza', 'event_decisiones']:
            resultado["modificadores"]["puntos_sombra"] = evento.get('puntos_sombra', 0)
        
        # Extra saves for terrible events
        if evento.get('requiere_salvacion_extra'):
            resultado["requiere_salvacion_adicional"] = {
                "tipo": evento['tipo_salvacion_extra'],
                "cd": cd
            }
    
    return resultado

@router.post("/fatigue-save")
async def calculate_fatigue_save(
    personaje_nombre: str,
    modificador_constitucion: int,
    cd_acumulada: int,
    dias_con_montura: int = 0,
    dias_totales: int = 1,
    bonus_montura_con: int = 0
):
    """
    Calculate fatigue save for a character at end of journey.
    """
    rules = await get_travel_rules()
    
    # Calculate mount bonus (if used for 50%+ of journey)
    porcentaje_montura = dias_con_montura / dias_totales if dias_totales > 0 else 0
    bonus_montura = bonus_montura_con if porcentaje_montura >= 0.5 else 0
    
    # Roll the save
    tirada = roll_d20()
    total = tirada + modificador_constitucion + bonus_montura
    
    # Determine result
    diferencia = cd_acumulada - total
    
    if total >= cd_acumulada:
        niveles_cansancio = 0
        resultado = "éxito"
    elif diferencia < 5:
        niveles_cansancio = 1
        resultado = "fracaso"
    elif diferencia < 10:
        niveles_cansancio = rules.get('fatigue_fail_by_5_levels', 2)
        resultado = "fracaso_grave"
    else:
        niveles_cansancio = rules.get('fatigue_fail_by_10_levels', 3)
        resultado = "fracaso_critico"
    
    return {
        "personaje": personaje_nombre,
        "tirada": {
            "d20": tirada,
            "modificador_con": modificador_constitucion,
            "bonus_montura": bonus_montura,
            "total": total
        },
        "cd": cd_acumulada,
        "resultado": resultado,
        "niveles_cansancio": niveles_cansancio,
        "detalles": {
            "porcentaje_montura": round(porcentaje_montura * 100),
            "montura_aplicada": porcentaje_montura >= 0.5
        }
    }

# ============== ACTIVE JOURNEY MANAGEMENT (DAY-BY-DAY MODE) ==============

@router.post("/journey/start")
async def start_journey(config: JourneyConfig):
    """Start a new day-by-day journey"""
    # Calculate journey basics
    calc_result = await calculate_journey(config)
    
    if calc_result.get('error'):
        return calc_result
    
    journey = ActiveJourney(
        config=config,
        casillas_totales=calc_result['ruta']['casillas'],
        fatiga_cd_total=calc_result['reglas']['fatigue_base_cd']
    )
    
    journey_dict = journey.model_dump()
    journey_dict['created_at'] = journey_dict['created_at'].isoformat()
    journey_dict['updated_at'] = journey_dict['updated_at'].isoformat()
    
    await db.active_journeys.insert_one(journey_dict)
    
    # Remove MongoDB _id before returning
    journey_dict.pop('_id', None)
    
    return {
        "success": True,
        "journey_id": journey.id,
        "journey": journey_dict,
        "calculo": calc_result
    }

@router.get("/journey/{journey_id}")
async def get_journey(journey_id: str):
    """Get active journey state"""
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return journey

@router.post("/journey/{journey_id}/advance-day")
async def advance_journey_day(
    journey_id: str,
    ritmo: str = "normal",
    marcha_forzada_horas: int = 0,
    cambios_roles: Optional[Dict[str, str]] = None
):
    """Advance journey by one day"""
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    if journey.get('completado'):
        return {"error": True, "message": "El viaje ya está completado"}
    
    rules = await get_travel_rules()
    
    # Calculate distance for this day
    base_km = 36 if ritmo == "normal" else (24 if ritmo == "lento" else 48)
    marcha_km = marcha_forzada_horas * rules.get('forced_march_km_per_hour', 6)
    total_km = base_km + marcha_km
    
    # Create day record
    dia_actual = journey.get('dia_actual', 1)
    casillas_recorridas = journey.get('casillas_recorridas', 0)
    
    # Estimate casillas for this day (simplified)
    casillas_hoy = 1  # Simplified: 1 casilla per day normally
    if ritmo == "rapido":
        casillas_hoy = 1.5
    
    new_day = {
        "dia": dia_actual,
        "casilla_actual": casillas_recorridas + casillas_hoy,
        "terreno": "campo_abierto",
        "tipo_tierra": journey['config']['tipo_tierra'] if 'tipo_tierra' in journey.get('config', {}) else "tierras_salvajes",
        "distancia_recorrida_km": total_km,
        "eventos": [],
        "fatiga_cd_acumulada": journey.get('fatiga_cd_total', 10),
        "notas": f"Ritmo: {ritmo}" + (f", Marcha forzada: {marcha_forzada_horas}h" if marcha_forzada_horas > 0 else "")
    }
    
    # Check if journey is complete
    nueva_casilla = casillas_recorridas + casillas_hoy
    completado = nueva_casilla >= journey.get('casillas_totales', 1)
    
    # Update journey
    update_data = {
        "$push": {"dias": new_day},
        "$set": {
            "dia_actual": dia_actual + 1,
            "casillas_recorridas": nueva_casilla,
            "completado": completado,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    }
    
    await db.active_journeys.update_one({"id": journey_id}, update_data)
    
    # Get updated journey
    updated_journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    
    return {
        "success": True,
        "dia": new_day,
        "journey": updated_journey,
        "completado": completado
    }

@router.post("/journey/{journey_id}/add-event")
async def add_event_to_journey(journey_id: str, evento: Dict[str, Any]):
    """Add an event to the current journey day"""
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    dias = journey.get('dias', [])
    if not dias:
        return {"error": True, "message": "No hay días registrados en el viaje"}
    
    # Add event to last day
    dia_index = len(dias) - 1
    
    # Update fatigue CD
    fatiga_increase = evento.get('fatiga_cd_increase', 0)
    new_fatiga = journey.get('fatiga_cd_total', 10) + fatiga_increase
    
    await db.active_journeys.update_one(
        {"id": journey_id},
        {
            "$push": {f"dias.{dia_index}.eventos": evento},
            "$set": {
                "fatiga_cd_total": new_fatiga,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$inc": {
                "dias_extra": evento.get('dias_extra', 0),
                "dias_reducidos": evento.get('dias_reducidos', 0),
                "px_acumulados": evento.get('px', 0)
            }
        }
    )
    
    return {"success": True, "fatiga_cd_nueva": new_fatiga}

@router.post("/journey/{journey_id}/complete")
async def complete_journey(journey_id: str):
    """Mark journey as complete and calculate final results"""
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    
    await db.active_journeys.update_one(
        {"id": journey_id},
        {"$set": {"completado": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "resumen": {
            "dias_totales": journey.get('dia_actual', 1) - 1 + journey.get('dias_extra', 0) - journey.get('dias_reducidos', 0),
            "casillas_recorridas": journey.get('casillas_recorridas', 0),
            "fatiga_cd_final": journey.get('fatiga_cd_total', 10),
            "px_total": journey.get('px_acumulados', 0),
            "eventos_totales": sum(len(d.get('eventos', [])) for d in journey.get('dias', []))
        }
    }

@router.get("/journeys/active")
async def get_active_journeys():
    """Get all active (incomplete) journeys"""
    journeys = await db.active_journeys.find(
        {"completado": False},
        {"_id": 0}
    ).to_list(100)
    return {"journeys": journeys}

@router.delete("/journey/{journey_id}")
async def delete_journey(journey_id: str):
    """Delete a journey"""
    result = await db.active_journeys.delete_one({"id": journey_id})
    return {"success": True, "deleted": result.deleted_count}


# ============== CAMP (ACAMPAR) ==============

class CampRequest(BaseModel):
    """Request to camp overnight during journey"""
    fatiga_cd_decrement: float = 0.5  # How much to reduce accumulated fatigue CD

@router.post("/journey/{journey_id}/camp")
async def camp_journey(journey_id: str, data: CampRequest = Body(default=CampRequest())):
    """
    Register a camping day for an active journey.
    Reduces accumulated fatigue CD by a fixed decrement (default 0.5)
    without going below the base of 10.
    The rest of the camping mechanics (character fatigue recovery, rations,
    sentinel, night events) are handled client-side and persisted via the
    existing endpoints (character fatigue, provision consumption, events).
    """
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    current_cd = float(journey.get('fatiga_cd_total', 10))
    new_cd = max(10.0, round((current_cd - data.fatiga_cd_decrement) * 2) / 2)

    await db.active_journeys.update_one(
        {"id": journey_id},
        {"$set": {
            "fatiga_cd_total": new_cd,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {
        "success": True,
        "fatiga_cd_anterior": current_cd,
        "fatiga_cd_nueva": new_cd,
        "decremento_aplicado": round(current_cd - new_cd, 2)
    }


# ============== P0: BULK PX UPDATE FOR JOURNEY COMPLETION ==============

class BulkPXUpdate(BaseModel):
    """Request to apply PX to multiple characters"""
    character_ids: List[str]
    px_amount: int
    journey_id: Optional[str] = None
    journey_description: Optional[str] = None

@router.post("/apply-px")
async def apply_px_to_characters(data: BulkPXUpdate):
    """
    Apply PX to multiple characters at once (for journey completion).
    Returns updated XP for each character.
    """
    if not data.character_ids:
        return {"error": True, "message": "No se proporcionaron personajes"}
    
    if data.px_amount <= 0:
        return {"error": True, "message": "La cantidad de PX debe ser mayor a 0"}
    
    results = []
    success_count = 0
    
    for char_id in data.character_ids:
        try:
            # Get current character
            character = await db.characters.find_one({"_id": char_id})
            if not character:
                results.append({
                    "character_id": char_id,
                    "success": False,
                    "error": "Personaje no encontrado"
                })
                continue
            
            # Calculate new XP
            current_xp = character.get('experiencia', 0)
            new_xp = current_xp + data.px_amount
            
            # Update character
            await db.characters.update_one(
                {"_id": char_id},
                {
                    "$set": {
                        "experiencia": new_xp,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            
            results.append({
                "character_id": char_id,
                "nombre": character.get('nombre', 'Desconocido'),
                "success": True,
                "xp_anterior": current_xp,
                "xp_nuevo": new_xp,
                "px_ganados": data.px_amount
            })
            success_count += 1
            
        except Exception as e:
            results.append({
                "character_id": char_id,
                "success": False,
                "error": str(e)
            })
    
    # Log the journey completion if journey_id provided
    if data.journey_id:
        try:
            await db.active_journeys.update_one(
                {"id": data.journey_id},
                {
                    "$set": {
                        "px_aplicados": True,
                        "px_aplicados_fecha": datetime.now(timezone.utc).isoformat(),
                        "px_cantidad": data.px_amount
                    }
                }
            )
        except:
            pass  # Non-critical
    
    return {
        "success": success_count > 0,
        "message": f"PX aplicados a {success_count}/{len(data.character_ids)} personajes",
        "total_personajes": len(data.character_ids),
        "exitosos": success_count,
        "px_por_personaje": data.px_amount,
        "results": results
    }


# ============== AI NARRATIVE GENERATION ==============

@router.post("/generate-narrative")
async def generate_event_narrative(
    evento_nombre: str,
    exito: bool,
    consecuencia: str,
    personaje_nombre: str,
    papel: str,
    tirada: int,
    cd: int,
    origen: str,
    destino: str,
    terreno: str = "campo_abierto",
    evento_numero: int = 1,
    total_eventos: int = 1,
    dia_actual: int = 1,
    dias_totales: int = 1
):
    """
    Generate a Tolkien-style narrative for a travel event outcome.
    Uses AI to create immersive descriptions.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {
                "success": False,
                "narrative": consecuencia,
                "error": "No API key configured"
            }
        
        # Map terrain to Spanish description
        terreno_names = {
            "facil": "el camino despejado",
            "moderado": "las sendas serpenteantes",
            "dificil": "el terreno agreste",
            "muy_dificil": "las tierras inhóspitas",
            "desalentador": "los parajes desolados",
            "campo_abierto": "las vastas llanuras",
            "colinas": "las ondulantes colinas",
            "bosque": "el oscuro bosque",
            "bosque_denso": "la espesura del bosque antiguo",
            "montanas": "las montañas escarpadas",
            "pantano": "los traicioneros pantanos",
            "desierto": "las tierras áridas",
            "costa": "la costa rocosa",
            "rio": "las orillas del río"
        }
        terreno_desc = terreno_names.get(terreno, "el camino")
        
        # Map roles to Spanish
        papeles_names = {
            "guia": "Guía",
            "cazador": "Cazador",
            "vigia": "Vigía",
            "explorador": "Explorador"
        }
        papel_name = papeles_names.get(papel, papel)
        
        resultado = "ÉXITO" if exito else "FRACASO"
        
        # Calculate journey progress
        progreso = round((evento_numero / total_eventos) * 100) if total_eventos > 0 else 50
        if progreso <= 25:
            fase_viaje = "Al comienzo del viaje"
        elif progreso <= 50:
            fase_viaje = "A mitad de camino"
        elif progreso <= 75:
            fase_viaje = "Avanzado el viaje"
        else:
            fase_viaje = "Cerca del final del viaje"
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"narrative_{uuid.uuid4().hex[:8]}",
            system_message="""Eres un narrador para un juego de rol ambientado en la Tierra Media. 
            Genera narrativas cortas (2-3 frases) en español con un tono natural y cálido.
            Escribe como si fuera un diario de viaje o una conversación junto al fuego.
            NO uses lenguaje arcaico ni épico. Evita palabras como "épico", "glorioso", "valeroso".
            NO menciones origen ni destino. Céntrate SOLO en el momento presente del viaje.
            Describe la escena de forma sencilla pero evocadora, como lo haría un hobbit contando una historia.
            No uses emojis."""
        ).with_model("openai", "gpt-4o")
        
        prompt = f"""Genera una breve narrativa (2-3 frases) para este evento de viaje:

FASE DEL VIAJE: {fase_viaje} (día {dia_actual} de {dias_totales})
TERRENO ACTUAL: {terreno_desc}
EVENTO: {evento_nombre}
RESULTADO: {"El grupo tuvo éxito" if exito else "Las cosas no salieron bien"}
PERSONAJE RESPONSABLE: {personaje_nombre} ({papel_name})
CONSECUENCIA: {consecuencia}

INSTRUCCIONES: Describe qué sucedió de forma natural y sencilla, como si lo contaras a un amigo. Evita el tono épico."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {
            "success": True,
            "narrative": response,
            "evento": evento_nombre,
            "resultado": resultado
        }
        
    except Exception as e:
        # Fallback to simple description
        return {
            "success": False,
            "narrative": consecuencia,
            "error": str(e)
        }


class JourneySummaryRequest(BaseModel):
    origen: str
    destino: str
    dias: int
    eventos: List[Dict[str, Any]] = []
    personajes: List[Dict[str, Any]] = []
    px_total: int = 0
    terrenos: Dict[str, float] = None

@router.post("/generate-journey-summary")
async def generate_journey_summary(request: JourneySummaryRequest):
    """
    Generate a complete Tolkien-style journey summary for PDF export.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"success": False, "error": "No API key configured"}
        
        # Build event summary
        eventos_text = ""
        for i, e in enumerate(request.eventos, 1):
            resultado = "ÉXITO" if e.get('exito') else "FRACASO"
            eventos_text += f"\n  - Día {e.get('dia', i)}: {e.get('nombre', 'Evento')} - {resultado}"
        
        # Build party summary
        grupo_text = ", ".join([f"{p.get('nombre')} ({p.get('papel', 'viajero')})" for p in request.personajes])
        
        # Build terrain summary
        terreno_text = ""
        if request.terrenos:
            for terrain, km in request.terrenos.items():
                terreno_text += f"\n  - {terrain}: {km:.1f} km"
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"summary_{uuid.uuid4().hex[:8]}",
            system_message="""Eres un narrador que escribe relatos de viajes por la Tierra Media.
            Escribe en español con un tono cálido y natural, como si contaras la historia junto a una chimenea.
            Evita el lenguaje arcaico y épico excesivo. Sé descriptivo pero accesible.
            NO menciones puntos de experiencia, tiradas, ni mecánicas de juego.
            Estructura tu relato con naturalidad: cómo empezó el viaje, qué pasó en el camino, y cómo llegaron.
            Máximo 250 palabras. No uses emojis."""
        ).with_model("openai", "gpt-4o")
        
        prompt = f"""Escribe el relato de este viaje:

VIAJE: De {request.origen} a {request.destino}
DURACIÓN: {request.dias} días
COMPAÑÍA: {grupo_text if grupo_text else "Un grupo de viajeros"}
TERRENOS: {terreno_text if terreno_text else "Caminos y sendas de la Tierra Media"}
ACONTECIMIENTOS: {eventos_text if eventos_text else "El viaje fue tranquilo"}

Narra el viaje de forma natural, como si se lo contaras a alguien. Describe el paisaje, el clima, los momentos importantes. NO menciones puntos de experiencia ni mecánicas de juego."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {
            "success": True,
            "narrative": response,
            "tipo": "journey_summary"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "narrative": f"El viaje de {request.origen} a {request.destino} duró {request.dias} días."
        }



# New endpoint to apply individual PX amounts per character
class ApplyPXIndividualRequest(BaseModel):
    characters: List[dict]  # List of {character_id: str, character_name: str, px_amount: int}
    journey_id: Optional[str] = None
    journey_description: Optional[str] = None

@router.post("/apply-px-individual")
async def apply_px_individual(request: ApplyPXIndividualRequest):
    """Apply different PX amounts to each character based on their individual performance"""
    try:
        results = []
        exitosos = 0
        
        for char_data in request.characters:
            char_id = char_data.get('character_id')
            px_amount = char_data.get('px_amount', 0)
            char_name = char_data.get('character_name', 'Desconocido')
            
            if not char_id:
                continue
            
            # Find character in DB
            from bson import ObjectId
            try:
                character = await db.characters.find_one({"_id": ObjectId(char_id)})
            except:
                character = await db.characters.find_one({"_id": char_id})
            
            if not character:
                results.append({
                    "character_id": char_id,
                    "character_name": char_name,
                    "success": False,
                    "error": "Personaje no encontrado"
                })
                continue
            
            # Update XP
            current_xp = character.get('xp', 0) or 0
            new_xp = current_xp + px_amount
            
            try:
                await db.characters.update_one(
                    {"_id": character["_id"]},
                    {"$set": {"xp": new_xp}}
                )
                exitosos += 1
                results.append({
                    "character_id": char_id,
                    "character_name": char_name,
                    "success": True,
                    "xp_anterior": current_xp,
                    "xp_ganado": px_amount,
                    "xp_nuevo": new_xp
                })
            except Exception as e:
                results.append({
                    "character_id": char_id,
                    "character_name": char_name,
                    "success": False,
                    "error": str(e)
                })
        
        return {
            "success": exitosos > 0,
            "exitosos": exitosos,
            "total": len(request.characters),
            "results": results,
            "journey_description": request.journey_description
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
