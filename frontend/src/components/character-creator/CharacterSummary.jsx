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

        {/* Personal Details - TWO Distinctive Traits with Descriptions */}
        {(draft.rasgo_distintivo || draft.rasgo_distintivo_2 || draft.motivacion) && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Rasgos de Personalidad
            </h3>
            <div className="space-y-3">
              {draft.rasgo_distintivo && (
                <div className="bg-secondary rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-[hsl(var(--gold))] mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-heading text-[hsl(var(--gold))]">
                        {typeof draft.rasgo_distintivo === 'object' 
                          ? draft.rasgo_distintivo.nombre 
                          : draft.rasgo_distintivo}
                      </p>
                      {typeof draft.rasgo_distintivo === 'object' && draft.rasgo_distintivo.descripcion && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {draft.rasgo_distintivo.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {(draft.rasgo_distintivo_2 || draft.defecto) && (
                <div className="bg-secondary rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-[hsl(var(--gold))] mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-heading text-[hsl(var(--gold))]">
                        {typeof (draft.rasgo_distintivo_2 || draft.defecto) === 'object' 
                          ? (draft.rasgo_distintivo_2 || draft.defecto).nombre 
                          : (draft.rasgo_distintivo_2 || draft.defecto)}
                      </p>
                      {typeof (draft.rasgo_distintivo_2 || draft.defecto) === 'object' && (draft.rasgo_distintivo_2 || draft.defecto).descripcion && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {(draft.rasgo_distintivo_2 || draft.defecto).descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {draft.motivacion && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Motivación</p>
                  <p className="text-sm text-foreground">{draft.motivacion}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Complete Equipment Summary with Weight and Encumbrance */}
        <div className="mt-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
            Equipo Completo
          </h3>
          
          {(() => {
            // Weight data for common items (in libras)
            const ITEM_WEIGHTS = {
              // Weapons
              'daga': 1, 'espada corta': 2, 'espada': 3, 'espada larga': 3, 'espada ancha': 3,
              'hacha': 4, 'hacha de batalla': 4, 'maza': 4, 'martillo': 2, 'lanza': 3,
              'arco': 2, 'arco corto': 2, 'arco largo': 2, 'honda': 0,
              // Armor
              'armadura de cuero': 10, 'coleto de cuero': 10, 'armadura ligera': 10,
              'cota de mallas': 40, 'armadura de mallas': 40, 'cota de escamas': 45,
              'armadura media': 25, 'armadura pesada': 65,
              'escudo': 6, 'escudo grande': 6, 'escudo pequeño': 4,
              // General equipment
              'mochila': 5, 'petate': 7, 'utensilios de cocina': 8, 'lata de yesca': 1,
              'raciones': 2, 'antorchas': 1, 'odre': 5, 'cuerda': 10, 'tienda': 20,
              'linterna': 2, 'aceite': 1,
              // Tools
              'herramientas de ladrón': 1, 'herramientas de herrero': 8, 'herramientas de carpintero': 6,
              'instrumentos musicales': 3,
            };
            
            // Helper to estimate weight
            const getItemWeight = (name) => {
              if (!name) return 0;
              const lowerName = name.toLowerCase();
              for (const [key, weight] of Object.entries(ITEM_WEIGHTS)) {
                if (lowerName.includes(key)) return weight;
              }
              return 1; // Default weight
            };
            
            // Collect all equipment
            const allEquipment = [];
            let totalWeight = 0;
            
            // Armor/Weapons from occupation selection
            const occupationItems = draft.equipo_ocupacion || [];
            occupationItems.forEach(item => {
              const name = typeof item === 'string' ? item : item.nombre;
              const weight = getItemWeight(name);
              allEquipment.push({ name, type: 'ocupacion', weight });
              totalWeight += weight;
            });
            
            // Tools from occupation
            const tools = draft.herramientas_elegidas_ocupacion || [];
            tools.forEach(tool => {
              const weight = getItemWeight(tool);
              allEquipment.push({ name: tool, type: 'herramienta', weight });
              totalWeight += weight;
            });
            
            // Inventory from lifestyle
            const inventory = draft.inventario || [];
            inventory.forEach(item => {
              const name = item.nombre || item;
              const qty = item.cantidad || 1;
              const weight = getItemWeight(name) * qty;
              allEquipment.push({ name: `${name}${qty > 1 ? ` (x${qty})` : ''}`, type: 'general', weight });
              totalWeight += weight;
            });
            
            // Background equipment
            const bgEquip = draft.equipo_trasfondo || [];
            bgEquip.forEach(item => {
              const name = typeof item === 'string' ? item : item.nombre;
              const weight = getItemWeight(name);
              allEquipment.push({ name, type: 'trasfondo', weight });
              totalWeight += weight;
            });
            
            // Calculate encumbrance
            const attrs = draft.caracteristicas || draft.atributos_finales || {};
            const fuerza = attrs.fuerza || 10;
            const capacidadCarga = fuerza * 15; // Normal carrying capacity
            const pesoEstorbo = fuerza * 5; // Encumbered threshold
            const pesoPesado = fuerza * 10; // Heavily encumbered threshold
            
            // Double capacity if culture has it
            const capacidadFinal = draft.capacidad_carga_x2 ? capacidadCarga * 2 : capacidadCarga;
            
            let estorboStatus = 'normal';
            let estorboColor = 'text-green-500';
            if (totalWeight > pesoPesado) {
              estorboStatus = 'Muy estorbado (-20 pies velocidad)';
              estorboColor = 'text-red-500';
            } else if (totalWeight > pesoEstorbo) {
              estorboStatus = 'Estorbado (-10 pies velocidad)';
              estorboColor = 'text-yellow-500';
            } else {
              estorboStatus = 'Sin estorbo';
            }
            
            return (
              <div className="space-y-3">
                {/* Weapons and Armor from Occupation */}
                {allEquipment.filter(e => e.type === 'ocupacion').length > 0 && (
                  <div className="bg-[hsl(var(--destructive))/10] rounded-lg p-3 border border-[hsl(var(--destructive))/30]">
                    <p className="text-xs text-[hsl(var(--destructive))] font-heading mb-2">⚔️ Armas y Armaduras</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allEquipment.filter(e => e.type === 'ocupacion').map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground">{item.weight} lb</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Tools */}
                {allEquipment.filter(e => e.type === 'herramienta').length > 0 && (
                  <div className="bg-[hsl(var(--torch-orange))/10] rounded-lg p-3 border border-[hsl(var(--torch-orange))/30]">
                    <p className="text-xs text-[hsl(var(--torch-orange))] font-heading mb-2">🔧 Herramientas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allEquipment.filter(e => e.type === 'herramienta').map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground">{item.weight} lb</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* General Equipment */}
                {allEquipment.filter(e => e.type === 'general' || e.type === 'trasfondo').length > 0 && (
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-heading mb-2">📦 Equipo General</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allEquipment.filter(e => e.type === 'general' || e.type === 'trasfondo').map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="text-muted-foreground">{item.weight} lb</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Money */}
                <div className="bg-[hsl(var(--gold))/10] rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--gold))]">💰 Dinero</span>
                  <span className="font-heading text-[hsl(var(--gold))]">
                    {draft.dinero?.mp || 0} mp · {draft.dinero?.mo || 0} mo · {draft.dinero?.mc || 0} mc
                  </span>
                </div>
                
                {/* Weight and Encumbrance */}
                <div className="bg-black/20 rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground font-heading">Peso Total</span>
                    <span className="text-lg font-heading text-[hsl(var(--gold))]">{totalWeight} lb</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 mb-2">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        totalWeight > pesoPesado ? 'bg-red-500' :
                        totalWeight > pesoEstorbo ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((totalWeight / capacidadFinal) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Estorbo: {pesoEstorbo} lb</span>
                    <span>Pesado: {pesoPesado} lb</span>
                    <span>Máx: {capacidadFinal} lb</span>
                  </div>
                  <p className={`text-center text-sm mt-2 font-medium ${estorboColor}`}>
                    {estorboStatus}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
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
