/**
 * Path Debugger - Interactive tool to analyze and correct pathfinding decisions
 * Shows step-by-step explanation of the algorithm with correction capabilities
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ZoomIn, ZoomOut, Play, RotateCcw, ChevronRight, ChevronLeft, MapPin, Route, AlertTriangle, CheckCircle, XCircle, Footprints, Navigation, Copy, Download, Crosshair, Flag } from 'lucide-react';
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
  
  // CORRECTION MODE STATE
  const [correctionMode, setCorrectionMode] = useState(false);
  const [corrections, setCorrections] = useState({}); // { stepNumber: { correctPosition: {x, y}, comment: string } }
  const [selectedStepForCorrection, setSelectedStepForCorrection] = useState(null);
  const [correctionComment, setCorrectionComment] = useState('');
  const [suggestedPosition, setSuggestedPosition] = useState(null);
  
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

  // Convert screen coordinates to map percentage coordinates
  const screenToMapCoords = (screenX, screenY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    
    // Get position relative to container
    const relX = screenX - rect.left;
    const relY = screenY - rect.top;
    
    // Account for pan and zoom
    const mapX = (relX - pan.x) / zoom;
    const mapY = (relY - pan.y) / zoom;
    
    // Convert to percentage (0-100)
    const percentX = (mapX / MAP_PIXEL_WIDTH) * 100;
    const percentY = 100 - (mapY / MAP_PIXEL_HEIGHT) * 100; // Invert Y
    
    return { x: Math.round(percentX * 100) / 100, y: Math.round(percentY * 100) / 100 };
  };

  // Mouse handlers
  const handleMouseDown = (e) => {
    if (correctionMode && selectedStepForCorrection !== null) {
      // In correction mode, clicking sets the suggested position
      const coords = screenToMapCoords(e.clientX, e.clientY);
      if (coords && coords.x >= 0 && coords.x <= 100 && coords.y >= 0 && coords.y <= 100) {
        setSuggestedPosition(coords);
        toast.success(`Posición sugerida: (${coords.x}, ${coords.y})`);
      }
      return;
    }
    
    if (e.button === 0) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && !correctionMode) {
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
    setCorrections({});
    setCorrectionMode(false);
    
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
    setCorrections({});
    setCorrectionMode(false);
  };

  // Navigate steps
  const goToStep = (step) => {
    if (!debugResult) return;
    setCurrentStep(Math.max(0, Math.min(step, debugResult.pasos.length - 1)));
    setAutoPlay(false);
  };

  // Mark step for correction
  const startCorrectionForStep = (stepNum) => {
    setSelectedStepForCorrection(stepNum);
    setCorrectionMode(true);
    setSuggestedPosition(null);
    setCorrectionComment(corrections[stepNum]?.comment || '');
    toast.info('Haz clic en el mapa para indicar la posición correcta');
  };

  // Save correction
  const saveCorrection = () => {
    if (selectedStepForCorrection === null) return;
    
    const newCorrections = { ...corrections };
    newCorrections[selectedStepForCorrection] = {
      correctPosition: suggestedPosition,
      comment: correctionComment,
      originalPosition: debugResult?.pasos?.[selectedStepForCorrection]?.posicion,
      originalDecision: debugResult?.pasos?.[selectedStepForCorrection]?.decision,
    };
    setCorrections(newCorrections);
    
    setSelectedStepForCorrection(null);
    setCorrectionMode(false);
    setSuggestedPosition(null);
    setCorrectionComment('');
    toast.success('Corrección guardada');
  };

  // Cancel correction
  const cancelCorrection = () => {
    setSelectedStepForCorrection(null);
    setCorrectionMode(false);
    setSuggestedPosition(null);
    setCorrectionComment('');
  };

  // Remove correction
  const removeCorrection = (stepNum) => {
    const newCorrections = { ...corrections };
    delete newCorrections[stepNum];
    setCorrections(newCorrections);
    toast.info('Corrección eliminada');
  };

  // Generate log report
  const generateReport = () => {
    if (!debugResult) return '';
    
    const correctionsList = Object.entries(corrections);
    
    let report = `=== INFORME DE DEPURACIÓN DE RUTA ===\n`;
    report += `Fecha: ${new Date().toLocaleString('es-ES')}\n\n`;
    report += `RUTA: ${debugResult.origen} → ${debugResult.destino}\n`;
    report += `Configuración:\n`;
    report += `  - Paso: ${debugResult.configuracion?.paso_km || pasoKm} km\n`;
    report += `  - Preferir caminos: ${debugResult.configuracion?.preferir_caminos ? 'Sí' : 'No'}\n`;
    report += `  - Evitar sombra: ${debugResult.configuracion?.evitar_tierras_sombra ? 'Sí' : 'No'}\n`;
    report += `  - Evitar oscuras: ${debugResult.configuracion?.evitar_tierras_oscuras ? 'Sí' : 'No'}\n\n`;
    
    report += `RESUMEN:\n`;
    report += `  - Total pasos: ${debugResult.resumen?.total_pasos || 0}\n`;
    report += `  - Distancia total: ${debugResult.resumen?.distancia_total_km || 0} km\n`;
    report += `  - Línea recta: ${debugResult.resumen?.distancia_linea_recta_km || 0} km\n\n`;
    
    if (correctionsList.length > 0) {
      report += `=== CORRECCIONES SUGERIDAS (${correctionsList.length}) ===\n\n`;
      
      correctionsList.forEach(([stepNum, correction]) => {
        const step = debugResult.pasos?.[parseInt(stepNum)];
        report += `--- PASO ${stepNum} ---\n`;
        report += `Posición actual: (${correction.originalPosition?.x}, ${correction.originalPosition?.y})\n`;
        report += `Decisión: ${correction.originalDecision}\n`;
        if (step?.razon) report += `Razón: ${step.razon}\n`;
        if (step?.terreno) report += `Terreno: ${step.terreno}\n`;
        if (step?.tipo_tierra) report += `Tipo tierra: ${step.tipo_tierra}\n`;
        if (step?.en_camino) report += `En camino: ${step.en_camino}\n`;
        report += `\n`;
        if (correction.correctPosition) {
          report += `⚠️ CORRECCIÓN SUGERIDA:\n`;
          report += `  Posición correcta: (${correction.correctPosition.x}, ${correction.correctPosition.y})\n`;
        }
        if (correction.comment) {
          report += `  Comentario: ${correction.comment}\n`;
        }
        report += `\n`;
      });
    } else {
      report += `=== SIN CORRECCIONES ===\n`;
      report += `Todos los pasos parecen correctos.\n\n`;
    }
    
    report += `=== TODOS LOS PASOS ===\n\n`;
    debugResult.pasos?.forEach((step, i) => {
      const hasCorrection = corrections[i];
      report += `[${i}] ${hasCorrection ? '❌' : '✓'} (${step.posicion?.x}, ${step.posicion?.y}) - ${step.decision}`;
      if (step.en_camino) report += ` [${step.en_camino}]`;
      report += `\n`;
      report += `    ${step.razon}\n`;
      if (hasCorrection) {
        report += `    → CORREGIR A: (${hasCorrection.correctPosition?.x || '?'}, ${hasCorrection.correctPosition?.y || '?'})\n`;
        if (hasCorrection.comment) report += `    → ${hasCorrection.comment}\n`;
      }
    });
    
    return report;
  };

  // Copy report to clipboard
  const copyReport = () => {
    const report = generateReport();
    navigator.clipboard.writeText(report).then(() => {
      toast.success('Informe copiado al portapapeles');
    }).catch(() => {
      toast.error('Error al copiar');
    });
  };

  // Download report
  const downloadReport = () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-ruta-${selectedOrigin}-${selectedDestination}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Informe descargado');
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
      
      const roadColor = road.tipo === 'real' || road.tipo === 'grande' ? '#c9a227' : 
                        road.tipo === 'secundario' || road.tipo === 'mayor' ? '#a0845c' : '#8B7355';
      const width = road.tipo === 'real' || road.tipo === 'grande' ? 50 : 
                    road.tipo === 'secundario' || road.tipo === 'mayor' ? 35 : 25;
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={roadColor}
          strokeWidth={width}
          strokeOpacity={0.5}
          strokeLinecap="round"
          strokeDasharray={road.tipo === 'sendero' || road.tipo === 'senda' ? '60,30' : 'none'}
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
          const hasCorrection = corrections[i];
          
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              {/* Step circle */}
              <circle
                r={isCurrentStep ? 120 : 60}
                fill={hasCorrection ? '#ef4444' : config.color}
                stroke={hasCorrection ? '#ff0000' : '#fff'}
                strokeWidth={isCurrentStep ? 30 : 15}
                opacity={isCurrentStep ? 1 : 0.7}
              />
              {/* Correction X mark */}
              {hasCorrection && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={80}
                  fontWeight="bold"
                >
                  ✗
                </text>
              )}
              {/* Step number */}
              {!hasCorrection && zoom > 0.06 && (
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
        
        {/* Suggested position marker */}
        {correctionMode && suggestedPosition && (
          <g transform={`translate(${(suggestedPosition.x / 100) * MAP_PIXEL_WIDTH}, ${MAP_PIXEL_HEIGHT - (suggestedPosition.y / 100) * MAP_PIXEL_HEIGHT})`}>
            <circle r={100} fill="none" stroke="#00ff00" strokeWidth={40} strokeDasharray="50,25" />
            <circle r={40} fill="#00ff00" />
            <text y={180} textAnchor="middle" fill="#00ff00" fontSize={80} fontWeight="bold">
              AQUÍ
            </text>
          </g>
        )}
        
        {/* Correction markers */}
        {Object.entries(corrections).map(([stepNum, correction]) => {
          if (!correction.correctPosition) return null;
          const x = (correction.correctPosition.x / 100) * MAP_PIXEL_WIDTH;
          const y = MAP_PIXEL_HEIGHT - (correction.correctPosition.y / 100) * MAP_PIXEL_HEIGHT;
          return (
            <g key={`corr-${stepNum}`} transform={`translate(${x}, ${y})`}>
              <circle r={80} fill="none" stroke="#00ff00" strokeWidth={25} />
              <circle r={30} fill="#00ff00" />
            </g>
          );
        })}
        
        {/* Destination marker */}
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

  const correctionCount = Object.keys(corrections).length;

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
            {correctionMode && (
              <Badge className="bg-red-600 animate-pulse">
                <Crosshair className="w-3 h-3 mr-1" />
                MODO CORRECCIÓN - Clic en el mapa
              </Badge>
            )}
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
        <div className="w-96 border-r border-[hsl(var(--gold))]/20 bg-black/30 p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Configuration */}
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Route className="w-4 h-4" />
                Configuración
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Origin */}
              <div>
                <Label className="text-xs">Origen</Label>
                <select 
                  value={selectedOrigin} 
                  onChange={(e) => setSelectedOrigin(e.target.value)}
                  className="w-full h-8 text-xs bg-black/30 border border-border/30 rounded px-2"
                  data-testid="origin-select"
                >
                  <option value="">Seleccionar origen...</option>
                  {locations.map(loc => (
                    <option key={loc.nombre} value={loc.nombre}>{loc.nombre}</option>
                  ))}
                </select>
              </div>
              
              {/* Destination */}
              <div>
                <Label className="text-xs">Destino</Label>
                <select 
                  value={selectedDestination} 
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="w-full h-8 text-xs bg-black/30 border border-border/30 rounded px-2"
                >
                  <option value="">Seleccionar destino...</option>
                  {locations.map(loc => (
                    <option key={loc.nombre} value={loc.nombre}>{loc.nombre}</option>
                  ))}
                </select>
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
                {correctionCount > 0 && (
                  <div className="bg-red-900/30 p-2 rounded text-center">
                    <p className="text-lg font-bold text-red-400">{correctionCount}</p>
                    <p className="text-xs text-red-300">Correcciones marcadas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Step Navigator & Correction */}
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
                  <div className={`p-3 rounded border ${corrections[currentStep] ? 'bg-red-900/30 border-red-500' : DECISION_CONFIG[currentStepData.decision]?.bgColor || 'bg-gray-900/30'}`}>
                    {/* Decision badge */}
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(DECISION_CONFIG[currentStepData.decision]?.icon || ChevronRight, {
                        className: 'w-4 h-4',
                        style: { color: corrections[currentStep] ? '#ef4444' : DECISION_CONFIG[currentStepData.decision]?.color }
                      })}
                      <Badge style={{ backgroundColor: corrections[currentStep] ? '#ef4444' : DECISION_CONFIG[currentStepData.decision]?.color }}>
                        {DECISION_CONFIG[currentStepData.decision]?.label || currentStepData.decision}
                      </Badge>
                      {corrections[currentStep] && (
                        <Badge variant="outline" className="border-red-500 text-red-400">MARCADO</Badge>
                      )}
                    </div>
                    
                    {/* Reason */}
                    <p className="text-sm mb-2">{currentStepData.razon}</p>
                    
                    {/* Details */}
                    <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Pos:</span>
                        <span className="font-mono">({currentStepData.posicion?.x}, {currentStepData.posicion?.y})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Dist:</span>
                        <span>{currentStepData.distancia_destino_km} km</span>
                      </div>
                      {currentStepData.terreno && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Terreno:</span>
                          <span>{currentStepData.terreno}</span>
                        </div>
                      )}
                      {currentStepData.en_camino && (
                        <div className="flex items-center gap-1 col-span-2">
                          <span className="text-muted-foreground">Camino:</span>
                          <span className="text-amber-400">{currentStepData.en_camino}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Correction info */}
                    {corrections[currentStep] && (
                      <div className="mt-2 p-2 bg-green-900/30 rounded border border-green-500/50">
                        <p className="text-xs text-green-400 font-bold mb-1">Corrección sugerida:</p>
                        {corrections[currentStep].correctPosition && (
                          <p className="text-xs text-green-300">
                            Posición: ({corrections[currentStep].correctPosition.x}, {corrections[currentStep].correctPosition.y})
                          </p>
                        )}
                        {corrections[currentStep].comment && (
                          <p className="text-xs text-green-300 mt-1">{corrections[currentStep].comment}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Correction buttons */}
                    <div className="mt-2 flex gap-2">
                      {!corrections[currentStep] ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-900/30"
                          onClick={() => startCorrectionForStep(currentStep)}
                        >
                          <Flag className="w-3 h-3 mr-1" />
                          Marcar como incorrecto
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 h-7 text-xs border-green-500/50 text-green-400 hover:bg-green-900/30"
                          onClick={() => removeCorrection(currentStep)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Quitar corrección
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Correction input panel */}
                {correctionMode && selectedStepForCorrection === currentStep && (
                  <div className="mt-3 p-3 bg-red-900/20 rounded border border-red-500">
                    <p className="text-xs text-red-400 font-bold mb-2">
                      <Crosshair className="w-3 h-3 inline mr-1" />
                      Haz clic en el mapa para indicar la posición correcta
                    </p>
                    {suggestedPosition && (
                      <p className="text-xs text-green-400 mb-2">
                        Posición seleccionada: ({suggestedPosition.x}, {suggestedPosition.y})
                      </p>
                    )}
                    <Textarea
                      placeholder="Comentario: ¿Por qué esta posición es mejor?"
                      value={correctionComment}
                      onChange={(e) => setCorrectionComment(e.target.value)}
                      className="h-16 text-xs mb-2"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={saveCorrection}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelCorrection}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Step list */}
                <ScrollArea className="h-32 mt-3">
                  <div className="space-y-1">
                    {debugResult.pasos?.map((step, i) => (
                      <button
                        key={i}
                        onClick={() => goToStep(i)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors ${
                          i === currentStep 
                            ? 'bg-blue-600/30 border border-blue-500' 
                            : corrections[i]
                            ? 'bg-red-900/30 border border-red-500/50'
                            : i < currentStep
                            ? 'bg-black/20 opacity-70'
                            : 'bg-black/10 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">
                            {corrections[i] ? '❌' : '✓'} #{step.paso}
                          </span>
                          <span className="font-mono text-[10px]">({step.posicion?.x}, {step.posicion?.y})</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          
          {/* Export buttons */}
          {debugResult && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={copyReport}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copiar Log
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={downloadReport}
              >
                <Download className="w-3 h-3 mr-1" />
                Descargar
              </Button>
            </div>
          )}
        </div>
        
        {/* Map */}
        <div 
          ref={containerRef}
          className={`flex-1 overflow-hidden bg-[#1a1a1a] ${correctionMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
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
            {/* Map background */}
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
            
            {/* SVG overlay */}
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
        {correctionMode 
          ? '🎯 MODO CORRECCIÓN: Haz clic en el mapa para indicar la posición correcta'
          : debugResult 
          ? `Ruta de ${debugResult.origen} a ${debugResult.destino} | Marca pasos incorrectos → Exporta el log`
          : 'Selecciona origen y destino, luego pulsa "Analizar"'
        }
      </div>
    </div>
  );
};

export default PathDebugger;
