/**
 * TerrainGridEditor — Raster-based terrain editor (Iter 119).
 *
 * Replaces the old polygon system with a 2000×1536 cell grid. Two layers:
 * difficulty (7 IDs) and land_type (5 IDs). Paint, eraser and bucket tools
 * operate at the cell level so overlaps are impossible by design.
 *
 * Persistence: zlib-compressed Uint8 arrays → base64 → MongoDB (via pako).
 *
 * UI is intentionally compact and keyboard-friendly:
 *   - 1..7 (or 1..5 on land layer)       → pick color
 *   - B, E, G                              → brush / eraser / bucket
 *   - L                                    → toggle layer
 *   - Ctrl+Z / Ctrl+Shift+Z                → undo / redo
 *   - Ctrl+S                               → save
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import pako from 'pako';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ArrowLeft, ZoomIn, ZoomOut, Save, Undo2, Redo2, Paintbrush, Eraser,
  Droplet, Download, Upload, Layers, Eye, EyeOff, Hand,
} from 'lucide-react';
import { MAESTRO_MAP_URL } from '@/config/mapAssets';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ── Constants matching backend (terrain_grid_routes.py) ──────────────────────
const W = 2000;
const H = 1536;

const DIFFICULTY = [
  { id: 1, key: 'facil',         name: 'Fácil',         color: '#86efac' },
  { id: 2, key: 'moderado',      name: 'Moderado',      color: '#facc15' },
  { id: 3, key: 'dificil',       name: 'Difícil',       color: '#fb923c' },
  { id: 4, key: 'muy_dificil',   name: 'Muy difícil',   color: '#ef4444' },
  { id: 5, key: 'desalentador',  name: 'Desalentador',  color: '#9333ea' },
  { id: 6, key: 'infranqueable', name: 'Infranqueable', color: '#1e1e1e' },
  { id: 7, key: 'agua',          name: 'Agua',          color: '#3b82f6' },
];
const LAND_TYPE = [
  { id: 1, key: 'libres',          name: 'Libres',          color: '#a3e635' },
  { id: 2, key: 'fronterizas',     name: 'Fronterizas',     color: '#d97706' },
  { id: 3, key: 'salvajes',        name: 'Salvajes',        color: '#84cc16' },
  { id: 4, key: 'sombra',          name: 'Sombra',          color: '#6d28d9' },
  { id: 5, key: 'tierras_oscuras', name: 'Tierras Oscuras', color: '#18181b' },
];

// Pre-computed palette as Uint8 RGB for fast Imag​eData writes.
const buildPaletteRGB = (defs) => {
  const arr = new Uint8Array((defs.length + 1) * 3);
  for (const d of defs) {
    const r = parseInt(d.color.slice(1, 3), 16);
    const g = parseInt(d.color.slice(3, 5), 16);
    const b = parseInt(d.color.slice(5, 7), 16);
    arr[d.id * 3]     = r;
    arr[d.id * 3 + 1] = g;
    arr[d.id * 3 + 2] = b;
  }
  return arr;
};
const PALETTE_DIFFICULTY = buildPaletteRGB(DIFFICULTY);
const PALETTE_LAND = buildPaletteRGB(LAND_TYPE);

// ── Encoding helpers (mirror backend zlib + base64) ──────────────────────────
const b64ToUint8 = (b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};
const uint8ToB64 = (u8) => {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(s);
};
const decodeLayer = (b64) => {
  if (!b64) return new Uint8Array(W * H);
  const compressed = b64ToUint8(b64);
  const raw = pako.inflate(compressed);
  if (raw.length !== W * H) {
    throw new Error(`Grid size mismatch: ${raw.length} vs ${W * H}`);
  }
  return raw;
};
const encodeLayer = (u8) => uint8ToB64(pako.deflate(u8, { level: 6 }));

// ── Drawing on an ImageData buffer ───────────────────────────────────────────
const drawGridIntoImageData = (grid, palette, imageData, opacity255) => {
  // grid is row-major Uint8 (H rows × W cols). imageData is RGBA Uint8ClampedArray.
  const data = imageData.data;
  const n = grid.length;
  for (let i = 0; i < n; i++) {
    const id = grid[i];
    const o = i * 4;
    if (id === 0) {
      data[o + 3] = 0; // transparent
    } else {
      const p = id * 3;
      data[o] = palette[p];
      data[o + 1] = palette[p + 1];
      data[o + 2] = palette[p + 2];
      data[o + 3] = opacity255;
    }
  }
};

// ── Component ────────────────────────────────────────────────────────────────
export default function TerrainGridEditor() {
  const navigate = useNavigate();

  // Layers (Uint8Array, row-major: index = y*W + x)
  const diffGridRef = useRef(new Uint8Array(W * H));
  const landGridRef = useRef(new Uint8Array(W * H));

  // UI state
  const [layer, setLayer] = useState('difficulty'); // 'difficulty' | 'land_type'
  const [selectedId, setSelectedId] = useState(1);
  const [tool, setTool] = useState('pan'); // 'pan' | 'brush' | 'eraser' | 'bucket'
  const [brushRadius, setBrushRadius] = useState(10); // in CELLS
  const [opacity, setOpacity] = useState(0.7);
  const [showMap, setShowMap] = useState(true);
  const [showOtherLayer, setShowOtherLayer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [renderTick, setRenderTick] = useState(0); // force re-render on grid mutation
  const triggerRender = useCallback(() => setRenderTick((t) => t + 1), []);

  // Pan / zoom (relative to map %), same conventions as MiddleEarthMap.
  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);

  // Mouse / paint state
  const [isPainting, setIsPainting] = useState(false);
  const lastPaintCell = useRef(null);
  const beforeStrokeSnapshot = useRef(null);

  // History (snapshots of the active layer Uint8Array)
  const undoStack = useRef([]); // [{ layer, before }]
  const redoStack = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Refs for canvases
  const mapImgRef = useRef(null);
  const visibleCanvasRef = useRef(null);
  const offscreenDiffRef = useRef(null); // ImageData buffer (W×H)
  const offscreenLandRef = useRef(null);
  const containerRef = useRef(null);
  // Wrapper that holds the map + canvas at the REAL map aspect ratio. Sized
  // by a ResizeObserver so the map is never stretched (Iter 119.1 bugfix).
  const mapWrapperRef = useRef(null);
  const MAP_REAL_W = 19791;
  const MAP_REAL_H = 15133;
  const MAP_ASPECT = MAP_REAL_W / MAP_REAL_H;
  const [wrapperSize, setWrapperSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const update = () => {
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const containerAspect = r.width / r.height;
      let w, h;
      if (containerAspect > MAP_ASPECT) {
        // container is wider than map → height drives the size
        h = r.height;
        w = h * MAP_ASPECT;
      } else {
        w = r.width;
        h = w / MAP_ASPECT;
      }
      setWrapperSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(c);
    return () => ro.disconnect();
  }, [MAP_ASPECT]);

  const currentDef = useMemo(
    () => (layer === 'difficulty' ? DIFFICULTY : LAND_TYPE).find((d) => d.id === selectedId)
      || (layer === 'difficulty' ? DIFFICULTY[0] : LAND_TYPE[0]),
    [layer, selectedId]
  );

  // ── LOAD on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/terrain-grid`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.width !== W || data.height !== H) {
          toast.error(`La rejilla del backend es ${data.width}×${data.height}, se esperaba ${W}×${H}. Migración necesaria.`);
        }
        diffGridRef.current = decodeLayer(data.difficulty_b64);
        landGridRef.current = decodeLayer(data.land_type_b64);
        triggerRender();
        toast.success('Rejilla cargada.');
      } catch (e) {
        console.error(e);
        toast.error(`No se pudo cargar la rejilla: ${e.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [triggerRender]);

  // ── PAINT helpers (mutate the grid in-place) ───────────────────────────────
  const paintDisc = useCallback((cx, cy, r, value, grid) => {
    const r2 = r * r;
    const xMin = Math.max(0, cx - r);
    const xMax = Math.min(W - 1, cx + r);
    const yMin = Math.max(0, cy - r);
    const yMax = Math.min(H - 1, cy + r);
    for (let y = yMin; y <= yMax; y++) {
      const dy = y - cy;
      const dy2 = dy * dy;
      const rowOff = y * W;
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - cx;
        if (dx * dx + dy2 <= r2) grid[rowOff + x] = value;
      }
    }
  }, []);

  // Bresenham-style line of brush stamps so quick drags don't leave gaps.
  const paintLine = useCallback((x0, y0, x1, y1, r, value, grid) => {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    // Step at ~r/2 cells to keep stamps overlapping
    const step = Math.max(1, Math.floor(r / 2));
    let counter = 0;
    let x = x0, y = y0;
    paintDisc(x, y, r, value, grid);
    while (true) {
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      counter++;
      if (counter >= step) {
        paintDisc(x, y, r, value, grid);
        counter = 0;
      }
    }
    paintDisc(x1, y1, r, value, grid);
  }, [paintDisc]);

  const floodFill = useCallback((cx, cy, newVal, grid) => {
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return 0;
    const target = grid[cy * W + cx];
    if (target === newVal) return 0;
    // Scanline flood fill — much faster than naive 4-neighbour stack for big areas.
    const stack = [[cx, cy]];
    let painted = 0;
    while (stack.length) {
      const [sx, sy] = stack.pop();
      let x = sx;
      // Walk left
      while (x >= 0 && grid[sy * W + x] === target) x--;
      x++;
      let spanAbove = false, spanBelow = false;
      while (x < W && grid[sy * W + x] === target) {
        grid[sy * W + x] = newVal;
        painted++;
        if (sy > 0) {
          const above = grid[(sy - 1) * W + x] === target;
          if (above && !spanAbove) { stack.push([x, sy - 1]); spanAbove = true; }
          else if (!above && spanAbove) { spanAbove = false; }
        }
        if (sy < H - 1) {
          const below = grid[(sy + 1) * W + x] === target;
          if (below && !spanBelow) { stack.push([x, sy + 1]); spanBelow = true; }
          else if (!below && spanBelow) { spanBelow = false; }
        }
        x++;
      }
    }
    return painted;
  }, []);

  // ── HISTORY (snapshot per stroke) ──────────────────────────────────────────
  const activeGrid = layer === 'difficulty' ? diffGridRef.current : landGridRef.current;

  const snapshotBeforeStroke = useCallback(() => {
    beforeStrokeSnapshot.current = {
      layer,
      before: new Uint8Array(layer === 'difficulty' ? diffGridRef.current : landGridRef.current),
    };
  }, [layer]);

  const commitStroke = useCallback(() => {
    if (!beforeStrokeSnapshot.current) return;
    undoStack.current.push(beforeStrokeSnapshot.current);
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
    beforeStrokeSnapshot.current = null;
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    const currentRef = snap.layer === 'difficulty' ? diffGridRef : landGridRef;
    redoStack.current.push({ layer: snap.layer, before: new Uint8Array(currentRef.current) });
    currentRef.current = snap.before;
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    triggerRender();
    setDirty(true);
    toast.success('Deshecho.');
  }, [triggerRender]);

  const redo = useCallback(() => {
    const snap = redoStack.current.pop();
    if (!snap) return;
    const currentRef = snap.layer === 'difficulty' ? diffGridRef : landGridRef;
    undoStack.current.push({ layer: snap.layer, before: new Uint8Array(currentRef.current) });
    currentRef.current = snap.before;
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
    triggerRender();
    setDirty(true);
    toast.success('Rehecho.');
  }, [triggerRender]);

  // ── COORD CONVERSION ──────────────────────────────────────────────────────
  // screen px → map% (0..100). Uses the wrapper rect (which holds the real
  // aspect ratio) so coordinates are correct regardless of the container's
  // letterboxing.
  const screenToMap = useCallback((clientX, clientY) => {
    const w = mapWrapperRef.current;
    if (!w) return null;
    const r = w.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const sx = (clientX - r.left) / r.width;
    const sy = (clientY - r.top) / r.height;
    // The wrapper itself is transformed by scale/offset relative to the
    // container; we already applied that transform via CSS, so the rect
    // we read is the FINAL on-screen rect. Hence (sx,sy) is already the
    // normalised position on the map.
    return { x: sx * 100, y: sy * 100 };
  }, []);

  const mapToCell = (mx, my) => ({
    cx: Math.max(0, Math.min(W - 1, Math.round((mx / 100) * W))),
    cy: Math.max(0, Math.min(H - 1, Math.round((my / 100) * H))),
  });

  // ── INPUT HANDLERS ────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (loading) return;
    // PAN: right-click, middle-click, shift+left-click, or 'pan' tool with left-click.
    const wantPan =
      e.button === 1 ||
      e.button === 2 ||
      (e.button === 0 && e.shiftKey) ||
      (e.button === 0 && tool === 'pan');
    if (wantPan) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }
    if (e.button !== 0) return;
    const mp = screenToMap(e.clientX, e.clientY);
    if (!mp) return;
    if (mp.x < 0 || mp.x > 100 || mp.y < 0 || mp.y > 100) return;
    const { cx, cy } = mapToCell(mp.x, mp.y);

    if (tool === 'bucket') {
      snapshotBeforeStroke();
      const grid = layer === 'difficulty' ? diffGridRef.current : landGridRef.current;
      const newVal = selectedId;
      const target = grid[cy * W + cx];
      // Bucket logic:
      //   - on EMPTY (0) → flood fill empty cells with selected.
      //   - on SAME color → no-op.
      //   - on DIFFERENT color → confirm and flood fill that color region.
      if (target === newVal) {
        toast.info('Esa celda ya es de ese tipo.');
        beforeStrokeSnapshot.current = null;
        return;
      }
      if (target !== 0) {
        const fromName = (layer === 'difficulty' ? DIFFICULTY : LAND_TYPE)
          .find((d) => d.id === target)?.name || 'esa zona';
        if (!window.confirm(`¿Convertir toda la zona "${fromName}" conectada a "${currentDef.name}"?`)) {
          beforeStrokeSnapshot.current = null;
          return;
        }
      }
      const painted = floodFill(cx, cy, newVal, grid);
      commitStroke();
      triggerRender();
      toast.success(`${painted.toLocaleString()} celdas rellenadas.`);
      return;
    }

    // brush or eraser
    snapshotBeforeStroke();
    setIsPainting(true);
    lastPaintCell.current = { cx, cy };
    const grid = layer === 'difficulty' ? diffGridRef.current : landGridRef.current;
    const val = tool === 'eraser' ? 0 : selectedId;
    paintDisc(cx, cy, brushRadius, val, grid);
    triggerRender();
  };

  const handleMouseMove = (e) => {
    if (isPanning && panStart.current) {
      // offset stored in pixels (Iter 119.1)
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
      return;
    }
    if (!isPainting) return;
    const mp = screenToMap(e.clientX, e.clientY);
    if (!mp) return;
    const { cx, cy } = mapToCell(mp.x, mp.y);
    const last = lastPaintCell.current;
    if (!last) return;
    const grid = layer === 'difficulty' ? diffGridRef.current : landGridRef.current;
    const val = tool === 'eraser' ? 0 : selectedId;
    paintLine(last.cx, last.cy, cx, cy, brushRadius, val, grid);
    lastPaintCell.current = { cx, cy };
    triggerRender();
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      return;
    }
    if (isPainting) {
      setIsPainting(false);
      lastPaintCell.current = null;
      commitStroke();
    }
  };

  const handleWheel = (e) => {
    // Zoom around the cursor (Iter 119.1).
    e.preventDefault();
    const c = containerRef.current;
    if (!c) return;
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newScale = Math.max(0.5, Math.min(20, scale * factor));
    // Wrapper's current screen-left: (container.w - wrapperSize.w)/2 + offset.x
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const curLeft = (cw - wrapperSize.w) / 2 + offset.x;
    const curTop  = (ch - wrapperSize.h) / 2 + offset.y;
    // Map-pixel under cursor (in wrapper-local untransformed coords):
    const localX = (e.clientX - curLeft) / scale;
    const localY = (e.clientY - curTop)  / scale;
    // After zoom, we want the same map-pixel under the cursor:
    const newLeft = e.clientX - localX * newScale;
    const newTop  = e.clientY - localY * newScale;
    setScale(newScale);
    setOffset({
      x: newLeft - (cw - wrapperSize.w) / 2,
      y: newTop  - (ch - wrapperSize.h) / 2,
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault(); redo(); return;
        }
        if (e.key === 's') { e.preventDefault(); save(); return; }
      }
      if (e.key === 'h' || e.key === 'H') setTool('pan');
      if (e.key === 'b' || e.key === 'B') setTool('brush');
      if (e.key === 'e' || e.key === 'E') setTool('eraser');
      if (e.key === 'g' || e.key === 'G') setTool('bucket');
      if (e.key === 'l' || e.key === 'L') setLayer((l) => l === 'difficulty' ? 'land_type' : 'difficulty');
      const num = parseInt(e.key, 10);
      if (!isNaN(num)) {
        const max = layer === 'difficulty' ? DIFFICULTY.length : LAND_TYPE.length;
        if (num >= 1 && num <= max) setSelectedId(num);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, layer]);

  // ── RENDER LOOP (offscreen ImageData → drawImage on visible canvas) ──────
  useEffect(() => {
    if (!offscreenDiffRef.current) offscreenDiffRef.current = new ImageData(W, H);
    if (!offscreenLandRef.current) offscreenLandRef.current = new ImageData(W, H);
    const opacity255 = Math.round(opacity * 255);
    drawGridIntoImageData(diffGridRef.current, PALETTE_DIFFICULTY, offscreenDiffRef.current, opacity255);
    drawGridIntoImageData(landGridRef.current, PALETTE_LAND, offscreenLandRef.current, opacity255);

    const canvas = visibleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    // Bottom layer first, then top.
    const drawIfVisible = (layerKey) => {
      const isActive = layer === layerKey;
      if (!isActive && !showOtherLayer) return;
      const img = layerKey === 'difficulty' ? offscreenDiffRef.current : offscreenLandRef.current;
      ctx.putImageData(img, 0, 0);
    };
    // Draw non-active first (so active sits on top)
    if (showOtherLayer) {
      const otherKey = layer === 'difficulty' ? 'land_type' : 'difficulty';
      drawIfVisible(otherKey);
    }
    drawIfVisible(layer);
  }, [renderTick, layer, opacity, showOtherLayer]);

  // ── SAVE ──────────────────────────────────────────────────────────────────
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const body = {
        width: W,
        height: H,
        difficulty_b64: encodeLayer(diffGridRef.current),
        land_type_b64: encodeLayer(landGridRef.current),
      };
      const res = await fetch(`${API}/terrain-grid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDirty(false);
      toast.success('Rejilla guardada.');
    } catch (e) {
      console.error(e);
      toast.error(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  // ── EXPORT / IMPORT PNG ───────────────────────────────────────────────────
  // Plain handlers — only called from onClick, no need for memoization.
  async function exportPNG() {
    try {
      const res = await fetch(`${API}/terrain-grid/export-png?layer=${layer}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `terrain_${layer}_${W}x${H}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('PNG exportado.');
    } catch (e) {
      toast.error(`Error al exportar: ${e.message}`);
    }
  }

  async function importPNG(file) {
    if (!file) return;
    if (!window.confirm(`Esto sobrescribirá la capa "${layer === 'difficulty' ? 'Dificultad' : 'Tipo de tierra'}" con la imagen subida. ¿Continuar?`)) {
      return;
    }
    snapshotBeforeStroke();
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('layer', layer);
      const res = await fetch(`${API}/terrain-grid/import-png`, { method: 'POST', body: form });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const grid = await fetch(`${API}/terrain-grid`).then((r) => r.json());
      diffGridRef.current = decodeLayer(grid.difficulty_b64);
      landGridRef.current = decodeLayer(grid.land_type_b64);
      commitStroke();
      triggerRender();
      toast.success(`PNG importado: ${data.painted_cells.toLocaleString()} celdas.`);
    } catch (e) {
      beforeStrokeSnapshot.current = null;
      toast.error(`Error al importar: ${e.message}`);
    }
  }

  async function runMigration() {
    if (!window.confirm('Esto rasterizará los polígonos legados a la rejilla y SOBRESCRIBIRÁ la rejilla actual. ¿Continuar?')) return;
    try {
      const res = await fetch(`${API}/terrain-grid/migrate-from-polygons`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reload = await fetch(`${API}/terrain-grid`).then((r) => r.json());
      diffGridRef.current = decodeLayer(reload.difficulty_b64);
      landGridRef.current = decodeLayer(reload.land_type_b64);
      undoStack.current = [];
      redoStack.current = [];
      setUndoCount(0);
      setRedoCount(0);
      setDirty(false);
      triggerRender();
      toast.success(`Migrado: dificultad ${data.difficulty_polygons_painted}, tierras ${data.land_type_polygons_painted}.`);
    } catch (e) {
      toast.error(`Error en migración: ${e.message}`);
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const defs = layer === 'difficulty' ? DIFFICULTY : LAND_TYPE;

  // Cursor style helper
  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : tool === 'pan'
      ? 'cursor-grab'
      : tool === 'bucket'
        ? 'cursor-crosshair'
        : 'cursor-crosshair';

  // Pan/zoom transform for the layered canvas + map
  const transform = `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${scale})`;

  // Pan/zoom translates and scales the wrapper. Offset is expressed in
  // wrapper pixels so dragging feels 1:1 with the cursor regardless of zoom.
  const wrapperLeft = wrapperSize.w
    ? ((containerRef.current?.clientWidth || 0) - wrapperSize.w) / 2 + offset.x
    : 0;
  const wrapperTop = wrapperSize.h
    ? ((containerRef.current?.clientHeight || 0) - wrapperSize.h) / 2 + offset.y
    : 0;

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col">
      {/* HEADER */}
      <div className="flex items-center gap-3 p-3 border-b border-amber-700/30 bg-black/60 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <h1 className="text-lg font-serif text-amber-300">Editor de Terreno (raster)</h1>
        <div className="ml-2 text-xs text-zinc-400">{W}×{H} celdas</div>
        {dirty && <span className="ml-2 text-xs bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded">sin guardar</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} title="Deshacer (Ctrl+Z)" disabled={undoCount === 0}>
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={redo} title="Rehacer (Ctrl+Shift+Z)" disabled={redoCount === 0}>
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button onClick={save} disabled={saving || !dirty} className="bg-emerald-700 hover:bg-emerald-600" data-testid="terrain-grid-save">
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-3 p-2 bg-black/40 border-b border-amber-700/20 flex-shrink-0">
        {/* Layer toggle */}
        <div className="flex items-center gap-1">
          <Layers className="w-4 h-4 text-amber-400" />
          <Button
            size="sm" variant={layer === 'difficulty' ? 'default' : 'outline'}
            onClick={() => { setLayer('difficulty'); setSelectedId(1); }}
            data-testid="grid-layer-difficulty"
          >Dificultad</Button>
          <Button
            size="sm" variant={layer === 'land_type' ? 'default' : 'outline'}
            onClick={() => { setLayer('land_type'); setSelectedId(1); }}
            data-testid="grid-layer-landtype"
          >Tipo de tierra</Button>
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-1">
          {defs.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-7 h-7 rounded border-2 transition-all ${selectedId === d.id ? 'border-amber-300 scale-110' : 'border-zinc-700'}`}
              style={{ backgroundColor: d.color }}
              title={`${d.id} — ${d.name}`}
              data-testid={`grid-color-${d.key}`}
            />
          ))}
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 border-l border-zinc-700 pl-3">
          <Button size="sm" variant={tool === 'pan' ? 'default' : 'outline'} onClick={() => setTool('pan')} title="Mover mapa (H)" data-testid="grid-tool-pan">
            <Hand className="w-4 h-4" />
          </Button>
          <Button size="sm" variant={tool === 'brush' ? 'default' : 'outline'} onClick={() => setTool('brush')} title="Pincel (B)" data-testid="grid-tool-brush">
            <Paintbrush className="w-4 h-4" />
          </Button>
          <Button size="sm" variant={tool === 'eraser' ? 'default' : 'outline'} onClick={() => setTool('eraser')} title="Goma (E)" data-testid="grid-tool-eraser">
            <Eraser className="w-4 h-4" />
          </Button>
          <Button size="sm" variant={tool === 'bucket' ? 'default' : 'outline'} onClick={() => setTool('bucket')} title="Bote (G)" data-testid="grid-tool-bucket">
            <Droplet className="w-4 h-4" />
          </Button>
        </div>

        {/* Brush radius */}
        {(tool === 'brush' || tool === 'eraser') && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-300">Radio:</span>
            <input type="range" min="1" max="80" step="1"
              value={brushRadius}
              onChange={(e) => setBrushRadius(parseInt(e.target.value, 10))}
              className="w-32 accent-amber-500"
              data-testid="grid-brush-radius"
            />
            <span className="text-amber-200 font-mono w-12 text-right">{brushRadius} cel</span>
          </div>
        )}

        {/* Opacity */}
        <div className="flex items-center gap-2 text-xs border-l border-zinc-700 pl-3">
          <span className="text-amber-300">Opacidad:</span>
          <input type="range" min="0.1" max="1" step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-20 accent-amber-500"
          />
          <span className="text-amber-200 font-mono w-10 text-right">{Math.round(opacity * 100)}%</span>
        </div>

        {/* Visibility toggles */}
        <div className="flex items-center gap-1 border-l border-zinc-700 pl-3">
          <Button size="sm" variant="outline" onClick={() => setShowMap((v) => !v)} title="Mostrar/Ocultar mapa">
            {showMap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="ml-1 text-xs">Mapa</span>
          </Button>
          <Button size="sm" variant={showOtherLayer ? 'default' : 'outline'} onClick={() => setShowOtherLayer((v) => !v)} title="Mostrar también la otra capa">
            <span className="text-xs">Otra capa</span>
          </Button>
        </div>

        {/* Import / Export / Migrate */}
        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" variant="outline" onClick={exportPNG} title="Exportar capa actual a PNG transparente" data-testid="grid-export-png">
            <Download className="w-4 h-4 mr-1" /> PNG
          </Button>
          <label className="cursor-pointer">
            <Button size="sm" variant="outline" as="span" title="Importar PNG sobre la capa actual" data-testid="grid-import-png" asChild>
              <span><Upload className="w-4 h-4 mr-1" /> Importar PNG</span>
            </Button>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importPNG(f);
                e.target.value = '';
              }}
            />
          </label>
          <Button size="sm" variant="outline" onClick={runMigration} title="Rasterizar polígonos legados a la rejilla" className="text-amber-300 border-amber-700">
            Migrar polígonos
          </Button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden relative ${cursorClass}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="terrain-grid-canvas-container"
      >
        <div
          ref={mapWrapperRef}
          className="absolute origin-top-left"
          style={{
            left: wrapperLeft,
            top: wrapperTop,
            width: wrapperSize.w,
            height: wrapperSize.h,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {showMap && (
            <img
              ref={mapImgRef}
              src={MAESTRO_MAP_URL}
              alt="Tierra Media"
              className="absolute inset-0 w-full h-full select-none pointer-events-none"
              draggable={false}
            />
          )}
          <canvas
            ref={visibleCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-amber-300">
            Cargando rejilla…
          </div>
        )}

        {/* Footer status */}
        <div className="absolute bottom-2 left-2 text-xs bg-black/70 text-amber-200 px-2 py-1 rounded">
          Capa: <b>{layer === 'difficulty' ? 'Dificultad' : 'Tipo de tierra'}</b> · Color: <b style={{ color: currentDef.color }}>{currentDef.name}</b> · Zoom: <b>{scale.toFixed(2)}×</b>
        </div>

        <div className="absolute bottom-2 right-2 text-xs bg-black/70 text-zinc-300 px-2 py-1 rounded">
          Atajos: 1-7 color · H/B/E/G herramientas · L capa · Click der./medio o Shift+drag = pan · Rueda = zoom · Ctrl+Z/Y · Ctrl+S
        </div>
      </div>
    </div>
  );
}
