/**
 * LocationWidget — "Estás aquí"
 *
 * Compact card shown in the character sheet header. Displays:
 *   - Region + asentamiento label
 *   - Mini-map preview (cropped around the character's coordinates)
 *   - "Cambiar" button → opens a dialog with all settlements grouped by
 *     region. Disabled when the character is assigned to a campaign
 *     (`character.campaign_id` set).
 */
import { useState, useEffect } from 'react';
import { MapPin, Pencil, Lock, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const SETTLEMENT_TYPES = [
  'ciudad', 'ciudad_capital', 'ciudad_elfica', 'ciudad_lago', 'ciudad_puerto',
  'pueblo', 'aldea', 'puerto', 'fortaleza', 'refugio', 'refugio_elfico',
  'reino_elfico', 'reino_enano', 'casa', 'lugar_especial',
];

const MAP_IMG = '/mapa_jugadores.jpg';

const LocationWidget = ({ character, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const isLockedByCampaign = !!character?.campaign_id;
  const ubicacion = character?.ubicacion_actual;

  useEffect(() => {
    if (!open) return;
    if (locations.length > 0) return;
    api.get('/data/locations')
      .then((res) => {
        const list = res.data?.locations || res.data || [];
        const filtered = list.filter((l) => !l.tipo || SETTLEMENT_TYPES.includes(l.tipo));
        setLocations(filtered);
      })
      .catch(() => toast.error('No se pudieron cargar las ubicaciones'));
  }, [open, locations.length]);

  const handlePick = async (loc) => {
    setSaving(true);
    try {
      const res = await api.patch(`/characters/${character.id}/ubicacion`, {
        location_id: loc.id,
        force: false,
      });
      onUpdate?.(res.data?.character || character);
      toast.success(`Ubicación actualizada a ${loc.nombre}`);
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar ubicación');
    } finally {
      setSaving(false);
    }
  };

  // Compute mini-map crop. The map uses Y=0 at the BOTTOM (project
  // convention, see JourneyMiniMap.jsx). We want to center the visible
  // 96×96 px box on the character's (x, y) point of the map. CSS
  // `background-position` with percentages does NOT center on bg-point P
  // (it aligns bg-point P with container-point P), so it gives wrong
  // crops for arbitrary points. We instead render an <img> at 400%
  // width inside the container and translate it so the desired point is
  // exactly at the centre.
  const screenY = ubicacion?.y != null ? 100 - ubicacion.y : null;
  const hasCoords = ubicacion?.x != null && screenY != null;
  // Image is 4× wider/taller than the box. To center on bg-point (qx, qy)%:
  //   img_left% = 50% − qx × 4%   →   `${50 - qx * 4}%`
  //   img_top%  = 50% − qy × 4%   →   `${50 - qy * 4}%`
  const imgLeftPct = hasCoords ? 50 - ubicacion.x * 4 : 0;
  const imgTopPct = hasCoords ? 50 - screenY * 4 : 0;

  return (
    <>
      <div
        className="card-parchment rounded-lg p-3 flex items-center gap-3"
        data-testid="location-widget"
      >
        {/* Mini-map */}
        <div
          className="relative w-24 h-24 rounded-md border border-[hsl(var(--gold))/40] overflow-hidden flex-shrink-0 bg-black/20"
          data-testid="location-minimap"
        >
          {hasCoords ? (
            <>
              <img
                src={MAP_IMG}
                alt=""
                draggable="false"
                style={{
                  position: 'absolute',
                  width: '400%',
                  height: 'auto',
                  left: `${imgLeftPct}%`,
                  top: `${imgTopPct}%`,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  maxWidth: 'none',
                }}
              />
              <div
                className="absolute"
                style={{
                  left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'rgba(220,38,38,0.95)',
                  border: '2px solid #fff',
                  boxShadow: '0 0 8px rgba(220,38,38,0.8)',
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground italic">
              Sin ubicación
            </div>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[hsl(var(--gold))] text-xs uppercase tracking-wide">
            <MapPin className="w-3 h-3" />
            Estás aquí
          </div>
          <div className="font-heading text-base text-foreground truncate" data-testid="location-name">
            {ubicacion?.nombre || 'Ubicación no establecida'}
          </div>
          {ubicacion?.region && (
            <div className="text-xs text-muted-foreground truncate" data-testid="location-region">
              {ubicacion.region} · <span className="italic">{ubicacion.tipo}</span>
            </div>
          )}
        </div>

        {/* Edit button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={isLockedByCampaign}
          title={isLockedByCampaign ? 'Bloqueado: el personaje está en una campaña' : 'Cambiar ubicación'}
          className="flex-shrink-0"
          data-testid="location-edit-btn"
        >
          {isLockedByCampaign ? <Lock className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="location-picker-dialog">
          <DialogHeader>
            <DialogTitle>Cambiar ubicación del personaje</DialogTitle>
            <DialogDescription>
              Elige el asentamiento donde se encuentra ahora <strong>{character.nombre}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Buscar asentamiento o región..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mb-2"
            data-testid="location-picker-search"
          />
          <div className="overflow-y-auto flex-1 border rounded divide-y">
            {(() => {
              const filtered = locations.filter((l) => {
                const f = filter.toLowerCase();
                if (!f) return true;
                return (l.nombre || '').toLowerCase().includes(f) ||
                       (l.region || '').toLowerCase().includes(f);
              });
              const grouped = {};
              filtered.forEach((l) => {
                const r = l.region || 'Otros';
                grouped[r] = grouped[r] || [];
                grouped[r].push(l);
              });
              const regions = Object.keys(grouped).sort();
              if (!regions.length) {
                return <div className="p-3 text-sm text-muted-foreground text-center">Sin resultados.</div>;
              }
              return regions.map((r) => (
                <div key={r}>
                  <div className="bg-[hsl(var(--gold))/10] px-3 py-1 text-[11px] uppercase text-[hsl(var(--gold))]">
                    {r}
                  </div>
                  {grouped[r].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handlePick(l)}
                      disabled={saving}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-[hsl(var(--gold))/10] transition-colors ${
                        ubicacion?.id === l.id ? 'bg-emerald-900/30 border-l-2 border-emerald-500' : ''
                      }`}
                      data-testid={`location-pick-${l.id}`}
                    >
                      <span className="font-medium">{l.nombre}</span>
                      <span className="text-[11px] text-muted-foreground italic">{l.tipo}</span>
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>
          <DialogFooter>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="location-picker-close">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LocationWidget;
