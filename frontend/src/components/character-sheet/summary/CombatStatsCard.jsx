/**
 * Combat Stats Card - HP, Shadow, AC, Speed, Hit Die
 */
import { Heart, Shield, Footprints, Swords, Eye, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEncumbrance } from '@/hooks/useEncumbrance';

const getModifier = (score) => Math.floor((score - 10) / 2);

const CombatStatsCard = ({ 
  character, 
  onHpChange, 
  onShadowChange, 
  savingHp 
}) => {
  const attributes = character.atributos || {};
  const hpPercent = (character.puntos_golpe_actual / character.puntos_golpe_max) * 100;
  const ac = character.clase_armadura || (10 + getModifier(attributes.destreza || 10));
  // Cálculo en VIVO (mismo hook que la pestaña Equipo). Ya no depende de
  // `character.estorbo_metros` persistido — así no hay inconsistencias.
  const enc = useEncumbrance(character);

  return (
    <div className="space-y-6">
      {/* HP */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Puntos de Golpe
          </h3>
        </div>
        <div className="text-center mb-3">
          <span className="font-heading text-4xl text-foreground">
            {character.puntos_golpe_actual}
          </span>
          <span className="text-muted-foreground text-xl"> / {character.puntos_golpe_max}</span>
        </div>
        {/* HP Bar */}
        <div className="h-4 bg-secondary rounded-full overflow-hidden mb-3">
          <div 
            className={cn(
              'h-full transition-all duration-300',
              hpPercent > 50 ? 'bg-green-600' : hpPercent > 25 ? 'bg-yellow-600' : 'bg-red-600'
            )}
            style={{ width: `${Math.max(0, hpPercent)}%` }}
          />
        </div>
        {/* HP Controls */}
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onHpChange(-1)}
            disabled={savingHp || character.puntos_golpe_actual <= 0}
            className="border-red-500/50 hover:bg-red-500/10"
            data-testid="hp-minus"
          >
            <Minus className="w-4 h-4 text-red-500" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onHpChange(-5)}
            disabled={savingHp || character.puntos_golpe_actual <= 0}
            className="border-red-500/50 hover:bg-red-500/10"
          >
            -5
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onHpChange(5)}
            disabled={savingHp || character.puntos_golpe_actual >= character.puntos_golpe_max}
            className="border-green-500/50 hover:bg-green-500/10"
          >
            +5
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onHpChange(1)}
            disabled={savingHp || character.puntos_golpe_actual >= character.puntos_golpe_max}
            className="border-green-500/50 hover:bg-green-500/10"
            data-testid="hp-plus"
          >
            <Plus className="w-4 h-4 text-green-500" />
          </Button>
        </div>
      </div>

      {/* Combat Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-parchment rounded-lg p-4 text-center">
          <Shield className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--magic-blue))]" />
          <p className="text-xs text-muted-foreground">Clase Armadura</p>
          <p className="font-heading text-2xl text-foreground">{ac}</p>
        </div>
        <div className="card-parchment rounded-lg p-4 text-center">
          <Footprints className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--gold))]" />
          <p className="text-xs text-muted-foreground">Velocidad</p>
          {(() => {
            const { velBase, velEfectiva, tier } = enc;
            return (
              <>
                <p className={`font-heading text-2xl ${tier === 'ok' ? 'text-foreground' : tier === 'cargado' ? 'text-orange-300' : 'text-red-400'}`}>
                  {velEfectiva}m
                </p>
                {tier !== 'ok' && (
                  <p className={`text-[10px] mt-1 font-bold ${tier === 'cargado' ? 'text-orange-300' : 'text-red-400'}`}
                     data-testid="encumbrance-badge">
                    {tier === 'cargado'
                      ? 'CARGADO −33%'
                      : tier === 'muy'
                      ? 'MUY CARGADO −66%'
                      : 'SOBRECARGADO'}
                  </p>
                )}
                {tier !== 'ok' && (
                  <p className="text-[9px] text-muted-foreground italic">base {velBase}m · {velEfectiva - velBase}m</p>
                )}
              </>
            );
          })()}
        </div>
        <div className="card-parchment rounded-lg p-4 text-center">
          <Swords className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--torch-orange))]" />
          <p className="text-xs text-muted-foreground">Dado Golpe</p>
          <p className="font-heading text-xl text-foreground">{character.dado_golpe}</p>
        </div>
      </div>

      {/* Shadow Points */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg text-purple-400 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Puntos de Sombra
          </h3>
        </div>
        <div className="text-center mb-3">
          <span className="font-heading text-3xl text-purple-400">
            {character.puntos_sombra || 0}
          </span>
          {character.puntos_sombra_permanentes > 0 && (
            <span className="text-sm text-muted-foreground ml-2">
              ({character.puntos_sombra_permanentes} perm.)
            </span>
          )}
        </div>
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onShadowChange(-1)}
            disabled={character.puntos_sombra <= 0}
            className="border-purple-500/50 hover:bg-purple-500/10"
            data-testid="shadow-minus"
          >
            <Minus className="w-4 h-4 text-purple-400" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onShadowChange(1)}
            className="border-purple-500/50 hover:bg-purple-500/10"
            data-testid="shadow-plus"
          >
            <Plus className="w-4 h-4 text-purple-400" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CombatStatsCard;
