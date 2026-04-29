/**
 * FatigueSaveLogPanel
 * Tabla diaria, visible en pantalla durante el viaje, con TODAS las tiradas
 * de salvación contra cansancio (d20+mod vs CD) por personaje. Marca con
 * iconos cuándo hay tirada EXTRA por clima extremo o por terreno de la
 * Sombra. Al terminar el viaje sigue siendo accesible para el DJ y se
 * incluye en el resumen.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CloudLightning, Skull, Activity } from 'lucide-react';

const FatigueSaveLogPanel = ({ log = [] }) => {
  if (!log || log.length === 0) return null;

  // Agrupar por día (orden descendente: el día más reciente arriba).
  const byDay = log.reduce((acc, entry) => {
    const d = entry.dia ?? 0;
    if (!acc[d]) acc[d] = [];
    acc[d].push(entry);
    return acc;
  }, {});
  const dias = Object.keys(byDay).map(Number).sort((a, b) => b - a);

  return (
    <Card className="card-parchment border border-amber-500/30" data-testid="fatigue-save-log-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-[hsl(var(--gold))] flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Bitácora de salvaciones contra cansancio
          <Badge variant="outline" className="ml-1">{log.length}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground italic font-normal">
            <CloudLightning className="w-3 h-3 inline mr-1 text-cyan-300" />
            clima extremo · <Skull className="w-3 h-3 inline mx-1 text-purple-300" />
            tierras de la Sombra
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-3">
            {dias.map(dia => (
              <div key={dia} data-testid={`fatigue-log-day-${dia}`}>
                <p className="text-xs text-amber-300 font-bold mb-1 sticky top-0 bg-background/80 backdrop-blur-sm py-1">
                  Día {dia || '—'}
                </p>
                <table className="w-full text-[11px]">
                  <thead className="text-[10px] text-muted-foreground">
                    <tr>
                      <th className="text-left font-normal pb-1">Personaje</th>
                      <th className="text-center font-normal pb-1">d20</th>
                      <th className="text-center font-normal pb-1">+mod</th>
                      <th className="text-center font-normal pb-1">CD</th>
                      <th className="text-center font-normal pb-1">total</th>
                      <th className="text-center font-normal pb-1">resultado</th>
                      <th className="text-right font-normal pb-1">extras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay[dia].map((e, i) => {
                      const okMain = e.exito;
                      const colorMain = okMain ? 'text-emerald-300' : 'text-red-300';
                      return (
                        <tr key={i} className="border-t border-border/20" data-testid={`fatigue-log-entry-${dia}-${i}`}>
                          <td className="py-1 truncate max-w-[140px]">{e.charName || e.id}</td>
                          <td className="text-center font-mono">{e.d20}</td>
                          <td className="text-center font-mono">
                            {e.mod >= 0 ? `+${e.mod}` : e.mod}
                          </td>
                          <td className="text-center font-mono">{e.cd}</td>
                          <td className={`text-center font-mono font-bold ${colorMain}`}>{e.total}</td>
                          <td className="text-center">
                            <span className={colorMain}>{okMain ? '✓' : '✗'}</span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {e.climaExtremo && (
                                <span title="Tirada extra por clima extremo" className="text-cyan-300">
                                  <CloudLightning className="w-3 h-3 inline" />
                                </span>
                              )}
                              {e.enSombra && (
                                <span title="Tirada extra por tierras de la Sombra" className="text-purple-300">
                                  <Skull className="w-3 h-3 inline" />
                                </span>
                              )}
                              {e.saveExtra && (
                                <span
                                  className={`text-[10px] font-mono ${e.saveExtra.exito ? 'text-emerald-300' : 'text-red-300'}`}
                                  title={`Salv. extra (${e.saveExtra.motivo}): d20=${e.saveExtra.d20} + mod=${e.saveExtra.mod} = ${e.saveExtra.total} vs CD ${e.saveExtra.cd}`}
                                >
                                  ext. {e.saveExtra.total}/{e.saveExtra.cd} {e.saveExtra.exito ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FatigueSaveLogPanel;
