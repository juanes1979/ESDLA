"""
Languages routes — editable languages catalog used as source of truth
across the app (cultures, NPCs, character creation).

Endpoints under `/api/data/languages` (mounted under `/api`):
  GET    /languages                  — list all (any authenticated)
  POST   /languages                  — create (Maestro/DJ)
  PATCH  /languages/{id}             — update (Maestro/DJ)
  DELETE /languages/{id}             — delete (Maestro only)
  POST   /languages/seed             — idempotent seed of canonical languages

Storage: collection `languages`. Each doc has:
  { id, nombre, familia, descripcion, slug, created_at, updated_at }
"""
from __future__ import annotations

import os
import uuid
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

from auth import get_current_user, require_role


ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["languages"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or uuid.uuid4().hex[:8]


# Canonical seed languages for Tierra Media ----------------------------------
CANONICAL_LANGUAGES = [
    # Comunes / humanos
    {"nombre": "Oestron (Lengua Común)", "familia": "Humanos", "descripcion": "La lingua franca de la Tierra Media en la Tercera Edad."},
    {"nombre": "Rohírrico", "familia": "Humanos", "descripcion": "Lengua de los Rohirrim, derivada de las hablas del Norte."},
    {"nombre": "Dunlendino", "familia": "Humanos", "descripcion": "Lengua de los pueblos de Dunland."},
    {"nombre": "Haradrim", "familia": "Humanos", "descripcion": "Lengua de los Sureños."},
    {"nombre": "Easterling", "familia": "Humanos", "descripcion": "Lenguas del lejano Este."},
    # Élficos
    {"nombre": "Sindarin", "familia": "Élficos", "descripcion": "Lengua de los Elfos Grises, hablada en la mayor parte de Eriador."},
    {"nombre": "Quenya", "familia": "Élficos", "descripcion": "El alto Élfico, antiguo y ceremonial."},
    {"nombre": "Silvano", "familia": "Élficos", "descripcion": "Variante usada por los Elfos Silvanos del Bosque Negro y Lothlórien."},
    # Enanos
    {"nombre": "Khuzdul", "familia": "Enanos", "descripcion": "Lengua secreta de los Enanos, raramente enseñada a forasteros."},
    {"nombre": "Cirth (runas)", "familia": "Enanos", "descripcion": "Sistema de escritura rúnica usado para inscripciones."},
    # Hobbits
    {"nombre": "Hobbitiano", "familia": "Hobbits", "descripcion": "Variedad regional del Oestron hablada en La Comarca."},
    # Antiguas y oscuras
    {"nombre": "Adûnaico", "familia": "Antiguos", "descripcion": "Lengua antigua de los Númenoreanos."},
    {"nombre": "Lengua Negra", "familia": "Oscuros", "descripcion": "Lengua de Mordor, creada por Sauron. Pocos la pronuncian."},
    {"nombre": "Orco", "familia": "Oscuros", "descripcion": "Jerga corrupta usada por las hordas de orcos."},
    # Otros
    {"nombre": "Éntico", "familia": "Antiguos", "descripcion": "Lenta y profunda lengua de los Ents."},
    {"nombre": "Lengua de los Trasgos", "familia": "Oscuros", "descripcion": "Variantes orquescas de las Montañas Nubladas."},
]


# ===== Pydantic models =====
class LanguageBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    familia: Optional[str] = ""
    descripcion: Optional[str] = ""
    slug: Optional[str] = None


class LanguageCreate(LanguageBase):
    pass


class LanguageUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=80)
    familia: Optional[str] = None
    descripcion: Optional[str] = None
    slug: Optional[str] = None


class LanguageOut(BaseModel):
    id: str
    nombre: str
    familia: str = ""
    descripcion: str = ""
    slug: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ===== Helpers =====
def _normalize_out(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "nombre": doc.get("nombre", ""),
        "familia": doc.get("familia", "") or "",
        "descripcion": doc.get("descripcion", "") or "",
        "slug": doc.get("slug", "") or "",
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


# ===== Seed =====
async def seed_languages_if_empty(db_):
    """Insert the canonical languages if collection has none."""
    coll = db_.languages
    count = await coll.count_documents({})
    if count > 0:
        return
    now = now_utc_iso()
    docs = []
    for entry in CANONICAL_LANGUAGES:
        slug = slugify(entry["nombre"])
        docs.append({
            "id": str(uuid.uuid4()),
            "nombre": entry["nombre"],
            "familia": entry.get("familia", ""),
            "descripcion": entry.get("descripcion", ""),
            "slug": slug,
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        await coll.insert_many(docs)
        try:
            await coll.create_index("slug", unique=True)
        except Exception:
            pass
        logger.info("Seeded %d canonical languages", len(docs))


# ===== Endpoints =====
@router.get("/languages", response_model=List[LanguageOut])
async def list_languages(user: dict = Depends(get_current_user)):
    cursor = db.languages.find({}, {"_id": 0}).sort("nombre", 1)
    return [_normalize_out(doc) async for doc in cursor]


@router.post("/languages", response_model=LanguageOut, status_code=201)
async def create_language(payload: LanguageCreate, user: dict = Depends(get_current_user)):
    require_role(user, "maestro", "director_de_juego")
    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(400, "Nombre requerido")
    slug = slugify(payload.slug or nombre)
    existing = await db.languages.find_one({"slug": slug})
    if existing:
        raise HTTPException(400, f"Ya existe un idioma con slug '{slug}'")
    now = now_utc_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "nombre": nombre,
        "familia": (payload.familia or "").strip(),
        "descripcion": (payload.descripcion or "").strip(),
        "slug": slug,
        "created_at": now,
        "updated_at": now,
    }
    await db.languages.insert_one(doc)
    return _normalize_out(doc)


@router.patch("/languages/{lang_id}", response_model=LanguageOut)
async def update_language(
    lang_id: str,
    payload: LanguageUpdate,
    user: dict = Depends(get_current_user),
):
    require_role(user, "maestro", "director_de_juego")
    doc = await db.languages.find_one({"id": lang_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Idioma no encontrado")
    update = {}
    data = payload.model_dump(exclude_unset=True)
    if "nombre" in data and data["nombre"] is not None:
        update["nombre"] = data["nombre"].strip()
    if "familia" in data and data["familia"] is not None:
        update["familia"] = (data["familia"] or "").strip()
    if "descripcion" in data and data["descripcion"] is not None:
        update["descripcion"] = (data["descripcion"] or "").strip()
    if "slug" in data and data["slug"]:
        new_slug = slugify(data["slug"])
        if new_slug != doc.get("slug"):
            collide = await db.languages.find_one({"slug": new_slug, "id": {"$ne": lang_id}})
            if collide:
                raise HTTPException(400, f"Ya existe un idioma con slug '{new_slug}'")
            update["slug"] = new_slug
    if update:
        update["updated_at"] = now_utc_iso()
        await db.languages.update_one({"id": lang_id}, {"$set": update})
    fresh = await db.languages.find_one({"id": lang_id}, {"_id": 0})
    return _normalize_out(fresh)


@router.delete("/languages/{lang_id}")
async def delete_language(lang_id: str, user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    res = await db.languages.delete_one({"id": lang_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Idioma no encontrado")
    return {"deleted": lang_id}


@router.post("/languages/seed")
async def seed_languages_endpoint(user: dict = Depends(get_current_user)):
    require_role(user, "maestro")
    before = await db.languages.count_documents({})
    await seed_languages_if_empty(db)
    after = await db.languages.count_documents({})
    return {"before": before, "after": after, "added": after - before}
