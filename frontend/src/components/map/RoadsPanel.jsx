/**
 * Roads Panel Component
 * Manages road drawing, editing and display on the map
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ROAD_TYPES } from './mapConstants';

const RoadsPanel = ({
  roads = [],
  setRoads,
  selectedRoad,
  setSelectedRoad,
  showRoadsPanel,
  setShowRoadsPanel,
  onDeleteRoad,
  onUpdateRoad,
  onCenterOnRoad,
}) => {
  const [editingRoadId, setEditingRoadId] = useState(null);

  if (!showRoadsPanel) return null;

  const handleSave = async (road) => {
    await onUpdateRoad?.(road.id, { nombre: road.nombre, tipo: road.tipo });
    setEditingRoadId(null);
  };

  const handleView = (road) => {
    setSelectedRoad(road);
    onCenterOnRoad?.(road);
  };

  return (
    <Card className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[80vh] overflow-hidden flex flex-col" data-testid="roads-panel">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            🛤️ Gestión de Caminos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRoadsPanel(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{roads.length} caminos guardados</p>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
        {roads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay caminos dibujados.<br/>
            Usa "Dibujar Camino" para crear uno.
          </p>
        ) : (
          roads.map(road => {
            const roadStyle = ROAD_TYPES[road.tipo] || ROAD_TYPES.secondary;
            const isEditing = editingRoadId === road.id;
            
            return (
              <div 
                key={road.id}
                className={`p-3 rounded-lg border transition-all ${
                  selectedRoad?.id === road.id 
                    ? 'border-green-500 bg-green-900/20' 
                    : 'border-border/30 bg-black/20 hover:bg-black/30'
                }`}
                data-testid={`road-${road.id}`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={road.nombre}
                      onChange={(e) => setRoads(prev => prev.map(r => 
                        r.id === road.id ? { ...r, nombre: e.target.value } : r
                      ))}
                      className="h-8 text-sm"
                      placeholder="Nombre del camino"
                    />
                    <select
                      value={road.tipo}
                      onChange={(e) => setRoads(prev => prev.map(r => 
                        r.id === road.id ? { ...r, tipo: e.target.value } : r
                      ))}
                      className="w-full h-8 text-sm bg-black/30 border border-border/30 rounded px-2"
                    >
                      {Object.entries(ROAD_TYPES).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 bg-green-600 hover:bg-green-700"
                        onClick={() => handleSave(road)}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingRoadId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-4 h-1 rounded"
                        style={{ 
                          backgroundColor: roadStyle.color,
                          borderStyle: roadStyle.dashed ? 'dashed' : 'solid'
                        }}
                      />
                      <span className="font-medium text-sm flex-1">{road.nombre}</span>
                      <span 
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: roadStyle.color + '40', color: roadStyle.color }}
                      >
                        {roadStyle.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {road.puntos?.length || 0} puntos
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs flex-1"
                        onClick={() => handleView(road)}
                      >
                        👁️ Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => setEditingRoadId(road.id)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs text-red-400 hover:text-red-300"
                        onClick={() => onDeleteRoad?.(road.id)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
      
      {/* Quick stats footer */}
      <div className="p-3 border-t border-border/30 flex-shrink-0">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>🥾 Senderos: {roads.filter(r => r.tipo === 'path').length}</span>
          <span>🛤️ Secundarios: {roads.filter(r => r.tipo === 'secondary').length}</span>
          <span>👑 Principales: {roads.filter(r => r.tipo === 'main').length}</span>
        </div>
      </div>
    </Card>
  );
};

export default RoadsPanel;
