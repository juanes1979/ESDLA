/**
 * useJourneyProvisions
 *
 * Custom hook que encapsula TODO el estado + lógica de provisiones del
 * sistema de viaje (Enhanced Travel System):
 *   • Comida/agua disponibles a nivel grupo
 *   • Fatiga acumulada por falta de provisiones (por personaje y a nivel grupo)
 *   • Cálculo de días disponibles a partir de inventarios reales
 *   • Consumo diario (ritmo + marcha forzada)
 *   • Recarga de agua cerca de asentamientos / ríos
 *   • Forrajeo (tirada de Sabiduría con ventaja si Cazador)
 *
 * Extraído de `EnhancedTravelSystem.jsx` (P0: refactor del archivo gigante).
 * No incluye lógica de eventos / orientación / rutas; sólo provisiones.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { summarizeProvisions } from '@/components/travel/inventoryProvisions';

const LITROS_AGUA_POR_DIA_BASE = 2;

// Origen "asentamiento conocido" → odres parten LLENOS al iniciar el viaje.
const isKnownSettlement = (loc) => {
  if (!loc) return false;
  const tipo = (loc?.tipo || loc?.tipo_lugar || '').toLowerCase();
  if (!tipo) return true; // sin tipo definido → asumimos asentamiento
  return ['aldea', 'pueblo', 'ciudad', 'refugio', 'santuario', 'asentamiento',
          'fortal', 'castillo', 'hostal', 'posada'].some(k => tipo.includes(k));
};

/**
 * @param {Object} args
 * @param {Object} args.config        - El JourneyConfig completo (miembros, acompanantes, ritmo, horasMarchaForzada, origenId).
 * @param {Array}  args.characters    - Lista de personajes con inventario.
 * @param {Array}  args.locations     - Lista de ubicaciones (para detectar asentamientos).
 * @param {Object} args.travelRules   - Reglas editables del DJ (consumo_comida_*, etc.).
 * @param {Function} args.onForageDay - Callback opcional ejecutado cuando el forrajeo consume 1 día (incrementa stageDays en el padre).
 */
export const useJourneyProvisions = ({ config, characters, locations, travelRules, onForageDay } = {}) => {
  const [partyProvisions, setPartyProvisions] = useState({
    comidaTotal: 0,
    aguaTotal: 0,
    comidaConsumida: 0,
    aguaConsumida: 0,
  });
  const [provisionFatigue, setProvisionFatigue] = useState({}); // { charId: { sinComida, sinAgua } }
  const [diasSinComida, setDiasSinComida] = useState(0);
  const [diasSinAgua, setDiasSinAgua] = useState(0);

  /**
   * Lee inventarios reales de los viajeros y calcula la disponibilidad
   * vs. el viaje planificado. Devuelve { numPersonajes, comidaNecesaria,
   * aguaNecesaria, comidaDisponible, aguaDisponible, ... } o null.
   */
  const checkProvisionsForJourney = useCallback((diasViaje) => {
    if (!config?.miembros?.length || !diasViaje) return null;

    const todosViajeros = [
      ...(config.miembros.filter(m => m.papeles?.length > 0)),
      ...(config.acompanantes || []),
    ];
    const numPersonajes = todosViajeros.length;
    if (numPersonajes === 0) return null;

    const comidaNecesaria = numPersonajes * diasViaje;
    const aguaNecesaria = numPersonajes * diasViaje * LITROS_AGUA_POR_DIA_BASE;

    const origenLoc = (locations || []).find(l => l.id === config.origenId);
    const origenAsent = isKnownSettlement(origenLoc);

    let comidaDisponible = 0;
    let aguaDisponible = 0;
    todosViajeros.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      const summary = summarizeProvisions(char.inventario);
      comidaDisponible += summary.diasComidaTotal || summary.raciones;
      const litros = origenAsent
        ? summary.odres.length * 10 + summary.aguaSuelta
        : summary.totalLitros;
      aguaDisponible += litros;
    });

    return {
      numPersonajes,
      comidaNecesaria,
      aguaNecesaria,
      comidaDisponible,
      aguaDisponible,
      comidaSuficiente: comidaDisponible >= comidaNecesaria,
      aguaSuficiente: aguaDisponible >= aguaNecesaria,
      diasComida: comidaDisponible / numPersonajes,
      diasAgua: aguaDisponible / (numPersonajes * LITROS_AGUA_POR_DIA_BASE),
      faltaComida: Math.max(0, comidaNecesaria - comidaDisponible),
      faltaAgua: Math.max(0, aguaNecesaria - aguaDisponible),
    };
  }, [config, characters, locations]);

  /**
   * Inicializa provisiones al comenzar un viaje. Si el origen es
   * asentamiento conocido, los odres se rellenan gratis a 10 L.
   * Devuelve true si se rellenaron odres en origen (para mostrar toast en el padre).
   */
  const initializeProvisions = useCallback(() => {
    const todosViajeros = [
      ...(config.miembros.filter(m => m.papeles?.length > 0)),
      ...(config.acompanantes || []),
    ];
    const origenLoc = (locations || []).find(l => l.id === config.origenId);
    const origenAsent = isKnownSettlement(origenLoc);

    let comidaInicial = 0;
    let aguaInicial = 0;
    todosViajeros.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      const summary = summarizeProvisions(char.inventario);
      comidaInicial += summary.diasComidaTotal || summary.raciones;
      aguaInicial += origenAsent
        ? summary.odres.length * 10 + summary.aguaSuelta
        : summary.totalLitros;
    });

    setPartyProvisions({
      comidaTotal: comidaInicial,
      aguaTotal: aguaInicial,
      comidaConsumida: 0,
      aguaConsumida: 0,
    });
    setProvisionFatigue({});
    setDiasSinComida(0);
    setDiasSinAgua(0);
    return { origenAsent, comidaInicial, aguaInicial, numViajeros: todosViajeros.length };
  }, [config, characters, locations]);

  /**
   * Consume comida/agua de un día completo. Aplica:
   *   • consumo base por ritmo (lento/normal/rápido) según `travelRules`.
   *   • modificador % por horas de marcha forzada (1-4 h).
   *   • Toasts de aviso cuando escasea o se agota.
   */
  const consumeDailyProvisions = useCallback(() => {
    const todosViajeros = [
      ...(config.miembros.filter(m => m.papeles?.length > 0)),
      ...(config.acompanantes || []),
    ];
    const numPersonajes = todosViajeros.length;
    if (numPersonajes === 0) return;

    const ritmo = config.ritmo || 'normal';
    const baseFood = Number(travelRules?.[`consumo_comida_${ritmo}`] ?? 1.0);
    const baseWater = Number(travelRules?.[`consumo_agua_${ritmo}`] ?? 2.0);

    const horasMF = Math.max(0, Math.min(4, Number(config.horasMarchaForzada || 0)));
    const consumoPctArr = travelRules?.marcha_forzada_consumo_pct || [10, 20, 35, 50];
    const mfMultiplier = horasMF > 0 ? 1 + (Number(consumoPctArr[horasMF - 1] || 0) / 100) : 1;

    const comidaConsumidaHoy = numPersonajes * baseFood * mfMultiplier;
    const aguaConsumidaHoy = numPersonajes * baseWater * mfMultiplier;

    setPartyProvisions(prev => {
      const nuevaComida = prev.comidaTotal - prev.comidaConsumida - comidaConsumidaHoy;
      const nuevaAgua = prev.aguaTotal - prev.aguaConsumida - aguaConsumidaHoy;

      // Tracking por personaje (sólo miembros con papel)
      setProvisionFatigue(pfPrev => {
        const next = { ...pfPrev };
        config.miembros.forEach(m => {
          if (!next[m.id]) next[m.id] = { sinComida: 0, sinAgua: 0 };
          if (nuevaComida < 0) next[m.id].sinComida += 1;
          if (nuevaAgua < 0) next[m.id].sinAgua += 1;
        });
        return next;
      });

      // Contadores a nivel grupo (suben CD del descanso)
      setDiasSinComida(d => nuevaComida < 0 ? d + 1 : 0);
      setDiasSinAgua(d => nuevaAgua < 0 ? d + 1 : 0);

      // Avisos
      if (nuevaComida < comidaConsumidaHoy && nuevaComida >= 0) {
        toast.warning(`¡Comida escasa! Queda para ${Math.floor(nuevaComida / Math.max(0.01, comidaConsumidaHoy))} día(s).`);
      } else if (nuevaComida < 0) {
        toast.error(`¡Sin comida! +1 nivel de fatiga para cada miembro.`);
      }
      if (nuevaAgua < aguaConsumidaHoy && nuevaAgua >= 0) {
        toast.warning(`¡Agua escasa! Queda para ${Math.floor(nuevaAgua / Math.max(0.01, aguaConsumidaHoy))} día(s).`);
      } else if (nuevaAgua < 0) {
        toast.error(`¡Sin agua! +2 niveles de fatiga para cada miembro.`);
      }

      return {
        ...prev,
        comidaConsumida: prev.comidaConsumida + comidaConsumidaHoy,
        aguaConsumida: prev.aguaConsumida + aguaConsumidaHoy,
      };
    });
  }, [config.miembros, config.acompanantes, config.ritmo, config.horasMarchaForzada, travelRules]);

  /**
   * Rellena los odres del grupo cerca de un asentamiento o río.
   * Suma 3 días de agua para el grupo entero.
   */
  const refillWaterNearTown = useCallback((townName) => {
    const numPersonajes = config.miembros.filter(m => m.papeles?.length > 0).length
      + (config.acompanantes || []).length;
    const aguaNecesaria = numPersonajes * LITROS_AGUA_POR_DIA_BASE * 3;
    setPartyProvisions(prev => ({ ...prev, aguaTotal: prev.aguaTotal + aguaNecesaria }));
    toast.success(`Agua rellenada cerca de ${townName}. +${aguaNecesaria}L disponibles.`);
  }, [config.miembros, config.acompanantes]);

  /**
   * Acción de forrajeo: tirada de Sabiduría (con ventaja si Cazador).
   * Suma raciones/litros encontrados al grupo y consume 1 día (vía onForageDay).
   * Devuelve { exito, tirada, cd, esCazador }.
   */
  const performForaging = useCallback(async (characterId, opts = {}) => {
    const char = config.miembros.find(m => m.id === characterId)
      || (config.acompanantes || []).find(a => a.id === characterId);
    if (!char) return null;
    const fullChar = characters.find(c => c.id === characterId);

    const esCazador = !!opts.esCazador
      || (char.papeles || []).includes('cazador')
      || (fullChar?.ocupacion_nombre || '').toLowerCase().includes('cazador');
    const d1 = Math.floor(Math.random() * 20) + 1;
    const d2 = esCazador ? (Math.floor(Math.random() * 20) + 1) : null;
    const d20 = esCazador ? Math.max(d1, d2) : d1;
    const modSab = char.modSabiduria != null
      ? Number(char.modSabiduria)
      : Math.floor(((fullChar?.atributos?.sabiduria ?? 10) - 10) / 2);
    const total = d20 + modSab;
    const cd = 15;
    const exito = total >= cd;
    const ventajaMsg = esCazador ? ` [ventaja Cazador: ${d1}/${d2}]` : '';

    if (exito) {
      const comidaEncontrada =
        (Math.floor(Math.random() * 4) + 1) + (Math.floor(Math.random() * 4) + 1);
      const aguaEncontrada =
        (Math.floor(Math.random() * 4) + 1) +
        (Math.floor(Math.random() * 4) + 1) +
        (Math.floor(Math.random() * 4) + 1);
      setPartyProvisions(prev => ({
        ...prev,
        comidaTotal: prev.comidaTotal + comidaEncontrada,
        aguaTotal: prev.aguaTotal + aguaEncontrada,
      }));
      toast.success(`¡${char.nombre} encontró ${comidaEncontrada} raciones y ${aguaEncontrada} L! (Tirada: ${total} vs CD ${cd}${ventajaMsg})`);
    } else {
      toast.error(`${char.nombre} no encontró nada. (Tirada: ${total} vs CD ${cd}${ventajaMsg})`);
    }

    onForageDay && onForageDay();
    return { exito, tirada: total, cd, esCazador };
  }, [config.miembros, config.acompanantes, characters, onForageDay]);

  return {
    // state
    partyProvisions, setPartyProvisions,
    provisionFatigue, setProvisionFatigue,
    diasSinComida, setDiasSinComida,
    diasSinAgua, setDiasSinAgua,
    // actions
    checkProvisionsForJourney,
    initializeProvisions,
    consumeDailyProvisions,
    refillWaterNearTown,
    performForaging,
  };
};

export default useJourneyProvisions;
