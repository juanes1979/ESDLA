import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/services/api';

// Map dimensions in pixels (same as player map)
const MAP_PIXEL_WIDTH = 19791;
const MAP_PIXEL_HEIGHT = 15133;

const LocationEditor = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [editX, setEditX] = useState('');
  const [editY, setEditY] = useState('');
  const [saving, setSaving] = useState(false);
  const svgRef = useRef(null);
  
  // Zoom and pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: MAP_PIXEL_WIDTH, height: MAP_PIXEL_HEIGHT });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Reference locations to show
  const referenceIds = ['loc_002', 'loc_038']; // Hobbiton, Minas Tirith
  const [referenceLocations, setReferenceLocations] = useState([]);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const res = await api.get('/data/locations');
      const locs = res.data.locations || [];
      setLocations(locs);
      
      // Find reference locations
      const refs = locs.filter(l => 
        l.nombre?.toLowerCase().includes('hobbiton') ||
        l.nombre?.toLowerCase().includes('moria') ||
        l.nombre?.toLowerCase().includes('minas tirith')
      );
      setReferenceLocations(refs);
    } catch (err) {
      console.error('Error loading locations:', err);
      toast.error('Error cargando ubicaciones');
    }
  };

  const handleSelectLocation = (locId) => {
    const loc = locations.find(l => l.id === locId);
    if (loc) {
      setSelectedLocation(loc);
      setEditX(loc.x?.toString() || '0');
      setEditY(loc.y?.toString() || '0');
      
      // Center view on selected location
      const pos = toPixels(loc.x, loc.y);
      const zoomWidth = MAP_PIXEL_WIDTH * 0.3;
      const zoomHeight = MAP_PIXEL_HEIGHT * 0.3;
      setViewBox({
        x: pos.x - zoomWidth / 2,
        y: pos.y - zoomHeight / 2,
        width: zoomWidth,
        height: zoomHeight
      });
    }
  };

  // Zoom with mouse wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const mouseY = ((e.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;

    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
    
    const newWidth = Math.min(Math.max(viewBox.width * zoomFactor, MAP_PIXEL_WIDTH * 0.05), MAP_PIXEL_WIDTH);
    const newHeight = Math.min(Math.max(viewBox.height * zoomFactor, MAP_PIXEL_HEIGHT * 0.05), MAP_PIXEL_HEIGHT);

    // Zoom towards mouse position
    const newX = mouseX - (mouseX - viewBox.x) * (newWidth / viewBox.width);
    const newY = mouseY - (mouseY - viewBox.y) * (newHeight / viewBox.height);

    setViewBox({
      x: Math.max(0, Math.min(newX, MAP_PIXEL_WIDTH - newWidth)),
      y: Math.max(0, Math.min(newY, MAP_PIXEL_HEIGHT - newHeight)),
      width: newWidth,
      height: newHeight
    });
  };

  // Pan with middle mouse button or shift+drag
  const handleMouseDown = (e) => {
    if (e.button === 1 || e.shiftKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.x) / rect.width * viewBox.width;
    const dy = (e.clientY - panStart.y) / rect.height * viewBox.height;

    setViewBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(prev.x - dx, MAP_PIXEL_WIDTH - prev.width)),
      y: Math.max(0, Math.min(prev.y - dy, MAP_PIXEL_HEIGHT - prev.height))
    }));

    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Reset zoom
  const resetZoom = () => {
    setViewBox({ x: 0, y: 0, width: MAP_PIXEL_WIDTH, height: MAP_PIXEL_HEIGHT });
  };

  const handleMapClick = (e) => {
    if (isPanning) return;
    
    if (!selectedLocation) {
      toast.error('Selecciona primero una ubicación');
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    
    // Calculate click position in SVG coordinates using current viewBox
    const clickX = ((e.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const clickY = ((e.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;
    
    // Convert to percentage (0-100)
    const percentX = (clickX / MAP_PIXEL_WIDTH) * 100;
    const percentY = 100 - (clickY / MAP_PIXEL_HEIGHT) * 100; // Flip Y
    
    setEditX(percentX.toFixed(1));
    setEditY(percentY.toFixed(1));
  };

  const handleSave = async () => {
    if (!selectedLocation) return;
    
    setSaving(true);
    try {
      const newX = parseFloat(editX);
      const newY = parseFloat(editY);
      
      if (isNaN(newX) || isNaN(newY)) {
        toast.error('Coordenadas inválidas');
        return;
      }

      await api.put(`/data/locations/${selectedLocation.id}`, {
        ...selectedLocation,
        x: newX,
        y: newY
      });
      
      toast.success(`${selectedLocation.nombre} actualizado: (${newX}, ${newY})`);
      
      // Reload locations
      await loadLocations();
      
      // Update selected location
      setSelectedLocation(prev => ({...prev, x: newX, y: newY}));
      
    } catch (err) {
      console.error('Error saving:', err);
      toast.error('Error guardando ubicación');
    } finally {
      setSaving(false);
    }
  };

  // Convert percentage to pixels for display
  const toPixels = (xPercent, yPercent) => ({
    x: (xPercent / 100) * MAP_PIXEL_WIDTH,
    y: MAP_PIXEL_HEIGHT - (yPercent / 100) * MAP_PIXEL_HEIGHT
  });

  // Get current edit position in pixels
  const editPixels = toPixels(parseFloat(editX) || 0, parseFloat(editY) || 0);

  // Filter key locations
  const keyLocations = locations.filter(l => 
    l.nombre?.toLowerCase().includes('hobbiton') ||
    l.nombre?.toLowerCase().includes('moria') ||
    l.nombre?.toLowerCase().includes('minas tirith') ||
    l.nombre?.toLowerCase().includes('rivendel') ||
    l.nombre?.toLowerCase().includes('bree')
  );

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <Card className="card-parchment mb-4">
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--gold))]">
            Editor de Ubicaciones (Temporal)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Selecciona una ubicación y haz clic en el mapa para establecer su posición.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Location selector */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Ubicación:</label>
              <Select onValueChange={handleSelectLocation} value={selectedLocation?.id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación..." />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="header-key" disabled>--- Ubicaciones clave ---</SelectItem>
                  {keyLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.nombre} ({loc.x?.toFixed(1)}, {loc.y?.toFixed(1)})
                    </SelectItem>
                  ))}
                  <SelectItem value="header-all" disabled>--- Todas ---</SelectItem>
                  {locations.slice(0, 50).map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* X coordinate */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">X (%):</label>
              <Input 
                type="number" 
                step="0.1"
                value={editX} 
                onChange={(e) => setEditX(e.target.value)}
                placeholder="0-100"
              />
            </div>
            
            {/* Y coordinate */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Y (%):</label>
              <Input 
                type="number"
                step="0.1" 
                value={editY} 
                onChange={(e) => setEditY(e.target.value)}
                placeholder="0-100"
              />
            </div>
          </div>
          
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={handleSave} 
              disabled={!selectedLocation || saving}
              className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
            >
              {saving ? 'Guardando...' : 'Guardar Posición'}
            </Button>
            <Button variant="outline" onClick={resetZoom}>
              Ver Todo
            </Button>
            <Button variant="outline" onClick={loadLocations}>
              Recargar
            </Button>
            <Button variant="outline" asChild>
              <a href="/travel">Volver a Viajes</a>
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground mb-2">
            <strong>Controles:</strong> Rueda del ratón = Zoom | Shift+Arrastrar = Mover | Clic = Posicionar
          </div>
          
          {selectedLocation && (
            <div className="text-sm text-muted-foreground mb-2">
              <strong>{selectedLocation.nombre}</strong>: 
              Actual ({selectedLocation.x?.toFixed(1)}, {selectedLocation.y?.toFixed(1)}) → 
              Nuevo ({editX}, {editY})
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Map */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Mapa de Jugadores - Haz clic para posicionar</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="relative w-full border border-amber-500/30 rounded overflow-hidden" 
            style={{ height: '70vh' }}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              className="w-full h-full"
              style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
              preserveAspectRatio="xMidYMid meet"
              onClick={handleMapClick}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
            >
              {/* Player map background */}
              <image
                href="/mapa_jugadores.jpg"
                x="0"
                y="0"
                width={MAP_PIXEL_WIDTH}
                height={MAP_PIXEL_HEIGHT}
              />
              
              {/* Grid lines for reference */}
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => {
                const x = (p / 100) * MAP_PIXEL_WIDTH;
                const y = MAP_PIXEL_HEIGHT - (p / 100) * MAP_PIXEL_HEIGHT;
                return (
                  <g key={p}>
                    <line x1={x} y1={0} x2={x} y2={MAP_PIXEL_HEIGHT} stroke="rgba(255,255,255,0.1)" strokeWidth="20" />
                    <line x1={0} y1={y} x2={MAP_PIXEL_WIDTH} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="20" />
                    <text x={x + 50} y={200} fill="rgba(255,255,255,0.3)" fontSize="200">{p}%</text>
                    <text x={100} y={y - 50} fill="rgba(255,255,255,0.3)" fontSize="200">{p}%</text>
                  </g>
                );
              })}
              
              {/* Show all reference locations */}
              {referenceLocations.map(loc => {
                const pos = toPixels(loc.x, loc.y);
                const isSelected = selectedLocation?.id === loc.id;
                return (
                  <g key={loc.id}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 200 : 150}
                      fill={isSelected ? '#22c55e' : '#3b82f6'}
                      stroke="#fff"
                      strokeWidth="30"
                      opacity="0.8"
                    />
                    <text
                      x={pos.x}
                      y={pos.y - 250}
                      fill="#fff"
                      fontSize="180"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {loc.nombre}
                    </text>
                    <text
                      x={pos.x}
                      y={pos.y + 350}
                      fill="#ffd700"
                      fontSize="140"
                      textAnchor="middle"
                    >
                      ({loc.x?.toFixed(1)}, {loc.y?.toFixed(1)})
                    </text>
                  </g>
                );
              })}
              
              {/* Current edit position (red crosshair) */}
              {selectedLocation && !isNaN(editPixels.x) && !isNaN(editPixels.y) && (
                <g>
                  <line
                    x1={editPixels.x - 300}
                    y1={editPixels.y}
                    x2={editPixels.x + 300}
                    y2={editPixels.y}
                    stroke="#ff0000"
                    strokeWidth="20"
                  />
                  <line
                    x1={editPixels.x}
                    y1={editPixels.y - 300}
                    x2={editPixels.x}
                    y2={editPixels.y + 300}
                    stroke="#ff0000"
                    strokeWidth="20"
                  />
                  <circle
                    cx={editPixels.x}
                    cy={editPixels.y}
                    r="100"
                    fill="none"
                    stroke="#ff0000"
                    strokeWidth="30"
                  />
                  <text
                    x={editPixels.x}
                    y={editPixels.y - 400}
                    fill="#ff0000"
                    fontSize="200"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    NUEVA POSICIÓN
                  </text>
                </g>
              )}
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationEditor;
