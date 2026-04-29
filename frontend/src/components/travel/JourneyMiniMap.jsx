/**
 * JourneyMiniMap
 * Renders a small SVG preview of the journey route over the player map.
 * Extracted from EnhancedTravelSystem.jsx to keep that file manageable.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Route, Maximize2 } from 'lucide-react';
import { PLAYER_MAP_URL, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT } from './travelConstants';

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
    const curr = points[i];
    const next = points[i + 1];

    // Control point is current point
    // End point is midpoint between current and next
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;

    path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }

  // Last segment - curve to final point
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;

  return path;
};

const JourneyMiniMap = ({ origenCoords, destinoCoords, origenNombre, destinoNombre, pathPoints, isDirectLine, expanded = false, onToggleExpand, events = [], totalCasillas = 0, forPrint = false }) => {
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
  // Por defecto mostramos un mapa más grande para que origen y destino
  // siempre quepan con holgura. Usamos preserveAspectRatio="xMidYMid meet"
  // (en lugar de "slice") y fondo negro en el contenedor → si el viaje es
  // corto o vertical, aparecen franjas negras tipo letterbox sin recortar
  // los marcadores de origen/destino.
  const containerHeight = expanded ? 'h-[640px]' : 'h-[480px]';

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
          <Button variant="ghost" size="sm" onClick={onToggleExpand} className="h-6 w-6 p-0" data-testid="journey-minimap-expand-btn">
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <div
          ref={containerRef}
          className={`relative ${containerHeight} rounded overflow-hidden border border-border/30 bg-black`}
          data-testid="journey-minimap-container"
        >
          {!imageLoaded ? (
            <div className="w-full h-full flex items-center justify-center bg-black/40">
              <div className="animate-spin w-6 h-6 border-2 border-[hsl(var(--gold))] border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <svg
              viewBox={viewBox}
              className="w-full h-full"
              preserveAspectRatio="xMidYMid meet"
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
                // El total real de casillas viene del cálculo del viaje. Si
                // no llega, fallback al máximo `casilla` registrado y, en
                // último caso, al número de eventos. Usar la casilla del
                // último evento como denominador (bug previo) hacía que
                // todos los marcadores se amontonaran al final.
                const maxEventCasilla = Math.max(0, ...events.map(e => Number(e.casilla || 0)));
                const casillaTotal = totalCasillas
                  || maxEventCasilla
                  || (pathInPixelCoords.length - 1)
                  || 1;
                const eventCasilla = Number(event.casilla || idx + 1);
                const eventProgress = Math.min(1, Math.max(0, eventCasilla / Math.max(1, casillaTotal)));

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

export default JourneyMiniMap;
