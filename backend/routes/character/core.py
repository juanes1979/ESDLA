"""
Character CRUD + HP/fatigue/XP/rests/codigo público + ubicación endpoints.
Extracted from character_routes.py during the iter95 refactor.
"""
from fastapi import HTTPException, Body, Query, Depends
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone
import random
import uuid
from ._common import (
    router, db, generate_id, now_utc, serialize_doc, serialize_docs,
    generate_codigo_publico,
    UbicacionUpdateRequest,
    _owner_filter, _ensure_owner,
)
from auth import get_current_user


# === CHARACTER MANAGEMENT ENDPOINTS ===

@router.get("/")
async def list_characters(
    jugador: Optional[str] = None,
    campaign_id: Optional[str] = None,
    include_all: bool = False,
    user: dict = Depends(get_current_user),
):
    """List characters owned by the current user (Maestro sees all)."""
    if include_all:
        query = {"estado": {"$ne": "eliminado"}}
    else:
        query = {"$or": [{"estado": "activo"}, {"estado": {"$exists": False}}]}

    if jugador:
        query["jugador"] = jugador
    if campaign_id:
        query["campaign_id"] = campaign_id

    # Filtro de propietario (vacío para Maestro).
    query.update(_owner_filter(user))

    characters = await db.characters.find(query).to_list(100)
    return {"characters": serialize_docs(characters)}


@router.get("/{character_id}")
async def get_character(character_id: str, user: dict = Depends(get_current_user)):
    """Get a specific character by ID (only owner or Maestro)."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    _ensure_owner(character, user, "personaje")
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
async def update_character_fatigue(
    character_id: str,
    fatiga: float = Body(..., embed=True, ge=0.0, le=6.0),
):
    """Update character's fatigue level directly (supports decimals like 0.5 for sentinel rule).
    Fatigue is bounded 0.0-6.0; Pydantic rejects out-of-range values at the API boundary."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Fatigue supports 0.5 increments; clamp to valid range defensively too.
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
        # Bloqueo del retrato: una vez `portrait_locked=true`, la UI
        # impide regenerar/cambiar el retrato. Se establece desde el
        # botón "Guardar imagen" tras una generación con IA.
        'portrait_locked',
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




# ---------------------------------------------------------------------------
# Ubicación del personaje
# ---------------------------------------------------------------------------

@router.patch("/{character_id}/ubicacion")
async def update_character_ubicacion(character_id: str, data: UbicacionUpdateRequest):
    """Set the character's current location.

    If the character has been assigned to a campaign (`campaign_id` is set),
    this endpoint refuses to change the location unless `force=True` is
    provided (intended for the campaign DJ once RBAC is wired up).

    The location's `id`, `nombre`, `region`, `tipo`, `x`, `y` and
    `tipo_tierra` are denormalised onto `character.ubicacion_actual` so the
    frontend can render the "you are here" widget without an extra round-trip.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    if character.get("campaign_id") and not data.force:
        raise HTTPException(
            status_code=403,
            detail=(
                "El personaje está asignado a una campaña; "
                "sólo el Director de Juego puede mover su ubicación."
            ),
        )

    # Resolve the target location
    loc = await db.locations.find_one({"id": data.location_id}) or \
          await db.locations.find_one({"_id": data.location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")

    ubicacion = {
        "id": loc.get("id") or loc.get("_id"),
        "nombre": loc.get("nombre"),
        "region": loc.get("region"),
        "tipo": loc.get("tipo"),
        "x": loc.get("x"),
        "y": loc.get("y"),
        "tipo_tierra": loc.get("tipo_tierra") or loc.get("clase_region"),
        "terreno": loc.get("terreno"),
    }

    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"ubicacion_actual": ubicacion, "updated_at": now_utc()}},
    )
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated), "ubicacion": ubicacion}
