/**
 * Character Sheet Page 1 Component
 * Renders the first page of the character sheet with all stats and skills
 */
import { cn } from '@/lib/utils';
import { useRef, useLayoutEffect, useState } from 'react';

// Handwritten style font
const FONT_STYLE = "'Caveat', 'Ink Free', cursive";

// Display field component - supports multiline with height parameter
export const DisplayField = ({ value, x, y, width, scale, fontSize = 14, align = 'center', height = null, multiline = false }) => {
  const styles = {
    position: 'absolute',
    left: `${x * scale}px`,
    top: `${y * scale}px`,
    width: `${width * scale}px`,
    fontSize: `${fontSize * scale}px`,
    textAlign: align,
    fontFamily: FONT_STYLE,
    lineHeight: 1.3,
    color: 'black',
  };
  
  if (multiline) {
    styles.height = height ? `${height * scale}px` : 'auto';
    styles.whiteSpace = 'pre-line';
    styles.wordWrap = 'break-word';
    styles.overflowWrap = 'break-word';
    styles.overflow = 'hidden';
  } else {
    styles.whiteSpace = 'nowrap';
    styles.overflow = 'hidden';
    styles.textOverflow = 'ellipsis';
  }
  
  return <div style={styles}>{value}</div>;
};

/**
 * AutoFitField — como DisplayField pero AJUSTA el tamaño de letra automáticamente
 * para que TODO el texto quepa dentro del recuadro (ancho × alto) definido en el
 * Editor de posiciones. Reduce el tamaño de fuente hasta que el contenido deja de
 * desbordar (o hasta un mínimo). Se usa para `descripcion_ocupacion_larga`.
 */
export const AutoFitField = ({ value, x, y, width, height, scale, fontSize = 40, align = 'left', minFontSize = 10 }) => {
  const ref = useRef(null);
  const [fittedSize, setFittedSize] = useState(fontSize);
  const [fontsNonce, setFontsNonce] = useState(0);

  // Vuelve a medir cuando la fuente caligráfica (Caveat) termina de cargarse,
  // para que el ajuste sea exacto también en la exportación a PDF.
  useLayoutEffect(() => {
    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (!cancelled) setFontsNonce((n) => n + 1); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !height) {
      setFittedSize(fontSize);
      return;
    }
    const boxH = height * scale;
    // Empieza por el tamaño máximo y reduce hasta que el contenido cabe en el alto.
    let size = fontSize * scale;
    const minPx = minFontSize * scale;
    el.style.fontSize = `${size}px`;
    let guard = 0;
    while (el.scrollHeight > boxH && size > minPx && guard < 400) {
      size -= 1;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFittedSize(size / scale);
  }, [value, width, height, scale, fontSize, minFontSize, fontsNonce]);

  const styles = {
    position: 'absolute',
    left: `${x * scale}px`,
    top: `${y * scale}px`,
    width: `${width * scale}px`,
    height: height ? `${height * scale}px` : 'auto',
    fontSize: `${fittedSize * scale}px`,
    textAlign: align,
    fontFamily: FONT_STYLE,
    lineHeight: 1.3,
    color: 'black',
    whiteSpace: 'pre-line',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    overflow: 'hidden',
  };

  return <div ref={ref} style={styles}>{value}</div>;
};

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
  // Código público RAZSUBCAAXXXXX, esquina superior derecha
  codigo_publico: { x: 1310, y: 45, width: 420, fontSize: 21, align: 'right' },
  // Código único del PJ — campo posicionable e independiente (movible desde el
  // Editor de posiciones). Ancho generoso y dentro de la hoja para que salga entero.
  CODIGOUNICOPJ: { x: 1160, y: 55, width: 500, fontSize: 20, align: 'right' },
  // Campo de IMAGEN del retrato del personaje: posicionable y redimensionable
  // (ancho y alto) desde el Editor de posiciones.
  RETRATO: { x: 70, y: 120, width: 400, height: 600, fontSize: 14, align: 'left' },
  // Descripción de la virtud (texto completo: descripción + rasgos + bonos aplicados).
  DescripcionVirtud: { x: 60, y: 700, width: 520, height: 380, fontSize: 15, align: 'left' },
  
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
  peso_transportado: { x: 1190, y: 369, width: 106, fontSize: 42, align: 'center' },
  peso_montura: { x: 1186, y: 421, width: 116, fontSize: 24, align: 'center' },
  cargado: { x: 1337, y: 368, width: 23, fontSize: 30, align: 'left' },
  muy_cargado: { x: 1337, y: 418, width: 23, fontSize: 30, align: 'left' },
  
  // Montura - Campo para mostrar "MONTURA, PesoCargado/PesoMax"
  montura_peso: { x: 616, y: 1649, width: 492, fontSize: 32, align: 'left' },
  
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
  
  // Recompensas - 6 filas (armas/armadura/escudo con mejoras aplicadas)
  recompensa1: { x: 641, y: 1331, width: 439, fontSize: 22, align: 'left' },
  recompensa2: { x: 641, y: 1374, width: 439, fontSize: 22, align: 'left' },
  recompensa3: { x: 641, y: 1421, width: 439, fontSize: 22, align: 'left' },
  recompensa4: { x: 641, y: 1468, width: 439, fontSize: 22, align: 'left' },
  recompensa5: { x: 641, y: 1514, width: 439, fontSize: 22, align: 'left' },
  recompensa6: { x: 641, y: 1560, width: 439, fontSize: 22, align: 'left' },
  
  // Idiomas y herramientas - 7 filas
  idioma_herr_1: { x: 109, y: 1830, width: 435, fontSize: 31, align: 'left' },
  idioma_herr_2: { x: 109, y: 1869, width: 435, fontSize: 31, align: 'left' },
  idioma_herr_3: { x: 109, y: 1914, width: 435, fontSize: 31, align: 'left' },
  idioma_herr_4: { x: 109, y: 1955, width: 435, fontSize: 31, align: 'left' },
  idioma_herr_5: { x: 109, y: 2000, width: 435, fontSize: 31, align: 'left' },
  idioma_herr_6: { x: 109, y: 2038, width: 435, fontSize: 31, align: 'left' },
  idioma_herr_7: { x: 109, y: 2078, width: 435, fontSize: 31, align: 'left' },
  
  // Virtudes
  virtudes: { x: 1179, y: 1433, width: 437, fontSize: 30, align: 'left' },
  
  // Sombra - puntuación y cicatrices
  sombra_puntuacion: { x: 1199, y: 580, width: 80, fontSize: 80, align: 'center' },
  sombra_cicatrices: { x: 1354, y: 580, width: 80, fontSize: 80, align: 'left' },
  desanimado: { x: 1484, y: 614, width: 18, fontSize: 30, align: 'center' },
  angustiado: { x: 1484, y: 664, width: 18, fontSize: 30, align: 'center' },
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
  // Handle both string and object formats
  const name = typeof itemName === 'string' ? itemName : itemName?.nombre;
  if (!name) return false;
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return WEAPON_NAMES.some(w => normalized.includes(w));
};

const SheetPage1 = ({ character, scale, weaponCatalog = [], equipmentCatalog = {}, fieldPositions = {}, retratoFallback = true, weightSummary = null }) => {
  // Posición efectiva: usa la guardada en el Editor (BD) o el valor por defecto.
  const getPos = (key) => fieldPositions?.[key] || PAGE1_FIELDS[key] || { x: 0, y: 0, width: 100, fontSize: 14, align: 'left' };

  // Texto completo de la virtud para el campo DescripcionVirtud de la ficha.
  const buildVirtudTexto = () => {
    if (!character.virtud_nombre) return '';
    const partes = [character.virtud_nombre];
    if (character.virtud_descripcion) partes.push(character.virtud_descripcion);
    if (character.virtud_rasgos) partes.push(character.virtud_rasgos);
    const bonos = [];
    const fijas = character.virtud_caracteristicas_fijas || {};
    Object.entries(fijas).forEach(([k, v]) => { if (v) bonos.push(`+${v} ${String(k).toUpperCase().slice(0, 3)}`); });
    if (character.virtud_caracteristica_elegida) bonos.push(`+1 ${String(character.virtud_caracteristica_elegida).toUpperCase().slice(0, 3)}`);
    (character.virtud_habilidades_elegir || []).forEach((h) => h && bonos.push(`Competencia: ${h}`));
    (character.virtud_salvaciones_elegir || []).forEach((s) => s && bonos.push(`Salvación: ${s}`));
    (character.virtud_herramientas_elegir || []).forEach((t) => t && bonos.push(`Herramienta: ${t}`));
    if (character.virtud_pg_extra) bonos.push(`+${character.virtud_pg_extra} PG`);
    if (character.virtud_ca_extra) bonos.push(`+${character.virtud_ca_extra} CA`);
    if (character.virtud_comunidad_extra) bonos.push(`+${character.virtud_comunidad_extra} Comunidad`);
    if (bonos.length) partes.push('Efectos: ' + bonos.join(' · '));
    return partes.join('\n');
  };

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
  
  const salvacionesCompetentes = character.salvaciones_competencia ||
    character.salvaciones_competentes ||
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
    // Handle both string and object formats
    const name = typeof weaponName === 'string' ? weaponName : weaponName?.nombre;
    if (!name) return { dano: '1d4', herida: 12, distancia: 'C/C' };
    
    const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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
      ...(character.inventario || []).map(i => {
        const nombre = typeof i === 'string' ? i : i.nombre;
        const portado = typeof i === 'object' && i.portado_por === 'montura' ? ' (M)' : '';
        return nombre + portado;
      }),
      ...(character.equipo_ocupacion || []).map(i => typeof i === 'string' ? i : i.nombre),
      ...(character.equipo_trasfondo || []).map(i => typeof i === 'string' ? i : i.nombre),
      ...(character.equipo_nivel_vida || []).map(i => typeof i === 'string' ? i : i.nombre),
      ...(character.ropa_nivel_vida || []).map(i => typeof i === 'string' ? i : i.nombre),
    ];
    // Add mount if exists
    const montura = character.montura;
    if (montura && montura.nombre) {
      allItems.push(`🐴 ${montura.nombre} (${montura.capacidad_carga || 0}kg cap.)`);
    }
    return allItems.filter(item => item && !isWeapon(item));
  };
  
  const getEquipmentRows = () => {
    const equipment = getAllEquipment();
    return Array.from({ length: 8 }, (_, i) => equipment[i] || '');
  };
  
  // Get weapons (5 max) - ONLY weapons WITHOUT rewards
  // Weapons with rewards are shown in the recompensas section
  const getWeapons = () => {
    const weaponItems = [];
    
    // Helper to safely get name and check duplicates
    const getName = (item) => {
      if (!item) return null;
      return typeof item === 'string' ? item : item?.nombre;
    };
    
    const getMejoras = (item) => {
      if (!item || typeof item === 'string') return [];
      return item.mejoras || [];
    };
    
    const isDuplicate = (nombre) => {
      if (!nombre) return true;
      const normalized = nombre.toLowerCase();
      return weaponItems.some(w => w.nombre?.toLowerCase() === normalized);
    };
    
    // Check armas_elegidas first
    (character.armas_elegidas || []).forEach(arma => {
      const nombre = getName(arma);
      const mejoras = getMejoras(arma);
      // Skip if has mejoras (will be shown in recompensas section)
      if (nombre && !isDuplicate(nombre) && mejoras.length === 0) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: stats.dano, herida: stats.herida, distancia: stats.distancia, mejoras: [] });
      }
    });
    
    // Check inventario for weapons
    (character.inventario || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (isWeapon(nombre) && !isDuplicate(nombre) && mejoras.length === 0) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: item.dano || stats.dano, herida: item.herida || stats.herida, distancia: item.distancia || stats.distancia, mejoras: [] });
      }
    });
    
    // Check equipo_ocupacion for weapons
    (character.equipo_ocupacion || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (isWeapon(nombre) && !isDuplicate(nombre) && mejoras.length === 0) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: stats.dano, herida: stats.herida, distancia: stats.distancia, mejoras: [] });
      }
    });
    
    // Check equipo_trasfondo for weapons (like Bastón)
    (character.equipo_trasfondo || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (isWeapon(nombre) && !isDuplicate(nombre) && mejoras.length === 0) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: stats.dano, herida: stats.herida, distancia: stats.distancia, mejoras: [] });
      }
    });
    
    // Check equipo_nivel_vida for weapons
    (character.equipo_nivel_vida || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (isWeapon(nombre) && !isDuplicate(nombre) && mejoras.length === 0) {
        const stats = getWeaponStats(nombre);
        weaponItems.push({ nombre, dano: stats.dano, herida: stats.herida, distancia: stats.distancia, mejoras: [] });
      }
    });
    
    return Array.from({ length: 5 }, (_, i) => weaponItems[i] || { nombre: '', dano: '', herida: '', distancia: '' });
  };
  
  // Get items with rewards (armas, armadura, escudo) - max 6
  // Format: "NOMBRE DAÑO HERIDA DISTANCIA RECOMPENSA: mejora1, mejora2"
  const getRecompensasRows = () => {
    const recompensaItems = [];
    
    const getName = (item) => {
      if (!item) return null;
      return typeof item === 'string' ? item : item?.nombre;
    };
    
    const getMejoras = (item) => {
      if (!item || typeof item === 'string') return [];
      return item.mejoras || [];
    };
    
    const addedNames = new Set();
    
    // Check armas_elegidas
    (character.armas_elegidas || []).forEach(arma => {
      const nombre = getName(arma);
      const mejoras = getMejoras(arma);
      if (nombre && mejoras.length > 0 && !addedNames.has(nombre.toLowerCase())) {
        addedNames.add(nombre.toLowerCase());
        const stats = getWeaponStats(nombre);
        recompensaItems.push({
          nombre,
          dano: stats.dano,
          herida: stats.herida,
          distancia: stats.distancia,
          mejoras,
        });
      }
    });
    
    // Check inventario weapons
    (character.inventario || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (isWeapon(nombre) && mejoras.length > 0 && !addedNames.has(nombre.toLowerCase())) {
        addedNames.add(nombre.toLowerCase());
        const stats = getWeaponStats(nombre);
        recompensaItems.push({
          nombre,
          dano: item.dano || stats.dano,
          herida: item.herida || stats.herida,
          distancia: item.distancia || stats.distancia,
          mejoras,
        });
      }
    });
    
    // Check equipo_ocupacion weapons
    (character.equipo_ocupacion || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (isWeapon(nombre) && mejoras.length > 0 && !addedNames.has(nombre.toLowerCase())) {
        addedNames.add(nombre.toLowerCase());
        const stats = getWeaponStats(nombre);
        recompensaItems.push({
          nombre,
          dano: stats.dano,
          herida: stats.herida,
          distancia: stats.distancia,
          mejoras,
        });
      }
    });
    
    // Check armadura
    const armadura = character.armadura;
    if (armadura) {
      const nombre = getName(armadura);
      const mejoras = getMejoras(armadura);
      if (nombre && mejoras.length > 0) {
        recompensaItems.push({
          nombre,
          dano: '-',
          herida: '-',
          distancia: '-',
          mejoras,
        });
      }
    }
    
    // Check equipo for shields with mejoras
    (character.equipo || []).forEach(item => {
      const nombre = getName(item);
      const mejoras = getMejoras(item);
      if (nombre && mejoras.length > 0 && !addedNames.has(nombre.toLowerCase())) {
        addedNames.add(nombre.toLowerCase());
        recompensaItems.push({
          nombre,
          dano: '-',
          herida: '-',
          distancia: '-',
          mejoras,
        });
      }
    });
    
    // Format each item: "NOMBRE DAÑO HERIDA DIST RECOMPENSA: mejora1, mejora2"
    return Array.from({ length: 6 }, (_, i) => {
      const item = recompensaItems[i];
      if (!item) return '';
      return `${item.nombre} ${item.dano} ${item.herida} ${item.distancia} [${item.mejoras.join(', ')}]`;
    });
  };
  
  // Get languages and tools
  const getIdiomasHerramientasRows = () => {
    const idiomas = character.competencias?.idiomas || character.idiomas || [];
    const herramientas = [
      ...(character.competencia_herramienta_cultura ? [character.competencia_herramienta_cultura] : []),
      ...(character.herramienta_elegida_cultura ? [character.herramienta_elegida_cultura] : []),
      ...(character.competencia_herramienta_1 ? [character.competencia_herramienta_1] : []),
      ...(character.competencias_herramientas_2 || []),
      ...(character.competencias_herramientas || []),
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
    // Handle both string and object formats
    const name = typeof itemName === 'string' ? itemName : itemName?.nombre;
    if (!name) return 0;
    const normalizedName = name.toLowerCase().trim();
    
    // Search in all categories of the equipment catalog
    const allCategories = [
      'equipo_general', 'herramientas', 'juegos', 'instrumentos_musicales',
      'consumibles', 'comida_posadas', 'hierbas', 'venenos',
      'armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia',
      'armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos',
      'monturas', 'accesorios_monturas', 'transporte_terrestre', 'transporte_maritimo',
      'gemas_preciosas', 'gemas_semipreciosas', 'recursos_desarrollo'
    ];
    
    for (const category of allCategories) {
      const items = equipmentCatalog[category] || [];
      for (const item of items) {
        const catalogName = (item.nombre || '').toLowerCase().trim();
        if (catalogName === normalizedName || normalizedName.includes(catalogName) || catalogName.includes(normalizedName)) {
          return item.peso_kg || 0;
        }
      }
    }
    return 0;
  };
  
  // Calculate peso carried by mount
  const calcularPesoMontura = () => {
    let pesoMontura = 0;
    
    // Helper to add weight if item is on mount
    const addIfOnMount = (item, cantidad = 1) => {
      if (typeof item === 'object' && item.portado_por === 'montura') {
        const nombre = item.nombre;
        if (item.peso_kg) {
          pesoMontura += (parseFloat(item.peso_kg) || 0) * cantidad;
        } else {
          pesoMontura += getItemWeight(nombre) * cantidad;
        }
      }
    };
    
    // Check inventario for items carried by mount
    (character.inventario || []).forEach(item => {
      if (typeof item === 'object' && item.portado_por === 'montura') {
        const nombre = item.nombre;
        const cantidad = item.cantidad || 1;
        if (item.peso_kg) {
          pesoMontura += (parseFloat(item.peso_kg) || 0) * cantidad;
        } else {
          pesoMontura += getItemWeight(nombre) * cantidad;
        }
      }
    });
    
    // Check equipo_ocupacion
    (character.equipo_ocupacion || []).forEach(item => addIfOnMount(item));
    
    // Check equipo_trasfondo
    (character.equipo_trasfondo || []).forEach(item => addIfOnMount(item));
    
    // Check equipo_nivel_vida
    (character.equipo_nivel_vida || []).forEach(item => addIfOnMount(item));
    
    return pesoMontura.toFixed(2);
  };
  
  // Calculate peso transportado (by character, excluding mount cargo)
  const calcularPesoTransportado = () => {
    let pesoTotal = 0;
    
    // Inventario (exclude items on mount)
    (character.inventario || []).forEach(item => {
      // Skip items carried by mount
      if (typeof item === 'object' && item.portado_por === 'montura') return;
      
      const nombre = typeof item === 'string' ? item : item.nombre;
      const cantidad = typeof item === 'object' ? (item.cantidad || 1) : 1;
      if (typeof item === 'object' && item.peso_kg) {
        pesoTotal += (parseFloat(item.peso_kg) || 0) * cantidad;
      } else {
        pesoTotal += getItemWeight(nombre) * cantidad;
      }
    });
    
    // Equipo de ocupación
    (character.equipo_ocupacion || []).forEach(item => {
      if (typeof item === 'object' && item.portado_por === 'montura') return;
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    
    // Equipo de trasfondo
    (character.equipo_trasfondo || []).forEach(item => {
      if (typeof item === 'object' && item.portado_por === 'montura') return;
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    
    // Equipo de nivel de vida
    (character.equipo_nivel_vida || []).forEach(item => {
      if (typeof item === 'object' && item.portado_por === 'montura') return;
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    
    // Ropa de nivel de vida
    (character.ropa_nivel_vida || []).forEach(item => {
      if (typeof item === 'object' && item.portado_por === 'montura') return;
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    
    // Herramientas elegidas
    (character.herramientas_elegidas_ocupacion || []).forEach(item => {
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    
    // Armas elegidas
    (character.armas_elegidas || []).forEach(item => {
      pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
    });
    
    // Armadura elegida
    if (character.armadura_elegida) {
      (character.armadura_elegida || []).forEach(item => {
        pesoTotal += getItemWeight(typeof item === 'string' ? item : item.nombre);
      });
    }
    
    // Armadura actual
    if (character.armadura) {
      const armaduraNombre = typeof character.armadura === 'string' ? character.armadura : character.armadura.nombre;
      pesoTotal += getItemWeight(armaduraNombre);
    }
    
    // Escudo
    if (character.escudo) {
      const escudoNombre = typeof character.escudo === 'string' ? character.escudo : character.escudo.nombre;
      pesoTotal += getItemWeight(escudoNombre);
    }
    
    // Dinero (monedas)
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
  const pesoMontura = calcularPesoMontura();
  const estorbo = calcularEstorbo();

  return (
    <>
      {/* Basic Info */}
      <DisplayField {...PAGE1_FIELDS.nombre} value={character.nombre} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.ocupacion_nivel} value={`${character.ocupacion_nombre || character.vocacion_nombre || ''} ${nivel}`} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.jugador} value={character.jugador || character.nombre_jugador || ''} scale={scale} />
      <DisplayField {...getPos('CODIGOUNICOPJ')} value={character.codigo_publico || ''} scale={scale} />

      {/* Descripción completa de la virtud (texto + rasgos + bonos) */}
      {character.virtud_nombre && (
        <DisplayField {...getPos('DescripcionVirtud')} multiline value={buildVirtudTexto()} scale={scale} />
      )}

      {/* Imagen del retrato del personaje (posición y tamaño desde el Editor: campo RETRATO).
          Solo se pinta en la Página 1 si el RETRATO está colocado explícitamente en esta
          página (fieldPositions.RETRATO) o si NO se ha colocado en ninguna página
          (retratoFallback → posición por defecto en la Página 1). Si el usuario lo movió a
          otra página, aquí NO se pinta. */}
      {character.portrait_image && (fieldPositions?.RETRATO || retratoFallback) && (() => {
        const p = getPos('RETRATO');
        return (
          <img
            src={`data:image/png;base64,${character.portrait_image}`}
            alt={`Retrato de ${character.nombre || ''}`}
            style={{
              position: 'absolute',
              left: `${(p.x || 0) * scale}px`,
              top: `${(p.y || 0) * scale}px`,
              width: `${(p.width || 380) * scale}px`,
              height: `${(p.height || p.width || 480) * scale}px`,
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
            data-testid="sheet-retrato-image"
          />
        );
      })()}
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
      <DisplayField {...PAGE1_FIELDS.iniciativa} value={(() => {
        const dexMod = Math.floor(((attrs.destreza || 10) - 10) / 2);
        const total = dexMod + Number(character.iniciativa_bonus || 0);
        return total >= 0 ? `+${total}` : `${total}`;
      })()} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.velocidad} value={`${character.velocidad || 9}m`} scale={scale} />
      
      {/* Hit Points */}
      <DisplayField {...PAGE1_FIELDS.pg_max} value={character.puntos_golpe_max || character.pg_max || 8} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.pg_actual} value={character.puntos_golpe_actual || character.pg_actual || character.puntos_golpe_max || character.pg_max || 8} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.pg_temp} value={(character.puntos_golpe_temp || character.pg_temp) ? (character.puntos_golpe_temp || character.pg_temp) : ''} scale={scale} />
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
      
      {/* Recompensas - Items with applied rewards */}
      {getRecompensasRows().map((recompensa, i) => (
        <DisplayField key={`recompensa${i+1}`} {...PAGE1_FIELDS[`recompensa${i+1}`]} value={recompensa} scale={scale} />
      ))}
      
      {/* Peso y estorbo */}
      <DisplayField {...PAGE1_FIELDS.peso_transportado} value={pesoTransportado} scale={scale} />
      {/* Mount weight - only show if there's a mount */}
      {character.montura?.nombre && parseFloat(pesoMontura) > 0 && (
        <DisplayField {...PAGE1_FIELDS.peso_montura} value={`(M:${pesoMontura})`} scale={scale} />
      )}
      <DisplayField {...PAGE1_FIELDS.cargado} value={estorbo.cargado} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.muy_cargado} value={estorbo.muy_cargado} scale={scale} />
      
      {/* Montura - "MONTURA, PesoCargado/PesoMax" */}
      {(() => {
        // Detect mount from character.montura OR from inventory
        const mountNames = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno'];
        const mountAccessoryNames = ['silla de monta', 'alforjas', 'bocado', 'bridas', 'bocado y bridas', 
                                     'arreos', 'barda', 'silla de montar', 'albarda', 'estribos', 'riendas', 
                                     'herradura', 'manta de montar'];
        
        const isMountItem = (nombre) => {
          const lower = (nombre || '').toLowerCase();
          return mountNames.some(m => lower.includes(m));
        };
        
        const isMountAccessory = (nombre) => {
          const lower = (nombre || '').toLowerCase();
          return mountAccessoryNames.some(a => lower.includes(a));
        };
        
        let mountName = null;
        let mountCapacity = 150;
        
        // Helper to find mount capacity from catalog
        const getMountCapacityFromCatalog = (nombre) => {
          const monturasEnCatalogo = equipmentCatalog.monturas || [];
          const normalizedNombre = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          for (const mount of monturasEnCatalogo) {
            const catalogName = (mount.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (catalogName === normalizedNombre || normalizedNombre.includes(catalogName) || catalogName.includes(normalizedNombre)) {
              return mount.capacidad_carga || 150;
            }
          }
          return 150; // Default fallback
        };
        
        // Check character.montura first
        if (character.montura?.nombre) {
          mountName = character.montura.nombre;
          // First try character.montura.capacidad_carga, then catalog lookup
          mountCapacity = character.montura.capacidad_carga || getMountCapacityFromCatalog(character.montura.nombre);
        } else {
          // Check inventory for mount
          const allSources = [
            ...(character.inventario || []),
            ...(character.equipo_nivel_vida || []),
            ...(character.equipo_trasfondo || []),
            ...(character.equipo_ocupacion || []),
          ];
          
          for (const item of allSources) {
            const nombre = typeof item === 'string' ? item : item?.nombre || '';
            if (isMountItem(nombre)) {
              mountName = nombre;
              // Get capacity from item, or lookup in catalog
              mountCapacity = (typeof item === 'object' && item.capacidad_carga) || getMountCapacityFromCatalog(nombre);
              break;
            }
          }
        }
        
        if (!mountName) return null;

        // FUENTE AUTORITATIVA: si tenemos el resumen de peso del backend (el mismo que
        // usa el Gestor de Equipamiento), usamos su `peso_cargado` y `capacidad` para
        // que la ficha oficial muestre EXACTAMENTE el mismo peso que la ficha previa.
        const detalleMonturas = weightSummary?.monturas_detalle || [];
        if (detalleMonturas.length > 0) {
          const norm = (s) => String(s || '').toLowerCase().trim();
          const det = detalleMonturas.find(d =>
            norm(d.nombre) === norm(mountName) ||
            norm(d.nombre_personalizado) === norm(mountName) ||
            norm(d.nombre_original) === norm(mountName)
          ) || detalleMonturas[0];
          if (det) {
            const cargado = Math.round(Number(det.peso_cargado || 0));
            const cap = Number(det.capacidad || det.capacidad_carga || mountCapacity || 0);
            const nombreDet = det.nombre_personalizado || det.nombre || det.nombre_original || mountName;
            return (
              <DisplayField
                {...PAGE1_FIELDS.montura_peso}
                value={`${nombreDet}, ${cargado}/${cap} Kg`}
                scale={scale}
              />
            );
          }
        }
        
        // Cálculo de reserva (solo si NO hay resumen de peso del backend).
        let pesoEnMontura = parseFloat(pesoMontura) || 0;
        
        // Add weight of mount accessories that are always on mount
        const allItems = [
          ...(character.inventario || []),
          ...(character.equipo_nivel_vida || []),
          ...(character.equipo_trasfondo || []),
          ...(character.equipo_ocupacion || []),
        ];
        
        allItems.forEach(item => {
          const nombre = typeof item === 'string' ? item : item?.nombre || '';
          const cantidad = (typeof item === 'object' && item.cantidad) || 1;
          // Mount accessories always count as on mount
          if (isMountAccessory(nombre)) {
            const peso = (typeof item === 'object' && item.peso_kg) || getItemWeight(nombre);
            pesoEnMontura += (peso || 0) * cantidad;
          }
          // Items explicitly on mount (that aren't already mount accessories)
          if (typeof item === 'object' && item.portado_por === 'montura' && !isMountAccessory(nombre) && !isMountItem(nombre)) {
            // Already counted in calcularPesoMontura
          }
        });
        
        // Add character's body weight + equipment weight ONLY when actually mounted.
        // Without this gate, the PDF double-counts the rider even when the
        // "montado aquí" checkbox is off (mismatch with EquipmentManagerModal).
        let pesoTotal;
        if (character.montado) {
          const pesoEquipoPersonaje = parseFloat(pesoTransportado) || 0;
          const pesoPersonaje = parseFloat(character.peso_kg) || parseFloat(character.peso) || 70;
          pesoTotal = Math.round(pesoEnMontura + pesoEquipoPersonaje + pesoPersonaje);
        } else {
          pesoTotal = Math.round(pesoEnMontura);
        }
        
        return (
          <DisplayField 
            {...PAGE1_FIELDS.montura_peso} 
            value={`${mountName}, ${pesoTotal}/${mountCapacity} Kg`}
            scale={scale} 
          />
        );
      })()}
      
      {/* Idiomas y Herramientas */}
      {idiomasRows.map((item, i) => (
        <DisplayField key={`idioma_herr_${i+1}`} {...PAGE1_FIELDS[`idioma_herr_${i+1}`]} value={item} scale={scale} />
      ))}
      
      {/* Virtudes */}
      <DisplayField {...PAGE1_FIELDS.virtudes} value={character.virtud_nombre || ''} scale={scale} />
      
      {/* Sombra puntuación */}
      <DisplayField {...PAGE1_FIELDS.sombra_puntuacion} value={character.puntos_sombra || ''} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.sombra_cicatrices} value={character.puntos_sombra_permanentes || ''} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.desanimado} value={character.desanimado ? 'x' : ''} scale={scale} />
      <DisplayField {...PAGE1_FIELDS.angustiado} value={character.angustiado ? 'x' : ''} scale={scale} />
    </>
  );
};

export default SheetPage1;
