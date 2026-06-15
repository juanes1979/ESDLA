/**
 * Create Location Panel Component
 * Form for creating new locations on the map with integrated name/history generator
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Plus, Loader2, MapPin, Sparkles, BookOpen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

const CreateLocationPanel = ({
  newLocationData,
  setNewLocationData,
  newLocationCoords,
  onCreate,
  onCancel,
  isCreating,
  isVisible = true,
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
  // Name generator state
  const [nameGenRegions, setNameGenRegions] = useState({});
  const [selectedGenRegion, setSelectedGenRegion] = useState('eriador');
  const [selectedGenRace, setSelectedGenRace] = useState('humano');
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingHistory, setIsGeneratingHistory] = useState(false);
  const [lastGeneratedName, setLastGeneratedName] = useState(null);

  // Race icons for display
  const RACE_ICONS = {
    humano: '👤',
    elfico: '🧝',
    enano: '⛏️',
    orco: '👹',
    hobbit: '🍃'
  };

  // Load name generator regions on mount
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const res = await api.get('/names/regions');
        setNameGenRegions(res.data);
      } catch (err) {
        console.error('Error loading name gen regions:', err);
      }
    };
    if (isVisible) loadRegions();
  }, [isVisible]);

  // Update available races when region changes
  useEffect(() => {
    if (selectedGenRegion && nameGenRegions[selectedGenRegion]) {
      const races = Object.keys(nameGenRegions[selectedGenRegion].razas);
      if (races.length > 0 && !races.includes(selectedGenRace)) {
        setSelectedGenRace(races[0]);
      }
    }
  }, [selectedGenRegion, nameGenRegions, selectedGenRace]);

  // Generate a name using AI
  const generateName = async () => {
    if (!selectedGenRegion || !selectedGenRace) return;
    
    setIsGeneratingName(true);
    try {
      const res = await api.get(`/names/generate-single/${selectedGenRegion}/${selectedGenRace}`);
      if (res.data.nombre) {
        setNewLocationData(prev => ({ ...prev, nombre: res.data.nombre }));
        setLastGeneratedName({
          nombre: res.data.nombre,
          region: selectedGenRegion,
          raza: selectedGenRace
        });
        toast.success(`Nombre generado: ${res.data.nombre}`);
      } else {
        toast.error(res.data.error || 'Error al generar nombre');
      }
    } catch (err) {
      console.error('Error generating name:', err);
      toast.error('Error al generar nombre');
    } finally {
      setIsGeneratingName(false);
    }
  };

  // Generate history using AI
  const generateHistory = async () => {
    const nameToUse = newLocationData.nombre;
    if (!nameToUse) {
      toast.error('Primero genera o escribe un nombre');
      return;
    }
    
    setIsGeneratingHistory(true);
    try {
      const res = await api.post('/names/generate-history', {
        nombre: nameToUse,
        region: lastGeneratedName?.region || selectedGenRegion,
        raza: lastGeneratedName?.raza || selectedGenRace
      });
      if (res.data.historia) {
        setNewLocationData(prev => ({ ...prev, descripcion: res.data.historia }));
        toast.success('Historia generada con IA');
      } else {
        toast.error(res.data.error || 'Error al generar historia');
      }
    } catch (err) {
      console.error('Error generating history:', err);
      toast.error('Error al generar historia');
    } finally {
      setIsGeneratingHistory(false);
    }
  };

  // Don't render if not visible
  if (!isVisible) return null;

  const availableGenRaces = selectedGenRegion && nameGenRegions[selectedGenRegion] 
    ? nameGenRegions[selectedGenRegion].razas 
    : {};
  
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
    <Card className="absolute top-4 right-4 w-96 bg-black/95 border-green-500/50 z-50 max-h-[calc(100%-2rem)] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg text-green-400">
            <Plus className="w-5 h-5 inline mr-1" /> Crear Nueva Ubicación
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto flex-1 min-h-0">
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
        
        {/* Name with Generator */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Nombre *</label>
          <Input
            value={newLocationData.nombre}
            onChange={(e) => setNewLocationData({ ...newLocationData, nombre: e.target.value })}
            placeholder="Nombre de la ubicación"
          />
          
          {/* Name Generator Section */}
          <div className="p-2 bg-purple-900/20 border border-purple-500/30 rounded-md space-y-2">
            <div className="flex items-center gap-1 text-xs text-purple-300">
              <Sparkles className="w-3 h-3" />
              <span>Generador de Nombres</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedGenRegion} onValueChange={setSelectedGenRegion}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Región" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(nameGenRegions).map(([key, data]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {data.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedGenRace} onValueChange={setSelectedGenRace}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Raza" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableGenRaces).map(([key, name]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {RACE_ICONS[key] || '🏷️'} {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={generateName}
              disabled={isGeneratingName}
              className="w-full h-7 text-xs bg-purple-600 hover:bg-purple-700"
            >
              {isGeneratingName ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generando...</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1" /> Generar Nombre</>
              )}
            </Button>
          </div>
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
        
        {/* Terrain Type */}
        <div>
          <label className="text-xs text-muted-foreground">Tipo de Terreno</label>
          <Select value={newLocationData.terreno} onValueChange={(v) => setNewLocationData({ ...newLocationData, terreno: v })}>
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
        
        {/* Description with AI Generator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Descripción</label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={generateHistory}
              disabled={isGeneratingHistory || !newLocationData.nombre}
              className="h-6 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 px-2"
              title={!newLocationData.nombre ? 'Primero escribe o genera un nombre' : 'Generar historia con IA'}
            >
              {isGeneratingHistory ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generando...</>
              ) : (
                <><BookOpen className="w-3 h-3 mr-1" /> Generar con IA</>
              )}
            </Button>
          </div>
          <textarea
            value={newLocationData.descripcion || ''}
            onChange={(e) => setNewLocationData({ ...newLocationData, descripcion: e.target.value })}
            className="w-full h-20 bg-black/50 border border-border rounded px-2 py-1 text-sm resize-none"
            placeholder="Descripción de la ubicación..."
          />
        </div>

        {(!newLocationData.nombre || !newLocationData.region || !newLocationCoords) && (
          <p className="text-xs text-yellow-400">
            * Haz clic en el mapa para seleccionar la ubicación
          </p>
        )}
      </CardContent>

      {/* Sticky footer with action buttons — always visible regardless of
          scroll position inside the panel (Iter 119.2). */}
      <div className="shrink-0 px-6 py-3 border-t border-border/30 bg-black/95">
        <Button
          onClick={onCreate}
          disabled={isCreating || !newLocationData.nombre || !newLocationData.region || !newLocationCoords}
          className="w-full bg-green-600 hover:bg-green-700"
          data-testid="create-location-submit"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          Crear Ubicación
        </Button>
      </div>
    </Card>
  );
};

export default CreateLocationPanel;
