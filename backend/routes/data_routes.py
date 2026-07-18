"""
Game Data API Routes
Endpoints for retrieving game data (cultures, backgrounds, occupations, etc.)
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
import logging

logger = logging.getLogger(__name__)
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/data", tags=["Game Data"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def now_utc():
    return datetime.now(timezone.utc).isoformat()

# === PYDANTIC MODELS FOR CRUD ===

class RaceCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    imc_min: Optional[float] = 18
    imc_max: Optional[float] = 25

class RaceUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    imc_min: Optional[float] = None
    imc_max: Optional[float] = None

class CultureCreate(BaseModel):
    nombre: str
    raza: str  # Base race (Elfos, Enanos, Hombres, Hobbits, etc.)
    descripcion: Optional[str] = ""
    descripcion_riqueza: Optional[str] = ""
    nivel_vida: Optional[str] = "Común"
    # Physical characteristics
    edad_min: Optional[int] = 20
    edad_max: Optional[int] = 80
    edad_sesgo: Optional[float] = 2.0  # 0=plano · 3=muy joven (curva de juventud)
    altura_min: Optional[int] = 150
    altura_max: Optional[int] = 190
    velocidad: Optional[int] = 9
    descanso: Optional[int] = 8
    tamanio: Optional[str] = "Mediano"
    mod_peso: Optional[int] = 0
    # Attributes
    bonificadores_caracteristicas: Optional[Dict[str, int]] = None
    bonificador_a_eleccion: Optional[bool] = False
    # Skills
    habilidades_puntuaciones: Optional[Dict[str, int]] = None
    # Languages
    idiomas: Optional[List[str]] = []
    # Competencies
    competencias_habilidades: Optional[List[str]] = []
    competencia_herramienta_elegir_1: Optional[List[str]] = []
    competencia_herramienta_elegir_2: Optional[List[str]] = []
    competencia_habilidad_elegir: Optional[List[str]] = []
    competencia_adicional: Optional[str] = ""
    # Physical traits
    rasgos_fisicos: Optional[Dict[str, List[str]]] = None
    # Cultural traits
    rasgos_culturales: Optional[List[str]] = []
    # Specials
    pg_extra_nivel: Optional[int] = 0
    capacidad_carga_x2: Optional[bool] = False
    tiene_virtud_inicial: Optional[bool] = False
    mejora_noldor: Optional[bool] = False
    # NEW: Associated backgrounds
    trasfondos_ids: Optional[List[str]] = []
    # NEW: Virtues configuration
    virtudes_propias: Optional[List[str]] = []  # List of virtue IDs specific to this culture
    copiar_virtudes_de: Optional[str] = ""  # Culture ID to copy virtues from
    permite_virtudes_comunes: Optional[bool] = False  # Can choose common virtues too
    # NEW (it82): texto base editable que se usará al generar retratos IA
    # para personajes de esta cultura. Si está vacío, fallback al diccionario
    # hardcoded de `portrait_routes.build_portrait_prompt`.
    prompt_imagen_ia: Optional[str] = ""

class CultureNamesCreate(BaseModel):
    cultura: str
    hombre: Optional[Dict[str, List[str]]] = None  # {prefijos: [], sufijos: []}
    mujer: Optional[Dict[str, List[str]]] = None
    apellidos: Optional[List[str]] = []


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


# === CULTURES ===

@router.get("/cultures")
async def get_cultures(categoria: Optional[str] = None):
    """Get all cultures, optionally filtered by category (ELFOS, ENANOS, HOMBRES, HOBBITS)"""
    query = {}
    if categoria:
        query["categoria"] = categoria.upper()
    
    cultures = await db.cultures.find(query).to_list(100)
    return {"cultures": serialize_docs(cultures)}


@router.get("/cultures/{culture_id}")
async def get_culture(culture_id: str):
    """Get a specific culture by ID"""
    culture = await db.cultures.find_one({"_id": culture_id})
    if not culture:
        raise HTTPException(status_code=404, detail="Culture not found")
    return serialize_doc(culture)


@router.get("/cultures/categories/list")
async def get_culture_categories():
    """Get list of culture categories"""
    categories = await db.cultures.distinct("categoria")
    return {"categories": [c for c in categories if c]}


# === BACKGROUNDS ===

@router.get("/backgrounds")
async def get_backgrounds(culture_id: Optional[str] = None, cultura: Optional[str] = None):
    """Get backgrounds, optionally filtered by culture"""
    query = {}
    if culture_id:
        query["culture_id"] = culture_id
    if cultura:
        # Case-insensitive search for cultura name
        query["cultura"] = {"$regex": f"^{cultura}$", "$options": "i"}
    
    backgrounds = await db.backgrounds.find(query).to_list(200)
    return {"backgrounds": serialize_docs(backgrounds)}


@router.get("/backgrounds/grouped/by-race")
async def get_backgrounds_grouped():
    """Get backgrounds grouped by race and culture for organized display"""
    # Get all backgrounds
    backgrounds = await db.backgrounds.find({}).to_list(500)
    
    # Get all cultures to map culture name -> race
    cultures = await db.cultures.find({}).to_list(100)
    culture_to_race = {}
    for c in cultures:
        nombre = c.get("nombre", "")
        raza = c.get("raza") or c.get("categoria") or "Otros"
        culture_to_race[nombre.lower()] = raza
    
    # Group backgrounds by race -> culture
    grouped = {}
    for bg in backgrounds:
        cultura = bg.get("cultura", "Sin Cultura")
        # Find the race for this culture
        raza = culture_to_race.get(cultura.lower(), "Otros")
        
        if raza not in grouped:
            grouped[raza] = {}
        if cultura not in grouped[raza]:
            grouped[raza][cultura] = []
        
        grouped[raza][cultura].append(serialize_doc(bg))
    
    # Sort races and cultures alphabetically
    result = {}
    race_order = ["Elfos", "Enanos", "Hobbits", "Hombres", "Otros"]
    for race in race_order:
        if race in grouped:
            result[race] = {}
            for cultura in sorted(grouped[race].keys()):
                result[race][cultura] = grouped[race][cultura]
    
    # Add any races not in our predefined order
    for race in sorted(grouped.keys()):
        if race not in result:
            result[race] = {}
            for cultura in sorted(grouped[race].keys()):
                result[race][cultura] = grouped[race][cultura]
    
    return {"grouped": result, "total": len(backgrounds)}


@router.get("/backgrounds/{background_id}")
async def get_background(background_id: str):
    """Get a specific background by ID"""
    background = await db.backgrounds.find_one({"_id": background_id})
    if not background:
        raise HTTPException(status_code=404, detail="Background not found")
    return serialize_doc(background)


# === OCCUPATIONS ===

@router.get("/occupations")
async def get_occupations():
    """Get all occupations/classes"""
    occupations = await db.occupations.find({}).to_list(20)
    return {"occupations": serialize_docs(occupations)}


@router.get("/occupations/{occupation_id}")
async def get_occupation(occupation_id: str):
    """Get a specific occupation by ID"""
    occupation = await db.occupations.find_one({"_id": occupation_id})
    if not occupation:
        raise HTTPException(status_code=404, detail="Occupation not found")
    return serialize_doc(occupation)


# === VIRTUES ===

@router.get("/virtues")
async def get_virtues(
    culture_id: Optional[str] = None,
    cultura: Optional[str] = None,
    include_common: bool = True
):
    """Get virtues, optionally filtered by culture. By default includes common virtues."""
    query = {}
    
    if culture_id or cultura:
        # Build OR query: specific culture OR common virtues
        conditions = []
        if culture_id:
            conditions.append({"culture_id": culture_id})
        if cultura:
            conditions.append({"cultura": cultura})
        if include_common:
            conditions.append({"es_comun": True})
        query["$or"] = conditions
    
    virtues = await db.virtues.find(query).to_list(200)
    return {"virtues": serialize_docs(virtues)}


@router.get("/virtues/{virtue_id}")
async def get_virtue(virtue_id: str):
    """Get a specific virtue by ID"""
    virtue = await db.virtues.find_one({"_id": virtue_id})
    if not virtue:
        raise HTTPException(status_code=404, detail="Virtue not found")
    return serialize_doc(virtue)


@router.get("/cultures/{culture_id}/virtues")
async def get_culture_virtues(culture_id: str):
    """Get available virtues for a specific culture based on its configuration"""
    culture = await db.cultures.find_one({"_id": culture_id})
    if not culture:
        raise HTTPException(status_code=404, detail="Culture not found")
    
    virtues = []
    virtue_ids = set()
    
    # Get virtues from copied culture
    if culture.get("copiar_virtudes_de"):
        source_culture = await db.cultures.find_one({"_id": culture["copiar_virtudes_de"]})
        if source_culture:
            # Get virtues by type (culture name)
            source_virtues = await db.virtues.find({
                "$or": [
                    {"tipo": source_culture.get("nombre")},
                    {"cultura": source_culture.get("nombre")}
                ]
            }).to_list(100)
            for v in source_virtues:
                if v["_id"] not in virtue_ids:
                    virtues.append(v)
                    virtue_ids.add(v["_id"])
    
    # Get own virtues by IDs
    if culture.get("virtudes_propias"):
        own_virtues = await db.virtues.find({
            "_id": {"$in": culture["virtudes_propias"]}
        }).to_list(100)
        for v in own_virtues:
            if v["_id"] not in virtue_ids:
                virtues.append(v)
                virtue_ids.add(v["_id"])
    
    # Get virtues by culture name (auto-linked)
    culture_virtues = await db.virtues.find({
        "$or": [
            {"tipo": culture.get("nombre")},
            {"cultura": culture.get("nombre")}
        ]
    }).to_list(100)
    for v in culture_virtues:
        if v["_id"] not in virtue_ids:
            virtues.append(v)
            virtue_ids.add(v["_id"])
    
    # Get common virtues if allowed
    if culture.get("permite_virtudes_comunes"):
        common_virtues = await db.virtues.find({
            "$or": [
                {"es_comun": True},
                {"tipo": "COMUNES"}
            ]
        }).to_list(100)
        for v in common_virtues:
            if v["_id"] not in virtue_ids:
                virtues.append(v)
                virtue_ids.add(v["_id"])
    
    # Map virtue fields to frontend-expected names
    def map_virtue(v):
        # Build caracteristicas_fijas from direct increases
        caracteristicas_fijas = {}
        if v.get("aumenta_fuerza"):
            caracteristicas_fijas["fuerza"] = 1
        if v.get("aumenta_destreza"):
            caracteristicas_fijas["destreza"] = 1
        if v.get("aumenta_constitucion"):
            caracteristicas_fijas["constitucion"] = 1
        if v.get("aumenta_inteligencia"):
            caracteristicas_fijas["inteligencia"] = 1
        if v.get("aumenta_sabiduria"):
            caracteristicas_fijas["sabiduria"] = 1
        if v.get("aumenta_carisma"):
            caracteristicas_fijas["carisma"] = 1
        
        return {
            "id": str(v.get("_id")),
            "nombre": v.get("nombre"),
            "cultura": v.get("cultura"),
            "es_comun": v.get("es_comun", False),
            "tipo": v.get("cultura") if v.get("cultura") else ("COMUNES" if v.get("es_comun") else None),
            "descripcion": v.get("descripcion"),
            "rasgos_virtud": v.get("rasgos"),
            "competencias_texto": v.get("rasgos"),  # Legacy field
            # Stat bonuses
            "caracteristicas_fijas": caracteristicas_fijas if caracteristicas_fijas else None,
            "caracteristicas_elegir": v.get("elegir_caracteristica"),
            # Saving throw proficiencies
            "salvaciones_elegir": v.get("elegir_salvacion"),
            # Extra stats
            "puntos_golpe_extra": v.get("bonus_puntos_golpe") or 0,
            "puntos_comunidad_extra": v.get("bonus_comunidad") or 0,
            "clase_armadura_extra": v.get("bonus_ca") or 0,
            # Skill/tool proficiencies to choose
            "competencias_habilidades_elegir": v.get("elegir_habilidad"),
            "competencias_herramientas_elegir": v.get("elegir_herramienta"),
            # Reglas especiales (flags) para el asistente de creación
            "otorga_pericia": v.get("otorga_pericia", False),
            "perfeccionamiento": v.get("perfeccionamiento", False),
            "pg_por_nivel": v.get("pg_por_nivel", False),
            "bonus_dano_fuerza": v.get("bonus_dano_fuerza") or 0,
        }
    
    mapped_virtues = [map_virtue(v) for v in virtues]
    
    return {
        "culture_id": culture_id,
        "culture_name": culture.get("nombre"),
        "tiene_virtud_inicial": culture.get("tiene_virtud_inicial", False),
        "permite_virtudes_comunes": culture.get("permite_virtudes_comunes", False),
        "virtues": mapped_virtues
    }


# === ARTS ===

@router.get("/arts")
async def get_arts():
    """Get all arts/magic abilities"""
    arts = await db.arts.find({}).to_list(50)
    return {"arts": serialize_docs(arts)}


@router.get("/arts/{art_id}")
async def get_art(art_id: str):
    """Get a specific art by ID"""
    art = await db.arts.find_one({"_id": art_id})
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")
    return serialize_doc(art)


# === PATRONS ===
# (CRUD endpoints moved to routes/patrons_routes.py)


# === MECENAS (Spanish version of Patrons) ===

@router.get("/mecenas")
async def get_mecenas():
    """Get all mecenas (patrons in Spanish)"""
    mecenas_list = await db.mecenas.find({}).to_list(50)
    return {"mecenas": serialize_docs(mecenas_list)}


@router.get("/mecenas/{mecenas_id}")
async def get_mecenas_by_id(mecenas_id: str):
    """Get a specific mecenas by ID"""
    mecenas = await db.mecenas.find_one({"_id": mecenas_id})
    if not mecenas:
        raise HTTPException(status_code=404, detail="Mecenas not found")
    return serialize_doc(mecenas)


# === EQUIPMENT ===

@router.get("/equipment")
async def get_equipment(tipo: Optional[str] = None):
    """Get general equipment items"""
    query = {}
    if tipo:
        query["tipo"] = tipo
    
    equipment = await db.equipment.find(query).to_list(500)
    return {"equipment": serialize_docs(equipment)}


@router.get("/weapons")
async def get_weapons():
    """Get all weapons"""
    weapons = await db.weapons.find({}).to_list(100)
    return {"weapons": serialize_docs(weapons)}


@router.get("/weapons/{weapon_id}")
async def get_weapon(weapon_id: str):
    """Get a specific weapon by ID"""
    weapon = await db.weapons.find_one({"_id": weapon_id})
    if not weapon:
        raise HTTPException(status_code=404, detail="Weapon not found")
    return serialize_doc(weapon)


@router.get("/armors")
async def get_armors():
    """Get all armors"""
    armors = await db.armors.find({}).to_list(50)
    return {"armors": serialize_docs(armors)}


@router.get("/armors/{armor_id}")
async def get_armor(armor_id: str):
    """Get a specific armor by ID"""
    armor = await db.armors.find_one({"_id": armor_id})
    if not armor:
        raise HTTPException(status_code=404, detail="Armor not found")
    return serialize_doc(armor)


@router.get("/tools")
async def get_tools():
    """Get all tools"""
    tools = await db.tools.find({}).to_list(100)
    return {"tools": serialize_docs(tools)}


# === SHADOW RULES ===

@router.get("/shadow-rules")
async def get_shadow_rules():
    """Get shadow/corruption rules"""
    rules = await db.shadow_rules.find_one({})
    if rules:
        return serialize_doc(rules)
    return {"fuentes_pavor": [], "fuentes_avaricia": [], "fuentes_desesperacion": []}


# === NAME GENERATION ===

@router.get("/names/{cultura}")
async def get_culture_names(cultura: str):
    """Get name generation data for a specific culture"""
    # Case-insensitive search
    names = await db.culture_names.find_one({"cultura": {"$regex": f"^{cultura}$", "$options": "i"}})
    if not names:
        raise HTTPException(status_code=404, detail="Name data not found for this culture")
    return serialize_doc(names)


@router.get("/names")
async def get_all_culture_names():
    """Get all culture name data"""
    names = await db.culture_names.find({}).to_list(50)
    return {"names": serialize_docs(names)}



# === EQUIPMENT LISTS (Instruments, Games) ===

@router.get("/equipment-lists")
async def get_equipment_lists():
    """Get special equipment lists (instruments, games) from equipment catalog"""
    # Get from equipment catalog
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        catalog = await db.equipment_catalog.find_one({})
    
    if catalog:
        return {
            "juegos": [item.get("nombre") for item in catalog.get("juegos", [])],
            "instrumentos_musicales": [item.get("nombre") for item in catalog.get("instrumentos_musicales", [])]
        }
    return {"juegos": [], "instrumentos_musicales": []}


# === CRUD: RACES ===

@router.get("/races")
async def get_races():
    """Get all races"""
    races = await db.races.find({}).to_list(50)
    return {"races": serialize_docs(races)}

@router.post("/races")
async def create_race(data: RaceCreate):
    """Create a new race (admin only)"""
    # Check if race already exists
    existing = await db.races.find_one({"nombre": {"$regex": f"^{data.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una raza con ese nombre")
    
    race = {
        "_id": str(uuid.uuid4()),
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "imc": {"min": data.imc_min, "max": data.imc_max},
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
    await db.races.insert_one(race)
    return serialize_doc(race)

@router.put("/races/{race_id}")
async def update_race(race_id: str, data: RaceUpdate):
    """Update a race (admin only)"""
    race = await db.races.find_one({"_id": race_id})
    if not race:
        raise HTTPException(status_code=404, detail="Raza no encontrada")
    
    update = {"updated_at": now_utc()}
    if data.nombre is not None:
        update["nombre"] = data.nombre
    if data.descripcion is not None:
        update["descripcion"] = data.descripcion
    if data.imc_min is not None or data.imc_max is not None:
        update["imc"] = {
            "min": data.imc_min if data.imc_min is not None else race.get("imc", {}).get("min", 18),
            "max": data.imc_max if data.imc_max is not None else race.get("imc", {}).get("max", 25)
        }
    
    await db.races.update_one({"_id": race_id}, {"$set": update})
    updated = await db.races.find_one({"_id": race_id})
    return serialize_doc(updated)

@router.delete("/races/{race_id}")
async def delete_race(race_id: str):
    """Delete a race (admin only)"""
    result = await db.races.delete_one({"_id": race_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Raza no encontrada")
    return {"message": "Raza eliminada correctamente"}


# === CRUD: CULTURES ===

@router.post("/cultures")
async def create_culture(data: CultureCreate):
    """Create a new culture (admin only)"""
    # Check if culture already exists
    existing = await db.cultures.find_one({"nombre": {"$regex": f"^{data.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una cultura con ese nombre")
    
    # Build culture document with all fields
    culture = {
        "_id": str(uuid.uuid4()),
        "nombre": data.nombre,
        "raza": data.raza,
        "categoria": data.raza.upper(),
        "descripcion": data.descripcion,
        "descripcion_riqueza": data.descripcion_riqueza,
        "nivel_vida": data.nivel_vida,
        "riqueza": data.nivel_vida,
        # Physical
        "edad_min": data.edad_min,
        "edad_max": data.edad_max,
        "edad_sesgo": data.edad_sesgo,
        "altura_min": data.altura_min,
        "altura_max": data.altura_max,
        "velocidad": data.velocidad,
        "descanso": data.descanso,
        "tamanio": data.tamanio,
        "mod_peso": data.mod_peso,
        # Attributes
        "bonificadores_caracteristicas": data.bonificadores_caracteristicas or {
            "fuerza": 0, "destreza": 0, "constitucion": 0,
            "inteligencia": 0, "sabiduria": 0, "carisma": 0
        },
        "bonificador_a_eleccion": data.bonificador_a_eleccion,
        # Skills
        "habilidades_puntuaciones": data.habilidades_puntuaciones or {},
        # Languages
        "idiomas": data.idiomas,
        # Competencies
        "competencias_habilidades": data.competencias_habilidades,
        "competencia_herramienta_elegir_1": data.competencia_herramienta_elegir_1,
        "competencia_herramienta_elegir_2": data.competencia_herramienta_elegir_2,
        "competencia_habilidad_elegir": data.competencia_habilidad_elegir,
        "competencia_adicional": data.competencia_adicional,
        # Physical traits
        "rasgos_fisicos": data.rasgos_fisicos or {"ojos": [], "piel": [], "pelo": []},
        # Cultural traits
        "rasgos_culturales": data.rasgos_culturales,
        # Specials
        "pg_extra_nivel": data.pg_extra_nivel,
        "capacidad_carga_x2": data.capacidad_carga_x2,
        "tiene_virtud_inicial": data.tiene_virtud_inicial,
        "mejora_noldor": data.mejora_noldor,
        # NEW: Associated backgrounds
        "trasfondos_ids": data.trasfondos_ids,
        # NEW: Virtues configuration
        "virtudes_propias": data.virtudes_propias,
        "copiar_virtudes_de": data.copiar_virtudes_de,
        "permite_virtudes_comunes": data.permite_virtudes_comunes,
        # Metadata
        "is_custom": True,
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
    
    await db.cultures.insert_one(culture)
    return serialize_doc(culture)

@router.put("/cultures/{culture_id}")
async def update_culture(culture_id: str, data: dict = Body(...)):
    """Update a culture (admin only)"""
    culture = await db.cultures.find_one({"_id": culture_id})
    if not culture:
        raise HTTPException(status_code=404, detail="Cultura no encontrada")
    
    # Update only provided fields
    update = {"updated_at": now_utc()}
    for key, value in data.items():
        if key not in ["_id", "id", "created_at"]:
            update[key] = value
    
    await db.cultures.update_one({"_id": culture_id}, {"$set": update})
    updated = await db.cultures.find_one({"_id": culture_id})
    return serialize_doc(updated)

@router.delete("/cultures/{culture_id}")
async def delete_culture(culture_id: str):
    """Delete a culture (admin only)"""
    result = await db.cultures.delete_one({"_id": culture_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cultura no encontrada")
    # Also delete associated names
    await db.culture_names.delete_many({"cultura": culture_id})
    return {"message": "Cultura eliminada correctamente"}

@router.post("/cultures/{culture_id}/copy")
async def copy_culture(culture_id: str, new_name: str = Body(..., embed=True)):
    """Copy an existing culture with a new name (admin only)"""
    culture = await db.cultures.find_one({"_id": culture_id})
    if not culture:
        raise HTTPException(status_code=404, detail="Cultura no encontrada")
    
    # Check if new name already exists
    existing = await db.cultures.find_one({"nombre": {"$regex": f"^{new_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una cultura con ese nombre")
    
    # Create copy
    new_id = str(uuid.uuid4())
    new_culture = {**culture}
    new_culture["_id"] = new_id
    new_culture["nombre"] = new_name
    new_culture["is_custom"] = True
    new_culture["created_at"] = now_utc()
    new_culture["updated_at"] = now_utc()
    
    await db.cultures.insert_one(new_culture)
    
    # Copy names if they exist
    original_names = await db.culture_names.find_one({"cultura": culture["nombre"]})
    if original_names:
        new_names = {**original_names}
        new_names["_id"] = str(uuid.uuid4())
        new_names["cultura"] = new_name
        new_names["created_at"] = now_utc()
        new_names["updated_at"] = now_utc()
        await db.culture_names.insert_one(new_names)
    
    return serialize_doc(new_culture)

@router.post("/culture-names")
async def create_culture_names(data: CultureNamesCreate):
    """Create or update name data for a culture (admin only)"""
    # Upsert - update if exists, create if not
    names_doc = {
        "cultura": data.cultura,
        "hombre": data.hombre or {"prefijos": [], "sufijos": []},
        "mujer": data.mujer or {"prefijos": [], "sufijos": []},
        "apellidos": data.apellidos,
        "updated_at": now_utc()
    }
    
    existing = await db.culture_names.find_one({"cultura": data.cultura})
    if existing:
        await db.culture_names.update_one({"cultura": data.cultura}, {"$set": names_doc})
        names_doc["_id"] = existing["_id"]
    else:
        names_doc["_id"] = str(uuid.uuid4())
        names_doc["created_at"] = now_utc()
        await db.culture_names.insert_one(names_doc)
    
    return serialize_doc(names_doc)


# === CRUD: BACKGROUNDS ===

class BackgroundCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    competencias_habilidades_auto: Optional[List[str]] = []
    competencias_habilidades_elegir: Optional[List[str]] = []
    competencias_herramientas_1: Optional[List[str]] = []
    competencias_herramientas_2: Optional[List[str]] = []
    rasgos_descripciones: Optional[List[str]] = []
    cultura: Optional[str] = None  # Link to culture

@router.post("/backgrounds")
async def create_background(data: BackgroundCreate):
    """Create a new background (admin only)"""
    existing = await db.backgrounds.find_one({"nombre": {"$regex": f"^{data.nombre}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un trasfondo con ese nombre")
    
    background = {
        "_id": str(uuid.uuid4()),
        "nombre": data.nombre,
        "descripcion": data.descripcion,
        "competencias_habilidades_auto": data.competencias_habilidades_auto,
        "competencias_habilidades_elegir": data.competencias_habilidades_elegir,
        "competencias_herramientas_1": data.competencias_herramientas_1,
        "competencias_herramientas_2": data.competencias_herramientas_2,
        "rasgos_descripciones": data.rasgos_descripciones,
        "cultura": data.cultura,
        "is_custom": True,
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
    
    await db.backgrounds.insert_one(background)
    return serialize_doc(background)

@router.put("/backgrounds/{background_id}")
async def update_background(background_id: str, data: dict = Body(...)):
    """Update a background (admin only)"""
    bg = await db.backgrounds.find_one({"_id": background_id})
    if not bg:
        raise HTTPException(status_code=404, detail="Trasfondo no encontrado")
    
    update = {"updated_at": now_utc()}
    for key, value in data.items():
        if key not in ["_id", "id", "created_at"]:
            update[key] = value
    
    await db.backgrounds.update_one({"_id": background_id}, {"$set": update})
    updated = await db.backgrounds.find_one({"_id": background_id})
    return serialize_doc(updated)

@router.delete("/backgrounds/{background_id}")
async def delete_background(background_id: str):
    """Delete a background (admin only)"""
    result = await db.backgrounds.delete_one({"_id": background_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trasfondo no encontrado")
    return {"message": "Trasfondo eliminado correctamente"}

@router.post("/backgrounds/{background_id}/copy")
async def copy_background(background_id: str, new_name: str = Body(..., embed=True)):
    """Copy an existing background with a new name (admin only)"""
    bg = await db.backgrounds.find_one({"_id": background_id})
    if not bg:
        raise HTTPException(status_code=404, detail="Trasfondo no encontrado")
    
    existing = await db.backgrounds.find_one({"nombre": {"$regex": f"^{new_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un trasfondo con ese nombre")
    
    new_bg = {**bg}
    new_bg["_id"] = str(uuid.uuid4())
    new_bg["nombre"] = new_name
    new_bg["is_custom"] = True
    new_bg["created_at"] = now_utc()
    new_bg["updated_at"] = now_utc()
    
    await db.backgrounds.insert_one(new_bg)
    return serialize_doc(new_bg)


class CopyBackgroundsRequest(BaseModel):
    """Request model for copying backgrounds to another culture"""
    background_ids: List[str]  # List of background IDs to copy
    target_cultura: str  # Target culture name
    source_cultura: Optional[str] = None  # Source culture (for "copy all from culture")


@router.post("/backgrounds/copy-to-culture")
async def copy_backgrounds_to_culture(data: CopyBackgroundsRequest):
    """Copy one or more backgrounds to another culture (admin only)"""
    if not data.background_ids and not data.source_cultura:
        raise HTTPException(status_code=400, detail="Debes especificar trasfondos o una cultura origen")
    
    # If source culture is specified, get all backgrounds from that culture
    backgrounds_to_copy = []
    if data.source_cultura:
        source_bgs = await db.backgrounds.find({"cultura": data.source_cultura}).to_list(100)
        backgrounds_to_copy = source_bgs
    else:
        # Get specific backgrounds by ID
        for bg_id in data.background_ids:
            bg = await db.backgrounds.find_one({"_id": bg_id})
            if bg:
                backgrounds_to_copy.append(bg)
    
    if not backgrounds_to_copy:
        raise HTTPException(status_code=404, detail="No se encontraron trasfondos para copiar")
    
    # Get existing backgrounds in target culture to avoid duplicates
    existing_in_target = await db.backgrounds.find({"cultura": data.target_cultura}).to_list(100)
    existing_names = set(bg["nombre"] for bg in existing_in_target)
    
    copied_count = 0
    skipped_count = 0
    copied_backgrounds = []
    
    for bg in backgrounds_to_copy:
        # Check if a background with the same name already exists in target culture
        if bg["nombre"] in existing_names:
            skipped_count += 1
            continue
        
        # Create a copy with new ID and target culture
        new_bg = {**bg}
        new_bg["_id"] = str(uuid.uuid4())
        new_bg["cultura"] = data.target_cultura
        new_bg["is_custom"] = True
        new_bg["created_at"] = now_utc()
        new_bg["updated_at"] = now_utc()
        # Remove ObjectId if present
        new_bg.pop("id", None)
        
        await db.backgrounds.insert_one(new_bg)
        copied_backgrounds.append(serialize_doc(new_bg))
        copied_count += 1
    
    return {
        "message": f"Se copiaron {copied_count} trasfondos. {skipped_count} omitidos (ya existían).",
        "copied_count": copied_count,
        "skipped_count": skipped_count,
        "copied_backgrounds": copied_backgrounds
    }


# === CRUD: OCCUPATIONS ===

class OccupationCreate(BaseModel):
    vocacion: str
    descripcion_corta: Optional[str] = ""
    descripcion_ocupacion_larga: Optional[str] = ""
    dado_golpe: Optional[str] = "1d8"
    puntos_golpe_base: Optional[int] = 8
    caracteristicas_principales: Optional[List[str]] = []
    tiradas_salvacion: Optional[List[str]] = []
    competencia_armas: Optional[List[str]] = []
    competencia_armaduras: Optional[List[str]] = []
    habilidades_favorecidas: Optional[List[str]] = []
    maldicion_nombre: Optional[str] = ""
    maldicion_descripcion: Optional[str] = ""
    especiales_ocupacion1: Optional[str] = ""
    especiales_ocupacion1_descripcion: Optional[str] = ""
    especiales_ocupacion2: Optional[str] = ""
    especiales_ocupacion2_descripcion: Optional[str] = ""
    especiales_ocupacion3: Optional[str] = ""
    especiales_ocupacion3_descripcion: Optional[str] = ""
    especiales_ocupacion4: Optional[str] = ""
    especiales_ocupacion4_descripcion: Optional[str] = ""
    especiales_ocupacion5: Optional[str] = ""
    especiales_ocupacion5_descripcion: Optional[str] = ""
    especiales_ocupacion6: Optional[str] = ""
    especiales_ocupacion6_descripcion: Optional[str] = ""

@router.post("/occupations")
async def create_occupation(data: OccupationCreate):
    """Create a new occupation (admin only)"""
    existing = await db.occupations.find_one({"vocacion": {"$regex": f"^{data.vocacion}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una ocupación con ese nombre")
    
    occupation = {
        "_id": str(uuid.uuid4()),
        "vocacion": data.vocacion,
        "descripcion_corta": data.descripcion_corta,
        "descripcion_ocupacion_larga": data.descripcion_ocupacion_larga,
        "dado_golpe": data.dado_golpe,
        "puntos_golpe_base": data.puntos_golpe_base,
        "caracteristicas_principales": data.caracteristicas_principales,
        "tiradas_salvacion": data.tiradas_salvacion,
        "competencia_armas": data.competencia_armas,
        "competencia_armaduras": data.competencia_armaduras,
        "habilidades_favorecidas": data.habilidades_favorecidas,
        "maldicion_nombre": data.maldicion_nombre,
        "maldicion_descripcion": data.maldicion_descripcion,
        "especiales_ocupacion1": data.especiales_ocupacion1,
        "especiales_ocupacion1_descripcion": data.especiales_ocupacion1_descripcion,
        "especiales_ocupacion2": data.especiales_ocupacion2,
        "especiales_ocupacion2_descripcion": data.especiales_ocupacion2_descripcion,
        "especiales_ocupacion3": data.especiales_ocupacion3,
        "especiales_ocupacion3_descripcion": data.especiales_ocupacion3_descripcion,
        "especiales_ocupacion4": data.especiales_ocupacion4,
        "especiales_ocupacion4_descripcion": data.especiales_ocupacion4_descripcion,
        "especiales_ocupacion5": data.especiales_ocupacion5,
        "especiales_ocupacion5_descripcion": data.especiales_ocupacion5_descripcion,
        "especiales_ocupacion6": data.especiales_ocupacion6,
        "especiales_ocupacion6_descripcion": data.especiales_ocupacion6_descripcion,
        "is_custom": True,
        "created_at": now_utc(),
        "updated_at": now_utc()
    }
    
    await db.occupations.insert_one(occupation)
    return serialize_doc(occupation)

@router.put("/occupations/{occupation_id}")
async def update_occupation(occupation_id: str, data: dict = Body(...)):
    """Update an occupation (admin only)"""
    occ = await db.occupations.find_one({"_id": occupation_id})
    if not occ:
        raise HTTPException(status_code=404, detail="Ocupación no encontrada")
    
    update = {"updated_at": now_utc()}
    for key, value in data.items():
        if key not in ["_id", "id", "created_at"]:
            update[key] = value
    
    await db.occupations.update_one({"_id": occupation_id}, {"$set": update})
    updated = await db.occupations.find_one({"_id": occupation_id})
    return serialize_doc(updated)

@router.delete("/occupations/{occupation_id}")
async def delete_occupation(occupation_id: str):
    """Delete an occupation (admin only)"""
    result = await db.occupations.delete_one({"_id": occupation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ocupación no encontrada")
    return {"message": "Ocupación eliminada correctamente"}

@router.post("/occupations/{occupation_id}/copy")
async def copy_occupation(occupation_id: str, new_name: str = Body(..., embed=True)):
    """Copy an existing occupation with a new name (admin only)"""
    occ = await db.occupations.find_one({"_id": occupation_id})
    if not occ:
        raise HTTPException(status_code=404, detail="Ocupación no encontrada")
    
    existing = await db.occupations.find_one({"vocacion": {"$regex": f"^{new_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una ocupación con ese nombre")
    
    new_occ = {**occ}
    new_occ["_id"] = str(uuid.uuid4())
    new_occ["vocacion"] = new_name
    new_occ["is_custom"] = True
    new_occ["created_at"] = now_utc()
    new_occ["updated_at"] = now_utc()
    
    await db.occupations.insert_one(new_occ)
    return serialize_doc(new_occ)

async def get_equipment_lists():
    """Get special equipment lists (instruments, games)"""
    lists = await db.equipment_lists.find_one({})
    if lists:
        return serialize_doc(lists)
    return {"juegos": [], "instrumentos_musicales": []}


# === TRAIT DESCRIPTIONS ===

@router.get("/trait-descriptions")
async def get_trait_descriptions():
    """Get all personality trait descriptions"""
    data = await db.trait_descriptions.find_one({})
    if data:
        return data.get('descriptions', {})
    return {}


# === EQUIPMENT CATALOG (Full with prices and weights) ===

@router.get("/equipment-catalog")
async def get_equipment_catalog(
    categoria: Optional[str] = None,
    search: Optional[str] = None
):
    """Get full equipment catalog with prices and weights.
    Now includes ALL categories:
    - Weapons: armas_sencillas_cc, armas_sencillas_distancia, armas_marciales_cc, armas_marciales_distancia
    - Armors: armaduras_ligeras, armaduras_medias, armaduras_pesadas, escudos
    - Equipment: herramientas, juegos, instrumentos_musicales, equipo_general
    - Food: consumibles, comida_posadas
    - Medical: hierbas, venenos
    - Transport: monturas, accesorios_monturas, transporte_terrestre, transporte_maritimo
    - Construction: construccion
    """
    # Try to get the updated catalog first
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        # Fallback to any catalog
        catalog = await db.equipment_catalog.find_one({})
    if not catalog:
        return {
            "herramientas": [],
            "juegos": [],
            "instrumentos_musicales": [],
            "equipo_general": [],
            "consumibles": [],
            "comida_posadas": [],
            "hierbas": [],
            "venenos": [],
            "armas_sencillas_cc": [],
            "armas_sencillas_distancia": [],
            "armas_marciales_cc": [],
            "armas_marciales_distancia": [],
            "armaduras_ligeras": [],
            "armaduras_medias": [],
            "armaduras_pesadas": [],
            "escudos": [],
            "yelmos": [],
            "monturas": [],
            "accesorios_monturas": [],
            "transporte_terrestre": [],
            "transporte_maritimo": [],
            "recursos_desarrollo": []
        }
    
    # Build full result from catalog
    all_keys = [
        "herramientas", "juegos", "instrumentos_musicales", "equipo_general",
        "ropa",
        "consumibles", "comida_posadas", "hierbas", "venenos",
        "armas_sencillas_cc", "armas_sencillas_distancia", "armas_marciales_cc", "armas_marciales_distancia",
        "armaduras_ligeras", "armaduras_medias", "armaduras_pesadas", "escudos", "yelmos",
        "monturas", "accesorios_monturas", "transporte_terrestre", "transporte_maritimo",
        "recursos_desarrollo", "gemas_preciosas", "gemas_semipreciosas"
    ]
    
    result = {key: catalog.get(key, []) for key in all_keys}

    # Categorías personalizadas (grupos creados por el Maestro). Cada def:
    #   {key, name, fields:[...], section:"<título sección>"|"__root__", icono}
    custom_cats = catalog.get("_custom_categories", []) or []
    for cc in custom_cats:
        ck = cc.get("key")
        if ck and ck not in result:
            result[ck] = catalog.get(ck, [])

    # Profesiones por bloque (para herencia en la tienda)
    block_prof = catalog.get("_block_profesiones", {})
    # Regiones/asentamiento por bloque (herencia independiente de las profesiones)
    block_reg = catalog.get("_block_regiones", {})

    # Filter by category if specified
    if categoria and categoria in result:
        result = {categoria: result[categoria]}
    
    # Filter by search if specified
    if search:
        search_lower = search.lower()
        for key in result:
            result[key] = [
                item for item in result[key]
                if search_lower in item.get('nombre', '').lower()
            ]
    
    result["_block_profesiones"] = block_prof
    result["_block_regiones"] = block_reg
    result["_custom_categories"] = custom_cats
    return result


@router.get("/equipment/block-profesiones")
async def get_block_profesiones():
    """Devuelve las profesiones asignadas por bloque/categoría."""
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    return (catalog or {}).get("_block_profesiones", {})


@router.put("/equipment/block-profesiones")
async def update_block_profesiones(payload: dict = Body(...)):
    """Guarda el mapa {categoria: [profesiones]} de profesiones por bloque."""
    data = payload.get("block_profesiones", payload) or {}
    # Normaliza: solo listas de strings
    clean = {str(k): [str(p) for p in (v or [])] for k, v in data.items() if isinstance(v, list)}
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"_block_profesiones": clean, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"message": "Profesiones por bloque guardadas", "block_profesiones": clean}


@router.get("/equipment/block-regiones")
async def get_block_regiones():
    """Devuelve las regiones/asentamientos por defecto de cada bloque/categoría.

    Forma: { categoria: { regiones_disponibles: [...], nivel_asentamiento: [...] } }
    Los objetos sin regiones/asentamiento propios heredan estos valores del bloque.
    """
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    return (catalog or {}).get("_block_regiones", {})


@router.put("/equipment/block-regiones")
async def update_block_regiones(payload: dict = Body(...)):
    """Guarda el mapa {categoria: {regiones_disponibles:[], nivel_asentamiento:[]}}."""
    data = payload.get("block_regiones", payload) or {}
    clean = {}
    for cat, val in data.items():
        if not isinstance(val, dict):
            continue
        clean[str(cat)] = {
            "regiones_disponibles": [str(r) for r in (val.get("regiones_disponibles") or [])],
            "nivel_asentamiento": [str(n) for n in (val.get("nivel_asentamiento") or [])],
        }
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"_block_regiones": clean, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"message": "Regiones por bloque guardadas", "block_regiones": clean}



# Profesiones por defecto sugeridas para cada bloque/categoría de equipo.
DEFAULT_BLOCK_PROFESIONES = {
    "armas_sencillas_cc": ["Herrero", "Herrero aprendiz", "Enano Herrero", "Mercader"],
    "armas_sencillas_distancia": ["Herrero", "Cazador", "Arquero de élite", "Mercader"],
    "armas_marciales_cc": ["Herrero", "Enano Herrero", "Caballero de Gondor", "Capitán de la guardia"],
    "armas_marciales_distancia": ["Herrero", "Arquero de élite", "Cazador", "Enano Herrero"],
    "armaduras_ligeras": ["Herrero", "Enano Herrero", "Mercader"],
    "armaduras_medias": ["Herrero", "Enano Herrero"],
    "armaduras_pesadas": ["Herrero", "Enano Herrero", "Caballero de Gondor"],
    "escudos": ["Herrero", "Enano Herrero", "Carpintero"],
    "equipo_general": ["Mercader", "Posadero", "Hobbit Posadero", "Explorador / Rastreador"],
    "herramientas": ["Herrero", "Carpintero", "Albañil", "Mercader", "Enano Herrero"],
    "juegos": ["Mercader", "Posadero", "Hobbit Posadero"],
    "instrumentos_musicales": ["Músico / Juglar", "Mercader", "Elfo Artesano"],
    "ropa": ["Mercader", "Elfo Artesano"],
    "consumibles": ["Mercader", "Posadero", "Hobbit Posadero", "Campesino"],
    "comida_posadas": ["Posadero", "Hobbit Posadero", "Campesino"],
    "hierbas": ["Sanador / Herbalista", "Explorador / Rastreador"],
    "venenos": ["Delincuente", "Atracador", "Salteador de caminos", "Sanador / Herbalista"],
    "monturas": ["Mozo de cuadra", "Mercader"],
    "accesorios_monturas": ["Mozo de cuadra", "Carpintero", "Mercader"],
    "transporte_terrestre": ["Carpintero", "Mercader", "Mozo de cuadra"],
    "transporte_maritimo": ["Barquero / Remero", "Carpintero", "Mercader"],
    "recursos_desarrollo": ["Albañil", "Peón de construcción", "Mercader", "Leñador", "Señor de una aldea"],
    "gemas_preciosas": ["Mercader", "Príncipe o noble", "Elfo Artesano"],
    "gemas_semipreciosas": ["Mercader", "Elfo Artesano"],
}


@router.post("/equipment/block-profesiones/auto-defaults")
async def auto_assign_block_profesiones(payload: dict = Body(default={})):
    """Auto-asigna profesiones por defecto a los bloques de equipo.

    payload.solo_vacios (bool, default True): si True, solo rellena los bloques
    que aún no tienen profesiones asignadas; si False, sobrescribe todos.
    """
    solo_vacios = payload.get("solo_vacios", True) if isinstance(payload, dict) else True
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    current = (catalog or {}).get("_block_profesiones", {}) or {}

    result = dict(current)
    cambiados = 0
    for cat, profs in DEFAULT_BLOCK_PROFESIONES.items():
        existente = current.get(cat) or []
        if solo_vacios and existente:
            continue
        result[cat] = list(profs)
        cambiados += 1

    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"_block_profesiones": result, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {
        "message": f"Profesiones por defecto asignadas a {cambiados} bloque(s)",
        "block_profesiones": result,
        "bloques_actualizados": cambiados,
    }



# === FOOD/WATER ITEM MANAGEMENT ===

class FoodWaterUpdate(BaseModel):
    nombre: str
    categoria: str
    es_comida: bool = False
    es_agua: bool = False
    porcentaje_racion: int = 100  # 100% = full ration, 50% = half ration
    litros: float = 0  # For water items

class BulkFoodWaterUpdate(BaseModel):
    items: List[FoodWaterUpdate]

@router.put("/equipment-catalog/food-water")
async def update_food_water_items(request: BulkFoodWaterUpdate):
    """Update multiple items with food/water properties"""
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        catalog = await db.equipment_catalog.find_one({})
    if not catalog:
        raise HTTPException(status_code=404, detail="Equipment catalog not found")
    
    updated_count = 0
    
    for update in request.items:
        categoria = update.categoria
        if categoria not in catalog:
            continue
        
        items = catalog.get(categoria, [])
        for i, item in enumerate(items):
            if item.get('nombre') == update.nombre:
                items[i]['es_comida'] = update.es_comida
                items[i]['es_agua'] = update.es_agua
                items[i]['porcentaje_racion'] = update.porcentaje_racion
                items[i]['litros'] = update.litros
                updated_count += 1
                break
        
        catalog[categoria] = items
    
    # Save updated catalog
    await db.equipment_catalog.update_one(
        {"_id": catalog.get("_id", "main")},
        {"$set": catalog}
    )
    
    return {"success": True, "updated": updated_count}

class MoveItemRequest(BaseModel):
    nombre: str
    from_categoria: str
    to_categoria: str
    item_data: Optional[dict] = None  # Additional item data to update
    # When True, the moved item will be REPLACED with `item_data` instead
    # of merged. Used by "Cambiar categoría" so that fields specific to the
    # original category (dano, CA, alcance…) get dropped — the user must
    # re-enter them in the new category's editor.
    replace: bool = False

@router.put("/equipment-catalog/move-item")
async def move_equipment_item(request: MoveItemRequest):
    """Move an item from one category to another.

    Matching is **case-insensitive and Unicode-normalised** so that minor
    differences (NFC vs NFD accents, capitalisation) don't break the move.
    If the exact name doesn't match, falls back to the FIRST item whose
    normalised name starts with the requested name (handles cases where
    the user shortened the name in the editor without saving first).
    """
    import unicodedata
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        catalog = await db.equipment_catalog.find_one({})
    if not catalog:
        raise HTTPException(status_code=404, detail="Equipment catalog not found")

    def norm(s: str) -> str:
        return unicodedata.normalize('NFC', (s or '').strip().casefold())

    target = norm(request.nombre)

    # Find and remove item from source category
    source_items = catalog.get(request.from_categoria, [])
    item_to_move = None
    found_idx = None

    # 1) Exact normalised match
    for i, item in enumerate(source_items):
        if norm(item.get('nombre', '')) == target:
            found_idx = i
            break
    # 2) Prefix fallback (handles in-editor renames like
    #    "Raciones (1 día) (Paquete de 10)" → "Raciones (1 día)")
    if found_idx is None:
        candidates = [
            i for i, it in enumerate(source_items)
            if norm(it.get('nombre', '')).startswith(target) and target
        ]
        if len(candidates) == 1:
            found_idx = candidates[0]

    if found_idx is not None:
        item_to_move = source_items.pop(found_idx)

    if not item_to_move:
        available = [it.get('nombre', '?') for it in source_items[:5]]
        raise HTTPException(
            status_code=404,
            detail=(
                f"Item '{request.nombre}' no encontrado en '{request.from_categoria}'. "
                f"Primeros items disponibles: {available}. "
                "Pista: si renombraste el item antes de mover, guarda primero o usa el nombre original."
            ),
        )
    
    # Apply the new data: either fully replace (drop old fields) or merge.
    if request.item_data:
        if request.replace:
            item_to_move = dict(request.item_data)
        else:
            item_to_move.update(request.item_data)
    
    # Add to destination category
    dest_items = catalog.get(request.to_categoria, [])
    dest_items.append(item_to_move)
    
    # Update catalog
    catalog[request.from_categoria] = source_items
    catalog[request.to_categoria] = dest_items
    
    await db.equipment_catalog.update_one(
        {"_id": catalog.get("_id", "main")},
        {"$set": {
            request.from_categoria: source_items,
            request.to_categoria: dest_items
        }}
    )
    
    return {"success": True, "message": f"Item moved from {request.from_categoria} to {request.to_categoria}"}

@router.get("/equipment-catalog/food-items")
async def get_food_water_items():
    """Get all items marked as food or water across all categories"""
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        catalog = await db.equipment_catalog.find_one({})
    if not catalog:
        return {"food_items": [], "water_items": []}
    
    food_items = []
    water_items = []
    
    for categoria, items in catalog.items():
        if categoria.startswith('_') or not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict):
                if item.get('es_comida'):
                    food_items.append({**item, 'categoria': categoria})
                if item.get('es_agua'):
                    water_items.append({**item, 'categoria': categoria})
    
    return {"food_items": food_items, "water_items": water_items}



# === SHEET POSITIONS (for character sheet layout) ===

@router.get("/sheet-positions")
async def get_sheet_positions():
    """Get saved sheet field positions for all pages"""
    positions = await db.sheet_positions.find_one({"_id": "default"})
    if not positions:
        return {"page1": {}, "page2": {}, "page3": {}}
    return {
        "page1": positions.get("page1", {}),
        "page2": positions.get("page2", {}),
        "page3": positions.get("page3", {})
    }


@router.put("/sheet-positions")
async def save_sheet_positions(positions: dict):
    """Save sheet field positions (upsert)"""
    await db.sheet_positions.update_one(
        {"_id": "default"},
        {"$set": {
            "page1": positions.get("page1", {}),
            "page2": positions.get("page2", {}),
            "page3": positions.get("page3", {})
        }},
        upsert=True
    )
    return {"message": "Positions saved successfully"}


@router.put("/sheet-positions/page/{page_num}")
async def save_sheet_positions_page(page_num: int, positions: dict):
    """Save sheet field positions for a specific page"""
    if page_num < 1 or page_num > 3:
        raise HTTPException(status_code=400, detail="Page must be 1, 2, or 3")
    
    page_key = f"page{page_num}"
    await db.sheet_positions.update_one(
        {"_id": "default"},
        {"$set": {page_key: positions}},
        upsert=True
    )
    return {"message": f"Page {page_num} positions saved successfully"}



# === SOMBRA (Shadow Rules) ===

@router.get("/sombra")
async def get_sombra_rules():
    """Get shadow rules including pavor, avaricia, fechorias, estados, sendas, hechiceria, fortalecer_voluntad, como_sucumbir"""
    sombra = await db.sombra_rules.find_one({"_id": "main"})
    if not sombra:
        return {
            "pavor": [],
            "avaricia": [],
            "fechorias": [],
            "estados": [],
            "sendas_sombra": [],
            "hechiceria": None,
            "fortalecer_voluntad": None,
            "como_sucumbir": None
        }
    return {
        "pavor": sombra.get("pavor", []),
        "avaricia": sombra.get("avaricia", []),
        "fechorias": sombra.get("fechorias", []),
        "estados": sombra.get("estados", []),
        "sendas_sombra": sombra.get("sendas_sombra", []),
        "hechiceria": sombra.get("hechiceria"),
        "fortalecer_voluntad": sombra.get("fortalecer_voluntad"),
        "como_sucumbir": sombra.get("como_sucumbir")
    }



@router.post("/sombra/sendas")
async def add_occupation_shadow_path(data: dict = Body(...)):
    """Add or update shadow path from an occupation to the shadow rules"""
    ocupacion = data.get("ocupacion")
    senda = data.get("senda")
    descripcion = data.get("descripcion")
    defectos = data.get("defectos", [])
    
    if not ocupacion or not senda:
        raise HTTPException(status_code=400, detail="ocupacion and senda are required")
    
    # Get current sombra rules
    current = await db.sombra_rules.find_one({"_id": "main"})
    if not current:
        current = {"_id": "main", "sendas_sombra": []}
    
    sendas = current.get("sendas_sombra", [])
    
    # Remove existing entries for this senda (if updating)
    sendas = [s for s in sendas if s.get("senda") != senda]
    
    # Add new entries
    for defecto in defectos:
        if defecto.get("nombre"):
            sendas.append({
                "senda": senda,
                "ocupacion": ocupacion,
                "descripcion_senda": descripcion,
                "defecto": defecto.get("nombre"),
                "descripcion": defecto.get("descripcion"),
                "efecto_juego": defecto.get("efecto_juego")
            })
    
    # Update
    await db.sombra_rules.update_one(
        {"_id": "main"},
        {"$set": {"sendas_sombra": sendas}},
        upsert=True
    )
    
    return {"message": f"Shadow path '{senda}' saved successfully"}


# === OBJECT MATERIALS (for Object Interaction system) ===

@router.get("/object-materials")
async def get_object_materials():
    """Get object materials with vulnerabilities/resistances"""
    data = await db.object_materials.find_one({"_id": "default"})
    if not data:
        return {"materials": []}
    return {"materials": data.get("materials", [])}


@router.put("/object-materials")
async def update_object_materials(data: dict = Body(...)):
    """Update object materials"""
    materials = data.get("materials", [])
    await db.object_materials.update_one(
        {"_id": "default"},
        {"$set": {"materials": materials, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Materials saved successfully"}


# === TREASURE INDEX (DM's pre-created magic items) ===

@router.get("/treasure-index")
async def get_treasure_index():
    """Get DM's treasure index"""
    data = await db.treasure_index.find_one({"_id": "default"})
    if not data:
        return {"items": []}
    return {"items": data.get("items", [])}


@router.put("/treasure-index")
async def update_treasure_index(data: dict = Body(...)):
    """Update DM's treasure index"""
    items = data.get("items", [])
    await db.treasure_index.update_one(
        {"_id": "default"},
        {"$set": {"items": items, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Treasure index saved successfully"}


# === TREASURE CONFIG (Editable treasure generation parameters) ===

@router.get("/treasure-config")
async def get_treasure_config():
    """Get DM's custom treasure generation configuration including pricing tables"""
    data = await db.treasure_config.find_one({"_id": "default"})
    if not data:
        return {"tiers": None, "coinTypes": None, "blessings": None, "weaponQualities": None, "armorQualities": None, "shieldQualities": None}
    return {
        "tiers": data.get("tiers"),
        "coinTypes": data.get("coinTypes"),
        "blessings": data.get("blessings"),
        "weaponQualities": data.get("weaponQualities"),
        "armorQualities": data.get("armorQualities"),
        "shieldQualities": data.get("shieldQualities"),
        "updated_at": data.get("updated_at")
    }


@router.put("/treasure-config")
async def update_treasure_config(data: dict = Body(...)):
    """Update DM's treasure generation configuration including pricing tables"""
    tiers = data.get("tiers")
    coin_types = data.get("coinTypes")
    blessings = data.get("blessings")
    weapon_qualities = data.get("weaponQualities")
    armor_qualities = data.get("armorQualities")
    shield_qualities = data.get("shieldQualities")
    
    await db.treasure_config.update_one(
        {"_id": "default"},
        {"$set": {
            "tiers": tiers,
            "coinTypes": coin_types,
            "blessings": blessings,
            "weaponQualities": weapon_qualities,
            "armorQualities": armor_qualities,
            "shieldQualities": shield_qualities,
            "updated_at": now_utc()
        }},
        upsert=True
    )
    return {"message": "Treasure configuration saved successfully"}


@router.delete("/treasure-config")
async def reset_treasure_config():
    """Reset treasure configuration to defaults"""
    await db.treasure_config.delete_one({"_id": "default"})
    return {"message": "Treasure configuration reset to defaults"}


# === ARTES (Arts) ===

@router.get("/artes")
async def get_artes():
    """Get all arts"""
    artes = await db.artes.find({}).to_list(50)
    return {"artes": serialize_docs(artes)}


@router.post("/artes")
async def create_arte(arte: dict = Body(...)):
    """Create a new arte"""
    arte["_id"] = str(uuid.uuid4())
    arte["created_at"] = now_utc()
    await db.artes.insert_one(arte)
    return {"id": arte["_id"], "message": "Arte created successfully"}


@router.put("/artes/{arte_id}")
async def update_arte(arte_id: str, arte: dict = Body(...)):
    """Update an existing arte"""
    arte["updated_at"] = now_utc()
    result = await db.artes.update_one({"_id": arte_id}, {"$set": arte})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Arte not found")
    return {"message": "Arte updated successfully"}


@router.delete("/artes/{arte_id}")
async def delete_arte(arte_id: str):
    """Delete an arte"""
    result = await db.artes.delete_one({"_id": arte_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Arte not found")
    return {"message": "Arte deleted successfully"}


# === RECOMPENSAS (Rewards) ===

@router.get("/recompensas")
async def get_recompensas():
    """Get rewards data including mejoras, niveles, bendiciones, and info general"""
    recompensas = await db.recompensas.find_one({"_id": "main"})
    if not recompensas:
        return {
            "mejoras": [],
            "niveles_recompensa": [],
            "bendiciones": None,
            "info_general": None,
            "armas_con_nombre": None
        }
    return {
        "mejoras": recompensas.get("mejoras", recompensas.get("mejoras_equipo", [])),
        "niveles_recompensa": recompensas.get("niveles_recompensa", []),
        "bendiciones": recompensas.get("bendiciones"),
        "info_general": recompensas.get("info_general"),
        "armas_con_nombre": recompensas.get("armas_con_nombre")
    }


@router.get("/recompensas/mejoras")
async def get_mejoras_aplicables(tipo_equipo: Optional[str] = None):
    """Get applicable rewards for a specific equipment type (arma, armadura, escudo)"""
    recompensas = await db.recompensas.find_one({"_id": "main"})
    if not recompensas:
        return {"mejoras": []}
    
    mejoras = recompensas.get("mejoras", [])
    
    if tipo_equipo:
        # Filter by equipment type
        tipo_lower = tipo_equipo.lower()
        filtered = []
        for m in mejoras:
            tipos_aplicables = m.get("tipos_aplicables", [])
            tipo_mejora = m.get("tipo", "").lower()
            
            # Check if this reward can be applied to this equipment type
            if tipo_lower in ["arma", "arma_cuerpo_cuerpo", "arma_distancia"]:
                if tipo_mejora == "arma" or any("arma" in t for t in tipos_aplicables):
                    filtered.append(m)
            elif tipo_lower in ["armadura", "armadura_ligera", "armadura_media", "armadura_pesada"]:
                if tipo_mejora == "armadura" or any("armadura" in t for t in tipos_aplicables):
                    filtered.append(m)
            elif tipo_lower == "escudo":
                if tipo_mejora == "escudo" or "escudo" in tipos_aplicables:
                    filtered.append(m)
        
        return {"mejoras": filtered}
    
    return {"mejoras": mejoras}


# === VIRTUDES (Virtues) - Complete data ===

@router.get("/virtudes")
async def get_all_virtudes():
    """Get all virtues with complete data (name, description, traits, stats)"""
    # Use 'virtues' collection (that's where the data is)
    virtudes = await db.virtues.find({}).to_list(200)
    return {"virtudes": serialize_docs(virtudes)}


@router.post("/virtudes")
async def create_virtud(virtud: dict = Body(...)):
    """Create a new virtue"""
    virtud["_id"] = str(uuid.uuid4())
    virtud["created_at"] = now_utc()
    await db.virtues.insert_one(virtud)
    return {"id": virtud["_id"], "message": "Virtud created successfully"}


@router.put("/virtudes/{virtud_id}")
async def update_virtud(virtud_id: str, virtud: dict = Body(...)):
    """Update an existing virtue"""
    virtud["updated_at"] = now_utc()
    result = await db.virtues.update_one({"_id": virtud_id}, {"$set": virtud})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Virtud not found")
    return {"message": "Virtud updated successfully"}


@router.delete("/virtudes/{virtud_id}")
async def delete_virtud(virtud_id: str):
    """Delete a virtue"""
    result = await db.virtues.delete_one({"_id": virtud_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Virtud not found")
    return {"message": "Virtud deleted successfully"}


# === EQUIPMENT CRUD ===

class EquipmentItem(BaseModel):
    categoria: str  # armas_sencillas_cc, armas_marciales_cc, armaduras_ligeras, hierbas, venenos, etc.
    nombre: str
    precio: Optional[float] = None
    moneda: Optional[str] = "mp"
    peso_kg: Optional[float] = None
    # Weapon-specific
    dano: Optional[str] = None
    modificador: Optional[str] = None
    herida: Optional[int] = None
    alcance: Optional[str] = None
    # Armor-specific
    ca: Optional[int] = None
    comentarios: Optional[str] = None
    otros: Optional[str] = None
    # Ropa / armadura: posición corporal (cabeza, cuerpo, brazos, piernas, pies)
    posicion: Optional[str] = None
    es_corporal: Optional[bool] = None
    # Ropa que se puede llevar SOBRE otra prenda (capas: capa, pieles, etc.)
    ropa_complementaria: Optional[bool] = None
    # Herb/Poison specific
    forma_preparacion: Optional[str] = None
    efecto: Optional[str] = None
    # Mount-specific
    capacidad_carga: Optional[int] = None
    constitucion: Optional[str] = None
    velocidad: Optional[int] = None
    capacidad_pequeno: Optional[bool] = None
    capacidad_mediano: Optional[bool] = None
    capacidad_monta: Optional[str] = None
    # Construction-specific
    m2: Optional[str] = None
    # Disponibilidad / venta
    descripcion: Optional[str] = None
    disponible_creacion: Optional[bool] = None
    nivel_asentamiento: Optional[List[str]] = None
    regiones_disponibles: Optional[List[str]] = None
    profesiones: Optional[List[str]] = None
    # Otros campos del Excel
    ca_bonus: Optional[int] = None
    propiedades: Optional[str] = None
    tipo_dano: Optional[str] = None
    pasajeros: Optional[int] = None
    capacidad_kg: Optional[float] = None
    es_racion_diaria: Optional[bool] = None
    unidades_paquete: Optional[int] = None
    racion_valor: Optional[float] = None


@router.post("/equipment")
async def create_equipment_item(item: EquipmentItem):
    """Create a new equipment item in the specified category"""
    categoria = item.categoria
    item_dict = item.dict(exclude_unset=True, exclude={"categoria"})
    
    # Get current catalog
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        catalog = {"_id": "main"}
    
    # Initialize category if doesn't exist
    if categoria not in catalog:
        catalog[categoria] = []
    
    # Add item
    catalog[categoria].append(item_dict)
    
    # Update catalog
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {categoria: catalog[categoria]}},
        upsert=True
    )
    
    return {"message": f"Item '{item.nombre}' added to {categoria}"}


@router.put("/equipment/{categoria}/{item_nombre}")
async def update_equipment_item(categoria: str, item_nombre: str, item: dict = Body(...)):
    """Update an equipment item by category and name"""
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog or categoria not in catalog:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Find and update item
    items = catalog[categoria]
    found = False
    for i, existing in enumerate(items):
        if existing.get("nombre", "").lower() == item_nombre.lower():
            items[i] = {**existing, **item}
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Save
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {categoria: items}}
    )
    
    return {"message": f"Item '{item_nombre}' updated"}


@router.delete("/equipment/{categoria}/{item_nombre}")
async def delete_equipment_item(categoria: str, item_nombre: str):
    """Delete an equipment item by category and name"""
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog or categoria not in catalog:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Find and remove item
    items = catalog[categoria]
    original_len = len(items)
    items = [item for item in items if item.get("nombre", "").lower() != item_nombre.lower()]
    
    if len(items) == original_len:
        raise HTTPException(status_code=404, detail="Item not found")

    # Save
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {categoria: items}}
    )

    return {"message": f"Item '{item_nombre}' deleted"}


# === CUSTOM EQUIPMENT CATEGORIES (grupos personalizados) ===

# Claves reservadas por los grupos integrados (no se pueden recrear/borrar
# como personalizadas, salvo "ropa" que sembramos como grupo individual).
_BUILTIN_EQUIPMENT_KEYS = {
    "herramientas", "juegos", "instrumentos_musicales", "equipo_general",
    "consumibles", "comida_posadas", "hierbas", "venenos",
    "armas_sencillas_cc", "armas_sencillas_distancia", "armas_marciales_cc", "armas_marciales_distancia",
    "armaduras_ligeras", "armaduras_medias", "armaduras_pesadas", "escudos", "yelmos",
    "monturas", "accesorios_monturas", "transporte_terrestre", "transporte_maritimo",
    "recursos_desarrollo", "gemas_preciosas", "gemas_semipreciosas",
}

# Campos permitidos al definir un grupo (whitelist; nombre y precio van implícitos).
_ALLOWED_GROUP_FIELDS = {
    "moneda", "peso_kg", "dano", "modificador", "herida", "alcance",
    "ca", "ca_bonus", "posicion", "comentarios", "forma_preparacion", "efecto",
    "capacidad_carga", "capacidad_kg", "constitucion", "velocidad",
    "capacidad_pequeno", "capacidad_mediano", "m2",
}


def _slugify_group_key(name: str) -> str:
    import unicodedata, re
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s).strip("_").lower()
    return s or "grupo"


class CustomCategoryCreate(BaseModel):
    name: str
    fields: List[str] = []
    section: str = "__root__"  # título de una sección existente o "__root__"
    icono: Optional[str] = "🧩"


class CustomCategoryUpdate(BaseModel):
    name: Optional[str] = None
    fields: Optional[List[str]] = None
    section: Optional[str] = None
    icono: Optional[str] = None


@router.get("/equipment-custom-categories")
async def list_custom_categories():
    """Devuelve la lista de grupos personalizados definidos por el Maestro."""
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    return {"custom_categories": (catalog or {}).get("_custom_categories", []) or []}


@router.post("/equipment-custom-category")
async def create_custom_category(data: CustomCategoryCreate):
    """Crea un grupo de objetos nuevo (categoría dinámica)."""
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del grupo es obligatorio")

    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or {"_id": "main"}
    custom_cats = list(catalog.get("_custom_categories", []) or [])

    # Genera una clave única que no choque con grupos integrados ni existentes.
    base_key = _slugify_group_key(name)
    existing_keys = {c.get("key") for c in custom_cats} | _BUILTIN_EQUIPMENT_KEYS
    key = base_key
    n = 2
    while key in existing_keys:
        key = f"{base_key}_{n}"
        n += 1

    # Sanitiza los campos contra la whitelist.
    fields = ["nombre", "precio"] + [f for f in (data.fields or []) if f in _ALLOWED_GROUP_FIELDS]
    # Dedupe preservando orden
    seen, clean_fields = set(), []
    for f in fields:
        if f not in seen:
            seen.add(f)
            clean_fields.append(f)

    new_cat = {
        "key": key,
        "name": name,
        "fields": clean_fields,
        "section": data.section or "__root__",
        "icono": (data.icono or "🧩").strip() or "🧩",
    }
    custom_cats.append(new_cat)

    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"_custom_categories": custom_cats, key: catalog.get(key, [])}},
        upsert=True,
    )
    return {"success": True, "category": new_cat}


@router.put("/equipment-custom-category/{key}")
async def update_custom_category(key: str, data: CustomCategoryUpdate):
    """Renombra / reconfigura un grupo personalizado existente."""
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")
    custom_cats = list(catalog.get("_custom_categories", []) or [])
    idx = next((i for i, c in enumerate(custom_cats) if c.get("key") == key), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Grupo personalizado no encontrado")

    cat = dict(custom_cats[idx])
    if data.name is not None and data.name.strip():
        cat["name"] = data.name.strip()
    if data.section is not None:
        cat["section"] = data.section or "__root__"
    if data.icono is not None:
        cat["icono"] = (data.icono or "🧩").strip() or "🧩"
    if data.fields is not None:
        fields = ["nombre", "precio"] + [f for f in data.fields if f in _ALLOWED_GROUP_FIELDS]
        seen, clean_fields = set(), []
        for f in fields:
            if f not in seen:
                seen.add(f)
                clean_fields.append(f)
        cat["fields"] = clean_fields
    custom_cats[idx] = cat

    await db.equipment_catalog.update_one(
        {"_id": "main"}, {"$set": {"_custom_categories": custom_cats}}
    )
    return {"success": True, "category": cat}


@router.delete("/equipment-custom-category/{key}")
async def delete_custom_category(key: str):
    """Elimina un grupo personalizado y sus objetos."""
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")
    custom_cats = list(catalog.get("_custom_categories", []) or [])
    if not any(c.get("key") == key for c in custom_cats):
        raise HTTPException(status_code=404, detail="Grupo personalizado no encontrado")
    custom_cats = [c for c in custom_cats if c.get("key") != key]

    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"_custom_categories": custom_cats}, "$unset": {key: ""}},
    )
    return {"success": True, "message": f"Grupo '{key}' eliminado"}


@router.post("/equipment/batch-update-prices")
async def batch_update_equipment_prices(updates: List[dict] = Body(...)):
    """
    Update prices for multiple equipment items.
    Each update should have: { categoria, nombre, precio, moneda (optional) }
    """
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=404, detail="Equipment catalog not found")
    
    updated_count = 0
    not_found = []
    
    for update in updates:
        categoria = update.get("categoria")
        nombre = update.get("nombre")
        nuevo_precio = update.get("precio")
        moneda = update.get("moneda")
        
        if not categoria or not nombre or nuevo_precio is None:
            continue
        
        if categoria not in catalog:
            not_found.append(f"{categoria}/{nombre}")
            continue
        
        found = False
        for item in catalog[categoria]:
            if item.get("nombre", "").lower() == nombre.lower():
                item["precio"] = nuevo_precio
                if moneda:
                    item["moneda"] = moneda
                found = True
                updated_count += 1
                break
        
        if not found:
            not_found.append(f"{categoria}/{nombre}")
    
    # Save all changes
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": catalog}
    )
    
    return {
        "message": f"Updated {updated_count} items",
        "updated_count": updated_count,
        "not_found": not_found
    }


@router.post("/equipment/set-availability")
async def set_equipment_availability(data: dict = Body(...)):
    """
    Set availability for equipment items based on settlement level and regions.
    data: { categoria, nombre, nivel_asentamiento: [], regiones_disponibles: [] }
    
    Niveles de asentamiento: aldea, pueblo, villa, ciudad, capital, especial
    """
    categoria = data.get("categoria")
    nombre = data.get("nombre")
    nivel_asentamiento = data.get("nivel_asentamiento", [])
    regiones_disponibles = data.get("regiones_disponibles", [])
    
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog or categoria not in catalog:
        raise HTTPException(status_code=404, detail="Category not found")
    
    found = False
    for item in catalog[categoria]:
        if item.get("nombre", "").lower() == nombre.lower():
            item["nivel_asentamiento"] = nivel_asentamiento
            item["regiones_disponibles"] = regiones_disponibles
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {categoria: catalog[categoria]}}
    )
    
    return {"message": f"Availability updated for '{nombre}'"}


@router.post("/equipment/batch-set-availability")
async def batch_set_equipment_availability(updates: List[dict] = Body(...)):
    """
    Set availability for multiple items at once.
    Each update: { categoria, nombre, nivel_asentamiento: [], regiones_disponibles: [] }
    """
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=404, detail="Equipment catalog not found")
    
    updated_count = 0
    
    for update in updates:
        categoria = update.get("categoria")
        nombre = update.get("nombre")
        nivel_asentamiento = update.get("nivel_asentamiento", [])
        regiones_disponibles = update.get("regiones_disponibles", [])
        
        if not categoria or not nombre:
            continue
        
        if categoria not in catalog:
            continue
        
        for item in catalog[categoria]:
            if item.get("nombre", "").lower() == nombre.lower():
                item["nivel_asentamiento"] = nivel_asentamiento
                item["regiones_disponibles"] = regiones_disponibles
                updated_count += 1
                break
    
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": catalog}
    )
    
    return {"message": f"Updated availability for {updated_count} items"}


@router.post("/equipment/batch-set-creation-availability")
async def batch_set_creation_availability(updates: List[dict] = Body(...)):
    """
    Set whether items are available for character creation.
    Each update: { categoria, nombre, disponible_creacion: bool }
    """
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=404, detail="Equipment catalog not found")
    
    updated_count = 0
    
    for update in updates:
        categoria = update.get("categoria")
        nombre = update.get("nombre")
        disponible_creacion = update.get("disponible_creacion", True)
        
        if not categoria or not nombre:
            continue
        
        if categoria not in catalog:
            continue
        
        for item in catalog[categoria]:
            if item.get("nombre", "").lower() == nombre.lower():
                item["disponible_creacion"] = disponible_creacion
                updated_count += 1
                break
    
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": catalog}
    )
    
    return {"message": f"Updated creation availability for {updated_count} items", "updated_count": updated_count}


@router.post("/equipment/category-set-creation-availability")
async def category_set_creation_availability(data: dict = Body(...)):
    """
    Set creation availability for all items in a category at once.
    data: { categoria: str, disponible_creacion: bool }
    """
    categoria = data.get("categoria")
    disponible_creacion = data.get("disponible_creacion", True)
    
    if not categoria:
        raise HTTPException(status_code=400, detail="categoria is required")
    
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=404, detail="Equipment catalog not found")
    
    if categoria not in catalog:
        raise HTTPException(status_code=404, detail=f"Category '{categoria}' not found")
    
    updated_count = 0
    for item in catalog[categoria]:
        item["disponible_creacion"] = disponible_creacion
        updated_count += 1
    
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {categoria: catalog[categoria]}}
    )
    
    return {"message": f"Updated {updated_count} items in '{categoria}'", "updated_count": updated_count}


# === EQUIPMENT CATEGORIES METADATA ===

@router.get("/equipment-categories")
async def get_equipment_categories():
    """Get all equipment categories with their field definitions"""
    return {
        "categories": [
            {
                "key": "armas_sencillas_cc",
                "name": "Armas Sencillas (Cuerpo a Cuerpo)",
                "fields": ["nombre", "precio", "moneda", "dano", "modificador", "herida", "peso_kg"]
            },
            {
                "key": "armas_sencillas_distancia",
                "name": "Armas Sencillas (Distancia)",
                "fields": ["nombre", "precio", "moneda", "dano", "alcance", "herida", "peso_kg"]
            },
            {
                "key": "armas_marciales_cc",
                "name": "Armas Marciales (Cuerpo a Cuerpo)",
                "fields": ["nombre", "precio", "moneda", "dano", "modificador", "herida", "peso_kg"]
            },
            {
                "key": "armas_marciales_distancia",
                "name": "Armas Marciales (Distancia)",
                "fields": ["nombre", "precio", "moneda", "dano", "alcance", "herida", "peso_kg"]
            },
            {
                "key": "armaduras_ligeras",
                "name": "Armaduras Ligeras",
                "fields": ["nombre", "precio", "moneda", "ca", "comentarios", "peso_kg"]
            },
            {
                "key": "armaduras_medias",
                "name": "Armaduras Medias",
                "fields": ["nombre", "precio", "moneda", "ca", "comentarios", "peso_kg"]
            },
            {
                "key": "armaduras_pesadas",
                "name": "Armaduras Pesadas",
                "fields": ["nombre", "precio", "moneda", "ca", "comentarios", "peso_kg"]
            },
            {
                "key": "escudos",
                "name": "Escudos",
                "fields": ["nombre", "precio", "moneda", "ca", "peso_kg"]
            },
            {
                "key": "equipo_general",
                "name": "Equipo General",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "herramientas",
                "name": "Herramientas",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "juegos",
                "name": "Juegos",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "instrumentos_musicales",
                "name": "Instrumentos Musicales",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "consumibles",
                "name": "Consumibles y Alimentación",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "comida_posadas",
                "name": "Comida en Posadas",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "hierbas",
                "name": "Hierbas Medicinales y Pociones",
                "fields": ["nombre", "precio", "moneda", "forma_preparacion", "efecto", "peso_kg"]
            },
            {
                "key": "venenos",
                "name": "Venenos",
                "fields": ["nombre", "precio", "moneda", "forma_preparacion", "efecto", "peso_kg"]
            },
            {
                "key": "monturas",
                "name": "Monturas",
                "fields": ["nombre", "precio", "moneda", "capacidad_carga", "constitucion", "velocidad", "capacidad_pequeno", "capacidad_mediano"]
            },
            {
                "key": "accesorios_monturas",
                "name": "Accesorios de Monturas",
                "fields": ["nombre", "precio", "moneda", "peso_kg"]
            },
            {
                "key": "transporte_terrestre",
                "name": "Transporte Terrestre",
                "fields": ["nombre", "precio", "moneda", "capacidad_kg"]
            },
            {
                "key": "transporte_maritimo",
                "name": "Transporte Marítimo",
                "fields": ["nombre", "precio", "moneda", "capacidad_kg"]
            },
            {
                "key": "recursos_desarrollo",
                "name": "Recursos de Desarrollo",
                "fields": ["nombre", "precio", "moneda", "peso_kg", "m2"]
            }
        ]
    }


# === SALARIOS (Wages) ===

@router.get("/salarios")
async def get_salarios():
    """Get wages data for all worker categories and modifiers"""
    salarios = await db.salarios.find_one({"_id": "main"})
    if not salarios:
        return {
            "descripcion": "",
            "nota": "",
            "categorias": {},
            "modificadores": {}
        }
    return {
        "descripcion": salarios.get("descripcion", ""),
        "nota": salarios.get("nota", ""),
        "categorias": salarios.get("categorias", {}),
        "modificadores": salarios.get("modificadores", {})
    }


# === VARIOS (Miscellaneous Rules) ===

@router.get("/varios")
async def get_varios_rules():
    """Get miscellaneous rules: pruebas_habilidad, cansancio, inspiracion, ojo_de_mordor, ventaja"""
    varios = await db.varios_rules.find_one({"_id": "main"})
    if not varios:
        return {
            "pruebas_habilidad": None,
            "cansancio": None,
            "inspiracion": None,
            "ojo_de_mordor": None,
            "ventaja": None,
            "mas_alla_nivel_10": None
        }
    return {
        "pruebas_habilidad": varios.get("pruebas_habilidad"),
        "cansancio": varios.get("cansancio"),
        "inspiracion": varios.get("inspiracion"),
        "ojo_de_mordor": varios.get("ojo_de_mordor"),
        "ventaja": varios.get("ventaja"),
        "mas_alla_nivel_10": varios.get("mas_alla_nivel_10")
    }


# === COMBATE (Combat Rules) ===

@router.get("/combate")
async def get_combate_rules():
    """Get combat rules: estructura, acciones, atacar, muerte_e_inconsciencia"""
    combate = await db.combate_rules.find_one({"_id": "main"})
    if not combate:
        return {
            "estructura": None,
            "acciones": None,
            "atacar": None,
            "muerte_e_inconsciencia": None
        }
    return {
        "estructura": combate.get("estructura"),
        "acciones": combate.get("acciones"),
        "atacar": combate.get("atacar"),
        "muerte_e_inconsciencia": combate.get("muerte_e_inconsciencia")
    }


# === SOMBRA CRUD (Shadow Path Delete/Edit) ===

@router.delete("/sombra/sendas/{senda_name}")
async def delete_shadow_path(senda_name: str):
    """Delete a shadow path by name (admin only)"""
    current = await db.sombra_rules.find_one({"_id": "main"})
    if not current:
        raise HTTPException(status_code=404, detail="Sombra rules not found")
    
    sendas = current.get("sendas_sombra", [])
    original_len = len(sendas)
    sendas = [s for s in sendas if s.get("senda") != senda_name]
    
    if len(sendas) == original_len:
        raise HTTPException(status_code=404, detail=f"Shadow path '{senda_name}' not found")
    
    await db.sombra_rules.update_one(
        {"_id": "main"},
        {"$set": {"sendas_sombra": sendas}}
    )
    
    return {"message": f"Shadow path '{senda_name}' deleted successfully"}


@router.put("/sombra/sendas/{senda_name}")
async def update_shadow_path(senda_name: str, data: dict = Body(...)):
    """Update a shadow path by name (admin only)"""
    current = await db.sombra_rules.find_one({"_id": "main"})
    if not current:
        raise HTTPException(status_code=404, detail="Sombra rules not found")
    
    sendas = current.get("sendas_sombra", [])
    
    # Find and update entries for this senda
    new_senda = data.get("senda", senda_name)
    new_descripcion = data.get("descripcion")
    new_defectos = data.get("defectos", [])
    ocupacion = data.get("ocupacion")
    
    # Remove old entries
    sendas = [s for s in sendas if s.get("senda") != senda_name]
    
    # Add new entries
    for defecto in new_defectos:
        if defecto.get("nombre"):
            sendas.append({
                "senda": new_senda,
                "ocupacion": ocupacion,
                "descripcion_senda": new_descripcion,
                "defecto": defecto.get("nombre"),
                "descripcion": defecto.get("descripcion"),
                "efecto_juego": defecto.get("efecto_juego")
            })
    
    await db.sombra_rules.update_one(
        {"_id": "main"},
        {"$set": {"sendas_sombra": sendas}}
    )
    
    return {"message": f"Shadow path '{new_senda}' updated successfully"}


# === COMUNIDAD (Community Phase Rules) ===

@router.get("/comunidad")
async def get_comunidad_rules():
    """Get community phase rules: estructura, yule, empresas"""
    comunidad = await db.comunidad_rules.find_one({"_id": "main"})
    if not comunidad:
        # Return default structure if not in DB
        return {
            "introduccion": {
                "titulo": "FASE DE COMUNIDAD",
                "descripcion": "La fase de comunidad es una modalidad de juego guiada por las decisiones de los jugadores. Mientras que en la fase de aventuras los jugadores reaccionan a las indicaciones del Maestro del saber, durante la fase de comunidad pueden desarrollar las historias y ambiciones de sus héroes y controlar su progresión.",
                "rol_maestro": "El Maestro del saber adopta un papel más pasivo y escucha lo que los jugadores cuentan sobre sus personajes.",
                "narracion": "Se anima a narrar con detalle lo que hacen los héroes durante este periodo, incluso actividades sin efecto directo en las reglas: investigar pistas, atender asuntos personales o desarrollar relaciones surgidas en la fase de aventuras anterior."
            },
            "limites_narrativos": {
                "descripcion": "Los jugadores deben tener en cuenta:",
                "limites": [
                    "La duración de la fase de comunidad",
                    "Sus límites geográficos",
                    "Que no deben introducir elementos propios de una fase de aventuras (explorar lugares nunca visitados, conocer figuras importantes nuevas, etc.)"
                ],
                "cuando": [
                    "Marca la conclusión de una fase de aventuras",
                    "Suele jugarse al final de una sesión",
                    "También puede abrir una sesión antes de iniciar nuevas aventuras"
                ]
            },
            "estructura": {
                "descripcion": "Todas las fases de comunidad siguen esta secuencia:",
                "pasos": [
                    {
                        "numero": 1,
                        "titulo": "Establecer la duración",
                        "descripcion": "La fase de comunidad abarca más tiempo que una fase de aventuras. Los acontecimientos se describen de forma general. Los días y semanas pasan mientras los héroes descansan, trabajan o estudian.",
                        "duracion": {
                            "minimo": "1 semana",
                            "maximo_habitual": "una estación completa",
                            "nota": "La fase de comunidad más larga suele coincidir con las festividades de invierno (Yule)"
                        }
                    },
                    {
                        "numero": 2,
                        "titulo": "Elegir el destino",
                        "descripcion": "Tras decidir la duración, los jugadores eligen dónde pasarán este periodo.",
                        "reglas": [
                            "La compañía suele reunirse en un refugio seguro",
                            "Debe estar a una distancia razonable del último lugar de aventuras",
                            "Debe ser coherente con la duración disponible",
                            "Puede elegirse cualquier lugar visitado anteriormente",
                            "El viaje hasta el destino se considera realizado 'entre bastidores', salvo que se quiera jugar"
                        ],
                        "refugios_recomendados": ["Bree", "Rivendel"],
                        "nota_refugios": "Son lugares seguros, con anfitriones dispuestos a acoger a los viajeros y propicios para la sanación"
                    },
                    {
                        "numero": 3,
                        "titulo": "Recuperación espiritual",
                        "descripcion": "El descanso y la vida cotidiana refuerzan la fe de los héroes en que sus esfuerzos tienen sentido. Si la fase de aventuras ha tenido resultados positivos contra la Sombra, la compañía reduce su puntuación de Sombra.",
                        "tabla_reduccion": [
                            {"impacto": "Interferencia menor en la Sombra", "reduccion": "-1 punto"},
                            {"impacto": "Obstáculo o daño real al Enemigo", "reduccion": "hasta -2 puntos"},
                            {"impacto": "Proezas notables que llaman la atención del Enemigo", "reduccion": "hasta -3 puntos"}
                        ]
                    },
                    {
                        "numero": 4,
                        "titulo": "Elegir empresas",
                        "descripcion": "Las empresas son actividades prolongadas que solo pueden realizarse durante la fase de comunidad.",
                        "seleccion": [
                            {"tipo": "Fase ordinaria", "empresas": "1 empresa"},
                            {"tipo": "Fase de Yule", "empresas": "cada jugador elige 1 empresa propia"}
                        ],
                        "empresa_gratuita": "Siempre puede elegirse una extra si se cumplen requisitos de ocupación o competencias",
                        "resumen": [
                            {"tipo": "Fase ordinaria", "maximo": "2 empresas"},
                            {"tipo": "Fase de Yule", "maximo": "número de héroes + 1"}
                        ],
                        "nota": "Deben elegirse empresas distintas, salvo las marcadas como actividades de Yule"
                    }
                ]
            },
            "yule": {
                "titulo": "YULE (FIN DE AÑO)",
                "descripcion": "Aproximadamente cada tres fases de comunidad llega el invierno y el final del año.",
                "caracteristicas": [
                    "La compañía suele pasar toda la estación fría en comunidad",
                    "Muchos héroes regresan temporalmente a casa",
                    "Tres meses bastan para viajar desde la mayoría de regiones"
                ],
                "paso_anos": {
                    "titulo": "El paso de los años",
                    "efectos": [
                        "Todos los héroes envejecen un año",
                        "El tiempo de reflexión puede otorgar sabiduría"
                    ],
                    "regla_px": {
                        "descripcion": "Quienes no elijan Sanar cicatrices obtienen PX adicionales:",
                        "formula": "PX = Inteligencia × 10 × nivel",
                        "ejemplo": "Nivel 3, INT 13 → 390 PX"
                    },
                    "maestro": [
                        "Informar de cambios en el mundo",
                        "Introducir noticias relevantes",
                        "Preparar el trasfondo de la siguiente fase de aventuras"
                    ]
                }
            },
            "empresas": [
                {
                    "nombre": "Educar a un heredero",
                    "tipo": "Yule",
                    "descripcion": "El héroe invierte tiempo y dinero en formar a un sucesor.",
                    "coste": "Mínimo 50 peniques de plata",
                    "efecto": "Se registra en la hoja de personaje. Cuando el héroe muera o se retire: Experiencia del heredero = cantidad invertida × nivel del héroe",
                    "maximo": "La mitad de los PX actuales del héroe",
                    "bonus": "Hereda hasta 3 objetos mágicos",
                    "nota": "La primera vez debe asignarse un nombre al heredero",
                    "gratuita": False
                },
                {
                    "nombre": "Escribir una canción",
                    "tipo": "Ordinaria",
                    "descripcion": "El héroe compone una Balada, Canción de victoria o Canción de viaje.",
                    "efecto": "Se añade a la lista de canciones de la compañía",
                    "uso": "Acción adicional + Carisma (Interpretación) CD 15",
                    "tipos_cancion": [
                        {"tipo": "Balada", "efecto": "Ventaja en la primera prueba durante un concilio"},
                        {"tipo": "Canción de victoria", "efecto": "Ventaja en la primera tirada de ataque"},
                        {"tipo": "Canción de viaje", "efecto": "Ventaja en la siguiente salvación de fatiga"}
                    ],
                    "limite_uso": "Cada canción se usa una vez por fase de aventuras",
                    "gratuita": True,
                    "requisito_gratuita": "Competencia en Interpretación o instrumentos"
                },
                {
                    "nombre": "Estudiar mapas historiados e ilustrados",
                    "tipo": "Ordinaria",
                    "descripcion": "El héroe estudia mapas y pergaminos.",
                    "efecto": "Ventaja en pruebas de orientación hasta la siguiente fase de comunidad",
                    "gratuita": True,
                    "requisito_gratuita": "Erudito o competencia en cartografía"
                },
                {
                    "nombre": "Estudiar objetos mágicos",
                    "tipo": "Ordinaria",
                    "descripcion": "Permite comprender las propiedades de objetos mágicos de la compañía.",
                    "gratuita": True,
                    "requisito_gratuita": "Buscador de tesoros o competencia en Saber antiguo"
                },
                {
                    "nombre": "Fortalecer la comunidad",
                    "tipo": "Ordinaria",
                    "descripcion": "Refuerza los vínculos del grupo.",
                    "efecto": "+1 a la puntuación de Comunidad hasta la siguiente fase de comunidad",
                    "gratuita": True,
                    "requisito_gratuita": "Capitán o competencias sociales (cervecería, juegos)"
                },
                {
                    "nombre": "Recopilar rumores",
                    "tipo": "Ordinaria",
                    "descripcion": "Se investigan noticias y relatos.",
                    "efecto": "El Maestro del saber entrega un rumor relevante. Ventaja en pruebas de Inteligencia relacionadas con él hasta la siguiente fase",
                    "gratuita": True,
                    "requisito_gratuita": "Guardián o competencia en Investigación"
                },
                {
                    "nombre": "Cambiar equipo aventurero",
                    "tipo": "Ordinaria",
                    "descripcion": "Durante la fase de comunidad se puede comprar y vender equipo, sustituir armas y armaduras disponibles en el destino.",
                    "gratuita": False
                },
                {
                    "nombre": "Reunión con un mecenas",
                    "tipo": "Ordinaria",
                    "descripcion": "La compañía se reúne con un aliado influyente.",
                    "efecto": "Posible ayuda o misión. Héroes favorecidos por el mecenas comienzan la siguiente aventura con inspiración",
                    "gratuita": True,
                    "requisito_gratuita": "Mensajero o competencia en caligrafía"
                },
                {
                    "nombre": "Sanar cicatrices",
                    "tipo": "Yule",
                    "descripcion": "El héroe se centra en su recuperación interior.",
                    "efecto": "Elimina 1 cicatriz de Sombra",
                    "penalizacion": "No obtiene PX adicionales ese año",
                    "gratuita": False
                },
                {
                    "nombre": "Volver a contar una historia",
                    "tipo": "Yule",
                    "descripcion": "El héroe narra un episodio vivido y aprende de él.",
                    "permite": [
                        "Cambiar un rasgo distintivo",
                        "Sustituir una competencia con herramientas",
                        "Cambiar competencias vinculadas a Pericia",
                        "Sustituir un estilo de lucha"
                    ],
                    "nota": "Debe basarse en una cualidad demostrada en la historia narrada",
                    "gratuita": False
                }
            ]
        }
    # Remove _id from response
    return {k: v for k, v in comunidad.items() if k != '_id'}


# === MODIFICADORES DE PRECIO (Price Modifiers) ===
# Movido a routes/modifiers_routes.py (mayo 2026). El router se incluye
# desde server.py con el mismo prefijo `/data` para mantener URLs estables.


# === SALARIOS (Salaries with modifiers) ===

DEFAULT_SALARIES = [
    {"ocupacion": "Campesino", "salario_diario": 1, "moneda": "mc", "descripcion": "Trabajo de campo básico"},
    {"ocupacion": "Artesano aprendiz", "salario_diario": 2, "moneda": "mc", "descripcion": "Aprendiendo un oficio"},
    {"ocupacion": "Artesano", "salario_diario": 1, "moneda": "mp", "descripcion": "Trabajo artesanal cualificado"},
    {"ocupacion": "Artesano maestro", "salario_diario": 2, "moneda": "mp", "descripcion": "Artesanía de alta calidad"},
    {"ocupacion": "Soldado", "salario_diario": 1, "moneda": "mp", "descripcion": "Servicio militar básico"},
    {"ocupacion": "Guardia veterano", "salario_diario": 2, "moneda": "mp", "descripcion": "Guardia experimentado"},
    {"ocupacion": "Mercenario", "salario_diario": 5, "moneda": "mp", "descripcion": "Combatiente a sueldo"},
    {"ocupacion": "Sirviente", "salario_diario": 1, "moneda": "mc", "descripcion": "Servicio doméstico"},
    {"ocupacion": "Escriba", "salario_diario": 3, "moneda": "mp", "descripcion": "Trabajo administrativo"},
    {"ocupacion": "Sanador", "salario_diario": 5, "moneda": "mp", "descripcion": "Servicios médicos"},
    {"ocupacion": "Guía/Rastreador", "salario_diario": 3, "moneda": "mp", "descripcion": "Conocimiento del terreno"},
    {"ocupacion": "Bardo/Juglar", "salario_diario": 2, "moneda": "mp", "descripcion": "Entretenimiento"},
    {"ocupacion": "Posadero", "salario_diario": 3, "moneda": "mp", "descripcion": "Gestión de posada"},
    {"ocupacion": "Comerciante", "salario_diario": 5, "moneda": "mp", "descripcion": "Comercio y ventas"},
    {"ocupacion": "Herrero", "salario_diario": 3, "moneda": "mp", "descripcion": "Trabajo del metal"},
    {"ocupacion": "Herrero maestro", "salario_diario": 1, "moneda": "mo", "descripcion": "Forja de alta calidad"},
]


@router.get("/salarios")
async def get_salaries():
    """Get salary table"""
    salarios = await db.salarios.find({}).to_list(100)
    if not salarios:
        return {"salarios": DEFAULT_SALARIES}
    return {"salarios": serialize_docs(salarios)}


@router.post("/salarios/init")
async def init_salaries():
    """Initialize default salaries"""
    existing = await db.salarios.find({}).to_list(1)
    if existing:
        return {"message": "Salaries already exist"}
    
    for s in DEFAULT_SALARIES:
        s["_id"] = str(uuid.uuid4())
        await db.salarios.insert_one(s)
    
    return {"message": "Default salaries initialized"}



# === CHARACTER CREATION CONFIG (Equipment and Money by Level of Life) ===

DEFAULT_WEALTH_LEVELS = {
    "Pobre": {
        "descripcion": "Vives al día, con apenas lo necesario para sobrevivir.",
        "dinero_inicial": {"oro": 0, "plata": 0, "cobre": 5, "estano": 0},
        "equipo_adicional": []
    },
    "Frugal": {
        "descripcion": "Vives con lo justo, sin lujos pero sin pasar hambre.",
        "dinero_inicial": {"oro": 0, "plata": 2, "cobre": 10, "estano": 0},
        "equipo_adicional": []
    },
    "Común": {
        "descripcion": "Tienes lo suficiente para vivir cómodamente.",
        "dinero_inicial": {"oro": 0, "plata": 10, "cobre": 20, "estano": 0},
        "equipo_adicional": []
    },
    "Próspero": {
        "descripcion": "Gozas de cierta abundancia y comodidades.",
        "dinero_inicial": {"oro": 2, "plata": 20, "cobre": 0, "estano": 0},
        "equipo_adicional": []
    },
    "Rico": {
        "descripcion": "Posees grandes riquezas y vives con lujo.",
        "dinero_inicial": {"oro": 10, "plata": 50, "cobre": 0, "estano": 0},
        "equipo_adicional": []
    }
}

DEFAULT_OCCUPATION_BONUSES = {
    "Buscador de tesoros": {
        "dinero_extra": {"oro": 0, "plata": 5, "cobre": 0, "estano": 0},
        "equipo_adicional": ["Herramientas de ladrón", "Cuerda (15m)"],
        "descripcion": "El buscador de tesoros empieza con herramientas básicas de exploración."
    },
    "Campeón": {
        "dinero_extra": {"oro": 0, "plata": 0, "cobre": 0, "estano": 0},
        "equipo_adicional": ["Escudo"],
        "descripcion": "El campeón recibe un escudo como parte de su entrenamiento."
    },
    "Erudito": {
        "dinero_extra": {"oro": 0, "plata": 10, "cobre": 0, "estano": 0},
        "equipo_adicional": ["Libro en blanco", "Tinta", "Pluma"],
        "descripcion": "El erudito posee materiales de escritura y conocimiento."
    },
    "Guardián": {
        "dinero_extra": {"oro": 0, "plata": 0, "cobre": 0, "estano": 0},
        "equipo_adicional": ["Kit de curación"],
        "descripcion": "El guardián está preparado para sanar a sus compañeros."
    },
    "Mensajero": {
        "dinero_extra": {"oro": 0, "plata": 5, "cobre": 0, "estano": 0},
        "equipo_adicional": ["Mapa local", "Raciones (3 días)"],
        "descripcion": "El mensajero viaja ligero pero preparado."
    },
    "Montaraz": {
        "dinero_extra": {"oro": 0, "plata": 0, "cobre": 0, "estano": 0},
        "equipo_adicional": ["Kit de explorador", "Trampa para caza"],
        "descripcion": "El montaraz domina la supervivencia en la naturaleza."
    }
}

DEFAULT_CULTURE_BONUSES = {
    "_default": {
        "equipo_cultural": [],
        "idiomas_adicionales": [],
        "descripcion": "Sin bonificaciones especiales de cultura."
    }
}


@router.get("/character-creation-config")
async def get_character_creation_config():
    """Get character creation configuration (wealth levels, occupation bonuses, culture bonuses)"""
    config = await db.character_creation_config.find_one({"_id": "main"})
    
    if not config:
        # Return defaults if no config exists
        return {
            "wealth_levels": DEFAULT_WEALTH_LEVELS,
            "occupation_bonuses": DEFAULT_OCCUPATION_BONUSES,
            "culture_bonuses": DEFAULT_CULTURE_BONUSES,
            "updated_at": None
        }
    
    return {
        "wealth_levels": config.get("wealth_levels", DEFAULT_WEALTH_LEVELS),
        "occupation_bonuses": config.get("occupation_bonuses", DEFAULT_OCCUPATION_BONUSES),
        "culture_bonuses": config.get("culture_bonuses", DEFAULT_CULTURE_BONUSES),
        "updated_at": config.get("updated_at")
    }


@router.put("/character-creation-config")
async def update_character_creation_config(config: dict = Body(...)):
    """Update entire character creation configuration"""
    update_data = {
        "wealth_levels": config.get("wealth_levels", DEFAULT_WEALTH_LEVELS),
        "occupation_bonuses": config.get("occupation_bonuses", DEFAULT_OCCUPATION_BONUSES),
        "culture_bonuses": config.get("culture_bonuses", DEFAULT_CULTURE_BONUSES),
        "updated_at": now_utc()
    }
    
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Configuration saved successfully"}


@router.put("/character-creation-config/wealth-levels")
async def update_wealth_levels(levels: dict = Body(...)):
    """Update only wealth levels configuration"""
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {"wealth_levels": levels, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Wealth levels updated"}


@router.put("/character-creation-config/occupation-bonuses")
async def update_occupation_bonuses(bonuses: dict = Body(...)):
    """Update only occupation bonuses configuration"""
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {"occupation_bonuses": bonuses, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Occupation bonuses updated"}


@router.put("/character-creation-config/culture-bonuses")
async def update_culture_bonuses(bonuses: dict = Body(...)):
    """Update only culture bonuses configuration"""
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {"culture_bonuses": bonuses, "updated_at": now_utc()}},
        upsert=True
    )
    return {"message": "Culture bonuses updated"}


@router.post("/character-creation-config/reset")
async def reset_character_creation_config():
    """Reset configuration to defaults"""
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {
            "wealth_levels": DEFAULT_WEALTH_LEVELS,
            "occupation_bonuses": DEFAULT_OCCUPATION_BONUSES,
            "culture_bonuses": DEFAULT_CULTURE_BONUSES,
            "updated_at": now_utc()
        }},
        upsert=True
    )
    return {"message": "Configuration reset to defaults"}


@router.get("/character-creation-config/wealth-level/{level_name}")
async def get_wealth_level(level_name: str):
    """Get specific wealth level configuration"""
    config = await db.character_creation_config.find_one({"_id": "main"})
    
    if not config:
        levels = DEFAULT_WEALTH_LEVELS
    else:
        levels = config.get("wealth_levels", DEFAULT_WEALTH_LEVELS)
    
    if level_name not in levels:
        raise HTTPException(status_code=404, detail=f"Wealth level '{level_name}' not found")
    
    return {"level_name": level_name, "config": levels[level_name]}


@router.put("/character-creation-config/wealth-level/{level_name}")
async def update_single_wealth_level(level_name: str, level_config: dict = Body(...)):
    """Update a single wealth level"""
    config = await db.character_creation_config.find_one({"_id": "main"})
    
    if not config:
        levels = dict(DEFAULT_WEALTH_LEVELS)
    else:
        levels = config.get("wealth_levels", dict(DEFAULT_WEALTH_LEVELS))
    
    levels[level_name] = {
        "descripcion": level_config.get("descripcion", ""),
        "dinero_inicial": level_config.get("dinero_inicial", {"oro": 0, "plata": 0, "cobre": 0, "estano": 0}),
        "equipo_adicional": level_config.get("equipo_adicional", [])
    }
    
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {"wealth_levels": levels, "updated_at": now_utc()}},
        upsert=True
    )
    
    return {"message": f"Wealth level '{level_name}' updated"}


@router.put("/character-creation-config/occupation-bonus/{occupation_name}")
async def update_single_occupation_bonus(occupation_name: str, bonus_config: dict = Body(...)):
    """Update a single occupation bonus"""
    config = await db.character_creation_config.find_one({"_id": "main"})
    
    if not config:
        bonuses = dict(DEFAULT_OCCUPATION_BONUSES)
    else:
        bonuses = config.get("occupation_bonuses", dict(DEFAULT_OCCUPATION_BONUSES))
    
    bonuses[occupation_name] = {
        "dinero_extra": bonus_config.get("dinero_extra", {"oro": 0, "plata": 0, "cobre": 0, "estano": 0}),
        "equipo_adicional": bonus_config.get("equipo_adicional", []),
        "descripcion": bonus_config.get("descripcion", "")
    }
    
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {"occupation_bonuses": bonuses, "updated_at": now_utc()}},
        upsert=True
    )
    
    return {"message": f"Occupation bonus '{occupation_name}' updated"}


@router.delete("/character-creation-config/occupation-bonus/{occupation_name}")
async def delete_occupation_bonus(occupation_name: str):
    """Delete an occupation bonus"""
    config = await db.character_creation_config.find_one({"_id": "main"})
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    bonuses = config.get("occupation_bonuses", {})
    
    if occupation_name not in bonuses:
        raise HTTPException(status_code=404, detail=f"Occupation bonus '{occupation_name}' not found")
    
    del bonuses[occupation_name]
    
    await db.character_creation_config.update_one(
        {"_id": "main"},
        {"$set": {"occupation_bonuses": bonuses, "updated_at": now_utc()}}
    )
    
    return {"message": f"Occupation bonus '{occupation_name}' deleted"}



# === WEAPON/ARMOR STORY GENERATOR ===

class StoryGeneratorRequest(BaseModel):
    nombre: str
    categoria: str  # arma, armadura, escudo
    manufactura: str  # numenorean, elven_eregion, etc.
    equipo_base: Optional[str] = None  # espada, hacha, cota de malla, etc.
    cualidades: Optional[List[str]] = []
    perdiciones: Optional[List[str]] = []

@router.post("/generate-weapon-story")
async def generate_weapon_story(data: StoryGeneratorRequest):
    """Generate an epic but moderate story for a weapon/armor using AI"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid
        
        # Build context based on manufacture
        manufacture_context = {
            "numenorean": "forjada en los reinos de los Dúnedain, herederos de Númenor, en las fraguas de Oesternesse",
            "elven_eregion": "creada por los herreros élficos de Eregion, en los días de Celebrimbor, antes de la caída de Ost-in-Edhil",
            "elven_beleriand": "una reliquia de la Primera Edad, forjada en las antiguas fraguas de los Noldor en Beleriand, quizás en Gondolin o Nargothrond",
            "dwarven_khazad": "forjada en las profundidades de Khazad-dûm por los maestros herreros de Durin, cuando Moria aún brillaba con esplendor",
            "dwarven_erebor": "creada bajo la Montaña Solitaria por los artesanos de Erebor, guardianes del tesoro del Rey bajo la Montaña",
            "dwarven_beleriand": "una obra maestra de los enanos de Nogrod o Belegost, de los días antiguos cuando comerciaban con los elfos de Beleriand"
        }
        
        categoria_text = {
            "arma": "arma",
            "armadura": "armadura",
            "escudo": "escudo"
        }
        
        context = manufacture_context.get(data.manufactura, "de origen misterioso")
        tipo = categoria_text.get(data.categoria, "objeto")
        equipo = data.equipo_base or tipo
        
        # Build qualities text
        cualidades_text = ""
        if data.cualidades:
            cualidades_text = f"Posee cualidades encantadas: {', '.join(data.cualidades)}. "
        
        perdiciones_text = ""
        if data.perdiciones:
            perdiciones_text = f"Es especialmente temida por: {', '.join(data.perdiciones)}. "
        
        prompt = f"""Genera una historia BREVE (máximo 150 palabras) para un {tipo} llamado "{data.nombre}".

CONTEXTO:
- Es un/a {equipo} {context}
- {cualidades_text}{perdiciones_text}

INSTRUCCIONES IMPORTANTES:
1. La historia debe ser épica pero MODERADA - NO al nivel de Andúril, Glamdring o artefactos legendarios
2. NO menciones personajes principales de los libros (Aragorn, Gandalf, Frodo, etc.)
3. Inventa un héroe o herrero MENOR y FICTICIO (un capitán olvidado, un herrero sin nombre famoso, un guerrero de una escaramuza)
4. Menciona una batalla o evento MENOR, no las grandes guerras
5. Escribe en español, con tono evocador pero sin exagerar
6. La historia debe explicar cómo se forjó, quién la empuñó brevemente y cómo se perdió o pasó de mano

Genera SOLO la historia, sin introducciones ni comentarios."""

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"weapon_story_{uuid.uuid4().hex[:8]}",
            system_message="""Eres un narrador de la Tierra Media especializado en crear historias de objetos mágicos.
Escribes en español con un tono evocador pero moderado, evitando exageraciones épicas.
Inventas personajes menores y eventos secundarios que encajan en el mundo de Tolkien sin alterar la historia principal."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {"success": True, "historia": response.strip() if response else ""}
        
    except Exception as e:
        logger.error(f"Error generating story: {e}")
        return {"success": False, "error": str(e), "historia": ""}


# === PERSONAL HISTORY GENERATOR ===

class PersonalHistoryRequest(BaseModel):
    nombre_personaje: str
    cultura: Optional[str] = None
    vocacion: Optional[str] = None
    trasfondo: Optional[str] = None
    descripcion_trasfondo: Optional[str] = None
    rasgos: Optional[List] = []

@router.post("/generate-personal-history")
async def generate_personal_history(data: PersonalHistoryRequest):
    """Generate a personal history for a character based on their background"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import uuid
        
        # Build rasgos text
        rasgos_text = ""
        if data.rasgos:
            rasgos_list = []
            for r in data.rasgos:
                if isinstance(r, dict):
                    rasgos_list.append(r.get('nombre', str(r)))
                else:
                    rasgos_list.append(str(r))
            rasgos_text = f"Rasgos de personalidad: {', '.join(rasgos_list)}. "
        
        prompt = f"""Genera una historia personal BREVE para un personaje de la Tierra Media.

DATOS DEL PERSONAJE:
- Nombre: {data.nombre_personaje}
- Cultura: {data.cultura or 'Desconocida'}
- Vocación: {data.vocacion or 'Aventurero'}
- Trasfondo: {data.trasfondo or 'Común'}
- {rasgos_text}

DESCRIPCIÓN BASE DEL TRASFONDO:
{data.descripcion_trasfondo or 'Sin descripción'}

INSTRUCCIONES:
1. Escribe un ÚNICO PÁRRAFO de máximo 100 palabras
2. Personaliza la historia genérica del trasfondo para este personaje específico
3. Menciona su nombre, cultura y algún detalle que lo haga único
4. NO inventes eventos épicos ni conexiones con personajes famosos de Tolkien
5. Mantén un tono cotidiano pero evocador de la Tierra Media
6. El texto debe caber en un espacio pequeño de ficha de personaje

Genera SOLO el párrafo de historia, sin títulos ni comentarios adicionales."""

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"personal_history_{uuid.uuid4().hex[:8]}",
            system_message="""Eres un narrador de la Tierra Media que crea historias personales breves para personajes de rol.
Escribes textos concisos y evocadores que personalizan trasfondos genéricos sin añadir elementos épicos innecesarios."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {"success": True, "historia": response.strip() if response else ""}
        
    except Exception as e:
        logger.error(f"Error generating personal history: {e}")
        return {"success": False, "error": str(e), "historia": ""}


# ============ EQUIPMENT EXCEL IMPORT/EXPORT (Mayo 2026) ============
# El DJ puede:
#   • Exportar todo el catálogo a un .xlsx (una hoja por categoría, cabecera
#     con todos los campos soportados, valores listos para editar).
#   • Importar un .xlsx: cada fila actualiza/crea un item. Si ya existe un
#     item con el mismo `nombre` dentro de la misma categoría (comparación
#     case-insensitive + Unicode NFC), se **sobreescribe** (upsert por nombre),
#     evitando duplicados.

EQUIPMENT_XLSX_COLUMNS = [
    # Comunes
    "nombre", "precio", "moneda", "peso_kg", "descripcion", "comentarios", "otros",
    "disponible_creacion",
    # Armas
    "dano", "modificador", "alcance", "herida",
    # Armaduras
    "ca", "ca_bonus", "propiedades", "tipo_dano",
    # Hierbas / venenos
    "forma_preparacion", "efecto",
    # Monturas / transporte
    "capacidad_carga", "constitucion", "velocidad", "capacidad_pequeno",
    "capacidad_mediano", "capacidad_monta", "pasajeros", "capacidad_kg",
    # Comida / consumibles / construcción
    "es_racion_diaria", "unidades_paquete", "racion_valor", "m2",
    # Disponibilidad y venta
    "nivel_asentamiento", "regiones_disponibles", "profesiones",
]

# Campos que son LISTAS (se serializan separados por " | " en el Excel).
EQUIPMENT_LIST_COLUMNS = {"nivel_asentamiento", "regiones_disponibles", "profesiones"}
# Campos booleanos.
EQUIPMENT_BOOL_COLUMNS = {"disponible_creacion", "es_racion_diaria", "capacidad_pequeno", "capacidad_mediano"}
# Campos numéricos.
EQUIPMENT_NUM_COLUMNS = {"precio", "peso_kg", "herida", "ca", "ca_bonus", "capacidad_carga",
                         "velocidad", "pasajeros", "unidades_paquete", "racion_valor", "capacidad_kg"}
_EQUIPMENT_INTERNAL_KEYS = {"_id", "updated_at", "version", "_block_profesiones"}


def _equipment_columns(catalog: dict) -> list:
    """Columnas base + cualquier campo extra presente en los items (nada se queda fuera)."""
    cols = list(EQUIPMENT_XLSX_COLUMNS)
    seen = set(cols)
    for cat_key, items in (catalog or {}).items():
        if cat_key in _EQUIPMENT_INTERNAL_KEYS or not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            for k in it.keys():
                if k not in seen:
                    seen.add(k)
                    cols.append(k)
    return cols


def _equipment_cell(col: str, value):
    """Serializa un valor para una celda del Excel."""
    if value is None:
        return ""
    if col in EQUIPMENT_LIST_COLUMNS or isinstance(value, list):
        return " | ".join(str(x) for x in value) if isinstance(value, list) else str(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict):
        return str(value)
    return value


@router.get("/equipment/export-xlsx")
async def export_equipment_xlsx():
    """Exporta el catálogo completo a un .xlsx (una hoja por categoría) con TODOS los campos."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")

    columns = _equipment_columns(catalog)
    wb = Workbook()
    wb.remove(wb.active)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="4B5563")

    for cat_key, items in catalog.items():
        if cat_key in _EQUIPMENT_INTERNAL_KEYS or not isinstance(items, list):
            continue
        ws = wb.create_sheet(title=cat_key[:31] or "items")
        ws.append(columns)
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
        for it in items:
            ws.append([_equipment_cell(col, it.get(col)) for col in columns])
        for col_cells in ws.columns:
            max_len = max((len(str(c.value)) for c in col_cells if c.value is not None), default=8)
            ws.column_dimensions[col_cells[0].column_letter].width = min(40, max(10, max_len + 2))

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"equipment_catalog_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.get("/equipment/template-xlsx")
async def equipment_template_xlsx():
    """Devuelve una plantilla vacía con una hoja por categoría estándar y
    una fila de ejemplo con los formatos esperados."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    # Usamos las categorías actuales del catálogo si existen; si no, fallback.
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or {}
    cat_keys = [k for k in catalog.keys() if k not in _EQUIPMENT_INTERNAL_KEYS and isinstance(catalog.get(k), list)]
    if not cat_keys:
        cat_keys = [
            "armas_sencillas_cc", "armas_marciales_cc", "armaduras_ligeras",
            "armaduras_medias", "armaduras_pesadas", "escudos", "equipo_general",
            "consumibles", "herramientas", "monturas", "transporte_terrestre",
            "gemas_preciosas", "gemas_semipreciosas", "ropa",
        ]

    wb = Workbook()
    wb.remove(wb.active)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="6D28D9")

    columns = _equipment_columns(catalog)
    for cat in cat_keys:
        ws = wb.create_sheet(title=cat[:31])
        ws.append(columns)
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
        # Fila de ejemplo
        sample = {
            "nombre": "Ejemplo (reemplázame)",
            "precio": 10,
            "moneda": "mp",
            "peso_kg": 0.5,
            "disponible_creacion": "true",
            "descripcion": "Descripción opcional del ítem.",
            "profesiones": "Mercader | Herrero",
            "regiones_disponibles": "Eriador | Gondor",
        }
        ws.append([sample.get(c, "") for c in columns])
        for col_cells in ws.columns:
            ws.column_dimensions[col_cells[0].column_letter].width = 18

    # Hoja "LEEME" con instrucciones
    readme = wb.create_sheet(title="LEEME", index=0)
    readme.append(["Plantilla de importación de equipo — Middle-earth 5e"])
    readme.append([""])
    readme.append(["• Una hoja por categoría (p.ej. armas_sencillas_cc, monturas...)."])
    readme.append(["• Al importar, cada fila crea o SOBREESCRIBE el ítem con el mismo"])
    readme.append(["  'nombre' dentro de su categoría (comparación case-insensitive)."])
    readme.append(["• Los campos no aplicables a una categoría pueden dejarse vacíos."])
    readme.append(["• Booleanos (disponible_creacion, es_racion_diaria...): true/false/1/0/sí/no."])
    readme.append(["• Listas (profesiones, regiones_disponibles, nivel_asentamiento, propiedades):"])
    readme.append(["  separa los valores con ' | ' (barra vertical). Ej: Mercader | Herrero"])
    readme.append([""])
    readme.append(["Columnas soportadas:"] + columns)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=equipment_template.xlsx"},
    )


@router.post("/equipment/import-xlsx")
async def import_equipment_xlsx(file: UploadFile = File(...)):
    """Importa un .xlsx con items. Upsert por (categoría, nombre)."""
    import io
    import unicodedata
    from openpyxl import load_workbook

    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="El archivo debe ser .xlsx")

    content = await file.read()
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Archivo no válido: {e}")

    def parse_bool(v):
        if isinstance(v, bool):
            return v
        if v is None:
            return None
        s = str(v).strip().lower()
        if s in ("true", "1", "yes", "sí", "si", "y"):
            return True
        if s in ("false", "0", "no", "n", ""):
            return False
        return None

    def parse_num(v):
        if v is None or v == "":
            return None
        try:
            f = float(v)
            return int(f) if f.is_integer() else f
        except (TypeError, ValueError):
            return None

    def norm(s):
        return unicodedata.normalize("NFC", (str(s) or "").strip().casefold())

    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    if not catalog:
        catalog = {"_id": "main"}
        await db.equipment_catalog.insert_one(catalog)

    reserved = {"LEEME", "_id", "updated_at", "version"}
    stats = {"categories": 0, "created": 0, "updated": 0, "skipped": 0, "details": []}

    for sheet_name in wb.sheetnames:
        if sheet_name.strip().upper() in reserved:
            continue
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        headers = [str(h).strip() if h else "" for h in rows[0]]
        if "nombre" not in [h.lower() for h in headers]:
            stats["details"].append(f"{sheet_name}: omitido (falta columna 'nombre')")
            stats["skipped"] += 1
            continue

        cat_key = sheet_name.strip().lower()
        existing_items = list(catalog.get(cat_key, []) or [])
        # Index by normalised name for fast upsert.
        idx_by_name = {norm(it.get("nombre", "")): i for i, it in enumerate(existing_items)}

        created = updated = 0
        for row in rows[1:]:
            if not row or all(c is None or c == "" for c in row):
                continue
            item = {}
            for h, v in zip(headers, row):
                if not h:
                    continue
                key = h.lower()
                if key in EQUIPMENT_BOOL_COLUMNS:
                    b = parse_bool(v)
                    if b is not None:
                        item[key] = b
                elif key in EQUIPMENT_NUM_COLUMNS:
                    n = parse_num(v)
                    if n is not None:
                        item[key] = n
                elif key in EQUIPMENT_LIST_COLUMNS:
                    if v is not None and str(v).strip() != "":
                        # Acepta separadores | , ;
                        raw = str(v).replace(";", "|").replace(",", "|")
                        item[key] = [p.strip() for p in raw.split("|") if p.strip()]
                elif v is not None and v != "":
                    item[key] = v
            nombre = str(item.get("nombre", "")).strip()
            if not nombre:
                continue
            item["nombre"] = nombre
            k = norm(nombre)
            if k in idx_by_name:
                existing_items[idx_by_name[k]] = {**existing_items[idx_by_name[k]], **item}
                updated += 1
            else:
                existing_items.append(item)
                idx_by_name[k] = len(existing_items) - 1
                created += 1

        await db.equipment_catalog.update_one(
            {"_id": catalog["_id"]},
            {"$set": {cat_key: existing_items, "updated_at": datetime.now(timezone.utc)}},
        )
        stats["categories"] += 1
        stats["created"] += created
        stats["updated"] += updated
        stats["details"].append(f"{sheet_name}: {created} creados, {updated} actualizados ({cat_key})")

    return {"success": True, "stats": stats}
