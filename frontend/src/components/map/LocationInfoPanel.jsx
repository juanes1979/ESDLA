/**
 * Location Info Panel Component
 * Displays information about a selected location with route and edit options
 */
import { X, MapPin, Shield, AlertTriangle } from 'lucide-react';
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
  if (!location) return null;

  const loc = location;

  return (
    <Card className="absolute top-4 right-4 w-80 card-parchment z-20" data-testid="location-info-panel">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              {LOCATION_ICONS[loc.tipo]} {loc.nombre}
            </CardTitle>
            {loc.nombre_sindarin && (
              <p className="text-sm text-muted-foreground italic">{loc.nombre_sindarin}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{loc.descripcion}</p>
        
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
          <Badge className={`${
            loc.peligro === 'bajo' ? 'bg-green-500/20 text-green-400' :
            loc.peligro === 'medio' ? 'bg-yellow-500/20 text-yellow-400' :
            loc.peligro === 'alto' ? 'bg-orange-500/20 text-orange-400' :
            loc.peligro === 'muy_alto' ? 'bg-red-500/20 text-red-400' :
            'bg-purple-500/20 text-purple-400'
          }`}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            Peligro: {loc.peligro}
          </Badge>
        </div>
        
        {/* Coordinates display */}
        <div className="text-xs text-muted-foreground">
          Coordenadas: ({loc.x}, {loc.y})
        </div>
        
        {/* Route buttons */}
        <div className="flex gap-2 pt-2 border-t border-border/30">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetOrigin?.(loc)}
            className="flex-1"
          >
            <MapPin className="w-3 h-3 mr-1 text-green-400" />
            Origen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetDestination?.(loc)}
            className="flex-1"
          >
            <MapPin className="w-3 h-3 mr-1 text-red-400" />
            Destino
          </Button>
        </div>
        
        {/* Edit/Delete buttons - Only for Maestro */}
        {showMasterView && (
          <div className="flex gap-2 pt-2 border-t border-border/30">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit?.(loc)}
              className="flex-1"
            >
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
  );
};

export default LocationInfoPanel;
