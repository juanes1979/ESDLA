"""
Migration: move clothing items (ropa) from `equipo_general` to a new
dedicated `ropa` category with a `posicion` attribute (cabeza / cuerpo /
piernas / brazos / pies).

Idempotent: if a 'ropa' category already exists in the catalog with entries,
the migration is a no-op.

Run manually:
    cd /app/backend && set -a && source .env && set +a && \
    python3 -m migrations.migrate_ropa_category
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


# Mapping: substring match → posicion
POSITION_RULES = [
    ("bota", "pies"),
    ("capucha", "cabeza"),
    ("capa", "cuerpo"),
    ("muda", "cuerpo"),
    ("túnica", "cuerpo"),
    ("tunica", "cuerpo"),
    ("vestido", "cuerpo"),
]


def infer_posicion(nombre: str) -> str:
    lower = (nombre or "").lower()
    for key, pos in POSITION_RULES:
        if key in lower:
            return pos
    return "cuerpo"


async def migrate():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        print("❌  No catalog found with _id='main'")
        return

    eg = catalog.get("equipo_general", []) or []
    existing_ropa = catalog.get("ropa", []) or []

    # Detect ropa items already in equipo_general
    ropa_targets = ["bota", "capa", "túnica", "tunica", "muda", "vestido", "capucha"]
    ropa_items = []
    remaining_eg = []
    for item in eg:
        nombre = (item.get("nombre") or "").lower()
        if any(t in nombre for t in ropa_targets):
            # Add posicion, copy fields
            new_item = dict(item)
            new_item["posicion"] = infer_posicion(item.get("nombre", ""))
            ropa_items.append(new_item)
        else:
            remaining_eg.append(item)

    if not ropa_items and existing_ropa:
        print(f"✅  Already migrated. 'ropa' has {len(existing_ropa)} items.")
        return

    # Deduplicate against existing_ropa by name
    existing_names = {(i.get("nombre") or "").lower() for i in existing_ropa}
    merged_ropa = list(existing_ropa)
    added = 0
    for item in ropa_items:
        n = (item.get("nombre") or "").lower()
        if n not in existing_names:
            merged_ropa.append(item)
            existing_names.add(n)
            added += 1

    # Persist
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {
            "ropa": merged_ropa,
            "equipo_general": remaining_eg,
        }}
    )
    print(f"✅  Migrated {added} items to 'ropa'. equipo_general now has {len(remaining_eg)} items.")

    # Also migrate existing characters' inventario: any item whose nombre
    # matches the 24 ropa items gets categoria='ropa' and posicion set.
    ropa_names = {(i.get("nombre") or "").lower() for i in merged_ropa}
    name_to_posicion = {(i.get("nombre") or "").lower(): i.get("posicion") for i in merged_ropa}
    updated_chars = 0
    async for char in db.characters.find({}):
        inv = char.get("inventario", []) or []
        changed = False
        for i, it in enumerate(inv):
            if not isinstance(it, dict):
                continue
            name_lower = (it.get("nombre") or "").lower()
            if name_lower in ropa_names:
                if it.get("categoria") != "ropa":
                    it["categoria"] = "ropa"
                    changed = True
                if not it.get("posicion"):
                    it["posicion"] = name_to_posicion.get(name_lower, "cuerpo")
                    changed = True
                if "activa" not in it:
                    it["activa"] = True
                    changed = True
        if changed:
            await db.characters.update_one(
                {"_id": char["_id"]},
                {"$set": {"inventario": inv}}
            )
            updated_chars += 1
    print(f"✅  Updated {updated_chars} character inventories with ropa metadata.")


if __name__ == "__main__":
    asyncio.run(migrate())
