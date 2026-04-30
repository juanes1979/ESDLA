/**
 * Helpers to determine a character's clothing/armor state:
 *  - isNaked   : no active clothing/armor covering "cuerpo".
 *  - isBarefoot: no active clothing/armor covering "pies".
 *  - hasActiveWeapon: at least one weapon is active (ready to wield).
 *
 * Takes into account:
 *  - inventario items with categoria==='ropa' (activa + portado_por)
 *  - character.armadura (principal)
 *  - character.armadura_piezas[]  (brazaletes, grebas, hombreras…)
 *  - character.armas[]             (weapons)
 *
 * An item counts only when activa !== false AND portado_por !== 'montura'.
 */

const isActiveOnBody = (it) => {
  if (!it || typeof it !== 'object') return false;
  if (it.activa === false) return false;
  if (it.portado_por === 'montura') return false;
  return true;
};

export const getActiveClothingByPosition = (character, posicion) => {
  const lower = (s) => (s || '').toString().toLowerCase();
  const out = [];

  const inv = character?.inventario || [];
  inv.forEach((it) => {
    if (!it || typeof it !== 'object') return;
    if (lower(it.categoria) !== 'ropa') return;
    if (lower(it.posicion) !== posicion) return;
    if (isActiveOnBody(it)) out.push(it);
  });

  // Primary armor (posicion=cuerpo por defecto)
  const arm = character?.armadura;
  if (arm && typeof arm === 'object' && arm.nombre) {
    const pos = lower(arm.posicion || 'cuerpo');
    if (pos === posicion && isActiveOnBody(arm)) out.push(arm);
  }

  // Armor pieces
  const piezas = character?.armadura_piezas || [];
  piezas.forEach((p) => {
    if (!p || typeof p !== 'object') return;
    if (lower(p.posicion) !== posicion) return;
    if (isActiveOnBody(p)) out.push(p);
  });

  return out;
};

export const isNaked = (character) =>
  getActiveClothingByPosition(character, 'cuerpo').length === 0;

export const isBarefoot = (character) =>
  getActiveClothingByPosition(character, 'pies').length === 0;

export const hasActiveWeapon = (character) => {
  const armas = character?.armas || [];
  return armas.some((a) => isActiveOnBody(a));
};
