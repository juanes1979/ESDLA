/**
 * Background Card - Background info with personal history
 */
import { Scroll, Crown } from 'lucide-react';

const BackgroundCard = ({ character, background }) => {
  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
        <Scroll className="w-5 h-5" />
        Trasfondo
      </h3>
      <div className="space-y-2">
        <div className="bg-secondary rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Trasfondo</p>
          <p className="text-foreground font-medium">{character.trasfondo_nombre}</p>
        </div>
        
        {/* Historia generada por IA o descripción del trasfondo */}
        {(character.historia || character.descripcion_trasfondo || background?.descripcion) && (
          <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-[hsl(var(--gold))/50]">
            <p className="text-xs text-[hsl(var(--gold))] mb-1">Historia Personal</p>
            <p className="text-muted-foreground text-sm italic leading-relaxed">
              {character.historia || character.descripcion_trasfondo || background?.descripcion}
            </p>
          </div>
        )}
        
        {character.virtud_nombre && (
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Virtud</p>
            <p className="text-foreground font-medium">{character.virtud_nombre}</p>
            {(character.virtud_rasgos || character.virtud_descripcion) && (
              <p className="text-muted-foreground text-xs mt-1 italic">
                {character.virtud_rasgos || character.virtud_descripcion}
              </p>
            )}
          </div>
        )}
        {character.patron_nombre && (
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Crown className="w-3 h-3" /> Mecenas
            </p>
            <p className="text-foreground">{character.patron_nombre}</p>
            <p className="text-xs text-[hsl(var(--magic-blue))]">
              Puntos de Comunidad: {character.puntos_comunidad || 0}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundCard;
