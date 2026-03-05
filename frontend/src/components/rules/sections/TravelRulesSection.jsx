/**
 * Travel Rules Section Component
 * Allows editing travel rules, events, terrains, and land types
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Map, Save, Plus, Trash2, Edit, Check, X, 
  AlertTriangle, Footprints, Mountain, Compass
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

const TravelRulesSection = () => {
  // State for all travel configurations
  const [events, setEvents] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [terrains, setTerrains] = useState([]);
  const [landTypes, setLandTypes] = useState([]);
  const [rules, setRules] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingTerrain, setEditingTerrain] = useState(null);
  const [editingLand, setEditingLand] = useState(null);
  
  // Load all configurations
  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsRes, objectivesRes, terrainsRes, landRes, rulesRes] = await Promise.all([
          api.get('/travel/config/events'),
          api.get('/travel/config/objectives'),
          api.get('/travel/config/terrains'),
          api.get('/travel/config/land-types'),
          api.get('/travel/config/rules')
        ]);
        
        setEvents(eventsRes.data?.events || []);
        setObjectives(objectivesRes.data?.objectives || []);
        setTerrains(terrainsRes.data?.terrains || []);
        setLandTypes(landRes.data?.land_types || []);
        setRules(rulesRes.data?.rules || {});
      } catch (err) {
        console.error('Error loading travel config:', err);
        toast.error('Error al cargar configuración de viajes');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  // Save event
  const saveEvent = async (event) => {
    setSaving(true);
    try {
      await api.put(`/travel/config/events/${event.id}`, event);
      setEvents(prev => prev.map(e => e.id === event.id ? event : e));
      setEditingEvent(null);
      toast.success('Evento guardado');
    } catch (err) {
      toast.error('Error al guardar evento');
    } finally {
      setSaving(false);
    }
  };
  
  // Save terrain
  const saveTerrain = async (terrain) => {
    setSaving(true);
    try {
      await api.put(`/travel/config/terrains/${terrain.id}`, terrain);
      setTerrains(prev => prev.map(t => t.id === terrain.id ? terrain : t));
      setEditingTerrain(null);
      toast.success('Terreno guardado');
    } catch (err) {
      toast.error('Error al guardar terreno');
    } finally {
      setSaving(false);
    }
  };
  
  // Save land type
  const saveLandType = async (land) => {
    setSaving(true);
    try {
      await api.put(`/travel/config/land-types/${land.id}`, land);
      setLandTypes(prev => prev.map(l => l.id === land.id ? land : l));
      setEditingLand(null);
      toast.success('Tipo de tierra guardado');
    } catch (err) {
      toast.error('Error al guardar tipo de tierra');
    } finally {
      setSaving(false);
    }
  };
  
  // Save rules
  const saveRules = async () => {
    setSaving(true);
    try {
      await api.put('/travel/config/rules', rules);
      toast.success('Reglas guardadas');
    } catch (err) {
      toast.error('Error al guardar reglas');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Card className="card-parchment">
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[hsl(var(--gold))] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando configuración de viajes...</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card className="card-parchment">
        <CardHeader>
          <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <Compass className="w-6 h-6" />
            Reglas de Viaje
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configura las tablas de acontecimientos, terrenos, tipos de tierra y reglas generales del sistema de viajes.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="events" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="events" data-testid="tab-events">
                <AlertTriangle className="w-4 h-4 mr-1" /> Acontecimientos
              </TabsTrigger>
              <TabsTrigger value="terrains" data-testid="tab-terrains">
                <Mountain className="w-4 h-4 mr-1" /> Terrenos
              </TabsTrigger>
              <TabsTrigger value="lands" data-testid="tab-lands">
                <Map className="w-4 h-4 mr-1" /> Tipos de Tierra
              </TabsTrigger>
              <TabsTrigger value="rules" data-testid="tab-rules">
                <Footprints className="w-4 h-4 mr-1" /> Reglas
              </TabsTrigger>
            </TabsList>
            
            {/* EVENTS TAB */}
            <TabsContent value="events">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Tabla de acontecimientos de viaje (d20). Define qué sucede cuando la compañía se encuentra con un evento.
                  </p>
                  {events.map((event) => (
                    <Card 
                      key={event.id} 
                      className={`p-4 ${
                        event.d20_max <= 6 ? 'border-red-500/50 bg-red-900/10' :
                        event.d20_max <= 14 ? 'border-yellow-500/50 bg-yellow-900/10' :
                        'border-green-500/50 bg-green-900/10'
                      }`}
                    >
                      {editingEvent?.id === event.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">d20 Mín</Label>
                              <Input
                                type="number"
                                value={editingEvent.d20_min}
                                onChange={(e) => setEditingEvent({...editingEvent, d20_min: parseInt(e.target.value)})}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">d20 Máx</Label>
                              <Input
                                type="number"
                                value={editingEvent.d20_max}
                                onChange={(e) => setEditingEvent({...editingEvent, d20_max: parseInt(e.target.value)})}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">+CD Fatiga</Label>
                              <Input
                                type="number"
                                value={editingEvent.fatigue_cd_increase}
                                onChange={(e) => setEditingEvent({...editingEvent, fatigue_cd_increase: parseInt(e.target.value)})}
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Nombre</Label>
                            <Input
                              value={editingEvent.nombre}
                              onChange={(e) => setEditingEvent({...editingEvent, nombre: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Consecuencias (Éxito)</Label>
                            <textarea
                              value={editingEvent.consecuencias_exito}
                              onChange={(e) => setEditingEvent({...editingEvent, consecuencias_exito: e.target.value})}
                              className="w-full h-16 p-2 text-sm bg-background border border-input rounded resize-none"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Consecuencias (Fracaso)</Label>
                            <textarea
                              value={editingEvent.consecuencias_fracaso}
                              onChange={(e) => setEditingEvent({...editingEvent, consecuencias_fracaso: e.target.value})}
                              className="w-full h-16 p-2 text-sm bg-background border border-input rounded resize-none"
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={editingEvent.requiere_salvacion_extra}
                                onCheckedChange={(v) => setEditingEvent({...editingEvent, requiere_salvacion_extra: v})}
                              />
                              <Label className="text-xs">Requiere salvación extra</Label>
                            </div>
                            {editingEvent.requiere_salvacion_extra && (
                              <Select 
                                value={editingEvent.tipo_salvacion_extra || ''} 
                                onValueChange={(v) => setEditingEvent({...editingEvent, tipo_salvacion_extra: v})}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="destreza">Destreza</SelectItem>
                                  <SelectItem value="carisma">Carisma</SelectItem>
                                  <SelectItem value="sabiduria">Sabiduría</SelectItem>
                                  <SelectItem value="constitucion">Constitución</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Puntos Sombra:</Label>
                              <Input
                                type="number"
                                min={0}
                                className="w-16"
                                value={editingEvent.puntos_sombra || 0}
                                onChange={(e) => setEditingEvent({...editingEvent, puntos_sombra: parseInt(e.target.value) || 0})}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEvent(editingEvent)} disabled={saving}>
                              <Check className="w-4 h-4 mr-1" /> Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingEvent(null)}>
                              <X className="w-4 h-4 mr-1" /> Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono">
                                {event.d20_min === event.d20_max ? event.d20_min : `${event.d20_min}-${event.d20_max}`}
                              </Badge>
                              <span className="font-bold text-[hsl(var(--gold))]">{event.nombre}</span>
                              <Badge className={`text-xs ${
                                event.fatigue_cd_increase >= 3 ? 'bg-red-600' :
                                event.fatigue_cd_increase >= 2 ? 'bg-orange-600' :
                                event.fatigue_cd_increase >= 1 ? 'bg-yellow-600' :
                                'bg-green-600'
                              }`}>
                                +{event.fatigue_cd_increase} CD
                              </Badge>
                              {event.puntos_sombra > 0 && (
                                <Badge className="bg-purple-600 text-xs">
                                  {event.puntos_sombra} Sombra
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <span className="text-green-400">✓ Éxito:</span> {event.consecuencias_exito.substring(0, 80)}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="text-red-400">✗ Fracaso:</span> {event.consecuencias_fracaso.substring(0, 80)}...
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setEditingEvent({...event})}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            {/* TERRAINS TAB */}
            <TabsContent value="terrains">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Define la dificultad y modificadores para cada tipo de terreno.
                </p>
                {terrains.map((terrain) => (
                  <Card key={terrain.id} className="p-4 border-border/50">
                    {editingTerrain?.id === terrain.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">Nombre</Label>
                            <Input
                              value={editingTerrain.nombre}
                              onChange={(e) => setEditingTerrain({...editingTerrain, nombre: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">CD Prueba</Label>
                            <Input
                              type="number"
                              value={editingTerrain.cd_prueba}
                              onChange={(e) => setEditingTerrain({...editingTerrain, cd_prueba: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Mod. Velocidad</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={editingTerrain.modificador_velocidad}
                              onChange={(e) => setEditingTerrain({...editingTerrain, modificador_velocidad: parseFloat(e.target.value)})}
                            />
                          </div>
                          <div className="flex items-end">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={editingTerrain.permite_montura}
                                onCheckedChange={(v) => setEditingTerrain({...editingTerrain, permite_montura: v})}
                              />
                              <Label className="text-xs">Montura</Label>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveTerrain(editingTerrain)} disabled={saving}>
                            <Check className="w-4 h-4 mr-1" /> Guardar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTerrain(null)}>
                            <X className="w-4 h-4 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[hsl(var(--gold))]">{terrain.nombre}</span>
                          <Badge variant="outline">CD {terrain.cd_prueba}</Badge>
                          <Badge className={terrain.modificador_velocidad < 1 ? 'bg-red-600' : 'bg-green-600'}>
                            ×{terrain.modificador_velocidad} vel.
                          </Badge>
                          {!terrain.permite_montura && (
                            <Badge className="bg-yellow-600">Sin montura</Badge>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTerrain({...terrain})}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            {/* LAND TYPES TAB */}
            <TabsContent value="lands">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Configura los tipos de tierra y sus valores de PX por casilla.
                </p>
                {landTypes.map((land) => (
                  <Card 
                    key={land.id} 
                    className={`p-4 ${
                      land.tipo.includes('oscura') || land.tipo.includes('sombra') ? 'border-red-500/50 bg-red-900/10' :
                      land.tipo.includes('salvaje') ? 'border-orange-500/50 bg-orange-900/10' :
                      land.tipo.includes('fronteriza') ? 'border-yellow-500/50 bg-yellow-900/10' :
                      'border-green-500/50 bg-green-900/10'
                    }`}
                  >
                    {editingLand?.id === land.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Nombre</Label>
                          <Input
                            value={editingLand.nombre}
                            onChange={(e) => setEditingLand({...editingLand, nombre: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">PX Camino</Label>
                            <Input
                              type="number"
                              value={editingLand.px_camino}
                              onChange={(e) => setEditingLand({...editingLand, px_camino: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">PX Campo Abierto</Label>
                            <Input
                              type="number"
                              value={editingLand.px_campo_abierto}
                              onChange={(e) => setEditingLand({...editingLand, px_campo_abierto: parseInt(e.target.value)})}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">PX Terreno Difícil</Label>
                            <Input
                              type="number"
                              value={editingLand.px_terreno_dificil}
                              onChange={(e) => setEditingLand({...editingLand, px_terreno_dificil: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingLand.ventaja_acontecimientos}
                              onCheckedChange={(v) => setEditingLand({...editingLand, ventaja_acontecimientos: v})}
                            />
                            <Label className="text-xs">Ventaja eventos</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingLand.desventaja_acontecimientos}
                              onCheckedChange={(v) => setEditingLand({...editingLand, desventaja_acontecimientos: v})}
                            />
                            <Label className="text-xs">Desventaja eventos</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingLand.permite_ritmo_rapido}
                              onCheckedChange={(v) => setEditingLand({...editingLand, permite_ritmo_rapido: v})}
                            />
                            <Label className="text-xs">Permite ritmo rápido</Label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveLandType(editingLand)} disabled={saving}>
                            <Check className="w-4 h-4 mr-1" /> Guardar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingLand(null)}>
                            <X className="w-4 h-4 mr-1" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[hsl(var(--gold))]">{land.nombre}</span>
                            {land.ventaja_acontecimientos && (
                              <Badge className="bg-green-600 text-xs">Ventaja</Badge>
                            )}
                            {land.desventaja_acontecimientos && (
                              <Badge className="bg-red-600 text-xs">Desventaja</Badge>
                            )}
                            {!land.permite_ritmo_rapido && (
                              <Badge className="bg-yellow-600 text-xs">Sin ritmo rápido</Badge>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>Camino: <span className="text-[hsl(var(--gold))]">{land.px_camino} PX</span></span>
                            <span>Campo: <span className="text-[hsl(var(--gold))]">{land.px_campo_abierto} PX</span></span>
                            <span>Difícil: <span className="text-[hsl(var(--gold))]">{land.px_terreno_dificil} PX</span></span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditingLand({...land})}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            {/* RULES TAB */}
            <TabsContent value="rules">
              {rules && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Configuración general de las reglas del sistema de viajes.
                  </p>
                  
                  {/* Fatigue Rules */}
                  <Card className="p-4 border-red-500/30">
                    <h4 className="font-bold text-red-400 mb-3">Fatiga</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs">CD Base Fatiga</Label>
                        <Input
                          type="number"
                          value={rules.fatigue_base_cd}
                          onChange={(e) => setRules({...rules, fatigue_base_cd: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Niveles (fallo ≥5)</Label>
                        <Input
                          type="number"
                          value={rules.fatigue_fail_by_5_levels}
                          onChange={(e) => setRules({...rules, fatigue_fail_by_5_levels: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Niveles (fallo ≥10)</Label>
                        <Input
                          type="number"
                          value={rules.fatigue_fail_by_10_levels}
                          onChange={(e) => setRules({...rules, fatigue_fail_by_10_levels: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CD Marcha Forzada</Label>
                        <Input
                          type="number"
                          value={rules.forced_march_cd}
                          onChange={(e) => setRules({...rules, forced_march_cd: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </Card>
                  
                  {/* Orientation Rules */}
                  <Card className="p-4 border-blue-500/30">
                    <h4 className="font-bold text-blue-400 mb-3">Orientación</h4>
                    <div className="grid grid-cols-5 gap-4">
                      <div>
                        <Label className="text-xs">CD Orientación</Label>
                        <Input
                          type="number"
                          value={rules.orientation_cd}
                          onChange={(e) => setRules({...rules, orientation_cd: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dist. Fracaso</Label>
                        <Input
                          type="number"
                          value={rules.orientation_fail_distance}
                          onChange={(e) => setRules({...rules, orientation_fail_distance: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dist. Fracaso ≥5</Label>
                        <Input
                          type="number"
                          value={rules.orientation_fail_by_5_distance}
                          onChange={(e) => setRules({...rules, orientation_fail_by_5_distance: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dist. Éxito</Label>
                        <Input
                          type="number"
                          value={rules.orientation_success_distance}
                          onChange={(e) => setRules({...rules, orientation_success_distance: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dist. Éxito ≥5</Label>
                        <Input
                          type="number"
                          value={rules.orientation_success_by_5_distance}
                          onChange={(e) => setRules({...rules, orientation_success_by_5_distance: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                  </Card>
                  
                  {/* Speed Rules */}
                  <Card className="p-4 border-green-500/30">
                    <h4 className="font-bold text-green-400 mb-3">Velocidad</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs">Umbral Lento (pies)</Label>
                        <Input
                          type="number"
                          value={rules.speed_slow_threshold}
                          onChange={(e) => setRules({...rules, speed_slow_threshold: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Días (Lento)</Label>
                        <Input
                          type="number"
                          value={rules.speed_slow_days}
                          onChange={(e) => setRules({...rules, speed_slow_days: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Umbral Rápido (pies)</Label>
                        <Input
                          type="number"
                          value={rules.speed_fast_threshold}
                          onChange={(e) => setRules({...rules, speed_fast_threshold: parseInt(e.target.value)})}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Días (Rápido)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={rules.speed_fast_days}
                          onChange={(e) => setRules({...rules, speed_fast_days: parseFloat(e.target.value)})}
                        />
                      </div>
                    </div>
                  </Card>
                  
                  {/* Season Modifier */}
                  <Card className="p-4 border-yellow-500/30">
                    <h4 className="font-bold text-yellow-400 mb-3">Modificadores Estacionales</h4>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={rules.autumn_winter_disadvantage}
                        onCheckedChange={(v) => setRules({...rules, autumn_winter_disadvantage: v})}
                      />
                      <Label>Desventaja en salvaciones durante otoño/invierno</Label>
                    </div>
                  </Card>
                  
                  <Button onClick={saveRules} disabled={saving} className="w-full" data-testid="save-travel-rules-btn">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Reglas de Viaje
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TravelRulesSection;
