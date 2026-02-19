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

// Human-readable type names
const TYPE_NAMES = {
  ciudad_capital: 'Capital',
  ciudad: 'Ciudad',
  ciudad_puerto: 'Puerto',
  ciudad_elfica: 'Ciudad Élfica',
  pueblo: 'Pueblo',
  fortaleza: 'Fortaleza',
  fortaleza_enemiga: 'Fortaleza Enemiga',
  fortaleza_abandonada: 'Ruinas Fortaleza',
  reino_enano: 'Reino Enano',
  reino_elfico: 'Reino Élfico',
  refugio_elfico: 'Refugio Élfico',
  refugio: 'Refugio',
  ruinas: 'Ruinas',
  bosque: 'Bosque',
  bosque_antiguo: 'Bosque Antiguo',
  bosque_elfico: 'Bosque Élfico',
  bosque_oscuro: 'Bosque Oscuro',
  cordillera: 'Montañas',
  volcan: 'Volcán',
  paso_montaña: 'Paso de Montaña',
  colinas: 'Colinas',
  lago: 'Lago',
  rio: 'Río',
  pantano: 'Pantano',
  region: 'Región',
  vado: 'Vado',
  camino: 'Camino',
  puerto: 'Puerto',
  almenaras: 'Almenaras',
  monumento: 'Monumento',
  lugar_especial: 'Lugar Especial',
};

// Type categories for filtering
const TYPE_CATEGORIES = {
  'Asentamientos': ['ciudad_capital', 'ciudad', 'ciudad_puerto', 'ciudad_elfica', 'pueblo', 'refugio', 'refugio_elfico'],
  'Fortalezas': ['fortaleza', 'fortaleza_enemiga', 'fortaleza_abandonada', 'ruinas'],
  'Reinos': ['reino_enano', 'reino_elfico'],
  'Naturaleza': ['bosque', 'bosque_antiguo', 'bosque_elfico', 'bosque_oscuro', 'cordillera', 'volcan', 'colinas', 'pantano'],
  'Agua': ['lago', 'rio', 'vado'],
  'Caminos': ['camino', 'paso_montaña', 'puerto', 'ciudad_puerto'],
  'Otros': ['region', 'almenaras', 'monumento', 'lugar_especial'],
};

// Available regions for location creation
const REGIONS = [
  'Angmar',
  'Bosque Negro',
  'Eriador',
  'Este de las Montañas',
  'Fangorn',
  'Gondor',
  'Gondor/Harad',
  'Gondor/Rohan',
  'Harad',
  'La Comarca',
  'Montañas Nubladas',
  'Mordor',
  'Mordor/Harad',
  'Nan Curunír',
  'Norte',
  'Rhovanion',
  'Rhûn',
  'Rohan',
  'Rohan/Gondor',
  'Sur',
];

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
  
  // Location edit/delete state
  const [editingLocation, setEditingLocation] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Create new location state
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [newLocationCoords, setNewLocationCoords] = useState(null);
  const [newLocationData, setNewLocationData] = useState({
    nombre: '',
    nombre_sindarin: '',
    region: '',
    tipo: 'ciudad',
    terreno: 'moderado',
    tipo_tierra: 'tierras_libres',
    peligro: 'bajo',
    refugio: false,
    descripcion: '',
    x: 50,
    y: 50,
  });
  
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
      url: 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/8bm4010y_Tierra%20Media.jpg',
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
  
  // Get SVG coordinates from mouse event using native SVG method
  const getSVGPoint = (e) => {
    if (!mapRef.current) return null;
    
    try {
      const svg = mapRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      // Get the inverse of the screen transformation matrix
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      
      const svgP = pt.matrixTransform(ctm.inverse());
      return { x: svgP.x, y: svgP.y };
    } catch (err) {
      console.error('Error getting SVG point:', err);
      return null;
    }
  };
  
  // Handle mouse events for panning
  const handleMouseDown = (e) => {
    // Don't start panning if we're dragging a location
    if (draggingLocation) return;
    
    // If creating a new location, capture the click position
    if (isCreatingLocation && e.button === 0) {
      handleMapClickForNewLocation(e);
      return;
    }
    
    // In edit mode, only start panning if clicking on empty space (not on a marker)
    // The marker's onMouseDown will handle location dragging
    if (e.button === 0) {
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
  
  // Start editing a location
  const startEditingLocation = (loc) => {
    setEditingLocation(loc);
    setEditFormData({
      nombre: loc.nombre || '',
      nombre_sindarin: loc.nombre_sindarin || '',
      region: loc.region || '',
      tipo: loc.tipo || '',
      terreno: loc.terreno || '',
      tipo_tierra: loc.tipo_tierra || '',
      peligro: loc.peligro || 'bajo',
      refugio: loc.refugio || false,
      descripcion: loc.descripcion || '',
      x: loc.x || 50,
      y: loc.y || 50,
    });
    setSelectedLocation(null);
  };
  
  // Save edited location
  const saveEditedLocation = async () => {
    if (!editingLocation) return;
    
    try {
      await api.put(`/data/locations/${editingLocation.id}`, editFormData);
      
      // Update local state
      setLocations(prev => prev.map(loc => 
        loc.id === editingLocation.id 
          ? { ...loc, ...editFormData }
          : loc
      ));
      
      toast.success(`"${editFormData.nombre}" guardado correctamente`);
      setEditingLocation(null);
      setEditFormData({});
    } catch (err) {
      console.error('Error saving location:', err);
      toast.error('Error al guardar la ubicación');
    }
  };
  
  // Delete a location
  const deleteLocation = async (loc) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${loc.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await api.delete(`/data/locations/${loc.id}`);
      
      // Remove from local state
      setLocations(prev => prev.filter(l => l.id !== loc.id));
      
      toast.success(`"${loc.nombre}" eliminado correctamente`);
      setSelectedLocation(null);
      setEditingLocation(null);
    } catch (err) {
      console.error('Error deleting location:', err);
      toast.error('Error al eliminar la ubicación');
    }
    setIsDeleting(false);
  };
  
  // Start creating a new location
  const startCreatingLocation = () => {
    setIsCreatingLocation(true);
    setNewLocationCoords(null);
    setNewLocationData({
      nombre: '',
      nombre_sindarin: '',
      region: '',
      tipo: 'ciudad',
      terreno: 'moderado',
      tipo_tierra: 'tierras_libres',
      peligro: 'bajo',
      refugio: false,
      descripcion: '',
      x: 50,
      y: 50,
    });
    toast.info('Haz clic en el mapa para seleccionar la ubicación');
  };
  
  // Handle map click for new location - ONLY accepts first click
  const handleMapClickForNewLocation = (e) => {
    if (!isCreatingLocation) return;
    
    // If coordinates already selected, don't change them
    if (newLocationCoords) return;
    
    const svgPoint = getSVGPoint(e);
    if (svgPoint) {
      const coords = posToCoord(svgPoint.x, svgPoint.y);
      setNewLocationCoords(coords);
      setNewLocationData(prev => ({
        ...prev,
        x: coords.x,
        y: coords.y,
      }));
      toast.success(`Posición seleccionada: (${coords.x}, ${coords.y}). Ahora rellena los datos.`);
    }
  };
  
  // Reset coordinates for new location (if user wants to change position)
  const resetNewLocationCoords = () => {
    setNewLocationCoords(null);
    toast.info('Haz clic en el mapa para seleccionar nueva posición');
  };
  
  // Save new location
  const saveNewLocation = async () => {
    if (!newLocationData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    
    if (!newLocationCoords) {
      toast.error('Haz clic en el mapa para seleccionar la posición');
      return;
    }
    
    if (!newLocationData.region) {
      toast.error('Selecciona una región');
      return;
    }
    
    try {
      // Generate a unique ID
      const id = newLocationData.nombre.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
      
      const locationToCreate = {
        nombre: newLocationData.nombre,
        nombre_sindarin: newLocationData.nombre_sindarin || '',
        region: newLocationData.region,
        tipo: newLocationData.tipo,
        terreno: newLocationData.terreno,
        tipo_tierra: newLocationData.tipo_tierra,
        peligro: newLocationData.peligro,
        refugio: newLocationData.refugio,
        descripcion: newLocationData.descripcion || '',
        x: newLocationCoords.x,
        y: newLocationCoords.y,
      };
      
      console.log('Creating location:', locationToCreate);
      const res = await api.post('/data/locations', locationToCreate);
      console.log('Response:', res.data);
      
      // Add to local state with the ID from the response
      const newLoc = { 
        ...locationToCreate, 
        id: res.data.id,
        _id: res.data.id 
      };
      setLocations(prev => [...prev, newLoc]);
      
      toast.success(`"${newLocationData.nombre}" creado correctamente`);
      setIsCreatingLocation(false);
      setNewLocationCoords(null);
      setNewLocationData({
        nombre: '',
        nombre_sindarin: '',
        region: '',
        tipo: 'ciudad',
        terreno: 'moderado',
        tipo_tierra: 'tierras_libres',
        peligro: 'bajo',
        refugio: false,
        descripcion: '',
        x: 50,
        y: 50,
      });
    } catch (err) {
      console.error('Error creating location:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Error desconocido';
      toast.error(`Error al crear: ${errorMsg}`);
    }
  };
  
  // Cancel creating location
  const cancelCreatingLocation = () => {
    setIsCreatingLocation(false);
    setNewLocationCoords(null);
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
    
    // Calculate inverse scale to keep markers same size regardless of zoom
    const inverseZoom = 1 / zoom;
    // Base marker size (will stay constant on screen)
    const baseSize = editMode ? 4 : 6;
    const markerSize = baseSize * inverseZoom;
    const hitAreaSize = 15 * inverseZoom;
    
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
        {/* Invisible hit area for easier clicking */}
        <circle
          r={hitAreaSize}
          fill="transparent"
          stroke="none"
        />
        
        {/* Edit mode indicator */}
        {editMode && (
          <circle
            r={hitAreaSize * 0.8}
            fill="transparent"
            stroke={isModified ? '#f59e0b' : '#3b82f6'}
            strokeWidth={1 * inverseZoom}
            strokeDasharray={isDraggingThis ? 'none' : `${3 * inverseZoom} ${2 * inverseZoom}`}
            opacity={0.6}
          />
        )}
        
        {/* Glow for selected/route points */}
        {(isSelected || isOrigin || isDestination) && !editMode && (
          <circle
            r={markerSize * 2}
            fill="none"
            stroke={isOrigin ? '#22c55e' : isDestination ? '#ef4444' : '#c9a227'}
            strokeWidth={2 * inverseZoom}
            opacity={0.8}
            className="animate-pulse"
          />
        )}
        
        {/* Main marker - simple dot */}
        <circle
          r={markerSize}
          fill={color}
          stroke={editMode && isModified ? '#f59e0b' : loc.refugio ? '#22c55e' : '#333'}
          strokeWidth={(editMode && isModified ? 2 : 1) * inverseZoom}
          opacity={0.9}
        />
        
        {/* Icon (only when NOT in edit mode and zoom is reasonable) */}
        {!editMode && showMasterView && zoom > 0.8 && zoom < 2.5 && (
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10 * inverseZoom}
            style={{ pointerEvents: 'none' }}
          >
            {icon}
          </text>
        )}
        
        {/* Label - only visible when zoomed in (>100%), fixed size on screen */}
        {showLabels && !editMode && zoom > 1 && (
          <text
            y={12 * inverseZoom}
            textAnchor="middle"
            fill="#fff"
            fontSize={9 * inverseZoom}
            fontWeight="bold"
            stroke="#000"
            strokeWidth={2.5 * inverseZoom}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {loc.nombre}
          </text>
        )}
        
        {/* Label in edit mode - visible when zoomed in, fixed size */}
        {editMode && showLabels && zoom > 1 && (
          <text
            y={10 * inverseZoom}
            textAnchor="middle"
            fill="#fff"
            fontSize={8 * inverseZoom}
            fontWeight="bold"
            stroke="#000"
            strokeWidth={2 * inverseZoom}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {loc.nombre}
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
          
          {/* Coordinates display */}
          <div className="text-xs text-muted-foreground">
            Coordenadas: ({loc.x}, {loc.y})
          </div>
          
          {/* Route buttons */}
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
          
          {/* Edit/Delete buttons - Only for Maestro */}
          {showMasterView && (
            <div className="flex gap-2 pt-2 border-t border-border/30">
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEditingLocation(loc)}
                className="flex-1"
              >
                ✏️ Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteLocation(loc)}
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
  
  // Render edit location panel
  const renderEditPanel = () => {
    if (!editingLocation) return null;
    
    return (
      <Card className="absolute top-4 right-4 w-96 card-parchment z-30 max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              ✏️ Editar Ubicación
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingLocation(null);
                setEditFormData({});
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground">Nombre</label>
            <Input
              value={editFormData.nombre}
              onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
              placeholder="Nombre de la ubicación"
            />
          </div>
          
          {/* Sindarin name */}
          <div>
            <label className="text-xs text-muted-foreground">Nombre Sindarin (opcional)</label>
            <Input
              value={editFormData.nombre_sindarin}
              onChange={(e) => setEditFormData({ ...editFormData, nombre_sindarin: e.target.value })}
              placeholder="Nombre en Sindarin"
            />
          </div>
          
          {/* Region */}
          <div>
            <label className="text-xs text-muted-foreground">Región</label>
            <Input
              value={editFormData.region}
              onChange={(e) => setEditFormData({ ...editFormData, region: e.target.value })}
              placeholder="Región"
            />
          </div>
          
          {/* Type */}
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={editFormData.tipo} onValueChange={(v) => setEditFormData({ ...editFormData, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_NAMES).map(([key, name]) => (
                  <SelectItem key={key} value={key}>{LOCATION_ICONS[key]} {name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Terrain */}
          <div>
            <label className="text-xs text-muted-foreground">Terreno</label>
            <Select value={editFormData.terreno} onValueChange={(v) => setEditFormData({ ...editFormData, terreno: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facil">Fácil</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="dificil">Difícil</SelectItem>
                <SelectItem value="severo">Severo</SelectItem>
                <SelectItem value="peligroso">Peligroso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Land type */}
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Tierra</label>
            <Select value={editFormData.tipo_tierra} onValueChange={(v) => setEditFormData({ ...editFormData, tipo_tierra: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tierras_libres">Tierras Libres</SelectItem>
                <SelectItem value="tierras_fronterizas">Tierras Fronterizas</SelectItem>
                <SelectItem value="tierras_salvajes">Tierras Salvajes</SelectItem>
                <SelectItem value="tierras_de_la_sombra">Tierras de la Sombra</SelectItem>
                <SelectItem value="tierras_oscuras">Tierras Oscuras</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Danger */}
          <div>
            <label className="text-xs text-muted-foreground">Nivel de Peligro</label>
            <Select value={editFormData.peligro} onValueChange={(v) => setEditFormData({ ...editFormData, peligro: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bajo">Bajo</SelectItem>
                <SelectItem value="medio">Medio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="muy_alto">Muy Alto</SelectItem>
                <SelectItem value="extremo">Extremo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Coordinates */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">X</label>
              <Input
                type="number"
                step="0.1"
                value={editFormData.x}
                onChange={(e) => setEditFormData({ ...editFormData, x: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Y</label>
              <Input
                type="number"
                step="0.1"
                value={editFormData.y}
                onChange={(e) => setEditFormData({ ...editFormData, y: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          
          {/* Refuge checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="refugio-edit"
              checked={editFormData.refugio}
              onChange={(e) => setEditFormData({ ...editFormData, refugio: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="refugio-edit" className="text-sm">Es un refugio seguro</label>
          </div>
          
          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground">Descripción</label>
            <textarea
              value={editFormData.descripcion}
              onChange={(e) => setEditFormData({ ...editFormData, descripcion: e.target.value })}
              placeholder="Descripción del lugar..."
              className="w-full h-24 p-2 text-sm bg-background border border-input rounded resize-none"
            />
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-border/30">
            <Button
              size="sm"
              onClick={saveEditedLocation}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              💾 Guardar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => deleteLocation(editingLocation)}
              disabled={isDeleting}
              className="flex-1 text-red-400 border-red-400/50 hover:bg-red-400/10"
            >
              🗑️ Eliminar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  // Render create new location panel
  const renderCreatePanel = () => {
    if (!isCreatingLocation) return null;
    
    return (
      <Card className="absolute top-4 right-4 w-96 card-parchment z-30 max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              ➕ Crear Nueva Ubicación
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelCreatingLocation}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Position indicator */}
          {newLocationCoords ? (
            <div className="p-2 bg-green-900/30 border border-green-600/50 rounded text-sm text-green-200 flex items-center justify-between">
              <span>📍 Posición: ({newLocationCoords.x}, {newLocationCoords.y})</span>
              <Button
                size="sm"
                variant="outline"
                onClick={resetNewLocationCoords}
                className="text-xs h-6 px-2"
              >
                🔄 Cambiar
              </Button>
            </div>
          ) : (
            <div className="p-2 bg-yellow-900/30 border border-yellow-600/50 rounded text-sm text-yellow-200">
              ⚠️ Haz clic en el mapa para seleccionar la posición
            </div>
          )}
          
          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground">Nombre *</label>
            <Input
              value={newLocationData.nombre}
              onChange={(e) => setNewLocationData({ ...newLocationData, nombre: e.target.value })}
              placeholder="Nombre de la ubicación"
            />
          </div>
          
          {/* Sindarin name */}
          <div>
            <label className="text-xs text-muted-foreground">Nombre Sindarin (opcional)</label>
            <Input
              value={newLocationData.nombre_sindarin}
              onChange={(e) => setNewLocationData({ ...newLocationData, nombre_sindarin: e.target.value })}
              placeholder="Nombre en Sindarin"
            />
          </div>
          
          {/* Region - Dropdown */}
          <div>
            <label className="text-xs text-muted-foreground">Región *</label>
            <Select value={newLocationData.region} onValueChange={(v) => setNewLocationData({ ...newLocationData, region: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una región" />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Type */}
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={newLocationData.tipo} onValueChange={(v) => setNewLocationData({ ...newLocationData, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_NAMES).map(([key, name]) => (
                  <SelectItem key={key} value={key}>{LOCATION_ICONS[key]} {name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Terrain */}
          <div>
            <label className="text-xs text-muted-foreground">Terreno</label>
            <Select value={newLocationData.terreno} onValueChange={(v) => setNewLocationData({ ...newLocationData, terreno: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facil">Fácil</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="dificil">Difícil</SelectItem>
                <SelectItem value="severo">Severo</SelectItem>
                <SelectItem value="peligroso">Peligroso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Land type */}
          <div>
            <label className="text-xs text-muted-foreground">Tipo de Tierra</label>
            <Select value={newLocationData.tipo_tierra} onValueChange={(v) => setNewLocationData({ ...newLocationData, tipo_tierra: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tierras_libres">Tierras Libres</SelectItem>
                <SelectItem value="tierras_fronterizas">Tierras Fronterizas</SelectItem>
                <SelectItem value="tierras_salvajes">Tierras Salvajes</SelectItem>
                <SelectItem value="tierras_de_la_sombra">Tierras de la Sombra</SelectItem>
                <SelectItem value="tierras_oscuras">Tierras Oscuras</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Danger */}
          <div>
            <label className="text-xs text-muted-foreground">Nivel de Peligro</label>
            <Select value={newLocationData.peligro} onValueChange={(v) => setNewLocationData({ ...newLocationData, peligro: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bajo">Bajo</SelectItem>
                <SelectItem value="medio">Medio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="muy_alto">Muy Alto</SelectItem>
                <SelectItem value="extremo">Extremo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Refuge checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="refugio-new"
              checked={newLocationData.refugio}
              onChange={(e) => setNewLocationData({ ...newLocationData, refugio: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="refugio-new" className="text-sm">Es un refugio seguro</label>
          </div>
          
          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground">Descripción</label>
            <textarea
              value={newLocationData.descripcion}
              onChange={(e) => setNewLocationData({ ...newLocationData, descripcion: e.target.value })}
              placeholder="Descripción del lugar..."
              className="w-full h-20 p-2 text-sm bg-background border border-input rounded resize-none"
            />
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-border/30">
            <Button
              size="sm"
              onClick={saveNewLocation}
              disabled={!newLocationCoords || !newLocationData.nombre.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              💾 Crear Ubicación
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelCreatingLocation}
              className="flex-1 text-red-400 border-red-400/50 hover:bg-red-400/10"
            >
              ❌ Cancelar
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
          {editMode && !isCreatingLocation && (
            <div className="w-full bg-orange-900/30 border border-orange-600/50 rounded-md p-2 mt-2 flex items-center justify-between">
              <p className="text-sm text-orange-200">
                <strong>Modo Edición:</strong> Arrastra los marcadores para reposicionar ubicaciones. 
                Los cambios se marcan en <span className="text-orange-400">naranja</span>. 
                Guarda cuando termines.
              </p>
              <Button
                size="sm"
                onClick={startCreatingLocation}
                className="bg-green-600 hover:bg-green-700 ml-4"
              >
                ➕ Crear Ubicación
              </Button>
            </div>
          )}
          
          {/* Creating location mode */}
          {isCreatingLocation && (
            <div className="w-full bg-green-900/30 border border-green-600/50 rounded-md p-2 mt-2 flex items-center justify-between">
              <p className="text-sm text-green-200">
                <strong>Crear Ubicación:</strong> Haz clic en el mapa para seleccionar la posición.
                {newLocationCoords && (
                  <span className="ml-2 text-green-400">
                    Posición: ({newLocationCoords.x}, {newLocationCoords.y})
                  </span>
                )}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelCreatingLocation}
                className="text-red-400 border-red-400/50 hover:bg-red-400/10 ml-4"
              >
                ❌ Cancelar
              </Button>
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
                <SelectItem value="all">Todos los tipos</SelectItem>
                {types.map(t => (
                  <SelectItem key={t} value={t}>
                    {LOCATION_ICONS[t]} {TYPE_NAMES[t] || t}
                  </SelectItem>
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
              onClick={() => setZoom(z => Math.max(0.1, z - 0.2))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <input
              type="text"
              value={`${Math.round(zoom * 100)}%`}
              onChange={(e) => {
                const val = e.target.value.replace('%', '').trim();
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 10 && num <= 1500) {
                  setZoom(num / 100);
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.replace('%', '').trim();
                const num = parseInt(val, 10);
                if (isNaN(num) || num < 10) {
                  setZoom(0.1);
                } else if (num > 1500) {
                  setZoom(15);
                }
              }}
              className="w-16 text-center text-sm bg-background border border-input rounded px-1 py-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(z => Math.min(15, z + 0.2))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPan({ x: 0, y: 0 })}
              title="Centrar mapa (mantiene zoom)"
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
          cursor: isCreatingLocation 
            ? 'crosshair'
            : editMode 
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
          
          {/* Temporary marker for new location */}
          {isCreatingLocation && newLocationCoords && (
            <g transform={`translate(${coordToPos(newLocationCoords.x, newLocationCoords.y).x}, ${coordToPos(newLocationCoords.x, newLocationCoords.y).y})`}>
              <circle
                r={10 / zoom}
                fill="#22c55e"
                stroke="#fff"
                strokeWidth={3 / zoom}
                opacity={0.9}
                className="animate-pulse"
              />
              <text
                y={-15 / zoom}
                textAnchor="middle"
                fill="#22c55e"
                fontSize={12 / zoom}
                fontWeight="bold"
                stroke="#000"
                strokeWidth={2 / zoom}
                paintOrder="stroke"
              >
                Nueva ubicación
              </text>
            </g>
          )}
        </svg>
        
        {/* Info panels */}
        {renderInfoPanel()}
        {renderEditPanel()}
        {renderCreatePanel()}
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
