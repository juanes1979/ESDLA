"""
Game Data API Routes
Endpoints for retrieving game data (cultures, backgrounds, occupations, etc.)
"""
from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
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
        "armaduras_ligeras", "armaduras_medias", "armaduras_pesadas", "escudos",
        "monturas", "accesorios_monturas", "transporte_terrestre", "transporte_maritimo",
        "recursos_desarrollo", "gemas_preciosas", "gemas_semipreciosas"
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
    origin = await db.locations.find_one({"_id": origin_id})
    destination = await db.locations.find_one({"_id": destination_id})
    
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


# === MODIFICADORES DE PRECIO (Price Modifiers) ===

# Default price modifiers data
DEFAULT_PRICE_MODIFIERS = {
    "region": [
        {"nombre": "Eriador", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Rivendell (Imladris)", "modificador": 0.9, "descripcion": "-10% (artesanía élfica)"},
        {"nombre": "Rohan", "modificador": 0.95, "descripcion": "-5% (caballos y cuero más baratos)"},
        {"nombre": "Gondor", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Minas Tirith", "modificador": 1.1, "descripcion": "+10% (ciudad capital)"},
        {"nombre": "Dol Amroth", "modificador": 1.05, "descripcion": "+5% (puerto importante)"},
        {"nombre": "Bosque Negro", "modificador": 1.15, "descripcion": "+15% (peligroso, escasez)"},
        {"nombre": "Erebor", "modificador": 0.85, "descripcion": "-15% (productos enanos)"},
        {"nombre": "Valle (Dale)", "modificador": 0.95, "descripcion": "-5% (comercio enano)"},
        {"nombre": "Esgaroth (Ciudad del Lago)", "modificador": 1.0, "descripcion": "Precio base (comercio)"},
        {"nombre": "Comarca", "modificador": 0.9, "descripcion": "-10% (vida sencilla)"},
        {"nombre": "Bree", "modificador": 1.0, "descripcion": "Precio base (cruce de caminos)"},
        {"nombre": "Tierras Salvajes", "modificador": 1.25, "descripcion": "+25% (difícil acceso)"},
        {"nombre": "Mordor/Harad/Rhûn", "modificador": 1.5, "descripcion": "+50% (territorio enemigo)"},
    ],
    "asentamiento": [
        {"nombre": "Aldea pequeña", "modificador": 1.15, "descripcion": "+15% (escasez)"},
        {"nombre": "Aldea", "modificador": 1.1, "descripcion": "+10% (selección limitada)"},
        {"nombre": "Pueblo", "modificador": 1.05, "descripcion": "+5% (comercio modesto)"},
        {"nombre": "Villa", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Ciudad pequeña", "modificador": 0.95, "descripcion": "-5% (competencia)"},
        {"nombre": "Ciudad", "modificador": 0.9, "descripcion": "-10% (gran mercado)"},
        {"nombre": "Capital", "modificador": 0.85, "descripcion": "-15% (máxima competencia)"},
        {"nombre": "Fortaleza/Castillo", "modificador": 1.2, "descripcion": "+20% (suministros militares)"},
        {"nombre": "Puerto", "modificador": 0.9, "descripcion": "-10% (bienes importados)"},
        {"nombre": "Caravana/Nómada", "modificador": 1.3, "descripcion": "+30% (conveniencia)"},
    ],
    "relacion": [
        {"nombre": "Desconocido", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Conocido", "modificador": 0.95, "descripcion": "-5% (familiaridad)"},
        {"nombre": "Amigo", "modificador": 0.85, "descripcion": "-15% (amistad)"},
        {"nombre": "Aliado/Compañero", "modificador": 0.75, "descripcion": "-25% (lealtad)"},
        {"nombre": "Mecenas/Protector", "modificador": 0.5, "descripcion": "-50% (patronazgo)"},
        {"nombre": "Rival/Enemigo conocido", "modificador": 1.25, "descripcion": "+25% (hostilidad)"},
        {"nombre": "Enemigo declarado", "modificador": 1.5, "descripcion": "+50% (rechazo)"},
        {"nombre": "Proscritos/Exiliados", "modificador": 2.0, "descripcion": "+100% (mercado negro)"},
    ],
    "contexto": [
        {"nombre": "Tiempos de paz", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Rumores de guerra", "modificador": 1.1, "descripcion": "+10% (acaparamiento)"},
        {"nombre": "Guerra cercana", "modificador": 1.25, "descripcion": "+25% (escasez)"},
        {"nombre": "Guerra activa", "modificador": 1.5, "descripcion": "+50% (prioridad militar)"},
        {"nombre": "Post-batalla", "modificador": 0.8, "descripcion": "-20% (botín, reconstrucción)"},
        {"nombre": "Hambruna/Sequía", "modificador": 1.75, "descripcion": "+75% (desesperación)"},
        {"nombre": "Festival/Celebración", "modificador": 0.9, "descripcion": "-10% (generosidad)"},
        {"nombre": "Invierno duro", "modificador": 1.2, "descripcion": "+20% (dificultad transporte)"},
    ],
}


@router.get("/modificadores-precio")
async def get_price_modifiers():
    """Get all price modifiers (region, settlement, relationship, context)"""
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        return DEFAULT_PRICE_MODIFIERS
    return {
        "region": modifiers.get("region", DEFAULT_PRICE_MODIFIERS["region"]),
        "asentamiento": modifiers.get("asentamiento", DEFAULT_PRICE_MODIFIERS["asentamiento"]),
        "relacion": modifiers.get("relacion", DEFAULT_PRICE_MODIFIERS["relacion"]),
        "contexto": modifiers.get("contexto", DEFAULT_PRICE_MODIFIERS["contexto"]),
    }


@router.post("/modificadores-precio/init")
async def init_price_modifiers():
    """Initialize default price modifiers in database"""
    existing = await db.price_modifiers.find_one({"_id": "main"})
    if existing:
        return {"message": "Modifiers already exist", "action": "none"}
    
    await db.price_modifiers.insert_one({
        "_id": "main",
        **DEFAULT_PRICE_MODIFIERS,
        "created_at": now_utc()
    })
    return {"message": "Default price modifiers initialized"}


@router.put("/modificadores-precio/{category}/{index}")
async def update_price_modifier(category: str, index: int, data: dict = Body(...)):
    """Update a specific price modifier"""
    if category not in ["region", "asentamiento", "relacion", "contexto"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        # Initialize first
        modifiers = {"_id": "main", **DEFAULT_PRICE_MODIFIERS}
        await db.price_modifiers.insert_one(modifiers)
    
    category_list = modifiers.get(category, [])
    if index < 0 or index >= len(category_list):
        raise HTTPException(status_code=400, detail="Invalid index")
    
    category_list[index] = {
        "nombre": data.get("nombre", category_list[index]["nombre"]),
        "modificador": data.get("modificador", category_list[index]["modificador"]),
        "descripcion": data.get("descripcion", category_list[index]["descripcion"]),
    }
    
    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$set": {category: category_list, "updated_at": now_utc()}}
    )
    
    return {"message": "Modifier updated"}


@router.post("/modificadores-precio/{category}")
async def add_price_modifier(category: str, data: dict = Body(...)):
    """Add a new price modifier to a category"""
    if category not in ["region", "asentamiento", "relacion", "contexto"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        modifiers = {"_id": "main", **DEFAULT_PRICE_MODIFIERS}
        await db.price_modifiers.insert_one(modifiers)
    
    new_modifier = {
        "nombre": data.get("nombre", "Nuevo"),
        "modificador": data.get("modificador", 1.0),
        "descripcion": data.get("descripcion", ""),
    }
    
    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$push": {category: new_modifier}, "$set": {"updated_at": now_utc()}}
    )
    
    return {"message": "Modifier added"}


@router.delete("/modificadores-precio/{category}/{index}")
async def delete_price_modifier(category: str, index: int):
    """Delete a price modifier from a category"""
    if category not in ["region", "asentamiento", "relacion", "contexto"]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        raise HTTPException(status_code=404, detail="Modifiers not found")
    
    category_list = modifiers.get(category, [])
    if index < 0 or index >= len(category_list):
        raise HTTPException(status_code=400, detail="Invalid index")
    
    category_list.pop(index)
    
    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$set": {category: category_list, "updated_at": now_utc()}}
    )
    
    return {"message": "Modifier deleted"}


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


# ============================================================
# TERRAIN EDITOR ENDPOINTS
# ============================================================

class TerrainZone(BaseModel):
    x: float
    y: float
    type: str
    size: float = 0.25

class TerrainZonesData(BaseModel):
    mode: str  # 'terrain' or 'landType'
    cells: List[TerrainZone]

@router.get("/terrain-zones")
async def get_terrain_zones():
    """Get all terrain difficulty zones"""
    doc = await db.terrain_zones.find_one({"_id": "terrain_data"})
    if not doc:
        return {"zones": []}
    return {"zones": doc.get("zones", [])}

@router.post("/terrain-zones")
async def save_terrain_zones(data: TerrainZonesData):
    """Save terrain difficulty zones (overwrite)"""
    cells_data = [cell.dict() for cell in data.cells]
    
    await db.terrain_zones.update_one(
        {"_id": "terrain_data"},
        {
            "$set": {
                "zones": cells_data,
                "mode": data.mode,
                "updated_at": now_utc()
            }
        },
        upsert=True
    )
    
    return {"message": f"Terrain zones saved ({len(cells_data)} cells)", "count": len(cells_data)}

@router.delete("/terrain-zones")
async def clear_terrain_zones():
    """Clear all terrain zones"""
    await db.terrain_zones.delete_one({"_id": "terrain_data"})
    return {"message": "Terrain zones cleared"}

# ============================================================
# TERRAIN POLYGONS (More efficient than cells)
# ============================================================

class PolygonPoint(BaseModel):
    x: float
    y: float

class TerrainPolygon(BaseModel):
    id: Optional[str] = None
    type: str
    points: List[PolygonPoint]

class TerrainPolygonsData(BaseModel):
    mode: str  # 'terrain' or 'landType'
    polygons: List[TerrainPolygon]

@router.get("/terrain-polygons")
async def get_terrain_polygons():
    """Get all terrain polygons"""
    doc = await db.terrain_polygons.find_one({"_id": "terrain_polygons_data"})
    if not doc:
        return {"polygons": []}
    return {"polygons": doc.get("polygons", [])}

@router.post("/terrain-polygons")
async def save_terrain_polygons(data: TerrainPolygonsData):
    """Save terrain polygons (overwrite)"""
    polygons_data = []
    for poly in data.polygons:
        poly_dict = {
            "id": poly.id or f"poly_{uuid.uuid4().hex[:8]}",
            "type": poly.type,
            "points": [{"x": p.x, "y": p.y} for p in poly.points]
        }
        polygons_data.append(poly_dict)
    
    await db.terrain_polygons.update_one(
        {"_id": "terrain_polygons_data"},
        {
            "$set": {
                "polygons": polygons_data,
                "mode": data.mode,
                "updated_at": now_utc()
            }
        },
        upsert=True
    )
    
    return {"message": f"Terrain polygons saved ({len(polygons_data)} polygons)", "count": len(polygons_data)}

@router.delete("/terrain-polygons")
async def clear_terrain_polygons():
    """Clear all terrain polygons"""
    await db.terrain_polygons.delete_one({"_id": "terrain_polygons_data"})
    return {"message": "Terrain polygons cleared"}

@router.get("/land-type-zones")
async def get_land_type_zones():
    """Get all land type zones"""
    doc = await db.land_type_zones.find_one({"_id": "land_type_data"})
    if not doc:
        return {"zones": []}
    return {"zones": doc.get("zones", [])}

@router.post("/land-type-zones")
async def save_land_type_zones(data: TerrainZonesData):
    """Save land type zones (overwrite)"""
    cells_data = [cell.dict() for cell in data.cells]
    
    await db.land_type_zones.update_one(
        {"_id": "land_type_data"},
        {
            "$set": {
                "zones": cells_data,
                "mode": data.mode,
                "updated_at": now_utc()
            }
        },
        upsert=True
    )
    
    return {"message": f"Land type zones saved ({len(cells_data)} cells)", "count": len(cells_data)}

@router.delete("/land-type-zones")
async def clear_land_type_zones():
    """Clear all land type zones"""
    await db.land_type_zones.delete_one({"_id": "land_type_data"})
    return {"message": "Land type zones cleared"}


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
        print(f"Error generating story: {e}")
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
        print(f"Error generating personal history: {e}")
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
    "nombre", "precio", "moneda", "peso_kg", "descripcion", "comentarios",
    "disponible_creacion",
    # Armas / armaduras
    "dano", "alcance", "ca", "ca_bonus", "propiedades", "tipo_dano",
    # Monturas / transporte
    "capacidad_carga", "velocidad", "pasajeros",
    # Comida / consumibles
    "es_racion_diaria", "unidades_paquete", "racion_valor", "m2",
    # Herida
    "herida",
]


@router.get("/equipment/export-xlsx")
async def export_equipment_xlsx():
    """Exporta el catálogo completo a un .xlsx (una hoja por categoría)."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")

    wb = Workbook()
    # Remove default sheet; we'll add one per category.
    wb.remove(wb.active)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="4B5563")

    for cat_key, items in catalog.items():
        if cat_key in ("_id", "updated_at", "version") or not isinstance(items, list):
            continue
        # openpyxl limits sheet names to 31 chars.
        ws = wb.create_sheet(title=cat_key[:31] or "items")
        ws.append(EQUIPMENT_XLSX_COLUMNS)
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
        for it in items:
            row = []
            for col in EQUIPMENT_XLSX_COLUMNS:
                v = it.get(col, "")
                if isinstance(v, (list, dict)):
                    v = str(v)
                row.append(v)
            ws.append(row)
        # Auto-ish width.
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
    cat_keys = [k for k in catalog.keys() if k not in ("_id", "updated_at", "version") and isinstance(catalog.get(k), list)]
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

    for cat in cat_keys:
        ws = wb.create_sheet(title=cat[:31])
        ws.append(EQUIPMENT_XLSX_COLUMNS)
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
        # Fila de ejemplo
        sample = {
            "nombre": "Ejemplo (reemplázame)",
            "precio": 10,
            "moneda": "mp",
            "peso_kg": 0.5,
            "disponible_creacion": True,
            "descripcion": "Descripción opcional del ítem.",
        }
        ws.append([sample.get(c, "") for c in EQUIPMENT_XLSX_COLUMNS])
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
    readme.append(["• 'disponible_creacion' acepta: true/false/1/0/sí/no."])
    readme.append(["• 'es_racion_diaria' acepta lo mismo. 1 ración = 1 kg = 1 día."])
    readme.append([""])
    readme.append(["Columnas soportadas:"] + EQUIPMENT_XLSX_COLUMNS)

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
                if key in ("disponible_creacion", "es_racion_diaria"):
                    b = parse_bool(v)
                    if b is not None:
                        item[key] = b
                elif key in ("precio", "peso_kg", "ca", "ca_bonus", "capacidad_carga",
                             "velocidad", "pasajeros", "unidades_paquete", "racion_valor",
                             "herida", "m2"):
                    n = parse_num(v)
                    if n is not None:
                        item[key] = n
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
