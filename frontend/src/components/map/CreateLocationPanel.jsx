/**
 * Create Location Panel Component
 * Form for creating new locations on the map
 */
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Plus, Loader2, MapPin } from 'lucide-react';

const CreateLocationPanel = ({
  newLocationData,
  setNewLocationData,
  newLocationCoords,
  onCreate,
  onCancel,
  isCreating,
  regionsHierarchy,
  typeNames,
  locationIcons,
  staticRegionHierarchy,
  customTypes,
  isCreatingNewType,
  setIsCreatingNewType,
  newCustomType,
  setNewCustomType,
  onAddCustomType,
}) => {
  const renderRegionOptions = () => {
    if (regionsHierarchy && regionsHierarchy.length > 0) {
      return regionsHierarchy.map((region) => (
        <React.Fragment key={region.id}>
          <SelectItem value={region.nombre} className="font-bold text-[hsl(var(--gold))]">
            📍 {region.nombre}
          </SelectItem>
          {region.subregions?.map(sub => (
            <SelectItem key={sub.id} value={sub.nombre} className="pl-6 text-muted-foreground">
              ↳ {sub.nombre}
            </SelectItem>
          ))}
        </React.Fragment>
      ));
    }
    
    // Fallback to static hierarchy
    return Object.entries(staticRegionHierarchy).map(([key, data]) => (
      <React.Fragment key={key}>
        <SelectItem value={key} className="font-bold text-[hsl(var(--gold))]">
          📍 {data.label}
        </SelectItem>
        {data.subregions.map(sub => (
          <SelectItem key={sub} value={sub} className="pl-6 text-muted-foreground">
            ↳ {sub}
          </SelectItem>
        ))}
      </React.Fragment>
    ));
  };

  return (
    <Card className="absolute top-4 right-4 w-96 bg-black/95 border-green-500/50 z-50 max-h-[90vh] overflow-y-auto">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg text-green-400">
            <Plus className="w-5 h-5 inline mr-1" /> Crear Nueva Ubicación
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Position indicator */}
        {newLocationCoords ? (
          <div className="p-2 bg-green-900/30 border border-green-600/50 rounded text-sm text-green-200 flex items-center justify-between">
            <span>
              <MapPin className="w-4 h-4 inline mr-1" />
              Posición: ({newLocationCoords.x}, {newLocationCoords.y})
            </span>
          </div>
        ) : (
          <div className="p-2 bg-yellow-900/30 border border-yellow-600/50 rounded text-sm text-yellow-200">
            Haz clic en el mapa para seleccionar la posición
          </div>
        )}
        
        {/* Name */}
        <div>
          <label className="text-xs text-muted-foreground">Nombre *</label>
          <Input
            value={newLocationData.nombre}
            onChange={(e) => setNewLocationData({ ...newLocationData, nombre: e.target.value })}
            placeholder="Nombre de la ubicación"
          />
        </div>
        
        {/* Sindarin name */}
        <div>
          <label className="text-xs text-muted-foreground">Nombre Sindarin (opcional)</label>
          <Input
            value={newLocationData.nombre_sindarin || ''}
            onChange={(e) => setNewLocationData({ ...newLocationData, nombre_sindarin: e.target.value })}
            placeholder="Nombre en Sindarin"
          />
        </div>
        
        {/* Region */}
        <div>
          <label className="text-xs text-muted-foreground">Región *</label>
          <Select value={newLocationData.region} onValueChange={(v) => setNewLocationData({ ...newLocationData, region: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una región" />
            </SelectTrigger>
            <SelectContent>
              {renderRegionOptions()}
            </SelectContent>
          </Select>
        </div>
        
        {/* Type - with option to create new */}
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          {!isCreatingNewType ? (
            <div className="flex gap-2">
              <Select 
                value={newLocationData.tipo} 
                onValueChange={(v) => {
                  if (v === '__new__') {
                    setIsCreatingNewType(true);
                  } else {
                    setNewLocationData({ ...newLocationData, tipo: v });
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeNames).map(([key, name]) => (
                    <SelectItem key={key} value={key}>{locationIcons[key]} {name}</SelectItem>
                  ))}
                  {/* Custom types created by user */}
                  {customTypes.map(ct => (
                    <SelectItem key={ct} value={ct}>🏷️ {ct}</SelectItem>
                  ))}
                  <SelectItem value="__new__" className="text-green-400 border-t border-border/30 mt-1 pt-1">
                    <Plus className="w-3 h-3 inline mr-1" /> Crear nuevo tipo...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={newCustomType}
                onChange={(e) => setNewCustomType(e.target.value)}
                placeholder="Nombre del tipo (ej: posada)"
                className="flex-1"
                autoFocus
              />
              <Button
                size="sm"
                onClick={onAddCustomType}
                disabled={!newCustomType.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                Añadir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsCreatingNewType(false); setNewCustomType(''); }}
              >
                ✕
              </Button>
            </div>
          )}
        </div>
        
        {/* Terrain */}
        <div>
          <label className="text-xs text-muted-foreground">Terreno</label>
          <Select value={newLocationData.terreno} onValueChange={(v) => setNewLocationData({ ...newLocationData, terreno: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="facil">Fácil</SelectItem>
              <SelectItem value="moderado">Moderado</SelectItem>
              <SelectItem value="dificil">Difícil</SelectItem>
              <SelectItem value="severo">Severo</SelectItem>
              <SelectItem value="peligroso">Peligroso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Land type */}
        <div>
          <label className="text-xs text-muted-foreground">Tipo de Tierra</label>
          <Select value={newLocationData.tipo_tierra} onValueChange={(v) => setNewLocationData({ ...newLocationData, tipo_tierra: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tierras_libres">🟢 Tierras Libres</SelectItem>
              <SelectItem value="fronterizas">🟡 Fronterizas</SelectItem>
              <SelectItem value="tierras_salvajes">🟠 Tierras Salvajes</SelectItem>
              <SelectItem value="tierras_sombra">🔴 Tierras de Sombra</SelectItem>
              <SelectItem value="tierras_oscuras">⚫ Tierras Oscuras</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Refuge toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={newLocationData.refugio || false}
            onCheckedChange={(v) => setNewLocationData({ ...newLocationData, refugio: v })}
            id="new-refugio"
          />
          <Label htmlFor="new-refugio">Es refugio seguro</Label>
        </div>
        
        {/* Description */}
        <div>
          <label className="text-xs text-muted-foreground">Descripción</label>
          <textarea
            value={newLocationData.descripcion || ''}
            onChange={(e) => setNewLocationData({ ...newLocationData, descripcion: e.target.value })}
            className="w-full h-20 bg-black/50 border border-border rounded px-2 py-1 text-sm resize-none"
            placeholder="Descripción de la ubicación..."
          />
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border/30">
          <Button
            onClick={onCreate}
            disabled={isCreating || !newLocationData.nombre || !newLocationData.region || !newLocationCoords}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Crear Ubicación
          </Button>
        </div>
        
        {(!newLocationData.nombre || !newLocationData.region || !newLocationCoords) && (
          <p className="text-xs text-yellow-400">
            * Haz clic en el mapa para seleccionar la ubicación
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CreateLocationPanel;
