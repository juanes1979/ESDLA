/**
 * LocationPickerField — typeahead search + "Seleccionar del mapa" button.
 *
 * Returns an object with the chosen stop:
 *   { location_id, location_name, region, map_x?, map_y? }
 *
 * Uses the global `MapPickDialog` to allow picking a free point on the map.
 */
import { useMemo, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MapPickDialog from '@/components/travel/MapPickDialog';

const LocationPickerField = ({
  locations = [],
  value, // { location_id, location_name, region, map_x, map_y } | null
  onChange,
  placeholder = 'Buscar ubicación…',
  testidPrefix = 'locpick',
  allowMapPick = true,
}) => {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations.slice(0, 25);
    return locations
      .filter(
        (l) =>
          l.nombre?.toLowerCase().includes(q) ||
          l.region?.toLowerCase().includes(q) ||
          l.nombre_sindarin?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [locations, search]);

  const handlePick = (loc) => {
    onChange({
      location_id: loc.id,
      location_name: loc.nombre,
      region: loc.region,
      map_x: null,
      map_y: null,
    });
    setSearch('');
    setShowDropdown(false);
  };

  const handleMapPick = (point) => {
    // point is { id, nombre, x, y, region, custom }
    onChange({
      location_id: null,
      location_name: point.nombre,
      region: point.region,
      map_x: point.x,
      map_y: point.y,
    });
  };

  return (
    <div className="relative">
      {value?.location_name ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-900/20 border border-amber-700/50">
          <MapPin className="w-4 h-4 text-amber-300" />
          <div className="flex-1 min-w-0">
            <div
              className="text-sm text-amber-100 truncate"
              data-testid={`${testidPrefix}-current-name`}
            >
              {value.location_name}
            </div>
            {value.region && (
              <div className="text-xs text-amber-300/60 truncate">{value.region}</div>
            )}
          </div>
          <button
            onClick={() => onChange(null)}
            className="p-1 rounded hover:bg-amber-900/40 text-amber-300/70"
            data-testid={`${testidPrefix}-clear`}
            aria-label="Quitar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-300/50 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder={placeholder}
              data-testid={`${testidPrefix}-search`}
              className="w-full pl-8 pr-3 py-2 rounded-md bg-black/50 border border-amber-700/40 text-amber-100 placeholder-amber-300/30 focus:outline-none focus:border-amber-500 text-sm"
            />
            {showDropdown && filtered.length > 0 && (
              <div
                className="absolute z-30 w-full mt-1 max-h-60 overflow-y-auto rounded-md bg-black/95 border border-amber-700/50 shadow-xl"
                data-testid={`${testidPrefix}-dropdown`}
              >
                {filtered.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(l);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-amber-900/40 text-amber-100 border-b border-amber-900/20 last:border-0"
                    data-testid={`${testidPrefix}-opt-${l.id}`}
                  >
                    <span className="text-amber-300">{l.nombre}</span>
                    {l.region && <span className="text-amber-400/60 text-xs"> · {l.region}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {allowMapPick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMap(true)}
              data-testid={`${testidPrefix}-map-btn`}
              className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 shrink-0"
              title="Seleccionar del mapa"
            >
              <MapPin className="w-4 h-4 mr-1" /> Mapa
            </Button>
          )}
        </div>
      )}

      {allowMapPick && (
        <MapPickDialog
          open={showMap}
          onClose={() => setShowMap(false)}
          locations={locations}
          target="origen"
          onPick={handleMapPick}
        />
      )}
    </div>
  );
};

export default LocationPickerField;
