/**
 * Terrain Editor - Visualize and edit terrain types
 * Two modes:
 * 1. Terrain Difficulty (fácil, moderado, difícil, etc.)
 * 2. Land Types (Tierras Libres, Salvajes, Sombra, etc.)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ZoomIn, ZoomOut, Move, Save, Trash2, Plus, Edit3, Download } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

// Map dimensions (same as main system)
const MAP_PIXEL_WIDTH = 19791;
const MAP_PIXEL_HEIGHT = 15133;

// Terrain difficulty colors
const TERRAIN_COLORS = {
  facil: { color: '#22c55e', name: 'Fácil', description: 'Caminos bien mantenidos' },
  moderado: { color: '#eab308', name: 'Moderado', description: 'Sendas y campos' },
  dificil: { color: '#f97316', name: 'Difícil', description: 'Bosques densos, colinas' },
  muy_dificil: { color: '#ef4444', name: 'Muy Difícil', description: 'Montañas, pantanos' },
  desalentador: { color: '#dc2626', name: 'Desalentador', description: 'Terreno extremo' },
  infranqueable: { color: '#7f1d1d', name: 'Infranqueable', description: 'Imposible de atravesar' },
};

// Land type colors
const LAND_TYPE_COLORS = {
  tierras_libres: { color: '#22c55e', name: 'Tierras Libres', description: 'Seguras, civilizadas' },
  tierras_fronterizas: { color: '#eab308', name: 'Tierras Fronterizas', description: 'Límite de lo salvaje' },
  tierras_salvajes: { color: '#f97316', name: 'Tierras Salvajes', description: 'Peligrosas, inexploradas' },
  tierras_sombra: { color: '#9333ea', name: 'Tierras de la Sombra', description: 'Influencia oscura' },
  tierras_oscuras: { color: '#1f2937', name: 'Tierras Oscuras', description: 'Dominio del enemigo' },
};

const TerrainEditor = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [mode, setMode] = useState('terrain'); // 'terrain' or 'landType'
  const [zoom, setZoom] = useState(0.05); // Start zoomed out to see full map
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Zoom mode - only zoom with wheel when this is active
  const [zoomMode, setZoomMode] = useState(false);
  
  // Data
  const [terrainZones, setTerrainZones] = useState([]);
  const [landTypeZones, setLandTypeZones] = useState([]);
  const [regions, setRegions] = useState([]);
  const [roads, setRoads] = useState([]);
  const [rivers, setRivers] = useState([]);
  const [barriers, setBarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Drawing/Editing mode
  const [paintMode, setPaintMode] = useState(false);
  const [selectedBrush, setSelectedBrush] = useState(null); // 'facil', 'moderado', etc.
  const [brushSize, setBrushSize] = useState(1); // Default to 1 cell
  const [paintedCells, setPaintedCells] = useState([]); // Painted terrain cells
  
  // Piece editing mode
  const [editPieceMode, setEditPieceMode] = useState(null); // 'roads', 'mountains', 'rivers'
  const [selectedPiece, setSelectedPiece] = useState(null);

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load regions from database
        const regionsRes = await api.get('/data/regions');
        if (regionsRes.data) {
          setRegions(regionsRes.data.regions || regionsRes.data || []);
        }
        
        // Load roads
        const roadsRes = await api.get('/data/roads');
        if (roadsRes.data) {
          setRoads(roadsRes.data.roads || roadsRes.data || []);
        }
        
        // Load terrain zones if they exist - and set as painted cells
        const terrainRes = await api.get('/data/terrain-zones');
        if (terrainRes.data?.zones && terrainRes.data.zones.length > 0) {
          setTerrainZones(terrainRes.data.zones);
          // Also load as painted cells if we're in terrain mode
          setPaintedCells(terrainRes.data.zones);
          toast.success(`Cargadas ${terrainRes.data.zones.length} celdas de terreno`);
        }
        
        // Load land type zones if they exist
        const landRes = await api.get('/data/land-type-zones');
        if (landRes.data?.zones) {
          setLandTypeZones(landRes.data.zones);
        }
      } catch (err) {
        console.log('Loading terrain data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Mouse handlers for pan
  const handleMouseDown = (e) => {
    // Solo permitir pan si NO estamos en modo pincel, o si es click derecho
    if (e.button === 0 && !paintMode) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (e.button === 2) {
      // Click derecho siempre permite pan
      e.preventDefault();
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

  // Wheel zoom - only when zoomMode is active
  const handleWheel = useCallback((e) => {
    if (!zoomMode) return; // Only zoom when zoom mode is active
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(20, Math.max(0.05, zoom * zoomFactor));
    setZoom(newZoom);
  }, [zoom, zoomMode]);

  // Convert screen to map coordinates
  const screenToMap = (screenX, screenY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    
    // Convert to percentage coordinates
    const xPercent = (x / MAP_PIXEL_WIDTH) * 100;
    const yPercent = ((MAP_PIXEL_HEIGHT - y) / MAP_PIXEL_HEIGHT) * 100;
    
    return { x: xPercent, y: yPercent };
  };

  // Get color config based on mode
  const getColorConfig = () => mode === 'terrain' ? TERRAIN_COLORS : LAND_TYPE_COLORS;
  const getZones = () => mode === 'terrain' ? terrainZones : landTypeZones;

  // Handle painting on map
  const handleMapClick = (e) => {
    // Solo pintar si el modo pincel está activo Y hay un brush seleccionado
    if (!paintMode || !selectedBrush) {
      if (paintMode && !selectedBrush) {
        toast.info('Selecciona un color primero');
      }
      return;
    }
    
    // Evitar pintar si estábamos haciendo drag
    if (isDragging) return;
    
    const coords = screenToMap(e.clientX, e.clientY);
    if (!coords) return;
    
    // Validar que las coordenadas estén dentro del mapa
    if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) {
      return;
    }
    
    // Cell size for precision (0.125% = 1/8 of original)
    const cellSize = 0.125; // 0.125% of map = ~2.5km per cell
    const centerX = Math.floor(coords.x / cellSize) * cellSize + cellSize / 2;
    const centerY = Math.floor(coords.y / cellSize) * cellSize + cellSize / 2;
    
    // Paint cells in a CIRCULAR pattern based on brush size
    const newCells = [];
    const radius = brushSize; // Radius in cells
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Check if this cell is within the circular brush
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          const cellX = Math.floor((centerX + dx * cellSize) / cellSize) * cellSize;
          const cellY = Math.floor((centerY + dy * cellSize) / cellSize) * cellSize;
          
          // Only add if within map bounds
          if (cellX >= 0 && cellX < 100 && cellY >= 0 && cellY < 100) {
            newCells.push({
              x: cellX,
              y: cellY,
              type: selectedBrush,
              size: cellSize
            });
          }
        }
      }
    }
    
    setPaintedCells(prev => {
      // Remove existing cells at same positions
      const filtered = prev.filter(c => 
        !newCells.some(nc => Math.abs(nc.x - c.x) < 0.01 && Math.abs(nc.y - c.y) < 0.01)
      );
      const updated = [...filtered, ...newCells];
      return updated;
    });
  };

  // Handle mouse drag for painting
  const handleMouseMoveForPaint = (e) => {
    if (isDragging && !paintMode) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (paintMode && e.buttons === 1 && selectedBrush) {
      // Paint while dragging
      handleMapClick(e);
    }
  };

  // Save terrain to database
  const saveTerrainToDatabase = async () => {
    if (paintedCells.length === 0) {
      toast.error('No hay celdas pintadas para guardar');
      return;
    }
    
    try {
      const endpoint = mode === 'terrain' ? '/data/terrain-zones' : '/data/land-type-zones';
      const response = await api.post(endpoint, {
        mode,
        cells: paintedCells
      });
      toast.success(`${response.data.count} celdas guardadas en la base de datos`);
    } catch (err) {
      console.error('Error saving terrain:', err);
      toast.error('Error al guardar el terreno');
    }
  };

  // Export painted terrain as JSON file
  const exportPaintedTerrain = () => {
    const data = {
      mode,
      cells: paintedCells,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrain_${mode}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Terreno exportado a archivo');
  };

  // Clear painted cells from UI
  const clearPaintedCells = () => {
    setPaintedCells([]);
    toast.info('Terreno limpiado (cambios locales)');
  };

  // Clear terrain from database
  const clearTerrainFromDatabase = async () => {
    try {
      const endpoint = mode === 'terrain' ? '/data/terrain-zones' : '/data/land-type-zones';
      await api.delete(endpoint);
      setPaintedCells([]);
      toast.success('Terreno eliminado de la base de datos');
    } catch (err) {
      console.error('Error clearing terrain:', err);
      toast.error('Error al eliminar el terreno');
    }
  };

  // Render painted cells - bright and visible
  const renderPaintedCells = () => {
    const colors = getColorConfig();
    return paintedCells.map((cell, idx) => {
      const config = colors[cell.type];
      if (!config) return null;
      
      const x = (cell.x / 100) * MAP_PIXEL_WIDTH;
      const y = MAP_PIXEL_HEIGHT - (cell.y / 100) * MAP_PIXEL_HEIGHT;
      const size = (cell.size / 100) * MAP_PIXEL_WIDTH;
      
      return (
        <rect
          key={`cell-${idx}`}
          x={x}
          y={y - size}
          width={size}
          height={size}
          fill={config.color}
          fillOpacity={0.7}
          stroke={config.color}
          strokeWidth={8}
          strokeOpacity={1}
        />
      );
    });
  };

  // Render roads for editing
  const renderRoads = () => {
    return roads.map((road, idx) => {
      if (!road.puntos || road.puntos.length < 2) return null;
      
      const isSelected = selectedPiece?.type === 'road' && selectedPiece?.id === road.id;
      
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
          stroke={isSelected ? '#3b82f6' : '#8B4513'}
          strokeWidth={isSelected ? 50 : 30}
          strokeOpacity={0.7}
          strokeLinecap="round"
          style={{ cursor: editPieceMode === 'roads' ? 'pointer' : 'default' }}
          onClick={() => {
            if (editPieceMode === 'roads') {
              setSelectedPiece({ type: 'road', id: road.id, data: road });
              toast.info(`Seleccionado: ${road.nombre}`);
            }
          }}
        />
      );
    });
  };

  // Render zones on map
  const renderZones = () => {
    const zones = getZones();
    const colors = getColorConfig();
    
    return zones.map((zone, idx) => {
      const config = colors[zone.type];
      if (!config || !zone.polygon || zone.polygon.length < 3) return null;
      
      // Convert percentage to pixels
      const points = zone.polygon.map(p => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${x},${y}`;
      }).join(' ');
      
      return (
        <polygon
          key={idx}
          points={points}
          fill={config.color}
          fillOpacity={0.4}
          stroke={config.color}
          strokeWidth={50}
          strokeOpacity={0.8}
        />
      );
    });
  };

  // Render regions from database
  const renderRegions = () => {
    return regions.map((region, idx) => {
      if (!region.poligono || region.poligono.length < 3) return null;
      
      // Determine color based on tipo_tierra or terreno
      const terrainType = region.terreno || 'moderado';
      const landType = region.tipo_tierra || 'tierras_libres';
      
      const colors = mode === 'terrain' ? TERRAIN_COLORS : LAND_TYPE_COLORS;
      const key = mode === 'terrain' ? terrainType : landType;
      const config = colors[key] || colors[Object.keys(colors)[0]];
      
      // Convert percentage to pixels
      const points = region.poligono.map(p => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${x},${y}`;
      }).join(' ');
      
      // Calculate centroid for label
      const centroidX = region.poligono.reduce((sum, p) => sum + (p.x / 100) * MAP_PIXEL_WIDTH, 0) / region.poligono.length;
      const centroidY = region.poligono.reduce((sum, p) => sum + (MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT), 0) / region.poligono.length;
      
      return (
        <g key={idx}>
          <polygon
            points={points}
            fill={config.color}
            fillOpacity={0.35}
            stroke={config.color}
            strokeWidth={30}
            strokeOpacity={0.7}
          />
          {zoom > 0.04 && (
            <text
              x={centroidX}
              y={centroidY}
              textAnchor="middle"
              fill="#fff"
              fontSize={300}
              fontWeight="bold"
              stroke="#000"
              strokeWidth={20}
              paintOrder="stroke"
            >
              {region.nombre}
            </text>
          )}
        </g>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--parchment-dark))] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[hsl(var(--gold))] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Cargando datos de terrenos...</p>
        </div>
      </div>
    );
  }

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
              Editor de Terrenos
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Mode selector */}
            <Tabs value={mode} onValueChange={(newMode) => {
              setMode(newMode);
              // Switch painted cells based on mode
              if (newMode === 'terrain') {
                setPaintedCells(terrainZones);
              } else {
                setPaintedCells(landTypeZones);
              }
              setSelectedBrush(null);
            }}>
              <TabsList>
                <TabsTrigger value="terrain">Dificultad</TabsTrigger>
                <TabsTrigger value="landType">Tipo de Tierra</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.05, z * 0.8))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm w-20 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(20, z * 1.25))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button 
                variant={zoomMode ? "default" : "outline"} 
                size="sm" 
                onClick={() => {
                  setZoomMode(!zoomMode);
                  if (!zoomMode) {
                    toast.info('Modo zoom activado. Usa la rueda del ratón para hacer zoom.');
                  }
                }}
                className={zoomMode ? 'bg-purple-600' : ''}
                title="Activar zoom con rueda del ratón"
              >
                🔍
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setZoom(0.05); setPan({ x: 0, y: 0 }); }}>
                <Move className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend and Tools */}
      <div className="p-3 bg-black/30 border-b border-[hsl(var(--gold))]/10">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {/* Color Legend / Brush Selection */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(getColorConfig()).map(([key, config]) => (
              <Badge 
                key={key}
                className={`cursor-pointer transition-all ${
                  selectedBrush === key ? 'ring-2 ring-white scale-110' : ''
                }`}
                style={{ 
                  backgroundColor: config.color + (selectedBrush === key ? 'ff' : '40'),
                  borderColor: config.color,
                  color: '#fff'
                }}
                title={config.description}
                onClick={() => {
                  // Permitir seleccionar brush siempre, y activar paintMode automáticamente
                  if (selectedBrush === key) {
                    setSelectedBrush(null);
                  } else {
                    setSelectedBrush(key);
                    if (!paintMode) {
                      setPaintMode(true);
                      toast.info(`Pincel ${config.name} activado. Haz clic en el mapa para pintar.`);
                    }
                  }
                }}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: config.color }}
                />
                {config.name}
              </Badge>
            ))}
          </div>
          
          {/* Tools */}
          <div className="flex items-center gap-2">
            <Button
              variant={paintMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPaintMode(!paintMode);
                if (!paintMode) {
                  toast.info('Modo pincel activado. Selecciona un color y pinta en el mapa.');
                }
              }}
              className={paintMode ? 'bg-blue-600' : ''}
            >
              <Edit3 className="w-4 h-4 mr-1" />
              Pincel
            </Button>
            
            {paintMode && (
              <>
                {/* Brush info and cell count */}
                <div className="flex items-center gap-2 text-xs bg-black/40 px-2 py-1 rounded">
                  <span className="text-muted-foreground">
                    Pincel: <span className="text-white font-bold">{selectedBrush ? TERRAIN_COLORS[selectedBrush]?.name || LAND_TYPE_COLORS[selectedBrush]?.name || selectedBrush : 'Ninguno'}</span>
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">
                    Celdas: <span className="text-green-400 font-bold">{paintedCells.length}</span>
                  </span>
                </div>
                
                <div className="flex items-center gap-1 text-xs">
                  <span>Tamaño:</span>
                  <Button size="sm" variant="outline" onClick={() => setBrushSize(Math.max(1, brushSize - 1))}>-</Button>
                  <span className="w-6 text-center">{brushSize}</span>
                  <Button size="sm" variant="outline" onClick={() => setBrushSize(Math.min(20, brushSize + 1))}>+</Button>
                </div>
                <Button variant="outline" size="sm" onClick={clearPaintedCells} title="Limpiar cambios locales">
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={exportPaintedTerrain} title="Exportar a JSON">
                  <Download className="w-4 h-4" />
                </Button>
                <div className="h-6 w-px bg-gray-600 mx-1" />
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={saveTerrainToDatabase}
                  className="bg-green-600 hover:bg-green-700"
                  title="Guardar en base de datos"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Guardar BD
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearTerrainFromDatabase}
                  className="border-red-600 text-red-400 hover:bg-red-600/20"
                  title="Eliminar de base de datos"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            
            <div className="h-6 w-px bg-gray-600 mx-2" />
            
            {/* Piece editing */}
            <Button
              variant={editPieceMode === 'roads' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'roads' ? null : 'roads');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'roads' ? 'bg-amber-600' : ''}
            >
              Caminos
            </Button>
            <Button
              variant={editPieceMode === 'mountains' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'mountains' ? null : 'mountains');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'mountains' ? 'bg-gray-600' : ''}
            >
              Montañas
            </Button>
            <Button
              variant={editPieceMode === 'rivers' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'rivers' ? null : 'rivers');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'rivers' ? 'bg-blue-600' : ''}
            >
              Ríos
            </Button>
          </div>
        </div>
        
        {/* Selected piece info */}
        {selectedPiece && (
          <div className="mt-2 p-2 bg-blue-900/30 rounded text-sm">
            <span className="font-bold">Seleccionado:</span> {selectedPiece.data?.nombre || 'Sin nombre'}
            <Button size="sm" variant="ghost" className="ml-2" onClick={() => setSelectedPiece(null)}>
              Deseleccionar
            </Button>
          </div>
        )}
        
        {/* List of elements when in edit mode */}
        {editPieceMode && (
          <div className="mt-2 p-2 bg-black/40 rounded max-h-32 overflow-y-auto">
            <div className="text-xs text-amber-400 mb-1 font-bold">
              {editPieceMode === 'roads' && `Caminos (${roads.length})`}
              {editPieceMode === 'mountains' && 'Montañas (zonas de terreno difícil)'}
              {editPieceMode === 'rivers' && `Ríos (${rivers.length})`}
            </div>
            <div className="flex flex-wrap gap-1">
              {editPieceMode === 'roads' && roads.slice(0, 15).map((road, idx) => (
                <Badge 
                  key={idx} 
                  variant={selectedPiece?.data?.id === road.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    setSelectedPiece({ type: 'road', id: road.id, data: road });
                    toast.info(`Seleccionado: ${road.nombre}`);
                  }}
                >
                  {road.nombre}
                </Badge>
              ))}
              {editPieceMode === 'roads' && roads.length > 15 && (
                <span className="text-xs text-muted-foreground">+{roads.length - 15} más</span>
              )}
              {editPieceMode === 'rivers' && rivers.slice(0, 15).map((river, idx) => (
                <Badge 
                  key={idx}
                  variant={selectedPiece?.data?.id === river.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    setSelectedPiece({ type: 'river', id: river.id, data: river });
                    toast.info(`Seleccionado: ${river.nombre}`);
                  }}
                >
                  {river.nombre}
                </Badge>
              ))}
              {editPieceMode === 'mountains' && (
                <span className="text-xs text-muted-foreground">Usa el pincel "Muy Difícil" o "Infranqueable" para marcar montañas</span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Map Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-hidden ${paintMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ backgroundColor: '#1a1510' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveForPaint}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleMapClick}
      >
        <svg
          ref={svgRef}
          width={MAP_PIXEL_WIDTH}
          height={MAP_PIXEL_HEIGHT}
          viewBox={`0 0 ${MAP_PIXEL_WIDTH} ${MAP_PIXEL_HEIGHT}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        >
          {/* 1. Map background image - MAPA DEL MAESTRO */}
          <image
            href="https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/8bm4010y_Tierra%20Media.jpg"
            x={0}
            y={0}
            width={MAP_PIXEL_WIDTH}
            height={MAP_PIXEL_HEIGHT}
            preserveAspectRatio="none"
            opacity={0.7}
          />
          
          {/* 2. Semi-transparent overlay to soften the map slightly */}
          <rect
            x={0}
            y={0}
            width={MAP_PIXEL_WIDTH}
            height={MAP_PIXEL_HEIGHT}
            fill="#1a1510"
            fillOpacity={0.25}
          />
          
          {/* 3. Grid overlay - 800 divisions (8x more precise) */}
          <defs>
            <pattern id="gridPattern" width={MAP_PIXEL_WIDTH / 800} height={MAP_PIXEL_HEIGHT / 800} patternUnits="userSpaceOnUse">
              <rect width={MAP_PIXEL_WIDTH / 800} height={MAP_PIXEL_HEIGHT / 800} fill="none" stroke="#c9a227" strokeWidth="1" strokeOpacity="0.25"/>
            </pattern>
            <pattern id="gridPatternLarge" width={MAP_PIXEL_WIDTH / 100} height={MAP_PIXEL_HEIGHT / 100} patternUnits="userSpaceOnUse">
              <rect width={MAP_PIXEL_WIDTH / 100} height={MAP_PIXEL_HEIGHT / 100} fill="none" stroke="#c9a227" strokeWidth="4" strokeOpacity="0.5"/>
            </pattern>
          </defs>
          <rect width={MAP_PIXEL_WIDTH} height={MAP_PIXEL_HEIGHT} fill="url(#gridPattern)" />
          <rect width={MAP_PIXEL_WIDTH} height={MAP_PIXEL_HEIGHT} fill="url(#gridPatternLarge)" />
          
          {/* 4. Render regions from database */}
          {renderRegions()}
          
          {/* 5. Render custom zones */}
          {renderZones()}
          
          {/* 6. Render roads */}
          {renderRoads()}
          
          {/* 7. Render painted cells ON TOP */}
          {renderPaintedCells()}
        </svg>
      </div>
      
      {/* Info Panel */}
      <div className="p-3 bg-black/40 border-t border-[hsl(var(--gold))]/20">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            {paintMode 
              ? `Modo Pincel: ${selectedBrush ? getColorConfig()[selectedBrush]?.name : 'Selecciona un color'} | Tamaño: ${brushSize} celdas`
              : mode === 'terrain' 
                ? 'Mapa de Dificultad del Terreno - Activa el pincel para pintar'
                : 'Mapa de Tipos de Tierra - Activa el pincel para pintar'
            }
          </p>
          <p className="text-xs mt-1">
            Escala: 1 celda ≈ 2.5 km | Celdas pintadas: {paintedCells.length} | Zoom máx: 2000%
          </p>
        </div>
      </div>
    </div>
  );
};

export default TerrainEditor;
