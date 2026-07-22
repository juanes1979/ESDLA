"""
Travel & World-Map Data API Routes
Endpoints for locations, regions, roads, rivers, barriers, pathfinding and
travel generation. Split out of data_routes.py for maintainability.
Shares the same "/data" prefix so all existing frontend URLs keep working.
"""
from fastapi import APIRouter, HTTPException, Query, Body
import logging

logger = logging.getLogger(__name__)
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from utils.locations import find_location

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/data", tags=["Travel & Map Data"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def now_utc():
    return datetime.now(timezone.utc).isoformat()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != '_id'}
    result['id'] = str(doc['_id'])
    return result


def serialize_docs(docs: list) -> list:
    """Convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]



# === NPCs, ENEMIES, ANIMALS ===
# Moved to /app/backend/routes/npc_routes.py (Feb 2026 refactor).


# === LOCATIONS (Map Locations) ===

@router.get("/locations")
async def get_locations(
    region: Optional[str] = None,
    tipo: Optional[str] = None,
    refugio: Optional[bool] = None,
    search: Optional[str] = None
):
    """Get map locations for Middle-earth, with optional filters"""
    query = {}
    
    if region:
        query["region"] = {"$regex": region, "$options": "i"}
    if tipo:
        query["tipo"] = tipo
    if refugio is not None:
        query["refugio"] = refugio
    if search:
        query["$or"] = [
            {"nombre": {"$regex": search, "$options": "i"}},
            {"nombre_sindarin": {"$regex": search, "$options": "i"}},
            {"descripcion": {"$regex": search, "$options": "i"}}
        ]
    
    locations = await db.locations.find(query).to_list(500)
    return {"locations": serialize_docs(locations), "total": len(locations)}


@router.get("/locations/regions")
async def get_location_regions():
    """Get list of all regions with location counts"""
    pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    result = await db.locations.aggregate(pipeline).to_list(50)
    return {"regions": [{"region": r["_id"], "count": r["count"]} for r in result]}


@router.get("/locations/types")
async def get_location_types():
    """Get list of all location types"""
    types = await db.locations.distinct("tipo")
    return {"types": sorted(types)}


@router.get("/locations/for-travel")
async def get_locations_for_travel():
    """Get locations suitable for travel generator (refugios and major points)"""
    # Get all locations that can be travel destinations
    locations = await db.locations.find({
        "$or": [
            {"refugio": True},
            {"tipo": {"$in": ["ciudad", "ciudad_capital", "pueblo", "puerto", "reino_elfico", "reino_enano", "region"]}}
        ]
    }).to_list(200)
    
    # Group by region for easier UI
    by_region = {}
    for loc in locations:
        region = loc.get("region", "Otros")
        if region not in by_region:
            by_region[region] = []
        by_region[region].append(serialize_doc(loc))
    
    return {"by_region": by_region, "total": len(locations)}


@router.get("/locations/{location_id}")
async def get_location(location_id: str):
    """Get a specific location by ID"""
    location = await find_location(db, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return serialize_doc(location)


@router.post("/locations")
async def create_location(location: dict = Body(...)):
    """Create a new location (admin only)"""
    import uuid
    
    # Generate unique ID using UUID to avoid duplicates
    unique_id = f"loc_{uuid.uuid4().hex[:8]}"
    location["_id"] = unique_id
    location["id"] = unique_id
    location["created_at"] = now_utc()
    
    await db.locations.insert_one(location)
    return {"id": unique_id, "message": "Location created successfully"}


@router.put("/locations/{location_id}")
async def update_location(location_id: str, location: dict = Body(...)):
    """Update a location (admin only)"""
    location["updated_at"] = now_utc()
    result = await db.locations.update_one({"_id": location_id}, {"$set": location})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location updated successfully"}


@router.delete("/locations/{location_id}")
async def delete_location(location_id: str):
    """Delete a location (admin only)"""
    result = await db.locations.delete_one({"_id": location_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted successfully"}


# === REGIONS (Hierarchical geography management) ===

class RegionCreate(BaseModel):
    nombre: str
    parent_id: Optional[str] = None  # If null, it's a main region
    descripcion: Optional[str] = ""
    orden: Optional[int] = 0  # For ordering within parent
    tipo_terreno: Optional[str] = None  # Fácil, Moderado, Difícil, Muy Difícil, Desalentador, Infranqueable
    clase_region: Optional[str] = None  # Tierras Libres, Tierras Fronterizas, Tierras Salvajes, Tierras de la sombra, Tierras Oscuras

class RegionUpdate(BaseModel):
    nombre: Optional[str] = None
    parent_id: Optional[str] = None
    descripcion: Optional[str] = None
    orden: Optional[int] = None
    tipo_terreno: Optional[str] = None
    clase_region: Optional[str] = None

@router.get("/regions")
async def get_regions():
    """Get all regions in a hierarchical structure"""
    regions = await db.regions.find({}).sort("orden", 1).to_list(500)
    
    # Build hierarchy: separate main regions and sub-regions
    main_regions = []
    sub_regions_map = {}  # parent_id -> list of sub-regions
    
    for r in regions:
        region_data = serialize_doc(r)
        parent_id = r.get("parent_id")
        
        if parent_id:
            if parent_id not in sub_regions_map:
                sub_regions_map[parent_id] = []
            sub_regions_map[parent_id].append(region_data)
        else:
            main_regions.append(region_data)
    
    # Attach sub-regions to their parents
    for main in main_regions:
        main["subregions"] = sub_regions_map.get(main["id"], [])
    
    return {"regions": main_regions, "total": len(regions)}


@router.get("/regions/flat")
async def get_regions_flat():
    """Get all regions as a flat list (for simple dropdowns)"""
    regions = await db.regions.find({}).sort([("parent_id", 1), ("orden", 1)]).to_list(500)
    return {"regions": serialize_docs(regions)}


@router.get("/regions/{region_id}")
async def get_region(region_id: str):
    """Get a specific region by ID"""
    region = await db.regions.find_one({"_id": region_id})
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return serialize_doc(region)


@router.post("/regions")
async def create_region(region: RegionCreate):
    """Create a new region (admin only)"""
    region_id = f"reg_{str(uuid.uuid4())[:8]}"
    region_dict = {
        "_id": region_id,
        "nombre": region.nombre,
        "parent_id": region.parent_id,
        "descripcion": region.descripcion,
        "orden": region.orden,
        "created_at": now_utc()
    }
    await db.regions.insert_one(region_dict)
    return {"id": region_id, "message": "Region created successfully"}


@router.put("/regions/{region_id}")
async def update_region(region_id: str, region: RegionUpdate):
    """Update an existing region"""
    update_data = {k: v for k, v in region.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = now_utc()
    result = await db.regions.update_one({"_id": region_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Region not found")
    return {"message": "Region updated successfully"}


class RegionMoveRequest(BaseModel):
    parent_id: Optional[str] = None  # null = mover a raíz (acepta explícitamente null)


@router.patch("/regions/{region_id}/move")
async def move_region(region_id: str, req: RegionMoveRequest):
    """
    Mueve una región dentro de la jerarquía. Acepta `parent_id=null`
    para mover a raíz (a diferencia del PUT /regions/{id} que descarta
    los valores None y por tanto no permite "desanidar").
    Valida que no se cree un ciclo.
    """
    region = await db.regions.find_one({"_id": region_id})
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    if req.parent_id == region_id:
        raise HTTPException(status_code=400, detail="Una región no puede ser su propio padre")
    if req.parent_id:
        parent = await db.regions.find_one({"_id": req.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent region not found")
        # Validar ciclo: el nuevo padre no puede ser descendiente
        all_regions = await db.regions.find({}, {"_id": 1, "parent_id": 1}).to_list(2000)
        # construir set de descendientes del nodo
        descendants = set()
        stack = [region_id]
        while stack:
            cur = stack.pop()
            for r in all_regions:
                if r.get("parent_id") == cur:
                    descendants.add(r["_id"])
                    stack.append(r["_id"])
        if req.parent_id in descendants:
            raise HTTPException(status_code=400, detail="Movimiento crearía un ciclo")
    await db.regions.update_one(
        {"_id": region_id},
        {"$set": {"parent_id": req.parent_id, "updated_at": now_utc()}},
    )
    return {"message": "Region moved", "id": region_id, "parent_id": req.parent_id}


@router.delete("/regions/{region_id}")
async def delete_region(region_id: str):
    """Delete a region. If it's a main region, also delete all its sub-regions"""
    # Check if region exists
    region = await db.regions.find_one({"_id": region_id})
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    
    # If it's a main region, delete its sub-regions first
    if not region.get("parent_id"):
        await db.regions.delete_many({"parent_id": region_id})
    
    # Delete the region itself
    await db.regions.delete_one({"_id": region_id})
    return {"message": "Region deleted successfully"}


@router.post("/regions/seed")
async def seed_regions():
    """Seed the regions collection with initial Middle-earth geography (admin only)"""
    # Check if already seeded
    count = await db.regions.count_documents({})
    if count > 0:
        return {"message": f"Regions already exist ({count} regions). Use DELETE first if you want to reseed."}
    
    # Define initial hierarchy
    initial_regions = [
        {"nombre": "Eriador", "subregions": ["La Comarca", "Tierras de Bree", "Arthedain", "Cardolan", "Rhudaur", "Lindon", "Eregion"]},
        {"nombre": "Angmar", "subregions": []},
        {"nombre": "Montañas Nubladas", "subregions": ["Paso Alto", "Moria", "Este de las Montañas"]},
        {"nombre": "Rhovanion", "subregions": ["Bosque Negro", "Valle del Anduin", "Valle", "Erebor", "Esgaroth", "Lothlórien", "Tierras Pardas"]},
        {"nombre": "Fangorn", "subregions": []},
        {"nombre": "Rohan", "subregions": ["Folde Este", "Folde Oeste", "Cuernavilla", "Nan Curunír"]},
        {"nombre": "Gondor", "subregions": ["Anórien", "Ithilien", "Lebennin", "Belfalas", "Lamedon", "Anfalas", "Dor-en-Ernil"]},
        {"nombre": "Mordor", "subregions": ["Gorgoroth", "Nurn", "Udûn", "Lithlad"]},
        {"nombre": "Rhûn", "subregions": ["Dorwinion"]},
        {"nombre": "Harad", "subregions": ["Harad Cercano", "Harad Lejano", "Umbar"]},
        {"nombre": "Norte (Forodwaith)", "subregions": []},
        {"nombre": "Sur", "subregions": []},
    ]
    
    created = 0
    for i, main_reg in enumerate(initial_regions):
        main_id = f"reg_{str(uuid.uuid4())[:8]}"
        await db.regions.insert_one({
            "_id": main_id,
            "nombre": main_reg["nombre"],
            "parent_id": None,
            "descripcion": "",
            "orden": i,
            "created_at": now_utc()
        })
        created += 1
        
        for j, sub_name in enumerate(main_reg["subregions"]):
            sub_id = f"reg_{str(uuid.uuid4())[:8]}"
            await db.regions.insert_one({
                "_id": sub_id,
                "nombre": sub_name,
                "parent_id": main_id,
                "descripcion": "",
                "orden": j,
                "created_at": now_utc()
            })
            created += 1
    
    return {"message": f"Seeded {created} regions successfully"}


@router.get("/locations/calculate-route/{origin_id}/{destination_id}")
async def calculate_route(origin_id: str, destination_id: str):
    """Calculate route between two locations including distance, terrain, and estimated travel time"""
    import math
    
    origin = await find_location(db, origin_id)
    destination = await find_location(db, destination_id)
    
    if not origin:
        raise HTTPException(status_code=404, detail="Origin location not found")
    if not destination:
        raise HTTPException(status_code=404, detail="Destination location not found")
    
    # Calculate distance using coordinates
    # Each coordinate unit represents roughly 4 miles (1 hex)
    dx = destination.get("x", 0) - origin.get("x", 0)
    dy = destination.get("y", 0) - origin.get("y", 0)
    
    # Euclidean distance in hexes
    distance_hexes = math.sqrt(dx**2 + dy**2)
    
    # Convert to miles and km (1 hex = 4 miles = 6.4 km)
    distance_miles = round(distance_hexes * 4, 1)
    distance_km = round(distance_hexes * 6.4, 1)
    
    # Determine average terrain difficulty
    terrain_weights = {
        "facil": 1,
        "moderado": 1.5,
        "dificil": 2,
        "muy_dificil": 3,
        "desalentador": 4,
        "infranqueable": 10
    }
    
    origin_terrain = origin.get("terreno", "moderado")
    dest_terrain = destination.get("terreno", "moderado")
    
    # Use the harder terrain as the baseline
    origin_weight = terrain_weights.get(origin_terrain, 1.5)
    dest_weight = terrain_weights.get(dest_terrain, 1.5)
    avg_weight = (origin_weight + dest_weight) / 2
    
    # Calculate travel time
    # Base: 24 miles per day on foot on easy terrain
    # Adjust for terrain difficulty
    base_miles_per_day = 24
    adjusted_miles_per_day = base_miles_per_day / avg_weight
    
    travel_days = round(distance_miles / adjusted_miles_per_day, 1)
    if travel_days < 0.5:
        travel_days = 0.5  # Minimum half day
    
    # Determine danger level
    danger_levels = {
        "bajo": 1,
        "medio": 2,
        "alto": 3,
        "muy_alto": 4,
        "extremo": 5
    }
    origin_danger = danger_levels.get(origin.get("peligro", "medio"), 2)
    dest_danger = danger_levels.get(destination.get("peligro", "medio"), 2)
    max_danger = max(origin_danger, dest_danger)
    
    danger_names = {1: "bajo", 2: "medio", 3: "alto", 4: "muy_alto", 5: "extremo"}
    route_danger = danger_names.get(max_danger, "medio")
    
    # Determine land type for the route
    land_priority = ["tierras_oscuras", "tierras_sombra", "tierras_salvajes", "fronterizas", "tierras_libres"]
    origin_land = origin.get("tipo_tierra", "tierras_salvajes")
    dest_land = destination.get("tipo_tierra", "tierras_salvajes")
    
    # Use the more dangerous land type
    origin_priority = land_priority.index(origin_land) if origin_land in land_priority else 2
    dest_priority = land_priority.index(dest_land) if dest_land in land_priority else 2
    route_land = land_priority[min(origin_priority, dest_priority)]
    
    return {
        "origin": serialize_doc(origin),
        "destination": serialize_doc(destination),
        "route": {
            "distance_hexes": round(distance_hexes, 1),
            "distance_miles": distance_miles,
            "distance_km": distance_km,
            "estimated_days": travel_days,
            "terrain_difficulty": max(origin_terrain, dest_terrain, key=lambda t: terrain_weights.get(t, 1)),
            "land_type": route_land,
            "danger_level": route_danger,
            "direction": {
                "dx": dx,
                "dy": dy,
                "cardinal": get_cardinal_direction(dx, dy)
            }
        }
    }


def get_cardinal_direction(dx, dy):
    """Get cardinal direction from coordinate delta"""
    import math
    if dx == 0 and dy == 0:
        return "mismo lugar"
    
    angle = math.atan2(dy, dx) * 180 / math.pi
    
    if -22.5 <= angle < 22.5:
        return "Este"
    elif 22.5 <= angle < 67.5:
        return "Noreste"
    elif 67.5 <= angle < 112.5:
        return "Norte"
    elif 112.5 <= angle < 157.5:
        return "Noroeste"
    elif angle >= 157.5 or angle < -157.5:
        return "Oeste"
    elif -157.5 <= angle < -112.5:
        return "Suroeste"
    elif -112.5 <= angle < -67.5:
        return "Sur"
    else:
        return "Sureste"


@router.post("/locations/search-nearby")
async def search_nearby_locations(data: dict = Body(...)):
    """Find locations near a given point or within a region"""
    x = data.get("x")
    y = data.get("y")
    radius = data.get("radius", 10)  # Default 10 hexes
    region = data.get("region")
    tipo_tierra = data.get("tipo_tierra")
    refugio_only = data.get("refugio_only", False)
    
    query = {}
    
    if region:
        query["region"] = {"$regex": region, "$options": "i"}
    if tipo_tierra:
        query["tipo_tierra"] = tipo_tierra
    if refugio_only:
        query["refugio"] = True
    
    locations = await db.locations.find(query).to_list(500)
    
    # If x, y provided, filter by distance
    if x is not None and y is not None:
        import math
        nearby = []
        for loc in locations:
            loc_x = loc.get("x", 0)
            loc_y = loc.get("y", 0)
            distance = math.sqrt((loc_x - x)**2 + (loc_y - y)**2)
            if distance <= radius:
                loc_data = serialize_doc(loc)
                loc_data["distance_hexes"] = round(distance, 1)
                loc_data["distance_km"] = round(distance * 6.4, 1)
                nearby.append(loc_data)
        
        # Sort by distance
        nearby.sort(key=lambda l: l["distance_hexes"])
        return {"locations": nearby, "total": len(nearby)}
    
    return {"locations": serialize_docs(locations), "total": len(locations)}


# === VIAJE (Travel Rules) ===

@router.get("/viaje")
async def get_viaje_rules():
    """Get travel rules: papeles, secuencia, fatiga, duracion, acontecimientos"""
    viaje = await db.viaje_rules.find_one({"_id": "main"})
    if not viaje:
        return None
    # Remove _id from response
    return {k: v for k, v in viaje.items() if k != '_id'}


# === TRAVEL GENERATOR ===

@router.get("/clima")
async def get_clima_regiones():
    """Get all climate regions"""
    regiones = await db.clima.find({}).to_list(100)
    return [{"id": r["_id"], "nombre": r["nombre"]} for r in regiones]


@router.get("/clima/{region}")
async def get_clima_region(region: str):
    """Get climate data for a specific region"""
    clima = await db.clima.find_one({"_id": region})
    if not clima:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found")
    return {k: v for k, v in clima.items() if k != '_id'}


@router.get("/distancias")
async def get_distancias():
    """Get predefined travel distances"""
    distancias = await db.distancias_viaje.find_one({"_id": "main"})
    if not distancias:
        return {"rutas": [], "puntos_interes": []}
    return {
        "rutas": distancias.get("rutas", []),
        "puntos_interes": distancias.get("puntos_interes", [])
    }


@router.get("/monturas")
async def get_monturas():
    """Get available mounts for travel"""
    monturas = await db.monturas_viaje.find_one({"_id": "main"})
    if not monturas:
        return []
    return monturas.get("monturas", [])


class TravelConfig(BaseModel):
    origen: str
    destino: str
    region: str
    casillas: int
    tipo_terreno: str  # camino, campo_abierto, terreno_dificil
    tipo_tierra: str  # fronteriza, salvaje, oscura
    mes: str  # Mes élfico
    montura: str
    velocidad: int
    marcha_forzada: bool = False
    papeles: dict  # {"guia": "Héroe1", "cazador": "Héroe2", ...}
    heroes_multiples_papeles: list = []  # Héroes que asumen varios papeles


class SavedTravel(BaseModel):
    nombre: str
    config: dict
    eventos: list
    resultado: dict
    fecha: str = None


@router.post("/viajes/generar")
async def generar_viaje(config: TravelConfig):
    """Generate a complete travel with events based on rules"""
    import random
    from datetime import datetime
    
    # Get climate data
    clima = await db.clima.find_one({"_id": config.region})
    clima_mes = clima.get("meses", {}).get(config.mes, {}) if clima else {}
    
    # Calculate climate modifiers
    modificadores_clima = []
    cd_extra_clima = 0
    
    temp_media = clima_mes.get("temp_media", 15)
    lluvias = clima_mes.get("lluvias_mm", 0)
    viento = clima_mes.get("viento_kmh", 0)
    prob_lluvia = clima_mes.get("prob_lluvia", 0)
    
    # Lluvia fuerte
    if lluvias > 70:
        cd_extra_clima += 2
        modificadores_clima.append({"tipo": "Lluvia fuerte", "efecto": "+2 CD en pruebas de viaje", "valor": lluvias})
    
    # Temperatura extrema
    if temp_media < 0 or temp_media > 30:
        cd_extra_clima += 1
        modificadores_clima.append({"tipo": "Temperatura extrema", "efecto": "+1 CD en fatiga", "valor": temp_media})
    
    # Viento fuerte
    desventaja_viento = viento > 20
    if desventaja_viento:
        modificadores_clima.append({"tipo": "Viento fuerte", "efecto": "Desventaja en pruebas de Explorar", "valor": viento})
    
    # Nieve/Hielo
    terreno_dificil_clima = temp_media < -10
    if terreno_dificil_clima:
        modificadores_clima.append({"tipo": "Nieve/Hielo", "efecto": "Terreno difícil automático", "valor": temp_media})
    
    # Season penalties
    estacion = "invierno" if config.mes in ["Nénimë", "Súlimë", "Ringarë"] else \
               "otono" if config.mes in ["Narquelië", "Hísimë"] else \
               "primavera" if config.mes in ["Coiviennë", "Víressë", "Lótessë"] else "verano"
    desventaja_estacion = estacion in ["otono", "invierno"]
    
    # CD base según terreno
    cd_terreno = {"camino": 10, "campo_abierto": 15, "terreno_dificil": 20}
    cd_base = cd_terreno.get(config.tipo_terreno, 15)
    
    # Ajustar terreno si hay nieve/hielo
    tipo_terreno_efectivo = "terreno_dificil" if terreno_dificil_clima else config.tipo_terreno
    
    # Calculate travel duration
    velocidad = config.velocidad
    casillas_por_dia = 1
    
    if velocidad <= 15:
        casillas_por_dia = 0.5
    elif velocidad >= 80:
        casillas_por_dia = 3
    elif velocidad >= 50:
        casillas_por_dia = 2
    
    if tipo_terreno_efectivo == "terreno_dificil":
        casillas_por_dia /= 2
    
    if config.marcha_forzada:
        casillas_por_dia *= 2
    
    dias_estimados = int(config.casillas / casillas_por_dia) if casillas_por_dia > 0 else config.casillas
    
    # Generate events
    eventos = []
    casilla_actual = 0
    cd_fatiga_acumulada = 0
    dias_extra = 0
    
    # Tabla de acontecimientos
    tabla_acontecimientos = [
        {"rango": (1, 2), "nombre": "Terrible desgracia", "cd_fatiga": 3, "grave": True},
        {"rango": (3, 4), "nombre": "Desesperanza", "cd_fatiga": 2, "sombra_grupo": True},
        {"rango": (5, 6), "nombre": "Decisiones erróneas", "cd_fatiga": 2, "sombra_objetivo": True},
        {"rango": (7, 14), "nombre": "Percance", "cd_fatiga": 1, "dia_extra": True},
        {"rango": (15, 17), "nombre": "Atajo", "cd_fatiga": 1, "dia_menos": True},
        {"rango": (18, 19), "nombre": "Encuentro casual", "cd_fatiga": 1, "encuentro": True},
        {"rango": (20, 20), "nombre": "Vista agradable", "cd_fatiga": 0, "inspiracion": True},
    ]
    
    while casilla_actual < config.casillas:
        # Prueba de orientación (Guía)
        penalizacion_guia = -5 if config.papeles.get("guia") in config.heroes_multiples_papeles else 0
        
        # Simular tirada
        tirada_orientacion = random.randint(1, 20) + penalizacion_guia
        cd_orientacion = 15 + cd_extra_clima
        
        # Calcular distancia al acontecimiento
        diferencia = tirada_orientacion - cd_orientacion
        if diferencia >= 5:
            distancia = 4
        elif diferencia >= 0:
            distancia = 3
        elif diferencia >= -4:
            distancia = 2
        else:
            distancia = 1
        
        casilla_evento = casilla_actual + distancia
        
        if casilla_evento >= config.casillas:
            # Viaje termina sin más eventos
            break
        
        casilla_actual = casilla_evento
        
        # Determinar objetivo (1d3)
        d3 = random.randint(1, 3)
        objetivos = {1: "Exploradores", 2: "Vigías", 3: "Cazadores"}
        pruebas = {1: "Sabiduría (Explorar)", 2: "Sabiduría (Percepción)", 3: "Sabiduría (Cazar)"}
        
        # Tirada de acontecimiento (1d20 con ventaja/desventaja según región)
        if config.tipo_tierra == "fronteriza":
            tirada_evento = max(random.randint(1, 20), random.randint(1, 20))  # Ventaja
        elif config.tipo_tierra == "oscura":
            tirada_evento = min(random.randint(1, 20), random.randint(1, 20))  # Desventaja
        else:
            tirada_evento = random.randint(1, 20)
        
        # Determinar tipo de acontecimiento
        acontecimiento = None
        for a in tabla_acontecimientos:
            if a["rango"][0] <= tirada_evento <= a["rango"][1]:
                acontecimiento = a
                break
        
        if acontecimiento:
            cd_fatiga_acumulada += acontecimiento["cd_fatiga"]
            
            # Simular resolución
            penalizacion_papel = -5 if config.papeles.get(objetivos[d3].lower()[:4]) in config.heroes_multiples_papeles else 0
            tirada_resolucion = random.randint(1, 20) + penalizacion_papel
            
            # Aplicar desventaja si corresponde
            if desventaja_estacion or (desventaja_viento and d3 == 1):
                tirada_resolucion = min(tirada_resolucion, random.randint(1, 20) + penalizacion_papel)
            
            cd_evento = cd_base + cd_extra_clima
            exito = tirada_resolucion >= cd_evento
            
            evento = {
                "casilla": casilla_actual,
                "tirada_orientacion": tirada_orientacion,
                "tirada_evento": tirada_evento,
                "d3": d3,
                "objetivo": objetivos[d3],
                "prueba": pruebas[d3],
                "acontecimiento": acontecimiento["nombre"],
                "cd": cd_evento,
                "tirada_resolucion": tirada_resolucion,
                "exito": exito,
                "consecuencias": []
            }
            
            # Aplicar consecuencias según éxito/fracaso
            if not exito:
                if acontecimiento.get("dia_extra"):
                    dias_extra += 1
                    cd_fatiga_acumulada += 2
                    evento["consecuencias"].append("+1 día de viaje, +2 CD fatiga")
                if acontecimiento.get("sombra_grupo"):
                    evento["consecuencias"].append("Toda la compañía gana 1 punto de Sombra")
                if acontecimiento.get("sombra_objetivo"):
                    evento["consecuencias"].append(f"{objetivos[d3]} gana 1 punto de Sombra")
                if acontecimiento.get("grave"):
                    evento["consecuencias"].append("Salvación de Destreza o 0 PG / mitad PG")
            else:
                if acontecimiento.get("dia_menos"):
                    dias_extra -= 1
                    evento["consecuencias"].append("-1 día de viaje")
                if acontecimiento.get("encuentro"):
                    evento["consecuencias"].append("Encuentro favorable con habitantes locales")
                if acontecimiento.get("inspiracion"):
                    evento["consecuencias"].append("Todos los héroes obtienen Inspiración")
            
            eventos.append(evento)
    
    # Calcular resultado final
    dias_totales = dias_estimados + dias_extra
    cd_fatiga_final = 10 + cd_fatiga_acumulada
    
    # Bonus por montura
    montura_info = None
    monturas_data = await db.monturas_viaje.find_one({"_id": "main"})
    if monturas_data:
        for m in monturas_data.get("monturas", []):
            if m["nombre"] == config.montura:
                montura_info = m
                break
    
    mod_con_montura = montura_info.get("mod_con", 0) if montura_info and montura_info.get("con_montura") else 0
    
    resultado = {
        "dias_base": dias_estimados,
        "dias_extra": dias_extra,
        "dias_totales": dias_totales,
        "cd_fatiga": cd_fatiga_final,
        "mod_con_montura": mod_con_montura,
        "eventos_totales": len(eventos),
        "clima": {
            "temperatura": temp_media,
            "lluvias": lluvias,
            "viento": viento,
            "estacion": estacion
        },
        "modificadores_clima": modificadores_clima,
        "terreno_efectivo": tipo_terreno_efectivo
    }
    
    return {
        "config": config.dict(),
        "eventos": eventos,
        "resultado": resultado
    }


@router.post("/viajes/guardar")
async def guardar_viaje(viaje: SavedTravel):
    """Save a generated travel for future reference"""
    from datetime import datetime
    
    viaje_dict = viaje.dict()
    viaje_dict["fecha"] = viaje.fecha or datetime.now().isoformat()
    viaje_dict["_id"] = None  # Let MongoDB generate ID
    
    result = await db.viajes_guardados.insert_one(viaje_dict)
    return {"id": str(result.inserted_id), "message": "Viaje guardado correctamente"}


@router.get("/viajes/guardados")
async def get_viajes_guardados():
    """Get all saved travels"""
    viajes = await db.viajes_guardados.find({}).sort("fecha", -1).to_list(100)
    return [{**{k: v for k, v in v.items() if k != '_id'}, "id": str(v["_id"])} for v in viajes]


@router.delete("/viajes/{viaje_id}")
async def delete_viaje(viaje_id: str):
    """Delete a saved travel"""
    from bson import ObjectId
    result = await db.viajes_guardados.delete_one({"_id": ObjectId(viaje_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return {"message": "Viaje eliminado"}


# === ROADS (Map Roads/Paths) ===

class RoadCreate(BaseModel):
    nombre: str
    tipo: str = "secundario"  # sendero, secundario, real
    descripcion: Optional[str] = ""
    puntos: List[Dict[str, float]] = []  # [{x: float, y: float}, ...]

class RoadUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    puntos: Optional[List[Dict[str, float]]] = None


@router.get("/roads")
async def get_roads():
    """Get all roads/paths from the map"""
    roads = await db.roads.find({}).to_list(500)
    for road in roads:
        road['id'] = str(road.pop('_id'))
    return {"roads": roads, "total": len(roads)}


@router.get("/roads/{road_id}")
async def get_road(road_id: str):
    """Get a specific road by ID"""
    road = await db.roads.find_one({"_id": road_id})
    if not road:
        raise HTTPException(status_code=404, detail="Camino no encontrado")
    road['id'] = str(road.pop('_id'))
    return road


@router.post("/roads")
async def create_road(road: RoadCreate):
    """Create a new road/path"""
    road_dict = road.dict()
    road_dict['_id'] = f"road_{uuid.uuid4().hex[:8]}"
    road_dict['created_at'] = now_utc()
    road_dict['updated_at'] = now_utc()
    
    await db.roads.insert_one(road_dict)
    
    road_dict['id'] = road_dict.pop('_id')
    return road_dict


@router.put("/roads/{road_id}")
async def update_road(road_id: str, road: RoadUpdate):
    """Update an existing road"""
    update_data = {k: v for k, v in road.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    update_data['updated_at'] = now_utc()
    
    result = await db.roads.update_one({"_id": road_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Camino no encontrado")
    
    updated = await db.roads.find_one({"_id": road_id})
    updated['id'] = str(updated.pop('_id'))
    return updated


@router.delete("/roads/{road_id}")
async def delete_road(road_id: str):
    """Delete a road"""
    result = await db.roads.delete_one({"_id": road_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Camino no encontrado")
    return {"message": "Camino eliminado"}


# === RIVERS (Ríos) ===

class RiverCreate(BaseModel):
    nombre: str
    tipo: str = "profundo"  # vadeable, profundo, infranqueable
    descripcion: Optional[str] = ""
    puntos: List[Dict[str, float]] = []  # [{x: float, y: float}, ...]

class RiverUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    puntos: Optional[List[Dict[str, float]]] = None


@router.get("/rivers")
async def get_rivers():
    """Get all rivers from the map"""
    rivers = await db.rivers.find({}).to_list(500)
    for river in rivers:
        river['id'] = str(river.pop('_id'))
    return {"rivers": rivers, "total": len(rivers)}


@router.get("/rivers/{river_id}")
async def get_river(river_id: str):
    """Get a specific river by ID"""
    river = await db.rivers.find_one({"_id": river_id})
    if not river:
        raise HTTPException(status_code=404, detail="Río no encontrado")
    river['id'] = str(river.pop('_id'))
    return river


@router.post("/rivers")
async def create_river(river: RiverCreate):
    """Create a new river"""
    river_dict = river.dict()
    river_dict['_id'] = f"river_{uuid.uuid4().hex[:8]}"
    river_dict['created_at'] = now_utc()
    river_dict['updated_at'] = now_utc()
    
    await db.rivers.insert_one(river_dict)
    
    river_dict['id'] = river_dict.pop('_id')
    return river_dict


@router.put("/rivers/{river_id}")
async def update_river(river_id: str, river: RiverUpdate):
    """Update an existing river"""
    update_data = {k: v for k, v in river.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    update_data['updated_at'] = now_utc()
    
    result = await db.rivers.update_one({"_id": river_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Río no encontrado")
    
    updated = await db.rivers.find_one({"_id": river_id})
    updated['id'] = str(updated.pop('_id'))
    return updated


@router.delete("/rivers/{river_id}")
async def delete_river(river_id: str):
    """Delete a river"""
    result = await db.rivers.delete_one({"_id": river_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Río no encontrado")
    return {"message": "Río eliminado"}


# === BARRIERS (Barreras/Líneas Infranqueables) ===

class BarrierCreate(BaseModel):
    nombre: str
    tipo: str = "montana"  # montana, acantilado, frontera
    descripcion: Optional[str] = ""
    puntos: List[Dict[str, float]] = []  # [{x: float, y: float}, ...]

class BarrierUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    puntos: Optional[List[Dict[str, float]]] = None


@router.get("/barriers")
async def get_barriers():
    """Get all barriers/impassable lines from the map"""
    barriers = await db.barriers.find({}).to_list(500)
    for barrier in barriers:
        barrier['id'] = str(barrier.pop('_id'))
    return {"barriers": barriers, "total": len(barriers)}


@router.get("/barriers/{barrier_id}")
async def get_barrier(barrier_id: str):
    """Get a specific barrier by ID"""
    barrier = await db.barriers.find_one({"_id": barrier_id})
    if not barrier:
        raise HTTPException(status_code=404, detail="Barrera no encontrada")
    barrier['id'] = str(barrier.pop('_id'))
    return barrier


@router.post("/barriers")
async def create_barrier(barrier: BarrierCreate):
    """Create a new barrier/impassable line"""
    barrier_dict = barrier.dict()
    barrier_dict['_id'] = f"barrier_{uuid.uuid4().hex[:8]}"
    barrier_dict['created_at'] = now_utc()
    barrier_dict['updated_at'] = now_utc()
    
    await db.barriers.insert_one(barrier_dict)
    
    barrier_dict['id'] = barrier_dict.pop('_id')
    return barrier_dict


@router.put("/barriers/{barrier_id}")
async def update_barrier(barrier_id: str, barrier: BarrierUpdate):
    """Update an existing barrier"""
    update_data = {k: v for k, v in barrier.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    update_data['updated_at'] = now_utc()
    
    result = await db.barriers.update_one({"_id": barrier_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Barrera no encontrada")
    
    updated = await db.barriers.find_one({"_id": barrier_id})
    updated['id'] = str(updated.pop('_id'))
    return updated


@router.delete("/barriers/{barrier_id}")
async def delete_barrier(barrier_id: str):
    """Delete a barrier"""
    result = await db.barriers.delete_one({"_id": barrier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Barrera no encontrada")
    return {"message": "Barrera eliminada"}


# === PATHFINDING ===

class PathfindingRequest(BaseModel):
    """Request model for pathfinding between two points"""
    start_x: Optional[float] = None
    start_y: Optional[float] = None
    end_x: Optional[float] = None
    end_y: Optional[float] = None
    start_location_id: Optional[str] = None
    end_location_id: Optional[str] = None


@router.post("/pathfinding/calculate")
async def calculate_path(request: PathfindingRequest):
    """
    Calculate optimal path between two points or locations
    Uses A* algorithm considering terrain, roads, rivers, and barriers
    """
    from utils.pathfinding import MiddleEarthPathfinder
    
    # Load all required data
    roads = await db.roads.find({}).to_list(500)
    rivers = await db.rivers.find({}).to_list(500)
    barriers = await db.barriers.find({}).to_list(500)
    locations = await db.locations.find({}).to_list(1000)
    
    # Clean up MongoDB _id fields
    for road in roads:
        road['id'] = str(road.pop('_id'))
    for river in rivers:
        river['id'] = str(river.pop('_id'))
    for barrier in barriers:
        barrier['id'] = str(barrier.pop('_id'))
    for loc in locations:
        loc['id'] = str(loc.pop('_id'))
    
    # Initialize pathfinder
    pathfinder = MiddleEarthPathfinder(
        roads=roads,
        rivers=rivers,
        barriers=barriers,
        locations=locations
    )
    
    # Find path
    if request.start_location_id and request.end_location_id:
        result = pathfinder.find_path_by_location_ids(
            request.start_location_id,
            request.end_location_id
        )
    elif request.start_x is not None and request.end_x is not None:
        result = pathfinder.find_path(
            (request.start_x, request.start_y),
            (request.end_x, request.end_y)
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Debe proporcionar coordenadas (start_x, start_y, end_x, end_y) o IDs de ubicación (start_location_id, end_location_id)"
        )
    
    # Convert result to dict
    return {
        "success": result.success,
        "path": result.path,
        "segments": [
            {
                "start": seg.start,
                "end": seg.end,
                "distance_km": seg.distance_km,
                "terrain": seg.terrain,
                "road_type": seg.road_type,
                "river_crossing": seg.river_crossing,
                "travel_cost": seg.travel_cost
            }
            for seg in result.segments
        ],
        "total_distance_km": result.total_distance_km,
        "total_travel_cost": result.total_travel_cost,
        "estimated_days": result.estimated_days,
        "warnings": result.warnings,
        "rivers_crossed": result.rivers_crossed,
        "roads_used": result.roads_used,
        "terrain_summary": result.terrain_summary
    }


@router.get("/pathfinding/between/{start_id}/{end_id}")
async def get_path_between_locations(start_id: str, end_id: str):
    """
    Get optimal path between two location IDs
    Shortcut endpoint for common use case
    """
    from utils.pathfinding import MiddleEarthPathfinder
    
    # Load all required data
    roads = await db.roads.find({}).to_list(500)
    rivers = await db.rivers.find({}).to_list(500)
    barriers = await db.barriers.find({}).to_list(500)
    locations = await db.locations.find({}).to_list(1000)
    
    # Clean up MongoDB _id fields
    for road in roads:
        road['id'] = str(road.pop('_id'))
    for river in rivers:
        river['id'] = str(river.pop('_id'))
    for barrier in barriers:
        barrier['id'] = str(barrier.pop('_id'))
    for loc in locations:
        loc['id'] = str(loc.pop('_id'))
    
    # Initialize pathfinder
    pathfinder = MiddleEarthPathfinder(
        roads=roads,
        rivers=rivers,
        barriers=barriers,
        locations=locations
    )
    
    result = pathfinder.find_path_by_location_ids(start_id, end_id)
    
    return {
        "success": result.success,
        "path": result.path,
        "segments": [
            {
                "start": seg.start,
                "end": seg.end,
                "distance_km": seg.distance_km,
                "terrain": seg.terrain,
                "road_type": seg.road_type,
                "river_crossing": seg.river_crossing,
                "travel_cost": seg.travel_cost
            }
            for seg in result.segments
        ],
        "total_distance_km": result.total_distance_km,
        "total_travel_cost": result.total_travel_cost,
        "estimated_days": result.estimated_days,
        "warnings": result.warnings,
        "rivers_crossed": result.rivers_crossed,
        "roads_used": result.roads_used,
        "terrain_summary": result.terrain_summary
    }


# === TRAVEL CALCULATION (New rules) ===

class TravelCalculationRequest(BaseModel):
    """Request model for travel calculation with full rules"""
    ritmo: str = "normal"  # lento, normal, rapido
    terreno: str = "moderado"  # facil, moderado, dificil, muy_dificil, desalentador, infranqueable
    camino: str = "ninguno"  # ninguno, sendero, secundario, real
    region: str = "tierras_salvajes"  # tierras_libres, tierras_fronterizas, tierras_salvajes, tierras_sombra, tierras_oscuras
    montura: bool = False
    horas_extra: int = 0  # Forced march hours
    distancia_total_km: Optional[float] = None  # If calculating days for a distance


@router.post("/travel/calculate")
async def calculate_travel(request: TravelCalculationRequest):
    """
    Calculate travel distance/time using the full LOTR 5e rules.
    
    Rules:
    - Base distance: Lento 24km, Normal 36km, Rápido 48km per day (8 hours)
    - Terrain modifiers: Fácil ×1, Moderado ×0.75, Difícil ×0.5, etc.
    - Road modifiers: Secundario ×1.10, Real ×1.25
    - Special case: Sendero in moderado terrain = ×1 (cancels penalty)
    - Mount: ×1.5 (not applicable in muy_dificil+ terrain)
    - Forced march: +distance, Constitution save DC = 10 + hours + region_mod
    """
    # Base distances per day (8 hours)
    DISTANCIA_BASE = {"lento": 24, "normal": 36, "rapido": 48}
    
    # Terrain modifiers
    MOD_TERRENO = {
        "facil": 1.0,
        "moderado": 0.75,
        "dificil": 0.5,
        "muy_dificil": 0.33,
        "desalentador": 0.25,
        "infranqueable": 0
    }
    
    # Road modifiers
    MOD_CAMINO = {"ninguno": 1.0, "sendero": 1.0, "secundario": 1.10, "real": 1.25}
    
    # Region modifiers for forced march CD
    MOD_CD_REGION = {
        "tierras_libres": 0,
        "tierras_fronterizas": 1,
        "tierras_salvajes": 0,
        "tierras_sombra": 2,
        "tierras_oscuras": 3
    }
    
    # Validate fast pace restrictions
    if request.ritmo == "rapido" and request.region in ["tierras_salvajes", "tierras_sombra", "tierras_oscuras"]:
        return {
            "error": True,
            "mensaje": f"El ritmo rápido no está permitido en {request.region.replace('_', ' ').title()}.",
            "sugerencia": "Usa ritmo normal o lento."
        }
    
    # Check infranqueable terrain
    if request.terreno == "infranqueable":
        return {
            "error": True,
            "mensaje": "Terreno infranqueable. No se puede atravesar directamente.",
            "sugerencia": "Busca un paso de montaña o ruta alternativa.",
            "es_infranqueable": True
        }
    
    advertencias = []
    
    # 1. Base distance
    distancia = DISTANCIA_BASE.get(request.ritmo, 36)
    base = distancia
    
    # 2. Terrain modifier
    mod_terreno = MOD_TERRENO.get(request.terreno, 1.0)
    
    # Special case: sendero in moderado terrain
    if request.camino == "sendero" and request.terreno == "moderado":
        mod_terreno = 1.0  # Sendero cancels moderado penalty
    
    distancia *= mod_terreno
    
    # 3. Road modifier
    mod_camino = MOD_CAMINO.get(request.camino, 1.0)
    
    # Region affects road bonus
    if request.region == "tierras_sombra" and mod_camino > 1.0:
        # Shadow lands: road bonus halved
        bonus = mod_camino - 1.0
        mod_camino = 1.0 + (bonus / 2)
        advertencias.append("En Tierras de la Sombra, el bonus del camino se reduce a la mitad.")
    elif request.region == "tierras_oscuras":
        # Dark lands: no road bonus
        mod_camino = 1.0
        advertencias.append("En Tierras Oscuras, los caminos no proporcionan bonus.")
    
    distancia *= mod_camino
    
    # 4. Mount modifier
    mod_montura = 1.0
    montura_usada = False
    if request.montura:
        if request.terreno not in ["muy_dificil", "desalentador", "infranqueable"]:
            mod_montura = 1.5
            montura_usada = True
        else:
            advertencias.append(f"No se puede usar montura en terreno {request.terreno.replace('_', ' ')}.")
    
    distancia *= mod_montura
    
    # Round to 1 decimal
    distancia_base = round(distancia, 1)
    
    # 5. Forced march
    distancia_extra = 0
    cd_constitucion = None
    if request.horas_extra > 0:
        km_por_hora = distancia_base / 8
        distancia_extra = round(km_por_hora * request.horas_extra, 1)
        
        cd_base = 10 + request.horas_extra
        mod_region = MOD_CD_REGION.get(request.region, 0)
        cd_constitucion = cd_base + mod_region
        
        advertencias.append(f"Marcha forzada: CD {cd_constitucion} Constitución por cada hora extra. Fallo = 1 nivel de cansancio.")
    
    distancia_total = distancia_base + distancia_extra
    
    # Calculate days if distance provided
    dias_info = None
    if request.distancia_total_km and request.distancia_total_km > 0:
        if distancia_total > 0:
            dias = request.distancia_total_km / distancia_total
            dias_completos = int(dias)
            horas_parciales = round((dias - dias_completos) * 8, 1)
            dias_info = {
                "dias_totales": round(dias, 1),
                "dias_completos": dias_completos,
                "horas_ultimo_dia": horas_parciales,
                "resumen": f"El viaje de {request.distancia_total_km} km toma {dias_completos} días" +
                          (f" y {horas_parciales} horas" if horas_parciales > 0 else "")
            }
    
    return {
        "error": False,
        "distancia_total_km": round(distancia_total, 1),
        "distancia_base_km": distancia_base,
        "distancia_marcha_forzada_km": distancia_extra,
        "detalles": {
            "ritmo": request.ritmo,
            "base_km": base,
            "terreno": request.terreno,
            "mod_terreno": mod_terreno,
            "camino": request.camino,
            "mod_camino": round(mod_camino, 2),
            "region": request.region,
            "montura_usada": montura_usada,
            "mod_montura": mod_montura,
            "horas_extra": request.horas_extra,
            "cd_constitucion": cd_constitucion,
        },
        "dias_info": dias_info,
        "advertencias": advertencias,
        "formula": f"{base} × {mod_terreno} × {round(mod_camino, 2)} × {mod_montura} = {distancia_base} km/día"
    }


@router.get("/travel/options")
async def get_travel_options():
    """Get all available travel options for UI dropdowns"""
    return {
        "ritmos": [
            {"value": "lento", "label": "Lento", "descripcion": "Cauteloso, permite explorar. 24 km/día.", "km_dia": 24},
            {"value": "normal", "label": "Normal", "descripcion": "Ritmo estándar. 36 km/día.", "km_dia": 36},
            {"value": "rapido", "label": "Rápido", "descripcion": "Acelerado, no permitido en zonas peligrosas. 48 km/día.", "km_dia": 48},
        ],
        "terrenos": [
            {"value": "facil", "label": "Fácil", "modificador": 1.0, "color": "#d3ba84", "descripcion": "Caminos, llanuras"},
            {"value": "moderado", "label": "Moderado", "modificador": 0.75, "color": "#948c4d", "descripcion": "Colinas, bosques claros"},
            {"value": "dificil", "label": "Difícil", "modificador": 0.5, "color": "#c38d4f", "descripcion": "Bosques densos, páramos"},
            {"value": "muy_dificil", "label": "Muy Difícil", "modificador": 0.33, "color": "#a57044", "descripcion": "Montañas, pantanos. Sin montura."},
            {"value": "desalentador", "label": "Desalentador", "modificador": 0.25, "color": "#af4b27", "descripcion": "Volcánico, maldito. Sin montura."},
            {"value": "infranqueable", "label": "Infranqueable", "modificador": 0, "color": "#664540", "descripcion": "Solo por pasos de montaña."},
        ],
        "caminos": [
            {"value": "ninguno", "label": "Sin camino", "modificador": 1.0, "color": "#666666"},
            {"value": "sendero", "label": "Sendero", "modificador": 1.0, "color": "#8B7355", "nota": "Anula penalización en terreno moderado"},
            {"value": "secundario", "label": "Camino Secundario", "modificador": 1.10, "color": "#C4A574"},
            {"value": "real", "label": "Camino Real", "modificador": 1.25, "color": "#FFD700"},
        ],
        "regiones": [
            {"value": "tierras_libres", "label": "Tierras Libres", "prob_encuentro": 5, "color": "#4ade80"},
            {"value": "tierras_fronterizas", "label": "Tierras Fronterizas", "prob_encuentro": 15, "color": "#facc15"},
            {"value": "tierras_salvajes", "label": "Tierras Salvajes", "prob_encuentro": 25, "color": "#fb923c"},
            {"value": "tierras_sombra", "label": "Tierras de la Sombra", "prob_encuentro": 40, "color": "#f87171"},
            {"value": "tierras_oscuras", "label": "Tierras Oscuras", "prob_encuentro": 60, "color": "#991b1b"},
        ],
    }


@router.post("/travel/find-route")
async def find_alternative_route(origin_id: str, destination_id: str):
    """
    Find alternative route when direct path goes through infranqueable terrain.
    Returns mountain passes and suggested waypoints.
    """
    # Get origin and destination
    origin = await find_location(db, origin_id)
    destination = await find_location(db, destination_id)
    
    if not origin or not destination:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    
    # Get all mountain passes
    passes = await db.locations.find({"es_paso_montana": True}).to_list(50)
    
    # Get all roads that might help
    roads = await db.roads.find({}).to_list(100)
    
    # Simple distance calculation (Euclidean for now)
    def calc_distance(loc1, loc2):
        dx = loc1.get('x', 0) - loc2.get('x', 0)
        dy = loc1.get('y', 0) - loc2.get('y', 0)
        return (dx**2 + dy**2) ** 0.5
    
    # Find passes that are roughly between origin and destination
    relevant_passes = []
    origin_to_dest = calc_distance(origin, destination)
    
    for p in passes:
        origin_to_pass = calc_distance(origin, p)
        pass_to_dest = calc_distance(p, destination)
        
        # Pass is relevant if it doesn't add too much distance (max 50% extra)
        total_via_pass = origin_to_pass + pass_to_dest
        if total_via_pass < origin_to_dest * 1.5:
            p['id'] = str(p.pop('_id'))
            p['distancia_extra_percent'] = round((total_via_pass / origin_to_dest - 1) * 100, 1)
            relevant_passes.append(p)
    
    # Sort by extra distance
    relevant_passes.sort(key=lambda x: x.get('distancia_extra_percent', 100))
    
    return {
        "origen": {"nombre": origin.get('nombre'), "id": origin_id},
        "destino": {"nombre": destination.get('nombre'), "id": destination_id},
        "pasos_sugeridos": relevant_passes[:5],  # Top 5 suggestions
        "mensaje": "Ruta directa bloqueada. Considera usar uno de estos pasos de montaña." if relevant_passes else "No se encontraron pasos de montaña cercanos.",
        "tiene_alternativas": len(relevant_passes) > 0
    }


# ============================================================
# PATH DEBUGGER ENDPOINTS
# ============================================================

class PathPoint(BaseModel):
    x: float
    y: float

class CustomPath(BaseModel):
    origin_id: str
    destination_id: Optional[str] = None
    origin_name: str
    destination_name: Optional[str] = None
    path_points: List[PathPoint]
    total_distance: float
    description: Optional[str] = ""

@router.get("/custom-paths")
async def get_custom_paths():
    """Get all user-defined custom paths"""
    cursor = db.custom_paths.find({}, {"_id": 0})
    paths = await cursor.to_list(length=100)
    return {"paths": paths}

@router.get("/custom-paths/{path_id}")
async def get_custom_path(path_id: str):
    """Get a specific custom path"""
    doc = await db.custom_paths.find_one({"id": path_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Path not found")
    return doc

@router.post("/custom-paths")
async def save_custom_path(data: CustomPath):
    """Save a user-defined custom path"""
    path_id = f"{data.origin_id}_{data.destination_id or 'partial'}_{uuid.uuid4().hex[:8]}"
    
    path_data = {
        "id": path_id,
        "origin_id": data.origin_id,
        "destination_id": data.destination_id,
        "origin_name": data.origin_name,
        "destination_name": data.destination_name,
        "path_points": [p.dict() for p in data.path_points],
        "total_distance": data.total_distance,
        "description": data.description,
        "created_at": now_utc()
    }
    
    await db.custom_paths.insert_one(path_data)
    
    return {"message": "Custom path saved", "id": path_id}

@router.put("/custom-paths/{path_id}")
async def update_custom_path(path_id: str, data: CustomPath):
    """Update an existing custom path"""
    existing = await db.custom_paths.find_one({"id": path_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Path not found")
    
    await db.custom_paths.update_one(
        {"id": path_id},
        {
            "$set": {
                "origin_id": data.origin_id,
                "destination_id": data.destination_id,
                "origin_name": data.origin_name,
                "destination_name": data.destination_name,
                "path_points": [p.dict() for p in data.path_points],
                "total_distance": data.total_distance,
                "description": data.description,
                "updated_at": now_utc()
            }
        }
    )
    
    return {"message": "Custom path updated", "id": path_id}

@router.delete("/custom-paths/{path_id}")
async def delete_custom_path(path_id: str):
    """Delete a custom path"""
    result = await db.custom_paths.delete_one({"id": path_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Path not found")
    return {"message": "Custom path deleted"}

@router.get("/custom-paths/route/{origin_id}/{destination_id}")
async def get_custom_path_for_route(origin_id: str, destination_id: str):
    """Get custom path for a specific origin-destination pair"""
    # Try to find exact match
    doc = await db.custom_paths.find_one(
        {"origin_id": origin_id, "destination_id": destination_id},
        {"_id": 0}
    )
    
    # Also try reverse direction
    if not doc:
        doc = await db.custom_paths.find_one(
            {"origin_id": destination_id, "destination_id": origin_id},
            {"_id": 0}
        )
        # Reverse the path if found in opposite direction
        if doc:
            doc["path_points"] = list(reversed(doc["path_points"]))
    
    if not doc:
        return {"found": False, "path": None}
    
    return {"found": True, "path": doc}
