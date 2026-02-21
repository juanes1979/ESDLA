/**
 * Route Info Panel Component
 * Displays calculated route information between two locations
 */
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, MapPin, Route } from 'lucide-react';

const TERRAIN_COLORS = {
  facil: '#c4b998',
  moderado: '#8b9a6b',
  dificil: '#a08060',
  muy_dificil: '#8b6914',
  desalentador: '#c45c30',
  infranqueable: '#4a3728',
};

const LAND_COLORS = {
  tierras_libres: '#22c55e',
  fronterizas: '#eab308',
  tierras_salvajes: '#f97316',
  tierras_sombra: '#ef4444',
  tierras_oscuras: '#7c3aed',
};

const RouteInfoPanel = ({
  routeInfo,
  routeOrigin,
  routeDestination,
  onClear,
}) => {
  if (!routeInfo) return null;

  const route = routeInfo.route;

  return (
    <Card className="absolute bottom-4 left-4 w-96 bg-black/90 border-[hsl(var(--magic-blue))]/50 z-50">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Route className="w-5 h-5 inline mr-1" /> Ruta Calculada
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Origin and destination */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-green-400" />
          <span className="font-bold">{routeInfo.origin.nombre}</span>
          <span className="text-muted-foreground">→</span>
          <MapPin className="w-4 h-4 text-red-400" />
          <span className="font-bold">{routeInfo.destination.nombre}</span>
        </div>
        
        {/* Stats grid */}
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
              {route.direction.cardinal}
            </p>
            <p className="text-xs text-muted-foreground">dirección</p>
          </div>
        </div>
        
        {/* Badges */}
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
      </CardContent>
    </Card>
  );
};

export default RouteInfoPanel;
