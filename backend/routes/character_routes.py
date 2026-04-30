"""
Character API Routes
Endpoints for character creation and management
"""
from fastapi import APIRouter, HTTPException, Body, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
import random

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/characters", tags=["Characters"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def generate_id():
    return str(uuid.uuid4())


# ==== Código público de personaje (RAZSUBCAAXXXXX) ====
import re as _re
import unicodedata as _ud

_STOP_WORDS = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a'}

# Mapeo cultura → raza (3 letras). Usado cuando categoria_cultura no
# permite deducirla automáticamente.
_CULTURE_TO_RACE = {
    # Hombres
    'dunedain': 'HOM', 'beornidas': 'HOM', 'rohirrim': 'HOM', 'gondorianos': 'HOM',
    'tharbad': 'HOM', 'lossoth': 'HOM', 'pueblo de bardo': 'HOM', 'bardidas': 'HOM',
    'hombres': 'HOM',
    # Elfos
    'elfos': 'ELF', 'noldor': 'ELF', 'sindar': 'ELF', 'silvanos': 'ELF',
    'lindon': 'ELF', 'rivendel': 'ELF', 'lothlorien': 'ELF', 'bosque negro': 'ELF',
    # Enanos
    'enanos': 'ENA', 'erebor': 'ENA', 'colinas de hierro': 'ENA',
    'montañas grises': 'ENA', 'montanas grises': 'ENA',
    # Hobbits
    'hobbits': 'HOB', 'pelosos': 'HOB', 'fuertes': 'HOB', 'albos': 'HOB',
    'mediano': 'HOB', 'medianos': 'HOB',
}


def _strip_accents(s: str) -> str:
    return ''.join(c for c in _ud.normalize('NFD', s or '') if _ud.category(c) != 'Mn')


def _detect_race_letters(character: dict) -> str:
    """3 letras de raza basadas en categoria_cultura/cultura_nombre."""
    src = ((character.get('categoria_cultura') or '') + ' ' + (character.get('cultura_nombre') or '')).lower()
    src = _strip_accents(src)
    for key, race in _CULTURE_TO_RACE.items():
        if key in src:
            return race
    # Fallback razonable por nombre directo
    return 'HOM'


def _subculture_letters(cultura_nombre: str) -> str:
    """4 letras: si UNA palabra → primeras 4 de esa palabra. Si VARIAS
    palabras → primeras 4 de la última palabra (saltando "de/del/la…")."""
    raw = _strip_accents(cultura_nombre or '').upper()
    palabras = [p for p in _re.split(r'\s+', raw.strip()) if p and p.lower() not in _STOP_WORDS]
    if not palabras:
        return 'XXXX'
    target = palabras[0] if len(palabras) == 1 else palabras[-1]
    target = _re.sub(r'[^A-Z]', '', target)
    return (target[:4]).ljust(4, 'X')


async def generate_codigo_publico(character: dict) -> str:
    """Genera RAZSUBCAAXXXXX único. Reintenta hasta encontrar XXXXX libre."""
    raz = _detect_race_letters(character)
    sub = _subculture_letters(character.get('cultura_nombre', ''))
    # Año de creación si existe; si no, año actual.
    created = character.get('created_at')
    try:
        if isinstance(created, str):
            year = datetime.fromisoformat(created.replace('Z', '+00:00')).year
        elif isinstance(created, datetime):
            year = created.year
        else:
            year = datetime.now(timezone.utc).year
    except Exception:
        year = datetime.now(timezone.utc).year
    aa = f"{year % 100:02d}"

    prefix = f"{raz}{sub}{aa}"
    # Semilla temporal + reintentos para garantizar unicidad
    rng = random.Random()
    for _ in range(20):
        xxxxx = f"{rng.randint(0, 99999):05d}"
        codigo = f"{prefix}{xxxxx}"
        existing = await db.characters.find_one({"codigo_publico": codigo}, {"_id": 1})
        if not existing:
            return codigo
    # Si tras 20 intentos no encontró único, usa timestamp como último recurso
    ts = int(datetime.now(timezone.utc).timestamp()) % 100000
    return f"{prefix}{ts:05d}"


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
    return [serialize_doc(doc) for doc in docs]


# === REQUEST/RESPONSE MODELS ===

class CharacterAttributes(BaseModel):
    fuerza: int = 10
    destreza: int = 10
    constitucion: int = 10
    inteligencia: int = 10
    sabiduria: int = 10
    carisma: int = 10


class CharacterSkill(BaseModel):
    nombre: str
    atributo_base: str
    competente: bool = False


class EquipmentItem(BaseModel):
    item_id: str
    nombre: str
    cantidad: int = 1
    equipado: bool = False


class CharacterCreateStep1(BaseModel):
    """Step 1: Complete Culture selection with all physical data and selections"""
    cultura_id: str
    nombre: str
    jugador: Optional[str] = None
    
    # Physical data
    genero: Optional[str] = 'hombre'
    edad: Optional[int] = None
    altura_cm: Optional[int] = None
    peso_kg: Optional[float] = None
    ojos: Optional[str] = None
    piel: Optional[str] = None
    pelo: Optional[str] = None
    
    # Culture data
    raza: Optional[str] = None
    velocidad: Optional[int] = None
    descanso: Optional[int] = None
    tamanio: Optional[str] = None
    nivel_vida: Optional[str] = None
    
    # Characteristics
    caracteristicas: Optional[Dict[str, int]] = None
    mejora_noldor: Optional[str] = None  # Selected characteristic for Noldor bonus
    
    # Skills and competencies
    habilidades_puntuaciones: Optional[Dict[str, int]] = None
    competencias_habilidades: Optional[List[str]] = None
    rasgos_culturales: Optional[List[str]] = None
    idiomas: Optional[List[str]] = None
    
    # Culture selections
    competencia_habilidad_cultura: Optional[str] = None
    competencia_herramienta_1: Optional[str] = None
    competencias_herramientas_2: Optional[List[str]] = None
    competencia_adicional: Optional[str] = None
    
    # Special features
    pg_extra_nivel: Optional[int] = None
    capacidad_carga_x2: Optional[int] = None
    tiene_virtud_inicial: Optional[bool] = False


class CharacterCreateStep2(BaseModel):
    """Step 2: Background selection with skill and tool selections"""
    trasfondo_id: str
    trasfondo_nombre: Optional[str] = None
    competencias_habilidades_trasfondo: Optional[List[str]] = []
    competencias_herramientas_trasfondo: Optional[List[str]] = []
    rasgos_trasfondo: Optional[List[Any]] = []
    equipo_trasfondo: Optional[List[str]] = []  # Equipment from background (games, instruments, etc.)


class CharacterCreateStep3(BaseModel):
    """Step 3: Occupation selection with skills, armor, weapons, expertise, and tools"""
    ocupacion_id: str
    habilidades_elegidas: List[str] = []
    herramientas_elegidas: List[str] = []  # Tools selected from occupation
    pericia_elegida: List[str] = []
    equipo_ocupacion: List[str] = []
    armadura_elegida: Optional[str] = None  # 'A' or 'B'


class CharacterCreateStep4(BaseModel):
    """Step 4: Attributes assignment"""
    atributos: CharacterAttributes
    # Method used: standard_array, point_buy, random
    metodo_asignacion: str = "standard_array"


class CharacterCreateStep5(BaseModel):
    """Step 5: Virtue selection - All virtue data"""
    virtud_id: str
    virtud_nombre: Optional[str] = None
    virtud_descripcion: Optional[str] = None
    virtud_rasgos: Optional[str] = None
    # Characteristic bonuses
    virtud_caracteristicas_fijas: Optional[Dict[str, int]] = None
    virtud_caracteristicas_elegir: Optional[List[str]] = None
    # Saving throw proficiencies
    virtud_salvaciones_elegir: Optional[List[str]] = None
    # Extra stats
    virtud_pg_extra: Optional[int] = 0
    virtud_comunidad_extra: Optional[int] = 0
    virtud_ca_extra: Optional[int] = 0
    # Skill/tool proficiencies to choose
    virtud_habilidades_elegir: Optional[List[str]] = None
    virtud_herramientas_elegir: Optional[List[str]] = None


class CharacterCreateStep6(BaseModel):
    """Step 6: Skills selection"""
    habilidades: List[str]  # List of skill names


class CharacterCreateStep7(BaseModel):
    """Step 7: Equipment selection"""
    inventario: List[EquipmentItem] = []
    dinero: Dict[str, int] = {"mp": 0, "mo": 0, "me": 0, "mc": 0}


class CharacterCreateStep8(BaseModel):
    """Step 8: Patron selection (optional)"""
    patron_id: Optional[str] = None


class CharacterCreateStep9(BaseModel):
    """Step 9: Final details - Two distinctive traits with descriptions"""
    rasgo_distintivo: Optional[Any] = None  # Can be string or {nombre, descripcion}
    rasgo_distintivo_2: Optional[Any] = None
    motivacion: Optional[str] = None
    historia: Optional[str] = None


class CharacterDraft(BaseModel):
    """Full character draft during creation wizard"""
    paso_actual: int = 1
    nombre: Optional[str] = None
    jugador: Optional[str] = None
    cultura_id: Optional[str] = None
    trasfondo_id: Optional[str] = None
    ocupacion_id: Optional[str] = None
    atributos: Optional[CharacterAttributes] = None
    virtud_id: Optional[str] = None
    habilidades: List[str] = []
    inventario: List[EquipmentItem] = []
    dinero: Dict[str, int] = {"mp": 0, "mo": 0, "me": 0, "mc": 0}
    patron_id: Optional[str] = None
    rasgo_distintivo: Optional[str] = None
    defecto: Optional[str] = None
    motivacion: Optional[str] = None


# === CHARACTER CREATION ENDPOINTS ===

@router.get("/drafts")
async def list_character_drafts():
    """List all character drafts"""
    drafts = await db.character_drafts.find({"estado": "borrador"}).to_list(100)
    return {"drafts": serialize_docs(drafts)}


@router.post("/draft")
async def create_character_draft():
    """Create a new character draft for the wizard"""
    draft = {
        "_id": generate_id(),
        "paso_actual": 1,
        "estado": "borrador",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.character_drafts.insert_one(draft)
    return serialize_doc(draft)


@router.delete("/draft/{draft_id}")
async def delete_character_draft(draft_id: str):
    """Delete a character draft"""
    result = await db.character_drafts.delete_one({"_id": draft_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Draft deleted"}


@router.get("/draft/{draft_id}")
async def get_character_draft(draft_id: str):
    """Get current state of a character draft"""
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step1")
async def update_draft_step1(draft_id: str, data: CharacterCreateStep1):
    """Update draft with Step 1 complete culture data (30 fields from plan)"""
    # Verify culture exists
    culture = await db.cultures.find_one({"_id": data.cultura_id})
    if not culture:
        raise HTTPException(status_code=404, detail="Culture not found")
    
    # Build update with all data from frontend
    update = {
        # Basic info
        "nombre": data.nombre,
        "jugador": data.jugador,
        "cultura_id": data.cultura_id,
        "cultura_nombre": culture['nombre'],
        
        # Physical data (from frontend)
        "genero": data.genero,
        "raza": data.raza or culture.get('raza'),
        "edad": data.edad,
        "altura_cm": data.altura_cm,
        "peso_kg": data.peso_kg,
        "ojos": data.ojos,
        "piel": data.piel,
        "pelo": data.pelo,
        
        # Culture stats
        "velocidad": data.velocidad or culture.get('velocidad', 9),
        "descanso": data.descanso or culture.get('descanso', 8),
        "tamanio": data.tamanio or culture.get('tamanio', 'Mediano'),
        "nivel_vida": data.nivel_vida or culture.get('nivel_vida'),
        "descripcion_nivel_vida": culture.get('descripcion_nivel_vida'),
        
        # Characteristics (base 8 + culture bonuses + Noldor if applicable)
        "caracteristicas": data.caracteristicas,
        "mejora_noldor_seleccion": data.mejora_noldor,  # Which characteristic got +1
        "bonificadores_cultura": culture.get('bonificadores_caracteristicas', {}),
        
        # Skills and competencies
        "habilidades_puntuaciones": data.habilidades_puntuaciones or culture.get('habilidades_puntuaciones', {}),
        "competencias_habilidades_cultura": data.competencias_habilidades or culture.get('competencias_habilidades', []),
        "rasgos_culturales": data.rasgos_culturales or culture.get('rasgos_culturales', []),
        "idiomas": data.idiomas or culture.get('idiomas', []),
        
        # Culture selections made by user
        "competencia_habilidad_cultura": data.competencia_habilidad_cultura,
        "competencia_herramienta_1": data.competencia_herramienta_1,
        "competencias_herramientas_2": data.competencias_herramientas_2 or [],
        "competencia_adicional": data.competencia_adicional or culture.get('competencia_adicional'),
        
        # Special features
        "pg_extra_nivel": data.pg_extra_nivel or culture.get('pg_extra_nivel'),
        "capacidad_carga_x2": data.capacidad_carga_x2 or culture.get('capacidad_carga_x2'),
        "tiene_virtud_inicial": data.tiene_virtud_inicial if data.tiene_virtud_inicial is not None else culture.get('tiene_virtud_inicial', False),
        
        # Wizard state
        "paso_actual": 2,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step2")
async def update_draft_step2(draft_id: str, data: CharacterCreateStep2):
    """Update draft with Step 2 data (background with skills and tools selections)"""
    background = await db.backgrounds.find_one({"_id": data.trasfondo_id})
    if not background:
        raise HTTPException(status_code=404, detail="Background not found")
    
    # Use data from frontend if provided, otherwise fall back to background defaults
    habilidades_trasfondo = data.competencias_habilidades_trasfondo if data.competencias_habilidades_trasfondo else (
        background.get('competencias_habilidades_auto', [])
    )
    herramientas_trasfondo = data.competencias_herramientas_trasfondo if data.competencias_herramientas_trasfondo else (
        background.get('competencias_herramientas_1', []) + background.get('competencias_herramientas_2', [])
    )
    
    # Equipment from background: use frontend-provided if available, otherwise from background data
    equipo_trasfondo = data.equipo_trasfondo if hasattr(data, 'equipo_trasfondo') and data.equipo_trasfondo else background.get('equipo_inicial', [])
    
    update = {
        "trasfondo_id": data.trasfondo_id,
        "trasfondo_nombre": data.trasfondo_nombre or background['nombre'],
        "competencias_trasfondo": {
            "habilidades": habilidades_trasfondo,
            "herramientas": herramientas_trasfondo,
            "idiomas": background.get('idiomas', []),
        },
        # Also store at top level for easier access during filtering
        "competencias_habilidades_trasfondo": habilidades_trasfondo,
        "equipo_trasfondo": equipo_trasfondo,  # Use frontend data or background defaults
        "rasgos_trasfondo": data.rasgos_trasfondo if data.rasgos_trasfondo else background.get('rasgos_descripciones', []),
        "descripcion_trasfondo": background.get('descripcion'),  # NEW: From row 5 of Trasfondo sheet
        "paso_actual": 3,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step3")
async def update_draft_step3(draft_id: str, data: CharacterCreateStep3):
    """Update draft with Step 3 data (occupation with skills, armor, weapons, expertise, tools)"""
    occupation = await db.occupations.find_one({"_id": data.ocupacion_id})
    if not occupation:
        raise HTTPException(status_code=404, detail="Occupation not found")
    
    # Calculate initial HP
    dado_golpe = occupation.get('dado_golpe', '1d8')
    hp_inicial = int(occupation.get('puntos_golpe_nivel1', 8) or 8)
    
    # Get current draft to consolidate all skill competencies
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Consolidate all skill competencies from culture + background + occupation
    all_skill_competencies = []
    # From culture - automatic
    all_skill_competencies.extend(draft.get('competencias_habilidades_cultura', []))
    # From culture - single choice
    if draft.get('competencia_habilidad_cultura'):
        all_skill_competencies.append(draft['competencia_habilidad_cultura'])
    # From culture - "herramientas_2" which actually contains SKILLS for some cultures like Dunedain
    all_skill_competencies.extend(draft.get('competencias_herramientas_2', []))
    # From background
    all_skill_competencies.extend(draft.get('competencias_trasfondo', {}).get('habilidades', []))
    all_skill_competencies.extend(draft.get('competencias_habilidades_trasfondo', []))
    # From occupation (just selected)
    all_skill_competencies.extend(data.habilidades_elegidas)
    
    # Dedupe while preserving order
    seen = set()
    unique_skills = []
    for skill in all_skill_competencies:
        clean = skill.split(' (')[0].strip() if skill else ''
        if clean and clean.lower() not in seen:
            seen.add(clean.lower())
            unique_skills.append(skill)
    
    update = {
        "ocupacion_id": data.ocupacion_id,
        "vocacion_nombre": occupation['vocacion'],
        "ocupacion_nombre": occupation['vocacion'],  # Alias for easier access
        "dado_golpe": dado_golpe,
        "puntos_golpe_base": hp_inicial,
        "caracteristicas_principales": occupation.get('caracteristicas_principales', []),
        "competencias_ocupacion": {
            "tiradas_salvacion": occupation.get('tiradas_salvacion', []),
            "armas": occupation.get('competencia_armas', []),
            "armaduras": occupation.get('competencia_armaduras', []),
        },
        # Favored skills from occupation
        "habilidades_favorecidas": occupation.get('habilidades_favorecidas', []),
        # Shadow path (maldición de la ocupación)
        "maldicion_nombre": occupation.get('maldicion_nombre'),
        "maldicion_descripcion": occupation.get('maldicion_descripcion'),
        # Occupation descriptions and special abilities
        "descripcion_corta": occupation.get('descripcion_corta', ''),  # Short description from row 16
        "descripcion_ocupacion": occupation.get('descripcion_ocupacion', ''),
        "descripcion_ocupacion_larga": occupation.get('descripcion_ocupacion_larga', ''),
        "especiales_ocupacion1": occupation.get('especiales_ocupacion1', ''),
        "especiales_ocupacion1_descripcion": occupation.get('especiales_ocupacion1_descripcion', ''),
        "especiales_ocupacion2": occupation.get('especiales_ocupacion2', ''),
        "especiales_ocupacion2_descripcion": occupation.get('especiales_ocupacion2_descripcion', ''),
        "especiales_ocupacion3": occupation.get('especiales_ocupacion3', ''),
        "especiales_ocupacion3_descripcion": occupation.get('especiales_ocupacion3_descripcion', ''),
        "especiales_ocupacion4": occupation.get('especiales_ocupacion4', ''),
        "especiales_ocupacion4_descripcion": occupation.get('especiales_ocupacion4_descripcion', ''),
        "especiales_ocupacion5": occupation.get('especiales_ocupacion5', ''),
        "especiales_ocupacion5_descripcion": occupation.get('especiales_ocupacion5_descripcion', ''),
        "especiales_ocupacion6": occupation.get('especiales_ocupacion6', ''),
        "especiales_ocupacion6_descripcion": occupation.get('especiales_ocupacion6_descripcion', ''),
        # Virtue/Art text for level-up system
        "ocupacion_virtudes_texto": occupation.get('virtudes_texto', []),
        "ocupacion_virtudes_ocupacion": occupation.get('virtudes_ocupacion', ''),
        # Caminos de profesión
        "caminos_profesion": occupation.get('caminos_profesion', ''),
        "caminos_profesion1": occupation.get('caminos_profesion1', ''),
        "caminos_profesion2": occupation.get('caminos_profesion2', ''),
        # Skills, tools, armor, weapons, expertise from user selection
        "habilidades_elegidas_ocupacion": data.habilidades_elegidas,
        "herramientas_elegidas_ocupacion": data.herramientas_elegidas,
        "pericia_elegida": data.pericia_elegida,
        "equipo_ocupacion": data.equipo_ocupacion,
        "armadura_elegida": data.armadura_elegida,
        # Consolidated field with ALL skill competencies for easy access
        "habilidades_competencia": unique_skills,
        "paso_actual": 4,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step4")
async def update_draft_step4(draft_id: str, data: CharacterCreateStep4):
    """Update draft with Step 4 data (attributes)"""
    # Get draft to apply culture modifiers
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    mod_cultura = draft.get('mod_cultura', {})
    
    # Apply culture modifiers to base attributes
    atributos_finales = {
        "fuerza": data.atributos.fuerza + mod_cultura.get('fuerza', 0),
        "destreza": data.atributos.destreza + mod_cultura.get('destreza', 0),
        "constitucion": data.atributos.constitucion + mod_cultura.get('constitucion', 0),
        "inteligencia": data.atributos.inteligencia + mod_cultura.get('inteligencia', 0),
        "sabiduria": data.atributos.sabiduria + mod_cultura.get('sabiduria', 0),
        "carisma": data.atributos.carisma + mod_cultura.get('carisma', 0),
    }
    
    # Calculate HP with constitution modifier
    con_mod = (atributos_finales['constitucion'] - 10) // 2
    hp_base = draft.get('puntos_golpe_base', 8)
    hp_final = hp_base + con_mod
    
    update = {
        "atributos_base": data.atributos.model_dump(),
        "atributos_finales": atributos_finales,
        "metodo_asignacion": data.metodo_asignacion,
        "puntos_golpe_max": hp_final,
        "puntos_golpe_actual": hp_final,
        "paso_actual": 5,
        "updated_at": now_utc(),
    }
    
    await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step5")
async def update_draft_step5(draft_id: str, data: CharacterCreateStep5):
    """Update draft with Step 5 data (virtue) - All virtue data with bonuses"""
    virtue = await db.virtues.find_one({"_id": data.virtud_id})
    if not virtue:
        raise HTTPException(status_code=404, detail="Virtue not found")
    
    # Get current draft to apply virtue bonuses
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Apply fixed virtue attribute increases
    atributos = draft.get('atributos_finales', {})
    caracteristicas_fijas = data.virtud_caracteristicas_fijas or virtue.get('caracteristicas_fijas', {})
    
    for attr, bonus in caracteristicas_fijas.items():
        if attr in atributos and bonus:
            atributos[attr] += bonus
    
    # Build the update with all virtue data
    update = {
        "virtud_id": data.virtud_id,
        "virtud_nombre": data.virtud_nombre or virtue.get('nombre'),
        "virtud_descripcion": data.virtud_descripcion or virtue.get('descripcion'),
        "virtud_rasgos": data.virtud_rasgos or virtue.get('rasgos_virtud') or virtue.get('competencias_texto'),
        # Characteristic bonuses
        "virtud_caracteristicas_fijas": caracteristicas_fijas,
        "virtud_caracteristicas_elegir": data.virtud_caracteristicas_elegir or virtue.get('caracteristicas_elegir', []),
        # Saving throw proficiencies to choose
        "virtud_salvaciones_elegir": data.virtud_salvaciones_elegir or virtue.get('salvaciones_elegir', []),
        # Extra stats
        "virtud_pg_extra": data.virtud_pg_extra or virtue.get('puntos_golpe_extra', 0),
        "virtud_comunidad_extra": data.virtud_comunidad_extra or virtue.get('puntos_comunidad_extra', 0),
        "virtud_ca_extra": data.virtud_ca_extra or virtue.get('clase_armadura_extra', 0),
        # Skill/tool proficiencies to choose
        "virtud_habilidades_elegir": data.virtud_habilidades_elegir or virtue.get('competencias_habilidades_elegir', []),
        "virtud_herramientas_elegir": data.virtud_herramientas_elegir or virtue.get('competencias_herramientas_elegir', []),
        # Update attributes with fixed bonuses
        "atributos_finales": atributos,
        "paso_actual": 6,  # Continue to skills step
        "updated_at": now_utc(),
    }

    # Virtudes especiales que añaden una montura al personaje
    # ("Poni de Bree" para los Hombres de Bree).
    nombre_virtud = (data.virtud_nombre or virtue.get('nombre') or '').strip().lower()
    if nombre_virtud == 'poni de bree':
        # Stats canónicos del Poni de Bree.
        montura_data = {
            "nombre": "Poni de Bree",
            "tipo": "poni",
            "carga_kg": 101,
            "capacidad_carga": 101,
            "constitucion": 13,
            "constitucion_mod": 1,
            "velocidad": 12,
            "tamano": "Mediano",  # también puede actuar como pequeño
            "tamano_alt": "Pequeño",
            "transporta_equipo": True,
            "origen": "Virtud cultural de los Hombres de Bree",
            "rasgos": [
                "Usa el bonificador por competencia del personaje",
                "Mejora sus estadísticas con la experiencia del jinete",
                "Puede actuar en combate bajo las órdenes de su dueño",
            ],
            "ganado_via_virtud": True,
            "equipo": [],  # equipo cargado en la montura
        }
        update["montura"] = montura_data

        # También añade el poni al inventario para que aparezca en "Equipo
        # completo" y se pueda gestionar (cargar equipo en él) desde la
        # ficha. Sólo se añade si todavía no está.
        existing_inv = draft.get('inventario', []) or []
        already_has = any(
            (it.get('nombre') if isinstance(it, dict) else str(it)).strip().lower() == 'poni de bree'
            for it in existing_inv
        )
        if not already_has:
            existing_inv = existing_inv + [{
                "nombre": "Poni de Bree",
                "categoria": "monturas",
                "cantidad": 1,
                "peso_kg": 0,  # el peso de la montura no afecta al estorbo del jinete
                "portado_por": "personaje",  # se monta, no se carga
                "es_montura": True,
                "ganado_via_virtud": True,
                "capacidad_carga_kg": 101,
            }]
            update["inventario"] = existing_inv
    
    await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step6")
async def update_draft_step6(draft_id: str, data: CharacterCreateStep6):
    """Update draft with Step 6 data (skills)"""
    update = {
        "habilidades_elegidas": data.habilidades,
        "paso_actual": 7,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step7")
async def update_draft_step7(draft_id: str, data: CharacterCreateStep7):
    """Update draft with Step 7 data (equipment - automático según nivel de vida)"""
    update = {
        "inventario": [item.model_dump() for item in data.inventario],
        "dinero": data.dinero,
        "paso_actual": 8,  # Ahora hay 8 pasos, no 9
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step8")
async def update_draft_step8(draft_id: str, data: CharacterCreateStep8):
    """Update draft with Step 8 data (patron)"""
    update = {
        "paso_actual": 9,
        "updated_at": now_utc(),
    }
    
    if data.patron_id:
        patron = await db.patrons.find_one({"_id": data.patron_id})
        if not patron:
            raise HTTPException(status_code=404, detail="Patron not found")
        update["patron_id"] = data.patron_id
        update["patron_nombre"] = patron['nombre']
        update["puntos_comunidad"] = patron.get('puntos_comunidad', 0)
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step9")
async def update_draft_step9(draft_id: str, data: CharacterCreateStep9):
    """Update draft with Step 9/8 data (final details - rasgos del trasfondo + historia)"""
    update = {
        "rasgo_distintivo": data.rasgo_distintivo,
        "rasgo_distintivo_2": data.rasgo_distintivo_2,  # Second distinctive trait
        "motivacion": data.motivacion,
        "historia": data.historia,
        "paso_actual": 9,  # Complete (8 pasos + 1 = finalizado)
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/portrait")
async def update_draft_portrait(draft_id: str, data: dict):
    """Update draft with AI-generated portrait image"""
    portrait_image = data.get('portrait_image')
    
    if not portrait_image:
        raise HTTPException(status_code=400, detail="portrait_image is required")
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": {
            "portrait_image": portrait_image,
            "updated_at": now_utc(),
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return {"success": True, "message": "Portrait updated"}


@router.post("/draft/{draft_id}/finalize")
async def finalize_character(draft_id: str):
    """Convert a completed draft into a final character"""
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Validate draft is complete enough - virtud es opcional (solo 3 culturas la obtienen)
    required_fields = ['nombre', 'cultura_id', 'trasfondo_id', 'ocupacion_id']
    # Check for characteristics (might be in 'caracteristicas' or 'atributos_finales')
    has_attributes = draft.get('caracteristicas') or draft.get('atributos_finales')
    
    missing = [f for f in required_fields if not draft.get(f)]
    if not has_attributes:
        missing.append('caracteristicas')
    
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"Draft incomplete. Missing: {', '.join(missing)}"
        )
    
    # Create final character document
    # Use 'caracteristicas' or 'atributos_finales' (depending on which exists)
    final_attributes = draft.get('caracteristicas') or draft.get('atributos_finales', {})
    
    character = {
        "_id": generate_id(),
        "nombre": draft['nombre'],
        "jugador": draft.get('jugador'),
        # Culture
        "cultura_id": draft['cultura_id'],
        "cultura_nombre": draft['cultura_nombre'],
        "categoria_cultura": draft.get('categoria_cultura'),
        "genero": draft.get('genero'),
        "edad": draft.get('edad'),
        "altura_cm": draft.get('altura_cm'),
        "peso_kg": draft.get('peso_kg'),
        "ojos": draft.get('ojos'),
        "piel": draft.get('piel'),
        "pelo": draft.get('pelo'),
        "tamano": draft.get('tamanio'),
        "velocidad": draft.get('velocidad'),
        "nivel_vida": draft.get('nivel_vida'),
        # Background
        "trasfondo_id": draft['trasfondo_id'],
        "trasfondo_nombre": draft.get('trasfondo_nombre'),
        "descripcion_trasfondo": draft.get('descripcion_trasfondo'),
        # Occupation
        "ocupacion_id": draft['ocupacion_id'],
        "ocupacion_tipo": draft.get('ocupacion_tipo'),
        "vocacion_nombre": draft.get('vocacion_nombre'),
        "dado_golpe": draft.get('dado_golpe'),
        # Attributes
        "atributos": final_attributes,
        # Virtue (optional - only cultures with tiene_virtud_inicial get virtue at level 1)
        "virtud_id": draft.get('virtud_id'),
        "virtud_nombre": draft.get('virtud_nombre'),
        "virtud_descripcion": draft.get('virtud_descripcion'),
        "virtud_rasgos": draft.get('virtud_rasgos'),
        "virtud_caracteristicas_fijas": draft.get('virtud_caracteristicas_fijas', {}),
        "virtud_caracteristicas_elegir": draft.get('virtud_caracteristicas_elegir', []),
        "virtud_salvaciones_elegir": draft.get('virtud_salvaciones_elegir', []),
        "virtud_pg_extra": draft.get('virtud_pg_extra', 0),
        "virtud_comunidad_extra": draft.get('virtud_comunidad_extra', 0),
        "virtud_ca_extra": draft.get('virtud_ca_extra', 0),
        "virtud_habilidades_elegir": draft.get('virtud_habilidades_elegir', []),
        "virtud_herramientas_elegir": draft.get('virtud_herramientas_elegir', []),
        # Legacy field for backwards compatibility
        "rasgos_virtud": draft.get('virtud_rasgos') or draft.get('rasgos_virtud'),
        # Cultural traits (rasgos culturales from culture)
        "rasgos_culturales": draft.get('rasgos_culturales', []),
        # ALL Skills and competencies consolidated
        "habilidades_competencia": draft.get('habilidades_competencia', []),
        "habilidades_elegidas_ocupacion": draft.get('habilidades_elegidas_ocupacion', []),
        "pericia_elegida": draft.get('pericia_elegida', []),
        "competencias": {
            "tiradas_salvacion": draft.get('competencias_ocupacion', {}).get('tiradas_salvacion', []),
            "armaduras": draft.get('competencias_ocupacion', {}).get('armaduras', []),
            "armas": draft.get('competencias_ocupacion', {}).get('armas', []),
            "habilidades_cultura": draft.get('competencias_habilidades_cultura', []),
            "habilidades_trasfondo": draft.get('competencias_trasfondo', {}).get('habilidades', []),
            "herramientas": draft.get('competencias_trasfondo', {}).get('herramientas', []),
            "idiomas": draft.get('idiomas', []),
        },
        # Equipment from all sources
        "inventario": draft.get('inventario', []),
        "equipo_ocupacion": draft.get('equipo_ocupacion', []),
        "herramientas_elegidas_ocupacion": draft.get('herramientas_elegidas_ocupacion', []),
        "dinero": draft.get('dinero', {"mp": 0, "mo": 0, "me": 0, "mc": 0}),
        # Combat stats
        "puntos_golpe_max": draft.get('puntos_golpe_base', 8),
        "puntos_golpe_actual": draft.get('puntos_golpe_base', 8),
        "clase_armadura": 10 + ((final_attributes.get('destreza', 10) - 10) // 2),
        # Patron
        "patron_id": draft.get('patron_id'),
        "patron_nombre": draft.get('patron_nombre'),
        "puntos_comunidad": draft.get('puntos_comunidad', 0),
        # Personal details - TWO distinctive traits
        "rasgo_distintivo": draft.get('rasgo_distintivo'),
        "rasgo_distintivo_2": draft.get('rasgo_distintivo_2') or draft.get('defecto'),  # Fallback to defecto
        "motivacion": draft.get('motivacion'),
        "historia": draft.get('historia'),
        # Progression
        "nivel": 1,
        "experiencia": 0,
        # Favored skills from occupation
        "habilidades_favorecidas": draft.get('habilidades_favorecidas', []),
        # Shadow path (maldición de la ocupación)
        "senda_sombra": draft.get('maldicion_nombre'),
        "senda_sombra_descripcion": draft.get('maldicion_descripcion'),
        # Shadow points
        "puntos_sombra": 0,
        "puntos_sombra_permanentes": 0,
        
        # NEW: Shadow/Estado fields (for rules, to be set later)
        "desanimado": False,
        "angustiado": False,
        "descripcion_sombra": None,
        
        # NEW: Recompensas (rewards, to be filled later by game master)
        "recompensa1": None,
        "recompensa2": None,
        "recompensa3": None,
        "recompensa4": None,
        "recompensa5": None,
        "recompensa6": None,
        
        # NEW: Additional resources
        "heredero": None,
        "inversion": None,
        
        # NEW: Descriptions from data (populated from culture/occupation/etc)
        "descripcion_cultura": draft.get('descripcion_cultura'),
        "descripcion_riqueza": draft.get('descripcion_riqueza'),
        "riqueza": draft.get('riqueza'),
        "descripcion_corta": draft.get('descripcion_corta'),  # Short description from row 16
        "descripcion_ocupacion": draft.get('descripcion_ocupacion'),
        "descripcion_ocupacion_larga": draft.get('descripcion_ocupacion_larga'),
        
        # NEW: Mecenas fields
        "mecenas": draft.get('mecenas'),
        "descripcion_mecenas": draft.get('descripcion_mecenas'),
        "ventaja_mecenas": draft.get('ventaja_mecenas'),
        
        # NEW: Especiales de ocupación
        "especiales_ocupacion1": draft.get('especiales_ocupacion1'),
        "especiales_ocupacion1_descripcion": draft.get('especiales_ocupacion1_descripcion'),
        "especiales_ocupacion2": draft.get('especiales_ocupacion2'),
        "especiales_ocupacion2_descripcion": draft.get('especiales_ocupacion2_descripcion'),
        "especiales_ocupacion3": draft.get('especiales_ocupacion3'),
        "especiales_ocupacion3_descripcion": draft.get('especiales_ocupacion3_descripcion'),
        "especiales_ocupacion4": draft.get('especiales_ocupacion4'),
        "especiales_ocupacion4_descripcion": draft.get('especiales_ocupacion4_descripcion'),
        "especiales_ocupacion5": draft.get('especiales_ocupacion5'),
        "especiales_ocupacion5_descripcion": draft.get('especiales_ocupacion5_descripcion'),
        "especiales_ocupacion6": draft.get('especiales_ocupacion6'),
        "especiales_ocupacion6_descripcion": draft.get('especiales_ocupacion6_descripcion'),
        
        # NEW: Caminos de profesión
        "caminos_profesion": draft.get('caminos_profesion'),
        "caminos_profesion1": draft.get('caminos_profesion1'),
        "caminos_profesion2": draft.get('caminos_profesion2'),
        
        # NEW: Virtudes de ocupación y virtudes seleccionadas (texto para level-up)
        "ocupacion_virtudes_texto": draft.get('ocupacion_virtudes_texto', []),
        "virtudes_ocupacion": draft.get('virtudes_ocupacion') or draft.get('ocupacion_virtudes_ocupacion'),
        # Virtues and arts obtained through level-up
        "virtudes_obtenidas": draft.get('virtudes_obtenidas', []),
        "artes_obtenidas": draft.get('artes_obtenidas', []),
        "espacios_arte": draft.get('espacios_arte', 0),
        "virtud1": draft.get('virtud1'),
        "virtud1_descripcion": draft.get('virtud1_descripcion'),
        "virtud1_rasgos": draft.get('virtud1_rasgos'),
        "virtud2": draft.get('virtud2'),
        "virtud2_descripcion": draft.get('virtud2_descripcion'),
        "virtud2_rasgos": draft.get('virtud2_rasgos'),
        "virtud3": draft.get('virtud3'),
        "virtud3_descripcion": draft.get('virtud3_descripcion'),
        "virtud3_rasgos": draft.get('virtud3_rasgos'),
        "virtud4": draft.get('virtud4'),
        "virtud4_descripcion": draft.get('virtud4_descripcion'),
        "virtud4_rasgos": draft.get('virtud4_rasgos'),
        # Mount obtained via virtue (e.g. "Poni de Bree" for Bree Men)
        "montura": draft.get('montura') or {},
        
        # Meta
        "estado": "activo",
        "portrait_image": draft.get('portrait_image'),  # AI-generated portrait
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    
    # Insert character and delete draft
    await db.characters.insert_one(character)
    await db.character_drafts.delete_one({"_id": draft_id})
    
    return serialize_doc(character)


# === CHARACTER MANAGEMENT ENDPOINTS ===

@router.get("/")
async def list_characters(jugador: Optional[str] = None, campaign_id: Optional[str] = None, include_all: bool = False):
    """List all characters, optionally filtered"""
    if include_all:
        query = {"estado": {"$ne": "eliminado"}}
    else:
        query = {"$or": [{"estado": "activo"}, {"estado": {"$exists": False}}]}
    
    if jugador:
        query["jugador"] = jugador
    if campaign_id:
        query["campaign_id"] = campaign_id
    
    characters = await db.characters.find(query).to_list(100)
    return {"characters": serialize_docs(characters)}


@router.get("/{character_id}")
async def get_character(character_id: str):
    """Get a specific character by ID"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return serialize_doc(character)


@router.delete("/{character_id}")
async def delete_character(character_id: str):
    """Soft delete a character"""
    result = await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"estado": "eliminado", "updated_at": now_utc()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character deleted"}


@router.patch("/{character_id}/hp")
async def update_character_hp(character_id: str, hp_change: int = Body(..., embed=True)):
    """Update character's current HP (positive to heal, negative for damage)"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    new_hp = max(0, min(
        character.get('puntos_golpe_max', 0),
        character.get('puntos_golpe_actual', 0) + hp_change
    ))
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"puntos_golpe_actual": new_hp, "updated_at": now_utc()}}
    )
    
    return {"puntos_golpe_actual": new_hp}


@router.patch("/{character_id}/shadow")
async def update_character_shadow(character_id: str, shadow_change: int = Body(..., embed=True)):
    """Update character's shadow points"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    new_shadow = max(0, character.get('puntos_sombra', 0) + shadow_change)
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"puntos_sombra": new_shadow, "updated_at": now_utc()}}
    )
    
    return {"puntos_sombra": new_shadow}


@router.put("/{character_id}/fatigue")
async def update_character_fatigue(character_id: str, fatiga: float = Body(..., embed=True)):
    """Update character's fatigue level directly (supports decimals like 0.5 for sentinel rule)"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Fatigue can be 0-6 (6 levels of exhaustion in 5e). Supports 0.5 increments.
    new_fatigue = max(0.0, min(6.0, round(fatiga * 2) / 2))
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"fatiga": new_fatigue, "updated_at": now_utc()}}
    )
    
    return {"fatiga": new_fatigue}


@router.patch("/{character_id}/xp")
async def add_experience(character_id: str, xp: int = Body(..., embed=True)):
    """Add experience points to character"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    new_xp = character.get('experiencia', 0) + xp
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"experiencia": new_xp, "updated_at": now_utc()}}
    )
    
    return {"experiencia": new_xp}


# ============== REST SYSTEM (5e standard: Short / Long Rest) ==============

def _hd_size(dado_golpe: str) -> int:
    """Parse '1d8' → 8, '1d10' → 10, fallback 8."""
    try:
        if dado_golpe and 'd' in dado_golpe:
            return int(dado_golpe.split('d')[1])
    except Exception:
        pass
    return 8


@router.post("/{character_id}/rest/short")
async def short_rest(
    character_id: str,
    dice_to_spend: int = Body(..., embed=True),
):
    """
    5e Short Rest (1 hour). Spend N hit dice; each rolls 1d{HD} + CON mod
    and heals HP (capped at max). Returns rolls and new state.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    nivel = max(1, int(character.get('nivel', 1)))
    gastados = int(character.get('dados_golpe_gastados', 0))
    disponibles = max(0, nivel - gastados)
    n = max(0, min(int(dice_to_spend), disponibles))

    hd_size = _hd_size(character.get('dado_golpe', '1d8'))
    con_score = int((character.get('atributos') or {}).get('constitucion', 10))
    con_mod = (con_score - 10) // 2

    rolls = []
    total_curacion = 0
    for _ in range(n):
        roll = random.randint(1, hd_size)
        # Mínimo 1 PG curado por dado, sumando CON mod (puede ser negativo)
        ganancia = max(1, roll + con_mod)
        total_curacion += ganancia
        rolls.append({"d": hd_size, "roll": roll, "con_mod": con_mod, "heal": ganancia})

    pg_max = int(character.get('puntos_golpe_max', 0) or 0)
    pg_actual = int(character.get('puntos_golpe_actual', 0) or 0)
    nuevo_pg = min(pg_max, pg_actual + total_curacion)
    nuevos_gastados = gastados + n

    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {
            "puntos_golpe_actual": nuevo_pg,
            "dados_golpe_gastados": nuevos_gastados,
            "updated_at": now_utc(),
        }}
    )

    return {
        "tipo": "descanso_corto",
        "dados_gastados": n,
        "dados_disponibles_restantes": max(0, nivel - nuevos_gastados),
        "rolls": rolls,
        "curacion_total": total_curacion,
        "pg_anterior": pg_actual,
        "pg_actual": nuevo_pg,
        "pg_max": pg_max,
        "con_mod": con_mod,
    }


@router.post("/{character_id}/rest/long")
async def long_rest(character_id: str):
    """
    5e Long Rest (8 hours). Restores HP to full, recovers floor(level/2)
    hit dice (min 1), and reduces fatigue by 1 (LOTR 5e house-rule kept).
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    nivel = max(1, int(character.get('nivel', 1)))
    gastados = int(character.get('dados_golpe_gastados', 0))
    recuperar = max(1, nivel // 2)
    nuevos_gastados = max(0, gastados - recuperar)
    dados_recuperados = gastados - nuevos_gastados

    pg_max = int(character.get('puntos_golpe_max', 0) or 0)
    pg_anterior = int(character.get('puntos_golpe_actual', 0) or 0)

    fatiga_anterior = float(character.get('fatiga', 0) or 0)
    fatiga_nueva = max(0.0, fatiga_anterior - 1)

    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {
            "puntos_golpe_actual": pg_max,
            "dados_golpe_gastados": nuevos_gastados,
            "fatiga": fatiga_nueva,
            "updated_at": now_utc(),
        }}
    )

    return {
        "tipo": "descanso_largo",
        "pg_anterior": pg_anterior,
        "pg_actual": pg_max,
        "pg_max": pg_max,
        "dados_recuperados": dados_recuperados,
        "dados_disponibles": nivel - nuevos_gastados,
        "fatiga_anterior": fatiga_anterior,
        "fatiga_nueva": fatiga_nueva,
        "curacion_total": pg_max - pg_anterior,
    }



@router.patch("/{character_id}")
async def update_character(character_id: str, data: dict = Body(...)):
    """Update character fields (used for level-up, etc.)"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Fields allowed to be updated
    allowed_fields = [
        'nivel', 'puntos_golpe_max', 'bonificador_competencia',
        'virtudes_obtenidas', 'artes_obtenidas', 'espacios_arte',
        'experiencia', 'puntos_comunidad', 'puntos_sombra',
        'inventario', 'dinero', 'notas',
        # Reward fields
        'recompensa1', 'recompensa2', 'recompensa3', 
        'recompensa4', 'recompensa5', 'recompensa6',
        # Shadow state
        'desanimado', 'angustiado', 'descripcion_sombra',
        # Other editable
        'heredero', 'inversion',
        # Notas privadas (DJ → jugador)
        'notas_privadas_jugador',
        # Campos de la Oleada 3
        'sexo',
        'nombre_jugador',
        'iniciativa_bonus',  # bonificador adicional manual a la iniciativa
        'competencias_herramientas',
        # Tiradas de salvación de los 6 atributos (lista de strings con
        # los atributos en los que el personaje tiene competencia, p.ej.
        # ['fuerza', 'destreza']).
        'salvaciones_competencia',
        # Salvaciones contra la muerte: { exitos: int (0-3), fracasos: int (0-3) }
        'salvaciones_muerte',
        # Sombra extendida
        'cicatrices_sombra',  # lista de strings
        'maldicion_sombra',   # string libre
        # Mecenas: { nombre, tipo, descripcion, beneficios }
        'mecenas',
        # Especiales de la profesión (lista de strings o textos)
        'especiales_profesion',
        # Historia narrativa (string largo). Se va rellenando con campañas/viajes.
        'historia',
        # Estorbo en metros (negativo si está estorbado, ej: -3 m). Lo
        # calcula la ficha automáticamente y lo persiste para que el
        # sistema de viaje pueda leerlo y aplicarlo al cálculo de velocidad.
        'estorbo_metros',
        # Montura completa (incluye flag transporta_equipo)
        'montura',
        # Código público RAZSUBCAAXXXXX (read-only en práctica, pero se
        # puede sobreescribir manualmente para casos excepcionales).
        'codigo_publico',
        # Defectos de la Sombra (lista de objetos
        # {nombre, descripcion, efecto_juego, contexto, fecha, campana,
        # ocupacion}). Una vez añadidos, no se borran a la ligera.
        'defectos_sombra',
        # Retrato generado por IA (base64). Permitido sobreescribir desde
        # la pantalla de la ficha como red de seguridad si la generación
        # durante el wizard falló.
        'portrait_image',
    ]
    
    update = {"updated_at": now_utc()}
    for key, value in data.items():
        if key in allowed_fields:
            update[key] = value
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated = await db.characters.find_one({"_id": character_id})
    return serialize_doc(updated)



# ─── Código público RAZSUBCAAXXXXX ─────────────────────────────────────
@router.post("/{character_id}/codigo-publico")
async def assign_codigo_publico(character_id: str, force: bool = False):
    """Genera (o regenera si force=True) el código público del personaje."""
    char = await db.characters.find_one({"_id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if char.get("codigo_publico") and not force:
        return {"codigo_publico": char["codigo_publico"], "regenerated": False}
    codigo = await generate_codigo_publico(char)
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"codigo_publico": codigo, "updated_at": now_utc()}}
    )
    return {"codigo_publico": codigo, "regenerated": True}


@router.post("/codigo-publico/migrate")
async def migrate_all_codigo_publico(force: bool = False):
    """Asigna codigo_publico a todos los personajes que no lo tengan
    (o a todos si force=True). Idempotente."""
    cursor = db.characters.find({} if force else {"codigo_publico": {"$in": [None, ""]}})
    assigned = []
    skipped = 0
    async for char in cursor:
        if char.get("codigo_publico") and not force:
            skipped += 1
            continue
        codigo = await generate_codigo_publico(char)
        await db.characters.update_one(
            {"_id": char["_id"]},
            {"$set": {"codigo_publico": codigo, "updated_at": now_utc()}}
        )
        assigned.append({"id": char.get("_id"), "nombre": char.get("nombre"), "codigo": codigo})
    return {"assigned": len(assigned), "skipped": skipped, "items": assigned}



# === EQUIPMENT REWARDS ENDPOINT ===

class ApplyEquipmentReward(BaseModel):
    """Data to apply a reward/upgrade to equipment"""
    equipment_type: str  # 'arma', 'armadura', 'escudo'
    equipment_index: Optional[int] = None  # Index in array for armas/equipo
    equipment_source: Optional[str] = "armas"  # 'armas', 'elegidas', 'inv' - where the weapon is stored
    mejora_nombre: str  # Name of the reward/upgrade to apply
    mejora_efecto: Optional[str] = None  # Effect description (optional)


@router.post("/{character_id}/equipment/apply-reward")
async def apply_equipment_reward(character_id: str, data: ApplyEquipmentReward):
    """Apply a reward/upgrade to a character's equipment item"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    update = {"updated_at": now_utc()}
    equipment_type = data.equipment_type.lower()
    source = data.equipment_source or "armas"
    
    if equipment_type == 'arma':
        # Apply to weapon at specified index
        if data.equipment_index is None:
            raise HTTPException(status_code=400, detail="equipment_index required for weapons")
        
        # Determine which array to use based on source
        source_map = {
            'armas': 'armas',
            'elegidas': 'armas_elegidas',
            'inv': 'inventario',
            'ocupacion': 'equipo_ocupacion',
            'trasfondo': 'equipo_trasfondo',
        }
        array_key = source_map.get(source, 'armas')
        
        armas = character.get(array_key, [])
        if data.equipment_index < 0 or data.equipment_index >= len(armas):
            raise HTTPException(status_code=400, detail=f"Invalid weapon index for {array_key}")
        
        # Get the weapon and add the mejora
        arma = armas[data.equipment_index]
        if isinstance(arma, dict):
            mejoras = arma.get('mejoras', [])
            if data.mejora_nombre not in mejoras:
                mejoras.append(data.mejora_nombre)
                arma['mejoras'] = mejoras
                armas[data.equipment_index] = arma
                update[array_key] = armas
        else:
            # If weapon is just a string, convert to dict
            armas[data.equipment_index] = {
                'nombre': arma,
                'mejoras': [data.mejora_nombre]
            }
            update[array_key] = armas
            
    elif equipment_type == 'armadura':
        # Apply to armor
        armadura = character.get('armadura', {})
        if isinstance(armadura, dict):
            mejoras = armadura.get('mejoras', [])
            if data.mejora_nombre not in mejoras:
                mejoras.append(data.mejora_nombre)
                armadura['mejoras'] = mejoras
                update['armadura'] = armadura
        elif isinstance(armadura, str):
            # Convert string to dict
            update['armadura'] = {
                'nombre': armadura,
                'mejoras': [data.mejora_nombre]
            }
        else:
            raise HTTPException(status_code=400, detail="El personaje no tiene armadura")
            
    elif equipment_type == 'escudo':
        # Apply to shield in equipo array
        if data.equipment_index is None:
            raise HTTPException(status_code=400, detail="equipment_index required for shields")
        
        equipo = character.get('equipo', [])
        if data.equipment_index < 0 or data.equipment_index >= len(equipo):
            raise HTTPException(status_code=400, detail="Índice de equipo inválido")
        
        item = equipo[data.equipment_index]
        if isinstance(item, dict):
            mejoras = item.get('mejoras', [])
            if data.mejora_nombre not in mejoras:
                mejoras.append(data.mejora_nombre)
                item['mejoras'] = mejoras
                equipo[data.equipment_index] = item
                update['equipo'] = equipo
        else:
            equipo[data.equipment_index] = {
                'nombre': item,
                'mejoras': [data.mejora_nombre]
            }
            update['equipo'] = equipo
    else:
        raise HTTPException(status_code=400, detail=f"Unknown equipment type: {equipment_type}")
    
    # Update character
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated_character = await db.characters.find_one({"_id": character_id})
    return serialize_doc(updated_character)


@router.delete("/{character_id}/equipment/{equipment_type}/{equipment_index}/reward/{mejora_nombre}")
async def remove_equipment_reward(
    character_id: str, 
    equipment_type: str, 
    equipment_index: int,
    mejora_nombre: str
):
    """Remove a reward/upgrade from a character's equipment item"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    update = {"updated_at": now_utc()}
    equipment_type = equipment_type.lower()
    
    if equipment_type == 'arma':
        armas = character.get('armas', [])
        if equipment_index < 0 or equipment_index >= len(armas):
            raise HTTPException(status_code=400, detail="Índice de arma inválido")
        
        arma = armas[equipment_index]
        if isinstance(arma, dict):
            mejoras = arma.get('mejoras', [])
            if mejora_nombre in mejoras:
                mejoras.remove(mejora_nombre)
                arma['mejoras'] = mejoras
                armas[equipment_index] = arma
                update['armas'] = armas
                
    elif equipment_type == 'armadura':
        armadura = character.get('armadura', {})
        if isinstance(armadura, dict):
            mejoras = armadura.get('mejoras', [])
            if mejora_nombre in mejoras:
                mejoras.remove(mejora_nombre)
                armadura['mejoras'] = mejoras
                update['armadura'] = armadura
                
    elif equipment_type == 'escudo':
        equipo = character.get('equipo', [])
        if equipment_index < 0 or equipment_index >= len(equipo):
            raise HTTPException(status_code=400, detail="Índice de equipo inválido")
        
        item = equipo[equipment_index]
        if isinstance(item, dict):
            mejoras = item.get('mejoras', [])
            if mejora_nombre in mejoras:
                mejoras.remove(mejora_nombre)
                item['mejoras'] = mejoras
                equipo[equipment_index] = item
                update['equipo'] = equipo
    else:
        raise HTTPException(status_code=400, detail=f"Unknown equipment type: {equipment_type}")
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated_character = await db.characters.find_one({"_id": character_id})
    return serialize_doc(updated_character)



# === EQUIPMENT MANAGEMENT ENDPOINTS ===

# Jerarquía oficial Tierra Media: 1 mo = 100 mp = 1.000 mc = 10.000 me
# Unidad base = me (la más pequeña). Cualquier moneda se convierte a "me" para
# poder pagar con cualquier combinación que sume el valor total.
COIN_VALUES = {
    "mo": 10000,  # 1 oro = 10.000 me
    "mp": 100,    # 1 plata = 100 me
    "mc": 10,     # 1 cobre = 10 me
    "me": 1       # 1 estaño = 1 me  (base)
}

def convert_to_base(dinero: dict) -> int:
    """Convert all coins to base value (estaño)"""
    total = 0
    for coin, amount in dinero.items():
        if coin in COIN_VALUES:
            total += amount * COIN_VALUES[coin]
    return total

def convert_from_base(base_amount: int) -> dict:
    """Convert base value back to coins (prioritize larger denominations).
    Orden importante: mo → mp → mc → me (de mayor a menor valor)."""
    result = {"mo": 0, "mp": 0, "mc": 0, "me": 0}
    remaining = base_amount
    for coin in ["mo", "mp", "mc", "me"]:
        result[coin] = remaining // COIN_VALUES[coin]
        remaining = remaining % COIN_VALUES[coin]
    return result

def price_to_base(precio: float, moneda: str) -> int:
    """Convert a price to base value"""
    return int(precio * COIN_VALUES.get(moneda, 100))


class AddEquipmentRequest(BaseModel):
    """Request to add equipment to a character"""
    item_name: str
    item_category: str  # equipo_general, armas_sencillas_cc, monturas, ropa, etc.
    cantidad: int = 1
    is_purchase: bool = True  # True = compra, False = regalo/tesoro
    precio: Optional[float] = None  # Si es diferente al del catálogo
    moneda: Optional[str] = "mp"
    # Additional item data
    peso_kg: Optional[float] = None
    dano: Optional[str] = None
    ca: Optional[int] = None
    ca_bonus: Optional[int] = None  # CA incremental para piezas de armadura (bracelete +1, etc.)
    herida: Optional[int] = None
    alcance: Optional[str] = None
    capacidad_carga: Optional[int] = None  # Para monturas
    posicion: Optional[str] = None  # cabeza / cuerpo / piernas / brazos / pies (ropa/armadura)


class UpdateEquipmentCarryRequest(BaseModel):
    """Request to update what the character/mount carries.

    `source` indica en qué array del personaje está el objeto:
      - "inventario" (por defecto) - inventario general
      - "equipo"      - lista character.equipo (escudos, utensilios)
      - "armas"       - character.armas
      - "armadura"    - character.armadura (objeto único)
      - "armadura_piezas" - character.armadura_piezas[] (nuevas piezas tipo brazalete)
      - "ropa"        - inventario filtrando categoria=='ropa'
    """
    item_index: int
    carried_by: str  # "personaje" or "montura"
    source: Optional[str] = "inventario"
    mount_id: Optional[str] = None  # si carried_by == 'montura', especifica qué montura


class ToggleActiveRequest(BaseModel):
    """Activate / deactivate a piece of clothing or an armor piece."""
    item_index: int
    activa: bool
    source: str = "inventario"  # "inventario" | "armadura" | "armadura_piezas"


class MountCreateRequest(BaseModel):
    nombre_original: str
    nombre_personalizado: Optional[str] = None
    especie: Optional[str] = None
    capacidad_carga: Optional[float] = 150
    velocidad: Optional[float] = 12
    constitucion: Optional[str] = ""


class MountUpdateRequest(BaseModel):
    nombre_personalizado: Optional[str] = None
    capacidad_carga: Optional[float] = None
    velocidad: Optional[float] = None


@router.post("/{character_id}/equipment/add")
async def add_equipment_to_character(character_id: str, data: AddEquipmentRequest):
    """
    Add equipment to a character.
    - If is_purchase=True, deduct money from character (must have enough)
    - If is_purchase=False, add without cost (gift/treasure/reward)
    - For mounts: add to character.montura and update carrying capacity
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Get equipment catalog to find item details
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=500, detail="Equipment catalog not found")
    
    # Find item in catalog
    catalog_item = None
    category_items = catalog.get(data.item_category, [])
    for item in category_items:
        if item.get("nombre", "").lower() == data.item_name.lower():
            catalog_item = item
            break
    
    # Build item object
    new_item = {
        "nombre": data.item_name,
        "cantidad": data.cantidad,
        "categoria": data.item_category,
        "peso_kg": data.peso_kg or (catalog_item.get("peso_kg") if catalog_item else 0),
        "portado_por": "personaje",  # Default: carried by character
        "es_regalo": not data.is_purchase,
    }
    
    # Add category-specific fields
    if "armas" in data.item_category:
        new_item["dano"] = data.dano or (catalog_item.get("dano") if catalog_item else "")
        new_item["herida"] = data.herida or (catalog_item.get("herida") if catalog_item else 0)
        new_item["alcance"] = data.alcance or (catalog_item.get("alcance") if catalog_item else "")
        new_item["tipo"] = catalog_item.get("modificador") if catalog_item else ""
        new_item["activa"] = True  # arma lista para blandir
    elif "armaduras" in data.item_category or data.item_category == "escudos":
        new_item["ca"] = data.ca or (catalog_item.get("ca") if catalog_item else 0)
        new_item["ca_bonus"] = data.ca_bonus if data.ca_bonus is not None else (catalog_item.get("ca_bonus") if catalog_item else 0)
        # Posicion for armor (not shields)
        if "armaduras" in data.item_category:
            new_item["posicion"] = data.posicion or (catalog_item.get("posicion") if catalog_item else "cuerpo")
        new_item["activa"] = True
    elif data.item_category == "ropa":
        new_item["posicion"] = data.posicion or (catalog_item.get("posicion") if catalog_item else "cuerpo")
        new_item["activa"] = True
    
    # Handle purchase
    if data.is_purchase:
        precio = data.precio if data.precio is not None else (catalog_item.get("precio", 0) if catalog_item else 0)
        moneda = data.moneda or (catalog_item.get("moneda", "mp") if catalog_item else "mp")
        
        if precio > 0:
            precio_total = precio * data.cantidad
            precio_base = price_to_base(precio_total, moneda)
            
            dinero_actual = character.get("dinero", {"mo": 0, "mp": 0, "me": 0, "mc": 0})
            dinero_base = convert_to_base(dinero_actual)
            
            if dinero_base < precio_base:
                # Calculate what they can afford
                can_afford = dinero_base // price_to_base(precio, moneda)
                raise HTTPException(
                    status_code=400, 
                    detail=f"Dinero insuficiente. Necesitas {precio_total} {moneda}. Tienes {dinero_actual}. Puedes comprar máximo {can_afford} unidades."
                )
            
            # Deduct money
            nuevo_dinero_base = dinero_base - precio_base
            nuevo_dinero = convert_from_base(nuevo_dinero_base)
            new_item["precio_pagado"] = precio_total
            new_item["moneda_pagada"] = moneda
    else:
        new_item["precio_pagado"] = 0
    
    update = {"updated_at": now_utc()}
    
    # Handle mounts specially
    if data.item_category == "monturas":
        # Add mount to character
        mount_data = {
            "nombre": data.item_name,
            "capacidad_carga": data.capacidad_carga or (catalog_item.get("capacidad_carga") if catalog_item else 0),
            "velocidad": catalog_item.get("velocidad") if catalog_item else 0,
            "constitucion": catalog_item.get("constitucion") if catalog_item else "",
            "equipo": [],  # Equipment carried by mount
        }
        update["montura"] = mount_data
    elif "armas" in data.item_category:
        # Add to armas array
        armas = character.get("armas", [])
        armas.append(new_item)
        update["armas"] = armas
    elif "armaduras" in data.item_category:
        # Si la pieza tiene posicion != cuerpo O viene como ca_bonus > 0,
        # la tratamos como pieza secundaria (brazalete, grebas, hombreras).
        pos = (new_item.get("posicion") or "").lower()
        is_secondary = (pos and pos != "cuerpo") or ((new_item.get("ca_bonus") or 0) > 0 and not new_item.get("ca"))
        if is_secondary:
            piezas = character.get("armadura_piezas", []) or []
            piezas.append(new_item)
            update["armadura_piezas"] = piezas
        else:
            # Reemplaza la armadura principal del cuerpo
            update["armadura"] = new_item
    elif data.item_category == "escudos":
        # Add to equipo
        equipo = character.get("equipo", [])
        equipo.append(new_item)
        update["equipo"] = equipo
    else:
        # Add to inventario
        inventario = character.get("inventario", [])
        # Check if item already exists
        found = False
        for i, item in enumerate(inventario):
            if isinstance(item, dict) and item.get("nombre", "").lower() == data.item_name.lower():
                inventario[i]["cantidad"] = inventario[i].get("cantidad", 1) + data.cantidad
                found = True
                break
        if not found:
            inventario.append(new_item)
        update["inventario"] = inventario
    
    # Update money if purchase
    if data.is_purchase and precio > 0:
        update["dinero"] = nuevo_dinero
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "message": f"{'Comprado' if data.is_purchase else 'Añadido'}: {data.item_name} x{data.cantidad}",
        "character": serialize_doc(updated)
    }


@router.delete("/{character_id}/equipment/remove")
async def remove_equipment_from_character(
    character_id: str,
    item_name: str = Query(...),
    item_category: str = Query(...),
    cantidad: int = Query(default=1)
):
    """Remove equipment from a character's inventory"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    update = {"updated_at": now_utc()}
    removed = False
    
    if item_category == "monturas":
        # Remove mount
        if character.get("montura", {}).get("nombre", "").lower() == item_name.lower():
            update["montura"] = {}
            removed = True
    elif "armas" in item_category:
        armas = character.get("armas", [])
        for i, arma in enumerate(armas):
            nombre = arma.get("nombre") if isinstance(arma, dict) else arma
            if nombre and nombre.lower() == item_name.lower():
                armas.pop(i)
                removed = True
                break
        update["armas"] = armas
    elif "armaduras" in item_category:
        armadura = character.get("armadura", {})
        if isinstance(armadura, dict) and armadura.get("nombre", "").lower() == item_name.lower():
            update["armadura"] = {}
            removed = True
    elif item_category == "escudos":
        equipo = character.get("equipo", [])
        for i, item in enumerate(equipo):
            nombre = item.get("nombre") if isinstance(item, dict) else item
            if nombre and nombre.lower() == item_name.lower():
                equipo.pop(i)
                removed = True
                break
        update["equipo"] = equipo
    else:
        inventario = character.get("inventario", [])
        for i, item in enumerate(inventario):
            nombre = item.get("nombre") if isinstance(item, dict) else item
            if nombre and nombre.lower() == item_name.lower():
                current_qty = item.get("cantidad", 1) if isinstance(item, dict) else 1
                if current_qty <= cantidad:
                    inventario.pop(i)
                else:
                    inventario[i]["cantidad"] = current_qty - cantidad
                removed = True
                break
        update["inventario"] = inventario
    
    if not removed:
        raise HTTPException(status_code=404, detail=f"Item '{item_name}' not found")
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "message": f"Eliminado: {item_name}",
        "character": serialize_doc(updated)
    }


@router.patch("/{character_id}/equipment/carry")
async def update_equipment_carrier(character_id: str, data: UpdateEquipmentCarryRequest):
    """
    Update who carries an item.

    Supports moving items between the character and the mount across different
    sources: inventario, equipo, armas, armadura principal, armadura_piezas.

    When a ropa/armadura/arma "activa" is moved to the mount it is automatically
    deactivated (no la llevas puesta/lista). The caller is responsible for
    showing the warning toasts in the UI.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    # Detect mount (primary list or legacy)
    monturas_list = character.get("monturas", []) or []
    has_mount = bool(monturas_list) or bool(character.get("montura", {}).get("nombre"))

    if data.carried_by == "montura" and not has_mount:
        raise HTTPException(status_code=400, detail="El personaje no tiene montura")

    # Resolve target mount_id
    target_mount_id = data.mount_id
    if data.carried_by == "montura" and not target_mount_id:
        if monturas_list:
            target_mount_id = monturas_list[0].get("id")

    source = (data.source or "inventario").lower()
    update = {"updated_at": now_utc()}
    deactivated = False
    item_name = None
    item_posicion = None

    def _apply_move(obj):
        """Apply move semantics to a single item dict. Returns the dict modified."""
        nonlocal deactivated, item_name, item_posicion
        if not isinstance(obj, dict):
            return obj
        obj["portado_por"] = data.carried_by
        if data.carried_by == "montura":
            if target_mount_id:
                obj["mount_id"] = target_mount_id
        else:
            obj.pop("mount_id", None)
        item_name = obj.get("nombre")
        item_posicion = obj.get("posicion")
        if data.carried_by == "montura" and obj.get("activa"):
            obj["activa"] = False
            deactivated = True
        return obj

    if source == "armas":
        armas = character.get("armas", []) or []
        if data.item_index < 0 or data.item_index >= len(armas):
            raise HTTPException(status_code=400, detail="Índice de arma inválido")
        item = armas[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        armas[data.item_index] = _apply_move(item)
        update["armas"] = armas

    elif source == "armadura":
        arm = character.get("armadura", {}) or {}
        if not isinstance(arm, dict) or not arm.get("nombre"):
            raise HTTPException(status_code=404, detail="Armadura no encontrada")
        update["armadura"] = _apply_move(arm)

    elif source == "armadura_piezas":
        piezas = character.get("armadura_piezas", []) or []
        if data.item_index < 0 or data.item_index >= len(piezas):
            raise HTTPException(status_code=400, detail="Índice de pieza inválido")
        piezas[data.item_index] = _apply_move(piezas[data.item_index])
        update["armadura_piezas"] = piezas

    elif source == "equipo":
        equipo = character.get("equipo", []) or []
        if data.item_index < 0 or data.item_index >= len(equipo):
            raise HTTPException(status_code=400, detail="Índice de equipo inválido")
        item = equipo[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        equipo[data.item_index] = _apply_move(item)
        update["equipo"] = equipo

    elif source == "equipo_ocupacion":
        eqocup = character.get("equipo_ocupacion", []) or []
        if data.item_index < 0 or data.item_index >= len(eqocup):
            raise HTTPException(status_code=400, detail="Índice de equipo_ocupacion inválido")
        item = eqocup[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        eqocup[data.item_index] = _apply_move(item)
        update["equipo_ocupacion"] = eqocup

    else:  # inventario (default)
        inventario = character.get("inventario", []) or []
        if data.item_index < 0 or data.item_index >= len(inventario):
            raise HTTPException(status_code=400, detail="Índice de objeto inválido")
        item = inventario[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        inventario[data.item_index] = _apply_move(item)
        update["inventario"] = inventario

    await db.characters.update_one({"_id": character_id}, {"$set": update})

    updated = await db.characters.find_one({"_id": character_id})
    return {
        "character": serialize_doc(updated),
        "deactivated": deactivated,
        "item_name": item_name,
        "item_posicion": item_posicion,
        "source": source,
    }


@router.patch("/{character_id}/equipment/toggle-active")
async def toggle_equipment_active(character_id: str, data: ToggleActiveRequest):
    """Activate / deactivate a clothing or armor piece.

    - source='inventario': toggle inventario[item_index].activa (ropa)
    - source='armadura': toggle character.armadura.activa (cuerpo)
    - source='armadura_piezas': toggle armadura_piezas[item_index].activa
    - source='armas': toggle armas[item_index].activa (blandida / guardada)
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    source = (data.source or "inventario").lower()
    update = {"updated_at": now_utc()}

    if source == "armadura":
        arm = character.get("armadura", {}) or {}
        if not isinstance(arm, dict) or not arm.get("nombre"):
            raise HTTPException(status_code=404, detail="Armadura no encontrada")
        arm["activa"] = bool(data.activa)
        update["armadura"] = arm
    elif source == "armadura_piezas":
        piezas = character.get("armadura_piezas", []) or []
        if data.item_index < 0 or data.item_index >= len(piezas):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(piezas[data.item_index], dict):
            piezas[data.item_index] = {"nombre": piezas[data.item_index]}
        piezas[data.item_index]["activa"] = bool(data.activa)
        update["armadura_piezas"] = piezas
    elif source == "armas":
        armas = character.get("armas", []) or []
        if data.item_index < 0 or data.item_index >= len(armas):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(armas[data.item_index], dict):
            armas[data.item_index] = {"nombre": armas[data.item_index]}
        armas[data.item_index]["activa"] = bool(data.activa)
        update["armas"] = armas
    elif source == "equipo_ocupacion":
        eqocup = character.get("equipo_ocupacion", []) or []
        if data.item_index < 0 or data.item_index >= len(eqocup):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(eqocup[data.item_index], dict):
            eqocup[data.item_index] = {"nombre": eqocup[data.item_index]}
        eqocup[data.item_index]["activa"] = bool(data.activa)
        update["equipo_ocupacion"] = eqocup
    else:
        inventario = character.get("inventario", []) or []
        if data.item_index < 0 or data.item_index >= len(inventario):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(inventario[data.item_index], dict):
            inventario[data.item_index] = {"nombre": inventario[data.item_index]}
        inventario[data.item_index]["activa"] = bool(data.activa)
        update["inventario"] = inventario

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated), "activa": bool(data.activa), "source": source}


@router.get("/{character_id}/weight-summary")
async def get_character_weight_summary(character_id: str):
    """
    Calculate detailed weight summary for character including mount.
    Returns:
    - Total weight carried by character
    - Total weight on mount
    - Encumbrance status
    - Mount's remaining capacity
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Get equipment catalog for weights
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    
    def get_weight(item_name: str, item_data: dict = None) -> float:
        if item_data and item_data.get("peso_kg"):
            return float(item_data.get("peso_kg", 0))
        if not catalog:
            return 0
        # Search all categories
        for category_items in catalog.values():
            if isinstance(category_items, list):
                for item in category_items:
                    if item.get("nombre", "").lower() == item_name.lower():
                        return float(item.get("peso_kg", 0))
        return 0
    
    peso_personaje = 0
    peso_montura = 0  # total across all mounts
    peso_por_mount_id = {}  # mount_id -> kg

    def _add_mount_weight(peso: float, mount_id: str = None):
        nonlocal peso_montura
        peso_montura += peso
        if mount_id:
            peso_por_mount_id[mount_id] = peso_por_mount_id.get(mount_id, 0) + peso
        else:
            peso_por_mount_id["__unassigned__"] = peso_por_mount_id.get("__unassigned__", 0) + peso
    
    # Mount-related item detection
    mount_names = ['caballo', 'pony', 'poni', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']
    mount_accessory_names = ['silla de monta', 'alforjas', 'bocado', 'bridas', 'bocado y bridas', 
                             'arreos', 'barda', 'silla de montar', 'albarda', 'estribos', 'riendas', 
                             'herradura', 'manta de montar']
    
    def is_mount_related(nombre: str) -> bool:
        lower = nombre.lower()
        return any(m in lower for m in mount_names) or any(a in lower for a in mount_accessory_names)
    
    # Prefer new `monturas` list; fallback to legacy single `montura`
    monturas_list = character.get("monturas", []) or []
    if not monturas_list and character.get("montura", {}).get("nombre"):
        mlegacy = character["montura"]
        monturas_list = [{
            "id": "legacy",
            "nombre_original": mlegacy.get("nombre"),
            "nombre_personalizado": mlegacy.get("nombre_personalizado") or mlegacy.get("nombre"),
            "capacidad_carga": mlegacy.get("capacidad_carga", 0),
            "velocidad": mlegacy.get("velocidad", 0),
        }]

    has_mount = bool(monturas_list)
    default_mount_id = monturas_list[0]["id"] if monturas_list else None
    
    # Weapons - account for portado_por
    for arma in character.get("armas", []):
        if not isinstance(arma, dict):
            peso_personaje += get_weight(arma)
            continue
        nombre = arma.get("nombre")
        peso = get_weight(nombre, arma)
        if arma.get("portado_por") == "montura":
            _add_mount_weight(peso, arma.get("mount_id") or default_mount_id)
        else:
            peso_personaje += peso

    # Armor (principal) - account for portado_por
    armadura = character.get("armadura", {})
    if isinstance(armadura, dict) and armadura.get("nombre"):
        peso = get_weight(armadura.get("nombre"), armadura)
        if armadura.get("portado_por") == "montura":
            _add_mount_weight(peso, armadura.get("mount_id") or default_mount_id)
        else:
            peso_personaje += peso

    # Armor pieces (brazalete, grebas, etc.)
    for pieza in character.get("armadura_piezas", []) or []:
        if not isinstance(pieza, dict):
            continue
        peso = get_weight(pieza.get("nombre"), pieza)
        if pieza.get("portado_por") == "montura":
            _add_mount_weight(peso, pieza.get("mount_id") or default_mount_id)
        else:
            peso_personaje += peso

    # Equipo (shield, tools) - account for portado_por
    for item in character.get("equipo", []):
        if isinstance(item, dict):
            peso = get_weight(item.get("nombre"), item)
            if item.get("portado_por") == "montura":
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            else:
                peso_personaje += peso
        else:
            peso_personaje += get_weight(item)

    # Equipo de ocupación (armas, armaduras, escudos y útiles del trasfondo)
    for item in character.get("equipo_ocupacion", []) or []:
        if isinstance(item, dict):
            peso = get_weight(item.get("nombre"), item)
            if item.get("portado_por") == "montura":
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            else:
                peso_personaje += peso
        else:
            peso_personaje += get_weight(item)
    
    # Inventory items - check who carries them
    # Mount items ALWAYS go to mount if character has one
    for item in character.get("inventario", []):
        if isinstance(item, dict):
            nombre = item.get("nombre", "")
            cantidad = item.get("cantidad", 1)
            peso = get_weight(nombre, item) * cantidad
            
            # Mount-related items always on mount (if has mount)
            if is_mount_related(nombre) and has_mount:
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            elif item.get("portado_por") == "montura":
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            else:
                peso_personaje += peso
        else:
            peso_personaje += get_weight(item)
    
    # Add coin weight (1 coin ≈ 9g)
    dinero = character.get("dinero", {})
    total_coins = sum(dinero.values())
    peso_personaje += total_coins * 0.009
    
    # Calculate encumbrance
    attrs = character.get("atributos", character.get("caracteristicas", character.get("atributos_finales", {})))
    fuerza = attrs.get("fuerza", 10)
    
    # Base capacity = Strength * 6.8 kg (15 lb per point)
    # With x2 (dwarf trait): doubled
    capacidad_base = fuerza * 6.8
    if character.get("capacidad_carga_x2"):
        capacidad_base *= 2
    
    limite_cargado = fuerza * 2.5  # Encumbered threshold
    limite_muy_cargado = fuerza * 4  # Heavily encumbered threshold
    
    # Mount info — compute per-mount details
    montura = character.get("montura", {})
    # capacidad principal (legacy field, primer montura)
    capacidad_montura = 0
    if monturas_list:
        capacidad_montura = monturas_list[0].get("capacidad_carga", 0)
    elif montura:
        capacidad_montura = montura.get("capacidad_carga", 0)

    # Character's body weight (relevant only when riding)
    peso_corporal = character.get("peso_kg", 0) or 0

    # Whether the rider is mounted right now. Find the mount flagged with
    # es_jinete_activo (or default to monturas[0]).
    montado = bool(character.get("montado", False))
    jinete_mount_id = None
    if montado and monturas_list:
        for m in monturas_list:
            if m.get("es_jinete_activo"):
                jinete_mount_id = m.get("id")
                break
        if jinete_mount_id is None:
            jinete_mount_id = monturas_list[0].get("id")

    # Build per-mount detail
    monturas_detalle = []
    for m in monturas_list:
        mid = m.get("id")
        base_peso = peso_por_mount_id.get(mid, 0)
        # Unassigned items fall onto the primary mount only
        if mid == default_mount_id:
            base_peso += peso_por_mount_id.get("__unassigned__", 0)
        total = base_peso
        lleva_jinete = montado and mid == jinete_mount_id
        if lleva_jinete:
            total += peso_corporal + peso_personaje
        cap = m.get("capacidad_carga", 0) or 0
        monturas_detalle.append({
            "id": mid,
            "nombre": m.get("nombre_personalizado") or m.get("nombre_original"),
            "nombre_original": m.get("nombre_original"),
            "capacidad": cap,
            "velocidad": m.get("velocidad", 0) or 0,
            "peso_cargado": round(total, 2),
            "peso_sin_jinete": round(base_peso, 2),
            "capacidad_restante": round(cap - total, 2) if cap else 0,
            "sobrecargada": bool(cap and total > cap),
            "lleva_jinete": lleva_jinete,
            "es_jinete_activo": bool(m.get("es_jinete_activo")),
        })

    if montado and monturas_list:
        # Primary riding mount receives rider weight
        primary_base = peso_por_mount_id.get(jinete_mount_id, 0)
        if jinete_mount_id == default_mount_id:
            primary_base += peso_por_mount_id.get("__unassigned__", 0)
        peso_total_montura = primary_base + peso_corporal + peso_personaje
    else:
        peso_total_montura = peso_montura

    return {
        "peso_personaje": round(peso_personaje, 2),
        "peso_montura": round(peso_montura, 2),  # Just items (aggregated across all mounts)
        "peso_corporal": round(peso_corporal, 2),  # Character's body weight
        "peso_total_montura": round(peso_total_montura, 2),  # Primary mount-borne weight (depends on montado)
        "capacidad_personaje": round(capacidad_base, 2),
        "limite_cargado": round(limite_cargado, 2),
        "limite_muy_cargado": round(limite_muy_cargado, 2),
        "estado_carga": "muy_cargado" if peso_personaje > limite_muy_cargado else ("cargado" if peso_personaje > limite_cargado else "normal"),
        "tiene_montura": bool(monturas_list) or bool(montura.get("nombre")),
        "nombre_montura": (monturas_list[0].get("nombre_personalizado") or monturas_list[0].get("nombre_original")) if monturas_list else montura.get("nombre", ""),
        "capacidad_montura": capacidad_montura,
        "capacidad_montura_restante": round(capacidad_montura - peso_total_montura, 2) if capacidad_montura else 0,
        "montado": montado,
        "montura_sobrecargada": bool(capacidad_montura and peso_total_montura > capacidad_montura),
        "monturas_detalle": monturas_detalle,
        "jinete_mount_id": jinete_mount_id,
    }


@router.patch("/{character_id}/mounted")
async def toggle_mounted(
    character_id: str,
    montado: bool = Body(..., embed=True),
    mount_id: Optional[str] = Body(None, embed=True),
):
    """Toggle the rider's mounted state and (optionally) select which mount to ride.

    If `mount_id` is provided, sets `es_jinete_activo=True` on that mount and
    False on all others. Keeps `character.montura` as a mirror of the active
    mount for backward compatibility.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    monturas_list = character.get("monturas", []) or []
    update = {"montado": bool(montado), "updated_at": now_utc()}

    if monturas_list:
        target_id = mount_id or next((m.get("id") for m in monturas_list if m.get("es_jinete_activo")), None)
        if not target_id:
            target_id = monturas_list[0].get("id")
        new_monturas = []
        target_mount = None
        for m in monturas_list:
            m2 = dict(m)
            m2["es_jinete_activo"] = (m2.get("id") == target_id and bool(montado))
            if m2["es_jinete_activo"]:
                target_mount = m2
            new_monturas.append(m2)
        update["monturas"] = new_monturas
        if montado and target_mount:
            update["montura"] = {
                "nombre": target_mount.get("nombre_original"),
                "nombre_personalizado": target_mount.get("nombre_personalizado"),
                "capacidad_carga": target_mount.get("capacidad_carga"),
                "velocidad": target_mount.get("velocidad"),
                "constitucion": target_mount.get("constitucion"),
                "equipo": target_mount.get("equipo", []),
            }

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    active_mount_id = None
    if montado and monturas_list:
        for m in update.get("monturas", []):
            if m.get("es_jinete_activo"):
                active_mount_id = m.get("id")
                break
    return {
        "montado": bool(montado),
        "mount_id": active_mount_id,
        "character": serialize_doc(updated),
    }


# ---------------------------------------------------------------------------
# Multi-mount CRUD endpoints
# ---------------------------------------------------------------------------

@router.post("/{character_id}/monturas")
async def add_mount(character_id: str, data: MountCreateRequest):
    """Add a new mount to character.monturas[]. Returns the new mount id."""
    import uuid as _uuid
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    new_mount = {
        "id": str(_uuid.uuid4()),
        "nombre_original": data.nombre_original,
        "nombre_personalizado": data.nombre_personalizado or data.nombre_original,
        "especie": data.especie or data.nombre_original,
        "capacidad_carga": data.capacidad_carga or 150,
        "velocidad": data.velocidad or 12,
        "constitucion": data.constitucion or "",
        "equipo": [],
        "es_jinete_activo": False,
    }

    monturas = character.get("monturas", []) or []
    monturas.append(new_mount)
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"monturas": monturas, "updated_at": now_utc()}}
    )
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated), "mount": new_mount}


@router.patch("/{character_id}/monturas/{mount_id}")
async def update_mount(character_id: str, mount_id: str, data: MountUpdateRequest):
    """Rename or adjust a mount (capacity/speed)."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    monturas = character.get("monturas", []) or []
    found = False
    for m in monturas:
        if m.get("id") == mount_id:
            if data.nombre_personalizado is not None:
                m["nombre_personalizado"] = data.nombre_personalizado
            if data.capacidad_carga is not None:
                m["capacidad_carga"] = data.capacidad_carga
            if data.velocidad is not None:
                m["velocidad"] = data.velocidad
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Montura no encontrada")

    # Mirror primary in character.montura
    update = {"monturas": monturas, "updated_at": now_utc()}
    primary = monturas[0]
    update["montura"] = {
        "nombre": primary.get("nombre_original"),
        "nombre_personalizado": primary.get("nombre_personalizado"),
        "capacidad_carga": primary.get("capacidad_carga"),
        "velocidad": primary.get("velocidad"),
        "constitucion": primary.get("constitucion"),
        "equipo": primary.get("equipo", []),
    }

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated)}


@router.delete("/{character_id}/monturas/{mount_id}")
async def delete_mount(character_id: str, mount_id: str):
    """Remove a mount. Items carried by it fall to the character."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    monturas = character.get("monturas", []) or []
    monturas = [m for m in monturas if m.get("id") != mount_id]

    # Reassign items that belonged to this mount
    def _reassign(lst):
        if not isinstance(lst, list):
            return lst
        out = []
        for it in lst:
            if isinstance(it, dict) and it.get("mount_id") == mount_id:
                it = dict(it)
                it["portado_por"] = "personaje"
                it.pop("mount_id", None)
            out.append(it)
        return out

    update = {
        "monturas": monturas,
        "inventario": _reassign(character.get("inventario", []) or []),
        "equipo": _reassign(character.get("equipo", []) or []),
        "equipo_ocupacion": _reassign(character.get("equipo_ocupacion", []) or []),
        "armas": _reassign(character.get("armas", []) or []),
        "armadura_piezas": _reassign(character.get("armadura_piezas", []) or []),
        "updated_at": now_utc(),
    }
    # Armadura is a single dict
    arm = character.get("armadura", {}) or {}
    if isinstance(arm, dict) and arm.get("mount_id") == mount_id:
        arm = dict(arm)
        arm["portado_por"] = "personaje"
        arm.pop("mount_id", None)
        update["armadura"] = arm

    # Mirror primary
    if monturas:
        p = monturas[0]
        update["montura"] = {
            "nombre": p.get("nombre_original"),
            "nombre_personalizado": p.get("nombre_personalizado"),
            "capacidad_carga": p.get("capacidad_carga"),
            "velocidad": p.get("velocidad"),
            "constitucion": p.get("constitucion"),
            "equipo": p.get("equipo", []),
        }
    else:
        update["montura"] = {}
        update["montado"] = False

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated)}
