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
import React, { useState, useMemo, useCallback } from 'react';
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
}) {
  const [sentinelId, setSentinelId] = useState(miembros?.[0]?.id || '');
  const [foragerId, setForagerId] = useState(
    miembros?.find((m) => m.papeles?.includes('cazador'))?.id || miembros?.[0]?.id || ''
  );
  const [foragingResult, setForagingResult] = useState(null);
  const [foragingBusy, setForagingBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [processing, setProcessing] = useState(false);

  const regionKey = region || activeJourney?.config?.tipo_tierra || 'tierras_salvajes';
  const numNightEvents = NIGHT_EVENTS_BY_REGION[regionKey] || 1;

  const provisionesSuficientes = useMemo(() => {
    if (!partyProvisions) return true;
    const disponiblesComida = partyProvisions.comidaTotal - partyProvisions.comidaConsumida;
    const disponiblesAgua = partyProvisions.aguaTotal - partyProvisions.aguaConsumida;
    return disponiblesComida >= miembros.length && disponiblesAgua >= miembros.length;
  }, [partyProvisions, miembros]);

  const performCamp = useCallback(async () => {
    setProcessing(true);
    const hasBackendJourney = !!activeJourney?.id;

    try {
      // 1) Consumir provisiones: 1 ración y 1 litro por miembro
      if (setPartyProvisions) {
        setPartyProvisions((prev) => ({
          ...prev,
          comidaConsumida: prev.comidaConsumida + miembros.length,
          aguaConsumida: prev.aguaConsumida + miembros.length,
        }));
      }

      // 2) Tirada de recuperación de fatiga para cada personaje
      const charResults = [];
      for (const m of miembros) {
        const char = characters.find((c) => c.id === m.id);
        const conMod = modFromScore(char?.atributos?.constitucion);
        const d20 = rollDie(20);
        const total = d20 + conMod;
        const cd = 10;
        const pasa = total >= cd;
        const nat20 = d20 === 20;
        const isSentinel = m.id === sentinelId;

        // Base: -1 auto. Con nat20 -> -2. Centinela recibe la mitad.
        let reduccion = 1;
        if (nat20) reduccion = 2;
        if (isSentinel) reduccion = reduccion / 2;

        const fatigaAntes = Number(char?.fatiga || 0);
        const fatigaDespues = Math.max(0, Math.round((fatigaAntes - reduccion) * 2) / 2);

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
        });
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

              {/* Forrajear durante la acampada */}
              <div className="space-y-2 p-3 rounded border border-emerald-500/30 bg-emerald-500/5">
                <p className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                  <Leaf className="w-4 h-4" />
                  Forrajear (opcional)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Un personaje busca alimento y agua en la naturaleza. Tirada de
                  <strong> Sabiduría </strong>vs CD según terreno
                  ({getForageCD(terrenoViaje)} en {terrenoViaje || 'desconocido'}).
                  Éxito: <strong>2d4 raciones</strong> y <strong>3d4 L</strong> de agua.
                </p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Forrajeador</Label>
                    <Select value={foragerId} onValueChange={setForagerId}>
                      <SelectTrigger data-testid="camp-forager-select">
                        <SelectValue placeholder="Elegir forrajeador" />
                      </SelectTrigger>
                      <SelectContent>
                        {miembros.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nombre}
                            {m.papeles?.includes('cazador') ? ' (Cazador)' : ''}
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
                        const r = await onForage(foragerId);
                        setForagingResult(r || null);
                      } finally {
                        setForagingBusy(false);
                      }
                    }}
                    disabled={foragingBusy || !foragerId}
                    className="border-emerald-500/40 hover:bg-emerald-500/10"
                    data-testid="camp-forage-btn"
                  >
                    <Leaf className="w-4 h-4 mr-2" />
                    {foragingBusy ? 'Buscando...' : 'Forrajear'}
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
                          CON: d20 ({r.d20}) + {r.conMod} = {r.total} vs CD {r.cd}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Cansancio</p>
                        <p className="text-sm font-bold">
                          {r.fatigaAntes % 1 === 0 ? r.fatigaAntes : r.fatigaAntes.toFixed(1)}
                          {' → '}
                          <span className="text-green-400">
                            {r.fatigaDespues % 1 === 0
                              ? r.fatigaDespues
                              : r.fatigaDespues.toFixed(1)}
                          </span>
                        </p>
                        <p className="text-[10px] text-green-400">-{r.reduccion}</p>
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
