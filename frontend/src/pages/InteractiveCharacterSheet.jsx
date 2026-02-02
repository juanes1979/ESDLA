/**
 * Interactive Character Sheet - 3-page character sheet with image backgrounds
 * Uses the official LOTR RPG sheet images as backgrounds with data overlay fields
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
  'acertijos': 'inteligencia',
  'acrobacias': 'destreza',
  'atletismo': 'fuerza',
  'cazar': 'sabiduria',
  'engano': 'carisma',
  'explorar': 'sabiduria',
  'interpretacion': 'carisma',
  'intimidacion': 'carisma',
  'investigacion': 'inteligencia',
  'juego_manos': 'destreza',
  'medicina': 'inteligencia',
  'naturaleza': 'inteligencia',
  'percepcion': 'sabiduria',
  'perspicacia': 'sabiduria',
  'persuasion': 'carisma',
  'saber_antiguo': 'inteligencia',
  'sigilo': 'destreza',
  'trato_animales': 'sabiduria',
  'viajar': 'sabiduria',
};

// Skill names for display (Spanish)
const SKILL_DISPLAY_NAMES = {
  'acertijos': 'Acertijos',
  'acrobacias': 'Acrobacias',
  'atletismo': 'Atletismo',
  'cazar': 'Cazar',
  'engano': 'Engaño',
  'explorar': 'Explorar',
  'interpretacion': 'Interpretación',
  'intimidacion': 'Intimidación',
  'investigacion': 'Investigación',
  'juego_manos': 'Juego de manos',
  'medicina': 'Medicina',
  'naturaleza': 'Saber de la naturaleza',
  'percepcion': 'Percepción',
  'perspicacia': 'Perspicacia',
  'persuasion': 'Persuasión',
  'saber_antiguo': 'Saber antiguo',
  'sigilo': 'Sigilo',
  'trato_animales': 'Trato con animales',
  'viajar': 'Viajar',
};

// PAGE 1 FIELD POSITIONS (from user-provided JSON - final version 2026-02-01)
const PAGE1_FIELDS = {
  // Basic Info
  nombre: { x: 89, y: 171, width: 630, fontSize: 45, align: 'center' },
  ocupacion_nivel: { x: 757, y: 142, width: 260, fontSize: 31, align: 'left' },
  jugador: { x: 983, y: 43, width: 600, fontSize: 50, align: 'center' },
  cultura: { x: 757, y: 220, width: 260, fontSize: 31, align: 'left' },
  senda_sombra: { x: 1182, y: 514, width: 445, fontSize: 31, align: 'left' },
  
  // Rasgos distintivos (2 con descripción) - descripción es multilinea
  rasgos_distintivos_1: { x: 1336, y: 1007, width: 260, fontSize: 31, align: 'left' },
  rasgos_distintivos_2: { x: 1336, y: 1244, width: 260, fontSize: 31, align: 'left' },
  descripcion_rasgos_distintivos_1: { x: 1179, y: 1056, width: 437, fontSize: 22, align: 'left', height: 180, multiline: true },
  descripcion_rasgos_distintivos_2: { x: 1179, y: 1289, width: 437, fontSize: 22, align: 'left', height: 180, multiline: true },
  
  // Habilidades favorecidas (3)
  habilidad_favorecida_1: { x: 1228, y: 237, width: 117, fontSize: 16, align: 'left' },
  habilidad_favorecida_2: { x: 1352, y: 237, width: 117, fontSize: 16, align: 'left' },
  habilidad_favorecida_3: { x: 1485, y: 237, width: 117, fontSize: 16, align: 'left' },
  
  // Características físicas
  edad: { x: 1059, y: 148, width: 46, fontSize: 30, align: 'left' },
  altura: { x: 1130, y: 148, width: 73, fontSize: 30, align: 'left' },
  peso: { x: 1228, y: 148, width: 73, fontSize: 30, align: 'left' },
  ojos: { x: 1334, y: 156, width: 90, fontSize: 20, align: 'left' },
  piel: { x: 1434, y: 156, width: 90, fontSize: 20, align: 'left' },
  pelo: { x: 1518, y: 156, width: 90, fontSize: 20, align: 'left' },
  sexo: { x: 376, y: 254, width: 137, fontSize: 40, align: 'center' },
  
  // Attributes - Main values
  fuerza_valor: { x: 95, y: 327, width: 100, fontSize: 100, align: 'center' },
  destreza_valor: { x: 95, y: 547, width: 100, fontSize: 100, align: 'center' },
  constitucion_valor: { x: 95, y: 767, width: 100, fontSize: 100, align: 'center' },
  inteligencia_valor: { x: 95, y: 987, width: 100, fontSize: 100, align: 'center' },
  sabiduria_valor: { x: 93, y: 1207, width: 100, fontSize: 100, align: 'center' },
  carisma_valor: { x: 95, y: 1427, width: 100, fontSize: 100, align: 'center' },
  
  // Attributes - Modifiers (big circle)
  fuerza_mod: { x: 91, y: 444, width: 100, fontSize: 55, align: 'center' },
  destreza_mod: { x: 91, y: 660, width: 100, fontSize: 55, align: 'center' },
  constitucion_mod: { x: 91, y: 878, width: 100, fontSize: 55, align: 'center' },
  inteligencia_mod: { x: 91, y: 1098, width: 100, fontSize: 55, align: 'center' },
  sabiduria_mod: { x: 91, y: 1317, width: 100, fontSize: 55, align: 'center' },
  carisma_mod: { x: 91, y: 1534, width: 100, fontSize: 55, align: 'center' },
  
  // Combat stats
  inspiracion: { x: 250, y: 340, width: 100, fontSize: 65, align: 'center' },
  bonificador_competencia: { x: 250, y: 478, width: 100, fontSize: 65, align: 'center' },
  clase_armadura: { x: 657, y: 357, width: 100, fontSize: 65, align: 'center' },
  iniciativa: { x: 808, y: 357, width: 100, fontSize: 65, align: 'center' },
  velocidad: { x: 949, y: 357, width: 120, fontSize: 65, align: 'center' },
  
  // Hit points
  pg_max: { x: 707, y: 508, width: 80, fontSize: 50, align: 'center' },
  pg_actual: { x: 689, y: 646, width: 110, fontSize: 70, align: 'center' },
  pg_temp: { x: 901, y: 585, width: 110, fontSize: 70, align: 'center' },
  dado_golpe: { x: 682, y: 807, width: 120, fontSize: 65, align: 'center' },
  
  percepcion_pasiva: { x: 78, y: 1674, width: 100, fontSize: 65, align: 'center' },
  
  // Peso y estorbo (Updated from JSON)
  peso_transportado: { x: 1192, y: 367, width: 92, fontSize: 60, align: 'center' },
  cargado: { x: 1337, y: 368, width: 23, fontSize: 30, align: 'left' },
  muy_cargado: { x: 1337, y: 418, width: 23, fontSize: 30, align: 'left' },
  
  // Saving throws - modifiers (in column)
  salvacion_fue_mod: { x: 282, y: 683, width: 100, fontSize: 30, align: 'center' },
  salvacion_des_mod: { x: 282, y: 715, width: 100, fontSize: 30, align: 'center' },
  salvacion_con_mod: { x: 282, y: 746, width: 100, fontSize: 30, align: 'center' },
  salvacion_int_mod: { x: 282, y: 778, width: 100, fontSize: 30, align: 'center' },
  salvacion_sab_mod: { x: 282, y: 809, width: 100, fontSize: 30, align: 'center' },
  salvacion_car_mod: { x: 282, y: 840, width: 100, fontSize: 30, align: 'center' },
  
  // Saving throws - competency checkboxes (x if proficient)
  comp_salvacion_fue: { x: 280, y: 691, width: 21, fontSize: 22, align: 'center' },
  comp_salvacion_des: { x: 280, y: 723, width: 21, fontSize: 22, align: 'center' },
  comp_salvacion_con: { x: 280, y: 754, width: 21, fontSize: 22, align: 'center' },
  comp_salvacion_int: { x: 280, y: 785, width: 21, fontSize: 22, align: 'center' },
  comp_salvacion_sab: { x: 280, y: 815, width: 21, fontSize: 22, align: 'center' },
  comp_salvacion_car: { x: 280, y: 846, width: 21, fontSize: 22, align: 'center' },
  
  // Skills - modifiers
  hab_acertijos: { x: 282, y: 992, width: 100, fontSize: 30, align: 'center' },
  hab_acrobacias: { x: 282, y: 1023, width: 100, fontSize: 30, align: 'center' },
  hab_atletismo: { x: 282, y: 1054, width: 100, fontSize: 30, align: 'center' },
  hab_cazar: { x: 282, y: 1085, width: 100, fontSize: 30, align: 'center' },
  hab_engano: { x: 282, y: 1116, width: 100, fontSize: 30, align: 'center' },
  hab_explorar: { x: 282, y: 1147, width: 100, fontSize: 30, align: 'center' },
  hab_interpretacion: { x: 282, y: 1178, width: 100, fontSize: 30, align: 'center' },
  hab_intimidacion: { x: 282, y: 1209, width: 100, fontSize: 30, align: 'center' },
  hab_investigacion: { x: 282, y: 1240, width: 100, fontSize: 30, align: 'center' },
  hab_juego_manos: { x: 282, y: 1271, width: 100, fontSize: 30, align: 'center' },
  hab_medicina: { x: 282, y: 1302, width: 100, fontSize: 30, align: 'center' },
  hab_naturaleza: { x: 282, y: 1333, width: 100, fontSize: 30, align: 'center' },
  hab_percepcion: { x: 282, y: 1364, width: 100, fontSize: 30, align: 'center' },
  hab_perspicacia: { x: 282, y: 1395, width: 100, fontSize: 30, align: 'center' },
  hab_persuasion: { x: 282, y: 1426, width: 100, fontSize: 30, align: 'center' },
  hab_saber_antiguo: { x: 282, y: 1457, width: 100, fontSize: 30, align: 'center' },
  hab_sigilo: { x: 282, y: 1488, width: 100, fontSize: 30, align: 'center' },
  hab_trato_animales: { x: 282, y: 1519, width: 100, fontSize: 30, align: 'center' },
  hab_viajar: { x: 282, y: 1550, width: 100, fontSize: 30, align: 'center' },
  
  // Skills - competency checkboxes (x=competencia, P=pericia)
  comp_hab_acertijos: { x: 280, y: 1001, width: 21, fontSize: 22, align: 'center' },
  comp_hab_acrobacias: { x: 280, y: 1032, width: 21, fontSize: 22, align: 'center' },
  comp_hab_atletismo: { x: 280, y: 1062, width: 21, fontSize: 22, align: 'center' },
  comp_hab_cazar: { x: 280, y: 1094, width: 21, fontSize: 22, align: 'center' },
  comp_hab_engano: { x: 280, y: 1125, width: 21, fontSize: 22, align: 'center' },
  comp_hab_explorar: { x: 280, y: 1156, width: 21, fontSize: 22, align: 'center' },
  comp_hab_interpretacion: { x: 280, y: 1187, width: 21, fontSize: 22, align: 'center' },
  comp_hab_intimidacion: { x: 280, y: 1217, width: 21, fontSize: 22, align: 'center' },
  comp_hab_investigacion: { x: 280, y: 1248, width: 21, fontSize: 22, align: 'center' },
  comp_hab_juego_manos: { x: 280, y: 1280, width: 21, fontSize: 22, align: 'center' },
  comp_hab_medicina: { x: 280, y: 1310, width: 21, fontSize: 22, align: 'center' },
  comp_hab_naturaleza: { x: 280, y: 1341, width: 21, fontSize: 22, align: 'center' },
  comp_hab_percepcion: { x: 280, y: 1372, width: 21, fontSize: 22, align: 'center' },
  comp_hab_perspicacia: { x: 280, y: 1403, width: 21, fontSize: 22, align: 'center' },
  comp_hab_persuasion: { x: 280, y: 1434, width: 21, fontSize: 22, align: 'center' },
  comp_hab_saber_antiguo: { x: 280, y: 1465, width: 21, fontSize: 22, align: 'center' },
  comp_hab_sigilo: { x: 280, y: 1495, width: 21, fontSize: 22, align: 'center' },
  comp_hab_trato_animales: { x: 280, y: 1527, width: 21, fontSize: 22, align: 'center' },
  comp_hab_viajar: { x: 280, y: 1558, width: 21, fontSize: 22, align: 'center' },
  
  // Monedas - campos separados
  monedas_cobre: { x: 653, y: 1731, width: 60, fontSize: 40, align: 'center' },
  monedas_plata: { x: 653, y: 1852, width: 60, fontSize: 40, align: 'center' },
  monedas_oro: { x: 653, y: 1973, width: 60, fontSize: 40, align: 'center' },
  monedas_estano: { x: 680, y: 2084, width: 60, fontSize: 40, align: 'center' },
  
  // Equipo - 8 filas
  equipo_1: { x: 771, y: 1725, width: 298, fontSize: 22, align: 'left' },
  equipo_2: { x: 771, y: 1772, width: 298, fontSize: 22, align: 'left' },
  equipo_3: { x: 771, y: 1818, width: 298, fontSize: 22, align: 'left' },
  equipo_4: { x: 771, y: 1867, width: 298, fontSize: 22, align: 'left' },
  equipo_5: { x: 771, y: 1915, width: 298, fontSize: 22, align: 'left' },
  equipo_6: { x: 771, y: 1957, width: 298, fontSize: 22, align: 'left' },
  equipo_7: { x: 771, y: 2002, width: 298, fontSize: 22, align: 'left' },
  equipo_8: { x: 771, y: 2040, width: 298, fontSize: 22, align: 'left' },
  equipo_9: { x: 1100, y: 1725, width: 298, fontSize: 22, align: 'left' },
  equipo_10: { x: 1100, y: 1772, width: 298, fontSize: 22, align: 'left' },
  equipo_11: { x: 1100, y: 1818, width: 298, fontSize: 22, align: 'left' },
  equipo_12: { x: 1100, y: 1867, width: 298, fontSize: 22, align: 'left' },
  equipo_13: { x: 1100, y: 1915, width: 298, fontSize: 22, align: 'left' },
  equipo_14: { x: 1100, y: 1957, width: 298, fontSize: 22, align: 'left' },
  equipo_15: { x: 1100, y: 2002, width: 298, fontSize: 22, align: 'left' },
  equipo_16: { x: 1100, y: 2040, width: 298, fontSize: 22, align: 'left' },
  equipo_17: { x: 1100, y: 2085, width: 298, fontSize: 22, align: 'left' },
  equipo_18: { x: 1100, y: 2130, width: 298, fontSize: 22, align: 'left' },
  equipo_19: { x: 1400, y: 1725, width: 298, fontSize: 22, align: 'left' },
  equipo_20: { x: 1400, y: 1772, width: 298, fontSize: 22, align: 'left' },
  
  // Armas - 5 filas (Nombre | Daño | Herida | Distancia)
  arma_1_nombre: { x: 642, y: 1042, width: 135, fontSize: 22, align: 'left' },
  arma_1_dano: { x: 801, y: 1042, width: 78, fontSize: 22, align: 'left' },
  arma_1_herida: { x: 901, y: 1042, width: 81, fontSize: 22, align: 'left' },
  arma_1_distancia: { x: 1008, y: 1042, width: 70, fontSize: 22, align: 'left' },
  
  arma_2_nombre: { x: 642, y: 1086, width: 135, fontSize: 22, align: 'left' },
  arma_2_dano: { x: 801, y: 1086, width: 78, fontSize: 22, align: 'left' },
  arma_2_herida: { x: 901, y: 1086, width: 81, fontSize: 22, align: 'left' },
  arma_2_distancia: { x: 1008, y: 1086, width: 70, fontSize: 22, align: 'left' },
  
  arma_3_nombre: { x: 642, y: 1134, width: 135, fontSize: 22, align: 'left' },
  arma_3_dano: { x: 801, y: 1134, width: 78, fontSize: 22, align: 'left' },
  arma_3_herida: { x: 901, y: 1134, width: 81, fontSize: 22, align: 'left' },
  arma_3_distancia: { x: 1008, y: 1134, width: 70, fontSize: 22, align: 'left' },
  
  arma_4_nombre: { x: 642, y: 1181, width: 135, fontSize: 22, align: 'left' },
  arma_4_dano: { x: 801, y: 1181, width: 78, fontSize: 22, align: 'left' },
  arma_4_herida: { x: 901, y: 1181, width: 81, fontSize: 22, align: 'left' },
  arma_4_distancia: { x: 1008, y: 1181, width: 70, fontSize: 22, align: 'left' },
  
  arma_5_nombre: { x: 642, y: 1230, width: 135, fontSize: 22, align: 'left' },
  arma_5_dano: { x: 801, y: 1229, width: 78, fontSize: 22, align: 'left' },
  arma_5_herida: { x: 901, y: 1230, width: 81, fontSize: 22, align: 'left' },
  arma_5_distancia: { x: 1008, y: 1230, width: 70, fontSize: 22, align: 'left' },
  
  // Idiomas y herramientas - 7 filas
  idioma_herr_1: { x: 109, y: 1836, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_2: { x: 109, y: 1874, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_3: { x: 109, y: 1918, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_4: { x: 109, y: 1959, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_5: { x: 109, y: 2004, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_6: { x: 109, y: 2044, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_7: { x: 109, y: 2083, width: 435, fontSize: 22, align: 'left' },
};

// Handwritten style font
const FONT_STYLE = "'Caveat', 'Ink Free', cursive";

// Display field component - supports multiline with height parameter
const DisplayField = ({ value, x, y, width, scale, fontSize = 14, align = 'center', height = null, multiline = false }) => (
  <div
    className={cn(
      "absolute text-black",
      multiline ? "whitespace-pre-wrap overflow-hidden" : "whitespace-nowrap overflow-hidden"
    )}
    style={{
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: `${width * scale}px`,
      height: height ? `${height * scale}px` : 'auto',
      fontSize: `${fontSize * scale}px`,
      textAlign: align,
      fontFamily: FONT_STYLE,
      lineHeight: 1.2,
      wordWrap: multiline ? 'break-word' : 'normal',
    }}
  >
    {value}
  </div>
);

const InteractiveCharacterSheet = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [weaponCatalog, setWeaponCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.6);
  const containerRef = useRef(null);

  // Load character data and equipment catalog
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load character and equipment catalog in parallel
        const [characterData, catalogRes] = await Promise.all([
          getCharacter(characterId),
          api.get('/api/data/equipment-catalog')
        ]);
        setCharacter(characterData);
        setWeaponCatalog(catalogRes.data?.armas || []);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [characterId]);

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

  // Get attributes - check multiple possible field names
  const attrs = character.atributos || character.caracteristicas || character.atributos_finales || {};
  const bonificadorCompetencia = character.bonificador_competencia || 2;
  const nivel = character.nivel || 1;
  
  // Get proficiencies (skills with competence) - combine from all sources
  const habilidadesCompetencia = character.habilidades_competencia || [];
  const competenciasHabilidades = [
    ...habilidadesCompetencia,
    ...(character.competencias_habilidades_cultura || []),
    ...(character.competencia_habilidad_cultura ? [character.competencia_habilidad_cultura] : []),
    ...(character.competencias_habilidades_trasfondo || []),
    ...(character.habilidades_elegidas_ocupacion || []),
    ...(character.competencias?.habilidades_cultura || []),
    ...(character.competencias?.habilidades_trasfondo || []),
  ].map(s => {
    if (!s) return '';
    // Remove the attribute part like "(Sab)", "(Des)" etc and normalize
    const cleaned = s.replace(/\s*\([^)]*\)\s*/g, '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    return cleaned;
  }).filter(s => s);
  
  // Get expertise (pericia)
  const periciasHabilidades = (character.pericia_elegida || [])
    .map(s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'));
  
  // Saving throw proficiencies - check multiple possible locations
  const salvacionesCompetentes = character.salvaciones_competentes || 
    character.competencias?.tiradas_salvacion || 
    [];
  
  // Calculate skill modifier
  const getSkillMod = (skillKey) => {
    const attrName = SKILL_ATTRIBUTES[skillKey];
    const attrValue = attrs[attrName] || 10;
    const baseMod = Math.floor((attrValue - 10) / 2);
    
    let totalMod = baseMod;
    if (competenciasHabilidades.includes(skillKey)) {
      totalMod += bonificadorCompetencia;
    }
    if (periciasHabilidades.includes(skillKey)) {
      totalMod += bonificadorCompetencia; // Pericia = double proficiency
    }
    
    return totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
  };
  
  // Get skill competency mark (x=competencia, P=pericia, empty otherwise)
  const getSkillCompMark = (skillKey) => {
    if (periciasHabilidades.includes(skillKey)) return 'P';
    if (competenciasHabilidades.includes(skillKey)) return 'x';
    return '';
  };
  
  // Calculate saving throw modifier
  const getSavingMod = (attrName) => {
    const attrValue = attrs[attrName] || 10;
    const baseMod = Math.floor((attrValue - 10) / 2);
    
    // Check if proficient in this saving throw
    const isProficient = salvacionesCompetentes.some(s => 
      s?.toLowerCase().includes(attrName.substring(0, 3))
    );
    
    let totalMod = baseMod;
    if (isProficient) {
      totalMod += bonificadorCompetencia;
    }
    
    return totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
  };
  
  // Get saving throw competency mark
  const getSavingCompMark = (attrName) => {
    const isProficient = salvacionesCompetentes.some(s => 
      s?.toLowerCase().includes(attrName.substring(0, 3))
    );
    return isProficient ? 'x' : '';
  };
  
  // Lista de nombres de armas conocidas para filtrar
  const WEAPON_NAMES = [
    'bastón', 'garrote', 'gran garrote', 'hacha', 'hoz', 'maza', 'martillo', 'daga',
    'hacha de mano', 'lanza', 'lanza corta', 'arco', 'espada', 'espada corta', 
    'espada larga', 'cimitarra', 'estoque', 'flajelo', 'hacha a dos manos',
    'lanza de caballería', 'látigo', 'gran hacha', 'hacha de guerra', 'lanza pesada',
    'martillo pesado', 'piqueta', 'arco largo', 'ballesta'
  ];
  
  // Check if item is a weapon
  const isWeapon = (itemName) => {
    if (!itemName) return false;
    const normalized = itemName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return WEAPON_NAMES.some(w => normalized.includes(w));
  };
  
  // Get all equipment items (excluding weapons)
  const getAllEquipment = () => {
    const allItems = [
      ...(character.inventario || []).map(i => typeof i === 'string' ? i : i.nombre),
      ...(character.equipo_ocupacion || []),
      ...(character.equipo_trasfondo || []),
      ...(character.equipo_nivel_vida || []),
    ];
    // Filter out weapons
    return allItems.filter(item => !isWeapon(item));
  };
  
  // Get equipment rows (25 total: 8 for page 1, 17 for page 2)
  const getEquipmentRows = () => {
    const equipment = getAllEquipment();
    const rows = [];
    // Get up to 25 equipment items
    for (let i = 0; i < 25; i++) {
      rows.push(equipment[i] || '');
    }
    return rows;
  };
  
  // Weapon stats from game rules (herida = wound threshold, distancia = range)
  const WEAPON_STATS = {
    'bastón': { dano: '1d4', herida: 12, distancia: 'C/C' },
    'baston': { dano: '1d4', herida: 12, distancia: 'C/C' },
    'garrote': { dano: '1d4', herida: 12, distancia: 'C/C' },
    'gran garrote': { dano: '1d8', herida: 14, distancia: 'C/C' },
    'hacha': { dano: '1d6', herida: 14, distancia: 'C/C' },
    'hoz': { dano: '1d4', herida: 12, distancia: 'C/C' },
    'maza': { dano: '1d6', herida: 14, distancia: 'C/C' },
    'martillo': { dano: '1d6', herida: 14, distancia: 'C/C' },
    'daga': { dano: '1d4', herida: 12, distancia: '6/18' },
    'hacha de mano': { dano: '1d6', herida: 14, distancia: '6/18' },
    'lanza': { dano: '1d6', herida: 14, distancia: '6/18' },
    'lanza corta': { dano: '1d4', herida: 12, distancia: '6/18' },
    'arco': { dano: '1d6', herida: 14, distancia: '24/96' },
    'arco corto': { dano: '1d6', herida: 14, distancia: '24/96' },
    'espada': { dano: '1d6', herida: 14, distancia: 'C/C' },
    'espada corta': { dano: '1d6', herida: 14, distancia: 'C/C' },
    'espada larga': { dano: '1d8', herida: 16, distancia: 'C/C' },
    'cimitarra': { dano: '1d6', herida: 14, distancia: 'C/C' },
    'estoque': { dano: '1d8', herida: 16, distancia: 'C/C' },
    'hacha a dos manos': { dano: '1d10', herida: 18, distancia: 'C/C' },
    'hacha de guerra': { dano: '1d8', herida: 20, distancia: 'C/C' },
    'lanza pesada': { dano: '1d10', herida: 18, distancia: 'C/C' },
    'martillo pesado': { dano: '1d10', herida: 18, distancia: 'C/C' },
    'arco largo': { dano: '1d8', herida: 16, distancia: '20/180' },
    'ballesta': { dano: '1d8', herida: 16, distancia: '24/96' },
  };
  
  // Get weapon stats from API catalog (loaded in state)
  const getWeaponStats = (weaponName) => {
    const normalized = weaponName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    // Search in the API catalog first
    for (const weapon of weaponCatalog) {
      const catalogName = weapon.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (catalogName === normalized || normalized.includes(catalogName) || catalogName.includes(normalized)) {
        return {
          dano: weapon.dano || '1d4',
          herida: weapon.herida || 12,
          distancia: weapon.distancia || 'C/C'
        };
      }
    }
    
    // Fallback to static lookup if not found in catalog
    if (WEAPON_STATS[normalized]) return WEAPON_STATS[normalized];
    
    // Try partial match in static lookup
    for (const [key, stats] of Object.entries(WEAPON_STATS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return stats;
      }
    }
    
    return { dano: '1d4', herida: 12, distancia: 'C/C' };
  };
  
  // Get weapons with details (5 max) - includes weapons from ocupacion and armas_elegidas
  const getWeapons = () => {
    const weaponItems = [];
    
    // Get weapons from armas_elegidas (selected weapons from occupation)
    const armasElegidas = character.armas_elegidas || [];
    armasElegidas.forEach(arma => {
      const nombre = typeof arma === 'string' ? arma : arma.nombre;
      if (nombre && !weaponItems.some(w => w.nombre.toLowerCase() === nombre.toLowerCase())) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({
          nombre: nombre,
          dano: stats.dano,
          herida: stats.herida,
          distancia: stats.distancia,
        });
      }
    });
    
    // Check inventario for weapons with details
    const inventario = character.inventario || [];
    inventario.forEach(item => {
      const nombre = typeof item === 'string' ? item : item.nombre;
      if (isWeapon(nombre) && !weaponItems.some(w => w.nombre.toLowerCase() === nombre.toLowerCase())) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({
          nombre: nombre,
          dano: item.dano || item.daño || stats.dano,
          herida: item.herida || stats.herida,
          distancia: item.distancia || stats.distancia,
        });
      }
    });
    
    // Check equipo_ocupacion for weapons
    (character.equipo_ocupacion || []).forEach(item => {
      const nombre = typeof item === 'string' ? item : item;
      if (isWeapon(nombre) && !weaponItems.some(w => w.nombre.toLowerCase() === nombre.toLowerCase())) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({
          nombre: nombre,
          dano: stats.dano,
          herida: stats.herida,
          distancia: stats.distancia,
        });
      }
    });
    
    // Fill up to 5 weapons
    const weapons = [];
    for (let i = 0; i < 5; i++) {
      weapons.push(weaponItems[i] || { nombre: '', dano: '', herida: '', distancia: '' });
    }
    return weapons;
  };
  
  // Get languages and tools (idiomas primero, luego herramientas) - 7 filas
  const getIdiomasHerramientasRows = () => {
    // First, get all languages from competencias.idiomas or direct idiomas field
    const idiomas = character.competencias?.idiomas || character.idiomas || [];
    
    // Then, get all tools/herramientas - including from culture selection (step 1)
    const herramientas = [
      // Herramienta de cultura (seleccionada en paso 1 - Step1Culture)
      ...(character.competencia_herramienta_cultura ? [character.competencia_herramienta_cultura] : []),
      ...(character.herramienta_elegida_cultura ? [character.herramienta_elegida_cultura] : []),
      ...(character.competencia_herramienta_1 ? [character.competencia_herramienta_1] : []),
      ...(character.competencias_herramientas_2 || []),
      // From nested competencias object
      ...(character.competencias?.herramientas || []),
      ...(character.competencias?.herramientas_cultura || []),
      // From occupation
      ...(character.herramientas_elegidas_ocupacion || []),
      // From background
      ...(character.competencias_herramientas_trasfondo || []),
    ];
    
    // Remove duplicates
    const uniqueHerramientas = [...new Set(herramientas.filter(h => h))];
    
    // Combine: idiomas first, then herramientas
    const items = [...idiomas, ...uniqueHerramientas];
    
    const rows = [];
    for (let i = 0; i < 7; i++) {
      rows.push(items[i] || '');
    }
    return rows;
  };
  
  // Get rasgos distintivos (2 with descriptions) - check both rasgo_distintivo and rasgo_distintivo_2
  const getRasgosDistintivos = () => {
    const rasgo1 = character.rasgo_distintivo;
    const rasgo2 = character.rasgo_distintivo_2;
    
    return {
      rasgo1_nombre: typeof rasgo1 === 'object' ? rasgo1?.nombre : rasgo1 || '',
      rasgo1_desc: typeof rasgo1 === 'object' ? rasgo1?.descripcion : '',
      rasgo2_nombre: typeof rasgo2 === 'object' ? rasgo2?.nombre : rasgo2 || '',
      rasgo2_desc: typeof rasgo2 === 'object' ? rasgo2?.descripcion : '',
    };
  };
  
  // Get habilidades favorecidas (3) - from pericia_elegida typically
  const getHabilidadesFavorecidas = () => {
    const favorecidas = character.habilidades_favorecidas || character.pericia_elegida || [];
    return {
      hab1: favorecidas[0] || '',
      hab2: favorecidas[1] || '',
      hab3: favorecidas[2] || '',
    };
  };
  
  // Calculate peso transportado (total weight)
  const calcularPesoTransportado = () => {
    let pesoTotal = 0;
    
    // Add weight from inventory
    (character.inventario || []).forEach(item => {
      if (typeof item === 'object' && item.peso) {
        pesoTotal += parseFloat(item.peso) || 0;
      }
    });
    
    // Add money weight (0.009 kg per coin)
    const dinero = character.dinero || {};
    const totalMonedas = (dinero.mp || 0) + (dinero.mo || 0) + (dinero.me || 0) + (dinero.mc || 0);
    pesoTotal += totalMonedas * 0.009;
    
    return pesoTotal.toFixed(2);
  };
  
  // Calculate estorbo (encumbrance status)
  const calcularEstorbo = () => {
    const pesoTotal = parseFloat(calcularPesoTransportado());
    const fuerza = attrs.fuerza || 10;
    
    // Reglas de estorbo basadas en Fuerza
    const limiteCargado = fuerza * 2.5; // Cargado si pesa más de FUE * 2.5 kg
    const limiteMuyCargado = fuerza * 4; // Muy cargado si pesa más de FUE * 4 kg
    
    return {
      cargado: pesoTotal > limiteCargado ? 'x' : '',
      muy_cargado: pesoTotal > limiteMuyCargado ? 'x' : '',
    };
  };
  
  // Get money
  const dinero = character.dinero || { mp: 0, mo: 0, me: 0, mc: 0 };
  
  // Calculate passive perception
  const percepcionPasiva = 10 + parseInt(getSkillMod('percepcion').replace('+', ''));
  
  // Get physical characteristics - check multiple field names
  const caracteristicasFisicas = {
    edad: character.edad || '',
    altura: character.altura_cm ? `${character.altura_cm} cm` : character.altura || '',
    peso: character.peso_kg ? `${character.peso_kg} kg` : character.peso || '',
    ojos: character.ojos || '',
    piel: character.piel || '',
    pelo: character.pelo || '',
    sexo: character.genero || character.sexo || '',
  };

  const equipmentRows = getEquipmentRows();
  const idiomasRows = getIdiomasHerramientasRows();
  const weapons = getWeapons();
  const rasgos = getRasgosDistintivos();
  const habFavorecidas = getHabilidadesFavorecidas();
  const pesoTransportado = calcularPesoTransportado();
  const estorbo = calcularEstorbo();

  return (
    <div className="min-h-screen bg-[#2a2a2a]" data-testid="interactive-sheet">
      {/* Import handwritten font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap');
      `}</style>

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
        className="flex-1 overflow-auto py-8 print:py-0 print:overflow-visible"
      >
        <div className="flex justify-center min-w-fit px-4">
          <div 
            className="relative bg-white shadow-2xl print:shadow-none flex-shrink-0"
            style={{
              width: SHEET_WIDTH * scale,
              height: SHEET_HEIGHT * scale,
              aspectRatio: `${SHEET_WIDTH} / ${SHEET_HEIGHT}`,
            }}
          >
            {/* Background Image */}
            <img
              src={`/assets/sheets/sheet_page${currentPage}_web.png`}
              alt={`Character Sheet Page ${currentPage}`}
              className="absolute inset-0 w-full h-full"
              draggable={false}
            />

            {/* PAGE 1 FIELDS */}
            {currentPage === 1 && (
              <>
                {/* Basic Info */}
                <DisplayField {...PAGE1_FIELDS.nombre} value={character.nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.ocupacion_nivel} value={`${character.ocupacion_nombre || character.vocacion_nombre || ''} ${nivel}`} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.jugador} value={character.jugador || ''} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.cultura} value={character.cultura_nombre || ''} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.senda_sombra} value={character.senda_sombra || ''} scale={scale} />
                
                {/* Rasgos distintivos (2 con descripción) */}
                <DisplayField {...PAGE1_FIELDS.rasgos_distintivos_1} value={rasgos.rasgo1_nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.rasgos_distintivos_2} value={rasgos.rasgo2_nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.descripcion_rasgos_distintivos_1} value={rasgos.rasgo1_desc} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.descripcion_rasgos_distintivos_2} value={rasgos.rasgo2_desc} scale={scale} />
                
                {/* Habilidades favorecidas (3) */}
                <DisplayField {...PAGE1_FIELDS.habilidad_favorecida_1} value={habFavorecidas.hab1} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.habilidad_favorecida_2} value={habFavorecidas.hab2} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.habilidad_favorecida_3} value={habFavorecidas.hab3} scale={scale} />
                
                {/* Características físicas */}
                <DisplayField {...PAGE1_FIELDS.edad} value={caracteristicasFisicas.edad} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.altura} value={caracteristicasFisicas.altura} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.peso} value={caracteristicasFisicas.peso} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.ojos} value={caracteristicasFisicas.ojos} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.piel} value={caracteristicasFisicas.piel} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.pelo} value={caracteristicasFisicas.pelo} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.sexo} value={caracteristicasFisicas.sexo} scale={scale} />
                
                {/* Attributes - Values */}
                <DisplayField {...PAGE1_FIELDS.fuerza_valor} value={attrs.fuerza || 10} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.destreza_valor} value={attrs.destreza || 10} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.constitucion_valor} value={attrs.constitucion || 10} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.inteligencia_valor} value={attrs.inteligencia || 10} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.sabiduria_valor} value={attrs.sabiduria || 10} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.carisma_valor} value={attrs.carisma || 10} scale={scale} />
                
                {/* Attributes - Modifiers */}
                <DisplayField {...PAGE1_FIELDS.fuerza_mod} value={getModifier(attrs.fuerza || 10)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.destreza_mod} value={getModifier(attrs.destreza || 10)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.constitucion_mod} value={getModifier(attrs.constitucion || 10)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.inteligencia_mod} value={getModifier(attrs.inteligencia || 10)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.sabiduria_mod} value={getModifier(attrs.sabiduria || 10)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.carisma_mod} value={getModifier(attrs.carisma || 10)} scale={scale} />
                
                {/* Combat Stats */}
                <DisplayField {...PAGE1_FIELDS.inspiracion} value={character.inspiracion || ''} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.bonificador_competencia} value={`+${bonificadorCompetencia}`} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.clase_armadura} value={10 + Math.floor(((attrs.destreza || 10) - 10) / 2)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.iniciativa} value={getModifier(attrs.destreza || 10)} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.velocidad} value={`${character.velocidad || 9}m`} scale={scale} />
                
                {/* Hit Points */}
                <DisplayField {...PAGE1_FIELDS.pg_max} value={character.puntos_golpe_max || character.pg_max || 8} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.pg_actual} value={character.puntos_golpe_actual || character.pg_actual || character.puntos_golpe_max || character.pg_max || 8} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.pg_temp} value={character.puntos_golpe_temp || character.pg_temp || 0} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.dado_golpe} value={character.dado_golpe || character.dado_de_golpe || '1d8'} scale={scale} />
                
                <DisplayField {...PAGE1_FIELDS.percepcion_pasiva} value={percepcionPasiva} scale={scale} />
                
                {/* Saving Throws - Modifiers */}
                <DisplayField {...PAGE1_FIELDS.salvacion_fue_mod} value={getSavingMod('fuerza')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.salvacion_des_mod} value={getSavingMod('destreza')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.salvacion_con_mod} value={getSavingMod('constitucion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.salvacion_int_mod} value={getSavingMod('inteligencia')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.salvacion_sab_mod} value={getSavingMod('sabiduria')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.salvacion_car_mod} value={getSavingMod('carisma')} scale={scale} />
                
                {/* Saving Throws - Competency Marks */}
                <DisplayField {...PAGE1_FIELDS.comp_salvacion_fue} value={getSavingCompMark('fuerza')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_salvacion_des} value={getSavingCompMark('destreza')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_salvacion_con} value={getSavingCompMark('constitucion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_salvacion_int} value={getSavingCompMark('inteligencia')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_salvacion_sab} value={getSavingCompMark('sabiduria')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_salvacion_car} value={getSavingCompMark('carisma')} scale={scale} />
                
                {/* Skills - Modifiers */}
                <DisplayField {...PAGE1_FIELDS.hab_acertijos} value={getSkillMod('acertijos')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_acrobacias} value={getSkillMod('acrobacias')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_atletismo} value={getSkillMod('atletismo')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_cazar} value={getSkillMod('cazar')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_engano} value={getSkillMod('engano')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_explorar} value={getSkillMod('explorar')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_interpretacion} value={getSkillMod('interpretacion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_intimidacion} value={getSkillMod('intimidacion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_investigacion} value={getSkillMod('investigacion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_juego_manos} value={getSkillMod('juego_manos')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_medicina} value={getSkillMod('medicina')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_naturaleza} value={getSkillMod('naturaleza')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_percepcion} value={getSkillMod('percepcion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_perspicacia} value={getSkillMod('perspicacia')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_persuasion} value={getSkillMod('persuasion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_saber_antiguo} value={getSkillMod('saber_antiguo')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_sigilo} value={getSkillMod('sigilo')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_trato_animales} value={getSkillMod('trato_animales')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.hab_viajar} value={getSkillMod('viajar')} scale={scale} />
                
                {/* Skills - Competency Marks */}
                <DisplayField {...PAGE1_FIELDS.comp_hab_acertijos} value={getSkillCompMark('acertijos')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_acrobacias} value={getSkillCompMark('acrobacias')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_atletismo} value={getSkillCompMark('atletismo')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_cazar} value={getSkillCompMark('cazar')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_engano} value={getSkillCompMark('engano')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_explorar} value={getSkillCompMark('explorar')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_interpretacion} value={getSkillCompMark('interpretacion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_intimidacion} value={getSkillCompMark('intimidacion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_investigacion} value={getSkillCompMark('investigacion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_juego_manos} value={getSkillCompMark('juego_manos')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_medicina} value={getSkillCompMark('medicina')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_naturaleza} value={getSkillCompMark('naturaleza')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_percepcion} value={getSkillCompMark('percepcion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_perspicacia} value={getSkillCompMark('perspicacia')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_persuasion} value={getSkillCompMark('persuasion')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_saber_antiguo} value={getSkillCompMark('saber_antiguo')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_sigilo} value={getSkillCompMark('sigilo')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_trato_animales} value={getSkillCompMark('trato_animales')} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.comp_hab_viajar} value={getSkillCompMark('viajar')} scale={scale} />
                
                {/* Monedas */}
                <DisplayField {...PAGE1_FIELDS.monedas_estano} value={dinero.me || 0} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.monedas_cobre} value={dinero.mc || 0} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.monedas_plata} value={dinero.mp || 0} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.monedas_oro} value={dinero.mo || 0} scale={scale} />
                
                {/* Equipo (solo 8 filas en página 1) */}
                <DisplayField {...PAGE1_FIELDS.equipo_1} value={equipmentRows[0]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_2} value={equipmentRows[1]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_3} value={equipmentRows[2]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_4} value={equipmentRows[3]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_5} value={equipmentRows[4]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_6} value={equipmentRows[5]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_7} value={equipmentRows[6]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_8} value={equipmentRows[7]} scale={scale} />
                
                {/* Armas (5 rows: nombre, daño, herida, distancia) */}
                <DisplayField {...PAGE1_FIELDS.arma_1_nombre} value={weapons[0].nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_1_dano} value={weapons[0].dano} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_1_herida} value={weapons[0].herida} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_1_distancia} value={weapons[0].distancia} scale={scale} />
                
                <DisplayField {...PAGE1_FIELDS.arma_2_nombre} value={weapons[1].nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_2_dano} value={weapons[1].dano} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_2_herida} value={weapons[1].herida} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_2_distancia} value={weapons[1].distancia} scale={scale} />
                
                <DisplayField {...PAGE1_FIELDS.arma_3_nombre} value={weapons[2].nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_3_dano} value={weapons[2].dano} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_3_herida} value={weapons[2].herida} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_3_distancia} value={weapons[2].distancia} scale={scale} />
                
                <DisplayField {...PAGE1_FIELDS.arma_4_nombre} value={weapons[3].nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_4_dano} value={weapons[3].dano} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_4_herida} value={weapons[3].herida} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_4_distancia} value={weapons[3].distancia} scale={scale} />
                
                <DisplayField {...PAGE1_FIELDS.arma_5_nombre} value={weapons[4].nombre} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_5_dano} value={weapons[4].dano} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_5_herida} value={weapons[4].herida} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.arma_5_distancia} value={weapons[4].distancia} scale={scale} />
                
                {/* Peso transportado y estorbo */}
                <DisplayField {...PAGE1_FIELDS.peso_transportado} value={`${pesoTransportado} kg`} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.cargado} value={estorbo.cargado} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.muy_cargado} value={estorbo.muy_cargado} scale={scale} />
                
                {/* Idiomas y Herramientas (7 rows) - Idiomas primero, luego herramientas */}
                <DisplayField {...PAGE1_FIELDS.idioma_herr_1} value={idiomasRows[0]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_2} value={idiomasRows[1]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_3} value={idiomasRows[2]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_4} value={idiomasRows[3]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_5} value={idiomasRows[4]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_6} value={idiomasRows[5]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_7} value={idiomasRows[6]} scale={scale} />
              </>
            )}

            {/* PAGE 2 - TODO: Add fields */}
            {currentPage === 2 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-500 text-lg">Página 2 - Pendiente de configurar coordenadas</p>
              </div>
            )}

            {/* PAGE 3 - TODO: Add fields */}
            {currentPage === 3 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-500 text-lg">Página 3 - Pendiente de configurar coordenadas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveCharacterSheet;
