/**
 * Pure helper functions and constants for the Enhanced Travel System.
 * No React state or component dependencies — safe to import anywhere.
 * Extracted from EnhancedTravelSystem.jsx to keep that file manageable.
 */

// =============== REST SYSTEM ===============
// Types of rest and their effects on fatigue / HP / Hit Dice (D&D 5e)
export const REST_TYPES = {
  short: {
    nombre: 'Descanso Corto',
    duracion: '1 hora',
    efecto: 'Gasta Dados de Golpe para curar PG (1d{DG}+CON por dado)',
    fatiga: 0, // No fatigue reduction
    sinFatiga: false,
    afectaPG: true,
    requiereSeleccionDG: true,
  },
  long: {
    nombre: 'Descanso Largo',
    duracion: '8 horas',
    efecto: 'PG al máx · recupera mitad DG · -1 fatiga (CD CON)',
    fatiga: -1,
    sinFatiga: false,
    requiereTiradaCON: true,
    cdBase: 10,
    afectaPG: true,
    restauraPGCompleto: true,
    recuperaDG: true,
  },
  sanctuary: {
    nombre: 'Descanso en Santuario',
    duracion: '1+ días',
    efecto: 'Elimina toda la fatiga sin tirada · PG al máx · todos los DG',
    fatiga: 'all',
    sinFatiga: true,
    afectaPG: true,
    restauraPGCompleto: true,
    recuperaDG: true,
    recuperaTodosDG: true,
  }
};

// =============== ROLE/SKILL MAPPINGS ===============
// Map travel role → precomputed member skill modifier key
export const ROLE_MODIFIER_KEY = {
  guia: 'modViajar',
  cazador: 'modCaza',
  vigia: 'modPercepcion',
  explorador: 'modExplorar',
};

// Map skill names to their governing attribute
export const SKILL_ATTRIBUTES = {
  'viajar': 'sabiduria',
  'percepción': 'sabiduria',
  'percepcion': 'sabiduria',
  'cazar': 'sabiduria',
  'explorar': 'sabiduria',  // Note: In the character sheet it shows Explorar (Sab)
  'sigilo': 'destreza',
  'acrobacias': 'destreza',
  'atletismo': 'fuerza',
  'perspicacia': 'sabiduria',
};

// =============== CHARACTER SKILL HELPERS ===============
// Helper to calculate proficiency bonus based on level
export const calcBonusCompetencia = (nivel) => {
  if (nivel >= 17) return 6;
  if (nivel >= 13) return 5;
  if (nivel >= 9) return 4;
  if (nivel >= 5) return 3;
  return 2;
};

// Helper to check if character has proficiency in a skill
export const tieneCompetenciaEn = (char, habilidad) => {
  // Check in habilidades_competencia (e.g., ['Viajar (Sab)', 'Percepción (Sab)'])
  const competencias = char.habilidades_competencia || char.habilidades || [];
  const normalizedSkill = habilidad.toLowerCase();
  return competencias.some(h => h.toLowerCase().includes(normalizedSkill));
};

// Helper to check if character has expertise (pericia) in a skill
export const tienePericia = (char, habilidad) => {
  // Check in pericia_elegida (e.g., ['Percepción', 'Viajar'])
  const pericias = char.pericia_elegida || [];
  const normalizedSkill = habilidad.toLowerCase();
  return pericias.some(p => p.toLowerCase().includes(normalizedSkill));
};

// Get attribute modifier
export const getModAtributo = (char, atributo) => {
  const valor = char.atributos?.[atributo] || 10;
  return Math.floor((valor - 10) / 2);
};

// Calculate skill modifier: attribute_mod + (competencia ? bonus : 0) + (pericia ? bonus : 0)
export const calcModHabilidad = (char, habilidad) => {
  const nivel = char.nivel || 1;
  const bonusCompetencia = calcBonusCompetencia(nivel);

  // Get governing attribute
  const atributo = SKILL_ATTRIBUTES[habilidad.toLowerCase()] || 'sabiduria';
  const modAtributo = getModAtributo(char, atributo);

  let mod = modAtributo;

  // Add proficiency bonus if competent
  if (tieneCompetenciaEn(char, habilidad)) {
    mod += bonusCompetencia;
  }

  // Add another proficiency bonus if has expertise (pericia = x2)
  if (tienePericia(char, habilidad)) {
    mod += bonusCompetencia;
  }

  return mod;
};

// =============== FATIGUE ===============
// CD base por terreno del viaje
//   camino/fácil/moderado → 10
//   campo abierto/colinas/bosque → 15
//   terreno difícil/montañas/pantano/desalentador/muy_dificil → 20
export const getFatigueBaseCD = (terrain) => {
  const t = (terrain || '').toLowerCase();
  if (['muy_dificil', 'desalentador', 'montanas', 'pantano', 'pantanos', 'dificil'].includes(t)) return 20;
  if (['facil', 'camino', 'caminos'].includes(t)) return 10;
  // campo abierto, colinas, bosque, moderado → 15
  return 15;
};

// =============== XP CALCULATION ===============
// TABLA 1 — PX base por CD (actualizada 2026-02-24)
// CD 5-10: 0 PX | 11-14: 2 PX | 15-19: 5 PX | 20-24: 10 PX | 25+: 15 PX
export const calculateRollXP = (cd, tirada, exito, terreno, tipoTierra, d20Nat) => {
  let pxBase = 0;
  if (cd >= 25) pxBase = 15;
  else if (cd >= 20) pxBase = 10;
  else if (cd >= 15) pxBase = 5;
  else if (cd >= 11) pxBase = 2;
  else pxBase = 0;

  const diferencia = tirada - cd;
  let pxFinal;

  if (exito) {
    pxFinal = pxBase;
  } else {
    // Fallo: no gana PX base (sólo restaría por pifia natural)
    pxFinal = 0;
  }

  // Modificadores especiales por tirada natural
  let critico = false;
  let pifia = false;
  if (d20Nat === 20) {
    critico = true;
    pxFinal += 20; // Crítico: +20 PX extra (se suma al base)
  } else if (d20Nat === 1) {
    pifia = true;
    pxFinal -= 10; // Pifia: -10 PX
  }

  // No hay multiplicadores de terreno/tierra individuales en la nueva tabla.
  // El ajuste global del viaje se aplica al final (calculateGroupMultiplier).

  return {
    pxBase,
    diferencia,
    pxFinal: Math.round(pxFinal),
    critico,
    pifia,
    // Mantener estos campos por compatibilidad con UI existente
    multDiferencia: 1,
    multTerreno: 1,
    multTierra: 1,
  };
};

// =============== FORAGING ===============
// Foraging DC depends on terrain difficulty.
//   camino/fácil → 10
//   moderado/colinas/bosque (default) → 15
//   difícil → 20
//   muy_difícil/desalentador/pantano/montañas → 25
export const getForageCD = (terrain) => {
  const t = (terrain || '').toLowerCase();
  if (['muy_dificil', 'desalentador', 'montanas', 'montaña', 'pantano', 'pantanos'].includes(t)) return 25;
  if (['dificil', 'difícil'].includes(t)) return 20;
  if (['facil', 'camino', 'caminos'].includes(t)) return 10;
  // moderado, colinas, bosque, campo_abierto → 15
  return 15;
};

// TABLA 2 — Multiplicador global según aciertos/fallos del viaje
export const calculateGroupMultiplier = (aciertos, fallos) => {
  const total = aciertos + fallos;
  if (total === 0) return { multiplicador: 1, diferencia: 0, tendencia: 'equilibrado' };
  const diferencia = Math.abs(aciertos - fallos) / total * 100;
  const masAciertos = aciertos >= fallos;
  let multiplicador = 1;
  let tendencia = 'equilibrado';
  if (diferencia <= 20) {
    multiplicador = 1.0;
    tendencia = 'equilibrado';
  } else if (diferencia <= 40) {
    multiplicador = masAciertos ? 1.3 : 0.7;
    tendencia = masAciertos ? 'aciertos_moderados' : 'fallos_moderados';
  } else {
    multiplicador = masAciertos ? 1.6 : 0.4;
    tendencia = masAciertos ? 'aciertos_fuertes' : 'fallos_fuertes';
  }
  return { multiplicador, diferencia: Math.round(diferencia * 10) / 10, tendencia };
};
