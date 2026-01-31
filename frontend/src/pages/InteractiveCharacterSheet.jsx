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

// PAGE 1 FIELD POSITIONS (from user-provided JSON + additions)
const PAGE1_FIELDS = {
  // Basic Info
  nombre: { x: 89, y: 171, width: 630, fontSize: 45, align: 'center' },
  ocupacion_nivel: { x: 757, y: 142, width: 260, fontSize: 31, align: 'left' },
  rasgos_distintivos: { x: 1048, y: 142, width: 260, fontSize: 31, align: 'left' },
  jugador: { x: 1337, y: 142, width: 260, fontSize: 31, align: 'left' },
  cultura: { x: 757, y: 212, width: 260, fontSize: 31, align: 'left' },
  senda_sombra: { x: 1048, y: 212, width: 260, fontSize: 31, align: 'left' },
  
  // Attributes - Main values
  fuerza_valor: { x: 95, y: 327, width: 100, fontSize: 100, align: 'center' },
  destreza_valor: { x: 95, y: 547, width: 100, fontSize: 100, align: 'center' },
  constitucion_valor: { x: 95, y: 767, width: 100, fontSize: 100, align: 'center' },
  inteligencia_valor: { x: 95, y: 987, width: 100, fontSize: 100, align: 'center' },
  sabiduria_valor: { x: 93, y: 1207, width: 100, fontSize: 100, align: 'center' },
  carisma_valor: { x: 95, y: 1427, width: 100, fontSize: 100, align: 'center' },
  
  // Attributes - Modifiers (in small circle below)
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
  pg_max: { x: 682, y: 520, width: 120, fontSize: 50, align: 'center' },
  pg_actual: { x: 682, y: 650, width: 120, fontSize: 50, align: 'center' },
  pg_temp: { x: 682, y: 720, width: 120, fontSize: 50, align: 'center' },
  dado_golpe: { x: 682, y: 807, width: 120, fontSize: 65, align: 'center' },
  
  percepcion_pasiva: { x: 78, y: 1674, width: 100, fontSize: 65, align: 'center' },
  
  // Saving throws - modifiers (in column)
  salvacion_fue_mod: { x: 282, y: 683, width: 100, fontSize: 30, align: 'center' },
  salvacion_des_mod: { x: 282, y: 715, width: 100, fontSize: 30, align: 'center' },
  salvacion_con_mod: { x: 282, y: 746, width: 100, fontSize: 30, align: 'center' },
  salvacion_int_mod: { x: 282, y: 778, width: 100, fontSize: 30, align: 'center' },
  salvacion_sab_mod: { x: 282, y: 809, width: 100, fontSize: 30, align: 'center' },
  salvacion_car_mod: { x: 282, y: 840, width: 100, fontSize: 30, align: 'center' },
  
  // Saving throws - competency checkboxes (x if proficient)
  comp_salvacion_fue: { x: 215, y: 683, width: 30, fontSize: 24, align: 'center' },
  comp_salvacion_des: { x: 215, y: 715, width: 30, fontSize: 24, align: 'center' },
  comp_salvacion_con: { x: 215, y: 746, width: 30, fontSize: 24, align: 'center' },
  comp_salvacion_int: { x: 215, y: 778, width: 30, fontSize: 24, align: 'center' },
  comp_salvacion_sab: { x: 215, y: 809, width: 30, fontSize: 24, align: 'center' },
  comp_salvacion_car: { x: 215, y: 840, width: 30, fontSize: 24, align: 'center' },
  
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
  comp_hab_acertijos: { x: 215, y: 992, width: 30, fontSize: 24, align: 'center' },
  comp_hab_acrobacias: { x: 215, y: 1023, width: 30, fontSize: 24, align: 'center' },
  comp_hab_atletismo: { x: 215, y: 1054, width: 30, fontSize: 24, align: 'center' },
  comp_hab_cazar: { x: 215, y: 1085, width: 30, fontSize: 24, align: 'center' },
  comp_hab_engano: { x: 215, y: 1116, width: 30, fontSize: 24, align: 'center' },
  comp_hab_explorar: { x: 215, y: 1147, width: 30, fontSize: 24, align: 'center' },
  comp_hab_interpretacion: { x: 215, y: 1178, width: 30, fontSize: 24, align: 'center' },
  comp_hab_intimidacion: { x: 215, y: 1209, width: 30, fontSize: 24, align: 'center' },
  comp_hab_investigacion: { x: 215, y: 1240, width: 30, fontSize: 24, align: 'center' },
  comp_hab_juego_manos: { x: 215, y: 1271, width: 30, fontSize: 24, align: 'center' },
  comp_hab_medicina: { x: 215, y: 1302, width: 30, fontSize: 24, align: 'center' },
  comp_hab_naturaleza: { x: 215, y: 1333, width: 30, fontSize: 24, align: 'center' },
  comp_hab_percepcion: { x: 215, y: 1364, width: 30, fontSize: 24, align: 'center' },
  comp_hab_perspicacia: { x: 215, y: 1395, width: 30, fontSize: 24, align: 'center' },
  comp_hab_persuasion: { x: 215, y: 1426, width: 30, fontSize: 24, align: 'center' },
  comp_hab_saber_antiguo: { x: 215, y: 1457, width: 30, fontSize: 24, align: 'center' },
  comp_hab_sigilo: { x: 215, y: 1488, width: 30, fontSize: 24, align: 'center' },
  comp_hab_trato_animales: { x: 215, y: 1519, width: 30, fontSize: 24, align: 'center' },
  comp_hab_viajar: { x: 215, y: 1550, width: 30, fontSize: 24, align: 'center' },
  
  // Monedas - campos separados
  monedas_estano: { x: 1150, y: 1725, width: 80, fontSize: 28, align: 'center' },
  monedas_cobre: { x: 1250, y: 1725, width: 80, fontSize: 28, align: 'center' },
  monedas_plata: { x: 1350, y: 1725, width: 80, fontSize: 28, align: 'center' },
  monedas_oro: { x: 1450, y: 1725, width: 80, fontSize: 28, align: 'center' },
  
  // Equipo - 20 filas (from y:1725, spacing ~26px para caber más)
  equipo_1: { x: 771, y: 1725, width: 298, fontSize: 18, align: 'left' },
  equipo_2: { x: 771, y: 1751, width: 298, fontSize: 18, align: 'left' },
  equipo_3: { x: 771, y: 1777, width: 298, fontSize: 18, align: 'left' },
  equipo_4: { x: 771, y: 1803, width: 298, fontSize: 18, align: 'left' },
  equipo_5: { x: 771, y: 1829, width: 298, fontSize: 18, align: 'left' },
  equipo_6: { x: 771, y: 1855, width: 298, fontSize: 18, align: 'left' },
  equipo_7: { x: 771, y: 1881, width: 298, fontSize: 18, align: 'left' },
  equipo_8: { x: 771, y: 1907, width: 298, fontSize: 18, align: 'left' },
  equipo_9: { x: 771, y: 1933, width: 298, fontSize: 18, align: 'left' },
  equipo_10: { x: 771, y: 1959, width: 298, fontSize: 18, align: 'left' },
  equipo_11: { x: 771, y: 1985, width: 298, fontSize: 18, align: 'left' },
  equipo_12: { x: 771, y: 2011, width: 298, fontSize: 18, align: 'left' },
  equipo_13: { x: 771, y: 2037, width: 298, fontSize: 18, align: 'left' },
  equipo_14: { x: 771, y: 2063, width: 298, fontSize: 18, align: 'left' },
  equipo_15: { x: 771, y: 2089, width: 298, fontSize: 18, align: 'left' },
  equipo_16: { x: 771, y: 2115, width: 298, fontSize: 18, align: 'left' },
  equipo_17: { x: 771, y: 2141, width: 298, fontSize: 18, align: 'left' },
  equipo_18: { x: 771, y: 2167, width: 298, fontSize: 18, align: 'left' },
  equipo_19: { x: 1100, y: 1725, width: 298, fontSize: 18, align: 'left' }, // Segunda columna
  equipo_20: { x: 1100, y: 1751, width: 298, fontSize: 18, align: 'left' },
  
  // Armas - 5 filas (Nombre | Daño | Herida | Distancia)
  // Posiciones tentativas - el usuario las ajustará con el editor
  arma_1_nombre: { x: 430, y: 1725, width: 120, fontSize: 18, align: 'left' },
  arma_1_dano: { x: 560, y: 1725, width: 50, fontSize: 18, align: 'center' },
  arma_1_herida: { x: 620, y: 1725, width: 40, fontSize: 18, align: 'center' },
  arma_1_distancia: { x: 670, y: 1725, width: 60, fontSize: 18, align: 'center' },
  
  arma_2_nombre: { x: 430, y: 1755, width: 120, fontSize: 18, align: 'left' },
  arma_2_dano: { x: 560, y: 1755, width: 50, fontSize: 18, align: 'center' },
  arma_2_herida: { x: 620, y: 1755, width: 40, fontSize: 18, align: 'center' },
  arma_2_distancia: { x: 670, y: 1755, width: 60, fontSize: 18, align: 'center' },
  
  arma_3_nombre: { x: 430, y: 1785, width: 120, fontSize: 18, align: 'left' },
  arma_3_dano: { x: 560, y: 1785, width: 50, fontSize: 18, align: 'center' },
  arma_3_herida: { x: 620, y: 1785, width: 40, fontSize: 18, align: 'center' },
  arma_3_distancia: { x: 670, y: 1785, width: 60, fontSize: 18, align: 'center' },
  
  arma_4_nombre: { x: 430, y: 1815, width: 120, fontSize: 18, align: 'left' },
  arma_4_dano: { x: 560, y: 1815, width: 50, fontSize: 18, align: 'center' },
  arma_4_herida: { x: 620, y: 1815, width: 40, fontSize: 18, align: 'center' },
  arma_4_distancia: { x: 670, y: 1815, width: 60, fontSize: 18, align: 'center' },
  
  arma_5_nombre: { x: 430, y: 1845, width: 120, fontSize: 18, align: 'left' },
  arma_5_dano: { x: 560, y: 1845, width: 50, fontSize: 18, align: 'center' },
  arma_5_herida: { x: 620, y: 1845, width: 40, fontSize: 18, align: 'center' },
  arma_5_distancia: { x: 670, y: 1845, width: 60, fontSize: 18, align: 'center' },
  
  // Idiomas y herramientas - 6 filas (from y:1836 to y:2043, spacing ~41px)
  idioma_herr_1: { x: 109, y: 1836, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_2: { x: 109, y: 1877, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_3: { x: 109, y: 1918, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_4: { x: 109, y: 1959, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_5: { x: 109, y: 2000, width: 435, fontSize: 22, align: 'left' },
  idioma_herr_6: { x: 109, y: 2041, width: 435, fontSize: 22, align: 'left' },
};

// Handwritten style font
const FONT_STYLE = "'Caveat', 'Ink Free', cursive";

// Display field component
const DisplayField = ({ value, x, y, width, scale, fontSize = 14, align = 'center' }) => (
  <div
    className="absolute text-black whitespace-nowrap overflow-hidden"
    style={{
      left: `${x * scale}px`,
      top: `${y * scale}px`,
      width: `${width * scale}px`,
      fontSize: `${fontSize * scale}px`,
      textAlign: align,
      fontFamily: FONT_STYLE,
      lineHeight: 1.1,
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

  // Load character data
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        setLoading(true);
        const data = await getCharacter(characterId);
        setCharacter(data);
      } catch (err) {
        console.error('Error loading character:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
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

  // Get attributes
  const attrs = character.caracteristicas || character.atributos_finales || {};
  const bonificadorCompetencia = character.bonificador_competencia || 2;
  const nivel = character.nivel || 1;
  
  // Get proficiencies (skills with competence)
  const competenciasHabilidades = [
    ...(character.competencias_habilidades_cultura || []),
    ...(character.competencia_habilidad_cultura ? [character.competencia_habilidad_cultura] : []),
    ...(character.competencias_habilidades_trasfondo || []),
    ...(character.habilidades_elegidas_ocupacion || []),
  ].map(s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'));
  
  // Get expertise (pericia)
  const periciasHabilidades = (character.pericia_elegida || [])
    .map(s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'));
  
  // Saving throw proficiencies (typically from occupation)
  const salvacionesCompetentes = character.salvaciones_competentes || [];
  
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
  
  // Get equipment rows (20 rows, excluding weapons)
  const getEquipmentRows = () => {
    const equipment = getAllEquipment();
    const rows = [];
    for (let i = 0; i < 20; i++) {
      rows.push(equipment[i] || '');
    }
    return rows;
  };
  
  // Get weapons with details (5 max)
  const getWeapons = () => {
    // Get weapons from character data
    const weaponItems = [];
    
    // Check inventario for weapons with details
    const inventario = character.inventario || [];
    inventario.forEach(item => {
      const nombre = typeof item === 'string' ? item : item.nombre;
      if (isWeapon(nombre)) {
        weaponItems.push({
          nombre: nombre,
          dano: item.dano || item.daño || '1d4',
          herida: item.herida || 12,
          distancia: item.distancia || 'C/C',
        });
      }
    });
    
    // Check equipo_ocupacion for weapons
    (character.equipo_ocupacion || []).forEach(item => {
      if (isWeapon(item) && !weaponItems.some(w => w.nombre.toLowerCase() === item.toLowerCase())) {
        weaponItems.push({
          nombre: item,
          dano: '1d6', // Default
          herida: 12,
          distancia: 'C/C',
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
  
  // Get languages and tools (split into 6 rows)
  const getIdiomasHerramientasRows = () => {
    const items = [
      ...(character.idiomas || []),
      ...(character.competencia_herramienta_1 ? [character.competencia_herramienta_1] : []),
      ...(character.competencias_herramientas_2 || []),
      ...(character.competencias_herramientas_trasfondo || []),
    ];
    const rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push(items[i] || '');
    }
    return rows;
  };
  
  // Get money
  const dinero = character.dinero || { mp: 0, mo: 0, me: 0, mc: 0 };
  
  // Calculate passive perception
  const percepcionPasiva = 10 + parseInt(getSkillMod('percepcion').replace('+', ''));
  
  // Get rasgo distintivo text
  const rasgoDistintivo = typeof character.rasgo_distintivo === 'object' 
    ? character.rasgo_distintivo?.nombre 
    : character.rasgo_distintivo || '';

  const equipmentRows = getEquipmentRows();
  const idiomasRows = getIdiomasHerramientasRows();
  const weapons = getWeapons();

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
                <DisplayField {...PAGE1_FIELDS.ocupacion_nivel} value={`${character.vocacion_nombre || ''} ${nivel}`} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.rasgos_distintivos} value={rasgoDistintivo} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.jugador} value={character.jugador || ''} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.cultura} value={character.cultura_nombre || ''} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.senda_sombra} value={character.senda_sombra || ''} scale={scale} />
                
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
                <DisplayField {...PAGE1_FIELDS.pg_max} value={character.puntos_golpe_max || 8} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.pg_actual} value={character.puntos_golpe_actual || character.puntos_golpe_max || 8} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.pg_temp} value={character.puntos_golpe_temp || 0} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.dado_golpe} value={character.dado_golpe || '1d8'} scale={scale} />
                
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
                
                {/* Equipo (8 rows) */}
                <DisplayField {...PAGE1_FIELDS.equipo_1} value={equipmentRows[0]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_2} value={equipmentRows[1]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_3} value={equipmentRows[2]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_4} value={equipmentRows[3]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_5} value={equipmentRows[4]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_6} value={equipmentRows[5]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_7} value={equipmentRows[6]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.equipo_8} value={equipmentRows[7]} scale={scale} />
                
                {/* Idiomas y Herramientas (6 rows) */}
                <DisplayField {...PAGE1_FIELDS.idioma_herr_1} value={idiomasRows[0]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_2} value={idiomasRows[1]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_3} value={idiomasRows[2]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_4} value={idiomasRows[3]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_5} value={idiomasRows[4]} scale={scale} />
                <DisplayField {...PAGE1_FIELDS.idioma_herr_6} value={idiomasRows[5]} scale={scale} />
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
