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
import { ArrowLeft, ZoomIn, ZoomOut, Move, Save, Trash2, Plus, Edit3, Download, Eraser } from 'lucide-react';
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
  agua: { color: '#0ea5e9', name: 'Agua', description: 'Ríos, lagos, mar - requiere embarcación' },
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
  const [eraseMode, setEraseMode] = useState(false); // Eraser mode
  const [polygonMode, setPolygonMode] = useState(false); // Polygon drawing mode
  const [currentPolygon, setCurrentPolygon] = useState([]); // Points of current polygon being drawn
  const [selectedBrush, setSelectedBrush] = useState(null); // 'facil', 'moderado', etc.
  const [brushSize, setBrushSize] = useState(1); // Default to 1 cell
  const [paintedCells, setPaintedCells] = useState([]); // Painted terrain cells
  const [drawnPolygons, setDrawnPolygons] = useState([]); // Completed polygons
  
  // Piece editing mode
  const [editPieceMode, setEditPieceMode] = useState(null); // 'roads', 'barriers', 'rivers'
  const [selectedPiece, setSelectedPiece] = useState(null);

  // === Move polygons (Iter 67) ===
  const [movePolygonMode, setMovePolygonMode] = useState(false);
  const [movingPolygonId, setMovingPolygonId] = useState(null);
  const [moveStartCoords, setMoveStartCoords] = useState(null);

  // === Undo / Redo history of drawnPolygons (Iter 68) ===
  const HISTORY_MAX = 50;
  const [history, setHistory] = useState([]);     // array of polygon snapshots
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Push the CURRENT drawnPolygons onto history. Call BEFORE applying a change.
  const pushHistory = (snapshot) => {
    const snap = JSON.parse(JSON.stringify(snapshot || []));
    setHistory(prev => {
      // Drop everything after the cursor (redo branch is invalidated)
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, snap];
      // Cap size — drop oldest entries
      if (next.length > HISTORY_MAX) next.shift();
      // Adjust the cursor to the new tail
      setHistoryIndex(next.length - 1);
      return next;
    });
  };

  const undo = () => {
    if (historyIndex < 0) {
      toast.info('Nada que deshacer.');
      return;
    }
    const snap = history[historyIndex];
    setDrawnPolygons(JSON.parse(JSON.stringify(snap || [])));
    setHistoryIndex(historyIndex - 1);
    toast.success('Deshecho.');
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) {
      toast.info('Nada que rehacer.');
      return;
    }
    const snap = history[historyIndex + 2]; // +2 because pushHistory stored the BEFORE state
    if (snap) {
      setDrawnPolygons(JSON.parse(JSON.stringify(snap)));
      setHistoryIndex(historyIndex + 1);
      toast.success('Rehecho.');
    }
  };


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
        
        // Load rivers
        const riversRes = await api.get('/data/rivers');
        if (riversRes.data) {
          setRivers(riversRes.data.rivers || riversRes.data || []);
        }
        
        // Load barriers
        const barriersRes = await api.get('/data/barriers');
        if (barriersRes.data) {
          setBarriers(barriersRes.data.barriers || barriersRes.data || []);
        }
        
        // Load terrain polygons (NOT cells - too slow)
        const terrainRes = await api.get('/data/terrain-polygons');
        if (terrainRes.data?.polygons && terrainRes.data.polygons.length > 0) {
          setDrawnPolygons(terrainRes.data.polygons);
          toast.success(`Cargados ${terrainRes.data.polygons.length} polígonos de terreno`);
        }
        
        // Don't load individual cells - too many, too slow
        // setPaintedCells is now only for temporary brush strokes
        
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
    // Allow pan with left click when NOT in polygon, erase or move mode
    if (e.button === 0 && !polygonMode && !eraseMode && !movePolygonMode) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (e.button === 2) {
      // Right click always allows pan
      e.preventDefault();
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (e.button === 1) {
      // Middle click also allows pan
      e.preventDefault();
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    // Move polygon dragging takes precedence over pan
    if (movingPolygonId && moveStartCoords) {
      const coords = screenToMap(e.clientX, e.clientY);
      const dx = coords.x - moveStartCoords.x;
      const dy = coords.y - moveStartCoords.y;
      setDrawnPolygons(prev => prev.map(p => {
        if (p.id !== movingPolygonId) return p;
        return {
          ...p,
          points: p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })),
        };
      }));
      setMoveStartCoords(coords);
      return;
    }
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (movingPolygonId) {
      toast.success('Polígono movido — recuerda Guardar para persistirlo.');
      setMovingPolygonId(null);
      setMoveStartCoords(null);
    }
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
    // Check polygon mode first
    if (polygonMode) {
      if (!selectedBrush) {
        toast.info('Selecciona un color primero');
        return;
      }
      
      const coords = screenToMap(e.clientX, e.clientY);
      if (!coords) return;
      if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
      
      // Check if clicking near the first point to close the polygon
      if (currentPolygon.length >= 3) {
        const firstPoint = currentPolygon[0];
        const distance = Math.sqrt(
          Math.pow(coords.x - firstPoint.x, 2) + 
          Math.pow(coords.y - firstPoint.y, 2)
        );
        
        // If close enough to first point, close the polygon
        if (distance < 1.5) { // 1.5% threshold
          closePolygon();
          return;
        }
      }
      
      // Add point to current polygon
      setCurrentPolygon(prev => [...prev, { x: coords.x, y: coords.y }]);
      return;
    }
    
    // Check eraser mode
    if (eraseMode) {
      if (isDragging) return;
      const coords = screenToMap(e.clientX, e.clientY);
      if (!coords) return;
      if (coords.x < 0 || coords.x > 100 || coords.y < 0 || coords.y > 100) return;
      eraseCellsAt(coords);
      return;
    }
    
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
    // Pan when dragging and NOT in any drawing mode
    if (isDragging && !polygonMode && !eraseMode) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Save terrain to database (polygons)
  const saveTerrainToDatabase = async () => {
    if (drawnPolygons.length === 0) {
      toast.error('No hay polígonos para guardar');
      return;
    }
    
    try {
      const response = await api.post('/data/terrain-polygons', {
        mode,
        polygons: drawnPolygons
      });
      toast.success(`${response.data.count} polígonos guardados en la base de datos`);
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
      polygons: drawnPolygons,
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

  // Close polygon and fill it with selected color
  const closePolygon = () => {
    if (currentPolygon.length < 3) {
      toast.error('El polígono necesita al menos 3 puntos');
      return;
    }
    
    // Add the completed polygon
    const newPolygon = {
      id: `poly_${Date.now()}`,
      type: selectedBrush,
      points: [...currentPolygon]
    };
    
    pushHistory(drawnPolygons);
    setDrawnPolygons(prev => [...prev, newPolygon]);
    setCurrentPolygon([]);
    toast.success(`Polígono creado con ${newPolygon.points.length} puntos`);
  };

  // Cancel current polygon
  const cancelPolygon = () => {
    setCurrentPolygon([]);
    toast.info('Polígono cancelado');
  };

  // Undo last point in polygon
  const undoLastPoint = () => {
    if (currentPolygon.length > 0) {
      setCurrentPolygon(prev => prev.slice(0, -1));
    }
  };

  // Delete a drawn polygon
  const deletePolygon = (polygonId) => {
    pushHistory(drawnPolygons);
    setDrawnPolygons(prev => prev.filter(p => p.id !== polygonId));
    toast.info('Polígono eliminado');
  };

  // Clear all local changes - with confirmation
  const clearPaintedCells = () => {
    if (drawnPolygons.length === 0 && currentPolygon.length === 0) {
      toast.info('No hay nada para borrar');
      return;
    }
    if (window.confirm(`¿Estás seguro de que quieres borrar ${drawnPolygons.length} polígonos locales?`)) {
      setDrawnPolygons([]);
      setCurrentPolygon([]);
      setPaintedCells([]);
      toast.info('Cambios locales eliminados');
    }
  };

  // Clear terrain from database - with confirmation
  const clearTerrainFromDatabase = async () => {
    if (!window.confirm('¿Estás seguro de que quieres ELIMINAR TODOS los polígonos de la base de datos? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await api.delete('/data/terrain-polygons');
      setDrawnPolygons([]);
      toast.success('Polígonos eliminados de la base de datos');
    } catch (err) {
      console.error('Error clearing terrain:', err);
      toast.error('Error al eliminar el terreno');
    }
  };

  // Erase cells at coordinate (eraser tool)
  const eraseCellsAt = (coords) => {
    const cellSize = 0.125;
    const centerX = Math.floor(coords.x / cellSize) * cellSize + cellSize / 2;
    const centerY = Math.floor(coords.y / cellSize) * cellSize + cellSize / 2;
    const radius = brushSize;
    
    setPaintedCells(prev => {
      return prev.filter(cell => {
        const cellCenterX = cell.x + cell.size / 2;
        const cellCenterY = cell.y + cell.size / 2;
        const dx = (cellCenterX - centerX) / cellSize;
        const dy = (cellCenterY - centerY) / cellSize;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > radius; // Keep cells outside the eraser radius
      });
    });
  };

  // Render painted cells - DISABLED for performance
  // Use polygons instead
  const renderPaintedCells = () => {
    // Don't render individual cells - too slow with many cells
    // Only render if there are very few (for brush preview)
    if (paintedCells.length > 100) return null;
    
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

  // Render drawn polygons
  const renderDrawnPolygons = () => {
    const colors = getColorConfig();
    return drawnPolygons.map((polygon) => {
      const config = colors[polygon.type];
      if (!config || !polygon.points || polygon.points.length < 3) return null;
      
      // Convert points to pixel coordinates
      const pointsStr = polygon.points.map(p => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${x},${y}`;
      }).join(' ');
      
      return (
        <polygon
          key={polygon.id}
          points={pointsStr}
          fill={config.color}
          fillOpacity={movingPolygonId === polygon.id ? 0.85 : 0.6}
          stroke={movingPolygonId === polygon.id ? '#ffd166' : config.color}
          strokeWidth={movingPolygonId === polygon.id ? 30 : 15}
          strokeOpacity={0.9}
          onMouseDown={(e) => {
            if (movePolygonMode) {
              e.stopPropagation();
              const coords = screenToMap(e.clientX, e.clientY);
              setMovingPolygonId(polygon.id);
              setMoveStartCoords(coords);
            }
          }}
          onClick={(e) => {
            if (eraseMode) {
              if (window.confirm('¿Eliminar este polígono?')) {
                deletePolygon(polygon.id);
              }
            } else if (movePolygonMode) {
              e.stopPropagation();
            }
          }}
          style={{
            cursor: movePolygonMode
              ? 'move'
              : eraseMode
              ? 'pointer'
              : 'default'
          }}
          data-testid={`terrain-polygon-${polygon.id}`}
        />
      );
    });
  };

  // Render current polygon being drawn
  const renderCurrentPolygon = () => {
    if (currentPolygon.length === 0) return null;
    
    const colors = getColorConfig();
    const config = colors[selectedBrush];
    const color = config?.color || '#ffffff';
    
    // Convert points to pixel coordinates
    const points = currentPolygon.map(p => ({
      x: (p.x / 100) * MAP_PIXEL_WIDTH,
      y: MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT
    }));
    
    return (
      <g>
        {/* Lines connecting points */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeDasharray="30,15"
            strokeOpacity={0.8}
          />
        )}
        
        {/* Line from last point to first (preview of closing) */}
        {points.length >= 3 && (
          <line
            x1={points[points.length - 1].x}
            y1={points[points.length - 1].y}
            x2={points[0].x}
            y2={points[0].y}
            stroke={color}
            strokeWidth={8}
            strokeDasharray="20,10"
            strokeOpacity={0.4}
          />
        )}
        
        {/* Points - smaller size */}
        {points.map((point, idx) => (
          <g key={idx}>
            <circle
              cx={point.x}
              cy={point.y}
              r={idx === 0 ? 40 : 25}
              fill={idx === 0 ? '#00ff00' : color}
              fillOpacity={0.9}
              stroke="#ffffff"
              strokeWidth={5}
            />
            <text
              x={point.x}
              y={point.y + 8}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={30}
              fontWeight="bold"
            >
              {idx + 1}
            </text>
          </g>
        ))}
      </g>
    );
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

  // Render rivers for editing
  const renderRivers = () => {
    return rivers.map((river, idx) => {
      if (!river.puntos || river.puntos.length < 2) return null;
      
      const isSelected = selectedPiece?.type === 'river' && selectedPiece?.id === river.id;
      
      const pathD = river.puntos.map((p, i) => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={isSelected ? '#22d3ee' : '#3b82f6'}
          strokeWidth={isSelected ? 60 : 40}
          strokeOpacity={0.7}
          strokeLinecap="round"
          style={{ cursor: editPieceMode === 'rivers' ? 'pointer' : 'default' }}
          onClick={() => {
            if (editPieceMode === 'rivers') {
              setSelectedPiece({ type: 'river', id: river.id, data: river });
              toast.info(`Seleccionado: ${river.nombre}`);
            }
          }}
        />
      );
    });
  };

  // Render barriers for editing
  const renderBarriers = () => {
    return barriers.map((barrier, idx) => {
      if (!barrier.puntos || barrier.puntos.length < 2) return null;
      
      const isSelected = selectedPiece?.type === 'barrier' && selectedPiece?.id === barrier.id;
      
      const pathD = barrier.puntos.map((p, i) => {
        const x = (p.x / 100) * MAP_PIXEL_WIDTH;
        const y = MAP_PIXEL_HEIGHT - (p.y / 100) * MAP_PIXEL_HEIGHT;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
      
      return (
        <path
          key={idx}
          d={pathD}
          fill="none"
          stroke={isSelected ? '#f87171' : '#6b7280'}
          strokeWidth={isSelected ? 70 : 50}
          strokeOpacity={0.8}
          strokeLinecap="round"
          strokeDasharray="100,50"
          style={{ cursor: editPieceMode === 'barriers' ? 'pointer' : 'default' }}
          onClick={() => {
            if (editPieceMode === 'barriers') {
              setSelectedPiece({ type: 'barrier', id: barrier.id, data: barrier });
              toast.info(`Seleccionado: ${barrier.nombre || `Barrera ${idx + 1}`}`);
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
          
          {/* Tools - Polygon based */}
          <div className="flex items-center gap-2">
            <Button
              variant={polygonMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setPolygonMode(!polygonMode);
                setEraseMode(false);
                setMovePolygonMode(false);
                if (!polygonMode) {
                  toast.info('Modo polígono activado. Haz clic para poner puntos. Cierra haciendo clic cerca del primer punto (verde).');
                }
              }}
              className={polygonMode ? 'bg-green-600' : ''}
            >
              <Plus className="w-4 h-4 mr-1" />
              Dibujar Zona
            </Button>
            
            <Button
              variant={eraseMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEraseMode(!eraseMode);
                setPolygonMode(false);
                setMovePolygonMode(false);
                if (!eraseMode) {
                  toast.info('Modo borrar activado. Haz clic en un polígono para eliminarlo.');
                }
              }}
              className={eraseMode ? 'bg-pink-600' : ''}
            >
              <Eraser className="w-4 h-4 mr-1" />
              Borrar
            </Button>

            <Button
              variant={movePolygonMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMovePolygonMode(!movePolygonMode);
                setEraseMode(false);
                setPolygonMode(false);
                if (!movePolygonMode) {
                  toast.info('Modo mover activado. Arrastra un polígono para reposicionarlo.');
                }
              }}
              className={movePolygonMode ? 'bg-amber-600' : ''}
              data-testid="terrain-move-mode-btn"
            >
              <Move className="w-4 h-4 mr-1" />
              Mover
            </Button>
            
            {/* Info display */}
            <div className="flex items-center gap-2 text-xs bg-black/40 px-2 py-1 rounded">
              <span>Polígonos: <span className="text-amber-400 font-bold">{drawnPolygons.length}</span></span>
            </div>
            
            {/* Polygon mode controls */}
            {polygonMode && currentPolygon.length > 0 && (
              <>
                <div className="text-xs bg-green-900/40 px-2 py-1 rounded">
                  Puntos: <span className="text-white font-bold">{currentPolygon.length}</span>
                </div>
                <Button size="sm" variant="outline" onClick={undoLastPoint} title="Deshacer último punto">
                  ↩
                </Button>
                <Button size="sm" variant="outline" onClick={cancelPolygon} title="Cancelar">
                  ✕
                </Button>
                {currentPolygon.length >= 3 && (
                  <Button size="sm" variant="default" onClick={closePolygon} className="bg-green-600" title="Cerrar polígono">
                    ✓ Cerrar
                  </Button>
                )}
              </>
            )}
            
            {/* Save/Export buttons */}
            <div className="h-6 w-px bg-gray-600 mx-1" />
            <Button variant="outline" size="sm" onClick={exportPaintedTerrain} title="Exportar a JSON">
              <Download className="w-4 h-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={saveTerrainToDatabase}
              className="bg-green-600 hover:bg-green-700"
              title="Guardar en base de datos"
              disabled={drawnPolygons.length === 0}
            >
              <Save className="w-4 h-4 mr-1" />
              Guardar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearPaintedCells}
              title="Limpiar todo local"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
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
              Caminos ({roads.length})
            </Button>
            <Button
              variant={editPieceMode === 'barriers' ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditPieceMode(editPieceMode === 'barriers' ? null : 'barriers');
                setSelectedPiece(null);
              }}
              className={editPieceMode === 'barriers' ? 'bg-gray-600' : ''}
            >
              Barreras ({barriers.length})
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
              Ríos ({rivers.length})
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
              {editPieceMode === 'barriers' && `Barreras (${barriers.length})`}
              {editPieceMode === 'rivers' && `Ríos (${rivers.length})`}
            </div>
            <div className="flex flex-wrap gap-1">
              {editPieceMode === 'roads' && roads.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay caminos definidos</span>
              )}
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
              {editPieceMode === 'rivers' && rivers.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay ríos definidos</span>
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
              {editPieceMode === 'barriers' && barriers.length === 0 && (
                <span className="text-xs text-muted-foreground">No hay barreras definidas</span>
              )}
              {editPieceMode === 'barriers' && barriers.slice(0, 15).map((barrier, idx) => (
                <Badge 
                  key={idx}
                  variant={selectedPiece?.data?.id === barrier.id ? "default" : "outline"}
                  className="cursor-pointer text-xs bg-gray-700"
                  onClick={() => {
                    setSelectedPiece({ type: 'barrier', id: barrier.id, data: barrier });
                    toast.info(`Seleccionado: ${barrier.nombre || `Barrera ${idx + 1}`}`);
                  }}
                >
                  {barrier.nombre || `Barrera ${idx + 1}`}
                </Badge>
              ))}
              {editPieceMode === 'barriers' && barriers.length > 15 && (
                <span className="text-xs text-muted-foreground">+{barriers.length - 15} más</span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Map Container */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-hidden ${polygonMode ? 'cursor-crosshair' : eraseMode ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
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
          
          {/* 6b. Render rivers */}
          {renderRivers()}
          
          {/* 6c. Render barriers */}
          {renderBarriers()}
          
          {/* 7. Render painted cells */}
          {renderPaintedCells()}
          
          {/* 8. Render drawn polygons */}
          {renderDrawnPolygons()}
          
          {/* 9. Render current polygon being drawn */}
          {renderCurrentPolygon()}
        </svg>
      </div>
      
      {/* Info Panel */}
      <div className="p-3 bg-black/40 border-t border-[hsl(var(--gold))]/20">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            {polygonMode 
              ? `Modo Polígono: ${selectedBrush ? getColorConfig()[selectedBrush]?.name : 'Selecciona un color'} | Puntos: ${currentPolygon.length} | Polígonos: ${drawnPolygons.length}`
              : paintMode 
                ? `Modo Pincel: ${selectedBrush ? getColorConfig()[selectedBrush]?.name : 'Selecciona un color'} | Tamaño: ${brushSize} celdas`
                : eraseMode
                  ? 'Modo Goma: Haz clic para borrar celdas o polígonos'
                  : mode === 'terrain' 
                    ? 'Mapa de Dificultad del Terreno - Selecciona una herramienta'
                    : 'Mapa de Tipos de Tierra - Selecciona una herramienta'
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
