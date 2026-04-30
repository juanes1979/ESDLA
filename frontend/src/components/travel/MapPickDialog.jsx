/**
 * MapPickDialog — full-screen empty map picker.
 *
 * Shows the raw Middle-earth player map (no markers) and lets the user
 * click a point. The closest known location is computed and returned via
 * `onPick({ id, nombre, region, x, y, distancePct })`.
 *
 * UX:
 *  - Click + drag to pan
 *  - Mouse wheel to zoom (1× → 6×)
 *  - Click without dragging to select the point
 *  - "Reset" button restores zoom 1× / center
 *  - Single dot marker shows the snapped location after pick (preview).
 *
 * The component is "vacío total" by request — no labels, no icons.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Crosshair, MapPin, X as XIcon } from 'lucide-react';

const MAP_SRC = '/mapa_jugadores.jpg';
const NATURAL_W = 1920;
const NATURAL_H = 1080;
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.25;

const distanceSq = (a, b) => {
  const dx = (a.x - b.x);
  const dy = (a.y - b.y);
  return dx * dx + dy * dy;
};

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
  const [snapped, setSnapped] = useState(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setSnapped(null);
    }
  }, [open]);

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
    if (moved.current) return; // it was a drag, not a click
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Click position relative to container
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    // Center of container
    const ccx = rect.width / 2;
    const ccy = rect.height / 2;
    // Map coordinates: derived from displayed pan/zoom
    // Displayed image dimensions:
    const displayW = rect.width * zoom;
    const displayH = (rect.width * zoom) * (NATURAL_H / NATURAL_W);
    // Top-left of the displayed image relative to container
    const imgLeft = (rect.width - displayW) / 2 + pan.x;
    const imgTop = (rect.height - displayH) / 2 + pan.y;
    const imgX = cx - imgLeft;
    const imgY = cy - imgTop;
    if (imgX < 0 || imgY < 0 || imgX > displayW || imgY > displayH) return;
    const xPct = (imgX / displayW) * 100;
    const yPct = (imgY / displayH) * 100;
    // Snap to nearest known location
    let best = null;
    let bestDistSq = Infinity;
    for (const loc of locations) {
      if (loc.x == null || loc.y == null) continue;
      const d = distanceSq({ x: loc.x, y: loc.y }, { x: xPct, y: yPct });
      if (d < bestDistSq) {
        bestDistSq = d;
        best = loc;
      }
    }
    if (best) {
      setSnapped({
        ...best,
        clickX: xPct,
        clickY: yPct,
        distancePct: Math.sqrt(bestDistSq),
      });
    }
  };

  const handleConfirm = () => {
    if (!snapped) return;
    onPick?.(snapped);
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
          <DialogDescription>
            Arrastra para mover, rueda para hacer zoom. Haz clic en un punto y se elegirá la
            ubicación más cercana.
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
          {snapped && (
            <div className="text-xs text-emerald-300" data-testid="mappick-selected">
              Más cercano: <strong className="text-emerald-200">{snapped.nombre}</strong>
              {snapped.region && <> · {snapped.region}</>}
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
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          data-testid="mappick-canvas"
        >
          <img
            ref={imgRef}
            src={MAP_SRC}
            alt="Mapa de la Tierra Media"
            draggable="false"
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
          {/* Marker for the snapped location */}
          {snapped && containerRef.current && (() => {
            const rect = containerRef.current.getBoundingClientRect();
            const displayW = rect.width * zoom;
            const displayH = displayW * (NATURAL_H / NATURAL_W);
            const imgLeft = (rect.width - displayW) / 2 + pan.x;
            const imgTop = (rect.height - displayH) / 2 + pan.y;
            const px = imgLeft + (snapped.x / 100) * displayW;
            const py = imgTop + (snapped.y / 100) * displayH;
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
            disabled={!snapped}
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
