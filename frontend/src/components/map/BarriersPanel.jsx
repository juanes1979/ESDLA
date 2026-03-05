/**
 * Barriers Panel Component
 * Manages barrier drawing, editing and display on the map
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BARRIER_TYPES } from './mapConstants';

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

  return (
    <Card className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[80vh] overflow-hidden flex flex-col" data-testid="barriers-panel">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))] flex items-center gap-2">
            ⛰️ Gestión de Barreras
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBarriersPanel(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{barriers.length} barreras guardadas</p>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
        {barriers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay barreras dibujadas.<br/>
            Usa "Dibujar Barrera" para crear una.
          </p>
        ) : (
          barriers.map(barrier => {
            const barrierStyle = BARRIER_TYPES[barrier.tipo] || BARRIER_TYPES.mountain;
            const isEditing = editingBarrierId === barrier.id;
            
            return (
              <div 
                key={barrier.id}
                className={`p-3 rounded-lg border transition-all ${
                  selectedBarrier?.id === barrier.id 
                    ? 'border-orange-500 bg-orange-900/20' 
                    : 'border-border/30 bg-black/20 hover:bg-black/30'
                }`}
                data-testid={`barrier-${barrier.id}`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={barrier.nombre}
                      onChange={(e) => setBarriers(prev => prev.map(b => 
                        b.id === barrier.id ? { ...b, nombre: e.target.value } : b
                      ))}
                      className="h-8 text-sm"
                      placeholder="Nombre de la barrera"
                    />
                    <select
                      value={barrier.tipo}
                      onChange={(e) => setBarriers(prev => prev.map(b => 
                        b.id === barrier.id ? { ...b, tipo: e.target.value } : b
                      ))}
                      className="w-full h-8 text-sm bg-black/30 border border-border/30 rounded px-2"
                    >
                      {Object.entries(BARRIER_TYPES).map(([key, val]) => (
                        <option key={key} value={key}>{val.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleSave(barrier)}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingBarrierId(null)}
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
                          backgroundColor: barrierStyle.color,
                          borderStyle: barrierStyle.dashed ? 'dashed' : 'solid'
                        }}
                      />
                      <span className="font-medium text-sm flex-1">{barrier.nombre}</span>
                      <span 
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: barrierStyle.color + '40', color: barrierStyle.color }}
                      >
                        {barrierStyle.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {barrier.puntos?.length || 0} puntos
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs flex-1"
                        onClick={() => handleView(barrier)}
                      >
                        👁️ Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => setEditingBarrierId(barrier.id)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs text-red-400 hover:text-red-300"
                        onClick={() => onDeleteBarrier?.(barrier.id)}
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
          <span>⛰️ Cordilleras: {barriers.filter(b => b.tipo === 'mountain').length}</span>
          <span>🧱 Muros: {barriers.filter(b => b.tipo === 'wall').length}</span>
          <span>🚧 Fronteras: {barriers.filter(b => b.tipo === 'border').length}</span>
        </div>
      </div>
    </Card>
  );
};

export default BarriersPanel;
