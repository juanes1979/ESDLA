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
    Optional filters:
    - categoria: herramientas, equipo_general, armas, armaduras, monturas
    - search: search by item name
    """
    catalog = await db.equipment_catalog.find_one({})
    if not catalog:
        return {
            "herramientas": [],
            "equipo_general": [],
            "armas": [],
            "armaduras": [],
            "monturas": []
        }
    
    result = {
        "herramientas": catalog.get('herramientas', []),
        "equipo_general": catalog.get('equipo_general', []),
        "armas": catalog.get('armas', []),
        "armaduras": catalog.get('armaduras', []),
        "monturas": catalog.get('monturas', [])
    }
    
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
