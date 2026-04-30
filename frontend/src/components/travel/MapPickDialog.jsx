/**
 * MapPickDialog — full-screen empty map picker.
 *
 * Shows the raw Middle-earth player map and lets the user click ANY point.
 * The marker appears EXACTLY at the click coordinates (no snapping). The
 * picked point is returned with its raw (x, y) percentages and a synthetic
 * id `custom:x,y`. The closest known location is used silently to inherit
 * a region for climate/terrain calculations.
 *
 * UX:
 *  - Click + drag to pan
 *  - Mouse wheel to zoom (1× → 6×)
 *  - Click without dragging to drop a marker at that exact point
 *  - "Centrar" button restores zoom 1× / center
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Crosshair, MapPin, X as XIcon } from 'lucide-react';

const MAP_SRC = '/mapa_jugadores.jpg';
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.25;

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
  const [picked, setPicked] = useState(null); // { x, y, regionGuess }

  useEffect(() => {
    if (open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setPicked(null);
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
    if (!imgRef.current) return;
    // Use the image's REAL on-screen bounding rect (post-transform).
    const rect = imgRef.current.getBoundingClientRect();
    const imgX = e.clientX - rect.left;
    const imgY = e.clientY - rect.top;
    if (imgX < 0 || imgY < 0 || imgX > rect.width || imgY > rect.height) return;
    const xPct = (imgX / rect.width) * 100;
    const yPct = (imgY / rect.height) * 100;

    // Silently look up the closest known location to inherit region/terrain
    // (used by the climate/event system). The marker itself is placed at the
    // raw click coordinates — never on the snapped location.
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
          <DialogDescription>
            Arrastra para mover, rueda para hacer zoom. Haz clic en cualquier
            punto del mapa para fijarlo como {target === 'origen' ? 'origen' : 'destino'}.
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
          {/* Marker — anchored to the image's real on-screen rect (post-
              transform) so it lines up exactly with the click point. */}
          {picked && imgRef.current && containerRef.current && (() => {
            const imgRect = imgRef.current.getBoundingClientRect();
            const ctRect = containerRef.current.getBoundingClientRect();
            const px = (imgRect.left - ctRect.left) + (picked.x / 100) * imgRect.width;
            const py = (imgRect.top - ctRect.top) + (picked.y / 100) * imgRect.height;
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
