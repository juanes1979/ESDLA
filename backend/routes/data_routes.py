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


# === NPCs, ENEMIES, ANIMALS ===

@router.get("/npcs")
async def get_all_npcs(categoria: Optional[str] = None, search: Optional[str] = None):
    """Get all NPCs/enemies/animals, optionally filtered by category and search term"""
    query = {}
    if categoria:
        query["categoria"] = categoria
    if search:
        query["$or"] = [
            {"nombre": {"$regex": search, "$options": "i"}},
            {"tipo": {"$regex": search, "$options": "i"}},
            {"descripcion": {"$regex": search, "$options": "i"}}
        ]
    
    npcs = await db.npcs.find(query).to_list(500)
    
    # Group by category
    grouped = {
        'malignos': [],
        'pnj': [],
        'animales': [],
        'especiales': []
    }
    
    for npc in npcs:
        cat = npc.get('categoria', 'especiales')
        if cat in grouped:
            # Build comprehensive NPC object
            npc_data = {
                'id': npc['_id'],
                'nombre': npc.get('nombre'),
                'descripcion': npc.get('descripcion'),
                'tipo': npc.get('tipo'),
                'tamanio': npc.get('tamanio'),
                'alineamiento': npc.get('alineamiento'),
                # Combat stats
                'clase_armadura': npc.get('clase_armadura'),
                'descripcion_armadura': npc.get('descripcion_armadura'),
                'puntos_golpe': npc.get('puntos_golpe'),
                'dados_golpe': npc.get('dados_golpe'),
                'velocidad': npc.get('velocidad'),
                'velocidades_especiales': npc.get('velocidades_especiales'),
                'velocidad_nota': npc.get('velocidad_nota'),
                # Attributes
                'atributos': npc.get('atributos'),
                # Saves & Skills
                'tiradas_salvacion': npc.get('tiradas_salvacion'),
                'habilidades': npc.get('habilidades'),
                'percepcion_pasiva': npc.get('percepcion_pasiva', 10),
                # Resistances & Immunities
                'resistencias': npc.get('resistencias', []),
                'inmunidades_dano': npc.get('inmunidades_dano', []),
                'inmunidades_estados': npc.get('inmunidades_estados', []),
                'vulnerabilidades': npc.get('vulnerabilidades', []),
                # Senses & Languages  
                'sentidos': npc.get('sentidos'),
                'idiomas': npc.get('idiomas', []),
                # Challenge
                'desafio': npc.get('desafio'),
                'experiencia': npc.get('experiencia'),
                'bonificador_competencia': npc.get('bonificador_competencia', 2),
                # Special Abilities (new structured format)
                'especiales': npc.get('especiales', []),
                # Legacy 'especial' field for backwards compatibility
                'especial': npc.get('especial'),
                # Weapons (new structured format)
                'armas': npc.get('armas', []),
                # Other Actions
                'acciones': npc.get('acciones'),
                'ataque_multiple': npc.get('ataque_multiple'),
                # Reactions
                'reacciones': npc.get('reacciones', []),
                # Legendary Actions
                'acciones_legendarias': npc.get('acciones_legendarias', []),
                # AI-generated story
                'historia': npc.get('historia')
            }
            grouped[cat].append(npc_data)
    
    return grouped


@router.get("/npcs/{npc_id}")
async def get_npc(npc_id: str):
    """Get a single NPC by ID"""
    npc = await db.npcs.find_one({"_id": npc_id})
    if not npc:
        raise HTTPException(status_code=404, detail="NPC not found")
    result = {k: v for k, v in npc.items() if k != '_id'}
    result['id'] = npc['_id']
    return result


# === NPC CRUD Models ===

class ArmaAtaque(BaseModel):
    """Structured weapon/attack data for combat automation"""
    nombre: str
    tipo: str = "cuerpo a cuerpo"  # cuerpo a cuerpo, distancia
    bonificador_impacto: Optional[int] = None
    alcance: Optional[str] = None  # "5 pies" or "20/60 pies"
    alcance_metros: Optional[str] = None  # "1,5 m" or "6/18 m"
    dano: Optional[str] = None  # "1d8 + 3"
    tipo_dano: Optional[str] = None  # cortante, perforante, contundente
    dano_extra: Optional[str] = None  # Additional damage like fire, poison
    efecto: Optional[str] = None  # Special effects on hit

class AccionNPC(BaseModel):
    """Non-weapon actions like special abilities"""
    nombre: str
    descripcion: str
    recarga: Optional[str] = None  # "Se recarga tras un descanso corto o largo"
    dano: Optional[str] = None
    salvacion: Optional[str] = None  # "Fuerza CD 14"
    alcance: Optional[str] = None

class ReaccionNPC(BaseModel):
    """Reactions like Parry"""
    nombre: str
    descripcion: str

class NPCCreate(BaseModel):
    """Create/update NPC with structured data"""
    nombre: str
    categoria: str = "malignos"  # malignos, pnj, animales, especiales
    descripcion: Optional[str] = ""
    tipo: Optional[str] = ""  # "Humanoide Mediano (orco)", "Bestia Grande"
    tamanio: Optional[str] = "Mediano"  # Pequeño, Mediano, Grande, Enorme, Gargantuesco
    alineamiento: Optional[str] = ""
    
    # Combat stats
    clase_armadura: Optional[int] = 10
    descripcion_armadura: Optional[str] = ""  # "cota de mallas, escudo"
    puntos_golpe: Optional[int] = 1
    dados_golpe: Optional[str] = ""  # "2d8 + 2"
    velocidad: Optional[float] = 9  # meters
    velocidades_especiales: Optional[Dict[str, float]] = None  # {"volar": 15, "nadar": 9, "excavar": 6}
    
    # Attributes
    atributos: Optional[Dict[str, int]] = None  # fuerza, destreza, etc.
    
    # Saves & Skills
    tiradas_salvacion: Optional[Dict[str, int]] = None  # {"constitucion": 5, "fuerza": 4}
    habilidades: Optional[Dict[str, int]] = None  # {"percepcion": 5, "sigilo": 4}
    percepcion_pasiva: Optional[int] = 10
    
    # Resistances & Immunities
    resistencias: Optional[List[str]] = []
    inmunidades_dano: Optional[List[str]] = []
    inmunidades_estados: Optional[List[str]] = []
    vulnerabilidades: Optional[List[str]] = []
    
    # Senses & Languages
    sentidos: Optional[List[str]] = []  # ["Visión en la oscuridad 120 pies", "Visión verdadera 60 pies"]
    idiomas: Optional[List[str]] = []
    
    # Challenge
    desafio: Optional[str] = ""  # "3 (700 PX)"
    experiencia: Optional[int] = 0
    bonificador_competencia: Optional[int] = 2
    
    # Special Abilities (structured list)
    especiales: Optional[List[Dict[str, str]]] = []  # [{nombre, descripcion, efecto_juego}]
    
    # Attacks (structured weapons)
    armas: Optional[List[Dict]] = []  # List of ArmaAtaque-like dicts
    
    # Other Actions
    acciones: Optional[List[Dict]] = []  # List of AccionNPC-like dicts
    ataque_multiple: Optional[str] = ""  # "Lleva a cabo dos ataques cuerpo a cuerpo"
    
    # Reactions
    reacciones: Optional[List[Dict]] = []  # List of ReaccionNPC-like dicts
    
    # Legendary Actions (for bosses)
    acciones_legendarias: Optional[List[Dict]] = []
    
    # Future AI-generated story
    historia: Optional[str] = ""


@router.post("/npcs")
async def create_npc(data: NPCCreate):
    """Create a new NPC (admin only)"""
    npc = data.dict()
    npc["_id"] = str(uuid.uuid4())
    npc["created_at"] = now_utc()
    npc["updated_at"] = now_utc()
    
    await db.npcs.insert_one(npc)
    
    result = {k: v for k, v in npc.items() if k != '_id'}
    result['id'] = npc['_id']
    return result


@router.patch("/npcs/{npc_id}")
async def update_npc(npc_id: str, data: dict = Body(...)):
    """Update an existing NPC (admin only)"""
    npc = await db.npcs.find_one({"_id": npc_id})
    if not npc:
        raise HTTPException(status_code=404, detail="NPC not found")
    
    # Build update document
    update = {"updated_at": now_utc()}
    for key, value in data.items():
        if key not in ["_id", "id", "created_at"]:
            update[key] = value
    
    await db.npcs.update_one({"_id": npc_id}, {"$set": update})
    
    updated = await db.npcs.find_one({"_id": npc_id})
    result = {k: v for k, v in updated.items() if k != '_id'}



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
    location = await db.locations.find_one({"_id": location_id})
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

class RegionUpdate(BaseModel):
    nombre: Optional[str] = None
    parent_id: Optional[str] = None
    descripcion: Optional[str] = None
    orden: Optional[int] = None

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
    
    origin = await db.locations.find_one({"_id": origin_id})
    destination = await db.locations.find_one({"_id": destination_id})
    
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


@router.delete("/npcs/{npc_id}")
async def delete_npc(npc_id: str):
    """Delete an NPC (admin only)"""
    result = await db.npcs.delete_one({"_id": npc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="NPC not found")
    return {"message": "NPC eliminado correctamente"}


@router.post("/npcs/{npc_id}/copy")
async def copy_npc(npc_id: str, new_name: str = Body(..., embed=True)):
    """Copy an existing NPC with a new name (admin only)"""
    npc = await db.npcs.find_one({"_id": npc_id})
    if not npc:
        raise HTTPException(status_code=404, detail="NPC not found")
    
    # Create copy
    new_npc = {**npc}
    new_npc["_id"] = str(uuid.uuid4())
    new_npc["nombre"] = new_name
    new_npc["created_at"] = now_utc()
    new_npc["updated_at"] = now_utc()
    
    await db.npcs.insert_one(new_npc)
    
    result = {k: v for k, v in new_npc.items() if k != '_id'}
    result['id'] = new_npc['_id']
    return result


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
