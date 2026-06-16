/**
 * Location Info Panel Component
 * Displays information about a selected location with route and edit options.
 * Includes an "Expandir descripción" button that opens a fullscreen-friendly
 * modal for long lore texts (descriptions can grow quite large for cities
 * like Tunum, Minas Tirith, etc.).
 */
import { useState } from 'react';
import { X, MapPin, Shield, AlertTriangle, Maximize2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TERRAIN_COLORS, TERRAIN_NAMES, LAND_COLORS, LOCATION_ICONS } from './mapConstants';

const LocationInfoPanel = ({
  location,
  onClose,
  onSetOrigin,
  onSetDestination,
  onEdit,
  onDelete,
  showMasterView = false,
  isDeleting = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!location) return null;

  const loc = location;
  const hasDescription = !!(loc.descripcion && loc.descripcion.trim());

  return (
    <>
      <Card
        className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[calc(100%-2rem)] flex flex-col"
        data-testid="location-info-panel"
      >
        <CardHeader className="pb-2 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg text-[hsl(var(--gold))]">
                {LOCATION_ICONS[loc.tipo]} {loc.nombre}
              </CardTitle>
              {loc.nombre_sindarin && (
                <p className="text-sm text-muted-foreground italic">{loc.nombre_sindarin}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* The whole panel scrolls as a single column so the bottom buttons
              (Origen/Destino/Editar) are always reachable. Long lore can also
              be opened fullscreen via the "Expandir" button. */}
          {hasDescription && (
            <>
              <div className="text-sm whitespace-pre-wrap pr-2 border-l-2 border-amber-700/30 pl-3">
                {loc.descripcion}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExpanded(true)}
                className="w-full text-amber-200 border-amber-700/50 hover:bg-amber-900/30"
                data-testid="expand-description-btn"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-2" />
                Expandir descripción
              </Button>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{loc.region}</Badge>
            <Badge style={{ backgroundColor: TERRAIN_COLORS[loc.terreno] + '40', color: '#fff' }}>
              {TERRAIN_NAMES[loc.terreno] || loc.terreno}
            </Badge>
            <Badge style={{ backgroundColor: LAND_COLORS[loc.tipo_tierra] + '40', color: '#fff' }}>
              {loc.tipo_tierra?.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex gap-2">
            {loc.refugio && (
              <Badge className="bg-green-500/20 text-green-400">
                <Shield className="w-3 h-3 mr-1" />
                Refugio
              </Badge>
            )}
            <Badge
              className={`${
                loc.peligro === 'bajo'
                  ? 'bg-green-500/20 text-green-400'
                  : loc.peligro === 'medio'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : loc.peligro === 'alto'
                  ? 'bg-orange-500/20 text-orange-400'
                  : loc.peligro === 'muy_alto'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Peligro: {loc.peligro}
            </Badge>
          </div>

          {/* Coordinates display */}
          <div className="text-xs text-muted-foreground">
            Coordenadas: ({loc.x}, {loc.y})
          </div>

          {/* Edit/Delete buttons - Only for Maestro */}
          {showMasterView && (
            <div className="flex gap-2 pt-2 border-t border-border/30">
              <Button size="sm" variant="outline" onClick={() => onEdit?.(loc)} className="flex-1">
                ✏️ Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete?.(loc)}
                disabled={isDeleting}
                className="flex-1 text-red-400 border-red-400/50 hover:bg-red-400/10"
              >
                🗑️ Eliminar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expanded description modal */}
      {expanded && hasDescription && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          data-testid="expanded-description-modal"
        >
          <div
            className="card-parchment w-full max-w-3xl max-h-[88vh] flex flex-col rounded-lg border border-amber-700/40 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-700/30 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen className="w-5 h-5 text-[hsl(var(--gold))] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xl font-heading text-[hsl(var(--gold))] truncate">
                    {LOCATION_ICONS[loc.tipo]} {loc.nombre}
                  </h3>
                  {loc.nombre_sindarin && (
                    <p className="text-xs text-muted-foreground italic truncate">
                      {loc.nombre_sindarin}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                data-testid="close-expanded-description-btn"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="px-6 py-5 overflow-y-auto leading-relaxed text-base whitespace-pre-wrap text-amber-50/95">
              {loc.descripcion}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LocationInfoPanel;
