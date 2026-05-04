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
    # Niveles de fatiga aplicados según el margen de fallo:
    #   • Fallar por menos de 5    → +fatigue_fail_by_less_than_5_levels  (def. 1)
    #   • Fallar por 5  a 9        → +fatigue_fail_by_5_levels            (def. 2)
    #   • Fallar por 10 o más      → +fatigue_fail_by_10_levels           (def. 3)
    fatigue_fail_by_less_than_5_levels: int = 1
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
    # Rationing — base consumption per character per day, by pace.
    #   1 ración = 1 día completo de comida (no afecta peso al consumir).
    #   El agua se mide en litros/día.
    consumo_comida_lento: float = 1.0
    consumo_comida_normal: float = 1.0
    consumo_comida_rapido: float = 1.25
    consumo_agua_lento: float = 2.0
    consumo_agua_normal: float = 2.0
    consumo_agua_rapido: float = 2.5
    # Forced March — la marcha forzada NO se expone ya como parámetro global;
    # se decide día a día después de la tirada de orientación. No consume
    # más raciones (el cansancio extra lo representa la salvación diaria CD 15).
    # Se conservan los campos defaults vacíos por compatibilidad con
    # instalaciones antiguas, pero no se usan para nada nuevo.
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
    # Penalización en metros por estorbo (carga > capacidad). Se resta de
    # la velocidad efectiva. Negativo: -3 (estorbado), -6 (muy estorbado).
    estorbo_metros: int = 0
    # Si el jinete (con montura) deja la carga sobre el animal, se cancela el
    # estorbo del personaje a efectos de velocidad.
    montura_carga_equipo: bool = False
    # Carga real (kg) que va sobre la montura y su capacidad (kg). Si la
    # carga supera la capacidad, se aplica -33% a la velocidad de la
    # montura (regla LOTR 5e: animal sobrecargado).
    montura_capacidad_kg: float = 0
    montura_carga_actual_kg: float = 0
    
    def velocidad_efectiva(self, mount_allowed: bool = True) -> Dict[str, float]:
        """
        Get effective travel speed for this member in METERS, applying:
          • Cuando va montado y el terreno lo permite, la velocidad es
            DIRECTAMENTE la de la montura (no el +40% antiguo). Si la
            montura va sobrecargada (carga > capacidad), se le resta un
            33% (regla LOTR 5e: animal cargado).
          • Si la montura transporta el equipo, el jinete no sufre
            estorbo (su penalización por carga se anula).
          • Si va a pie o el terreno no permite montar, su velocidad =
            velocidad_base + estorbo_metros.
        Devuelve {"velocidad": float, "montura_sobrecargada": bool,
                  "carga_pct": float}.
        """
        carries_gear = bool(getattr(self, 'montura_carga_equipo', False))
        estorbo_efectivo = 0 if (self.tiene_montura and carries_gear) else self.estorbo_metros
        base_a_pie = max(1.0, self.velocidad_base + estorbo_efectivo)

        if self.tiene_montura and mount_allowed:
            # Velocidad de la montura. Si no está definida, fallback al
            # +40% sobre la velocidad del personaje (compat. retro).
            vel_montura = self.montura_velocidad if self.montura_velocidad > 0 else (self.velocidad_base * 1.40)
            # Penalización por sobrecarga del animal: -33% si carga > cap.
            cap = self.montura_capacidad_kg or 0
            carga = self.montura_carga_actual_kg or 0
            sobrecargada = (cap > 0 and carga > cap)
            carga_pct = (carga / cap) if cap > 0 else 0
            if sobrecargada:
                vel_montura = vel_montura * 0.67  # -33%
            return {
                "velocidad": round(vel_montura, 2),
                "montura_sobrecargada": sobrecargada,
                "carga_pct": round(carga_pct, 2),
                "monta": True,
            }
        return {
            "velocidad": base_a_pie,
            "montura_sobrecargada": False,
            "carga_pct": 0,
            "monta": False,
        }

class JourneyConfig(BaseModel):
    """Configuration for a journey"""
    origen_id: str
    origen_nombre: str
    destino_id: str
    destino_nombre: str
    # Optional explicit coordinates (used when picking arbitrary points on the
    # map via MapPickDialog). When provided they override the DB lookup and
    # allow the journey to start/end at any (x, y) percentage on the map.
    origen_x: Optional[float] = None
    origen_y: Optional[float] = None
    destino_x: Optional[float] = None
    destino_y: Optional[float] = None
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

    Uses the SAME `MiddleEarthPathfinder` (A*) the real journey calculation
    uses, so the visualised path matches what the system actually walks.
    Each step is annotated with terrain, land type, road and river info.
    """
    import math
    from utils.pathfinding import MiddleEarthPathfinder

    KM_PER_PERCENT = 1.974

    def distance(x1, y1, x2, y2):
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

    # Locate origen / destino
    locations = await db.locations.find({}).to_list(length=None)
    for loc in locations:
        if '_id' in loc:
            loc['id'] = str(loc.pop('_id'))

    origen = next((l for l in locations if l.get('nombre') == config.origen_nombre), None)
    destino = next((l for l in locations if l.get('nombre') == config.destino_nombre), None)
    if not origen or not destino:
        raise HTTPException(
            status_code=404,
            detail=f"Origen o destino no encontrado: {config.origen_nombre} → {config.destino_nombre}",
        )

    # Load roads/rivers/barriers/regions/polygons (same as calculate-journey)
    roads = await db.roads.find({}).to_list(length=None)
    rivers = await db.rivers.find({}).to_list(length=None)
    barriers = await db.barriers.find({}).to_list(length=None)
    regions = await db.regions.find({}).to_list(length=None)
    terrain_polygons = await get_terrain_polygons()
    for col in (roads, rivers, barriers, regions):
        for c in col:
            if '_id' in c:
                c['id'] = str(c.pop('_id'))

    pathfinder = MiddleEarthPathfinder(
        roads=roads,
        rivers=rivers,
        barriers=barriers,
        locations=locations,
        regions=regions,
        terrain_polygons=terrain_polygons,
        prefer_roads=config.preferir_caminos,
        avoid_shadow_lands=config.evitar_tierras_sombra,
        avoid_dark_lands=config.evitar_tierras_oscuras,
    )

    start_coords = (origen.get('x', 0), origen.get('y', 0))
    end_coords = (destino.get('x', 0), destino.get('y', 0))

    path_result = pathfinder.find_path(start_coords, end_coords)

    # Helper: nearest location land type for a point
    def land_at(x, y):
        min_d = float('inf')
        land = 'tierras_salvajes'
        for loc in locations:
            d = (x - loc.get('x', 0)) ** 2 + (y - loc.get('y', 0)) ** 2
            if d < min_d:
                min_d = d
                land = loc.get('clase_region') or loc.get('tipo_tierra') or 'tierras_salvajes'
        return land

    # Build the step-by-step path narrative from the segments returned by A*
    pasos = []
    if path_result.success:
        prev = start_coords
        cum_km = 0.0
        # First step = origin
        pasos.append({
            "paso": 0,
            "nombre": f"Origen — {config.origen_nombre}",
            "x": prev[0],
            "y": prev[1],
            "terreno": pathfinder.get_terrain_from_polygons(prev[0], prev[1]),
            "tipo_tierra": land_at(prev[0], prev[1]),
            "road_name": pathfinder._get_road_at_point(prev[0], prev[1]).get('name')
                if pathfinder._get_road_at_point(prev[0], prev[1]) else None,
            "decision": "Punto de partida",
            "distancia_acumulada_km": 0.0,
        })

        for i, seg in enumerate(path_result.segments, start=1):
            seg_d_km = distance(seg.start[0], seg.start[1], seg.end[0], seg.end[1]) * KM_PER_PERCENT
            cum_km += seg_d_km
            terreno = pathfinder.get_terrain_from_polygons(seg.end[0], seg.end[1])
            tipo_tierra = land_at(seg.end[0], seg.end[1])
            road_at = pathfinder._get_road_at_point(seg.end[0], seg.end[1])
            road_name = road_at.get('name') if road_at else None
            decision_parts = []
            if seg.road_type and seg.road_type not in ('ninguno', '', None):
                decision_parts.append(f"Por {seg.road_type}")
            else:
                decision_parts.append(f"A campo través ({terreno})")
            if seg.river_crossing:
                decision_parts.append(f"Cruce de río ({seg.river_crossing})")
            decision_parts.append(f"+{seg_d_km:.1f} km · coste {seg.travel_cost:.2f}")
            pasos.append({
                "paso": i,
                "x": seg.end[0],
                "y": seg.end[1],
                "terreno": terreno,
                "tipo_tierra": tipo_tierra,
                "road_name": road_name,
                "river_crossing": seg.river_crossing,
                "travel_cost": round(seg.travel_cost, 3),
                "decision": " · ".join(decision_parts),
                "distancia_acumulada_km": round(cum_km, 1),
            })
            prev = seg.end

        # Final step = destino
        pasos.append({
            "paso": len(pasos),
            "nombre": f"Destino — {config.destino_nombre}",
            "x": end_coords[0],
            "y": end_coords[1],
            "terreno": pathfinder.get_terrain_from_polygons(end_coords[0], end_coords[1]),
            "tipo_tierra": land_at(end_coords[0], end_coords[1]),
            "decision": "Llegada al destino",
            "distancia_acumulada_km": round(path_result.total_distance_km, 1),
        })

    straight_km = distance(
        origen.get('x', 0), origen.get('y', 0),
        destino.get('x', 0), destino.get('y', 0),
    ) * KM_PER_PERCENT

    return {
        "configuracion": {
            "origen": config.origen_nombre,
            "destino": config.destino_nombre,
            "preferir_caminos": config.preferir_caminos,
            "evitar_tierras_oscuras": config.evitar_tierras_oscuras,
            "evitar_tierras_sombra": config.evitar_tierras_sombra,
        },
        "resumen": {
            "exito": path_result.success,
            "total_pasos": len(pasos),
            "segmentos_pathfinder": len(path_result.segments),
            "distancia_total_km": round(path_result.total_distance_km, 1) if path_result.success else 0,
            "coste_total": round(path_result.total_travel_cost, 2) if path_result.success else 0,
            "dias_estimados": round(path_result.estimated_days, 1) if path_result.success else 0,
            "distancia_linea_recta_km": round(straight_km, 1),
            "warnings": path_result.warnings,
            "rivers_crossed": getattr(path_result, 'rivers_crossed', []),
            "roads_used": getattr(path_result, 'roads_used', []),
            "terrain_summary": getattr(path_result, 'terrain_summary', {}),
        },
        "pasos": pasos,
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
    path_result = None  # Pathfinder result (may stay None if pathfinder is not run)
    
    try:
        # Use our own db connection to get locations
        # If the id is a "custom:" sentinel (free map point) we skip DB lookup
        # and build a synthetic location below from explicit coordinates.
        start_loc = None
        end_loc = None
        if config.origen_id and not str(config.origen_id).startswith("custom:"):
            start_loc = await db.locations.find_one({"_id": config.origen_id})
        if config.destino_id and not str(config.destino_id).startswith("custom:"):
            end_loc = await db.locations.find_one({"_id": config.destino_id})

        # Build virtual locations for free map points based on the closest
        # known location's region/clase_region (used for climate + land type).
        async def _build_virtual_loc(x, y, nombre, fallback_id):
            all_l = await db.locations.find({}).to_list(length=None)
            nearest = None
            best = float('inf')
            for l in all_l:
                lx = l.get('x'); ly = l.get('y')
                if lx is None or ly is None:
                    continue
                d = (lx - x) ** 2 + (ly - y) ** 2
                if d < best:
                    best = d
                    nearest = l
            return {
                "_id": fallback_id or f"custom:{x},{y}",
                "nombre": nombre or "Punto en el mapa",
                "x": x,
                "y": y,
                "region": (nearest.get('region') if nearest else 'Eriador'),
                "clase_region": (nearest.get('clase_region') if nearest else 'tierras_salvajes'),
                "tipo_tierra": (nearest.get('tipo_tierra') if nearest else 'tierras_salvajes'),
            }

        if not start_loc and config.origen_x is not None and config.origen_y is not None:
            start_loc = await _build_virtual_loc(
                config.origen_x, config.origen_y,
                config.origen_nombre, config.origen_id,
            )
        if not end_loc and config.destino_x is not None and config.destino_y is not None:
            end_loc = await _build_virtual_loc(
                config.destino_x, config.destino_y,
                config.destino_nombre, config.destino_id,
            )

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
            # — IMPORTANTE: si el A* falla por presencia de barreras infranqueables o
            #   polígonos bloqueantes, NO calculamos línea recta (sería ignorar todo
            #   el terreno). Avisamos al DJ y le dejamos decidir.
            if not route_data:
                pathfinder_failed = path_result is not None and not path_result.success
                if pathfinder_failed:
                    return {
                        "error": True,
                        "message": (
                            "No se pudo encontrar una ruta válida entre origen y destino. "
                            "Es probable que haya barreras infranqueables, ríos sin paso o "
                            "extensiones de agua que bloquean el camino. Revisa el mapa, "
                            "añade un puente / paso de montaña, o desactiva 'preferir caminos' "
                            "y prueba de nuevo."
                        ),
                        "ruta_alternativa_necesaria": True,
                        "warnings_pathfinder": getattr(path_result, 'warnings', []),
                    }
                # Si NO se ejecutó pathfinder (origen/destino sin coords, etc.), sí
                # caemos al modo línea recta como hasta ahora — pero con aviso claro.
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
    
    # ============ CALCULATE GROUP SPEED (METRIC SYSTEM, NEW TABLE Feb 2026) ============
    # New base speeds (midpoints of the ranges confirmed by user):
    #   A pie — Lento: 17.5 | Normal: 22.5 | Forzado: 27.5 km/día
    #   A caballo — +40% SOBRE la velocidad a pie (en terreno permitido)
    # En terrenos que no permiten montar (difícil, muy difícil, desalentador) se
    # desmonta y se aplica la velocidad del personaje sin bonificación.
    # Speeds per race (metros): Dúnedain=10, Hombre/Elfo=9, Enano/Hobbit=7
    # Conversion: 2.5 km/day per meter of speed → 9m = 22.5 km/día (Normal)
    BASE_SPEED_METERS = 9  # Standard human
    BASE_KM_DAY = 22.5     # Normal midpoint
    KM_PER_METER_SPEED = 2.5  # 1m of speed = 2.5 km/día at Normal ritmo
    
    # Whether riding is allowed in this overall terrain (affects default speed calc)
    mount_allowed = terrain_config.get('permite_montura', True)
    
    # Determine the slowest speed in the group (considering mount allowance)
    tiene_monturas = sum(1 for m in config.miembros if m.tiene_montura)
    total_miembros = len(config.miembros) if config.miembros else 1
    porcentaje_monturas = tiene_monturas / total_miembros if total_miembros > 0 else 0
    
    if config.miembros:
        velocidades = []
        for m in config.miembros:
            vel_info = m.velocidad_efectiva(mount_allowed=mount_allowed)
            vel_efectiva = vel_info["velocidad"]
            km_dia_miembro = vel_efectiva * KM_PER_METER_SPEED
            # Velocidad sin estorbo: si va montado, la velocidad teórica
            # de la montura sin sobrecarga; si va a pie, su velocidad base.
            if m.tiene_montura and mount_allowed:
                vel_sin_estorbo = m.montura_velocidad if m.montura_velocidad > 0 else (m.velocidad_base * 1.40)
            else:
                vel_sin_estorbo = m.velocidad_base
            velocidades.append({
                "nombre": m.nombre,
                "velocidad_base": m.velocidad_base,
                "tiene_montura": m.tiene_montura,
                "montura_velocidad": m.montura_velocidad,
                "montura_sobrecargada": vel_info.get("montura_sobrecargada", False),
                "montura_carga_pct": vel_info.get("carga_pct", 0),
                "monta": vel_info.get("monta", False),
                "estorbo_metros": m.estorbo_metros,
                "velocidad_efectiva": vel_efectiva,
                "velocidad_sin_estorbo": vel_sin_estorbo,
                "km_por_dia": km_dia_miembro,
            })
        velocidad_grupo = min(v["velocidad_efectiva"] for v in velocidades)
        miembro_mas_lento = next(v["nombre"] for v in velocidades if v["velocidad_efectiva"] == velocidad_grupo)
        # Marca quién recibe +5 al cansancio: aquellos cuya velocidad SIN
        # estorbo es estrictamente mayor que la velocidad del grupo Y que
        # no son ellos mismos los estorbados (estorbo_metros >= 0). El
        # +5 compensa a los compañeros forzados a ir lento por culpa de
        # OTRO miembro estorbado.
        for v in velocidades:
            no_estorbado = (v.get("estorbo_metros", 0) or 0) >= 0
            v["bonus_fatiga"] = 5 if (v["velocidad_sin_estorbo"] > velocidad_grupo and no_estorbado) else 0
    else:
        velocidad_grupo = BASE_SPEED_METERS
        velocidades = []
        miembro_mas_lento = None
    
    km_por_dia_grupo = velocidad_grupo * KM_PER_METER_SPEED
    
    # Check if mounts are allowed in this terrain
    # (Already handled via velocidad_efectiva(mount_allowed=...) above)
    
    # Use pathfinder's estimated days if available (already accounts for terrain costs)
    # The pathfinder uses BASE_SPEED_KM_DAY = 36 km/day and terrain multipliers
    # We need to adjust based on actual group speed
    
    # Speed ratio: how much faster/slower is the group compared to base
    ratio_velocidad = km_por_dia_grupo / BASE_KM_DAY  # e.g., 27.5/22.5 = 1.22 for forzado
    
    # Ritmo modifier factors (relative to Normal base)
    RITMO_LENTO_FACTOR = 17.5 / 22.5   # ≈ 0.778 → slower (more days)
    RITMO_RAPIDO_FACTOR = 27.5 / 22.5  # ≈ 1.222 → faster (fewer days)
    
    # Ritmo Rápido partial adaptation (Point 4 confirmed by user):
    # Si el grupo elige Rápido pero el tipo de tierra no lo permite, el grupo
    # baja a Normal en ese tramo en vez de bloquear el viaje. Usamos una
    # aproximación global: si el ritmo es rápido y el tipo_tierra no lo permite,
    # aplicamos un factor intermedio (promedio de rápido y normal) en vez de
    # devolver error. La futura implementación segmentada permitirá un cálculo
    # exacto por tramo.
    rapido_no_permitido_global = False
    if config.ritmo == 'rapido' and not land_config.get('permite_ritmo_rapido', True):
        rapido_no_permitido_global = True
    
    if route_data.get('estimated_days_pathfinder'):
        # El pathfinder calcula "días" usando BASE_SPEED_KM_DAY=36 (5e RAW).
        # Hay que renormalizarlos a la velocidad real del grupo para obtener
        # los días que realmente tarda esta compañía. Además, los días no
        # pueden ser menos que distancia_física / velocidad_grupo (suelo
        # mínimo físico aunque la ruta sea casi todo carretera).
        PATHFINDER_BASE_KM_DAY = 36.0
        dias_terreno = (
            route_data['estimated_days_pathfinder'] * PATHFINDER_BASE_KM_DAY
        ) / max(0.1, km_por_dia_grupo)
        dias_distancia_fisica = (
            route_data.get('distance_km', 0) / max(0.1, km_por_dia_grupo)
        )
        dias_base = max(dias_terreno, dias_distancia_fisica)
        if config.ritmo == 'lento':
            dias_base = dias_base / RITMO_LENTO_FACTOR  # more days
        elif config.ritmo == 'rapido':
            if rapido_no_permitido_global:
                # Half the journey at fast, half at normal → midpoint factor
                avg_factor = (RITMO_RAPIDO_FACTOR + 1.0) / 2
                dias_base = dias_base / avg_factor
            else:
                dias_base = dias_base / RITMO_RAPIDO_FACTOR
    else:
        # Fallback to distance-based calculation (for direct line paths)
        distance_km = route_data['distance_km']
        if config.ritmo == 'lento':
            dias_base = distance_km / (km_por_dia_grupo * RITMO_LENTO_FACTOR)
        elif config.ritmo == 'rapido':
            if rapido_no_permitido_global:
                avg_factor = (RITMO_RAPIDO_FACTOR + 1.0) / 2
                dias_base = distance_km / (km_por_dia_grupo * avg_factor)
            else:
                dias_base = distance_km / (km_por_dia_grupo * RITMO_RAPIDO_FACTOR)
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
    
    # Expose casillas at outer scope (previously only set inside inner route_data builders)
    casillas = route_data.get('casillas') if isinstance(route_data, dict) else None
    if not casillas or casillas <= 0:
        casillas = max(1, round(route_data.get('distance_km', 0) / 16.0))

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
    # Optional arbitrary map coordinates (mirrors JourneyConfig)
    origen_x: Optional[float] = None
    origen_y: Optional[float] = None
    destino_x: Optional[float] = None
    destino_y: Optional[float] = None
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
    
    # Get locations (allow free map points via "custom:" id + explicit coords)
    start_loc = None
    end_loc = None
    if request.origen_id and not str(request.origen_id).startswith("custom:"):
        start_loc = await db.locations.find_one({"_id": request.origen_id})
    if request.destino_id and not str(request.destino_id).startswith("custom:"):
        end_loc = await db.locations.find_one({"_id": request.destino_id})

    async def _virtual_loc(x, y, nombre, fallback_id):
        all_l = await db.locations.find({}).to_list(length=None)
        nearest = None
        best = float('inf')
        for l in all_l:
            lx = l.get('x'); ly = l.get('y')
            if lx is None or ly is None:
                continue
            d = (lx - x) ** 2 + (ly - y) ** 2
            if d < best:
                best = d
                nearest = l
        return {
            "_id": fallback_id or f"custom:{x},{y}",
            "nombre": nombre or "Punto en el mapa",
            "x": x,
            "y": y,
            "region": (nearest.get('region') if nearest else 'Eriador'),
            "clase_region": (nearest.get('clase_region') if nearest else 'tierras_salvajes'),
            "tipo_tierra": (nearest.get('tipo_tierra') if nearest else 'tierras_salvajes'),
        }

    if not start_loc and request.origen_x is not None and request.origen_y is not None:
        start_loc = await _virtual_loc(
            request.origen_x, request.origen_y, request.origen_nombre, request.origen_id,
        )
    if not end_loc and request.destino_x is not None and request.destino_y is not None:
        end_loc = await _virtual_loc(
            request.destino_x, request.destino_y, request.destino_nombre, request.destino_id,
        )

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
        
        # Calculate days based on rhythm. El pathfinder calcula los días con
        # BASE_SPEED_KM_DAY=36 (5e RAW), pero para una compañía humana normal
        # la velocidad media son ~22.5 km/día. Renormalizamos y aplicamos un
        # mínimo basado en la distancia física.
        PATHFINDER_BASE_KM_DAY = 36.0
        GROUP_BASE_KM_DAY = 22.5  # ritmo Normal humano
        dias_terreno = path_result.estimated_days * PATHFINDER_BASE_KM_DAY / GROUP_BASE_KM_DAY
        dias_fisicos = path_result.total_distance_km / GROUP_BASE_KM_DAY
        dias_base = max(dias_terreno, dias_fisicos)
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
    estacion: str = "verano",
    tipo_via: Optional[str] = None,
):
    """
    Generate a single travel event with dice rolls.
    Returns event type, objective, and CD for resolution.

    `tipo_via` (opcional) indica si la casilla del evento está en
    camino, sendas o campo abierto; si se proporciona, tiene PRIORIDAD
    sobre `terreno` para decidir la CD de la prueba (regla:
    camino → CD 10, campo abierto → CD 15, difícil → CD 20).
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

    # Compute event-resolution CD per the rulebook:
    #   CAMINO        → CD 10
    #   CAMPO ABIERTO → CD 15
    #   TERRENO DIFÍCIL (any "dificil" variant) → CD 20
    #
    # Si el frontend envía `tipo_via` (per-casilla / dominante de la
    # ruta), tiene PRIORIDAD: refleja mejor la realidad del segmento
    # que el `terreno` topográfico (ej. una ruta plana "fácil" puede
    # ir POR CAMINO, en cuyo caso la CD debe ser 10, no 15).
    via_lower = (tipo_via or "").lower()
    t_lower = (terreno or "").lower()

    ROAD_TIPOS = {
        "camino_real", "gran_camino", "camino_mayor", "camino_menor",
        "sendas", "senda", "sendero",
    }
    DIFICIL_TIPOS = {"terreno_dificil", "muy_dificil", "desalentador"}

    if via_lower in ROAD_TIPOS or "camino" in via_lower or "senda" in via_lower:
        cd_prueba = 10
        terreno_categoria = "camino"
    elif via_lower in DIFICIL_TIPOS or "dificil" in via_lower:
        cd_prueba = 20
        terreno_categoria = "dificil"
    elif "camino" in t_lower or t_lower in ("gran_camino", "camino_mayor", "camino_menor", "sendas"):
        cd_prueba = 10
        terreno_categoria = "camino"
    elif "dificil" in t_lower or t_lower in DIFICIL_TIPOS:
        cd_prueba = 20
        terreno_categoria = "dificil"
    else:
        # Default to "campo abierto"
        terrain_config = next((t for t in terrains if t['tipo'] == terreno), None)
        cd_prueba = 15 if not terrain_config else (terrain_config.get('cd_prueba_evento') or 15)
        terreno_categoria = "campo_abierto"

    # Check season disadvantage for saves AND the event resolution check
    es_invierno_otono = estacion in ['invierno', 'otono', 'otoño']

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
        "terreno_categoria": terreno_categoria,
        "cd_prueba": cd_prueba,
        "desventaja_estacion": bool(es_invierno_otono),
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
    bonus_montura_con: int = 0,
    penalizacion_multiples_papeles: bool = False
):
    """
    Calcula la tirada de salvación de Constitución contra Fatiga.

    Según reglas confirmadas (LOTR 5e):
    - 1 TS de CON al final de cada jornada (y cuando haya exigencias extra).
    - CD base por terreno: 10 caminos / 15 campo abierto / 20 terreno difícil
      (se espera recibida ya calculada y acumulada en `cd_acumulada`).
    - Si el personaje tiene múltiples papeles asumidos: -5 a la tirada.
    - Si falla la TS → el personaje gana EXACTAMENTE +1 nivel de cansancio,
      independientemente del margen de fallo.
    - Si supera la CD → no gana cansancio, sin importar cuánta CD haya acumulada.
    """
    # Bonus de montura (si se usa 50%+ del viaje)
    porcentaje_montura = dias_con_montura / dias_totales if dias_totales > 0 else 0
    bonus_montura = bonus_montura_con if porcentaje_montura >= 0.5 else 0

    penalizacion_papeles = -5 if penalizacion_multiples_papeles else 0

    tirada = roll_d20()
    total = tirada + modificador_constitucion + bonus_montura + penalizacion_papeles

    if total >= cd_acumulada:
        niveles_cansancio = 0
        resultado = "éxito"
    else:
        niveles_cansancio = 1
        resultado = "fracaso"

    return {
        "personaje": personaje_nombre,
        "tirada": {
            "d20": tirada,
            "modificador_con": modificador_constitucion,
            "bonus_montura": bonus_montura,
            "penalizacion_multiples_papeles": penalizacion_papeles,
            "total": total
        },
        "cd": cd_acumulada,
        "resultado": resultado,
        "niveles_cansancio": niveles_cansancio,
        "detalles": {
            "porcentaje_montura": round(porcentaje_montura * 100),
            "montura_aplicada": porcentaje_montura >= 0.5,
            "regla": "Fallo = +1 nivel de cansancio (exacto). Éxito = 0."
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
    
    # CD base de Fatiga según terreno (LOTR 5e: 10 caminos / 15 campo abierto / 20 terreno difícil)
    terreno_viaje = (calc_result.get('ruta', {}).get('terreno') or 'moderado').lower()
    if terreno_viaje in ('muy_dificil', 'desalentador', 'montanas', 'pantano', 'pantanos', 'dificil'):
        cd_base = 20
    elif terreno_viaje in ('facil', 'camino', 'caminos'):
        cd_base = 10
    else:
        cd_base = 15
    
    journey = ActiveJourney(
        config=config,
        casillas_totales=calc_result['ruta']['casillas'],
        fatiga_cd_total=float(cd_base)
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
    """Mark journey as complete and calculate final results.

    Side effect: actualiza `ubicacion_actual` de cada personaje participante al
    destino del viaje, denormalizando los campos clave de la location para que
    el frontend pueda renderizar el "estás aquí" sin un round-trip extra.
    """
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")

    await db.active_journeys.update_one(
        {"id": journey_id},
        {"$set": {"completado": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Auto-actualizar la ubicación de los miembros al destino del viaje.
    # Si no hay destino_id en config (custom waypoint) se persiste un snapshot
    # mínimo construido a partir del nombre + coordenadas para que la UI pueda
    # mostrar al menos el nombre del lugar como "estás aquí".
    arrived = []
    try:
        config = journey.get("config") or {}
        miembros = config.get("miembros") or []
        destino_id = config.get("destino_id")
        destino_nombre = config.get("destino_nombre")

        ubicacion_payload = None
        if destino_id and not str(destino_id).startswith("custom:"):
            loc = await db.locations.find_one({"_id": destino_id}) or \
                  await db.locations.find_one({"id": destino_id})
            if loc:
                ubicacion_payload = {
                    "id": loc.get("id") or loc.get("_id"),
                    "nombre": loc.get("nombre"),
                    "region": loc.get("region"),
                    "tipo": loc.get("tipo"),
                    "x": loc.get("x"),
                    "y": loc.get("y"),
                    "tipo_tierra": loc.get("tipo_tierra") or loc.get("clase_region"),
                    "terreno": loc.get("terreno"),
                }
        if ubicacion_payload is None and destino_nombre:
            ubicacion_payload = {
                "id": destino_id or f"custom:{destino_nombre}",
                "nombre": destino_nombre,
                "region": None,
                "tipo": "custom",
                "x": config.get("destino_x"),
                "y": config.get("destino_y"),
            }

        if ubicacion_payload and miembros:
            # El modelo TravelPartyMember usa `personaje_id`, pero algunos
            # journeys legacy guardan `id`. Aceptamos ambos para no perder
            # ningún miembro al sincronizar la ubicación final.
            character_ids = [
                m.get("personaje_id") or m.get("id") or m.get("character_id")
                for m in miembros
            ]
            character_ids = [cid for cid in character_ids if cid]
            if character_ids:
                await db.characters.update_many(
                    {"_id": {"$in": character_ids}},
                    {"$set": {
                        "ubicacion_actual": ubicacion_payload,
                        "updated_at": datetime.now(timezone.utc),
                    }},
                )
                arrived = character_ids
    except Exception as e:
        # No bloquear el cierre del viaje si falla la actualización de ubicación
        print(f"[complete_journey] aviso: no se pudo actualizar ubicación de miembros: {e}")

    return {
        "success": True,
        "ubicacion_actualizada": bool(arrived),
        "personajes_movidos": arrived,
        "resumen": {
            "dias_totales": journey.get('dia_actual', 1) - 1 + journey.get('dias_extra', 0) - journey.get('dias_reducidos', 0),
            "casillas_recorridas": journey.get('casillas_recorridas', 0),
            "fatiga_cd_final": journey.get('fatiga_cd_total', 10),
            "px_total": journey.get('px_acumulados', 0),
            "eventos_totales": sum(len(d.get('eventos', [])) for d in journey.get('dias', []))
        }
    }


class ArrivalRequest(BaseModel):
    """Endpoint genérico para cuando un viaje finaliza fuera del flujo
    `journey/{id}/complete` (p.ej. modo global automatizado que no crea
    `active_journey`)."""
    character_ids: List[str]
    destination_id: Optional[str] = None
    destination_nombre: Optional[str] = None
    destination_x: Optional[float] = None
    destination_y: Optional[float] = None


@router.post("/arrival")
async def register_arrival(req: ArrivalRequest):
    """Actualiza `ubicacion_actual` de los personajes al destino tras un viaje
    sin `active_journey` (p.ej. el modo global automatizado)."""
    if not req.character_ids:
        return {"success": True, "personajes_movidos": []}

    ubicacion_payload = None
    if req.destination_id and not str(req.destination_id).startswith("custom:"):
        loc = await db.locations.find_one({"_id": req.destination_id}) or \
              await db.locations.find_one({"id": req.destination_id})
        if loc:
            ubicacion_payload = {
                "id": loc.get("id") or loc.get("_id"),
                "nombre": loc.get("nombre"),
                "region": loc.get("region"),
                "tipo": loc.get("tipo"),
                "x": loc.get("x"),
                "y": loc.get("y"),
                "tipo_tierra": loc.get("tipo_tierra") or loc.get("clase_region"),
                "terreno": loc.get("terreno"),
            }
    if ubicacion_payload is None and req.destination_nombre:
        ubicacion_payload = {
            "id": req.destination_id or f"custom:{req.destination_nombre}",
            "nombre": req.destination_nombre,
            "region": None,
            "tipo": "custom",
            "x": req.destination_x,
            "y": req.destination_y,
        }

    if not ubicacion_payload:
        raise HTTPException(status_code=400, detail="Destino no resoluble")

    await db.characters.update_many(
        {"_id": {"$in": req.character_ids}},
        {"$set": {
            "ubicacion_actual": ubicacion_payload,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return {
        "success": True,
        "ubicacion": ubicacion_payload,
        "personajes_movidos": req.character_ids,
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


@router.patch("/journey/{journey_id}/fatigue-cd")
async def patch_journey_fatigue_cd(journey_id: str, delta: float = 0, reason: str = ""):
    """Apply an in-flight delta to the live fatigue CD of an active journey.

    Used when an event mid-journey modifies the CD (e.g. Percance failure
    raises it by +2). Returns the updated `fatiga_cd_total`.
    """
    journey = await db.active_journeys.find_one({"id": journey_id}, {"_id": 0})
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    new_cd = float(journey.get("fatiga_cd_total", 10.0)) + float(delta)
    if new_cd < 10.0:
        new_cd = 10.0
    await db.active_journeys.update_one(
        {"id": journey_id},
        {
            "$set": {"fatiga_cd_total": new_cd},
            "$push": {
                "fatiga_cd_log": {
                    "delta": float(delta),
                    "reason": reason,
                    "ts": datetime.now(timezone.utc).isoformat(),
                }
            },
        },
    )
    return {"success": True, "fatiga_cd_total": new_cd}


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
    decrement = max(0.0, float(data.fatiga_cd_decrement))
    new_cd = max(10.0, round((current_cd - decrement) * 2) / 2)

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
    dias_totales: int = 1,
    notas_maestro: str = "",
    clima: str = ""
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
            system_message="""Eres el narrador del grupo. Escribes notas cortas (2-3 frases) en español, en tono cercano tipo Tolkien pero NATURAL — como un compañero de viaje contando lo sucedido al volver. NUNCA pedante.

REGLAS DE PERSONAJES:
- Refiérete al personaje SOLO por su NOMBRE DE PILA. NUNCA uses apellido.
- NO repitas el papel ('nuestro vigía', 'el atento explorador'). Su papel se sobrentiende del contexto del viaje.
- Ejemplos: 'Folgo se adelantó al sendero' (SÍ). 'Folgo Rizocastaño, nuestro vigía de ojos avizores' (NO).

REGLAS DE AMBIENTACIÓN (Tolkien):
- Si la región es reconocible (Comarca, Bree, Eriador, Cardolan, Bosque Negro, Rhovanion, Rohan, Gondor, etc.), describe el paisaje COMO LO ES en la obra de Tolkien. La Comarca = praderas, smials, ríos serenos. El camino entre Bree y Tharbad = brezales yermos, ruinas del antiguo Reino del Norte. NO inventes paisajes genéricos.

REGLAS DE CLIMA:
- Si se proporciona un clima, INTÉGRALO en una pincelada breve — sin cifras. 'la lluvia ligera', 'el cielo despejado', 'una bruma helada' — sí. '15mm', '12°C' — no.

PROHIBIDO:
- 'épico', 'glorioso', 'valeroso', 'magnánimo'.
- Emojis.
- Mencionar tiradas, dados, CDs.
- Mencionar origen ni destino del viaje completo (céntrate en el momento)."""
        ).with_model("openai", "gpt-4o")
        
        # Use only first name in the narrative
        primer_nombre = (personaje_nombre or "").split()[0] if personaje_nombre else "el compañero"
        
        prompt = f"""Genera una breve narrativa (2-3 frases) para este evento de viaje:

FASE DEL VIAJE: {fase_viaje} (día {dia_actual} de {dias_totales})
TERRENO ACTUAL: {terreno_desc}
EVENTO: {evento_nombre}
RESULTADO: {"El grupo tuvo éxito" if exito else "Las cosas no salieron bien"}
PERSONAJE RESPONSABLE: {primer_nombre} (papel: {papel_name} — NO menciones el papel en el texto)
CONSECUENCIA: {consecuencia}
{f"NOTAS DEL MAESTRO (contexto real, intégralas): {notas_maestro}" if notas_maestro else ""}
{f"CLIMA DE ESE DÍA (mencionar de pasada, sin números): {clima}" if clima else ""}

Describe qué sucedió de forma natural y sencilla, como si lo contaras junto al fuego. Usa SOLO el nombre de pila '{primer_nombre}'."""
        
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


# ============== DAY LOG — DIARIO DE VIAJE UNIFICADO ==============

class DayLogRequest(BaseModel):
    """Solicita la narrativa unificada de una jornada de viaje."""
    dia_numero: int
    dias_totales: int = 1
    terreno: str = "campo_abierto"
    tipo_tierra: str = "tierras_salvajes"
    origen: Optional[str] = None
    destino: Optional[str] = None
    # Personajes con papeles y sus niveles de fatiga del día
    personajes: List[Dict[str, Any]] = []
    # Tirada de orientación del día (opcional)
    orientacion: Optional[Dict[str, Any]] = None
    # Eventos resueltos ese día (con sus notas del maestro y narrativas individuales)
    eventos: List[Dict[str, Any]] = []
    # Resultados de TS de Fatiga de ese día (opcional)
    tiradas_fatiga: List[Dict[str, Any]] = []
    # Si el grupo acampó ese día
    acampada: Optional[Dict[str, Any]] = None
    # Clima del día (preparado para el sistema futuro)
    clima: Optional[str] = None
    # Continuidad: resumen del día anterior (opcional)
    dia_anterior_resumen: Optional[str] = None
    # Notas globales del maestro para el día (extra, si quiere añadir algo fuera de tiradas)
    notas_maestro_dia: Optional[str] = None


@router.post("/generate-day-log")
async def generate_day_log(request: DayLogRequest):
    """
    Genera un párrafo narrativo unificado para una jornada concreta del viaje,
    tejiendo orientación, eventos, notas del Maestro, tiradas de fatiga y clima.

    El clima se integra de forma orgánica (p. ej. "la lluvia que lleva cayendo
    desde el mediodía ha embarrado el camino…") no como mero enunciado.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"success": False, "error": "No API key configured", "narrative": ""}

        # Construir contexto
        fase = "al comienzo del viaje" if request.dia_numero <= request.dias_totales * 0.25 \
            else "a media travesía" if request.dia_numero <= request.dias_totales * 0.5 \
            else "avanzado el viaje" if request.dia_numero <= request.dias_totales * 0.75 \
            else "cerca del final del viaje"

        # Orientación
        orientacion_txt = ""
        if request.orientacion:
            o = request.orientacion
            exito_o = o.get('exito', False)
            orientacion_txt = (
                f"\n- Tirada de orientación del guía: d20={o.get('d20','?')} "
                f"total={o.get('total','?')} vs CD 15 "
                f"({'éxito' if exito_o else 'fallo'}). {o.get('detalle','')}"
            )
            if o.get('gm_notes'):
                orientacion_txt += f"\n  Contexto del Maestro: {o['gm_notes']}"

        # Eventos
        eventos_txt = ""
        for i, e in enumerate(request.eventos, 1):
            nombre = e.get('nombre') or e.get('evento', {}).get('nombre') or 'evento sin nombre'
            tirada = e.get('tirada', '?')
            cd = e.get('cd') or e.get('resolucion', {}).get('cd', '?')
            exito_e = e.get('exito', False)
            personaje = e.get('personaje') or e.get('objetivo', {}).get('papel', '')
            eventos_txt += (
                f"\n- Evento {i}: {nombre} (tirada {tirada} vs CD {cd}, "
                f"{'éxito' if exito_e else 'fallo'}{', responsable: '+personaje if personaje else ''})."
            )
            if e.get('gm_notes'):
                eventos_txt += f"\n  Notas del Maestro: {e['gm_notes']}"
            if e.get('narrativa'):
                eventos_txt += f"\n  Narrativa previa: {e['narrativa']}"

        # Fatiga
        fatiga_txt = ""
        for tf in request.tiradas_fatiga:
            nombre = tf.get('personaje', '?')
            d20 = tf.get('tirada', {}).get('d20') if isinstance(tf.get('tirada'), dict) else tf.get('d20', '?')
            total = tf.get('tirada', {}).get('total') if isinstance(tf.get('tirada'), dict) else tf.get('total', '?')
            cd_f = tf.get('cd', '?')
            resultado = tf.get('resultado', '?')
            niveles = tf.get('niveles_cansancio', 0)
            fatiga_txt += (
                f"\n- {nombre}: TS Fatiga d20={d20} total={total} vs CD {cd_f} → "
                f"{resultado}"
                f"{' (+1 cansancio)' if niveles > 0 else ''}."
            )

        # Acampada
        acampada_txt = ""
        if request.acampada:
            a = request.acampada
            acampada_txt = f"\n- El grupo acampa. Centinela: {a.get('centinela','ninguno')}. "
            if a.get('resultados'):
                for r in a['resultados']:
                    acampada_txt += f" {r.get('nombre','')}: -{r.get('reduccion',0)} cansancio."
            if a.get('eventos_nocturnos'):
                acampada_txt += f" Eventos nocturnos: {len(a['eventos_nocturnos'])}."

        personajes_txt = ", ".join([
            f"{p.get('nombre','?')}" + (f" ({p.get('papel','')})" if p.get('papel') else '')
            for p in request.personajes
        ]) or "el grupo"

        clima_txt = f"\n- Clima del día: {request.clima}" if request.clima else ""
        notas_dia_txt = f"\n- Notas globales del Maestro: {request.notas_maestro_dia}" if request.notas_maestro_dia else ""
        anterior_txt = f"\n- Continuación del día anterior: {request.dia_anterior_resumen}" if request.dia_anterior_resumen else ""

        system_msg = (
            "Eres el cronista del grupo que escribe un 'Diario de Viaje' estilo Tolkien/Tierra Media "
            "en español, pero con lenguaje natural y accesible (nada arcaico ni épico exagerado). "
            "Escribe un ÚNICO párrafo (4-7 frases) para la jornada concreta descrita, tejiendo los "
            "hechos (orientación, eventos, notas del maestro, fatiga, acampada) en una prosa fluida. "
            "IMPORTANTE sobre el CLIMA: NO te limites a mencionarlo, INTÉGRALO ORGÁNICAMENTE en el "
            "relato para que afecte a la acción (p. ej. 'la lluvia que lleva cayendo desde el mediodía "
            "ha embarrado el camino y complicado cada paso…', 'el frío muerde los dedos del cazador', "
            "'la niebla confunde al guía y apenas distingue las marcas del sendero'). "
            "Las Notas del Maestro son CONTEXTO real que debes usar (nombre del lugar, condiciones "
            "específicas, detalles). No uses emojis. No menciones estadísticas de dado. "
            "No repitas 'Día X' al principio, céntrate en lo narrativo."
        )

        prompt = (
            f"JORNADA {request.dia_numero} de {request.dias_totales} ({fase})\n"
            f"GRUPO: {personajes_txt}\n"
            f"TERRENO: {request.terreno} — {request.tipo_tierra}"
            f"{orientacion_txt}"
            f"{eventos_txt}"
            f"{fatiga_txt}"
            f"{acampada_txt}"
            f"{clima_txt}"
            f"{notas_dia_txt}"
            f"{anterior_txt}\n\n"
            f"Escribe ahora el párrafo del diario para esta jornada."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"daylog_{uuid.uuid4().hex[:8]}",
            system_message=system_msg,
        ).with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=prompt))

        return {
            "success": True,
            "dia": request.dia_numero,
            "narrative": response,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "narrative": "",
        }


# ============== FULL CHRONICLE — TEXTO NARRATIVO UNIFICADO ==============

class FullChronicleRequest(BaseModel):
    """Genera una crónica continua de todo el viaje como texto narrativo único."""
    origen: Optional[str] = None
    destino: Optional[str] = None
    fecha_salida: Optional[str] = None  # ej: "1 de Cermië"
    kilometros: Optional[float] = None
    dias_totales: int = 1
    personajes: List[Dict[str, Any]] = []
    # Lista de jornadas con todo lo sucedido
    jornadas: List[Dict[str, Any]] = []
    # Clima general / clima por día (se integrará cuando exista el sistema de clima)
    clima_por_dia: Optional[Dict[str, str]] = None
    # Sistema de clima vivo (Iteración 57+): día por día, ya rodado
    weather_log: Optional[List[Dict[str, Any]]] = None


@router.post("/generate-full-chronicle")
async def generate_full_chronicle(request: FullChronicleRequest):
    """
    Crea un ÚNICO texto narrativo continuo que cuenta todo el viaje de forma
    fluida, estilo crónica de aventura: introducción (quién viaja, de dónde a
    dónde, fecha, kilómetros, jornadas), cuerpo (hilvanando jornadas clave con
    frases como "al tercer día…", "en la quinta jornada…"), y cierre
    (llegada al destino).
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"success": False, "error": "No API key configured", "chronicle": ""}

        personajes_txt = ", ".join([
            f"{p.get('nombre','?')}" + (f" ({p.get('papel','')})" if p.get('papel') else '')
            for p in request.personajes
        ]) or "el grupo de aventureros"

        jornadas_txt_parts = []
        for j in request.jornadas:
            dia = j.get('dia_numero', '?')
            lineas = [f"JORNADA {dia}:"]
            if j.get('orientacion'):
                o = j['orientacion']
                lineas.append(
                    f"  Orientación: d20={o.get('d20','?')} total={o.get('total','?')} vs CD 15 "
                    f"({'éxito' if o.get('exito') else 'fallo'}). {o.get('detalle','')}"
                )
                if o.get('gm_notes'):
                    lineas.append(f"  Notas del maestro: {o['gm_notes']}")
            for i, e in enumerate(j.get('eventos', []), 1):
                ev_nombre = e.get('nombre') or '(evento)'
                lineas.append(
                    f"  Evento {i}: {ev_nombre} — tirada {e.get('tirada','?')} vs CD {e.get('cd','?')} "
                    f"({'éxito' if e.get('exito') else 'fallo'})."
                )
                if e.get('gm_notes'):
                    lineas.append(f"    Notas del maestro: {e['gm_notes']}")
                if e.get('narrativa'):
                    lineas.append(f"    Narrativa previa: {e['narrativa']}")
            if j.get('tiradas_fatiga'):
                for tf in j['tiradas_fatiga']:
                    niveles = tf.get('niveles_cansancio', 0)
                    if niveles > 0:
                        lineas.append(f"  Fatiga: {tf.get('personaje','?')} gana +1 nivel de cansancio.")
            if request.clima_por_dia and str(dia) in request.clima_por_dia:
                lineas.append(f"  Clima: {request.clima_por_dia[str(dia)]}")
            jornadas_txt_parts.append("\n".join(lineas))

        jornadas_block = "\n\n".join(jornadas_txt_parts) if jornadas_txt_parts else "(Sin jornadas registradas.)"

        # ── Bloque de clima detallado (sistema de clima vivo) ──
        weather_block = ""
        weather_log_block = ""
        if request.weather_log:
            weather_lines = []
            log_lines_compact = []
            for w in request.weather_log:
                # Línea compacta para el LOG técnico (PDF)
                log_lines_compact.append(w.get("log_line") or
                    f"Día {w.get('dia','?')} — {w.get('region','')} {w.get('icon','')} {w.get('estado_label','')} · "
                    f"{w.get('temp_min','?')}°→{w.get('temp_max','?')}° · viento {w.get('viento_kmh','?')}km/h"
                )
                # Línea expandida para alimentar a la IA con contexto
                anomalo = " (día anómalo)" if w.get("anomalo") else ""
                weather_lines.append(
                    f"  Día {w.get('dia','?')}: {w.get('region','?')} — "
                    f"{w.get('estado_label','?')}{anomalo}, "
                    f"{w.get('temp_min','?')}° a {w.get('temp_max','?')}° (media {w.get('temp_dia','?')}°), "
                    f"viento {w.get('viento_kmh','?')}km/h {w.get('dir_viento','') or ''}, "
                    f"sol {w.get('horas_sol_efectivas','?')}h"
                    + (f", {w.get('precipitacion_mm','?')}mm precip." if (w.get('precipitacion_mm') or 0) > 0 else '')
                )
            weather_block = "CLIMA POR DÍA (referencia para la narrativa):\n" + "\n".join(weather_lines) + "\n\n"
            weather_log_block = "\n".join(log_lines_compact)

        system_msg = (
            "Eres un narrador del grupo que escribe una crónica de viaje continua, en español, "
            "como si fuese el diario de uno de los viajeros, escrito al volver. El tono debe ser "
            "tipo Tolkien pero NATURAL Y CERCANO, NO pedante ni recargado. Evita palabras "
            "rebuscadas, latiguillos épicos y adornos innecesarios. Imagina a Sam Gamyi contando "
            "el viaje a sus hijos: hermoso pero claro.\n\n"
            "PERSONAJES — IMPORTANTE:\n"
            "- En el PRIMER párrafo, presenta a los viajeros con nombre+papel UNA sola vez "
            "(ej. 'Aragorn, el guía; Folgo, el vigía; …'). \n"
            "- A partir de ahí, refiérete a ellos SOLO POR SU NOMBRE DE PILA (sin apellidos, "
            "sin volver a indicar su papel). 'Folgo se adelantó al sendero' — SÍ. "
            "'Folgo Rizocastaño, nuestro atento vigía, se adelantó…' — NO.\n\n"
            "AMBIENTACIÓN BASADA EN TOLKIEN:\n"
            "- Si el viaje pasa por regiones reconocibles (Comarca, Eriador, Bree, Tharbad, "
            "Rhovanion, Rohan, Gondor, Mordor, Bosque Negro, Lothlórien, etc.), describe el "
            "paisaje TAL COMO ES en la obra de Tolkien. NO inventes paisajes genéricos. "
            "Ejemplo: 'la Comarca' = praderas verdes, smials hobbit, ríos serenos. "
            "'Camino del Norte hacia Tharbad' = ruina de un viejo Reino del Norte, brezales "
            "yermos, rastros del Camino Norte. NO conviertas la Comarca en un páramo.\n\n"
            "ESTRUCTURA:\n"
            "1. PÁRRAFO INICIAL: presenta brevemente quiénes viajan (nombre+papel UNA vez), "
            "el origen, el destino y la fecha si se indica. Sin estadísticas.\n"
            "2. CUERPO: hila las jornadas con transiciones suaves ('al tercer día…', "
            "'aquella tarde…', 'la noche del séptimo día…'). Selecciona los eventos "
            "significativos, integra las notas del Maestro como contexto real (lugares, "
            "circunstancias) y haz que el clima asome SUAVE Y BREVE — no como protagonista. "
            "Una mención por jornada basta ('el frío se hizo más áspero', 'la lluvia fina daba "
            "tregua a ratos'). NO uses cifras ni tecnicismos meteorológicos.\n"
            "3. PÁRRAFO FINAL: la llegada, en una o dos frases evocadoras.\n\n"
            "REGLAS ESTRICTAS:\n"
            "- No emojis.\n"
            "- No números (d20, CD, °C, mm, km/h, %).\n"
            "- No encabezados ni listas; solo prosa en párrafos.\n"
            "- 4–7 párrafos. Lenguaje accesible.\n"
            "- Evita 'glorioso', 'épico', 'valeroso', 'magnánimo'. Mejor: 'cansados pero firmes', "
            "'el corazón un poco más ligero', 'sin más prisa que la del camino'.\n"
            "- Si en las notas aparecen nombres concretos (Bosque de los Trolls, El Vado, etc.), "
            "úsalos.\n"
        )

        prompt = (
            f"DATOS DEL VIAJE\n"
            f"Viajeros: {personajes_txt}\n"
            f"Trayecto: {request.origen or '?'} → {request.destino or '?'}\n"
            + (f"Fecha de salida: {request.fecha_salida}\n" if request.fecha_salida else '')
            + (f"Kilómetros aproximados: {int(request.kilometros)}\n" if request.kilometros else '')
            + f"Jornadas previstas: {request.dias_totales}\n\n"
            + weather_block
            + f"ACONTECIMIENTOS POR JORNADA:\n{jornadas_block}\n\n"
            f"Escribe ahora la crónica unificada del viaje."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"chronicle_{uuid.uuid4().hex[:8]}",
            system_message=system_msg,
        ).with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=prompt))

        return {
            "success": True,
            "chronicle": response,
            "weather_log": weather_log_block,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "chronicle": "",
        }


class JourneySummaryRequest(BaseModel):
    origen: str
    destino: str
    dias: int
    eventos: List[Dict[str, Any]] = []
    clima_por_dia: List[Dict[str, Any]] = []
    personajes: List[Dict[str, Any]] = []
    px_total: int = 0
    terrenos: Dict[str, float] = None
    heridos: List[Dict[str, Any]] = []  # personajes que cayeron a 0 PG durante el viaje
    solo_traveler: bool = False  # Un único viajero (todos los papeles a uno)
    miembro_sobrecargado: Optional[Dict[str, Any]] = None  # {nombre, papeles} si alguien lleva 3+ papeles

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
        
        # Build event summary — incluye clima del día y narrativa individual
        # ya generada para que la crónica final encaje 100% con cada evento.
        eventos_text = ""
        for i, e in enumerate(request.eventos, 1):
            resultado = "ÉXITO" if e.get('exito') else "FRACASO"
            clima = e.get('clima') or ''
            consecuencia = e.get('consecuencia') or ''
            narrativa = e.get('narrativa_individual') or ''
            eventos_text += f"\n  - Día {e.get('dia', i)}: {e.get('nombre', 'Evento')} - {resultado}"
            if clima:
                eventos_text += f" [Clima: {clima}]"
            if consecuencia:
                eventos_text += f"\n      Consecuencia: {consecuencia}"
            if narrativa:
                eventos_text += f"\n      Narrativa breve: \"{narrativa}\""
        
        # Build day-by-day weather summary
        clima_text = ""
        for c in request.clima_por_dia or []:
            clima_text += f"\n  - Día {c.get('dia')}: {c.get('estado', '')} ({c.get('region', '')})"
        
        # Build party summary
        grupo_text = ", ".join([f"{p.get('nombre')} ({p.get('papel', 'viajero')})" for p in request.personajes])
        
        # Build terrain summary
        terreno_text = ""
        if request.terrenos:
            for terrain, km in request.terrenos.items():
                terreno_text += f"\n  - {terrain}: {km:.1f} km"
        
        # Build casualty summary (personajes que cayeron a 0 PG)
        heridos_text = ""
        if request.heridos:
            for h in request.heridos:
                dia_h = h.get('dia') or h.get('casilla') or '?'
                evento_h = h.get('evento') or 'un acontecimiento'
                heridos_text += f"\n  - {h.get('nombre', 'Un viajero')} cayó a 0 PG en el día {dia_h} ({evento_h})"

        chat = LlmChat(
            api_key=api_key,
            session_id=f"summary_{uuid.uuid4().hex[:8]}",
            system_message="""Eres un narrador que escribe relatos de viajes por la Tierra Media.
            Escribe en español con un tono cálido y natural, como si contaras la historia junto a una chimenea.
            Evita el lenguaje arcaico y épico excesivo. Sé descriptivo pero accesible.
            NO menciones puntos de experiencia, tiradas, ni mecánicas de juego.
            DEBES respetar EXACTAMENTE el clima de cada día indicado y los acontecimientos en el orden y desenlace dados.
            Cuando referencias un evento, usa el mismo clima que ya consta para ese día (no inventes otro tiempo).
            Reutiliza las narrativas individuales si están disponibles, integrándolas con cohesión.
            Estructura tu relato con naturalidad: cómo empezó el viaje, qué pasó en el camino, y cómo llegaron.
            Si hay HERIDOS GRAVES (personajes que cayeron a 0 PG), narra explícitamente cómo y dónde ocurrió,
            quién quedó inconsciente, cómo lo cargaron sus compañeros (en montura, a hombros) y en qué estado
            llegaron al destino. NO inventes salvaciones ni curaciones que no se hayan rodado.
            REGLA DE NÚMERO GRAMATICAL: si el campo VIAJE_EN_SOLITARIO es 'sí', el viajero está totalmente solo;
            usa SIEMPRE la tercera persona del singular ('viajaba', 'avanzaba', 'él/ella'), NO uses 'la compañía',
            'el grupo', 'los viajeros', ni plurales colectivos. Si hay un MIEMBRO SOBRECARGADO con varios papeles,
            menciona en algún momento la fatiga acumulada por asumir tantos roles a la vez (guía, cazador, vigía,
            explorador). Máximo 400 palabras. No uses emojis."""
        ).with_model("openai", "gpt-4o")

        solo_text = "sí" if request.solo_traveler else "no"
        sobrecarga_text = ""
        if request.miembro_sobrecargado:
            n = request.miembro_sobrecargado.get("papeles") or 0
            nombre = request.miembro_sobrecargado.get("nombre") or "El viajero"
            sobrecarga_text = f"\nMIEMBRO SOBRECARGADO: {nombre} cargaba {n} papeles a la vez (peso del viaje en sus hombros)."

        prompt = f"""Escribe el relato de este viaje:

VIAJE: De {request.origen} a {request.destino}
DURACIÓN: {request.dias} días
COMPAÑÍA: {grupo_text if grupo_text else "Un grupo de viajeros"}
VIAJE_EN_SOLITARIO: {solo_text}{sobrecarga_text}
TERRENOS: {terreno_text if terreno_text else "Caminos y sendas de la Tierra Media"}
CLIMA POR DÍA: {clima_text if clima_text else "(no disponible)"}
ACONTECIMIENTOS: {eventos_text if eventos_text else "El viaje fue tranquilo"}
HERIDOS GRAVES (cayeron a 0 PG): {heridos_text if heridos_text else "Ninguno — todos llegan en pie"}

Narra el viaje de forma natural, como si se lo contaras a alguien. Respeta el clima exacto de cada día (NO inventes otro), describe el paisaje y los momentos importantes. Si hay narrativas individuales arriba, intégralas. {"USA SIEMPRE EL SINGULAR (es un viaje en solitario): el viajero, él/ella, no menciones grupo ni compañía." if request.solo_traveler else ""} {"INTEGRA EXPLÍCITAMENTE el desenlace de los heridos en la narración: cuándo cayó cada uno, cómo lo cargaron sus compañeros y cómo llegan al destino malheridos." if request.heridos else ""} NO menciones puntos de experiencia ni mecánicas de juego."""
        
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


# ─── TTS narrador clásico ──────────────────────────────────────────────
class TTSNarrativeRequest(BaseModel):
    text: str
    voice: Optional[str] = 'onyx'  # narrador clásico, grave
    model: Optional[str] = 'tts-1-hd'  # alta calidad para audiolibro
    speed: Optional[float] = 0.95  # ligeramente más lento, tono epopeya


@router.post("/tts/narrative")
async def tts_narrative(request: TTSNarrativeRequest):
    """
    Convierte una crónica de viaje a audio MP3 (base64) usando OpenAI TTS
    a través de la Universal Key. Modelo por defecto: tts-1-hd, voz onyx
    (grave, autoritaria — estilo "narrador clásico").
    """
    try:
        from emergentintegrations.llm.openai import OpenAITextToSpeech
        from dotenv import load_dotenv
        load_dotenv()

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"success": False, "error": "No API key configured"}

        # OpenAI TTS limita a 4096 caracteres por petición. Si el texto es
        # más largo, lo truncamos al límite cortando por la última frase.
        text = (request.text or '').strip()
        if not text:
            return {"success": False, "error": "Texto vacío"}
        max_chars = 4000
        if len(text) > max_chars:
            cut = text.rfind('.', 0, max_chars)
            text = text[:cut + 1] if cut > 0 else text[:max_chars]

        # Para textos largos (>2000 chars) bajamos a tts-1 (mucho más rápido,
        # ~60% del coste de tts-1-hd, sin timeouts del ingress).
        model = request.model
        if model == 'tts-1-hd' and len(text) > 2000:
            model = 'tts-1'

        tts = OpenAITextToSpeech(api_key=api_key)
        audio_b64 = await tts.generate_speech_base64(
            text=text,
            model=model,
            voice=request.voice,
            speed=request.speed,
            response_format='mp3',
        )
        return {
            "success": True,
            "audio_base64": audio_b64,
            "mime": "audio/mp3",
            "voice": request.voice,
            "model": model,
            "chars": len(text),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}



# New endpoint to apply individual PX amounts per character
class ApplyPXIndividualRequest(BaseModel):
    characters: List[dict]  # List of {character_id: str, character_name: str, px_amount: int}
    journey_id: Optional[str] = None
    journey_description: Optional[str] = None
    journey_origen: Optional[str] = None
    journey_destino: Optional[str] = None
    anio_te: Optional[int] = None
    journey_summary: Optional[str] = None  # 3-line AI summary

@router.post("/apply-px-individual")
async def apply_px_individual(request: ApplyPXIndividualRequest):
    """Apply different PX amounts to each character based on their individual performance"""
    try:
        results = []
        exitosos = 0

        # Construye una entrada compacta de 3 líneas para añadir a la historia
        # del personaje. Si no llega `journey_summary` (la crónica IA aún no se
        # ha generado), el entry sigue siendo válido sin esa parte.
        def _trim_to_3_lines(text: str) -> str:
            if not text:
                return ""
            lines = [ln.strip() for ln in text.replace("\r", "").split("\n") if ln.strip()]
            joined = " ".join(lines)
            # Heurística: corta a ~3 oraciones cortas (separadas por '. ')
            sentences = [s.strip() for s in joined.split(". ") if s.strip()]
            picked = sentences[:3]
            out = ". ".join(picked)
            if out and not out.endswith("."):
                out += "."
            return out

        def _build_history_entry(char_name: str, px: int) -> Optional[str]:
            origen = request.journey_origen
            destino = request.journey_destino
            if not (origen and destino):
                return None
            anio = request.anio_te or 2950
            resumen = _trim_to_3_lines(request.journey_summary or "")
            partes = [
                f"En el año {anio} T.E., {char_name} viajó desde {origen} a {destino}",
            ]
            entrada = ", ".join(partes)
            if resumen:
                entrada += f". {resumen}"
            else:
                entrada += "."
            entrada += f" Esto le otorgó {px}px."
            return entrada

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
            except Exception:
                character = await db.characters.find_one({"_id": char_id})

            if not character:
                results.append({
                    "character_id": char_id,
                    "character_name": char_name,
                    "success": False,
                    "error": "Personaje no encontrado"
                })
                continue

            # Update XP — el campo oficial en la ficha es `experiencia`.
            # `xp` se mantiene también por compatibilidad legacy.
            current_xp = character.get('experiencia', 0) or 0
            new_xp = current_xp + px_amount

            update_dict: Dict[str, Any] = {
                "experiencia": new_xp,
                "xp": new_xp,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            history_entry = _build_history_entry(char_name, px_amount)
            if history_entry:
                # Anexa la entrada al final del campo `historia` (string).
                # Conserva el contenido previo separándolo con doble salto de línea.
                prev = character.get('historia') or ''
                if prev and not prev.endswith("\n"):
                    nueva = prev + "\n\n" + history_entry
                else:
                    nueva = (prev or '') + history_entry
                update_dict["historia"] = nueva

            try:
                await db.characters.update_one(
                    {"_id": character["_id"]},
                    {"$set": update_dict}
                )
                exitosos += 1
                results.append({
                    "character_id": char_id,
                    "character_name": char_name,
                    "success": True,
                    "xp_anterior": current_xp,
                    "xp_ganado": px_amount,
                    "xp_nuevo": new_xp,
                    "history_appended": bool(history_entry),
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


# ============== AI PROMPTS — TRANSPARENCIA PARA EL DJ ==============

@router.get("/config/ai-prompts")
async def get_ai_prompts():
    """Devuelve los prompts actualmente en uso por la IA para generar
    narrativas de eventos de viaje, tiradas de orientación y crónicas.
    Permite que el DJ los vea y (en el futuro) los depure/modifique.
    Por ahora: READ-ONLY reflejo del código.
    """
    system_message = (
        "Eres el narrador del grupo. Escribes notas cortas (2-3 frases) en español, en tono cercano tipo "
        "Tolkien pero NATURAL — como un compañero de viaje contando lo sucedido al volver. NUNCA pedante.\n\n"
        "REGLAS DE PERSONAJES:\n"
        "- Refiérete al personaje SOLO por su NOMBRE DE PILA. NUNCA uses apellido.\n"
        "- NO repitas el papel ('nuestro vigía', 'el atento explorador').\n"
        "- Ejemplos: 'Folgo se adelantó al sendero' (SÍ). 'Folgo Rizocastaño, nuestro vigía...' (NO).\n\n"
        "REGLAS DE AMBIENTACIÓN (Tolkien):\n"
        "- Si la región es reconocible (Comarca, Bree, Eriador, Bosque Negro, Rohan, Gondor, etc.), describe "
        "el paisaje COMO LO ES en la obra de Tolkien.\n\n"
        "REGLAS DE CLIMA:\n"
        "- Si se proporciona un clima, INTÉGRALO en una pincelada breve — sin cifras.\n\n"
        "PROHIBIDO:\n"
        "- 'épico', 'glorioso', 'valeroso', 'magnánimo'.\n"
        "- Emojis.\n"
        "- Mencionar tiradas, dados, CDs.\n"
        "- Mencionar origen ni destino del viaje completo (céntrate en el momento)."
    )

    event_prompt_template = (
        "Genera una breve narrativa (2-3 frases) para este evento de viaje:\n\n"
        "FASE DEL VIAJE: {fase_viaje} (día {dia_actual} de {dias_totales})\n"
        "TERRENO ACTUAL: {terreno_desc}\n"
        "EVENTO: {evento_nombre}\n"
        "RESULTADO: {\"El grupo tuvo éxito\" if exito else \"Las cosas no salieron bien\"}\n"
        "PERSONAJE RESPONSABLE: {primer_nombre} (papel: {papel_name} — NO menciones el papel en el texto)\n"
        "CONSECUENCIA: {consecuencia}\n"
        "[Opcional] NOTAS DEL MAESTRO: {notas_maestro}\n"
        "[Opcional] CLIMA DEL DÍA (mencionar sin cifras): {clima}\n\n"
        "Describe qué sucedió de forma natural y sencilla, como si lo contaras junto al fuego. "
        "Usa SOLO el nombre de pila '{primer_nombre}'."
    )

    day_log_prompt_template = (
        "Genera UN párrafo (máx. 4-5 frases) contando el día {dia_numero} de un viaje de {dias_totales} días "
        "por el terreno {terreno} ({tipo_tierra}).\n\n"
        "ORIENTACIÓN DEL DÍA: {orientacion_resumen}\n"
        "EVENTOS DEL DÍA: {eventos_resumen}\n"
        "TIRADAS DE FATIGA: {fatiga_resumen}\n"
        "ACAMPADA: {acampada_resumen}\n"
        "CLIMA: {clima}\n"
        "CONTEXTO DE AYER: {dia_anterior_resumen}\n\n"
        "Narra como si lo contaras al fuego, sin repeticiones técnicas y sin cifras."
    )

    return {
        "success": True,
        "read_only": True,
        "prompts": {
            "system_message": system_message,
            "event_narrative_template": event_prompt_template,
            "day_log_template": day_log_prompt_template,
        },
        "model": "openai:gpt-4o",
        "notas": (
            "Estos prompts se usan en los endpoints /api/travel/generate-event-narrative "
            "y /api/travel/generate-day-log. Por ahora son READ-ONLY (reflejan el código). "
            "Si quieres editarlos en caliente, indícalo y añadimos persistencia + override."
        ),
    }
