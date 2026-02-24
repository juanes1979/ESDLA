/**
 * Interactive Middle-earth Map Component
 * Displays all 182 locations with terrain, land types, and route calculation
 * Supports player/master view modes
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Compass, Ruler, ArrowLeft
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

// Hierarchical region structure - Main regions with sub-regions/provinces
const REGION_HIERARCHY = {
  'Eriador': {
    label: 'Eriador',
    subregions: ['La Comarca', 'Tierras de Bree', 'Arthedain', 'Cardolan', 'Rhudaur', 'Lindon', 'Eregion']
  },
  'Angmar': {
    label: 'Angmar',
    subregions: []
  },
  'Montañas Nubladas': {
    label: 'Montañas Nubladas',
    subregions: ['Paso Alto', 'Moria', 'Este de las Montañas']
  },
  'Rhovanion': {
    label: 'Rhovanion',
    subregions: ['Bosque Negro', 'Valle del Anduin', 'Valle', 'Erebor', 'Esgaroth', 'Lothlórien', 'Tierras Pardas']
  },
  'Fangorn': {
    label: 'Fangorn',
    subregions: []
  },
  'Rohan': {
    label: 'Rohan',
    subregions: ['Folde Este', 'Folde Oeste', 'Cuernavilla', 'Nan Curunír']
  },
  'Gondor': {
    label: 'Gondor',
    subregions: ['Anórien', 'Ithilien', 'Lebennin', 'Belfalas', 'Lamedon', 'Anfalas', 'Dor-en-Ernil']
  },
  'Mordor': {
    label: 'Mordor',
    subregions: ['Gorgoroth', 'Nurn', 'Udûn', 'Lithlad']
  },
  'Rhûn': {
    label: 'Rhûn',
    subregions: ['Dorwinion']
  },
  'Harad': {
    label: 'Harad',
    subregions: ['Harad Cercano', 'Harad Lejano', 'Umbar']
  },
  'Norte': {
    label: 'Norte (Forodwaith)',
    subregions: []
  },
  'Sur': {
    label: 'Sur',
    subregions: []
  },
};

// Flat list of all regions for simple dropdowns (backwards compatible)
const REGIONS = [
  // Main regions
  'Eriador', 'Angmar', 'Montañas Nubladas', 'Rhovanion', 'Fangorn', 
  'Rohan', 'Gondor', 'Mordor', 'Rhûn', 'Harad', 'Norte', 'Sur',
  // Sub-regions
  'La Comarca', 'Tierras de Bree', 'Arthedain', 'Cardolan', 'Rhudaur', 'Lindon', 'Eregion',
  'Paso Alto', 'Moria', 'Este de las Montañas',
  'Bosque Negro', 'Valle del Anduin', 'Valle', 'Erebor', 'Esgaroth', 'Lothlórien', 'Tierras Pardas',
  'Folde Este', 'Folde Oeste', 'Cuernavilla', 'Nan Curunír',
  'Anórien', 'Ithilien', 'Lebennin', 'Belfalas', 'Lamedon', 'Anfalas', 'Dor-en-Ernil',
  'Gorgoroth', 'Nurn', 'Udûn', 'Lithlad',
  'Dorwinion',
  'Harad Cercano', 'Harad Lejano', 'Umbar',
];

const MiddleEarthMap = () => {
  const navigate = useNavigate();
  
  // Data state
  const [locations, setLocations] = useState([]);
  const [regionsHierarchy, setRegionsHierarchy] = useState([]);  // Dynamic regions from backend
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
  const [isCreatingNewType, setIsCreatingNewType] = useState(false);
  const [newCustomType, setNewCustomType] = useState('');
  const [customTypes, setCustomTypes] = useState([]); // Store user-created types
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
  
  // Road/Path drawing state
  const [isDrawingRoad, setIsDrawingRoad] = useState(false);
  const [currentRoad, setCurrentRoad] = useState(null);  // Road being drawn
  const [roads, setRoads] = useState([]);  // All saved roads
  const [selectedRoad, setSelectedRoad] = useState(null);  // Road selected for editing
  const [showRoads, setShowRoads] = useState(true);  // Toggle road visibility
  const [showRoadsPanel, setShowRoadsPanel] = useState(false);  // Show roads management panel
  const [editingRoadId, setEditingRoadId] = useState(null);  // Road being edited in panel
  const [roadFormData, setRoadFormData] = useState({
    nombre: '',
    tipo: 'secundario',  // sendero, secundario, real
    descripcion: '',
  });
  
  // Road types configuration
  const ROAD_TYPES = {
    sendero: { label: 'Sendero', color: '#8B7355', width: 2, dash: [5, 5] },
    secundario: { label: 'Camino Secundario', color: '#C4A574', width: 3, dash: [] },
    real: { label: 'Camino Real', color: '#FFD700', width: 4, dash: [] },
  };
  
  // River types configuration
  const RIVER_TYPES = {
    vadeable: { label: 'Vadeable', color: '#4A90D9', width: 3, dash: [], description: 'Cruzable con montura' },
    profundo: { label: 'Profundo', color: '#2E5A8B', width: 4, dash: [], description: 'Solo nadando, sin monturas' },
    infranqueable: { label: 'Infranqueable', color: '#1A3A5C', width: 5, dash: [], description: 'Solo barcaza o puente' },
  };
  
  // Barrier types (impassable lines)
  const BARRIER_TYPES = {
    montana: { label: 'Montaña', color: '#8B4513', width: 4, dash: [10, 5], description: 'Cordillera infranqueable' },
    acantilado: { label: 'Acantilado', color: '#654321', width: 3, dash: [5, 3], description: 'Pared vertical' },
    frontera: { label: 'Frontera Oscura', color: '#4A0000', width: 3, dash: [8, 4], description: 'Barrera mágica/peligrosa' },
  };
  
  // Rivers state
  const [rivers, setRivers] = useState([]);
  const [isDrawingRiver, setIsDrawingRiver] = useState(false);
  const [currentRiver, setCurrentRiver] = useState(null);
  const [selectedRiver, setSelectedRiver] = useState(null);
  const [showRivers, setShowRivers] = useState(true);
  const [showRiversPanel, setShowRiversPanel] = useState(false);
  const [editingRiverId, setEditingRiverId] = useState(null);
  const [riverFormData, setRiverFormData] = useState({
    nombre: '',
    tipo: 'profundo',
  });
  
  // Barriers state (impassable lines)
  const [barriers, setBarriers] = useState([]);
  const [isDrawingBarrier, setIsDrawingBarrier] = useState(false);
  const [currentBarrier, setCurrentBarrier] = useState(null);
  const [selectedBarrier, setSelectedBarrier] = useState(null);
  const [showBarriers, setShowBarriers] = useState(true);
  const [showBarriersPanel, setShowBarriersPanel] = useState(false);
  const [editingBarrierId, setEditingBarrierId] = useState(null);
  const [barrierFormData, setBarrierFormData] = useState({
    nombre: '',
    tipo: 'montana',
  });
  
  // Pathfinding state
  const [calculatedPath, setCalculatedPath] = useState(null);  // Pathfinding result
  const [showCalculatedPath, setShowCalculatedPath] = useState(true);  // Toggle visibility
  const [isCalculatingPath, setIsCalculatingPath] = useState(false);
  
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
  
  // Load locations and regions
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load locations and regions in parallel
        const [locRes, regRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/data/regions')
        ]);
        setLocations(locRes.data.locations || []);
        setRegionsHierarchy(regRes.data.regions || []);
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Error al cargar datos del mapa');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  // Load roads from database
  useEffect(() => {
    const loadRoads = async () => {
      try {
        const res = await api.get('/data/roads');
        setRoads(res.data.roads || []);
      } catch (err) {
        console.error('Error loading roads:', err);
      }
    };
    loadRoads();
  }, []);
  
  // Load rivers from database
  useEffect(() => {
    const loadRivers = async () => {
      try {
        const res = await api.get('/data/rivers');
        setRivers(res.data.rivers || []);
      } catch (err) {
        console.error('Error loading rivers:', err);
      }
    };
    loadRivers();
  }, []);
  
  // Load barriers from database
  useEffect(() => {
    const loadBarriers = async () => {
      try {
        const res = await api.get('/data/barriers');
        setBarriers(res.data.barriers || []);
      } catch (err) {
        console.error('Error loading barriers:', err);
      }
    };
    loadBarriers();
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
  
  // ==================== ROAD DRAWING FUNCTIONS ====================
  
  // Start drawing a new road
  const startDrawingRoad = () => {
    setIsDrawingRoad(true);
    setCurrentRoad({
      id: `road_${Date.now()}`,
      nombre: roadFormData.nombre || 'Nuevo Camino',
      tipo: roadFormData.tipo,
      descripcion: roadFormData.descripcion,
      puntos: [],  // Array of {x, y} coordinates (percentage)
    });
    toast.info('Haz clic en el mapa para añadir puntos al camino. Doble clic para terminar.');
  };
  
  // Add point to current road
  const addRoadPoint = (e) => {
    if (!isDrawingRoad || !currentRoad) return;
    
    const svgPoint = getSVGPoint(e);
    if (!svgPoint) return;
    
    const coords = posToCoord(svgPoint.x, svgPoint.y);
    
    setCurrentRoad(prev => ({
      ...prev,
      puntos: [...prev.puntos, { x: coords.x, y: coords.y }],
    }));
  };
  
  // Finish drawing current road
  const finishDrawingRoad = async () => {
    if (!currentRoad || currentRoad.puntos.length < 2) {
      toast.error('El camino debe tener al menos 2 puntos');
      return;
    }
    
    try {
      // Save to database
      const res = await api.post('/data/roads', currentRoad);
      setRoads(prev => [...prev, res.data]);
      toast.success(`Camino "${currentRoad.nombre}" guardado`);
    } catch (err) {
      console.error('Error saving road:', err);
      toast.error('Error al guardar el camino');
    }
    
    setIsDrawingRoad(false);
    setCurrentRoad(null);
  };
  
  // Cancel drawing
  const cancelDrawingRoad = () => {
    setIsDrawingRoad(false);
    setCurrentRoad(null);
    toast.info('Dibujo de camino cancelado');
  };
  
  // Delete a road
  const deleteRoad = async (roadId) => {
    if (!window.confirm('¿Eliminar este camino?')) return;
    
    try {
      await api.delete(`/data/roads/${roadId}`);
      setRoads(prev => prev.filter(r => r.id !== roadId));
      setSelectedRoad(null);
      toast.success('Camino eliminado');
    } catch (err) {
      console.error('Error deleting road:', err);
      toast.error('Error al eliminar el camino');
    }
  };
  
  // Update road properties
  const updateRoad = async (roadId, updates) => {
    try {
      const res = await api.put(`/data/roads/${roadId}`, updates);
      setRoads(prev => prev.map(r => r.id === roadId ? { ...r, ...updates } : r));
      toast.success('Camino actualizado');
      setEditingRoadId(null);
      return res.data;
    } catch (err) {
      console.error('Error updating road:', err);
      toast.error('Error al actualizar el camino');
    }
  };
  
  // Render roads management panel
  const renderRoadsPanel = () => {
    if (!showRoadsPanel) return null;
    
    return (
      <Card className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
              🛤️ Gestión de Caminos
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRoadsPanel(false)}
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{roads.length} caminos guardados</p>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
          {roads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay caminos dibujados.<br/>
              Usa "Dibujar Camino" para crear uno.
            </p>
          ) : (
            roads.map(road => {
              const roadStyle = ROAD_TYPES[road.tipo] || ROAD_TYPES.secundario;
              const isEditing = editingRoadId === road.id;
              
              return (
                <div 
                  key={road.id}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedRoad?.id === road.id 
                      ? 'border-green-500 bg-green-900/20' 
                      : 'border-border/30 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  {isEditing ? (
                    // Edit mode
                    <div className="space-y-2">
                      <Input
                        value={road.nombre}
                        onChange={(e) => setRoads(prev => prev.map(r => 
                          r.id === road.id ? { ...r, nombre: e.target.value } : r
                        ))}
                        className="h-8 text-sm"
                        placeholder="Nombre del camino"
                      />
                      <select
                        value={road.tipo}
                        onChange={(e) => setRoads(prev => prev.map(r => 
                          r.id === road.id ? { ...r, tipo: e.target.value } : r
                        ))}
                        className="w-full h-8 text-sm bg-black/30 border border-border/30 rounded px-2"
                      >
                        {Object.entries(ROAD_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-7 bg-green-600 hover:bg-green-700"
                          onClick={() => updateRoad(road.id, { nombre: road.nombre, tipo: road.tipo })}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setEditingRoadId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-4 h-1 rounded"
                          style={{ 
                            backgroundColor: roadStyle.color,
                            borderStyle: road.tipo === 'sendero' ? 'dashed' : 'solid'
                          }}
                        />
                        <span className="font-medium text-sm flex-1">{road.nombre}</span>
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: roadStyle.color + '40', color: roadStyle.color }}
                        >
                          {roadStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {road.puntos?.length || 0} puntos
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs flex-1"
                          onClick={() => {
                            setSelectedRoad(road);
                            // Center map on road midpoint
                            if (road.puntos?.length > 0) {
                              const mid = road.puntos[Math.floor(road.puntos.length / 2)];
                              const pos = coordToPos(mid.x, mid.y);
                              setPan({ x: -pos.x * zoom + window.innerWidth / 2, y: -pos.y * zoom + window.innerHeight / 2 });
                            }
                          }}
                        >
                          👁️ Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => setEditingRoadId(road.id)}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs text-red-400 hover:text-red-300"
                          onClick={() => deleteRoad(road.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
        
        {/* Quick stats footer */}
        <div className="p-3 border-t border-border/30 flex-shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>🥾 Senderos: {roads.filter(r => r.tipo === 'sendero').length}</span>
            <span>🛤️ Secundarios: {roads.filter(r => r.tipo === 'secundario').length}</span>
            <span>👑 Reales: {roads.filter(r => r.tipo === 'real').length}</span>
          </div>
        </div>
      </Card>
    );
  };
  
  // Convert road points to SVG path
  const roadToPath = (road) => {
    if (!road.puntos || road.puntos.length < 2) return '';
    
    const points = road.puntos.map(p => coordToPos(p.x, p.y));
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return d;
  };
  
  // Handle map click for road drawing
  const handleMapClickForRoad = (e) => {
    if (!isDrawingRoad) return;
    
    // Check for double-click to finish
    if (e.detail === 2) {
      finishDrawingRoad();
      return;
    }
    
    addRoadPoint(e);
  };
  
  // ==================== END ROAD DRAWING FUNCTIONS ====================
  
  // ==================== RIVER DRAWING FUNCTIONS ====================
  
  // Start drawing a new river
  const startDrawingRiver = () => {
    setIsDrawingRiver(true);
    setCurrentRiver({
      id: `river_${Date.now()}`,
      nombre: riverFormData.nombre || 'Nuevo Río',
      tipo: riverFormData.tipo,
      puntos: [],
    });
    toast.info('Haz clic en el mapa para añadir puntos al río. Doble clic para terminar.');
  };
  
  // Add point to current river
  const addRiverPoint = (e) => {
    if (!isDrawingRiver || !currentRiver) return;
    
    const svgPoint = getSVGPoint(e);
    if (!svgPoint) return;
    
    const coords = posToCoord(svgPoint.x, svgPoint.y);
    
    setCurrentRiver(prev => ({
      ...prev,
      puntos: [...prev.puntos, { x: coords.x, y: coords.y }],
    }));
  };
  
  // Finish drawing current river
  const finishDrawingRiver = async () => {
    if (!currentRiver || currentRiver.puntos.length < 2) {
      toast.error('El río debe tener al menos 2 puntos');
      return;
    }
    
    try {
      const res = await api.post('/data/rivers', currentRiver);
      setRivers(prev => [...prev, res.data]);
      toast.success(`Río "${currentRiver.nombre}" guardado`);
    } catch (err) {
      console.error('Error saving river:', err);
      toast.error('Error al guardar el río');
    }
    
    setIsDrawingRiver(false);
    setCurrentRiver(null);
  };
  
  // Cancel drawing river
  const cancelDrawingRiver = () => {
    setIsDrawingRiver(false);
    setCurrentRiver(null);
    toast.info('Dibujo de río cancelado');
  };
  
  // Delete a river
  const deleteRiver = async (riverId) => {
    if (!window.confirm('¿Eliminar este río?')) return;
    
    try {
      await api.delete(`/data/rivers/${riverId}`);
      setRivers(prev => prev.filter(r => r.id !== riverId));
      setSelectedRiver(null);
      toast.success('Río eliminado');
    } catch (err) {
      console.error('Error deleting river:', err);
      toast.error('Error al eliminar el río');
    }
  };
  
  // Update river properties
  const updateRiver = async (riverId, updates) => {
    try {
      const res = await api.put(`/data/rivers/${riverId}`, updates);
      setRivers(prev => prev.map(r => r.id === riverId ? { ...r, ...updates } : r));
      toast.success('Río actualizado');
      setEditingRiverId(null);
      return res.data;
    } catch (err) {
      console.error('Error updating river:', err);
      toast.error('Error al actualizar el río');
    }
  };
  
  // Convert river points to SVG path
  const riverToPath = (river) => {
    if (!river.puntos || river.puntos.length < 2) return '';
    
    const points = river.puntos.map(p => coordToPos(p.x, p.y));
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return d;
  };
  
  // Handle map click for river drawing
  const handleMapClickForRiver = (e) => {
    if (!isDrawingRiver) return;
    
    if (e.detail === 2) {
      finishDrawingRiver();
      return;
    }
    
    addRiverPoint(e);
  };
  
  // Render rivers management panel
  const renderRiversPanel = () => {
    if (!showRiversPanel) return null;
    
    return (
      <Card className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[hsl(var(--magic-blue))] flex items-center gap-2">
              🌊 Gestión de Ríos
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRiversPanel(false)}
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{rivers.length} ríos guardados</p>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
          {rivers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ríos dibujados.<br/>
              Usa "Dibujar Río" para crear uno.
            </p>
          ) : (
            rivers.map(river => {
              const riverStyle = RIVER_TYPES[river.tipo] || RIVER_TYPES.profundo;
              const isEditing = editingRiverId === river.id;
              
              return (
                <div 
                  key={river.id}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedRiver?.id === river.id 
                      ? 'border-blue-500 bg-blue-900/20' 
                      : 'border-border/30 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={river.nombre}
                        onChange={(e) => setRivers(prev => prev.map(r => 
                          r.id === river.id ? { ...r, nombre: e.target.value } : r
                        ))}
                        className="h-8 text-sm"
                        placeholder="Nombre del río"
                      />
                      <select
                        value={river.tipo}
                        onChange={(e) => setRivers(prev => prev.map(r => 
                          r.id === river.id ? { ...r, tipo: e.target.value } : r
                        ))}
                        className="w-full h-8 text-sm bg-black/30 border border-border/30 rounded px-2"
                      >
                        {Object.entries(RIVER_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-7 bg-blue-600 hover:bg-blue-700"
                          onClick={() => updateRiver(river.id, { nombre: river.nombre, tipo: river.tipo })}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setEditingRiverId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-4 h-1 rounded"
                          style={{ backgroundColor: riverStyle.color }}
                        />
                        <span className="font-medium text-sm flex-1">{river.nombre}</span>
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: riverStyle.color + '40', color: riverStyle.color }}
                        >
                          {riverStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {riverStyle.description}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {river.puntos?.length || 0} puntos
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs flex-1"
                          onClick={() => {
                            setSelectedRiver(river);
                            if (river.puntos?.length > 0) {
                              const mid = river.puntos[Math.floor(river.puntos.length / 2)];
                              const pos = coordToPos(mid.x, mid.y);
                              setPan({ x: -pos.x * zoom + window.innerWidth / 2, y: -pos.y * zoom + window.innerHeight / 2 });
                            }
                          }}
                        >
                          👁️ Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => setEditingRiverId(river.id)}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs text-red-400 hover:text-red-300"
                          onClick={() => deleteRiver(river.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
        
        <div className="p-3 border-t border-border/30 flex-shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>🏊 Vadeable: {rivers.filter(r => r.tipo === 'vadeable').length}</span>
            <span>🌊 Profundo: {rivers.filter(r => r.tipo === 'profundo').length}</span>
            <span>⛔ Infranq.: {rivers.filter(r => r.tipo === 'infranqueable').length}</span>
          </div>
        </div>
      </Card>
    );
  };
  
  // ==================== END RIVER DRAWING FUNCTIONS ====================
  
  // ==================== BARRIER DRAWING FUNCTIONS ====================
  
  // Start drawing a new barrier
  const startDrawingBarrier = () => {
    setIsDrawingBarrier(true);
    setCurrentBarrier({
      id: `barrier_${Date.now()}`,
      nombre: barrierFormData.nombre || 'Nueva Barrera',
      tipo: barrierFormData.tipo,
      puntos: [],
    });
    toast.info('Haz clic en el mapa para añadir puntos a la barrera. Doble clic para terminar.');
  };
  
  // Add point to current barrier
  const addBarrierPoint = (e) => {
    if (!isDrawingBarrier || !currentBarrier) return;
    
    const svgPoint = getSVGPoint(e);
    if (!svgPoint) return;
    
    const coords = posToCoord(svgPoint.x, svgPoint.y);
    
    setCurrentBarrier(prev => ({
      ...prev,
      puntos: [...prev.puntos, { x: coords.x, y: coords.y }],
    }));
  };
  
  // Finish drawing current barrier
  const finishDrawingBarrier = async () => {
    if (!currentBarrier || currentBarrier.puntos.length < 2) {
      toast.error('La barrera debe tener al menos 2 puntos');
      return;
    }
    
    try {
      const res = await api.post('/data/barriers', currentBarrier);
      setBarriers(prev => [...prev, res.data]);
      toast.success(`Barrera "${currentBarrier.nombre}" guardada`);
    } catch (err) {
      console.error('Error saving barrier:', err);
      toast.error('Error al guardar la barrera');
    }
    
    setIsDrawingBarrier(false);
    setCurrentBarrier(null);
  };
  
  // Cancel drawing barrier
  const cancelDrawingBarrier = () => {
    setIsDrawingBarrier(false);
    setCurrentBarrier(null);
    toast.info('Dibujo de barrera cancelado');
  };
  
  // Delete a barrier
  const deleteBarrier = async (barrierId) => {
    if (!window.confirm('¿Eliminar esta barrera?')) return;
    
    try {
      await api.delete(`/data/barriers/${barrierId}`);
      setBarriers(prev => prev.filter(b => b.id !== barrierId));
      setSelectedBarrier(null);
      toast.success('Barrera eliminada');
    } catch (err) {
      console.error('Error deleting barrier:', err);
      toast.error('Error al eliminar la barrera');
    }
  };
  
  // Update barrier properties
  const updateBarrier = async (barrierId, updates) => {
    try {
      const res = await api.put(`/data/barriers/${barrierId}`, updates);
      setBarriers(prev => prev.map(b => b.id === barrierId ? { ...b, ...updates } : b));
      toast.success('Barrera actualizada');
      setEditingBarrierId(null);
      return res.data;
    } catch (err) {
      console.error('Error updating barrier:', err);
      toast.error('Error al actualizar la barrera');
    }
  };
  
  // Convert barrier points to SVG path
  const barrierToPath = (barrier) => {
    if (!barrier.puntos || barrier.puntos.length < 2) return '';
    
    const points = barrier.puntos.map(p => coordToPos(p.x, p.y));
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return d;
  };
  
  // Handle map click for barrier drawing
  const handleMapClickForBarrier = (e) => {
    if (!isDrawingBarrier) return;
    
    if (e.detail === 2) {
      finishDrawingBarrier();
      return;
    }
    
    addBarrierPoint(e);
  };
  
  // Render barriers management panel
  const renderBarriersPanel = () => {
    if (!showBarriersPanel) return null;
    
    return (
      <Card className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[hsl(var(--torch-orange))] flex items-center gap-2">
              ⛰️ Barreras Infranqueables
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBarriersPanel(false)}
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{barriers.length} barreras guardadas</p>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
          {barriers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay barreras dibujadas.<br/>
              Usa "Dibujar Barrera" para crear una.
            </p>
          ) : (
            barriers.map(barrier => {
              const barrierStyle = BARRIER_TYPES[barrier.tipo] || BARRIER_TYPES.montana;
              const isEditing = editingBarrierId === barrier.id;
              
              return (
                <div 
                  key={barrier.id}
                  className={`p-3 rounded-lg border transition-all ${
                    selectedBarrier?.id === barrier.id 
                      ? 'border-orange-500 bg-orange-900/20' 
                      : 'border-border/30 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={barrier.nombre}
                        onChange={(e) => setBarriers(prev => prev.map(b => 
                          b.id === barrier.id ? { ...b, nombre: e.target.value } : b
                        ))}
                        className="h-8 text-sm"
                        placeholder="Nombre de la barrera"
                      />
                      <select
                        value={barrier.tipo}
                        onChange={(e) => setBarriers(prev => prev.map(b => 
                          b.id === barrier.id ? { ...b, tipo: e.target.value } : b
                        ))}
                        className="w-full h-8 text-sm bg-black/30 border border-border/30 rounded px-2"
                      >
                        {Object.entries(BARRIER_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-7 bg-orange-600 hover:bg-orange-700"
                          onClick={() => updateBarrier(barrier.id, { nombre: barrier.nombre, tipo: barrier.tipo })}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setEditingBarrierId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-4 h-1 rounded"
                          style={{ 
                            backgroundColor: barrierStyle.color,
                            borderStyle: 'dashed'
                          }}
                        />
                        <span className="font-medium text-sm flex-1">{barrier.nombre}</span>
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: barrierStyle.color + '40', color: barrierStyle.color }}
                        >
                          {barrierStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {barrierStyle.description}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {barrier.puntos?.length || 0} puntos
                      </p>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs flex-1"
                          onClick={() => {
                            setSelectedBarrier(barrier);
                            if (barrier.puntos?.length > 0) {
                              const mid = barrier.puntos[Math.floor(barrier.puntos.length / 2)];
                              const pos = coordToPos(mid.x, mid.y);
                              setPan({ x: -pos.x * zoom + window.innerWidth / 2, y: -pos.y * zoom + window.innerHeight / 2 });
                            }
                          }}
                        >
                          👁️ Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => setEditingBarrierId(barrier.id)}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs text-red-400 hover:text-red-300"
                          onClick={() => deleteBarrier(barrier.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
        
        <div className="p-3 border-t border-border/30 flex-shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>⛰️ Montañas: {barriers.filter(b => b.tipo === 'montana').length}</span>
            <span>🪨 Acantilados: {barriers.filter(b => b.tipo === 'acantilado').length}</span>
            <span>🚫 Fronteras: {barriers.filter(b => b.tipo === 'frontera').length}</span>
          </div>
        </div>
      </Card>
    );
  };
  
  // ==================== END BARRIER DRAWING FUNCTIONS ====================
  
  // Handle mouse events for panning
  const handleMouseDown = (e) => {
    // Handle road drawing
    if (isDrawingRoad && e.button === 0) {
      handleMapClickForRoad(e);
      return;
    }
    
    // Handle river drawing
    if (isDrawingRiver && e.button === 0) {
      handleMapClickForRiver(e);
      return;
    }
    
    // Handle barrier drawing
    if (isDrawingBarrier && e.button === 0) {
      handleMapClickForBarrier(e);
      return;
    }
    
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
    // Render calculated pathfinding route if available
    if (calculatedPath && calculatedPath.success && calculatedPath.path?.length > 1 && showCalculatedPath) {
      const pathPoints = calculatedPath.path.map(p => coordToPos(p[0], p[1]));
      const pathD = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      
      return (
        <g>
          {/* Path glow effect */}
          <path
            d={pathD}
            fill="none"
            stroke="#00ffff"
            strokeWidth={6 / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3}
            filter="blur(4px)"
          />
          
          {/* Main path line */}
          <path
            d={pathD}
            fill="none"
            stroke="#00ffff"
            strokeWidth={3 / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
          
          {/* Start marker */}
          <circle
            cx={pathPoints[0].x}
            cy={pathPoints[0].y}
            r={8 / zoom}
            fill="#22c55e"
            stroke="#fff"
            strokeWidth={2 / zoom}
          />
          
          {/* End marker */}
          <circle
            cx={pathPoints[pathPoints.length - 1].x}
            cy={pathPoints[pathPoints.length - 1].y}
            r={8 / zoom}
            fill="#ef4444"
            stroke="#fff"
            strokeWidth={2 / zoom}
          />
          
          {/* Direction arrow at midpoint */}
          {pathPoints.length > 2 && (() => {
            const midIdx = Math.floor(pathPoints.length / 2);
            const prev = pathPoints[midIdx - 1];
            const curr = pathPoints[midIdx];
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x) * 180 / Math.PI;
            return (
              <polygon
                points="-8,-5 0,0 -8,5"
                fill="#00ffff"
                transform={`translate(${curr.x}, ${curr.y}) rotate(${angle}) scale(${1/zoom})`}
              />
            );
          })()}
        </g>
      );
    }
    
    // Fallback to simple line if no pathfinding result
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
          strokeWidth={3 / zoom}
          strokeDasharray={`${10/zoom},${5/zoom}`}
          opacity={0.8}
        />
        
        {/* Arrow at destination */}
        <polygon
          points="-8,-5 0,0 -8,5"
          fill="#c9a227"
          transform={`translate(${destPos.x}, ${destPos.y}) rotate(${Math.atan2(destPos.y - originPos.y, destPos.x - originPos.x) * 180 / Math.PI}) scale(${1/zoom})`}
        />
      </g>
    );
  };
  
  // Calculate path between two locations using pathfinding
  const calculatePathBetweenLocations = async (originId, destinationId) => {
    if (!originId || !destinationId || originId === destinationId) {
      setCalculatedPath(null);
      return;
    }
    
    setIsCalculatingPath(true);
    try {
      const res = await api.get(`/data/pathfinding/between/${originId}/${destinationId}`);
      setCalculatedPath(res.data);
      toast.success(`Ruta calculada: ${res.data.total_distance_km} km, ${res.data.estimated_days} días`);
    } catch (err) {
      console.error('Error calculating path:', err);
      toast.error('Error calculando ruta');
      setCalculatedPath(null);
    } finally {
      setIsCalculatingPath(false);
    }
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
          
          {/* Region - Hierarchical Dropdown */}
          <div>
            <label className="text-xs text-muted-foreground">Región</label>
            <Select value={editFormData.region} onValueChange={(v) => setEditFormData({ ...editFormData, region: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona región" />
              </SelectTrigger>
              <SelectContent>
                {regionsHierarchy.length > 0 ? (
                  regionsHierarchy.map((region) => (
                    <React.Fragment key={region.id}>
                      <SelectItem value={region.nombre} className="font-bold text-[hsl(var(--gold))]">
                        📍 {region.nombre}
                      </SelectItem>
                      {region.subregions?.map(sub => (
                        <SelectItem key={sub.id} value={sub.nombre} className="pl-6 text-muted-foreground">
                          ↳ {sub.nombre}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  // Fallback to static REGION_HIERARCHY if no dynamic data
                  Object.entries(REGION_HIERARCHY).map(([key, data]) => (
                    <React.Fragment key={key}>
                      <SelectItem value={key} className="font-bold text-[hsl(var(--gold))]">
                        📍 {data.label}
                      </SelectItem>
                      {data.subregions.map(sub => (
                        <SelectItem key={sub} value={sub} className="pl-6 text-muted-foreground">
                          ↳ {sub}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </SelectContent>
            </Select>
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
          
          {/* Region - Hierarchical Dropdown */}
          <div>
            <label className="text-xs text-muted-foreground">Región *</label>
            <Select value={newLocationData.region} onValueChange={(v) => setNewLocationData({ ...newLocationData, region: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una región" />
              </SelectTrigger>
              <SelectContent>
                {regionsHierarchy.length > 0 ? (
                  regionsHierarchy.map((region) => (
                    <React.Fragment key={region.id}>
                      <SelectItem value={region.nombre} className="font-bold text-[hsl(var(--gold))]">
                        📍 {region.nombre}
                      </SelectItem>
                      {region.subregions?.map(sub => (
                        <SelectItem key={sub.id} value={sub.nombre} className="pl-6 text-muted-foreground">
                          ↳ {sub.nombre}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  // Fallback to static REGION_HIERARCHY if no dynamic data
                  Object.entries(REGION_HIERARCHY).map(([key, data]) => (
                    <React.Fragment key={key}>
                      <SelectItem value={key} className="font-bold text-[hsl(var(--gold))]">
                        📍 {data.label}
                      </SelectItem>
                      {data.subregions.map(sub => (
                        <SelectItem key={sub} value={sub} className="pl-6 text-muted-foreground">
                          ↳ {sub}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Type - with option to create new */}
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            {!isCreatingNewType ? (
              <div className="flex gap-2">
                <Select 
                  value={newLocationData.tipo} 
                  onValueChange={(v) => {
                    if (v === '__new__') {
                      setIsCreatingNewType(true);
                    } else {
                      setNewLocationData({ ...newLocationData, tipo: v });
                    }
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_NAMES).map(([key, name]) => (
                      <SelectItem key={key} value={key}>{LOCATION_ICONS[key]} {name}</SelectItem>
                    ))}
                    {/* Custom types created by user */}
                    {customTypes.map(ct => (
                      <SelectItem key={ct} value={ct}>🏷️ {ct}</SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-green-400">
                      ➕ Crear nuevo tipo...
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={newCustomType}
                  onChange={(e) => setNewCustomType(e.target.value)}
                  placeholder="Ej: posada, taberna, granja..."
                  className="flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newCustomType.trim()) {
                      const typeKey = newCustomType.toLowerCase().replace(/\s+/g, '_');
                      setCustomTypes(prev => [...prev, typeKey]);
                      setNewLocationData({ ...newLocationData, tipo: typeKey });
                      setNewCustomType('');
                      setIsCreatingNewType(false);
                      toast.success(`Tipo "${newCustomType}" creado`);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreatingNewType(false);
                    setNewCustomType('');
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-[hsl(var(--gold))]"
              data-testid="back-to-home-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Inicio
            </Button>
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
          
          {/* Road controls */}
          {editMode && (
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Button
                variant={showRoads ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRoads(!showRoads)}
                title="Mostrar/ocultar caminos"
              >
                🛤️
              </Button>
              
              <Button
                variant={showRoadsPanel ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRoadsPanel(!showRoadsPanel)}
                title="Gestionar caminos"
                className="relative"
              >
                📋
                {roads.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[hsl(var(--gold))] text-black text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {roads.length}
                  </span>
                )}
              </Button>
              
              {!isDrawingRoad ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startDrawingRoad}
                  className="bg-amber-600/20 hover:bg-amber-600/40"
                >
                  ✏️ Dibujar Camino
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400 animate-pulse">
                    Dibujando... ({currentRoad?.puntos?.length || 0} puntos)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={finishDrawingRoad}
                    disabled={!currentRoad || currentRoad.puntos.length < 2}
                    className="bg-green-600/20 hover:bg-green-600/40"
                  >
                    ✓ Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelDrawingRoad}
                    className="bg-red-600/20 hover:bg-red-600/40"
                  >
                    ✗ Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Road type selector when drawing */}
          {editMode && !isDrawingRoad && !isDrawingRiver && !isDrawingBarrier && (
            <div className="flex items-center gap-2">
              <select
                value={roadFormData.tipo}
                onChange={(e) => setRoadFormData(prev => ({ ...prev, tipo: e.target.value }))}
                className="h-8 text-xs bg-black/30 border border-border/30 rounded px-2"
              >
                {Object.entries(ROAD_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <Input
                value={roadFormData.nombre}
                onChange={(e) => setRoadFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del camino..."
                className="w-40 h-8 text-xs"
              />
            </div>
          )}
          
          {/* River controls */}
          {editMode && (
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Button
                variant={showRivers ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRivers(!showRivers)}
                title="Mostrar/ocultar ríos"
              >
                🌊
              </Button>
              
              <Button
                variant={showRiversPanel ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowRiversPanel(!showRiversPanel);
                  setShowRoadsPanel(false);
                  setShowBarriersPanel(false);
                }}
                title="Gestionar ríos"
                className="relative"
              >
                💧
                {rivers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {rivers.length}
                  </span>
                )}
              </Button>
              
              {!isDrawingRiver && !isDrawingRoad && !isDrawingBarrier ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startDrawingRiver}
                  className="bg-blue-600/20 hover:bg-blue-600/40"
                >
                  🌊 Dibujar Río
                </Button>
              ) : isDrawingRiver && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-400 animate-pulse">
                    Dibujando río... ({currentRiver?.puntos?.length || 0} puntos)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={finishDrawingRiver}
                    disabled={!currentRiver || currentRiver.puntos.length < 2}
                    className="bg-green-600/20 hover:bg-green-600/40"
                  >
                    ✓ Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelDrawingRiver}
                    className="bg-red-600/20 hover:bg-red-600/40"
                  >
                    ✗ Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* River type selector when not drawing */}
          {editMode && !isDrawingRiver && !isDrawingRoad && !isDrawingBarrier && (
            <div className="flex items-center gap-2">
              <select
                value={riverFormData.tipo}
                onChange={(e) => setRiverFormData(prev => ({ ...prev, tipo: e.target.value }))}
                className="h-8 text-xs bg-blue-900/30 border border-blue-500/30 rounded px-2"
              >
                {Object.entries(RIVER_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <Input
                value={riverFormData.nombre}
                onChange={(e) => setRiverFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del río..."
                className="w-32 h-8 text-xs"
              />
            </div>
          )}
          
          {/* Barrier controls */}
          {editMode && (
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Button
                variant={showBarriers ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBarriers(!showBarriers)}
                title="Mostrar/ocultar barreras"
              >
                ⛰️
              </Button>
              
              <Button
                variant={showBarriersPanel ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowBarriersPanel(!showBarriersPanel);
                  setShowRoadsPanel(false);
                  setShowRiversPanel(false);
                }}
                title="Gestionar barreras"
                className="relative"
              >
                🚫
                {barriers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {barriers.length}
                  </span>
                )}
              </Button>
              
              {!isDrawingBarrier && !isDrawingRoad && !isDrawingRiver ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startDrawingBarrier}
                  className="bg-orange-600/20 hover:bg-orange-600/40"
                >
                  ⛰️ Dibujar Barrera
                </Button>
              ) : isDrawingBarrier && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-400 animate-pulse">
                    Dibujando barrera... ({currentBarrier?.puntos?.length || 0} puntos)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={finishDrawingBarrier}
                    disabled={!currentBarrier || currentBarrier.puntos.length < 2}
                    className="bg-green-600/20 hover:bg-green-600/40"
                  >
                    ✓ Guardar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelDrawingBarrier}
                    className="bg-red-600/20 hover:bg-red-600/40"
                  >
                    ✗ Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* Barrier type selector when not drawing */}
          {editMode && !isDrawingBarrier && !isDrawingRoad && !isDrawingRiver && (
            <div className="flex items-center gap-2">
              <select
                value={barrierFormData.tipo}
                onChange={(e) => setBarrierFormData(prev => ({ ...prev, tipo: e.target.value }))}
                className="h-8 text-xs bg-orange-900/30 border border-orange-500/30 rounded px-2"
              >
                {Object.entries(BARRIER_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <Input
                value={barrierFormData.nombre}
                onChange={(e) => setBarrierFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre barrera..."
                className="w-32 h-8 text-xs"
              />
            </div>
          )}
          
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
          cursor: isCreatingLocation || isDrawingRoad || isDrawingRiver || isDrawingBarrier
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
          
          {/* Saved Roads */}
          {showRoads && roads.map(road => {
            const roadStyle = ROAD_TYPES[road.tipo] || ROAD_TYPES.secundario;
            const isSelected = selectedRoad?.id === road.id;
            return (
              <g key={road.id}>
                <path
                  d={roadToPath(road)}
                  fill="none"
                  stroke={isSelected ? '#00ff00' : roadStyle.color}
                  strokeWidth={(roadStyle.width + (isSelected ? 2 : 0)) / zoom}
                  strokeDasharray={roadStyle.dash.map(d => d / zoom).join(' ')}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.8}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRoad(road);
                  }}
                />
                {/* Road label at midpoint */}
                {showLabels && road.puntos?.length > 1 && (
                  <text
                    x={coordToPos(road.puntos[Math.floor(road.puntos.length / 2)].x, road.puntos[Math.floor(road.puntos.length / 2)].y).x}
                    y={coordToPos(road.puntos[Math.floor(road.puntos.length / 2)].x, road.puntos[Math.floor(road.puntos.length / 2)].y).y - 10 / zoom}
                    fill={roadStyle.color}
                    fontSize={10 / zoom}
                    textAnchor="middle"
                    fontWeight="bold"
                    stroke="#000"
                    strokeWidth={2 / zoom}
                    paintOrder="stroke"
                    opacity={0.9}
                  >
                    {road.nombre}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Current road being drawn */}
          {isDrawingRoad && currentRoad && currentRoad.puntos.length > 0 && (
            <g>
              <path
                d={roadToPath(currentRoad)}
                fill="none"
                stroke="#00ff00"
                strokeWidth={3 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${5 / zoom} ${5 / zoom}`}
                opacity={0.9}
              />
              {/* Points markers */}
              {currentRoad.puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={coordToPos(p.x, p.y).x}
                  cy={coordToPos(p.x, p.y).y}
                  r={6 / zoom}
                  fill={i === 0 ? '#22c55e' : '#00ff00'}
                  stroke="#fff"
                  strokeWidth={2 / zoom}
                />
              ))}
            </g>
          )}
          
          {/* Saved Rivers */}
          {showRivers && rivers.map(river => {
            const riverStyle = RIVER_TYPES[river.tipo] || RIVER_TYPES.profundo;
            const isSelected = selectedRiver?.id === river.id;
            return (
              <g key={river.id}>
                <path
                  d={riverToPath(river)}
                  fill="none"
                  stroke={isSelected ? '#00ffff' : riverStyle.color}
                  strokeWidth={(riverStyle.width + (isSelected ? 2 : 0)) / zoom}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRiver(river);
                  }}
                />
                {/* River label at midpoint */}
                {showLabels && river.puntos?.length > 1 && (
                  <text
                    x={coordToPos(river.puntos[Math.floor(river.puntos.length / 2)].x, river.puntos[Math.floor(river.puntos.length / 2)].y).x}
                    y={coordToPos(river.puntos[Math.floor(river.puntos.length / 2)].x, river.puntos[Math.floor(river.puntos.length / 2)].y).y - 10 / zoom}
                    fill={riverStyle.color}
                    fontSize={10 / zoom}
                    textAnchor="middle"
                    fontWeight="bold"
                    stroke="#000"
                    strokeWidth={2 / zoom}
                    paintOrder="stroke"
                    opacity={0.9}
                  >
                    🌊 {river.nombre}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Current river being drawn */}
          {isDrawingRiver && currentRiver && currentRiver.puntos.length > 0 && (
            <g>
              <path
                d={riverToPath(currentRiver)}
                fill="none"
                stroke="#00bfff"
                strokeWidth={4 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                opacity={0.9}
              />
              {/* Points markers */}
              {currentRiver.puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={coordToPos(p.x, p.y).x}
                  cy={coordToPos(p.x, p.y).y}
                  r={6 / zoom}
                  fill={i === 0 ? '#00bfff' : '#4A90D9'}
                  stroke="#fff"
                  strokeWidth={2 / zoom}
                />
              ))}
            </g>
          )}
          
          {/* Saved Barriers (Impassable Lines) */}
          {showBarriers && barriers.map(barrier => {
            const barrierStyle = BARRIER_TYPES[barrier.tipo] || BARRIER_TYPES.montana;
            const isSelected = selectedBarrier?.id === barrier.id;
            return (
              <g key={barrier.id}>
                <path
                  d={barrierToPath(barrier)}
                  fill="none"
                  stroke={isSelected ? '#ff6600' : barrierStyle.color}
                  strokeWidth={(barrierStyle.width + (isSelected ? 2 : 0)) / zoom}
                  strokeDasharray={barrierStyle.dash.map(d => d / zoom).join(' ')}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBarrier(barrier);
                  }}
                />
                {/* Barrier label at midpoint */}
                {showLabels && barrier.puntos?.length > 1 && (
                  <text
                    x={coordToPos(barrier.puntos[Math.floor(barrier.puntos.length / 2)].x, barrier.puntos[Math.floor(barrier.puntos.length / 2)].y).x}
                    y={coordToPos(barrier.puntos[Math.floor(barrier.puntos.length / 2)].x, barrier.puntos[Math.floor(barrier.puntos.length / 2)].y).y - 10 / zoom}
                    fill={barrierStyle.color}
                    fontSize={10 / zoom}
                    textAnchor="middle"
                    fontWeight="bold"
                    stroke="#000"
                    strokeWidth={2 / zoom}
                    paintOrder="stroke"
                    opacity={0.9}
                  >
                    ⛰️ {barrier.nombre}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Current barrier being drawn */}
          {isDrawingBarrier && currentBarrier && currentBarrier.puntos.length > 0 && (
            <g>
              <path
                d={barrierToPath(currentBarrier)}
                fill="none"
                stroke="#ff6600"
                strokeWidth={4 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${10 / zoom} ${5 / zoom}`}
                opacity={0.9}
              />
              {/* Points markers */}
              {currentBarrier.puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={coordToPos(p.x, p.y).x}
                  cy={coordToPos(p.x, p.y).y}
                  r={6 / zoom}
                  fill={i === 0 ? '#ff6600' : '#8B4513'}
                  stroke="#fff"
                  strokeWidth={2 / zoom}
                />
              ))}
            </g>
          )}
          
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
        {renderRoadsPanel()}
        {renderRiversPanel()}
        {renderBarriersPanel()}
        
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
