/**
 * Culture Card - Culture information with blessing and traits
 */
import { Star } from 'lucide-react';

const CultureCard = ({ character, culture }) => {
  if (!culture) {
    return null;
  }

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-emerald-400 mb-3 flex items-center gap-2">
        <Star className="w-5 h-5" />
        Cultura: {character.cultura_nombre}
      </h3>
      <div className="space-y-3 text-sm">
        {culture.descripcion && (
          <p className="text-muted-foreground italic">{culture.descripcion}</p>
        )}
        {culture.bendicion_nombre && (
          <div className="bg-emerald-500/10 rounded p-3 border border-emerald-500/30">
            <span className="text-emerald-400 font-heading block mb-1">
              Bendición: {culture.bendicion_nombre}
            </span>
            <span className="text-muted-foreground text-xs">
              {culture.bendicion_descripcion}
            </span>
          </div>
        )}
        
        {/* Cultural Traits */}
        {character.rasgos_culturales?.length > 0 && (
          <div className="bg-secondary/50 rounded p-3">
            <span className="text-emerald-400 font-medium block mb-2">Rasgos Culturales</span>
            {character.rasgos_culturales?.map((rasgo, i) => (
              <div key={i} className="text-muted-foreground text-xs mb-1">
                • {typeof rasgo === 'string' ? rasgo : rasgo.nombre}
                {typeof rasgo === 'object' && rasgo.descripcion && (
                  <span className="block ml-3 text-muted-foreground/70 italic">{rasgo.descripcion}</span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {culture.idiomas && culture.idiomas.length > 0 && (
          <div>
            <span className="text-muted-foreground">Idiomas: </span>
            <span className="text-foreground">{culture.idiomas.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CultureCard;
