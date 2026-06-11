/**
 * Player Map Component
 * Simplified map without location names - for players during gameplay
 * Can display travel routes calculated from the Master map
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, ZoomIn, ZoomOut, Move, Compass, RotateCcw, Route, Info
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { PLAYER_MAP_URL } from '../config/mapAssets';

const PlayerMap = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 1000 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  
  // Route visualization state (will be populated from travel calculations)
  const [currentRoute, setCurrentRoute] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);

  // Map dimensions (same as master map for coordinate alignment)
  const MAP_WIDTH = 5000;
  const MAP_HEIGHT = 5000;

  useEffect(() => {
    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      // Set initial viewbox to show full map
      setViewBox({ x: 0, y: 0, width: img.width, height: img.height });
    };
    img.src = PLAYER_MAP_URL;
  }, []);

  // Pan handlers
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
    
    setViewBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(prev.x - dx, imageSize.width - prev.width)),
      y: Math.max(0, Math.min(prev.y - dy, imageSize.height - prev.height))
    }));
    
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    zoomMap(zoomFactor, e.clientX, e.clientY);
  };

  const zoomMap = (factor, clientX, clientY) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const mouseY = ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;

    const newWidth = Math.max(200, Math.min(imageSize.width, viewBox.width * factor));
    const newHeight = Math.max(200, Math.min(imageSize.height, viewBox.height * factor));

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
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      zoomMap(0.8, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  };

  const zoomOut = () => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      zoomMap(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  };

  // Convert master map coordinates to player map coordinates
  // (The maps should be aligned, but this allows for future scaling adjustments)
  const convertCoordinates = (x, y) => {
    // For now, assume 1:1 mapping - adjust scale if maps differ
    const scaleX = imageSize.width / MAP_WIDTH;
    const scaleY = imageSize.height / MAP_HEIGHT;
    return {
      x: x * scaleX,
      y: y * scaleY
    };
  };

  // Render route on map (will be called when route data is available)
  const renderRoute = () => {
    if (!currentRoute || routePoints.length < 2) return null;

    const pathData = routePoints.map((point, index) => {
      const coords = convertCoordinates(point.x, point.y);
      return `${index === 0 ? 'M' : 'L'} ${coords.x} ${coords.y}`;
    }).join(' ');

    return (
      <g className="route-layer">
        {/* Route shadow */}
        <path
          d={pathData}
          fill="none"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Route line */}
        <path
          d={pathData}
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="20,10"
          className="animate-dash"
        />
        {/* Start marker */}
        <circle
          cx={convertCoordinates(routePoints[0].x, routePoints[0].y).x}
          cy={convertCoordinates(routePoints[0].x, routePoints[0].y).y}
          r="12"
          fill="#22c55e"
          stroke="white"
          strokeWidth="3"
        />
        {/* End marker */}
        <circle
          cx={convertCoordinates(routePoints[routePoints.length - 1].x, routePoints[routePoints.length - 1].y).x}
          cy={convertCoordinates(routePoints[routePoints.length - 1].x, routePoints[routePoints.length - 1].y).y}
          r="12"
          fill="#ef4444"
          stroke="white"
          strokeWidth="3"
        />
      </g>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#1a1512]">
      {/* Header */}
      <div className="bg-black/80 border-b border-[hsl(var(--magic-blue))/30] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/map')}
            className="text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[hsl(var(--magic-blue))]" />
            <h1 className="text-xl font-heading text-[hsl(var(--magic-blue))]">
              MAPA DEL JUGADOR
            </h1>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            className="border-[hsl(var(--magic-blue))]/30 text-[hsl(var(--magic-blue))]"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            className="border-[hsl(var(--magic-blue))]/30 text-[hsl(var(--magic-blue))]"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
            className="border-[hsl(var(--magic-blue))]/30 text-[hsl(var(--magic-blue))]"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div 
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
          {/* Map image */}
          <image
            href={PLAYER_MAP_URL}
            x="0"
            y="0"
            width={imageSize.width}
            height={imageSize.height}
            preserveAspectRatio="xMidYMid meet"
          />
          
          {/* Route overlay (when active) */}
          {renderRoute()}
        </svg>

        {/* Info overlay */}
        <div className="absolute bottom-4 left-4 bg-black/70 border border-[hsl(var(--magic-blue))]/30 rounded-lg p-3 max-w-xs">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-[hsl(var(--magic-blue))] mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-300">
              <p className="mb-1"><strong className="text-[hsl(var(--magic-blue))]">Mapa del Jugador</strong></p>
              <p>Usa el scroll del ratón para hacer zoom y arrastra para moverte por el mapa.</p>
              <p className="mt-1 text-gray-400">Las rutas de viaje calculadas se mostrarán aquí.</p>
            </div>
          </div>
        </div>

        {/* Route info panel (when route is active) */}
        {currentRoute && (
          <div className="absolute top-4 right-4 bg-black/80 border border-green-500/30 rounded-lg p-4 max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <Route className="h-4 w-4 text-green-500" />
              <span className="text-green-500 font-heading">Ruta Activa</span>
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              <p>Origen: <span className="text-white">{currentRoute.origin}</span></p>
              <p>Destino: <span className="text-white">{currentRoute.destination}</span></p>
              <p>Distancia: <span className="text-white">{currentRoute.distance} km</span></p>
              <p>Duración: <span className="text-white">{currentRoute.duration} días</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-black/80 border-t border-[hsl(var(--magic-blue))]/30 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>La Tierra Media</span>
          <span>Arrastra para mover • Scroll para zoom</span>
        </div>
      </div>

      {/* CSS for animated dash */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -60;
          }
        }
        .animate-dash {
          animation: dash 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default PlayerMap;
