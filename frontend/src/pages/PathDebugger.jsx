/**
 * Path Debugger - Interactive tool to define and debug travel paths
 * Asks every 10km for direction input to build correct paths
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ZoomIn, ZoomOut, Move, Play, Pause, RotateCcw, Download, Upload, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

// Map dimensions
const MAP_PIXEL_WIDTH = 19791;
const MAP_PIXEL_HEIGHT = 15133;
const PLAYER_MAP_URL = '/mapa_jugadores.jpg';

// 10km in coordinate units (approximately)
const KM_TO_COORD = 0.5; // 1 coordinate unit ≈ 2km

const PathDebugger = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Locations
  const [locations, setLocations] = useState([]);
  const [roads, setRoads] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  
  // Path debugging state
  const [debugMode, setDebugMode] = useState(false);
  const [pathPoints, setPathPoints] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [pathLog, setPathLog] = useState([]);
  
  // Click mode for adding points
  const [clickMode, setClickMode] = useState(false);

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locsRes, roadsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/data/roads')
        ]);
        
        if (locsRes.data) {
          setLocations(locsRes.data.locations || locsRes.data || []);
        }
        if (roadsRes.data) {
          setRoads(roadsRes.data.roads || roadsRes.data || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    fetchData();
  }, []);

  // Mouse handlers
  const handleMouseDown = (e) => {
    if (e.button === 0 && !clickMode) {
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(20, Math.max(0.02, z * zoomFactor)));
  }, []);

  // Convert screen to map coordinates
  const screenToMap = (screenX, screenY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    
    const mapX = (screenX - rect.left - pan.x) / zoom;
    const mapY = (screenY - rect.top - pan.y) / zoom;
    
    // Convert to percentage
    return {
      x: (mapX / MAP_PIXEL_WIDTH) * 100,
      y: ((MAP_PIXEL_HEIGHT - mapY) / MAP_PIXEL_HEIGHT) * 100
    };
  };

  // Handle map click in click mode
  const handleMapClick = (e) => {
    if (!clickMode || !debugMode) return;
    
    const coords = screenToMap(e.clientX, e.clientY);
    if (!coords) return;
    
    addPathPoint(coords);
  };

  // Add a point to the path
  const addPathPoint = (coords) => {
    const newPoint = { x: coords.x, y: coords.y };
    
    // Calculate distance from last point
    let segmentDist = 0;
    if (pathPoints.length > 0) {
      const lastPoint = pathPoints[pathPoints.length - 1];
      segmentDist = Math.sqrt(
        Math.pow((coords.x - lastPoint.x) * 2, 2) + 
        Math.pow((coords.y - lastPoint.y) * 2, 2)
      ); // Approximate km
    }
    
    setPathPoints(prev => [...prev, newPoint]);
    setDistanceTraveled(prev => prev + segmentDist);
    setCurrentPosition(newPoint);
    
    // Log the action
    setPathLog(prev => [...prev, {
      point: pathPoints.length + 1,
      coords: newPoint,
      distance: segmentDist.toFixed(1),
      totalDistance: (distanceTraveled + segmentDist).toFixed(1),
      timestamp: new Date().toISOString()
    }]);
    
    toast.success(`Punto ${pathPoints.length + 1} añadido (${segmentDist.toFixed(1)} km)`);
  };

  // Start debugging a path
  const startDebug = () => {
    if (!selectedOrigin) {
      toast.error('Selecciona un origen primero');
      return;
    }
    
    const originLoc = locations.find(l => l.id === selectedOrigin);
    if (!originLoc) return;
    
    setDebugMode(true);
    setPathPoints([{ x: originLoc.x, y: originLoc.y }]);
    setCurrentPosition({ x: originLoc.x, y: originLoc.y });
    setDistanceTraveled(0);
    setPathLog([{
      point: 1,
      coords: { x: originLoc.x, y: originLoc.y },
      distance: 0,
      totalDistance: 0,
      timestamp: new Date().toISOString(),
      note: `Inicio en ${originLoc.nombre}`
    }]);
    setClickMode(true);
    
    toast.info('Modo de depuración activo. Haz clic en el mapa para añadir puntos al camino.');
  };

  // Reset debug
  const resetDebug = () => {
    setDebugMode(false);
    setPathPoints([]);
    setCurrentPosition(null);
    setDistanceTraveled(0);
    setPathLog([]);
    setClickMode(false);
  };

  // Export path
  const exportPath = () => {
    const data = {
      origin: selectedOrigin,
      destination: selectedDestination,
      originName: locations.find(l => l.id === selectedOrigin)?.nombre,
      destinationName: locations.find(l => l.id === selectedDestination)?.nombre,
      pathPoints,
      totalDistance: distanceTraveled,
      log: pathLog,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `path_debug_${data.originName}_${data.destinationName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Camino exportado');
  };

  // Render locations on map
  const renderLocations = () => {
    const inverseZoom = 1 / zoom;
    
    return locations.map(loc => {
      const x = (loc.x / 100) * MAP_PIXEL_WIDTH;
      const y = MAP_PIXEL_HEIGHT - (loc.y / 100) * MAP_PIXEL_HEIGHT;
      
      const isOrigin = loc.id === selectedOrigin;
      const isDestination = loc.id === selectedDestination;
      
      return (
        <g key={loc.id} transform={`translate(${x}, ${y})`}>
          <circle
            r={isOrigin || isDestination ? 120 : 60}
            fill={isOrigin ? '#22c55e' : isDestination ? '#ef4444' : '#c9a227'}
            opacity={0.8}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (!selectedOrigin) {
                setSelectedOrigin(loc.id);
                toast.info(`Origen: ${loc.nombre}`);
              } else if (!selectedDestination && loc.id !== selectedOrigin) {
                setSelectedDestination(loc.id);
                toast.info(`Destino: ${loc.nombre}`);
              }
            }}
          />
          {zoom > 0.06 && (
            <text
              y={150}
              textAnchor="middle"
              fill="#fff"
              fontSize={150}
              fontWeight="bold"
              stroke="#000"
              strokeWidth={30}
              paintOrder="stroke"
            >
              {loc.nombre}
            </text>
          )}
        </g>
      );
    });
  };

  // Render existing roads
  const renderRoads = () => {
    return roads.map((road, idx) => {
      if (!road.puntos || road.puntos.length < 2) return null;
      
      const pathD = road.puntos.map((p, i) => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke="#8B4513"
          strokeWidth={30}
          strokeOpacity={0.5}
          strokeLinecap="round"
        />
      );
    });
  };

  // Render debug path
  const renderDebugPath = () => {
    if (pathPoints.length < 1) return null;
    
    const pathD = pathPoints.map((p, i) => {
      const x = (p.x / 100) * MAP_PIXEL_WIDTH;
      const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return (
      <g>
        {/* Path line */}
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={40}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="100,50"
        />
        
        {/* Points */}
        {pathPoints.map((p, i) => {
          const x = (p.x / 100) * MAP_PIXEL_WIDTH;
          const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
          
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <circle r={80} fill="#3b82f6" stroke="#fff" strokeWidth={20} />
              {zoom > 0.08 && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={100}
                  fontWeight="bold"
                >
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--parchment-dark))] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[hsl(var(--gold))]/20 bg-black/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-xl font-bold text-[hsl(var(--gold))]">
              Depurador de Caminos
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.02, z * 0.8))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z * 1.25))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-[hsl(var(--gold))]/20 bg-black/30 p-4 flex flex-col gap-4">
          {/* Origin/Destination Selection */}
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Selección de Ruta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Origen (clic en el mapa)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedOrigin ? "default" : "outline"} className="flex-1 justify-center">
                    {selectedOrigin ? locations.find(l => l.id === selectedOrigin)?.nombre : 'Sin seleccionar'}
                  </Badge>
                  {selectedOrigin && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedOrigin(null)}>×</Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Destino (clic en el mapa)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedDestination ? "default" : "outline"} className="flex-1 justify-center">
                    {selectedDestination ? locations.find(l => l.id === selectedDestination)?.nombre : 'Sin seleccionar'}
                  </Badge>
                  {selectedDestination && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedDestination(null)}>×</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Debug Controls */}
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Control de Depuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!debugMode ? (
                <Button className="w-full btn-gold" onClick={startDebug} disabled={!selectedOrigin}>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Depuración
                </Button>
              ) : (
                <>
                  <div className="p-3 bg-blue-900/30 rounded border border-blue-500/50 text-sm">
                    <p className="font-bold text-blue-400">Modo activo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Haz clic en el mapa para añadir puntos al camino
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-black/30 p-2 rounded">
                      <p className="text-xl font-bold text-[hsl(var(--gold))]">{pathPoints.length}</p>
                      <p className="text-xs text-muted-foreground">Puntos</p>
                    </div>
                    <div className="bg-black/30 p-2 rounded">
                      <p className="text-xl font-bold text-blue-400">{distanceTraveled.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">km total</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={resetDebug}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reiniciar
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={exportPath}>
                      <Download className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Path Log */}
          {pathLog.length > 0 && (
            <Card className="card-parchment flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Registro del Camino</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-1 text-xs">
                    {pathLog.map((log, i) => (
                      <div key={i} className="p-2 bg-black/20 rounded">
                        <div className="flex justify-between">
                          <span className="font-bold">Punto {log.point}</span>
                          <span className="text-muted-foreground">{log.totalDistance} km</span>
                        </div>
                        <p className="text-muted-foreground">
                          x={log.coords.x.toFixed(1)}, y={log.coords.y.toFixed(1)}
                        </p>
                        {log.note && <p className="text-blue-400">{log.note}</p>}
                      </div>
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
          className={`flex-1 overflow-hidden ${clickMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleMapClick}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${MAP_PIXEL_WIDTH} ${MAP_PIXEL_HEIGHT}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {/* Map background */}
            <image
              href={PLAYER_MAP_URL}
              x={0}
              y={0}
              width={MAP_PIXEL_WIDTH}
              height={MAP_PIXEL_HEIGHT}
              preserveAspectRatio="xMidYMid slice"
            />
            
            {/* Existing roads (dimmed) */}
            <g opacity={0.4}>
              {renderRoads()}
            </g>
            
            {/* Debug path */}
            {renderDebugPath()}
            
            {/* Locations */}
            {renderLocations()}
          </svg>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="p-2 bg-black/40 border-t border-[hsl(var(--gold))]/20 text-center text-xs text-muted-foreground">
        {debugMode 
          ? 'Haz clic en el mapa para añadir puntos. Los caminos existentes se muestran en marrón claro.'
          : 'Selecciona origen y destino haciendo clic en las ubicaciones del mapa, luego inicia la depuración.'
        }
      </div>
    </div>
  );
};

export default PathDebugger;
