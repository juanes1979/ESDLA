/**
 * Rivers Panel Component
 * Manages river drawing, editing and display on the map
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RIVER_TYPES } from './mapConstants';

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

  return (
    <Card className="absolute top-4 right-4 w-80 card-parchment z-20 max-h-[80vh] overflow-hidden flex flex-col" data-testid="rivers-panel">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))] flex items-center gap-2">
            🌊 Gestión de Ríos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRiversPanel(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{rivers.length} ríos guardados</p>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto space-y-2 p-3">
        {rivers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay ríos dibujados.<br/>
            Usa "Dibujar Río" para crear uno.
          </p>
        ) : (
          rivers.map(river => {
            const riverStyle = RIVER_TYPES[river.tipo] || RIVER_TYPES.rio || { label: 'Desconocido', color: '#4169E1', width: 2 };
            const isEditing = editingRiverId === river.id;
            
            return (
              <div 
                key={river.id}
                className={`p-3 rounded-lg border transition-all ${
                  selectedRiver?.id === river.id 
                    ? 'border-blue-500 bg-blue-900/20' 
                    : 'border-border/30 bg-black/20 hover:bg-black/30'
                }`}
                data-testid={`river-${river.id}`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={river.nombre}
                      onChange={(e) => setRivers(prev => prev.map(r => 
                        r.id === river.id ? { ...r, nombre: e.target.value } : r
                      ))}
                      className="h-8 text-sm"
                      placeholder="Nombre del río"
                    />
                    <select
                      value={river.tipo}
                      onChange={(e) => setRivers(prev => prev.map(r => 
                        r.id === river.id ? { ...r, tipo: e.target.value } : r
                      ))}
                      className="w-full h-8 text-sm bg-black/30 border border-border/30 rounded px-2"
                    >
                      {Object.entries(RIVER_TYPES).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleSave(river)}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingRiverId(null)}
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
                        style={{ backgroundColor: riverStyle.color }}
                      />
                      <span className="font-medium text-sm flex-1">{river.nombre}</span>
                      <span 
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: riverStyle.color + '40', color: riverStyle.color }}
                      >
                        {riverStyle.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {river.puntos?.length || 0} puntos
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs flex-1"
                        onClick={() => handleView(river)}
                      >
                        👁️ Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => setEditingRiverId(river.id)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs text-red-400 hover:text-red-300"
                        onClick={() => onDeleteRiver?.(river.id)}
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
          <span>🌊 Ríos: {rivers.filter(r => r.tipo === 'river').length}</span>
          <span>💧 Arroyos: {rivers.filter(r => r.tipo === 'stream').length}</span>
          <span>🏞️ Grandes: {rivers.filter(r => r.tipo === 'major').length}</span>
        </div>
      </div>
    </Card>
  );
};

export default RiversPanel;
