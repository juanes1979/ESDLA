/**
 * Route Panel Component
 * Displays calculated route information between two locations
 */
import { X, MapPin, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TERRAIN_COLORS, LAND_COLORS } from './mapConstants';

const RoutePanel = ({
  routeInfo,
  calculatedPath,
  isCalculatingPath,
  showCalculatedPath,
  setShowCalculatedPath,
  onClose,
}) => {
  if (!routeInfo) return null;
  
  const route = routeInfo.route;
  
  return (
    <Card className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 card-parchment z-20" data-testid="route-panel">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Route className="w-5 h-5 inline mr-2" />
            Ruta Calculada
          </CardTitle>
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
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-green-400" />
          <span className="font-bold">{routeInfo.origin.nombre}</span>
          <span className="text-muted-foreground">→</span>
          <MapPin className="w-4 h-4 text-red-400" />
          <span className="font-bold">{routeInfo.destination.nombre}</span>
        </div>
        
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold text-[hsl(var(--torch-orange))]">{route.distance_km}</p>
            <p className="text-xs text-muted-foreground">km</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold text-[hsl(var(--magic-blue))]">{route.distance_hexes}</p>
            <p className="text-xs text-muted-foreground">hexágonos</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold text-[hsl(var(--gold))]">{route.estimated_days}</p>
            <p className="text-xs text-muted-foreground">días</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-lg font-bold" style={{ color: LAND_COLORS[route.land_type] }}>
              {route.direction?.cardinal || '-'}
            </p>
            <p className="text-xs text-muted-foreground">dirección</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge style={{ backgroundColor: TERRAIN_COLORS[route.terrain_difficulty] + '40' }}>
            Terreno: {route.terrain_difficulty}
          </Badge>
          <Badge style={{ backgroundColor: LAND_COLORS[route.land_type] + '40' }}>
            {route.land_type?.replace('_', ' ')}
          </Badge>
          <Badge className={`${
            route.danger_level === 'bajo' ? 'bg-green-500/20 text-green-400' :
            route.danger_level === 'medio' ? 'bg-yellow-500/20 text-yellow-400' :
            route.danger_level === 'alto' ? 'bg-orange-500/20 text-orange-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            Peligro: {route.danger_level}
          </Badge>
        </div>
        
        {/* Pathfinding Result */}
        {calculatedPath && calculatedPath.success && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                <Route className="w-3 h-3" />
                Ruta Óptima (A*)
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs"
                onClick={() => setShowCalculatedPath?.(!showCalculatedPath)}
              >
                {showCalculatedPath ? '👁️' : '👁️‍🗨️'}
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-cyan-500/10 p-1 rounded">
                <p className="font-bold text-cyan-400">{calculatedPath.total_distance_km}</p>
                <p className="text-muted-foreground">km total</p>
              </div>
              <div className="bg-cyan-500/10 p-1 rounded">
                <p className="font-bold text-cyan-400">{calculatedPath.estimated_days}</p>
                <p className="text-muted-foreground">días</p>
              </div>
              <div className="bg-cyan-500/10 p-1 rounded">
                <p className="font-bold text-green-400">{calculatedPath.roads_used?.length || 0}</p>
                <p className="text-muted-foreground">caminos</p>
              </div>
            </div>
            
            {calculatedPath.roads_used?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {calculatedPath.roads_used.map((road, idx) => (
                  <Badge key={idx} className="bg-yellow-500/20 text-yellow-400 text-xs py-0">
                    🛤️ {road}
                  </Badge>
                ))}
              </div>
            )}
            
            {calculatedPath.rivers_crossed?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {calculatedPath.rivers_crossed.map((river, idx) => (
                  <Badge key={idx} className="bg-blue-500/20 text-blue-400 text-xs py-0">
                    🌊 {river.type}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
        
        {isCalculatingPath && (
          <div className="mt-2 text-center">
            <p className="text-xs text-cyan-400 animate-pulse">Calculando ruta óptima...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RoutePanel;
