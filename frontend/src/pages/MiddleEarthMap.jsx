/**
 * Interactive Middle-earth Map Component
 * Displays all 182 locations with terrain, land types, and route calculation
 * Supports player/master view modes
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Input } from '../components/ui/input';
import { 
  Map, MapPin, Route, Shield, AlertTriangle, Mountain, TreePine, Castle,
  Skull, Home, Anchor, Eye, EyeOff, ZoomIn, ZoomOut, Move, Info, X,
  Compass, Ruler
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

// Terrain colors matching the map legend
const TERRAIN_COLORS = {
  facil: '#c4b998',          // Cream/tan
  moderado: '#8b9a6b',       // Olive green
  dificil: '#a08060',        // Light brown
  muy_dificil: '#8b6914',    // Medium brown
  desalentador: '#c45c30',   // Orange/rust
  infranqueable: '#4a3728',  // Dark brown
};

// Land type colors
const LAND_COLORS = {
  tierras_libres: '#22c55e',    // Green
  fronterizas: '#eab308',       // Yellow
  tierras_salvajes: '#f97316',  // Orange
  tierras_sombra: '#ef4444',    // Red
  tierras_oscuras: '#7c3aed',   // Purple
};

// Location type icons
const LOCATION_ICONS = {
  ciudad_capital: '🏰',
  ciudad: '🏘️',
  ciudad_puerto: '⚓',
  ciudad_elfica: '✨',
  pueblo: '🏠',
  fortaleza: '🏯',
  fortaleza_enemiga: '💀',
  fortaleza_abandonada: '🏚️',
  reino_enano: '⛏️',
  reino_elfico: '🌟',
  refugio_elfico: '🌿',
  refugio: '🛖',
  ruinas: '🏛️',
  bosque: '🌲',
  bosque_antiguo: '🌳',
  bosque_elfico: '🌸',
  bosque_oscuro: '🌑',
  cordillera: '⛰️',
  volcan: '🌋',
  paso_montaña: '🚶',
  colinas: '🏔️',
  lago: '💧',
  rio: '🌊',
  pantano: '🐸',
  region: '📍',
  vado: '🌉',
  camino: '🛤️',
  puerto: '⛵',
  almenaras: '🔥',
  monumento: '🗿',
  lugar_especial: '⭐',
};

const MiddleEarthMap = () => {
  // Data state
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Filter state
  const [showMasterView, setShowMasterView] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showLandTypes, setShowLandTypes] = useState(true);
  const [showMapBackground, setShowMapBackground] = useState(true);
  const [mapOpacity, setMapOpacity] = useState(0.7);
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Map image URLs - Player maps (clean, without decorative borders)
  const MAP_IMAGES = {
    // Single unified map of Middle-earth (clean version)
    unified: {
      url: 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/t9634c1y_Tierra%20media.jpg',
    },
    // Individual maps for reference (4-part layout)
    eriador: {
      url: 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/rc50v5ir_Mapa-03-Eriador-MMS-HR.jpg',
      x: 0, y: 0, width: 500, height: 450
    },
    rhovanion: {
      url: 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/hweoecgy_Mapa-04-Rhovanion-MMS-HR.jpg',
      x: 500, y: 0, width: 500, height: 450
    },
    gondor: {
      url: 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/vlt5od8m_Mapa-01-Gondor-MMS-HR.jpg',
      x: 0, y: 450, width: 500, height: 450
    },
    mordor: {
      url: 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/ikcantpd_Mapa-02-Mordor-MMS-HR.jpg',
      x: 500, y: 450, width: 500, height: 450
    }
  };
  
  // Refs
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  
  // Map dimensions (based on coordinate system 0-100)
  const MAP_WIDTH = 1000;
  const MAP_HEIGHT = 900;
  
  // Load locations
  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoading(true);
        const res = await api.get('/data/locations');
        setLocations(res.data.locations || []);
      } catch (err) {
        console.error('Error loading locations:', err);
        toast.error('Error al cargar ubicaciones');
      } finally {
        setLoading(false);
      }
    };
    loadLocations();
  }, []);
  
  // Calculate route when origin/destination change
  useEffect(() => {
    const calculateRoute = async () => {
      if (routeOrigin && routeDestination && routeOrigin.id !== routeDestination.id) {
        try {
          const res = await api.get(`/data/locations/calculate-route/${routeOrigin.id}/${routeDestination.id}`);
          setRouteInfo(res.data);
        } catch (err) {
          console.error('Error calculating route:', err);
          setRouteInfo(null);
        }
      } else {
        setRouteInfo(null);
      }
    };
    calculateRoute();
  }, [routeOrigin, routeDestination]);
  
  // Get unique regions
  const regions = useMemo(() => {
    const regs = new Set(locations.map(l => l.region));
    return Array.from(regs).sort();
  }, [locations]);
  
  // Get unique types
  const types = useMemo(() => {
    const t = new Set(locations.map(l => l.tipo));
    return Array.from(t).sort();
  }, [locations]);
  
  // Filter locations
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      if (filterRegion !== 'all' && loc.region !== filterRegion) return false;
      if (filterType !== 'all' && loc.tipo !== filterType) return false;
      if (searchTerm && !loc.nombre.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [locations, filterRegion, filterType, searchTerm]);
  
  // Convert coordinates to map position
  const coordToPos = (x, y) => ({
    x: (x / 100) * MAP_WIDTH,
    y: MAP_HEIGHT - (y / 100) * MAP_HEIGHT, // Flip Y axis
  });
  
  // Handle mouse events for panning
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle location click
  const handleLocationClick = (loc, e) => {
    e.stopPropagation();
    
    if (e.shiftKey && routeOrigin) {
      // Shift+click sets destination
      setRouteDestination(loc);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+click sets origin
      setRouteOrigin(loc);
      setRouteDestination(null);
    } else {
      // Normal click shows info
      setSelectedLocation(loc);
    }
  };
  
  // Get location color based on settings
  const getLocationColor = (loc) => {
    if (showLandTypes) {
      return LAND_COLORS[loc.tipo_tierra] || '#888';
    }
    if (showTerrain) {
      return TERRAIN_COLORS[loc.terreno] || '#888';
    }
    return '#c9a227'; // Gold default
  };
  
  // Render location marker
  const renderLocation = (loc) => {
    const pos = coordToPos(loc.x, loc.y);
    const isSelected = selectedLocation?.id === loc.id;
    const isOrigin = routeOrigin?.id === loc.id;
    const isDestination = routeDestination?.id === loc.id;
    const color = getLocationColor(loc);
    const icon = LOCATION_ICONS[loc.tipo] || '📍';
    
    // Skip if player view and not a refuge or major location
    if (!showMasterView && !loc.refugio && !['ciudad_capital', 'ciudad', 'reino_enano', 'reino_elfico'].includes(loc.tipo)) {
      return null;
    }
    
    return (
      <g
        key={loc.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onClick={(e) => handleLocationClick(loc, e)}
        style={{ cursor: 'pointer' }}
        data-testid={`map-location-${loc.id}`}
      >
        {/* Glow for selected/route points */}
        {(isSelected || isOrigin || isDestination) && (
          <circle
            r={isSelected ? 18 : 14}
            fill="none"
            stroke={isOrigin ? '#22c55e' : isDestination ? '#ef4444' : '#c9a227'}
            strokeWidth={3}
            opacity={0.8}
            className="animate-pulse"
          />
        )}
        
        {/* Background circle */}
        <circle
          r={loc.refugio ? 10 : 8}
          fill={color}
          stroke={loc.refugio ? '#22c55e' : '#333'}
          strokeWidth={loc.refugio ? 2 : 1}
          opacity={0.9}
        />
        
        {/* Icon (only in master view with zoom > 0.8) */}
        {showMasterView && zoom > 0.8 && (
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            style={{ pointerEvents: 'none' }}
          >
            {icon}
          </text>
        )}
        
        {/* Label */}
        {showLabels && zoom > 0.6 && (
          <text
            y={16}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.max(8, 10 / zoom)}
            fontWeight="bold"
            stroke="#000"
            strokeWidth={0.5}
            style={{ pointerEvents: 'none' }}
          >
            {loc.nombre.length > 15 ? loc.nombre.substring(0, 12) + '...' : loc.nombre}
          </text>
        )}
      </g>
    );
  };
  
  // Render route line
  const renderRoute = () => {
    if (!routeOrigin || !routeDestination) return null;
    
    const originPos = coordToPos(routeOrigin.x, routeOrigin.y);
    const destPos = coordToPos(routeDestination.x, routeDestination.y);
    
    return (
      <g>
        {/* Route line */}
        <line
          x1={originPos.x}
          y1={originPos.y}
          x2={destPos.x}
          y2={destPos.y}
          stroke="#c9a227"
          strokeWidth={3}
          strokeDasharray="10,5"
          opacity={0.8}
        />
        
        {/* Arrow at destination */}
        <polygon
          points="-8,-5 0,0 -8,5"
          fill="#c9a227"
          transform={`translate(${destPos.x}, ${destPos.y}) rotate(${Math.atan2(destPos.y - originPos.y, destPos.x - originPos.x) * 180 / Math.PI})`}
        />
      </g>
    );
  };
  
  // Render info panel
  const renderInfoPanel = () => {
    if (!selectedLocation) return null;
    
    const loc = selectedLocation;
    
    return (
      <Card className="absolute top-4 right-4 w-80 card-parchment z-20">
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
              onClick={() => setSelectedLocation(null)}
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
              {loc.terreno}
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
          
          <div className="flex gap-2 pt-2 border-t border-border/30">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRouteOrigin(loc);
                setSelectedLocation(null);
                toast.success(`Origen: ${loc.nombre}`);
              }}
              className="flex-1"
            >
              <MapPin className="w-3 h-3 mr-1 text-green-400" />
              Origen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRouteDestination(loc);
                setSelectedLocation(null);
                toast.success(`Destino: ${loc.nombre}`);
              }}
              className="flex-1"
            >
              <MapPin className="w-3 h-3 mr-1 text-red-400" />
              Destino
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  // Render route info panel
  const renderRoutePanel = () => {
    if (!routeInfo) return null;
    
    const route = routeInfo.route;
    
    return (
      <Card className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 card-parchment z-20">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              <Route className="w-5 h-5 inline mr-2" />
              Ruta Calculada
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRouteOrigin(null);
                setRouteDestination(null);
                setRouteInfo(null);
              }}
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
                {route.direction.cardinal}
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
        </CardContent>
      </Card>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Map className="w-16 h-16 animate-pulse text-[hsl(var(--gold))] mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando mapa de la Tierra Media...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="p-4 border-b border-border/30 bg-black/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="font-heading text-2xl text-[hsl(var(--gold))]">
              <Map className="w-6 h-6 inline mr-2" />
              Mapa de la Tierra Media
            </h1>
            <Badge variant="outline">{filteredLocations.length} ubicaciones</Badge>
          </div>
          
          {/* View controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={showMasterView}
                onCheckedChange={setShowMasterView}
                id="master-view"
              />
              <Label htmlFor="master-view" className="text-sm flex items-center gap-1">
                {showMasterView ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {showMasterView ? 'Maestro' : 'Jugador'}
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={showMapBackground}
                onCheckedChange={setShowMapBackground}
                id="map-bg"
              />
              <Label htmlFor="map-bg" className="text-sm">Mapa</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={showLabels}
                onCheckedChange={setShowLabels}
                id="labels"
              />
              <Label htmlFor="labels" className="text-sm">Etiquetas</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={showLandTypes}
                onCheckedChange={setShowLandTypes}
                id="land-types"
              />
              <Label htmlFor="land-types" className="text-sm">Tipo Tierra</Label>
            </div>
            
            {/* Map opacity slider */}
            {showMapBackground && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Opacidad:</Label>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.1"
                  value={mapOpacity}
                  onChange={(e) => setMapOpacity(parseFloat(e.target.value))}
                  className="w-20 h-2 accent-[hsl(var(--gold))]"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Región:</Label>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {regions.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm">Tipo:</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {types.map(t => (
                  <SelectItem key={t} value={t}>{LOCATION_ICONS[t]} {t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Input
            placeholder="Buscar ubicación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-48"
          />
          
          {/* Zoom controls */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            >
              <Move className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Map container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={mapRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* SVG Definitions */}
          <defs>
            {/* Soft blur filter (for potential future use) */}
            <filter id="softBlend" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>
          
          {/* Background */}
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#1a1510" />
          
          {/* Map images as background - Unified Middle-earth map */}
          {showMapBackground && (
            <g opacity={mapOpacity}>
              {/* 
                Single unified map - calibrated to match location coordinates
                The coordinate system uses 0-100 range where:
                - x increases from west to east
                - y increases from south to north (flipped in rendering)
                
                Key calibration points from database:
                - Hobbiton: x=24, y=56 → should be in The Shire (northwest)
                - Minas Tirith: x=52, y=32 → should be in Gondor (south-center)
                - Erebor: x=62, y=65 → should be in Rhovanion (northeast)
                - Edoras: x=30, y=44 → should be in Rohan
                
                Adjusting map position to align with these coordinates
              */}
              <image
                href={MAP_IMAGES.unified.url}
                x={-50}
                y={-50}
                width={1150}
                height={1000}
                preserveAspectRatio="xMinYMin slice"
              />
            </g>
          )}
          
          {/* Grid lines (optional) */}
          {showMasterView && !showMapBackground && (
            <g opacity={0.1}>
              {Array.from({ length: 11 }, (_, i) => (
                <React.Fragment key={i}>
                  <line
                    x1={i * (MAP_WIDTH / 10)}
                    y1={0}
                    x2={i * (MAP_WIDTH / 10)}
                    y2={MAP_HEIGHT}
                    stroke="#c9a227"
                  />
                  <line
                    x1={0}
                    y1={i * (MAP_HEIGHT / 10)}
                    x2={MAP_WIDTH}
                    y2={i * (MAP_HEIGHT / 10)}
                    stroke="#c9a227"
                  />
                </React.Fragment>
              ))}
            </g>
          )}
          
          {/* Region labels (only when no map background) */}
          {showMasterView && !showMapBackground && zoom > 0.5 && (
            <g opacity={0.3}>
              <text x={150} y={400} fill="#c9a227" fontSize={40} fontWeight="bold">ERIADOR</text>
              <text x={400} y={650} fill="#c9a227" fontSize={35} fontWeight="bold">ROHAN</text>
              <text x={500} y={750} fill="#c9a227" fontSize={35} fontWeight="bold">GONDOR</text>
              <text x={650} y={650} fill="#8b0000" fontSize={30} fontWeight="bold">MORDOR</text>
              <text x={600} y={350} fill="#c9a227" fontSize={30} fontWeight="bold">RHOVANION</text>
            </g>
          )}
          
          {/* Route line */}
          {renderRoute()}
          
          {/* Locations */}
          {filteredLocations.map(renderLocation)}
        </svg>
        
        {/* Info panels */}
        {renderInfoPanel()}
        {renderRoutePanel()}
        
        {/* Legend */}
        <Card className="absolute bottom-4 left-4 w-64 card-parchment z-10 opacity-90">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-bold text-[hsl(var(--gold))]">Tipo de Tierra:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(LAND_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs">{key.replace('tierras_', '').replace('_', ' ')}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click = Info | Ctrl+Click = Origen | Shift+Click = Destino
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MiddleEarthMap;
