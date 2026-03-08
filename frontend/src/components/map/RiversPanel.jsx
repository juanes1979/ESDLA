/**
 * Rivers Panel Component
 * Manages river drawing, editing and display on the map
 */
import { useState } from 'react';
import { X, Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// River types configuration
const RIVER_TYPES_CONFIG = {
  rio: { label: 'Río', color: '#4169E1', description: 'Río normal' },
  arroyo: { label: 'Arroyo', color: '#6495ED', description: 'Arroyo pequeño' },
  grande: { label: 'Río Grande', color: '#1E90FF', description: 'Río caudaloso' },
  profundo: { label: 'Río Profundo', color: '#0000CD', description: 'Río profundo' },
  // Legacy mappings
  river: { label: 'Río', color: '#4169E1', description: 'Río normal' },
  stream: { label: 'Arroyo', color: '#6495ED', description: 'Arroyo pequeño' },
  major: { label: 'Río Grande', color: '#1E90FF', description: 'Río caudaloso' },
};

const RiversPanel = ({
  rivers = [],
  setRivers,
  selectedRiver,
  setSelectedRiver,
  showRiversPanel,
  setShowRiversPanel,
  onDeleteRiver,
  onUpdateRiver,
  onCenterOnRiver,
}) => {
  const [editingRiverId, setEditingRiverId] = useState(null);

  if (!showRiversPanel) return null;

  const handleSave = async (river) => {
    await onUpdateRiver?.(river.id, { nombre: river.nombre, tipo: river.tipo });
    setEditingRiverId(null);
  };

  const handleView = (river) => {
    setSelectedRiver(river);
    onCenterOnRiver?.(river);
  };

  // Count rivers by type
  const countByType = (types) => rivers.filter(r => types.includes(r.tipo)).length;
  const riosCount = countByType(['rio', 'river']);
  const arroyosCount = countByType(['arroyo', 'stream']);
  const grandesCount = countByType(['grande', 'major', 'profundo']);

  return (
    <Card 
      className="absolute top-16 right-4 w-96 z-50 bg-[#101520] border-2 border-blue-500/50 shadow-2xl"
      data-testid="rivers-panel"
    >
      {/* Header */}
      <CardHeader className="pb-3 border-b border-blue-500/30 bg-gradient-to-r from-[#151a28] to-[#101520]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-blue-400 flex items-center gap-3">
            <span className="text-2xl">🌊</span>
            Gestión de Ríos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRiversPanel(false)}
            className="h-8 w-8 p-0 hover:bg-red-900/30 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-sm text-blue-300 mt-1">{rivers.length} ríos guardados</p>
      </CardHeader>
      
      {/* Content */}
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {rivers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-base mb-2">No hay ríos dibujados.</p>
                <p className="text-gray-500 text-sm">Usa "Dibujar Río" para crear uno.</p>
              </div>
            ) : (
              rivers.map(river => {
                const riverConfig = RIVER_TYPES_CONFIG[river.tipo] || RIVER_TYPES_CONFIG.rio;
                const isEditing = editingRiverId === river.id;
                const isSelected = selectedRiver?.id === river.id;
                
                return (
                  <div 
                    key={river.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? 'border-cyan-400 bg-cyan-900/30' 
                        : 'border-blue-500/30 bg-black/40 hover:bg-black/60 hover:border-blue-500/50'
                    }`}
                    data-testid={`river-${river.id}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={river.nombre}
                          onChange={(e) => setRivers(prev => prev.map(r => 
                            r.id === river.id ? { ...r, nombre: e.target.value } : r
                          ))}
                          className="h-10 text-base bg-black/50 border-blue-500/50 text-white"
                          placeholder="Nombre del río"
                        />
                        <select
                          value={river.tipo}
                          onChange={(e) => setRivers(prev => prev.map(r => 
                            r.id === river.id ? { ...r, tipo: e.target.value } : r
                          ))}
                          className="w-full h-10 text-base bg-black/50 border border-blue-500/50 rounded-md px-3 text-white"
                        >
                          <option value="rio">Río</option>
                          <option value="arroyo">Arroyo</option>
                          <option value="grande">Río Grande</option>
                          <option value="profundo">Río Profundo</option>
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                            onClick={() => handleSave(river)}
                          >
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-gray-600 hover:bg-gray-800"
                            onClick={() => setEditingRiverId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* River name and type */}
                        <div className="flex items-center gap-3 mb-2">
                          <div 
                            className="w-6 h-2 rounded-full"
                            style={{ backgroundColor: riverConfig.color }}
                          />
                          <span className="font-semibold text-base text-white flex-1">{river.nombre}</span>
                        </div>
                        
                        {/* Type badge and points */}
                        <div className="flex items-center gap-2 mb-3">
                          <Badge 
                            className="text-sm px-3 py-1"
                            style={{ 
                              backgroundColor: riverConfig.color + '30', 
                              color: riverConfig.color,
                              border: `1px solid ${riverConfig.color}50`
                            }}
                          >
                            {riverConfig.label}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            {river.puntos?.length || 0} puntos
                          </span>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-9 text-sm border-blue-500/50 hover:bg-blue-900/30 text-blue-400"
                            onClick={() => handleView(river)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-cyan-500/50 hover:bg-cyan-900/30 text-cyan-400"
                            onClick={() => setEditingRiverId(river.id)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 border-red-500/50 hover:bg-red-900/30 text-red-400"
                            onClick={() => onDeleteRiver?.(river.id)}
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
      <div className="p-4 border-t border-blue-500/30 bg-gradient-to-r from-[#151a28] to-[#101520]">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4169E1' }} />
            <span className="text-gray-300">Ríos: {riosCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6495ED' }} />
            <span className="text-gray-300">Arroyos: {arroyosCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1E90FF' }} />
            <span className="text-gray-300">Grandes: {grandesCount}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RiversPanel;
