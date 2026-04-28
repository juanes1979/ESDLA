/**
 * JourneyForecastCard
 * Tarjeta de "Alerta predictiva" que se muestra en la pantalla de
 * configuración del viaje cuando ya hay ruta calculada y miembros
 * asignados. Estima — sin viajar — los siguientes datos para dar
 * contexto al DJ:
 *   • Fatiga media estimada al final del viaje
 *   • Raciones / agua disponibles vs. necesarias
 *   • Día más duro (clima más severo + carga del grupo)
 *   • Avisos críticos (fatiga 5+, provisiones insuficientes, terreno extremo)
 *
 * Es 100 % cliente; usa los datos ya conocidos (journeyCalc, journeyWeather,
 * inventario por miembro, estorbo). Sin coste de IA.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, AlertTriangle, Drumstick, Droplet, Activity, CloudLightning,
  Calendar, Footprints,
} from 'lucide-react';

// Probabilidad de FALLAR la salvación CD 10 con un mod CON medio (+1) y bonus 0.
// d20 + 1 < 10 → d20 ≤ 8 → 8/20 = 40 %. Asumimos +0.4 fatiga/día por miembro
// como base. Subimos 1 punto por cada día sin comida y 2 puntos por día sin
// agua. Esto es una estimación gruesa, pero razonable como aviso.
const baseFailRate = 0.4;

const isExtremeWeather = (label) => {
  const l = (label || '').toLowerCase();
  return l.includes('tormenta') || l.includes('vendaval')
    || l.includes('nieve fuerte') || l.includes('helada') || l.includes('extremo');
};

const sumProvisions = (inv) => {
  let raciones = 0, litros = 0;
  (inv || []).forEach(it => {
    const cant = Number(it?.cantidad || 1);
    const tipo = (it?.tipo || it?.categoria || '').toLowerCase();
    const nombre = (it?.nombre || '').toLowerCase();
    if (tipo.includes('racion') || tipo.includes('comida') || nombre.includes('ración') || nombre.includes('racion')) {
      raciones += cant;
    }
    if (tipo.includes('odre') || tipo.includes('agua') || nombre.includes('odre') || nombre.includes('agua')) {
      // Asumir 10 L por odre estándar.
      const litrosPorUnidad = Number(it?.litros || it?.capacidad || 10);
      litros += cant * litrosPorUnidad;
    }
  });
  return { raciones, litros };
};

const JourneyForecastCard = ({ config, journeyCalc, journeyWeather = [], characters = [] }) => {
  if (!journeyCalc?.success) return null;
  const miembrosConPapel = (config?.miembros || []).filter(m => m.papeles?.length > 0);
  const acompanantes = config?.acompanantes || [];
  const numViajeros = miembrosConPapel.length + acompanantes.length;
  if (numViajeros === 0) return null;

  const dias = Math.max(1, Math.round(journeyCalc?.estimaciones?.dias_estimados || 1));

  // ── Provisiones disponibles vs necesarias ─────────────────────────────
  let raciones = 0, litros = 0;
  const todosViajeros = [...miembrosConPapel, ...acompanantes];
  todosViajeros.forEach(m => {
    const ch = characters.find(c => c.id === m.id);
    if (!ch?.inventario) return;
    const s = sumProvisions(ch.inventario);
    raciones += s.raciones;
    litros += s.litros;
  });
  const racionesNecesarias = numViajeros * dias;
  const litrosNecesarios = numViajeros * 2 * dias;
  const racionesFaltan = Math.max(0, racionesNecesarias - raciones);
  const litrosFaltan = Math.max(0, litrosNecesarios - litros);
  const diasSinComida = raciones >= racionesNecesarias ? 0 : Math.ceil(racionesFaltan / numViajeros);
  const diasSinAgua = litros >= litrosNecesarios ? 0 : Math.ceil(litrosFaltan / (numViajeros * 2));

  // ── Fatiga media estimada al final del viaje ─────────────────────────
  // base 0.4 fatiga/día + 0.1 × diasSinComida + 0.2 × diasSinAgua, restando
  // -1 por noche descanso. Aproximación conservadora.
  const fatigaPorDia = baseFailRate
    + 0.1 * Math.min(diasSinComida, dias)
    + 0.2 * Math.min(diasSinAgua, dias);
  const fatigaPromedio = Math.max(0, Math.min(6, +(fatigaPorDia * dias / 2).toFixed(1)));
  const algunoLlegaA5 = fatigaPromedio >= 5;
  const algunoLlegaA6 = fatigaPromedio >= 6;

  // ── Día más duro: por clima extremo o por terreno ────────────────────
  let diaMasDuro = null;
  if (journeyWeather?.length > 0) {
    const ranked = journeyWeather.map((w, i) => ({
      dia: i + 1,
      label: w?.estado_label || '',
      region: w?.region || '',
      severity: isExtremeWeather(w?.estado_label) ? 3 : (
        ((w?.estado_label || '').toLowerCase().includes('lluvia') ||
         (w?.estado_label || '').toLowerCase().includes('niebla')) ? 1 : 0
      ),
    })).sort((a, b) => b.severity - a.severity);
    if (ranked[0]?.severity > 0) diaMasDuro = ranked[0];
  }

  // ── Avisos ─────────────────────────────────────────────────────────────
  const avisos = [];
  if (racionesFaltan > 0)
    avisos.push({ tipo: 'comida', msg: `Faltan ${racionesFaltan} raciones (${diasSinComida} día${diasSinComida === 1 ? '' : 's'} sin comida).` });
  if (litrosFaltan > 0)
    avisos.push({ tipo: 'agua', msg: `Faltan ${litrosFaltan.toFixed(0)} L de agua (${diasSinAgua} día${diasSinAgua === 1 ? '' : 's'} sin agua).` });
  if (algunoLlegaA6)
    avisos.push({ tipo: 'fatiga', msg: 'Riesgo crítico: alguien podría caer inconsciente al final del viaje.' });
  else if (algunoLlegaA5)
    avisos.push({ tipo: 'fatiga', msg: 'La compañía llegará exhausta. Compra provisiones extra o planea acampadas intermedias.' });
  if (diaMasDuro?.severity >= 3)
    avisos.push({ tipo: 'clima', msg: `Día ${diaMasDuro.dia}: clima extremo (${diaMasDuro.label}). Considera retrasar el inicio.` });

  // Mensaje narrativo (estilo del usuario)
  const resumen = `Con esta carga y velocidad, llegarás con fatiga media ${fatigaPromedio} ` +
    `tras ${dias} día${dias === 1 ? '' : 's'} de viaje. ` +
    (raciones >= racionesNecesarias
      ? `Te quedarán ${raciones - racionesNecesarias} raciones de margen. `
      : `Te faltan ${racionesFaltan} raciones. `) +
    (diaMasDuro
      ? `El día más duro será el ${diaMasDuro.dia} (${diaMasDuro.label}${diaMasDuro.region ? ' en ' + diaMasDuro.region : ''}).`
      : 'No se prevé clima especialmente adverso.');

  const colorClass = avisos.some(a => a.tipo === 'fatiga')
    ? 'border-red-500/40 bg-red-950/10'
    : avisos.length > 0
      ? 'border-amber-500/40 bg-amber-950/10'
      : 'border-emerald-500/30 bg-emerald-950/10';

  return (
    <Card className={`card-parchment ${colorClass}`} data-testid="journey-forecast-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Alerta predictiva del viaje
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm italic text-foreground/90">"{resumen}"</p>

        {/* KPIs en una fila */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-black/30 p-2 rounded">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3" /> Días
            </p>
            <p className="font-mono text-lg font-bold">{dias}</p>
          </div>
          <div className="bg-black/30 p-2 rounded">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Activity className="w-3 h-3" /> Fatiga ~final
            </p>
            <p className={`font-mono text-lg font-bold ${algunoLlegaA5 ? 'text-red-300' : algunoLlegaA6 ? 'text-red-500' : 'text-emerald-300'}`}
               data-testid="forecast-fatigue">
              {fatigaPromedio}
            </p>
          </div>
          <div className="bg-black/30 p-2 rounded">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Drumstick className="w-3 h-3 text-amber-300" /> Comida
            </p>
            <p className={`font-mono text-lg font-bold ${racionesFaltan > 0 ? 'text-red-300' : 'text-emerald-300'}`}
               data-testid="forecast-food">
              {raciones}/{racionesNecesarias}
            </p>
          </div>
          <div className="bg-black/30 p-2 rounded">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Droplet className="w-3 h-3 text-sky-300" /> Agua (L)
            </p>
            <p className={`font-mono text-lg font-bold ${litrosFaltan > 0 ? 'text-red-300' : 'text-emerald-300'}`}
               data-testid="forecast-water">
              {litros.toFixed(0)}/{litrosNecesarios.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Día más duro */}
        {diaMasDuro && (
          <div className="flex items-center gap-2 p-2 rounded bg-black/20 border border-amber-500/30">
            <CloudLightning className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 text-xs">
              <span className="font-bold text-amber-300">Día más duro:</span> Día {diaMasDuro.dia} —{' '}
              {diaMasDuro.label}{diaMasDuro.region ? ` en ${diaMasDuro.region}` : ''}
              {diaMasDuro.severity >= 3 && <Badge variant="outline" className="ml-2 text-[10px] border-red-500/40 text-red-300">EXTREMO</Badge>}
            </div>
          </div>
        )}

        {/* Avisos */}
        {avisos.length > 0 && (
          <div className="space-y-1" data-testid="forecast-warnings">
            {avisos.map((a, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs p-1.5 rounded ${
                  a.tipo === 'fatiga' ? 'bg-red-900/20 text-red-200'
                    : a.tipo === 'clima' ? 'bg-amber-900/20 text-amber-200'
                    : 'bg-orange-900/15 text-orange-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{a.msg}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic">
          <Footprints className="w-3 h-3 inline mr-1" />
          Estimación basada en CD 10 base, fallo medio del 40 % por día,
          consumo 1 ración + 2 L por persona/día. Ajusta las provisiones
          o la velocidad antes de iniciar.
        </p>
      </CardContent>
    </Card>
  );
};

export default JourneyForecastCard;
