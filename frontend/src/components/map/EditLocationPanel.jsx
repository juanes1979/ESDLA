/**
 * Edit Location Panel Component
 * Form for editing existing location properties
 */
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Save, Loader2, Trash2, Plus } from 'lucide-react';

const EditLocationPanel = ({
  location,
  formData,
  setFormData,
  onSave,
  onDelete,
  onCancel,
  isSaving,
  isDeleting,
  regionsHierarchy,
  typeNames,
  locationIcons,
  staticRegionHierarchy,
  customTypes = [],
  onAddCustomType,
}) => {
  const [isCreatingNewType, setIsCreatingNewType] = useState(false);
  const [newCustomType, setNewCustomType] = useState('');
  
  if (!location) return null;

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
    <Card className="absolute top-4 right-4 w-96 bg-black/95 border-[hsl(var(--torch-orange))]/50 z-50 max-h-[90vh] overflow-y-auto">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
            ✏️ Editar: {location.nombre}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Name */}
        <div>
          <label className="text-xs text-muted-foreground">Nombre</label>
          <Input
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Nombre de la ubicación"
          />
        </div>
        
        {/* Sindarin name */}
        <div>
          <label className="text-xs text-muted-foreground">Nombre Sindarin (opcional)</label>
          <Input
            value={formData.nombre_sindarin || ''}
            onChange={(e) => setFormData({ ...formData, nombre_sindarin: e.target.value })}
            placeholder="Nombre en Sindarin"
          />
        </div>
        
        {/* Region - Hierarchical Dropdown */}
        <div>
          <label className="text-xs text-muted-foreground">Región</label>
          <Select value={formData.region} onValueChange={(v) => setFormData({ ...formData, region: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona región" />
            </SelectTrigger>
            <SelectContent>
              {renderRegionOptions()}
            </SelectContent>
          </Select>
        </div>
        
        {/* Type */}
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          {!isCreatingNewType ? (
            <div className="flex gap-2">
              <Select 
                value={formData.tipo} 
                onValueChange={(v) => {
                  if (v === '__new__') {
                    setIsCreatingNewType(true);
                  } else {
                    setFormData({ ...formData, tipo: v });
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
                  {/* Show current type if it's not in the list (could be custom) */}
                  {formData.tipo && !typeNames[formData.tipo] && !customTypes.includes(formData.tipo) && (
                    <SelectItem value={formData.tipo}>🏷️ {formData.tipo}</SelectItem>
                  )}
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
                placeholder="Nombre del tipo (ej: túmulos)"
                className="flex-1"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => {
                  if (newCustomType.trim() && onAddCustomType) {
                    onAddCustomType(newCustomType);
                  }
                  setNewCustomType('');
                  setIsCreatingNewType(false);
                }}
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
        
        {/* Terrain Type */}
        <div>
          <label className="text-xs text-muted-foreground">Tipo de Terreno</label>
          <Select value={formData.terreno} onValueChange={(v) => setFormData({ ...formData, terreno: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="facil">🟢 Fácil</SelectItem>
              <SelectItem value="moderado">🟡 Moderado</SelectItem>
              <SelectItem value="dificil">🟠 Difícil</SelectItem>
              <SelectItem value="muy_dificil">🔴 Muy Difícil</SelectItem>
              <SelectItem value="desalentador">🟣 Desalentador</SelectItem>
              <SelectItem value="infranqueable">⬛ Infranqueable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Land type */}
        <div>
          <label className="text-xs text-muted-foreground">Tipo de Tierra</label>
          <Select value={formData.tipo_tierra} onValueChange={(v) => setFormData({ ...formData, tipo_tierra: v })}>
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
        
        {/* Danger level */}
        <div>
          <label className="text-xs text-muted-foreground">Nivel de Peligro</label>
          <Select value={formData.peligro || 'bajo'} onValueChange={(v) => setFormData({ ...formData, peligro: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bajo">Bajo</SelectItem>
              <SelectItem value="medio">Medio</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="muy_alto">Muy Alto</SelectItem>
              <SelectItem value="extremo">Extremo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Coordinates */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">X</label>
            <Input
              type="number"
              value={formData.x}
              onChange={(e) => setFormData({ ...formData, x: parseFloat(e.target.value) })}
              step="0.1"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Y</label>
            <Input
              type="number"
              value={formData.y}
              onChange={(e) => setFormData({ ...formData, y: parseFloat(e.target.value) })}
              step="0.1"
            />
          </div>
        </div>
        
        {/* Refuge toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.refugio || false}
            onCheckedChange={(v) => setFormData({ ...formData, refugio: v })}
            id="refugio"
          />
          <Label htmlFor="refugio">Es refugio seguro</Label>
        </div>
        
        {/* Description */}
        <div>
          <label className="text-xs text-muted-foreground">Descripción</label>
          <textarea
            value={formData.descripcion || ''}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            className="w-full h-20 bg-black/50 border border-border rounded px-2 py-1 text-sm resize-none"
            placeholder="Descripción de la ubicación..."
          />
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border/30">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Guardar
          </Button>
          <Button
            onClick={onDelete}
            disabled={isDeleting}
            variant="outline"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EditLocationPanel;
