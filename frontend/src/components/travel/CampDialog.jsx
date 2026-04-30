/**
 * CampDialog — Sistema de Acampar durante un viaje.
 *
 * Reglas implementadas (confirmadas por el usuario):
 *   - Acampar consume 1 ración + 1 litro de agua por miembro.
 *   - Cada personaje reduce su fatiga -1 automáticamente; si la tirada CON
 *     (CD 10) resulta en un 20 natural, la reducción es -2.
 *   - El Centinela recibe la mitad del beneficio (p.ej. -0,5 o -1 en nat20).
 *   - Tiradas de evento nocturno según peligro de la región:
 *       tierras_libres / fronterizas: 1 evento
 *       tierras_salvajes / sombra:    2 eventos
 *       tierras_oscuras:              3 eventos
 *   - El Centinela hace Sabiduría (Percepción) CD 12 para anticiparse.
 *     Fallo = posible sorpresa al grupo.
 *   - La CD acumulada de Fatiga del viaje se reduce 0,5 por cada acampada.
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

      // 2) Tirada de recuperación de fatiga para cada personaje
      // Reglas (Feb 2026):
      //   • Salvación contra cansancio CD 10 + diasSinComida×1 + diasSinAgua×2.
      //   • Bonus +5 si el personaje no es el causante del estorbo del grupo.
      //   • Si se trata de la 2.ª acampada consecutiva (sin marcha entre
      //     medias), se OMITE la tirada y se aplica recuperación automática.
      //   • Si el clima del día es extremo (tormenta/nieve fuerte) o se
      //     atraviesan tierras de la sombra, se rueda una tirada EXTRA;
      //     fallar cualquiera de las dos suma +1 fatiga.
      const skipSave = consecutiveCampDays >= 1; // 2nd+ consecutive camp
      const climaExtremo = (() => {
        const lab = (currentClima?.estado_label || '').toLowerCase();
        return lab.includes('tormenta') || lab.includes('nieve fuerte') ||
               lab.includes('vendaval') || lab.includes('extremo') || lab.includes('helada');
      })();
      const enSombra = (currentTerreno || '').toLowerCase().includes('sombra') ||
                       (currentTerreno || '').toLowerCase().includes('oscur');
      const necesitaSalvExtra = climaExtremo || enSombra;
      const cdProvisiones = (Number(diasSinComida) || 0) * 1 + (Number(diasSinAgua) || 0) * 2;

      const charResults = [];
      for (const m of todosViajeros) {
        const char = characters.find((c) => c.id === m.id);
        const conMod = modFromScore(char?.atributos?.constitucion);
        const bonusFatiga = Number(
          desgloseVelocidades.find((v) => v.nombre === m.nombre)?.bonus_fatiga || 0
        );
        const cd = 10 + cdProvisiones;
        let d20 = 0, total = 0, pasa = true, nat20 = false;
        let saveExtra = null;
        let pasoSavExtra = true;

        if (!skipSave) {
          d20 = rollDie(20);
          total = d20 + conMod + bonusFatiga;
          pasa = total >= cd;
          nat20 = d20 === 20;

          if (necesitaSalvExtra) {
            const d20e = rollDie(20);
            const totalE = d20e + conMod + bonusFatiga;
            pasoSavExtra = totalE >= cd;
            saveExtra = {
              motivo: climaExtremo ? 'Clima extremo' : 'Tierras de la Sombra',
              d20: d20e, mod: conMod + bonusFatiga, total: totalE, cd,
              exito: pasoSavExtra,
            };
          }
        }

        const isSentinel = m.id === sentinelId;

        // Base: -1 auto. Con nat20 -> -2. Centinela recibe la mitad.
        // Si la tirada principal falla → fatiga adicional según margen:
        //    Falla por <5  → +1 nivel
        //    Falla por 5-9 → +2 niveles
        //    Falla por ≥10 → +3 niveles
        // Si la tirada extra (clima/sombra) falla → +1 fatiga adicional.
        // Si es la 2.ª acampada consecutiva: recuperación automática sin tiradas.
        let reduccion = 1;
        let margenFallo = 0;
        if (skipSave) {
          reduccion = 1;
        } else {
          if (!pasa) {
            margenFallo = cd - total;        // siempre > 0 cuando falla
            // Margen-aware fatigue penalty (LOTR 5e house rule, Feb 2026):
            let nivelesFatiga = 1;            // <5 → +1
            if (margenFallo >= 10) nivelesFatiga = 3;
            else if (margenFallo >= 5) nivelesFatiga = 2;
            reduccion = -nivelesFatiga;       // negativo = suma fatiga
          } else if (nat20) {
            reduccion = 2;
          }
          if (saveExtra && !pasoSavExtra) {
            reduccion -= 1; // suma fatiga adicional (resta a la reducción)
          }
        }
        if (isSentinel && reduccion > 0) reduccion = reduccion / 2;

        const fatigaAntes = Number(char?.fatiga || 0);
        const fatigaDespues = Math.max(0, Math.min(6, Math.round((fatigaAntes - reduccion) * 2) / 2));

        try {
          await api.put(`/characters/${m.id}/fatigue`, { fatiga: fatigaDespues });
          if (setCharacters) {
            setCharacters((prev) =>
              prev.map((c) => (c.id === m.id ? { ...c, fatiga: fatigaDespues } : c))
            );
          }
        } catch (err) {
          console.error('Error actualizando fatiga:', err);
        }

        // Notifica al panel del grupo (modo interactivo). Pasamos también
        // la tirada extra (si la hay) y los motivos para el log diario.
        if (onFatigueSave && !skipSave) {
          onFatigueSave(m.id, {
            d20,
            mod: conMod + bonusFatiga,
            total,
            cd,
            exito: pasa,
            margenFallo: pasa ? 0 : margenFallo,
            nivelesFatiga: pasa ? 0 : Math.max(1, -reduccion),
            saveExtra,
            climaExtremo,
            enSombra,
            charName: m.nombre,
            dia: activeJourney?.dia_actual || null,
          });
        }
        if (onFatigueChange && reduccion !== 0) {
          onFatigueChange(m.id, -reduccion);
        }

        charResults.push({
          id: m.id,
          nombre: m.nombre,
          conMod,
          d20,
          total,
          cd,
          pasa,
          nat20,
          isSentinel,
          reduccion,
          fatigaAntes,
          fatigaDespues,
          skipSave,
          saveExtra,
        });
      }

      // Notifica al estado superior que se ha completado un día de campamento.
      if (onCampDayCompleted) {
        onCampDayCompleted();
      }

      // 3) Tirada del centinela (Sabiduría/Percepción CD 12)
      let vigia = null;
      if (sentinelId) {
        const sentChar = characters.find((c) => c.id === sentinelId);
        const wisMod = modFromScore(sentChar?.atributos?.sabiduria);
        // Bonus de competencia si tiene Percepción o papel de 'vigia'
        const miembroInfo = miembros.find((m) => m.id === sentinelId);
        const esVigiaProf = miembroInfo?.papeles?.includes('vigia') || false;
        const profBonus = esVigiaProf ? 2 : 0;
        const d20 = rollDie(20);
        const total = d20 + wisMod + profBonus;
        vigia = {
          nombre: sentChar?.nombre || miembroInfo?.nombre || 'Centinela',
          d20,
          mod: wisMod + profBonus,
          total,
          cd: 12,
          exito: total >= 12,
          esVigiaProf,
        };
      }

      // 4) Tiradas de eventos nocturnos — escoge aleatoriamente de DEFAULT events
      const nightEvents = [];
      let totalFatigaCdIncrement = 0;
      for (let i = 0; i < numNightEvents; i++) {
        const d20 = rollDie(20);
        const matched = travelEvents.find(
          (e) => d20 >= (e.d20_min ?? 0) && d20 <= (e.d20_max ?? 0)
        );
        const evento = matched || {
          nombre: 'Noche tranquila',
          fatigue_cd_increase: 0,
          consecuencias_exito: 'Nada perturba el descanso del grupo.',
        };
        nightEvents.push({
          d20,
          nombre: evento.nombre,
          fatigue_cd_increase: evento.fatigue_cd_increase || 0,
          consecuencias: evento.consecuencias_exito || '',
        });
        totalFatigaCdIncrement += evento.fatigue_cd_increase || 0;
      }

      // 5) Llamar al backend para decrementar 0,5 la CD y sumar los incrementos de eventos
      let fatigaCdNueva = activeJourney?.fatiga_cd_total || 10;
      if (hasBackendJourney) {
        try {
          const res = await api.post(`/travel/journey/${activeJourney.id}/camp`);
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
        // localmente. -0,5 a la CD acumulada + suma de incrementos por
        // eventos nocturnos. El estado vive en EnhancedTravelSystem.
        fatigaCdNueva = Math.max(0, fatigaCdNueva - 0.5);
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
                    <strong>-1 nivel de cansancio</strong> automático por miembro. Tirada CON CD 10:
                    con un <strong>20 natural</strong> la reducción es -2.
                  </li>
                  <li>
                    El <strong>Centinela</strong> recibe la mitad de la recuperación (se acumula
                    en décimos: -0,5 o -1 con nat20).
                  </li>
                  <li>
                    Consumo: <strong>1 ración</strong> y <strong>1 litro de agua</strong> por miembro.
                  </li>
                  <li>
                    Evento(s) nocturno(s) según región: <strong>{numNightEvents}</strong>{' '}
                    en {REGION_LABEL[regionKey] || regionKey}.
                  </li>
                  <li>
                    CD Fatiga acumulada del viaje: <strong>-0,5</strong>.
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

              {/* Vigía */}
              {results.vigia && (
                <div
                  className={`p-3 rounded border ${
                    results.vigia.exito
                      ? 'border-green-500/40 bg-green-500/10'
                      : 'border-orange-500/40 bg-orange-500/10'
                  }`}
                >
                  <p className="text-xs font-bold flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4" />
                    Tirada de Centinela — {results.vigia.nombre}
                  </p>
                  <p className="text-xs">
                    Sabiduría (Percepción): {results.vigia.d20} + {results.vigia.mod} ={' '}
                    <strong>{results.vigia.total}</strong> vs CD 12 →{' '}
                    {results.vigia.exito ? (
                      <span className="text-green-400 font-bold">¡ÉXITO!</span>
                    ) : (
                      <span className="text-orange-400 font-bold">
                        FALLO (posible sorpresa)
                      </span>
                    )}
                  </p>
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
                        e.fatigue_cd_increase > 0
                          ? 'border-red-500/40 bg-red-500/10'
                          : 'border-muted bg-black/20'
                      }`}
                      data-testid={`camp-night-event-${i}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Dice6 className="w-4 h-4" />
                          {e.nombre}
                        </p>
                        {e.fatigue_cd_increase > 0 ? (
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
