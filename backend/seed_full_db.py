#!/usr/bin/env python3
"""
IMPORTA (restaura) TODO el contenido volcado por `export_full_db.py` desde
`data_seeds/full/*.json` a la base de datos configurada en backend/.env.

Conserva _id/fechas/referencias (Extended JSON de MongoDB). Es idempotente:
vacía cada colección y la vuelve a llenar con el volcado.

Uso:
    cd backend && python seed_full_db.py

Opcional: para cargar SOLO algunas colecciones:
    python seed_full_db.py virtues arts recompensas

Nota: NO toca `users` (las cuentas se gestionan aparte; el Maestro se crea al
arrancar el backend con MAESTRO_EMAIL / MAESTRO_PASSWORD).
"""
import asyncio
import glob
import os
import sys
from bson import json_util
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SEED_DIR = os.path.join(os.path.dirname(__file__), "data_seeds", "full")


async def main():
    if not os.path.isdir(SEED_DIR):
        print(f"[ERROR] No existe {SEED_DIR}. ¿Has hecho 'git pull' tras 'Save to Github'?")
        return

    only = set(sys.argv[1:])  # colecciones concretas si se pasan por CLI
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    files = sorted(glob.glob(os.path.join(SEED_DIR, "*.json")))
    if not files:
        print(f"[ERROR] No hay ficheros .json en {SEED_DIR}.")
        return

    total = 0
    loaded_cols = 0
    for path in files:
        col = os.path.splitext(os.path.basename(path))[0]
        if only and col not in only:
            continue
        with open(path, "r", encoding="utf-8") as f:
            docs = json_util.loads(f.read())
        await db[col].delete_many({})
        if docs:
            await db[col].insert_many(docs)
        total += len(docs)
        loaded_cols += 1
        print(f"{col:40s} {len(docs)}")

    print(f"\n✅ {loaded_cols} colecciones, {total} documentos importados.")
    print("Reinicia el backend si estaba en marcha y recarga la app.")


if __name__ == "__main__":
    asyncio.run(main())
