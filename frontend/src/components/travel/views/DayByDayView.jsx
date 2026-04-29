/**
 * DayByDayView
 * Day-by-day journey mode: header, progress, provisions, current event resolution,
 * party fatigue, days log, rest dialog.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Route, Clock, Package, Tent, Moon, Leaf, Utensils, Droplets,
  AlertTriangle, ChevronRight, Users, Dice6, BookOpen, Flag, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import PartyFatiguePanel from '../PartyFatiguePanel';
import { ROLE_INFO, ROLE_ICONS } from '../travelConstants';
import { REST_TYPES } from '../travelHelpers';

const DayByDayView = ({
  // state
  config, journeyCalc, activeJourney, events, partyProvisions, provisionFatigue,
  currentDayConfig, currentEvent, gmNotesEvent, eventDiceRoll, resolvingEvent,
  characters, showRestDialog, selectedRestType, restResults, nearbyRefuges,
  // setters
  setShowProvisionsShop, setShowCampDialog, setShowRestDialog,
  setCurrentDayConfig, setGmNotesEvent, setSelectedRestType, setRestResults,
  // handlers
  performForaging, advanceDay, getRoleModifier, rollEventDice,
  resolveCurrentEvent, resetJourney, finishDayByDayJourney, performRest,
}) => (
  <div className="space-y-6">
    {/* Journey Header */}
    <Card className="card-parchment bg-gradient-to-r from-[hsl(var(--gold))/10] to-transparent">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--gold))]">
              {config.origenNombre} → {config.destinoNombre}
            </h2>
            <p className="text-sm text-muted-foreground">
              {journeyCalc?.ruta?.tipo_tierra_nombre} • {journeyCalc?.ruta?.terreno_nombre || journeyCalc?.ruta?.terreno}
            </p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-lg px-3 py-1">
              <Clock className="w-4 h-4 mr-1 inline" />
              Día {activeJourney?.dia_actual || 1}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Journey Status */}
    <Card className="card-parchment">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))]">
          <Route className="w-5 h-5 inline mr-2" />
          Progreso del Viaje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Progress
            value={((activeJourney?.casillas_recorridas || 0) / (activeJourney?.casillas_totales || 1)) * 100}
            className="h-4"
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>Casillas: {activeJourney?.casillas_recorridas?.toFixed(1) || 0} / {activeJourney?.casillas_totales || 0}</span>
            <span>{Math.round(((activeJourney?.casillas_recorridas || 0) / (activeJourney?.casillas_totales || 1)) * 100)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-black/20 p-3 rounded text-center">
            <p className="text-2xl font-bold text-red-400">{activeJourney?.fatiga_cd_total || 10}</p>
            <p className="text-xs text-muted-foreground">CD Fatiga</p>
          </div>
          <div className="bg-black/20 p-3 rounded text-center">
            <p className="text-2xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
            <p className="text-xs text-muted-foreground">PX Totales</p>
          </div>
          <div className="bg-black/20 p-3 rounded text-center">
            <p className="text-2xl font-bold text-blue-400">{events.length}</p>
            <p className="text-xs text-muted-foreground">Eventos</p>
          </div>
        </div>

        <div className="bg-black/20 p-3 rounded mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Provisiones
            </h4>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProvisionsShop(true)}
                className="text-xs h-7 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40"
                data-testid="buy-provisions-btn"
              >
                <Package className="w-3 h-3 mr-1" />
                Comprar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCampDialog(true)}
                className="text-xs h-7 bg-[hsl(var(--gold))]/10 hover:bg-[hsl(var(--gold))]/20 border border-[hsl(var(--gold))]/40"
                data-testid="camp-btn"
              >
                <Tent className="w-3 h-3 mr-1" />
                Acampar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRestDialog(true)}
                className="text-xs h-7"
                data-testid="rest-btn"
              >
                <Moon className="w-3 h-3 mr-1" />
                Descansar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => performForaging(config.miembros.find(m => m.papeles?.includes('explorador'))?.id || config.miembros[0]?.id)}
                className="text-xs h-7"
                data-testid="forage-btn"
              >
                <Leaf className="w-3 h-3 mr-1" />
                Forrajear
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-2 rounded border ${
              (partyProvisions.comidaTotal - partyProvisions.comidaConsumida) > (config.miembros.length + (config.acompanantes || []).length)
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}>
              <div className="flex items-center gap-1 text-xs font-medium">
                <Utensils className="w-3 h-3 text-orange-400" />
                Comida
              </div>
              <p className="text-lg font-bold">
                {Math.max(0, partyProvisions.comidaTotal - partyProvisions.comidaConsumida).toFixed(1)}
                <span className="text-xs text-muted-foreground ml-1">raciones</span>
              </p>
              <p className="text-xs text-muted-foreground">
                ~{Math.floor(Math.max(0, partyProvisions.comidaTotal - partyProvisions.comidaConsumida) / Math.max(1, config.miembros.length + (config.acompanantes || []).length))} días
              </p>
            </div>
            <div className={`p-2 rounded border ${
              (partyProvisions.aguaTotal - partyProvisions.aguaConsumida) > (config.miembros.length + (config.acompanantes || []).length) * 2
                ? 'border-blue-500/30 bg-blue-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}>
              <div className="flex items-center gap-1 text-xs font-medium">
                <Droplets className="w-3 h-3 text-blue-400" />
                Agua
              </div>
              <p className="text-lg font-bold">
                {Math.max(0, partyProvisions.aguaTotal - partyProvisions.aguaConsumida).toFixed(1)}
                <span className="text-xs text-muted-foreground ml-1">litros</span>
              </p>
              <p className="text-xs text-muted-foreground">
                ~{Math.floor(Math.max(0, partyProvisions.aguaTotal - partyProvisions.aguaConsumida) / Math.max(1, (config.miembros.length + (config.acompanantes || []).length) * 2))} días
              </p>
            </div>
          </div>
          {Object.entries(provisionFatigue).some(([_, f]) => f.sinComida > 0 || f.sinAgua > 0) && (
            <div className="mt-2 p-2 bg-red-500/20 rounded border border-red-500/30">
              <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Fatiga por falta de provisiones:
              </p>
              <div className="text-xs mt-1 space-y-0.5">
                {Object.entries(provisionFatigue).map(([charId, fatigue]) => {
                  if (fatigue.sinComida === 0 && fatigue.sinAgua === 0) return null;
                  const char = config.miembros.find(m => m.id === charId);
                  const totalFatiga = fatigue.sinComida + (fatigue.sinAgua * 2);
                  return (
                    <div key={charId} className="flex justify-between">
                      <span>{char?.nombre || 'Desconocido'}</span>
                      <span className="text-red-400">+{totalFatiga} fatiga</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-sm">Ritmo de hoy</Label>
            <Select
              value={currentDayConfig.ritmo}
              onValueChange={(v) => setCurrentDayConfig(prev => ({ ...prev, ritmo: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lento">🐢 Lento (24 km)</SelectItem>
                <SelectItem value="normal">🚶 Normal (36 km)</SelectItem>
                <SelectItem value="rapido">🏃 Rápido (48 km)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Marcha Forzada</Label>
            <Select
              value={currentDayConfig.marchaForzada.toString()}
              onValueChange={(v) => setCurrentDayConfig(prev => ({ ...prev, marchaForzada: parseInt(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin marcha forzada</SelectItem>
                <SelectItem value="1">+1 hora (+6 km)</SelectItem>
                <SelectItem value="2">+2 horas (+12 km)</SelectItem>
                <SelectItem value="3">+3 horas (+18 km)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={advanceDay}
          className="w-full h-11"
          disabled={currentEvent}
          data-testid="advance-day-btn"
        >
          <ChevronRight className="w-4 h-4 mr-2" />
          {currentEvent
            ? 'Resuelve el acontecimiento primero'
            : `Avanzar al Día ${(activeJourney?.dia_actual || 1) + 1}`
          }
        </Button>
      </CardContent>
    </Card>

    <PartyFatiguePanel
      miembros={config.miembros}
      acompanantes={config.acompanantes || []}
      characters={characters}
    />

    <Card className="card-parchment">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
          <Users className="w-5 h-5 inline mr-2" />
          Grupo de Viaje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
            const members = config.miembros.filter(m => m.papeles?.includes(roleKey));
            return (
              <div
                key={roleKey}
                className={`p-2 rounded text-center text-sm ${
                  members.length > 0 ? 'bg-green-900/20 border border-green-500/30' : 'bg-black/20 opacity-50'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {ROLE_ICONS[roleKey]}
                  <span className="font-bold text-[hsl(var(--gold))]">{roleInfo.nombre}</span>
                </div>
                {members.length > 0 ? (
                  <div className="space-y-1">
                    {members.map(m => (
                      <p key={m.id} className="text-xs text-muted-foreground truncate">
                        {m.nombre}
                        {m.papeles.length > 1 && <span className="text-yellow-400"> (-5)</span>}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">Vacante</p>
                )}
              </div>
            );
          })}
        </div>

        {(config.miembros.some(m => m.papeles?.length > 1) || config.horasMarchaForzada > 0) && (
          <div className="mt-3 p-2 bg-yellow-900/30 rounded border border-yellow-500/30 text-xs text-yellow-400">
            ⚠️ Percepción pasiva reducida (-5):
            {config.miembros.filter(m => m.papeles?.length > 1).map(m => m.nombre).join(', ')}
            {config.horasMarchaForzada > 0 && ' | Todos (marcha forzada)'}
          </div>
        )}
      </CardContent>
    </Card>

    {currentEvent && (
      <Card className={`card-parchment border-2 ${
        currentEvent.evento.fatigue_cd_increase >= 3 ? 'border-red-500' :
        currentEvent.evento.fatigue_cd_increase >= 2 ? 'border-orange-500' :
        'border-yellow-500'
      }`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
              <AlertTriangle className="w-5 h-5 inline mr-2" />
              ¡Acontecimiento!
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
              (Tirada d20 del evento: {currentEvent.tiradas.d20})
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
                    <p className="text-xs text-muted-foreground mt-1">
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
                    <p className="text-2xl font-bold text-red-400" data-testid="event-resolution-cd">{currentEvent.resolucion.cd}</p>
                    {currentEvent.resolucion?.cd_clima_mod !== undefined && currentEvent.resolucion.cd_clima_mod !== 0 && (
                      <p className="text-[11px] mt-0.5">
                        <span className="text-muted-foreground">Base </span>
                        <span className="font-mono">{currentEvent.resolucion.cd_base}</span>
                        <span className={`ml-1 font-bold ${currentEvent.resolucion.cd_clima_mod > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                          {currentEvent.resolucion.cd_clima_mod > 0 ? '+' : ''}{currentEvent.resolucion.cd_clima_mod}
                        </span>
                        <span className="ml-1 text-muted-foreground italic">
                          ({currentEvent.resolucion.clima_label})
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                {currentEvent.clima_dia?.estado_label && currentEvent.resolucion?.cd_clima_mod === 0 && (
                  <p className="text-[11px] mt-2 text-muted-foreground italic" data-testid="event-clima-info">
                    Clima del día: <span className="text-sky-300">{currentEvent.clima_dia.estado_label}</span>
                  </p>
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
                <div className="flex items-center justify-center gap-6 mb-3">
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl font-bold ${
                      eventDiceRoll.d20 === 20 ? 'bg-green-600 text-white animate-pulse' :
                      eventDiceRoll.d20 === 1 ? 'bg-red-600 text-white animate-pulse' :
                      'bg-[hsl(var(--gold))] text-black'
                    }`}>
                      {eventDiceRoll.d20}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">d20</p>
                  </div>

                  <span className="text-2xl text-muted-foreground">+</span>

                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl font-bold ${
                      eventDiceRoll.modifier >= 0 ? 'bg-blue-600' : 'bg-red-600'
                    } text-white`}>
                      {eventDiceRoll.modifier >= 0 ? '+' : ''}{eventDiceRoll.modifier}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Mod</p>
                  </div>

                  <span className="text-2xl text-muted-foreground">=</span>

                  <div className="text-center">
                    <div className={`w-20 h-16 rounded-lg flex items-center justify-center text-3xl font-bold ${
                      eventDiceRoll.total >= currentEvent.resolucion.cd ? 'bg-green-600' : 'bg-red-600'
                    } text-white`}>
                      {eventDiceRoll.total}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Total</p>
                  </div>
                </div>

                <div className="text-center">
                  <p className={`text-xl font-bold ${
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
                    id="day-roll-input"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.getElementById('day-roll-input');
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

    {activeJourney?.dias && activeJourney.dias.length > 0 && (
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Registro de Jornadas</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {activeJourney.dias.map((dia, idx) => (
                <div key={idx} className="p-2 bg-black/20 rounded text-sm flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[hsl(var(--gold))]">Día {dia.dia}</span>
                    <span className="text-muted-foreground ml-2">{dia.notas}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{dia.distancia_recorrida_km} km</Badge>
                    {dia.eventos?.length > 0 && (
                      <Badge className="bg-yellow-600">{dia.eventos.length} evento(s)</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )}

    <div className="flex gap-2">
      <Button variant="outline" onClick={resetJourney} className="flex-1">
        <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
      </Button>
      <Button
        onClick={finishDayByDayJourney}
        className="flex-1 bg-green-600 hover:bg-green-700"
        disabled={!activeJourney || activeJourney.casillas_recorridas < activeJourney.casillas_totales}
        data-testid="finish-journey-btn"
      >
        <Flag className="w-4 h-4 mr-2" /> Finalizar Viaje
      </Button>
    </div>

    {showRestDialog && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowRestDialog(false)}>
        <Card className="card-parchment w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
          <CardHeader>
            <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
              <Moon className="w-5 h-5" />
              Descansar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!restResults ? (
              <RestDialogBody
                config={config}
                characters={characters}
                selectedRestType={selectedRestType}
                setSelectedRestType={setSelectedRestType}
                nearbyRefuges={nearbyRefuges}
                onCancel={() => setShowRestDialog(false)}
                onConfirm={(diceMap) => performRest(selectedRestType, diceMap)}
              />
            ) : (
              <>
                <h4 className="font-bold text-sm">Resultados del descanso:</h4>
                <ScrollArea className="max-h-[60vh] pr-2">
                  <div className="space-y-2">
                    {restResults.map((result, idx) => (
                      <div key={idx} className={`p-2 rounded ${result.exito ? 'bg-green-500/20' : 'bg-red-500/20'}`} data-testid={`rest-result-${idx}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{result.nombre}</span>
                          <Badge variant={result.exito ? 'default' : 'destructive'}>
                            {result.exito ? '✓ Éxito' : '✗ Fallo'}
                          </Badge>
                        </div>
                        {result.tirada !== null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Tirada CON: {result.tirada} vs CD {result.cd}
                          </p>
                        )}
                        {result.rolls && result.rolls.length > 0 && (
                          <p className="text-[11px] text-emerald-300 mt-1">
                            Dados gastados: {result.dadosGastados} → {result.rolls.map(r => `(${r.roll}+${r.con_mod}=${r.heal})`).join(' ')}
                          </p>
                        )}
                        {result.dadosRecuperados > 0 && (
                          <p className="text-[11px] text-blue-300 mt-1">
                            Dados de Golpe recuperados: +{result.dadosRecuperados}
                          </p>
                        )}
                        {(result.curacionTotal > 0) && (
                          <p className="text-xs text-emerald-400 mt-1">
                            Curación: +{result.curacionTotal} PG ({result.pgAntes} → {result.pgDespues}/{result.pgMax})
                          </p>
                        )}
                        <p className="text-xs mt-1">
                          Fatiga: {result.fatigaAntes} → {result.fatigaDespues}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  onClick={() => { setRestResults(null); setShowRestDialog(false); }}
                  className="w-full"
                >
                  Continuar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )}
  </div>
);

export default DayByDayView;

/**
 * RestDialogBody — UI de selección de descanso (corto/largo/santuario).
 * Para descanso corto permite elegir cuántos Dados de Golpe gasta cada
 * personaje (1d{HD}+CON por dado). Devuelve el mapa al confirmar.
 */
function RestDialogBody({ config, characters, selectedRestType, setSelectedRestType, nearbyRefuges, onCancel, onConfirm }) {
  const todosViajeros = [
    ...(config?.miembros || []),
    ...((config?.acompanantes || []).map(a => ({ ...a, papeles: a.papeles || [] }))),
  ];
  const [diceMap, setDiceMap] = React.useState({});

  React.useEffect(() => {
    setDiceMap({});
  }, [selectedRestType]);

  const setDiceFor = (id, val) => {
    setDiceMap(prev => ({ ...prev, [id]: val }));
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Elige el tipo de descanso para la compañía:
      </p>

      <div className="space-y-2">
        {Object.entries(REST_TYPES).map(([key, rest]) => (
          <div
            key={key}
            onClick={() => setSelectedRestType(key)}
            className={`p-3 rounded border cursor-pointer transition-colors ${
              selectedRestType === key
                ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))/10]'
                : 'border-transparent bg-black/20 hover:bg-black/30'
            }`}
            data-testid={`rest-type-${key}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm">{rest.nombre}</h4>
                <p className="text-xs text-muted-foreground">{rest.duracion}</p>
              </div>
              {key === 'sanctuary' && nearbyRefuges.length === 0 && (
                <Badge variant="outline" className="text-xs text-red-400">
                  Requiere refugio
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{rest.efecto}</p>
          </div>
        ))}
      </div>

      {/* Selector de Dados de Golpe para descanso corto */}
      {selectedRestType === 'short' && (
        <div className="space-y-2 p-3 rounded border border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs font-bold text-emerald-300 flex items-center gap-2">
            <Dice6 className="w-4 h-4" />
            Dados de Golpe a gastar (cada uno: 1d{'{DG}'} + mod CON)
          </p>
          <div className="space-y-2">
            {todosViajeros.map((m) => {
              const c = characters.find(x => x.id === m.id);
              if (!c) return null;
              const nivel = Math.max(1, c.nivel || 1);
              const gastados = c.dados_golpe_gastados || 0;
              const disponibles = Math.max(0, nivel - gastados);
              const pgActual = c.puntos_golpe_actual ?? c.puntos_golpe_max ?? 0;
              const pgMax = c.puntos_golpe_max || 0;
              const value = diceMap[m.id] || 0;
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs" data-testid={`rest-hd-row-${m.id}`}>
                  <div className="flex-1">
                    <p className="font-medium">{m.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">
                      PG {pgActual}/{pgMax} · DG {disponibles}/{nivel} ({c.dado_golpe || '1d8'})
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={disponibles}
                    value={value}
                    onChange={(e) => setDiceFor(m.id, Math.max(0, Math.min(disponibles, Number(e.target.value) || 0)))}
                    className="w-20 h-8 text-center"
                    data-testid={`rest-hd-input-${m.id}`}
                    disabled={disponibles === 0}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Si dejas 0 dados, el personaje sólo gasta 1 hora sin curarse.
          </p>
        </div>
      )}

      {selectedRestType === 'long' && (
        <p className="text-[11px] text-muted-foreground italic">
          Restaura PG al máximo, recupera la mitad de los Dados de Golpe (mín. 1) y -1 fatiga si supera la TS de CON.
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          data-testid="rest-cancel-btn"
        >
          Cancelar
        </Button>
        <Button
          onClick={() => onConfirm(diceMap)}
          disabled={selectedRestType === 'sanctuary' && nearbyRefuges.length === 0}
          className="flex-1"
          data-testid="confirm-rest-btn"
        >
          <Moon className="w-4 h-4 mr-2" />
          Descansar
        </Button>
      </div>
    </>
  );
}
