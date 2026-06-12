/**
 * Terrain Editor - Visualize and edit terrain types
 * Two modes:
 * 1. Terrain Difficulty (fácil, moderado, difícil, etc.)
 * 2. Land Types (Tierras Libres, Salvajes, Sombra, etc.)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import polygonClipping from 'polygon-clipping';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ZoomIn, ZoomOut, Move, Save, Trash2, Plus, Edit3, Download, Eraser, Paintbrush, Droplet } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { MAESTRO_MAP_URL } from '@/config/mapAssets';

// ===========================================================================
// Brush helpers — clip polygons with a circular stamp (Iter 107)
// ===========================================================================

/** Build the perimeter of a circle as a closed ring (GeoJSON-like). */
const circleRing = (cx, cy, r, sides = 24) => {
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  ring.push(ring[0]); // close
  return [ring]; // single-ring polygon
};

/** Convert our `{points: [{x,y}]}` representation to GeoJSON-like polygon. */
const polyToRing = (poly) => {
  const ring = poly.points.map((p) => [p.x, p.y]);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    ring.push(ring[0]);
  }
  return [ring];
};

/** Convert a GeoJSON-like multipolygon back to our flat `{points}` shape.
 *  Holes are flattened back into outer-only rings (acceptable for our editor —
 *  if a brush carves a hole inside a big polygon we end up with two outer
 *  polygons after the split). */
const ringsToPolys = (multipoly, baseType, baseId) => {
  const out = [];
  multipoly.forEach((poly, i) => {
    poly.forEach((ring, j) => {
      // Drop the closing duplicate point
      const cleaned = ring.slice(0, -1);
      if (cleaned.length < 3) return;
      out.push({
        id: `${baseId}_p${i}_${j}_${Math.random().toString(36).slice(2, 7)}`,
        type: baseType,
        points: cleaned.map(([x, y]) => ({ x, y })),
      });
    });
  });
  return out;
};

// Map dimensions (same as main system)
const MAP_PIXEL_WIDTH = 19791;
const MAP_PIXEL_HEIGHT = 15133;

/** Subtract `winner`'s geometry from every polygon in `others` so the newest /
 *  most recently modified polygon always wins overlapping pixels.
 *  Returns a new flat array of polygons.
 *  - `winner` is kept untouched in the result (the caller is responsible for
 *    re-appending it if needed).
 *  - Polygons of any type — including `winner.type` — get clipped, so the
 *    overlap rule is strict and visual: last-drawn = on top.
 *  - If clipping a polygon completely consumes it, the polygon is dropped. */
const subtractWinnerFromOthers = (others, winner) => {
  if (!winner || !others?.length) return others || [];
  let winnerRing;
  try {
    winnerRing = polyToRing(winner);
  } catch (_e) {
    return others;
  }
  const out = [];
  for (const poly of others) {
    if (poly.id === winner.id) continue; // never clip self
    try {
      const diff = polygonClipping.difference(polyToRing(poly), winnerRing);
      if (!diff || diff.length === 0) continue; // fully covered → drop
      out.push(...ringsToPolys(diff, poly.type, poly.id));
    } catch (_e) {
      out.push(poly); // fall back: keep original on clipping failure
    }
  }
  return out;
};

// Terrain difficulty colors
const TERRAIN_COLORS = {
  facil: { color: '#22c55e', name: 'Fácil', description: 'Caminos bien mantenidos' },
  moderado: { color: '#eab308', name: 'Moderado', description: 'Sendas y campos' },
  dificil: { color: '#f97316', name: 'Difícil', description: 'Bosques densos, colinas' },
  muy_dificil: { color: '#ef4444', name: 'Muy Difícil', description: 'Montañas, pantanos' },
  desalentador: { color: '#dc2626', name: 'Desalentador', description: 'Terreno extremo' },
  infranqueable: { color: '#7f1d1d', name: 'Infranqueable', description: 'Imposible de atravesar' },
  agua: { color: '#0ea5e9', name: 'Agua', description: 'Ríos, lagos, mar - requiere embarcación' },
};

// Land type colors
const LAND_TYPE_COLORS = {
  tierras_libres: { color: '#22c55e', name: 'Tierras Libres', description: 'Seguras, civilizadas' },
  tierras_fronterizas: { color: '#eab308', name: 'Tierras Fronterizas', description: 'Límite de lo salvaje' },
  tierras_salvajes: { color: '#f97316', name: 'Tierras Salvajes', description: 'Peligrosas, inexploradas' },
  tierras_sombra: { color: '#9333ea', name: 'Tierras de la Sombra', description: 'Influencia oscura' },
  tierras_oscuras: { color: '#1f2937', name: 'Tierras Oscuras', description: 'Dominio del enemigo' },
};

const TerrainEditor = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [mode, setMode] = useState('terrain'); // 'terrain' or 'landType'
  const [zoom, setZoom] = useState(0.05); // Start zoomed out to see full map
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Zoom mode - only zoom with wheel when this is active
  const [zoomMode, setZoomMode] = useState(false);
  
  // Data
  const [terrainZones, setTerrainZones] = useState([]);
  const [landTypeZones, setLandTypeZones] = useState([]);
  const [regions, setRegions] = useState([]);
  const [roads, setRoads] = useState([]);
  const [rivers, setRivers] = useState([]);
  const [barriers, setBarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Drawing/Editing mode
  const [paintMode, setPaintMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false); // Eraser mode
  const [polygonMode, setPolygonMode] = useState(false); // Polygon drawing mode
  const [currentPolygon, setCurrentPolygon] = useState([]); // Points of current polygon being drawn
  const [selectedBrush, setSelectedBrush] = useState(null); // 'facil', 'moderado', etc.
  const [brushSize, setBrushSize] = useState(1); // Default to 1 cell
  const [paintedCells, setPaintedCells] = useState([]); // Painted terrain cells
  const [drawnPolygons, setDrawnPolygons] = useState([]); // Completed polygons
  
  // Piece editing mode
  const [editPieceMode, setEditPieceMode] = useState(null); // 'roads', 'barriers', 'rivers'
  const [selectedPiece, setSelectedPiece] = useState(null);

  // === Move polygons (Iter 67) ===
  const [movePolygonMode, setMovePolygonMode] = useState(false);
  const [movingPolygonId, setMovingPolygonId] = useState(null);
  const [moveStartCoords, setMoveStartCoords] = useState(null);

  // === Brush mode (Iter 107) — circular stamp that clips/replaces parts
  //     of existing polygons instead of deleting them whole.
  //     Two sub-modes: 'erase' (subtract only) and 'paint' (replace by the
  //     currently selected terrain). ===
  const [brushMode, setBrushMode] = useState(null); // null | 'erase' | 'paint'
  const [brushRadius, setBrushRadius] = useState(0.6); // map % (0.2 - 5)
  const [brushActive, setBrushActive] = useState(false);
  const [brushCursor, setBrushCursor] = useState(null); // {x, y} in map %
  const [brushPreStamp, setBrushPreStamp] = useState(null); // history snapshot taken on mousedown

  // === Paint bucket mode (Iter 117) — Paint-style flood fill on click ===
  const [bucketMode, setBucketMode] = useState(false);

  // === Undo / Redo history of drawnPolygons (Iter 83) ===
  // Stores AFTER-states. cursor (`historyIndex`) points to the index in
  // `history` that corresponds to the CURRENT drawn polygons.
  // - undo: cursor-- and restore that state.
  // - redo: cursor++ and restore that state.
  // - pushHistory: drop redo branch (anything after cursor), append the
  //   new state, then advance cursor to the tail.
  const HISTORY_MAX = 50;
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback((newState) => {
    const snap = JSON.parse(JSON.stringify(newState || []));
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, snap];
      if (next.length > HISTORY_MAX) {
        next.shift();
        setHistoryIndex(next.length - 1);
      } else {
        setHistoryIndex(next.length - 1);
      }
      return next;
    });
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (historyIndex <= 0) {
      toast.info('Nada que deshacer.');
      return;
    }
    const newIndex = historyIndex - 1;
    setDrawnPolygons(JSON.parse(JSON.stringify(history[newIndex] || [])));
    setHistoryIndex(newIndex);
    toast.success('Deshecho.');
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      toast.info('Nada que rehacer.');
      return;
    }
    const newIndex = historyIndex + 1;
    setDrawnPolygons(JSON.parse(JSON.stringify(history[newIndex] || [])));
    setHistoryIndex(newIndex);
    toast.success('Rehecho.');
  }, [history, historyIndex]);

  // Keyboard shortcuts: Ctrl/Cmd+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo).
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'y') || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Apply one brush stamp at (cx, cy). In 'erase' mode every polygon that
  // intersects the brush circle is clipped with `poly - circle`. In 'paint'
  // mode we ONLY clip polygons of a DIFFERENT type (so the new paint
  // replaces them) and add the circle as a fresh polygon of `selectedBrush`.
  // We deliberately leave same-type polygons untouched so consecutive brush
  // stamps overlap freely — that way the "Unir polígonos" button can later
  // collapse them into one big shape without snap-rounding microgaps.
  const applyBrushStamp = useCallback((cx, cy) => {
    if (!brushMode) return;
    const circle = circleRing(cx, cy, brushRadius, 28);
    setDrawnPolygons((prev) => {
      const next = [];
      for (const poly of prev) {
        // In 'paint' mode keep same-type polygons intact (they will be
        // unioned later when the user presses "Unir polígonos").
        if (brushMode === 'paint' && selectedBrush && poly.type === selectedBrush) {
          next.push(poly);
          continue;
        }
        try {
          const diff = polygonClipping.difference(polyToRing(poly), circle);
          if (!diff || diff.length === 0) continue; // poly fully inside brush
          next.push(...ringsToPolys(diff, poly.type, poly.id));
        } catch (_e) {
          next.push(poly);
        }
      }
      if (brushMode === 'paint' && selectedBrush) {
        next.push({
          id: `brush_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: selectedBrush,
          points: circle[0].slice(0, -1).map(([x, y]) => ({ x, y })),
        });
      }
      return next;
    });
  }, [brushMode, brushRadius, selectedBrush]);

  // Merge all adjacent/overlapping polygons of the same type into one (or as
  // few as topologically possible). Runs polygon-clipping.union per type.
  // To bridge tiny floating-point gaps between adjacent stamps we briefly
  // inflate each ring by `bleed` units before unioning (no real geometric
  // expansion — just a coordinate snap that makes neighbouring rings share
  // boundaries cleanly).
  const mergeSameTypePolygons = useCallback(() => {
    if (!drawnPolygons.length) {
      toast.info('No hay polígonos para unir.');
      return;
    }
    const before = drawnPolygons.length;
    const byType = {};
    for (const p of drawnPolygons) {
      if (!byType[p.type]) byType[p.type] = [];
      byType[p.type].push(p);
    }
    // Bleed in MAP-% — 0.01% ≈ 2 map pixels = enough to bridge gaps from
    // snap rounding but small enough to not visibly distort the result.
    const BLEED = 0.01;
    const inflateRing = (poly) => {
      // Compute polygon centroid
      let cxSum = 0;
      let cySum = 0;
      for (const p of poly.points) {
        cxSum += p.x;
        cySum += p.y;
      }
      const cx = cxSum / poly.points.length;
      const cy = cySum / poly.points.length;
      // Move each vertex AWAY from centroid by BLEED units (radially)
      const expanded = poly.points.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return [p.x + (dx / len) * BLEED, p.y + (dy / len) * BLEED];
      });
      expanded.push(expanded[0]);
      return [expanded];
    };
    const merged = [];
    // First pass: collect all unioned-by-type results before clipping each
    // against the others, so the clipping uses the FINAL geometry of every
    // type (not the pre-union ones). Otherwise A unioned would still be
    // clipped against B's old fragments instead of B's union, which is fine
    // mathematically — but we already have direct access to "polys of type
    // X" so we just use them directly: clip the unified type against ALL
    // polygons whose type ≠ X. That guarantees the inflated union never
    // visually covers a polygon of a different type.
    for (const [type, polys] of Object.entries(byType)) {
      if (polys.length === 1) {
        merged.push(polys[0]);
        continue;
      }
      try {
        const rings = polys.map(inflateRing);
        let unified = polygonClipping.union(...rings);
        if (!unified || unified.length === 0) {
          merged.push(...polys);
          continue;
        }
        // Clip against ALL polygons of any other type — they always win.
        const otherTypeRings = drawnPolygons
          .filter((p) => p.type !== type)
          .map(polyToRing);
        if (otherTypeRings.length > 0) {
          try {
            unified = polygonClipping.difference(unified, ...otherTypeRings);
          } catch (e) {
            console.warn(`Difference vs other types failed for ${type}:`, e);
          }
        }
        if (unified && unified.length) {
          merged.push(...ringsToPolys(unified, type, `union_${type}`));
        } else {
          // The union was entirely covered by other-type polygons → drop it.
        }
      } catch (e) {
        console.warn(`Union failed for type ${type}:`, e);
        merged.push(...polys);
      }
    }
    if (merged.length === before) {
      toast.info(`Sin cambios: los ${before} polígonos no son contiguos.`);
      return;
    }
    pushHistory(merged);
    setDrawnPolygons(merged);
    toast.success(`Unidos: ${before} → ${merged.length} polígonos.`);
  }, [drawnPolygons, pushHistory]);

  // === Paint-bucket — Paint-style flood fill (Iter 117).
  //   Click behaviour:
  //   - Click on EMPTY space → fill the connected empty component that
  //     contains the click with `selectedBrush`. If the component touches
  //     the map borders, ask for confirmation (it would flood half the map).
  //   - Click on a polygon of the SAME type as `selectedBrush` → no-op
  //     (info toast).
  //   - Click on a polygon of a DIFFERENT type → confirm and CHANGE that
  //     polygon's type to `selectedBrush` (no new polygons created). ===
  const polyContainsPoint = useCallback((poly, px, py) => {
    // Ray-cast on the polygon's outer ring (we treat each polygon as a
    // single closed ring — our editor doesn't store explicit holes).
    let inside = false;
    const pts = poly.points;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const hit = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }, []);

  const fillBucketAt = useCallback((cx, cy) => {
    if (!selectedBrush) {
      toast.error('Selecciona primero un tipo de terreno o tierra.');
      return;
    }
    // Iterate in REVERSE so we hit the topmost polygon first (drawnPolygons
    // are rendered in array order; the last one is painted on top).
    let hit = null;
    for (let i = drawnPolygons.length - 1; i >= 0; i--) {
      if (polyContainsPoint(drawnPolygons[i], cx, cy)) {
        hit = drawnPolygons[i];
        break;
      }
    }

    // CASE A — clicked on a polygon already painted.
    if (hit) {
      if (hit.type === selectedBrush) {
        toast.info('Esta zona ya es de ese tipo.');
        return;
      }
      const colors = mode === 'terrain' ? TERRAIN_COLORS : LAND_TYPE_COLORS;
      const fromName = colors[hit.type]?.name || hit.type;
      const toName = colors[selectedBrush]?.name || selectedBrush;
      if (!window.confirm(`¿Cambiar esta zona de "${fromName}" a "${toName}"?`)) {
        return;
      }
      const updated = drawnPolygons.map((p) =>
        p.id === hit.id ? { ...p, type: selectedBrush } : p
      );
      pushHistory(updated);
      setDrawnPolygons(updated);
      toast.success(`Zona cambiada a "${toName}".`);
      return;
    }

    // CASE B — clicked on empty space. Flood fill the connected empty
    // component that contains (cx, cy).
    const bbox = [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]];
    let empty;
    try {
      if (drawnPolygons.length === 0) {
        empty = bbox.map((r) => [r]);
      } else {
        const rings = drawnPolygons.map(polyToRing);
        empty = polygonClipping.difference(bbox, ...rings);
      }
    } catch (_e) {
      toast.error('No se pudo calcular el hueco.');
      return;
    }
    if (!empty || empty.length === 0) {
      toast.info('El mapa está totalmente cubierto.');
      return;
    }
    // Ray-cast on a ring expressed as [[x,y]...].
    const ringContains = (ring, px, py) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const h = ((yi > py) !== (yj > py)) &&
          (px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi);
        if (h) inside = !inside;
      }
      return inside;
    };
    const touchesBorder = (ring) =>
      ring.some(([x, y]) => x <= 0.05 || x >= 99.95 || y <= 0.05 || y >= 99.95);
    // Find the component whose outer ring contains (cx,cy) AND none of
    // whose holes contains (cx,cy) — that's the actual empty pocket the
    // user clicked inside.
    let target = null;
    for (const poly of empty) {
      if (!ringContains(poly[0], cx, cy)) continue;
      const inHole = poly.slice(1).some((h) => ringContains(h, cx, cy));
      if (inHole) continue;
      target = poly;
      break;
    }
    if (!target) {
      // Shouldn't normally happen — click was reported in empty space.
      toast.info('No hay hueco bajo el cursor.');
      return;
    }
    const outerRing = target[0];
    const holes = target.slice(1);
    if (touchesBorder(outerRing)) {
      if (!window.confirm('El hueco bajo el cursor toca el borde del mapa (rellenará una zona muy grande). ¿Continuar?')) {
        return;
      }
    }
    // Build new fill polygon(s): outer ring minus any internal holes (which
    // correspond to existing polygons inside the pocket — we don't want to
    // cover them).
    let result;
    try {
      if (holes.length === 0) {
        result = [[outerRing]];
      } else {
        result = polygonClipping.difference([outerRing], ...holes.map((h) => [h]));
      }
    } catch (_e) {
      result = [[outerRing]];
    }
    const newPolys = [];
    result.forEach((poly, i) => {
      poly.forEach((ring, j) => {
        const cleaned = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
        if (cleaned.length < 3) return;
        newPolys.push({
          id: `bucket_${Date.now()}_${i}_${j}_${Math.random().toString(36).slice(2, 6)}`,
          type: selectedBrush,
          points: cleaned,
        });
      });
    });
    if (!newPolys.length) {
      toast.error('No se pudo construir el polígono de relleno.');
      return;
    }
    // "Newest wins" safety net: clip any existing polygon against the new
    // fill so no overlap remains. By construction this should be a no-op,
    // but we keep it for robustness on rounding edges.
    let working = drawnPolygons;
    for (const np of newPolys) {
      working = subtractWinnerFromOthers(working, np);
    }
    const next = [...working, ...newPolys];
    pushHistory(next);
    setDrawnPolygons(next);
    toast.success('Hueco rellenado.');
  }, [drawnPolygons, selectedBrush, pushHistory, polyContainsPoint, mode]);



  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load regions from database
        const regionsRes = await api.get('/data/regions');
        if (regionsRes.data) {
          setRegions(regionsRes.data.regions || regionsRes.data || []);
        }
        
        // Load roads
        const roadsRes = await api.get('/data/roads');
        if (roadsRes.data) {
          setRoads(roadsRes.data.roads || roadsRes.data || []);
        }
        
        // Load rivers
        const riversRes = await api.get('/data/rivers');
        if (riversRes.data) {
          setRivers(riversRes.data.rivers || riversRes.data || []);
        }
        
        // Load barriers
        const barriersRes = await api.get('/data/barriers');
        if (barriersRes.data) {
          setBarriers(barriersRes.data.barriers || barriersRes.data || []);
        }
        
        // Load terrain polygons (NOT cells - too slow)
        const terrainRes = await api.get('/data/terrain-polygons');
        if (terrainRes.data?.polygons && terrainRes.data.polygons.length > 0) {
          setDrawnPolygons(terrainRes.data.polygons);
          // Initialise history with the loaded state so the first action
          // can be undone back to the database state.
          setHistory([JSON.parse(JSON.stringify(terrainRes.data.polygons))]);
          setHistoryIndex(0);
          toast.success(`Cargados ${terrainRes.data.polygons.length} polígonos de terreno`);
        }
        
        // Don't load individual cells - too many, too slow
        // setPaintedCells is now only for temporary brush strokes
        
      } catch (err) {
        console.warn('Loading terrain data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Mouse handlers for pan / brush
  const handleMouseDown = (e) => {
    // Brush mode takes precedence: start a stroke and snapshot history
    if (e.button === 0 && brushMode) {
      const coords = screenToMap(e.clientX, e.clientY);
      setBrushPreStamp(drawnPolygons); // for history
      setBrushActive(true);
      applyBrushStamp(coords.x, coords.y);
      return;
    }
    // Allow pan with left click when NOT in polygon, erase, move, brush or bucket mode
    if (e.button === 0 && !polygonMode && !eraseMode && !movePolygonMode && !brushMode && !bucketMode) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (e.button === 2) {
      // Right click always allows pan
      e.preventDefault();
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (e.button === 1) {
      // Middle click also allows pan
      e.preventDefault();
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    // NOTE: legacy handler kept for backward compatibility; the active
    // listener bound to the container is handleMouseMoveForPaint, which
    // now also handles polygon-moving. Leaving this in case any future
    // overlay binds onto it.
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (movingPolygonId) {
      // After moving, the moved polygon is the "newest" → clip every other
      // polygon against its new footprint so no overlap remains.
      setDrawnPolygons((prev) => {
        const moved = prev.find((p) => p.id === movingPolygonId);
        if (!moved) return prev;
        const others = prev.filter((p) => p.id !== movingPolygonId);
        const clipped = subtractWinnerFromOthers(others, moved);
        const next = [...clipped, moved];
        pushHistory(next);
        return next;
      });
      toast.success('Polígono movido — recuerda Guardar para persistirlo.');
      setMovingPolygonId(null);
      setMoveStartCoords(null);
    }
    if (brushActive) {
      // Snapshot the BEFORE state so a whole brush stroke counts as 1 undo
      if (brushPreStamp) {
        pushHistory(drawnPolygons);
      }
      setBrushActive(false);
      setBrushPreStamp(null);
    }
  };

  // Wheel zoom - only when zoomMode is active
  const handleWheel = useCallback((e) => {
    if (!zoomMode) return; // Only zoom when zoom mode is active
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(20, Math.max(0.05, zoom * zoomFactor));
    setZoom(newZoom);
  }, [zoom, zoomMode]);

  // Convert screen to map coordinates
  const screenToMap = (screenX, screenY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    
    // Convert to percentage coordinates
    const xPercent = (x / MAP_PIXEL_WIDTH) * 100;
    const yPercent = ((MAP_PIXEL_HEIGHT - y) / MAP_PIXEL_HEIGHT) * 100;
    
    return { x: xPercent, y: yPercent };
  };

  // Get color config based on mode
  const getColorConfig = () => mode === 'terrain' ? TERRAIN_COLORS : LAND_TYPE_COLORS;
  const getZones = () => mode === 'terrain' ? terrainZones : landTypeZones;

  // Handle painting on map
  const handleMapClick = (e) => {
    // Paint-bucket has top priority — it handles clicks on EMPTY or PAINTED
    // areas with its own logic (fill / change type / no-op).
    if (bucketMode) {
      const coords = screenToMap(e.clientX, e.clientY);
      if (!coords) return;
      if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
      fillBucketAt(coords.x, coords.y);
      return;
    }
    // Check polygon mode first
    if (polygonMode) {
      if (!selectedBrush) {
        toast.info('Selecciona un color primero');
        return;
      }
      
      const coords = screenToMap(e.clientX, e.clientY);
      if (!coords) return;
      if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
      
      // Check if clicking near the first point to close the polygon.
      // We compare distance in SCREEN PIXELS (not map percent) so the
      // closure threshold feels the same regardless of the current zoom
      // level. Previously the threshold was 1.5% of the map which at
      // normal zoom is ~300 px — that auto-closed small polygons after
      // 3-4 clicks (Iter 107 bug fix).
      if (currentPolygon.length >= 3) {
        const firstPoint = currentPolygon[0];
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const fpMapX = (firstPoint.x / 100) * MAP_PIXEL_WIDTH;
          const fpMapY = MAP_PIXEL_HEIGHT - (firstPoint.y / 100) * MAP_PIXEL_HEIGHT;
          const fpScreenX = rect.left + pan.x + fpMapX * zoom;
          const fpScreenY = rect.top + pan.y + fpMapY * zoom;
          const sdx = e.clientX - fpScreenX;
          const sdy = e.clientY - fpScreenY;
          const pixelDist = Math.sqrt(sdx * sdx + sdy * sdy);
          // ~14 px = the radius of the rendered "1" marker.
          if (pixelDist < 14) {
            closePolygon();
            return;
          }
        }
      }
      
      // Add point to current polygon
      setCurrentPolygon(prev => [...prev, { x: coords.x, y: coords.y }]);
      return;
    }
    
    // Check eraser mode
    if (eraseMode) {
      if (isDragging) return;
      const coords = screenToMap(e.clientX, e.clientY);
      if (!coords) return;
      if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
      eraseCellsAt(coords);
      return;
    }
    
    // Solo pintar si el modo pincel está activo Y hay un brush seleccionado
    if (!paintMode || !selectedBrush) {
      if (paintMode && !selectedBrush) {
        toast.info('Selecciona un color primero');
      }
      return;
    }
    
    // Evitar pintar si estábamos haciendo drag
    if (isDragging) return;
    
    const coords = screenToMap(e.clientX, e.clientY);
    if (!coords) return;
    
    // Validar que las coordenadas estén dentro del mapa
    if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) {
      return;
    }
    
    // Cell size for precision (0.125% = 1/8 of original)
    const cellSize = 0.125; // 0.125% of map = ~2.5km per cell
    const centerX = Math.floor(coords.x / cellSize) * cellSize + cellSize / 2;
    const centerY = Math.floor(coords.y / cellSize) * cellSize + cellSize / 2;
    
    // Paint cells in a CIRCULAR pattern based on brush size
    const newCells = [];
    const radius = brushSize; // Radius in cells
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Check if this cell is within the circular brush
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          const cellX = Math.floor((centerX + dx * cellSize) / cellSize) * cellSize;
          const cellY = Math.floor((centerY + dy * cellSize) / cellSize) * cellSize;
          
          // Only add if within map bounds
          if (cellX >= 0 && cellX < 100 && cellY >= 0 && cellY < 100) {
            newCells.push({
              x: cellX,
              y: cellY,
              type: selectedBrush,
              size: cellSize
            });
          }
        }
      }
    }
    
    setPaintedCells(prev => {
      // Remove existing cells at same positions
      const filtered = prev.filter(c => 
        !newCells.some(nc => Math.abs(nc.x - c.x) < 0.01 && Math.abs(nc.y - c.y) < 0.01)
      );
      const updated = [...filtered, ...newCells];
      return updated;
    });
  };

  // Handle mouse drag for painting / polygon-moving / panning / brush.
  const handleMouseMoveForPaint = (e) => {
    // Update brush cursor preview position whenever brush mode is active
    if (brushMode) {
      const coords = screenToMap(e.clientX, e.clientY);
      setBrushCursor(coords);
      // Continuous stroke while mouse held
      if (brushActive) {
        applyBrushStamp(coords.x, coords.y);
        return;
      }
    }
    // 1) Moving a polygon takes precedence over everything else.
    if (movingPolygonId && moveStartCoords) {
      const coords = screenToMap(e.clientX, e.clientY);
      const dx = coords.x - moveStartCoords.x;
      const dy = coords.y - moveStartCoords.y;
      setDrawnPolygons(prev => prev.map(p => {
        if (p.id !== movingPolygonId) return p;
        return {
          ...p,
          points: p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })),
        };
      }));
      setMoveStartCoords(coords);
      return;
    }
    // 2) Pan when dragging and NOT in any drawing mode.
    if (isDragging && !polygonMode && !eraseMode && !movePolygonMode && !brushMode && !bucketMode) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Save terrain to database (polygons)
  const saveTerrainToDatabase = async () => {
    if (drawnPolygons.length === 0) {
      toast.error('No hay polígonos para guardar');
      return;
    }
    
    try {
      const response = await api.post('/data/terrain-polygons', {
        mode,
        polygons: drawnPolygons
      });
      toast.success(`${response.data.count} polígonos guardados en la base de datos`);
    } catch (err) {
      console.error('Error saving terrain:', err);
      toast.error('Error al guardar el terreno');
    }
  };

  // Export painted terrain as JSON file
  const exportPaintedTerrain = () => {
    const data = {
      mode,
      cells: paintedCells,
      polygons: drawnPolygons,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrain_${mode}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Terreno exportado a archivo');
  };

  // Close polygon and fill it with selected color
  const closePolygon = () => {
    if (currentPolygon.length < 3) {
      toast.error('El polígono necesita al menos 3 puntos');
      return;
    }
    
    // Add the completed polygon
    const newPolygon = {
      id: `poly_${Date.now()}`,
      type: selectedBrush,
      points: [...currentPolygon]
    };

    // "Newest wins": clip the new polygon out of every existing polygon so no
    // two zones overlap. The freshly drawn shape stays intact on top.
    const clippedOthers = subtractWinnerFromOthers(drawnPolygons, newPolygon);
    const nextPolys = [...clippedOthers, newPolygon];
    pushHistory(nextPolys);
    setDrawnPolygons(nextPolys);
    setCurrentPolygon([]);
    const dropped = drawnPolygons.length - clippedOthers.length;
    if (dropped > 0) {
      toast.success(`Polígono creado (${newPolygon.points.length} pts). Sobrescribió ${dropped} zona${dropped === 1 ? '' : 's'}.`);
    } else {
      toast.success(`Polígono creado con ${newPolygon.points.length} puntos`);
    }
  };

  // Cancel current polygon
  const cancelPolygon = () => {
    setCurrentPolygon([]);
    toast.info('Polígono cancelado');
  };

  // Undo last point in polygon
  const undoLastPoint = () => {
    if (currentPolygon.length > 0) {
      setCurrentPolygon(prev => prev.slice(0, -1));
    }
  };

  // Delete a drawn polygon
  const deletePolygon = (polygonId) => {
    pushHistory(drawnPolygons.filter(p => p.id !== polygonId));
    setDrawnPolygons(prev => prev.filter(p => p.id !== polygonId));
    toast.info('Polígono eliminado');
  };

  // Clear all local changes - with confirmation
  const clearPaintedCells = () => {
    if (drawnPolygons.length === 0 && currentPolygon.length === 0) {
      toast.info('No hay nada para borrar');
      return;
    }
    if (window.confirm(`¿Estás seguro de que quieres borrar ${drawnPolygons.length} polígonos locales?`)) {
      pushHistory([]);
      setDrawnPolygons([]);
      setCurrentPolygon([]);
      setPaintedCells([]);
      toast.info('Cambios locales eliminados');
    }
  };

  // Clear terrain from database - with confirmation
  const clearTerrainFromDatabase = async () => {
    if (!window.confirm('¿Estás seguro de que quieres ELIMINAR TODOS los polígonos de la base de datos? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await api.delete('/data/terrain-polygons');
      pushHistory([]);
      setDrawnPolygons([]);
      toast.success('Polígonos eliminados de la base de datos');
    } catch (err) {
      console.error('Error clearing terrain:', err);
      toast.error('Error al eliminar el terreno');
    }
  };

  // Erase cells at coordinate (eraser tool)
  const eraseCellsAt = (coords) => {
    const cellSize = 0.125;
    const centerX = Math.floor(coords.x / cellSize) * cellSize + cellSize / 2;
    const centerY = Math.floor(coords.y / cellSize) * cellSize + cellSize / 2;
    const radius = brushSize;
    
    setPaintedCells(prev => {
      return prev.filter(cell => {
        const cellCenterX = cell.x + cell.size / 2;
        const cellCenterY = cell.y + cell.size / 2;
        const dx = (cellCenterX - centerX) / cellSize;
        const dy = (cellCenterY - centerY) / cellSize;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > radius; // Keep cells outside the eraser radius
      });
    });
  };

  // Render painted cells - DISABLED for performance
  // Use polygons instead
  const renderPaintedCells = () => {
    // Don't render individual cells - too slow with many cells
    // Only render if there are very few (for brush preview)
    if (paintedCells.length > 100) return null;
    
    const colors = getColorConfig();
    return paintedCells.map((cell, idx) => {
      const config = colors[cell.type];
      if (!config) return null;
      
      const x = (cell.x / 100) * MAP_PIXEL_WIDTH;
      const y = MAP_PIXEL_HEIGHT - (cell.y / 100) * MAP_PIXEL_HEIGHT;
      const size = (cell.size / 100) * MAP_PIXEL_WIDTH;
      
      return (
        <rect
          key={`cell-${idx}`}
          x={x}
          y={y - size}
          width={size}
          height={size}
          fill={config.color}
          fillOpacity={0.7}
          stroke={config.color}
          strokeWidth={8}
          strokeOpacity={1}
        />
      );
    });
  };

  // Render drawn polygons
  const renderDrawnPolygons = () => {
    const colors = getColorConfig();
    return drawnPolygons.map((polygon) => {
      const config = colors[polygon.type];
      if (!config || !polygon.points || polygon.points.length < 3) return null;
      
      // Convert points to pixel coordinates
      const pointsStr = polygon.points.map(p => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${x},${y}`;
      }).join(' ');
      
      return (
        <polygon
          key={polygon.id}
          points={pointsStr}
          fill={config.color}
          fillOpacity={movingPolygonId === polygon.id ? 0.85 : 0.6}
          stroke={movingPolygonId === polygon.id ? '#ffd166' : config.color}
          strokeWidth={movingPolygonId === polygon.id ? 30 : 15}
          strokeOpacity={0.9}
          onMouseDown={(e) => {
            if (movePolygonMode) {
              e.stopPropagation();
              const coords = screenToMap(e.clientX, e.clientY);
              setMovingPolygonId(polygon.id);
              setMoveStartCoords(coords);
            }
          }}
          onClick={(e) => {
            if (eraseMode) {
              if (window.confirm('¿Eliminar este polígono?')) {
                deletePolygon(polygon.id);
              }
            } else if (movePolygonMode) {
              e.stopPropagation();
            }
          }}
          style={{
            cursor: movePolygonMode
              ? 'move'
              : eraseMode
              ? 'pointer'
              : 'default'
          }}
          data-testid={`terrain-polygon-${polygon.id}`}
        />
      );
    });
  };

  // Render current polygon being drawn
  const renderCurrentPolygon = () => {
    if (currentPolygon.length === 0) return null;
    
    const colors = getColorConfig();
    const config = colors[selectedBrush];
    const color = config?.color || '#ffffff';
    
    // Convert points to pixel coordinates
    const points = currentPolygon.map(p => ({
      x: (p.x / 100) * MAP_PIXEL_WIDTH,
      y: MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT
    }));
    
    return (
      <g>
        {/* Lines connecting points */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeDasharray="30,15"
            strokeOpacity={0.8}
          />
        )}
        
        {/* Line from last point to first (preview of closing) */}
        {points.length >= 3 && (
          <line
            x1={points[points.length - 1].x}
            y1={points[points.length - 1].y}
            x2={points[0].x}
            y2={points[0].y}
            stroke={color}
            strokeWidth={8}
            strokeDasharray="20,10"
            strokeOpacity={0.4}
          />
        )}
        
        {/* Points - smaller size */}
        {points.map((point, idx) => (
          <g key={idx}>
            <circle
              cx={point.x}
              cy={point.y}
              r={idx === 0 ? 40 : 25}
              fill={idx === 0 ? '#00ff00' : color}
              fillOpacity={0.9}
              stroke="#ffffff"
              strokeWidth={5}
            />
            <text
              x={point.x}
              y={point.y + 8}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={30}
              fontWeight="bold"
            >
              {idx + 1}
            </text>
          </g>
        ))}
      </g>
    );
  };

  // Render roads for editing
  const renderRoads = () => {
    return roads.map((road, idx) => {
      if (!road.puntos || road.puntos.length < 2) return null;
      
      const isSelected = selectedPiece?.type === 'road' && selectedPiece?.id === road.id;
      
      const pathD = road.puntos.map((p, i) => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={isSelected ? '#3b82f6' : '#8B4513'}
          strokeWidth={isSelected ? 50 : 30}
          strokeOpacity={0.7}
          strokeLinecap="round"
          style={{ cursor: editPieceMode === 'roads' ? 'pointer' : 'default' }}
          onClick={() => {
            if (editPieceMode === 'roads') {
              setSelectedPiece({ type: 'road', id: road.id, data: road });
              toast.info(`Seleccionado: ${road.nombre}`);
            }
          }}
        />
      );
    });
  };

  // Render rivers for editing
  const renderRivers = () => {
    return rivers.map((river, idx) => {
      if (!river.puntos || river.puntos.length < 2) return null;
      
      const isSelected = selectedPiece?.type === 'river' && selectedPiece?.id === river.id;
      
      const pathD = river.puntos.map((p, i) => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={isSelected ? '#22d3ee' : '#3b82f6'}
          strokeWidth={isSelected ? 60 : 40}
          strokeOpacity={0.7}
          strokeLinecap="round"
          style={{ cursor: editPieceMode === 'rivers' ? 'pointer' : 'default' }}
          onClick={() => {
            if (editPieceMode === 'rivers') {
              setSelectedPiece({ type: 'river', id: river.id, data: river });
              toast.info(`Seleccionado: ${river.nombre}`);
            }
          }}
        />
      );
    });
  };

  // Render barriers for editing
  const renderBarriers = () => {
    return barriers.map((barrier, idx) => {
      if (!barrier.puntos || barrier.puntos.length < 2) return null;
      
      const isSelected = selectedPiece?.type === 'barrier' && selectedPiece?.id === barrier.id;
      
      const pathD = barrier.puntos.map((p, i) => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={isSelected ? '#f87171' : '#6b7280'}
          strokeWidth={isSelected ? 70 : 50}
          strokeOpacity={0.8}
          strokeLinecap="round"
          strokeDasharray="100,50"
          style={{ cursor: editPieceMode === 'barriers' ? 'pointer' : 'default' }}
          onClick={() => {
            if (editPieceMode === 'barriers') {
              setSelectedPiece({ type: 'barrier', id: barrier.id, data: barrier });
              toast.info(`Seleccionado: ${barrier.nombre || `Barrera ${idx + 1}`}`);
            }
          }}
        />
      );
    });
  };

  // Render zones on map
  const renderZones = () => {
    const zones = getZones();
    const colors = getColorConfig();
    
    return zones.map((zone, idx) => {
      const config = colors[zone.type];
      if (!config || !zone.polygon || zone.polygon.length < 3) return null;
      
      // Convert percentage to pixels
      const points = zone.polygon.map(p => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${x},${y}`;
      }).join(' ');
      
      return (
        <polygon
          key={idx}
          points={points}
          fill={config.color}
          fillOpacity={0.4}
          stroke={config.color}
          strokeWidth={50}
          strokeOpacity={0.8}
        />
      );
    });
  };

  // Render regions from database
  const renderRegions = () => {
    return regions.map((region, idx) => {
      if (!region.poligono || region.poligono.length < 3) return null;
      
      // Determine color based on tipo_tierra or terreno
      const terrainType = region.terreno || 'moderado';
      const landType = region.tipo_tierra || 'tierras_libres';
      
      const colors = mode === 'terrain' ? TERRAIN_COLORS : LAND_TYPE_COLORS;
      const key = mode === 'terrain' ? terrainType : landType;
      const config = colors[key] || colors[Object.keys(colors)[0]];
      
      // Convert percentage to pixels
      const points = region.poligono.map(p => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${x},${y}`;
      }).join(' ');
      
      // Calculate centroid for label
      const centroidX = region.poligono.reduce((sum, p) => sum + (p.x / 100) * MAP_PIXEL_WIDTH, 0) / region.poligono.length;
      const centroidY = region.poligono.reduce((sum, p) => sum + (MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT), 0) / region.poligono.length;
      
      return (
        <g key={idx}>
          <polygon
            points={points}
            fill={config.color}
            fillOpacity={0.35}
            stroke={config.color}
            strokeWidth={30}
            strokeOpacity={0.7}
          />
          {zoom > 0.04 && (
            <text
              x={centroidX}
              y={centroidY}
              textAnchor="middle"
              fill="#fff"
              fontSize={300}
              fontWeight="bold"
              stroke="#000"
              strokeWidth={20}
              paintOrder="stroke"
            >
              {region.nombre}
            </text>
          )}
        </g>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--parchment-dark))] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[hsl(var(--gold))] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Cargando datos de terrenos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[hsl(var(--parchment-dark))] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[hsl(var(--gold))]/20 bg-black/40 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-xl font-bold text-[hsl(var(--gold))]">
              Editor de Terrenos
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Mode selector */}
            <Tabs value={mode} onValueChange={(newMode) => {
              setMode(newMode);
              // Switch painted cells based on mode
              if (newMode === 'terrain') {
                setPaintedCells(terrainZones);
              } else {
                setPaintedCells(landTypeZones);
              }
              setSelectedBrush(null);
            }}>
              <TabsList>
                <TabsTrigger value="terrain">Dificultad</TabsTrigger>
                <TabsTrigger value="landType">Tipo de Tierra</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.05, z * 0.8))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm w-20 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(20, z * 1.25))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button 
                variant={zoomMode ? "default" : "outline"} 
                size="sm" 
                onClick={() => {
                  setZoomMode(!zoomMode);
                  if (!zoomMode) {
                    toast.info('Modo zoom activado. Usa la rueda del ratón para hacer zoom.');
                  }
                }}
                className={zoomMode ? 'bg-purple-600' : ''}
                title="Activar zoom con rueda del ratón"
              >
                🔍
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setZoom(0.05); setPan({ x: 0, y: 0 }); }}>
                <Move className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend and Tools */}
      <div className="p-3 bg-black/30 border-b border-[hsl(var(--gold))]/10 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {/* Color Legend / Brush Selection */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(getColorConfig()).map(([key, config]) => (
              <Badge 
                key={key}
                className={`cursor-pointer transition-all ${
                  selectedBrush === key ? 'ring-2 ring-white scale-110' : ''
                }`}
                style={{ 
                  backgroundColor: config.color + (selectedBrush === key ? 'ff' : '40'),
                  borderColor: config.color,
                  color: '#fff'
                }}
                title={config.description}
                onClick={() => {
                  // Permitir seleccionar brush siempre, y activar paintMode automáticamente
                  if (selectedBrush === key) {
                    setSelectedBrush(null);
                  } else {
                    setSelectedBrush(key);
                    if (!paintMode) {
                      setPaintMode(true);
                      toast.info(`Pincel ${config.name} activado. Haz clic en el mapa para pintar.`);
                    }
                  }
                }}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: config.color }}
                />
                {config.name}
              </Badge>
            ))}
          </div>
          
          {/* Tools - Polygon based */}
          <div className="flex items-center gap-2">
            <Button
              variant={polygonMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPolygonMode(!polygonMode);
                setEraseMode(false);
                setMovePolygonMode(false);
                setBucketMode(false);
                if (!polygonMode) {
                  toast.info('Modo polígono activado. Haz clic para poner puntos. Cierra haciendo clic cerca del primer punto (verde).');
                }
              }}
              className={polygonMode ? 'bg-green-600' : ''}
            >
              <Plus className="w-4 h-4 mr-1" />
              Dibujar Zona
            </Button>
            
            <Button
              variant={eraseMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEraseMode(!eraseMode);
                setPolygonMode(false);
                setMovePolygonMode(false);
                setBucketMode(false);
                if (!eraseMode) {
                  toast.info('Modo borrar activado. Haz clic en un polígono para eliminarlo.');
                }
              }}
              className={eraseMode ? 'bg-pink-600' : ''}
            >
              <Eraser className="w-4 h-4 mr-1" />
              Borrar
            </Button>

            <Button
              variant={movePolygonMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMovePolygonMode(!movePolygonMode);
                setEraseMode(false);
                setPolygonMode(false);
                setBrushMode(null);
                setBucketMode(false);
                if (!movePolygonMode) {
                  toast.info('Modo mover activado. Arrastra un polígono para reposicionarlo.');
                }
              }}
              className={movePolygonMode ? 'bg-amber-600' : ''}
              data-testid="terrain-move-mode-btn"
            >
              <Move className="w-4 h-4 mr-1" />
              Mover
            </Button>

            {/* === BRUSH MODES (Iter 107) === */}
            <Button
              variant={brushMode === 'erase' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const next = brushMode === 'erase' ? null : 'erase';
                setBrushMode(next);
                setEraseMode(false);
                setPolygonMode(false);
                setMovePolygonMode(false);
                setBucketMode(false);
                if (next === 'erase') {
                  toast.info('Pincel BORRAR activado. Pinta sobre las zonas a recortar.');
                }
              }}
              className={brushMode === 'erase' ? 'bg-rose-700' : ''}
              data-testid="terrain-brush-erase-btn"
              title="Pincel: recorta trozos de polígonos existentes"
            >
              <Eraser className="w-4 h-4 mr-1" />
              Pincel borrar
            </Button>
            <Button
              variant={brushMode === 'paint' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (!selectedBrush) {
                  toast.error('Selecciona primero un tipo de terreno o tierra.');
                  return;
                }
                const next = brushMode === 'paint' ? null : 'paint';
                setBrushMode(next);
                setEraseMode(false);
                setPolygonMode(false);
                setMovePolygonMode(false);
                setBucketMode(false);
                if (next === 'paint') {
                  toast.info(`Pincel PINTAR activado con "${selectedBrush}". Pinta encima para reemplazar.`);
                }
              }}
              className={brushMode === 'paint' ? 'bg-emerald-700' : ''}
              data-testid="terrain-brush-paint-btn"
              title="Pincel: pinta encima reemplazando lo que haya"
              disabled={!selectedBrush}
            >
              <Paintbrush className="w-4 h-4 mr-1" />
              Pincel pintar
            </Button>

            {/* === PAINT BUCKET (Iter 117) — toggle mode, Paint-style.
                  Click on empty hole = flood fill that hole.
                  Click on polygon = confirm change-type. === */}
            <Button
              variant={bucketMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (!selectedBrush && !bucketMode) {
                  toast.error('Selecciona primero un tipo de terreno o tierra.');
                  return;
                }
                const next = !bucketMode;
                setBucketMode(next);
                if (next) {
                  setEraseMode(false);
                  setPolygonMode(false);
                  setMovePolygonMode(false);
                  setBrushMode(null);
                  toast.info(`Bote activado con "${selectedBrush}". Clic en un hueco para rellenar, o sobre una zona para cambiar su tipo.`);
                }
              }}
              className={bucketMode ? 'bg-sky-700' : ''}
              data-testid="terrain-bucket-btn"
              title="Bote de pintura: clic en hueco vacío para rellenarlo, clic en zona pintada para cambiar su tipo"
              disabled={!selectedBrush && !bucketMode}
            >
              <Droplet className="w-4 h-4 mr-1" />
              Bote
            </Button>

            {brushMode && (
              <div className="flex items-center gap-2 text-xs bg-black/40 px-2 py-1 rounded">
                <span className="text-amber-300">Radio:</span>
                <input
                  type="range"
                  min="0.2"
                  max="5"
                  step="0.1"
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
                  data-testid="terrain-brush-radius-slider"
                  className="w-24 accent-amber-500"
                />
                <span className="text-amber-200 font-mono w-10 text-right">
                  {brushRadius.toFixed(1)}%
                </span>
              </div>
            )}
            
            {/* Info display */}
            <div className="flex items-center gap-2 text-xs bg-black/40 px-2 py-1 rounded">
              <span>Polígonos: <span className="text-amber-400 font-bold">{drawnPolygons.length}</span></span>
            </div>

            {/* Merge same-type polygons (Iter 107) */}
            <Button
              size="sm"
              variant="outline"
              onClick={mergeSameTypePolygons}
              disabled={drawnPolygons.length < 2}
              title="Une polígonos del mismo color que se toquen o solapen"
              data-testid="terrain-merge-btn"
              className="border-indigo-500/60 text-indigo-200 hover:bg-indigo-900/30"
            >
              ⛓ Unir polígonos
            </Button>

            {/* Undo / Redo */}
            <Button
              size="sm"
              variant="outline"
              onClick={undo}
              disabled={!canUndo}
              title="Deshacer (Ctrl+Z)"
              data-testid="terrain-undo-btn"
            >
              ↶ Deshacer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={redo}
              disabled={!canRedo}
              title="Rehacer (Ctrl+Y)"
              data-testid="terrain-redo-btn"
            >
              ↷ Rehacer
            </Button>
            
            {/* Polygon mode controls */}
            {polygonMode && currentPolygon.length > 0 && (
              <>
                <div className="text-xs bg-green-900/40 px-2 py-1 rounded">
                  Puntos: <span className="text-white font-bold">{currentPolygon.length}</span>
                </div>
                <Button size="sm" variant="outline" onClick={undoLastPoint} title="Deshacer último punto">
                  ↩
                </Button>
                <Button size="sm" variant="outline" onClick={cancelPolygon} title="Cancelar">
                  ✕
                </Button>
                {currentPolygon.length >= 3 && (
                  <Button size="sm" variant="default" onClick={closePolygon} className="bg-green-600" title="Cerrar polígono">
                    ✓ Cerrar
                  </Button>
                )}
              </>
            )}
            
            {/* Save/Export buttons */}
            <div className="h-6 w-px bg-gray-600 mx-1" />
            <Button variant="outline" size="sm" onClick={exportPaintedTerrain} title="Exportar a JSON">
              <Download className="w-4 h-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={saveTerrainToDatabase}
              className="bg-green-600 hover:bg-green-700"
              title="Guardar en base de datos"
              disabled={drawnPolygons.length === 0}
            >
              <Save className="w-4 h-4 mr-1" />
              Guardar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearPaintedCells}
              title="Limpiar todo local"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <div className="h-6 w-px bg-gray-600 mx-2" />
            
            {/* Piece editing */}
            <Button
              variant={editPieceMode === 'roads' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'roads' ? null : 'roads');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'roads' ? 'bg-amber-600' : ''}
            >
              Caminos ({roads.length})
            </Button>
            <Button
              variant={editPieceMode === 'barriers' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'barriers' ? null : 'barriers');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'barriers' ? 'bg-gray-600' : ''}
            >
              Barreras ({barriers.length})
            </Button>
            <Button
              variant={editPieceMode === 'rivers' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'rivers' ? null : 'rivers');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'rivers' ? 'bg-blue-600' : ''}
            >
              Ríos ({rivers.length})
            </Button>
          </div>
        </div>
        
        {/* Selected piece info */}
        {selectedPiece && (
          <div className="mt-2 p-2 bg-blue-900/30 rounded text-sm">
            <span className="font-bold">Seleccionado:</span> {selectedPiece.data?.nombre || 'Sin nombre'}
            <Button size="sm" variant="ghost" className="ml-2" onClick={() => setSelectedPiece(null)}>
              Deseleccionar
            </Button>
          </div>
        )}
        
        {/* List of elements when in edit mode */}
        {editPieceMode && (
          <div className="mt-2 p-2 bg-black/40 rounded max-h-32 overflow-y-auto">
            <div className="text-xs text-amber-400 mb-1 font-bold">
              {editPieceMode === 'roads' && `Caminos (${roads.length})`}
              {editPieceMode === 'barriers' && `Barreras (${barriers.length})`}
              {editPieceMode === 'rivers' && `Ríos (${rivers.length})`}
            </div>
            <div className="flex flex-wrap gap-1">
              {editPieceMode === 'roads' && roads.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay caminos definidos</span>
              )}
              {editPieceMode === 'roads' && roads.slice(0, 15).map((road, idx) => (
                <Badge 
                  key={idx} 
                  variant={selectedPiece?.data?.id === road.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    setSelectedPiece({ type: 'road', id: road.id, data: road });
                    toast.info(`Seleccionado: ${road.nombre}`);
                  }}
                >
                  {road.nombre}
                </Badge>
              ))}
              {editPieceMode === 'roads' && roads.length > 15 && (
                <span className="text-xs text-muted-foreground">+{roads.length - 15} más</span>
              )}
              {editPieceMode === 'rivers' && rivers.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay ríos definidos</span>
              )}
              {editPieceMode === 'rivers' && rivers.slice(0, 15).map((river, idx) => (
                <Badge 
                  key={idx}
                  variant={selectedPiece?.data?.id === river.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    setSelectedPiece({ type: 'river', id: river.id, data: river });
                    toast.info(`Seleccionado: ${river.nombre}`);
                  }}
                >
                  {river.nombre}
                </Badge>
              ))}
              {editPieceMode === 'barriers' && barriers.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay barreras definidas</span>
              )}
              {editPieceMode === 'barriers' && barriers.slice(0, 15).map((barrier, idx) => (
                <Badge 
                  key={idx}
                  variant={selectedPiece?.data?.id === barrier.id ? "default" : "outline"}
                  className="cursor-pointer text-xs bg-gray-700"
                  onClick={() => {
                    setSelectedPiece({ type: 'barrier', id: barrier.id, data: barrier });
                    toast.info(`Seleccionado: ${barrier.nombre || `Barrera ${idx + 1}`}`);
                  }}
                >
                  {barrier.nombre || `Barrera ${idx + 1}`}
                </Badge>
              ))}
              {editPieceMode === 'barriers' && barriers.length > 15 && (
                <span className="text-xs text-muted-foreground">+{barriers.length - 15} más</span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Map Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-hidden ${bucketMode || polygonMode ? 'cursor-crosshair' : eraseMode ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ backgroundColor: '#1a1510' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveForPaint}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleMapClick}
      >
        <svg
          ref={svgRef}
          width={MAP_PIXEL_WIDTH}
          height={MAP_PIXEL_HEIGHT}
          viewBox={`0 0 ${MAP_PIXEL_WIDTH} ${MAP_PIXEL_HEIGHT}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          {/* 1. Map background image - MAPA DEL MAESTRO */}
          <image
            href={MAESTRO_MAP_URL}
            x={0}
            y={0}
            width={MAP_PIXEL_WIDTH}
            height={MAP_PIXEL_HEIGHT}
            preserveAspectRatio="none"
            opacity={0.7}
          />
          
          {/* 2. Semi-transparent overlay to soften the map slightly */}
          <rect
            x={0}
            y={0}
            width={MAP_PIXEL_WIDTH}
            height={MAP_PIXEL_HEIGHT}
            fill="#1a1510"
            fillOpacity={0.25}
          />
          
          {/* 3. Grid overlay - 800 divisions (8x more precise) */}
          <defs>
            <pattern id="gridPattern" width={MAP_PIXEL_WIDTH / 800} height={MAP_PIXEL_HEIGHT / 800} patternUnits="userSpaceOnUse">
              <rect width={MAP_PIXEL_WIDTH / 800} height={MAP_PIXEL_HEIGHT / 800} fill="none" stroke="#c9a227" strokeWidth="1" strokeOpacity="0.25"/>
            </pattern>
            <pattern id="gridPatternLarge" width={MAP_PIXEL_WIDTH / 100} height={MAP_PIXEL_HEIGHT / 100} patternUnits="userSpaceOnUse">
              <rect width={MAP_PIXEL_WIDTH / 100} height={MAP_PIXEL_HEIGHT / 100} fill="none" stroke="#c9a227" strokeWidth="4" strokeOpacity="0.5"/>
            </pattern>
          </defs>
          <rect width={MAP_PIXEL_WIDTH} height={MAP_PIXEL_HEIGHT} fill="url(#gridPattern)" />
          <rect width={MAP_PIXEL_WIDTH} height={MAP_PIXEL_HEIGHT} fill="url(#gridPatternLarge)" />
          
          {/* 4. Render regions from database */}
          {renderRegions()}
          
          {/* 5. Render custom zones */}
          {renderZones()}
          
          {/* 6. Render roads */}
          {renderRoads()}
          
          {/* 6b. Render rivers */}
          {renderRivers()}
          
          {/* 6c. Render barriers */}
          {renderBarriers()}
          
          {/* 7. Render painted cells */}
          {renderPaintedCells()}
          
          {/* 8. Render drawn polygons */}
          {renderDrawnPolygons()}
          
          {/* 9. Render current polygon being drawn */}
          {renderCurrentPolygon()}

          {/* 10. Brush cursor preview (Iter 107) */}
          {brushMode && brushCursor && (
            <circle
              cx={(brushCursor.x / 100) * MAP_PIXEL_WIDTH}
              cy={MAP_PIXEL_HEIGHT - (brushCursor.y / 100) * MAP_PIXEL_HEIGHT}
              r={(brushRadius / 100) * MAP_PIXEL_WIDTH}
              fill={brushMode === 'erase' ? 'rgba(244,63,94,0.18)' : 'rgba(16,185,129,0.20)'}
              stroke={brushMode === 'erase' ? '#f43f5e' : '#10b981'}
              strokeWidth={20 / zoom}
              strokeDasharray={`${40 / zoom} ${40 / zoom}`}
              style={{ pointerEvents: 'none' }}
              data-testid="terrain-brush-cursor"
            />
          )}
        </svg>
      </div>
      
      {/* Info Panel */}
      <div className="p-3 bg-black/40 border-t border-[hsl(var(--gold))]/20">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            {polygonMode 
              ? `Modo Polígono: ${selectedBrush ? getColorConfig()[selectedBrush]?.name : 'Selecciona un color'} | Puntos: ${currentPolygon.length} | Polígonos: ${drawnPolygons.length}`
              : paintMode 
                ? `Modo Pincel: ${selectedBrush ? getColorConfig()[selectedBrush]?.name : 'Selecciona un color'} | Tamaño: ${brushSize} celdas`
                : eraseMode
                  ? 'Modo Goma: Haz clic para borrar celdas o polígonos'
                  : mode === 'terrain' 
                    ? 'Mapa de Dificultad del Terreno - Selecciona una herramienta'
                    : 'Mapa de Tipos de Tierra - Selecciona una herramienta'
            }
          </p>
          <p className="text-xs mt-1">
            Escala: 1 celda ≈ 2.5 km | Celdas pintadas: {paintedCells.length} | Zoom máx: 2000%
          </p>
        </div>
      </div>
    </div>
  );
};

export default TerrainEditor;
