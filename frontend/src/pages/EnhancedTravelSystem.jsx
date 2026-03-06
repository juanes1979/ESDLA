/**
 * Enhanced Travel System Component
 * Implements both Global and Day-by-Day journey modes
 * Uses the new travel rules API with editable configurations
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Map, Users, Compass, Play, Save, Clock, Mountain,
  Sun, Moon, Snowflake, Leaf, ArrowLeft, ArrowRight, Plus, MapPin, 
  Route, AlertTriangle, Shield, Footprints, Dice6, Check, X,
  ChevronRight, SkipForward, Flag, Zap, Heart, Eye, Sparkles, Maximize2,
  Printer, FileText, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// Map URLs and coordinate system
// Both maps have the same pixel dimensions (19791x15133)
// Player map loaded from local public folder
const PLAYER_MAP_URL = '/mapa_jugadores.jpg';
// Use actual pixel dimensions for coordinate system
const MAP_PIXEL_WIDTH = 19791;
const MAP_PIXEL_HEIGHT = 15133;

// Elvish months with seasons
const MESES_ELFICOS = [
  { id: "Nénimë", nombre: "Nénimë (Enero)", estacion: "invierno" },
  { id: "Súlimë", nombre: "Súlimë (Febrero)", estacion: "invierno" },
  { id: "Coiviennë", nombre: "Coiviennë (Marzo)", estacion: "primavera" },
  { id: "Víressë", nombre: "Víressë (Abril)", estacion: "primavera" },
  { id: "Lótessë", nombre: "Lótessë (Mayo)", estacion: "primavera" },
  { id: "Nárië", nombre: "Nárië (Junio)", estacion: "verano" },
  { id: "Cermië", nombre: "Cermië (Julio)", estacion: "verano" },
  { id: "Urimë", nombre: "Urimë (Agosto)", estacion: "verano" },
  { id: "Yavannië", nombre: "Yavannië (Septiembre)", estacion: "verano" },
  { id: "Narquelië", nombre: "Narquelië (Octubre)", estacion: "otono" },
  { id: "Hísimë", nombre: "Hísimë (Noviembre)", estacion: "otono" },
  { id: "Ringarë", nombre: "Ringarë (Diciembre)", estacion: "invierno" },
];

const SeasonIcon = ({ estacion }) => {
  switch (estacion) {
    case 'invierno': return <Snowflake className="w-4 h-4 text-blue-400" />;
    case 'primavera': return <Leaf className="w-4 h-4 text-green-400" />;
    case 'verano': return <Sun className="w-4 h-4 text-yellow-400" />;
    case 'otono': return <Leaf className="w-4 h-4 text-orange-400" />;
    default: return null;
  }
};

// Role icons
const ROLE_ICONS = {
  guia: <Compass className="w-4 h-4" />,
  cazador: <Zap className="w-4 h-4" />,
  vigia: <Eye className="w-4 h-4" />,
  explorador: <Map className="w-4 h-4" />
};

const ROLE_INFO = {
  guia: { 
    nombre: 'Guía', 
    desc: 'A cargo de todas las decisiones relativas a la ruta, el descanso y los suministros.', 
    habilidad: 'Viajar',
    habilidad_key: 'viajar',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  cazador: { 
    nombre: 'Cazador', 
    desc: 'Encargado de encontrar comida en la naturaleza.', 
    habilidad: 'Caza',
    habilidad_key: 'caza',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  vigia: { 
    nombre: 'Vigía', 
    desc: 'Responsable de la vigilancia.', 
    habilidad: 'Percepción',
    habilidad_key: 'percepcion',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  explorador: { 
    nombre: 'Explorador', 
    desc: 'Encargado de montar el campamento y de abrir nuevos caminos.', 
    habilidad: 'Explorar',
    habilidad_key: 'explorar',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  }
};

// Helper to check if a character has multiple roles
const hasMultipleRoles = (member) => {
  return member.papeles && member.papeles.length > 1;
};

// Helper to check if character has penalty (multiple roles or forced march)
const hasPenalty = (member, marchaForzada = 0) => {
  return hasMultipleRoles(member) || marchaForzada > 0;
};

// Penalty amount for multiple roles or forced march
const MULTI_ROLE_PENALTY = -5;

// Maximum roles per character
const MAX_ROLES_PER_CHARACTER = 2;

// =============== JOURNEY MAP MINI COMPONENT ===============

// Function to add natural variation to a path (makes it look hand-drawn)
const createNaturalPath = (points, variationAmount = 2) => {
  if (points.length < 2) return points;
  
  const result = [points[0]]; // Keep start point
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Add slight random variation perpendicular to the path direction
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len > 0) {
      // Perpendicular direction
      const px = -dy / len;
      const py = dx / len;
      
      // Random variation
      const variation = (Math.random() - 0.5) * variationAmount;
      
      result.push({
        x: curr.x + px * variation,
        y: curr.y + py * variation
      });
    } else {
      result.push(curr);
    }
  }
  
  result.push(points[points.length - 1]); // Keep end point
  return result;
};

// Create smooth SVG path from points using quadratic curves
const createSmoothPath = (points) => {
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  if (points.length === 2) {
    path += ` L ${points[1].x} ${points[1].y}`;
    return path;
  }
  
  // Use quadratic bezier curves for smooth transitions
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Control point is current point
    // End point is midpoint between current and next
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    
    if (i === 1) {
      // First curve - start from first point
      path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
    } else {
      path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
    }
  }
  
  // Last segment - curve to final point
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;
  
  return path;
};

const JourneyMiniMap = ({ origenCoords, destinoCoords, origenNombre, destinoNombre, pathPoints, isDirectLine, expanded = false, onToggleExpand }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const svgRef = useRef(null);
  
  // Preload image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = PLAYER_MAP_URL;
  }, []);
  
  // Validate required coordinates
  if (!origenCoords || !destinoCoords || 
      typeof origenCoords.x !== 'number' || typeof origenCoords.y !== 'number' ||
      typeof destinoCoords.x !== 'number' || typeof destinoCoords.y !== 'number') {
    return null;
  }
  
  // Convert percentage coords (0-100) to actual pixel coordinates
  // The coordinates in the database are percentages
  // X: 0% = left, 100% = right
  // Y: 0% = bottom, 100% = top (so we need to flip for SVG where 0 = top)
  const percentToPixels = (xPercent, yPercent) => {
    if (typeof xPercent !== 'number' || typeof yPercent !== 'number' || 
        isNaN(xPercent) || isNaN(yPercent)) {
      return null;
    }
    return {
      x: (xPercent / 100) * MAP_PIXEL_WIDTH,
      y: MAP_PIXEL_HEIGHT - (yPercent / 100) * MAP_PIXEL_HEIGHT  // Flip Y
    };
  };
  
  const origen = percentToPixels(origenCoords.x, origenCoords.y);
  const destino = percentToPixels(destinoCoords.x, destinoCoords.y);
  
  if (!origen || !destino) return null;
  
  // Convert all path points to pixel coordinates, filtering invalid points
  let pathInPixelCoords = (pathPoints || [])
    .map(p => {
      const px = Array.isArray(p) ? p[0] : (p?.x ?? null);
      const py = Array.isArray(p) ? p[1] : (p?.y ?? null);
      return percentToPixels(px, py);
    })
    .filter(p => p !== null);
  
  // ALWAYS ensure we have at least the origin and destination as path endpoints
  // This guarantees a visible route line even if pathfinding returns empty
  if (pathInPixelCoords.length === 0) {
    pathInPixelCoords = [origen, destino];
  } else {
    // Ensure path starts at origin and ends at destination
    if (pathInPixelCoords[0].x !== origen.x || pathInPixelCoords[0].y !== origen.y) {
      pathInPixelCoords.unshift(origen);
    }
    const lastPoint = pathInPixelCoords[pathInPixelCoords.length - 1];
    if (lastPoint.x !== destino.x || lastPoint.y !== destino.y) {
      pathInPixelCoords.push(destino);
    }
  }
  
  // If no path points, create direct path
  if (pathInPixelCoords.length < 2) {
    pathInPixelCoords = [origen, destino];
  }
  
  // Add natural variation to make the path look hand-drawn
  const naturalPath = createNaturalPath(pathInPixelCoords, isDirectLine ? 5 : 3);
  
  // Calculate viewBox to show entire route with padding
  // IMPORTANT: Always include both origin and destination markers
  const allX = [origen.x, destino.x, ...naturalPath.map(p => p.x)].filter(v => !isNaN(v));
  const allY = [origen.y, destino.y, ...naturalPath.map(p => p.y)].filter(v => !isNaN(v));
  
  // Validate we have coordinates
  if (allX.length === 0 || allY.length === 0) {
    return (
      <Card className="card-parchment overflow-hidden">
        <CardContent className="p-4 text-center text-muted-foreground">
          Coordenadas no disponibles para mostrar el mapa
        </CardContent>
      </Card>
    );
  }
  
  // Padding in pixels (about 5% of visible area)
  const padding = Math.max(MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT) * 0.05;
  const minX = Math.max(0, Math.min(...allX) - padding);
  const minY = Math.max(0, Math.min(...allY) - padding);
  const maxX = Math.min(MAP_PIXEL_WIDTH, Math.max(...allX) + padding);
  const maxY = Math.min(MAP_PIXEL_HEIGHT, Math.max(...allY) + padding);
  
  let width = Math.max(maxX - minX, MAP_PIXEL_WIDTH * 0.1);
  let height = Math.max(maxY - minY, MAP_PIXEL_HEIGHT * 0.1);
  
  // Maintain map aspect ratio (19791/15133 = 1.308)
  const mapAspect = MAP_PIXEL_WIDTH / MAP_PIXEL_HEIGHT;
  const currentAspect = width / height;
  
  if (currentAspect > mapAspect * 1.5) {
    height = width / mapAspect;
  } else if (currentAspect < mapAspect * 0.5) {
    width = height * mapAspect;
  }
  
  const viewBox = `${minX} ${minY} ${width} ${height}`;
  const containerHeight = expanded ? 'h-[500px]' : 'h-72';
  
  // Create smooth SVG path
  const smoothPathD = createSmoothPath(naturalPath);
  
  // Line and marker sizes - proportional to viewBox (in pixels)
  const mapScale = Math.max(width, height);
  
  // Line thickness - subtle but visible
  const lineWidth = Math.max(20, mapScale * 0.0015);
  // Markers - small but clear
  const markerRadius = Math.max(50, mapScale * 0.004);
  // Text - readable
  const fontSize = Math.max(100, mapScale * 0.008);
  
  return (
    <Card className="card-parchment overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-[hsl(var(--gold))]">
          <Route className="w-4 h-4 inline mr-2" />
          Mapa del Viaje
        </CardTitle>
        {onToggleExpand && (
          <Button variant="ghost" size="sm" onClick={onToggleExpand} className="h-6 w-6 p-0">
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <div className={`relative ${containerHeight} rounded overflow-hidden border border-border/30`}>
          {!imageLoaded ? (
            <div className="w-full h-full flex items-center justify-center bg-black/40">
              <div className="animate-spin w-6 h-6 border-2 border-[hsl(var(--gold))] border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <svg 
              ref={svgRef}
              viewBox={viewBox}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid slice"
            >
              {/* Player map as background - uses actual pixel dimensions */}
              <image
                href={PLAYER_MAP_URL}
                x="0"
                y="0"
                width={MAP_PIXEL_WIDTH}
                height={MAP_PIXEL_HEIGHT}
                preserveAspectRatio="none"
              />
              
              {/* Route path - brown ink style */}
              <path
                d={smoothPathD}
                fill="none"
                stroke="#5c3d2e"
                strokeWidth={lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
              
              {/* Origin marker - green circle */}
              <g>
                <circle
                  cx={origen.x}
                  cy={origen.y}
                  r={markerRadius}
                  fill="none"
                  stroke="#2d5016"
                  strokeWidth={lineWidth * 0.8}
                />
                <circle
                  cx={origen.x}
                  cy={origen.y}
                  r={markerRadius * 0.4}
                  fill="#2d5016"
                />
              </g>
              
              {/* Destination marker - red circle with X */}
              <g>
                <circle
                  cx={destino.x}
                  cy={destino.y}
                  r={markerRadius}
                  fill="none"
                  stroke="#8b1a1a"
                  strokeWidth={lineWidth * 0.8}
                />
                <line
                  x1={destino.x - markerRadius * 0.5}
                  y1={destino.y - markerRadius * 0.5}
                  x2={destino.x + markerRadius * 0.5}
                  y2={destino.y + markerRadius * 0.5}
                  stroke="#8b1a1a"
                  strokeWidth={lineWidth * 0.6}
                />
                <line
                  x1={destino.x + markerRadius * 0.5}
                  y1={destino.y - markerRadius * 0.5}
                  x2={destino.x - markerRadius * 0.5}
                  y2={destino.y + markerRadius * 0.5}
                  stroke="#8b1a1a"
                  strokeWidth={lineWidth * 0.6}
                />
              </g>
              
              {/* Origin label - italic calligraphy style */}
              <text
                x={origen.x}
                y={origen.y - markerRadius * 2.5}
                fill="#2d3a1d"
                fontSize={fontSize}
                fontStyle="italic"
                fontFamily="Georgia, serif"
                textAnchor="middle"
              >
                {origenNombre}
              </text>
              
              {/* Destination label - italic calligraphy style */}
              <text
                x={destino.x}
                y={destino.y - markerRadius * 2.5}
                fill="#4a1c1c"
                fontSize={fontSize}
                fontStyle="italic"
                fontFamily="Georgia, serif"
                textAnchor="middle"
              >
                {destinoNombre}
              </text>
            </svg>
          )}
          
          {/* Legend - parchment style */}
          <div className="absolute bottom-2 left-2 bg-amber-50/90 border border-amber-900/30 rounded px-2 py-1 text-xs flex gap-3">
            <span className="flex items-center gap-1 text-green-900">
              <span className="w-2 h-2 rounded-full border border-green-800 bg-transparent"></span>
              Origen
            </span>
            <span className="flex items-center gap-1 text-red-900">
              <span className="relative w-2 h-2">
                <span className="absolute inset-0 flex items-center justify-center text-[8px] text-red-800">✕</span>
              </span>
              Destino
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EnhancedTravelSystem = () => {
  // =============== STATE ===============
  
  // Mode: 'config' | 'global' | 'dayByDay' | 'results'
  const [mode, setMode] = useState('config');
  const [travelMode, setTravelMode] = useState('global'); // 'global' or 'dayByDay'
  
  // Data from API
  const [locations, setLocations] = useState([]);
  const [locationsByRegion, setLocationsByRegion] = useState({});
  const [characters, setCharacters] = useState([]);
  const [monturas, setMonturas] = useState([]);
  const [travelRules, setTravelRules] = useState(null);
  const [landTypes, setLandTypes] = useState([]);
  const [terrainTypes, setTerrainTypes] = useState([]);
  
  // Journey configuration
  const [config, setConfig] = useState({
    origenId: '',
    origenNombre: '',
    destinoId: '',
    destinoNombre: '',
    evitarSombra: false,
    evitarTierrasOscuras: false,
    preferirCaminos: true,
    ritmo: 'normal',
    mes: 'Cermië',
    estacion: 'verano',
    horasMarchaForzada: 0,
    miembros: []
  });
  
  // Search filters for origin/destination
  const [origenSearch, setOrigenSearch] = useState('');
  const [destinoSearch, setDestinoSearch] = useState('');
  const [origenOpen, setOrigenOpen] = useState(false);
  const [destinoOpen, setDestinoOpen] = useState(false);
  
  // Journey calculation result
  const [journeyCalc, setJourneyCalc] = useState(null);
  const [loadingCalc, setLoadingCalc] = useState(false);
  
  // Map expansion state
  const [mapExpanded, setMapExpanded] = useState(false);
  
  // Active journey (day-by-day mode)
  const [activeJourney, setActiveJourney] = useState(null);
  const [currentDayConfig, setCurrentDayConfig] = useState({
    ritmo: 'normal',
    marchaForzada: 0
  });
  
  // Events for current journey
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [resolvingEvent, setResolvingEvent] = useState(false);
  
  // Dice roll state for event resolution
  const [eventDiceRoll, setEventDiceRoll] = useState(null); // { d20: number, modifier: number, total: number }
  
  // Final results
  const [fatigueResults, setFatigueResults] = useState([]);
  
  // PX Application state
  const [applyingPX, setApplyingPX] = useState(false);
  const [pxApplied, setPxApplied] = useState(false);
  const [pxResults, setPxResults] = useState(null);
  
  // Journey narrative state
  const [journeyNarrative, setJourneyNarrative] = useState(null);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  
  // =============== LOAD DATA ===============
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locRes, charRes, mountRes, rulesRes, landsRes, terrainsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/characters/'),
          api.get('/data/monturas'),
          api.get('/travel/config/rules'),
          api.get('/travel/config/land-types'),
          api.get('/travel/config/terrains')
        ]);
        
        // Process locations
        const locs = locRes.data?.locations || [];
        setLocations(locs);
        
        // Group by region
        const byRegion = {};
        locs.forEach(loc => {
          const region = loc.region || 'Otros';
          if (!byRegion[region]) byRegion[region] = [];
          byRegion[region].push(loc);
        });
        Object.keys(byRegion).forEach(r => {
          byRegion[r].sort((a, b) => a.nombre.localeCompare(b.nombre));
        });
        setLocationsByRegion(byRegion);
        
        setCharacters(charRes.data?.characters || []);
        setMonturas(mountRes.data || []);
        setTravelRules(rulesRes.data?.rules || {});
        setLandTypes(landsRes.data?.land_types || []);
        setTerrainTypes(terrainsRes.data?.terrains || []);
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Error al cargar datos');
      }
    };
    loadData();
  }, []);
  
  // Update season when month changes
  useEffect(() => {
    const mes = MESES_ELFICOS.find(m => m.id === config.mes);
    if (mes) {
      setConfig(prev => ({ ...prev, estacion: mes.estacion }));
    }
  }, [config.mes]);
  
  // =============== JOURNEY CALCULATION ===============
  
  const calculateJourney = useCallback(async () => {
    if (!config.origenId || !config.destinoId) return;
    
    setLoadingCalc(true);
    try {
      const payload = {
        origen_id: config.origenId,
        origen_nombre: config.origenNombre,
        destino_id: config.destinoId,
        destino_nombre: config.destinoNombre,
        evitar_sombra: config.evitarSombra,
        evitar_tierras_oscuras: config.evitarTierrasOscuras,
        preferir_caminos: config.preferirCaminos,
        ritmo: config.ritmo,
        mes: config.mes,
        estacion: config.estacion,
        horas_marcha_forzada: config.horasMarchaForzada,
        miembros: config.miembros.map(m => ({
          personaje_id: m.id,
          nombre: m.nombre,
          papel: m.papel,
          tiene_montura: m.tieneMontura,
          montura_nombre: m.monturaNombre,
          montura_con_bonus: m.monturaConBonus || 0,
          velocidad_base: 30,
          modificador_sabiduria: m.modSabiduria || 0,
          competencias: m.competencias || [],
          nivel: m.nivel || 1
        }))
      };
      
      const res = await api.post('/travel/calculate-journey', payload);
      setJourneyCalc(res.data);
      
      if (res.data.error) {
        toast.error(res.data.message);
      }
    } catch (err) {
      console.error('Error calculating journey:', err);
      toast.error('Error al calcular viaje');
    } finally {
      setLoadingCalc(false);
    }
  }, [config]);
  
  // Recalculate when config changes
  useEffect(() => {
    if (config.origenId && config.destinoId) {
      const timer = setTimeout(() => calculateJourney(), 500);
      return () => clearTimeout(timer);
    }
  }, [config.origenId, config.destinoId, config.ritmo, config.evitarSombra, config.preferirCaminos, calculateJourney]);
  
  // =============== START JOURNEY ===============
  
  const startGlobalJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    if (!config.miembros.some(m => m.papeles?.includes('guia'))) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }
    
    setMode('global');
    setEvents([]);
    
    // Generate all events for the journey
    const numEvents = journeyCalc.estimaciones.eventos_esperados;
    const generatedEvents = [];
    
    for (let i = 0; i < numEvents; i++) {
      try {
        const eventRes = await api.post('/travel/generate-event', null, {
          params: {
            tipo_tierra: journeyCalc.ruta.tipo_tierra,
            terreno: journeyCalc.ruta.terreno,
            estacion: config.estacion
          }
        });
        
        if (eventRes.data.success) {
          generatedEvents.push({
            ...eventRes.data,
            casilla: Math.ceil((i + 1) * (journeyCalc.ruta.casillas / numEvents)),
            resuelto: false,
            resultado: null
          });
        }
      } catch (err) {
        console.error('Error generating event:', err);
      }
    }
    
    setEvents(generatedEvents);
    if (generatedEvents.length > 0) {
      setCurrentEvent(generatedEvents[0]);
    }
  };
  
  const startDayByDayJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    if (!config.miembros.some(m => m.papeles?.includes('guia'))) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }
    
    try {
      const payload = {
        origen_id: config.origenId,
        origen_nombre: config.origenNombre,
        destino_id: config.destinoId,
        destino_nombre: config.destinoNombre,
        evitar_sombra: config.evitarSombra,
        evitar_tierras_oscuras: config.evitarTierrasOscuras,
        preferir_caminos: config.preferirCaminos,
        ritmo: config.ritmo,
        mes: config.mes,
        estacion: config.estacion,
        horas_marcha_forzada: config.horasMarchaForzada,
        miembros: config.miembros.map(m => ({
          personaje_id: m.id,
          nombre: m.nombre,
          papeles: m.papeles || [],
          tiene_montura: m.tieneMontura,
          montura_con_bonus: m.monturaConBonus || 0
        }))
      };
      
      const res = await api.post('/travel/journey/start', payload);
      
      if (res.data.success) {
        setActiveJourney(res.data.journey);
        setMode('dayByDay');
        toast.success('Viaje iniciado');
      } else {
        toast.error(res.data.message || 'Error al iniciar viaje');
      }
    } catch (err) {
      console.error('Error starting journey:', err);
      toast.error('Error al iniciar viaje');
    }
  };
  
  // =============== EVENT RESOLUTION ===============
  
  // Roll dice for event resolution
  const rollEventDice = () => {
    if (!currentEvent) return;
    
    // Find the character with the target role
    const targetRole = currentEvent.objetivo.papel;
    const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
    const targetChar = characters.find(c => c.id === targetMember?.id);
    
    // Calculate modifier based on role's skill
    const roleInfo = ROLE_INFO[targetRole];
    let modifier = 0;
    
    if (targetChar && roleInfo) {
      // Get attribute modifier
      const atributoVal = targetChar.atributos?.[roleInfo.atributo] || 10;
      const atributoMod = Math.floor((atributoVal - 10) / 2);
      
      // Check proficiency
      const competencias = targetChar.habilidades || [];
      const esCompetente = competencias.some(h => 
        h.toLowerCase().includes(roleInfo.habilidad_key) ||
        roleInfo.habilidad_key.includes(h.toLowerCase())
      );
      const profBonus = esCompetente ? Math.ceil((targetChar.nivel || 1) / 4) + 1 : 0;
      
      modifier = atributoMod + profBonus;
      
      // Apply penalty if character has multiple roles
      if (targetMember?.papeles?.length > 1) {
        modifier += MULTI_ROLE_PENALTY;
      }
    }
    
    // Roll d20
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;
    
    setEventDiceRoll({ d20, modifier, total });
  };
  
  // Clear dice roll when event changes
  useEffect(() => {
    setEventDiceRoll(null);
  }, [currentEvent]);
  
  const resolveCurrentEvent = async (tirada) => {
    if (!currentEvent) return;
    
    setResolvingEvent(true);
    
    // Find the character with the target role
    const targetRole = currentEvent.objetivo.papel;
    const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
    
    const cd = currentEvent.resolucion.cd;
    const exito = tirada >= cd;
    
    try {
      const res = await api.post('/travel/resolve-event', null, {
        params: {
          evento_id: currentEvent.evento.id,
          tirada_resolucion: tirada,
          cd: cd,
          exito: exito,
          evento_nombre: currentEvent.evento.nombre,
          objetivo_papel: targetRole,
          personaje_nombre: targetMember?.nombre || 'Desconocido'
        }
      });
      
      // Generate AI narrative for the event (non-blocking)
      let narrativa = null;
      try {
        const narrativeRes = await api.post('/travel/generate-narrative', null, {
          params: {
            evento_nombre: currentEvent.evento.nombre,
            exito: exito,
            consecuencia: exito ? currentEvent.evento.consecuencias_exito : currentEvent.evento.consecuencias_fracaso,
            personaje_nombre: targetMember?.nombre || 'El grupo',
            papel: targetRole,
            tirada: tirada,
            cd: cd,
            origen: config.origenNombre,
            destino: config.destinoNombre,
            terreno: journeyCalc?.ruta?.terreno || 'campo_abierto'
          }
        });
        if (narrativeRes.data.success) {
          narrativa = narrativeRes.data.narrative;
        }
      } catch (err) {
        console.log('Narrative generation skipped:', err);
      }
      
      // Update event with result
      const updatedEvents = events.map(e => {
        if (e === currentEvent) {
          return {
            ...e,
            resuelto: true,
            resultado: res.data,
            tirada: tirada,
            exito: exito,
            narrativa: narrativa
          };
        }
        return e;
      });
      
      setEvents(updatedEvents);
      
      // Move to next event
      const nextUnresolved = updatedEvents.find(e => !e.resuelto);
      setCurrentEvent(nextUnresolved || null);
      
      if (!nextUnresolved) {
        // All events resolved - show results
        await calculateFatigueResults(updatedEvents);
        setMode('results');
      }
    } catch (err) {
      console.error('Error resolving event:', err);
      toast.error('Error al resolver acontecimiento');
    } finally {
      setResolvingEvent(false);
    }
  };
  
  // =============== DAY BY DAY FUNCTIONS ===============
  
  const advanceDay = async () => {
    if (!activeJourney) return;
    
    try {
      const res = await api.post(`/travel/journey/${activeJourney.id}/advance-day`, null, {
        params: {
          ritmo: currentDayConfig.ritmo,
          marcha_forzada_horas: currentDayConfig.marchaForzada
        }
      });
      
      if (res.data.success) {
        setActiveJourney(res.data.journey);
        
        // Check for event generation (simplified - every 2-3 days)
        if (res.data.journey.dia_actual % 2 === 0) {
          await generateDayEvent();
        }
        
        if (res.data.completado) {
          await finishDayByDayJourney();
        }
      }
    } catch (err) {
      console.error('Error advancing day:', err);
      toast.error('Error al avanzar día');
    }
  };
  
  const generateDayEvent = async () => {
    try {
      const res = await api.post('/travel/generate-event', null, {
        params: {
          tipo_tierra: journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
          terreno: journeyCalc?.ruta?.terreno || 'campo_abierto',
          estacion: config.estacion
        }
      });
      
      if (res.data.success) {
        const newEvent = {
          ...res.data,
          casilla: activeJourney?.casillas_recorridas || 0,
          resuelto: false
        };
        setCurrentEvent(newEvent);
        setEvents(prev => [...prev, newEvent]);
      }
    } catch (err) {
      console.error('Error generating event:', err);
    }
  };
  
  const finishDayByDayJourney = async () => {
    try {
      const res = await api.post(`/travel/journey/${activeJourney.id}/complete`);
      if (res.data.success) {
        await calculateFatigueResults(events);
        setMode('results');
      }
    } catch (err) {
      console.error('Error finishing journey:', err);
    }
  };
  
  // =============== FATIGUE CALCULATION ===============
  
  const calculateFatigueResults = async (resolvedEvents) => {
    const results = [];
    
    // Calculate total fatigue CD
    let fatigueCd = travelRules?.fatigue_base_cd || 10;
    resolvedEvents.forEach(e => {
      if (e.resultado?.modificadores?.fatiga_cd_increase) {
        fatigueCd += e.resultado.modificadores.fatiga_cd_increase;
      }
    });
    
    // Calculate for each party member
    for (const member of config.miembros) {
      const char = characters.find(c => c.id === member.id);
      if (!char) continue;
      
      // Get constitution modifier
      const conMod = Math.floor(((char.atributos?.constitucion || 10) - 10) / 2);
      
      // Mount bonus
      const mountBonus = member.tieneMontura ? (member.monturaConBonus || 0) : 0;
      
      try {
        const res = await api.post('/travel/fatigue-save', null, {
          params: {
            personaje_nombre: member.nombre,
            modificador_constitucion: conMod,
            cd_acumulada: fatigueCd,
            dias_con_montura: member.tieneMontura ? journeyCalc?.estimaciones?.dias_estimados || 1 : 0,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            bonus_montura_con: mountBonus
          }
        });
        
        results.push({
          personaje: member.nombre,
          papel: member.papel,
          ...res.data
        });
      } catch (err) {
        console.error('Error calculating fatigue:', err);
      }
    }
    
    setFatigueResults(results);
  };
  
  // =============== MEMBER MANAGEMENT ===============
  
  const addMember = (charId) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    
    if (config.miembros.some(m => m.id === charId)) {
      toast.error('Este personaje ya está en el grupo');
      return;
    }
    
    // Get character's owned mount (if any)
    const monturaPropia = char.montura ? {
      nombre: char.montura.nombre,
      capacidad: char.montura.capacidad_carga,
      velocidad: char.montura.velocidad,
      constitucion: char.montura.constitucion
    } : null;
    
    setConfig(prev => ({
      ...prev,
      miembros: [...prev.miembros, {
        id: char.id,
        nombre: char.nombre,
        papeles: [], // Array of roles now
        tieneMontura: false,
        monturaNombre: null,
        monturaConBonus: 0,
        monturaPropia: monturaPropia, // Store owned mount
        modSabiduria: Math.floor(((char.atributos?.sabiduria || 10) - 10) / 2),
        percepcionPasiva: 10 + Math.floor(((char.atributos?.sabiduria || 10) - 10) / 2),
        competencias: char.habilidades || [],
        nivel: char.nivel || 1
      }]
    }));
  };
  
  const addMemberWithRole = (charId, role) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    
    // Check if character is already in the group
    const existingMember = config.miembros.find(m => m.id === charId);
    
    // Get character's owned mount (if any)
    const monturaPropia = char.montura ? {
      nombre: char.montura.nombre,
      capacidad: char.montura.capacidad_carga,
      velocidad: char.montura.velocidad,
      constitucion: char.montura.constitucion
    } : null;
    
    if (existingMember) {
      // Add role to existing member (allow multiple roles)
      setConfig(prev => ({
        ...prev,
        miembros: prev.miembros.map(m => {
          if (m.id === charId) {
            // Check if already has max roles
            if (m.papeles.length >= MAX_ROLES_PER_CHARACTER && !m.papeles.includes(role)) {
              toast.error(`Máximo ${MAX_ROLES_PER_CHARACTER} papeles por personaje`);
              return m;
            }
            const newPapeles = m.papeles.includes(role) 
              ? m.papeles 
              : [...m.papeles, role];
            return { ...m, papeles: newPapeles };
          }
          return m;
        })
      }));
    } else {
      // Add new member with role
      setConfig(prev => ({
        ...prev,
        miembros: [...prev.miembros, {
          id: char.id,
          nombre: char.nombre,
          papeles: [role],
          tieneMontura: false,
          monturaNombre: null,
          monturaConBonus: 0,
          monturaPropia: monturaPropia,
          modSabiduria: Math.floor(((char.atributos?.sabiduria || 10) - 10) / 2),
          percepcionPasiva: 10 + Math.floor(((char.atributos?.sabiduria || 10) - 10) / 2),
          competencias: char.habilidades || [],
          nivel: char.nivel || 1
        }]
      }));
    }
  };
  
  const removeMember = (charId) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.filter(m => m.id !== charId)
    }));
  };
  
  // Remove a specific role from a member
  const removeRoleFromMember = (charId, role) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => 
        m.id === charId 
          ? { ...m, papeles: m.papeles.filter(p => p !== role) }
          : m
      )
    }));
  };
  
  // Toggle a role on/off for a member
  const toggleMemberRole = (charId, role) => {
    const member = config.miembros.find(m => m.id === charId);
    if (member && member.papeles.length >= MAX_ROLES_PER_CHARACTER && !member.papeles.includes(role)) {
      toast.error(`Máximo ${MAX_ROLES_PER_CHARACTER} papeles por personaje`);
      return;
    }
    
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => {
        if (m.id !== charId) return m;
        const hasPapel = m.papeles.includes(role);
        return {
          ...m,
          papeles: hasPapel 
            ? m.papeles.filter(p => p !== role)
            : [...m.papeles, role]
        };
      })
    }));
  };
  
  const updateMemberRole = (charId, role) => {
    // Legacy - just adds a role now
    if (!role) return;
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => {
        if (m.id !== charId) return m;
        if (m.papeles.includes(role)) return m;
        return { ...m, papeles: [...m.papeles, role] };
      })
    }));
  };
  
  const updateMemberMount = (charId, useMount) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => {
        if (m.id !== charId) return m;
        
        if (useMount && m.monturaPropia) {
          // Use owned mount
          const modCon = parseInt(m.monturaPropia.constitucion?.match(/[+-]?\d+/)?.[1] || '0');
          return {
            ...m,
            tieneMontura: true,
            monturaNombre: m.monturaPropia.nombre,
            monturaConBonus: modCon
          };
        } else {
          // Walking
          return {
            ...m,
            tieneMontura: false,
            monturaNombre: null,
            monturaConBonus: 0
          };
        }
      })
    }));
  };
  
  // =============== RESET ===============
  
  const resetJourney = () => {
    setMode('config');
    setEvents([]);
    setCurrentEvent(null);
    setActiveJourney(null);
    setFatigueResults([]);
    setJourneyCalc(null);
    setPxApplied(false);
    setPxResults(null);
    setJourneyNarrative(null);
  };
  
  // =============== JOURNEY NARRATIVE & PDF ===============
  
  const generateJourneyNarrative = async () => {
    setGeneratingNarrative(true);
    try {
      const res = await api.post('/travel/generate-journey-summary', {
        origen: config.origenNombre,
        destino: config.destinoNombre,
        dias: journeyCalc?.estimaciones?.dias_estimados || 1,
        eventos: events.map(e => ({
          dia: e.casilla,
          nombre: e.evento?.nombre,
          exito: e.exito
        })),
        personajes: config.miembros.map(m => ({
          nombre: m.nombre,
          papel: m.papeles?.[0] || 'viajero'
        })),
        px_total: journeyCalc?.estimaciones?.px_total || 0,
        terrenos: journeyCalc?.ruta?.terrain_summary
      });
      
      if (res.data.success) {
        setJourneyNarrative(res.data.narrative);
      }
    } catch (err) {
      console.error('Error generating narrative:', err);
      toast.error('Error al generar narrativa');
    } finally {
      setGeneratingNarrative(false);
    }
  };
  
  const printJourneyDocument = () => {
    // Create a print-ready document with Tolkien styling
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Crónica del Viaje - ${config.origenNombre} a ${config.destinoNombre}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Spectral:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
        <style>
          @page { margin: 2cm; size: A4; }
          body {
            font-family: 'Spectral', Georgia, serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #2c1810;
            background: #f4efe6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }
          h1 {
            font-family: 'Cinzel', serif;
            font-size: 24pt;
            text-align: center;
            color: #8B4513;
            border-bottom: 2px solid #8B4513;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }
          h2 {
            font-family: 'Cinzel', serif;
            font-size: 16pt;
            color: #5c4033;
            margin-top: 25px;
            border-bottom: 1px solid #d4c4a8;
          }
          .narrative {
            font-style: italic;
            text-align: justify;
            margin: 25px 0;
            padding: 20px;
            background: rgba(139, 69, 19, 0.05);
            border-left: 4px solid #8B4513;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin: 20px 0;
          }
          .stat {
            text-align: center;
            padding: 15px;
            background: rgba(139, 69, 19, 0.08);
            border: 1px solid #d4c4a8;
          }
          .stat-value {
            font-family: 'Cinzel', serif;
            font-size: 24pt;
            color: #8B4513;
          }
          .stat-label { font-size: 10pt; color: #666; }
          .event {
            padding: 12px;
            margin: 10px 0;
            border-left: 3px solid;
          }
          .event-success { border-color: #228B22; background: rgba(34, 139, 34, 0.08); }
          .event-failure { border-color: #8B0000; background: rgba(139, 0, 0, 0.08); }
          .party-member {
            display: inline-block;
            padding: 5px 15px;
            margin: 5px;
            background: #f0e6d3;
            border: 1px solid #d4c4a8;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10pt;
            color: #888;
            border-top: 1px solid #d4c4a8;
            padding-top: 15px;
          }
          @media print {
            body { background: white; }
          }
        </style>
      </head>
      <body>
        <h1>Crónica del Viaje</h1>
        <p style="text-align: center; font-size: 14pt;">
          De <strong>${config.origenNombre}</strong> a <strong>${config.destinoNombre}</strong>
        </p>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${journeyCalc?.estimaciones?.dias_estimados || 0}</div>
            <div class="stat-label">Días de Marcha</div>
          </div>
          <div class="stat">
            <div class="stat-value">${journeyCalc?.ruta?.casillas || 0}</div>
            <div class="stat-label">Casillas</div>
          </div>
          <div class="stat">
            <div class="stat-value">${Math.round(journeyCalc?.ruta?.distance_km || 0)}</div>
            <div class="stat-label">Kilómetros</div>
          </div>
          <div class="stat">
            <div class="stat-value">${journeyCalc?.estimaciones?.px_total || 0}</div>
            <div class="stat-label">PX Ganados</div>
          </div>
        </div>
        
        ${journeyNarrative ? `
          <h2>Relato del Viaje</h2>
          <div class="narrative">${journeyNarrative}</div>
        ` : ''}
        
        <h2>La Compañía</h2>
        <div>
          ${config.miembros.filter(m => m.papeles?.length).map(m => `
            <div class="party-member">
              <strong>${m.nombre}</strong><br>
              <small>${m.papeles.map(p => ROLE_INFO[p]?.nombre || p).join(', ')}</small>
            </div>
          `).join('')}
        </div>
        
        ${events.length > 0 ? `
          <h2>Acontecimientos del Viaje</h2>
          ${events.map((e, i) => `
            <div class="event ${e.exito ? 'event-success' : 'event-failure'}">
              <strong>Casilla ${e.casilla}: ${e.evento?.nombre || 'Acontecimiento'}</strong>
              <span style="float: right;">${e.exito ? '✓ Éxito' : '✗ Fracaso'} (${e.tirada} vs CD ${e.resolucion?.cd || '?'})</span>
              <p style="margin: 8px 0 0 0; font-style: italic;">
                ${e.narrativa || (e.exito ? e.evento?.consecuencias_exito : e.evento?.consecuencias_fracaso) || ''}
              </p>
            </div>
          `).join('')}
        ` : '<p><em>El viaje transcurrió sin mayores contratiempos.</em></p>'}
        
        ${fatigueResults.length > 0 ? `
          <h2>Fatiga del Viaje</h2>
          ${fatigueResults.map(r => `
            <p>
              <strong>${r.personaje}:</strong> 
              Tirada ${r.tirada?.d20} + ${r.tirada?.modificador_con} CON = ${r.tirada?.total} vs CD ${r.cd}
              → <strong>${r.niveles_cansancio} nivel(es) de cansancio</strong>
            </p>
          `).join('')}
        ` : ''}
        
        <div class="footer">
          <p>Generado por el Sistema de Viajes de Rutas por la Tierra Media</p>
          <p>${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };
  
  // =============== APPLY PX TO CHARACTERS ===============
  
  const applyPXToCharacters = async () => {
    if (!journeyCalc?.estimaciones?.px_por_personaje) {
      toast.error('No hay PX para aplicar');
      return;
    }
    
    const membersWithRoles = config.miembros.filter(m => m.papeles?.length > 0);
    if (membersWithRoles.length === 0) {
      toast.error('No hay personajes con roles asignados');
      return;
    }
    
    setApplyingPX(true);
    
    try {
      const response = await api.post('/travel/apply-px', {
        character_ids: membersWithRoles.map(m => m.id),
        px_amount: journeyCalc.estimaciones.px_por_personaje,
        journey_id: activeJourney?.id || null,
        journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`
      });
      
      if (response.data.success) {
        setPxApplied(true);
        setPxResults(response.data);
        toast.success(`¡${response.data.px_por_personaje} PX aplicados a ${response.data.exitosos} personajes!`);
      } else {
        toast.error(response.data.message || 'Error al aplicar PX');
      }
    } catch (err) {
      console.error('Error applying PX:', err);
      toast.error('Error al aplicar PX a los personajes');
    } finally {
      setApplyingPX(false);
    }
  };
  
  // =============== RENDER SECTIONS ===============
  
  // Filter locations by search term
  const filterLocations = (searchTerm) => {
    if (!searchTerm) return locationsByRegion;
    
    const filtered = {};
    const term = searchTerm.toLowerCase();
    
    Object.entries(locationsByRegion).forEach(([region, locs]) => {
      const matchingLocs = locs.filter(loc => 
        loc.nombre.toLowerCase().includes(term) ||
        loc.nombre_sindarin?.toLowerCase().includes(term) ||
        region.toLowerCase().includes(term)
      );
      if (matchingLocs.length > 0) {
        filtered[region] = matchingLocs;
      }
    });
    
    return filtered;
  };
  
  // Configuration Panel
  const renderConfig = () => (
    <div className="space-y-6">
      {/* Origin & Destination */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Route className="w-5 h-5" /> Origen y Destino
            <Badge variant="outline" className="ml-2">{locations.length} ubicaciones</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Origin with Search */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-green-400" /> Origen
              </Label>
              <div className="relative">
                <Input
                  placeholder="Buscar origen..."
                  value={origenSearch}
                  onChange={(e) => setOrigenSearch(e.target.value)}
                  onFocus={() => setOrigenOpen(true)}
                  className="mb-1"
                />
                {config.origenNombre && !origenOpen && (
                  <div className="p-2 bg-green-900/20 rounded border border-green-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="font-medium">{config.origenNombre}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setConfig(prev => ({ ...prev, origenId: '', origenNombre: '' }));
                        setOrigenSearch('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {origenOpen && (
                  <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-auto border shadow-lg">
                    <ScrollArea className="h-60">
                      {Object.entries(filterLocations(origenSearch)).map(([region, locs]) => (
                        <div key={region} className="p-1">
                          <p className="text-xs font-bold text-[hsl(var(--gold))] px-2 py-1 sticky top-0 bg-card">{region}</p>
                          {locs.map(loc => (
                            <Button
                              key={loc.id}
                              variant="ghost"
                              className="w-full justify-start h-8 text-sm"
                              disabled={loc.id === config.destinoId}
                              onClick={() => {
                                setConfig(prev => ({ ...prev, origenId: loc.id, origenNombre: loc.nombre }));
                                setOrigenSearch('');
                                setOrigenOpen(false);
                              }}
                            >
                              {loc.refugio && <Shield className="w-3 h-3 text-green-400 mr-1" />}
                              {loc.nombre}
                            </Button>
                          ))}
                        </div>
                      ))}
                      {Object.keys(filterLocations(origenSearch)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ubicaciones</p>
                      )}
                    </ScrollArea>
                    <div className="border-t p-1">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setOrigenOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
            
            {/* Destination with Search */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-red-400" /> Destino
              </Label>
              <div className="relative">
                <Input
                  placeholder="Buscar destino..."
                  value={destinoSearch}
                  onChange={(e) => setDestinoSearch(e.target.value)}
                  onFocus={() => setDestinoOpen(true)}
                  className="mb-1"
                />
                {config.destinoNombre && !destinoOpen && (
                  <div className="p-2 bg-red-900/20 rounded border border-red-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span className="font-medium">{config.destinoNombre}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setConfig(prev => ({ ...prev, destinoId: '', destinoNombre: '' }));
                        setDestinoSearch('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {destinoOpen && (
                  <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-auto border shadow-lg">
                    <ScrollArea className="h-60">
                      {Object.entries(filterLocations(destinoSearch)).map(([region, locs]) => (
                        <div key={region} className="p-1">
                          <p className="text-xs font-bold text-[hsl(var(--gold))] px-2 py-1 sticky top-0 bg-card">{region}</p>
                          {locs.map(loc => (
                            <Button
                              key={loc.id}
                              variant="ghost"
                              className="w-full justify-start h-8 text-sm"
                              disabled={loc.id === config.origenId}
                              onClick={() => {
                                setConfig(prev => ({ ...prev, destinoId: loc.id, destinoNombre: loc.nombre }));
                                setDestinoSearch('');
                                setDestinoOpen(false);
                              }}
                            >
                              {loc.refugio && <Shield className="w-3 h-3 text-green-400 mr-1" />}
                              {loc.nombre}
                            </Button>
                          ))}
                        </div>
                      ))}
                      {Object.keys(filterLocations(destinoSearch)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ubicaciones</p>
                      )}
                    </ScrollArea>
                    <div className="border-t p-1">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDestinoOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
          
          {/* Route Options */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.evitarSombra}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, evitarSombra: v }))}
              />
              <Label className="text-sm">Evitar Tierras de la Sombra</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.evitarTierrasOscuras}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, evitarTierrasOscuras: v }))}
              />
              <Label className="text-sm">Evitar Tierras Oscuras</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.preferirCaminos}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, preferirCaminos: v }))}
              />
              <Label className="text-sm">Preferir Caminos</Label>
            </div>
          </div>
          
          {/* Journey Calculation Result */}
          {loadingCalc && (
            <div className="p-4 bg-black/20 rounded animate-pulse">
              <p className="text-muted-foreground">Calculando ruta...</p>
            </div>
          )}
          
          {journeyCalc?.success && !loadingCalc && (
            <div className="p-4 bg-gradient-to-r from-[hsl(var(--gold))/10] to-transparent rounded-lg border border-[hsl(var(--gold))/30]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[hsl(var(--gold))]">Ruta Calculada</h4>
                <div className="flex gap-2">
                  <Badge>{journeyCalc.ruta.tipo_tierra_nombre}</Badge>
                  <Badge variant="outline">{journeyCalc.ruta.terreno_nombre || journeyCalc.ruta.terreno}</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--torch-orange))]">{journeyCalc.ruta.distance_km}</p>
                  <p className="text-xs text-muted-foreground">kilómetros</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--magic-blue))]">{journeyCalc.ruta.casillas}</p>
                  <p className="text-xs text-muted-foreground">casillas</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--gold))]">{journeyCalc.estimaciones.dias_estimados}</p>
                  <p className="text-xs text-muted-foreground">días estimados</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{journeyCalc.estimaciones.px_total}</p>
                  <p className="text-xs text-muted-foreground">PX totales</p>
                </div>
              </div>
              
              {/* Terrain Breakdown - Detailed */}
              {journeyCalc.ruta?.terrain_summary && Object.keys(journeyCalc.ruta.terrain_summary).length > 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground mb-2">
                    <span className="text-[hsl(var(--gold))]">
                      <Mountain className="w-4 h-4 inline mr-1" />
                      Desglose del Terreno:
                    </span>
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(journeyCalc.ruta.terrain_summary)
                      .sort((a, b) => b[1] - a[1]) // Sort by distance descending
                      .map(([terrain, distance]) => {
                        const terrainNames = {
                          facil: { name: 'Fácil', color: 'bg-green-600', icon: '🌿' },
                          moderado: { name: 'Moderado', color: 'bg-yellow-600', icon: '🌾' },
                          dificil: { name: 'Difícil', color: 'bg-orange-600', icon: '🏔️' },
                          muy_dificil: { name: 'Muy Difícil', color: 'bg-red-600', icon: '⛰️' },
                          desalentador: { name: 'Desalentador', color: 'bg-purple-600', icon: '💀' }
                        };
                        const info = terrainNames[terrain] || { name: terrain, color: 'bg-gray-600', icon: '❓' };
                        const percentage = ((distance / journeyCalc.ruta.distance_km) * 100).toFixed(0);
                        
                        return (
                          <div key={terrain} className="bg-black/30 p-2 rounded">
                            <div className="flex items-center gap-1 mb-1">
                              <span>{info.icon}</span>
                              <span className="text-xs font-medium">{info.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${info.color} transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {distance.toFixed(1)} km
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Roads Used */}
              {journeyCalc.ruta?.roads_used?.length > 0 && (
                <div className="mt-2 p-3 bg-amber-900/20 rounded border border-amber-500/30 text-sm">
                  <p className="text-amber-400 mb-2">
                    <Route className="w-4 h-4 inline mr-1" />
                    Caminos utilizados:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {journeyCalc.ruta.roads_used.map((road, i) => (
                      <Badge key={i} variant="outline" className="border-amber-500/50 text-amber-300">
                        🛤️ {road}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rivers Crossed */}
              {journeyCalc.ruta?.rivers_crossed?.length > 0 && (
                <div className="mt-2 p-3 bg-blue-900/20 rounded border border-blue-500/30 text-sm">
                  <p className="text-blue-400 mb-2">
                    🌊 Ríos a cruzar: {journeyCalc.ruta.rivers_crossed.length}
                  </p>
                </div>
              )}
              
              {/* PX Breakdown */}
              {/* PX Breakdown - New per-km system */}
              {journeyCalc.px_desglose && journeyCalc.estimaciones?.px_total > 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground mb-2">
                    <span className="text-[hsl(var(--gold))]">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Experiencia del Viaje:
                    </span>
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-lg font-bold">{journeyCalc.estimaciones.px_total} PX</span>
                      <span className="text-xs text-muted-foreground">
                        ({journeyCalc.px_desglose.px_por_km_promedio} PX/km promedio)
                      </span>
                    </div>
                    
                    {/* Land type summary - show which lands give PX */}
                    {journeyCalc.ruta?.land_type_summary && Object.keys(journeyCalc.ruta.land_type_summary).length > 0 && (
                      <div className="text-xs space-y-1 border-t border-white/10 pt-2">
                        <p className="text-muted-foreground mb-1">Tierras atravesadas:</p>
                        {Object.entries(journeyCalc.ruta.land_type_summary).map(([land, km]) => {
                          const landNames = {
                            'tierras_libres': { name: 'Tierras Libres', color: 'text-green-400', px: false },
                            'tierras_fronterizas': { name: 'Tierras Fronterizas', color: 'text-yellow-400', px: true },
                            'tierras_salvajes': { name: 'Tierras Salvajes', color: 'text-orange-400', px: true },
                            'tierras_sombra': { name: 'Tierras de la Sombra', color: 'text-red-400', px: true },
                            'tierras_oscuras': { name: 'Tierras Oscuras', color: 'text-purple-400', px: true }
                          };
                          const info = landNames[land] || { name: land, color: 'text-white', px: false };
                          return (
                            <div key={land} className="flex justify-between items-center">
                              <span className={info.color}>{info.name}</span>
                              <span>
                                {km.toFixed(1)} km
                                {info.px && <span className="text-[hsl(var(--gold))] ml-1">★</span>}
                              </span>
                            </div>
                          );
                        })}
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          ★ = Otorga experiencia
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Show when no PX */}
              {journeyCalc.px_desglose && journeyCalc.estimaciones?.px_total === 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground">
                    <Sparkles className="w-4 h-4 inline mr-1 text-gray-500" />
                    <span className="text-gray-400">0 PX</span>
                    <span className="text-xs ml-2">(El viaje por Tierras Libres no otorga experiencia)</span>
                  </p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mt-3">
                {journeyCalc.modificadores.tiene_ventaja_eventos && (
                  <Badge className="bg-green-600">Ventaja en eventos</Badge>
                )}
                {journeyCalc.modificadores.tiene_desventaja_eventos && (
                  <Badge className="bg-red-600">Desventaja en eventos</Badge>
                )}
                {journeyCalc.modificadores.desventaja_estacion && (
                  <Badge className="bg-blue-600">Desventaja estacional</Badge>
                )}
              </div>
              
              {/* Journey Map */}
              {journeyCalc.ruta?.origen_coords && journeyCalc.ruta?.destino_coords && (
                <div className="mt-4">
                  <JourneyMiniMap
                    origenCoords={journeyCalc.ruta.origen_coords}
                    destinoCoords={journeyCalc.ruta.destino_coords}
                    origenNombre={config.origenNombre}
                    destinoNombre={config.destinoNombre}
                    pathPoints={journeyCalc.ruta.path}
                    isDirectLine={journeyCalc.ruta.is_direct_line}
                    expanded={mapExpanded}
                    onToggleExpand={() => setMapExpanded(!mapExpanded)}
                  />
                </div>
              )}
              
              {/* Route warnings */}
              {journeyCalc.ruta?.warnings?.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-900/30 rounded border border-yellow-500/30 text-sm">
                  {journeyCalc.ruta.warnings.map((w, i) => (
                    <p key={i} className="text-yellow-400">⚠️ {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {journeyCalc?.error && (
            <div className="p-4 bg-red-900/20 rounded border border-red-500/30">
              <p className="text-red-400">{journeyCalc.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Travel Settings */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
            <Footprints className="w-5 h-5 inline mr-2" />
            Configuración del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Ritmo de Viaje</Label>
              <Select value={config.ritmo} onValueChange={(v) => setConfig(prev => ({ ...prev, ritmo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lento">🐢 Lento (24 km/día)</SelectItem>
                  <SelectItem value="normal">🚶 Normal (36 km/día)</SelectItem>
                  <SelectItem value="rapido">🏃 Rápido (48 km/día)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Mes</Label>
              <Select value={config.mes} onValueChange={(v) => setConfig(prev => ({ ...prev, mes: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_ELFICOS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <SeasonIcon estacion={m.estacion} />
                        {m.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Marcha Forzada (horas extra)</Label>
              <Select 
                value={config.horasMarchaForzada.toString()} 
                onValueChange={(v) => setConfig(prev => ({ ...prev, horasMarchaForzada: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sin marcha forzada</SelectItem>
                  <SelectItem value="1">+1 hora (CD 11)</SelectItem>
                  <SelectItem value="2">+2 horas (CD 12)</SelectItem>
                  <SelectItem value="3">+3 horas (CD 13)</SelectItem>
                  <SelectItem value="4">+4 horas (CD 14)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Party Roles - 4 Independent Fields */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Users className="w-5 h-5 inline mr-2" />
            Papeles de Viaje
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Asigna personajes a cada papel. Un mismo personaje puede tener varios papeles (con penalización de -5 en cada función).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role Assignment Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
              // Get all members assigned to this role
              const assignedMembers = config.miembros.filter(m => m.papeles?.includes(roleKey));
              
              // Calculate bonus for each character for this role
              const getCharBonus = (char, member = null) => {
                if (!char) return { total: 0, atributo: 0, habilidad: 0, competente: false, penalizado: false };
                const atributoVal = char.atributos?.[roleInfo.atributo] || 10;
                const atributoMod = Math.floor((atributoVal - 10) / 2);
                const competencias = char.habilidades || [];
                const esCompetente = competencias.some(h => 
                  h.toLowerCase().includes(roleInfo.habilidad_key) ||
                  roleInfo.habilidad_key.includes(h.toLowerCase())
                );
                const profBonus = esCompetente ? Math.ceil((char.nivel || 1) / 4) + 1 : 0;
                
                // Check if this character has multiple roles (apply penalty)
                const tienePenalizacion = member?.papeles?.length > 1 || false;
                const penalizacion = tienePenalizacion ? MULTI_ROLE_PENALTY : 0;
                
                return {
                  total: atributoMod + profBonus + penalizacion,
                  totalSinPenalizacion: atributoMod + profBonus,
                  atributo: atributoMod,
                  habilidad: profBonus,
                  competente: esCompetente,
                  penalizado: tienePenalizacion,
                  penalizacion: penalizacion
                };
              };
              
              return (
                <Card 
                  key={roleKey} 
                  className={`p-4 ${assignedMembers.length > 0 ? 'border-green-500/50 bg-green-900/10' : 'border-border/50'}`}
                >
                  {/* Role Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-full ${
                      roleKey === 'guia' ? 'bg-blue-600' :
                      roleKey === 'cazador' ? 'bg-orange-600' :
                      roleKey === 'vigia' ? 'bg-purple-600' :
                      'bg-green-600'
                    }`}>
                      {ROLE_ICONS[roleKey]}
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--gold))]">{roleInfo.nombre}</h4>
                      <p className="text-xs text-muted-foreground">
                        {roleInfo.atributo_nombre} ({roleInfo.habilidad})
                      </p>
                    </div>
                  </div>
                  
                  {/* Role Description */}
                  <p className="text-xs text-muted-foreground mb-3 italic">
                    {roleInfo.desc}
                  </p>
                  
                  {/* Character Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Personaje asignado</Label>
                    <Select 
                      value="_select_"
                      onValueChange={(charId) => {
                        if (charId !== '_select_') {
                          addMemberWithRole(charId, roleKey);
                        }
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue>
                          {assignedMembers.length > 0 
                            ? `${assignedMembers.length} asignado(s)`
                            : <span className="text-muted-foreground">Seleccionar personaje</span>
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_select_" disabled>
                          <span className="text-muted-foreground">Seleccionar personaje</span>
                        </SelectItem>
                        {characters.map(char => {
                          const member = config.miembros.find(m => m.id === char.id);
                          const bonus = getCharBonus(char, member);
                          const alreadyHasRole = member?.papeles?.includes(roleKey);
                          const hasMaxRoles = member?.papeles?.length >= MAX_ROLES_PER_CHARACTER;
                          const isDisabled = alreadyHasRole || (hasMaxRoles && !alreadyHasRole);
                          return (
                            <SelectItem 
                              key={char.id} 
                              value={char.id}
                              disabled={isDisabled}
                            >
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className={isDisabled ? 'text-muted-foreground' : ''}>
                                  {char.nombre}
                                  {member?.papeles?.length > 0 && !alreadyHasRole && (
                                    <span className={`text-xs ml-1 ${hasMaxRoles ? 'text-red-400' : 'text-yellow-400'}`}>
                                      ({member.papeles.length}/{MAX_ROLES_PER_CHARACTER} papeles)
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  {bonus.competente && (
                                    <Badge variant="outline" className="text-xs bg-green-900/30 border-green-500/50">
                                      {roleInfo.habilidad}
                                    </Badge>
                                  )}
                                  <Badge className={`${
                                    bonus.totalSinPenalizacion >= 5 ? 'bg-green-600' :
                                    bonus.totalSinPenalizacion >= 2 ? 'bg-yellow-600' :
                                    'bg-red-600'
                                  }`}>
                                    {bonus.totalSinPenalizacion >= 0 ? '+' : ''}{bonus.totalSinPenalizacion}
                                  </Badge>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    
                    {/* List of assigned members for this role */}
                    {assignedMembers.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {assignedMembers.map(member => {
                          const char = characters.find(c => c.id === member.id);
                          const bonus = getCharBonus(char, member);
                          const hasOtherRoles = member.papeles.length > 1;
                          
                          return (
                            <div 
                              key={member.id}
                              className={`p-2 rounded border flex items-center justify-between ${
                                hasOtherRoles ? 'border-yellow-500/50 bg-yellow-900/20' : 'border-green-500/30 bg-green-900/10'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{member.nombre}</span>
                                {hasOtherRoles && (
                                  <Badge className="bg-yellow-600 text-xs">
                                    ⚠️ {member.papeles.length} papeles: -5
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={bonus.total >= 2 ? 'bg-green-600' : bonus.total >= 0 ? 'bg-yellow-600' : 'bg-red-600'}>
                                  {bonus.total >= 0 ? '+' : ''}{bonus.total}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                  onClick={() => removeRoleFromMember(member.id, roleKey)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Mount selection for first assigned member */}
                    {assignedMembers.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {assignedMembers.map(member => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">{member.nombre}:</Label>
                            {member.monturaPropia ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Switch
                                  checked={member.tieneMontura}
                                  onCheckedChange={(v) => updateMemberMount(member.id, v)}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {member.tieneMontura ? member.monturaPropia.nombre : 'A pie'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin montura propia</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          
          {/* Penalty Warning */}
          {config.miembros.some(m => m.papeles?.length > 1) && (
            <div className="p-3 bg-yellow-900/30 rounded border border-yellow-500/50 text-sm">
              <p className="text-yellow-400 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Personajes con múltiples papeles:
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {config.miembros.filter(m => m.papeles?.length > 1).map(m => (
                  <li key={m.id}>
                    • <span className="text-white">{m.nombre}</span>: {m.papeles.map(p => ROLE_INFO[p]?.nombre).join(', ')} 
                    <span className="text-red-400"> → -5 en todas sus funciones y Percepción pasiva</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Forced march warning */}
          {config.horasMarchaForzada > 0 && (
            <div className="p-3 bg-orange-900/30 rounded border border-orange-500/50 text-sm">
              <p className="text-orange-400">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                <strong>Marcha Forzada activa:</strong> Todos los personajes sufren -5 a su Percepción pasiva.
              </p>
            </div>
          )}
          
          {/* Summary of assigned roles */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
                const assigned = config.miembros.filter(m => m.papeles?.includes(roleKey));
                return (
                  <Badge 
                    key={roleKey}
                    className={assigned.length > 0 ? 'bg-green-600' : 'bg-red-600/50'}
                  >
                    {ROLE_ICONS[roleKey]}
                    <span className="ml-1">{roleInfo.nombre}:</span>
                    <span className="ml-1">{assigned.length > 0 ? assigned.map(a => a.nombre).join(', ') : 'Vacante'}</span>
                  </Badge>
                );
              })}
            </div>
          </div>
          
          {/* Warning if no guide */}
          {!config.miembros.some(m => m.papeles?.includes('guia')) && (
            <div className="p-2 bg-yellow-900/30 rounded border border-yellow-500/50 text-sm text-yellow-400">
              ⚠️ No hay ningún Guía asignado. Se requiere al menos uno para iniciar el viaje.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Travel Mode Selection */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Play className="w-5 h-5 inline mr-2" />
            Modo de Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={travelMode} onValueChange={setTravelMode}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="global">
                <SkipForward className="w-4 h-4 mr-2" /> Viaje Global
              </TabsTrigger>
              <TabsTrigger value="dayByDay">
                <ChevronRight className="w-4 h-4 mr-2" /> Jornada a Jornada
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="global" className="text-sm text-muted-foreground">
              <p>Ejecuta todo el viaje de una vez. Genera todos los acontecimientos y calcula el resultado final automáticamente.</p>
            </TabsContent>
            
            <TabsContent value="dayByDay" className="text-sm text-muted-foreground">
              <p>Avanza día a día. Permite cambiar el ritmo, los papeles y tomar decisiones cada jornada.</p>
            </TabsContent>
          </Tabs>
          
          <Button 
            onClick={travelMode === 'global' ? startGlobalJourney : startDayByDayJourney}
            disabled={!journeyCalc?.success || config.miembros.length === 0 || !config.miembros.some(m => m.papeles?.includes('guia'))}
            className="w-full h-12 text-lg mt-4"
            data-testid="start-journey-btn"
          >
            <Compass className="w-5 h-5 mr-2" />
            Iniciar Viaje ({travelMode === 'global' ? 'Global' : 'Jornada a Jornada'})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
  
  // Global Journey - Event Resolution
  const renderGlobalJourney = () => (
    <div className="space-y-6">
      {/* Journey Progress */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Route className="w-5 h-5 inline mr-2" />
            {config.origenNombre} → {config.destinoNombre}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress 
              value={(events.filter(e => e.resuelto).length / events.length) * 100} 
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Eventos resueltos: {events.filter(e => e.resuelto).length} / {events.length}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold">{journeyCalc?.ruta?.casillas || 0}</p>
              <p className="text-xs text-muted-foreground">casillas</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold">{journeyCalc?.estimaciones?.dias_estimados || 0}</p>
              <p className="text-xs text-muted-foreground">días</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
              <p className="text-xs text-muted-foreground">PX</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Current Event */}
      {currentEvent && (
        <Card className={`card-parchment border-2 ${
          currentEvent.evento.fatigue_cd_increase >= 3 ? 'border-red-500' :
          currentEvent.evento.fatigue_cd_increase >= 2 ? 'border-orange-500' :
          'border-yellow-500'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[hsl(var(--gold))]">
                <Dice6 className="w-5 h-5 inline mr-2" />
                Acontecimiento - Casilla {currentEvent.casilla}
              </CardTitle>
              <Badge className={
                currentEvent.evento.fatigue_cd_increase >= 3 ? 'bg-red-600' :
                currentEvent.evento.fatigue_cd_increase >= 2 ? 'bg-orange-600' :
                'bg-yellow-600'
              }>
                +{currentEvent.evento.fatigue_cd_increase} CD Fatiga
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Name */}
            <div className="p-4 bg-black/20 rounded">
              <h3 className="text-xl font-bold text-[hsl(var(--torch-orange))] mb-2">
                {currentEvent.evento.nombre}
              </h3>
              <p className="text-xs text-muted-foreground">
                (Tirada d20 del evento: {currentEvent.tiradas.d20}
                {currentEvent.tiradas.tipo_tirada !== 'normal' && (
                  <span className={currentEvent.tiradas.tipo_tirada === 'ventaja' ? 'text-green-400' : 'text-red-400'}>
                    {' '}- {currentEvent.tiradas.tipo_tirada}
                  </span>
                )})
              </p>
            </div>
            
            {/* Target Character Info */}
            {(() => {
              const targetRole = currentEvent.objetivo.papel;
              const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
              const targetChar = characters.find(c => c.id === targetMember?.id);
              const roleInfo = ROLE_INFO[targetRole];
              
              // Calculate modifier
              let modifier = 0;
              let modifierBreakdown = [];
              
              if (targetChar && roleInfo) {
                const atributoVal = targetChar.atributos?.[roleInfo.atributo] || 10;
                const atributoMod = Math.floor((atributoVal - 10) / 2);
                const competencias = targetChar.habilidades || [];
                const esCompetente = competencias.some(h => 
                  h.toLowerCase().includes(roleInfo.habilidad_key) ||
                  roleInfo.habilidad_key.includes(h.toLowerCase())
                );
                const profBonus = esCompetente ? Math.ceil((targetChar.nivel || 1) / 4) + 1 : 0;
                const hasMultipleRoles = targetMember?.papeles?.length > 1;
                
                modifier = atributoMod + profBonus + (hasMultipleRoles ? MULTI_ROLE_PENALTY : 0);
                
                modifierBreakdown.push(`${roleInfo.atributo_nombre}: ${atributoMod >= 0 ? '+' : ''}${atributoMod}`);
                if (profBonus > 0) modifierBreakdown.push(`${roleInfo.habilidad}: +${profBonus}`);
                if (hasMultipleRoles) modifierBreakdown.push(`Múltiples papeles: ${MULTI_ROLE_PENALTY}`);
              }
              
              return (
                <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
                  <h4 className="font-bold text-[hsl(var(--magic-blue))] mb-3">
                    Objetivo: {roleInfo?.nombre || targetRole}
                  </h4>
                  
                  {/* Character assigned to role */}
                  <div className="mb-3 p-2 bg-black/30 rounded">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Personaje:</span>{' '}
                      <span className="font-bold text-[hsl(var(--gold))]">
                        {targetMember?.nombre || 'Sin asignar'}
                      </span>
                    </p>
                    {targetChar && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Modificador total: <span className={`font-bold ${modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {modifier >= 0 ? '+' : ''}{modifier}
                        </span>
                        <span className="ml-2">({modifierBreakdown.join(', ')})</span>
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Prueba:</p>
                      <p className="text-[hsl(var(--gold))] font-medium">{currentEvent.objetivo.prueba}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dificultad (CD):</p>
                      <p className="text-2xl font-bold text-red-400">{currentEvent.resolucion.cd}</p>
                    </div>
                  </div>
                  {currentEvent.resolucion.desventaja_salvacion && (
                    <Badge className="bg-blue-600 mt-2">Desventaja (Otoño/Invierno)</Badge>
                  )}
                </div>
              );
            })()}
            
            {/* Consequences */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-green-900/20 rounded border border-green-500/30">
                <h5 className="font-bold text-green-400 mb-1">✓ Éxito</h5>
                <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_exito}</p>
              </div>
              <div className="p-3 bg-red-900/20 rounded border border-red-500/30">
                <h5 className="font-bold text-red-400 mb-1">✗ Fracaso</h5>
                <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_fracaso}</p>
              </div>
            </div>
            
            {/* Dice Rolling Section */}
            <div className="pt-4 border-t border-border/30 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  El personaje debe tirar 1d20 + modificador y superar la CD
                </p>
                
                {/* Roll Dice Button */}
                <Button 
                  onClick={rollEventDice}
                  className="h-14 px-8 text-lg bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
                  disabled={resolvingEvent}
                >
                  <Dice6 className="w-6 h-6 mr-2" />
                  🎲 Tirar 1d20
                </Button>
              </div>
              
              {/* Dice Result Display */}
              {eventDiceRoll && (
                <div className="p-4 bg-black/40 rounded-lg border-2 border-[hsl(var(--gold))]/50">
                  <div className="flex items-center justify-center gap-4 md:gap-6 mb-3">
                    {/* D20 Result */}
                    <div className="text-center">
                      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl font-bold ${
                        eventDiceRoll.d20 === 20 ? 'bg-green-600 text-white animate-pulse' :
                        eventDiceRoll.d20 === 1 ? 'bg-red-600 text-white animate-pulse' :
                        'bg-[hsl(var(--gold))] text-black'
                      }`}>
                        {eventDiceRoll.d20}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">d20</p>
                    </div>
                    
                    <span className="text-xl md:text-2xl text-muted-foreground">+</span>
                    
                    {/* Modifier */}
                    <div className="text-center">
                      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl font-bold ${
                        eventDiceRoll.modifier >= 0 ? 'bg-blue-600' : 'bg-red-600'
                      } text-white`}>
                        {eventDiceRoll.modifier >= 0 ? '+' : ''}{eventDiceRoll.modifier}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Mod</p>
                    </div>
                    
                    <span className="text-xl md:text-2xl text-muted-foreground">=</span>
                    
                    {/* Total */}
                    <div className="text-center">
                      <div className={`w-16 h-14 md:w-20 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl font-bold ${
                        eventDiceRoll.total >= currentEvent.resolucion.cd ? 'bg-green-600' : 'bg-red-600'
                      } text-white`}>
                        {eventDiceRoll.total}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Total</p>
                    </div>
                  </div>
                  
                  {/* Result comparison */}
                  <div className="text-center">
                    <p className={`text-lg md:text-xl font-bold ${
                      eventDiceRoll.total >= currentEvent.resolucion.cd ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {eventDiceRoll.total} vs CD {currentEvent.resolucion.cd} → {' '}
                      {eventDiceRoll.total >= currentEvent.resolucion.cd ? '¡ÉXITO!' : 'FRACASO'}
                    </p>
                    {eventDiceRoll.d20 === 20 && <p className="text-green-400 text-sm">🎉 ¡Crítico natural!</p>}
                    {eventDiceRoll.d20 === 1 && <p className="text-red-400 text-sm">💀 ¡Pifia natural!</p>}
                  </div>
                  
                  {/* Confirm Resolution Button */}
                  <div className="flex justify-center mt-4">
                    <Button 
                      onClick={() => resolveCurrentEvent(eventDiceRoll.total)}
                      disabled={resolvingEvent}
                      className={`h-10 px-6 ${
                        eventDiceRoll.total >= currentEvent.resolucion.cd 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {resolvingEvent ? 'Resolviendo...' : 'Confirmar Resultado'}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Manual input option */}
              {!eventDiceRoll && (
                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    ¿Prefieres tirar un dado físico? Introduce el resultado total (d20 + mod):
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={40}
                      className="w-20 text-center"
                      placeholder="Total"
                      id="roll-input"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('roll-input');
                        const value = parseInt(input?.value);
                        if (value >= 1) {
                          resolveCurrentEvent(value);
                        } else {
                          toast.error('Introduce un resultado válido');
                        }
                      }}
                      disabled={resolvingEvent}
                    >
                      {resolvingEvent ? 'Resolviendo...' : 'Resolver'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Resolved Events */}
      {events.filter(e => e.resuelto).length > 0 && (
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Crónica del Viaje</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {events.filter(e => e.resuelto).map((e, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded border ${e.exito ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-[hsl(var(--gold))]">
                        Casilla {e.casilla}: {e.evento?.nombre || 'Acontecimiento'}
                      </span>
                      <Badge className={e.exito ? 'bg-green-600' : 'bg-red-600'}>
                        {e.exito ? 'Éxito' : 'Fracaso'} ({e.tirada} vs CD {e.resolucion?.cd || '?'})
                      </Badge>
                    </div>
                    {/* Event narrative/consequence */}
                    <div className="text-sm text-muted-foreground italic border-l-2 border-[hsl(var(--gold))/30] pl-3 mt-2">
                      {e.narrativa || (e.exito 
                        ? e.evento?.consecuencias_exito || 'El grupo superó el obstáculo.'
                        : e.evento?.consecuencias_fracaso || 'El grupo enfrentó dificultades.'
                      )}
                    </div>
                    {/* Show who resolved it */}
                    <p className="text-xs text-muted-foreground mt-2">
                      Resuelto por: <span className="text-[hsl(var(--magic-blue))]">{e.objetivo?.prueba || 'El grupo'}</span>
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      <Button variant="outline" onClick={() => setMode('config')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Configuración
      </Button>
    </div>
  );
  
  // Day by Day Journey
  const renderDayByDay = () => (
    <div className="space-y-6">
      {/* Journey Header */}
      <Card className="card-parchment bg-gradient-to-r from-[hsl(var(--gold))/10] to-transparent">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[hsl(var(--gold))]">
                {config.origenNombre} → {config.destinoNombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {journeyCalc?.ruta?.tipo_tierra_nombre} • {journeyCalc?.ruta?.terreno_nombre || journeyCalc?.ruta?.terreno}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-lg px-3 py-1">
                <Clock className="w-4 h-4 mr-1 inline" />
                Día {activeJourney?.dia_actual || 1}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Journey Status */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Route className="w-5 h-5 inline mr-2" />
            Progreso del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress 
              value={((activeJourney?.casillas_recorridas || 0) / (activeJourney?.casillas_totales || 1)) * 100} 
              className="h-4"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>Casillas: {activeJourney?.casillas_recorridas?.toFixed(1) || 0} / {activeJourney?.casillas_totales || 0}</span>
              <span>{Math.round(((activeJourney?.casillas_recorridas || 0) / (activeJourney?.casillas_totales || 1)) * 100)}%</span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-black/20 p-3 rounded text-center">
              <p className="text-2xl font-bold text-red-400">{activeJourney?.fatiga_cd_total || 10}</p>
              <p className="text-xs text-muted-foreground">CD Fatiga</p>
            </div>
            <div className="bg-black/20 p-3 rounded text-center">
              <p className="text-2xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
              <p className="text-xs text-muted-foreground">PX Totales</p>
            </div>
            <div className="bg-black/20 p-3 rounded text-center">
              <p className="text-2xl font-bold text-blue-400">{events.length}</p>
              <p className="text-xs text-muted-foreground">Eventos</p>
            </div>
          </div>
          
          {/* Day Configuration */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm">Ritmo de hoy</Label>
              <Select 
                value={currentDayConfig.ritmo} 
                onValueChange={(v) => setCurrentDayConfig(prev => ({ ...prev, ritmo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lento">🐢 Lento (24 km)</SelectItem>
                  <SelectItem value="normal">🚶 Normal (36 km)</SelectItem>
                  <SelectItem value="rapido">🏃 Rápido (48 km)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm">Marcha Forzada</Label>
              <Select 
                value={currentDayConfig.marchaForzada.toString()} 
                onValueChange={(v) => setCurrentDayConfig(prev => ({ ...prev, marchaForzada: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sin marcha forzada</SelectItem>
                  <SelectItem value="1">+1 hora (+6 km)</SelectItem>
                  <SelectItem value="2">+2 horas (+12 km)</SelectItem>
                  <SelectItem value="3">+3 horas (+18 km)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            onClick={advanceDay} 
            className="w-full h-11" 
            disabled={currentEvent}
            data-testid="advance-day-btn"
          >
            <ChevronRight className="w-4 h-4 mr-2" />
            {currentEvent 
              ? 'Resuelve el acontecimiento primero' 
              : `Avanzar al Día ${(activeJourney?.dia_actual || 1) + 1}`
            }
          </Button>
        </CardContent>
      </Card>
      
      {/* Party Roles - Quick View */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Users className="w-5 h-5 inline mr-2" />
            Grupo de Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
              const members = config.miembros.filter(m => m.papeles?.includes(roleKey));
              return (
                <div 
                  key={roleKey}
                  className={`p-2 rounded text-center text-sm ${
                    members.length > 0 ? 'bg-green-900/20 border border-green-500/30' : 'bg-black/20 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {ROLE_ICONS[roleKey]}
                    <span className="font-bold text-[hsl(var(--gold))]">{roleInfo.nombre}</span>
                  </div>
                  {members.length > 0 ? (
                    <div className="space-y-1">
                      {members.map(m => (
                        <p key={m.id} className="text-xs text-muted-foreground truncate">
                          {m.nombre}
                          {m.papeles.length > 1 && <span className="text-yellow-400"> (-5)</span>}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground truncate">Vacante</p>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Penalties info */}
          {(config.miembros.some(m => m.papeles?.length > 1) || config.horasMarchaForzada > 0) && (
            <div className="mt-3 p-2 bg-yellow-900/30 rounded border border-yellow-500/30 text-xs text-yellow-400">
              ⚠️ Percepción pasiva reducida (-5): 
              {config.miembros.filter(m => m.papeles?.length > 1).map(m => m.nombre).join(', ')}
              {config.horasMarchaForzada > 0 && ' | Todos (marcha forzada)'}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Current Event (if any) */}
      {currentEvent && (
        <Card className={`card-parchment border-2 ${
          currentEvent.evento.fatigue_cd_increase >= 3 ? 'border-red-500' :
          currentEvent.evento.fatigue_cd_increase >= 2 ? 'border-orange-500' :
          'border-yellow-500'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                ¡Acontecimiento!
              </CardTitle>
              <Badge className={
                currentEvent.evento.fatigue_cd_increase >= 3 ? 'bg-red-600' :
                currentEvent.evento.fatigue_cd_increase >= 2 ? 'bg-orange-600' :
                'bg-yellow-600'
              }>
                +{currentEvent.evento.fatigue_cd_increase} CD Fatiga
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Name */}
            <div className="p-4 bg-black/20 rounded">
              <h3 className="text-xl font-bold text-[hsl(var(--torch-orange))] mb-2">
                {currentEvent.evento.nombre}
              </h3>
              <p className="text-xs text-muted-foreground">
                (Tirada d20 del evento: {currentEvent.tiradas.d20})
              </p>
            </div>
            
            {/* Target Character Info */}
            {(() => {
              const targetRole = currentEvent.objetivo.papel;
              const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
              const targetChar = characters.find(c => c.id === targetMember?.id);
              const roleInfo = ROLE_INFO[targetRole];
              
              // Calculate modifier
              let modifier = 0;
              let modifierBreakdown = [];
              
              if (targetChar && roleInfo) {
                const atributoVal = targetChar.atributos?.[roleInfo.atributo] || 10;
                const atributoMod = Math.floor((atributoVal - 10) / 2);
                const competencias = targetChar.habilidades || [];
                const esCompetente = competencias.some(h => 
                  h.toLowerCase().includes(roleInfo.habilidad_key) ||
                  roleInfo.habilidad_key.includes(h.toLowerCase())
                );
                const profBonus = esCompetente ? Math.ceil((targetChar.nivel || 1) / 4) + 1 : 0;
                const hasMultipleRoles = targetMember?.papeles?.length > 1;
                
                modifier = atributoMod + profBonus + (hasMultipleRoles ? MULTI_ROLE_PENALTY : 0);
                
                modifierBreakdown.push(`${roleInfo.atributo_nombre}: ${atributoMod >= 0 ? '+' : ''}${atributoMod}`);
                if (profBonus > 0) modifierBreakdown.push(`${roleInfo.habilidad}: +${profBonus}`);
                if (hasMultipleRoles) modifierBreakdown.push(`Múltiples papeles: ${MULTI_ROLE_PENALTY}`);
              }
              
              return (
                <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
                  <h4 className="font-bold text-[hsl(var(--magic-blue))] mb-3">
                    Objetivo: {roleInfo?.nombre || targetRole}
                  </h4>
                  
                  {/* Character assigned to role */}
                  <div className="mb-3 p-2 bg-black/30 rounded">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Personaje:</span>{' '}
                      <span className="font-bold text-[hsl(var(--gold))]">
                        {targetMember?.nombre || 'Sin asignar'}
                      </span>
                    </p>
                    {targetChar && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Modificador total: <span className={`font-bold ${modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {modifier >= 0 ? '+' : ''}{modifier}
                        </span>
                        <span className="ml-2">({modifierBreakdown.join(', ')})</span>
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Prueba:</p>
                      <p className="text-[hsl(var(--gold))] font-medium">{currentEvent.objetivo.prueba}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dificultad (CD):</p>
                      <p className="text-2xl font-bold text-red-400">{currentEvent.resolucion.cd}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Consequences */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-green-900/20 rounded border border-green-500/30">
                <h5 className="font-bold text-green-400 mb-1">✓ Éxito</h5>
                <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_exito}</p>
              </div>
              <div className="p-3 bg-red-900/20 rounded border border-red-500/30">
                <h5 className="font-bold text-red-400 mb-1">✗ Fracaso</h5>
                <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_fracaso}</p>
              </div>
            </div>
            
            {/* Dice Rolling Section */}
            <div className="pt-4 border-t border-border/30 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  El personaje debe tirar 1d20 + modificador y superar la CD
                </p>
                
                {/* Roll Dice Button */}
                <Button 
                  onClick={rollEventDice}
                  className="h-14 px-8 text-lg bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
                  disabled={resolvingEvent}
                >
                  <Dice6 className="w-6 h-6 mr-2" />
                  🎲 Tirar 1d20
                </Button>
              </div>
              
              {/* Dice Result Display */}
              {eventDiceRoll && (
                <div className="p-4 bg-black/40 rounded-lg border-2 border-[hsl(var(--gold))]/50">
                  <div className="flex items-center justify-center gap-6 mb-3">
                    {/* D20 Result */}
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl font-bold ${
                        eventDiceRoll.d20 === 20 ? 'bg-green-600 text-white animate-pulse' :
                        eventDiceRoll.d20 === 1 ? 'bg-red-600 text-white animate-pulse' :
                        'bg-[hsl(var(--gold))] text-black'
                      }`}>
                        {eventDiceRoll.d20}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">d20</p>
                    </div>
                    
                    <span className="text-2xl text-muted-foreground">+</span>
                    
                    {/* Modifier */}
                    <div className="text-center">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl font-bold ${
                        eventDiceRoll.modifier >= 0 ? 'bg-blue-600' : 'bg-red-600'
                      } text-white`}>
                        {eventDiceRoll.modifier >= 0 ? '+' : ''}{eventDiceRoll.modifier}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Mod</p>
                    </div>
                    
                    <span className="text-2xl text-muted-foreground">=</span>
                    
                    {/* Total */}
                    <div className="text-center">
                      <div className={`w-20 h-16 rounded-lg flex items-center justify-center text-3xl font-bold ${
                        eventDiceRoll.total >= currentEvent.resolucion.cd ? 'bg-green-600' : 'bg-red-600'
                      } text-white`}>
                        {eventDiceRoll.total}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Total</p>
                    </div>
                  </div>
                  
                  {/* Result comparison */}
                  <div className="text-center">
                    <p className={`text-xl font-bold ${
                      eventDiceRoll.total >= currentEvent.resolucion.cd ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {eventDiceRoll.total} vs CD {currentEvent.resolucion.cd} → {' '}
                      {eventDiceRoll.total >= currentEvent.resolucion.cd ? '¡ÉXITO!' : 'FRACASO'}
                    </p>
                    {eventDiceRoll.d20 === 20 && <p className="text-green-400 text-sm">🎉 ¡Crítico natural!</p>}
                    {eventDiceRoll.d20 === 1 && <p className="text-red-400 text-sm">💀 ¡Pifia natural!</p>}
                  </div>
                  
                  {/* Confirm Resolution Button */}
                  <div className="flex justify-center mt-4">
                    <Button 
                      onClick={() => resolveCurrentEvent(eventDiceRoll.total)}
                      disabled={resolvingEvent}
                      className={`h-10 px-6 ${
                        eventDiceRoll.total >= currentEvent.resolucion.cd 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {resolvingEvent ? 'Resolviendo...' : 'Confirmar Resultado'}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Manual input option */}
              {!eventDiceRoll && (
                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    ¿Prefieres tirar un dado físico? Introduce el resultado total (d20 + mod):
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={40}
                      className="w-20 text-center"
                      placeholder="Total"
                      id="day-roll-input"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('day-roll-input');
                        const value = parseInt(input?.value);
                        if (value >= 1) {
                          resolveCurrentEvent(value);
                        } else {
                          toast.error('Introduce un resultado válido');
                        }
                      }}
                      disabled={resolvingEvent}
                    >
                      {resolvingEvent ? 'Resolviendo...' : 'Resolver'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Days Log */}
      {activeJourney?.dias && activeJourney.dias.length > 0 && (
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Registro de Jornadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {activeJourney.dias.map((dia, idx) => (
                  <div key={idx} className="p-2 bg-black/20 rounded text-sm flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[hsl(var(--gold))]">Día {dia.dia}</span>
                      <span className="text-muted-foreground ml-2">{dia.notas}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{dia.distancia_recorrida_km} km</Badge>
                      {dia.eventos?.length > 0 && (
                        <Badge className="bg-yellow-600">{dia.eventos.length} evento(s)</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={resetJourney} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
        </Button>
        <Button 
          onClick={finishDayByDayJourney} 
          className="flex-1 bg-green-600 hover:bg-green-700"
          disabled={!activeJourney || activeJourney.casillas_recorridas < activeJourney.casillas_totales}
          data-testid="finish-journey-btn"
        >
          <Flag className="w-4 h-4 mr-2" /> Finalizar Viaje
        </Button>
      </div>
    </div>
  );
  
  // Results
  const renderResults = () => {
    // Calculate totals
    const totalFatigueCd = travelRules?.fatigue_base_cd || 10;
    let diasExtra = 0;
    let diasReducidos = 0;
    
    events.forEach(e => {
      if (e.resultado?.modificadores) {
        diasExtra += e.resultado.modificadores.dias_extra || 0;
        diasReducidos += e.resultado.modificadores.dias_reducidos || 0;
      }
    });
    
    const diasFinales = (journeyCalc?.estimaciones?.dias_estimados || 0) + diasExtra - diasReducidos;
    const eventosExitosos = events.filter(e => e.exito).length;
    const eventosFracasados = events.filter(e => e.resuelto && !e.exito).length;
    
    return (
      <div className="space-y-6">
        {/* Journey Summary */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-xl text-[hsl(var(--gold))]">
              <Flag className="w-6 h-6 inline mr-2" />
              Viaje Completado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">{config.origenNombre} → {config.destinoNombre}</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-[hsl(var(--gold))]">{diasFinales}</p>
                <p className="text-sm text-muted-foreground">días totales</p>
              </div>
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-green-400">{eventosExitosos}</p>
                <p className="text-sm text-muted-foreground">éxitos</p>
              </div>
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-red-400">{eventosFracasados}</p>
                <p className="text-sm text-muted-foreground">fracasos</p>
              </div>
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-[hsl(var(--torch-orange))]">
                  {journeyCalc?.estimaciones?.px_total || 0}
                </p>
                <p className="text-sm text-muted-foreground">PX totales</p>
              </div>
            </div>
            
            {diasExtra > 0 && (
              <Badge className="bg-red-600 mr-2">+{diasExtra} días por percances</Badge>
            )}
            {diasReducidos > 0 && (
              <Badge className="bg-green-600">-{diasReducidos} días por atajos</Badge>
            )}
          </CardContent>
        </Card>
        
        {/* XP Distribution per Character */}
        <Card className="card-parchment border-2 border-green-500/50">
          <CardHeader>
            <CardTitle className="text-lg text-green-400">
              <Sparkles className="w-5 h-5 inline mr-2" />
              Puntos de Experiencia Ganados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {pxApplied 
                ? '¡Los PX han sido aplicados a las fichas de los personajes!'
                : 'Cada personaje recibirá los siguientes PX al finalizar el viaje.'
              }
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {config.miembros.filter(m => m.papeles?.length > 0).map((member) => {
                const memberResult = pxResults?.results?.find(r => r.character_id === member.id);
                const hasMultiple = member.papeles.length > 1;
                return (
                  <Card key={member.id} className={`p-4 ${pxApplied ? 'bg-green-600/20 border-green-400' : 'bg-green-900/20 border-green-500/30'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[hsl(var(--gold))]">{member.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.papeles.map(p => ROLE_INFO[p]?.nombre).join(', ')}
                        </p>
                        {hasMultiple && (
                          <p className="text-xs text-yellow-400">⚠️ Múltiples papeles: -5</p>
                        )}
                        {memberResult && pxApplied && (
                          <p className="text-xs text-green-400 mt-1">
                            XP Total: {memberResult.xp_nuevo}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${pxApplied ? 'text-green-300' : 'text-green-400'}`}>
                          {pxApplied ? '✓' : '+'}{journeyCalc?.estimaciones?.px_por_personaje || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">PX</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            
            {journeyCalc?.px_desglose && (
              <div className="mt-4 p-3 bg-black/30 rounded text-xs">
                <p className="font-bold mb-2 text-[hsl(var(--gold))]">Desglose del cálculo:</p>
                <div className="space-y-1 text-muted-foreground">
                  <p>Distancia total: {journeyCalc.px_desglose.distancia_total_km} km</p>
                  <p>PX por km (promedio): {journeyCalc.px_desglose.px_por_km_promedio}</p>
                  {journeyCalc.ruta?.land_type_summary && (
                    <div className="mt-2">
                      <p className="font-medium text-white">Tierras atravesadas:</p>
                      {Object.entries(journeyCalc.ruta.land_type_summary).map(([land, km]) => (
                        <p key={land} className="pl-2">
                          • {land.replace('_', ' ')}: {km.toFixed(1)} km
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="font-bold text-white mt-2">
                    Total: {journeyCalc.px_desglose.px_total} PX ({journeyCalc.px_desglose.nota})
                  </p>
                </div>
              </div>
            )}
            
            {/* Apply PX Button */}
            {!pxApplied && (
              <Button 
                onClick={applyPXToCharacters}
                disabled={applyingPX}
                className="w-full mt-4 h-12 text-lg bg-green-600 hover:bg-green-700"
                data-testid="apply-px-btn"
              >
                {applyingPX ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Aplicando PX...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Finalizar Viaje y Repartir PX
                  </>
                )}
              </Button>
            )}
            
            {pxApplied && pxResults && (
              <div className="mt-4 p-3 bg-green-900/30 rounded border border-green-500/50">
                <p className="text-green-400 font-bold flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  {pxResults.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Fatigue Results */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-lg text-red-400">
              <Heart className="w-5 h-5 inline mr-2" />
              Tiradas de Fatiga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {fatigueResults.map((result, i) => (
                  <Card key={i} className={`p-3 ${
                    result.niveles_cansancio === 0 ? 'bg-green-900/20 border-green-500/50' :
                    result.niveles_cansancio === 1 ? 'bg-yellow-900/20 border-yellow-500/50' :
                    result.niveles_cansancio === 2 ? 'bg-orange-900/20 border-orange-500/50' :
                    'bg-red-900/20 border-red-500/50'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{result.personaje}</span>
                        {result.papel && (
                          <Badge variant="outline">{ROLE_INFO[result.papel]?.nombre}</Badge>
                        )}
                      </div>
                      <Badge className={
                        result.resultado === 'éxito' ? 'bg-green-600' :
                        result.resultado === 'fracaso' ? 'bg-yellow-600' :
                        result.resultado === 'fracaso_grave' ? 'bg-orange-600' :
                        'bg-red-600'
                      }>
                        {result.niveles_cansancio} nivel(es) cansancio
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Tirada: <span className="font-mono">{result.tirada?.d20}</span> + 
                        <span className="font-mono">{result.tirada?.modificador_con}</span> CON
                        {result.tirada?.bonus_montura > 0 && (
                          <span className="text-green-400"> + {result.tirada.bonus_montura} montura</span>
                        )}
                        {' = '}<span className="font-bold">{result.tirada?.total}</span>
                        {' vs CD '}<span className="text-red-400 font-bold">{result.cd}</span>
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Events Log */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-lg">Registro de Acontecimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {events.map((e, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded ${e.exito ? 'bg-green-900/10' : 'bg-red-900/10'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="mr-2">Casilla {e.casilla}</Badge>
                        <span className="font-bold">{e.evento.nombre}</span>
                      </div>
                      <Badge className={e.exito ? 'bg-green-600' : 'bg-red-600'}>
                        {e.tirada} vs CD {e.resolucion?.cd}
                      </Badge>
                    </div>
                    {e.resultado?.consecuencias?.map((c, ci) => (
                      <p key={ci} className="text-xs text-muted-foreground mt-1">• {c}</p>
                    ))}
                    {/* Show narrative if available */}
                    {e.narrativa && (
                      <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-[hsl(var(--gold))/30] pl-2">
                        {e.narrativa}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Journey Narrative Section */}
        <Card className="card-parchment border-2 border-[hsl(var(--gold))]/30">
          <CardHeader>
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              <BookOpen className="w-5 h-5 inline mr-2" />
              Crónica del Viaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {journeyNarrative ? (
              <div className="prose prose-sm max-w-none">
                <p className="italic text-muted-foreground leading-relaxed text-justify border-l-4 border-[hsl(var(--gold))]/30 pl-4">
                  {journeyNarrative}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Genera una narrativa épica en estilo Tolkien para este viaje.
              </p>
            )}
            
            <div className="flex gap-3 mt-4">
              <Button 
                onClick={generateJourneyNarrative}
                disabled={generatingNarrative}
                variant="outline"
                className="flex-1"
              >
                {generatingNarrative ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    {journeyNarrative ? 'Regenerar Narrativa' : 'Generar Narrativa'}
                  </>
                )}
              </Button>
              
              <Button 
                onClick={printJourneyDocument}
                className="flex-1 bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Crónica
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => setMode('config')} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Configuración
          </Button>
          <Button onClick={resetJourney} className="flex-1">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Viaje
          </Button>
        </div>
      </div>
    );
  };
  
  // =============== MAIN RENDER ===============
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-white">
            <a href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Inicio
            </a>
          </Button>
          <h1 className="text-3xl font-heading text-[hsl(var(--gold))]">
            <Compass className="w-8 h-8 inline mr-3" />
            Generador de Viajes
          </h1>
        </div>
        {mode !== 'config' && (
          <Badge variant="outline" className="text-lg">
            {mode === 'global' ? 'Modo Global' : mode === 'dayByDay' ? 'Jornada a Jornada' : 'Resultados'}
          </Badge>
        )}
      </div>
      
      {mode === 'config' && renderConfig()}
      {mode === 'global' && renderGlobalJourney()}
      {mode === 'dayByDay' && renderDayByDay()}
      {mode === 'results' && renderResults()}
    </div>
  );
};

export default EnhancedTravelSystem;
