"""
Travel System Routes - LOTR 5e RPG
Complete travel mechanics with editable rules and tables
"""
from fastapi import APIRouter, HTTPException
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
    montura_con_bonus: int = 0
    velocidad_base: int = 30  # feet
    modificador_sabiduria: int = 0
    competencias: List[str] = []
    nivel: int = 1

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
    fatiga_cd_acumulada: int = 0
    notas: str = ""

class ActiveJourney(BaseModel):
    """Active journey state (for day-by-day mode)"""
    id: str = Field(default_factory=lambda: f"journey_{uuid.uuid4().hex[:8]}")
    config: JourneyConfig
    dias: List[JourneyDay] = []
    dia_actual: int = 1
    casillas_totales: int = 0
    casillas_recorridas: int = 0
    fatiga_cd_total: int = 10
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
    {"id": "obj_cazador", "d3_value": 3, "papel": "cazador", "prueba": "Sabiduría (Cazar)", "atributo": "sabiduria", "habilidad": "cazar"}
]

DEFAULT_TERRAIN_DIFFICULTIES = [
    {"id": "terrain_dificil", "tipo": "dificil", "nombre": "Terreno Difícil", "cd_prueba": 20, "modificador_velocidad": 0.5, "permite_montura": False},
    {"id": "terrain_camino", "tipo": "camino", "nombre": "Camino", "cd_prueba": 10, "modificador_velocidad": 1.25, "permite_montura": True},
    {"id": "terrain_campo", "tipo": "campo_abierto", "nombre": "Campo Abierto", "cd_prueba": 15, "modificador_velocidad": 1.0, "permite_montura": True}
]

DEFAULT_LAND_TYPES = [
    {"id": "land_libres", "tipo": "tierras_libres", "nombre": "Tierras Libres", "ventaja_acontecimientos": True, "desventaja_acontecimientos": False, "px_camino": 0, "px_campo_abierto": 5, "px_terreno_dificil": 15, "permite_ritmo_rapido": True},
    {"id": "land_fronterizas", "tipo": "tierras_fronterizas", "nombre": "Tierras Fronterizas", "ventaja_acontecimientos": True, "desventaja_acontecimientos": False, "px_camino": 0, "px_campo_abierto": 10, "px_terreno_dificil": 25, "permite_ritmo_rapido": True},
    {"id": "land_salvajes", "tipo": "tierras_salvajes", "nombre": "Tierras Salvajes", "ventaja_acontecimientos": False, "desventaja_acontecimientos": False, "px_camino": 10, "px_campo_abierto": 25, "px_terreno_dificil": 50, "permite_ritmo_rapido": False},
    {"id": "land_sombra", "tipo": "tierras_sombra", "nombre": "Tierras de la Sombra", "ventaja_acontecimientos": False, "desventaja_acontecimientos": True, "px_camino": 25, "px_campo_abierto": 50, "px_terreno_dificil": 100, "permite_ritmo_rapido": False},
    {"id": "land_oscuras", "tipo": "tierras_oscuras", "nombre": "Tierras Oscuras", "ventaja_acontecimientos": False, "desventaja_acontecimientos": True, "px_camino": 25, "px_campo_abierto": 50, "px_terreno_dificil": 100, "permite_ritmo_rapido": False}
]

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

async def get_travel_rules() -> dict:
    """Get travel rules config from DB or return defaults"""
    rules = await db.travel_rules.find_one({"id": "travel_rules_main"}, {"_id": 0})
    if not rules:
        rules = TravelRulesConfig().model_dump()
        rules['updated_at'] = rules['updated_at'].isoformat()
        await db.travel_rules.insert_one(rules)
    return rules

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

# ============== JOURNEY CALCULATION ENDPOINTS ==============

@router.post("/calculate-journey")
async def calculate_journey(config: JourneyConfig):
    """
    Calculate a complete journey with route, events, and estimates.
    Uses pathfinding if available, otherwise direct calculation.
    """
    # Get configurations from DB
    events_table = await get_travel_events()
    land_types = await get_land_types()
    terrains = await get_terrain_difficulties()
    rules = await get_travel_rules()
    
    # Try to get route from pathfinding
    route_data = None
    try:
        # Use our own db connection to get locations
        # Note: Location IDs are stored in _id field
        start_loc = await db.locations.find_one({"_id": config.origen_id})
        end_loc = await db.locations.find_one({"_id": config.destino_id})
        
        # Remove MongoDB _id for serialization
        if start_loc:
            start_loc['id'] = str(start_loc.pop('_id'))
        if end_loc:
            end_loc['id'] = str(end_loc.pop('_id'))
        
        if start_loc and end_loc:
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
            
            route_data = {
                "origen": start_loc,
                "destino": end_loc,
                "distance_km": round(distance_km, 1),
                "casillas": casillas,
                "terreno": terreno,
                "tipo_tierra": tipo_tierra
            }
    except Exception as e:
        print(f"Error getting route: {e}")
    
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
    
    # Determine speed modifier based on mounts and rhythm
    tiene_monturas = sum(1 for m in config.miembros if m.tiene_montura)
    total_miembros = len(config.miembros) if config.miembros else 1
    porcentaje_monturas = tiene_monturas / total_miembros if total_miembros > 0 else 0
    
    # Base days calculation
    speed_multiplier = terrain_config.get('modificador_velocidad', 1.0)
    
    if config.ritmo == 'lento':
        dias_base = casillas * 1.5
    elif config.ritmo == 'rapido':
        if not land_config.get('permite_ritmo_rapido', True):
            return {"error": True, "message": f"Ritmo rápido no permitido en {land_config['nombre']}"}
        dias_base = casillas * 0.75
    else:
        dias_base = casillas
    
    # Apply terrain modifier
    dias_base = dias_base / speed_multiplier
    
    # Mount speed bonus
    if porcentaje_monturas >= 0.5 and terrain_config.get('permite_montura', True):
        dias_base = dias_base * 0.75
    
    dias_estimados = max(1, round(dias_base))
    
    # Calculate PX for the journey
    px_total = 0
    terreno_tipo = route_data['terreno']
    
    if terreno_tipo in ['dificil', 'muy_dificil', 'desalentador']:
        px_per_casilla = land_config.get('px_terreno_dificil', 25)
    elif terreno_tipo == 'camino' or config.preferir_caminos:
        px_per_casilla = land_config.get('px_camino', 0)
    else:
        px_per_casilla = land_config.get('px_campo_abierto', 10)
    
    px_total = px_per_casilla * casillas
    
    # Calculate number of expected events
    num_eventos_esperados = max(1, casillas // rules.get('orientation_success_distance', 3))
    
    # Determine advantage/disadvantage for events
    tiene_ventaja = land_config.get('ventaja_acontecimientos', False)
    tiene_desventaja = land_config.get('desventaja_acontecimientos', False)
    
    # Season modifier
    estacion = config.estacion
    es_invierno_otono = estacion in ['invierno', 'otono']
    
    return {
        "success": True,
        "ruta": {
            "origen": config.origen_nombre,
            "destino": config.destino_nombre,
            "distance_km": route_data['distance_km'],
            "casillas": casillas,
            "terreno": route_data['terreno'],
            "tipo_tierra": route_data['tipo_tierra'],
            "tipo_tierra_nombre": land_config['nombre']
        },
        "estimaciones": {
            "dias_base": round(dias_base, 1),
            "dias_estimados": dias_estimados,
            "eventos_esperados": num_eventos_esperados,
            "px_total": px_total,
            "px_por_personaje": px_total // total_miembros if total_miembros > 0 else px_total
        },
        "modificadores": {
            "tiene_ventaja_eventos": tiene_ventaja,
            "tiene_desventaja_eventos": tiene_desventaja,
            "desventaja_estacion": es_invierno_otono,
            "porcentaje_monturas": round(porcentaje_monturas * 100),
            "bonus_montura_fatiga": sum(m.montura_con_bonus for m in config.miembros if m.tiene_montura) // max(1, tiene_monturas) if tiene_monturas > 0 else 0
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
