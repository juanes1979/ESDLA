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
// ── SISTEMA 2: PX por TIRADA de evento (individual) ──
// PX_final = PX_base(CD) × mod_diferencia × mult_terreno × mult_tierras (límite ±N).
// La tabla es editable en CONFIG. VIAJES; se carga del backend y se inyecta con
// setRollTableConfig(). Aquí guardamos los valores por defecto (= imagen de reglas).
export const DEFAULT_ROLL_TABLE = {
  px_base_por_cd: [
    { cd: 10, exito: 1, fallo: 0 },
    { cd: 12, exito: 2, fallo: -1 },
    { cd: 14, exito: 3, fallo: -1 },
    { cd: 16, exito: 4, fallo: -2 },
    { cd: 18, exito: 5, fallo: -2 },
    { cd: 20, exito: 6, fallo: -3 },
  ],
  mod_diferencia: [
    { min: 10, max: 9999, mult: 2.0 },
    { min: 5, max: 9, mult: 1.5 },
    { min: 1, max: 4, mult: 1.2 },
    { min: 0, max: 0, mult: 1.0 },
    { min: -3, max: -1, mult: 1.0 },
    { min: -6, max: -4, mult: 1.2 },
    { min: -9999, max: -7, mult: 1.5 },
  ],
  mult_terreno: { facil: 0.8, moderado: 1.0, dificil: 1.2, muy_dificil: 1.5, desalentador: 1.8 },
  mult_tierras: { tierras_libres: 0.8, tierras_fronterizas: 1.0, tierras_salvajes: 1.2, tierras_sombra: 1.5, tierras_oscuras: 1.8 },
  limite_px: 12,
};

// Module-level config injected from the backend editable table.
let _rollTableConfig = DEFAULT_ROLL_TABLE;
export const setRollTableConfig = (t) => { if (t) _rollTableConfig = t; };

const _normTerreno = (t) => {
  t = (t || '').toLowerCase();
  if (t === 'facil' || t === 'muy_facil') return 'facil';
  if (t === 'dificil' || t === 'terreno_dificil') return 'dificil';
  if (t === 'muy_dificil') return 'muy_dificil';
  if (t === 'desalentador') return 'desalentador';
  return 'moderado';
};
const _normTierra = (t) => {
  t = (t || '').toLowerCase();
  if (t.includes('libre')) return 'tierras_libres';
  if (t.includes('fronteriz')) return 'tierras_fronterizas';
  if (t.includes('salvaje')) return 'tierras_salvajes';
  if (t.includes('sombra')) return 'tierras_sombra';
  if (t.includes('oscura')) return 'tierras_oscuras';
  return 'tierras_salvajes';
};

export const calculateRollXP = (cd, tirada, exito, terreno, tipoTierra, d20Nat, rollTable) => {
  const T = rollTable || _rollTableConfig || DEFAULT_ROLL_TABLE;

  // 1) PX base por CD (fila con el mayor cd <= cd indicado).
  const filas = [...(T.px_base_por_cd || [])].sort((a, b) => a.cd - b.cd);
  let fila = filas[0] || { exito: 0, fallo: 0 };
  for (const f of filas) { if (cd >= f.cd) fila = f; }
  const pxBase = exito ? fila.exito : fila.fallo;

  // 2) Modificador por diferencia (resultado − CD).
  const diferencia = tirada - cd;
  let multDif = 1.0;
  for (const r of (T.mod_diferencia || [])) {
    if (diferencia >= r.min && diferencia <= r.max) { multDif = r.mult; break; }
  }

  // 3) Multiplicadores de terreno y tierras.
  const multTerr = (T.mult_terreno || {})[_normTerreno(terreno)] ?? 1.0;
  const multTier = (T.mult_tierras || {})[_normTierra(tipoTierra)] ?? 1.0;

  // 4) PX final + límite + redondeo.
  let pxFinal = pxBase * multDif * multTerr * multTier;
  const limite = Math.abs(T.limite_px ?? 12);
  pxFinal = Math.max(-limite, Math.min(limite, Math.round(pxFinal)));

  return {
    pxBase,
    diferencia,
    pxFinal,
    critico: d20Nat === 20,
    pifia: d20Nat === 1,
    multDiferencia: multDif,
    multTerreno: multTerr,
    multTierra: multTier,
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
