/**
 * Character Header - Name, level, culture, experience
 */
import { LevelUpButton } from '@/components/LevelUpModal';

const CharacterHeader = ({ character, onLevelUp }) => {
  return (
    <div className="card-parchment rounded-lg p-6 mb-6">
      <div className="flex items-center gap-6">
        {/* Portrait - Show AI image or fallback to initial */}
        {character.portrait_image ? (
          <img 
            src={`data:image/png;base64,${character.portrait_image}`}
            alt={`Retrato de ${character.nombre}`}
            className="w-24 h-24 rounded-full object-cover ring-1 ring-[hsl(var(--gold))/50]"
            style={{ background: 'transparent' }}
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center ring-1 ring-[hsl(var(--gold))/50]">
            <span className="font-heading text-4xl text-[hsl(var(--gold))]">
              {character.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="font-heading text-3xl text-foreground mb-1">
            {character.nombre}
          </h1>
          <p className="text-lg text-muted-foreground">
            {character.cultura_nombre} {character.vocacion_nombre}
          </p>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground items-center">
            <span>Nivel {character.nivel || 1}</span>
            <LevelUpButton 
              character={character} 
              onLevelUp={onLevelUp}
              className="text-xs py-1 h-auto"
            />
            <span>·</span>
            <span>{character.edad} años</span>
            <span>·</span>
            <span>{character.altura_cm} cm</span>
            <span>·</span>
            <span>{character.peso_kg} kg</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Experiencia</p>
          <p className="font-heading text-2xl text-[hsl(var(--gold))]">
            {character.experiencia || 0} XP
          </p>
          {character.codigo_publico && (
            <p className="text-[10px] text-muted-foreground font-mono mt-2 tracking-wider"
               data-testid="codigo-publico-display"
               title="Código público único del personaje">
              {character.codigo_publico}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterHeader;
