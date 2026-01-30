/**
 * Interactive Character Sheet - 3-page character sheet with image backgrounds
 * Uses the official LOTR RPG sheet images as backgrounds with editable overlay fields
 * Coordinates based on 1701x2197 pixel images
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, ChevronLeft, ChevronRight, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCharacter } from '@/services/api';
import api from '@/services/api';
import { cn } from '@/lib/utils';

// Sheet dimensions (based on PDF converted images 1701x2197)
const SHEET_WIDTH = 1701;
const SHEET_HEIGHT = 2197;

// Calculate modifier from attribute value
const getModifier = (value) => {
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

// Skill to attribute mapping
const SKILL_ATTRIBUTES = {
  'Acertijos': 'inteligencia',
  'Acrobacias': 'destreza',
  'Atletismo': 'fuerza',
  'Cazar': 'sabiduria',
  'Engaño': 'carisma',
  'Explorar': 'sabiduria',
  'Interpretación': 'carisma',
  'Intimidación': 'carisma',
  'Investigación': 'inteligencia',
  'Juego de manos': 'destreza',
  'Medicina': 'inteligencia',
  'Naturaleza': 'inteligencia',
  'Percepción': 'sabiduria',
  'Perspicacia': 'sabiduria',
  'Persuasión': 'carisma',
  'Saber antiguo': 'inteligencia',
  'Sigilo': 'destreza',
  'Trato con animales': 'sabiduria',
  'Viajar': 'sabiduria',
};

// Skills in order as they appear on the sheet
const SKILLS_ORDER = [
  'Acertijos', 'Acrobacias', 'Atletismo', 'Cazar', 'Engaño', 
  'Explorar', 'Interpretación', 'Intimidación', 'Investigación', 
  'Juego de manos', 'Medicina', 'Naturaleza', 'Percepción',
  'Perspicacia', 'Persuasión', 'Saber antiguo', 'Sigilo',
  'Trato con animales', 'Viajar'
];

// Skill Y positions (based on extracted coordinates, starting at 499 with ~18px spacing)
const SKILL_Y_POSITIONS = [
  499, 517, 535, 553, 571, 589, 607, 625, 643, 661, 
  679, 697, 715, 733, 751, 769, 787, 805, 823
];

// Field positioned absolutely on the sheet
const SheetField = ({ x, y, width, height, children, className, scale }) => (
  <div
    className={cn("absolute", className)}
    style={{
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: width ? `${width * scale}px` : 'auto',
      height: height ? `${height * scale}px` : 'auto',
    }}
  >
    {children}
  </div>
);

// Editable text field
const EditableField = ({ value, onChange, x, y, width, scale, fontSize = 14, align = 'left', className = '' }) => (
  <input
    type="text"
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    className={cn(
      "absolute bg-transparent border-none outline-none text-black font-medium",
      className
    )}
    style={{
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: `${width * scale}px`,
      fontSize: `${fontSize * scale}px`,
      textAlign: align,
    }}
  />
);

// Display-only text field
const DisplayField = ({ value, x, y, width, scale, fontSize = 14, align = 'center', className = '', bold = false }) => (
  <div
    className={cn(
      "absolute text-black",
      bold && "font-bold",
      className
    )}
    style={{
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: width ? `${width * scale}px` : 'auto',
      fontSize: `${fontSize * scale}px`,
      textAlign: align,
    }}
  >
    {value}
  </div>
);

const InteractiveCharacterSheet = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.6);
  const containerRef = useRef(null);

  // Editable fields state (for interactive editing during play)
  const [editableFields, setEditableFields] = useState({
    puntos_golpe_actual: 0,
    puntos_golpe_temp: 0,
    nivel_cansancio: 0,
    inspiracion: 0,
    sombra_puntuacion: 0,
    experiencia: 0,
    notas_historia: '',
    rasgos_distintivos: '',
  });

  // Load character data
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        setLoading(true);
        const data = await getCharacter(characterId);
        setCharacter(data);
        
        // Initialize editable fields from character data
        setEditableFields({
          puntos_golpe_actual: data.puntos_golpe_actual || data.puntos_golpe_max || 0,
          puntos_golpe_temp: data.puntos_golpe_temp || 0,
          nivel_cansancio: data.nivel_cansancio || 0,
          inspiracion: data.inspiracion || 0,
          sombra_puntuacion: data.sombra_puntuacion || data.puntos_sombra || 0,
          experiencia: data.experiencia || 0,
          notas_historia: data.notas_historia || '',
          rasgos_distintivos: data.rasgos_distintivos || '',
        });
      } catch (err) {
        console.error('Error loading character:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
  }, [characterId]);

  // Calculate skill modifier
  const getSkillModifier = (skillName) => {
    if (!character) return '+0';
    const attrs = character.caracteristicas || character.atributos_finales || {};
    const attrName = SKILL_ATTRIBUTES[skillName];
    const attrValue = attrs[attrName] || 10;
    const baseMod = Math.floor((attrValue - 10) / 2);
    
    const profBonus = character.bonificador_competencia || 2;
    const proficiencias = character.habilidades_competentes || [];
    const pericias = character.habilidades_pericias || [];
    
    let totalMod = baseMod;
    if (proficiencias.includes(skillName)) {
      totalMod += profBonus;
    }
    if (pericias.includes(skillName)) {
      totalMod += profBonus;
    }
    
    return totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
  };

  // Check if skill has proficiency
  const hasSkillProficiency = (skillName) => {
    if (!character) return false;
    const proficiencias = character.habilidades_competentes || [];
    return proficiencias.includes(skillName);
  };

  // Save editable fields
  const handleSave = async () => {
    try {
      setSaving(true);
      await api.patch(`/characters/${characterId}`, editableFields);
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle print/PDF
  const handlePrint = () => {
    window.print();
  };

  // Update editable field
  const updateField = (field, value) => {
    setEditableFields(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <p className="text-muted-foreground">Personaje no encontrado</p>
      </div>
    );
  }

  // Get attributes
  const attrs = character.caracteristicas || character.atributos_finales || {};
  const bonificadorCompetencia = character.bonificador_competencia || 2;

  return (
    <div className="min-h-screen bg-[#2a2a2a]" data-testid="interactive-sheet">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/70 backdrop-blur-sm sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/characters`)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="font-heading text-xl text-[hsl(var(--gold))]">
              {character.nombre}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Page navigation */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
                Página {currentPage} / 3
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(3, p + 1))}
                disabled={currentPage === 3}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
                className="h-7 w-7 p-0"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.min(1.2, s + 0.1))}
                className="h-7 w-7 p-0"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[hsl(var(--magic-blue))/50] hover:bg-[hsl(var(--magic-blue))/10]"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </header>

      {/* Sheet Container */}
      <div 
        ref={containerRef}
        className="flex justify-center py-8 overflow-auto print:py-0 print:overflow-visible"
      >
        <div 
          className="relative bg-white shadow-2xl print:shadow-none"
          style={{
            width: SHEET_WIDTH * scale,
            height: SHEET_HEIGHT * scale,
          }}
        >
          {/* Background Image */}
          <img
            src={`/assets/sheets/sheet_page${currentPage}_web.png`}
            alt={`Character Sheet Page ${currentPage}`}
            className="absolute inset-0 w-full h-full"
            draggable={false}
          />

          {/* Page 1 - Main Sheet */}
          {currentPage === 1 && (
            <>
              {/* === HEADER SECTION === */}
              {/* Character Name */}
              <DisplayField 
                value={character.nombre} 
                x={130} y={128} width={350} 
                scale={scale} fontSize={16} align="left" bold
              />
              
              {/* Occupation and Level */}
              <DisplayField 
                value={`${character.vocacion_nombre || ''} Nivel ${character.nivel || 1}`} 
                x={130} y={148} width={350} 
                scale={scale} fontSize={11} align="left"
              />
              
              {/* Culture */}
              <DisplayField 
                value={character.cultura_nombre} 
                x={130} y={210} width={200} 
                scale={scale} fontSize={12} align="left"
              />
              
              {/* Experience */}
              <DisplayField 
                value={editableFields.experiencia || 0} 
                x={1070} y={210} width={100} 
                scale={scale} fontSize={12} align="center"
              />

              {/* === ATTRIBUTES SECTION (Left column) === */}
              {/* Fuerza - Value in diamond, modifier below */}
              <DisplayField value={attrs.fuerza || 10} x={55} y={270} width={45} scale={scale} fontSize={18} align="center" bold />
              <DisplayField value={getModifier(attrs.fuerza || 10)} x={55} y={320} width={45} scale={scale} fontSize={14} align="center" bold />
              
              {/* Destreza */}
              <DisplayField value={attrs.destreza || 10} x={55} y={392} width={45} scale={scale} fontSize={18} align="center" bold />
              <DisplayField value={getModifier(attrs.destreza || 10)} x={55} y={442} width={45} scale={scale} fontSize={14} align="center" bold />
              
              {/* Constitución */}
              <DisplayField value={attrs.constitucion || 10} x={55} y={514} width={45} scale={scale} fontSize={18} align="center" bold />
              <DisplayField value={getModifier(attrs.constitucion || 10)} x={55} y={564} width={45} scale={scale} fontSize={14} align="center" bold />
              
              {/* Inteligencia */}
              <DisplayField value={attrs.inteligencia || 10} x={55} y={636} width={45} scale={scale} fontSize={18} align="center" bold />
              <DisplayField value={getModifier(attrs.inteligencia || 10)} x={55} y={686} width={45} scale={scale} fontSize={14} align="center" bold />
              
              {/* Sabiduría */}
              <DisplayField value={attrs.sabiduria || 10} x={55} y={758} width={45} scale={scale} fontSize={18} align="center" bold />
              <DisplayField value={getModifier(attrs.sabiduria || 10)} x={55} y={808} width={45} scale={scale} fontSize={14} align="center" bold />
              
              {/* Carisma */}
              <DisplayField value={attrs.carisma || 10} x={55} y={880} width={45} scale={scale} fontSize={18} align="center" bold />
              <DisplayField value={getModifier(attrs.carisma || 10)} x={55} y={930} width={45} scale={scale} fontSize={14} align="center" bold />

              {/* === INSPIRATION & PROFICIENCY === */}
              {/* Inspiración (first diamond in center section) */}
              <DisplayField value={editableFields.inspiracion || 0} x={192} y={270} width={35} scale={scale} fontSize={16} align="center" bold />
              
              {/* Proficiency Bonus (second diamond) */}
              <DisplayField value={`+${bonificadorCompetencia}`} x={192} y={355} width={35} scale={scale} fontSize={16} align="center" bold />

              {/* === SAVING THROWS === */}
              {['Fuerza', 'Destreza', 'Constitución', 'Inteligencia', 'Sabiduría', 'Carisma'].map((attr, index) => {
                const attrKey = attr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const yPos = 472 + (index * 24);
                const hasSaveProficiency = character.competencias?.tiradas_salvacion?.some(
                  t => t.toLowerCase() === attr.toLowerCase() || t.toLowerCase() === attrKey
                );
                const attrValue = attrs[attrKey] || attrs[attr.toLowerCase()] || 10;
                const saveMod = Math.floor((attrValue - 10) / 2) + (hasSaveProficiency ? bonificadorCompetencia : 0);
                
                return (
                  <div key={attr}>
                    {/* Proficiency circle */}
                    <div
                      className={cn(
                        "absolute rounded-full",
                        hasSaveProficiency ? "bg-black" : "border border-black/40"
                      )}
                      style={{
                        left: `${148 * scale}px`,
                        top: `${yPos * scale}px`,
                        width: `${8 * scale}px`,
                        height: `${8 * scale}px`,
                      }}
                    />
                    {/* Modifier */}
                    <DisplayField 
                      value={saveMod >= 0 ? `+${saveMod}` : saveMod} 
                      x={160} y={yPos - 4} width={25} 
                      scale={scale} fontSize={10} align="center"
                    />
                  </div>
                );
              })}

              {/* === COMBAT STATS === */}
              {/* Armor Class */}
              <DisplayField value={character.clase_armadura || 10} x={302} y={300} width={60} scale={scale} fontSize={20} align="center" bold />
              
              {/* Initiative */}
              <DisplayField value={getModifier(attrs.destreza || 10)} x={382} y={300} width={60} scale={scale} fontSize={18} align="center" bold />
              
              {/* Speed */}
              <DisplayField value={`${character.velocidad || 9}`} x={462} y={300} width={60} scale={scale} fontSize={18} align="center" bold />

              {/* === HIT POINTS === */}
              {/* Max HP */}
              <DisplayField value={character.puntos_golpe_max || 0} x={320} y={400} width={80} scale={scale} fontSize={12} align="center" />
              
              {/* Temp HP */}
              <DisplayField value={editableFields.puntos_golpe_temp || ''} x={430} y={445} width={60} scale={scale} fontSize={12} align="center" />
              
              {/* Current HP (large editable number in center) */}
              <input
                type="number"
                value={editableFields.puntos_golpe_actual}
                onChange={(e) => updateField('puntos_golpe_actual', parseInt(e.target.value) || 0)}
                className="absolute bg-transparent border-none outline-none text-black font-bold text-center"
                style={{
                  left: `${320 * scale}px`,
                  top: `${490 * scale}px`,
                  width: `${120 * scale}px`,
                  fontSize: `${28 * scale}px`,
                }}
              />

              {/* Hit Dice */}
              <DisplayField value={`${character.nivel || 1}${character.dado_golpe || 'd8'}`} x={302} y={600} width={80} scale={scale} fontSize={14} align="center" />

              {/* === SKILLS SECTION === */}
              {SKILLS_ORDER.map((skill, index) => {
                const yPos = 645 + (index * 26);
                const hasProficiency = hasSkillProficiency(skill);
                const modifier = getSkillModifier(skill);
                
                return (
                  <div key={skill}>
                    {/* Proficiency indicator (filled circle if proficient) */}
                    <div
                      className={cn(
                        "absolute rounded-full",
                        hasProficiency ? "bg-black" : "border border-black/40"
                      )}
                      style={{
                        left: `${148 * scale}px`,
                        top: `${yPos * scale}px`,
                        width: `${8 * scale}px`,
                        height: `${8 * scale}px`,
                      }}
                    />
                    {/* Modifier value */}
                    <DisplayField 
                      value={modifier} 
                      x={160} y={yPos - 4} width={25} 
                      scale={scale} fontSize={10} align="center"
                    />
                  </div>
                );
              })}

              {/* Passive Perception */}
              <DisplayField 
                value={10 + parseInt(getSkillModifier('Percepción'))} 
                x={148} y={1165} width={40} 
                scale={scale} fontSize={14} align="center" bold
              />

              {/* === SHADOW SECTION (Right side) === */}
              {/* Shadow Score */}
              <DisplayField 
                value={editableFields.sombra_puntuacion || 0} 
                x={570} y={445} width={40} 
                scale={scale} fontSize={18} align="center" bold
              />

            </>
          )}

          {/* Page 2 - Description & Equipment */}
          {currentPage === 2 && (
            <>
              {/* Age */}
              <DisplayField value={character.edad || '-'} x={190} y={95} width={80} scale={scale} fontSize={14} align="center" />
              
              {/* Height */}
              <DisplayField value={`${character.altura_cm || character.altura || '-'}`} x={340} y={95} width={80} scale={scale} fontSize={14} align="center" />
              
              {/* Weight */}
              <DisplayField value={`${character.peso_kg || character.peso || '-'}`} x={490} y={95} width={80} scale={scale} fontSize={14} align="center" />

              {/* Background Name */}
              <DisplayField value={character.trasfondo_nombre || '-'} x={100} y={320} width={300} scale={scale} fontSize={14} align="left" bold />

              {/* Personality Traits - Display area */}
              <div
                className="absolute text-black overflow-hidden"
                style={{
                  left: `${100 * scale}px`,
                  top: `${400 * scale}px`,
                  width: `${700 * scale}px`,
                  fontSize: `${11 * scale}px`,
                  lineHeight: 1.3,
                }}
              >
                {character.rasgos_personalidad?.slice(0, 4).map((rasgo, i) => (
                  <p key={i} className="mb-1">• {typeof rasgo === 'string' ? rasgo : rasgo.nombre}</p>
                ))}
              </div>

              {/* Equipment List */}
              <div
                className="absolute text-black overflow-hidden"
                style={{
                  left: `${900 * scale}px`,
                  top: `${300 * scale}px`,
                  width: `${700 * scale}px`,
                  fontSize: `${10 * scale}px`,
                  lineHeight: 1.2,
                }}
              >
                {character.equipo?.slice(0, 20).map((item, i) => (
                  <p key={i}>• {typeof item === 'string' ? item : item.nombre}</p>
                ))}
              </div>

              {/* Money */}
              <div
                className="absolute text-black"
                style={{
                  left: `${900 * scale}px`,
                  top: `${700 * scale}px`,
                  fontSize: `${12 * scale}px`,
                }}
              >
                {character.dinero && (
                  <>
                    <p>Oro: {character.dinero.mo || 0}</p>
                    <p>Plata: {character.dinero.mp || 0}</p>
                    <p>Cobre: {character.dinero.mc || 0}</p>
                  </>
                )}
              </div>
            </>
          )}

          {/* Page 3 - Story Notes */}
          {currentPage === 3 && (
            <>
              {/* Character Name */}
              <DisplayField value={character.nombre} x={500} y={95} width={600} scale={scale} fontSize={20} align="center" bold />

              {/* Story text area (editable) */}
              <textarea
                value={editableFields.notas_historia}
                onChange={(e) => updateField('notas_historia', e.target.value)}
                placeholder="Escribe la historia de tu personaje aquí..."
                className="absolute bg-transparent border-none outline-none resize-none text-black"
                style={{
                  left: `${100 * scale}px`,
                  top: `${200 * scale}px`,
                  width: `${1500 * scale}px`,
                  height: `${1900 * scale}px`,
                  fontSize: `${14 * scale}px`,
                  lineHeight: 1.6,
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Page indicators at bottom */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 print:hidden">
        {[1, 2, 3].map(page => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              currentPage === page 
                ? "bg-[hsl(var(--gold))] scale-125" 
                : "bg-muted-foreground/50 hover:bg-muted-foreground"
            )}
          />
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          header, .print\\:hidden { display: none !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default InteractiveCharacterSheet;
