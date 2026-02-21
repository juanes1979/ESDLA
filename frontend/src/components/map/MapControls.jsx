/**
 * Map Controls Component
 * Handles zoom, pan controls and view toggles for the Middle-earth Map
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ZoomIn, ZoomOut, Move, Eye, EyeOff } from 'lucide-react';

const MapControls = ({
  zoom,
  setZoom,
  showMasterView,
  setShowMasterView,
  showMapBackground,
  setShowMapBackground,
  showLabels,
  setShowLabels,
  showLandTypes,
  setShowLandTypes,
  mapOpacity,
  setMapOpacity,
  resetView,
}) => {
  const handleZoomChange = (delta) => {
    setZoom(prev => Math.max(0.2, Math.min(15, prev + delta)));
  };

  const handleZoomInput = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 20 && value <= 1500) {
      setZoom(value / 100);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* View toggles */}
      <div className="flex items-center gap-2">
        <Switch
          checked={showMasterView}
          onCheckedChange={setShowMasterView}
          id="master-view"
        />
        <Label htmlFor="master-view" className="text-sm flex items-center gap-1">
          {showMasterView ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showMasterView ? 'Maestro' : 'Jugador'}
        </Label>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={showMapBackground}
          onCheckedChange={setShowMapBackground}
          id="map-bg"
        />
        <Label htmlFor="map-bg" className="text-sm">Mapa</Label>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={showLabels}
          onCheckedChange={setShowLabels}
          id="labels"
        />
        <Label htmlFor="labels" className="text-sm">Etiquetas</Label>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={showLandTypes}
          onCheckedChange={setShowLandTypes}
          id="land-types"
        />
        <Label htmlFor="land-types" className="text-sm">Tipo Tierra</Label>
      </div>
      
      {/* Map opacity slider */}
      {showMapBackground && (
        <div className="flex items-center gap-2">
          <Label className="text-sm">Opacidad:</Label>
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.1"
            value={mapOpacity}
            onChange={(e) => setMapOpacity(parseFloat(e.target.value))}
            className="w-20 h-2 accent-[hsl(var(--gold))]"
          />
        </div>
      )}
    </div>
  );
};

export default MapControls;
