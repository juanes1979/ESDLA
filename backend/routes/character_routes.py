"""
Character API Routes
Endpoints for character creation and management
"""
from fastapi import APIRouter, HTTPException, Body
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
    """Step 5: Virtue selection"""
    virtud_id: str


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
    """Update draft with Step 5 data (virtue) - Solo para culturas que obtienen virtud"""
    virtue = await db.virtues.find_one({"_id": data.virtud_id})
    if not virtue:
        raise HTTPException(status_code=404, detail="Virtue not found")
    
    # Get current draft to apply virtue bonuses
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Apply virtue attribute increases
    atributos = draft.get('atributos_finales', {})
    aumentos = virtue.get('aumentos_caracteristica', {})
    
    for attr, bonus in aumentos.items():
        if attr in atributos:
            atributos[attr] += bonus
    
    update = {
        "virtud_id": data.virtud_id,
        "virtud_nombre": virtue['nombre'],
        "virtud_descripcion": virtue.get('descripcion'),
        "rasgos_virtud": virtue.get('rasgos_hoja_pj'),
        "atributos_finales": atributos,
        "paso_actual": 6,  # Sigue al paso de habilidades
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
        # Occupation
        "ocupacion_id": draft['ocupacion_id'],
        "ocupacion_tipo": draft.get('ocupacion_tipo'),
        "vocacion_nombre": draft.get('vocacion_nombre'),
        "dado_golpe": draft.get('dado_golpe'),
        # Attributes
        "atributos": final_attributes,
        # Virtue (optional - only 3 cultures get virtue at level 1)
        "virtud_id": draft.get('virtud_id'),
        "virtud_nombre": draft.get('virtud_nombre'),
        "rasgos_virtud": draft.get('rasgos_virtud'),
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
async def list_characters(jugador: Optional[str] = None, campaign_id: Optional[str] = None):
    """List all characters, optionally filtered"""
    query = {"estado": "activo"}
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
