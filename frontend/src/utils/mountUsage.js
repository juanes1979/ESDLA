/**
 * Helpers to determine whether a character can:
 *   - load items onto a mount (needs Alforjas)
 *   - ride a mount (needs Bocado y bridas + Silla de monta), unless they
 *     are an Elf, Rohirrim or Dúnedan (special exemption noted in the
 *     game lore — applied at the warning level only for now).
 *
 * We inspect:
 *   - character.inventario          (newly bought accessories)
 *   - character.equipo_ocupacion    (accessories from background)
 *   - character.equipo_nivel_vida   (lifestyle equipment)
 *   - character.equipo_trasfondo    (background equipment)
 *
 * Match is case-insensitive and substring-based, so any item whose name
 * contains "alforja" / "silla de monta" / "bridas" counts.
 */
const lower = (s) => (s || '').toString().toLowerCase();

const allEquipmentSources = (character) => {
  const out = [];
  ['inventario', 'equipo', 'equipo_ocupacion', 'equipo_nivel_vida', 'equipo_trasfondo'].forEach((key) => {
    const list = character?.[key] || [];
    for (const it of list) out.push(it);
  });
  return out;
};

const hasItemMatching = (character, predicate) => {
  return allEquipmentSources(character).some((it) => {
    const n = lower(typeof it === 'object' ? it?.nombre : it);
    return predicate(n);
  });
};

export const hasAlforjas = (character) =>
  hasItemMatching(character, (n) => n.includes('alforja'));

export const hasBocadoYBridas = (character) =>
  hasItemMatching(character, (n) => n.includes('bocado') || n.includes('brida'));

export const hasSillaDeMonta = (character) =>
  hasItemMatching(character, (n) => n.includes('silla de monta') || n.includes('silla de montar'));

const RAZAS_MONTAR_NATURAL = ['elfo', 'rohirrim', 'dúnedan', 'dunedan', 'dúnedain', 'dunedain'];

export const puedeMontarSinSilla = (character) => {
  const cultura = lower(character?.cultura_nombre || character?.raza || '');
  return RAZAS_MONTAR_NATURAL.some((r) => cultura.includes(r));
};

/**
 * Returns an object describing what this character is missing to use a mount.
 *   { canLoad, canRide, missingForLoad: [], missingForRide: [], razaPuedeSinSilla }
 */
export const getMountUsageStatus = (character) => {
  const alforjas = hasAlforjas(character);
  const bocado = hasBocadoYBridas(character);
  const silla = hasSillaDeMonta(character);
  const razaPuedeSinSilla = puedeMontarSinSilla(character);

  const missingForLoad = [];
  if (!alforjas) missingForLoad.push('Alforjas');

  const missingForRide = [];
  if (!bocado) missingForRide.push('Bocado y bridas');
  if (!silla) missingForRide.push('Silla de monta');

  return {
    canLoad: alforjas,
    canRide: razaPuedeSinSilla || (bocado && silla),
    missingForLoad,
    missingForRide,
    razaPuedeSinSilla,
  };
};
