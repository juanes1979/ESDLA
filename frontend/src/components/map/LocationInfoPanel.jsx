/**
 * Location Info Panel Component
 * Displays detailed information about a selected location
 */
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, MapPin, Shield, Edit, Trash2 } from 'lucide-react';

const TERRAIN_NAMES = {
  facil: 'Fácil',
  moderado: 'Moderado',
  dificil: 'Difícil',
  muy_dificil: 'Muy Difícil',
  desalentador: 'Desalentador',
  infranqueable: 'Infranqueable',
};

const LAND_NAMES = {
  tierras_libres: 'Tierras Libres',
  fronterizas: 'Fronterizas',
  tierras_salvajes: 'Tierras Salvajes',
  tierras_sombra: 'Tierras de Sombra',
  tierras_oscuras: 'Tierras Oscuras',
};

const DANGER_COLORS = {
  bajo: 'bg-green-500/20 text-green-400',
  medio: 'bg-yellow-500/20 text-yellow-400',
  alto: 'bg-orange-500/20 text-orange-400',
  muy_alto: 'bg-red-500/20 text-red-400',
  extremo: 'bg-purple-500/20 text-purple-400',
};

const LocationInfoPanel = ({
  location,
  onClose,
  onEdit,
  onDelete,
  isAdmin,
  terrainColors,
  landColors,
  locationIcons,
  typeNames,
}) => {
  if (!location) return null;

  return (
    <Card className="absolute top-4 right-4 w-80 bg-black/90 border-[hsl(var(--gold))/30] z-50">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              {locationIcons[location.tipo]} {location.nombre}
            </CardTitle>
            {location.nombre_sindarin && (
              <p className="text-sm text-muted-foreground italic">({location.nombre_sindarin})</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{location.region}</Badge>
          <Badge variant="outline">{typeNames[location.tipo] || location.tipo}</Badge>
          {location.refugio && (
            <Badge className="bg-green-600/20 text-green-400 border-green-500/30">
              <Shield className="w-3 h-3 mr-1" /> Refugio
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Badge style={{ backgroundColor: terrainColors[location.terreno] + '40' }}>
            Terreno: {TERRAIN_NAMES[location.terreno] || location.terreno}
          </Badge>
          <Badge style={{ backgroundColor: landColors[location.tipo_tierra] + '40' }}>
            {LAND_NAMES[location.tipo_tierra] || location.tipo_tierra}
          </Badge>
        </div>
        
        {location.peligro && (
          <Badge className={DANGER_COLORS[location.peligro] || 'bg-gray-500/20'}>
            Peligro: {location.peligro}
          </Badge>
        )}
        
        <div className="text-xs text-muted-foreground">
          Coordenadas: ({location.x}, {location.y})
        </div>
        
        {location.descripcion && (
          <p className="text-sm text-muted-foreground border-t border-border/30 pt-2">
            {location.descripcion}
          </p>
        )}
        
        {isAdmin && (
          <div className="flex gap-2 pt-2 border-t border-border/30">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(location)}
              className="flex-1"
            >
              <Edit className="w-4 h-4 mr-1" /> Editar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onDelete(location)}
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LocationInfoPanel;
