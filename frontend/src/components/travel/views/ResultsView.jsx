/**
 * ResultsView
 * Displays the post-journey results: stats, XP distribution, fatigue, provisions,
 * events log, narrative, and print/export actions.
 * Extracted from EnhancedTravelSystem.jsx.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Flag, Heart, Sparkles, Printer, FileText, BookOpen, Package,
  ArrowLeft, Plus, Check
} from 'lucide-react';
import JourneyMiniMap from '../JourneyMiniMap';
import JourneyDiary from '../JourneyDiary';
import WeatherIndicator from '../WeatherIndicator';
import NarrativeTTSPlayer from '../NarrativeTTSPlayer';
import { MESES_ELFICOS, ROLE_INFO } from '../travelConstants';
import { calculateGroupMultiplier } from '../travelHelpers';

const ResultsView = ({
  travelRules, events, journeyCalc, config, orientationChecks, fatigueResults,
  pxApplied, pxResults, applyingPX, characterXP,
  journeyChronicle, journeyNarrative, generatingNarrative, includeChronicleInPDF,
  currentPosition, nextEventPosition, locations,
  mapContainerRef, characters = [],
  eyeHistory = [],
  setMode, setIncludeChronicleInPDF, setJourneyChronicle,
  applyPXToCharacters, generateJourneyNarrative, printJourneyDocument, resetJourney,
}) => {
  // Calculate totals
  const totalFatigueCd = travelRules?.fatigue_base_cd || 10;
  let diasExtra = 0;
  let diasReducidos = 0;

  events.forEach(e => {
    if (e.resultado?.modificadores) {
      diasExtra += e.resultado.modificadores.dias_extra || 0;
      diasReducidos += e.resultado.modificadores.dias_reducidos || 0;
    }
  });

  const diasFinales = (journeyCalc?.estimaciones?.dias_estimados || 0) + diasExtra - diasReducidos;
  const eventosExitosos = events.filter(e => e.exito).length;
  const eventosFracasados = events.filter(e => e.resuelto && !e.exito).length;

  return (
    <div className="space-y-6">
      {/* Journey Map for PDF capture */}
      <div ref={mapContainerRef}>
        <JourneyMiniMap
          origenCoords={journeyCalc?.ruta?.origen_coords}
          destinoCoords={journeyCalc?.ruta?.destino_coords}
          origenNombre={config.origenNombre}
          destinoNombre={config.destinoNombre}
          pathPoints={journeyCalc?.ruta?.path}
          isDirectLine={!journeyCalc?.ruta?.path || journeyCalc.ruta.path.length < 3}
          events={events}
          totalCasillas={journeyCalc?.ruta?.casillas || 0}
        />
      </div>

      {/* Diario del Viaje (IA narrativa unificada por jornada) */}
      <JourneyDiary
        orientationChecks={orientationChecks}
        events={events.filter(e => e.resuelto)}
        fatigueResults={fatigueResults}
        miembros={config.miembros}
        origen={config.origenNombre}
        destino={config.destinoNombre}
        terreno={journeyCalc?.ruta?.terreno || 'campo_abierto'}
        tipoTierra={journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes'}
        diasTotales={journeyCalc?.estimaciones?.dias_estimados || orientationChecks.length}
        kilometros={journeyCalc?.ruta?.distance_km}
        fechaSalida={`${config.diaMes} de ${MESES_ELFICOS.find(m => m.id === config.mes)?.nombre?.split(' ')[0] || config.mes}`}
        mes={config.mes}
        diaMes={config.diaMes}
        origenRegion={(locations || []).find(l => l.id === config.origenId)?.region}
        destinoRegion={(locations || []).find(l => l.id === config.destinoId)?.region}
        pathRegions={journeyCalc?.ruta?.casillas_detalle?.map(c => c.region) || journeyCalc?.ruta?.regiones_por_casilla}
        chronicle={journeyChronicle}
        setChronicle={setJourneyChronicle}
      />

      {/* Journey Summary */}
      <Card className="card-parchment">
        <CardHeader>
          <CardTitle className="text-xl text-[hsl(var(--gold))]">
            <Flag className="w-6 h-6 inline mr-2" />
            Viaje Completado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">{config.origenNombre} → {config.destinoNombre}</h2>
            <div className="mt-3 flex justify-center gap-4 flex-wrap" data-testid="weather-results-banner">
              {config.origenId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{config.origenNombre}</span>
                  <WeatherIndicator locationId={config.origenId} mes={config.mes} dia={config.diaMes} />
                </div>
              )}
              {config.destinoId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{config.destinoNombre}</span>
                  <WeatherIndicator locationId={config.destinoId} mes={config.mes} dia={config.diaMes} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-black/20 p-4 rounded text-center">
              <p className="text-3xl font-bold text-[hsl(var(--gold))]">{diasFinales}</p>
              <p className="text-sm text-muted-foreground">días totales</p>
            </div>
            <div className="bg-black/20 p-4 rounded text-center">
              <p className="text-3xl font-bold text-green-400">{eventosExitosos}</p>
              <p className="text-sm text-muted-foreground">éxitos</p>
            </div>
            <div className="bg-black/20 p-4 rounded text-center">
              <p className="text-3xl font-bold text-red-400">{eventosFracasados}</p>
              <p className="text-sm text-muted-foreground">fracasos</p>
            </div>
            <div className="bg-black/20 p-4 rounded text-center">
              <p className="text-3xl font-bold text-[hsl(var(--torch-orange))]">
                {journeyCalc?.estimaciones?.px_total || 0}
              </p>
              <p className="text-sm text-muted-foreground">PX totales</p>
            </div>
          </div>

          {diasExtra > 0 && (
            <Badge className="bg-red-600 mr-2">+{diasExtra} días por percances</Badge>
          )}
          {diasReducidos > 0 && (
            <Badge className="bg-green-600">-{diasReducidos} días por atajos</Badge>
          )}
        </CardContent>
      </Card>

      {/* XP Distribution per Character */}
      <Card className="card-parchment border-2 border-green-500/50">
        <CardHeader>
          <CardTitle className="text-lg text-green-400">
            <Sparkles className="w-5 h-5 inline mr-2" />
            Puntos de Experiencia Ganados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Reparto del PX base del viaje: TODOS los viajeros (con papel y
            // acompañantes), porque todos cruzan el mismo terreno. Las PX
            // por tirada (individuales) sólo se ganan por quien tira.
            const allTravellers = [
              ...config.miembros,
              ...((config.acompanantes || []).map(a => ({ ...a, papeles: a.papeles || [] }))),
            ];
            const numMembers = Math.max(1, allTravellers.length);
            const journeyBasePX = journeyCalc?.estimaciones?.px_total || 0;
            const pxPerMemberFromJourney = Math.round(journeyBasePX / numMembers);

            return (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  {pxApplied
                    ? '¡Los PX han sido aplicados a las fichas de los personajes!'
                    : 'PX del viaje repartidos a partes iguales entre TODOS los viajeros + PX individuales por tiradas.'
                  }
                </p>

                <div className="p-3 bg-[hsl(var(--magic-blue))/10] rounded mb-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">PX base del viaje ({journeyCalc?.estimaciones?.distancia_km || 0} km):</span>
                    <span className="font-bold text-[hsl(var(--magic-blue))]">{journeyBasePX} PX</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">Dividido entre {numMembers} viajero{numMembers !== 1 ? 's' : ''}:</span>
                    <span className="font-bold text-[hsl(var(--gold))]">+{pxPerMemberFromJourney} PX c/u</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {allTravellers.map((member) => {
                    const memberResult = pxResults?.results?.find(r => r.character_id === member.id);
                    const papelesArr = member.papeles || [];
                    const hasMultiple = papelesArr.length > 1;
                    const memberXP = characterXP[member.id] || { total: 0, rolls: [] };
                    const rollCount = memberXP.rolls?.length || 0;
                    const successCount = memberXP.rolls?.filter(r => r.exito).length || 0;
                    const failCount = rollCount - successCount;

                    const allRolls = Object.values(characterXP).flatMap(c => c.rolls || []);
                    const aciertosTotales = allRolls.filter(r => r.exito).length;
                    const fallosTotales = allRolls.length - aciertosTotales;
                    const groupMult = calculateGroupMultiplier(aciertosTotales, fallosTotales);
                    const pxTiradasBruto = memberXP.total || 0;
                    const pxTiradasAjustado = Math.floor(pxTiradasBruto * groupMult.multiplicador);

                    const totalPXBruto = pxPerMemberFromJourney + pxTiradasAjustado;
                    const totalPXForMember = Math.max(0, totalPXBruto);

                    return (
                      <Card key={member.id} className={`p-4 ${pxApplied ? 'bg-green-600/20 border-green-400' : 'bg-green-900/20 border-green-500/30'}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-bold text-[hsl(var(--gold))]">{member.nombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {papelesArr.length ? papelesArr.map(p => ROLE_INFO[p]?.nombre || p).join(', ') : 'Acompañante'}
                            </p>
                            {hasMultiple && (
                              <p className="text-xs text-yellow-400">⚠️ Múltiples papeles: -5</p>
                            )}
                            <div className="text-xs mt-2 space-y-0.5">
                              <p className="text-[hsl(var(--magic-blue))]">
                                Viaje: +{pxPerMemberFromJourney}
                              </p>
                              <p className={pxTiradasBruto >= 0 ? 'text-green-400' : 'text-red-400'}>
                                Tiradas ({rollCount}): {pxTiradasBruto >= 0 ? '+' : ''}{pxTiradasBruto}
                                {rollCount > 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    ({successCount}✓ {failCount}✗)
                                  </span>
                                )}
                              </p>
                              {groupMult.multiplicador !== 1 && (
                                <p className="text-[hsl(var(--magic-blue))]">
                                  × {groupMult.multiplicador} (grupo {groupMult.tendencia.replace('_', ' ')}) = {pxTiradasAjustado >= 0 ? '+' : ''}{pxTiradasAjustado}
                                </p>
                              )}
                              {totalPXBruto < 0 && (
                                <p className="text-yellow-400 text-[10px]">
                                  Ajustado a 0 (mínimo)
                                </p>
                              )}
                            </div>
                            {memberResult && pxApplied && (
                              <p className="text-xs text-green-400 mt-1">
                                XP Total: {memberResult.xp_nuevo}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${totalPXForMember >= 0 ? (pxApplied ? 'text-green-300' : 'text-green-400') : 'text-red-400'}`}>
                              {pxApplied ? '✓' : '+'}{totalPXForMember}
                            </p>
                            <p className="text-xs text-muted-foreground">PX</p>
                          </div>
                        </div>
                        {!pxApplied && memberXP.rolls?.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-white">
                              Ver desglose tiradas
                            </summary>
                            <div className="mt-1 max-h-24 overflow-y-auto text-xs space-y-1 bg-black/20 p-2 rounded">
                              {memberXP.rolls.map((roll, idx) => (
                                <div key={idx} className={`flex justify-between ${roll.exito ? 'text-green-400' : 'text-red-400'}`}>
                                  <span>
                                    {roll.type === 'orientacion' ? '🧭' : '⚔️'}
                                    {roll.tirada} vs CD{roll.cd}
                                    {roll.critico && ' 🎉'}
                                    {roll.pifia && ' 💀'}
                                  </span>
                                  <span className="font-bold">
                                    {roll.pxFinal >= 0 ? '+' : ''}{roll.pxFinal}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </Card>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-black/30 rounded text-sm">
                  <p className="font-bold mb-2 text-[hsl(var(--gold))]">Resumen:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <p>PX base viaje: {journeyBasePX}</p>
                      <p>Total tiradas: {Object.values(characterXP).reduce((sum, c) => sum + (c.rolls?.length || 0), 0)}</p>
                      <p>Éxitos: {Object.values(characterXP).reduce((sum, c) => sum + (c.rolls?.filter(r => r.exito).length || 0), 0)} | Fracasos: {Object.values(characterXP).reduce((sum, c) => sum + (c.rolls?.filter(r => !r.exito).length || 0), 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">PX tiradas grupo: {Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0)}</p>
                      <p className="font-medium text-white">
                        PX Total Grupo: {journeyBasePX + Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {!pxApplied && (
            <Button
              onClick={applyPXToCharacters}
              disabled={applyingPX}
              className="w-full mt-4 h-12 text-lg bg-green-600 hover:bg-green-700"
              data-testid="apply-px-btn"
            >
              {applyingPX ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Aplicando PX...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Finalizar Viaje y Repartir PX
                </>
              )}
            </Button>
          )}

          {pxApplied && pxResults && (
            <div className="mt-4 p-3 bg-green-900/30 rounded border border-green-500/50">
              <p className="text-green-400 font-bold flex items-center gap-2">
                <Check className="w-5 h-5" />
                {pxResults.message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fatigue Results */}
      <Card className="card-parchment">
        <CardHeader>
          <CardTitle className="text-lg text-red-400">
            <Heart className="w-5 h-5 inline mr-2" />
            Tiradas de Fatiga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {fatigueResults.map((result, i) => (
                <Card key={i} className={`p-3 ${
                  result.niveles_cansancio === 0 ? 'bg-green-900/20 border-green-500/50' :
                  result.niveles_cansancio === 1 ? 'bg-yellow-900/20 border-yellow-500/50' :
                  result.niveles_cansancio === 2 ? 'bg-orange-900/20 border-orange-500/50' :
                  'bg-red-900/20 border-red-500/50'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{result.personaje}</span>
                      {result.papel && (
                        <Badge variant="outline">{ROLE_INFO[result.papel]?.nombre}</Badge>
                      )}
                    </div>
                    <Badge className={
                      result.resultado === 'éxito' ? 'bg-green-600' :
                      result.resultado === 'fracaso' ? 'bg-yellow-600' :
                      result.resultado === 'fracaso_grave' ? 'bg-orange-600' :
                      'bg-red-600'
                    }>
                      {result.niveles_cansancio} nivel(es) cansancio
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>
                      Tirada: <span className="font-mono">{result.tirada?.d20}</span> +
                      <span className="font-mono">{result.tirada?.modificador_con}</span> CON
                      {result.tirada?.bonus_montura > 0 && (
                        <span className="text-green-400"> + {result.tirada.bonus_montura} montura</span>
                      )}
                      {' = '}<span className="font-bold">{result.tirada?.total}</span>
                      {' vs CD '}<span className="text-red-400 font-bold">{result.cd}</span>
                    </p>
                    {result.niveles_cansancio > 0 && (
                      <div className="mt-2 p-2 bg-black/30 rounded text-xs">
                        <p className="font-bold text-yellow-400 mb-1">Efectos del cansancio:</p>
                        {result.niveles_cansancio >= 1 && <p>• Nivel 1: Desventaja en pruebas de característica</p>}
                        {result.niveles_cansancio >= 2 && <p>• Nivel 2: Velocidad reducida a la mitad</p>}
                        {result.niveles_cansancio >= 3 && <p>• Nivel 3: Desventaja en ataques y salvaciones</p>}
                        {result.niveles_cansancio >= 4 && <p>• Nivel 4: PG máximos reducidos a la mitad</p>}
                        {result.niveles_cansancio >= 5 && <p className="text-red-400">• Nivel 5: Velocidad reducida a 0</p>}
                        {result.niveles_cansancio >= 6 && <p className="text-red-600 font-bold">• Nivel 6: MUERTE</p>}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-4 p-3 bg-black/20 rounded">
            <p className="font-bold text-sm mb-2 text-[hsl(var(--gold))]">Referencia: Niveles de Cansancio</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex justify-between p-1 bg-yellow-900/30 rounded">
                <span>Nivel 1</span>
                <span className="text-muted-foreground">Desventaja en pruebas</span>
              </div>
              <div className="flex justify-between p-1 bg-yellow-900/40 rounded">
                <span>Nivel 2</span>
                <span className="text-muted-foreground">Velocidad ½</span>
              </div>
              <div className="flex justify-between p-1 bg-orange-900/40 rounded">
                <span>Nivel 3</span>
                <span className="text-muted-foreground">Desv. ataques/salv.</span>
              </div>
              <div className="flex justify-between p-1 bg-orange-900/50 rounded">
                <span>Nivel 4</span>
                <span className="text-muted-foreground">PG máx. ½</span>
              </div>
              <div className="flex justify-between p-1 bg-red-900/50 rounded">
                <span>Nivel 5</span>
                <span className="text-muted-foreground">Velocidad 0</span>
              </div>
              <div className="flex justify-between p-1 bg-red-900/70 rounded">
                <span>Nivel 6</span>
                <span className="text-red-400 font-bold">Muerte</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              <p><strong>Recuperación:</strong> Un descanso largo reduce 1 nivel (si come y bebe).</p>
              <p><strong>Acumulación:</strong> Los efectos son acumulativos.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Food and Water Consumption */}
      <Card className="card-parchment">
        <CardHeader>
          <CardTitle className="text-lg text-blue-400">
            <Package className="w-5 h-5 inline mr-2" />
            Provisiones Consumidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const numPersonajes = (config.miembros.filter(m => m.papeles?.length > 0).length + (config.acompanantes || []).length) || 1;
            const diasViaje = diasFinales || 1;
            const comidaTotal = numPersonajes * diasViaje * 0.5;
            const aguaTotal = numPersonajes * diasViaje * 4;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-900/20 p-4 rounded border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🍞</span>
                      <span className="font-bold text-amber-400">Comida</span>
                    </div>
                    <p className="text-2xl font-bold">{comidaTotal.toFixed(1)} kg</p>
                    <p className="text-xs text-muted-foreground">
                      {numPersonajes} personas × {diasViaje} días × 0.5 kg/día
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (500g por persona y día)
                    </p>
                  </div>
                  <div className="bg-blue-900/20 p-4 rounded border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💧</span>
                      <span className="font-bold text-blue-400">Agua</span>
                    </div>
                    <p className="text-2xl font-bold">{aguaTotal} L</p>
                    <p className="text-xs text-muted-foreground">
                      {numPersonajes} personas × {diasViaje} días × 4 L/día
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (8L en calor intenso)
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-black/30 rounded text-xs">
                  <p className="font-bold text-[hsl(var(--gold))] mb-2">Reglas de Supervivencia:</p>
                  <div className="space-y-1 text-muted-foreground">
                    <p><strong>Sin comida:</strong> Aguanta 3 + mod. CON días. Después, +1 nivel de cansancio/día.</p>
                    <p><strong>Media ración (250g):</strong> Cuenta como medio día sin comer.</p>
                    <p><strong>Mitad de agua:</strong> Prueba CON CD 15 o +1 cansancio.</p>
                    <p><strong>Sin agua:</strong> +1 cansancio automático (+2 si ya está cansado).</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Events Log */}
      <Card className="card-parchment">
        <CardHeader>
          <CardTitle className="text-lg">Registro de Acontecimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {events.map((e, i) => (
                <div
                  key={i}
                  className={`p-3 rounded ${e.exito ? 'bg-green-900/10' : 'bg-red-900/10'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="mr-2">Casilla {e.casilla}</Badge>
                      <span className="font-bold">{e.evento.nombre}</span>
                    </div>
                    <Badge className={e.exito ? 'bg-green-600' : 'bg-red-600'}>
                      {e.tirada} vs CD {e.resolucion?.cd}
                    </Badge>
                  </div>
                  {e.resultado?.consecuencias?.map((c, ci) => (
                    <p key={ci} className="text-xs text-muted-foreground mt-1">• {c}</p>
                  ))}
                  {e.narrativa && (
                    <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-[hsl(var(--gold))/30] pl-2">
                      {e.narrativa}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Heridos al llegar — mini-recap visual antes de la crónica */}
      {(() => {
        const todos = [
          ...(config?.miembros || []),
          ...((config?.acompanantes || []).map(a => ({ ...a, _esAcompanante: true }))),
        ];
        const heridos = [];
        for (const m of todos) {
          const ch = characters.find(c => c.id === m.id);
          if (!ch) continue;
          const pg = Number(ch.puntos_golpe_actual ?? ch.puntos_golpe_max ?? 0);
          const pgMax = Number(ch.puntos_golpe_max ?? 0);
          if (pgMax > 0 && pg <= 0) {
            const eventoCaida = events.find(e => e.evento?.id === 'event_terrible' && !e.exito);
            heridos.push({
              nombre: ch.nombre || m.nombre,
              dia: eventoCaida?.casilla,
              evento: eventoCaida?.evento?.nombre,
              pgMax,
            });
          }
        }
        if (heridos.length === 0) return null;
        return (
          <Card className="card-parchment border-2 border-red-500/50 bg-red-950/20" data-testid="heridos-recap-card">
            <CardHeader>
              <CardTitle className="text-lg text-red-300 flex items-center gap-2">
                <span className="text-2xl">💀</span>
                Heridos al llegar a {config.destinoNombre}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-200/80 mb-3 italic">
                {heridos.length === 1
                  ? `Un viajero llega inconsciente. Necesita curación urgente.`
                  : `${heridos.length} viajeros llegan inconscientes. La compañía necesita reposo y cuidados.`}
              </p>
              <ul className="space-y-2">
                {heridos.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" data-testid={`herido-${i}`}>
                    <span className="text-red-400 mt-0.5">•</span>
                    <div className="flex-1">
                      <span className="font-bold text-red-200">{h.nombre}</span>
                      <span className="text-red-300/70"> · 0 / {h.pgMax} PG</span>
                      {h.dia && (
                        <span className="text-red-300/60 text-xs ml-2 italic">
                          (Cayó el día {h.dia}{h.evento ? ` por "${h.evento}"` : ''})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })()}

      {/* Journey Narrative Section */}
      <Card className="card-parchment border-2 border-[hsl(var(--gold))]/30">
        <CardHeader>
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <BookOpen className="w-5 h-5 inline mr-2" />
            Crónica del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {journeyNarrative ? (
            <div className="prose prose-sm max-w-none">
              <p className="italic text-muted-foreground leading-relaxed text-justify border-l-4 border-[hsl(var(--gold))]/30 pl-4">
                {journeyNarrative}
              </p>
              {/* TTS deshabilitado a petición del usuario: las voces de
                  OpenAI tienen acento latinoamericano. Cuando dispongamos
                  de un TTS con voz castellana de España (estilo Gandalf)
                  se vuelve a habilitar. */}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Genera una narrativa épica en estilo Tolkien para este viaje.
            </p>
          )}

          <div className="flex gap-3 mt-4">
            <Button
              onClick={generateJourneyNarrative}
              disabled={generatingNarrative}
              variant="outline"
              className="flex-1"
            >
              {generatingNarrative ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  {journeyNarrative ? 'Regenerar Narrativa' : 'Generar Narrativa'}
                </>
              )}
            </Button>

            <Button
              onClick={printJourneyDocument}
              className="flex-1 bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
              data-testid="print-chronicle-btn"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Crónica
            </Button>

            <label className="flex items-center gap-2 px-3 py-2 border border-[hsl(var(--gold))]/30 rounded bg-black/20 cursor-pointer text-xs" data-testid="include-diary-pdf-toggle">
              <input
                type="checkbox"
                checked={includeChronicleInPDF}
                onChange={(e) => setIncludeChronicleInPDF(e.target.checked)}
                className="accent-[hsl(var(--gold))]"
              />
              <span>
                Incluir Crónica en PDF
                {journeyChronicle && (
                  <span className="ml-1 text-[hsl(var(--gold))] font-bold">✓</span>
                )}
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => setMode('config')} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Configuración
        </Button>
        <Button onClick={resetJourney} className="flex-1">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Viaje
        </Button>
      </div>

      {/* totalFatigueCd kept for parity (referenced in original component) */}
      <span className="hidden">{totalFatigueCd}</span>
    </div>
  );
};

export default ResultsView;
