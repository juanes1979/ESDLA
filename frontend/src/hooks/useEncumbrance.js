/**
 * useEncumbrance — Hook compartido para calcular peso transportado y
 * estorbo en tiempo real, a partir del inventario + equipo de ocupación
 * del personaje. Garantiza que TODAS las pestañas de la ficha (Resumen,
 * Combate, Equipo) muestren los mismos valores aunque el campo persistido
 * `estorbo_metros` en la BD esté desfasado.
 *
 * Reglas LotR 5e Mod (acordadas con el usuario):
 *  • capacidad normal: FUE × 8 kg (×2 Grande, ÷2 Pequeño/Hobbit)
 *  • empujar/arrastrar/levantar: FUE × 16 kg
 *  • cargado: peso > FUE × 2.5 → −33 % de movimiento
 *  • muy cargado: peso > FUE × 5 → −66 % + desventaja en FUE/DES/CON
 *  • sobrecargado: peso > capacidad → no puedes moverte con normalidad
 *  • si la montura "transporta_equipo": pesoEfectivo = 0 (Sin estorbo)
 */
import { useState, useEffect, useMemo } from 'react';
import api from '@/services/api';

let _pesoCache = null;

const normalizar = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/\s+[—–-]\s+mod\.?/i)[0]
  .replace(/\s+\(.*?\)/g, '')
  .replace(/\s+x\d+$/, '')
  .replace(/[\[\]]/g, '')
  .trim();

const cargarPesos = async () => {
  if (_pesoCache) return _pesoCache;
  const cache = {};
  try {
    const [w, a, e] = await Promise.allSettled([
      api.get('/data/weapons'),
      api.get('/data/armors'),
      api.get('/data/equipment-catalog'),
    ]);
    const collect = (r) => {
      if (r.status !== 'fulfilled' || !r.value?.data) return [];
      const d = r.value.data;
      if (Array.isArray(d)) return d;
      const all = [];
      for (const v of Object.values(d)) {
        if (Array.isArray(v)) all.push(...v);
      }
      return all;
    };
    [...collect(w), ...collect(a), ...collect(e)].forEach(it => {
      const n = normalizar(it?.nombre);
      const peso = Number(it?.peso_kg ?? it?.peso ?? 0);
      if (n && peso > 0) cache[n] = peso;
    });
  } catch (err) {
    // silencioso
  }
  _pesoCache = cache;
  return cache;
};

export function useEncumbrance(character) {
  const [pesoMap, setPesoMap] = useState(_pesoCache || {});

  useEffect(() => {
    if (_pesoCache) {
      if (pesoMap !== _pesoCache) setPesoMap(_pesoCache);
      return;
    }
    cargarPesos().then(setPesoMap);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inventario = character?.inventario || [];
  const equipoOcupacion = character?.equipo_ocupacion || [];
  const fuerza = Number(character?.atributos?.fuerza ?? 10);
  const tam = (character?.tamano || character?.cultura_tamano || '').toLowerCase();
  const isSmall = tam.includes('peque') || tam.includes('small') || tam.includes('hobbit');
  const isLarge = tam.includes('grande') || tam.includes('large');
  const sizeMul = isLarge ? 2 : isSmall ? 0.5 : 1;

  const cargaMaxima = +(fuerza * 8 * sizeMul).toFixed(1);
  const empujarArrastrar = +(fuerza * 16 * sizeMul).toFixed(1);
  const umbralCargado = +(fuerza * 2.5 * sizeMul).toFixed(1);
  const umbralMuyCargado = +(fuerza * 5 * sizeMul).toFixed(1);

  const pesoTotal = useMemo(() => {
    const sumItem = (it) => {
      if (!it) return 0;
      if (typeof it === 'object' && (it?.portado_por || '').toLowerCase() === 'montura') return 0;
      const cant = Number(typeof it === 'object' ? (it.cantidad || 1) : 1);
      const propio = Number((typeof it === 'object' ? (it.peso_kg ?? it.peso) : 0) || 0);
      const nombre = typeof it === 'string' ? it : it?.nombre;
      let peso = propio;
      if (!peso) peso = pesoMap[normalizar(nombre)] || 0;
      return peso * cant;
    };
    let total = 0;
    inventario.forEach(it => { total += sumItem(it); });
    equipoOcupacion.forEach(it => { total += sumItem(it); });
    return total;
  }, [inventario, equipoOcupacion, pesoMap]);

  const monturaCarga = !!character?.montura?.transporta_equipo;
  const pesoEfectivo = monturaCarga ? 0 : pesoTotal;

  let estado = 'Sin estorbo';
  let tier = 'ok'; // 'ok' | 'cargado' | 'muy' | 'sobrecargado'
  let factorMov = 1;
  let color = 'text-emerald-300';
  let desventajaTiradas = false;
  if (pesoEfectivo > cargaMaxima) {
    estado = 'Sobrecargado (no puedes moverte con normalidad)';
    tier = 'sobrecargado'; factorMov = 0; color = 'text-red-500'; desventajaTiradas = true;
  } else if (pesoEfectivo > umbralMuyCargado) {
    estado = 'Muy cargado (-66 % movimiento, desventaja en FUE/DES/CON)';
    tier = 'muy'; factorMov = 1 / 3; color = 'text-red-400'; desventajaTiradas = true;
  } else if (pesoEfectivo > umbralCargado) {
    estado = 'Cargado (-33 % movimiento)';
    tier = 'cargado'; factorMov = 2 / 3; color = 'text-orange-300';
  }

  const velBase = Number(character?.velocidad || character?.cultura_velocidad || 9);
  const velEfectiva = Math.max(0, Math.round(velBase * factorMov));
  const estorboM = velEfectiva - velBase;

  return {
    pesoMap,
    pesoTotal,
    pesoEfectivo,
    monturaCarga,
    fuerza, sizeMul,
    cargaMaxima, empujarArrastrar, umbralCargado, umbralMuyCargado,
    estado, tier,
    factorMov, color, desventajaTiradas,
    velBase, velEfectiva, estorboM,
  };
}

export { normalizar, cargarPesos };
