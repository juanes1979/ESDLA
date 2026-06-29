"""Migración:
 1. Marca como 'ropa_complementaria' las capas del catálogo (capa…).
 2. Enriquece el equipo de TODOS los personajes (categoria/peso_kg/posicion/
    ropa_complementaria) desde el catálogo y auto-equipa la ropa.
"""
import asyncio, os, sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(Path(__file__).parent.parent / ".env")
from utils.equipment_enrich import build_catalog_index, enrich_items, auto_equip_ropa, _norm  # noqa


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    # 1) Capas → complementarias
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    ropa = catalog.get("ropa", []) or []
    n_caps = 0
    for it in ropa:
        if isinstance(it, dict) and _norm(it.get("nombre")).startswith("capa"):
            if it.get("ropa_complementaria") is not True:
                it["ropa_complementaria"] = True
                n_caps += 1
    await db.equipment_catalog.update_one({"_id": "main"}, {"$set": {"ropa": ropa}})
    print(f"Capas marcadas como complementarias: {n_caps}")

    # 2) Enriquecer + auto-equipar personajes
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    index = build_catalog_index(catalog)
    n_chars = 0
    async for c in db.characters.find({}):
        changed = False
        for key in ("inventario", "equipo_trasfondo", "equipo_ocupacion", "equipo"):
            if enrich_items(c.get(key), index):
                changed = True
        before = _snapshot_active(c)
        auto_equip_ropa(c.get("inventario"))
        auto_equip_ropa(c.get("equipo_trasfondo"))
        if before != _snapshot_active(c):
            changed = True
        if changed:
            await db.characters.update_one(
                {"_id": c["_id"]},
                {"$set": {k: c.get(k) for k in ("inventario", "equipo_trasfondo", "equipo_ocupacion", "equipo") if c.get(k) is not None}},
            )
            n_chars += 1
    print(f"Personajes actualizados: {n_chars}")


def _snapshot_active(c):
    out = []
    for key in ("inventario", "equipo_trasfondo"):
        for it in (c.get(key) or []):
            if isinstance(it, dict):
                out.append((it.get("nombre"), it.get("activa"), it.get("peso_kg")))
    return out


if __name__ == "__main__":
    asyncio.run(main())
