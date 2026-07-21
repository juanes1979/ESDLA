#!/usr/bin/env python3
"""
EXPORTA (vuelca) TODAS las colecciones de contenido de la base de datos a
`data_seeds/full/*.json` usando Extended JSON de MongoDB (bson.json_util), que
conserva fielmente los _id (ObjectId o UUID), fechas y referencias cruzadas.

Esto sustituye a los seeds parciales: incluye virtudes (con su cultura real,
así se separan bien por subcultura), artes, recompensas, salarios, viajes,
bestiario (npcs), TODO el equipo, personajes, aventuras, PNJs, etc.

NO exporta (por seguridad / tamaño):
  - users, login_attempts        → cuentas y hashes (el Maestro se crea por env)
  - lotr_files.*                 → imágenes subidas (GridFS binario); para éstas
                                   usa `mongodump` (ver README).

Uso:
    cd backend && python export_full_db.py
"""
import asyncio
import os
from bson import json_util
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

OUT_DIR = os.path.join(os.path.dirname(__file__), "data_seeds", "full")

# Cadenas más largas que esto se consideran imágenes/blobs base64 incrustados
# y se omiten del volcado (retratos, mapas en base64, etc.) para no engordar
# el repositorio. Los datos "normales" (descripciones, etc.) nunca llegan a esto.
_MAX_STR_LEN = 20000


def _strip_big_blobs(value):
    """Recorre el documento y sustituye por None cualquier cadena enorme
    (base64 incrustado). Devuelve cuántas ha eliminado."""
    count = 0
    if isinstance(value, dict):
        for k, v in list(value.items()):
            if isinstance(v, str) and len(v) > _MAX_STR_LEN:
                value[k] = None
                count += 1
            else:
                count += _strip_big_blobs(v)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            if isinstance(v, str) and len(v) > _MAX_STR_LEN:
                value[i] = None
                count += 1
            else:
                count += _strip_big_blobs(v)
    return count


# Colecciones que NO se vuelcan al repositorio.
BLACKLIST = {
    "users",
    "login_attempts",
    "lotr_files.chunks",
    "lotr_files.files",
}


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    names = sorted(await db.list_collection_names())
    total_docs = 0
    exported = 0
    stripped = 0
    for col in names:
        if col in BLACKLIST:
            continue
        docs = await db[col].find({}).to_list(length=None)
        for d in docs:
            stripped += _strip_big_blobs(d)
        path = os.path.join(OUT_DIR, f"{col}.json")
        with open(path, "w", encoding="utf-8") as f:
            # json_util preserva ObjectId/fechas en Extended JSON.
            f.write(json_util.dumps(docs, ensure_ascii=False))
        total_docs += len(docs)
        exported += 1
        print(f"{col:40s} {len(docs)}")
    print(f"\n✅ {exported} colecciones, {total_docs} documentos → {OUT_DIR}")
    print(f"   ({stripped} imágenes base64 incrustadas omitidas para no engordar el repo)")


if __name__ == "__main__":
    asyncio.run(main())
