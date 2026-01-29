/**
 * Step 6: Skills Selection
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Check } from 'lucide-react';
import { updateDraftStep6 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Standard 5e-style skills mapped to attributes
const ALL_SKILLS = [
  { name: 'Acrobacias', attr: 'destreza' },
  { name: 'Atletismo', attr: 'fuerza' },
  { name: 'Engaño', attr: 'carisma' },
  { name: 'Historia', attr: 'inteligencia' },
  { name: 'Interpretación', attr: 'carisma' },
  { name: 'Intimidación', attr: 'carisma' },
  { name: 'Investigación', attr: 'inteligencia' },
  { name: 'Juego de Manos', attr: 'destreza' },
  { name: 'Medicina', attr: 'sabiduria' },
  { name: 'Naturaleza', attr: 'inteligencia' },
  { name: 'Percepción', attr: 'sabiduria' },
  { name: 'Perspicacia', attr: 'sabiduria' },
  { name: 'Persuasión', attr: 'carisma' },
  { name: 'Religión', attr: 'inteligencia' },
  { name: 'Sigilo', attr: 'destreza' },
  { name: 'Supervivencia', attr: 'sabiduria' },
  { name: 'Trato con Animales', attr: 'sabiduria' },
  { name: 'Viajar', attr: 'sabiduria' },
];

const ATTR_ABBR = {
  fuerza: 'FUE',
  destreza: 'DES',
  constitucion: 'CON',
  inteligencia: 'INT',
  sabiduria: 'SAB',
  carisma: 'CAR',
};

const Step6Skills = ({ draftId, draft, onComplete, onBack }) => {
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Skills from background (already granted)
  const backgroundSkills = draft?.competencias_trasfondo?.habilidades || [];
  
  // Number of skills to choose from occupation
  const numToChoose = draft?.ocupacion?.num_habilidades_elegir || 2;
  
  // Available skills from occupation
  const availableSkills = draft?.habilidades_disponibles || [];

  // Toggle skill selection
  const toggleSkill = (skillName) => {
    if (backgroundSkills.some(s => s.includes(skillName))) return; // Can't toggle background skills
    
    setSelectedSkills(prev => {
      if (prev.includes(skillName)) {
        return prev.filter(s => s !== skillName);
      }
      if (prev.length >= numToChoose) {
        // Replace the first one
        return [...prev.slice(1), skillName];
      }
      return [...prev, skillName];
    });
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      const allSkills = [...backgroundSkills, ...selectedSkills];
      const updatedDraft = await updateDraftStep6(draftId, {
        habilidades: allSkills,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 6:', err);
      setError('No se pudieron guardar las habilidades');
    } finally {
      setSaving(false);
    }
  };

  const isComplete = selectedSkills.length === numToChoose;

  return (
    <div className="space-y-8" data-testid="step-6-skills">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tus Habilidades
        </h2>
        <p className="text-muted-foreground">
          Selecciona {numToChoose} habilidades adicionales de tu ocupación
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">
                {draft?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
              <p className="text-sm text-muted-foreground">
                {draft?.cultura_nombre} · {draft?.vocacion_nombre}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Seleccionadas:</p>
            <p className={cn(
              'font-heading text-2xl',
              isComplete ? 'text-[hsl(var(--magic-blue))]' : 'text-[hsl(var(--gold))]'
            )}>
              {selectedSkills.length}/{numToChoose}
            </p>
          </div>
        </div>
      </div>

      {/* Background Skills (already granted) */}
      {backgroundSkills.length > 0 && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-3">
            Habilidades del Trasfondo (ya obtenidas)
          </h3>
          <div className="flex flex-wrap gap-2">
            {backgroundSkills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-2 rounded-lg bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills to Choose */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
          Elige de tu Ocupación ({draft?.vocacion_nombre})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {availableSkills.length > 0 
            ? `Disponibles: ${availableSkills.join(', ')}`
            : 'Puedes elegir cualquier habilidad'
          }
        </p>
        
        <ScrollArea className="h-[300px] pr-4">
          <div className="grid md:grid-cols-2 gap-3">
            {ALL_SKILLS.map((skill) => {
              const isFromBackground = backgroundSkills.some(s => s.includes(skill.name));
              const isSelected = selectedSkills.includes(skill.name);
              const isAvailable = availableSkills.length === 0 || 
                                  availableSkills.some(s => s.includes(skill.name));
              const modifier = draft?.atributos_finales?.[skill.attr] 
                ? Math.floor((draft.atributos_finales[skill.attr] - 10) / 2)
                : 0;

              return (
                <button
                  key={skill.name}
                  onClick={() => !isFromBackground && isAvailable && toggleSkill(skill.name)}
                  disabled={isFromBackground || !isAvailable}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    isFromBackground && 'bg-[hsl(var(--magic-blue))/10] border-[hsl(var(--magic-blue))/30] cursor-not-allowed',
                    isSelected && 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]',
                    !isFromBackground && !isSelected && isAvailable && 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]',
                    !isAvailable && !isFromBackground && 'opacity-40 cursor-not-allowed'
                  )}
                  data-testid={`skill-${skill.name}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(isFromBackground || isSelected) && (
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center',
                          isFromBackground ? 'bg-[hsl(var(--magic-blue))]' : 'bg-[hsl(var(--gold))]'
                        )}>
                          <Check className="w-3 h-3 text-background" />
                        </div>
                      )}
                      <span className={cn(
                        'font-medium',
                        (isFromBackground || isSelected) ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {skill.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {ATTR_ABBR[skill.attr]}
                      </span>
                      {(isFromBackground || isSelected) && (
                        <span className="text-xs text-[hsl(var(--gold))] ml-2">
                          +{2 + modifier}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          data-testid="step-6-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isComplete || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-6-next-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step6Skills;
