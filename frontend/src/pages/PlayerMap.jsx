/**
 * Player Map Component
 * Read-only map viewer for players. Players can browse/search/filter locations
 * (like a library) but CANNOT add, edit or delete anything.
 * Includes a "Imprimir mapa" button that prints only the visible map (with any
 * filtered locations) as a landscape A4 PDF.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '../components/ui/card';
import {
  ArrowLeft, ZoomIn, ZoomOut, Compass, RotateCcw, Info, Printer, Search, X,
} from 'lucide-react';
import api from '../services/api';
import { PLAYER_MAP_URL } from '../config/mapAssets';
import { LAND_COLORS, LOCATION_ICONS, TYPE_NAMES } from '../components/map/mapConstants';

const PlayerMap = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 1000 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Library data (read-only)
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Load the map image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      setViewBox({ x: 0, y: 0, width: img.width, height: img.height });
    };
    img.src = PLAYER_MAP_URL;
  }, []);

  // Load all locations once (read-only consultation)
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await api.get('/data/locations');
        setLocations(res.data.locations || []);
      } catch (err) {
        console.error('Error cargando ubicaciones:', err);
      }
    };
    fetchLocations();
  }, []);

  // Distinct regions / types present in the data (for the filter dropdowns)
  const regionOptions = useMemo(() => {
    const set = new Set();
    locations.forEach((l) => { if (l.region) set.add(l.region); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [locations]);

  const typeOptions = useMemo(() => {
    const set = new Set();
    locations.forEach((l) => { if (l.tipo) set.add(l.tipo); });
    return Array.from(set).sort((a, b) => (TYPE_NAMES[a] || a).localeCompare(TYPE_NAMES[b] || b));
  }, [locations]);

  const hasActiveFilter = search.trim() !== '' || regionFilter !== 'all' || typeFilter !== 'all';

  // Filtered locations. Empty on entry (library behaviour) until the player
  // searches or applies a filter.
  const visibleLocations = useMemo(() => {
    if (!hasActiveFilter) return [];
    const q = search.trim().toLowerCase();
    return locations.filter((l) => {
      if (regionFilter !== 'all' && l.region !== regionFilter) return false;
      if (typeFilter !== 'all' && l.tipo !== typeFilter) return false;
      if (q) {
        const hay = `${l.nombre || ''} ${l.nombre_sindarin || ''} ${l.region || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [locations, search, regionFilter, typeFilter, hasActiveFilter]);

  // Convert location percentage coords -> map pixel coords (same orientation
  // as the Master map: y=0 is the BOTTOM of the map).
  const locToPixel = (loc) => ({
    x: (loc.x / 100) * imageSize.width,
    y: imageSize.height - (loc.y / 100) * imageSize.height,
  });

  // ── Pan / Zoom ────────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };
  const handleMouseMove = (e) => {
    if (!isPanning) return;
    const dx = (e.clientX - panStart.x) * (viewBox.width / containerRef.current.clientWidth);
    const dy = (e.clientY - panStart.y) * (viewBox.height / containerRef.current.clientHeight);
    setViewBox((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(prev.x - dx, imageSize.width - prev.width)),
      y: Math.max(0, Math.min(prev.y - dy, imageSize.height - prev.height)),
    }));
    setPanStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setIsPanning(false);
  const handleWheel = (e) => {
    e.preventDefault();
    zoomMap(e.deltaY > 0 ? 1.1 : 0.9, e.clientX, e.clientY);
  };
  const zoomMap = (factor, clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const mouseY = ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;
    const newWidth = Math.max(800, Math.min(imageSize.width, viewBox.width * factor));
    const newHeight = Math.max(800 * (imageSize.height / imageSize.width), Math.min(imageSize.height, viewBox.height * factor));
    const newX = Math.max(0, Math.min(mouseX - (mouseX - viewBox.x) * (newWidth / viewBox.width), imageSize.width - newWidth));
    const newY = Math.max(0, Math.min(mouseY - (mouseY - viewBox.y) * (newHeight / viewBox.height), imageSize.height - newHeight));
    setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight });
    setZoom(imageSize.width / newWidth);
  };
  const resetView = () => {
    setViewBox({ x: 0, y: 0, width: imageSize.width, height: imageSize.height });
    setZoom(1);
  };
  const zoomIn = () => {
    const r = containerRef.current?.getBoundingClientRect();
    if (r) zoomMap(0.8, r.left + r.width / 2, r.top + r.height / 2);
  };
  const zoomOut = () => {
    const r = containerRef.current?.getBoundingClientRect();
    if (r) zoomMap(1.2, r.left + r.width / 2, r.top + r.height / 2);
  };

  const clearFilters = () => {
    setSearch('');
    setRegionFilter('all');
    setTypeFilter('all');
  };

  // Print only the visible map (landscape A4 PDF via the browser print dialog).
  const handlePrint = () => {
    setSelectedLocation(null);
    setTimeout(() => window.print(), 100);
  };

  // Marker sizing kept roughly constant on screen regardless of zoom.
  const markerR = viewBox.width * 0.0035;
  const labelSize = viewBox.width * 0.011;
  const strokeW = viewBox.width * 0.0012;

  return (
    <div className="h-screen flex flex-col bg-[#1a1512]" data-testid="player-map-page">
      {/* Header */}
      <div className="no-print bg-black/80 border-b border-[hsl(var(--magic-blue))/30] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/map')}
            className="text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/10"
            data-testid="player-map-back-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[hsl(var(--magic-blue))]" />
            <h1 className="text-lg font-heading text-[hsl(var(--magic-blue))]">MAPA DEL JUGADOR</h1>
          </div>
        </div>

        {/* Filters (library-style) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ubicación..."
              className="h-9 w-48 pl-7 bg-black/50 border-[hsl(var(--magic-blue))]/30 text-sm"
              data-testid="player-map-search-input"
            />
          </div>

          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="h-9 w-44 bg-black/50 border-[hsl(var(--magic-blue))]/30 text-sm" data-testid="player-map-region-select">
              <SelectValue placeholder="Región" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todas las regiones</SelectItem>
              {regionOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-44 bg-black/50 border-[hsl(var(--magic-blue))]/30 text-sm" data-testid="player-map-type-select">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos los tipos</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {LOCATION_ICONS[t] || '📍'} {TYPE_NAMES[t] || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-400" data-testid="player-map-clear-filters-btn">
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          )}
        </div>

        {/* Zoom + Print controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomIn} className="border-[hsl(var(--magic-blue))]/30 text-[hsl(var(--magic-blue))]" data-testid="player-map-zoom-in-btn">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-400 min-w-[54px] text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomOut} className="border-[hsl(var(--magic-blue))]/30 text-[hsl(var(--magic-blue))]" data-testid="player-map-zoom-out-btn">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView} className="border-[hsl(var(--magic-blue))]/30 text-[hsl(var(--magic-blue))]" data-testid="player-map-reset-btn">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/80 text-black font-semibold"
            data-testid="player-map-print-btn"
          >
            <Printer className="h-4 w-4 mr-2" /> Imprimir mapa
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div
        id="player-map-print-area"
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <image
            href={PLAYER_MAP_URL}
            x="0"
            y="0"
            width={imageSize.width}
            height={imageSize.height}
            preserveAspectRatio="xMidYMid meet"
          />

          {/* Filtered location markers (read-only) */}
          {imageSize.width > 0 && visibleLocations.map((loc) => {
            const p = locToPixel(loc);
            const color = LAND_COLORS[loc.tipo_tierra] || '#c9a227';
            return (
              <g
                key={loc.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setSelectedLocation(loc); }}
                data-testid={`player-map-marker-${loc.id}`}
              >
                <circle cx={p.x} cy={p.y} r={markerR} fill={color} stroke="#000" strokeWidth={strokeW} opacity={0.95} />
                <text
                  x={p.x}
                  y={p.y - markerR - labelSize * 0.3}
                  textAnchor="middle"
                  fontSize={labelSize}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={labelSize * 0.06}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none', fontWeight: 600 }}
                >
                  {loc.nombre}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Info overlay / hint */}
        <div className="no-print absolute bottom-4 left-4 bg-black/70 border border-[hsl(var(--magic-blue))]/30 rounded-lg p-3 max-w-xs">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-[hsl(var(--magic-blue))] mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-300">
              <p className="mb-1"><strong className="text-[hsl(var(--magic-blue))]">Consulta de ubicaciones</strong></p>
              <p>Busca por nombre o filtra por región/tipo para mostrar ubicaciones en el mapa.</p>
              <p className="mt-1 text-gray-400">
                {hasActiveFilter
                  ? `${visibleLocations.length} ubicación(es) mostrada(s).`
                  : 'El mapa empieza vacío, como una biblioteca.'}
              </p>
            </div>
          </div>
        </div>

        {/* Read-only location info panel */}
        {selectedLocation && (
          <Card
            className="no-print absolute top-4 right-4 w-80 bg-black/95 border-[hsl(var(--magic-blue))]/40 z-40 max-h-[calc(100%-2rem)] flex flex-col"
            data-testid="player-map-location-info"
          >
            <CardHeader className="pb-2 shrink-0">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-base text-[hsl(var(--magic-blue))]">
                  {LOCATION_ICONS[selectedLocation.tipo] || '📍'} {selectedLocation.nombre}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSelectedLocation(null)} data-testid="player-map-info-close-btn">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {selectedLocation.nombre_sindarin && (
                <p className="text-xs text-gray-400 italic">{selectedLocation.nombre_sindarin}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 overflow-y-auto flex-1 min-h-0 text-sm">
              {selectedLocation.region && (
                <p className="text-gray-300"><span className="text-gray-500">Región:</span> {selectedLocation.region}</p>
              )}
              <p className="text-gray-300">
                <span className="text-gray-500">Tipo:</span> {TYPE_NAMES[selectedLocation.tipo] || selectedLocation.tipo}
              </p>
              {selectedLocation.descripcion && (
                <p className="whitespace-pre-wrap text-gray-300 border-l-2 border-[hsl(var(--magic-blue))]/30 pl-3">
                  {selectedLocation.descripcion}
                </p>
              )}
              <p className="text-xs text-gray-500">Coordenadas: ({selectedLocation.x}, {selectedLocation.y})</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="no-print bg-black/80 border-t border-[hsl(var(--magic-blue))]/30 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>La Tierra Media — solo consulta</span>
          <span>Arrastra para mover • Scroll para zoom</span>
        </div>
      </div>

      {/* Print styles: only the visible map prints, in A4 landscape */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          body * { visibility: hidden !important; }
          #player-map-print-area, #player-map-print-area * { visibility: visible !important; }
          #player-map-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default PlayerMap;
