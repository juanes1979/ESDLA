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
import { PLAYER_MAP_URL } from '@/config/mapAssets';
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

const MAP_IMG = PLAYER_MAP_URL;

const LocationWidget = ({ character, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState([]);
  const [regionTree, setRegionTree] = useState([]); // hierarchical regions
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const isLockedByCampaign = !!character?.campaign_id;
  const ubicacion = character?.ubicacion_actual;

  useEffect(() => {
    if (!open) return;
    if (locations.length > 0) return;
    Promise.all([
      api.get('/data/locations'),
      api.get('/data/regions/flat').catch(() => ({ data: { regions: [] } })),
    ])
      .then(([locRes, regRes]) => {
        const list = locRes.data?.locations || locRes.data || [];
        const filtered = list.filter((l) => !l.tipo || SETTLEMENT_TYPES.includes(l.tipo));
        setLocations(filtered);
        // Build hierarchical region tree
        const flat = regRes.data?.regions || [];
        const byId = Object.fromEntries(flat.map(r => [r.id, { ...r, children: [] }]));
        const roots = [];
        for (const n of Object.values(byId)) {
          if (n.parent_id && byId[n.parent_id]) byId[n.parent_id].children.push(n);
          else roots.push(n);
        }
        const sortRec = (arr) => {
          arr.sort((a, b) => (a.orden || 0) - (b.orden || 0) || (a.nombre || '').localeCompare(b.nombre || ''));
          arr.forEach(n => sortRec(n.children));
        };
        sortRec(roots);
        setRegionTree(roots);
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
  // convention). We center the visible 96×96 px container on the
  // character's (x, y) point of the map. The image is rendered at
  // `width: 400%` while keeping its natural aspect ratio (`height: auto`),
  // so its rendered HEIGHT is NOT 400% of the container but 400/aspect.
  const MAP_ASPECT = 19791 / 15133; // natural width / height of mapa_jugadores.jpg
  const IMG_WIDTH_PCT = 400;
  // Image height as % of container height. With width:400% and
  // aspect-preserving auto height, this is 400 / aspect (≈ 305.86%).
  const IMG_HEIGHT_PCT = IMG_WIDTH_PCT / MAP_ASPECT;
  const screenY = ubicacion?.y != null ? 100 - ubicacion.y : null;
  const hasCoords = ubicacion?.x != null && screenY != null;
  // Position offsets so that the bg-point (x%, screenY%) sits at the
  // container's center (50%, 50%):
  //   img_left% = 50 − x   × IMG_WIDTH_PCT  / 100
  //   img_top%  = 50 − sY  × IMG_HEIGHT_PCT / 100
  const imgLeftPct = hasCoords ? 50 - (ubicacion.x * IMG_WIDTH_PCT) / 100 : 0;
  const imgTopPct = hasCoords ? 50 - (screenY * IMG_HEIGHT_PCT) / 100 : 0;

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
              const f = filter.toLowerCase();
              const matches = (l) => !f || (l.nombre || '').toLowerCase().includes(f) || (l.region || '').toLowerCase().includes(f);
              const filtered = locations.filter(matches);
              const grouped = {};
              filtered.forEach((l) => {
                const r = l.region || 'Otros';
                grouped[r] = grouped[r] || [];
                grouped[r].push(l);
              });
              if (!filtered.length) {
                return <div className="p-3 text-sm text-muted-foreground text-center">Sin resultados.</div>;
              }
              // Walk hierarchical tree (DFS) to render in order. Regions
              // not present in the tree (orphans) are appended at the end.
              const out = [];
              const renderRegion = (regionName, depth) => {
                const list = grouped[regionName] || [];
                if (!list.length) return;
                out.push(
                  <div key={`hdr-${regionName}`}>
                    <div
                      className="bg-[hsl(var(--gold))/10] py-1 text-[11px] uppercase text-[hsl(var(--gold))]"
                      style={{ paddingLeft: `${depth * 16 + 12}px` }}
                    >
                      {depth > 0 ? '└─ ' : ''}{regionName}
                    </div>
                    {list.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handlePick(l)}
                        disabled={saving}
                        className={`w-full text-left py-2 text-sm flex items-center justify-between hover:bg-[hsl(var(--gold))/10] transition-colors ${
                          ubicacion?.id === l.id ? 'bg-emerald-900/30 border-l-2 border-emerald-500' : ''
                        }`}
                        style={{ paddingLeft: `${depth * 16 + 24}px`, paddingRight: '16px' }}
                        data-testid={`location-pick-${l.id}`}
                      >
                        <span className="font-medium">{l.nombre}</span>
                        <span className="text-[11px] text-muted-foreground italic">{l.tipo}</span>
                      </button>
                    ))}
                  </div>
                );
              };
              const walk = (nodes, depth) => {
                for (const n of nodes) {
                  renderRegion(n.nombre, depth);
                  if (n.children?.length) walk(n.children, depth + 1);
                }
              };
              walk(regionTree, 0);
              // Orphan regions (in groupings but not in tree)
              const treeNames = new Set();
              const collectNames = (nodes) => nodes.forEach(n => { treeNames.add(n.nombre); collectNames(n.children || []); });
              collectNames(regionTree);
              Object.keys(grouped).filter(r => !treeNames.has(r)).sort().forEach(r => renderRegion(r, 0));
              return out;
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
