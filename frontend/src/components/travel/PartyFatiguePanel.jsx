/**
 * PartyFatiguePanel
 * Muestra la fatiga acumulada individual de cada miembro del grupo en tiempo real.
 * Se actualiza tras cada tirada de orientación / evento / fatiga / descanso.
 */
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, ShieldAlert, Skull } from 'lucide-react';

const FATIGUE_EFFECTS = [
  'Sin cansancio',                                    // 0
  'Desventaja en pruebas de característica',         // 1
  'Velocidad reducida a la mitad',                   // 2
  'Desventaja en ataques y salvaciones',             // 3
  'PG máximos reducidos a la mitad',                 // 4
  'Velocidad reducida a 0',                          // 5
  'Muerte'                                           // 6
];

const levelColor = (n) => {
  if (n <= 0) return { bar: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/40' };
  if (n < 2) return { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/40' };
  if (n < 3) return { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/40' };
  if (n < 5) return { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/40' };
  return { bar: 'bg-red-700', text: 'text-red-300', bg: 'bg-red-900/30 border-red-700/60' };
};

export default function PartyFatiguePanel({ miembros = [], acompanantes = [], characters = [] }) {
  // Mostramos TODOS los viajeros (con papel o acompañantes). La fatiga
  // aplica a cualquiera que viaje, no sólo a los miembros con papel.
  const acomp = (acompanantes || []).map(a => ({ ...a, _esAcompanante: true }));
  const todos = [...miembros, ...acomp];
  if (!todos.length) return null;

  return (
    <Card className="card-parchment" data-testid="party-fatigue-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Flame className="w-5 h-5" />
          Cansancio del Grupo
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            Actualizado tras cada tirada
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {todos.map((m) => {
            const char = characters.find((c) => c.id === m.id);
            const fatiga = Number(char?.fatiga || 0);
            const level = Math.floor(fatiga);
            const pct = Math.min(100, (fatiga / 6) * 100);
            const colors = levelColor(fatiga);
            const effect = FATIGUE_EFFECTS[Math.min(6, level)];
            const isDying = fatiga >= 6;

            return (
              <div
                key={m.id}
                className={`p-2 rounded border ${colors.bg}`}
                data-testid={`fatigue-row-${m.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{m.nombre}</span>
                    {m._esAcompanante ? (
                      <span className="text-[10px] text-muted-foreground italic truncate">
                        (acompañante)
                      </span>
                    ) : m.papeles?.length > 0 ? (
                      <span className="text-[10px] text-muted-foreground truncate">
                        ({m.papeles.join(', ')})
                      </span>
                    ) : null}
                  </div>
                  <Badge variant="outline" className={`${colors.text} text-xs shrink-0`}>
                    {isDying ? <Skull className="w-3 h-3 mr-1" /> : <ShieldAlert className="w-3 h-3 mr-1" />}
                    Nivel {fatiga % 1 === 0 ? fatiga : fatiga.toFixed(1)} / 6
                  </Badge>
                </div>
                <div className="w-full h-2 bg-black/40 rounded overflow-hidden">
                  <div
                    className={`h-full transition-all ${colors.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={`text-[11px] mt-1 ${colors.text}`}>{effect}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
