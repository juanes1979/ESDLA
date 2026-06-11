/**
 * MapPickDialog — full-screen empty map picker with impassable-zone overlay.
 *
 * Lets the user click ANY non-blocked point of the map. Impassable terrain
 * (`infranqueable`, `agua`) is rendered as a translucent red polygon overlay
 * fetched from `/api/data/terrain-polygons`. Clicks inside such zones are
 * rejected with a toast.
 *
 * The marker is dropped at the EXACT click position (no snap to known
 * locations). A nearest-location lookup is used silently to inherit a
 * region for climate/terrain calculations.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Crosshair, MapPin, X as XIcon, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { PLAYER_MAP_URL } from '@/config/mapAssets';

const MAP_SRC = PLAYER_MAP_URL;
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.25;

// Polygon types that should be visually blocked / non-clickable.
const BLOCKED_TYPES = new Set(['infranqueable', 'agua']);

// Ray-casting point-in-polygon test. `points` is an array of {x, y} in the
// same (percentage) coordinate system as the click.
function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const MapPickDialog = ({
  open,
  onClose,
  locations = [],
  target = 'origen', // 'origen' | 'destino'
  onPick,
}) => {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // px offset from center
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const moved = useRef(false);
  const [picked, setPicked] = useState(null); // { x, y, region }
  const [blockedPolys, setBlockedPolys] = useState([]); // [{type, points:[{x,y}]}]
  // Force re-render when image loads / pan / zoom change so the SVG overlay
  // and marker re-anchor to the image's fresh bounding rect.
  const [, setMeasureTick] = useState(0);
  const measure = () => setMeasureTick((t) => t + 1);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setPicked(null);
      // Fetch impassable / water polygons to draw a red overlay and reject
      // clicks inside them.
      (async () => {
        try {
          const res = await api.get('/data/terrain-polygons');
          const polys = (res.data?.polygons || []).filter(
            (p) => BLOCKED_TYPES.has(p.type),
          );
          setBlockedPolys(polys);
        } catch {
          setBlockedPolys([]);
        }
      })();
    }
  }, [open]);

  // Re-measure on window resize so the overlay stays aligned in fullscreen
  // / responsive layouts.
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  // ResizeObserver on the image so the SVG overlay re-anchors whenever the
  // rendered image size changes (load, layout shifts, container resize).
  useEffect(() => {
    if (!open || !imgRef.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const ro = new ResizeObserver(() => measure());
    ro.observe(imgRef.current);
    return () => ro.disconnect();
  }, [open]);

  // CSS `transform: scale()` doesn't change the layout box, so the
  // ResizeObserver above never fires when zooming. Force a re-measure
  // (after the DOM commit) every time zoom/pan changes so the SVG
  // overlay and marker re-anchor to the image's new bounding rect.
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [zoom, pan, open]);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * ZOOM_STEP;
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)));
  };

  const onMouseDown = (e) => {
    setDragging(true);
    moved.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    setPan({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  };

  const onMouseUp = (e) => {
    setDragging(false);
    if (moved.current) return;
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const imgX = e.clientX - rect.left;
    const imgY = e.clientY - rect.top;
    if (imgX < 0 || imgY < 0 || imgX > rect.width || imgY > rect.height) return;
    // IMPORTANT: the project-wide coordinate system uses Y=0 at the BOTTOM
    // of the map and Y=100 at the TOP (see JourneyMiniMap.jsx). The screen
    // however measures Y from the top, so we MUST flip the Y axis to keep
    // every coordinate (clicks, marker, polygons, payload) in the same
    // convention as `db.locations.y` and `db.terrain_polygons[i].y`.
    const xPct = (imgX / rect.width) * 100;
    const yPct = 100 - (imgY / rect.height) * 100;

    // Reject clicks inside an impassable / water polygon.
    for (const poly of blockedPolys) {
      if (pointInPolygon(xPct, yPct, poly.points || [])) {
        const label = poly.type === 'agua' ? 'agua' : 'zona infranqueable';
        toast.error(`No puedes elegir ese punto: está sobre ${label}.`);
        return;
      }
    }

    // Closest known location for region inheritance (silent).
    let nearest = null;
    let bestDistSq = Infinity;
    for (const loc of locations) {
      if (loc.x == null || loc.y == null) continue;
      const dx = loc.x - xPct;
      const dy = loc.y - yPct;
      const d = dx * dx + dy * dy;
      if (d < bestDistSq) {
        bestDistSq = d;
        nearest = loc;
      }
    }
    setPicked({
      x: xPct,
      y: yPct,
      region: nearest?.region || '',
      claseRegion: nearest?.clase_region || nearest?.tipo_tierra || '',
    });
  };

  const handleConfirm = () => {
    if (!picked) return;
    const { x, y, region, claseRegion } = picked;
    const xs = x.toFixed(1);
    const ys = y.toFixed(1);
    onPick?.({
      id: `custom:${xs},${ys}`,
      nombre: `Punto en el mapa (${xs}, ${ys})`,
      x,
      y,
      region,
      clase_region: claseRegion,
      custom: true,
    });
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent
        className="max-w-[96vw] w-[96vw] h-[90vh] flex flex-col p-3 gap-2"
        data-testid="mappick-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[hsl(var(--gold))]" />
            Marca en el mapa el {target === 'origen' ? 'punto de partida' : 'destino'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>Arrastra para mover, rueda para hacer zoom. Haz clic en cualquier
            punto del mapa para fijarlo como {target === 'origen' ? 'origen' : 'destino'}.</span>
            <span className="inline-flex items-center gap-1 text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              Las zonas en rojo son infranqueables (agua / barreras) y no se pueden seleccionar.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              data-testid="mappick-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center" data-testid="mappick-zoom">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              data-testid="mappick-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="ml-2"
              data-testid="mappick-reset"
            >
              <Crosshair className="w-4 h-4 mr-1" />
              Centrar
            </Button>
          </div>
          {picked && (
            <div className="text-xs text-emerald-300" data-testid="mappick-selected">
              Coordenadas: <strong className="text-emerald-200">{picked.x.toFixed(1)}, {picked.y.toFixed(1)}</strong>
              {picked.region && <span className="text-muted-foreground"> · región: {picked.region}</span>}
            </div>
          )}
        </div>

        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden rounded-lg border-2 border-[hsl(var(--gold))/40] bg-black/40 select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => setDragging(false)}
          style={{ cursor: dragging ? 'grabbing' : 'crosshair' }}
          data-testid="mappick-canvas"
        >
          {/* Image + impassable overlay share the SAME absolute positioning
              and transform so the SVG polygons line up exactly with the
              underlying map. The SVG uses viewBox 0-100 which matches the
              percentage coordinate system used for clicks and polygons. */}
          <img
            ref={imgRef}
            src={MAP_SRC}
            alt="Mapa de la Tierra Media"
            draggable="false"
            onLoad={measure}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: '100%',
              maxHeight: '100%',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
          {/* Impassable / water overlay — anchored to the image's real on-
              screen bounding rect (post-transform), so it stays in sync with
              both pan and zoom. The SVG flips Y because polygon coords use
              Y=0 at the BOTTOM (project convention) while SVG uses Y=0 at
              the TOP. */}
          {blockedPolys.length > 0 && imgRef.current && containerRef.current && (() => {
            const imgRect = imgRef.current.getBoundingClientRect();
            const ctRect = containerRef.current.getBoundingClientRect();
            return (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  left: imgRect.left - ctRect.left,
                  top: imgRect.top - ctRect.top,
                  width: imgRect.width,
                  height: imgRect.height,
                  pointerEvents: 'none',
                }}
                data-testid="mappick-blocked-overlay"
              >
                {/* g transform: flip Y so polygon (x, y) with y=0 at bottom
                    renders correctly on screen (where 0 is at top). */}
                <g transform="scale(1, -1) translate(0, -100)">
                  {blockedPolys.map((p, idx) => (
                    <polygon
                      key={p.id || idx}
                      points={(p.points || []).map((pt) => `${pt.x},${pt.y}`).join(' ')}
                      fill="rgba(220, 38, 38, 0.32)"
                      stroke="rgba(220, 38, 38, 0.75)"
                      strokeWidth="0.15"
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              </svg>
            );
          })()}

          {/* Click marker — anchored to image's real on-screen rect. The
              picked.y uses the project convention (Y=0 at the BOTTOM) so
              we flip it to map onto screen pixels (Y=0 at the TOP). */}
          {picked && imgRef.current && containerRef.current && (() => {
            const imgRect = imgRef.current.getBoundingClientRect();
            const ctRect = containerRef.current.getBoundingClientRect();
            const px = (imgRect.left - ctRect.left) + (picked.x / 100) * imgRect.width;
            const py = (imgRect.top - ctRect.top) + ((100 - picked.y) / 100) * imgRect.height;
            return (
              <div
                style={{
                  position: 'absolute',
                  left: px - 10,
                  top: py - 10,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'rgba(220, 38, 38, 0.9)',
                  border: '3px solid #fff',
                  boxShadow: '0 0 14px rgba(220, 38, 38, 0.85)',
                  pointerEvents: 'none',
                }}
                data-testid="mappick-marker"
              />
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="mappick-cancel">
            <XIcon className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!picked}
            className="bg-[hsl(var(--gold))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--gold-dim))]"
            data-testid="mappick-confirm"
          >
            <MapPin className="w-4 h-4 mr-1" />
            Fijar como {target === 'origen' ? 'origen' : 'destino'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MapPickDialog;
