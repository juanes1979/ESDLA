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
import { ArrowLeft, ZoomIn, ZoomOut, Move, Save, Trash2, Plus, Edit3 } from 'lucide-react';
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
  const [mode, setMode] = useState('terrain'); // 'terrain' or 'landType'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Data
  const [terrainZones, setTerrainZones] = useState([]);
  const [landTypeZones, setLandTypeZones] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Drawing mode
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState(null); // 'facil', 'moderado', etc.
  const [drawnPoints, setDrawnPoints] = useState([]);

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load regions from database
        const regionsRes = await api.get('/data/regions');
        if (regionsRes.data) {
          setRegions(regionsRes.data.regions || regionsRes.data || []);
        }
        
        // Load terrain zones if they exist
        const terrainRes = await api.get('/data/terrain-zones');
        if (terrainRes.data?.zones) {
          setTerrainZones(terrainRes.data.zones);
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
    if (e.button === 0 && !isDrawing) {
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

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(2, Math.max(0.02, zoom * zoomFactor));
    setZoom(newZoom);
  }, [zoom]);

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
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList>
                <TabsTrigger value="terrain">Dificultad</TabsTrigger>
                <TabsTrigger value="landType">Tipo de Tierra</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.02, z * 0.8))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z * 1.25))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setZoom(0.05); setPan({ x: 0, y: 0 }); }}>
                <Move className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="p-3 bg-black/30 border-b border-[hsl(var(--gold))]/10">
        <div className="flex flex-wrap gap-3 justify-center">
          {Object.entries(getColorConfig()).map(([key, config]) => (
            <Badge 
              key={key}
              className="cursor-pointer"
              style={{ 
                backgroundColor: config.color + '40',
                borderColor: config.color,
                color: '#fff'
              }}
              title={config.description}
            >
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: config.color }}
              />
              {config.name}
            </Badge>
          ))}
        </div>
      </div>
      
      {/* Map Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
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
          {/* Background */}
          <rect width={MAP_PIXEL_WIDTH} height={MAP_PIXEL_HEIGHT} fill="#1a1510" />
          
          {/* Render regions from database */}
          {renderRegions()}
          
          {/* Render custom zones */}
          {renderZones()}
          
          {/* Grid for reference */}
          <g opacity={0.1}>
            {Array.from({ length: 11 }, (_, i) => (
              <React.Fragment key={i}>
                <line
                  x1={i * (MAP_PIXEL_WIDTH / 10)}
                  y1={0}
                  x2={i * (MAP_PIXEL_WIDTH / 10)}
                  y2={MAP_PIXEL_HEIGHT}
                  stroke="#c9a227"
                  strokeWidth={10}
                />
                <line
                  x1={0}
                  y1={i * (MAP_PIXEL_HEIGHT / 10)}
                  x2={MAP_PIXEL_WIDTH}
                  y2={i * (MAP_PIXEL_HEIGHT / 10)}
                  stroke="#c9a227"
                  strokeWidth={10}
                />
              </React.Fragment>
            ))}
          </g>
        </svg>
      </div>
      
      {/* Info Panel */}
      <div className="p-3 bg-black/40 border-t border-[hsl(var(--gold))]/20">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            {mode === 'terrain' 
              ? 'Mapa de Dificultad del Terreno - Muestra la dificultad de movimiento por cada zona'
              : 'Mapa de Tipos de Tierra - Muestra la clasificación de cada región (afecta a PX y eventos)'
            }
          </p>
          <p className="text-xs mt-1">
            Regiones cargadas: {regions.length} | Usa la rueda del ratón para hacer zoom
          </p>
        </div>
      </div>
    </div>
  );
};

export default TerrainEditor;
