/**
 * ConfigView
 * Initial configuration: origin/destination search, route calc, map preview,
 * member assignments per role, mounts, weather indicators, journey start.
 * Extracted from EnhancedTravelSystem.jsx.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Route, Compass, Mountain, MapPin, Plus, X, Check, Shield,
  Footprints, AlertTriangle, Sparkles, Save, Users,
  ArrowLeftRight, ChevronRight, Coins, Loader2, Play, SkipForward,
  Activity, Bed
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import JourneyForecastCard from '../JourneyForecastCard';
import JourneyMiniMap from '../JourneyMiniMap';
import WeatherIndicator from '../WeatherIndicator';
import {
  MESES_ELFICOS, SeasonIcon, ROLE_ICONS, ROLE_INFO,
  MULTI_ROLE_PENALTY, MAX_ROLES_PER_CHARACTER
} from '../travelConstants';
import { calcModHabilidad, getModAtributo } from '../travelHelpers';

const ConfigView = ({
  config, locations, origenSearch, destinoSearch, origenOpen, destinoOpen,
  journeyCalc, loadingCalc, loadingComparison, routeComparison, showComparison,
  mapExpanded, characters, provisionsCheck, showProvisionsWarning, travelMode,
  initialFatigueOverrides = {}, setInitialFatigueOverrides = () => {},
  setConfig, setOrigenSearch, setDestinoSearch, setOrigenOpen, setDestinoOpen,
  setMapExpanded, setShowComparison, setShowProvisionsShop, setShowProvisionsWarning,
  setTravelMode,
  filterLocations, triggerCalculateJourney, compareRoutes,
  addMemberWithRole, removeRoleFromMember, updateMemberMount,
  // Companions
  addAcompanante, removeAcompanante, toggleAcompananteMount,
  startGlobalJourney, startDayByDayJourney,
  journeyWeather = [],
  openMapPicker = null,
}) => (
    <div className="space-y-6">
      {/* Origin & Destination */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Route className="w-5 h-5" /> Origen y Destino
            <Badge variant="outline" className="ml-2">{locations.length} ubicaciones</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Origin with Search */}
            <div>
              <Label className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-400" /> Origen
                </span>
                {openMapPicker && (
                  <button
                    type="button"
                    onClick={() => openMapPicker('origen')}
                    className="text-[11px] px-2 py-1 rounded bg-[hsl(var(--gold))/15] border border-[hsl(var(--gold))/30] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))/25]"
                    data-testid="origen-map-pick-btn"
                  >
                    📍 Indicar en mapa
                  </button>
                )}
              </Label>
              <div className="relative">
                <Input
                  placeholder="Buscar origen..."
                  value={origenSearch}
                  onChange={(e) => setOrigenSearch(e.target.value)}
                  onFocus={() => setOrigenOpen(true)}
                  className="mb-1"
                />
                {config.origenNombre && !origenOpen && (
                  <div className="p-2 bg-green-900/20 rounded border border-green-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="font-medium">{config.origenNombre}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setConfig(prev => ({ ...prev, origenId: '', origenNombre: '', origenX: null, origenY: null }));
                        setOrigenSearch('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {origenOpen && (
                  <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-auto border shadow-lg">
                    <ScrollArea className="h-60">
                      {Object.entries(filterLocations(origenSearch)).map(([region, locs]) => (
                        <div key={region} className="p-1">
                          <p className="text-xs font-bold text-[hsl(var(--gold))] px-2 py-1 sticky top-0 bg-card">{region}</p>
                          {locs.map(loc => (
                            <Button
                              key={loc.id}
                              variant="ghost"
                              className="w-full justify-start h-8 text-sm"
                              disabled={loc.id === config.destinoId}
                              onClick={() => {
                                setConfig(prev => ({ ...prev, origenId: loc.id, origenNombre: loc.nombre, origenX: null, origenY: null }));
                                setOrigenSearch('');
                                setOrigenOpen(false);
                              }}
                            >
                              {loc.refugio && <Shield className="w-3 h-3 text-green-400 mr-1" />}
                              {loc.nombre}
                            </Button>
                          ))}
                        </div>
                      ))}
                      {Object.keys(filterLocations(origenSearch)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ubicaciones</p>
                      )}
                    </ScrollArea>
                    <div className="border-t p-1">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setOrigenOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
            
            {/* Destination with Search */}
            <div>
              <Label className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-400" /> Destino
                </span>
                {openMapPicker && (
                  <button
                    type="button"
                    onClick={() => openMapPicker('destino')}
                    className="text-[11px] px-2 py-1 rounded bg-[hsl(var(--gold))/15] border border-[hsl(var(--gold))/30] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))/25]"
                    data-testid="destino-map-pick-btn"
                  >
                    📍 Indicar en mapa
                  </button>
                )}
              </Label>
              <div className="relative">
                <Input
                  placeholder="Buscar destino..."
                  value={destinoSearch}
                  onChange={(e) => setDestinoSearch(e.target.value)}
                  onFocus={() => setDestinoOpen(true)}
                  className="mb-1"
                />
                {config.destinoNombre && !destinoOpen && (
                  <div className="p-2 bg-red-900/20 rounded border border-red-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span className="font-medium">{config.destinoNombre}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setConfig(prev => ({ ...prev, destinoId: '', destinoNombre: '', destinoX: null, destinoY: null }));
                        setDestinoSearch('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {destinoOpen && (
                  <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-auto border shadow-lg">
                    <ScrollArea className="h-60">
                      {Object.entries(filterLocations(destinoSearch)).map(([region, locs]) => (
                        <div key={region} className="p-1">
                          <p className="text-xs font-bold text-[hsl(var(--gold))] px-2 py-1 sticky top-0 bg-card">{region}</p>
                          {locs.map(loc => (
                            <Button
                              key={loc.id}
                              variant="ghost"
                              className="w-full justify-start h-8 text-sm"
                              disabled={loc.id === config.origenId}
                              onClick={() => {
                                setConfig(prev => ({ ...prev, destinoId: loc.id, destinoNombre: loc.nombre, destinoX: null, destinoY: null }));
                                setDestinoSearch('');
                                setDestinoOpen(false);
                              }}
                            >
                              {loc.refugio && <Shield className="w-3 h-3 text-green-400 mr-1" />}
                              {loc.nombre}
                            </Button>
                          ))}
                        </div>
                      ))}
                      {Object.keys(filterLocations(destinoSearch)).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No se encontraron ubicaciones</p>
                      )}
                    </ScrollArea>
                    <div className="border-t p-1">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDestinoOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
          
          {/* Route Options */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.evitarSombra}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, evitarSombra: v }))}
              />
              <Label className="text-sm">Evitar Tierras de la Sombra</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.evitarTierrasOscuras}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, evitarTierrasOscuras: v }))}
              />
              <Label className="text-sm">Evitar Tierras Oscuras</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.preferirCaminos}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, preferirCaminos: v }))}
              />
              <Label className="text-sm">Preferir Caminos</Label>
            </div>
          </div>
          
          {/* Journey Calculation Result */}
          {loadingCalc && (
            <div className="p-4 bg-black/20 rounded animate-pulse">
              <p className="text-muted-foreground">Calculando ruta...</p>
            </div>
          )}
          
          {journeyCalc?.success && !loadingCalc && (
            <div className="p-4 bg-gradient-to-r from-[hsl(var(--gold))/10] to-transparent rounded-lg border border-[hsl(var(--gold))/30]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[hsl(var(--gold))]">Ruta Calculada</h4>
                <div className="flex gap-2">
                  <Badge>{journeyCalc.ruta.tipo_tierra_nombre}</Badge>
                  <Badge variant="outline">{journeyCalc.ruta.terreno_nombre || journeyCalc.ruta.terreno}</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--torch-orange))]">{journeyCalc.ruta.distance_km}</p>
                  <p className="text-xs text-muted-foreground">kilómetros</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--magic-blue))]">{journeyCalc.ruta.casillas}</p>
                  <p className="text-xs text-muted-foreground">casillas</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--gold))]">{journeyCalc.estimaciones.dias_estimados}</p>
                  <p className="text-xs text-muted-foreground">días estimados</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{journeyCalc.estimaciones.px_total}</p>
                  <p className="text-xs text-muted-foreground">PX totales</p>
                </div>
              </div>
              
              {/* Group Speed Info */}
              {journeyCalc.velocidad_grupo && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Footprints className="w-4 h-4 text-[hsl(var(--gold))]" />
                    <span className="text-[hsl(var(--gold))] font-medium">Velocidad del Grupo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 p-2 rounded">
                      <p className="text-muted-foreground text-xs">Km/día</p>
                      <p className="text-lg font-bold text-white">{journeyCalc.velocidad_grupo.km_por_dia}</p>
                    </div>
                    <div className="bg-black/30 p-2 rounded">
                      <p className="text-muted-foreground text-xs">Velocidad base</p>
                      <p className="text-lg font-bold text-white">{journeyCalc.velocidad_grupo.velocidad_metros || journeyCalc.velocidad_grupo.velocidad_pies} m</p>
                    </div>
                  </div>
                  {journeyCalc.velocidad_grupo.miembro_mas_lento && (
                    <p className="text-xs text-muted-foreground mt-2">
                      El grupo viaja a la velocidad de <span className="text-yellow-400">{journeyCalc.velocidad_grupo.miembro_mas_lento}</span>
                    </p>
                  )}
                  {journeyCalc.velocidad_grupo.desglose_velocidades && journeyCalc.velocidad_grupo.desglose_velocidades.length > 1 && (
                    <div className="mt-2 text-xs">
                      <p className="text-muted-foreground mb-1">Desglose por miembro:</p>
                      <div className="flex flex-wrap gap-1">
                        {journeyCalc.velocidad_grupo.desglose_velocidades.map((v, idx) => (
                          <span 
                            key={idx} 
                            className={`px-2 py-0.5 rounded ${v.velocidad_efectiva === (journeyCalc.velocidad_grupo.velocidad_metros || journeyCalc.velocidad_grupo.velocidad_pies) ? 'bg-yellow-600/30 text-yellow-400' : 'bg-black/30 text-gray-400'}`}
                          >
                            {v.nombre}: {v.velocidad_efectiva}m ({v.km_por_dia} km/día) {v.tiene_montura ? '🐴' : '🚶'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Terrain Breakdown - Detailed */}
              {journeyCalc.ruta?.terrain_summary && Object.keys(journeyCalc.ruta.terrain_summary).length > 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground mb-2">
                    <span className="text-[hsl(var(--gold))]">
                      <Mountain className="w-4 h-4 inline mr-1" />
                      Desglose del Terreno:
                    </span>
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(journeyCalc.ruta.terrain_summary)
                      .sort((a, b) => b[1] - a[1]) // Sort by distance descending
                      .map(([terrain, distance]) => {
                        const terrainNames = {
                          facil: { name: 'Fácil', color: 'bg-green-600', icon: '🌿' },
                          moderado: { name: 'Moderado', color: 'bg-yellow-600', icon: '🌾' },
                          dificil: { name: 'Difícil', color: 'bg-orange-600', icon: '🏔️' },
                          muy_dificil: { name: 'Muy Difícil', color: 'bg-red-600', icon: '⛰️' },
                          desalentador: { name: 'Desalentador', color: 'bg-purple-600', icon: '💀' }
                        };
                        const info = terrainNames[terrain] || { name: terrain, color: 'bg-gray-600', icon: '❓' };
                        const percentage = ((distance / journeyCalc.ruta.distance_km) * 100).toFixed(0);
                        
                        return (
                          <div key={terrain} className="bg-black/30 p-2 rounded">
                            <div className="flex items-center gap-1 mb-1">
                              <span>{info.icon}</span>
                              <span className="text-xs font-medium">{info.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${info.color} transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {distance.toFixed(1)} km
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Roads Used */}
              {journeyCalc.ruta?.roads_used?.length > 0 && (
                <div className="mt-2 p-3 bg-amber-900/20 rounded border border-amber-500/30 text-sm">
                  <p className="text-amber-400 mb-2">
                    <Route className="w-4 h-4 inline mr-1" />
                    Caminos utilizados (en orden de recorrido):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {journeyCalc.ruta.roads_used.map((road, i) => (
                      <Badge key={i} variant="outline" className="border-amber-500/50 text-amber-300">
                        <span className="inline-flex items-center justify-center w-5 h-5 mr-1 text-xs font-bold bg-amber-600/50 rounded-full">{i + 1}</span>
                        {road}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rivers Crossed */}
              {journeyCalc.ruta?.rivers_crossed?.length > 0 && (
                <div className="mt-2 p-3 bg-blue-900/20 rounded border border-blue-500/30 text-sm">
                  <p className="text-blue-400 mb-2">
                    🌊 Ríos a cruzar: {journeyCalc.ruta.rivers_crossed.length}
                  </p>
                </div>
              )}
              
              {/* PX Breakdown */}
              {/* PX Breakdown - New per-km system */}
              {journeyCalc.px_desglose && journeyCalc.estimaciones?.px_total > 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground mb-2">
                    <span className="text-[hsl(var(--gold))]">
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Experiencia del Viaje:
                    </span>
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-lg font-bold">{journeyCalc.estimaciones.px_total} PX</span>
                      <span className="text-xs text-muted-foreground">
                        ({journeyCalc.px_desglose.px_por_km_promedio} PX/km promedio)
                      </span>
                    </div>
                    
                    {/* Land type summary - show which lands give PX */}
                    {journeyCalc.ruta?.land_type_summary && Object.keys(journeyCalc.ruta.land_type_summary).length > 0 && (
                      <div className="text-xs space-y-1 border-t border-white/10 pt-2">
                        <p className="text-muted-foreground mb-1">Tierras atravesadas:</p>
                        {Object.entries(journeyCalc.ruta.land_type_summary).map(([land, km]) => {
                          const landNames = {
                            'tierras_libres': { name: 'Tierras Libres', color: 'text-green-400', px: false },
                            'tierras_fronterizas': { name: 'Tierras Fronterizas', color: 'text-yellow-400', px: true },
                            'tierras_salvajes': { name: 'Tierras Salvajes', color: 'text-orange-400', px: true },
                            'tierras_sombra': { name: 'Tierras de la Sombra', color: 'text-red-400', px: true },
                            'tierras_oscuras': { name: 'Tierras Oscuras', color: 'text-purple-400', px: true }
                          };
                          const info = landNames[land] || { name: land, color: 'text-white', px: false };
                          return (
                            <div key={land} className="flex justify-between items-center">
                              <span className={info.color}>{info.name}</span>
                              <span>
                                {km.toFixed(1)} km
                                {info.px && <span className="text-[hsl(var(--gold))] ml-1">★</span>}
                              </span>
                            </div>
                          );
                        })}
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          ★ = Otorga experiencia
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Show when no PX */}
              {journeyCalc.px_desglose && journeyCalc.estimaciones?.px_total === 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground">
                    <Sparkles className="w-4 h-4 inline mr-1 text-gray-500" />
                    <span className="text-gray-400">0 PX</span>
                    <span className="text-xs ml-2">(El viaje por Tierras Libres no otorga experiencia)</span>
                  </p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mt-3">
                {journeyCalc.modificadores.tiene_ventaja_eventos && (
                  <Badge className="bg-green-600">Ventaja en eventos</Badge>
                )}
                {journeyCalc.modificadores.tiene_desventaja_eventos && (
                  <Badge className="bg-red-600">Desventaja en eventos</Badge>
                )}
                {journeyCalc.modificadores.desventaja_estacion && (
                  <Badge className="bg-blue-600/40 text-blue-200 border-blue-500/50" title="Indicativo de la estación. La desventaja en tiradas SÓLO se aplica si el día tiene clima adverso.">
                    Estación: {journeyCalc.estacion} (sin penalización si hace buen tiempo)
                  </Badge>
                )}
              </div>
              
              {/* Journey Map */}
              {journeyCalc.ruta?.origen_coords && journeyCalc.ruta?.destino_coords && (
                <div className="mt-4">
                  <JourneyMiniMap
                    origenCoords={journeyCalc.ruta.origen_coords}
                    destinoCoords={journeyCalc.ruta.destino_coords}
                    origenNombre={config.origenNombre}
                    destinoNombre={config.destinoNombre}
                    pathPoints={journeyCalc.ruta.path}
                    isDirectLine={journeyCalc.ruta.is_direct_line}
                    expanded={mapExpanded}
                    onToggleExpand={() => setMapExpanded(!mapExpanded)}
                    totalCasillas={journeyCalc.ruta.casillas || 0}
                  />
                </div>
              )}
              
              {/* Route warnings */}
              {journeyCalc.ruta?.warnings?.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-900/30 rounded border border-yellow-500/30 text-sm">
                  {journeyCalc.ruta.warnings.map((w, i) => (
                    <p key={i} className="text-yellow-400">⚠️ {w}</p>
                  ))}
                </div>
              )}
              
              {/* Compare Routes Button */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  className="w-full border-amber-500/50 text-amber-300 hover:bg-amber-900/30"
                  onClick={compareRoutes}
                  disabled={loadingComparison}
                >
                  {loadingComparison ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Comparando rutas...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      Comparar Rutas (Caminos vs Campo a Través)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Route Comparison Panel */}
          {showComparison && routeComparison && (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-amber-500/30">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[hsl(var(--gold))]">
                  <ArrowLeftRight className="w-5 h-5 inline mr-2" />
                  Comparación de Rutas
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComparison(false)}
                  className="text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Straight Line Reference */}
              {routeComparison.linea_recta && (
                <div className="mb-4 p-3 bg-blue-900/20 rounded border border-blue-500/30">
                  <p className="text-blue-400 text-sm mb-1">
                    📏 Línea Recta (teórica, sin obstáculos):
                  </p>
                  <p className="text-white font-bold">
                    {routeComparison.linea_recta.distance_km} km ({routeComparison.linea_recta.dias_teoricos} días)
                  </p>
                </div>
              )}
              
              {/* Routes Comparison Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Route by Roads */}
                {routeComparison.ruta_caminos && (
                  <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-500/40">
                    <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                      <Route className="w-4 h-4" />
                      Ruta por Caminos
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distancia:</span>
                        <span className="text-white font-bold">{routeComparison.ruta_caminos.distance_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Días estimados:</span>
                        <span className="text-[hsl(var(--gold))] font-bold">{routeComparison.ruta_caminos.dias_estimados}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Caminos usados:</span>
                        <span className="text-amber-300">{routeComparison.ruta_caminos.roads_used?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Desvío vs recta:</span>
                        <span className="text-orange-400">+{routeComparison.ruta_caminos.desvio_vs_recta_km} km</span>
                      </div>
                      
                      {/* Terrain breakdown mini */}
                      {routeComparison.ruta_caminos.terrain_summary && (
                        <div className="mt-2 pt-2 border-t border-amber-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Terreno:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(routeComparison.ruta_caminos.terrain_summary).map(([t, km]) => (
                              <span key={t} className="text-xs px-1 py-0.5 bg-black/30 rounded">
                                {t}: {km.toFixed(0)}km
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {routeComparison.ruta_caminos.has_land_violations && (
                        <div className="mt-2 p-2 bg-red-900/30 rounded">
                          <p className="text-red-400 text-xs">⚠️ Atraviesa tierras prohibidas</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Direct Route */}
                {routeComparison.ruta_directa && (
                  <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/40">
                    <h4 className="text-green-400 font-bold mb-3 flex items-center gap-2">
                      <Mountain className="w-4 h-4" />
                      Ruta Directa
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distancia:</span>
                        <span className="text-white font-bold">{routeComparison.ruta_directa.distance_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Días estimados:</span>
                        <span className="text-[hsl(var(--gold))] font-bold">{routeComparison.ruta_directa.dias_estimados}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Caminos usados:</span>
                        <span className="text-green-300">{routeComparison.ruta_directa.roads_used?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Desvío vs recta:</span>
                        <span className="text-orange-400">+{routeComparison.ruta_directa.desvio_vs_recta_km} km</span>
                      </div>
                      
                      {/* Terrain breakdown mini */}
                      {routeComparison.ruta_directa.terrain_summary && (
                        <div className="mt-2 pt-2 border-t border-green-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Terreno:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(routeComparison.ruta_directa.terrain_summary).map(([t, km]) => (
                              <span key={t} className="text-xs px-1 py-0.5 bg-black/30 rounded">
                                {t}: {km.toFixed(0)}km
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {routeComparison.ruta_directa.has_land_violations && (
                        <div className="mt-2 p-2 bg-red-900/30 rounded">
                          <p className="text-red-400 text-xs">⚠️ Atraviesa tierras prohibidas</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Comparison Summary */}
              {routeComparison.comparacion && (
                <div className="mt-4 p-3 bg-slate-800/50 rounded">
                  {routeComparison.comparacion.rutas_identicas ? (
                    <p className="text-center text-muted-foreground">
                      ℹ️ Las rutas son idénticas. Las barreras naturales (montañas, agua) fuerzan el mismo camino.
                    </p>
                  ) : (
                    <div className="text-center">
                      <p className="text-white">
                        La ruta <span className="text-amber-400 font-bold">{routeComparison.comparacion.ruta_mas_rapida === 'caminos' ? 'por Caminos' : 'Directa'}</span> es{' '}
                        <span className="text-green-400 font-bold">{Math.abs(routeComparison.comparacion.dias_diferencia)} días más rápida</span>
                      </p>
                      {Math.abs(routeComparison.comparacion.distancia_diferencia_km) > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Diferencia de {Math.abs(routeComparison.comparacion.distancia_diferencia_km)} km ({routeComparison.comparacion.porcentaje_mas_largo}% más largo)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Options reminder */}
              <div className="mt-3 text-xs text-muted-foreground text-center">
                {routeComparison.opciones?.evitar_sombra && <span className="mr-2">🛡️ Evitando Tierras de Sombra</span>}
                {routeComparison.opciones?.evitar_tierras_oscuras && <span>🛡️ Evitando Tierras Oscuras</span>}
              </div>
            </div>
          )}
          
          {journeyCalc?.error && (
            <div className="p-4 bg-red-900/20 rounded border border-red-500/30">
              <p className="text-red-400">{journeyCalc.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Travel Settings */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
            <Footprints className="w-5 h-5 inline mr-2" />
            Configuración del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Ritmo de Viaje</Label>
              <Select value={config.ritmo} onValueChange={(v) => setConfig(prev => ({ ...prev, ritmo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lento">🐢 Lento (15-20 km/día)</SelectItem>
                  <SelectItem value="normal">🚶 Normal (20-25 km/día)</SelectItem>
                  <SelectItem value="rapido">🏃 Forzado (25-30 km/día)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Mes</Label>
              <Select value={config.mes} onValueChange={(v) => setConfig(prev => ({ ...prev, mes: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_ELFICOS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <SeasonIcon estacion={m.estacion} />
                        {m.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Día del Mes</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={config.diaMes ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Permite vaciar el input para que el usuario pueda
                  // teclear un número nuevo sin tener que insertar un
                  // dígito antes de borrar el "1".
                  if (raw === '') {
                    setConfig(prev => ({ ...prev, diaMes: '' }));
                    return;
                  }
                  if (!/^\d{1,2}$/.test(raw)) return; // ignora caracteres no numéricos
                  setConfig(prev => ({ ...prev, diaMes: raw }));
                }}
                onBlur={() => {
                  const v = parseInt(config.diaMes, 10);
                  const clamped = Number.isNaN(v) ? 1 : Math.max(1, Math.min(30, v));
                  setConfig(prev => ({ ...prev, diaMes: clamped }));
                }}
                data-testid="journey-day-input"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Fecha de salida (1-30). Al terminar el viaje se calculará la fecha de llegada.
              </p>
            </div>
            
            {/* Vista previa del clima en origen y destino para el mes elegido */}
            {(config.origenId || config.destinoId) && (
              <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-3 items-center bg-black/20 rounded p-2" data-testid="weather-preview-config">
                <span className="text-xs text-muted-foreground">Clima previsto:</span>
                {config.origenId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{config.origenNombre}:</span>
                    <WeatherIndicator locationId={config.origenId} mes={config.mes} dia={config.diaMes} compact />
                  </div>
                )}
                {config.destinoId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">→ {config.destinoNombre}:</span>
                    <WeatherIndicator locationId={config.destinoId} mes={config.mes} dia={config.diaMes} compact />
                  </div>
                )}
              </div>
            )}
            
            <div className="p-3 rounded border border-amber-500/30 bg-amber-950/10">
              <Label className="text-xs text-amber-300">Marcha Forzada</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Se decide <strong>día a día</strong> tras la tirada de orientación. Un día de
                marcha forzada dobla el avance en km y obliga a una salvación de CON CD 15
                al final del día con consecuencias por margen de fallo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Party Roles - 4 Independent Fields */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Users className="w-5 h-5 inline mr-2" />
            Papeles de Viaje
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Asigna personajes a cada papel. Un mismo personaje puede tener varios papeles. Penalización general: 2 papeles −5, 3 papeles −6, 4 papeles (viaje en solitario) −7. Con 3+ papeles: desventaja en marcha forzada y +CD en eventos.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role Assignment Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
              // Get all members assigned to this role
              const assignedMembers = config.miembros.filter(m => m.papeles?.includes(roleKey));
              
              // Calculate bonus for each character for this role
              const getCharBonus = (char, member = null) => {
                if (!char) return { total: 0, atributo: 0, habilidad: 0, competente: false, penalizado: false };
                
                // Use the pre-calculated modifiers if member exists, otherwise calculate
                let modHabilidad;
                if (member) {
                  // Use pre-calculated modifier from member
                  if (roleKey === 'guia') modHabilidad = member.modViajar;
                  else if (roleKey === 'cazador') modHabilidad = member.modCaza;
                  else if (roleKey === 'vigia') modHabilidad = member.modPercepcion;
                  else if (roleKey === 'explorador') modHabilidad = member.modExplorar;
                  else modHabilidad = member.modSabiduria || 0;
                } else {
                  // Calculate from character data
                  modHabilidad = calcModHabilidad(char, roleInfo.habilidad);
                }
                
                // Check competencies
                const competencias = char.habilidades_competencia || char.habilidades || [];
                const pericias = char.pericia_elegida || [];
                const esCompetente = competencias.some(h => 
                  h.toLowerCase().includes(roleInfo.habilidad_key)
                );
                const tienePericia = pericias.some(p => 
                  p.toLowerCase().includes(roleInfo.habilidad_key)
                );
                
                // Check if this character has multiple roles (apply penalty)
                const tienePenalizacion = member?.papeles?.length > 1 || false;
                const penalizacion = tienePenalizacion ? MULTI_ROLE_PENALTY : 0;
                
                return {
                  total: modHabilidad + penalizacion,
                  totalSinPenalizacion: modHabilidad,
                  atributo: getModAtributo(char, roleInfo.atributo),
                  habilidad: modHabilidad,
                  competente: esCompetente,
                  tienePericia: tienePericia,
                  penalizado: tienePenalizacion,
                  penalizacion: penalizacion
                };
              };
              
              return (
                <Card 
                  key={roleKey} 
                  className={`p-4 ${assignedMembers.length > 0 ? 'border-green-500/50 bg-green-900/10' : 'border-border/50'}`}
                >
                  {/* Role Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-full ${
                      roleKey === 'guia' ? 'bg-blue-600' :
                      roleKey === 'cazador' ? 'bg-orange-600' :
                      roleKey === 'vigia' ? 'bg-purple-600' :
                      'bg-green-600'
                    }`}>
                      {ROLE_ICONS[roleKey]}
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--gold))]">{roleInfo.nombre}</h4>
                      <p className="text-xs text-muted-foreground">
                        {roleInfo.atributo_nombre} ({roleInfo.habilidad})
                      </p>
                    </div>
                  </div>
                  
                  {/* Role Description */}
                  <p className="text-xs text-muted-foreground mb-3 italic">
                    {roleInfo.desc}
                  </p>
                  
                  {/* Character Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Personaje asignado</Label>
                    <Select 
                      value="_select_"
                      onValueChange={(charId) => {
                        if (charId !== '_select_') {
                          addMemberWithRole(charId, roleKey);
                        }
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue>
                          {assignedMembers.length > 0 
                            ? `${assignedMembers.length} asignado(s)`
                            : <span className="text-muted-foreground">Seleccionar personaje</span>
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[60vh]">
                        <SelectItem value="_select_" disabled>
                          <span className="text-muted-foreground">Seleccionar personaje</span>
                        </SelectItem>
                        {characters.map(char => {
                          const member = config.miembros.find(m => m.id === char.id);
                          const bonus = getCharBonus(char, member);
                          const alreadyHasRole = member?.papeles?.includes(roleKey);
                          const hasMaxRoles = member?.papeles?.length >= MAX_ROLES_PER_CHARACTER;
                          const isDisabled = alreadyHasRole || (hasMaxRoles && !alreadyHasRole);
                          return (
                            <SelectItem 
                              key={char.id} 
                              value={char.id}
                              disabled={isDisabled}
                            >
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className={isDisabled ? 'text-muted-foreground' : ''}>
                                  {char.nombre}
                                  {member?.papeles?.length > 0 && !alreadyHasRole && (
                                    <span className={`text-xs ml-1 ${hasMaxRoles ? 'text-red-400' : 'text-yellow-400'}`}>
                                      ({member.papeles.length}/{MAX_ROLES_PER_CHARACTER} papeles)
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  {bonus.competente && (
                                    <Badge variant="outline" className="text-xs bg-green-900/30 border-green-500/50">
                                      {roleInfo.habilidad}
                                    </Badge>
                                  )}
                                  <Badge className={`${
                                    bonus.totalSinPenalizacion >= 5 ? 'bg-green-600' :
                                    bonus.totalSinPenalizacion >= 2 ? 'bg-yellow-600' :
                                    'bg-red-600'
                                  }`}>
                                    {bonus.totalSinPenalizacion >= 0 ? '+' : ''}{bonus.totalSinPenalizacion}
                                  </Badge>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    
                    {/* List of assigned members for this role */}
                    {assignedMembers.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {assignedMembers.map(member => {
                          const char = characters.find(c => c.id === member.id);
                          const bonus = getCharBonus(char, member);
                          const hasOtherRoles = member.papeles.length > 1;
                          
                          return (
                            <div 
                              key={member.id}
                              className={`p-2 rounded border flex items-center justify-between ${
                                hasOtherRoles ? 'border-yellow-500/50 bg-yellow-900/20' : 'border-green-500/30 bg-green-900/10'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{member.nombre}</span>
                                {hasOtherRoles && (
                                  <Badge className="bg-yellow-600 text-xs">
                                    ⚠️ {member.papeles.length} papeles: -5
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={bonus.total >= 2 ? 'bg-green-600' : bonus.total >= 0 ? 'bg-yellow-600' : 'bg-red-600'}>
                                  {bonus.total >= 0 ? '+' : ''}{bonus.total}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                  onClick={() => removeRoleFromMember(member.id, roleKey)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Mount selection for first assigned member */}
                    {assignedMembers.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {assignedMembers.map(member => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">{member.nombre}:</Label>
                            {member.monturaPropia ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Switch
                                  checked={member.tieneMontura}
                                  onCheckedChange={(v) => updateMemberMount(member.id, v)}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {member.tieneMontura ? member.monturaPropia.nombre : 'A pie'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin montura propia</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          
          {/* Penalty Warning */}
          {config.miembros.some(m => m.papeles?.length > 1) && (
            <div className="p-3 bg-yellow-900/30 rounded border border-yellow-500/50 text-sm">
              <p className="text-yellow-400 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Personajes con múltiples papeles:
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {config.miembros.filter(m => m.papeles?.length > 1).map(m => (
                  <li key={m.id}>
                    • <span className="text-white">{m.nombre}</span>: {m.papeles.map(p => ROLE_INFO[p]?.nombre).join(', ')} 
                    <span className="text-red-400"> → -5 en todas sus funciones y Percepción pasiva</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Forced march info (now day-by-day) */}

          {/* Summary of assigned roles */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
                const assigned = config.miembros.filter(m => m.papeles?.includes(roleKey));
                return (
                  <Badge 
                    key={roleKey}
                    className={assigned.length > 0 ? 'bg-green-600' : 'bg-red-600/50'}
                  >
                    {ROLE_ICONS[roleKey]}
                    <span className="ml-1">{roleInfo.nombre}:</span>
                    <span className="ml-1">{assigned.length > 0 ? assigned.map(a => a.nombre).join(', ') : 'Vacante'}</span>
                  </Badge>
                );
              })}
            </div>
          </div>
          
          {/* Warning if no guide */}
          {!config.miembros.some(m => m.papeles?.includes('guia')) && (
            <div className="p-2 bg-yellow-900/30 rounded border border-yellow-500/50 text-sm text-yellow-400">
              ⚠️ No hay ningún Guía asignado. Se requiere al menos uno para iniciar el viaje.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acompañantes (sin papel de viaje) */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Users className="w-5 h-5" />
            Acompañantes
            <Badge variant="outline" className="ml-2">
              {(config.acompanantes || []).length} / 10
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Personajes que viajan con el grupo pero <strong>no</strong> tienen un papel asignado. No
            hacen tiradas de eventos, orientación ni fatiga, pero <strong>sí</strong> consumen
            comida y agua, y <strong>sí</strong> influyen en la velocidad del grupo (la del más
            lento). Si tienen montura propia, su velocidad es la de la montura.
          </p>

          {/* Add companion selector */}
          {(config.acompanantes || []).length < 10 && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Añadir personaje como acompañante</Label>
                <Select
                  value=""
                  onValueChange={(v) => v && addAcompanante && addAcompanante(v)}
                >
                  <SelectTrigger data-testid="add-acompanante-select">
                    <SelectValue placeholder="Selecciona un personaje..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[60vh]">
                    {characters
                      .filter(c =>
                        !config.miembros.some(m => m.id === c.id) &&
                        !(config.acompanantes || []).some(a => a.id === c.id)
                      )
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                          {c.montura ? ` 🐎 (${c.montura.nombre || 'Montura'})` : ''}
                          {c.cultura_nombre ? ` — ${c.cultura_nombre}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* List of companions */}
          {(config.acompanantes || []).length > 0 && (
            <div className="space-y-2">
              {(config.acompanantes || []).map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 p-2 rounded border border-border/40 bg-black/20"
                  data-testid={`acompanante-item-${a.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.nombre}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({a.raza})
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Velocidad base: {a.velocidadBase}m
                      {a.tieneMontura && a.monturaPropia && (
                        <span className="ml-2 text-emerald-400">
                          🐎 Montado en {a.monturaNombre} ({a.monturaPropia.velocidad}m)
                        </span>
                      )}
                    </p>
                  </div>
                  {a.monturaPropia && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!a.tieneMontura}
                        onCheckedChange={(checked) =>
                          toggleAcompananteMount && toggleAcompananteMount(a.id, checked)
                        }
                        data-testid={`acompanante-mount-toggle-${a.id}`}
                      />
                      <span className="text-[11px] text-muted-foreground">A caballo</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAcompanante && removeAcompanante(a.id)}
                    className="text-red-400 hover:bg-red-500/10 h-7 w-7 p-0"
                    data-testid={`remove-acompanante-${a.id}`}
                    title="Quitar acompañante"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Travel Mode Selection */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Play className="w-5 h-5 inline mr-2" />
            Modo de Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-black/20 rounded border border-[hsl(var(--gold))]/20 mb-4">
            <div className="flex items-start gap-3">
              <ChevronRight className="w-5 h-5 text-[hsl(var(--gold))] flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-muted-foreground">
                <p className="font-bold text-[hsl(var(--gold))] mb-1">Jornada a Jornada (interactivo)</p>
                <p>
                  El viaje avanza de evento a evento: los días sin incidentes se
                  resumen automáticamente y la marcha solo se detiene en una
                  tirada de orientación o un acontecimiento. Durante esas paradas
                  podrás <strong>acampar</strong>, <strong>forrajear</strong> o
                  <strong> comprar provisiones</strong>. También dispones de un
                  botón <em>"Viaje global"</em> dentro del viaje para resolverlo
                  todo automáticamente con narrativa al final.
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={triggerCalculateJourney}
            disabled={!config.origenId || !config.destinoId}
            className="w-full h-12 text-lg mt-4"
            variant="outline"
            data-testid="calculate-route-btn"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Calcular Ruta
          </Button>
          
          {/* Provisions Warning */}
          {provisionsCheck && showProvisionsWarning && (!provisionsCheck.comidaSuficiente || !provisionsCheck.aguaSuficiente) && (
            <Card className="mt-3 p-3 border-yellow-500/50 bg-yellow-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-yellow-500 text-sm">Provisiones Insuficientes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para {journeyCalc?.estimaciones?.dias_estimados || '?'} días de viaje con {provisionsCheck?.numPersonajes || (config.miembros.filter(m => m.papeles?.length > 0).length + (config.acompanantes || []).length)} personas:
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className={provisionsCheck.comidaSuficiente ? 'text-green-400' : 'text-red-400'}>
                      <span className="font-medium">Comida:</span> {provisionsCheck.comidaDisponible.toFixed(1)}/{provisionsCheck.comidaNecesaria} raciones
                      {!provisionsCheck.comidaSuficiente && (
                        <span className="block text-yellow-400">Faltan {provisionsCheck.faltaComida.toFixed(1)} raciones</span>
                      )}
                    </div>
                    <div className={provisionsCheck.aguaSuficiente ? 'text-green-400' : 'text-red-400'}>
                      <span className="font-medium">Agua:</span> {provisionsCheck.aguaDisponible.toFixed(1)}/{provisionsCheck.aguaNecesaria}L
                      {!provisionsCheck.aguaSuficiente && (
                        <span className="block text-yellow-400">Faltan {provisionsCheck.faltaAgua.toFixed(1)}L</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Sin provisiones: +1 fatiga/día sin comida, +2 fatiga/día sin agua.
                    Puedes forrajear durante el viaje (Supervivencia CD 15).
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button 
                      size="sm" 
                      onClick={() => setShowProvisionsShop(true)}
                      className="text-xs bg-[hsl(var(--gold))] text-black hover:brightness-110"
                      data-testid="provisions-warning-buy-btn"
                    >
                      <Coins className="w-3.5 h-3.5 mr-1" />
                      Comprar provisiones
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowProvisionsWarning(false)}
                      className="text-xs"
                    >
                      Continuar de todos modos
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Fatiga inicial — heredada de la ficha, override con justificación.
              Se muestra TANTO los miembros con papel COMO los acompañantes,
              porque todos cruzan los mismos terrenos y empiezan el viaje
              con la fatiga que tengan en su ficha. */}
          {([...config.miembros, ...(config.acompanantes || [])]).length > 0 && (
            <Card className="mt-3 p-3 border border-orange-500/30 bg-orange-900/10">
              <div className="flex items-start gap-2 mb-3">
                <Activity className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-orange-300 text-sm">Fatiga inicial</p>
                  <p className="text-xs text-muted-foreground">
                    Por defecto se hereda de la ficha del personaje. El DJ puede
                    ajustarla y, opcionalmente, anotar una justificación que se
                    incluirá en la crónica del viaje.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 border-orange-500/40 hover:bg-orange-500/10"
                  data-testid="clear-group-fatigue-btn"
                  onClick={() => {
                    const overrides = {};
                    [...config.miembros, ...(config.acompanantes || [])]
                      .forEach(m => {
                        const ch = characters.find(c => c.id === m.id);
                        const fichaFat = Number(ch?.fatiga ?? 0);
                        if (fichaFat !== 0) {
                          overrides[m.id] = {
                            fatiga: 0,
                            justificacion: 'Eliminado por el DJ antes de iniciar el viaje.',
                            original: fichaFat,
                          };
                        }
                      });
                    setInitialFatigueOverrides(prev => ({ ...prev, ...overrides }));
                  }}
                  title="Pone la fatiga inicial a 0 para TODOS los viajeros (con papel y acompañantes)"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Eliminar cansancio del grupo
                </Button>
              </div>
              <div className="space-y-2">
                {[...config.miembros, ...(config.acompanantes || [])].map(m => {
                  const ch = characters.find(c => c.id === m.id);
                  const fatigaFicha = Number(ch?.fatiga ?? 0);
                  const ov = initialFatigueOverrides[m.id];
                  const fatigaActual = ov ? Number(ov.fatiga ?? fatigaFicha) : fatigaFicha;
                  const justificacion = ov?.justificacion || '';
                  const cambiada = fatigaActual !== fatigaFicha;
                  return (
                    <div
                      key={m.id}
                      className={`p-2 rounded border ${cambiada ? 'border-orange-500/40 bg-black/30' : 'border-transparent bg-black/20'}`}
                      data-testid={`initial-fatigue-row-${m.id}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Bed className="w-4 h-4 text-orange-400/70 flex-shrink-0" />
                        {/* Reset (a la izquierda de Ficha:) — solo si cambiada */}
                        {cambiada ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setInitialFatigueOverrides(prev => {
                                const next = { ...prev };
                                delete next[m.id];
                                return next;
                              });
                            }}
                            className="h-7 px-2 text-xs"
                            title="Restablecer al valor de ficha"
                          >
                            <X className="w-3 h-3 mr-1" /> Reset
                          </Button>
                        ) : (
                          <span className="w-[60px]" aria-hidden="true" />
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Ficha: <span className="font-mono text-orange-200">{fatigaFicha}</span>
                        </span>
                        <span className="font-medium text-sm flex-1 truncate text-[hsl(var(--gold))]">
                          {m.nombre}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setInitialFatigueOverrides(prev => ({
                              ...prev,
                              [m.id]: {
                                fatiga: 0,
                                justificacion: prev[m.id]?.justificacion || '',
                                original: fatigaFicha,
                              },
                            }));
                          }}
                          className="h-7 px-2 text-xs border-orange-500/30 hover:bg-orange-500/10"
                          data-testid={`set-fatigue-zero-${m.id}`}
                          title="Pone la fatiga inicial a 0 para este personaje"
                        >
                          Poner a 0
                        </Button>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Inicial:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={6}
                            value={fatigaActual}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(6, parseInt(e.target.value || '0', 10)));
                              setInitialFatigueOverrides(prev => ({
                                ...prev,
                                [m.id]: {
                                  fatiga: val,
                                  justificacion: prev[m.id]?.justificacion || '',
                                  original: fatigaFicha,
                                },
                              }));
                            }}
                            className="w-16 h-7 text-center"
                            data-testid={`initial-fatigue-input-${m.id}`}
                          />
                        </div>
                      </div>
                      {cambiada && (
                        <div className="mt-2">
                          <Label className="text-xs text-orange-300">
                            Justificación (opcional, se incluye en la crónica):
                          </Label>
                          <Textarea
                            value={justificacion}
                            onChange={(e) => {
                              const txt = e.target.value;
                              setInitialFatigueOverrides(prev => ({
                                ...prev,
                                [m.id]: {
                                  fatiga: prev[m.id]?.fatiga ?? fatigaActual,
                                  justificacion: txt,
                                  original: fatigaFicha,
                                },
                              }));
                            }}
                            placeholder="Ej: La compañía durmió tres noches en la Posada del Poney Pisador antes de partir."
                            rows={2}
                            className="text-xs mt-1"
                            data-testid={`initial-fatigue-justification-${m.id}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Button
            onClick={startGlobalJourney}
            disabled={!journeyCalc?.success || config.miembros.length === 0 || !config.miembros.some(m => m.papeles?.includes('guia'))}
            className="w-full h-12 text-lg mt-2"
            data-testid="start-journey-btn"
          >
            <Compass className="w-5 h-5 mr-2" />
            Iniciar Viaje (Jornada a Jornada)
          </Button>

          {/* Alerta predictiva — sólo cuando hay ruta válida + miembros con papel */}
          <JourneyForecastCard
            config={config}
            journeyCalc={journeyCalc}
            journeyWeather={journeyWeather}
            characters={characters}
            provisionsCheck={provisionsCheck}
          />
        </CardContent>
      </Card>
    </div>
);

export default ConfigView;
