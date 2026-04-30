/**
 * Pure speed / role helpers extracted from EnhancedTravelSystem.jsx during
 * the iter95 refactor. These are deterministic functions of their inputs
 * (no React state) so we keep them outside the component for testability.
 */

import { ROLE_INFO, ROLE_MODIFIER_KEY, MULTI_ROLE_PENALTY } from '../components/travel/travelConstants';

/**
 * Compute the effective travel speed (in metres per round) of a single
 * character, accounting for encumbrance and an optional active mount.
 *
 * Rules (LOTR-5e house ruleset):
 *  - Without a mount, the character moves at its base speed minus its
 *    encumbrance metres (`estorbo_metros`). Minimum 1 m/turno.
 *  - When mounted (`char.montado === true`), the mount's speed replaces
 *    the rider's. The mount carries: rider body weight (peso_kg, default
 *    70 kg) + every personal-inventory item that is not explicitly carried
 *    by the mount + every item already stored in the mount's saddlebags
 *    (`montura.equipo`). If the resulting load exceeds
 *    `montura.capacidad_carga`, the mount is over-burdened and its speed
 *    drops to ⅔ of normal.
 */
export function computeMemberSpeed(char) {
  if (!char) return 0;
  const baseEstorbo = Number(char.estorbo_metros || 0);
  const velBase = Math.max(
    1,
    Number(char.velocidad_metros || char.velocidad_base || 9) + baseEstorbo,
  );
  const tieneMontura = !!char.montura?.nombre;
  if (!tieneMontura || !char.montado) return velBase;

  const velMontura = Number(char.montura.velocidad || 12);
  let cargaMontura = 0;
  let pesoPersonal = 0;
  (char.inventario || []).forEach((it) => {
    if (!it) return;
    const peso = Number(it.peso_kg || it.peso || 0) * Number(it.cantidad || 1);
    if (it.portado_por === 'montura') cargaMontura += peso;
    else pesoPersonal += peso;
  });
  (char.montura.equipo || []).forEach((it) => {
    cargaMontura += Number(it?.peso_kg || it?.peso || 0) * Number(it?.cantidad || 1);
  });
  const cap = Number(char.montura.capacidad_carga || char.montura.carga_kg || 0);
  const cargaTotal = cargaMontura + Number(char.peso_kg || 70) + pesoPersonal;
  const sobrecargada = cap > 0 && cargaTotal > cap;
  return sobrecargada ? velMontura * 0.67 : velMontura;
}

/**
 * Effective group speed = the slowest member's speed (a chain is only as
 * fast as its slowest link).
 */
export function computeGroupSpeed(members, characters) {
  const speeds = (members || [])
    .map((m) => characters.find((c) => c.id === m.id))
    .filter(Boolean)
    .map(computeMemberSpeed)
    .filter((v) => v > 0);
  return speeds.length ? Math.min(...speeds) : 0;
}

/**
 * Compute the modifier and breakdown for a given travel ROLE (`explorador`,
 * `cazador`, etc.). The penalty for taking multiple roles applies on top.
 */
export function getRoleModifier(targetRole, miembros) {
  const targetMember = (miembros || []).find((m) => m.papeles?.includes(targetRole));
  const roleInfo = ROLE_INFO[targetRole];
  if (!targetMember || !roleInfo) {
    return { modifier: 0, breakdown: [], member: null, roleInfo };
  }
  const key = ROLE_MODIFIER_KEY[targetRole];
  const baseMod =
    key && typeof targetMember[key] === 'number'
      ? targetMember[key]
      : targetMember.modSabiduria || 0;
  const hasMultipleRoles = targetMember.papeles?.length > 1;
  const modifier = baseMod + (hasMultipleRoles ? MULTI_ROLE_PENALTY : 0);
  const breakdown = [
    `${roleInfo.habilidad} (${roleInfo.atributo_nombre.slice(0, 3)}): ${baseMod >= 0 ? '+' : ''}${baseMod}`,
  ];
  if (hasMultipleRoles) breakdown.push(`Múltiples papeles: ${MULTI_ROLE_PENALTY}`);
  return { modifier, breakdown, member: targetMember, roleInfo };
}
