/**
 * Personality Card - Distinctive traits
 */
import { Star } from 'lucide-react';

const PersonalityCard = ({ character }) => {
  if (!character.rasgo_distintivo && !character.rasgo_distintivo_2) {
    return null;
  }

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-amber-400 mb-3 flex items-center gap-2">
        <Star className="w-5 h-5" />
        Rasgos de Personalidad
      </h3>
      <div className="space-y-2">
        {character.rasgo_distintivo && (
          <div className="bg-amber-500/10 rounded p-3 border border-amber-500/30">
            <span className="text-amber-400 font-medium">
              {character.rasgo_distintivo.nombre || character.rasgo_distintivo}
            </span>
            {character.rasgo_distintivo.descripcion && (
              <p className="text-muted-foreground text-xs mt-1 italic">
                {character.rasgo_distintivo.descripcion}
              </p>
            )}
          </div>
        )}
        {character.rasgo_distintivo_2 && (
          <div className="bg-amber-500/10 rounded p-3 border border-amber-500/30">
            <span className="text-amber-400 font-medium">
              {character.rasgo_distintivo_2.nombre || character.rasgo_distintivo_2}
            </span>
            {character.rasgo_distintivo_2.descripcion && (
              <p className="text-muted-foreground text-xs mt-1 italic">
                {character.rasgo_distintivo_2.descripcion}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalityCard;
