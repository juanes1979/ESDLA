/**
 * Barriers Panel Component
 * Manages barrier drawing, editing and display on the map
 */
import { useState } from 'react';
import { X, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Barrier types configuration
const BARRIER_TYPES_CONFIG = {
  cordillera: { label: 'Cordillera', color: '#808080', description: 'Cadena montañosa' },
  montaña: { label: 'Montaña', color: '#696969', description: 'Montaña individual' },
  colinas: { label: 'Colinas', color: '#A0A0A0', description: 'Zona de colinas' },
  muro: { label: 'Muro', color: '#8B4513', description: 'Muro o fortificación' },
  frontera: { label: 'Frontera', color: '#DC143C', description: 'Frontera territorial' },
  // Legacy mappings
  mountain: { label: 'Cordillera', color: '#808080', description: 'Cadena montañosa' },
  wall: { label: 'Muro', color: '#8B4513', description: 'Muro o fortificación' },
  border: { label: 'Frontera', color: '#DC143C', description: 'Frontera territorial' },
};

const BarriersPanel = ({
  barriers = [],
  setBarriers,
  selectedBarrier,
  setSelectedBarrier,
  showBarriersPanel,
  setShowBarriersPanel,
  onDeleteBarrier,
  onUpdateBarrier,
  onCenterOnBarrier,
}) => {
  const [editingBarrierId, setEditingBarrierId] = useState(null);

  if (!showBarriersPanel) return null;

  const handleSave = async (barrier) => {
    await onUpdateBarrier?.(barrier.id, { nombre: barrier.nombre, tipo: barrier.tipo });
    setEditingBarrierId(null);
  };

  const handleView = (barrier) => {
    setSelectedBarrier(barrier);
    onCenterOnBarrier?.(barrier);
  };

  // Count barriers by type
  const countByType = (types) => barriers.filter(b => types.includes(b.tipo)).length;
  const cordillerasCount = countByType(['cordillera', 'mountain', 'montaña']);
  const murosCount = countByType(['muro', 'wall']);
  const fronterasCount = countByType(['frontera', 'border']);

  return (
    <Card 
      className="absolute top-16 right-4 w-96 z-50 bg-[#1a1515] border-2 border-orange-500/50 shadow-2xl"
      data-testid="barriers-panel"
    >
      {/* Header */}
      <CardHeader className="pb-3 border-b border-orange-500/30 bg-gradient-to-r from-[#251a1a] to-[#1a1515]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-orange-400 flex items-center gap-3">
            <span className="text-2xl">⛰️</span>
            Gestión de Barreras
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBarriersPanel(false)}
            className="h-8 w-8 p-0 hover:bg-red-900/30 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-sm text-orange-300 mt-1">{barriers.length} barreras guardadas</p>
      </CardHeader>
      
      {/* Content */}
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {barriers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-base mb-2">No hay barreras dibujadas.</p>
                <p className="text-gray-500 text-sm">Usa "Dibujar Barrera" para crear una.</p>
              </div>
            ) : (
              barriers.map(barrier => {
                const barrierConfig = BARRIER_TYPES_CONFIG[barrier.tipo] || BARRIER_TYPES_CONFIG.cordillera;
                const isEditing = editingBarrierId === barrier.id;
                const isSelected = selectedBarrier?.id === barrier.id;
                
                return (
                  <div 
                    key={barrier.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'border-yellow-500 bg-yellow-900/30' 
                        : 'border-orange-500/30 bg-black/40 hover:bg-black/60 hover:border-orange-500/50'
                    }`}
                    data-testid={`barrier-${barrier.id}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={barrier.nombre}
                          onChange={(e) => setBarriers(prev => prev.map(b => 
                            b.id === barrier.id ? { ...b, nombre: e.target.value } : b
                          ))}
                          className="h-10 text-base bg-black/50 border-orange-500/50 text-white"
                          placeholder="Nombre de la barrera"
                        />
                        <select
                          value={barrier.tipo}
                          onChange={(e) => setBarriers(prev => prev.map(b => 
                            b.id === barrier.id ? { ...b, tipo: e.target.value } : b
                          ))}
                          className="w-full h-10 text-base bg-black/50 border border-orange-500/50 rounded-md px-3 text-white"
                        >
                          <option value="cordillera">Cordillera</option>
                          <option value="montaña">Montaña</option>
                          <option value="colinas">Colinas</option>
                          <option value="muro">Muro</option>
                          <option value="frontera">Frontera</option>
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-9 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                            onClick={() => handleSave(barrier)}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-gray-600 hover:bg-gray-800"
                            onClick={() => setEditingBarrierId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Barrier name and type */}
                        <div className="flex items-center gap-3 mb-2">
                          <div 
                            className="w-6 h-2 rounded-full"
                            style={{ backgroundColor: barrierConfig.color }}
                          />
                          <span className="font-semibold text-base text-white flex-1">{barrier.nombre}</span>
                        </div>
                        
                        {/* Type badge and points */}
                        <div className="flex items-center gap-2 mb-3">
                          <Badge 
                            className="text-sm px-3 py-1"
                            style={{ 
                              backgroundColor: barrierConfig.color + '30', 
                              color: barrierConfig.color,
                              border: `1px solid ${barrierConfig.color}50`
                            }}
                          >
                            {barrierConfig.label}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            {barrier.puntos?.length || 0} puntos
                          </span>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-9 text-sm border-orange-500/50 hover:bg-orange-900/30 text-orange-400"
                            onClick={() => handleView(barrier)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-yellow-500/50 hover:bg-yellow-900/30 text-yellow-400"
                            onClick={() => setEditingBarrierId(barrier.id)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-red-500/50 hover:bg-red-900/30 text-red-400"
                            onClick={() => onDeleteBarrier?.(barrier.id)}
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
      <div className="p-4 border-t border-orange-500/30 bg-gradient-to-r from-[#251a1a] to-[#1a1515]">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#808080' }} />
            <span className="text-gray-300">Cordilleras: {cordillerasCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B4513' }} />
            <span className="text-gray-300">Muros: {murosCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#DC143C' }} />
            <span className="text-gray-300">Fronteras: {fronterasCount}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BarriersPanel;
