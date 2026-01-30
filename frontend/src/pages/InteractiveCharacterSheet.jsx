/**
 * Interactive Character Sheet - 3-page character sheet with image backgrounds
 * Uses the official LOTR RPG sheet images as backgrounds with editable overlay fields
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Save, Loader2, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCharacter } from '@/services/api';
import api from '@/services/api';
import { cn } from '@/lib/utils';

// Sheet dimensions (based on images 2000x2744 and 2000x2584)
const SHEET_WIDTH = 2000;
const SHEET_HEIGHT_1_2 = 2744;
const SHEET_HEIGHT_3 = 2584;

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

const SKILLS_ORDER = [
  'Acertijos', 'Acrobacias', 'Atletismo', 'Cazar', 'Engaño', 
  'Explorar', 'Interpretación', 'Intimidación', 'Investigación', 
  'Juego de manos', 'Medicina', 'Naturaleza', 'Percepción',
  'Perspicacia', 'Persuasión', 'Saber antiguo', 'Sigilo',
  'Trato con animales', 'Viajar'
];

const InteractiveCharacterSheet = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.5);
  const containerRef = useRef(null);

  // Editable fields state (for interactive editing during play)
  const [editableFields, setEditableFields] = useState({
    puntos_golpe_actual: 0,
    puntos_golpe_temp: 0,
    nivel_cansancio: 0,
    inspiracion: false,
    sombra_puntuacion: 0,
    experiencia: 0,
    monedas: { oro: 0, plata: 0, cobre: 0, estano: 0, mithril: 0 },
    notas_historia: '',
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
          inspiracion: data.inspiracion || false,
          sombra_puntuacion: data.sombra_puntuacion || 0,
          experiencia: data.experiencia || 0,
          monedas: data.monedas || data.dinero || { oro: 0, plata: 0, cobre: 0, estano: 0, mithril: 0 },
          notas_historia: data.notas_historia || '',
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
    
    // Check for proficiency
    const profBonus = character.bonificador_competencia || 2;
    const proficiencias = character.habilidades_competentes || [];
    const pericias = character.habilidades_pericias || [];
    
    let totalMod = baseMod;
    if (proficiencias.includes(skillName)) {
      totalMod += profBonus;
    }
    if (pericias.includes(skillName)) {
      totalMod += profBonus; // Expertise doubles proficiency
    }
    
    return totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
  };

  // Check if skill has proficiency
  const hasSkillProficiency = (skillName) => {
    if (!character) return false;
    const proficiencias = character.habilidades_competentes || [];
    return proficiencias.includes(skillName);
  };

  // Check if skill has expertise
  const hasSkillExpertise = (skillName) => {
    if (!character) return false;
    const pericias = character.habilidades_pericias || [];
    return pericias.includes(skillName);
  };

  // Save editable fields
  const handleSave = async () => {
    try {
      setSaving(true);
      await api.patch(`/characters/${characterId}`, editableFields);
      // Show success somehow
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
    <div className="min-h-screen bg-[#1a1a1a]" data-testid="interactive-sheet">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/50 backdrop-blur-sm sticky top-0 z-50 print:hidden">
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
          
          <div className="flex items-center gap-2">
            {/* Page navigation */}
            <div className="flex items-center gap-1 mr-4 bg-secondary rounded-lg px-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Página {currentPage} / 3
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(3, p + 1))}
                disabled={currentPage === 3}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.max(0.25, s - 0.1))}
              >
                -
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale(s => Math.min(1, s + 0.1))}
              >
                +
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="border-[hsl(var(--gold))/50]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[hsl(var(--magic-blue))/50]"
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
        className="flex justify-center py-8 overflow-auto print:py-0"
      >
        <div 
          className="relative bg-white shadow-2xl print:shadow-none"
          style={{
            width: SHEET_WIDTH * scale,
            height: (currentPage === 3 ? SHEET_HEIGHT_3 : SHEET_HEIGHT_1_2) * scale,
            transform: `scale(1)`,
            transformOrigin: 'top center',
          }}
        >
          {/* Background Image */}
          <img
            src={`/assets/sheets/sheet_page${currentPage}_web.png`}
            alt={`Character Sheet Page ${currentPage}`}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ imageRendering: 'auto' }}
          />

          {/* Page 1 - Main Sheet Overlay Fields */}
          {currentPage === 1 && (
            <div 
              className="absolute inset-0"
              style={{ fontSize: `${14 * scale}px` }}
            >
              {/* Character Name - Top left header area */}
              <div 
                className="absolute font-bold text-black"
                style={{ 
                  left: `${180 * scale}px`, 
                  top: `${140 * scale}px`,
                  fontSize: `${24 * scale}px`,
                }}
              >
                {character.nombre}
              </div>

              {/* Occupation and Level */}
              <div 
                className="absolute text-black"
                style={{ 
                  left: `${180 * scale}px`, 
                  top: `${200 * scale}px`,
                  fontSize: `${16 * scale}px`,
                }}
              >
                {character.vocacion_nombre} Nivel {character.nivel || 1}
              </div>

              {/* Culture */}
              <div 
                className="absolute text-black"
                style={{ 
                  left: `${850 * scale}px`, 
                  top: `${200 * scale}px`,
                  fontSize: `${16 * scale}px`,
                }}
              >
                {character.cultura_nombre}
              </div>

              {/* ATTRIBUTES - Left column */}
              {/* Fuerza */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ left: `${85 * scale}px`, top: `${430 * scale}px`, width: `${80 * scale}px` }}
              >
                <div style={{ fontSize: `${28 * scale}px` }}>{attrs.fuerza || 10}</div>
                <div style={{ fontSize: `${18 * scale}px`, marginTop: `${5 * scale}px` }}>
                  {getModifier(attrs.fuerza || 10)}
                </div>
              </div>

              {/* Destreza */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ left: `${85 * scale}px`, top: `${640 * scale}px`, width: `${80 * scale}px` }}
              >
                <div style={{ fontSize: `${28 * scale}px` }}>{attrs.destreza || 10}</div>
                <div style={{ fontSize: `${18 * scale}px`, marginTop: `${5 * scale}px` }}>
                  {getModifier(attrs.destreza || 10)}
                </div>
              </div>

              {/* Constitución */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ left: `${85 * scale}px`, top: `${850 * scale}px`, width: `${80 * scale}px` }}
              >
                <div style={{ fontSize: `${28 * scale}px` }}>{attrs.constitucion || 10}</div>
                <div style={{ fontSize: `${18 * scale}px`, marginTop: `${5 * scale}px` }}>
                  {getModifier(attrs.constitucion || 10)}
                </div>
              </div>

              {/* Inteligencia */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ left: `${85 * scale}px`, top: `${1060 * scale}px`, width: `${80 * scale}px` }}
              >
                <div style={{ fontSize: `${28 * scale}px` }}>{attrs.inteligencia || 10}</div>
                <div style={{ fontSize: `${18 * scale}px`, marginTop: `${5 * scale}px` }}>
                  {getModifier(attrs.inteligencia || 10)}
                </div>
              </div>

              {/* Sabiduría */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ left: `${85 * scale}px`, top: `${1270 * scale}px`, width: `${80 * scale}px` }}
              >
                <div style={{ fontSize: `${28 * scale}px` }}>{attrs.sabiduria || 10}</div>
                <div style={{ fontSize: `${18 * scale}px`, marginTop: `${5 * scale}px` }}>
                  {getModifier(attrs.sabiduria || 10)}
                </div>
              </div>

              {/* Carisma */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ left: `${85 * scale}px`, top: `${1480 * scale}px`, width: `${80 * scale}px` }}
              >
                <div style={{ fontSize: `${28 * scale}px` }}>{attrs.carisma || 10}</div>
                <div style={{ fontSize: `${18 * scale}px`, marginTop: `${5 * scale}px` }}>
                  {getModifier(attrs.carisma || 10)}
                </div>
              </div>

              {/* Proficiency Bonus */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${330 * scale}px`, 
                  top: `${530 * scale}px`,
                  fontSize: `${24 * scale}px`,
                }}
              >
                +{bonificadorCompetencia}
              </div>

              {/* Armor Class */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${455 * scale}px`, 
                  top: `${720 * scale}px`,
                  fontSize: `${28 * scale}px`,
                  width: `${100 * scale}px`,
                }}
              >
                {character.clase_armadura || 10}
              </div>

              {/* Initiative */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${595 * scale}px`, 
                  top: `${720 * scale}px`,
                  fontSize: `${24 * scale}px`,
                  width: `${100 * scale}px`,
                }}
              >
                {getModifier(attrs.destreza || 10)}
              </div>

              {/* Speed */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${730 * scale}px`, 
                  top: `${720 * scale}px`,
                  fontSize: `${24 * scale}px`,
                  width: `${100 * scale}px`,
                }}
              >
                {character.velocidad || 9}m
              </div>

              {/* Max HP */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${550 * scale}px`, 
                  top: `${855 * scale}px`,
                  fontSize: `${20 * scale}px`,
                }}
              >
                {character.puntos_golpe_max || 0}
              </div>

              {/* Current HP (editable) */}
              <input
                type="number"
                value={editableFields.puntos_golpe_actual}
                onChange={(e) => setEditableFields(prev => ({ ...prev, puntos_golpe_actual: parseInt(e.target.value) || 0 }))}
                className="absolute text-center font-bold bg-transparent border-none outline-none text-black"
                style={{ 
                  left: `${480 * scale}px`, 
                  top: `${950 * scale}px`,
                  width: `${200 * scale}px`,
                  fontSize: `${32 * scale}px`,
                }}
              />

              {/* Hit Dice */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${470 * scale}px`, 
                  top: `${1195 * scale}px`,
                  fontSize: `${18 * scale}px`,
                }}
              >
                {character.nivel || 1}{character.dado_golpe || 'd8'}
              </div>

              {/* SKILLS - Center column */}
              {SKILLS_ORDER.map((skill, index) => {
                const yOffset = 430 + (index * 52);
                return (
                  <div 
                    key={skill}
                    className="absolute flex items-center text-black"
                    style={{ 
                      left: `${245 * scale}px`, 
                      top: `${yOffset * scale}px`,
                      fontSize: `${14 * scale}px`,
                    }}
                  >
                    {/* Proficiency checkbox indicator */}
                    <div 
                      className={cn(
                        "rounded-full mr-1",
                        hasSkillProficiency(skill) ? "bg-black" : "bg-transparent border border-black"
                      )}
                      style={{ 
                        width: `${12 * scale}px`, 
                        height: `${12 * scale}px`,
                      }}
                    />
                    {/* Expertise indicator */}
                    {hasSkillExpertise(skill) && (
                      <div 
                        className="bg-black rounded-full mr-1"
                        style={{ 
                          width: `${12 * scale}px`, 
                          height: `${12 * scale}px`,
                        }}
                      />
                    )}
                    {/* Modifier */}
                    <span className="font-bold" style={{ width: `${35 * scale}px` }}>
                      {getSkillModifier(skill)}
                    </span>
                  </div>
                );
              })}

              {/* Passive Perception */}
              <div 
                className="absolute text-center font-bold text-black"
                style={{ 
                  left: `${140 * scale}px`, 
                  top: `${1725 * scale}px`,
                  fontSize: `${20 * scale}px`,
                }}
              >
                {10 + parseInt(getSkillModifier('Percepción'))}
              </div>

            </div>
          )}

          {/* Page 2 - Description & Community */}
          {currentPage === 2 && (
            <div 
              className="absolute inset-0"
              style={{ fontSize: `${14 * scale}px` }}
            >
              {/* Age */}
              <div 
                className="absolute text-black"
                style={{ left: `${250 * scale}px`, top: `${170 * scale}px`, fontSize: `${16 * scale}px` }}
              >
                {character.edad || '-'}
              </div>

              {/* Height */}
              <div 
                className="absolute text-black"
                style={{ left: `${470 * scale}px`, top: `${170 * scale}px`, fontSize: `${16 * scale}px` }}
              >
                {character.altura || '-'} cm
              </div>

              {/* Weight */}
              <div 
                className="absolute text-black"
                style={{ left: `${700 * scale}px`, top: `${170 * scale}px`, fontSize: `${16 * scale}px` }}
              >
                {character.peso || '-'} kg
              </div>

              {/* Background */}
              <div 
                className="absolute text-black"
                style={{ 
                  left: `${100 * scale}px`, 
                  top: `${650 * scale}px`, 
                  width: `${400 * scale}px`,
                  fontSize: `${14 * scale}px`,
                  lineHeight: 1.4,
                }}
              >
                <p className="font-bold mb-1">{character.trasfondo_nombre}</p>
              </div>

              {/* Personality Traits */}
              <div 
                className="absolute text-black"
                style={{ 
                  left: `${100 * scale}px`, 
                  top: `${850 * scale}px`, 
                  width: `${800 * scale}px`,
                  fontSize: `${12 * scale}px`,
                  lineHeight: 1.3,
                }}
              >
                {character.rasgos_personalidad?.map((rasgo, i) => (
                  <p key={i} className="mb-1">• {typeof rasgo === 'string' ? rasgo : rasgo.nombre}</p>
                ))}
              </div>

              {/* Equipment list */}
              <div 
                className="absolute text-black"
                style={{ 
                  left: `${1050 * scale}px`, 
                  top: `${1200 * scale}px`, 
                  width: `${850 * scale}px`,
                  fontSize: `${11 * scale}px`,
                  lineHeight: 1.2,
                }}
              >
                {character.equipo?.map((item, i) => (
                  <p key={i}>• {typeof item === 'string' ? item : item.nombre}</p>
                ))}
              </div>

            </div>
          )}

          {/* Page 3 - Story/History Notes */}
          {currentPage === 3 && (
            <div 
              className="absolute inset-0"
              style={{ fontSize: `${14 * scale}px` }}
            >
              {/* Character Name */}
              <div 
                className="absolute font-bold text-black"
                style={{ 
                  left: `${500 * scale}px`, 
                  top: `${155 * scale}px`,
                  fontSize: `${24 * scale}px`,
                }}
              >
                {character.nombre}
              </div>

              {/* Story text area (editable) */}
              <textarea
                value={editableFields.notas_historia}
                onChange={(e) => setEditableFields(prev => ({ ...prev, notas_historia: e.target.value }))}
                placeholder="Escribe la historia de tu personaje aquí..."
                className="absolute bg-transparent border-none outline-none resize-none text-black"
                style={{ 
                  left: `${100 * scale}px`, 
                  top: `${250 * scale}px`,
                  width: `${1800 * scale}px`,
                  height: `${2200 * scale}px`,
                  fontSize: `${16 * scale}px`,
                  lineHeight: 1.5,
                }}
              />
            </div>
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
    </div>
  );
};

export default InteractiveCharacterSheet;
