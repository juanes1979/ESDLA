/**
 * GlobalJourneyView
 * Modo "Jornada a Jornada" interactivo: orientación → días sin incidentes
 * resumidos en bitácora → parada en evento → resolución → siguiente
 * orientación. Durante las paradas (orientación o evento activo) se muestran
 * botones de Acampar / Forrajear / Comprar provisiones.
 * Extracted from EnhancedTravelSystem.jsx.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Route, Compass, Dice6, Loader2, ArrowLeftRight, BookOpen, ArrowLeft,
  Tent, Leaf, Package, ScrollText, CloudSun, Footprints, Sparkles, Flag,
} from 'lucide-react';
import { toast } from 'sonner';
import JourneyPartyPanel from '../JourneyPartyPanel';

const summaryIcon = (tipo) => {
  switch (tipo) {
    case 'partida':     return <Flag className="w-3.5 h-3.5 text-amber-300" />;
    case 'antecedente': return <Sparkles className="w-3.5 h-3.5 text-purple-300" />;
    case 'orientacion': return <Compass className="w-3.5 h-3.5 text-blue-300" />;
    case 'marcha':      return <Footprints className="w-3.5 h-3.5 text-emerald-300" />;
    case 'evento':      return <Dice6 className="w-3.5 h-3.5 text-orange-300" />;
    case 'campamento':  return <Tent className="w-3.5 h-3.5 text-amber-300" />;
    case 'forrajeo':    return <Leaf className="w-3.5 h-3.5 text-green-300" />;
    case 'descanso':    return <CloudSun className="w-3.5 h-3.5 text-sky-300" />;
    default:            return <ScrollText className="w-3.5 h-3.5 text-zinc-300" />;
  }
};

const GlobalJourneyView = ({
  // state
  config, currentPosition, journeyCalc, events,
  awaitingOrientationCheck, characters, gmNotesOrientation,
  autoRunning, lastOrientationResult,
  currentEvent, gmNotesEvent, eventDiceRoll, resolvingEvent,
  dailySummaries = [],
  partyProvisions = { comidaTotal: 0, aguaTotal: 0, comidaConsumida: 0, aguaConsumida: 0 },
  globalFatigaCD = 10,
  lastFatigueSaves = {},
  fatigueChanges = {},
  // setters
  setMode, setGmNotesOrientation, setGmNotesEvent,
  setShowCampDialog, setShowProvisionsShop,
  // handlers
  performForaging, getRoleModifier, performOrientationCheck, automateJourney,
  rollEventDice, resolveCurrentEvent,
}) => {
  const isPaused = awaitingOrientationCheck || !!currentEvent;
  return (
  <div className="space-y-6">
    {/* Journey Progress with Orientation Info */}
    <Card className="card-parchment">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))]">
          <Route className="w-5 h-5 inline mr-2" />
          {config.origenNombre} → {config.destinoNombre}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Progress
            value={(currentPosition / journeyCalc?.ruta?.casillas) * 100}
            className="h-3"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Progreso: {currentPosition} / {journeyCalc?.ruta?.casillas} casillas |
            Eventos: {events.filter(e => e.resuelto).length} resueltos
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold">{journeyCalc?.ruta?.casillas || 0}</p>
            <p className="text-xs text-muted-foreground">total casillas</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold text-blue-400">{currentPosition}</p>
            <p className="text-xs text-muted-foreground">posición actual</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold">{journeyCalc?.ruta?.casillas - currentPosition}</p>
            <p className="text-xs text-muted-foreground">casillas restantes</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
            <p className="text-xs text-muted-foreground">PX</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Panel del grupo durante el viaje */}
    <JourneyPartyPanel
      miembros={config.miembros}
      characters={characters}
      partyProvisions={partyProvisions}
      globalFatigaCD={globalFatigaCD}
      lastFatigueSaves={lastFatigueSaves}
      fatigueChanges={fatigueChanges}
    />

    {/* Acciones disponibles durante una parada (orientación o evento). */}
    {isPaused && !autoRunning && (
      <Card className="card-parchment border border-amber-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-300 flex items-center gap-2">
            <Tent className="w-4 h-4" />
            Acciones de parada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            La compañía se ha detenido. Puedes acampar, forrajear o reabastecerte
            antes de continuar la marcha.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCampDialog?.(true)}
              className="text-xs bg-[hsl(var(--gold))]/10 hover:bg-[hsl(var(--gold))]/20 border border-[hsl(var(--gold))]/40"
              data-testid="global-camp-btn"
            >
              <Tent className="w-3.5 h-3.5 mr-1" /> Acampar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const explorador = config.miembros.find(m => m.papeles?.includes('explorador'));
                const cazador = config.miembros.find(m => m.papeles?.includes('cazador'));
                const target = explorador || cazador || config.miembros[0];
                if (!target) {
                  toast.error('No hay personajes para forrajear.');
                  return;
                }
                performForaging?.(target.id);
              }}
              className="text-xs"
              data-testid="global-forage-btn"
            >
              <Leaf className="w-3.5 h-3.5 mr-1" /> Forrajear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProvisionsShop?.(true)}
              className="text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40"
              data-testid="global-buy-provisions-btn"
            >
              <Package className="w-3.5 h-3.5 mr-1" /> Comprar provisiones
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Orientation Check UI */}
    {awaitingOrientationCheck && (
      <Card className="card-parchment border-2 border-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Compass className="w-5 h-5 inline mr-2" />
            Tirada de Orientación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const guia = config.miembros.find(m => m.papeles?.includes('guia'));
            // eslint-disable-next-line no-unused-vars
            const guiaChar = characters.find(c => c.id === guia?.id);
            const casillasRestantes = journeyCalc.ruta.casillas - currentPosition;
            const tieneMultiplesRoles = guia?.papeles?.length > 1;

            return (
              <>
                <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
                  <p className="text-sm mb-2">
                    El <strong>Guía ({guia?.nombre || 'Sin asignar'})</strong> debe realizar una prueba de
                    <strong> Sabiduría (Viajar) CD 15</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    • Si tiene un mapa, puede usar competencia con herramientas de cartografía.<br/>
                    • Si el Guía tiene múltiples papeles: <span className="text-red-400">-5 penalización</span>
                  </p>
                  {tieneMultiplesRoles && (
                    <p className="text-xs text-red-400 mt-2">
                      ⚠️ {guia?.nombre} tiene {guia?.papeles?.length} papeles asignados (-5 penalización)
                    </p>
                  )}
                </div>

                <div className="text-center p-4 bg-black/20 rounded">
                  <p className="text-sm text-muted-foreground mb-2">Casillas restantes hasta el destino:</p>
                  <p className="text-3xl font-bold text-[hsl(var(--gold))]">{casillasRestantes}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-black/10 p-3 rounded">
                  <div><strong>Fallo por 5+:</strong> Evento a 1 casilla</div>
                  <div><strong>Fallo:</strong> Evento a 2 casillas</div>
                  <div><strong>Éxito:</strong> Evento a 3 casillas</div>
                  <div><strong>Éxito por 5+:</strong> Evento a 4 casillas</div>
                  <div className="col-span-2 mt-2 text-green-400">
                    Si la tirada ≥ {casillasRestantes} casillas restantes: ¡Viaje completado sin más eventos!
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Notas del Maestro (opcional, para IA narrativa)
                  </Label>
                  <Textarea
                    value={gmNotesOrientation}
                    onChange={(e) => setGmNotesOrientation(e.target.value)}
                    placeholder="Ej: Cruzan el Bosque de los Trolls al amanecer. Terreno embarrado, niebla espesa..."
                    rows={2}
                    className="text-xs mt-1"
                    data-testid="gm-notes-orientation"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 btn-gold"
                    onClick={performOrientationCheck}
                    disabled={autoRunning}
                    data-testid="orientation-roll-btn"
                  >
                    <Dice6 className="w-4 h-4 mr-2" />
                    Realizar Tirada de Orientación
                  </Button>
                  <Button
                    variant={autoRunning ? 'destructive' : 'outline'}
                    onClick={automateJourney}
                    className="border-[hsl(var(--gold))]/50"
                    data-testid="global-journey-btn"
                    title={autoRunning ? 'Detener viaje global' : 'Ejecutar el viaje completo automáticamente'}
                  >
                    {autoRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Detener
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        Viaje global
                      </>
                    )}
                  </Button>
                </div>

                {lastOrientationResult && (
                  <div className={`p-3 rounded ${lastOrientationResult.exito ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                    <p className="text-sm">
                      <strong>Última tirada ({lastOrientationResult.guiaNombre || 'Guía'}):</strong>{' '}
                      {lastOrientationResult.d20} + {lastOrientationResult.modificador} = {lastOrientationResult.total} vs CD 15
                    </p>
                    <p className="text-xs mt-1">{lastOrientationResult.detalle}</p>
                    {lastOrientationResult.xpResult && (
                      <p className="text-xs mt-1" data-testid="orientation-xp-display">
                        <span className="text-muted-foreground">PX generados:</span>{' '}
                        <span className={`font-bold ${lastOrientationResult.xpResult.pxFinal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {lastOrientationResult.xpResult.pxFinal >= 0 ? '+' : ''}{lastOrientationResult.xpResult.pxFinal} PX
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    )}

    {/* Current Event */}
    {currentEvent && (
      <Card className={`card-parchment border-2 ${
        currentEvent.evento.fatigue_cd_increase >= 3 ? 'border-red-500' :
        currentEvent.evento.fatigue_cd_increase >= 2 ? 'border-orange-500' :
        'border-yellow-500'
      }`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[hsl(var(--gold))]">
              <Dice6 className="w-5 h-5 inline mr-2" />
              Acontecimiento - Casilla {currentEvent.casilla}
            </CardTitle>
            <Badge className={
              currentEvent.evento.fatigue_cd_increase >= 3 ? 'bg-red-600' :
              currentEvent.evento.fatigue_cd_increase >= 2 ? 'bg-orange-600' :
              'bg-yellow-600'
            }>
              +{currentEvent.evento.fatigue_cd_increase} CD Fatiga
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-black/20 rounded">
            <h3 className="text-xl font-bold text-[hsl(var(--torch-orange))] mb-2">
              {currentEvent.evento.nombre}
            </h3>
            <p className="text-xs text-muted-foreground">
              (Tirada d20 del evento: {currentEvent.tiradas.d20}
              {currentEvent.tiradas.tipo_tirada !== 'normal' && (
                <span className={currentEvent.tiradas.tipo_tirada === 'ventaja' ? 'text-green-400' : 'text-red-400'}>
                  {' '}- {currentEvent.tiradas.tipo_tirada}
                </span>
              )})
            </p>
          </div>

          {(() => {
            const targetRole = currentEvent.objetivo.papel;
            const { modifier, breakdown, member: targetMember, roleInfo } = getRoleModifier(targetRole);

            return (
              <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
                <h4 className="font-bold text-[hsl(var(--magic-blue))] mb-3">
                  Objetivo: {roleInfo?.nombre || targetRole}
                </h4>

                <div className="mb-3 p-2 bg-black/30 rounded">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Personaje:</span>{' '}
                    <span className="font-bold text-[hsl(var(--gold))]">
                      {targetMember?.nombre || 'Sin asignar'}
                    </span>
                  </p>
                  {targetMember && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="event-modifier-breakdown">
                      Modificador total: <span className={`font-bold ${modifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {modifier >= 0 ? '+' : ''}{modifier}
                      </span>
                      <span className="ml-2">({breakdown.join(', ')})</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Prueba:</p>
                    <p className="text-[hsl(var(--gold))] font-medium">{currentEvent.objetivo.prueba}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dificultad (CD):</p>
                    <p className="text-2xl font-bold text-red-400">{currentEvent.resolucion.cd}</p>
                  </div>
                </div>
                {currentEvent.resolucion.desventaja_salvacion && (
                  <Badge className="bg-blue-600 mt-2">Desventaja (Otoño/Invierno)</Badge>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-green-900/20 rounded border border-green-500/30">
              <h5 className="font-bold text-green-400 mb-1">✓ Éxito</h5>
              <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_exito}</p>
            </div>
            <div className="p-3 bg-red-900/20 rounded border border-red-500/30">
              <h5 className="font-bold text-red-400 mb-1">✗ Fracaso</h5>
              <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_fracaso}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border/30 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Notas del Maestro (opcional, para IA narrativa)
              </Label>
              <Textarea
                value={gmNotesEvent}
                onChange={(e) => setGmNotesEvent(e.target.value)}
                placeholder="Ej: Acampando en la región del Bosque de los Trolls. Terreno resguardado, barro..."
                rows={2}
                className="text-xs mt-1"
                data-testid="gm-notes-event"
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                El personaje debe tirar 1d20 + modificador y superar la CD
              </p>

              <Button
                onClick={rollEventDice}
                className="h-14 px-8 text-lg bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
                disabled={resolvingEvent}
              >
                <Dice6 className="w-6 h-6 mr-2" />
                🎲 Tirar 1d20
              </Button>
            </div>

            {eventDiceRoll && (
              <div className="p-4 bg-black/40 rounded-lg border-2 border-[hsl(var(--gold))]/50">
                <div className="flex items-center justify-center gap-4 md:gap-6 mb-3">
                  <div className="text-center">
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl font-bold ${
                      eventDiceRoll.d20 === 20 ? 'bg-green-600 text-white animate-pulse' :
                      eventDiceRoll.d20 === 1 ? 'bg-red-600 text-white animate-pulse' :
                      'bg-[hsl(var(--gold))] text-black'
                    }`}>
                      {eventDiceRoll.d20}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">d20</p>
                  </div>

                  <span className="text-xl md:text-2xl text-muted-foreground">+</span>

                  <div className="text-center">
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl font-bold ${
                      eventDiceRoll.modifier >= 0 ? 'bg-blue-600' : 'bg-red-600'
                    } text-white`}>
                      {eventDiceRoll.modifier >= 0 ? '+' : ''}{eventDiceRoll.modifier}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Mod</p>
                  </div>

                  <span className="text-xl md:text-2xl text-muted-foreground">=</span>

                  <div className="text-center">
                    <div className={`w-16 h-14 md:w-20 md:h-16 rounded-lg flex items-center justify-center text-2xl md:text-3xl font-bold ${
                      eventDiceRoll.total >= currentEvent.resolucion.cd ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                      {eventDiceRoll.total}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Total</p>
                  </div>
                </div>

                <div className="text-center">
                  <p className={`text-lg md:text-xl font-bold ${
                    eventDiceRoll.total >= currentEvent.resolucion.cd ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {eventDiceRoll.total} vs CD {currentEvent.resolucion.cd} → {' '}
                    {eventDiceRoll.total >= currentEvent.resolucion.cd ? '¡ÉXITO!' : 'FRACASO'}
                  </p>
                  {eventDiceRoll.d20 === 20 && <p className="text-green-400 text-sm">🎉 ¡Crítico natural!</p>}
                  {eventDiceRoll.d20 === 1 && <p className="text-red-400 text-sm">💀 ¡Pifia natural!</p>}
                </div>

                <div className="flex justify-center mt-4">
                  <Button
                    onClick={() => resolveCurrentEvent(eventDiceRoll.total)}
                    disabled={resolvingEvent}
                    className={`h-10 px-6 ${
                      eventDiceRoll.total >= currentEvent.resolucion.cd
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {resolvingEvent ? 'Resolviendo...' : 'Confirmar Resultado'}
                  </Button>
                </div>
              </div>
            )}

            {!eventDiceRoll && (
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  ¿Prefieres tirar un dado físico? Introduce el resultado total (d20 + mod):
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    className="w-20 text-center"
                    placeholder="Total"
                    id="roll-input"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById('roll-input');
                      const value = parseInt(input?.value);
                      if (value >= 1) {
                        resolveCurrentEvent(value);
                      } else {
                        toast.error('Introduce un resultado válido');
                      }
                    }}
                    disabled={resolvingEvent}
                  >
                    {resolvingEvent ? 'Resolviendo...' : 'Resolver'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Resolved Events */}
    {events.filter(e => e.resuelto).length > 0 && (
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Crónica del Viaje</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {events.filter(e => e.resuelto).map((e, i) => (
                <div
                  key={i}
                  className={`p-3 rounded border ${e.exito ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-[hsl(var(--gold))]">
                      Casilla {e.casilla}: {e.evento?.nombre || 'Acontecimiento'}
                    </span>
                    <Badge className={e.exito ? 'bg-green-600' : 'bg-red-600'}>
                      {e.exito ? 'Éxito' : 'Fracaso'} ({e.tirada} vs CD {e.resolucion?.cd || '?'})
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground italic border-l-2 border-[hsl(var(--gold))/30] pl-3 mt-2">
                    {e.narrativa || (e.exito
                      ? e.evento?.consecuencias_exito || 'El grupo superó el obstáculo.'
                      : e.evento?.consecuencias_fracaso || 'El grupo enfrentó dificultades.'
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Resuelto por: <span className="text-[hsl(var(--magic-blue))]">{e.objetivo?.prueba || 'El grupo'}</span>
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )}

    {/* Bitácora día a día (resumen automático de jornadas). */}
    {dailySummaries.length > 0 && (
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <ScrollText className="w-5 h-5" /> Bitácora del viaje
            <Badge variant="outline" className="ml-1">{dailySummaries.length} entradas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-56">
            <div className="space-y-1.5 pr-2" data-testid="daily-summaries">
              {dailySummaries.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs ${
                    s.tipo === 'evento'
                      ? (s.success === false ? 'bg-red-900/20 border border-red-500/30' : 'bg-green-900/20 border border-green-500/30')
                      : s.tipo === 'orientacion'
                      ? 'bg-blue-900/15 border border-blue-500/20'
                      : 'bg-black/15'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">{summaryIcon(s.tipo)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground/90">{s.message}</p>
                    {s.clima?.estado_label && (
                      <p className="text-[10px] text-sky-200/70 mt-0.5">
                        Clima: {s.clima.estado_label}{s.clima.region ? ` · ${s.clima.region}` : ''}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                    Día {s.dia}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )}

    <Button variant="outline" onClick={() => setMode('config')}>
      <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Configuración
    </Button>
  </div>
  );
};

export default GlobalJourneyView;
