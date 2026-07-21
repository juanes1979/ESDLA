#!/usr/bin/env python3
"""
Carga las UBICACIONES del mapa (y sus datos asociados) en la base de datos.

Estas colecciones NO se incluyen en los seeds de reglas y, además, sus
coordenadas están ya calibradas respecto al mapa, por eso se distribuyen como
un volcado JSON en `data_seeds/` en lugar de recalcularlas.

Colecciones que carga:
  - locations                    (ubicaciones del mapa)
  - regions                      (regiones)
  - region_nodes                 (nodos/jerarquía de regiones)
  - campaign_maps                (mapas de campaña)
  - climate_regions              (regiones climáticas)
  - climate_location_overrides   (ajustes de clima por ubicación)

Uso:
    cd backend && python seed_map_data.py

Es idempotente: vacía cada colección y la vuelve a llenar con el volcado.
Requiere que backend/.env tenga MONGO_URL y DB_NAME.
"""
import asyncio
import json
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SEED_DIR = os.path.join(os.path.dirname(__file__), "data_seeds")
COLLECTIONS = [
    "locations",
    "regions",
    "region_nodes",
    "campaign_maps",
    "climate_regions",
    "climate_location_overrides",
]


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    db = AsyncIOMotorClient(mongo_url)[db_name]

    total = 0
    for col in COLLECTIONS:
        path = os.path.join(SEED_DIR, f"{col}.json")
        if not os.path.exists(path):
            print(f"[AVISO] No se encontró {path}, se omite {col}.")
            continue
        with open(path, "r", encoding="utf-8") as f:
            docs = json.load(f)
        # Reemplaza el contenido de la colección por el volcado.
        await db[col].delete_many({})
        if docs:
            await db[col].insert_many(docs)
        print(f"{col}: {len(docs)} documentos cargados.")
        total += len(docs)

    print(f"\n✅ Datos del mapa cargados: {total} documentos en total.")


if __name__ == "__main__":
    asyncio.run(main())
