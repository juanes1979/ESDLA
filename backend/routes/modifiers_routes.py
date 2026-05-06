"""
Price Modifiers routes — region/settlement/relationship/context multipliers
applied by the Compra-Venta system.

Extracted from `data_routes.py` (May 2026) to keep that monolithic file
manageable. Mounts under `/api/data` like the rest of the data routes so
public URLs are unchanged (e.g. `GET /api/data/modificadores-precio`).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException


router = APIRouter(prefix="/data", tags=["modifiers"])


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# Default price modifiers data ------------------------------------------------
DEFAULT_PRICE_MODIFIERS = {
    "region": [
        {"nombre": "Eriador", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Rivendell (Imladris)", "modificador": 0.9, "descripcion": "-10% (artesanía élfica)"},
        {"nombre": "Rohan", "modificador": 0.95, "descripcion": "-5% (caballos y cuero más baratos)"},
        {"nombre": "Gondor", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Minas Tirith", "modificador": 1.1, "descripcion": "+10% (ciudad capital)"},
        {"nombre": "Dol Amroth", "modificador": 1.05, "descripcion": "+5% (puerto importante)"},
        {"nombre": "Bosque Negro", "modificador": 1.15, "descripcion": "+15% (peligroso, escasez)"},
        {"nombre": "Erebor", "modificador": 0.85, "descripcion": "-15% (productos enanos)"},
        {"nombre": "Valle (Dale)", "modificador": 0.95, "descripcion": "-5% (comercio enano)"},
        {"nombre": "Esgaroth (Ciudad del Lago)", "modificador": 1.0, "descripcion": "Precio base (comercio)"},
        {"nombre": "Comarca", "modificador": 0.9, "descripcion": "-10% (vida sencilla)"},
        {"nombre": "Bree", "modificador": 1.0, "descripcion": "Precio base (cruce de caminos)"},
        {"nombre": "Tierras Salvajes", "modificador": 1.25, "descripcion": "+25% (difícil acceso)"},
        {"nombre": "Mordor/Harad/Rhûn", "modificador": 1.5, "descripcion": "+50% (territorio enemigo)"},
    ],
    "asentamiento": [
        {"nombre": "Aldea pequeña", "modificador": 1.15, "descripcion": "+15% (escasez)"},
        {"nombre": "Aldea", "modificador": 1.1, "descripcion": "+10% (selección limitada)"},
        {"nombre": "Pueblo", "modificador": 1.05, "descripcion": "+5% (comercio modesto)"},
        {"nombre": "Villa", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Ciudad pequeña", "modificador": 0.95, "descripcion": "-5% (competencia)"},
        {"nombre": "Ciudad", "modificador": 0.9, "descripcion": "-10% (gran mercado)"},
        {"nombre": "Capital", "modificador": 0.85, "descripcion": "-15% (máxima competencia)"},
        {"nombre": "Fortaleza/Castillo", "modificador": 1.2, "descripcion": "+20% (suministros militares)"},
        {"nombre": "Puerto", "modificador": 0.9, "descripcion": "-10% (bienes importados)"},
        {"nombre": "Caravana/Nómada", "modificador": 1.3, "descripcion": "+30% (conveniencia)"},
    ],
    "relacion": [
        {"nombre": "Desconocido", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Conocido", "modificador": 0.95, "descripcion": "-5% (familiaridad)"},
        {"nombre": "Amigo", "modificador": 0.85, "descripcion": "-15% (amistad)"},
        {"nombre": "Aliado/Compañero", "modificador": 0.75, "descripcion": "-25% (lealtad)"},
        {"nombre": "Mecenas/Protector", "modificador": 0.5, "descripcion": "-50% (patronazgo)"},
        {"nombre": "Rival/Enemigo conocido", "modificador": 1.25, "descripcion": "+25% (hostilidad)"},
        {"nombre": "Enemigo declarado", "modificador": 1.5, "descripcion": "+50% (rechazo)"},
        {"nombre": "Proscritos/Exiliados", "modificador": 2.0, "descripcion": "+100% (mercado negro)"},
    ],
    "contexto": [
        {"nombre": "Tiempos de paz", "modificador": 1.0, "descripcion": "Precio base"},
        {"nombre": "Rumores de guerra", "modificador": 1.1, "descripcion": "+10% (acaparamiento)"},
        {"nombre": "Guerra cercana", "modificador": 1.25, "descripcion": "+25% (escasez)"},
        {"nombre": "Guerra activa", "modificador": 1.5, "descripcion": "+50% (prioridad militar)"},
        {"nombre": "Post-batalla", "modificador": 0.8, "descripcion": "-20% (botín, reconstrucción)"},
        {"nombre": "Hambruna/Sequía", "modificador": 1.75, "descripcion": "+75% (desesperación)"},
        {"nombre": "Festival/Celebración", "modificador": 0.9, "descripcion": "-10% (generosidad)"},
        {"nombre": "Invierno duro", "modificador": 1.2, "descripcion": "+20% (dificultad transporte)"},
    ],
}

VALID_CATEGORIES = {"region", "asentamiento", "relacion", "contexto"}


def _db():
    from server import db
    return db


@router.get("/modificadores-precio")
async def get_price_modifiers():
    """Get all price modifiers (region, settlement, relationship, context)."""
    db = _db()
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        return DEFAULT_PRICE_MODIFIERS
    return {
        "region": modifiers.get("region", DEFAULT_PRICE_MODIFIERS["region"]),
        "asentamiento": modifiers.get("asentamiento", DEFAULT_PRICE_MODIFIERS["asentamiento"]),
        "relacion": modifiers.get("relacion", DEFAULT_PRICE_MODIFIERS["relacion"]),
        "contexto": modifiers.get("contexto", DEFAULT_PRICE_MODIFIERS["contexto"]),
    }


@router.post("/modificadores-precio/init")
async def init_price_modifiers():
    """Initialize default price modifiers in database (idempotent)."""
    db = _db()
    existing = await db.price_modifiers.find_one({"_id": "main"})
    if existing:
        return {"message": "Modifiers already exist", "action": "none"}
    await db.price_modifiers.insert_one({
        "_id": "main",
        **DEFAULT_PRICE_MODIFIERS,
        "created_at": now_utc(),
    })
    return {"message": "Default price modifiers initialized"}


@router.put("/modificadores-precio/{category}/{index}")
async def update_price_modifier(category: str, index: int, data: dict = Body(...)):
    """Update a single modifier by category + index."""
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    db = _db()
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        modifiers = {"_id": "main", **DEFAULT_PRICE_MODIFIERS}
        await db.price_modifiers.insert_one(modifiers)
    category_list = modifiers.get(category, [])
    if index < 0 or index >= len(category_list):
        raise HTTPException(status_code=400, detail="Invalid index")
    category_list[index] = {
        "nombre": data.get("nombre", category_list[index]["nombre"]),
        "modificador": data.get("modificador", category_list[index]["modificador"]),
        "descripcion": data.get("descripcion", category_list[index]["descripcion"]),
    }
    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$set": {category: category_list, "updated_at": now_utc()}},
    )
    return {"message": "Modifier updated"}


@router.put("/modificadores-precio/{category}")
async def replace_price_modifier_category(category: str, data: dict = Body(...)):
    """
    Replace the full list for a price modifier category.

    Body: {"items": [{"nombre": str, "modificador": float, "descripcion": str?}]}

    Used by the Compra-Venta config tab to bulk-save the per-region %.
    """
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")

    items = data.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="`items` debe ser una lista")

    cleaned = []
    seen = set()
    for it in items:
        nombre = (it.get("nombre") or "").strip()
        if not nombre:
            continue
        key = nombre.lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            modificador = float(it.get("modificador", 1.0))
        except (TypeError, ValueError):
            modificador = 1.0
        cleaned.append({
            "nombre": nombre,
            "modificador": modificador,
            "descripcion": (it.get("descripcion") or "").strip(),
        })

    db = _db()
    existing = await db.price_modifiers.find_one({"_id": "main"})
    if not existing:
        await db.price_modifiers.insert_one({"_id": "main", **DEFAULT_PRICE_MODIFIERS})

    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$set": {category: cleaned, "updated_at": now_utc()}},
    )
    return {"message": f"Modifier list `{category}` replaced", "count": len(cleaned)}


@router.post("/modificadores-precio/{category}")
async def add_price_modifier(category: str, data: dict = Body(...)):
    """Append a new modifier to a category."""
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    db = _db()
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        modifiers = {"_id": "main", **DEFAULT_PRICE_MODIFIERS}
        await db.price_modifiers.insert_one(modifiers)
    new_modifier = {
        "nombre": data.get("nombre", "Nuevo"),
        "modificador": data.get("modificador", 1.0),
        "descripcion": data.get("descripcion", ""),
    }
    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$push": {category: new_modifier}, "$set": {"updated_at": now_utc()}},
    )
    return {"message": "Modifier added"}


@router.delete("/modificadores-precio/{category}/{index}")
async def delete_price_modifier(category: str, index: int):
    """Delete a single modifier by category + index."""
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    db = _db()
    modifiers = await db.price_modifiers.find_one({"_id": "main"})
    if not modifiers:
        raise HTTPException(status_code=404, detail="Modifiers not found")
    category_list = modifiers.get(category, [])
    if index < 0 or index >= len(category_list):
        raise HTTPException(status_code=400, detail="Invalid index")
    category_list.pop(index)
    await db.price_modifiers.update_one(
        {"_id": "main"},
        {"$set": {category: category_list, "updated_at": now_utc()}},
    )
    return {"message": "Modifier deleted"}
