/**
 * JourneyDiary — Crónica unificada del viaje.
 *
 * Genera UN ÚNICO texto narrativo continuo del viaje completo, hilvanando todas
 * las jornadas ("al tercer día…", "en la quinta jornada…") a partir de los datos
 * guardados durante el viaje (orientación, eventos, notas del maestro introducidas
 * durante cada tirada, fatiga final). El Maestro no tiene que volver a introducir
 * nada: las notas y el clima se heredan automáticamente.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Sparkles, Loader2, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

function buildJornadas({ orientationChecks = [], events = [], fatigueResults = [] }) {
  const jornadas = [];
  orientationChecks.forEach((oc, i) => {
    const nextOc = orientationChecks[i + 1];
    const dayCasilla = oc.casilla_actual || 0;
    const nextCasilla = nextOc ? nextOc.casilla_actual : Infinity;
    const dayEvents = events.filter(
      (e) => e.casilla && e.casilla > dayCasilla && e.casilla <= nextCasilla
    );
    jornadas.push({
      dia_numero: i + 1,
      orientacion: {
        d20: oc.d20,
        total: oc.total,
        exito: oc.exito,
        detalle: oc.detalle,
        gm_notes: oc.gm_notes || '',
      },
      eventos: dayEvents.map((e) => ({
        nombre: e.evento?.nombre || e.nombre,
        tirada: e.tirada,
        cd: e.resolucion?.cd,
        exito: e.exito,
        personaje: e.objetivo?.papel,
        gm_notes: e.gm_notes || '',
        narrativa: e.narrativa || '',
      })),
      tiradas_fatiga: i === orientationChecks.length - 1 ? fatigueResults : [],
    });
  });
  return jornadas;
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
  kilometros,
  fechaSalida,
  mes,                  // Eldarin or abbreviated month for the climate roll
  diaMes,               // day of month for narrative
  origenRegion,         // string region of the origin location (fallback)
  destinoRegion,        // string region of the destination location
  pathRegions,          // optional array of regions per casilla/day from journeyCalc.ruta
  chronicle: externalChronicle,
  setChronicle: externalSetChronicle,
}) {
  const jornadas = useMemo(
    () => buildJornadas({ orientationChecks, events, fatigueResults }),
    [orientationChecks, events, fatigueResults]
  );

  const [localChronicle, setLocalChronicle] = useState('');
  const chronicle = externalChronicle !== undefined ? externalChronicle : localChronicle;
  const setChronicle = externalSetChronicle || setLocalChronicle;

  const [loading, setLoading] = useState(false);
  const [weatherLog, setWeatherLog] = useState(''); // compact log lines
  const [weatherDays, setWeatherDays] = useState([]); // raw simulated days
  
  // Nº de notas heredadas (solo informativo)
  const totalGmNotes = useMemo(() => {
    let count = 0;
    jornadas.forEach((j) => {
      if (j.orientacion?.gm_notes) count++;
      j.eventos.forEach((e) => { if (e.gm_notes) count++; });
    });
    return count;
  }, [jornadas]);

  // Build a per-day region sequence from path or fallbacks
  const buildRegionsPerDay = useCallback((numDays) => {
    if (Array.isArray(pathRegions) && pathRegions.length > 0) {
      const out = [];
      for (let i = 0; i < numDays; i++) {
        out.push(pathRegions[Math.min(i, pathRegions.length - 1)]);
      }
      return out;
    }
    // Fallback: linear interpolation between origin and destination region
    const orig = origenRegion || destinoRegion || '';
    const dest = destinoRegion || origenRegion || '';
    const out = [];
    for (let i = 0; i < numDays; i++) {
      const ratio = numDays > 1 ? i / (numDays - 1) : 0;
      out.push(ratio < 0.5 ? orig : dest);
    }
    return out;
  }, [pathRegions, origenRegion, destinoRegion]);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Roll weather for all journey days (Markov chain)
      const numDays = diasTotales || jornadas.length || 1;
      let weatherLogStr = '';
      let weatherDaysArr = [];
      if (mes) {
        try {
          const wRes = await api.post('/weather/simulate', {
            mes,
            dia_inicio: diaMes || 1,
            num_dias: numDays,
            regiones_por_dia: buildRegionsPerDay(numDays),
          });
          weatherDaysArr = wRes.data?.dias || [];
          weatherLogStr = weatherDaysArr.map((w) => w.log_line).join('\n');
          setWeatherDays(weatherDaysArr);
          setWeatherLog(weatherLogStr);
        } catch (err) {
          console.warn('Weather simulation skipped:', err);
        }
      }

      // 2) Generate the chronicle, passing the weather log to the AI
      const res = await api.post('/travel/generate-full-chronicle', {
        origen,
        destino,
        fecha_salida: fechaSalida,
        kilometros,
        dias_totales: diasTotales || jornadas.length,
        personajes: (miembros || []).map((m) => ({
          nombre: m.nombre,
          papel: (m.papeles || []).join(', '),
        })),
        jornadas,
        weather_log: weatherDaysArr,
      });
      if (res.data.success) {
        setChronicle(res.data.chronicle);
        if (res.data.weather_log) {
          setWeatherLog(res.data.weather_log);
        }
        toast.success('Crónica del viaje generada.');
      } else {
        toast.error(`Error: ${res.data.error || 'desconocido'}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error generando crónica.');
    } finally {
      setLoading(false);
    }
  }, [origen, destino, fechaSalida, kilometros, diasTotales, jornadas, miembros, setChronicle, mes, diaMes, buildRegionsPerDay]);

  const download = useCallback(() => {
    if (!chronicle) return;
    const weatherSection = weatherLog ? `\n\n--- REGISTRO METEOROLÓGICO DEL VIAJE ---\n${weatherLog}\n` : '';
    const blob = new Blob([`CRÓNICA DEL VIAJE — ${origen || ''} → ${destino || ''}\n\n${chronicle}${weatherSection}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cronica-viaje-${(destino || 'fin').replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chronicle, origen, destino, weatherLog]);

  if (jornadas.length === 0) return null;

  return (
    <Card className="card-parchment" data-testid="journey-diary">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Crónica del Viaje
          </CardTitle>
          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-muted-foreground">
              {jornadas.length} jornadas · {totalGmNotes} notas del maestro heredadas
            </span>
            <Button
              size="sm"
              onClick={generate}
              disabled={loading}
              className="bg-[hsl(var(--gold))] text-black hover:brightness-110"
              data-testid="chronicle-generate-btn"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : chronicle ? (
                <RefreshCw className="w-4 h-4 mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {chronicle ? 'Regenerar Crónica' : 'Generar Crónica'}
            </Button>
            {chronicle && (
              <Button size="sm" variant="outline" onClick={download} data-testid="chronicle-download-btn">
                <Download className="w-4 h-4 mr-1" />
                .txt
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Un único texto continuo que teje todas las jornadas ("al tercer día...", "en la quinta jornada..."),
          usando automáticamente las notas que el Maestro introdujo durante cada tirada de orientación y evento.
          {fechaSalida && <> · Salida: <strong>{fechaSalida}</strong></>}
          {kilometros && <> · {Math.round(kilometros)} km</>}
        </p>
        {chronicle ? (
          <Textarea
            value={chronicle}
            onChange={(e) => setChronicle(e.target.value)}
            rows={16}
            className="text-sm leading-relaxed font-serif bg-black/20"
            data-testid="chronicle-textarea"
          />
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground italic bg-black/10 rounded border border-dashed border-[hsl(var(--gold))]/30">
            Aún no hay crónica generada. Pulsa "Generar Crónica" para que la IA teja un único relato
            continuo con todas las jornadas y las notas que ya introdujiste durante el viaje.
          </div>
        )}

        {/* Detailed weather log (compact, monospace) */}
        {weatherDays && weatherDays.length > 0 && (
          <div className="mt-4 border-t border-[hsl(var(--gold))]/20 pt-3" data-testid="weather-log-section">
            <h4 className="text-sm font-heading text-[hsl(var(--gold))] mb-2 flex items-center gap-2">
              Registro meteorológico del viaje
              <span className="text-[10px] text-muted-foreground font-normal italic">
                (rodado con cadena de Markov sobre {weatherDays.length} jornadas)
              </span>
            </h4>
            <div className="bg-black/30 rounded p-3 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto" data-testid="weather-log-content">
              {weatherDays.map((w) => w.log_line).join('\n')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
