/**
 * Path Debugger - Interactive tool to analyze pathfinding decisions
 * Shows step-by-step explanation of the A* algorithm
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ZoomIn, ZoomOut, Play, RotateCcw, ChevronRight, ChevronLeft, MapPin, Route, AlertTriangle, CheckCircle, XCircle, Footprints, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

// Map dimensions  
const MAP_PIXEL_WIDTH = 19791;
const MAP_PIXEL_HEIGHT = 15133;
const PLAYER_MAP_URL = '/mapa_jugadores.jpg';

// Decision type colors and icons
const DECISION_CONFIG = {
  'INICIO': { color: '#22c55e', bgColor: 'bg-green-900/30', icon: MapPin, label: 'Inicio' },
  'LLEGADA': { color: '#3b82f6', bgColor: 'bg-blue-900/30', icon: CheckCircle, label: 'Llegada' },
  'SEGUIR_CAMINO': { color: '#c9a227', bgColor: 'bg-yellow-900/30', icon: Route, label: 'Seguir Camino' },
  'IR_A_CAMINO': { color: '#f59e0b', bgColor: 'bg-amber-900/30', icon: Navigation, label: 'Ir a Camino' },
  'CAMPO_TRAVES': { color: '#8b5cf6', bgColor: 'bg-purple-900/30', icon: Footprints, label: 'Campo Través' },
  'EVITAR': { color: '#ef4444', bgColor: 'bg-red-900/30', icon: AlertTriangle, label: 'Evitar' },
  'DIRECTO': { color: '#6b7280', bgColor: 'bg-gray-900/30', icon: ChevronRight, label: 'Directo' },
};

// Land type colors
const LAND_TYPE_COLORS = {
  'tierras_libres': '#22c55e',
  'tierras_fronterizas': '#eab308', 
  'tierras_salvajes': '#f97316',
  'tierras_sombra': '#dc2626',
  'tierras_oscuras': '#581c87',
};

// Terrain colors
const TERRAIN_COLORS = {
  'facil': '#86efac',
  'moderado': '#fde047',
  'dificil': '#fb923c',
  'muy_dificil': '#f87171',
  'desalentador': '#dc2626',
  'infranqueable': '#1f2937',
  'agua': '#3b82f6',
};

const PathDebugger = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(0.05);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Data
  const [locations, setLocations] = useState([]);
  const [roads, setRoads] = useState([]);
  
  // Debug state
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [pasoKm, setPasoKm] = useState(10);
  const [preferirCaminos, setPreferirCaminos] = useState(true);
  const [evitarSombra, setEvitarSombra] = useState(false);
  const [evitarOscuras, setEvitarOscuras] = useState(false);
  
  // Results
  const [debugResult, setDebugResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  
  // Group locations by region
  const locationsByRegion = locations.reduce((acc, loc) => {
    const region = loc.region || 'Otras';
    if (!acc[region]) acc[region] = [];
    acc[region].push(loc);
    return acc;
  }, {});

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locsRes, roadsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/data/roads')
        ]);
        
        if (locsRes.data) {
          const locs = locsRes.data.locations || locsRes.data || [];
          setLocations(locs.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
        }
        if (roadsRes.data) {
          setRoads(roadsRes.data.roads || roadsRes.data || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Error cargando datos del mapa');
      }
    };
    fetchData();
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (!autoPlay || !debugResult) return;
    
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= debugResult.pasos.length - 1) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    
    return () => clearInterval(interval);
  }, [autoPlay, debugResult]);

  // Mouse handlers
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(2, Math.max(0.02, z * zoomFactor)));
  }, []);

  // Run debug analysis
  const runDebug = async () => {
    if (!selectedOrigin || !selectedDestination) {
      toast.error('Selecciona origen y destino');
      return;
    }
    
    const originLoc = locations.find(l => l.nombre === selectedOrigin);
    const destLoc = locations.find(l => l.nombre === selectedDestination);
    
    if (!originLoc || !destLoc) {
      toast.error('Ubicaciones no encontradas');
      return;
    }
    
    setIsLoading(true);
    setDebugResult(null);
    setCurrentStep(0);
    
    try {
      const response = await api.post('/travel/debug-pathfinding', {
        origen_nombre: selectedOrigin,
        destino_nombre: selectedDestination,
        paso_km: pasoKm,
        preferir_caminos: preferirCaminos,
        evitar_tierras_oscuras: evitarOscuras,
        evitar_tierras_sombra: evitarSombra,
        max_pasos: 100
      });
      
      if (response.data.error) {
        toast.error(response.data.error);
        return;
      }
      
      setDebugResult(response.data);
      toast.success(`Análisis completado: ${response.data.resumen?.total_pasos || 0} pasos`);
      
      // Center map on origin
      if (originLoc) {
        const mapX = (originLoc.x / 100) * MAP_PIXEL_WIDTH;
        const mapY = MAP_PIXEL_HEIGHT - (originLoc.y / 100) * MAP_PIXEL_HEIGHT;
        setPan({ x: -mapX * zoom + 400, y: -mapY * zoom + 300 });
      }
    } catch (err) {
      console.error('Debug error:', err);
      toast.error('Error al ejecutar análisis');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset analysis
  const resetDebug = () => {
    setDebugResult(null);
    setCurrentStep(0);
    setAutoPlay(false);
  };

  // Navigate steps
  const goToStep = (step) => {
    if (!debugResult) return;
    setCurrentStep(Math.max(0, Math.min(step, debugResult.pasos.length - 1)));
    setAutoPlay(false);
  };

  // Get current step data
  const currentStepData = debugResult?.pasos?.[currentStep];

  // Render roads
  const renderRoads = () => {
    return roads.map((road, idx) => {
      const puntos = road.puntos || road.path || [];
      if (puntos.length < 2) return null;
      
      const pathD = puntos.map((p, i) => {
        const x = ((p.x || p[0]) / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - ((p.y || p[1]) / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      const roadColor = road.tipo === 'real' ? '#c9a227' : road.tipo === 'secundario' ? '#a0845c' : '#8B7355';
      const width = road.tipo === 'real' ? 50 : road.tipo === 'secundario' ? 35 : 25;
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={roadColor}
          strokeWidth={width}
          strokeOpacity={0.5}
          strokeLinecap="round"
          strokeDasharray={road.tipo === 'sendero' ? '60,30' : 'none'}
        />
      );
    });
  };

  // Render debug path
  const renderDebugPath = () => {
    if (!debugResult?.pasos) return null;
    
    const visibleSteps = debugResult.pasos.slice(0, currentStep + 1);
    if (visibleSteps.length < 1) return null;
    
    // Draw path line
    const pathD = visibleSteps.map((step, i) => {
      const x = (step.posicion.x / 100) * MAP_PIXEL_WIDTH;
      const y = MAP_PIXEL_HEIGHT - (step.posicion.y / 100) * MAP_PIXEL_HEIGHT;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return (
      <g>
        {/* Main path line */}
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={30}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        
        {/* Step markers */}
        {visibleSteps.map((step, i) => {
          const x = (step.posicion.x / 100) * MAP_PIXEL_WIDTH;
          const y = MAP_PIXEL_HEIGHT - (step.posicion.y / 100) * MAP_PIXEL_HEIGHT;
          const config = DECISION_CONFIG[step.decision] || DECISION_CONFIG['DIRECTO'];
          const isCurrentStep = i === currentStep;
          
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              {/* Step circle */}
              <circle
                r={isCurrentStep ? 120 : 60}
                fill={config.color}
                stroke="#fff"
                strokeWidth={isCurrentStep ? 30 : 15}
                opacity={isCurrentStep ? 1 : 0.7}
              />
              {/* Step number */}
              {zoom > 0.06 && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={isCurrentStep ? 100 : 70}
                  fontWeight="bold"
                >
                  {step.paso}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Destination marker (if not reached yet) */}
        {debugResult.pasos[debugResult.pasos.length - 1]?.decision !== 'LLEGADA' && (
          (() => {
            const destLoc = locations.find(l => l.nombre === selectedDestination);
            if (!destLoc) return null;
            const x = (destLoc.x / 100) * MAP_PIXEL_WIDTH;
            const y = MAP_PIXEL_HEIGHT - (destLoc.y / 100) * MAP_PIXEL_HEIGHT;
            return (
              <g transform={`translate(${x}, ${y})`}>
                <circle r={100} fill="none" stroke="#ef4444" strokeWidth={30} strokeDasharray="50,25" />
                <circle r={40} fill="#ef4444" />
              </g>
            );
          })()
        )}
      </g>
    );
  };

  // Render location markers
  const renderLocations = () => {
    if (zoom < 0.05) return null;
    
    return locations.slice(0, 100).map(loc => {
      const x = (loc.x / 100) * MAP_PIXEL_WIDTH;
      const y = MAP_PIXEL_HEIGHT - (loc.y / 100) * MAP_PIXEL_HEIGHT;
      const isOrigin = loc.nombre === selectedOrigin;
      const isDestination = loc.nombre === selectedDestination;
      
      if (!isOrigin && !isDestination && zoom < 0.08) return null;
      
      return (
        <g key={loc._id || loc.nombre} transform={`translate(${x}, ${y})`}>
          <circle
            r={isOrigin || isDestination ? 80 : 40}
            fill={isOrigin ? '#22c55e' : isDestination ? '#ef4444' : '#c9a227'}
            opacity={0.8}
          />
          {zoom > 0.06 && (
            <text
              y={120}
              textAnchor="middle"
              fill="#fff"
              fontSize={100}
              fontWeight="bold"
              stroke="#000"
              strokeWidth={20}
              paintOrder="stroke"
            >
              {loc.nombre}
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--parchment-dark))] flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[hsl(var(--gold))]/20 bg-black/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Inicio
            </Button>
            <h1 className="text-lg font-bold text-[hsl(var(--gold))]">
              Depurador de Rutas
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.02, z * 0.8))} data-testid="zoom-out-btn">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs w-14 text-center" data-testid="zoom-level">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z * 1.25))} data-testid="zoom-in-btn">
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-[hsl(var(--gold))]/20 bg-black/30 p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Configuration */}
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Route className="w-4 h-4" />
                Configuración del Análisis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Origin */}
              <div>
                <Label className="text-xs">Origen</Label>
                <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                  <SelectTrigger className="h-8 text-xs" data-testid="origin-select">
                    <SelectValue placeholder="Seleccionar origen..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Object.entries(locationsByRegion).map(([region, locs]) => (
                      <React.Fragment key={region}>
                        <div className="px-2 py-1 text-xs font-bold text-muted-foreground bg-black/20">
                          {region}
                        </div>
                        {locs.map(loc => (
                          <SelectItem key={loc.nombre} value={loc.nombre} className="text-xs">
                            {loc.nombre}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Destination */}
              <div>
                <Label className="text-xs">Destino</Label>
                <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar destino..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Object.entries(locationsByRegion).map(([region, locs]) => (
                      <React.Fragment key={region}>
                        <div className="px-2 py-1 text-xs font-bold text-muted-foreground bg-black/20">
                          {region}
                        </div>
                        {locs.map(loc => (
                          <SelectItem key={loc.nombre} value={loc.nombre} className="text-xs">
                            {loc.nombre}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Step size */}
              <div>
                <Label className="text-xs">Paso (km)</Label>
                <Input
                  type="number"
                  value={pasoKm}
                  onChange={(e) => setPasoKm(Number(e.target.value))}
                  min={1}
                  max={50}
                  className="h-8 text-xs"
                />
              </div>
              
              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Preferir caminos</Label>
                  <Switch checked={preferirCaminos} onCheckedChange={setPreferirCaminos} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Evitar Tierras de Sombra</Label>
                  <Switch checked={evitarSombra} onCheckedChange={setEvitarSombra} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Evitar Tierras Oscuras</Label>
                  <Switch checked={evitarOscuras} onCheckedChange={setEvitarOscuras} />
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1 btn-gold text-xs h-8" 
                  onClick={runDebug}
                  disabled={isLoading || !selectedOrigin || !selectedDestination}
                >
                  <Play className="w-3 h-3 mr-1" />
                  {isLoading ? 'Analizando...' : 'Analizar'}
                </Button>
                {debugResult && (
                  <Button variant="outline" size="sm" onClick={resetDebug}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Results Summary */}
          {debugResult && (
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-black/30 p-2 rounded">
                    <p className="text-lg font-bold text-[hsl(var(--gold))]">{debugResult.resumen?.total_pasos || 0}</p>
                    <p className="text-xs text-muted-foreground">Pasos</p>
                  </div>
                  <div className="bg-black/30 p-2 rounded">
                    <p className="text-lg font-bold text-blue-400">{debugResult.resumen?.distancia_total_km || 0}</p>
                    <p className="text-xs text-muted-foreground">km total</p>
                  </div>
                </div>
                <div className="text-xs text-center text-muted-foreground">
                  Línea recta: {debugResult.resumen?.distancia_linea_recta_km || 0} km
                  <br />
                  <span className={debugResult.resumen?.distancia_total_km > debugResult.resumen?.distancia_linea_recta_km * 1.2 ? 'text-amber-400' : 'text-green-400'}>
                    {((debugResult.resumen?.distancia_total_km / debugResult.resumen?.distancia_linea_recta_km - 1) * 100).toFixed(0)}% desvío
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Step Navigator */}
          {debugResult && (
            <Card className="card-parchment flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Paso {currentStep + 1} de {debugResult.pasos?.length || 0}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 0}>
                      <ChevronLeft className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant={autoPlay ? 'default' : 'ghost'} onClick={() => setAutoPlay(!autoPlay)}>
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => goToStep(currentStep + 1)} disabled={currentStep >= (debugResult.pasos?.length || 1) - 1}>
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentStepData && (
                  <div className={`p-3 rounded border ${DECISION_CONFIG[currentStepData.decision]?.bgColor || 'bg-gray-900/30'} border-${DECISION_CONFIG[currentStepData.decision]?.color}/30`}>
                    {/* Decision badge */}
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(DECISION_CONFIG[currentStepData.decision]?.icon || ChevronRight, {
                        className: 'w-4 h-4',
                        style: { color: DECISION_CONFIG[currentStepData.decision]?.color }
                      })}
                      <Badge style={{ backgroundColor: DECISION_CONFIG[currentStepData.decision]?.color }}>
                        {DECISION_CONFIG[currentStepData.decision]?.label || currentStepData.decision}
                      </Badge>
                    </div>
                    
                    {/* Reason */}
                    <p className="text-sm mb-2">{currentStepData.razon}</p>
                    
                    {/* Details */}
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Posición:</span>
                        <span>({currentStepData.posicion?.x}, {currentStepData.posicion?.y})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Distancia:</span>
                        <span>{currentStepData.distancia_destino_km} km</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Terreno:</span>
                        <Badge variant="outline" style={{ borderColor: TERRAIN_COLORS[currentStepData.terreno] }}>
                          {currentStepData.terreno}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Tierra:</span>
                        <Badge variant="outline" style={{ borderColor: LAND_TYPE_COLORS[currentStepData.tipo_tierra] }}>
                          {currentStepData.tipo_tierra?.replace('tierras_', '')}
                        </Badge>
                      </div>
                      {currentStepData.en_camino && (
                        <div className="col-span-2 flex items-center gap-1">
                          <span className="text-muted-foreground">Camino:</span>
                          <Badge className="bg-amber-600">{currentStepData.en_camino}</Badge>
                          {currentStepData.tipo_camino && (
                            <span className="text-xs text-muted-foreground">({currentStepData.tipo_camino})</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Alternatives discarded */}
                    {currentStepData.alternativas_descartadas?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="text-[10px] text-muted-foreground mb-1">Alternativas descartadas:</p>
                        <ul className="text-[10px] text-amber-500/70 list-disc list-inside">
                          {currentStepData.alternativas_descartadas.map((alt, i) => (
                            <li key={i}>{alt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Step list */}
                <ScrollArea className="h-40 mt-3">
                  <div className="space-y-1">
                    {debugResult.pasos?.map((step, i) => (
                      <button
                        key={i}
                        onClick={() => goToStep(i)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors ${
                          i === currentStep 
                            ? 'bg-blue-600/30 border border-blue-500' 
                            : i < currentStep
                            ? 'bg-black/20 opacity-70'
                            : 'bg-black/10 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">#{step.paso}</span>
                          <Badge 
                            variant="outline" 
                            className="text-[10px]"
                            style={{ borderColor: DECISION_CONFIG[step.decision]?.color }}
                          >
                            {DECISION_CONFIG[step.decision]?.label || step.decision}
                          </Badge>
                        </div>
                        {step.en_camino && (
                          <span className="text-amber-400 text-[10px]">🛤️ {step.en_camino}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Map */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-[#1a1a1a]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          data-testid="map-container"
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              width: MAP_PIXEL_WIDTH,
              height: MAP_PIXEL_HEIGHT,
              position: 'relative',
            }}
          >
            {/* Map background as img for better performance */}
            <img
              src={PLAYER_MAP_URL}
              alt="Mapa de la Tierra Media"
              style={{
                width: MAP_PIXEL_WIDTH,
                height: MAP_PIXEL_HEIGHT,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
            
            {/* SVG overlay for paths and markers */}
            <svg
              width={MAP_PIXEL_WIDTH}
              height={MAP_PIXEL_HEIGHT}
              viewBox={`0 0 ${MAP_PIXEL_WIDTH} ${MAP_PIXEL_HEIGHT}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              }}
            >
            
            {/* Roads (dimmed) */}
            <g opacity={0.4}>
              {renderRoads()}
            </g>
            
            {/* Debug path */}
            {renderDebugPath()}
            
            {/* Location markers */}
            {renderLocations()}
            </svg>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-2 bg-black/40 border-t border-[hsl(var(--gold))]/20 text-center text-xs text-muted-foreground">
        {debugResult 
          ? `Ruta de ${debugResult.origen} a ${debugResult.destino} | Usa ◀ ▶ para navegar entre pasos`
          : 'Selecciona origen y destino, luego pulsa "Analizar" para ver las decisiones del algoritmo'
        }
      </div>
    </div>
  );
};

export default PathDebugger;
