/**
 * Competencies Card - Saving throws, armors, weapons, languages
 */

const CompetenciesCard = ({ character, occupation }) => {
  // Get proficiencies from character or fallback to occupation data
  const competencias = character.competencias || {};
  
  let armas = competencias.armas || [];
  let armaduras = competencias.armaduras || [];
  let tiradas = competencias.tiradas_salvacion || [];
  const idiomas = competencias.idiomas || [];
  
  // Fallback to occupation if character data is empty
  if (occupation && armas.length === 0) {
    armas = occupation.competencia_armas || [];
  }
  if (occupation && armaduras.length === 0) {
    armaduras = occupation.competencia_armaduras || [];
  }
  if (occupation && tiradas.length === 0) {
    tiradas = occupation.tiradas_salvacion || [];
  }

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-3">
        Competencias
      </h3>
      <div className="space-y-2 text-sm">
        {tiradas.length > 0 && (
          <div>
            <span className="text-muted-foreground">Tiradas de salvación: </span>
            <span className="text-foreground uppercase font-medium">
              {tiradas.join(', ')}
            </span>
          </div>
        )}
        {armaduras.length > 0 && (
          <div>
            <span className="text-muted-foreground">Armaduras: </span>
            <span className="text-foreground">
              {armaduras.join(', ')}
            </span>
          </div>
        )}
        {armas.length > 0 && (
          <div>
            <span className="text-muted-foreground">Armas: </span>
            <span className="text-foreground">
              {armas.join(', ')}
            </span>
          </div>
        )}
        {idiomas.length > 0 && (
          <div>
            <span className="text-muted-foreground">Idiomas: </span>
            <span className="text-foreground uppercase">
              {idiomas.join(', ')}
            </span>
          </div>
        )}
        {armas.length === 0 && armaduras.length === 0 && tiradas.length === 0 && (
          <p className="text-muted-foreground italic">Sin competencias registradas</p>
        )}
      </div>
    </div>
  );
};

export default CompetenciesCard;
