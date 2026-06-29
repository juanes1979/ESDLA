"""One-off: registra 'ropa' como grupo personalizado individual (raíz)."""
import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or {"_id": "main"}
    custom = list(catalog.get("_custom_categories", []) or [])
    if any(c.get("key") == "ropa" for c in custom):
        print("Ropa ya estaba registrada como grupo.")
        return
    custom.append({
        "key": "ropa",
        "name": "Ropa",
        "fields": ["nombre", "precio", "posicion", "comentarios", "peso_kg"],
        "section": "__root__",
        "icono": "🧵",
    })
    await db.equipment_catalog.update_one(
        {"_id": "main"},
        {"$set": {"_custom_categories": custom, "ropa": catalog.get("ropa", [])}},
        upsert=True,
    )
    n = len(catalog.get("ropa", []) or [])
    print(f"Grupo 'Ropa' registrado. Prendas existentes: {n}")


if __name__ == "__main__":
    asyncio.run(main())
