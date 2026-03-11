/**
 * Shadow Path Card - Shadow path with description
 */
import { Eye } from 'lucide-react';

const ShadowPathCard = ({ character }) => {
  if (!character.senda_sombra) {
    return null;
  }

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-purple-400 mb-3 flex items-center gap-2">
        <Eye className="w-5 h-5" />
        Senda de Sombra
      </h3>
      <div className="bg-purple-500/10 rounded p-3 border border-purple-500/30">
        <span className="text-purple-400 font-medium block mb-1">
          {character.senda_sombra}
        </span>
        {character.senda_sombra_descripcion && (
          <p className="text-muted-foreground text-xs italic">
            {character.senda_sombra_descripcion}
          </p>
        )}
      </div>
    </div>
  );
};

export default ShadowPathCard;
