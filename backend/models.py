"""
MongoDB Models and Schemas for LOTR 5e RPG
Defines all Pydantic models for the game data
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


# === BASE MODELS ===

class BaseDocument(BaseModel):
    """Base model for all MongoDB documents"""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# === CULTURE MODELS ===

class CultureBase(BaseModel):
    """Base culture data"""
    nombre: str
    descripcion: Optional[str] = None
    edad_min: Optional[int] = None
    edad_max: Optional[int] = None
    altura_min: Optional[int] = None
    altura_max: Optional[int] = None
    mod_peso_porcentaje: Optional[float] = None
    velocidad: Optional[float] = None
    descanso_horas: Optional[float] = None
    tamano: Optional[str] = None
    nivel_vida: Optional[str] = None
    descripcion_riqueza: Optional[str] = None
    # Characteristic modifiers
    mod_fuerza: int = 0
    mod_destreza: int = 0
    mod_constitucion: int = 0
    mod_inteligencia: int = 0
    mod_sabiduria: int = 0
    mod_carisma: int = 0


class Culture(CultureBase, BaseDocument):
    """Full culture document for MongoDB"""
    categoria: Optional[str] = None  # ELFOS, ENANOS, HOMBRES, HOBBITS


class CultureResponse(CultureBase):
    """Culture response model (without MongoDB _id)"""
    id: str
    categoria: Optional[str] = None


# === BACKGROUND MODELS ===

class BackgroundBase(BaseModel):
    """Background/Trasfondo base data"""
    nombre: str
    cultura: Optional[str] = None  # Which culture this belongs to
    descripcion: Optional[str] = None
    competencias_habilidades: List[str] = []
    competencias_herramientas: List[str] = []
    idiomas: List[str] = []
    equipo_inicial: List[str] = []
    rasgo_distintivo: Optional[str] = None


class Background(BackgroundBase, BaseDocument):
    """Full background document for MongoDB"""
    culture_id: Optional[str] = None  # Reference to Culture


class BackgroundResponse(BackgroundBase):
    """Background response model"""
    id: str
    culture_id: Optional[str] = None


# === OCCUPATION/CLASS MODELS ===

class OccupationBase(BaseModel):
    """Occupation/Class base data"""
    tipo: str  # Explorador, Guerrero, Lider, Maestro, Protector, Trotamundos
    vocacion: str  # Buscador de tesoros, Campeón, Capitán, etc.
    dado_golpe: str  # 1d8, 1d10
    puntos_golpe_nivel1: Optional[int] = None
    caracteristicas_principales: List[str] = []
    competencia_tiradas_salvacion: List[str] = []
    habilidades_disponibles: List[str] = []
    num_habilidades_elegir: int = 2
    competencia_armaduras: List[str] = []
    competencia_armas: List[str] = []


class OccupationFeature(BaseModel):
    """Feature gained at a specific level"""
    nivel: int
    nombre: str
    descripcion: str


class Occupation(OccupationBase, BaseDocument):
    """Full occupation document for MongoDB"""
    rasgos_por_nivel: List[OccupationFeature] = []


class OccupationResponse(OccupationBase):
    """Occupation response model"""
    id: str
    rasgos_por_nivel: List[OccupationFeature] = []


# === VIRTUE MODELS ===

class VirtueBase(BaseModel):
    """Virtue base data"""
    nombre: str
    cultura: Optional[str] = None
    es_comun: bool = False
    descripcion: Optional[str] = None
    rasgos_hoja_pj: Optional[str] = None  # Traits to write on character sheet
    aumentos_caracteristica: Dict[str, int] = {}  # {fuerza: 1, destreza: 2}


class Virtue(VirtueBase, BaseDocument):
    """Full virtue document for MongoDB"""
    culture_id: Optional[str] = None


class VirtueResponse(VirtueBase):
    """Virtue response model"""
    id: str
    culture_id: Optional[str] = None


# === EQUIPMENT MODELS ===

class EquipmentBase(BaseModel):
    """Base equipment item"""
    nombre: str
    precio: Optional[float] = None
    moneda: Optional[str] = None  # mp, mo, mc
    peso_kg: Optional[float] = None
    descripcion: Optional[str] = None


class Tool(EquipmentBase, BaseDocument):
    """Tool item"""
    tipo: str = "herramienta"


class GeneralItem(EquipmentBase, BaseDocument):
    """General equipment item"""
    tipo: str = "equipo_general"


class WeaponBase(EquipmentBase):
    """Weapon base data"""
    tipo_arma: Optional[str] = None  # Cuerpo a cuerpo, A distancia
    dano: Optional[str] = None  # 1d6, 2d6, etc.
    tipo_dano: Optional[str] = None  # Cortante, Perforante, Contundente
    propiedades: Optional[str] = None  # Versátil, Ligera, etc.


class Weapon(WeaponBase, BaseDocument):
    """Weapon document"""
    tipo: str = "arma"


class ArmorBase(EquipmentBase):
    """Armor base data"""
    clase_armadura: Optional[int] = None
    tipo_armadura: Optional[str] = None  # Ligera, Media, Pesada
    requisito_fuerza: Optional[int] = None
    desventaja_sigilo: bool = False


class Armor(ArmorBase, BaseDocument):
    """Armor document"""
    tipo: str = "armadura"


# === ART/SPELL MODELS ===

class ArtBase(BaseModel):
    """Art/Magic ability base data"""
    nombre: str
    resumen_hoja_pj: Optional[str] = None
    descripcion_completa: Optional[str] = None


class Art(ArtBase, BaseDocument):
    """Full art document"""
    pass


class ArtResponse(ArtBase):
    """Art response model"""
    id: str


# === PATRON MODELS ===

class PatronBase(BaseModel):
    """Patron/Mecenas base data"""
    nombre: str
    ocupaciones_favorecidas: Optional[str] = None
    puntos_comunidad: Optional[int] = None
    ventaja_adicional: Optional[str] = None
    planes: Optional[str] = None


class Patron(PatronBase, BaseDocument):
    """Full patron document"""
    pass


class PatronResponse(PatronBase):
    """Patron response model"""
    id: str


# === SHADOW/CORRUPTION MODELS ===

class ShadowSource(BaseModel):
    """Source of shadow points"""
    fuente: str
    ejemplo: Optional[str] = None
    puntos_sombra: Optional[int] = None


class ShadowRules(BaseDocument):
    """Shadow/Corruption rules document"""
    fuentes_pavor: List[ShadowSource] = []
    fuentes_avaricia: List[ShadowSource] = []
    fuentes_desesperacion: List[ShadowSource] = []


# === NAME GENERATION MODELS ===

class NameParts(BaseModel):
    """Name parts for generation"""
    prefijos: List[str] = []
    sufijos: List[str] = []


class CultureNames(BaseDocument):
    """Name generation data per culture"""
    cultura: str
    hombre: NameParts = NameParts()
    mujer: NameParts = NameParts()
    apellidos: List[str] = []


# === CHARACTER MODELS ===

class CharacterAttributes(BaseModel):
    """Character's six main attributes"""
    fuerza: int = 10
    destreza: int = 10
    constitucion: int = 10
    inteligencia: int = 10
    sabiduria: int = 10
    carisma: int = 10


class CharacterSkill(BaseModel):
    """A single skill with proficiency"""
    nombre: str
    atributo_base: str  # fuerza, destreza, etc.
    competente: bool = False
    experto: bool = False


class CharacterEquipmentItem(BaseModel):
    """Item in character's inventory"""
    item_id: str
    nombre: str
    cantidad: int = 1
    equipado: bool = False


class CharacterBase(BaseModel):
    """Base character data"""
    nombre: str
    jugador: Optional[str] = None
    # Step 1: Culture
    cultura_id: str
    cultura_nombre: str
    # Physical attributes from culture
    edad: int
    altura_cm: int
    peso_kg: float
    tamano: str
    velocidad: float
    # Step 2: Background
    trasfondo_id: str
    trasfondo_nombre: str
    # Step 3: Occupation
    ocupacion_id: str
    ocupacion_nombre: str
    vocacion_nombre: str
    # Step 4: Attributes
    atributos: CharacterAttributes = CharacterAttributes()
    # Step 5: Virtue
    virtud_id: str
    virtud_nombre: str
    # Step 6: Skills
    habilidades: List[CharacterSkill] = []
    # Step 7: Equipment
    inventario: List[CharacterEquipmentItem] = []
    dinero: Dict[str, int] = {"mp": 0, "mo": 0, "mc": 0}
    # Step 8: Combat stats
    puntos_golpe_max: int = 0
    puntos_golpe_actual: int = 0
    clase_armadura: int = 10
    # Step 9: Final details
    patron_id: Optional[str] = None
    patron_nombre: Optional[str] = None
    rasgo_distintivo: Optional[str] = None
    defecto: Optional[str] = None
    motivacion: Optional[str] = None
    # Progression
    nivel: int = 1
    experiencia: int = 0
    # Shadow/Corruption
    puntos_sombra: int = 0
    puntos_sombra_permanentes: int = 0


class Character(CharacterBase, BaseDocument):
    """Full character document for MongoDB"""
    campaign_id: Optional[str] = None


class CharacterCreate(BaseModel):
    """Model for creating a new character (partial data during wizard)"""
    nombre: Optional[str] = None
    jugador: Optional[str] = None
    cultura_id: Optional[str] = None
    trasfondo_id: Optional[str] = None
    ocupacion_id: Optional[str] = None
    atributos: Optional[CharacterAttributes] = None
    virtud_id: Optional[str] = None
    patron_id: Optional[str] = None
    # Wizard step tracking
    paso_actual: int = 1


class CharacterResponse(CharacterBase):
    """Character response model"""
    id: str
    campaign_id: Optional[str] = None


# === REGION/LOCATION MODELS (for DM) ===

class LocalityClimate(BaseModel):
    """Climate data for a specific locality"""
    temperatura_media: Optional[float] = None
    precipitacion_anual: Optional[float] = None
    estacion_predominante: Optional[str] = None


class Locality(BaseModel):
    """A specific location within a subregion"""
    nombre: str
    tipo: Optional[str] = None  # Ciudad, Villa, Aldea, Ruinas, etc.
    tipo_tierra: Optional[str] = None  # Fronteriza, Salvaje, Oscura
    poblacion: Optional[int] = None
    descripcion: Optional[str] = None
    puntos_interes: List[str] = []
    clima: Optional[LocalityClimate] = None


class SubRegion(BaseModel):
    """A subregion within a main region"""
    nombre: str
    tipo_tierra: Optional[str] = None
    descripcion: Optional[str] = None
    localidades: List[Locality] = []


class Region(BaseDocument):
    """A major region in Middle-earth"""
    nombre: str
    descripcion: Optional[str] = None
    tipo_tierra_default: Optional[str] = None
    subregiones: List[SubRegion] = []
    cultura_predominante: Optional[str] = None
    peligros: List[str] = []
    recursos: List[str] = []


# === NPC MODELS ===

class NPCStats(BaseModel):
    """NPC combat statistics"""
    clase_armadura: int = 10
    puntos_golpe: int = 1
    velocidad: float = 9.0
    fuerza: int = 10
    destreza: int = 10
    constitucion: int = 10
    inteligencia: int = 10
    sabiduria: int = 10
    carisma: int = 10


class NPCAction(BaseModel):
    """An action the NPC can take"""
    nombre: str
    descripcion: str
    dano: Optional[str] = None


class NPC(BaseDocument):
    """Non-player character"""
    nombre: str
    descripcion: Optional[str] = None
    tipo: str  # Maligno, Neutral, Aliado
    alineamiento: Optional[str] = None
    stats: NPCStats = NPCStats()
    sentidos: Optional[str] = None
    idiomas: List[str] = []
    acciones: List[NPCAction] = []
    habilidades_especiales: List[str] = []


# === TREASURE MODELS ===

class TreasureItem(BaseModel):
    """A treasure item entry"""
    nombre: str
    tipo: str  # Moneda, Objeto, Artefacto
    valor: Optional[str] = None
    descripcion: Optional[str] = None
    rareza: Optional[str] = None


class TreasureTable(BaseDocument):
    """A treasure generation table"""
    nombre: str
    tipo_lugar: str  # Aldea, Villa, Ruinas, etc.
    nivel_peligro: int = 1
    items: List[TreasureItem] = []
