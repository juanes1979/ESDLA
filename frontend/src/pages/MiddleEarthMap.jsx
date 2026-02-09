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
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [draggingLocation, setDraggingLocation] = useState(null);
  const [dragLocationStart, setDragLocationStart] = useState({ x: 0, y: 0 });
  const [pendingChanges, setPendingChanges] = useState({});
  const [savingChanges, setSavingChanges] = useState(false);
  
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
  
  // Convert map position back to coordinates
  const posToCoord = (mapX, mapY) => ({
    x: Math.round((mapX / MAP_WIDTH) * 100 * 10) / 10,
    y: Math.round(((MAP_HEIGHT - mapY) / MAP_HEIGHT) * 100 * 10) / 10,
  });
  
  // Get SVG coordinates from mouse event
  const getSVGPoint = (e) => {
    if (!mapRef.current || !containerRef.current) return null;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert to SVG viewBox coordinates, accounting for zoom and pan
    // The SVG has transform: translate(pan.x, pan.y) scale(zoom)
    // The viewBox is 0 0 MAP_WIDTH MAP_HEIGHT
    
    // First, get the center of the container (transform-origin)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate position relative to center
    const relX = mouseX - centerX;
    const relY = mouseY - centerY;
    
    // Account for zoom (scale around center)
    const scaledX = relX / zoom;
    const scaledY = relY / zoom;
    
    // Account for pan (translation before zoom)
    const panAdjustedX = scaledX - pan.x / zoom;
    const panAdjustedY = scaledY - pan.y / zoom;
    
    // Convert back to absolute coordinates
    const absX = panAdjustedX + centerX;
    const absY = panAdjustedY + centerY;
    
    // Scale to viewBox dimensions
    const viewBoxX = (absX / rect.width) * MAP_WIDTH;
    const viewBoxY = (absY / rect.height) * MAP_HEIGHT;
    
    return { x: viewBoxX, y: viewBoxY };
  };
  
  // Handle mouse events for panning (disabled when dragging location in edit mode)
  const handleMouseDown = (e) => {
    if (editMode && draggingLocation) return;
    if (e.button === 0 && !editMode) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  
  const handleMouseMove = (e) => {
    // Handle location dragging in edit mode
    if (editMode && draggingLocation) {
      const svgPoint = getSVGPoint(e);
      if (svgPoint) {
        const newCoords = posToCoord(svgPoint.x, svgPoint.y);
        // Update the location's position in pending changes
        setPendingChanges(prev => ({
          ...prev,
          [draggingLocation.id]: {
            ...draggingLocation,
            x: newCoords.x,
            y: newCoords.y,
          }
        }));
        // Update local state for visual feedback
        setLocations(prev => prev.map(loc => 
          loc.id === draggingLocation.id 
            ? { ...loc, x: newCoords.x, y: newCoords.y }
            : loc
        ));
      }
      return;
    }
    
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  
  const handleMouseUp = () => {
    if (draggingLocation) {
      setDraggingLocation(null);
      toast.success(`Posición de "${draggingLocation.nombre}" actualizada`);
    }
    setIsDragging(false);
  };
  
  // Handle location drag start in edit mode
  const handleLocationDragStart = (loc, e) => {
    e.stopPropagation();
    if (!editMode) return;
    setDraggingLocation(loc);
    const svgPoint = getSVGPoint(e);
    if (svgPoint) {
      setDragLocationStart({ x: svgPoint.x, y: svgPoint.y });
    }
  };
  
  // Save pending changes to database
  const savePendingChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('No hay cambios pendientes');
      return;
    }
    
    setSavingChanges(true);
    let savedCount = 0;
    let errors = 0;
    
    for (const [locId, locData] of Object.entries(pendingChanges)) {
      try {
        await api.put(`/data/locations/${locId}`, {
          x: locData.x,
          y: locData.y,
        });
        savedCount++;
      } catch (err) {
        console.error(`Error saving ${locData.nombre}:`, err);
        errors++;
      }
    }
    
    setSavingChanges(false);
    
    if (errors === 0) {
      toast.success(`${savedCount} ubicaciones guardadas correctamente`);
      setPendingChanges({});
    } else {
      toast.error(`${errors} errores al guardar. ${savedCount} guardadas.`);
    }
  };
  
  // Discard pending changes
  const discardChanges = async () => {
    setPendingChanges({});
    // Reload locations from server
    try {
      const res = await api.get('/data/locations');
      setLocations(res.data.locations || []);
      toast.info('Cambios descartados');
    } catch (err) {
      toast.error('Error al recargar ubicaciones');
    }
  };
  
  // Handle location click
  const handleLocationClick = (loc, e) => {
    e.stopPropagation();
    
    // In edit mode, start dragging instead of showing info
    if (editMode) {
      handleLocationDragStart(loc, e);
      return;
    }
    
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
    // In edit mode, highlight modified locations
    if (editMode && pendingChanges[loc.id]) {
      return '#f59e0b'; // Orange for modified
    }
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
    const isDraggingThis = draggingLocation?.id === loc.id;
    const isModified = pendingChanges[loc.id] !== undefined;
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
        onMouseDown={(e) => editMode ? handleLocationDragStart(loc, e) : handleLocationClick(loc, e)}
        onClick={(e) => !editMode && handleLocationClick(loc, e)}
        style={{ 
          cursor: editMode ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
          userSelect: 'none',
        }}
        data-testid={`map-location-${loc.id}`}
      >
        {/* Edit mode indicator - larger hit area */}
        {editMode && (
          <circle
            r={20}
            fill="transparent"
            stroke={isModified ? '#f59e0b' : '#3b82f6'}
            strokeWidth={isDraggingThis ? 3 : 1}
            strokeDasharray={isDraggingThis ? 'none' : '4 2'}
            opacity={0.6}
          />
        )}
        
        {/* Glow for selected/route points */}
        {(isSelected || isOrigin || isDestination) && !editMode && (
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
          stroke={editMode && isModified ? '#f59e0b' : loc.refugio ? '#22c55e' : '#333'}
          strokeWidth={editMode && isModified ? 3 : loc.refugio ? 2 : 1}
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
            
            {/* Edit mode toggle - Only for Maestro */}
            {showMasterView && (
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (editMode && Object.keys(pendingChanges).length > 0) {
                      // Ask confirmation before exiting edit mode with changes
                      if (window.confirm('¿Descartar cambios pendientes?')) {
                        discardChanges();
                        setEditMode(false);
                      }
                    } else {
                      setEditMode(!editMode);
                    }
                  }}
                  className={editMode ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  {editMode ? '🔧 Editando' : '✏️ Editar Posiciones'}
                </Button>
                
                {editMode && Object.keys(pendingChanges).length > 0 && (
                  <>
                    <Badge className="bg-orange-500">{Object.keys(pendingChanges).length} cambios</Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={savePendingChanges}
                      disabled={savingChanges}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {savingChanges ? '💾 Guardando...' : '💾 Guardar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={discardChanges}
                      className="text-red-400 border-red-400 hover:bg-red-400/10"
                    >
                      ❌ Descartar
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Edit mode instructions */}
          {editMode && (
            <div className="w-full bg-orange-900/30 border border-orange-600/50 rounded-md p-2 mt-2">
              <p className="text-sm text-orange-200">
                <strong>Modo Edición:</strong> Arrastra los marcadores para reposicionar ubicaciones. 
                Los cambios se marcan en <span className="text-orange-400">naranja</span>. 
                Guarda cuando termines.
              </p>
            </div>
          )}
          
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
        style={{ 
          cursor: editMode 
            ? (draggingLocation ? 'grabbing' : 'crosshair') 
            : (isDragging ? 'grabbing' : 'grab') 
        }}
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
                Single unified map - positioned to align with location markers
                Shifted left to align western coast with location coordinates
              */}
              <image
                href={MAP_IMAGES.unified.url}
                x={-220}
                y={-100}
                width={1350}
                height={1100}
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
