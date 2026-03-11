/**
 * Skills Card - All 19 skills with proficiency indicators
 */
import { Book } from 'lucide-react';

const ALL_SKILLS = [
  { nombre: 'Acertijos', atributo: 'inteligencia' },
  { nombre: 'Acrobacias', atributo: 'destreza' },
  { nombre: 'Atletismo', atributo: 'fuerza' },
  { nombre: 'Cazar', atributo: 'sabiduria' },
  { nombre: 'Engaño', atributo: 'carisma' },
  { nombre: 'Explorar', atributo: 'sabiduria' },
  { nombre: 'Intimidación', atributo: 'carisma' },
  { nombre: 'Investigación', atributo: 'inteligencia' },
  { nombre: 'Juego de manos', atributo: 'destreza' },
  { nombre: 'Percepción', atributo: 'sabiduria' },
  { nombre: 'Perspicacia', atributo: 'sabiduria' },
  { nombre: 'Persuasión', atributo: 'carisma' },
  { nombre: 'Saber antiguo', atributo: 'inteligencia' },
  { nombre: 'Saber de la naturaleza', atributo: 'inteligencia' },
  { nombre: 'Sanación', atributo: 'sabiduria' },
  { nombre: 'Sigilo', atributo: 'destreza' },
  { nombre: 'Supervivencia', atributo: 'sabiduria' },
  { nombre: 'Tradiciones', atributo: 'inteligencia' },
  { nombre: 'Viajar', atributo: 'sabiduria' },
];

const getModifier = (score) => Math.floor((score - 10) / 2);

const SkillsCard = ({ character }) => {
  const attributes = character.atributos || {};
  
  // Collect all competent skills
  const cleanSkill = (s) => s?.split(' (')[0]?.trim()?.toLowerCase();
  const competentSkillsRaw = [
    ...(character.habilidades || []),
    ...(character.habilidades_competencia || []),
    ...(character.habilidades_elegidas_ocupacion || []),
    ...(character.competencias?.habilidades_cultura || []),
    ...(character.competencias?.habilidades_trasfondo || []),
  ];
  const competentSkills = new Set(competentSkillsRaw.map(cleanSkill).filter(Boolean));
  
  // Expertise skills
  const expertiseSkillsRaw = character.pericia_elegida || [];
  const expertiseSkills = new Set(expertiseSkillsRaw.map(cleanSkill).filter(Boolean));
  
  // Level and proficiency bonus
  const nivel = character.nivel || 1;
  const profBonus = Math.ceil(nivel / 4) + 1;

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
        <Book className="w-5 h-5" />
        Habilidades
      </h3>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground text-center mb-2">
          Nivel {nivel} · Bonificador de Competencia: +{profBonus}
        </div>
        {/* Legend */}
        <div className="flex justify-center gap-4 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[hsl(var(--gold))/20] border border-[hsl(var(--gold))]"></div>
            <span className="text-[hsl(var(--gold))]">Competencia</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-[hsl(var(--magic-blue))/20] border border-[hsl(var(--magic-blue))]"></div>
            <span className="text-[hsl(var(--magic-blue))]">★ Pericia</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {ALL_SKILLS.map((skill) => {
            const attrValue = attributes[skill.atributo] || 10;
            const attrMod = getModifier(attrValue);
            const isCompetent = competentSkills.has(skill.nombre.toLowerCase());
            const hasExpertise = expertiseSkills.has(skill.nombre.toLowerCase());
            
            let totalMod = attrMod;
            if (isCompetent) totalMod += profBonus;
            if (hasExpertise) totalMod += profBonus;
            
            return (
              <div 
                key={skill.nombre}
                className={`p-1.5 rounded flex justify-between items-center text-xs ${
                  hasExpertise 
                    ? 'bg-[hsl(var(--magic-blue))/20] border border-[hsl(var(--magic-blue))]'
                    : isCompetent 
                      ? 'bg-[hsl(var(--gold))/20] border border-[hsl(var(--gold))]'
                      : 'bg-black/10'
                }`}
              >
                <span className={isCompetent ? 'font-medium' : 'text-muted-foreground'}>
                  {hasExpertise && '★ '}
                  {skill.nombre}
                </span>
                <span className={`font-heading ${
                  hasExpertise 
                    ? 'text-[hsl(var(--magic-blue))]'
                    : isCompetent 
                      ? 'text-[hsl(var(--gold))]'
                      : 'text-muted-foreground'
                }`}>
                  {totalMod >= 0 ? '+' : ''}{totalMod}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground justify-center mt-2">
          <span><span className="inline-block w-2 h-2 rounded bg-[hsl(var(--gold))/40] mr-1"></span>Competencia</span>
          <span><span className="inline-block w-2 h-2 rounded bg-[hsl(var(--magic-blue))/40] mr-1"></span>Pericia</span>
        </div>
      </div>
    </div>
  );
};

export default SkillsCard;
