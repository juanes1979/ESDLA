"""
Game Data API Routes
Endpoints for retrieving game data (cultures, backgrounds, occupations, etc.)
"""
from fastapi import APIRouter, HTTPException, Query, Body
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
    
    return {
        "culture_id": culture_id,
        "culture_name": culture.get("nombre"),
        "tiene_virtud_inicial": culture.get("tiene_virtud_inicial", False),
        "permite_virtudes_comunes": culture.get("permite_virtudes_comunes", False),
        "virtues": serialize_docs(virtues)
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

@router.get("/patrons")
async def get_patrons():
    """Get all patrons/mecenas"""
    patrons = await db.patrons.find({}).to_list(50)
    return {"patrons": serialize_docs(patrons)}


@router.get("/patrons/{patron_id}")
async def get_patron(patron_id: str):
    """Get a specific patron by ID"""
    patron = await db.patrons.find_one({"_id": patron_id})
    if not patron:
        raise HTTPException(status_code=404, detail="Patron not found")
    return serialize_doc(patron)


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
            "monturas": [],
            "accesorios_monturas": [],
            "transporte_terrestre": [],
            "transporte_maritimo": [],
            "construccion": []
        }
    
    # Build full result from catalog
    all_keys = [
        "herramientas", "juegos", "instrumentos_musicales", "equipo_general",
        "consumibles", "comida_posadas", "hierbas", "venenos",
        "armas_sencillas_cc", "armas_sencillas_distancia", "armas_marciales_cc", "armas_marciales_distancia",
        "armaduras_ligeras", "armaduras_medias", "armaduras_pesadas", "escudos",
        "monturas", "accesorios_monturas", "transporte_terrestre", "transporte_maritimo",
        "construccion"
    ]
    
    result = {key: catalog.get(key, []) for key in all_keys}
    
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
    
    return result


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
    """Get shadow rules including pavor, avaricia, fechorias, estados, sendas"""
    sombra = await db.sombra_rules.find_one({"_id": "main"})
    if not sombra:
        return {
            "pavor": [],
            "avaricia": [],
            "fechorias": [],
            "estados": [],
            "sendas_sombra": []
        }
    return {
        "pavor": sombra.get("pavor", []),
        "avaricia": sombra.get("avaricia", []),
        "fechorias": sombra.get("fechorias", []),
        "estados": sombra.get("estados", []),
        "sendas_sombra": sombra.get("sendas_sombra", [])
    }


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
    """Get rewards data"""
    recompensas = await db.recompensas.find_one({"_id": "main"})
    if not recompensas:
        return {
            "mejoras_equipo": [],
            "niveles_recompensa": [],
            "bonificador_competencia": []
        }
    return {
        "mejoras_equipo": recompensas.get("mejoras_equipo", []),
        "niveles_recompensa": recompensas.get("niveles_recompensa", []),
        "bonificador_competencia": recompensas.get("bonificador_competencia", [])
    }


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
                "key": "construccion",
                "name": "Elementos de Construcción",
                "fields": ["nombre", "precio", "moneda", "peso_kg", "m2"]
            }
        ]
    }
