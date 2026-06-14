/**
 * CampDialog — Sistema de Acampar durante un viaje.
 *
 * Reglas RAW (corregidas Abr 2026):
 *   - Acampar consume 1 ración + 1 litro de agua por miembro (sobre el consumo
 *     normal del día — la acampada es una acción adicional del DJ).
 *   - **NO hay tirada de salvación de fatiga diaria.** La tirada de fatiga
 *     se hace UNA SOLA VEZ al final del viaje con `calculateFatigueResults`.
 *     Acampar, en cambio, REBAJA la CD acumulada de esa tirada final (-0.5
 *     por acampada, gestionado por `POST /travel/journey/{id}/camp`).
 *   - Tiradas de evento nocturno según peligro de la región:
 *       tierras_libres / fronterizas: 1 evento
 *       tierras_salvajes / sombra:    2 eventos
 *       tierras_oscuras:              3 eventos
 *     Los eventos nocturnos SÍ pueden subir la CD acumulada (cada uno añade
 *     su `fatigue_cd_increase` al viaje).
 *   - El Centinela hace Sabiduría (Percepción) CD 12 para anticiparse a los
 *     eventos; fallar = posible sorpresa al grupo.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tent, Eye, Moon, Flame, Dice6, Droplets, Utensils, AlertTriangle, CheckCircle2, XCircle, Leaf } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { getForageCD } from './travelHelpers';

const NIGHT_EVENTS_BY_REGION = {
  tierras_libres: 1,
  tierras_fronterizas: 1,
  tierras_salvajes: 2,
  tierras_sombra: 2,
  tierras_oscuras: 3,
};

const REGION_LABEL = {
  tierras_libres: 'Tierras Libres',
  tierras_fronterizas: 'Tierras Fronterizas',
  tierras_salvajes: 'Tierras Salvajes',
  tierras_sombra: 'Tierras de la Sombra',
  tierras_oscuras: 'Tierras Oscuras',
};

const rollDie = (sides = 20) => Math.floor(Math.random() * sides) + 1;
const modFromScore = (s) => Math.floor(((s ?? 10) - 10) / 2);

export default function CampDialog({
  open,
  onClose,
  miembros,
  acompanantes = [],
  characters,
  activeJourney,
  region,
  partyProvisions,
  setPartyProvisions,
  setCharacters,
  onJourneyUpdate,
  travelEvents = [],
  terrenoViaje = '',
  onForage,
  onFatigueSave,
  onFatigueChange,
  desgloseVelocidades = [],
  consecutiveCampDays = 0,
  diasSinComida = 0,
  diasSinAgua = 0,
  currentClima = null,
  currentTerreno = '',
  onCampDayCompleted,
}) {
  // El cansancio afecta a TODOS los que viajan, no sólo a los que tienen
  // papel asignado. Combinamos miembros + acompañantes.
  const todosViajeros = useMemo(
    () => [
      ...(miembros || []),
      ...((acompanantes || []).map(a => ({ ...a, _esAcompanante: true, papeles: a.papeles || [] }))),
    ],
    [miembros, acompanantes]
  );
  const [sentinelId, setSentinelId] = useState(miembros?.[0]?.id || '');
  const [foragerId, setForagerId] = useState(
    miembros?.find((m) => m.papeles?.includes('cazador'))?.id || miembros?.[0]?.id || ''
  );
  const [foragingResult, setForagingResult] = useState(null);
  const [foragingDoneToday, setForagingDoneToday] = useState(false);
  const [foragingBusy, setForagingBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  // Tras "Acampar" el usuario decide si forrajear (o no). Sólo se permite
  // 1 forrajeo por acampada (regla del usuario).
  const [campDone, setCampDone] = useState(false);

  // Reset por día / al abrir el dialog otra vez.
  useEffect(() => {
    if (open) {
      setCampDone(false);
      setForagingDoneToday(false);
      setForagingResult(null);
      setResults(null);
    }
  }, [open]);

  const regionKey = region || activeJourney?.config?.tipo_tierra || 'tierras_salvajes';
  const numNightEvents = NIGHT_EVENTS_BY_REGION[regionKey] || 1;

  const provisionesSuficientes = useMemo(() => {
    if (!partyProvisions) return true;
    const disponiblesComida = partyProvisions.comidaTotal - partyProvisions.comidaConsumida;
    const disponiblesAgua = partyProvisions.aguaTotal - partyProvisions.aguaConsumida;
    return disponiblesComida >= todosViajeros.length && disponiblesAgua >= todosViajeros.length;
  }, [partyProvisions, todosViajeros]);

  const performCamp = useCallback(async () => {
    setProcessing(true);
    const hasBackendJourney = !!activeJourney?.id;

    try {
      // 1) Consumir provisiones: 1 ración y 1 litro por miembro
      if (setPartyProvisions) {
        setPartyProvisions((prev) => ({
          ...prev,
          comidaConsumida: prev.comidaConsumida + todosViajeros.length,
          aguaConsumida: prev.aguaConsumida + todosViajeros.length,
        }));
      }

      // 2) NO se hace tirada de salvación de fatiga en la acampada (RAW Abr 2026).
      //    La salvación única de fatiga ocurre al finalizar el viaje
      //    (véase `calculateFatigueResults` en EnhancedTravelSystem).
      //    Aquí sólo recogemos los resultados de centinela + eventos nocturnos
      //    y la reducción pasiva de la CD acumulada.
      const charResults = todosViajeros.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        fatigaAntes: Number(characters.find((c) => c.id === m.id)?.fatiga || 0),
        fatigaDespues: Number(characters.find((c) => c.id === m.id)?.fatiga || 0),
        skipSave: true,
        skipMotivo: 'La tirada de fatiga ocurre sólo al finalizar el viaje',
      }));

      // Notifica al estado superior que se ha completado un día de campamento.
      if (onCampDayCompleted) {
        onCampDayCompleted();
      }

      // 3-4) Tirada(s) del centinela — UNA por cada evento nocturno (Feb 2026)
      //   - d20 == 1: pifia segura → fallo crítico, vigía +0,5 fatiga personal.
      //   - d20 == 20: éxito seguro → evento anulado + cuenta como "éxito por 5+".
      //   - Otros: total = d20 + sab_mod + prof_vigia.
      //       total >= CD (12)           → ÉXITO, evento anulado.
      //       total < CD - 4 (fallo por 5+) → vigía +0,5 fatiga personal.
      //       resto                       → fallo normal, sin penalización extra.
      //   - Si TODAS las tiradas son éxito por 5+ (o nat 20), el grupo descansa
      //     -1 CD en vez de -0,5. Si hay al menos un fallo (de cualquier tipo),
      //     el descanso es -0,5 (RAW).
      const CD_VIGIA = 12;
      let vigiaResultados = [];
      let sentChar = null;
      let wisMod = 0;
      let profBonus = 0;
      let esVigiaProf = false;
      if (sentinelId) {
        sentChar = characters.find((c) => c.id === sentinelId);
        wisMod = modFromScore(sentChar?.atributos?.sabiduria);
        const miembroInfo = miembros.find((m) => m.id === sentinelId);
        esVigiaProf = miembroInfo?.papeles?.includes('vigia') || false;
        profBonus = esVigiaProf ? 2 : 0;
      }

      // 4) Tiradas de eventos nocturnos — escoge aleatoriamente de DEFAULT events
      const nightEvents = [];
      let totalFatigaCdIncrement = 0;
      let allSentinelGreatSuccess = !!sentinelId && numNightEvents > 0;
      let sentinelExtraFatiga = 0;

      for (let i = 0; i < numNightEvents; i++) {
        // (a) Tirada del centinela para ESTE evento
        let watch = null;
        let watchSuccess = false;
        let watchGreatSuccess = false;
        let watchBadFail = false;
        if (sentinelId) {
          const d20 = rollDie(20);
          const total = d20 + wisMod + profBonus;
          if (d20 === 20) {
            watchSuccess = true;
            watchGreatSuccess = true; // nat 20 cuenta como éxito por 5+
          } else if (d20 === 1) {
            watchSuccess = false;
            watchBadFail = true; // pifia = fallo por 5+
          } else {
            watchSuccess = total >= CD_VIGIA;
            watchGreatSuccess = watchSuccess && (total >= CD_VIGIA + 5);
            watchBadFail = !watchSuccess && (total <= CD_VIGIA - 5);
          }
          if (watchBadFail) sentinelExtraFatiga += 0.5;
          if (!watchGreatSuccess) allSentinelGreatSuccess = false;
          watch = { d20, mod: wisMod + profBonus, total, cd: CD_VIGIA, exito: watchSuccess, granExito: watchGreatSuccess, malFallo: watchBadFail };
          vigiaResultados.push(watch);
        } else {
          allSentinelGreatSuccess = false;
        }

        // (b) Tirada del evento (siempre se tira para mostrar el resultado al DJ)
        const d20ev = rollDie(20);
        const matched = travelEvents.find(
          (e) => d20ev >= (e.d20_min ?? 0) && d20ev <= (e.d20_max ?? 0)
        );
        const evento = matched || {
          nombre: 'Noche tranquila',
          fatigue_cd_increase: 0,
          consecuencias_exito: 'Nada perturba el descanso del grupo.',
        };
        const baseCdInc = evento.fatigue_cd_increase || 0;
        // El centinela NEUTRALIZA el evento si lo detectó a tiempo.
        const finalCdInc = watchSuccess ? 0 : baseCdInc;
        nightEvents.push({
          d20: d20ev,
          nombre: evento.nombre,
          fatigue_cd_increase: finalCdInc,
          fatigue_cd_base: baseCdInc,
          consecuencias: watchSuccess
            ? `Centinela alerta. ${evento.consecuencias_exito || ''}`.trim()
            : (evento.consecuencias_exito || ''),
          watch,
          anulado: watchSuccess,
        });
        totalFatigaCdIncrement += finalCdInc;
      }

      // Resumen del vigía (informativo para la cabecera)
      let vigia = null;
      if (sentinelId && sentChar) {
        vigia = {
          nombre: sentChar?.nombre || miembros.find((m) => m.id === sentinelId)?.nombre || 'Centinela',
          cd: CD_VIGIA,
          mod: wisMod + profBonus,
          esVigiaProf,
          tiradas: vigiaResultados,
          extraFatiga: sentinelExtraFatiga,
          granExito: allSentinelGreatSuccess,
        };
      }

      // Aplica el +fatiga personal al centinela (si la hubo) directamente al
      // personaje en BD a través de setCharacters.
      if (sentinelId && sentinelExtraFatiga > 0 && setCharacters) {
        setCharacters((prev) => prev.map((c) =>
          c.id === sentinelId
            ? { ...c, fatiga: Number(((Number(c.fatiga) || 0) + sentinelExtraFatiga).toFixed(1)) }
            : c
        ));
        // Refleja el cambio también en charResults del vigía
        const idxSent = charResults.findIndex((cr) => cr.id === sentinelId);
        if (idxSent >= 0) {
          charResults[idxSent] = {
            ...charResults[idxSent],
            fatigaDespues: Number((charResults[idxSent].fatigaAntes + sentinelExtraFatiga).toFixed(1)),
            extraFatigaVigia: sentinelExtraFatiga,
            skipSave: false,
            skipMotivo: null,
          };
        }
      }

      // 5) Llamar al backend para decrementar la CD y sumar los incrementos
      // de eventos. El decremento es -1 si TODAS las tiradas del centinela
      // fueron éxito por 5+, en caso contrario -0,5 (descanso normal).
      const groupRestDecrement = allSentinelGreatSuccess ? 1.0 : 0.5;
      let fatigaCdNueva = activeJourney?.fatiga_cd_total || 10;
      if (hasBackendJourney) {
        try {
          const res = await api.post(`/travel/journey/${activeJourney.id}/camp`, {
            fatiga_cd_decrement: groupRestDecrement,
          });
          fatigaCdNueva = res.data?.fatiga_cd_nueva ?? fatigaCdNueva;

          // Si hubo eventos nocturnos con incremento, registrarlos en el viaje.
          for (const ne of nightEvents) {
            if (ne.fatigue_cd_increase > 0) {
              try {
                await api.post(`/travel/journey/${activeJourney.id}/add-event`, {
                  nombre: `[Acampada] ${ne.nombre}`,
                  fatiga_cd_increase: ne.fatigue_cd_increase,
                  d20: ne.d20,
                });
                fatigaCdNueva += ne.fatigue_cd_increase;
              } catch (e) {
                console.error('Error registrando evento nocturno:', e);
              }
            }
          }

          if (onJourneyUpdate) {
            onJourneyUpdate({ fatiga_cd_total: fatigaCdNueva });
          }
        } catch (err) {
          console.error('Error al acampar:', err);
          toast.error('No se pudo aplicar la reducción de CD Fatiga.');
        }
      } else {
        // Modo Jornada a Jornada (sin viaje en BD): aplicamos efectos
        // localmente. Descanso -0,5 (o -1 si centinela acertó por 5+ en
        // todas las tiradas) + suma de incrementos por eventos NO neutralizados.
        fatigaCdNueva = Math.max(10, fatigaCdNueva - groupRestDecrement);
        for (const ne of nightEvents) {
          fatigaCdNueva += ne.fatigue_cd_increase || 0;
        }
        if (onJourneyUpdate) {
          onJourneyUpdate({ fatiga_cd_total: fatigaCdNueva });
        }
      }

      setResults({
        charResults,
        vigia,
        nightEvents,
        fatigaCdNueva,
      });

      toast.success(
        `Acampada realizada. CD Fatiga: ${fatigaCdNueva}. ` +
          `${charResults.length} tiradas CON, ${nightEvents.length} evento(s) nocturno(s).`
      );
      setCampDone(true);
    } finally {
      setProcessing(false);
    }
  }, [
    activeJourney,
    miembros,
    characters,
    sentinelId,
    numNightEvents,
    travelEvents,
    setCharacters,
    setPartyProvisions,
    onJourneyUpdate,
  ]);

  const handleClose = () => {
    setResults(null);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="camp-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--gold))]">
            <Tent className="w-5 h-5" />
            Acampar — Descanso Diurno
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!results && (
            <div className="space-y-4">
              {/* Reglas aplicadas */}
              <div className="bg-black/20 p-3 rounded border border-[hsl(var(--gold))]/30 space-y-2">
                <p className="text-sm font-bold text-[hsl(var(--gold))] flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  Reglas de esta acampada
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                  <li>
                    Consumo: <strong>1 ración</strong> y <strong>1 litro de agua</strong> por miembro.
                  </li>
                  <li>
                    Evento(s) nocturno(s) según región: <strong>{numNightEvents}</strong>{' '}
                    en {REGION_LABEL[regionKey] || regionKey}.
                  </li>
                  <li>
                    <strong>Centinela:</strong> tira Sabiduría (Percepción) CD 12 <strong>una vez por evento</strong>.
                    <ul className="list-[circle] pl-5">
                      <li>Éxito → evento <em>anulado</em>.</li>
                      <li>Pifia (1) o fallo por 5+ → el vigía gana <strong>+0,5 cansancio</strong>.</li>
                      <li>Si <strong>todas</strong> las tiradas son éxito por 5+ → grupo descansa <strong>-1 CD</strong>.</li>
                      <li>Si hay 20 natural → éxito por 5+ automático. Si hay 1 → pifia segura.</li>
                    </ul>
                  </li>
                  <li>
                    Descanso del grupo (CD del viaje): <strong>-0,5 CD</strong> (o -1 si el vigía
                    triunfa por 5+ en todas).
                  </li>
                </ul>
              </div>

              {/* Provisiones */}
              {partyProvisions && (
                <div
                  className={`p-3 rounded border ${
                    provisionesSuficientes
                      ? 'border-green-500/40 bg-green-500/10'
                      : 'border-red-500/40 bg-red-500/10'
                  }`}
                >
                  <p className="text-xs font-bold mb-2 flex items-center gap-2">
                    {provisionesSuficientes ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    Coste de la acampada
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-orange-400" />
                      <span>
                        {miembros.length} ración/es (
                        {Math.max(
                          0,
                          (partyProvisions.comidaTotal || 0) -
                            (partyProvisions.comidaConsumida || 0)
                        ).toFixed(1)}{' '}
                        disp.)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <span>
                        {miembros.length} L (
                        {Math.max(
                          0,
                          (partyProvisions.aguaTotal || 0) -
                            (partyProvisions.aguaConsumida || 0)
                        ).toFixed(1)}{' '}
                        disp.)
                      </span>
                    </div>
                  </div>
                  {!provisionesSuficientes && (
                    <p className="text-xs text-red-400 mt-2">
                      Provisiones insuficientes. El grupo acampará con hambre/sed y no obtendrá
                      beneficio completo del descanso.
                    </p>
                  )}
                </div>
              )}

              {/* Selección de Centinela */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Centinela durante el descanso (recupera la mitad)
                </Label>
                <Select value={sentinelId || '__none__'} onValueChange={(v) => setSentinelId(v === '__none__' ? '' : v)}>
                  <SelectTrigger data-testid="camp-sentinel-select">
                    <SelectValue placeholder="Elegir centinela" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin centinela (grupo completo descansa)</SelectItem>
                    {miembros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                        {m.papeles?.includes('vigia') ? ' (Vigía)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Si no eliges centinela, todos recuperan completamente pero la tirada de
                  Sabiduría (Percepción) se hace en desventaja.
                </p>
              </div>

              {/* Forrajear durante la acampada — sólo disponible TRAS
                  pulsar "Acampar un día" y limitado a 1 vez por acampada.*/}
              <div className={`space-y-2 p-3 rounded border ${campDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/30 bg-muted/30 opacity-60'}`}>
                <p className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                  <Leaf className="w-4 h-4" />
                  Forrajear (opcional, tras acampar)
                  {foragingDoneToday && (
                    <Badge variant="outline" className="ml-2 text-emerald-400 border-emerald-500/40">Hecho hoy</Badge>
                  )}
                </p>
                {!campDone && (
                  <p className="text-[11px] text-amber-300 italic">
                    Pulsa primero "Acampar un día" para poder forrajear.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Un personaje busca alimento y agua en la naturaleza. Tirada de
                  <strong> Sabiduría </strong>vs CD según terreno
                  ({getForageCD(terrenoViaje)} en {terrenoViaje || 'desconocido'}).
                  Éxito: <strong>2d4 raciones</strong> y <strong>3d4 L</strong> de agua.
                  Si el forrajeador es el <strong>Cazador</strong>, gana ventaja en la tirada.
                </p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Forrajeador</Label>
                    <Select value={foragerId} onValueChange={setForagerId} disabled={!campDone || foragingDoneToday}>
                      <SelectTrigger data-testid="camp-forager-select">
                        <SelectValue placeholder="Elegir forrajeador" />
                      </SelectTrigger>
                      <SelectContent>
                        {todosViajeros.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nombre}
                            {m.papeles?.includes('cazador') ? ' (Cazador)' : ''}
                            {m._esAcompanante ? ' (acompañante)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      if (!foragerId || !onForage) {
                        toast.error('Selecciona un forrajeador.');
                        return;
                      }
                      setForagingBusy(true);
                      try {
                        // Marca al forrajeador "esCazador" para que el handler
                        // padre aplique ventaja (2 d20 toma el mejor).
                        const cazador = !!todosViajeros.find(m => m.id === foragerId)?.papeles?.includes('cazador');
                        const r = await onForage(foragerId, { esCazador: cazador });
                        setForagingResult(r || null);
                        setForagingDoneToday(true);
                      } finally {
                        setForagingBusy(false);
                      }
                    }}
                    disabled={!campDone || foragingDoneToday || foragingBusy || !foragerId}
                    className="border-emerald-500/40 hover:bg-emerald-500/10"
                    data-testid="camp-forage-btn"
                  >
                    <Leaf className="w-4 h-4 mr-2" />
                    {foragingBusy ? 'Buscando...' : foragingDoneToday ? 'Ya forrajeado' : 'Forrajear'}
                  </Button>
                </div>
                {foragingResult && (
                  <p
                    className={`text-xs ${
                      foragingResult.exito ? 'text-emerald-400' : 'text-red-400'
                    }`}
                    data-testid="camp-forage-result"
                  >
                    Tirada {foragingResult.tirada} vs CD {foragingResult.cd} →{' '}
                    {foragingResult.exito ? '¡Éxito!' : 'Sin hallazgos'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Resultados */}
          {results && (
            <div className="space-y-3">
              <div className="p-3 rounded border border-[hsl(var(--gold))]/50 bg-black/30">
                <p className="text-xs text-muted-foreground mb-1">CD Fatiga del viaje</p>
                <p className="text-2xl font-bold text-red-400">
                  {results.fatigaCdNueva}
                </p>
              </div>

              {/* Vigía — ahora tira UNA vez por cada evento nocturno */}
              {results.vigia && results.vigia.tiradas?.length > 0 && (
                <div
                  className={`p-3 rounded border ${
                    results.vigia.granExito
                      ? 'border-green-500/60 bg-green-500/15'
                      : 'border-amber-500/40 bg-amber-500/10'
                  }`}
                  data-testid="camp-watchman-panel"
                >
                  <p className="text-xs font-bold flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4" />
                    Centinela — {results.vigia.nombre}
                    {results.vigia.esVigiaProf && (
                      <Badge variant="outline" className="ml-1 text-[10px]">Vigía profesional (+2)</Badge>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Tira <strong>Sabiduría (Percepción) CD {results.vigia.cd}</strong> una vez por
                    cada evento nocturno. Éxito = evento anulado. Pifia (1) o fallo por 5+ = el vigía
                    gana +0,5 de cansancio. Si todas las tiradas son éxito por 5+, el grupo descansa
                    -1 CD.
                  </p>
                  <div className="space-y-1">
                    {results.vigia.tiradas.map((t, i) => (
                      <div
                        key={i}
                        className={`text-xs flex items-center gap-2 p-1 rounded ${
                          t.granExito ? 'bg-green-500/15 text-green-200'
                          : t.exito ? 'bg-green-500/10 text-green-200'
                          : t.malFallo ? 'bg-red-500/15 text-red-200'
                          : 'bg-orange-500/10 text-orange-200'
                        }`}
                      >
                        <Dice6 className="w-3 h-3" />
                        <span>Tirada {i + 1}:</span>
                        <span>d20 ({t.d20}) + {t.mod} = <strong>{t.total}</strong></span>
                        <span>→</span>
                        {t.granExito && <strong>¡ÉXITO POR 5+!</strong>}
                        {!t.granExito && t.exito && <strong>ÉXITO</strong>}
                        {!t.exito && t.malFallo && <strong>FALLO POR 5+ (+0,5 fatiga al vigía)</strong>}
                        {!t.exito && !t.malFallo && <strong>FALLO</strong>}
                        {t.d20 === 20 && <Badge className="bg-green-600 text-[10px]">NAT 20</Badge>}
                        {t.d20 === 1 && <Badge className="bg-red-600 text-[10px]">PIFIA</Badge>}
                      </div>
                    ))}
                  </div>
                  {results.vigia.extraFatiga > 0 && (
                    <p className="text-[11px] text-red-300 mt-2">
                      +{results.vigia.extraFatiga} fatiga aplicada a <strong>{results.vigia.nombre}</strong>.
                    </p>
                  )}
                  {results.vigia.granExito && (
                    <p className="text-[11px] text-green-300 mt-2 font-bold">
                      Descanso reforzado: -1 CD al grupo (en vez de -0,5).
                    </p>
                  )}
                </div>
              )}

              {/* Recuperación por personaje */}
              <div className="space-y-2">
                <p className="text-sm font-bold flex items-center gap-2 text-[hsl(var(--gold))]">
                  <Flame className="w-4 h-4" />
                  Recuperación de Fatiga
                </p>
                {results.charResults.map((r) => (
                  <div
                    key={r.id}
                    className={`p-2 rounded border ${
                      r.nat20
                        ? 'border-green-500/60 bg-green-500/10'
                        : 'border-[hsl(var(--gold))]/30 bg-black/20'
                    }`}
                    data-testid={`camp-result-${r.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {r.nombre}
                          {r.isSentinel && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              <Eye className="w-3 h-3 mr-1" /> Centinela
                            </Badge>
                          )}
                          {r.nat20 && (
                            <Badge className="ml-2 bg-green-600 text-[10px]">¡NAT 20!</Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.skipSave
                            ? <span className="italic">Recuperación automática (2.ª acampada consecutiva, sin tirada).</span>
                            : <>CON: d20 ({r.d20}) + {r.conMod} = {r.total} vs CD {r.cd} {r.pasa ? '✓' : '✗'}</>}
                        </p>
                        {r.saveExtra && (
                          <p className={`text-[11px] ${r.saveExtra.exito ? 'text-emerald-300' : 'text-red-300'}`}>
                            Salv. extra ({r.saveExtra.motivo}): d20 ({r.saveExtra.d20}) + {r.saveExtra.mod} = {r.saveExtra.total} vs CD {r.saveExtra.cd} {r.saveExtra.exito ? '✓' : '✗'}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Cansancio</p>
                        <p className="text-sm font-bold">
                          {r.fatigaAntes % 1 === 0 ? r.fatigaAntes : r.fatigaAntes.toFixed(1)}
                          {' → '}
                          <span className={r.fatigaDespues > r.fatigaAntes ? 'text-red-400' : 'text-green-400'}>
                            {r.fatigaDespues % 1 === 0
                              ? r.fatigaDespues
                              : r.fatigaDespues.toFixed(1)}
                          </span>
                        </p>
                        <p className={`text-[10px] ${r.reduccion >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {r.reduccion >= 0 ? `-${r.reduccion}` : `+${Math.abs(r.reduccion)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Eventos nocturnos */}
              {results.nightEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold flex items-center gap-2 text-[hsl(var(--gold))]">
                    <Moon className="w-4 h-4" />
                    Eventos Nocturnos ({results.nightEvents.length})
                  </p>
                  {results.nightEvents.map((e, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded border ${
                        e.anulado
                          ? 'border-green-500/40 bg-green-500/10'
                          : e.fatigue_cd_increase > 0
                          ? 'border-red-500/40 bg-red-500/10'
                          : 'border-muted bg-black/20'
                      }`}
                      data-testid={`camp-night-event-${i}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Dice6 className="w-4 h-4" />
                          {e.nombre}
                          {e.anulado && (
                            <Badge className="bg-green-600 text-[10px]">Anulado por el centinela</Badge>
                          )}
                        </p>
                        {e.anulado ? (
                          <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-300">
                            +0 CD ({e.fatigue_cd_base > 0 ? `evitado +${e.fatigue_cd_base}` : 'sin riesgo'})
                          </Badge>
                        ) : e.fatigue_cd_increase > 0 ? (
                          <Badge className="bg-red-600 text-[10px]">
                            +{e.fatigue_cd_increase} CD
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Tirada: {e.d20}
                          </Badge>
                        )}
                      </div>
                      {e.consecuencias && (
                        <p className="text-[11px] text-muted-foreground">{e.consecuencias}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="outline" onClick={handleClose} data-testid="camp-cancel-btn">
                Cancelar
              </Button>
              <Button
                onClick={performCamp}
                disabled={processing}
                className="bg-[hsl(var(--gold))] text-black hover:brightness-110"
                data-testid="camp-confirm-btn"
              >
                <Tent className="w-4 h-4 mr-2" />
                {processing ? 'Acampando...' : 'Acampar un día'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} data-testid="camp-close-btn">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
