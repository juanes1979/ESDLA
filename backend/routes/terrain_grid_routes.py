"""
Terrain Grid Routes (Iter 119) — Raster-based terrain system.

Replaces the previous polygon-based editor with a grid of cells, one byte
per cell, for both difficulty and land-type layers. Stored compressed in
MongoDB and queried in O(1) per coordinate by the pathfinding code.

Default resolution: 2000 × 1536 cells (≈ 10 px on the real 19791×15133 map).
Each cell carries an ID (0 = empty):

  Difficulty   1=facil  2=moderado 3=dificil 4=muy_dificil
               5=desalentador 6=infranqueable 7=agua

  Land type    1=libres 2=fronterizas 3=salvajes 4=sombra 5=tierras_oscuras

Persistence: zlib-compressed `uint8` bytes, base64-encoded as a string field
of the single document `_id = "main"` in `terrain_grids`.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Header, Form
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
from pydantic import BaseModel

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/terrain-grid", tags=["Terrain Grid"])

# ── Mongo ────────────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ── Constants ────────────────────────────────────────────────────────────────
DEFAULT_WIDTH = 2000
DEFAULT_HEIGHT = 1536
GRID_DOC_ID = "main"

DIFFICULTY_IDS: Dict[str, int] = {
    "facil": 1,
    "moderado": 2,
    "dificil": 3,
    "muy_dificil": 4,
    "desalentador": 5,
    "infranqueable": 6,
    "agua": 7,
}
DIFFICULTY_NAMES: Dict[int, str] = {v: k for k, v in DIFFICULTY_IDS.items()}

LAND_TYPE_IDS: Dict[str, int] = {
    "libres": 1,
    "fronterizas": 2,
    "salvajes": 3,
    "sombra": 4,
    "tierras_oscuras": 5,
}
LAND_TYPE_NAMES: Dict[int, str] = {v: k for k, v in LAND_TYPE_IDS.items()}

# PNG palettes — RGB tuple per cell ID. Index 0 = transparent / empty.
DIFFICULTY_PALETTE: List[tuple] = [
    (0, 0, 0),          # 0 empty
    (134, 239, 172),    # 1 facil — green-300
    (250, 204, 21),     # 2 moderado — yellow-400
    (251, 146, 60),     # 3 dificil — orange-400
    (239, 68, 68),      # 4 muy_dificil — red-500
    (147, 51, 234),     # 5 desalentador — purple-600
    (30, 30, 30),       # 6 infranqueable — near-black
    (59, 130, 246),     # 7 agua — blue-500
]
LAND_TYPE_PALETTE: List[tuple] = [
    (0, 0, 0),          # 0 empty
    (163, 230, 53),     # 1 libres — lime
    (217, 119, 6),      # 2 fronterizas — amber
    (132, 204, 22),     # 3 salvajes — green
    (109, 40, 217),     # 4 sombra — violet
    (24, 24, 27),       # 5 tierras_oscuras — zinc-900
]

# ── Helpers ──────────────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _encode_grid(arr: np.ndarray) -> str:
    """zlib + base64 of a uint8 numpy array."""
    assert arr.dtype == np.uint8
    raw = arr.tobytes()
    return base64.b64encode(zlib.compress(raw, level=6)).decode("ascii")


def _decode_grid(b64: str, w: int, h: int) -> np.ndarray:
    if not b64:
        return np.zeros((h, w), dtype=np.uint8)
    raw = zlib.decompress(base64.b64decode(b64))
    arr = np.frombuffer(raw, dtype=np.uint8)
    if arr.size != w * h:
        raise ValueError(f"Grid size mismatch: expected {w*h}, got {arr.size}")
    return arr.reshape((h, w)).copy()


async def _load_or_init_doc() -> Dict[str, Any]:
    doc = await db.terrain_grids.find_one({"_id": GRID_DOC_ID})
    if doc:
        return doc
    # Initialize empty grid
    empty = np.zeros((DEFAULT_HEIGHT, DEFAULT_WIDTH), dtype=np.uint8)
    empty_b64 = _encode_grid(empty)
    doc = {
        "_id": GRID_DOC_ID,
        "width": DEFAULT_WIDTH,
        "height": DEFAULT_HEIGHT,
        "difficulty_b64": empty_b64,
        "land_type_b64": empty_b64,
        "updated_at": _now(),
    }
    await db.terrain_grids.insert_one(doc)
    return doc


# ── Schemas ──────────────────────────────────────────────────────────────────
class GridResponse(BaseModel):
    width: int
    height: int
    difficulty_b64: str
    land_type_b64: str
    updated_at: Optional[str] = None


class GridSaveRequest(BaseModel):
    width: int
    height: int
    difficulty_b64: str
    land_type_b64: str


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("", response_model=GridResponse)
async def get_grid():
    """Fetch the current raster grid (zlib+base64 encoded)."""
    doc = await _load_or_init_doc()
    return GridResponse(
        width=doc["width"],
        height=doc["height"],
        difficulty_b64=doc.get("difficulty_b64", ""),
        land_type_b64=doc.get("land_type_b64", ""),
        updated_at=doc.get("updated_at"),
    )


@router.put("")
async def save_grid(payload: GridSaveRequest):
    """Save the full grid (both layers). The frontend already encoded them."""
    # Validate: decoding must succeed at the declared dimensions.
    try:
        _decode_grid(payload.difficulty_b64, payload.width, payload.height)
        _decode_grid(payload.land_type_b64, payload.width, payload.height)
    except Exception as e:
        raise HTTPException(400, f"Invalid grid payload: {e}")
    await db.terrain_grids.update_one(
        {"_id": GRID_DOC_ID},
        {
            "$set": {
                "width": payload.width,
                "height": payload.height,
                "difficulty_b64": payload.difficulty_b64,
                "land_type_b64": payload.land_type_b64,
                "updated_at": _now(),
            }
        },
        upsert=True,
    )
    return {"ok": True, "saved_at": _now()}


# ── PNG export / import ──────────────────────────────────────────────────────
def _grid_to_png_bytes(arr: np.ndarray, palette: List[tuple]) -> bytes:
    """Convert a uint8 grid into an RGBA PNG using the given palette.
    Cells with value 0 are fully transparent so the user can overlay the PNG
    on their own base map in Photoshop."""
    h, w = arr.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for idx, rgb in enumerate(palette):
        if idx == 0:
            continue
        mask = arr == idx
        if not mask.any():
            continue
        rgba[mask] = [*rgb, 255]
    buf = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


@router.get("/export-png")
async def export_png(layer: str = Query("difficulty", regex="^(difficulty|land_type)$")):
    """Stream the current grid layer as a transparent PNG."""
    doc = await _load_or_init_doc()
    w, h = doc["width"], doc["height"]
    if layer == "difficulty":
        arr = _decode_grid(doc.get("difficulty_b64", ""), w, h)
        png_bytes = _grid_to_png_bytes(arr, DIFFICULTY_PALETTE)
        filename = f"terrain_difficulty_{w}x{h}.png"
    else:
        arr = _decode_grid(doc.get("land_type_b64", ""), w, h)
        png_bytes = _grid_to_png_bytes(arr, LAND_TYPE_PALETTE)
        filename = f"terrain_landtype_{w}x{h}.png"
    return StreamingResponse(
        io.BytesIO(png_bytes),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _png_bytes_to_grid(
    png_bytes: bytes,
    palette: List[tuple],
    w: int,
    h: int,
    tolerance: int = 40,
) -> np.ndarray:
    """Decode a PNG and convert each pixel to the nearest palette index
    (Euclidean RGB distance). Pixels with alpha < 128 → 0 (empty).
    Tolerance is the max channel distance allowed before a pixel is left
    empty — protects against arbitrary colors the user might have introduced
    in Photoshop."""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    if img.size != (w, h):
        img = img.resize((w, h), Image.NEAREST)
    rgba = np.array(img, dtype=np.uint8)
    rgb = rgba[..., :3].astype(np.int16)
    alpha = rgba[..., 3]

    # Build palette array (skip index 0)
    palette_arr = np.array(palette[1:], dtype=np.int16)  # shape (N, 3)
    palette_ids = np.arange(1, len(palette), dtype=np.uint8)  # 1..N

    # Compute L2 distance from each pixel to each palette entry
    # rgb: (H, W, 3) → expand to (H, W, 1, 3); palette: (N, 3) → (1, 1, N, 3)
    diff = rgb[:, :, None, :] - palette_arr[None, None, :, :]
    dist2 = (diff * diff).sum(axis=-1)  # (H, W, N)

    nearest = dist2.argmin(axis=-1)  # (H, W) → indices into palette[1:]
    nearest_dist = np.sqrt(dist2.min(axis=-1))

    out = palette_ids[nearest]  # (H, W), uint8

    # Mask out empty (alpha) or too-far pixels
    out[alpha < 128] = 0
    out[nearest_dist > tolerance] = 0
    return out


@router.post("/import-png")
async def import_png(
    file: UploadFile = File(...),
    layer: str = Form("difficulty"),
):
    """Replace one layer of the grid from a PNG uploaded by the user.
    The PNG must use (or be close to) the official palette — pixels too far
    from any palette colour are treated as empty (0)."""
    if layer not in ("difficulty", "land_type"):
        raise HTTPException(400, "layer must be 'difficulty' or 'land_type'")
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "PNG too large (max 25 MB)")
    doc = await _load_or_init_doc()
    w, h = doc["width"], doc["height"]
    palette = DIFFICULTY_PALETTE if layer == "difficulty" else LAND_TYPE_PALETTE
    try:
        arr = _png_bytes_to_grid(data, palette, w, h)
    except Exception as e:
        raise HTTPException(400, f"Could not decode PNG: {e}")
    field = "difficulty_b64" if layer == "difficulty" else "land_type_b64"
    await db.terrain_grids.update_one(
        {"_id": GRID_DOC_ID},
        {"$set": {field: _encode_grid(arr), "updated_at": _now()}},
        upsert=True,
    )
    painted = int((arr > 0).sum())
    return {"ok": True, "layer": layer, "painted_cells": painted}


# ── Coordinate lookup (used by pathfinding) ─────────────────────────────────
@router.get("/lookup")
async def lookup(x: float = Query(..., ge=0, le=100), y: float = Query(..., ge=0, le=100)):
    """Return the cell value at map-% coordinates (x, y). Mostly for debug."""
    doc = await _load_or_init_doc()
    w, h = doc["width"], doc["height"]
    diff = _decode_grid(doc.get("difficulty_b64", ""), w, h)
    land = _decode_grid(doc.get("land_type_b64", ""), w, h)
    cx = max(0, min(w - 1, int(round(x * w / 100.0))))
    cy = max(0, min(h - 1, int(round(y * h / 100.0))))
    return {
        "x": x,
        "y": y,
        "cell": [cx, cy],
        "difficulty_id": int(diff[cy, cx]),
        "difficulty": DIFFICULTY_NAMES.get(int(diff[cy, cx])),
        "land_type_id": int(land[cy, cx]),
        "land_type": LAND_TYPE_NAMES.get(int(land[cy, cx])),
    }
