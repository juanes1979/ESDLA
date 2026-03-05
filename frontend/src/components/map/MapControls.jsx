/**
 * Map Controls Component
 * Zoom, pan, filters and view options for the map
 */
import { ZoomIn, ZoomOut, Move, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { REGIONS, MAP_IMAGES, TYPE_CATEGORIES } from './mapConstants';

const MapControls = ({
  // Zoom/Pan
  zoom,
  setZoom,
  resetView,
  
  // Filters
  filterRegion,
  setFilterRegion,
  filterType,
  setFilterType,
  searchTerm,
  setSearchTerm,
  regionsHierarchy = [],
  
  // View options
  showLabels,
  setShowLabels,
  showTerrain,
  setShowTerrain,
  showLandTypes,
  setShowLandTypes,
  showMapBackground,
  setShowMapBackground,
  mapOpacity,
  setMapOpacity,
  selectedMapImage,
  setSelectedMapImage,
  
  // Layer toggles
  showRoads,
  setShowRoads,
  showRivers,
  setShowRivers,
  showBarriers,
  setShowBarriers,
  showCalculatedPath,
  setShowCalculatedPath,
}) => {
  // Get all available regions from hierarchy
  const allRegions = regionsHierarchy.length > 0 
    ? regionsHierarchy.flatMap(r => [r.nombre, ...(r.subregions?.map(s => s.nombre) || [])])
    : REGIONS;

  // Get all location types
  const allTypes = Object.values(TYPE_CATEGORIES).flat();

  return (
    <div className="absolute bottom-4 left-4 z-20 space-y-2" data-testid="map-controls">
      {/* Zoom Controls */}
      <Card className="card-parchment">
        <CardContent className="p-2 flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
            className="h-8 w-8 p-0"
            title="Acercar"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
            className="h-8 w-8 p-0"
            title="Alejar"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetView}
            className="h-8 w-8 p-0"
            title="Restablecer vista"
          >
            <Move className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground self-center px-2">
            {Math.round(zoom * 100)}%
          </span>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card className="card-parchment">
        <CardContent className="p-3 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar ubicación..."
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Region Filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Filtrar por Región</Label>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todas las regiones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las regiones</SelectItem>
                {allRegions.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Filtrar por Tipo</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {allTypes.map(t => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* View Options */}
      <Card className="card-parchment">
        <CardContent className="p-3 space-y-3">
          <p className="text-xs font-medium text-[hsl(var(--gold))]">Opciones de Vista</p>
          
          {/* Map Image Selector */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mapa Base</Label>
            <Select value={selectedMapImage} onValueChange={setSelectedMapImage}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MAP_IMAGES).map(([key, img]) => (
                  <SelectItem key={key} value={key}>{img.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Etiquetas</Label>
              <Switch checked={showLabels} onCheckedChange={setShowLabels} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Terreno</Label>
              <Switch checked={showTerrain} onCheckedChange={setShowTerrain} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Tipos de Tierra</Label>
              <Switch checked={showLandTypes} onCheckedChange={setShowLandTypes} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Fondo del Mapa</Label>
              <Switch checked={showMapBackground} onCheckedChange={setShowMapBackground} />
            </div>
          </div>

          {/* Map Opacity */}
          {showMapBackground && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Opacidad: {Math.round(mapOpacity * 100)}%</Label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={mapOpacity}
                onChange={(e) => setMapOpacity(parseFloat(e.target.value))}
                className="w-full h-2 accent-[hsl(var(--gold))]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layer Toggles */}
      <Card className="card-parchment">
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-medium text-[hsl(var(--gold))]">Capas</p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">🛤️ Caminos</Label>
            <Switch checked={showRoads} onCheckedChange={setShowRoads} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">🌊 Ríos</Label>
            <Switch checked={showRivers} onCheckedChange={setShowRivers} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">⛰️ Barreras</Label>
            <Switch checked={showBarriers} onCheckedChange={setShowBarriers} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">📍 Ruta Calculada</Label>
            <Switch checked={showCalculatedPath} onCheckedChange={setShowCalculatedPath} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapControls;
