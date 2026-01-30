/**
 * Character Summary - Final review before creation
 */
import { useState } from 'react';
import { Loader2, Edit2, Check, User, Sword, Shield, Heart, Star, Crown, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { downloadCharacterPDF } from '@/utils/characterPDF';

const getModifier = (score) => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const CharacterSummary = ({ draft, onFinalize, onEdit, loading }) => {
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true);
      await downloadCharacterPDF(draft);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (!draft) return null;

  // Use 'caracteristicas' or 'atributos_finales' (whichever exists)
  const attributes = draft.caracteristicas || draft.atributos_finales || {};

  return (
    <div className="space-y-8" data-testid="character-summary">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Resumen del Personaje
        </h2>
        <p className="text-muted-foreground">
          Revisa los detalles antes de finalizar la creación
        </p>
      </div>

      {/* Main Card */}
      <div className="card-parchment rounded-lg p-6">
        {/* Character Header */}
        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-border">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center border-2 border-[hsl(var(--gold))]">
            <span className="font-heading text-4xl text-[hsl(var(--gold))]">
              {draft.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="font-heading text-3xl text-foreground mb-1">
              {draft.nombre}
            </h1>
            <p className="text-lg text-muted-foreground">
              {draft.cultura_nombre} {draft.vocacion_nombre}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>{draft.edad} años</span>
              <span>{draft.altura_cm} cm</span>
              <span>{draft.peso_kg} kg</span>
            </div>
          </div>
        </div>

        {/* Attributes */}
        <div className="mb-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Atributos
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: 'fuerza', name: 'FUE' },
              { key: 'destreza', name: 'DES' },
              { key: 'constitucion', name: 'CON' },
              { key: 'inteligencia', name: 'INT' },
              { key: 'sabiduria', name: 'SAB' },
              { key: 'carisma', name: 'CAR' },
            ].map(attr => (
              <div key={attr.key} className="stat-box p-3 text-center">
                <p className="text-xs text-muted-foreground">{attr.name}</p>
                <p className="stat-value text-xl">{attributes[attr.key] || 10}</p>
                <p className="text-xs text-muted-foreground">
                  ({getModifier(attributes[attr.key] || 10)})
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Combat Stats */}
        <div className="mb-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <Sword className="w-5 h-5" />
            Combate
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-box p-3 text-center">
              <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
              <p className="text-xs text-muted-foreground">Puntos de Golpe</p>
              <p className="stat-value">{draft.puntos_golpe_max || 8}</p>
            </div>
            <div className="stat-box p-3 text-center">
              <Shield className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--magic-blue))]" />
              <p className="text-xs text-muted-foreground">Clase de Armadura</p>
              <p className="stat-value">
                {10 + Math.floor(((attributes.destreza || 10) - 10) / 2)}
              </p>
            </div>
            <div className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">Dado de Golpe</p>
              <p className="stat-value text-lg">{draft.dado_golpe || '1d8'}</p>
            </div>
            <div className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">Velocidad</p>
              <p className="stat-value text-lg">{draft.velocidad || 9}m</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Background & Virtue */}
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Trasfondo y Virtud
            </h3>
            <div className="space-y-3">
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Trasfondo</p>
                <p className="text-foreground">{draft.trasfondo_nombre}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Virtud</p>
                <p className="text-foreground">{draft.virtud_nombre}</p>
                {draft.rasgos_virtud && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {draft.rasgos_virtud.substring(0, 100)}...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Skills - Show ALL 19 skills with scores */}
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Habilidades
            </h3>
            {(() => {
              // All 19 skills in the game with their attribute
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
              
              // Collect all competent skills
              const competentSkillsRaw = [
                ...(draft.competencias_habilidades_cultura || []),
                ...(draft.competencia_habilidad_cultura ? [draft.competencia_habilidad_cultura] : []),
                ...(draft.competencias_herramientas_2 || []),
                ...(draft.competencias_trasfondo?.habilidades || []),
                ...(draft.competencias_habilidades_trasfondo || []),
                ...(draft.habilidades_elegidas_ocupacion || []),
                ...(draft.habilidades_competencia || []),
              ];
              const cleanSkill = (s) => s?.split(' (')[0]?.trim()?.toLowerCase();
              const competentSkills = new Set(competentSkillsRaw.map(cleanSkill).filter(Boolean));
              
              // Expertise skills
              const expertiseSkillsRaw = draft.pericia_elegida || [];
              const expertiseSkills = new Set(expertiseSkillsRaw.map(cleanSkill).filter(Boolean));
              
              // Get attributes and level
              const attrs = draft.caracteristicas || draft.atributos_finales || {};
              const nivel = draft.nivel || 1;
              // Proficiency bonus by level: 1-4 = +2, 5-8 = +3, 9-12 = +4, 13-16 = +5, 17-20 = +6
              const profBonus = Math.ceil(nivel / 4) + 1;
              
              return (
                <div className="bg-secondary rounded-lg p-4">
                  <div className="text-xs text-muted-foreground text-center mb-2">
                    Nivel {nivel} · Bonificador de Competencia: +{profBonus}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ALL_SKILLS.map((skill) => {
                      const attrValue = attrs[skill.atributo] || 10;
                      const attrMod = Math.floor((attrValue - 10) / 2);
                      const isCompetent = competentSkills.has(skill.nombre.toLowerCase());
                      const hasExpertise = expertiseSkills.has(skill.nombre.toLowerCase());
                      
                      let totalMod = attrMod;
                      if (isCompetent) totalMod += profBonus;
                      if (hasExpertise) totalMod += profBonus; // Double proficiency
                      
                      return (
                        <div 
                          key={skill.nombre}
                          className={`p-2 rounded flex justify-between items-center ${
                            hasExpertise 
                              ? 'bg-[hsl(var(--magic-blue))/20] border border-[hsl(var(--magic-blue))]'
                              : isCompetent 
                                ? 'bg-[hsl(var(--gold))/20] border border-[hsl(var(--gold))]'
                                : 'bg-black/10'
                          }`}
                        >
                          <span className={`text-sm ${isCompetent ? 'font-medium' : 'text-muted-foreground'}`}>
                            {hasExpertise && <Star className="w-3 h-3 inline mr-1 text-[hsl(var(--magic-blue))]" />}
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
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground justify-center">
                    <span><span className="inline-block w-3 h-3 rounded bg-[hsl(var(--gold))/20] border border-[hsl(var(--gold))] mr-1"></span> Competencia (+{profBonus})</span>
                    <span><span className="inline-block w-3 h-3 rounded bg-[hsl(var(--magic-blue))/20] border border-[hsl(var(--magic-blue))] mr-1"></span> Pericia (+{profBonus * 2})</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Patron */}
        {draft.patron_nombre && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Mecenas
            </h3>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-foreground">{draft.patron_nombre}</p>
              <p className="text-sm text-muted-foreground">
                Puntos de Comunidad: {draft.puntos_comunidad || 0}
              </p>
            </div>
          </div>
        )}

        {/* Personal Details - TWO Distinctive Traits */}
        {(draft.rasgo_distintivo || draft.rasgo_distintivo_2 || draft.motivacion) && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Rasgos de Personalidad
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {draft.rasgo_distintivo && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-[hsl(var(--gold))] font-heading mb-1">Rasgo Distintivo 1</p>
                  <p className="text-sm text-foreground">{draft.rasgo_distintivo}</p>
                </div>
              )}
              {draft.rasgo_distintivo_2 && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-[hsl(var(--gold))] font-heading mb-1">Rasgo Distintivo 2</p>
                  <p className="text-sm text-foreground">{draft.rasgo_distintivo_2}</p>
                </div>
              )}
              {draft.motivacion && (
                <div className="bg-secondary rounded-lg p-3 md:col-span-2">
                  <p className="text-xs text-muted-foreground">Motivación</p>
                  <p className="text-sm text-foreground">{draft.motivacion}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Equipment Summary */}
        {(draft.inventario?.length > 0 || draft.equipo_ocupacion?.length > 0 || draft.armadura_elegida || draft.herramientas_elegidas_ocupacion?.length > 0 || (draft.dinero?.mp > 0 || draft.dinero?.mo > 0)) && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Equipo
            </h3>
            
            {/* Occupation Equipment (weapons, armor, tools) */}
            {(draft.equipo_ocupacion?.length > 0 || draft.herramientas_elegidas_ocupacion?.length > 0) && (
              <div className="bg-[hsl(var(--magic-blue))/10] rounded-lg p-3 mb-3">
                <p className="text-xs text-[hsl(var(--magic-blue))] font-heading mb-2">Equipo de {draft.vocacion_nombre}</p>
                <div className="flex flex-wrap gap-2">
                  {draft.equipo_ocupacion?.map((item, i) => (
                    <span key={`occ-${i}`} className="text-sm px-2 py-1 rounded bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))]">
                      {typeof item === 'string' ? item : item.nombre}
                    </span>
                  ))}
                  {draft.herramientas_elegidas_ocupacion?.map((tool, i) => (
                    <span key={`tool-${i}`} className="text-sm px-2 py-1 rounded bg-secondary text-muted-foreground">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* General inventory */}
            <div className="bg-secondary rounded-lg p-3">
              {draft.inventario?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {draft.inventario.map((item, i) => (
                    <span key={i} className="text-sm text-muted-foreground">
                      {item.nombre}
                      {i < draft.inventario.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-4 text-sm">
                {draft.dinero?.mp > 0 && <span>{draft.dinero.mp} mp</span>}
                {draft.dinero?.mo > 0 && <span>{draft.dinero.mo} mo</span>}
                {draft.dinero?.mc > 0 && <span>{draft.dinero.mc} mc</span>}
                {(!draft.dinero?.mp && !draft.dinero?.mo && !draft.dinero?.mc) && <span className="text-muted-foreground">Sin monedas</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 flex-wrap">
        <Button
          variant="outline"
          onClick={onEdit}
          className="border-border hover:bg-secondary"
          data-testid="edit-character-btn"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadPDF}
          disabled={generatingPDF}
          className="border-[hsl(var(--magic-blue))] text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))/10]"
          data-testid="download-pdf-btn"
        >
          {generatingPDF ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          Descargar PDF (3 hojas)
        </Button>
        <Button
          onClick={onFinalize}
          disabled={loading}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="finalize-character-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Crear Personaje
        </Button>
      </div>
    </div>
  );
};

export default CharacterSummary;
