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
                    {typeof draft.rasgos_virtud === 'string' 
                      ? draft.rasgos_virtud.substring(0, 100) 
                      : JSON.stringify(draft.rasgos_virtud).substring(0, 100)}...
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
            // CORRECT Weight data from Excel (in kg)
            const ITEM_WEIGHTS = {
              // Weapons (from Excel Equipo sheet)
              'daga': 0.45,
              'espada corta': 0.9, 'espada': 0.9,
              'espada larga': 1.35, 'espada ancha': 1.35,
              'hacha de mano': 0.9, 'hacha': 0.9,
              'hacha de guerra': 1.8, 'hacha a dos manos': 3.5, 'gran hacha': 3.15,
              'maza': 1.8, 'martillo': 1.35, 'martillo pesado': 1.8,
              'lanza': 1.35, 'lanza corta': 0.9, 'lanza pesada': 2.7,
              'arco': 0.9, 'arco corto': 0.9, 'arco largo': 1.35,
              'ballesta': 4.5, 'honda': 0,
              'cimitarra': 1.2, 'estoque': 1, 'flajelo': 1.5, 'látigo': 1,
              'piqueta': 4.5,
              // Armor (from Excel)
              'coleto de cuero': 3.6, 'armadura de cuero': 3.6,
              'jubón reforzado': 4.5, 'pieles': 5.4,
              'camisote de mallas': 9,
              'armadura de escamas': 18,
              'cota de anillas': 22.5,
              'cota de mallas': 24.75,
              'loriga de mallas': 27,
              'escudo': 2.7, 'escudo grande': 2.7, 'escudo pequeño': 1.8,
              // General equipment (kg)
              'mochila': 2.25, 'petate': 3.15, 'utensilios de cocina': 3.6, 'útiles de cocina': 3.6,
              'lata de yesca': 0.45,
              'raciones': 0.6, 'raciones (1 día)': 0.6, // Updated as requested
              'antorchas': 0.45, 'odre': 2.25, 
              'cuerda de cáñamo': 4.5, 'cuerda de seda': 2.25, 'cuerda': 4.5,
              'tienda': 9, 'tienda para 2 personas': 9,
              'linterna': 0.9, 'linterna sorda': 0.9, 'aceite': 0.45,
              // Clothing
              'botas de viaje': 1, 'botas de buena piel': 1.2, 'botas de cuero': 1,
              'capa de viaje': 1, 'muda común': 1.5, 'muda de viajero': 2, 'muda fina': 1.8,
              // Tools (kg)
              'herramientas de ladrón': 0.45, 'herramientas de herrero': 3.6, 
              'herramientas de carpintero': 2.7, 'herramientas de curtidor': 2.25,
              'herramientas de alfarero': 1.35, 'herramientas de joyero': 0.9,
              'instrumentos musicales': 1.35,
            };
            
            // Size multiplier for weight (Small = half, Large = double)
            const tamanio = draft.tamanio || 'Mediano';
            const sizeMultiplier = tamanio === 'Pequeño' ? 0.5 : (tamanio === 'Grande' ? 2 : 1);
            
            // Helper to get weight with size adjustment for armor/clothing
            const getItemWeight = (name, isArmorOrClothing = false) => {
              if (!name) return 0;
              const lowerName = name.toLowerCase();
              for (const [key, weight] of Object.entries(ITEM_WEIGHTS)) {
                if (lowerName.includes(key)) {
                  // Apply size multiplier only for armor and clothing
                  return isArmorOrClothing ? weight * sizeMultiplier : weight;
                }
              }
              return 0.25; // Default weight
            };
            
            // Check if item is armor or clothing
            const isArmorOrClothing = (name) => {
              if (!name) return false;
              const lower = name.toLowerCase();
              return lower.includes('armadura') || lower.includes('coleto') || lower.includes('cota') ||
                     lower.includes('escudo') || lower.includes('pieles') || lower.includes('camisote') ||
                     lower.includes('botas') || lower.includes('capa') || lower.includes('muda') ||
                     lower.includes('jubón') || lower.includes('loriga');
            };
            
            // Collect all equipment
            const allEquipment = [];
            let totalWeight = 0;
            
            // Armor/Weapons from occupation selection
            const occupationItems = draft.equipo_ocupacion || [];
            occupationItems.forEach(item => {
              const name = typeof item === 'string' ? item : (item?.nombre || '');
              const weight = getItemWeight(name, isArmorOrClothing(name));
              if (name) {
                allEquipment.push({ name, type: 'ocupacion', weight });
                totalWeight += weight;
              }
            });
            
            // Tools from occupation
            const tools = draft.herramientas_elegidas_ocupacion || [];
            tools.forEach(tool => {
              const name = typeof tool === 'string' ? tool : '';
              const weight = getItemWeight(name, false);
              if (name) {
                allEquipment.push({ name, type: 'herramienta', weight });
                totalWeight += weight;
              }
            });
            
            // Inventory from lifestyle
            const inventory = draft.inventario || [];
            inventory.forEach(item => {
              const name = typeof item === 'string' ? item : (item?.nombre || '');
              const qty = item?.cantidad || 1;
              const weight = getItemWeight(name, isArmorOrClothing(name)) * qty;
              if (name) {
                allEquipment.push({ name: `${name}${qty > 1 ? ` (x${qty})` : ''}`, type: 'general', weight });
                totalWeight += weight;
              }
            });
            
            // Background equipment
            const bgEquip = draft.equipo_trasfondo || [];
            bgEquip.forEach(item => {
              const name = typeof item === 'string' ? item : (item?.nombre || '');
              const weight = getItemWeight(name, isArmorOrClothing(name));
              if (name) {
                allEquipment.push({ name, type: 'trasfondo', weight });
                totalWeight += weight;
              }
            });
            
            // Calculate coin weight (0.9 grams = 0.0009 kg per coin)
            const COIN_WEIGHT_KG = 0.0009;
            const totalCoins = (draft.dinero?.mp || 0) + (draft.dinero?.mo || 0) + 
                              (draft.dinero?.mc || 0) + (draft.dinero?.me || 0);
            const coinWeight = totalCoins * COIN_WEIGHT_KG;
            totalWeight += coinWeight;
            
            // ENCUMBRANCE RULES (metric system) - Updated rules
            const attrs = draft.caracteristicas || draft.atributos_finales || {};
            const fuerza = attrs.fuerza || 10;
            
            // Base values for Medium creatures
            let capacidadCarga = fuerza * 10;         // Max carrying capacity: FUE × 10 kg
            let capacidadEmpujar = fuerza * 15;       // Push/drag/lift capacity: FUE × 15 kg
            let pesoCargado = fuerza * 5;             // Encumbered threshold: > FUE × 5 kg
            let pesoMuyCargado = fuerza * 10;         // Heavily encumbered threshold: > FUE × 10 kg
            
            // Size adjustments (×1.5 for Large, ÷1.5 for Small)
            if (tamanio === 'Grande') {
              capacidadCarga *= 1.5;
              capacidadEmpujar *= 1.5;
              pesoCargado *= 1.5;
              pesoMuyCargado *= 1.5;
            } else if (tamanio === 'Pequeño') {
              capacidadCarga /= 1.5;
              capacidadEmpujar /= 1.5;
              pesoCargado /= 1.5;
              pesoMuyCargado /= 1.5;
            }
            
            // Double capacity if culture has it (e.g., Hobbits)
            if (draft.capacidad_carga_x2) {
              capacidadCarga *= 2;
              capacidadEmpujar *= 2;
            }
            
            let estorboStatus = '';
            let estorboColor = 'text-green-500';
            let estorboPenalties = [];
            
            if (totalWeight > pesoMuyCargado) {
              estorboStatus = 'Muy Cargado';
              estorboColor = 'text-red-500';
              estorboPenalties = [
                '−6 m velocidad',
                'Desventaja en ataques',
                'Desventaja en salvaciones',
                'Desventaja en pruebas de FUE/DES/CON'
              ];
            } else if (totalWeight > pesoCargado) {
              estorboStatus = 'Cargado';
              estorboColor = 'text-yellow-500';
              estorboPenalties = [
                '−3 m velocidad',
                'Desventaja en Atletismo',
                'Desventaja en Acrobacias',
                'Desventaja en salvaciones vs fatiga'
              ];
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
                          <span className="text-muted-foreground">{item.weight.toFixed(2)} kg</span>
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
                          <span className="text-muted-foreground">{item.weight.toFixed(2)} kg</span>
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
                          <span className="text-muted-foreground">{item.weight.toFixed(2)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Money */}
                <div className="bg-[hsl(var(--gold))/10] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--gold))]">💰 Dinero</span>
                    <span className="font-heading text-[hsl(var(--gold))]">
                      {draft.dinero?.mp || 0} mp · {draft.dinero?.mo || 0} mo · {draft.dinero?.me || 0} me · {draft.dinero?.mc || 0} mc
                    </span>
                  </div>
                  {totalCoins > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Peso monedas: {(coinWeight * 1000).toFixed(1)} g ({coinWeight.toFixed(3)} kg)
                    </p>
                  )}
                </div>
                
                {/* Weight and Encumbrance */}
                <div className="bg-black/20 rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground font-heading">Peso Total</span>
                    <span className="text-lg font-heading text-[hsl(var(--gold))]">{totalWeight.toFixed(2)} kg</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-secondary rounded-full h-3 mb-2 relative">
                    {/* Cargado marker */}
                    <div 
                      className="absolute h-3 w-0.5 bg-yellow-500 z-10"
                      style={{ left: `${Math.min((pesoCargado / capacidadCarga) * 100, 100)}%` }}
                    />
                    {/* Muy Cargado marker */}
                    <div 
                      className="absolute h-3 w-0.5 bg-red-500 z-10"
                      style={{ left: `${Math.min((pesoMuyCargado / capacidadCarga) * 100, 100)}%` }}
                    />
                    {/* Current weight */}
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        totalWeight > pesoMuyCargado ? 'bg-red-500' :
                        totalWeight > pesoCargado ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((totalWeight / capacidadCarga) * 100, 100)}%` }}
                    />
                  </div>
                  
                  {/* Thresholds */}
                  <div className="grid grid-cols-3 text-xs text-muted-foreground mb-2">
                    <span>Cargado: {pesoCargado.toFixed(1)} kg</span>
                    <span className="text-center">Muy Cargado: {pesoMuyCargado.toFixed(1)} kg</span>
                    <span className="text-right">Máx: {capacidadCarga.toFixed(1)} kg</span>
                  </div>
                  
                  {/* Status */}
                  <div className={`text-center p-2 rounded ${estorboColor} bg-black/30`}>
                    <p className="font-heading">{estorboStatus}</p>
                    {estorboPenalties.length > 0 && (
                      <div className="text-xs mt-1 space-y-0.5">
                        {estorboPenalties.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Size note */}
                  {tamanio !== 'Mediano' && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Tamaño {tamanio}: capacidades {tamanio === 'Pequeño' ? '÷1.5' : '×1.5'}
                    </p>
                  )}
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
