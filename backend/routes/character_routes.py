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
        
        # Meta
        "estado": "activo",
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
async def update_character_fatigue(character_id: str, fatiga: int = Body(..., embed=True)):
    """Update character's fatigue level directly"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Fatigue can be 0-6 (6 levels of exhaustion in 5e)
    new_fatigue = max(0, min(6, fatiga))
    
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
        'heredero', 'inversion'
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

# Conversion rates: 1 mo = 10 mp = 100 me = 1000 mc
COIN_VALUES = {
    "mo": 1000,  # 1 oro = 1000 base
    "mp": 100,   # 1 plata = 100 base
    "me": 10,    # 1 estaño = 10 base
    "mc": 1      # 1 cobre = 1 base
}

def convert_to_base(dinero: dict) -> int:
    """Convert all coins to base value (cobre)"""
    total = 0
    for coin, amount in dinero.items():
        if coin in COIN_VALUES:
            total += amount * COIN_VALUES[coin]
    return total

def convert_from_base(base_amount: int) -> dict:
    """Convert base value back to coins (prioritize larger denominations)"""
    result = {"mo": 0, "mp": 0, "me": 0, "mc": 0}
    remaining = base_amount
    for coin in ["mo", "mp", "me", "mc"]:
        result[coin] = remaining // COIN_VALUES[coin]
        remaining = remaining % COIN_VALUES[coin]
    return result

def price_to_base(precio: float, moneda: str) -> int:
    """Convert a price to base value"""
    return int(precio * COIN_VALUES.get(moneda, 100))


class AddEquipmentRequest(BaseModel):
    """Request to add equipment to a character"""
    item_name: str
    item_category: str  # equipo_general, armas_sencillas_cc, monturas, etc.
    cantidad: int = 1
    is_purchase: bool = True  # True = compra, False = regalo/tesoro
    precio: Optional[float] = None  # Si es diferente al del catálogo
    moneda: Optional[str] = "mp"
    # Additional item data
    peso_kg: Optional[float] = None
    dano: Optional[str] = None
    ca: Optional[int] = None
    herida: Optional[int] = None
    alcance: Optional[str] = None
    capacidad_carga: Optional[int] = None  # Para monturas


class UpdateEquipmentCarryRequest(BaseModel):
    """Request to update what the character/mount carries"""
    item_index: int
    carried_by: str  # "personaje" or "montura"


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
    elif "armaduras" in data.item_category or data.item_category == "escudos":
        new_item["ca"] = data.ca or (catalog_item.get("ca") if catalog_item else 0)
    
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
        # Replace armor
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
    Update who carries an item (character or mount).
    For calculating encumbrance:
    - Items carried by mount don't count towards character's weight
    - Weapons and armor ALWAYS count (character always wears them)
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")
    
    # Detect mount from character.montura field OR from inventory
    has_mount = False
    mount_names = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']
    
    if character.get("montura", {}).get("nombre"):
        has_mount = True
    else:
        # Check inventory for mount
        inventario = character.get("inventario", [])
        for item in inventario:
            nombre = (item.get("nombre", "") if isinstance(item, dict) else str(item)).lower()
            if any(m in nombre for m in mount_names):
                has_mount = True
                break
        
        # Also check equipo_nivel_vida, equipo_trasfondo, equipo_ocupacion
        for source in ["equipo_nivel_vida", "equipo_trasfondo", "equipo_ocupacion"]:
            for item in character.get(source, []):
                nombre = (item.get("nombre", "") if isinstance(item, dict) else str(item)).lower()
                if any(m in nombre for m in mount_names):
                    has_mount = True
                    break
    
    if not has_mount:
        raise HTTPException(status_code=400, detail="El personaje no tiene montura")
    
    inventario = character.get("inventario", [])
    if data.item_index < 0 or data.item_index >= len(inventario):
        raise HTTPException(status_code=400, detail="Índice de objeto inválido")
    
    item = inventario[data.item_index]
    if isinstance(item, dict):
        item["portado_por"] = data.carried_by
        inventario[data.item_index] = item
    else:
        inventario[data.item_index] = {
            "nombre": item,
            "cantidad": 1,
            "portado_por": data.carried_by
        }
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"inventario": inventario, "updated_at": now_utc()}}
    )
    
    updated = await db.characters.find_one({"_id": character_id})
    return serialize_doc(updated)


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
    peso_montura = 0
    
    # Mount-related item detection
    mount_names = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']
    mount_accessory_names = ['silla de monta', 'alforjas', 'bocado', 'bridas', 'bocado y bridas', 
                             'arreos', 'barda', 'silla de montar', 'albarda', 'estribos', 'riendas', 
                             'herradura', 'manta de montar']
    
    def is_mount_related(nombre: str) -> bool:
        lower = nombre.lower()
        return any(m in lower for m in mount_names) or any(a in lower for a in mount_accessory_names)
    
    # Detect if character has a mount
    has_mount = bool(character.get("montura", {}).get("nombre"))
    if not has_mount:
        # Check inventory for mount
        for item in character.get("inventario", []):
            nombre = item.get("nombre", "") if isinstance(item, dict) else str(item)
            if any(m in nombre.lower() for m in mount_names):
                has_mount = True
                break
        # Check other equipment sources
        if not has_mount:
            for source in ["equipo_nivel_vida", "equipo_trasfondo", "equipo_ocupacion"]:
                for item in character.get(source, []):
                    nombre = item.get("nombre", "") if isinstance(item, dict) else str(item)
                    if any(m in nombre.lower() for m in mount_names):
                        has_mount = True
                        break
    
    # Weapons (always on character)
    for arma in character.get("armas", []):
        nombre = arma.get("nombre") if isinstance(arma, dict) else arma
        peso = arma.get("peso_kg") if isinstance(arma, dict) else None
        peso_personaje += get_weight(nombre, arma if isinstance(arma, dict) else None)
    
    # Armor (always on character)
    armadura = character.get("armadura", {})
    if isinstance(armadura, dict) and armadura.get("nombre"):
        peso_personaje += get_weight(armadura.get("nombre"), armadura)
    
    # Shield/Equipo (always on character for now)
    for item in character.get("equipo", []):
        nombre = item.get("nombre") if isinstance(item, dict) else item
        peso_personaje += get_weight(nombre, item if isinstance(item, dict) else None)
    
    # Inventory items - check who carries them
    # Mount items ALWAYS go to mount if character has one
    for item in character.get("inventario", []):
        if isinstance(item, dict):
            nombre = item.get("nombre", "")
            cantidad = item.get("cantidad", 1)
            peso = get_weight(nombre, item) * cantidad
            
            # Mount-related items always on mount (if has mount)
            if is_mount_related(nombre) and has_mount:
                peso_montura += peso
            elif item.get("portado_por") == "montura":
                peso_montura += peso
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
    
    # Mount info
    montura = character.get("montura", {})
    capacidad_montura = montura.get("capacidad_carga", 0) if montura else 0
    
    # Character's body weight (for when mounted)
    peso_corporal = character.get("peso_kg", 0) or 0
    
    # Total weight on mount = items on mount + character body weight (when riding)
    peso_total_montura = peso_montura + peso_corporal
    
    return {
        "peso_personaje": round(peso_personaje, 2),
        "peso_montura": round(peso_montura, 2),  # Just items
        "peso_corporal": round(peso_corporal, 2),  # Character's body weight
        "peso_total_montura": round(peso_total_montura, 2),  # Items + rider
        "capacidad_personaje": round(capacidad_base, 2),
        "limite_cargado": round(limite_cargado, 2),
        "limite_muy_cargado": round(limite_muy_cargado, 2),
        "estado_carga": "muy_cargado" if peso_personaje > limite_muy_cargado else ("cargado" if peso_personaje > limite_cargado else "normal"),
        "tiene_montura": bool(montura.get("nombre")),
        "nombre_montura": montura.get("nombre", ""),
        "capacidad_montura": capacidad_montura,
        "capacidad_montura_restante": round(capacidad_montura - peso_total_montura, 2) if capacidad_montura else 0,
    }
