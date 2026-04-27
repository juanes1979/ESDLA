"""
Admin Routes — Backup / Restore.

Provides two endpoints protected by a shared token (`ADMIN_BACKUP_TOKEN`
from the backend .env), to be used by a future admin panel:

  GET  /api/admin/backup       → returns full database snapshot as JSON
  POST /api/admin/restore      → restores a snapshot (replace or merge)

Until the role-based auth system lands, the token is the only protection.
The header used is `X-Admin-Token`.
"""
from fastapi import APIRouter, HTTPException, Body, Header
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import os
import json

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/admin", tags=["Admin"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def _check_admin_token(token: Optional[str]) -> None:
    expected = os.environ.get('ADMIN_BACKUP_TOKEN')
    if not expected:
        raise HTTPException(
            status_code=500,
            detail="ADMIN_BACKUP_TOKEN no configurado en el servidor."
        )
    if not token or token != expected:
        raise HTTPException(status_code=401, detail="Token de admin inválido.")


# Collections excluded from backup (transient or auto-managed).
EXCLUDED_COLLECTIONS = {
    # System / connection
    'system.indexes',
}


def _sanitize_value(v):
    """Recursively replace ObjectId/datetime so the snapshot is JSON-safe."""
    from bson import ObjectId
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, list):
        return [_sanitize_value(x) for x in v]
    if isinstance(v, dict):
        return {k: _sanitize_value(x) for k, x in v.items()}
    return v


def _serialize_doc(doc: dict) -> dict:
    """Strip Mongo `_id` ObjectId from a doc, keeping a string id field, and
    recursively sanitize nested ObjectId/datetime so the result is JSON-safe."""
    if not doc:
        return doc
    out = {}
    for k, v in doc.items():
        out[k] = _sanitize_value(v)
    return out


@router.get("/backup")
async def admin_backup(x_admin_token: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Return a full snapshot of every collection in the database."""
    _check_admin_token(x_admin_token)

    collection_names = await db.list_collection_names()
    snapshot: Dict[str, List[dict]] = {}
    counts: Dict[str, int] = {}

    for name in collection_names:
        if name in EXCLUDED_COLLECTIONS:
            continue
        cursor = db[name].find({})
        docs = []
        async for doc in cursor:
            docs.append(_serialize_doc(doc))
        snapshot[name] = docs
        counts[name] = len(docs)

    payload = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "db_name": os.environ['DB_NAME'],
        "collections": snapshot,
        "counts": counts,
    }
    return payload


@router.post("/restore")
async def admin_restore(
    payload: Dict[str, Any] = Body(...),
    mode: str = "replace",
    x_admin_token: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Restore a backup snapshot.

    Body is the same shape returned by `/admin/backup`.
    `mode` can be `replace` (clears each collection before insert) or
    `merge` (upserts by `_id`, keeping existing docs that aren't in the snapshot).
    """
    _check_admin_token(x_admin_token)

    if mode not in {"replace", "merge"}:
        raise HTTPException(status_code=400, detail="mode must be 'replace' or 'merge'")

    collections = payload.get("collections")
    if not isinstance(collections, dict):
        raise HTTPException(status_code=400, detail="payload.collections faltante o inválido.")

    summary: Dict[str, Dict[str, int]] = {}

    for name, docs in collections.items():
        if name in EXCLUDED_COLLECTIONS:
            continue
        if not isinstance(docs, list):
            continue

        col = db[name]
        before = await col.count_documents({})

        if mode == "replace":
            await col.delete_many({})

        if docs:
            # Use bulk upsert by _id to be safe with merge mode and idempotent.
            inserted = 0
            updated = 0
            for d in docs:
                if not isinstance(d, dict):
                    continue
                _id = d.get('_id')
                if _id is None:
                    # No id: simple insert
                    await col.insert_one(d)
                    inserted += 1
                    continue
                # Upsert
                res = await col.update_one(
                    {"_id": _id},
                    {"$set": {k: v for k, v in d.items() if k != '_id'}},
                    upsert=True,
                )
                if res.upserted_id is not None:
                    inserted += 1
                else:
                    updated += res.modified_count
            after = await col.count_documents({})
            summary[name] = {
                "before": before,
                "after": after,
                "inserted": inserted,
                "updated": updated,
            }
        else:
            after = await col.count_documents({})
            summary[name] = {
                "before": before,
                "after": after,
                "inserted": 0,
                "updated": 0,
            }

    return {
        "success": True,
        "mode": mode,
        "summary": summary,
        "restored_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/verify-token")
async def admin_verify_token(x_admin_token: Optional[str] = Header(None)) -> Dict[str, bool]:
    """Lightweight endpoint for the admin panel to verify the token before
    enabling destructive UI."""
    _check_admin_token(x_admin_token)
    return {"valid": True}
