/**
 * Compute the effective Armor Class (CA) from a character's active armor,
 * armor pieces and shield. Falls back to 10 + DEX mod if nothing is active.
 *
 * Formula:
 *   base_ac = armadura.activa && not on mount  ? armadura.ca : 10
 *   dex_mod = floor((DEX - 10) / 2), capped by armor's "comentarios" if any
 *   piezas_bonus = Σ ca_bonus of active armor pieces carried by character
 *   escudo_bonus = +2 if character.equipo[] has an "escudo" (no portado_por=montura)
 *   virtud_bonus = character.virtud_ca_extra or 0
 *   effective_ca = base_ac + dex_mod + piezas_bonus + escudo_bonus + virtud_bonus
 */
const getModifier = (score) => Math.floor((score - 10) / 2);

const isActive = (it) =>
  it && typeof it === 'object' && it.activa !== false && it.portado_por !== 'montura';

export const computeEffectiveCA = (character) => {
  if (!character) return 10;
  const attrs = character.atributos || character.atributos_finales || {};
  const dex = attrs.destreza ?? 10;
  const dexMod = getModifier(dex);

  let baseAc = 10;
  let dexCap = null;

  const arm = character.armadura;
  if (arm && typeof arm === 'object' && arm.nombre && isActive(arm) && arm.ca) {
    baseAc = Number(arm.ca) || 10;
    // Parse DEX cap from "1 + mod. Des. (máx. 4)" style comments
    if (arm.comentarios) {
      const m = String(arm.comentarios).toLowerCase().match(/m[aá]x\.?\s*(\d+)/);
      if (m) dexCap = parseInt(m[1], 10);
    }
  }

  const cappedDex = dexCap != null ? Math.min(dexMod, dexCap) : dexMod;

  let piezasBonus = 0;
  (character.armadura_piezas || []).forEach((p) => {
    if (isActive(p) && p.ca_bonus) {
      piezasBonus += Number(p.ca_bonus) || 0;
    }
  });

  let escudoBonus = 0;
  (character.equipo || []).forEach((it) => {
    if (!it) return;
    const nombre = (typeof it === 'object' ? it.nombre : it) || '';
    if (!nombre.toLowerCase().includes('escudo')) return;
    if (typeof it === 'object' && it.portado_por === 'montura') return;
    escudoBonus += 2;
  });

  const virtud = character.virtud_ca_extra || 0;

  return baseAc + cappedDex + piezasBonus + escudoBonus + virtud;
};
