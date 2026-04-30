/**
 * Proportional food consumption helper.
 *
 * Given an inventario (possibly including raciones, odres, consumibles and
 * comida_posadas items) and a number of grams of food to consume, deducts
 * that amount proportionally across all food items by mass. Fractional
 * quantities are supported (float cantidad).
 *
 * A food item is any inventory entry that matches:
 *   - categoria ∈ {'consumibles', 'comida_posadas'}
 *   - OR nombre contiene "raci" (raciones de viaje / packs)
 *   - AND NOT contains "odre" or is water (those are water-only)
 *
 * Usage:
 *   const { inventario: newInv, consumido } =
 *     consumeProportionalFood(char.inventario, 500 * numDays);
 */

const lower = (s) => (s || '').toString().toLowerCase();

export const isFoodItem = (item) => {
  if (!item || typeof item !== 'object') return false;
  const n = lower(item.nombre);
  const cat = lower(item.categoria);
  if (n.includes('odre')) return false;
  if (cat === 'consumibles' || cat === 'comida_posadas') return true;
  if (n.includes('raci')) return true;
  // Treat generic loose water as NOT food
  if (n.includes('agua')) return false;
  return false;
};

/**
 * Compute days of food an item represents (peso / 0.5 kg per day).
 */
export const daysOfFood = (item) => {
  if (!item || typeof item !== 'object') return 0;
  const peso = Number(item.peso_kg || 0);
  const cantidad = Number(item.cantidad || 1);
  if (peso <= 0) return 0;
  return (peso * cantidad) / 0.5;
};

/**
 * Subtract `gramsToConsume` of food proportionally across all food items.
 * Returns { inventario, consumido, remainingGrams }.
 *
 *  - `inventario` is a brand-new array; original is not mutated.
 *  - `consumido` is total grams actually removed (may be < gramsToConsume if
 *    the party runs out of food).
 *  - `remainingGrams` = max(0, gramsToConsume - consumido).
 */
export const consumeProportionalFood = (inventario, gramsToConsume) => {
  const inv = (inventario || []).map((it) =>
    it && typeof it === 'object' ? { ...it } : it
  );
  if (gramsToConsume <= 0) return { inventario: inv, consumido: 0, remainingGrams: 0 };

  // Collect food items with their total mass
  const foodIdxs = [];
  let totalMassKg = 0;
  inv.forEach((it, idx) => {
    if (!isFoodItem(it)) return;
    const peso = Number(it.peso_kg || 0);
    const cantidad = Number(it.cantidad || 0);
    if (peso <= 0 || cantidad <= 0) return;
    const massKg = peso * cantidad;
    foodIdxs.push({ idx, peso, cantidad, massKg });
    totalMassKg += massKg;
  });

  if (totalMassKg <= 0) {
    return { inventario: inv, consumido: 0, remainingGrams: gramsToConsume };
  }

  const totalMassG = totalMassKg * 1000;
  const actualToConsume = Math.min(gramsToConsume, totalMassG);

  foodIdxs.forEach(({ idx, peso, cantidad, massKg }) => {
    const share = massKg / totalMassKg; // fraction of total food mass
    const gramsHere = actualToConsume * share;
    const cantidadReduced = gramsHere / 1000 / peso; // cantidad units to reduce
    const newCantidad = Math.max(0, cantidad - cantidadReduced);
    // Keep 2 decimals precision
    inv[idx] = { ...inv[idx], cantidad: Math.round(newCantidad * 100) / 100 };
  });

  // Drop items with cantidad <= 0.005 (essentially empty)
  const cleaned = inv.filter((it) => {
    if (!it || typeof it !== 'object') return !!it;
    if (it.cantidad == null) return true;
    return Number(it.cantidad) > 0.005;
  });

  return {
    inventario: cleaned,
    consumido: actualToConsume,
    remainingGrams: Math.max(0, gramsToConsume - actualToConsume),
  };
};
