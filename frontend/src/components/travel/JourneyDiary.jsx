/**
 * JourneyDiary — Diario de Viaje unificado.
 *
 * Toma los datos de orientación, eventos, fatiga, acampadas y clima para generar
 * un párrafo narrativo por jornada, usando /api/travel/generate-day-log.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Sparkles, Loader2, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

/**
 * Agrupa los datos del viaje por jornada (una entrada por tirada de orientación).
 * Cada entrada incluye la orientación, los eventos que le siguieron y,
 * opcionalmente, la TS final de fatiga del último día.
 */
function buildDayBlocks({ orientationChecks = [], events = [], fatigueResults = [] }) {
  const blocks = [];
  orientationChecks.forEach((oc, i) => {
    const nextOc = orientationChecks[i + 1];
    const dayCasilla = oc.casilla_actual || 0;
    const nextCasilla = nextOc ? nextOc.casilla_actual : Infinity;
    const dayEvents = events.filter(
      (e) => e.casilla && e.casilla > dayCasilla && e.casilla <= nextCasilla
    );
    blocks.push({
      dia_numero: i + 1,
      orientacion: oc,
      eventos: dayEvents,
      // TS de fatiga final solo se adjunta al último bloque (al final del viaje)
      tiradas_fatiga: i === orientationChecks.length - 1 ? fatigueResults : [],
    });
  });
  return blocks;
}

export default function JourneyDiary({
  orientationChecks,
  events,
  fatigueResults,
  miembros,
  origen,
  destino,
  terreno,
  tipoTierra,
  diasTotales,
}) {
  const dayBlocks = useMemo(
    () => buildDayBlocks({ orientationChecks, events, fatigueResults }),
    [orientationChecks, events, fatigueResults]
  );

  const [diary, setDiary] = useState({}); // { [dia_numero]: { narrative, loading, clima, notas_dia } }
  const [generatingAll, setGeneratingAll] = useState(false);

  const generateDayLog = useCallback(
    async (block) => {
      const dia = block.dia_numero;
      setDiary((prev) => ({
        ...prev,
        [dia]: { ...(prev[dia] || {}), loading: true },
      }));
      try {
        const res = await api.post('/travel/generate-day-log', {
          dia_numero: dia,
          dias_totales: diasTotales || dayBlocks.length,
          terreno: terreno || 'campo_abierto',
          tipo_tierra: tipoTierra || 'tierras_salvajes',
          origen,
          destino,
          personajes: (miembros || []).map((m) => ({
            nombre: m.nombre,
            papel: (m.papeles || []).join(', '),
          })),
          orientacion: block.orientacion
            ? {
                d20: block.orientacion.d20,
                total: block.orientacion.total,
                exito: block.orientacion.exito,
                detalle: block.orientacion.detalle,
                gm_notes: block.orientacion.gm_notes || '',
              }
            : null,
          eventos: (block.eventos || []).map((e) => ({
            nombre: e.evento?.nombre || e.nombre,
            tirada: e.tirada,
            cd: e.resolucion?.cd,
            exito: e.exito,
            personaje: e.objetivo?.papel,
            gm_notes: e.gm_notes || '',
            narrativa: e.narrativa || '',
          })),
          tiradas_fatiga: block.tiradas_fatiga || [],
          clima: diary[dia]?.clima || '',
          notas_maestro_dia: diary[dia]?.notas_dia || '',
          dia_anterior_resumen: dia > 1 ? diary[dia - 1]?.narrative?.slice(0, 300) : null,
        });
        if (res.data.success) {
          setDiary((prev) => ({
            ...prev,
            [dia]: { ...(prev[dia] || {}), narrative: res.data.narrative, loading: false },
          }));
        } else {
          toast.error(`Error generando día ${dia}: ${res.data.error || 'desconocido'}`);
          setDiary((prev) => ({ ...prev, [dia]: { ...(prev[dia] || {}), loading: false } }));
        }
      } catch (err) {
        console.error(err);
        toast.error(`Error generando día ${dia}`);
        setDiary((prev) => ({ ...prev, [dia]: { ...(prev[dia] || {}), loading: false } }));
      }
    },
    [
      dayBlocks.length,
      diasTotales,
      terreno,
      tipoTierra,
      origen,
      destino,
      miembros,
      diary,
    ]
  );

  const generateAll = useCallback(async () => {
    setGeneratingAll(true);
    for (const block of dayBlocks) {
      // eslint-disable-next-line no-await-in-loop
      await generateDayLog(block);
    }
    setGeneratingAll(false);
    toast.success(`Diario del viaje generado (${dayBlocks.length} jornadas).`);
  }, [dayBlocks, generateDayLog]);

  const downloadDiary = useCallback(() => {
    const lines = [];
    lines.push(`DIARIO DE VIAJE — ${origen || ''} → ${destino || ''}`);
    lines.push('='.repeat(60));
    lines.push('');
    dayBlocks.forEach((b) => {
      const entry = diary[b.dia_numero];
      lines.push(`Jornada ${b.dia_numero}`);
      lines.push('-'.repeat(20));
      if (entry?.clima) lines.push(`Clima: ${entry.clima}`);
      if (entry?.notas_dia) lines.push(`Notas del Maestro: ${entry.notas_dia}`);
      lines.push(entry?.narrative || '(sin narrativa generada)');
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diario-viaje-${(origen || 'inicio').replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dayBlocks, diary, origen, destino]);

  if (dayBlocks.length === 0) return null;

  return (
    <Card className="card-parchment" data-testid="journey-diary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Diario del Viaje
            <span className="text-xs text-muted-foreground font-normal ml-2">
              ({dayBlocks.length} jornadas)
            </span>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={generateAll}
              disabled={generatingAll}
              data-testid="diary-generate-all-btn"
            >
              {generatingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Generar Diario Completo
            </Button>
            {Object.keys(diary).length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={downloadDiary}
                data-testid="diary-download-btn"
              >
                <Download className="w-4 h-4 mr-1" />
                Descargar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[600px] pr-3">
          <div className="space-y-4">
            {dayBlocks.map((b) => {
              const entry = diary[b.dia_numero] || {};
              const hasNarrative = !!entry.narrative;
              return (
                <div
                  key={b.dia_numero}
                  className="p-4 rounded border border-[hsl(var(--gold))]/30 bg-black/20 space-y-2"
                  data-testid={`diary-day-${b.dia_numero}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[hsl(var(--gold))]">
                        Jornada {b.dia_numero}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {b.orientacion
                          ? `Orientación ${b.orientacion.total} vs CD 15 (${
                              b.orientacion.exito ? 'éxito' : 'fallo'
                            })`
                          : ''}
                        {b.eventos.length > 0 && ` · ${b.eventos.length} evento(s)`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => generateDayLog(b)}
                      disabled={entry.loading || generatingAll}
                      data-testid={`diary-regenerate-${b.dia_numero}`}
                    >
                      {entry.loading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : hasNarrative ? (
                        <RefreshCw className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </Button>
                  </div>

                  {/* Inputs contextuales: clima + notas globales */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Clima del día</label>
                      <input
                        type="text"
                        value={entry.clima || ''}
                        onChange={(e) =>
                          setDiary((prev) => ({
                            ...prev,
                            [b.dia_numero]: { ...(prev[b.dia_numero] || {}), clima: e.target.value },
                          }))
                        }
                        placeholder="Ej: Lluvia persistente desde el mediodía"
                        className="w-full text-xs p-1 rounded bg-black/30 border border-muted"
                        data-testid={`diary-clima-${b.dia_numero}`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Notas globales del día</label>
                      <input
                        type="text"
                        value={entry.notas_dia || ''}
                        onChange={(e) =>
                          setDiary((prev) => ({
                            ...prev,
                            [b.dia_numero]: {
                              ...(prev[b.dia_numero] || {}),
                              notas_dia: e.target.value,
                            },
                          }))
                        }
                        placeholder="Ej: El grupo descansa junto al río Aguada Gris"
                        className="w-full text-xs p-1 rounded bg-black/30 border border-muted"
                      />
                    </div>
                  </div>

                  {hasNarrative ? (
                    <Textarea
                      value={entry.narrative}
                      onChange={(e) =>
                        setDiary((prev) => ({
                          ...prev,
                          [b.dia_numero]: {
                            ...(prev[b.dia_numero] || {}),
                            narrative: e.target.value,
                          },
                        }))
                      }
                      rows={5}
                      className="text-sm leading-relaxed bg-black/10"
                      data-testid={`diary-narrative-${b.dia_numero}`}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Aún sin narrativa — pulsa el icono ✨ para generar.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
