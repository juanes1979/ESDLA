"""
Migration: consolidate all character mounts under `character.monturas` (list).

Previously each character could have ONE mount at `character.montura` (dict).
Mounts could also appear as items in `inventario` (by name). This migration:

  1. Builds a unified `character.monturas: [{ id, nombre, nombre_personalizado,
     especie, capacidad_carga, velocidad, constitucion, portado_por (n/a),
     equipo: [] }]` from `character.montura` + any inventario item whose name
     matches a mount keyword.
  2. Removes duplicated mounts from inventario (they should no longer live
     both as inventory items AND as mounts).
  3. Keeps `character.montura` as a MIRROR of monturas[0] for backward compat
     with existing code (temporary; we'll phase it out when UI is fully
     updated).

Idempotent.

Run:
    cd /app/backend && set -a && source .env && set +a && \
    python3 -m migrations.migrate_multi_mount
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


MOUNT_KEYWORDS = ['caballo', 'pony', 'poni', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']


def is_mount_name(nombre: str) -> bool:
    n = (nombre or '').lower()
    return any(k in n for k in MOUNT_KEYWORDS)


async def migrate():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Resolve catalog for default capacity/velocity
    catalog = await db.equipment_catalog.find_one({"_id": "main"}) or {}
    monturas_cat = catalog.get("monturas", []) or []

    def catalog_lookup(nombre):
        n = (nombre or '').lower().strip()
        for m in monturas_cat:
            if (m.get("nombre") or "").lower().strip() == n:
                return m
        # Looser fuzzy match
        for m in monturas_cat:
            cn = (m.get("nombre") or "").lower()
            if cn and (cn in n or n in cn):
                return m
        return {}

    updated_chars = 0
    async for char in db.characters.find({}):
        monturas_existing = char.get("monturas") or []
        # Already migrated? Skip ONLY if already a non-empty list AND no
        # legacy mounts remain in inventario/character.montura.
        legacy_mount_obj = char.get("montura") or {}
        has_legacy_mount = bool(isinstance(legacy_mount_obj, dict) and legacy_mount_obj.get("nombre"))
        inv = char.get("inventario") or []
        inv_mounts = [it for it in inv if isinstance(it, dict) and is_mount_name(it.get("nombre", ""))]

        monturas = list(monturas_existing)

        # Track seen mount names to dedupe
        seen = {(m.get("nombre_original") or m.get("nombre") or "").lower() for m in monturas if isinstance(m, dict)}

        # Pull from character.montura (legacy)
        if has_legacy_mount:
            nombre = legacy_mount_obj.get("nombre")
            key = (nombre or "").lower()
            if key not in seen:
                cat = catalog_lookup(nombre)
                monturas.append({
                    "id": str(uuid.uuid4()),
                    "nombre_original": nombre,
                    "nombre_personalizado": legacy_mount_obj.get("nombre_personalizado") or nombre,
                    "especie": nombre,
                    "capacidad_carga": legacy_mount_obj.get("capacidad_carga") or cat.get("capacidad_carga") or 150,
                    "velocidad": legacy_mount_obj.get("velocidad") or cat.get("velocidad") or 12,
                    "constitucion": legacy_mount_obj.get("constitucion") or cat.get("constitucion") or "",
                    "equipo": legacy_mount_obj.get("equipo") or [],
                    "es_jinete_activo": True,
                })
                seen.add(key)

        # Pull from inventory
        new_inv = []
        for it in inv:
            if isinstance(it, dict) and is_mount_name(it.get("nombre", "")):
                nombre = it.get("nombre")
                key = (nombre or "").lower()
                if key in seen:
                    # already tracked; skip from inventory
                    continue
                cat = catalog_lookup(nombre)
                monturas.append({
                    "id": str(uuid.uuid4()),
                    "nombre_original": nombre,
                    "nombre_personalizado": it.get("nombre_personalizado") or nombre,
                    "especie": nombre,
                    "capacidad_carga": it.get("capacidad_carga") or it.get("capacidad_carga_kg") or cat.get("capacidad_carga") or 150,
                    "velocidad": cat.get("velocidad") or 12,
                    "constitucion": cat.get("constitucion") or "",
                    "equipo": [],
                    "es_jinete_activo": False,
                })
                seen.add(key)
                # Do NOT keep the inventory duplicate
                continue
            new_inv.append(it)

        if not monturas:
            # Nothing to migrate for this char
            continue

        # Ensure exactly one "es_jinete_activo" if character.montado=true
        if char.get("montado") and not any(m.get("es_jinete_activo") for m in monturas):
            monturas[0]["es_jinete_activo"] = True

        update = {
            "monturas": monturas,
            "inventario": new_inv,
        }
        # Keep legacy `montura` as mirror of monturas[0] (for backward compat)
        primary = monturas[0]
        update["montura"] = {
            "nombre": primary.get("nombre_original"),
            "nombre_personalizado": primary.get("nombre_personalizado"),
            "capacidad_carga": primary.get("capacidad_carga"),
            "velocidad": primary.get("velocidad"),
            "constitucion": primary.get("constitucion"),
            "equipo": primary.get("equipo", []),
        }

        await db.characters.update_one({"_id": char["_id"]}, {"$set": update})
        updated_chars += 1

    print(f"✅  Migrated {updated_chars} character(s) to multi-mount schema.")


if __name__ == "__main__":
    asyncio.run(migrate())
