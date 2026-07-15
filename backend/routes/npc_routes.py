"""
NPC, Enemies and Animals API routes.

Extracted from data_routes.py (Feb 2026) as a proof-of-concept for the
domain-based refactor. All endpoints keep the original `/api/data/...`
URLs so the frontend doesn't need any changes.
"""
from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/data", tags=["NPCs"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Models ──────────────────────────────────────────────────────────────────

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
    tiradas_salvacion: Optional[Dict[str, int]] = None
    habilidades: Optional[Dict[str, int]] = None
    percepcion_pasiva: Optional[int] = 10

    # Resistances & Immunities
    resistencias: Optional[List[str]] = []
    inmunidades_dano: Optional[List[str]] = []
    inmunidades_estados: Optional[List[str]] = []
    vulnerabilidades: Optional[List[str]] = []

    # Senses & Languages
    sentidos: Optional[List[str]] = []
    idiomas: Optional[List[str]] = []

    # Challenge
    desafio: Optional[str] = ""  # "3 (700 PX)"
    experiencia: Optional[int] = 0
    bonificador_competencia: Optional[int] = 2

    # Special Abilities (structured list)
    especiales: Optional[List[Dict[str, str]]] = []

    # Attacks (structured weapons)
    armas: Optional[List[Dict]] = []

    # Other Actions
    acciones: Optional[List[Dict]] = []
    ataque_multiple: Optional[str] = ""

    # Reactions
    reacciones: Optional[List[Dict]] = []

    # Legendary Actions (for bosses)
    acciones_legendarias: Optional[List[Dict]] = []

    # AI-generated story (Feb 2026)
    historia: Optional[str] = ""

    # Config de creación de PNJ (Fase B): modo de raza del adversario
    modo_raza: Optional[str] = None  # 'racial' | 'sin_raza'
    razas_excluidas: Optional[List[str]] = None  # p. ej. ["Elfos"] para Espectro
    razas_permitidas: Optional[List[str]] = None  # razas que SÍ puede ocupar (vacío = todas)
    tipos_criatura: Optional[List[str]] = None  # tipos permitidos si sin_raza (ids)


# ─── Endpoints ───────────────────────────────────────────────────────────────

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

    grouped = {
        'malignos': [],
        'pnj': [],
        'animales': [],
        'especiales': []
    }

    for npc in npcs:
        cat = npc.get('categoria', 'especiales')
        if cat in grouped:
            npc_data = {
                'id': npc['_id'],
                'nombre': npc.get('nombre'),
                'descripcion': npc.get('descripcion'),
                'tipo': npc.get('tipo'),
                'tamanio': npc.get('tamanio'),
                'alineamiento': npc.get('alineamiento'),
                'clase_armadura': npc.get('clase_armadura'),
                'descripcion_armadura': npc.get('descripcion_armadura'),
                'puntos_golpe': npc.get('puntos_golpe'),
                'dados_golpe': npc.get('dados_golpe'),
                'velocidad': npc.get('velocidad'),
                'velocidades_especiales': npc.get('velocidades_especiales'),
                'velocidad_nota': npc.get('velocidad_nota'),
                'atributos': npc.get('atributos'),
                'tiradas_salvacion': npc.get('tiradas_salvacion'),
                'habilidades': npc.get('habilidades'),
                'percepcion_pasiva': npc.get('percepcion_pasiva', 10),
                'resistencias': npc.get('resistencias', []),
                'inmunidades_dano': npc.get('inmunidades_dano', []),
                'inmunidades_estados': npc.get('inmunidades_estados', []),
                'vulnerabilidades': npc.get('vulnerabilidades', []),
                'sentidos': npc.get('sentidos'),
                'idiomas': npc.get('idiomas', []),
                'desafio': npc.get('desafio'),
                'experiencia': npc.get('experiencia'),
                'bonificador_competencia': npc.get('bonificador_competencia', 2),
                'especiales': npc.get('especiales', []),
                'especial': npc.get('especial'),
                'armas': npc.get('armas', []),
                'acciones': npc.get('acciones'),
                'ataque_multiple': npc.get('ataque_multiple'),
                'reacciones': npc.get('reacciones', []),
                'acciones_legendarias': npc.get('acciones_legendarias', []),
                'historia': npc.get('historia'),
                'modo_raza': npc.get('modo_raza'),
                'razas_excluidas': npc.get('razas_excluidas'),
                'razas_permitidas': npc.get('razas_permitidas'),
                'tipos_criatura': npc.get('tipos_criatura'),
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

    update = {"updated_at": now_utc()}
    for key, value in data.items():
        if key not in ["_id", "id", "created_at"]:
            update[key] = value

    await db.npcs.update_one({"_id": npc_id}, {"$set": update})

    updated = await db.npcs.find_one({"_id": npc_id})
    result = {k: v for k, v in updated.items() if k != '_id'}
    result['id'] = updated['_id']
    return result


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

    new_npc = {**npc}
    new_npc["_id"] = str(uuid.uuid4())
    new_npc["nombre"] = new_name
    new_npc["created_at"] = now_utc()
    new_npc["updated_at"] = now_utc()

    await db.npcs.insert_one(new_npc)

    result = {k: v for k, v in new_npc.items() if k != '_id'}
    result['id'] = new_npc['_id']
    return result
