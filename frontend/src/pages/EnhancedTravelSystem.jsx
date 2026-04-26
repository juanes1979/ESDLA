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
import { Textarea } from '@/components/ui/textarea';
import { 
  Map, Users, Compass, Play, Save, Clock, Mountain,
  Sun, Moon, Snowflake, Leaf, ArrowLeft, ArrowRight, Plus, MapPin, 
  Route, AlertTriangle, Shield, Footprints, Dice6, Check, X,
  ChevronRight, SkipForward, Flag, Zap, Heart, Eye, Sparkles, Maximize2,
  Printer, FileText, BookOpen, Package, ArrowLeftRight, Loader2, Droplets, Utensils, Tent, Coins
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import api from '@/services/api';
import PartyFatiguePanel from '@/components/travel/PartyFatiguePanel';
import CampDialog from '@/components/travel/CampDialog';
import JourneyDiary from '@/components/travel/JourneyDiary';
import ProvisionsShopDialog from '@/components/travel/ProvisionsShopDialog';
import WeatherIndicator from '@/components/travel/WeatherIndicator';
import SauronEyeOverlay from '@/components/travel/SauronEyeOverlay';

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
      
      // Random variation - more pronounced for a hand-drawn look
      // Using sine wave for smoother, more natural variations
      const baseVariation = Math.sin(i * 0.8) * variationAmount * 0.7;
      const randomVariation = (Math.random() - 0.5) * variationAmount * 0.5;
      const variation = baseVariation + randomVariation;
      
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

const JourneyMiniMap = ({ origenCoords, destinoCoords, origenNombre, destinoNombre, pathPoints, isDirectLine, expanded = false, onToggleExpand, events = [], forPrint = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mapImageBase64, setMapImageBase64] = useState(null);
  const containerRef = useRef(null);
  
  // Preload image and convert to base64 for html2canvas compatibility
  useEffect(() => {
    const loadImageAsBase64 = async () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // Create canvas to convert to base64
          const canvas = document.createElement('canvas');
          // Use smaller size for base64 to avoid memory issues
          const maxSize = 2000;
          const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
          canvas.width = img.naturalWidth * scale;
          canvas.height = img.naturalHeight * scale;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          setMapImageBase64(base64);
          setImageLoaded(true);
        };
        
        img.onerror = () => {
          console.error('Failed to load map image');
          setImageLoaded(true); // Continue even if image fails
        };
        
        img.src = window.location.origin + PLAYER_MAP_URL;
      } catch (err) {
        console.error('Error loading map image:', err);
        setImageLoaded(true);
      }
    };
    
    loadImageAsBase64();
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
  if (pathInPixelCoords.length === 0) {
    pathInPixelCoords = [origen, destino];
  } else {
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
  // Moderate variation for a realistic hand-drawn look
  const naturalPath = createNaturalPath(pathInPixelCoords, isDirectLine ? 50 : 25);
  
  // Calculate viewBox to show entire route CENTERED with padding
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
  
  // Calculate bounding box of the route
  const routeMinX = Math.min(...allX);
  const routeMaxX = Math.max(...allX);
  const routeMinY = Math.min(...allY);
  const routeMaxY = Math.max(...allY);
  
  // Route dimensions
  const routeWidth = routeMaxX - routeMinX;
  const routeHeight = routeMaxY - routeMinY;
  
  // Center of the route
  const centerX = (routeMinX + routeMaxX) / 2;
  const centerY = (routeMinY + routeMaxY) / 2;
  
  // Add generous padding (30% of route size, minimum 15% of map)
  const paddingX = Math.max(routeWidth * 0.3, MAP_PIXEL_WIDTH * 0.15);
  const paddingY = Math.max(routeHeight * 0.3, MAP_PIXEL_HEIGHT * 0.15);
  
  // Calculate viewBox dimensions centered on route
  let width = routeWidth + paddingX * 2;
  let height = routeHeight + paddingY * 2;
  
  // Maintain map aspect ratio (19791/15133 = 1.308) but allow some flexibility
  const mapAspect = MAP_PIXEL_WIDTH / MAP_PIXEL_HEIGHT;
  const currentAspect = width / height;
  
  // Adjust to be closer to map aspect ratio
  if (currentAspect > mapAspect * 1.3) {
    // Too wide, increase height
    height = width / mapAspect;
  } else if (currentAspect < mapAspect * 0.7) {
    // Too tall, increase width
    width = height * mapAspect;
  }
  
  // Calculate viewBox origin (centered on route)
  let minX = centerX - width / 2;
  let minY = centerY - height / 2;
  
  // Clamp to map boundaries
  minX = Math.max(0, Math.min(minX, MAP_PIXEL_WIDTH - width));
  minY = Math.max(0, Math.min(minY, MAP_PIXEL_HEIGHT - height));
  
  // Ensure viewBox doesn't exceed map size
  width = Math.min(width, MAP_PIXEL_WIDTH);
  height = Math.min(height, MAP_PIXEL_HEIGHT);
  
  const viewBox = `${minX} ${minY} ${width} ${height}`;
  const viewBoxParts = [minX, minY, width, height];
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
        <div 
          ref={containerRef}
          className={`relative ${containerHeight} rounded overflow-hidden border border-border/30`}
        >
          {!imageLoaded ? (
            <div className="w-full h-full flex items-center justify-center bg-black/40">
              <div className="animate-spin w-6 h-6 border-2 border-[hsl(var(--gold))] border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <svg 
              viewBox={viewBox}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid slice"
            >
              {/* Player map as background - use base64 for html2canvas compatibility */}
              <image
                href={mapImageBase64 || PLAYER_MAP_URL}
                x="0"
                y="0"
                width={MAP_PIXEL_WIDTH}
                height={MAP_PIXEL_HEIGHT}
                preserveAspectRatio="none"
              />
              
              {/* Route path - RED ink style */}
              <path
                d={smoothPathD}
                fill="none"
                stroke="#c43c3c"
                strokeWidth={lineWidth * 1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
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
              
              {/* Origin label */}
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
              
              {/* Event markers along the path */}
              {events && events.length > 0 && events.map((event, idx) => {
                // Compute the event's progress along the journey [0..1]
                const casillaTotal = (events[events.length - 1]?.casilla) ||
                                     (pathInPixelCoords.length - 1) || 1;
                const eventProgress = Math.min(1, Math.max(0, (event.casilla || idx + 1) / Math.max(1, casillaTotal)));
                
                // Two ways to place: along detailed path, or interpolated on the straight line
                let point;
                if (pathInPixelCoords.length > 2) {
                  const pathIndex = Math.floor(eventProgress * (pathInPixelCoords.length - 1));
                  point = pathInPixelCoords[Math.min(pathIndex, pathInPixelCoords.length - 1)];
                } else {
                  // Linear interpolation between origin and destination
                  point = {
                    x: origen.x + (destino.x - origen.x) * eventProgress,
                    y: origen.y + (destino.y - origen.y) * eventProgress,
                  };
                }
                if (!point) return null;
                
                // Small offset so multiple events at same casilla don't overlap completely
                const sameCasillaCount = events.filter(e => e.casilla === event.casilla).length;
                const sameCasillaIndex = events.filter((e, i) => e.casilla === event.casilla && i < idx).length;
                const offsetAngle = sameCasillaCount > 1 ? (sameCasillaIndex / sameCasillaCount) * Math.PI * 2 : 0;
                const offsetRadius = sameCasillaCount > 1 ? markerRadius * 0.9 : 0;
                const cx = point.x + Math.cos(offsetAngle) * offsetRadius;
                const cy = point.y + Math.sin(offsetAngle) * offsetRadius;
                
                const eventMarkerRadius = markerRadius * 0.55;
                return (
                  <g key={`event-${idx}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={eventMarkerRadius}
                      fill={event.exito ? 'rgba(144, 238, 144, 0.92)' : 'rgba(255, 120, 120, 0.92)'}
                      stroke={event.exito ? '#228B22' : '#8B0000'}
                      strokeWidth={lineWidth * 0.4}
                    />
                    <text
                      x={cx}
                      y={cy + eventMarkerRadius * 0.4}
                      fill={event.exito ? '#0a3a0a' : '#3a0a0a'}
                      fontSize={fontSize * 0.7}
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none' }}
                    >
                      {idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          
          {/* Legend - parchment style */}
          <div className="absolute bottom-2 left-2 bg-amber-50/90 border border-amber-900/30 rounded px-2 py-1 text-xs flex flex-wrap gap-3">
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
            {events && events.length > 0 && (
              <>
                <span className="flex items-center gap-1 text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-200 border border-green-600"></span>
                  Éxito
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <span className="w-2 h-2 rounded-full bg-red-200 border border-red-600"></span>
                  Fracaso
                </span>
              </>
            )}
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
    diaMes: 1,
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
  
  // Route comparison
  const [routeComparison, setRouteComparison] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
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
  
  // GM notes for AI narrative context (saved with each roll for later AI processing)
  const [gmNotesOrientation, setGmNotesOrientation] = useState('');
  const [gmNotesEvent, setGmNotesEvent] = useState('');
  
  // Final results
  const [fatigueResults, setFatigueResults] = useState([]);
  
  // PX Application state
  const [applyingPX, setApplyingPX] = useState(false);
  const [pxApplied, setPxApplied] = useState(false);
  const [pxResults, setPxResults] = useState(null);
  
  // Individual PX tracking per character based on their rolls
  // { characterId: { total: number, rolls: [{ type, cd, tirada, diff, px, terreno, tierras }] } }
  const [characterXP, setCharacterXP] = useState({});
  
  // Journey narrative state
  const [journeyNarrative, setJourneyNarrative] = useState(null);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  
  // Ref for the map container to capture for PDF
  const mapContainerRef = useRef(null);
  // Saved map image captured when route is calculated
  const [savedMapImage, setSavedMapImage] = useState(null);
  
  // Orientation check state (new system)
  const [orientationChecks, setOrientationChecks] = useState([]); // All orientation checks
  const [currentPosition, setCurrentPosition] = useState(0); // Current position in tiles
  const [nextEventPosition, setNextEventPosition] = useState(0); // Position of next event
  const [awaitingOrientationCheck, setAwaitingOrientationCheck] = useState(false);
  const [lastOrientationResult, setLastOrientationResult] = useState(null);
  
  // Journey Stages system (new)
  const [journeyStages, setJourneyStages] = useState([]); // Completed stages
  const [currentStage, setCurrentStage] = useState(1); // Current stage number
  const [stageDays, setStageDays] = useState(0); // Days in current stage
  const [stageEvents, setStageEvents] = useState([]); // Events in current stage
  const [stageFatigueDC, setStageFatigueDC] = useState(10); // Fatigue DC for current stage
  const [nearbyRefuges, setNearbyRefuges] = useState([]); // Refuges near current position
  
  // =============== PROVISIONS SYSTEM (Food/Water) ===============
  const [foodWaterItems, setFoodWaterItems] = useState({ food_items: [], water_items: [] });
  const [provisionsCheck, setProvisionsCheck] = useState(null); // Result of provisions check
  const [showProvisionsWarning, setShowProvisionsWarning] = useState(false);
  // Party provisions tracking during journey
  const [partyProvisions, setPartyProvisions] = useState({
    comidaTotal: 0, // Total food rations available
    aguaTotal: 0,   // Total liters of water
    comidaConsumida: 0,
    aguaConsumida: 0
  });
  // Fatigue from lack of provisions
  const [provisionFatigue, setProvisionFatigue] = useState({}); // { charId: { sinComida: days, sinAgua: days } }
  
  // Camp dialog state
  const [showCampDialog, setShowCampDialog] = useState(false);
  const [travelEvents, setTravelEvents] = useState([]);
  
  // Journey chronicle (single unified narrative) — lifted for PDF export
  const [journeyChronicle, setJourneyChronicle] = useState('');
  const [includeChronicleInPDF, setIncludeChronicleInPDF] = useState(true);
  
  // Provisions shop dialog
  const [showProvisionsShop, setShowProvisionsShop] = useState(false);
  
  // Journey automation (Point 7)
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0); // 0-100
  const [autoMessage, setAutoMessage] = useState('');
  const [autoSubtitle, setAutoSubtitle] = useState('');
  // Weather rolled for the entire journey at startGlobalJourney (Markov chain)
  const [journeyWeather, setJourneyWeather] = useState([]);
  const autoStopRef = useRef(false);
  
  // Refs to access latest state inside the async automation loop (avoid stale closures)
  const currentPositionRef = useRef(currentPosition);
  const currentEventRef = useRef(currentEvent);
  const charactersRef = useRef(characters);
  const modeRef = useRef('config');
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { currentEventRef.current = currentEvent; }, [currentEvent]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  // Sync mode to ref so async automation loop can see immediate changes
  useEffect(() => { modeRef.current = mode; }, [mode]);
  
  // =============== LOAD DATA ===============
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locRes, charRes, mountRes, rulesRes, landsRes, terrainsRes, foodWaterRes, eventsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/characters/'),
          api.get('/data/monturas'),
          api.get('/travel/config/rules'),
          api.get('/travel/config/land-types'),
          api.get('/travel/config/terrains'),
          api.get('/data/equipment-catalog/food-items'),
          api.get('/travel/config/events')
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
        setFoodWaterItems(foodWaterRes.data || { food_items: [], water_items: [] });
        setTravelEvents(eventsRes.data?.events || []);
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
          montura_velocidad: m.tieneMontura && m.monturaPropia ? (m.monturaPropia.velocidad || 60) : 0,
          montura_con_bonus: m.monturaConBonus || 0,
          velocidad_base: m.velocidadBase || 30,
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
  
  // Compare routes function
  const compareRoutes = useCallback(async () => {
    if (!config.origenId || !config.destinoId) {
      toast.error('Selecciona origen y destino');
      return;
    }
    
    setLoadingComparison(true);
    try {
      const res = await api.post('/travel/compare-routes', {
        origen_id: config.origenId,
        origen_nombre: config.origenNombre,
        destino_id: config.destinoId,
        destino_nombre: config.destinoNombre,
        evitar_sombra: config.evitarSombra || false,
        evitar_tierras_oscuras: config.evitarTierrasOscuras || false,
        ritmo: config.ritmo || 'normal'
      });
      
      if (res.data.success) {
        setRouteComparison(res.data);
        setShowComparison(true);
      } else {
        toast.error(res.data.message || 'Error al comparar rutas');
      }
    } catch (err) {
      console.error('Error comparing routes:', err);
      toast.error('Error al comparar rutas');
    } finally {
      setLoadingComparison(false);
    }
  }, [config]);
  
  // Manual trigger for journey calculation (call this when user clicks button)
  const triggerCalculateJourney = useCallback(async () => {
    if (!config.origenId || !config.destinoId) {
      toast.error('Selecciona origen y destino');
      return;
    }
    await calculateJourney();
  }, [config.origenId, config.destinoId, calculateJourney]);
  
  // =============== PROVISIONS CHECK ===============
  // Check if party has enough food and water for the journey
  const checkProvisionsForJourney = useCallback((diasViaje) => {
    if (!config.miembros.length || !diasViaje) return null;
    
    const numPersonajes = config.miembros.length;
    // Requirements: 1 ration/day per person, 2L water/day per person
    const comidaNecesaria = numPersonajes * diasViaje; // in rations
    const aguaNecesaria = numPersonajes * diasViaje * 2; // in liters
    
    // Calculate total provisions from party inventory
    // This would need to check each character's inventory
    let comidaDisponible = 0;
    let aguaDisponible = 0;
    
    // For each member, check their character's inventory for food/water items
    config.miembros.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      
      // Check inventory items against foodWaterItems
      char.inventario.forEach(item => {
        // Check if this item is marked as food
        const foodItem = foodWaterItems.food_items?.find(f => 
          f.nombre?.toLowerCase() === item.nombre?.toLowerCase()
        );
        if (foodItem) {
          const porcentaje = foodItem.porcentaje_racion || 100;
          const cantidad = item.cantidad || 1;
          comidaDisponible += (cantidad * porcentaje) / 100;
        }
        
        // Check if this item is marked as water
        const waterItem = foodWaterItems.water_items?.find(w => 
          w.nombre?.toLowerCase() === item.nombre?.toLowerCase()
        );
        if (waterItem) {
          const litros = waterItem.litros || 0;
          const cantidad = item.cantidad || 1;
          aguaDisponible += cantidad * litros;
        }
      });
    });
    
    return {
      comidaNecesaria,
      aguaNecesaria,
      comidaDisponible,
      aguaDisponible,
      comidaSuficiente: comidaDisponible >= comidaNecesaria,
      aguaSuficiente: aguaDisponible >= comidaNecesaria,
      diasComida: comidaDisponible / numPersonajes,
      diasAgua: aguaDisponible / (numPersonajes * 2),
      faltaComida: Math.max(0, comidaNecesaria - comidaDisponible),
      faltaAgua: Math.max(0, aguaNecesaria - aguaDisponible)
    };
  }, [config.miembros, characters, foodWaterItems]);
  
  // Check provisions when journey is calculated
  useEffect(() => {
    if (journeyCalc?.success && journeyCalc?.estimaciones?.dias_estimados) {
      const check = checkProvisionsForJourney(journeyCalc.estimaciones.dias_estimados);
      setProvisionsCheck(check);
      // Show warning if provisions are insufficient
      if (check && (!check.comidaSuficiente || !check.aguaSuficiente)) {
        setShowProvisionsWarning(true);
      }
    }
  }, [journeyCalc, checkProvisionsForJourney]);
  
  // =============== PX CALCULATION PER ROLL ===============
  // Formula: PX final = PX base × diferencia × terreno × peligrosidad
  // Limit: ±12 PX per roll
  
  const calculateRollXP = useCallback((cd, tirada, exito, terreno, tipoTierra, d20Nat) => {
    // TABLA 1 — PX base por CD (actualizada 2026-02-24)
    // CD 5-10: 0 PX | 11-14: 2 PX | 15-19: 5 PX | 20-24: 10 PX | 25+: 15 PX
    let pxBase = 0;
    if (cd >= 25) pxBase = 15;
    else if (cd >= 20) pxBase = 10;
    else if (cd >= 15) pxBase = 5;
    else if (cd >= 11) pxBase = 2;
    else pxBase = 0;
    
    const diferencia = tirada - cd;
    let pxFinal;
    
    if (exito) {
      pxFinal = pxBase;
    } else {
      // Fallo: no gana PX base (sólo restaría por pifia natural)
      pxFinal = 0;
    }
    
    // Modificadores especiales por tirada natural
    let critico = false;
    let pifia = false;
    if (d20Nat === 20) {
      critico = true;
      pxFinal += 20; // Crítico: +20 PX extra (se suma al base)
    } else if (d20Nat === 1) {
      pifia = true;
      pxFinal -= 10; // Pifia: -10 PX
    }
    
    // No hay multiplicadores de terreno/tierra individuales en la nueva tabla.
    // El ajuste global del viaje se aplica al final (calculateGroupMultiplier).
    
    return {
      pxBase,
      diferencia,
      pxFinal: Math.round(pxFinal),
      critico,
      pifia,
      // Mantener estos campos por compatibilidad con UI existente
      multDiferencia: 1,
      multTerreno: 1,
      multTierra: 1,
    };
  }, []);
  
  // TABLA 2 — Multiplicador global según aciertos/fallos del viaje
  const calculateGroupMultiplier = useCallback((aciertos, fallos) => {
    const total = aciertos + fallos;
    if (total === 0) return { multiplicador: 1, diferencia: 0, tendencia: 'equilibrado' };
    const diferencia = Math.abs(aciertos - fallos) / total * 100;
    const masAciertos = aciertos >= fallos;
    let multiplicador = 1;
    let tendencia = 'equilibrado';
    if (diferencia <= 20) {
      multiplicador = 1.0;
      tendencia = 'equilibrado';
    } else if (diferencia <= 40) {
      multiplicador = masAciertos ? 1.3 : 0.7;
      tendencia = masAciertos ? 'aciertos_moderados' : 'fallos_moderados';
    } else {
      multiplicador = masAciertos ? 1.6 : 0.4;
      tendencia = masAciertos ? 'aciertos_fuertes' : 'fallos_fuertes';
    }
    return { multiplicador, diferencia: Math.round(diferencia * 10) / 10, tendencia };
  }, []);
  
  // Add XP to a character
  const addCharacterXP = useCallback((characterId, rollData) => {
    setCharacterXP(prev => {
      const charData = prev[characterId] || { total: 0, rolls: [] };
      return {
        ...prev,
        [characterId]: {
          total: charData.total + rollData.pxFinal,
          rolls: [...charData.rolls, rollData]
        }
      };
    });
  }, []);

  // =============== START JOURNEY ===============
  
  const startGlobalJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    const guia = config.miembros.find(m => m.papeles?.includes('guia'));
    if (!guia) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }
    
    setMode('global');
    setEvents([]);
    setOrientationChecks([]);
    setCurrentPosition(0);
    setNextEventPosition(0);
    setLastOrientationResult(null);
    setCharacterXP({}); // Reset individual XP tracking
    
    // Roll weather chain for the entire journey so narrative endpoints can look up
    // the climate for each event/day later. (Markov chain, region per day.)
    try {
      const numDays = Math.max(1, Math.ceil(journeyCalc?.estimaciones?.dias_estimados || journeyCalc?.ruta?.casillas || 7));
      const origRegion = (locations || []).find(l => l.id === config.origenId)?.region || '';
      const destRegion = (locations || []).find(l => l.id === config.destinoId)?.region || '';
      const regionsByDay = [];
      for (let i = 0; i < numDays; i++) {
        const ratio = numDays > 1 ? i / (numDays - 1) : 0;
        regionsByDay.push(ratio < 0.5 ? origRegion : destRegion);
      }
      const wRes = await api.post('/weather/simulate', {
        mes: config.mes,
        dia_inicio: config.diaMes || 1,
        num_dias: numDays,
        regiones_por_dia: regionsByDay,
      });
      setJourneyWeather(wRes.data?.dias || []);
    } catch (err) {
      console.warn('No se pudo rodar el clima del viaje al inicio:', err);
      setJourneyWeather([]);
    }
    
    // Check if guide has multiple roles (penalty -5)
    const guiaTieneMultiplesRoles = guia.papeles && guia.papeles.length > 1;
    
    // Start with first orientation check
    setAwaitingOrientationCheck(true);
    toast.info(`El Guía (${guia.nombre}) debe realizar la primera tirada de Orientación`);
  };
  
  // Perform orientation check
  const performOrientationCheck = async () => {
    const guia = config.miembros.find(m => m.papeles?.includes('guia'));
    if (!guia) return;
    
    const casillasRestantes = journeyCalc.ruta.casillas - currentPosition;
    const guiaTieneMultiplesRoles = guia.papeles && guia.papeles.length > 1;
    
    try {
      const res = await api.post('/travel/orientation-check', {
        // Use the pre-calculated modifier which includes competencia + pericia
        modificador_sabiduria: guia.modViajar || guia.modSabiduria || 0,
        competencia_viajar: guia.competenciaViajar || false,
        competencia_cartografia: guia.competenciaCartografia || false,
        competencia_navegacion: false,
        tiene_mapa: true,
        viaje_maritimo: false,
        penalizacion_multiples_papeles: guiaTieneMultiplesRoles,
        // Bonus competencia is now included in modViajar, so set to 0 to avoid double counting
        bonus_competencia: 0
      }, {
        params: { casillas_restantes: casillasRestantes }
      });
      
      if (res.data.success) {
        const result = res.data;
        
        // Calculate XP for the Guide's orientation check
        // CD for orientation is always 15, exito is tirada >= CD
        const orientationCD = 15;
        const exito = result.total >= orientationCD;
        const xpResult = calculateRollXP(
          orientationCD,
          result.total,
          exito,
          journeyCalc?.ruta?.terreno || 'moderado',
          journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
          result.d20
        );
        
        const enrichedResult = { ...result, xpResult, guiaId: guia.id, guiaNombre: guia.nombre, gm_notes: gmNotesOrientation };
        setLastOrientationResult(enrichedResult);
        setOrientationChecks(prev => [...prev, {
          ...enrichedResult,
          casilla_actual: currentPosition,
          casillas_restantes: casillasRestantes
        }]);
        
        // Clear GM notes for next roll
        setGmNotesOrientation('');
        
        // Add XP to guide
        addCharacterXP(guia.id, {
          type: 'orientacion',
          cd: orientationCD,
          tirada: result.total,
          exito: exito,
          ...xpResult,
          casilla: currentPosition
        });
        
        if (result.viaje_completado) {
          // Journey is complete!
          toast.success(result.detalle);
          setAwaitingOrientationCheck(false);
          // Move to results - calculate fatigue first
          await calculateFatigueResults(events);
          setMode('results');
        } else {
          // Calculate next event position
          const nuevaPosicionEvento = currentPosition + result.casillas_hasta_evento;
          setNextEventPosition(nuevaPosicionEvento);
          
          // Generate the event at that position
          await generateEventAtPosition(nuevaPosicionEvento, result);
        }
      }
    } catch (err) {
      console.error('Error in orientation check:', err);
      toast.error('Error al realizar la tirada de orientación');
    }
  };
  
  // Generate event at a specific position
  const generateEventAtPosition = async (posicion, orientationResult) => {
    try {
      const eventRes = await api.post('/travel/generate-event', null, {
        params: {
          tipo_tierra: journeyCalc.ruta.tipo_tierra,
          terreno: journeyCalc.ruta.terreno,
          estacion: config.estacion
        }
      });
      
      if (eventRes.data.success) {
        const newEvent = {
          ...eventRes.data,
          casilla: posicion,
          resuelto: false,
          resultado: null,
          orientacion: orientationResult // Link to the orientation check
        };
        
        setEvents(prev => [...prev, newEvent]);
        setCurrentEvent(newEvent);
        setAwaitingOrientationCheck(false);
        
        toast.info(`¡Acontecimiento en la casilla ${posicion}! (${orientationResult.detalle})`);
      }
    } catch (err) {
      console.error('Error generating event:', err);
      toast.error('Error al generar acontecimiento');
    }
  };
  
  // Check if there's a refuge nearby on the route (using calculated route data)
  const checkForNearbyRefuge = useCallback((positionInTiles) => {
    // Use refuges from the calculated route instead of hardcoded list
    const refugiosEnRuta = journeyCalc?.ruta?.refugios_en_ruta || [];
    
    if (refugiosEnRuta.length === 0) {
      return [];
    }
    
    // Find refuges within 2 tiles of current position
    return refugiosEnRuta.filter(r => {
      const distancia = Math.abs(r.casilla - positionInTiles);
      return distancia <= 2;
    });
  }, [journeyCalc?.ruta?.refugios_en_ruta]);
  
  // =============== DAILY CONSUMPTION ===============
  // Consume food and water for each party member, apply fatigue if supplies run out
  const consumeDailyProvisions = useCallback(() => {
    const numPersonajes = config.miembros.length;
    const comidaConsumidaHoy = numPersonajes; // 1 ration per person
    const aguaConsumidaHoy = numPersonajes * 2; // 2L per person
    
    setPartyProvisions(prev => {
      const nuevaComidaDisponible = prev.comidaTotal - prev.comidaConsumida - comidaConsumidaHoy;
      const nuevaAguaDisponible = prev.aguaTotal - prev.aguaConsumida - aguaConsumidaHoy;
      
      // Track provision fatigue per character
      const newProvisionFatigue = { ...provisionFatigue };
      
      config.miembros.forEach(miembro => {
        if (!newProvisionFatigue[miembro.id]) {
          newProvisionFatigue[miembro.id] = { sinComida: 0, sinAgua: 0 };
        }
        
        // If no food available, increment days without food
        if (nuevaComidaDisponible < 0) {
          newProvisionFatigue[miembro.id].sinComida += 1;
        }
        
        // If no water available, increment days without water
        if (nuevaAguaDisponible < 0) {
          newProvisionFatigue[miembro.id].sinAgua += 1;
        }
      });
      
      setProvisionFatigue(newProvisionFatigue);
      
      // Show warnings if running low
      if (nuevaComidaDisponible < numPersonajes && nuevaComidaDisponible >= 0) {
        toast.warning(`¡Comida escasa! Queda para ${Math.floor(nuevaComidaDisponible / numPersonajes)} día(s).`);
      } else if (nuevaComidaDisponible < 0) {
        toast.error(`¡Sin comida! +1 nivel de fatiga para cada miembro.`);
      }
      
      if (nuevaAguaDisponible < numPersonajes * 2 && nuevaAguaDisponible >= 0) {
        toast.warning(`¡Agua escasa! Queda para ${Math.floor(nuevaAguaDisponible / (numPersonajes * 2))} día(s).`);
      } else if (nuevaAguaDisponible < 0) {
        toast.error(`¡Sin agua! +2 niveles de fatiga para cada miembro.`);
      }
      
      return {
        ...prev,
        comidaConsumida: prev.comidaConsumida + comidaConsumidaHoy,
        aguaConsumida: prev.aguaConsumida + aguaConsumidaHoy
      };
    });
  }, [config.miembros, provisionFatigue]);
  
  // Refill water near towns/rivers
  const refillWaterNearTown = useCallback((townName) => {
    const numPersonajes = config.miembros.length;
    const aguaNecesaria = numPersonajes * 2 * 3; // 3 days of water
    
    setPartyProvisions(prev => ({
      ...prev,
      aguaTotal: prev.aguaTotal + aguaNecesaria,
    }));
    
    toast.success(`Agua rellenada cerca de ${townName}. +${aguaNecesaria}L disponibles.`);
  }, [config.miembros]);
  
  // Foraging action - costs time, success depends on Survival check
  const performForaging = useCallback(async (characterId) => {
    const char = config.miembros.find(m => m.id === characterId);
    if (!char) return;
    
    // Roll d20 + Wisdom modifier + proficiency if applicable
    const d20 = Math.floor(Math.random() * 20) + 1;
    const modifier = char.modSabiduria || 0;
    const total = d20 + modifier;
    const cd = 15; // Survival DC for foraging
    const exito = total >= cd;
    
    if (exito) {
      // Success: find 1d4 rations and 1d4 liters of water
      const comidaEncontrada = Math.floor(Math.random() * 4) + 1;
      const aguaEncontrada = Math.floor(Math.random() * 4) + 1;
      
      setPartyProvisions(prev => ({
        ...prev,
        comidaTotal: prev.comidaTotal + comidaEncontrada,
        aguaTotal: prev.aguaTotal + aguaEncontrada
      }));
      
      toast.success(`¡${char.nombre} encontró ${comidaEncontrada} raciones y ${aguaEncontrada}L de agua! (Tirada: ${total} vs CD ${cd})`);
    } else {
      toast.error(`${char.nombre} no encontró nada comestible. (Tirada: ${total} vs CD ${cd})`);
    }
    
    // Foraging takes time - add 1 to stage days
    setStageDays(prev => prev + 1);
    
    return { exito, tirada: total, cd };
  }, [config.miembros]);
  
  // =============== REST SYSTEM ===============
  // Types of rest and their effects on fatigue
  const REST_TYPES = {
    short: {
      nombre: 'Descanso Corto',
      duracion: '1 hora',
      efecto: 'Recupera uso de habilidades (según clase)',
      fatiga: 0, // No fatigue reduction
      sinFatiga: false
    },
    long: {
      nombre: 'Descanso Largo',
      duracion: '8 horas',
      efecto: '-1 nivel de fatiga (con tirada CON exitosa)',
      fatiga: -1,
      sinFatiga: false,
      requiereTiradaCON: true,
      cdBase: 10
    },
    sanctuary: {
      nombre: 'Descanso en Santuario',
      duracion: '1+ días',
      efecto: 'Elimina toda la fatiga sin tirada',
      fatiga: 'all',
      sinFatiga: true
    }
  };
  
  // State for rest dialog
  const [showRestDialog, setShowRestDialog] = useState(false);
  const [selectedRestType, setSelectedRestType] = useState('long');
  const [restResults, setRestResults] = useState(null);
  
  // Perform rest action
  const performRest = useCallback(async (restType = 'long') => {
    const restConfig = REST_TYPES[restType];
    const results = [];
    
    for (const miembro of config.miembros) {
      const char = characters.find(c => c.id === miembro.id);
      if (!char) continue;
      
      let result = {
        nombre: miembro.nombre,
        tipoDescanso: restConfig.nombre,
        fatigaAntes: char.fatiga || 0,
        fatigaDespues: char.fatiga || 0,
        tirada: null,
        cd: null,
        exito: true
      };
      
      if (restType === 'sanctuary') {
        // Sanctuary rest removes all fatigue without roll
        result.fatigaDespues = 0;
        result.exito = true;
        
        // Update character fatigue in database
        try {
          await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: 0 });
          setCharacters(prev => prev.map(c => c.id === miembro.id ? { ...c, fatiga: 0 } : c));
        } catch (err) {
          console.error('Error updating fatigue:', err);
        }
      } else if (restType === 'long' && restConfig.requiereTiradaCON) {
        // Long rest requires CON check
        const modCON = char.atributos?.constitucion 
          ? Math.floor((char.atributos.constitucion - 10) / 2) 
          : 0;
        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + modCON;
        const cd = restConfig.cdBase + (provisionFatigue[miembro.id]?.sinComida || 0) + (provisionFatigue[miembro.id]?.sinAgua || 0) * 2;
        
        result.tirada = total;
        result.cd = cd;
        result.exito = total >= cd;
        
        if (result.exito) {
          result.fatigaDespues = Math.max(0, (char.fatiga || 0) - 1);
          try {
            await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: result.fatigaDespues });
            setCharacters(prev => prev.map(c => c.id === miembro.id ? { ...c, fatiga: result.fatigaDespues } : c));
          } catch (err) {
            console.error('Error updating fatigue:', err);
          }
        }
      }
      
      results.push(result);
    }
    
    setRestResults(results);
    
    // If resting for long/sanctuary, add time
    if (restType === 'long') {
      setStageDays(prev => prev + 1);
    } else if (restType === 'sanctuary') {
      // Sanctuary rest ends the current stage
      await handleRestAtRefuge({ nombre: 'Santuario' });
    }
    
    // Reset provision fatigue tracking after rest
    if (restType === 'sanctuary' || restType === 'long') {
      setProvisionFatigue({});
    }
    
    return results;
  }, [config.miembros, characters, provisionFatigue]);
  
  // Check if near a water source to refill
  const checkWaterRefill = useCallback((positionInTiles) => {
    // Check refuges near current position for water refill
    const refugiosEnRuta = journeyCalc?.ruta?.refugios_en_ruta || [];
    const nearbyRefuge = refugiosEnRuta.find(r => Math.abs(r.casilla - positionInTiles) <= 1);
    
    if (nearbyRefuge) {
      refillWaterNearTown(nearbyRefuge.nombre);
      return true;
    }
    return false;
  }, [journeyCalc?.ruta?.refugios_en_ruta, refillWaterNearTown]);

  // After resolving an event, continue with next orientation check
  const continueAfterEvent = async (updatedEvents = null) => {
    // Update current position to event position
    setCurrentPosition(nextEventPosition);
    setStageDays(prev => prev + 1);
    
    // *** CONSUME DAILY PROVISIONS ***
    consumeDailyProvisions();
    
    // Use passed events or fall back to state (for direct calls)
    const currentEvents = updatedEvents || events;
    
    // Safety check for journeyCalc
    const totalCasillas = journeyCalc?.ruta?.casillas || 0;
    const casillasRestantes = totalCasillas - nextEventPosition;
    
    // Check for nearby refuges
    const refuges = checkForNearbyRefuge(nextEventPosition);
    setNearbyRefuges(refuges);
    
    // Check if we should end the current stage
    const shouldEndStage = 
      stageDays >= 7 || // 7+ days in this stage
      refuges.length > 0 || // Refuge nearby
      casillasRestantes <= 0; // Journey complete
    
    if (casillasRestantes <= 0) {
      // Journey complete - final fatigue check for this stage
      toast.success('¡La compañía ha llegado a su destino!');
      
      // Save current stage
      setJourneyStages(prev => [...prev, {
        numero: currentStage,
        dias: stageDays,
        eventos: [...stageEvents],
        fatigueDC: stageFatigueDC,
        completado: true
      }]);
      
      await calculateFatigueResults(currentEvents);
      setMode('results');
    } else if (shouldEndStage && refuges.length > 0) {
      // Refuge available - offer to rest
      toast.info(`¡Refugio cercano: ${refuges.map(r => r.nombre).join(', ')}! Puedes descansar aquí.`, {
        duration: 5000,
        action: {
          label: 'Descansar',
          onClick: () => handleRestAtRefuge(refuges[0])
        }
      });
      
      // Still continue with orientation check, but show refuge option
      setAwaitingOrientationCheck(true);
      setCurrentEvent(null);
    } else if (stageDays >= 10) {
      // Force stage end after 10 days - fatigue check required
      toast.warning('Han pasado 10 días. Es necesario realizar la tirada de Fatiga de esta etapa.');
      await handleEndStage();
    } else {
      // Continue journey
      setAwaitingOrientationCheck(true);
      setCurrentEvent(null);
      toast.info(`Quedan ${casillasRestantes} casillas (día ${stageDays} de la etapa ${currentStage}).`);
    }
  };
  
  // Handle resting at a refuge
  const handleRestAtRefuge = async (refuge) => {
    // Calculate fatigue for current stage
    await calculateStageFatigue();
    
    // Save completed stage
    setJourneyStages(prev => [...prev, {
      numero: currentStage,
      dias: stageDays,
      eventos: [...stageEvents],
      fatigueDC: stageFatigueDC,
      refugio: refuge.nombre,
      completado: true
    }]);
    
    // Reset for new stage
    setCurrentStage(prev => prev + 1);
    setStageDays(0);
    setStageEvents([]);
    setStageFatigueDC(10);
    
    toast.success(`Descanso en ${refuge.nombre}. La fatiga acumulada se reinicia. Nueva etapa comenzada.`);
    setAwaitingOrientationCheck(true);
  };
  
  // Handle ending a stage (for fatigue calculation)
  const handleEndStage = async () => {
    await calculateStageFatigue();
    
    setJourneyStages(prev => [...prev, {
      numero: currentStage,
      dias: stageDays,
      eventos: [...stageEvents],
      fatigueDC: stageFatigueDC,
      completado: true
    }]);
    
    // Start new stage
    setCurrentStage(prev => prev + 1);
    setStageDays(0);
    setStageEvents([]);
    setStageFatigueDC(10);
    
    setAwaitingOrientationCheck(true);
  };
  
  // Calculate fatigue for current stage only
  const calculateStageFatigue = async () => {
    // Calculate CD based on stage events
    let cd = 10 + stageDays; // Base + days
    stageEvents.forEach(e => {
      if (!e.exito) cd += 2; // Failed events add to fatigue
    });
    
    // Apply marcha forzada if used
    if (config.horasMarchaForzada > 0) {
      cd += config.horasMarchaForzada * 2;
    }
    
    setStageFatigueDC(cd);
    // Note: Actual fatigue rolls happen in calculateFatigueResults
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
    
    // *** INITIALIZE PROVISIONS ***
    // Calculate initial provisions from party inventory
    let comidaInicial = 0;
    let aguaInicial = 0;
    
    config.miembros.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      
      char.inventario.forEach(item => {
        const foodItem = foodWaterItems.food_items?.find(f => 
          f.nombre?.toLowerCase() === item.nombre?.toLowerCase()
        );
        if (foodItem) {
          const porcentaje = foodItem.porcentaje_racion || 100;
          const cantidad = item.cantidad || 1;
          comidaInicial += (cantidad * porcentaje) / 100;
        }
        
        const waterItem = foodWaterItems.water_items?.find(w => 
          w.nombre?.toLowerCase() === item.nombre?.toLowerCase()
        );
        if (waterItem) {
          const litros = waterItem.litros || 0;
          const cantidad = item.cantidad || 1;
          aguaInicial += cantidad * litros;
        }
      });
    });
    
    setPartyProvisions({
      comidaTotal: comidaInicial,
      aguaTotal: aguaInicial,
      comidaConsumida: 0,
      aguaConsumida: 0
    });
    
    // Reset provision fatigue tracking
    setProvisionFatigue({});
    
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
  
  // Map travel role → precomputed member skill modifier key
  const ROLE_MODIFIER_KEY = {
    guia: 'modViajar',
    cazador: 'modCaza',
    vigia: 'modPercepcion',
    explorador: 'modExplorar',
  };

  // Get the modifier + breakdown for a given target role using precomputed member values
  const getRoleModifier = (targetRole) => {
    const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
    const roleInfo = ROLE_INFO[targetRole];
    if (!targetMember || !roleInfo) {
      return { modifier: 0, breakdown: [], member: null, roleInfo };
    }
    const key = ROLE_MODIFIER_KEY[targetRole];
    const baseMod = (key && typeof targetMember[key] === 'number') ? targetMember[key] : (targetMember.modSabiduria || 0);
    const hasMultipleRoles = targetMember.papeles?.length > 1;
    const modifier = baseMod + (hasMultipleRoles ? MULTI_ROLE_PENALTY : 0);
    const breakdown = [
      `${roleInfo.habilidad} (${roleInfo.atributo_nombre.slice(0, 3)}): ${baseMod >= 0 ? '+' : ''}${baseMod}`,
    ];
    if (hasMultipleRoles) breakdown.push(`Múltiples papeles: ${MULTI_ROLE_PENALTY}`);
    return { modifier, breakdown, member: targetMember, roleInfo };
  };

  // Roll dice for event resolution
  const rollEventDice = () => {
    if (!currentEvent) return;
    const targetRole = currentEvent.objetivo.papel;
    const { modifier, member, roleInfo } = getRoleModifier(targetRole);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;
    setEventDiceRoll({
      d20,
      modifier,
      total,
      modifierSource: roleInfo?.habilidad || 'Sabiduría',
      targetMemberId: member?.id,
    });
  };
  
  // Clear dice roll + GM notes when event changes
  useEffect(() => {
    setEventDiceRoll(null);
    setGmNotesEvent('');
  }, [currentEvent]);
  
  const resolveCurrentEvent = async (tirada) => {
    if (!currentEvent) return;
    
    setResolvingEvent(true);
    
    // Find the character with the target role
    const targetRole = currentEvent.objetivo.papel;
    const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
    
    const cd = currentEvent.resolucion.cd;
    const exito = tirada >= cd;
    
    // Calculate XP for the character resolving the event
    if (targetMember) {
      const xpResult = calculateRollXP(
        cd,
        tirada,
        exito,
        journeyCalc?.ruta?.terreno || 'moderado',
        journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
        eventDiceRoll?.d20
      );
      
      addCharacterXP(targetMember.id, {
        type: 'evento',
        eventoNombre: currentEvent.evento.nombre,
        cd: cd,
        tirada: tirada,
        exito: exito,
        ...xpResult,
        casilla: currentEvent.casilla
      });
    }
    
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
        // Calculate event position in journey
        const resolvedEvents = events.filter(e => e.resuelto).length;
        const totalEvents = events.length;
        
        // Look up the climate for the day where this event is happening
        const eventDay = Math.max(1, currentEvent.casilla || 1);
        const wDay = journeyWeather[Math.min(eventDay - 1, journeyWeather.length - 1)];
        const climaTxt = wDay
          ? `${wDay.estado_label}${wDay.region ? ' en ' + wDay.region : ''}`
          : '';
        
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
            terreno: journeyCalc?.ruta?.terreno || 'campo_abierto',
            evento_numero: resolvedEvents + 1,
            total_eventos: totalEvents,
            dia_actual: currentEvent.casilla || 1,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            notas_maestro: gmNotesEvent || '',
            clima: climaTxt,
          }
        });
        if (narrativeRes.data.success) {
          narrativa = narrativeRes.data.narrative;
        }
      } catch (err) {
        console.log('Narrative generation skipped:', err);
      }
      
      // Capture the weather snapshot for this event's day
      const eventDayN = Math.max(1, currentEvent.casilla || 1);
      const eventWeather = journeyWeather[Math.min(eventDayN - 1, journeyWeather.length - 1)] || null;
      
      // Update event with result
      const updatedEvents = events.map(e => {
        if (e === currentEvent) {
          return {
            ...e,
            resuelto: true,
            resultado: res.data,
            tirada: tirada,
            exito: exito,
            narrativa: narrativa,
            gm_notes: gmNotesEvent || '',
            clima_dia: eventWeather,
          };
        }
        return e;
      });
      
      setEvents(updatedEvents);
      
      // In the new orientation system, after resolving an event we continue journey
      // No longer looking for "next unresolved" since events are generated one by one
      setCurrentEvent(null);
      
      // Continue with next orientation check - pass updated events explicitly
      // because React state may not be updated yet due to batching
      await continueAfterEvent(updatedEvents);
      
    } catch (err) {
      console.error('Error resolving event:', err);
      toast.error('Error al resolver acontecimiento');
    } finally {
      setResolvingEvent(false);
    }
  };
  
  // =============== JOURNEY AUTOMATION (Point 7) ===============
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  
  const automateJourney = async () => {
    if (autoRunning) {
      // Stop if already running
      autoStopRef.current = true;
      return;
    }
    setAutoRunning(true);
    autoStopRef.current = false;
    setAutoProgress(0);
    setAutoMessage('Iniciando automatización del viaje…');
    setAutoSubtitle('');

    const totalCasillas = journeyCalc?.ruta?.casillas || 1;
    // Hard upper bound: each casilla can spawn at most one event + one orientation,
    // plus some margin for camp/refuge insertions. casillas*3 + 5 is plenty.
    const maxIterations = Math.min(200, totalCasillas * 3 + 10);
    let iterations = 0;
    let prevPosition = currentPositionRef.current;
    let stuckCounter = 0;
    const eventsBefore = events.filter(e => e.resuelto).length;

    try {
      while (iterations < maxIterations && !autoStopRef.current) {
        iterations++;

        // ── EXIT 1: mode switched to results (journey completed via state update) ──
        if (modeRef.current === 'results') {
          setAutoProgress(100);
          break;
        }

        // ── Update progress (driven by current casilla position) ──
        const pos = currentPositionRef.current;
        const pct = Math.min(99, Math.round((pos / totalCasillas) * 100));
        setAutoProgress(pct);

        // Safety: any character at fatigue >= 5 → pause
        const dangerPj = config.miembros.find(m => {
          const c = charactersRef.current?.find(ch => ch.id === m.id);
          return (c?.fatiga || 0) >= 5;
        });
        if (dangerPj) {
          setAutoMessage('⚠️ Automatización pausada');
          setAutoSubtitle(`${dangerPj.nombre} ha alcanzado fatiga 5 (al borde de la muerte). Decide manualmente cómo continuar.`);
          await sleep(2500);
          toast.error(`⚠️ PAUSA: ${dangerPj.nombre} alcanzó fatiga 5.`, { duration: 8000 });
          break;
        }

        // ── EXIT 2: journey reached destination (position covered all casillas) ──
        if (pos >= totalCasillas) {
          setAutoMessage('Llegando al destino…');
          setAutoSubtitle('Compilando crónica del viaje');
          // Try to gracefully transition to results if mode hasn't changed yet
          if (modeRef.current !== 'results') {
            try {
              await calculateFatigueResults(events);
            } catch { /* non-blocking */ }
            setMode('results');
          }
          setAutoProgress(100);
          await sleep(800);
          break;
        }

        // ── Detect stuck state (position not advancing) ──
        if (pos === prevPosition) {
          stuckCounter++;
          if (stuckCounter >= 8) {
            // After 8 iterations without progress, abort
            setAutoMessage('Atasco detectado');
            setAutoSubtitle(`Tras ${stuckCounter} intentos sin avance, interrumpo la automatización.`);
            await sleep(2000);
            toast.error('⚠️ Automatización interrumpida: el viaje no avanza. Continúa manualmente.', { duration: 8000 });
            break;
          }
        } else {
          stuckCounter = 0;
          prevPosition = pos;
        }

        // ── Resolve a pending event ──
        if (currentEventRef.current && !currentEventRef.current.resuelto) {
          const ev = currentEventRef.current;
          setAutoMessage(`Resolviendo "${ev.evento?.nombre || 'acontecimiento'}"`);
          setAutoSubtitle(`Casilla ${ev.casilla || pos} · objetivo: ${ev.objetivo?.papel || '?'}`);
          const tr = ev.objetivo?.papel;
          const mod = tr ? getRoleModifier(tr).modifier : 0;
          const d20 = Math.floor(Math.random() * 20) + 1;
          const total = d20 + mod;
          try {
            await resolveCurrentEvent(total);
          } catch (e) {
            console.error('Error resolving event in auto:', e);
            // Skip this event and break to avoid infinite loop
            break;
          }
          await sleep(250);
          continue;
        }

        // ── Otherwise, do an orientation check ──
        setAutoMessage(`Tirada de orientación`);
        setAutoSubtitle(`Casilla ${pos} de ${totalCasillas}`);
        try {
          await performOrientationCheck();
        } catch (e) {
          console.error('Error in orientation in auto:', e);
          break;
        }
        await sleep(300);
      }

      // ── Final wrap-up ──
      const eventsAfter = events.filter(e => e.resuelto).length;
      const eventsProcessed = Math.max(0, eventsAfter - eventsBefore);

      if (modeRef.current === 'results') {
        toast.success(`Viaje automatizado: ${eventsProcessed} eventos resueltos en ${currentPositionRef.current} casillas.`);
      } else if (iterations >= maxIterations) {
        setAutoSubtitle('Límite de iteraciones alcanzado');
        await sleep(1500);
        toast.warning(`Automatización detenida tras ${iterations} iteraciones. Continúa manualmente.`);
      }
    } finally {
      setAutoRunning(false);
      autoStopRef.current = false;
      // Tiny delay so the user sees 100% before the overlay disappears
      setTimeout(() => {
        setAutoProgress(0);
        setAutoMessage('');
        setAutoSubtitle('');
      }, 600);
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

  // CD base de Fatiga según terreno (reglas LOTR 5e):
  //   camino/fácil/moderado → 10
  //   campo abierto/colinas/bosque → 15
  //   terreno difícil/montañas/pantano/desalentador/muy_dificil → 20
  const getFatigueBaseCD = (terrain) => {
    const t = (terrain || '').toLowerCase();
    if (['muy_dificil', 'desalentador', 'montanas', 'pantano', 'pantanos', 'dificil'].includes(t)) return 20;
    if (['facil', 'camino', 'caminos'].includes(t)) return 10;
    // campo abierto, colinas, bosque, moderado → 15
    return 15;
  };

  const calculateFatigueResults = async (resolvedEvents) => {
    const results = [];
    
    // CD base por terreno del viaje actual
    const terrenoViaje = journeyCalc?.ruta?.terreno || 'moderado';
    let fatigueCd = getFatigueBaseCD(terrenoViaje);
    
    // Sumar modificadores acumulados de los eventos (terrible desgracia +3, desesperanza +2, etc.)
    resolvedEvents.forEach(e => {
      if (e.resultado?.modificadores?.fatiga_cd_increase) {
        fatigueCd += e.resultado.modificadores.fatiga_cd_increase;
      } else if (e.evento?.fatigue_cd_increase) {
        // Algunos eventos guardan el modificador directamente en el objeto evento
        fatigueCd += e.evento.fatigue_cd_increase;
      }
    });
    
    // Tirada individual de CON por cada miembro (regla: fallo = +1 nivel exacto)
    for (const member of config.miembros) {
      const char = characters.find(c => c.id === member.id);
      if (!char) continue;
      
      const conMod = Math.floor(((char.atributos?.constitucion || 10) - 10) / 2);
      const mountBonus = member.tieneMontura ? (member.monturaConBonus || 0) : 0;
      const tieneMultiplesPapeles = (member.papeles?.length || 0) > 1;
      
      try {
        const res = await api.post('/travel/fatigue-save', null, {
          params: {
            personaje_nombre: member.nombre,
            modificador_constitucion: conMod,
            cd_acumulada: fatigueCd,
            dias_con_montura: member.tieneMontura ? journeyCalc?.estimaciones?.dias_estimados || 1 : 0,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            bonus_montura_con: mountBonus,
            penalizacion_multiples_papeles: tieneMultiplesPapeles
          }
        });
        
        // Aplicar el nivel al personaje en BD y en estado local
        const nivelesGanados = res.data.niveles_cansancio || 0;
        if (nivelesGanados > 0) {
          const fatigaActual = Number(char.fatiga || 0);
          const nuevaFatiga = Math.min(6, fatigaActual + nivelesGanados);
          try {
            await api.put(`/characters/${member.id}/fatigue`, { fatiga: nuevaFatiga });
            setCharacters(prev => prev.map(c => c.id === member.id ? { ...c, fatiga: nuevaFatiga } : c));
          } catch (e) {
            console.error('Error aplicando fatiga al personaje:', e);
          }
        }
        
        results.push({
          personaje: member.nombre,
          papel: member.papeles?.join(', ') || '',
          cd_base: getFatigueBaseCD(terrenoViaje),
          ...res.data
        });
      } catch (err) {
        console.error('Error calculating fatigue:', err);
      }
    }
    
    setFatigueResults(results);
  };
  
  // =============== MEMBER MANAGEMENT ===============
  
  // Helper to calculate proficiency bonus based on level
  const calcBonusCompetencia = (nivel) => {
    if (nivel >= 17) return 6;
    if (nivel >= 13) return 5;
    if (nivel >= 9) return 4;
    if (nivel >= 5) return 3;
    return 2;
  };
  
  // Helper to check if character has proficiency in a skill
  const tieneCompetenciaEn = (char, habilidad) => {
    // Check in habilidades_competencia (e.g., ['Viajar (Sab)', 'Percepción (Sab)'])
    const competencias = char.habilidades_competencia || char.habilidades || [];
    const normalizedSkill = habilidad.toLowerCase();
    return competencias.some(h => h.toLowerCase().includes(normalizedSkill));
  };
  
  // Helper to check if character has expertise (pericia) in a skill
  const tienePericia = (char, habilidad) => {
    // Check in pericia_elegida (e.g., ['Percepción', 'Viajar'])
    const pericias = char.pericia_elegida || [];
    const normalizedSkill = habilidad.toLowerCase();
    return pericias.some(p => p.toLowerCase().includes(normalizedSkill));
  };
  
  // Get attribute modifier
  const getModAtributo = (char, atributo) => {
    const valor = char.atributos?.[atributo] || 10;
    return Math.floor((valor - 10) / 2);
  };
  
  // Map skill names to their governing attribute
  const SKILL_ATTRIBUTES = {
    'viajar': 'sabiduria',
    'percepción': 'sabiduria',
    'percepcion': 'sabiduria',
    'cazar': 'sabiduria',
    'explorar': 'sabiduria',  // Note: In the character sheet it shows Explorar (Sab)
    'sigilo': 'destreza',
    'acrobacias': 'destreza',
    'atletismo': 'fuerza',
    'perspicacia': 'sabiduria',
  };
  
  // Calculate skill modifier: attribute_mod + (competencia ? bonus : 0) + (pericia ? bonus : 0)
  const calcModHabilidad = (char, habilidad) => {
    const nivel = char.nivel || 1;
    const bonusCompetencia = calcBonusCompetencia(nivel);
    
    // Get governing attribute
    const atributo = SKILL_ATTRIBUTES[habilidad.toLowerCase()] || 'sabiduria';
    const modAtributo = getModAtributo(char, atributo);
    
    let mod = modAtributo;
    
    // Add proficiency bonus if competent
    if (tieneCompetenciaEn(char, habilidad)) {
      mod += bonusCompetencia;
    }
    
    // Add another proficiency bonus if has expertise (pericia = x2)
    if (tienePericia(char, habilidad)) {
      mod += bonusCompetencia;
    }
    
    return mod;
  };
  
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
      velocidad: char.montura.velocidad || 18,
      constitucion: char.montura.constitucion
    } : null;
    
    // Character base speed in METERS
    const velocidadBase = char.velocidad || 9;
    
    // Calculate skill modifiers for travel roles using correct skill names
    const nivel = char.nivel || 1;
    const bonusCompetencia = calcBonusCompetencia(nivel);
    
    // Use calcModHabilidad with correct skill names
    const modViajar = calcModHabilidad(char, 'Viajar');
    const modCaza = calcModHabilidad(char, 'Cazar');
    const modPercepcion = calcModHabilidad(char, 'Percepción');
    const modExplorar = calcModHabilidad(char, 'Explorar');
    
    setConfig(prev => ({
      ...prev,
      miembros: [...prev.miembros, {
        id: char.id,
        nombre: char.nombre,
        raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
        papeles: [],
        tieneMontura: false,
        monturaNombre: null,
        monturaConBonus: 0,
        monturaPropia: monturaPropia,
        velocidadBase: velocidadBase,
        // Skill modifiers (already include competencia + pericia)
        modViajar: modViajar,
        modCaza: modCaza,
        modPercepcion: modPercepcion,
        modExplorar: modExplorar,
        // For backwards compatibility
        modSabiduria: getModAtributo(char, 'sabiduria'),
        modDestreza: getModAtributo(char, 'destreza'),
        percepcionPasiva: 10 + modPercepcion,
        // Proficiencies (for reference)
        competencias: char.habilidades_competencia || char.habilidades || [],
        pericias: char.pericia_elegida || [],
        competenciaViajar: tieneCompetenciaEn(char, 'Viajar'),
        periciaViajar: tienePericia(char, 'Viajar'),
        competenciaCartografia: tieneCompetenciaEn(char, 'cartograf'),
        // Level and bonus
        nivel: nivel,
        bonusCompetencia: bonusCompetencia
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
      velocidad: char.montura.velocidad || 18,
      constitucion: char.montura.constitucion
    } : null;
    
    // Character base speed in METERS
    const velocidadBase = char.velocidad || 9;
    
    if (existingMember) {
      // Add role to existing member (allow multiple roles)
      setConfig(prev => ({
        ...prev,
        miembros: prev.miembros.map(m => {
          if (m.id === charId) {
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
      // Calculate skill modifiers for travel roles
      const nivel = char.nivel || 1;
      const bonusCompetencia = calcBonusCompetencia(nivel);
      
      // Use calcModHabilidad with correct skill names (no second parameter)
      const modViajar = calcModHabilidad(char, 'Viajar');
      const modCaza = calcModHabilidad(char, 'Cazar');
      const modPercepcion = calcModHabilidad(char, 'Percepción');
      const modExplorar = calcModHabilidad(char, 'Explorar');
      
      // Add new member with role
      setConfig(prev => ({
        ...prev,
        miembros: [...prev.miembros, {
          id: char.id,
          nombre: char.nombre,
          raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
          papeles: [role],
          tieneMontura: false,
          monturaNombre: null,
          monturaConBonus: 0,
          monturaPropia: monturaPropia,
          velocidadBase: velocidadBase,
          // Skill modifiers (already include competencia + pericia)
          modViajar: modViajar,
          modCaza: modCaza,
          modPercepcion: modPercepcion,
          modExplorar: modExplorar,
          // For backwards compatibility
          modSabiduria: getModAtributo(char, 'sabiduria'),
          modDestreza: getModAtributo(char, 'destreza'),
          percepcionPasiva: 10 + modPercepcion,
          // Proficiencies
          competencias: char.habilidades_competencia || char.habilidades || [],
          pericias: char.pericia_elegida || [],
          competenciaViajar: tieneCompetenciaEn(char, 'Viajar'),
          periciaViajar: tienePericia(char, 'Viajar'),
          competenciaCartografia: tieneCompetenciaEn(char, 'cartograf'),
          // Level and bonus
          nivel: nivel,
          bonusCompetencia: bonusCompetencia
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
    setSavedMapImage(null); // Reset saved map image on new journey
  };
  
  // Capture map image when journeyCalc is available and we have coordinates
  useEffect(() => {
    if (journeyCalc?.ruta?.path_coords && mapContainerRef.current && !savedMapImage) {
      // Wait for the map to render, then capture it
      const timer = setTimeout(async () => {
        try {
          const canvas = await html2canvas(mapContainerRef.current, {
            backgroundColor: '#f4efe6',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            imageTimeout: 15000
          });
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setSavedMapImage(dataUrl);
          console.log('Map image auto-captured');
        } catch (err) {
          console.error('Error auto-capturing map:', err);
        }
      }, 1000); // Wait 1 second for map to fully render
      
      return () => clearTimeout(timer);
    }
  }, [journeyCalc?.ruta?.path_coords, savedMapImage]);
  
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
    // Export debug JSON for journey analysis
    const exportDebugJson = () => {
      const debugData = {
        timestamp: new Date().toISOString(),
        journey: {
          origen: config.origenNombre,
          destino: config.destinoNombre,
          origen_id: config.origenId,
          destino_id: config.destinoId,
          preferir_caminos: config.preferirCaminos,
          evitar_sombra: config.evitarSombra,
          estacion: config.estacion,
          ritmo: config.ritmo
        },
        calculation_result: journeyCalc,
        events: events.map(e => ({
          casilla: e.casilla,
          evento_nombre: e.evento?.nombre,
          resuelto: e.resuelto,
          exito: e.exito,
          tirada: e.tirada,
          orientacion: e.orientacion
        })),
        orientation_checks: orientationChecks,
        positions: {
          current: currentPosition,
          next_event: nextEventPosition
        }
      };
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viaje_debug_${config.origenNombre}_${config.destinoNombre}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Debug JSON exportado');
    };
    
    // Check if we should export debug instead of print
    if (window.event?.shiftKey) {
      exportDebugJson();
      return;
    }
    
    // Capture the map using html2canvas on the visible element
    // This should be called when the map is visible on screen
    const captureMapImage = async () => {
      // If we already have a saved map image, use it
      if (savedMapImage) {
        return savedMapImage;
      }
      
      if (!mapContainerRef.current) return null;
      
      try {
        // Wait a bit to ensure the map is fully rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const canvas = await html2canvas(mapContainerRef.current, {
          backgroundColor: '#f4efe6',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          imageTimeout: 15000
        });
        
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        return dataUrl;
      } catch (err) {
        console.error('Error capturing map with html2canvas:', err);
        return null;
      }
    };
    
    // Function to capture and save the map image
    // Should be called when the route is calculated and the map is visible
    const captureAndSaveMapImage = async () => {
      if (!mapContainerRef.current) return;
      
      try {
        // Wait for the map to render
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = await html2canvas(mapContainerRef.current, {
          backgroundColor: '#f4efe6',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          imageTimeout: 15000
        });
        
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        setSavedMapImage(dataUrl);
        console.log('Map image captured and saved');
      } catch (err) {
        console.error('Error capturing map:', err);
      }
    };
    
    // Generate map image placeholder HTML (will be replaced with actual capture)
    const generateMapPlaceholder = (mapDataUrl) => {
      if (!mapDataUrl) {
        return '<p style="text-align: center; color: #888; padding: 40px;">Mapa no disponible</p>';
      }
      return `<div style="margin: 20px 0; border: 2px solid #d4c4a8; border-radius: 8px; overflow: hidden;">
        <img src="${mapDataUrl}" style="width: 100%; max-height: 400px; object-fit: contain; display: block;" />
        <div style="display: flex; justify-content: center; gap: 20px; padding: 8px; background: rgba(139, 69, 19, 0.05); border-top: 1px solid #d4c4a8; font-size: 10pt;">
          <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #2d5a27; margin-right: 5px;"></span> Origen</span>
          <span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #8B2500; margin-right: 5px;"></span> Destino</span>
          ${events.length > 0 ? `<span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: rgba(144, 238, 144, 0.8); border: 1px solid #228B22; margin-right: 5px;"></span> Éxito</span>
          <span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 182, 193, 0.8); border: 1px solid #8B0000; margin-right: 5px;"></span> Fracaso</span>` : ''}
        </div>
      </div>`;
    };
    
    // Generate the print content
    const generatePrintContent = async () => {
      toast.info('Generando crónica del viaje...');
      const mapDataUrl = await captureMapImage();
      const mapHTML = generateMapPlaceholder(mapDataUrl);
      
      return `<!DOCTYPE html>
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
        
        ${mapHTML}
        
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
        
        ${includeChronicleInPDF && journeyChronicle ? `
          <h2>Diario del Viaje</h2>
          <div style="text-align: justify; line-height: 1.8; margin: 20px 0; padding: 20px 24px; background: rgba(139, 69, 19, 0.04); border-left: 4px solid #8B4513;">
            ${journeyChronicle.split(/\n\n+/).map(p => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
          </div>
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
        
        ${journeyCalc?.ruta?.terrain_summary && Object.keys(journeyCalc.ruta.terrain_summary).length > 0 ? `
          <h2>Tierras Atravesadas</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
            ${Object.entries(journeyCalc.ruta.terrain_summary).map(([terrain, km]) => {
              const terrainNames = {
                'facil': 'Camino Fácil',
                'moderado': 'Terreno Moderado', 
                'dificil': 'Terreno Difícil',
                'muy_dificil': 'Terreno Muy Difícil',
                'desalentador': 'Terreno Desalentador',
                'infranqueable': 'Terreno Infranqueable'
              };
              return `<span style="padding: 5px 15px; background: rgba(139, 69, 19, 0.1); border: 1px solid #d4c4a8; border-radius: 4px;">
                ${terrainNames[terrain] || terrain}: <strong>${km.toFixed(1)} km</strong>
              </span>`;
            }).join('')}
          </div>
        ` : ''}
        
        ${journeyCalc?.px_desglose && journeyCalc.estimaciones?.px_total > 0 ? `
          <h2>Experiencia Ganada</h2>
          <p style="margin-bottom: 10px;">El viaje a través de tierras peligrosas ha otorgado <strong>${journeyCalc.estimaciones.px_total} puntos de experiencia</strong> al total de la compañía, a repartir entre los ${config.miembros.filter(m => m.papeles?.length).length || config.miembros.length} viajeros (${Math.floor((journeyCalc.estimaciones.px_total) / Math.max(1, config.miembros.filter(m => m.papeles?.length).length || config.miembros.length))} PX por cabeza, antes de bonificaciones individuales por tiradas).</p>
          ${journeyCalc.px_desglose.por_tipo_tierra ? `
            <div style="padding: 15px; background: rgba(34, 139, 34, 0.08); border: 1px solid #d4c4a8; margin-bottom: 15px;">
              <p style="margin: 0 0 10px 0; font-weight: bold;">Desglose por Tipo de Tierra:</p>
              ${Object.entries(journeyCalc.px_desglose.por_tipo_tierra).map(([tipo, info]) => {
                const landNames = {
                  'tierras_salvajes': 'Tierras Salvajes',
                  'tierras_fronterizas': 'Tierras Fronterizas',
                  'tierras_sombra': 'Tierras de la Sombra',
                  'tierras_oscuras': 'Tierras Oscuras',
                  'tierras_libres': 'Tierras Libres'
                };
                return `<p style="margin: 5px 0;">• ${landNames[tipo] || tipo}: ${info.km?.toFixed(1) || 0} km → <strong>${info.px || 0} PX</strong></p>`;
              }).join('')}
            </div>
          ` : ''}
          ${(() => {
            // Tabla de PX desglosados por jugador
            const membersWithRoles = config.miembros.filter(m => m.papeles?.length);
            if (membersWithRoles.length === 0) return '';
            const journeyBasePX = journeyCalc.estimaciones.px_total;
            const pxPerMemberFromJourney = Math.floor(journeyBasePX / membersWithRoles.length);
            const allRolls = Object.values(characterXP || {}).flatMap(c => c.rolls || []);
            const aciertos = allRolls.filter(r => r.exito).length;
            const fallos = allRolls.length - aciertos;
            const totalRolls = aciertos + fallos;
            // Mismo cálculo que calculateGroupMultiplier (Tabla 2)
            let groupMult = 1.0;
            if (totalRolls > 0) {
              const ratio = aciertos / totalRolls;
              if (ratio >= 0.85) groupMult = 1.5;
              else if (ratio >= 0.7) groupMult = 1.25;
              else if (ratio >= 0.5) groupMult = 1.0;
              else if (ratio >= 0.3) groupMult = 0.75;
              else groupMult = 0.5;
            }
            const groupMultLabel = `×${groupMult.toFixed(2)} (grupo: ${aciertos} éxitos / ${fallos} fracasos)`;
            return `
              <div style="margin-top: 15px;">
                <p style="font-weight: bold; margin-bottom: 8px;">PX por jugador (multiplicador del grupo: ${groupMultLabel}):</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
                  <thead>
                    <tr style="background: rgba(212, 196, 168, 0.3);">
                      <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #c8b88a;">Personaje</th>
                      <th style="padding: 6px 8px; text-align: left; border-bottom: 2px solid #c8b88a;">Papel</th>
                      <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a;">PX viaje</th>
                      <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a;">PX tiradas</th>
                      <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a;">PX ajustados</th>
                      <th style="padding: 6px 8px; text-align: center; border-bottom: 2px solid #c8b88a; color: #1d4ed8;">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${membersWithRoles.map(m => {
                      const rollsXP = characterXP[m.id]?.total || 0;
                      const rollsXPAjustado = Math.floor(rollsXP * groupMult);
                      const totalXP = Math.max(0, pxPerMemberFromJourney + rollsXPAjustado);
                      const papeles = (m.papeles || []).join(', ');
                      return `
                        <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                          <td style="padding: 5px 8px; font-weight: 600;">${m.nombre}</td>
                          <td style="padding: 5px 8px; font-style: italic; color: #6b5b3a;">${papeles}</td>
                          <td style="padding: 5px 8px; text-align: center;">${pxPerMemberFromJourney}</td>
                          <td style="padding: 5px 8px; text-align: center;">${rollsXP}</td>
                          <td style="padding: 5px 8px; text-align: center;">${rollsXPAjustado}</td>
                          <td style="padding: 5px 8px; text-align: center; font-weight: bold; color: #1d4ed8; font-size: 14px;">${totalXP} PX</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
                <p style="font-size: 11px; color: #6b5b3a; margin-top: 6px; font-style: italic;">
                  PX viaje = base del trayecto dividida entre los miembros con papeles. PX tiradas = bonificaciones por tiradas individuales (por CD y resultado). PX ajustados = PX tiradas multiplicados por el rendimiento del grupo. TOTAL = PX viaje + PX ajustados (mínimo 0).
                </p>
              </div>
            `;
          })()}
        ` : ''}
        
        ${events.length > 0 ? `
          <h2>Acontecimientos del Viaje</h2>
          ${events.map((e, i) => `
            <div class="event ${e.exito ? 'event-success' : 'event-failure'}">
              <strong>Casilla ${e.casilla}: ${e.evento?.nombre || 'Acontecimiento'}</strong>
              <span style="float: right;">${e.exito ? '✓ Éxito' : '✗ Fracaso'} (${e.tirada} vs CD ${e.resolucion?.cd || '?'})</span>
              ${e.clima_dia ? `
                <div style="font-size:11px; color:#6b5b3a; margin:6px 0; padding:4px 8px; background:rgba(212,196,168,0.25); border-left:3px solid #c8b88a; font-family:monospace;">
                  ${e.clima_dia.icon || ''} ${e.clima_dia.estado_label || ''}
                  ${e.clima_dia.temp_min !== undefined ? ` · ${e.clima_dia.temp_min}°→${e.clima_dia.temp_max}°` : ''}
                  ${e.clima_dia.viento_kmh !== undefined ? ` · viento ${e.clima_dia.viento_kmh}km/h${e.clima_dia.dir_viento ? ' ' + e.clima_dia.dir_viento : ''}` : ''}
                  ${e.clima_dia.pct_lluvia !== undefined && e.clima_dia.pct_lluvia > 0 ? ` · lluvia ${Math.round(e.clima_dia.pct_lluvia)}%` : ''}
                </div>
              ` : ''}
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
      </html>`;
    };
    
    // Execute the async function
    generatePrintContent().then(printContent => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      } else {
        toast.error('No se pudo abrir la ventana de impresión. Verifica que los pop-ups no estén bloqueados.');
      }
    }).catch(err => {
      console.error('Error generating print content:', err);
      toast.error('Error al generar la crónica');
    });
  };
  
  // =============== APPLY PX TO CHARACTERS ===============
  
  const applyPXToCharacters = async () => {
    const membersWithRoles = config.miembros.filter(m => m.papeles?.length > 0);
    if (membersWithRoles.length === 0) {
      toast.error('No hay personajes con roles asignados');
      return;
    }
    
    // Calculate base journey PX divided equally
    const journeyBasePX = journeyCalc?.estimaciones?.px_total || 0;
    const pxPerMemberFromJourney = Math.round(journeyBasePX / membersWithRoles.length);
    
    setApplyingPX(true);
    
    try {
      // Calcular multiplicador global por grupo (Tabla 2)
      const allRolls = Object.values(characterXP).flatMap(c => c.rolls || []);
      const aciertos = allRolls.filter(r => r.exito).length;
      const fallos = allRolls.length - aciertos;
      const groupMult = calculateGroupMultiplier(aciertos, fallos);
      
      // Build array of {character_id, px_amount} with TOTAL = journey share + individual rolls (ajustado) — mínimo 0 por PJ
      const characterPXList = membersWithRoles.map(m => {
        const rollsXP = characterXP[m.id]?.total || 0;
        const rollsXPAjustado = Math.floor(rollsXP * groupMult.multiplicador);
        const totalXP = Math.max(0, pxPerMemberFromJourney + rollsXPAjustado);
        return {
          character_id: m.id,
          character_name: m.nombre,
          px_amount: totalXP,
          px_journey: pxPerMemberFromJourney,
          px_rolls: rollsXPAjustado
        };
      });
      
      const response = await api.post('/travel/apply-px-individual', {
        characters: characterPXList,
        journey_id: activeJourney?.id || null,
        journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`
      });
      
      if (response.data.success) {
        setPxApplied(true);
        setPxResults(response.data);
        toast.success(`¡PX aplicados a ${response.data.exitosos} personajes!`);
      } else {
        toast.error(response.data.message || 'Error al aplicar PX');
      }
    } catch (err) {
      console.error('Error applying PX:', err);
      // Fallback to old method if new endpoint doesn't exist
      try {
        const totalRollsXP = Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0);
        const avgPX = Math.round((journeyBasePX + totalRollsXP) / membersWithRoles.length);
        const response = await api.post('/travel/apply-px', {
          character_ids: membersWithRoles.map(m => m.id),
          px_amount: avgPX,
          journey_id: activeJourney?.id || null,
          journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`
        });
        
        if (response.data.success) {
          setPxApplied(true);
          setPxResults(response.data);
          toast.success(`¡PX aplicados a ${response.data.exitosos} personajes!`);
        } else {
          toast.error(response.data.message || 'Error al aplicar PX');
        }
      } catch (fallbackErr) {
        toast.error('Error al aplicar PX a los personajes');
      }
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
              
              {/* Group Speed Info */}
              {journeyCalc.velocidad_grupo && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Footprints className="w-4 h-4 text-[hsl(var(--gold))]" />
                    <span className="text-[hsl(var(--gold))] font-medium">Velocidad del Grupo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 p-2 rounded">
                      <p className="text-muted-foreground text-xs">Km/día</p>
                      <p className="text-lg font-bold text-white">{journeyCalc.velocidad_grupo.km_por_dia}</p>
                    </div>
                    <div className="bg-black/30 p-2 rounded">
                      <p className="text-muted-foreground text-xs">Velocidad base</p>
                      <p className="text-lg font-bold text-white">{journeyCalc.velocidad_grupo.velocidad_metros || journeyCalc.velocidad_grupo.velocidad_pies} m</p>
                    </div>
                  </div>
                  {journeyCalc.velocidad_grupo.miembro_mas_lento && (
                    <p className="text-xs text-muted-foreground mt-2">
                      El grupo viaja a la velocidad de <span className="text-yellow-400">{journeyCalc.velocidad_grupo.miembro_mas_lento}</span>
                    </p>
                  )}
                  {journeyCalc.velocidad_grupo.desglose_velocidades && journeyCalc.velocidad_grupo.desglose_velocidades.length > 1 && (
                    <div className="mt-2 text-xs">
                      <p className="text-muted-foreground mb-1">Desglose por miembro:</p>
                      <div className="flex flex-wrap gap-1">
                        {journeyCalc.velocidad_grupo.desglose_velocidades.map((v, idx) => (
                          <span 
                            key={idx} 
                            className={`px-2 py-0.5 rounded ${v.velocidad_efectiva === (journeyCalc.velocidad_grupo.velocidad_metros || journeyCalc.velocidad_grupo.velocidad_pies) ? 'bg-yellow-600/30 text-yellow-400' : 'bg-black/30 text-gray-400'}`}
                          >
                            {v.nombre}: {v.velocidad_efectiva}m ({v.km_por_dia} km/día) {v.tiene_montura ? '🐴' : '🚶'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
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
                    Caminos utilizados (en orden de recorrido):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {journeyCalc.ruta.roads_used.map((road, i) => (
                      <Badge key={i} variant="outline" className="border-amber-500/50 text-amber-300">
                        <span className="inline-flex items-center justify-center w-5 h-5 mr-1 text-xs font-bold bg-amber-600/50 rounded-full">{i + 1}</span>
                        {road}
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
              
              {/* Compare Routes Button */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  className="w-full border-amber-500/50 text-amber-300 hover:bg-amber-900/30"
                  onClick={compareRoutes}
                  disabled={loadingComparison}
                >
                  {loadingComparison ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Comparando rutas...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      Comparar Rutas (Caminos vs Campo a Través)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Route Comparison Panel */}
          {showComparison && routeComparison && (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-amber-500/30">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[hsl(var(--gold))]">
                  <ArrowLeftRight className="w-5 h-5 inline mr-2" />
                  Comparación de Rutas
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComparison(false)}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Straight Line Reference */}
              {routeComparison.linea_recta && (
                <div className="mb-4 p-3 bg-blue-900/20 rounded border border-blue-500/30">
                  <p className="text-blue-400 text-sm mb-1">
                    📏 Línea Recta (teórica, sin obstáculos):
                  </p>
                  <p className="text-white font-bold">
                    {routeComparison.linea_recta.distance_km} km ({routeComparison.linea_recta.dias_teoricos} días)
                  </p>
                </div>
              )}
              
              {/* Routes Comparison Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Route by Roads */}
                {routeComparison.ruta_caminos && (
                  <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-500/40">
                    <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                      <Route className="w-4 h-4" />
                      Ruta por Caminos
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distancia:</span>
                        <span className="text-white font-bold">{routeComparison.ruta_caminos.distance_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Días estimados:</span>
                        <span className="text-[hsl(var(--gold))] font-bold">{routeComparison.ruta_caminos.dias_estimados}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Caminos usados:</span>
                        <span className="text-amber-300">{routeComparison.ruta_caminos.roads_used?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Desvío vs recta:</span>
                        <span className="text-orange-400">+{routeComparison.ruta_caminos.desvio_vs_recta_km} km</span>
                      </div>
                      
                      {/* Terrain breakdown mini */}
                      {routeComparison.ruta_caminos.terrain_summary && (
                        <div className="mt-2 pt-2 border-t border-amber-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Terreno:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(routeComparison.ruta_caminos.terrain_summary).map(([t, km]) => (
                              <span key={t} className="text-xs px-1 py-0.5 bg-black/30 rounded">
                                {t}: {km.toFixed(0)}km
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {routeComparison.ruta_caminos.has_land_violations && (
                        <div className="mt-2 p-2 bg-red-900/30 rounded">
                          <p className="text-red-400 text-xs">⚠️ Atraviesa tierras prohibidas</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Direct Route */}
                {routeComparison.ruta_directa && (
                  <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/40">
                    <h4 className="text-green-400 font-bold mb-3 flex items-center gap-2">
                      <Mountain className="w-4 h-4" />
                      Ruta Directa
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distancia:</span>
                        <span className="text-white font-bold">{routeComparison.ruta_directa.distance_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Días estimados:</span>
                        <span className="text-[hsl(var(--gold))] font-bold">{routeComparison.ruta_directa.dias_estimados}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Caminos usados:</span>
                        <span className="text-green-300">{routeComparison.ruta_directa.roads_used?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Desvío vs recta:</span>
                        <span className="text-orange-400">+{routeComparison.ruta_directa.desvio_vs_recta_km} km</span>
                      </div>
                      
                      {/* Terrain breakdown mini */}
                      {routeComparison.ruta_directa.terrain_summary && (
                        <div className="mt-2 pt-2 border-t border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Terreno:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(routeComparison.ruta_directa.terrain_summary).map(([t, km]) => (
                              <span key={t} className="text-xs px-1 py-0.5 bg-black/30 rounded">
                                {t}: {km.toFixed(0)}km
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {routeComparison.ruta_directa.has_land_violations && (
                        <div className="mt-2 p-2 bg-red-900/30 rounded">
                          <p className="text-red-400 text-xs">⚠️ Atraviesa tierras prohibidas</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Comparison Summary */}
              {routeComparison.comparacion && (
                <div className="mt-4 p-3 bg-slate-800/50 rounded">
                  {routeComparison.comparacion.rutas_identicas ? (
                    <p className="text-center text-muted-foreground">
                      ℹ️ Las rutas son idénticas. Las barreras naturales (montañas, agua) fuerzan el mismo camino.
                    </p>
                  ) : (
                    <div className="text-center">
                      <p className="text-white">
                        La ruta <span className="text-amber-400 font-bold">{routeComparison.comparacion.ruta_mas_rapida === 'caminos' ? 'por Caminos' : 'Directa'}</span> es{' '}
                        <span className="text-green-400 font-bold">{Math.abs(routeComparison.comparacion.dias_diferencia)} días más rápida</span>
                      </p>
                      {Math.abs(routeComparison.comparacion.distancia_diferencia_km) > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Diferencia de {Math.abs(routeComparison.comparacion.distancia_diferencia_km)} km ({routeComparison.comparacion.porcentaje_mas_largo}% más largo)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Options reminder */}
              <div className="mt-3 text-xs text-muted-foreground text-center">
                {routeComparison.opciones?.evitar_sombra && <span className="mr-2">🛡️ Evitando Tierras de Sombra</span>}
                {routeComparison.opciones?.evitar_tierras_oscuras && <span>🛡️ Evitando Tierras Oscuras</span>}
              </div>
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
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Ritmo de Viaje</Label>
              <Select value={config.ritmo} onValueChange={(v) => setConfig(prev => ({ ...prev, ritmo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lento">🐢 Lento (15-20 km/día)</SelectItem>
                  <SelectItem value="normal">🚶 Normal (20-25 km/día)</SelectItem>
                  <SelectItem value="rapido">🏃 Forzado (25-30 km/día)</SelectItem>
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
              <Label>Día del Mes</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={config.diaMes}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  const clamped = Number.isNaN(v) ? 1 : Math.max(1, Math.min(30, v));
                  setConfig(prev => ({ ...prev, diaMes: clamped }));
                }}
                data-testid="journey-day-input"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Fecha de salida (1-30). Al terminar el viaje se calculará la fecha de llegada.
              </p>
            </div>
            
            {/* Vista previa del clima en origen y destino para el mes elegido */}
            {(config.origenId || config.destinoId) && (
              <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-3 items-center bg-black/20 rounded p-2" data-testid="weather-preview-config">
                <span className="text-xs text-muted-foreground">Clima previsto:</span>
                {config.origenId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{config.origenNombre}:</span>
                    <WeatherIndicator locationId={config.origenId} mes={config.mes} dia={config.diaMes} compact />
                  </div>
                )}
                {config.destinoId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">→ {config.destinoNombre}:</span>
                    <WeatherIndicator locationId={config.destinoId} mes={config.mes} dia={config.diaMes} compact />
                  </div>
                )}
              </div>
            )}
            
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
                
                // Use the pre-calculated modifiers if member exists, otherwise calculate
                let modHabilidad;
                if (member) {
                  // Use pre-calculated modifier from member
                  if (roleKey === 'guia') modHabilidad = member.modViajar;
                  else if (roleKey === 'cazador') modHabilidad = member.modCaza;
                  else if (roleKey === 'vigia') modHabilidad = member.modPercepcion;
                  else if (roleKey === 'explorador') modHabilidad = member.modExplorar;
                  else modHabilidad = member.modSabiduria || 0;
                } else {
                  // Calculate from character data
                  modHabilidad = calcModHabilidad(char, roleInfo.habilidad);
                }
                
                // Check competencies
                const competencias = char.habilidades_competencia || char.habilidades || [];
                const pericias = char.pericia_elegida || [];
                const esCompetente = competencias.some(h => 
                  h.toLowerCase().includes(roleInfo.habilidad_key)
                );
                const tienePericia = pericias.some(p => 
                  p.toLowerCase().includes(roleInfo.habilidad_key)
                );
                
                // Check if this character has multiple roles (apply penalty)
                const tienePenalizacion = member?.papeles?.length > 1 || false;
                const penalizacion = tienePenalizacion ? MULTI_ROLE_PENALTY : 0;
                
                return {
                  total: modHabilidad + penalizacion,
                  totalSinPenalizacion: modHabilidad,
                  atributo: getModAtributo(char, roleInfo.atributo),
                  habilidad: modHabilidad,
                  competente: esCompetente,
                  tienePericia: tienePericia,
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
            onClick={triggerCalculateJourney}
            disabled={!config.origenId || !config.destinoId}
            className="w-full h-12 text-lg mt-4"
            variant="outline"
            data-testid="calculate-route-btn"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Calcular Ruta
          </Button>
          
          {/* Provisions Warning */}
          {provisionsCheck && showProvisionsWarning && (!provisionsCheck.comidaSuficiente || !provisionsCheck.aguaSuficiente) && (
            <Card className="mt-3 p-3 border-yellow-500/50 bg-yellow-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-yellow-500 text-sm">Provisiones Insuficientes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para {journeyCalc?.estimaciones?.dias_estimados || '?'} días de viaje con {config.miembros.length} personas:
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className={provisionsCheck.comidaSuficiente ? 'text-green-400' : 'text-red-400'}>
                      <span className="font-medium">Comida:</span> {provisionsCheck.comidaDisponible.toFixed(1)}/{provisionsCheck.comidaNecesaria} raciones
                      {!provisionsCheck.comidaSuficiente && (
                        <span className="block text-yellow-400">Faltan {provisionsCheck.faltaComida.toFixed(1)} raciones</span>
                      )}
                    </div>
                    <div className={provisionsCheck.aguaSuficiente ? 'text-green-400' : 'text-red-400'}>
                      <span className="font-medium">Agua:</span> {provisionsCheck.aguaDisponible.toFixed(1)}/{provisionsCheck.aguaNecesaria}L
                      {!provisionsCheck.aguaSuficiente && (
                        <span className="block text-yellow-400">Faltan {provisionsCheck.faltaAgua.toFixed(1)}L</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Sin provisiones: +1 fatiga/día sin comida, +2 fatiga/día sin agua.
                    Puedes forrajear durante el viaje (Supervivencia CD 15).
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button 
                      size="sm" 
                      onClick={() => setShowProvisionsShop(true)}
                      className="text-xs bg-[hsl(var(--gold))] text-black hover:brightness-110"
                      data-testid="provisions-warning-buy-btn"
                    >
                      <Coins className="w-3.5 h-3.5 mr-1" />
                      Comprar provisiones
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowProvisionsWarning(false)}
                      className="text-xs"
                    >
                      Continuar de todos modos
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          <Button 
            onClick={travelMode === 'global' ? startGlobalJourney : startDayByDayJourney}
            disabled={!journeyCalc?.success || config.miembros.length === 0 || !config.miembros.some(m => m.papeles?.includes('guia'))}
            className="w-full h-12 text-lg mt-2"
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
      {/* Journey Progress with Orientation Info */}
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
              value={(currentPosition / journeyCalc?.ruta?.casillas) * 100} 
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Progreso: {currentPosition} / {journeyCalc?.ruta?.casillas} casillas | 
              Eventos: {events.filter(e => e.resuelto).length} resueltos
            </p>
          </div>
          
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold">{journeyCalc?.ruta?.casillas || 0}</p>
              <p className="text-xs text-muted-foreground">total casillas</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold text-blue-400">{currentPosition}</p>
              <p className="text-xs text-muted-foreground">posición actual</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold">{journeyCalc?.ruta?.casillas - currentPosition}</p>
              <p className="text-xs text-muted-foreground">casillas restantes</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
              <p className="text-xs text-muted-foreground">PX</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Orientation Check UI */}
      {awaitingOrientationCheck && (
        <Card className="card-parchment border-2 border-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
              <Compass className="w-5 h-5 inline mr-2" />
              Tirada de Orientación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const guia = config.miembros.find(m => m.papeles?.includes('guia'));
              const guiaChar = characters.find(c => c.id === guia?.id);
              const casillasRestantes = journeyCalc.ruta.casillas - currentPosition;
              const tieneMultiplesRoles = guia?.papeles?.length > 1;
              
              return (
                <>
                  <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
                    <p className="text-sm mb-2">
                      El <strong>Guía ({guia?.nombre || 'Sin asignar'})</strong> debe realizar una prueba de 
                      <strong> Sabiduría (Viajar) CD 15</strong>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      • Si tiene un mapa, puede usar competencia con herramientas de cartografía.<br/>
                      • Si el Guía tiene múltiples papeles: <span className="text-red-400">-5 penalización</span>
                    </p>
                    {tieneMultiplesRoles && (
                      <p className="text-xs text-red-400 mt-2">
                        ⚠️ {guia?.nombre} tiene {guia?.papeles?.length} papeles asignados (-5 penalización)
                      </p>
                    )}
                  </div>
                  
                  <div className="text-center p-4 bg-black/20 rounded">
                    <p className="text-sm text-muted-foreground mb-2">Casillas restantes hasta el destino:</p>
                    <p className="text-3xl font-bold text-[hsl(var(--gold))]">{casillasRestantes}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-black/10 p-3 rounded">
                    <div><strong>Fallo por 5+:</strong> Evento a 1 casilla</div>
                    <div><strong>Fallo:</strong> Evento a 2 casillas</div>
                    <div><strong>Éxito:</strong> Evento a 3 casillas</div>
                    <div><strong>Éxito por 5+:</strong> Evento a 4 casillas</div>
                    <div className="col-span-2 mt-2 text-green-400">
                      Si la tirada ≥ {casillasRestantes} casillas restantes: ¡Viaje completado sin más eventos!
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Notas del Maestro (opcional, para IA narrativa)
                    </Label>
                    <Textarea
                      value={gmNotesOrientation}
                      onChange={(e) => setGmNotesOrientation(e.target.value)}
                      placeholder="Ej: Cruzan el Bosque de los Trolls al amanecer. Terreno embarrado, niebla espesa..."
                      rows={2}
                      className="text-xs mt-1"
                      data-testid="gm-notes-orientation"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 btn-gold"
                      onClick={performOrientationCheck}
                      disabled={autoRunning}
                      data-testid="orientation-roll-btn"
                    >
                      <Dice6 className="w-4 h-4 mr-2" />
                      Realizar Tirada de Orientación
                    </Button>
                    <Button
                      variant={autoRunning ? 'destructive' : 'outline'}
                      onClick={automateJourney}
                      className="border-[hsl(var(--gold))]/50"
                      data-testid="automate-journey-btn"
                      title={autoRunning ? 'Detener automatización' : 'Simular todo el viaje automáticamente'}
                    >
                      {autoRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Detener
                        </>
                      ) : (
                        <>
                          <ArrowLeftRight className="w-4 h-4 mr-2" />
                          Automatizar viaje
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {lastOrientationResult && (
                    <div className={`p-3 rounded ${lastOrientationResult.exito ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                      <p className="text-sm">
                        <strong>Última tirada ({lastOrientationResult.guiaNombre || 'Guía'}):</strong>{' '}
                        {lastOrientationResult.d20} + {lastOrientationResult.modificador} = {lastOrientationResult.total} vs CD 15
                      </p>
                      <p className="text-xs mt-1">{lastOrientationResult.detalle}</p>
                      {lastOrientationResult.xpResult && (
                        <p className="text-xs mt-1" data-testid="orientation-xp-display">
                          <span className="text-muted-foreground">PX generados:</span>{' '}
                          <span className={`font-bold ${lastOrientationResult.xpResult.pxFinal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {lastOrientationResult.xpResult.pxFinal >= 0 ? '+' : ''}{lastOrientationResult.xpResult.pxFinal} PX
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}
      
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
              const { modifier, breakdown, member: targetMember, roleInfo } = getRoleModifier(targetRole);
              
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
                    {targetMember && (
                      <p className="text-xs text-muted-foreground mt-1" data-testid="event-modifier-breakdown">
                        Modificador total: <span className={`font-bold ${modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {modifier >= 0 ? '+' : ''}{modifier}
                        </span>
                        <span className="ml-2">({breakdown.join(', ')})</span>
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
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Notas del Maestro (opcional, para IA narrativa)
                </Label>
                <Textarea
                  value={gmNotesEvent}
                  onChange={(e) => setGmNotesEvent(e.target.value)}
                  placeholder="Ej: Acampando en la región del Bosque de los Trolls. Terreno resguardado, barro..."
                  rows={2}
                  className="text-xs mt-1"
                  data-testid="gm-notes-event"
                />
              </div>
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
          
          {/* Provisions Status */}
          <div className="bg-black/20 p-3 rounded mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4" />
                Provisiones
              </h4>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowProvisionsShop(true)}
                  className="text-xs h-7 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40"
                  data-testid="buy-provisions-btn"
                >
                  <Package className="w-3 h-3 mr-1" />
                  Comprar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowCampDialog(true)}
                  className="text-xs h-7 bg-[hsl(var(--gold))]/10 hover:bg-[hsl(var(--gold))]/20 border border-[hsl(var(--gold))]/40"
                  data-testid="camp-btn"
                >
                  <Tent className="w-3 h-3 mr-1" />
                  Acampar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowRestDialog(true)}
                  className="text-xs h-7"
                  data-testid="rest-btn"
                >
                  <Moon className="w-3 h-3 mr-1" />
                  Descansar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => performForaging(config.miembros.find(m => m.papeles?.includes('explorador'))?.id || config.miembros[0]?.id)}
                  className="text-xs h-7"
                  data-testid="forage-btn"
                >
                  <Leaf className="w-3 h-3 mr-1" />
                  Forrajear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-2 rounded border ${
                (partyProvisions.comidaTotal - partyProvisions.comidaConsumida) > config.miembros.length 
                  ? 'border-green-500/30 bg-green-500/10' 
                  : 'border-red-500/30 bg-red-500/10'
              }`}>
                <div className="flex items-center gap-1 text-xs font-medium">
                  <Utensils className="w-3 h-3 text-orange-400" />
                  Comida
                </div>
                <p className="text-lg font-bold">
                  {Math.max(0, partyProvisions.comidaTotal - partyProvisions.comidaConsumida).toFixed(1)}
                  <span className="text-xs text-muted-foreground ml-1">raciones</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ~{Math.floor(Math.max(0, partyProvisions.comidaTotal - partyProvisions.comidaConsumida) / config.miembros.length)} días
                </p>
              </div>
              <div className={`p-2 rounded border ${
                (partyProvisions.aguaTotal - partyProvisions.aguaConsumida) > config.miembros.length * 2 
                  ? 'border-blue-500/30 bg-blue-500/10' 
                  : 'border-red-500/30 bg-red-500/10'
              }`}>
                <div className="flex items-center gap-1 text-xs font-medium">
                  <Droplets className="w-3 h-3 text-blue-400" />
                  Agua
                </div>
                <p className="text-lg font-bold">
                  {Math.max(0, partyProvisions.aguaTotal - partyProvisions.aguaConsumida).toFixed(1)}
                  <span className="text-xs text-muted-foreground ml-1">litros</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ~{Math.floor(Math.max(0, partyProvisions.aguaTotal - partyProvisions.aguaConsumida) / (config.miembros.length * 2))} días
                </p>
              </div>
            </div>
            {/* Fatigue warnings from provisions */}
            {Object.entries(provisionFatigue).some(([_, f]) => f.sinComida > 0 || f.sinAgua > 0) && (
              <div className="mt-2 p-2 bg-red-500/20 rounded border border-red-500/30">
                <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Fatiga por falta de provisiones:
                </p>
                <div className="text-xs mt-1 space-y-0.5">
                  {Object.entries(provisionFatigue).map(([charId, fatigue]) => {
                    if (fatigue.sinComida === 0 && fatigue.sinAgua === 0) return null;
                    const char = config.miembros.find(m => m.id === charId);
                    const totalFatiga = fatigue.sinComida + (fatigue.sinAgua * 2);
                    return (
                      <div key={charId} className="flex justify-between">
                        <span>{char?.nombre || 'Desconocido'}</span>
                        <span className="text-red-400">+{totalFatiga} fatiga</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
      
      {/* Party Fatigue Panel - Acumulativa en tiempo real */}
      <PartyFatiguePanel miembros={config.miembros} characters={characters} />
      
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
              const { modifier, breakdown, member: targetMember, roleInfo } = getRoleModifier(targetRole);
              
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
                    {targetMember && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Modificador total: <span className={`font-bold ${modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {modifier >= 0 ? '+' : ''}{modifier}
                        </span>
                        <span className="ml-2">({breakdown.join(', ')})</span>
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
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Notas del Maestro (opcional, para IA narrativa)
                </Label>
                <Textarea
                  value={gmNotesEvent}
                  onChange={(e) => setGmNotesEvent(e.target.value)}
                  placeholder="Ej: Acampando en la región del Bosque de los Trolls. Terreno resguardado, barro..."
                  rows={2}
                  className="text-xs mt-1"
                  data-testid="gm-notes-event"
                />
              </div>
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
      
      {/* Rest Dialog */}
      {showRestDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowRestDialog(false)}>
          <Card className="card-parchment w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Descansar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!restResults ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Elige el tipo de descanso para la compañía:
                  </p>
                  
                  <div className="space-y-2">
                    {Object.entries(REST_TYPES).map(([key, rest]) => (
                      <div 
                        key={key}
                        onClick={() => setSelectedRestType(key)}
                        className={`p-3 rounded border cursor-pointer transition-colors ${
                          selectedRestType === key 
                            ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))/10]' 
                            : 'border-transparent bg-black/20 hover:bg-black/30'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-sm">{rest.nombre}</h4>
                            <p className="text-xs text-muted-foreground">{rest.duracion}</p>
                          </div>
                          {key === 'sanctuary' && nearbyRefuges.length === 0 && (
                            <Badge variant="outline" className="text-xs text-red-400">
                              Requiere refugio
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{rest.efecto}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowRestDialog(false)} 
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => performRest(selectedRestType)}
                      disabled={selectedRestType === 'sanctuary' && nearbyRefuges.length === 0}
                      className="flex-1"
                      data-testid="confirm-rest-btn"
                    >
                      <Moon className="w-4 h-4 mr-2" />
                      Descansar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="font-bold text-sm">Resultados del descanso:</h4>
                  <div className="space-y-2">
                    {restResults.map((result, idx) => (
                      <div key={idx} className={`p-2 rounded ${result.exito ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{result.nombre}</span>
                          <Badge variant={result.exito ? 'default' : 'destructive'}>
                            {result.exito ? '✓ Éxito' : '✗ Fallo'}
                          </Badge>
                        </div>
                        {result.tirada !== null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Tirada CON: {result.tirada} vs CD {result.cd}
                          </p>
                        )}
                        <p className="text-xs mt-1">
                          Fatiga: {result.fatigaAntes} → {result.fatigaDespues}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => { setRestResults(null); setShowRestDialog(false); }}
                    className="w-full"
                  >
                    Continuar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
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
        {/* Journey Map for PDF capture */}
        <div ref={mapContainerRef}>
          <JourneyMiniMap
            origenCoords={journeyCalc?.ruta?.origen_coords}
            destinoCoords={journeyCalc?.ruta?.destino_coords}
            origenNombre={config.origenNombre}
            destinoNombre={config.destinoNombre}
            pathPoints={journeyCalc?.ruta?.path}
            isDirectLine={!journeyCalc?.ruta?.path || journeyCalc.ruta.path.length < 3}
            events={events}
          />
        </div>
        
        {/* Diario del Viaje (IA narrativa unificada por jornada) */}
        <JourneyDiary
          orientationChecks={orientationChecks}
          events={events.filter(e => e.resuelto)}
          fatigueResults={fatigueResults}
          miembros={config.miembros}
          origen={config.origenNombre}
          destino={config.destinoNombre}
          terreno={journeyCalc?.ruta?.terreno || 'campo_abierto'}
          tipoTierra={journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes'}
          diasTotales={journeyCalc?.estimaciones?.dias_estimados || orientationChecks.length}
          kilometros={journeyCalc?.ruta?.distance_km}
          fechaSalida={`${config.diaMes} de ${MESES_ELFICOS.find(m => m.id === config.mes)?.nombre?.split(' ')[0] || config.mes}`}
          mes={config.mes}
          diaMes={config.diaMes}
          origenRegion={(locations || []).find(l => l.id === config.origenId)?.region}
          destinoRegion={(locations || []).find(l => l.id === config.destinoId)?.region}
          pathRegions={journeyCalc?.ruta?.casillas_detalle?.map(c => c.region) || journeyCalc?.ruta?.regiones_por_casilla}
          chronicle={journeyChronicle}
          setChronicle={setJourneyChronicle}
        />
        
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
              <div className="mt-3 flex justify-center gap-4 flex-wrap" data-testid="weather-results-banner">
                {config.origenId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{config.origenNombre}</span>
                    <WeatherIndicator locationId={config.origenId} mes={config.mes} dia={config.diaMes} />
                  </div>
                )}
                {config.destinoId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{config.destinoNombre}</span>
                    <WeatherIndicator locationId={config.destinoId} mes={config.mes} dia={config.diaMes} />
                  </div>
                )}
              </div>
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
            {/* Calculate base journey PX divided equally */}
            {(() => {
              const membersWithRoles = config.miembros.filter(m => m.papeles?.length > 0);
              const numMembers = membersWithRoles.length || 1;
              const journeyBasePX = journeyCalc?.estimaciones?.px_total || 0;
              const pxPerMemberFromJourney = Math.round(journeyBasePX / numMembers);
              
              return (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    {pxApplied 
                      ? '¡Los PX han sido aplicados a las fichas de los personajes!'
                      : 'PX del viaje repartidos a partes iguales + PX individuales por tiradas.'
                    }
                  </p>
                  
                  {/* Base journey PX info */}
                  <div className="p-3 bg-[hsl(var(--magic-blue))/10] rounded mb-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">PX base del viaje ({journeyCalc?.estimaciones?.distancia_km || 0} km):</span>
                      <span className="font-bold text-[hsl(var(--magic-blue))]">{journeyBasePX} PX</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Dividido entre {numMembers} viajero{numMembers !== 1 ? 's' : ''}:</span>
                      <span className="font-bold text-[hsl(var(--gold))]">+{pxPerMemberFromJourney} PX c/u</span>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-3">
                    {membersWithRoles.map((member) => {
                      const memberResult = pxResults?.results?.find(r => r.character_id === member.id);
                      const hasMultiple = member.papeles.length > 1;
                      const memberXP = characterXP[member.id] || { total: 0, rolls: [] };
                      const rollCount = memberXP.rolls?.length || 0;
                      const successCount = memberXP.rolls?.filter(r => r.exito).length || 0;
                      const failCount = rollCount - successCount;
                      
                      // Tabla 2: aplicar multiplicador global del viaje a los PX de tiradas
                      const allRolls = Object.values(characterXP).flatMap(c => c.rolls || []);
                      const aciertosTotales = allRolls.filter(r => r.exito).length;
                      const fallosTotales = allRolls.length - aciertosTotales;
                      const groupMult = calculateGroupMultiplier(aciertosTotales, fallosTotales);
                      const pxTiradasBruto = memberXP.total || 0;
                      const pxTiradasAjustado = Math.floor(pxTiradasBruto * groupMult.multiplicador);
                      
                      // Total = PX viaje (repartido) + PX tiradas ajustadas. Mínimo 0 por PJ.
                      const totalPXBruto = pxPerMemberFromJourney + pxTiradasAjustado;
                      const totalPXForMember = Math.max(0, totalPXBruto);
                      
                      return (
                        <Card key={member.id} className={`p-4 ${pxApplied ? 'bg-green-600/20 border-green-400' : 'bg-green-900/20 border-green-500/30'}`}>
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-bold text-[hsl(var(--gold))]">{member.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.papeles.map(p => ROLE_INFO[p]?.nombre).join(', ')}
                              </p>
                              {hasMultiple && (
                                <p className="text-xs text-yellow-400">⚠️ Múltiples papeles: -5</p>
                              )}
                              {/* PX breakdown */}
                              <div className="text-xs mt-2 space-y-0.5">
                                <p className="text-[hsl(var(--magic-blue))]">
                                  Viaje: +{pxPerMemberFromJourney}
                                </p>
                                <p className={pxTiradasBruto >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  Tiradas ({rollCount}): {pxTiradasBruto >= 0 ? '+' : ''}{pxTiradasBruto}
                                  {rollCount > 0 && (
                                    <span className="text-muted-foreground ml-1">
                                      ({successCount}✓ {failCount}✗)
                                    </span>
                                  )}
                                </p>
                                {groupMult.multiplicador !== 1 && (
                                  <p className="text-[hsl(var(--magic-blue))]">
                                    × {groupMult.multiplicador} (grupo {groupMult.tendencia.replace('_', ' ')}) = {pxTiradasAjustado >= 0 ? '+' : ''}{pxTiradasAjustado}
                                  </p>
                                )}
                                {totalPXBruto < 0 && (
                                  <p className="text-yellow-400 text-[10px]">
                                    Ajustado a 0 (mínimo)
                                  </p>
                                )}
                              </div>
                              {memberResult && pxApplied && (
                                <p className="text-xs text-green-400 mt-1">
                                  XP Total: {memberResult.xp_nuevo}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className={`text-3xl font-bold ${totalPXForMember >= 0 ? (pxApplied ? 'text-green-300' : 'text-green-400') : 'text-red-400'}`}>
                                {pxApplied ? '✓' : '+'}{totalPXForMember}
                              </p>
                              <p className="text-xs text-muted-foreground">PX</p>
                            </div>
                          </div>
                          {/* Individual roll breakdown */}
                          {!pxApplied && memberXP.rolls?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-white">
                                Ver desglose tiradas
                              </summary>
                              <div className="mt-1 max-h-24 overflow-y-auto text-xs space-y-1 bg-black/20 p-2 rounded">
                                {memberXP.rolls.map((roll, idx) => (
                                  <div key={idx} className={`flex justify-between ${roll.exito ? 'text-green-400' : 'text-red-400'}`}>
                                    <span>
                                      {roll.type === 'orientacion' ? '🧭' : '⚔️'} 
                                      {roll.tirada} vs CD{roll.cd}
                                      {roll.critico && ' 🎉'}
                                      {roll.pifia && ' 💀'}
                                    </span>
                                    <span className="font-bold">
                                      {roll.pxFinal >= 0 ? '+' : ''}{roll.pxFinal}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                  
                  {/* Summary of total XP earned */}
                  <div className="mt-4 p-3 bg-black/30 rounded text-sm">
                    <p className="font-bold mb-2 text-[hsl(var(--gold))]">Resumen:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-muted-foreground">
                        <p>PX base viaje: {journeyBasePX}</p>
                        <p>Total tiradas: {Object.values(characterXP).reduce((sum, c) => sum + (c.rolls?.length || 0), 0)}</p>
                        <p>Éxitos: {Object.values(characterXP).reduce((sum, c) => sum + (c.rolls?.filter(r => r.exito).length || 0), 0)} | Fracasos: {Object.values(characterXP).reduce((sum, c) => sum + (c.rolls?.filter(r => !r.exito).length || 0), 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">PX tiradas grupo: {Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0)}</p>
                        <p className="font-medium text-white">
                          PX Total Grupo: {journeyBasePX + Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
            
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
                      {/* Show exhaustion effect for this character */}
                      {result.niveles_cansancio > 0 && (
                        <div className="mt-2 p-2 bg-black/30 rounded text-xs">
                          <p className="font-bold text-yellow-400 mb-1">Efectos del cansancio:</p>
                          {result.niveles_cansancio >= 1 && <p>• Nivel 1: Desventaja en pruebas de característica</p>}
                          {result.niveles_cansancio >= 2 && <p>• Nivel 2: Velocidad reducida a la mitad</p>}
                          {result.niveles_cansancio >= 3 && <p>• Nivel 3: Desventaja en ataques y salvaciones</p>}
                          {result.niveles_cansancio >= 4 && <p>• Nivel 4: PG máximos reducidos a la mitad</p>}
                          {result.niveles_cansancio >= 5 && <p className="text-red-400">• Nivel 5: Velocidad reducida a 0</p>}
                          {result.niveles_cansancio >= 6 && <p className="text-red-600 font-bold">• Nivel 6: MUERTE</p>}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            
            {/* Exhaustion Reference Table */}
            <div className="mt-4 p-3 bg-black/20 rounded">
              <p className="font-bold text-sm mb-2 text-[hsl(var(--gold))]">Referencia: Niveles de Cansancio</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex justify-between p-1 bg-yellow-900/30 rounded">
                  <span>Nivel 1</span>
                  <span className="text-muted-foreground">Desventaja en pruebas</span>
                </div>
                <div className="flex justify-between p-1 bg-yellow-900/40 rounded">
                  <span>Nivel 2</span>
                  <span className="text-muted-foreground">Velocidad ½</span>
                </div>
                <div className="flex justify-between p-1 bg-orange-900/40 rounded">
                  <span>Nivel 3</span>
                  <span className="text-muted-foreground">Desv. ataques/salv.</span>
                </div>
                <div className="flex justify-between p-1 bg-orange-900/50 rounded">
                  <span>Nivel 4</span>
                  <span className="text-muted-foreground">PG máx. ½</span>
                </div>
                <div className="flex justify-between p-1 bg-red-900/50 rounded">
                  <span>Nivel 5</span>
                  <span className="text-muted-foreground">Velocidad 0</span>
                </div>
                <div className="flex justify-between p-1 bg-red-900/70 rounded">
                  <span>Nivel 6</span>
                  <span className="text-red-400 font-bold">Muerte</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <p><strong>Recuperación:</strong> Un descanso largo reduce 1 nivel (si come y bebe).</p>
                <p><strong>Acumulación:</strong> Los efectos son acumulativos.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Food and Water Consumption */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-lg text-blue-400">
              <Package className="w-5 h-5 inline mr-2" />
              Provisiones Consumidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const numPersonajes = config.miembros.filter(m => m.papeles?.length > 0).length || 1;
              const diasViaje = diasFinales || 1;
              const comidaTotal = numPersonajes * diasViaje * 0.5; // 500g = 0.5kg per day
              const aguaTotal = numPersonajes * diasViaje * 4; // 4L per day
              
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-amber-900/20 p-4 rounded border border-amber-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🍞</span>
                        <span className="font-bold text-amber-400">Comida</span>
                      </div>
                      <p className="text-2xl font-bold">{comidaTotal.toFixed(1)} kg</p>
                      <p className="text-xs text-muted-foreground">
                        {numPersonajes} personas × {diasViaje} días × 0.5 kg/día
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        (500g por persona y día)
                      </p>
                    </div>
                    <div className="bg-blue-900/20 p-4 rounded border border-blue-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">💧</span>
                        <span className="font-bold text-blue-400">Agua</span>
                      </div>
                      <p className="text-2xl font-bold">{aguaTotal} L</p>
                      <p className="text-xs text-muted-foreground">
                        {numPersonajes} personas × {diasViaje} días × 4 L/día
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        (8L en calor intenso)
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-black/30 rounded text-xs">
                    <p className="font-bold text-[hsl(var(--gold))] mb-2">Reglas de Supervivencia:</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p><strong>Sin comida:</strong> Aguanta 3 + mod. CON días. Después, +1 nivel de cansancio/día.</p>
                      <p><strong>Media ración (250g):</strong> Cuenta como medio día sin comer.</p>
                      <p><strong>Mitad de agua:</strong> Prueba CON CD 15 o +1 cansancio.</p>
                      <p><strong>Sin agua:</strong> +1 cansancio automático (+2 si ya está cansado).</p>
                    </div>
                  </div>
                </div>
              );
            })()}
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
                data-testid="print-chronicle-btn"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Crónica
              </Button>
              
              <label className="flex items-center gap-2 px-3 py-2 border border-[hsl(var(--gold))]/30 rounded bg-black/20 cursor-pointer text-xs" data-testid="include-diary-pdf-toggle">
                <input
                  type="checkbox"
                  checked={includeChronicleInPDF}
                  onChange={(e) => setIncludeChronicleInPDF(e.target.checked)}
                  className="accent-[hsl(var(--gold))]"
                />
                <span>
                  Incluir Crónica en PDF
                  {journeyChronicle && (
                    <span className="ml-1 text-[hsl(var(--gold))] font-bold">✓</span>
                  )}
                </span>
              </label>
              
              <Button 
                onClick={() => {
                  const debugData = {
                    timestamp: new Date().toISOString(),
                    journey: {
                      origen: config.origenNombre,
                      destino: config.destinoNombre,
                      origen_id: config.origenId,
                      destino_id: config.destinoId,
                      preferir_caminos: config.preferirCaminos,
                      evitar_sombra: config.evitarSombra,
                      estacion: config.estacion,
                      ritmo: config.ritmo
                    },
                    calculation_result: journeyCalc,
                    events: events.map(e => ({
                      casilla: e.casilla,
                      evento_nombre: e.evento?.nombre,
                      resuelto: e.resuelto,
                      exito: e.exito,
                      tirada: e.tirada,
                      orientacion: e.orientacion
                    })),
                    orientation_checks: orientationChecks,
                    positions: {
                      current: currentPosition,
                      next_event: nextEventPosition
                    }
                  };
                  
                  const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `viaje_debug_${config.origenNombre}_${config.destinoNombre}_${Date.now()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success('Debug JSON exportado');
                }}
                variant="outline"
                className="flex-1"
                title="Exportar datos del viaje para depuración"
              >
                <FileText className="w-4 h-4 mr-2" />
                Exportar Debug
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
      
      {/* Camp Dialog */}
      <CampDialog
        open={showCampDialog}
        onClose={() => setShowCampDialog(false)}
        miembros={config.miembros}
        characters={characters}
        activeJourney={activeJourney}
        region={journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes'}
        partyProvisions={partyProvisions}
        setPartyProvisions={setPartyProvisions}
        setCharacters={setCharacters}
        travelEvents={travelEvents}
        onJourneyUpdate={(patch) => setActiveJourney((prev) => (prev ? { ...prev, ...patch } : prev))}
      />
      
      {/* Provisions Shop Dialog */}
      <ProvisionsShopDialog
        open={showProvisionsShop}
        onClose={() => setShowProvisionsShop(false)}
        miembros={config.miembros}
        characters={characters}
        diasViaje={journeyCalc?.estimaciones?.dias_estimados || activeJourney?.config?.dias_estimados || 7}
        origenRegionName={(locations || []).find(l => l.id === config.origenId)?.region || ''}
        terreno={journeyCalc?.ruta?.terreno || ''}
        tipoTierra={journeyCalc?.ruta?.tipo_tierra || ''}
        numeroAnimales={config.miembros.filter(m => (m.montura || m.tieneCaballo || m.tienePoni)).length}
        onPurchaseComplete={() => {
          // Reload characters to reflect new inventory/money
          api.get('/characters/').then(res => {
            if (res.data?.characters) setCharacters(res.data.characters);
          }).catch(err => console.error(err));
        }}
      />

      {/* Sauron's Eye overlay during automated journey */}
      <SauronEyeOverlay
        visible={autoRunning}
        percent={autoProgress}
        message={autoMessage}
        subtitle={autoSubtitle}
        onCancel={() => { autoStopRef.current = true; }}
      />
    </div>
  );
};

export default EnhancedTravelSystem;

