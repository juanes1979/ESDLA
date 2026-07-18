"""
Character API Routes
Endpoints for character creation and management
"""
from fastapi import APIRouter, HTTPException, Body, Query, Depends
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


# === Auth helpers — ownership filter ===
# Importamos aquí (no a nivel de módulo) para evitar circular import.
def _owner_filter(user: dict) -> dict:
    """Devuelve el filtro Mongo a aplicar para que el usuario sólo vea
    sus recursos. El Maestro (admin) ve todos."""
    if user.get("role") == "maestro":
        return {}
    return {"owner_id": user.get("id")}


def _ensure_owner(doc: dict, user: dict, label: str = "recurso"):
    """Lanza 403 si el documento no pertenece al usuario y éste no es Maestro."""
    if user.get("role") == "maestro":
        return
    owner = doc.get("owner_id")
    # Documentos legacy sin owner: tratarlos como propiedad del Maestro.
    if owner is None:
        raise HTTPException(status_code=403, detail=f"No tienes permiso sobre este {label}")
    if owner != user.get("id"):
        raise HTTPException(status_code=403, detail=f"No tienes permiso sobre este {label}")


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
    # D&D 5e: atributos válidos 1-30. Pydantic rechaza valores fuera de rango.
    fuerza: int = Field(10, ge=1, le=30)
    destreza: int = Field(10, ge=1, le=30)
    constitucion: int = Field(10, ge=1, le=30)
    inteligencia: int = Field(10, ge=1, le=30)
    sabiduria: int = Field(10, ge=1, le=30)
    carisma: int = Field(10, ge=1, le=30)


class CharacterSkill(BaseModel):
    nombre: str
    atributo_base: str
    competente: bool = False


class EquipmentItem(BaseModel):
    model_config = {"extra": "allow"}  # Allow categoria/peso_kg/velocidad/etc. to pass through for mount promotion in finalize

    item_id: str
    nombre: str
    cantidad: int = Field(1, ge=1)     # ≥1 (un ítem de inventario no puede ser 0)
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
    # MAESTRÍA: pericia (doble competencia) en una habilidad/herramienta existente
    virtud_pericia_elegida: Optional[str] = None
    # PERFECCIONAMIENTO: {"inteligencia": 2} o {"fuerza": 1, "destreza": 1} (máx 20)
    virtud_perfeccionamiento: Optional[Dict[str, int]] = None


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
    ubicacion_id: Optional[str] = None  # Initial location chosen by player


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




# ---------------------------------------------------------------------------
# Equipment / mounts / location request models — placed in `_common` so the
# split sub-modules (drafts.py, core.py, equipment.py) can all import them.
# ---------------------------------------------------------------------------

class ApplyEquipmentReward(BaseModel):
    """Data to apply a reward/upgrade to equipment"""
    equipment_type: str  # 'arma', 'armadura', 'escudo'
    equipment_index: Optional[int] = None
    equipment_source: Optional[str] = "armas"
    mejora_nombre: str
    mejora_efecto: Optional[str] = None


# Currency helpers (Tierra Media): 1 mo = 100 mp = 1.000 mc = 10.000 me
COIN_VALUES = {
    "mo": 10000,
    "mp": 100,
    "mc": 10,
    "me": 1,
}


def convert_to_base(dinero: dict) -> int:
    total = 0
    for coin, amount in dinero.items():
        if coin in COIN_VALUES:
            total += amount * COIN_VALUES[coin]
    return total


def convert_from_base(base_amount: int) -> dict:
    result = {"mo": 0, "mp": 0, "mc": 0, "me": 0}
    remaining = base_amount
    for coin in ["mo", "mp", "mc", "me"]:
        result[coin] = remaining // COIN_VALUES[coin]
        remaining = remaining % COIN_VALUES[coin]
    return result


def price_to_base(precio: float, moneda: str) -> int:
    return int(precio * COIN_VALUES.get(moneda, 100))


class AddEquipmentRequest(BaseModel):
    item_name: str
    item_category: str
    cantidad: int = Field(1, ge=1)                      # ≥1
    is_purchase: bool = True
    precio: Optional[float] = Field(None, ge=0)         # ≥0
    moneda: Optional[str] = "mp"
    peso_kg: Optional[float] = Field(None, ge=0)        # ≥0
    dano: Optional[str] = None
    ca: Optional[int] = Field(None, ge=0)               # ≥0
    ca_bonus: Optional[int] = None
    herida: Optional[int] = Field(None, ge=0)           # ≥0
    alcance: Optional[str] = None
    capacidad_carga: Optional[int] = Field(None, ge=0)  # ≥0
    posicion: Optional[str] = None
    # Destino al añadir (Tienda D100): "personaje" (mochila) o "montura".
    carried_by: Optional[str] = "personaje"
    mount_id: Optional[str] = None
    equipado: Optional[bool] = None  # arma/armadura/escudo → activa; resto → flag equipado


class UpdateEquipmentCarryRequest(BaseModel):
    item_index: int
    carried_by: str
    source: Optional[str] = "inventario"
    mount_id: Optional[str] = None


class ToggleActiveRequest(BaseModel):
    item_index: int
    activa: bool
    source: str = "inventario"


class EditItemRequest(BaseModel):
    item_index: int
    source: str = "inventario"
    nueva_categoria: Optional[str] = None
    nueva_posicion: Optional[str] = None
    nuevo_nombre: Optional[str] = None


class MountCreateRequest(BaseModel):
    nombre_original: str
    nombre_personalizado: Optional[str] = None
    especie: Optional[str] = None
    capacidad_carga: Optional[float] = Field(150, ge=0)  # ≥0 kg
    velocidad: Optional[float] = Field(12, ge=0)         # ≥0 m/turno
    constitucion: Optional[str] = ""


class MountUpdateRequest(BaseModel):
    nombre_personalizado: Optional[str] = None
    capacidad_carga: Optional[float] = Field(None, ge=0)
    velocidad: Optional[float] = Field(None, ge=0)


class UbicacionUpdateRequest(BaseModel):
    location_id: str
    force: bool = False
