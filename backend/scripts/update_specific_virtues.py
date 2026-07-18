"""
Actualiza las virtudes específicas pedidas por el usuario y crea PERFECCIONAMIENTO.
- FIRMEZA: +1 PG por nivel del jugador (flag pg_por_nivel).
- MAESTRÍA: otorga Pericia (doble competencia) en una habilidad/herramienta existente.
- MANO IMPERTURBABLE: +1 al daño de armas de FUERZA (flag bonus_dano_fuerza).
- PERFECCIONAMIENTO (NUEVA, común): +2 a una característica o +1 a dos (máx 20).
"""
import asyncio, os, uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    now = datetime.now(timezone.utc).isoformat()

    # FIRMEZA — +1 PG por nivel
    await db.virtues.update_one(
        {"nombre": "Firmeza"},
        {"$set": {
            "pg_por_nivel": True,
            "bonus_puntos_golpe": 1,
            "rasgos": "Tus Puntos de Golpe máximos aumentan en 1 por cada nivel del personaje.",
            "updated_at": now,
        }},
    )

    # MAESTRÍA — otorga pericia en una habilidad/herramienta existente
    await db.virtues.update_one(
        {"nombre": {"$in": ["Maestría", "Maestria"]}},
        {"$set": {
            "otorga_pericia": True,
            "rasgos": "Elige una habilidad o herramienta que ya domines: obtienes Pericia en ella "
                      "(duplicas tu bonificador por competencia). Márcala con una \"P\" en la ficha.",
            "updated_at": now,
        }},
    )

    # MANO IMPERTURBABLE — +1 daño armas de Fuerza
    await db.virtues.update_one(
        {"nombre": "Mano Imperturbable"},
        {"$set": {
            "bonus_dano_fuerza": 1,
            "aumenta_fuerza": True,
            "rasgos": "Añades +1 a las tiradas de daño de las armas que usen Fuerza.",
            "updated_at": now,
        }},
    )

    # PERFECCIONAMIENTO — nueva virtud común
    existing = await db.virtues.find_one({"nombre": "Perfeccionamiento"})
    doc = {
        "nombre": "Perfeccionamiento",
        "cultura": None,
        "es_comun": True,
        "descripcion": "Tu entrenamiento constante ha perfeccionado tus capacidades naturales.",
        "rasgos": "Aumenta en 2 una característica, o en 1 dos características diferentes "
                  "(hasta un máximo de 20 en cada una).",
        "perfeccionamiento": True,
        "aumenta_fuerza": False, "aumenta_destreza": False, "aumenta_constitucion": False,
        "aumenta_inteligencia": False, "aumenta_sabiduria": False, "aumenta_carisma": False,
        "elegir_caracteristica": None, "elegir_salvacion": None,
        "bonus_puntos_golpe": None, "bonus_comunidad": None, "bonus_ca": None,
        "elegir_habilidad": None, "elegir_herramienta": None,
        "updated_at": now,
    }
    if existing:
        await db.virtues.update_one({"_id": existing["_id"]}, {"$set": doc})
        print("PERFECCIONAMIENTO actualizada")
    else:
        doc["_id"] = str(uuid.uuid4())
        doc["created_at"] = now
        await db.virtues.insert_one(doc)
        print("PERFECCIONAMIENTO creada")

    # Verificación
    for name in ["Firmeza", "Maestría", "Mano Imperturbable", "Perfeccionamiento"]:
        v = await db.virtues.find_one({"nombre": name})
        print(name, "→", {k: v.get(k) for k in ("pg_por_nivel", "otorga_pericia", "bonus_dano_fuerza", "perfeccionamiento") if v.get(k)})


if __name__ == "__main__":
    asyncio.run(main())
