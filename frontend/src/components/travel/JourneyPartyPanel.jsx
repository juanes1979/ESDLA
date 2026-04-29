/**
 * JourneyPartyPanel
 * Panel "Estado del grupo" mostrado durante el viaje interactivo. Resume
 * para cada miembro con papel asignado:
 *   • Nombre + papel
 *   • Fatiga actual y último cambio (+1, -1)
 *   • Comida/agua consumida (proporcional al grupo)
 *   • Última tirada de salvación contra cansancio (d20+mod vs CD)
 *   • Estorbo / penalización por carga (placeholder hasta integrar peso)
 * Y a nivel grupo:
 *   • CD acumulada de fatiga por eventos fallidos
 *   • Total de raciones / agua consumidas / disponibles
 */
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Drumstick, Droplet, Shield, AlertTriangle, Users, Heart, Skull } from 'lucide-react';

const PAPEL_LABELS = {
  guia: 'Guía',
  vigia: 'Vigía',
  cazador: 'Cazador',
  explorador: 'Explorador',
  cartografo: 'Cartógrafo',
  médico: 'Médico',
  medico: 'Médico',
};

const fatigueColor = (f) => {
  const v = Number(f || 0);
  if (v >= 5) return 'text-red-400';
  if (v >= 3) return 'text-orange-300';
  if (v >= 1) return 'text-amber-300';
  return 'text-emerald-300';
};

const JourneyPartyPanel = ({
  miembros = [],
  acompanantes = [],
  characters = [],
  partyProvisions = { comidaTotal: 0, aguaTotal: 0, comidaConsumida: 0, aguaConsumida: 0 },
  globalFatigaCD = 10,
  lastFatigueSaves = {},
  fatigueChanges = {},
}) => {
  // Mostramos TODOS los viajeros (con papel + acompañantes), no sólo los que
  // tienen papel asignado. La regla de comida/agua aplica al grupo entero.
  const conPapel = miembros.filter(m => m.papeles?.length > 0)
    .map(m => ({ ...m, _esAcompanante: false }));
  const acomp = (acompanantes || []).map(a => ({ ...a, _esAcompanante: true, papeles: a.papeles || [] }));
  const todos = [...conPapel, ...acomp];
  if (todos.length === 0) return null;

  const comidaDisp = Math.max(0, (partyProvisions.comidaTotal || 0) - (partyProvisions.comidaConsumida || 0));
  const aguaDisp = Math.max(0, (partyProvisions.aguaTotal || 0) - (partyProvisions.aguaConsumida || 0));
  const personasParaRepartir = Math.max(1, todos.length);
  const racionesPorCabeza = (partyProvisions.comidaConsumida || 0) / personasParaRepartir;
  const litrosPorCabeza = (partyProvisions.aguaConsumida || 0) / personasParaRepartir;

  return (
    <Card className="card-parchment border border-emerald-500/30" data-testid="journey-party-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-[hsl(var(--gold))] flex items-center gap-2">
          <Users className="w-4 h-4" />
          Estado del grupo
          <Badge variant="outline" className="ml-1">{todos.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-3 text-xs">
          <span title="CD acumulada de fatiga por eventos fallidos" className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-muted-foreground">CD fatiga</span>
            <span className="font-mono text-orange-300 font-bold" data-testid="party-cd-fatiga">
              {Number(globalFatigaCD).toFixed(1)}
            </span>
          </span>
          <span title="Comida disponible / consumida" className="flex items-center gap-1">
            <Drumstick className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-mono text-amber-200">
              {comidaDisp.toFixed(0)}/{(partyProvisions.comidaTotal || 0).toFixed(0)}
            </span>
          </span>
          <span title="Agua disponible / consumida" className="flex items-center gap-1">
            <Droplet className="w-3.5 h-3.5 text-sky-300" />
            <span className="font-mono text-sky-200">
              {aguaDisp.toFixed(1)}/{(partyProvisions.aguaTotal || 0).toFixed(1)}L
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {todos.map(m => {
            const ch = characters.find(c => c.id === m.id);
            const fatiga = Number(ch?.fatiga ?? 0);
            const change = fatigueChanges[m.id]; // {delta: +1/-1, casilla}
            const save = lastFatigueSaves[m.id];
            const pgActual = Number(ch?.puntos_golpe_actual ?? ch?.puntos_golpe_max ?? 0);
            const pgMax = Number(ch?.puntos_golpe_max ?? 0);
            const inconsciente = pgMax > 0 && pgActual <= 0;
            const pgCritico = pgMax > 0 && !inconsciente && pgActual <= Math.ceil(pgMax / 4);
            const papelLabel = m._esAcompanante
              ? 'acompañante'
              : (PAPEL_LABELS[m.papeles?.[0]] || m.papeles?.[0] || 'viajero');
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 text-xs p-2 rounded border ${
                  inconsciente
                    ? 'bg-red-900/40 border-red-500/60 ring-1 ring-red-500/40 animate-pulse'
                    : pgCritico
                      ? 'bg-orange-900/20 border-orange-500/40'
                      : 'bg-black/30 border-border/30'
                }`}
                data-testid={`party-row-${m.id}`}
              >
                {/* Identidad */}
                <div className="flex-shrink-0 min-w-[110px]">
                  <p className="font-bold text-[hsl(var(--gold))] truncate flex items-center gap-1">
                    {m.nombre}
                    {inconsciente && <Skull className="w-3 h-3 text-red-400" />}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{papelLabel}</p>
                </div>

                {/* Puntos de Golpe */}
                {pgMax > 0 && (
                  <div className="flex items-center gap-1" title={`PG ${pgActual}/${pgMax}`}>
                    <Heart className={`w-3.5 h-3.5 ${inconsciente ? 'text-red-500' : pgCritico ? 'text-orange-400' : 'text-rose-300'}`} />
                    <span className={`font-mono font-bold ${inconsciente ? 'text-red-400' : pgCritico ? 'text-orange-300' : 'text-rose-200'}`}
                      data-testid={`party-pg-${m.id}`}>
                      {pgActual}/{pgMax}
                    </span>
                    {inconsciente && (
                      <Badge variant="outline" className="px-1 py-0 text-[10px] text-red-300 border-red-500/60 bg-red-500/10" data-testid={`party-inconsciente-${m.id}`}>
                        Inconsciente
                      </Badge>
                    )}
                  </div>
                )}

                {/* Fatiga actual + último cambio */}
                <div className="flex items-center gap-1.5">
                  <Activity className={`w-3.5 h-3.5 ${fatigueColor(fatiga)}`} />
                  <span className={`font-mono font-bold ${fatigueColor(fatiga)}`}>
                    {fatiga.toFixed(fatiga % 1 === 0 ? 0 : 1)}
                  </span>
                  {change?.delta && (
                    <Badge
                      variant="outline"
                      className={`px-1 py-0 text-[10px] ${change.delta > 0 ? 'text-red-300 border-red-500/40' : 'text-emerald-300 border-emerald-500/40'}`}
                    >
                      {change.delta > 0 ? `+${change.delta}` : change.delta}
                    </Badge>
                  )}
                </div>

                {/* Provisiones individuales (proporcional) */}
                <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span><Drumstick className="w-3 h-3 inline text-amber-300/70" /> {racionesPorCabeza.toFixed(1)}</span>
                  <span><Droplet className="w-3 h-3 inline text-sky-300/70" /> {litrosPorCabeza.toFixed(1)}L</span>
                </div>

                {/* Última tirada de salvación contra cansancio */}
                <div className="flex-1 text-right">
                  {save ? (
                    <span
                      className={`text-[10px] font-mono ${save.exito ? 'text-emerald-300' : 'text-red-300'}`}
                      title={`d20=${save.d20} + mod=${save.mod} = ${save.total} vs CD ${save.cd}`}
                    >
                      Salv. {save.total} vs CD {save.cd} {save.exito ? '✓' : '✗'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60">— sin salvación —</span>
                  )}
                </div>

                {/* Estorbo (placeholder hasta integrar el cálculo de peso) */}
                {(ch?.estorbo || ch?.penalizacion_carga) && (
                  <span className="text-[10px] text-orange-300 flex items-center gap-1" title="Estorbo / penalización por carga">
                    <AlertTriangle className="w-3 h-3" /> Carga
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default JourneyPartyPanel;
