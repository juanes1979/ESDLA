/**
 * Roads Panel Component
 * Manages road drawing, editing and display on the map
 */
import { useState } from 'react';
import { X, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Road types with new nomenclature
const ROAD_TYPES_CONFIG = {
  grande: { label: 'Grandes Caminos', color: '#FFD700', description: 'Rutas principales entre reinos' },
  mayor: { label: 'Caminos Mayores', color: '#C9A227', description: 'Rutas regionales importantes' },
  menor: { label: 'Caminos Menores', color: '#A08050', description: 'Caminos locales' },
  senda: { label: 'Sendas', color: '#8B7355', description: 'Senderos estrechos' },
  // Legacy types mapping
  real: { label: 'Grandes Caminos', color: '#FFD700', description: 'Rutas principales' },
  principal: { label: 'Caminos Mayores', color: '#C9A227', description: 'Rutas regionales' },
  secundario: { label: 'Caminos Menores', color: '#A08050', description: 'Caminos locales' },
  sendero: { label: 'Sendas', color: '#8B7355', description: 'Senderos' },
};

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

  // Count roads by type (including legacy mappings)
  const countByType = (types) => roads.filter(r => types.includes(r.tipo)).length;
  const grandesCount = countByType(['grande', 'real']);
  const mayoresCount = countByType(['mayor', 'principal']);
  const menoresCount = countByType(['menor', 'secundario']);
  const sendasCount = countByType(['senda', 'sendero']);

  return (
    <Card 
      className="absolute top-16 right-4 w-96 z-50 bg-[#1a1510] border-2 border-[#c9a227]/50 shadow-2xl"
      data-testid="roads-panel"
    >
      {/* Header */}
      <CardHeader className="pb-3 border-b border-[#c9a227]/30 bg-gradient-to-r from-[#2a2015] to-[#1a1510]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-[#FFD700] flex items-center gap-3">
            <span className="text-2xl">🛤️</span>
            Gestión de Caminos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRoadsPanel(false)}
            className="h-8 w-8 p-0 hover:bg-red-900/30 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-sm text-[#c9a227] mt-1">{roads.length} caminos guardados</p>
      </CardHeader>
      
      {/* Content */}
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {roads.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-base mb-2">No hay caminos dibujados.</p>
                <p className="text-gray-500 text-sm">Usa "Dibujar Camino" para crear uno.</p>
              </div>
            ) : (
              roads.map(road => {
                const roadConfig = ROAD_TYPES_CONFIG[road.tipo] || ROAD_TYPES_CONFIG.menor;
                const isEditing = editingRoadId === road.id;
                const isSelected = selectedRoad?.id === road.id;
                
                return (
                  <div 
                    key={road.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'border-green-500 bg-green-900/30' 
                        : 'border-[#c9a227]/30 bg-black/40 hover:bg-black/60 hover:border-[#c9a227]/50'
                    }`}
                    data-testid={`road-${road.id}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={road.nombre}
                          onChange={(e) => setRoads(prev => prev.map(r => 
                            r.id === road.id ? { ...r, nombre: e.target.value } : r
                          ))}
                          className="h-10 text-base bg-black/50 border-[#c9a227]/50 text-white"
                          placeholder="Nombre del camino"
                        />
                        <select
                          value={road.tipo}
                          onChange={(e) => setRoads(prev => prev.map(r => 
                            r.id === road.id ? { ...r, tipo: e.target.value } : r
                          ))}
                          className="w-full h-10 text-base bg-black/50 border border-[#c9a227]/50 rounded-md px-3 text-white"
                        >
                          <option value="grande">Grandes Caminos</option>
                          <option value="mayor">Caminos Mayores</option>
                          <option value="menor">Caminos Menores</option>
                          <option value="senda">Sendas</option>
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white font-medium"
                            onClick={() => handleSave(road)}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-gray-600 hover:bg-gray-800"
                            onClick={() => setEditingRoadId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Road name and type */}
                        <div className="flex items-center gap-3 mb-2">
                          <div 
                            className="w-6 h-2 rounded-full"
                            style={{ backgroundColor: roadConfig.color }}
                          />
                          <span className="font-semibold text-base text-white flex-1">{road.nombre}</span>
                        </div>
                        
                        {/* Type badge and points */}
                        <div className="flex items-center gap-2 mb-3">
                          <Badge 
                            className="text-sm px-3 py-1"
                            style={{ 
                              backgroundColor: roadConfig.color + '30', 
                              color: roadConfig.color,
                              border: `1px solid ${roadConfig.color}50`
                            }}
                          >
                            {roadConfig.label}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            {road.puntos?.length || 0} puntos
                          </span>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-9 text-sm border-[#c9a227]/50 hover:bg-[#c9a227]/20 text-[#c9a227]"
                            onClick={() => handleView(road)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-blue-500/50 hover:bg-blue-900/30 text-blue-400"
                            onClick={() => setEditingRoadId(road.id)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-red-500/50 hover:bg-red-900/30 text-red-400"
                            onClick={() => onDeleteRoad?.(road.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
      
      {/* Footer stats */}
      <div className="p-4 border-t border-[#c9a227]/30 bg-gradient-to-r from-[#2a2015] to-[#1a1510]">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFD700' }} />
            <span className="text-gray-300">Grandes: {grandesCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#C9A227' }} />
            <span className="text-gray-300">Mayores: {mayoresCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#A08050' }} />
            <span className="text-gray-300">Menores: {menoresCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B7355' }} />
            <span className="text-gray-300">Sendas: {sendasCount}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RoadsPanel;
