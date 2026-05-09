/**
 * LocationMiniPreview — pequeña ventana al mapa de jugadores que enfoca
 * la coordenada de la ubicación seleccionada. Se usa en el wizard de
 * aventuras (Datos básicos y Entornos).
 *
 * Acepta `value` con `{ location_id, location_name, region, map_x, map_y }`
 * y resuelve la coordenada desde el catálogo `locations` cuando solo hay id.
 */
import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { PLAYER_MAP_URL, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT } from '@/components/travel/travelConstants';

const VIEWPORT = 220; // px square for the preview
const ZOOM = 4; // 1px = 4 displayed px (zoomed-in window)

const LocationMiniPreview = ({ value, locations = [], height = 200 }) => {
  const coord = useMemo(() => {
    if (!value) return null;
    if (value.map_x != null && value.map_y != null) {
      return { x: Number(value.map_x), y: Number(value.map_y) };
    }
    if (value.location_id) {
      const loc = locations.find((l) => l.id === value.location_id);
      if (loc && loc.x != null && loc.y != null) {
        return { x: Number(loc.x), y: Number(loc.y) };
      }
    }
    return null;
  }, [value, locations]);

  if (!value || !value.location_name) return null;

  if (!coord) {
    return (
      <div
        className="rounded-md border border-amber-700/40 bg-black/40 p-3 text-xs text-amber-300/70 italic"
        data-testid="location-mini-preview-no-coord"
      >
        <MapPin className="inline w-3.5 h-3.5 mr-1" />
        {value.location_name} (sin coordenadas registradas)
      </div>
    );
  }

  // Compute background-position so the coord is centered.
  // Display: a 220px square showing a zoomed-in region of the full map.
  const pxX = coord.x;
  const pxY = coord.y;
  // Background size = original / scale-factor… we scale the map to (width * ZOOM)
  // No — we keep the map at its real pixel size, then translate so the point is centered.
  // A simpler approach: render the full map scaled to fit, then overlay a pin on the relative coordinate.
  // Since the full map is enormous (19791x15133), we use a CSS background trick.
  const displayWidth = VIEWPORT;
  const displayHeight = height;
  // We want a "magnifier" effect: show map at 2x scale focused on coord.
  const bgScale = ZOOM;
  const bgWidth = MAP_PIXEL_WIDTH / bgScale; // displayed map width if shown completely at ZOOM scale
  const bgHeight = MAP_PIXEL_HEIGHT / bgScale;
  // bg pos so that (pxX/bgScale, pxY/bgScale) lands at center of viewport
  const bgPosX = -(pxX / bgScale - displayWidth / 2);
  const bgPosY = -(pxY / bgScale - displayHeight / 2);

  return (
    <div
      className="rounded-md border border-amber-700/50 overflow-hidden bg-black/50 relative shrink-0"
      style={{ width: displayWidth, height: displayHeight }}
      data-testid="location-mini-preview"
      title={`${value.location_name}${value.region ? ' · ' + value.region : ''}`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${PLAYER_MAP_URL})`,
          backgroundSize: `${bgWidth}px ${bgHeight}px`,
          backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.95) contrast(1.05)',
        }}
      />
      {/* Pin marker centered */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -100%)',
        }}
      >
        <MapPin className="w-7 h-7 text-amber-400 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]" fill="rgba(245,158,11,0.5)" />
      </div>
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5">
        <div className="text-xs font-bold text-amber-200 truncate">{value.location_name}</div>
        {value.region && (
          <div className="text-[10px] text-amber-300/70 truncate">{value.region}</div>
        )}
      </div>
    </div>
  );
};

export default LocationMiniPreview;
