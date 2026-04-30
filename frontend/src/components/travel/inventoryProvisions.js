/**
 * Provision inventory helpers.
 * Detects rations, water skins (odres) and loose water from a character's
 * inventario, and exposes utilities to count, consume and persist them.
 *
 * Item naming convention (kept loose to support older items):
 *  - Rations: any inventory item whose `nombre` includes "raci" (raciones,
 *    ración, ration pack…) is treated as 1 ración per `cantidad` unit, unless
 *    the name says "Pack de N raciones" — in that case we count `cantidad × N`.
 *  - Water skins: any item whose `nombre` includes "odre". A new flag
 *    `litros_actuales` (number) is stored on each odre to support partial fills.
 *    Odres without that flag default to 10 L (full).
 *  - Loose water: items with "agua" in the name and a `litros` or quantity in L.
 */

const PACK_RACIONES_DEFAULT = 10;
const ODRE_CAPACIDAD_L = 10;
const LITROS_AGUA_POR_DIA = 2;
const RACIONES_POR_DIA = 1;

const lower = (s) => (s || '').toString().toLowerCase();

const matchPackSize = (nombre) => {
  // "Pack de Raciones de viaje (10 raciones)" → 10
  const m = lower(nombre).match(/\((\d+)\s*raciones?\)/);
  return m ? parseInt(m[1], 10) : null;
};

export const isRationItem = (item) => {
  // Item explicitly flagged in the catalogue overrides any name guess.
  if (item?.es_racion_diaria === true) return true;
  if (item?.es_racion_diaria === false) return false;
  const n = lower(item?.nombre);
  return n.includes('raci');  // ración, raciones, ration (legacy fallback)
};

export const isOdreItem = (item) => {
  const n = lower(item?.nombre);
  return n.includes('odre');
};

/**
 * Given a character's inventario array, return:
 *   { raciones, diasComidaTotal, totalFoodMassKg, odres: [{idx, litros_actuales}], totalLitros }
 *
 * - `raciones` only counts classic "raciones de viaje" items (backward compat).
 * - `diasComidaTotal` counts ALL food items (raciones + consumibles + comida_posadas)
 *   using the `peso / 0.5` formula (1 día de comida = 0.5 kg).
 * - Each entry in `odres` represents ONE physical odre with its current liters.
 */
export const summarizeProvisions = (inventario = []) => {
  let raciones = 0;
  const odres = [];
  let aguaSuelta = 0;
  let totalFoodMassKg = 0;

  inventario.forEach((item, idx) => {
    if (!item) return;
    const cantidad = Number(item.cantidad || 1);

    if (isRationItem(item)) {
      // Si el item viene del catálogo con `unidades_paquete` definido,
      // 1 unidad de inventario = 1 día de comida × unidades_paquete.
      // Si no, intentamos detectar "(N raciones)" en el nombre, y si
      // tampoco aparece, asumimos 1 ración por unidad (legacy).
      const packSize = Number(item.unidades_paquete)
        || matchPackSize(item.nombre)
        || 1;
      raciones += cantidad * packSize;
      totalFoodMassKg += Number(item.peso_kg || 0) * cantidad;
    } else if (isOdreItem(item)) {
      const litros = item.litros_actuales != null
        ? Number(item.litros_actuales)
        : ODRE_CAPACIDAD_L;
      for (let k = 0; k < cantidad; k++) {
        odres.push({ idx, litros_actuales: litros });
      }
    } else if (lower(item.nombre).includes('agua') && item.litros) {
      aguaSuelta += Number(item.litros) * cantidad;
    } else {
      // Other food items (categoria=consumibles/comida_posadas)
      const cat = lower(item.categoria);
      if (cat === 'consumibles' || cat === 'comida_posadas') {
        totalFoodMassKg += Number(item.peso_kg || 0) * cantidad;
      }
    }
  });

  const totalLitros =
    odres.reduce((s, o) => s + o.litros_actuales, 0) + aguaSuelta;

  // Conversión másica: 1 ración = 1 kg de comida (1 día completo).
  const KG_POR_RACION = 1.0;
  const diasComidaTotal = totalFoodMassKg / KG_POR_RACION;

  return { raciones, odres, aguaSuelta, totalLitros, totalFoodMassKg, diasComidaTotal };
};

/**
 * How many days of food/water this character has, assuming standard intake.
 * `diasComida` uses the total food mass (all consumibles), not just raciones.
 */
export const daysOfProvisions = (inventario = []) => {
  const s = summarizeProvisions(inventario);
  return {
    diasComida: Math.floor(s.diasComidaTotal || 0),
    diasAgua: Math.floor(s.totalLitros / LITROS_AGUA_POR_DIA),
    raciones: s.raciones,
    diasComidaTotal: s.diasComidaTotal,
    totalFoodMassKg: s.totalFoodMassKg,
    litros: s.totalLitros,
  };
};

/**
 * Compute how many packs/odres a character must BUY to cover `dias` days,
 * given what they already have. Always rounds UP to the next pack/odre.
 */
export const computeShortfall = (inventario = [], dias = 0) => {
  if (dias <= 0) return { packsRaciones: 0, odres: 0, raciones: 0, litros: 0 };

  const s = summarizeProvisions(inventario);
  const racionesNecesarias = dias * RACIONES_POR_DIA;
  const litrosNecesarios = dias * LITROS_AGUA_POR_DIA;

  const racionesFaltantes = Math.max(0, racionesNecesarias - s.raciones);
  const litrosFaltantes = Math.max(0, litrosNecesarios - s.totalLitros);

  return {
    raciones: s.raciones,
    litros: s.totalLitros,
    racionesFaltantes,
    litrosFaltantes,
    packsRaciones: Math.ceil(racionesFaltantes / PACK_RACIONES_DEFAULT),
    odres: Math.ceil(litrosFaltantes / ODRE_CAPACIDAD_L),
  };
};

/**
 * Initial per-member provisions snapshot at the start of a journey.
 * Returns: { raciones: number, odres: [{litros}], _initialIdxs: ... }
 * If `autoFill` is true, every odre is topped up to ODRE_CAPACIDAD_L.
 */
export const buildInitialProvisions = (inventario = [], autoFill = false) => {
  const s = summarizeProvisions(inventario);
  const odres = s.odres.map((o) => ({
    litros_actuales: autoFill ? ODRE_CAPACIDAD_L : o.litros_actuales,
  }));
  return {
    raciones: s.raciones,
    odres,
    diasSinComida: 0,
    diasSinAgua: 0,
  };
};

/**
 * Consume one day of food/water from a per-member provisions object.
 * Mutates a copy and returns it together with consumption flags.
 */
export const consumeOneDay = (prov) => {
  const next = {
    ...prov,
    odres: prov.odres.map((o) => ({ ...o })),
  };

  // 1) Food
  let comio = false;
  if (next.raciones > 0) {
    next.raciones -= 1;
    comio = true;
  } else {
    next.diasSinComida = (next.diasSinComida || 0) + 1;
  }

  // 2) Water — drink from the fullest odre first
  let bebio = false;
  let litrosNecesarios = LITROS_AGUA_POR_DIA;
  next.odres.sort((a, b) => b.litros_actuales - a.litros_actuales);
  for (const o of next.odres) {
    if (litrosNecesarios <= 0) break;
    if (o.litros_actuales <= 0) continue;
    const take = Math.min(o.litros_actuales, litrosNecesarios);
    o.litros_actuales -= take;
    litrosNecesarios -= take;
  }
  if (litrosNecesarios <= 0) {
    bebio = true;
  } else {
    next.diasSinAgua = (next.diasSinAgua || 0) + 1;
  }

  return { next, comio, bebio };
};

/**
 * Refill all odres of a character to capacity (e.g. resting at a town).
 */
export const refillAllOdres = (prov) => ({
  ...prov,
  odres: prov.odres.map((o) => ({ litros_actuales: ODRE_CAPACIDAD_L })),
});

export const PROVISIONS_CONSTANTS = {
  PACK_RACIONES_DEFAULT,
  ODRE_CAPACIDAD_L,
  LITROS_AGUA_POR_DIA,
  RACIONES_POR_DIA,
};
