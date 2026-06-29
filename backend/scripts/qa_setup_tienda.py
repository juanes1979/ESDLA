"""QA temporal: coloca a un personaje en una ubicación con un PNJ comerciante
presente para poder probar el desplegable de la Tienda D100. Reversible con --undo."""
import asyncio, os, sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

CHAR_ID = "0b1662e4-6366-4e69-8bc2-f7e5b8671a43"  # Nimhir Belegorn
LOC = {"id": "qa-loc-1", "nombre": "Posada QA", "region": None}
NPC_ID = "qa-npc-tienda"


async def main(undo: bool):
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    if undo:
        await db.characters.update_one({"_id": CHAR_ID}, {"$unset": {"ubicacion_actual": ""}})
        await db.trading_npcs.delete_one({"_id": NPC_ID})
        print("Escenario QA eliminado.")
        return
    await db.characters.update_one({"_id": CHAR_ID}, {"$set": {"ubicacion_actual": LOC}})
    npc = {
        "_id": NPC_ID, "nombre": "Mercader QA", "profesion": "",
        "ubicacion_id": LOC["id"], "ubicacion": LOC["nombre"],
        "raza": "Humano", "subcultura": "", "actitud": "neutral",
        "relacion_base": 0, "rasgos": [],
    }
    await db.trading_npcs.update_one({"_id": NPC_ID}, {"$set": npc}, upsert=True)
    # dinero suficiente en varias monedas para probar compra
    await db.characters.update_one({"_id": CHAR_ID}, {"$set": {"dinero": {"mo": 5, "mp": 50, "mc": 200, "me": 500}}})
    print("Escenario QA listo: Nimhir en 'Posada QA' con 'Mercader QA'.")


if __name__ == "__main__":
    asyncio.run(main("--undo" in sys.argv))
