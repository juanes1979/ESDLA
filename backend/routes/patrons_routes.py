"""
Patrons (Mecenas) routes — entidades editables del catálogo.

Los Mecenas son entidades separadas del bestiario (NPCs). Cada uno tiene:
  - Datos narrativos (ocupación, rasgos, idiomas, dónde encontrarlo).
  - Bonificaciones de comunidad estáticas y temporales.
  - Habilidad activable con coste de puntos de comunidad y trigger.
  - Restricciones territoriales opcionales.

Permisos:
  - Cualquier usuario autenticado: leer.
  - Maestro y DJ: crear / editar / eliminar.

Seed inicial (idempotente): 6 mecenas canónicos del reglamento ESDLA 5e
(Balin, Bilbo, Círdan, Gandalf, Gilraen, Tom Bombadil & Baya de Oro).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data/patrons", tags=["patrons"])


# ============================================================================
# Models
# ============================================================================
class PatronAbility(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    cost_type: Optional[str] = "community_points"
    cost_value: Optional[str] = None  # e.g. "1" or "all_remaining"
    trigger: Optional[str] = None
    effect: Optional[str] = None
    restriction: Optional[str] = None


class PatronMeetingBonus(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: Optional[str] = None  # "temp_community_score" | "grant_rumor"
    value: Optional[str] = None
    duration: Optional[str] = None


class PatronBase(BaseModel):
    """Patron data. Supports BOTH the rich new schema (display_name, ability,
    community_bonus_static, etc.) AND the legacy simple schema (nombre,
    puntos_comunidad, ventaja_adicional, planes). Either `display_name` or
    `nombre` is required — the missing one is auto-filled on save."""
    model_config = ConfigDict(extra="ignore")
    slug: Optional[str] = None
    display_name: Optional[str] = None
    nombre: Optional[str] = None  # legacy alias
    entity_type: Optional[str] = None
    occupation: Optional[str] = None
    ocupaciones_favorecidas: Optional[str] = None  # legacy
    distinctive_traits: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    where_to_find_text: Optional[str] = None
    patron_role_text: Optional[str] = None
    planes: Optional[str] = None  # legacy narrative
    community_bonus_static: int = 0
    puntos_comunidad: Optional[int] = None  # legacy alias
    ventaja_adicional: Optional[str] = None  # legacy free-text ability
    ability: Optional[PatronAbility] = None
    meeting_bonus: Optional[PatronMeetingBonus] = None
    is_complete_ruleset: bool = False
    source_reference: Optional[str] = None


class PatronCreate(PatronBase):
    pass


class PatronUpdate(BaseModel):
    """All fields optional for partial update."""
    model_config = ConfigDict(extra="ignore")
    slug: Optional[str] = None
    display_name: Optional[str] = None
    nombre: Optional[str] = None
    entity_type: Optional[str] = None
    occupation: Optional[str] = None
    ocupaciones_favorecidas: Optional[str] = None
    distinctive_traits: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    where_to_find_text: Optional[str] = None
    patron_role_text: Optional[str] = None
    planes: Optional[str] = None
    community_bonus_static: Optional[int] = None
    puntos_comunidad: Optional[int] = None
    ventaja_adicional: Optional[str] = None
    ability: Optional[PatronAbility] = None
    meeting_bonus: Optional[PatronMeetingBonus] = None
    is_complete_ruleset: Optional[bool] = None
    source_reference: Optional[str] = None


class PatronOut(PatronBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _normalize(doc: dict) -> dict:
    """Auto-fill cross-aliases so both legacy and new readers work."""
    if doc.get("display_name") and not doc.get("nombre"):
        doc["nombre"] = doc["display_name"]
    if doc.get("nombre") and not doc.get("display_name"):
        doc["display_name"] = doc["nombre"]
    if doc.get("puntos_comunidad") is not None and not doc.get("community_bonus_static"):
        doc["community_bonus_static"] = doc["puntos_comunidad"]
    if doc.get("community_bonus_static") and doc.get("puntos_comunidad") is None:
        doc["puntos_comunidad"] = doc["community_bonus_static"]
    return doc


# ============================================================================
# Helpers
# ============================================================================
def _is_staff(user: dict) -> bool:
    return user.get("role") in ("maestro", "director_de_juego")


def _serialize(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k != "_id"}
    if "id" not in out and "_id" in doc:
        out["id"] = doc["_id"]
    return _normalize(out)


# ============================================================================
# Seed
# ============================================================================
SEED_PATRONS = [
    {
        "slug": "balin",
        "display_name": "Balin, hijo de Fundin",
        "entity_type": "Humanoide Mediano (enano)",
        "occupation": "aventurero, emisario",
        "distinctive_traits": ["Animoso", "Honorable"],
        "languages": ["Khuzdul", "oestron"],
        "where_to_find_text": (
            "Balin está a menudo en el camino, recorriendo las Tierras Ásperas y Eriador; "
            "visita la Comarca y las Montañas Azules con regularidad. Puede hallarse en "
            "posadas del camino, acampado cerca de la ruta o compartiendo pipa con viejos amigos."
        ),
        "patron_role_text": (
            "Quiere reforzar el protagonismo enano en Eriador y empujar a los orcos hacia atrás. "
            "Prefiere paciencia y observación frente a violencia precipitada. Interés especial: "
            "fortalezas enanas caídas y, en particular, Moria."
        ),
        "community_bonus_static": 1,
        "ability": {
            "name": "Consejo de Balin",
            "cost_type": "community_points",
            "cost_value": "1",
            "trigger": "after_attack_roll_before_resolution",
            "effect": "extra_d20_choose_one",
        },
        "is_complete_ruleset": True,
        "source_reference": "ESDLA 5e — Mecenas",
    },
    {
        "slug": "bilbo",
        "display_name": "Bilbo Bolsón",
        "entity_type": "Humanoide Pequeño (hobbit)",
        "occupation": "aventurero retirado, saqueador",
        "distinctive_traits": ["Astuto", "Bien hablado"],
        "languages": ["oestron"],
        "where_to_find_text": (
            "Habitualmente en Bolsón Cerrado, bajo la Colina (Hobbiton). A veces viaja fuera de "
            "la Comarca, con frecuencia en compañía de enanos."
        ),
        "patron_role_text": (
            "Se mantiene informado con viajeros y cartas; reacciona a amenazas que puedan afectar "
            "a la Comarca. Ofrece alojamiento y financiación a cambio de historias, mapas, "
            "reliquias y sabiduría geográfica."
        ),
        "community_bonus_static": 2,
        "meeting_bonus": {
            "type": "temp_community_score",
            "value": "1",
            "duration": "until_next_community_phase",
        },
        "is_complete_ruleset": True,
        "source_reference": "ESDLA 5e — Mecenas",
    },
    {
        "slug": "cirdan",
        "display_name": "Círdan el Carpintero de Barcos",
        "entity_type": "Humanoide Mediano (elfo)",
        "occupation": "emisario, maestro del saber",
        "distinctive_traits": ["Señorial", "Paciente"],
        "languages": ["todos"],
        "where_to_find_text": (
            "En Mithlond, los Puertos Grises. Rara vez sale; todos de buen espíritu y en paz son "
            "bienvenidos. Galdor de los Puertos es su heraldo y enviado."
        ),
        "patron_role_text": (
            "Protege la importancia estratégica de los Puertos Grises y preserva saber antiguo. "
            "Consejo y coordinación con Imladris (Elrond) mediante mensajeros."
        ),
        "community_bonus_static": 1,
        "ability": {
            "name": "La clarividencia del Carpintero de Barcos",
            "cost_type": "community_points",
            "cost_value": "1",
            "trigger": "after_attribute_test_before_resolution",
            "effect": "extra_d20_choose_one",
        },
        "meeting_bonus": {"type": "grant_rumor", "value": "1"},
        "is_complete_ruleset": True,
        "source_reference": "ESDLA 5e — Mecenas",
    },
    {
        "slug": "gandalf",
        "display_name": "Gandalf el Gris",
        "entity_type": "Humanoide Mediano (Mago)",
        "occupation": "aventurero, mago",
        "distinctive_traits": ["Arrojado", "Astuto"],
        "languages": ["todos"],
        "where_to_find_text": (
            "Puede estar casi en cualquier lugar. En Eriador suele elegir la posada de Bree como "
            "lugar de encuentro. A menudo aparece cuando se le necesita."
        ),
        "patron_role_text": (
            "Inspira a actuar con prontitud; se infiltra en las guaridas del Enemigo y enfrenta "
            "el mal sin dudar. Busca unir a los Pueblos Libres y dar ejemplo."
        ),
        "community_bonus_static": 2,
        "ability": {
            "name": "La sabiduría del Peregrino Gris",
            "cost_type": "community_points",
            "cost_value": "1",
            "trigger": "after_saving_throw_before_resolution",
            "effect": "extra_d20_choose_one",
        },
        "is_complete_ruleset": True,
        "source_reference": "ESDLA 5e — Mecenas",
    },
    {
        "slug": "gilraen",
        "display_name": "Gilraen la Bella",
        "entity_type": "Humanoide Mediana (dúnadan)",
        "occupation": "consejera, vidente",
        "distinctive_traits": ["Adusta", "Precavida"],
        "languages": ["oestron", "sindarin"],
        "where_to_find_text": (
            "Cerca de Rivendel y en rutas de los montaraces del Norte: Colinas de los Vientos, "
            "Quebradas del Norte. No suele alejarse más de unas pocas semanas."
        ),
        "patron_role_text": (
            "Defensa de Eriador/Arnor contra criaturas malignas; red de montaraces y refugios "
            "ocultos. Apoyo logístico: indicaciones para refugios y provisiones cuando los "
            "aventureros son dignos de confianza."
        ),
        "community_bonus_static": 0,
        "ability": {
            "name": "De la gente de Gilraen",
            "cost_type": "community_points",
            "cost_value": "1",
            "trigger": "journey_start",
            "effect": "travel_event_alt_d20_loremaster_choice",
            "restriction": "former_arnor",
        },
        "meeting_bonus": {"type": "grant_rumor", "value": "1"},
        "is_complete_ruleset": True,
        "source_reference": "ESDLA 5e — Mecenas",
    },
    {
        "slug": "tom_bombadil_goldberry",
        "display_name": "Tom Bombadil y Baya de Oro",
        "entity_type": "Humanoides Medianos (exploradores)",
        "occupation": "el señor / hija del río",
        "distinctive_traits": ["Alegre", "Despistado", "Bien hablada", "Hermosa"],
        "languages": ["todos"],
        "where_to_find_text": (
            "En la casa de Tom Bombadil al este del Bosque Viejo, cerca del Río Tornasauce y "
            "las Quebradas de los Túmulos. Baya de Oro puede encontrarse a lo largo del "
            "Tornasauce, trenzando margaritas o cantando."
        ),
        "patron_role_text": (
            "Su poder es inmenso pero su dominio parece limitado a un territorio pequeño "
            "(\"el país de Tom\"). Dentro de sus fronteras no temen a nada, pero no darán un paso "
            "más allá por ningún motivo. Pueden señalar problemas que necesitan solución y llamar "
            "a héroes bien intencionados para ayudar."
        ),
        "community_bonus_static": 2,
        "ability": {
            "name": "Señores de la Madera, el Agua y las Colinas",
            "cost_type": "community_points",
            "cost_value": "all_remaining",
            "trigger": "on_demand_within_patron_domain",
            "effect": "request_intervention",
            "restriction": "tom_country",
        },
        "is_complete_ruleset": True,
        "source_reference": "ESDLA 5e — Mecenas",
    },
]


async def seed_patrons_if_empty(db) -> int:
    """Idempotent seed. Inserts canonical patrons if their slug doesn't exist."""
    inserted = 0
    now = datetime.now(timezone.utc).isoformat()
    for p in SEED_PATRONS:
        existing = await db.patrons.find_one({"slug": p["slug"]})
        if existing:
            continue
        doc = {
            **p,
            "_id": str(uuid.uuid4()),
            "id": None,  # filled below
            "created_at": now,
            "updated_at": now,
        }
        doc["id"] = doc["_id"]
        await db.patrons.insert_one(doc)
        inserted += 1
    if inserted:
        logger.info("Seeded %d patrons", inserted)
    return inserted


# ============================================================================
# Endpoints
# ============================================================================
@router.get("", response_model=List[PatronOut])
async def list_patrons(user: dict = Depends(get_current_user)):
    from server import db
    cursor = db.patrons.find({}).sort("display_name", 1)
    out = []
    async for d in cursor:
        out.append(_serialize(d))
    return out


@router.post("", response_model=PatronOut, status_code=201)
async def create_patron(payload: PatronCreate, user: dict = Depends(get_current_user)):
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Sólo Maestro o DJ pueden crear mecenas")
    from server import db
    body = _normalize(payload.model_dump())
    if not body.get("display_name") and not body.get("nombre"):
        raise HTTPException(status_code=422, detail="Falta display_name / nombre")
    if not body.get("slug"):
        # Derive slug from name
        base = (body.get("display_name") or body.get("nombre") or "patron").lower()
        body["slug"] = "".join(c for c in base.replace(" ", "_") if c.isalnum() or c == "_")[:60]
    existing = await db.patrons.find_one({"slug": body["slug"]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un mecenas con slug '{body['slug']}'")
    now = datetime.now(timezone.utc).isoformat()
    pid = str(uuid.uuid4())
    doc = {**body, "_id": pid, "id": pid, "created_at": now, "updated_at": now}
    await db.patrons.insert_one(doc)
    return _serialize(doc)


@router.get("/{patron_id}", response_model=PatronOut)
async def get_patron(patron_id: str, user: dict = Depends(get_current_user)):
    from server import db
    p = await db.patrons.find_one({"$or": [{"_id": patron_id}, {"id": patron_id}, {"slug": patron_id}]})
    if not p:
        raise HTTPException(status_code=404, detail="Mecenas no encontrado")
    return _serialize(p)


@router.patch("/{patron_id}", response_model=PatronOut)
async def update_patron(
    patron_id: str, payload: PatronUpdate, user: dict = Depends(get_current_user)
):
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Sólo Maestro o DJ pueden editar mecenas")
    from server import db
    p = await db.patrons.find_one({"_id": patron_id})
    if not p:
        raise HTTPException(status_code=404, detail="Mecenas no encontrado")
    upd = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not upd:
        return _serialize(p)
    # Slug unique check
    if "slug" in upd and upd["slug"] != p.get("slug"):
        clash = await db.patrons.find_one({"slug": upd["slug"]})
        if clash:
            raise HTTPException(status_code=400, detail="Slug ya en uso")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.patrons.update_one({"_id": patron_id}, {"$set": upd})
    new_doc = await db.patrons.find_one({"_id": patron_id})
    return _serialize(new_doc)


@router.delete("/{patron_id}")
async def delete_patron(patron_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "maestro":
        raise HTTPException(status_code=403, detail="Sólo el Maestro puede eliminar mecenas")
    from server import db
    res = await db.patrons.delete_one({"_id": patron_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mecenas no encontrado")
    return {"deleted": True, "id": patron_id}


@router.post("/seed")
async def seed_patrons(user: dict = Depends(get_current_user)):
    if user.get("role") != "maestro":
        raise HTTPException(status_code=403, detail="Sólo el Maestro puede sembrar mecenas")
    from server import db
    count = await seed_patrons_if_empty(db)
    return {"inserted": count, "total": await db.patrons.count_documents({})}
