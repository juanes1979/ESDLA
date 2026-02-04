/**
 * Character Sheet Page 1 Component
 * Renders the first page of the character sheet with all stats and skills
 */
import { cn } from '@/lib/utils';

// Handwritten style font
const FONT_STYLE = "'Caveat', 'Ink Free', cursive";

// Display field component - supports multiline with height parameter
export const DisplayField = ({ value, x, y, width, scale, fontSize = 14, align = 'center', height = null, multiline = false }) => (
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

// PAGE 1 FIELD POSITIONS
export const PAGE1_FIELDS = {
  // Basic Info
  nombre: { x: 89, y: 184, width: 630, fontSize: 45, align: 'center' },
  ocupacion_nivel: { x: 757, y: 142, width: 260, fontSize: 31, align: 'left' },
  jugador: { x: 983, y: 43, width: 600, fontSize: 50, align: 'center' },
  cultura: { x: 757, y: 220, width: 260, fontSize: 31, align: 'left' },
  senda_sombra: { x: 1182, y: 514, width: 445, fontSize: 31, align: 'left' },
  
  // Rasgos distintivos (2 con descripción) - descripción es multilinea
  rasgos_distintivos_1: { x: 1336, y: 1007, width: 260, fontSize: 31, align: 'left' },
  rasgos_distintivos_2: { x: 1336, y: 1244, width: 260, fontSize: 31, align: 'left' },
  descripcion_rasgos_distintivos_1: { x: 1179, y: 1056, width: 437, fontSize: 35, align: 'left', height: 180, multiline: true },
  descripcion_rasgos_distintivos_2: { x: 1179, y: 1289, width: 437, fontSize: 35, align: 'left', height: 180, multiline: true },
  
  // Habilidades favorecidas (3)
  habilidad_favorecida_1: { x: 1228, y: 237, width: 117, fontSize: 16, align: 'left' },
  habilidad_favorecida_2: { x: 1352, y: 237, width: 117, fontSize: 16, align: 'left' },
  habilidad_favorecida_3: { x: 1485, y: 237, width: 117, fontSize: 16, align: 'left' },
  
  // Características físicas
  edad: { x: 1059, y: 148, width: 49, fontSize: 30, align: 'left' },
  altura: { x: 1130, y: 148, width: 77, fontSize: 30, align: 'left' },
  peso: { x: 1228, y: 148, width: 77, fontSize: 30, align: 'left' },
  ojos: { x: 1334, y: 156, width: 93, fontSize: 20, align: 'left' },
  piel: { x: 1434, y: 156, width: 93, fontSize: 20, align: 'left' },
  pelo: { x: 1518, y: 156, width: 93, fontSize: 20, align: 'left' },
  sexo: { x: 376, y: 261, width: 137, fontSize: 40, align: 'center' },
  
  // Attributes - Main values
  fuerza_valor: { x: 95, y: 332, width: 107, fontSize: 100, align: 'center' },
  destreza_valor: { x: 95, y: 552, width: 107, fontSize: 100, align: 'center' },
  constitucion_valor: { x: 95, y: 772, width: 105, fontSize: 100, align: 'center' },
  inteligencia_valor: { x: 95, y: 992, width: 107, fontSize: 100, align: 'center' },
  sabiduria_valor: { x: 93, y: 1212, width: 107, fontSize: 100, align: 'center' },
  carisma_valor: { x: 95, y: 1432, width: 107, fontSize: 100, align: 'center' },
  
  // Attributes - Modifiers
  fuerza_mod: { x: 91, y: 447, width: 100, fontSize: 55, align: 'center' },
  destreza_mod: { x: 91, y: 663, width: 100, fontSize: 55, align: 'center' },
  constitucion_mod: { x: 91, y: 883, width: 100, fontSize: 55, align: 'center' },
  inteligencia_mod: { x: 91, y: 1103, width: 100, fontSize: 55, align: 'center' },
  sabiduria_mod: { x: 91, y: 1322, width: 100, fontSize: 55, align: 'center' },
  carisma_mod: { x: 91, y: 1539, width: 100, fontSize: 55, align: 'center' },
  
  // Combat stats
  inspiracion: { x: 250, y: 345, width: 100, fontSize: 65, align: 'center' },
  bonificador_competencia: { x: 250, y: 486, width: 100, fontSize: 65, align: 'center' },
  clase_armadura: { x: 657, y: 360, width: 100, fontSize: 65, align: 'center' },
  iniciativa: { x: 808, y: 360, width: 100, fontSize: 65, align: 'center' },
  velocidad: { x: 949, y: 360, width: 120, fontSize: 65, align: 'center' },
  
  // Hit points
  pg_max: { x: 707, y: 508, width: 80, fontSize: 50, align: 'center' },
  pg_actual: { x: 689, y: 646, width: 110, fontSize: 70, align: 'center' },
  pg_temp: { x: 901, y: 585, width: 110, fontSize: 70, align: 'center' },
  dado_golpe: { x: 682, y: 807, width: 120, fontSize: 65, align: 'center' },
  
  percepcion_pasiva: { x: 78, y: 1679, width: 100, fontSize: 65, align: 'center' },
  
  // Peso y estorbo
  peso_transportado: { x: 1190, y: 377, width: 106, fontSize: 42, align: 'center' },
  cargado: { x: 1337, y: 368, width: 23, fontSize: 30, align: 'left' },
  muy_cargado: { x: 1337, y: 418, width: 23, fontSize: 30, align: 'left' },
  
  // Saving throws - modifiers
  salvacion_fue_mod: { x: 282, y: 683, width: 100, fontSize: 30, align: 'center' },
  salvacion_des_mod: { x: 282, y: 715, width: 100, fontSize: 30, align: 'center' },
  salvacion_con_mod: { x: 282, y: 746, width: 100, fontSize: 30, align: 'center' },
  salvacion_int_mod: { x: 282, y: 778, width: 100, fontSize: 30, align: 'center' },
  salvacion_sab_mod: { x: 282, y: 809, width: 100, fontSize: 30, align: 'center' },
  salvacion_car_mod: { x: 282, y: 840, width: 100, fontSize: 30, align: 'center' },
  
  // Saving throws - competency checkboxes
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
  
  // Skills - competency checkboxes
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
  
  // Monedas
  monedas_cobre: { x: 653, y: 1733, width: 60, fontSize: 40, align: 'center' },
  monedas_plata: { x: 653, y: 1854, width: 60, fontSize: 40, align: 'center' },
  monedas_oro: { x: 653, y: 1975, width: 60, fontSize: 40, align: 'center' },
  monedas_estano: { x: 680, y: 2086, width: 60, fontSize: 40, align: 'center' },
  
  // Equipo - 8 filas (página 1)
  equipo_1: { x: 771, y: 1725, width: 298, fontSize: 22, align: 'left' },
  equipo_2: { x: 771, y: 1772, width: 298, fontSize: 22, align: 'left' },
  equipo_3: { x: 771, y: 1818, width: 298, fontSize: 22, align: 'left' },
  equipo_4: { x: 771, y: 1867, width: 298, fontSize: 22, align: 'left' },
  equipo_5: { x: 771, y: 1915, width: 298, fontSize: 22, align: 'left' },
  equipo_6: { x: 771, y: 1957, width: 298, fontSize: 22, align: 'left' },
  equipo_7: { x: 771, y: 2002, width: 298, fontSize: 22, align: 'left' },
  equipo_8: { x: 771, y: 2040, width: 298, fontSize: 22, align: 'left' },
  
  // Armas - 5 filas
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

// Lista de nombres de armas conocidas
const WEAPON_NAMES = [
  'bastón', 'garrote', 'gran garrote', 'hacha', 'hoz', 'maza', 'martillo', 'daga',
  'hacha de mano', 'lanza', 'lanza corta', 'arco', 'espada', 'espada corta', 
  'espada larga', 'cimitarra', 'estoque', 'flajelo', 'hacha a dos manos',
  'lanza de caballería', 'látigo', 'gran hacha', 'hacha de guerra', 'lanza pesada',
  'martillo pesado', 'piqueta', 'arco largo', 'ballesta'
];

// Weapon stats lookup
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

// Calculate modifier from attribute value
const getModifier = (value) => {
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

// Check if item is a weapon
const isWeapon = (itemName) => {
  if (!itemName) return false;
  const normalized = itemName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return WEAPON_NAMES.some(w => normalized.includes(w));
};

const SheetPage1 = ({ character, scale, weaponCatalog = [], equipmentCatalog = {} }) => {
  // Get attributes
  const attrs = character.atributos || character.caracteristicas || character.atributos_finales || {};
  const bonificadorCompetencia = character.bonificador_competencia || 2;
  const nivel = character.nivel || 1;
  
  // Get proficiencies
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
    const cleaned = s.replace(/\s*\([^)]*\)\s*/g, '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    return cleaned;
  }).filter(s => s);
  
  const periciasHabilidades = (character.pericia_elegida || [])
    .map(s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'));
  
  const salvacionesCompetentes = character.salvaciones_competentes || 
    character.competencias?.tiradas_salvacion || [];
  
  // Calculate skill modifier
  const getSkillMod = (skillKey) => {
    const attrName = SKILL_ATTRIBUTES[skillKey];
    const attrValue = attrs[attrName] || 10;
    const baseMod = Math.floor((attrValue - 10) / 2);
    let totalMod = baseMod;
    if (competenciasHabilidades.includes(skillKey)) totalMod += bonificadorCompetencia;
    if (periciasHabilidades.includes(skillKey)) totalMod += bonificadorCompetencia;
    return totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
  };
  
  const getSkillCompMark = (skillKey) => {
    if (periciasHabilidades.includes(skillKey)) return 'P';
    if (competenciasHabilidades.includes(skillKey)) return 'x';
    return '';
  };
  
  const getSavingMod = (attrName) => {
    const attrValue = attrs[attrName] || 10;
    const baseMod = Math.floor((attrValue - 10) / 2);
    const isProficient = salvacionesCompetentes.some(s => 
      s?.toLowerCase().includes(attrName.substring(0, 3))
    );
    let totalMod = baseMod;
    if (isProficient) totalMod += bonificadorCompetencia;
    return totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
  };
  
  const getSavingCompMark = (attrName) => {
    const isProficient = salvacionesCompetentes.some(s => 
      s?.toLowerCase().includes(attrName.substring(0, 3))
    );
    return isProficient ? 'x' : '';
  };
  
  // Get weapon stats
  const getWeaponStats = (weaponName) => {
    const normalized = weaponName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const weapon of weaponCatalog) {
      const catalogName = weapon.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (catalogName === normalized || normalized.includes(catalogName) || catalogName.includes(normalized)) {
        return { dano: weapon.dano || '1d4', herida: weapon.herida || 12, distancia: weapon.distancia || 'C/C' };
      }
    }
    if (WEAPON_STATS[normalized]) return WEAPON_STATS[normalized];
    for (const [key, stats] of Object.entries(WEAPON_STATS)) {
      if (normalized.includes(key) || key.includes(normalized)) return stats;
    }
    return { dano: '1d4', herida: 12, distancia: 'C/C' };
  };
  
  // Get all equipment items (excluding weapons)
  const getAllEquipment = () => {
    const allItems = [
      ...(character.inventario || []).map(i => typeof i === 'string' ? i : i.nombre),
      ...(character.equipo_ocupacion || []),
      ...(character.equipo_trasfondo || []),
      ...(character.equipo_nivel_vida || []),
    ];
    return allItems.filter(item => !isWeapon(item));
  };
  
  const getEquipmentRows = () => {
    const equipment = getAllEquipment();
    return Array.from({ length: 8 }, (_, i) => equipment[i] || '');
  };
  
  // Get weapons (5 max)
  const getWeapons = () => {
    const weaponItems = [];
    (character.armas_elegidas || []).forEach(arma => {
      const nombre = typeof arma === 'string' ? arma : arma.nombre;
      if (nombre && !weaponItems.some(w => w.nombre.toLowerCase() === nombre.toLowerCase())) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: stats.dano, herida: stats.herida, distancia: stats.distancia });
      }
    });
    (character.inventario || []).forEach(item => {
      const nombre = typeof item === 'string' ? item : item.nombre;
      if (isWeapon(nombre) && !weaponItems.some(w => w.nombre.toLowerCase() === nombre.toLowerCase())) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: item.dano || stats.dano, herida: item.herida || stats.herida, distancia: item.distancia || stats.distancia });
      }
    });
    (character.equipo_ocupacion || []).forEach(item => {
      const nombre = typeof item === 'string' ? item : item;
      if (isWeapon(nombre) && !weaponItems.some(w => w.nombre.toLowerCase() === nombre.toLowerCase())) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: stats.dano, herida: stats.herida, distancia: stats.distancia });
      }
    });
    return Array.from({ length: 5 }, (_, i) => weaponItems[i] || { nombre: '', dano: '', herida: '', distancia: '' });
  };
  
  // Get languages and tools
  const getIdiomasHerramientasRows = () => {
    const idiomas = character.competencias?.idiomas || character.idiomas || [];
    const herramientas = [
      ...(character.competencia_herramienta_cultura ? [character.competencia_herramienta_cultura] : []),
      ...(character.herramienta_elegida_cultura ? [character.herramienta_elegida_cultura] : []),
      ...(character.competencia_herramienta_1 ? [character.competencia_herramienta_1] : []),
      ...(character.competencias_herramientas_2 || []),
      ...(character.competencias?.herramientas || []),
      ...(character.competencias?.herramientas_cultura || []),
      ...(character.herramientas_elegidas_ocupacion || []),
      ...(character.competencias_herramientas_trasfondo || []),
    ];
    const uniqueHerramientas = [...new Set(herramientas.filter(h => h))];
    const items = [...idiomas, ...uniqueHerramientas];
    return Array.from({ length: 7 }, (_, i) => items[i] || '');
  };
  
  // Get rasgos distintivos
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
  
  // Get habilidades favorecidas
  const getHabilidadesFavorecidas = () => {
    const favorecidas = character.habilidades_favorecidas || character.pericia_elegida || [];
    return { hab1: favorecidas[0] || '', hab2: favorecidas[1] || '', hab3: favorecidas[2] || '' };
  };
  
  // Helper function to find item weight
  const getItemWeight = (itemName) => {
    if (!itemName) return 0;
    const normalizedName = itemName.toLowerCase().trim();
    const allItems = [
      ...(equipmentCatalog.equipo_general || []),
      ...(equipmentCatalog.herramientas || []),
      ...(equipmentCatalog.armas || []),
      ...(equipmentCatalog.armaduras || []),
    ];
    for (const item of allItems) {
      const catalogName = (item.nombre || '').toLowerCase().trim();
      if (catalogName === normalizedName || normalizedName.includes(catalogName) || catalogName.includes(normalizedName)) {
        return item.peso_kg || 0;
      }
    }
    return 0;
  };
  
  // Calculate peso transportado
  const calcularPesoTransportado = () => {
    let pesoTotal = 0;
    (character.inventario || []).forEach(item => {
      const nombre = typeof item === 'string' ? item : item.nombre;
      const cantidad = typeof item === 'object' ? (item.cantidad || 1) : 1;
      if (typeof item === 'object' && item.peso) {
        pesoTotal += (parseFloat(item.peso) || 0) * cantidad;
      } else {
        pesoTotal += getItemWeight(nombre) * cantidad;
      }
    });
    (character.equipo_ocupacion || []).forEach(item => {
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    (character.herramientas_elegidas_ocupacion || []).forEach(item => {
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    (character.armas_elegidas || []).forEach(item => {
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    if (character.armadura_elegida) {
      (character.armadura_elegida || []).forEach(item => {
        pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
      });
    }
    const dinero = character.dinero || {};
    const totalMonedas = (dinero.mp || 0) + (dinero.mo || 0) + (dinero.me || 0) + (dinero.mc || 0);
    pesoTotal += totalMonedas * 0.009;
    return pesoTotal.toFixed(2);
  };
  
  // Calculate estorbo
  const calcularEstorbo = () => {
    const pesoTotal = parseFloat(calcularPesoTransportado());
    const fuerza = attrs.fuerza || 10;
    const limiteCargado = fuerza * 2.5;
    const limiteMuyCargado = fuerza * 4;
    return {
      cargado: pesoTotal > limiteCargado ? 'x' : '',
      muy_cargado: pesoTotal > limiteMuyCargado ? 'x' : '',
    };
  };
  
  const dinero = character.dinero || { mp: 0, mo: 0, me: 0, mc: 0 };
  const percepcionPasiva = 10 + parseInt(getSkillMod('percepcion').replace('+', ''));
  
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
    <>
      {/* Basic Info */}
      <DisplayField {...PAGE1_FIELDS.nombre} value={character.nombre} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.ocupacion_nivel} value={`${character.ocupacion_nombre || character.vocacion_nombre || ''} ${nivel}`} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.jugador} value={character.jugador || ''} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.cultura} value={character.cultura_nombre || ''} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.senda_sombra} value={character.senda_sombra || ''} scale={scale} />
      
      {/* Rasgos distintivos */}
      <DisplayField {...PAGE1_FIELDS.rasgos_distintivos_1} value={rasgos.rasgo1_nombre} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.rasgos_distintivos_2} value={rasgos.rasgo2_nombre} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.descripcion_rasgos_distintivos_1} value={rasgos.rasgo1_desc} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.descripcion_rasgos_distintivos_2} value={rasgos.rasgo2_desc} scale={scale} />
      
      {/* Habilidades favorecidas */}
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
      
      {/* Saving Throws */}
      <DisplayField {...PAGE1_FIELDS.salvacion_fue_mod} value={getSavingMod('fuerza')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.salvacion_des_mod} value={getSavingMod('destreza')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.salvacion_con_mod} value={getSavingMod('constitucion')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.salvacion_int_mod} value={getSavingMod('inteligencia')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.salvacion_sab_mod} value={getSavingMod('sabiduria')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.salvacion_car_mod} value={getSavingMod('carisma')} scale={scale} />
      
      <DisplayField {...PAGE1_FIELDS.comp_salvacion_fue} value={getSavingCompMark('fuerza')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.comp_salvacion_des} value={getSavingCompMark('destreza')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.comp_salvacion_con} value={getSavingCompMark('constitucion')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.comp_salvacion_int} value={getSavingCompMark('inteligencia')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.comp_salvacion_sab} value={getSavingCompMark('sabiduria')} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.comp_salvacion_car} value={getSavingCompMark('carisma')} scale={scale} />
      
      {/* Skills */}
      {['acertijos', 'acrobacias', 'atletismo', 'cazar', 'engano', 'explorar', 'interpretacion', 
        'intimidacion', 'investigacion', 'juego_manos', 'medicina', 'naturaleza', 'percepcion', 
        'perspicacia', 'persuasion', 'saber_antiguo', 'sigilo', 'trato_animales', 'viajar'].map(skill => (
        <DisplayField key={`hab_${skill}`} {...PAGE1_FIELDS[`hab_${skill}`]} value={getSkillMod(skill)} scale={scale} />
      ))}
      
      {['acertijos', 'acrobacias', 'atletismo', 'cazar', 'engano', 'explorar', 'interpretacion', 
        'intimidacion', 'investigacion', 'juego_manos', 'medicina', 'naturaleza', 'percepcion', 
        'perspicacia', 'persuasion', 'saber_antiguo', 'sigilo', 'trato_animales', 'viajar'].map(skill => (
        <DisplayField key={`comp_hab_${skill}`} {...PAGE1_FIELDS[`comp_hab_${skill}`]} value={getSkillCompMark(skill)} scale={scale} />
      ))}
      
      {/* Monedas */}
      <DisplayField {...PAGE1_FIELDS.monedas_estano} value={dinero.me || 0} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.monedas_cobre} value={dinero.mc || 0} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.monedas_plata} value={dinero.mp || 0} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.monedas_oro} value={dinero.mo || 0} scale={scale} />
      
      {/* Equipo */}
      {equipmentRows.map((item, i) => (
        <DisplayField key={`equipo_${i+1}`} {...PAGE1_FIELDS[`equipo_${i+1}`]} value={item} scale={scale} />
      ))}
      
      {/* Armas */}
      {weapons.map((weapon, i) => (
        <span key={`weapon_group_${i}`}>
          <DisplayField {...PAGE1_FIELDS[`arma_${i+1}_nombre`]} value={weapon.nombre} scale={scale} />
          <DisplayField {...PAGE1_FIELDS[`arma_${i+1}_dano`]} value={weapon.dano} scale={scale} />
          <DisplayField {...PAGE1_FIELDS[`arma_${i+1}_herida`]} value={weapon.herida} scale={scale} />
          <DisplayField {...PAGE1_FIELDS[`arma_${i+1}_distancia`]} value={weapon.distancia} scale={scale} />
        </span>
      ))}
      
      {/* Peso y estorbo */}
      <DisplayField {...PAGE1_FIELDS.peso_transportado} value={pesoTransportado} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.cargado} value={estorbo.cargado} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.muy_cargado} value={estorbo.muy_cargado} scale={scale} />
      
      {/* Idiomas y Herramientas */}
      {idiomasRows.map((item, i) => (
        <DisplayField key={`idioma_herr_${i+1}`} {...PAGE1_FIELDS[`idioma_herr_${i+1}`]} value={item} scale={scale} />
      ))}
    </>
  );
};

export default SheetPage1;
