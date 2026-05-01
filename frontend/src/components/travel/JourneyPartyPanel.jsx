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
import { Activity, Drumstick, Droplet, Shield, AlertTriangle, Users, Heart, Skull, Moon } from 'lucide-react';

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
  // Nuevos (Abr 2026): desglose del CD acumulado y estado del viaje.
  fatigaCdBreakdown = [],    // [{ motivo: 'Tormenta día 3', delta: +2, casilla: 4 }, ...]
  diaActual = null,
  casillaActual = null,
  totalCasillas = null,
  forcedMarchActive = false,
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

  // Últimos 4 modificadores del CD para vista compacta bajo el badge.
  const lastMods = (fatigaCdBreakdown || []).slice(-4);

  return (
    <Card className="card-parchment border border-emerald-500/30" data-testid="journey-party-panel">
      <CardHeader className="pb-2 flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between w-full">
          <CardTitle className="text-sm text-[hsl(var(--gold))] flex items-center gap-2">
            <Users className="w-4 h-4" />
            Estado del grupo
            <Badge variant="outline" className="ml-1">{todos.length}</Badge>
            {diaActual != null && (
              <Badge variant="outline" className="ml-1 text-[10px]" data-testid="party-dia-actual">
                Día {diaActual}{totalCasillas ? ` · ${casillaActual}/${totalCasillas}` : ''}
              </Badge>
            )}
            {forcedMarchActive && (
              <Badge className="ml-1 bg-orange-600 hover:bg-orange-600 text-[10px]" data-testid="party-marcha-forzada">
                ⚡ Marcha forzada
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span title="CD de la tirada FINAL de fatiga (base 10 + eventos − acampadas)" className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-muted-foreground">CD fatiga final</span>
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
        </div>

        {/* Desglose compacto de la CD acumulada — ayuda al DJ a decidir si acampar */}
        {lastMods.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[10px]" data-testid="party-cd-breakdown">
            <span className="text-muted-foreground">Modificadores recientes:</span>
            {lastMods.map((mod, i) => (
              <Badge
                key={i}
                variant="outline"
                className={`text-[10px] ${mod.delta >= 0 ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`}
                title={`Día ${mod.dia || '?'}: ${mod.motivo}`}
              >
                {mod.delta >= 0 ? '+' : ''}{mod.delta} {mod.motivo}
              </Badge>
            ))}
            {(fatigaCdBreakdown || []).length > lastMods.length && (
              <span className="text-[10px] text-muted-foreground">
                (+{fatigaCdBreakdown.length - lastMods.length} más)
              </span>
            )}
          </div>
        )}
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

                {/* Puntos de Sombra */}
                {(() => {
                  const sombra = Number(ch?.puntos_sombra ?? 0);
                  if (sombra <= 0) return null;
                  const tone = sombra >= 10 ? 'text-fuchsia-300' : sombra >= 5 ? 'text-purple-300' : 'text-violet-300';
                  return (
                    <div className="flex items-center gap-1" title={`Puntos de Sombra: ${sombra}`} data-testid={`party-sombra-${m.id}`}>
                      <Moon className={`w-3.5 h-3.5 ${tone}`} />
                      <span className={`font-mono font-bold ${tone}`}>{sombra}</span>
                    </div>
                  );
                })()}

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

                {/* Montura sobrecargada — calcula el peso REAL sobre el
                    animal: items con portado_por='montura' + montura.equipo[]
                    + (si va montado: peso del jinete + equipo personal). */}
                {(() => {
                  if (!ch?.montura?.nombre) return null;
                  const cap = Number(ch.montura.capacidad_carga || ch.montura.carga_kg || 0);
                  if (cap <= 0) return null;
                  let pesoMontura = 0;
                  let pesoPersonaje = 0;
                  (ch.inventario || []).forEach(it => {
                    if (!it) return;
                    const peso = Number(it.peso_kg || it.peso || 0) * Number(it.cantidad || 1);
                    if (it.portado_por === 'montura') pesoMontura += peso;
                    else pesoPersonaje += peso;
                  });
                  (ch.montura.equipo || []).forEach(it => {
                    pesoMontura += Number(it?.peso_kg || it?.peso || 0) * Number(it?.cantidad || 1);
                  });
                  if (ch.montado) {
                    pesoMontura += Number(ch.peso_kg || ch.peso || 70) + pesoPersonaje;
                  }
                  const ratio = pesoMontura / cap;
                  const sobrecargada = ratio > 1;
                  const cargada = !sobrecargada && ratio > 0.8;
                  const vacia = pesoMontura === 0;
                  return (
                    <span
                      className={`text-[10px] flex items-center gap-1 px-1 rounded ${
                        sobrecargada
                          ? 'text-red-300 bg-red-500/10 border border-red-500/40 animate-pulse'
                          : cargada
                            ? 'text-amber-300 bg-amber-500/10 border border-amber-500/30'
                            : vacia
                              ? 'text-blue-300 bg-blue-500/10 border border-blue-500/30 cursor-help'
                              : 'text-emerald-300'
                      }`}
                      title={vacia
                        ? `${ch.montura.nombre} vacío (0 / ${cap} kg). Carga el equipo del jinete en la montura desde "Gestionar equipo → En montura". Si el jinete va MONTADO sobre el animal, marca el toggle "Va montado" para que la montura cargue también su peso corporal.`
                        : `${ch.montura.nombre}: ${pesoMontura.toFixed(1)} / ${cap} kg ${ch.montado ? '(jinete + equipo)' : '(sólo carga)'}${sobrecargada ? ' — SOBRECARGADA: -33% velocidad' : ''}`}
                      data-testid={`party-mount-load-${m.id}`}
                    >
                      🐎 {pesoMontura.toFixed(0)}/{cap} kg
                      {ch.montado && <span className="text-[9px] italic">·jinete</span>}
                      {sobrecargada && <AlertTriangle className="w-3 h-3" />}
                      {vacia && <span className="text-[9px] italic ml-1">(sin carga)</span>}
                    </span>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default JourneyPartyPanel;
