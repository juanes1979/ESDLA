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

// Import shared constants from map components
import {
  TERRAIN_COLORS,
  LAND_COLORS,
  LOCATION_ICONS,
  TYPE_NAMES,
  ROAD_TYPES,
  RIVER_TYPES,
  BARRIER_TYPES,
  REGIONS,
} from '../components/map/mapConstants';
import { MAESTRO_MAP_URL } from '../config/mapAssets';

// Import map panel components
import { 
  RoadsPanel, 
  RiversPanel, 
  BarriersPanel, 
  LocationInfoPanel, 
  RoutePanel,
  EditLocationPanel,
  CreateLocationPanel,
  NameGeneratorPanel
} from '../components/map';

// Type categories for filtering (not in mapConstants - specific to this view)
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
  const [zoom, setZoom] = useState(1); // Initial zoom at 100%
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
  const [showNameGenerator, setShowNameGenerator] = useState(false); // Name generator panel
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
    tipo: 'menor',  // grande, mayor, menor, senda
    descripcion: '',
  });
  
  // Road types configuration
  const ROAD_TYPES = {
    grande: { label: 'Grandes Caminos', color: '#FFD700', width: 6, dash: [] },
    mayor: { label: 'Caminos Mayores', color: '#C9A227', width: 4.5, dash: [] },
    menor: { label: 'Caminos Menores', color: '#A08050', width: 3, dash: [] },
    senda: { label: 'Sendas', color: '#8B7355', width: 2, dash: [4, 2] },
    // Legacy types for backwards compatibility
    real: { label: 'Grandes Caminos', color: '#FFD700', width: 6, dash: [] },
    principal: { label: 'Caminos Mayores', color: '#C9A227', width: 4.5, dash: [] },
    secundario: { label: 'Caminos Menores', color: '#A08050', width: 3, dash: [] },
    sendero: { label: 'Sendas', color: '#8B7355', width: 2, dash: [4, 2] },
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
      url: MAESTRO_MAP_URL,
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
  
  // Map dimensions - absolute pixel coordinates (same as EnhancedTravelSystem)
  const MAP_PIXEL_WIDTH = 19791;
  const MAP_PIXEL_HEIGHT = 15133;
  
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
        const loadedLocations = locRes.data.locations || [];
        setLocations(loadedLocations);
        setRegionsHierarchy(regRes.data.regions || []);
        
        // Extract custom types from existing locations
        // A type is custom if it's not in the predefined TYPE_NAMES
        const predefinedTypes = Object.keys(TYPE_NAMES);
        const customTypesFromLocations = new Set();
        loadedLocations.forEach(loc => {
          if (loc.tipo && !predefinedTypes.includes(loc.tipo)) {
            customTypesFromLocations.add(loc.tipo);
          }
        });
        if (customTypesFromLocations.size > 0) {
          setCustomTypes(prev => [...new Set([...prev, ...customTypesFromLocations])]);
        }
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
          
          // Also calculate optimal pathfinding route
          calculatePathBetweenLocations(routeOrigin.id, routeDestination.id);
        } catch (err) {
          console.error('Error calculating route:', err);
          setRouteInfo(null);
        }
      } else {
        setRouteInfo(null);
        setCalculatedPath(null);
      }
    };
    calculateRoute();
  }, [routeOrigin, routeDestination]);
  
  // Get unique regions
  const regions = useMemo(() => {
    const regs = new Set(locations.map(l => l.region));
    return Array.from(regs).sort();
  }, [locations]);

  // Hierarchical region list (DFS) for filter dropdowns. Uses
  // regionsHierarchy (1-level structure from /data/regions) and appends
  // any orphans (region names present on locations but not in the tree).
  const regionOptionsHier = useMemo(() => {
    const out = [];
    const seen = new Set();
    (regionsHierarchy || []).forEach(top => {
      out.push({ name: top.nombre, depth: 0 });
      seen.add(top.nombre);
      (top.subregions || []).forEach(sub => {
        out.push({ name: sub.nombre, depth: 1 });
        seen.add(sub.nombre);
      });
    });
    regions.forEach(r => {
      if (!seen.has(r)) out.push({ name: r, depth: 0, orphan: true });
    });
    return out;
  }, [regionsHierarchy, regions]);
  
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
  
  // Convert coordinates (percentage 0-100) to absolute pixel position
  const coordToPos = (x, y) => ({
    x: (x / 100) * MAP_PIXEL_WIDTH,
    y: MAP_PIXEL_HEIGHT - (y / 100) * MAP_PIXEL_HEIGHT, // Flip Y axis
  });
  
  // Convert absolute pixel position back to percentage coordinates
  const posToCoord = (mapX, mapY) => ({
    x: Math.round((mapX / MAP_PIXEL_WIDTH) * 100 * 10) / 10,
    y: Math.round(((MAP_PIXEL_HEIGHT - mapY) / MAP_PIXEL_HEIGHT) * 100 * 10) / 10,
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
    toast.info('Haz clic para añadir puntos. Solo ancla si haces clic encima de una ubicación. Doble clic para terminar.');
  };
  
  // Add point to current road - ONLY snap if clicking EXACTLY on a location marker
  const addRoadPoint = (e) => {
    if (!isDrawingRoad || !currentRoad) return;
    
    const svgPoint = getSVGPoint(e);
    if (!svgPoint) return;
    
    const coords = posToCoord(svgPoint.x, svgPoint.y);
    
    // ONLY snap if clicking EXACTLY on a location (0.08% = basically on the marker itself)
    const SNAP_DISTANCE = 0.08;
    let finalCoords = { x: coords.x, y: coords.y };
    let snappedTo = null;
    
    for (const loc of locations) {
      const dist = Math.sqrt(Math.pow(loc.x - coords.x, 2) + Math.pow(loc.y - coords.y, 2));
      if (dist < SNAP_DISTANCE) {
        finalCoords = { x: loc.x, y: loc.y };
        snappedTo = loc.nombre;
        break;
      }
    }
    
    setCurrentRoad(prev => ({
      ...prev,
      puntos: [...prev.puntos, finalCoords],
    }));
    
    if (snappedTo) {
      toast.success(`📍 Anclado a: ${snappedTo}`, { duration: 1500 });
    }
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
  
  // Add point to current river - ONLY snap if clicking EXACTLY on a location marker
  const addRiverPoint = (e) => {
    if (!isDrawingRiver || !currentRiver) return;
    
    const svgPoint = getSVGPoint(e);
    if (!svgPoint) return;
    
    const coords = posToCoord(svgPoint.x, svgPoint.y);
    
    // ONLY snap if clicking EXACTLY on a location (0.08% = basically on the marker itself)
    const SNAP_DISTANCE = 0.08;
    let finalCoords = { x: coords.x, y: coords.y };
    let snappedTo = null;
    
    for (const loc of locations) {
      const dist = Math.sqrt(Math.pow(loc.x - coords.x, 2) + Math.pow(loc.y - coords.y, 2));
      if (dist < SNAP_DISTANCE) {
        finalCoords = { x: loc.x, y: loc.y };
        snappedTo = loc.nombre;
        break;
      }
    }
    
    setCurrentRiver(prev => ({
      ...prev,
      puntos: [...prev.puntos, finalCoords],
    }));
    
    if (snappedTo) {
      toast.success(`📍 Anclado a: ${snappedTo}`, { duration: 1500 });
    }
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
  
  // Add point to current barrier - with snap to nearby locations
  const addBarrierPoint = (e) => {
    if (!isDrawingBarrier || !currentBarrier) return;
    
    const svgPoint = getSVGPoint(e);
    if (!svgPoint) return;
    
    const coords = posToCoord(svgPoint.x, svgPoint.y);
    
    // ONLY snap if clicking EXACTLY on a location (0.08% = basically on the marker itself)
    const SNAP_DISTANCE = 0.08;
    let finalCoords = { x: coords.x, y: coords.y };
    let snappedTo = null;
    
    for (const loc of locations) {
      const dist = Math.sqrt(Math.pow(loc.x - coords.x, 2) + Math.pow(loc.y - coords.y, 2));
      if (dist < SNAP_DISTANCE) {
        finalCoords = { x: loc.x, y: loc.y };
        snappedTo = loc.nombre;
        break;
      }
    }
    
    setCurrentBarrier(prev => ({
      ...prev,
      puntos: [...prev.puntos, finalCoords],
    }));
    
    if (snappedTo) {
      toast.success(`📍 Anclado a: ${snappedTo}`, { duration: 1500 });
    }
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
  
  // Handle mouse wheel for zoom (smooth + centered on mouse pointer)
  const handleWheel = (e) => {
    // Sólo aplicar zoom si el ratón está sobre el SVG del mapa (no sobre
    // paneles/diálogos/legendas/sidebars superpuestos al contenedor).
    if (!mapRef.current || !mapRef.current.contains(e.target)) {
      return; // deja que el scroll natural funcione en el otro elemento
    }
    e.preventDefault();

    // Smooth proportional zoom: small deltaY → small zoom step.
    // Most browsers send |deltaY| ≈ 100 per notch on a wheel; trackpads send
    // much smaller values (~1-5) per event.
    const sensitivity = 0.0015;
    // Clamp factor to [0.5, 2] per single event so a fast trackpad burst does
    // not blow up the zoom in one tick.
    const rawFactor = Math.exp(-e.deltaY * sensitivity);
    const zoomFactor = Math.min(2, Math.max(0.5, rawFactor));
    const newZoom = Math.min(20, Math.max(0.05, zoom * zoomFactor));

    // Get mouse position relative to container
    const container = containerRef.current;
    if (!container) {
      setZoom(newZoom);
      return;
    }

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the point on the map under the mouse (using top-left origin
    // — must match `transformOrigin: '0 0'` in the SVG style below).
    const mapX = (mouseX - pan.x) / zoom;
    const mapY = (mouseY - pan.y) / zoom;

    // Calculate new pan to keep the same map point under the mouse.
    const newPanX = mouseX - mapX * newZoom;
    const newPanY = mouseY - mapY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
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
      
      const res = await api.post('/data/locations', locationToCreate);
      
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
    // Base marker size in screen pixels (will stay constant on screen)
    const baseSize = editMode ? 80 : 120;
    const markerSize = baseSize * inverseZoom;
    const hitAreaSize = 300 * inverseZoom;
    
    // Check if we're in drawing mode - if so, clicking on location should add a point, not drag
    const isDrawingMode = isDrawingRoad || isDrawingRiver || isDrawingBarrier;
    
    return (
      <g
        key={loc.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onMouseDown={(e) => {
          if (isDrawingMode) {
            // Don't drag - let the click pass through to add a road/river/barrier point
            e.stopPropagation();
            if (isDrawingRoad) addRoadPoint(e);
            else if (isDrawingRiver) addRiverPoint(e);
            else if (isDrawingBarrier) addBarrierPoint(e);
          } else if (editMode) {
            handleLocationDragStart(loc, e);
          } else {
            handleLocationClick(loc, e);
          }
        }}
        onClick={(e) => !editMode && !isDrawingMode && handleLocationClick(loc, e)}
        style={{ 
          cursor: isDrawingMode ? 'crosshair' : (editMode ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer'),
          userSelect: 'none',
          pointerEvents: isDrawingMode ? 'auto' : 'auto',
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
            strokeWidth={20 * inverseZoom}
            strokeDasharray={isDraggingThis ? 'none' : `${60 * inverseZoom} ${40 * inverseZoom}`}
            opacity={0.6}
          />
        )}
        
        {/* Glow for selected/route points */}
        {(isSelected || isOrigin || isDestination) && !editMode && (
          <circle
            r={markerSize * 2}
            fill="none"
            stroke={isOrigin ? '#22c55e' : isDestination ? '#ef4444' : '#c9a227'}
            strokeWidth={40 * inverseZoom}
            opacity={0.8}
            className="animate-pulse"
          />
        )}
        
        {/* Main marker - simple dot */}
        <circle
          r={markerSize}
          fill={color}
          stroke={editMode && isModified ? '#f59e0b' : loc.refugio ? '#22c55e' : '#333'}
          strokeWidth={(editMode && isModified ? 40 : 20) * inverseZoom}
          opacity={0.9}
        />
        
        {/* Icon (only when NOT in edit mode and zoom is reasonable) */}
        {!editMode && showMasterView && zoom > 0.04 && zoom < 0.2 && (
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={200 * inverseZoom}
            style={{ pointerEvents: 'none' }}
          >
            {icon}
          </text>
        )}
        
        {/* Label - only visible when zoomed in enough, fixed size on screen */}
        {showLabels && !editMode && zoom > 0.06 && (
          <text
            y={260 * inverseZoom}
            textAnchor="middle"
            fill="#fff"
            fontSize={195 * inverseZoom}
            fontWeight="bold"
            stroke="#000"
            strokeWidth={55 * inverseZoom}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {loc.nombre}
          </text>
        )}
        
        {/* Label in edit mode - visible when zoomed in, fixed size */}
        {editMode && showLabels && zoom > 0.06 && (
          <text
            y={210 * inverseZoom}
            textAnchor="middle"
            fill="#fff"
            fontSize={175 * inverseZoom}
            fontWeight="bold"
            stroke="#000"
            strokeWidth={45 * inverseZoom}
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
  
  // Loading state
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
              onClick={() => navigate('/map')}
              className="text-muted-foreground hover:text-[hsl(var(--gold))]"
              data-testid="back-to-map-selection-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Mapas
            </Button>
            <h1 className="font-heading text-2xl text-[hsl(var(--gold))]">
              <Map className="w-6 h-6 inline mr-2" />
              Mapa del Maestro
            </h1>
            <Badge variant="outline">{filteredLocations.length} ubicaciones</Badge>

            {/* Acceso rápido al editor de terrenos */}
            {showMasterView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/terrain-editor')}
                className="border-amber-600/60 text-amber-400 hover:bg-amber-600/10"
                data-testid="goto-terrain-editor-from-map-btn"
                title="Editor de Terrenos (pintar tipos de tierra y dificultad)"
              >
                🎨 Editor de Terrenos
              </Button>
            )}
            
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
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => setShowNameGenerator(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                  title="Generar nombres para poblaciones"
                >
                  ✨ Generador de Nombres
                </Button>
                <Button
                  size="sm"
                  onClick={startCreatingLocation}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ➕ Crear Ubicación
                </Button>
              </div>
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
                {regionOptionsHier.map(r => (
                  <SelectItem key={`${r.name}-${r.depth}`} value={r.name}>
                    {`${'\u00A0\u00A0'.repeat(r.depth)}${r.depth > 0 ? '└─ ' : ''}${r.name}${r.orphan ? ' (huérfana)' : ''}`}
                  </SelectItem>
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
                <option value="grande">Grandes Caminos</option>
                <option value="mayor">Caminos Mayores</option>
                <option value="menor">Caminos Menores</option>
                <option value="senda">Sendas</option>
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
              onClick={() => setZoom(z => Math.max(0.01, z * 0.8))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <input
              type="text"
              value={`${Math.round(zoom * 100)}%`}
              onChange={(e) => {
                const val = e.target.value.replace('%', '').trim();
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 2000) {
                  setZoom(num / 100);
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.replace('%', '').trim();
                const num = parseInt(val, 10);
                if (isNaN(num) || num < 1) {
                  setZoom(0.01);
                } else if (num > 2000) {
                  setZoom(20);
                }
              }}
              className="w-16 text-center text-sm bg-background border border-input rounded px-1 py-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(z => Math.min(20, z * 1.25))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title="Restablecer vista"
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
        onWheel={handleWheel}
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
          viewBox={`0 0 ${MAP_PIXEL_WIDTH} ${MAP_PIXEL_HEIGHT}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
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
          <rect width={MAP_PIXEL_WIDTH} height={MAP_PIXEL_HEIGHT} fill="#1a1510" />
          
          {/* Map images as background - Unified Middle-earth map */}
          {showMapBackground && (
            <g opacity={mapOpacity}>
              {/* 
                Single unified map - positioned at full size to match coordinates
                Same positioning as EnhancedTravelSystem
              */}
              <image
                href={MAP_IMAGES.unified.url}
                x={0}
                y={0}
                width={MAP_PIXEL_WIDTH}
                height={MAP_PIXEL_HEIGHT}
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
          )}
          
          {/* Grid lines (optional) */}
          {showMasterView && !showMapBackground && (
            <g opacity={0.1}>
              {Array.from({ length: 11 }, (_, i) => (
                <React.Fragment key={i}>
                  <line
                    x1={i * (MAP_PIXEL_WIDTH / 10)}
                    y1={0}
                    x2={i * (MAP_PIXEL_WIDTH / 10)}
                    y2={MAP_PIXEL_HEIGHT}
                    stroke="#c9a227"
                    strokeWidth={20}
                  />
                  <line
                    x1={0}
                    y1={i * (MAP_PIXEL_HEIGHT / 10)}
                    x2={MAP_PIXEL_WIDTH}
                    y2={i * (MAP_PIXEL_HEIGHT / 10)}
                    stroke="#c9a227"
                    strokeWidth={20}
                  />
                </React.Fragment>
              ))}
            </g>
          )}
          
          {/* Region labels (only when no map background) */}
          {showMasterView && !showMapBackground && zoom > 0.5 && (
            <g opacity={0.3}>
              <text x={3000} y={6000} fill="#c9a227" fontSize={800} fontWeight="bold">ERIADOR</text>
              <text x={8000} y={10000} fill="#c9a227" fontSize={700} fontWeight="bold">ROHAN</text>
              <text x={10000} y={12000} fill="#c9a227" fontSize={700} fontWeight="bold">GONDOR</text>
              <text x={13000} y={10000} fill="#8b0000" fontSize={600} fontWeight="bold">MORDOR</text>
              <text x={600} y={350} fill="#c9a227" fontSize={30} fontWeight="bold">RHOVANION</text>
            </g>
          )}
          
          {/* Route line */}
          {renderRoute()}
          
          {/* Saved Roads */}
          {showRoads && roads.map(road => {
            const roadStyle = ROAD_TYPES[road.tipo] || ROAD_TYPES.menor;
            const isSelected = selectedRoad?.id === road.id;
            // Base width that scales appropriately - significantly increased for better visibility
            const baseWidth = Math.max(2.5, (roadStyle.width * 2.5) / Math.sqrt(zoom));
            return (
              <g key={road.id}>
                {/* Road shadow/outline for better visibility */}
                <path
                  d={roadToPath(road)}
                  fill="none"
                  stroke="#000"
                  strokeWidth={(baseWidth + 1.5) * (isSelected ? 1.5 : 1)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.5}
                />
                {/* Main road path */}
                <path
                  d={roadToPath(road)}
                  fill="none"
                  stroke={isSelected ? '#00ff00' : roadStyle.color}
                  strokeWidth={baseWidth * (isSelected ? 1.5 : 1)}
                  strokeDasharray={roadStyle.dash.length > 0 ? roadStyle.dash.map(d => d / Math.sqrt(zoom)).join(' ') : 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
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
                    y={coordToPos(road.puntos[Math.floor(road.puntos.length / 2)].x, road.puntos[Math.floor(road.puntos.length / 2)].y).y - 12 / zoom}
                    fill={roadStyle.color}
                    fontSize={12 / zoom}
                    textAnchor="middle"
                    fontWeight="bold"
                    stroke="#000"
                    strokeWidth={2.5 / zoom}
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
              {/* Shadow for current road */}
              <path
                d={roadToPath(currentRoad)}
                fill="none"
                stroke="#000"
                strokeWidth={10 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.5}
              />
              <path
                d={roadToPath(currentRoad)}
                fill="none"
                stroke="#00ff00"
                strokeWidth={7 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${10 / zoom} ${5 / zoom}`}
                opacity={0.95}
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
        <LocationInfoPanel
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onSetOrigin={(loc) => {
            setRouteOrigin(loc);
            setSelectedLocation(null);
            toast.success(`Origen: ${loc.nombre}`);
          }}
          onSetDestination={(loc) => {
            setRouteDestination(loc);
            setSelectedLocation(null);
            toast.success(`Destino: ${loc.nombre}`);
          }}
          onEdit={startEditingLocation}
          onDelete={deleteLocation}
          showMasterView={showMasterView}
          isDeleting={isDeleting}
        />
        <EditLocationPanel
          location={editingLocation}
          formData={editFormData}
          setFormData={setEditFormData}
          onSave={saveEditedLocation}
          onDelete={() => deleteLocation(editingLocation)}
          onCancel={() => {
            setEditingLocation(null);
            setEditFormData({});
          }}
          isSaving={savingChanges}
          isDeleting={isDeleting}
          regionsHierarchy={regionsHierarchy}
          typeNames={TYPE_NAMES}
          locationIcons={LOCATION_ICONS}
          staticRegionHierarchy={REGION_HIERARCHY}
          customTypes={customTypes}
          onAddCustomType={(newType) => {
            if (newType.trim()) {
              const typeKey = newType.toLowerCase().replace(/\s+/g, '_');
              if (!customTypes.includes(typeKey)) {
                setCustomTypes(prev => [...prev, typeKey]);
              }
              setEditFormData(prev => ({ ...prev, tipo: typeKey }));
              toast.success(`Tipo "${newType}" creado`);
            }
          }}
        />
        <CreateLocationPanel
          isVisible={isCreatingLocation}
          newLocationData={newLocationData}
          setNewLocationData={setNewLocationData}
          newLocationCoords={newLocationCoords}
          onCreate={saveNewLocation}
          onCancel={cancelCreatingLocation}
          isCreating={false}
          regionsHierarchy={regionsHierarchy}
          typeNames={TYPE_NAMES}
          locationIcons={LOCATION_ICONS}
          staticRegionHierarchy={REGION_HIERARCHY}
          customTypes={customTypes}
          isCreatingNewType={isCreatingNewType}
          setIsCreatingNewType={setIsCreatingNewType}
          newCustomType={newCustomType}
          setNewCustomType={setNewCustomType}
          onAddCustomType={() => {
            if (newCustomType.trim()) {
              const typeKey = newCustomType.toLowerCase().replace(/\s+/g, '_');
              setCustomTypes(prev => [...prev, typeKey]);
              setNewLocationData({ ...newLocationData, tipo: typeKey });
              setNewCustomType('');
              setIsCreatingNewType(false);
              toast.success(`Tipo "${newCustomType}" creado`);
            }
          }}
        />
        <RoutePanel
          routeInfo={routeInfo}
          calculatedPath={calculatedPath}
          isCalculatingPath={isCalculatingPath}
          showCalculatedPath={showCalculatedPath}
          setShowCalculatedPath={setShowCalculatedPath}
          onClose={() => {
            setRouteOrigin(null);
            setRouteDestination(null);
            setRouteInfo(null);
            setCalculatedPath(null);
          }}
        />
        
        {/* Road/River/Barrier Management Panels */}
        <RoadsPanel
          roads={roads}
          setRoads={setRoads}
          selectedRoad={selectedRoad}
          setSelectedRoad={setSelectedRoad}
          showRoadsPanel={showRoadsPanel}
          setShowRoadsPanel={setShowRoadsPanel}
          onDeleteRoad={deleteRoad}
          onUpdateRoad={updateRoad}
          onCenterOnRoad={(road) => {
            if (road.puntos?.length > 0) {
              const mid = road.puntos[Math.floor(road.puntos.length / 2)];
              setViewBox(vb => ({...vb, x: mid.x - vb.width/2, y: mid.y - vb.height/2}));
            }
          }}
        />
        <RiversPanel
          rivers={rivers}
          setRivers={setRivers}
          selectedRiver={selectedRiver}
          setSelectedRiver={setSelectedRiver}
          showRiversPanel={showRiversPanel}
          setShowRiversPanel={setShowRiversPanel}
          onDeleteRiver={deleteRiver}
          onUpdateRiver={updateRiver}
          onCenterOnRiver={(river) => {
            if (river.puntos?.length > 0) {
              const mid = river.puntos[Math.floor(river.puntos.length / 2)];
              setViewBox(vb => ({...vb, x: mid.x - vb.width/2, y: mid.y - vb.height/2}));
            }
          }}
        />
        <BarriersPanel
          barriers={barriers}
          setBarriers={setBarriers}
          selectedBarrier={selectedBarrier}
          setSelectedBarrier={setSelectedBarrier}
          showBarriersPanel={showBarriersPanel}
          setShowBarriersPanel={setShowBarriersPanel}
          onDeleteBarrier={deleteBarrier}
          onUpdateBarrier={updateBarrier}
          onCenterOnBarrier={(barrier) => {
            if (barrier.puntos?.length > 0) {
              const mid = barrier.puntos[Math.floor(barrier.puntos.length / 2)];
              setViewBox(vb => ({...vb, x: mid.x - vb.width/2, y: mid.y - vb.height/2}));
            }
          }}
        />
        
        {/* Name Generator Panel */}
        <NameGeneratorPanel
          isVisible={showNameGenerator}
          onClose={() => setShowNameGenerator(false)}
          onSelectName={(name) => {
            // If creating a location, use the name
            if (isCreatingLocation) {
              setNewLocationData(prev => ({ ...prev, nombre: name }));
            }
          }}
          onSelectHistory={(history) => {
            // If creating a location, use the history as description
            if (isCreatingLocation) {
              setNewLocationData(prev => ({ ...prev, descripcion: history }));
            }
          }}
        />
        
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
