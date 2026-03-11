/**
 * Occupation Card - Occupation info with curse and favored skills
 */
import { Swords } from 'lucide-react';

const OccupationCard = ({ character, occupation }) => {
  if (!occupation) return null;

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-md text-amber-400 mb-2 flex items-center gap-2">
        <Swords className="w-4 h-4" />
        Ocupación: {occupation.vocacion}
      </h3>
      <div className="space-y-2 text-sm">
        {occupation.maldicion_nombre && (
          <div className="bg-red-500/10 rounded p-2 border border-red-500/30 text-xs">
            <span className="text-red-400 font-medium">
              Maldición: {occupation.maldicion_nombre}
            </span>
          </div>
        )}
        {character.habilidades_favorecidas && character.habilidades_favorecidas.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Hab. Favorecidas: </span>
            <span className="text-amber-400">{character.habilidades_favorecidas.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OccupationCard;
