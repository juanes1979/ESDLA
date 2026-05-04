/**
 * useFatigueSystem
 *
 * Hook que encapsula TODO el estado + lógica de la salvación de fatiga del
 * viaje y de la marcha forzada (extraído de `EnhancedTravelSystem.jsx`
 * durante el refactor P1 de Mayo 2026).
 *
 * Estado expuesto:
 *   • globalFatigaCD         – CD acumulada de la tirada final de fatiga.
 *   • fatigaCdBreakdown      – lista de modificadores ({motivo, delta, dia, casilla}).
 *   • lastFatigueSaves       – última salvación por personaje.
 *   • fatigueChanges         – delta de fatiga por personaje tras la última tirada.
 *   • fatigueSaveLog         – log histórico de tiradas.
 *   • forcedMarchActive      – ¿la marcha forzada está persistiendo?
 *
 * Acciones:
 *   • addCdModifier({motivo, delta, dia, casilla})
 *       Suma (o resta) delta a la CD y deja traza en el breakdown. Persiste
 *       opcionalmente en backend (PATCH /travel/journey/{id}/fatigue-cd).
 *   • applyForcedMarchExtraConsumption(options)
 *       Consume +50% comida y ×3 agua extra sobre el consumo base del ritmo.
 *   • applyForcedMarchSaves(dia)
 *       Ejecuta la salvación CON CD 15 a todos los viajeros tras un día de MF.
 *   • setForcedMarchActive(bool), setGlobalFatigaCD(fn), etc.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';

const FORCED_MARCH_CD = 15;
const FOOD_EXTRA_MULT = 0.5;   // +50 % comida
const WATER_EXTRA_MULT = 2.0;  // ×3 agua total → +200 % extra sobre el base.

const conMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

export const useFatigueSystem = ({
  config,
  characters,
  setCharacters,
  travelRules,
  setPartyProvisions,
  journeyId = null,
} = {}) => {
  const [globalFatigaCD, setGlobalFatigaCD] = useState(10);
  const [fatigaCdBreakdown, setFatigaCdBreakdown] = useState([]);
  const [lastFatigueSaves, setLastFatigueSaves] = useState({});
  const [fatigueChanges, setFatigueChanges] = useState({});
  const [fatigueSaveLog, setFatigueSaveLog] = useState([]);
  const [forcedMarchActive, setForcedMarchActive] = useState(false);

  /** Añade un modificador a la CD y deja traza en el breakdown + backend. */
  const addCdModifier = useCallback(async ({ motivo, delta, dia = null, casilla = null, persist = true }) => {
    if (!delta) return;
    setGlobalFatigaCD(prev => (prev || 10) + delta);
    setFatigaCdBreakdown(prev => [...prev, {
      motivo: motivo || 'Modificador',
      delta,
      dia,
      casilla,
    }]);
    if (persist && journeyId) {
      try {
        await api.patch(`/travel/journey/${journeyId}/fatigue-cd`, null, {
          params: { delta, reason: motivo || 'Modificador' },
        });
      } catch (_e) {
        /* non-fatal — el HUD ya muestra el valor nuevo. */
      }
    }
  }, [journeyId]);

  /** Consumo extra por un día de marcha forzada: +50% comida, ×3 agua. */
  const applyForcedMarchExtraConsumption = useCallback(() => {
    const todosViajeros = [
      ...((config?.miembros || []).filter(m => m.papeles?.length > 0)),
      ...(config?.acompanantes || []),
    ];
    const n = todosViajeros.length;
    if (n === 0 || !setPartyProvisions) return;
    const ritmo = config?.ritmo || 'normal';
    const baseFood = Number(travelRules?.[`consumo_comida_${ritmo}`] ?? 1.0);
    const baseWater = Number(travelRules?.[`consumo_agua_${ritmo}`] ?? 2.0);
    const extraComida = n * baseFood * FOOD_EXTRA_MULT;
    const extraAgua = n * baseWater * WATER_EXTRA_MULT;
    setPartyProvisions(prev => ({
      ...prev,
      comidaConsumida: (prev?.comidaConsumida || 0) + extraComida,
      aguaConsumida: (prev?.aguaConsumida || 0) + extraAgua,
    }));
    toast.info(`⚡ Marcha forzada: +${extraComida.toFixed(1)} raciones y +${extraAgua.toFixed(1)} L consumidos extra.`);
  }, [config, travelRules, setPartyProvisions]);

  /**
   * Tira salvación CON CD 15 para cada viajero tras un día de marcha forzada.
   * Aplica niveles de fatiga según el margen de fallo (RAW Mayo 2026):
   *   <5 → +1, 5-9 → +2, ≥10 → +3.
   */
  const applyForcedMarchSaves = useCallback(async (dia) => {
    if (!characters || !setCharacters) return [];
    const miembrosConPapeles = (config?.miembros || []).filter(m => m.papeles?.length > 0);
    const todosViajeros = [
      ...miembrosConPapeles,
      ...(config?.acompanantes || []),
    ];
    const results = [];
    for (const miembro of todosViajeros) {
      const char = characters.find(c => c.id === miembro.id);
      if (!char) continue;
      const mod = conMod(char.atributos?.constitucion);
      // Desventaja en MF si carga 3+ papeles (viaje en solitario o muy
      // desbalanceado): tirada con 2d20 quedándose con el menor.
      const rolesCount = (miembro.papeles || []).length;
      const conDesventaja = rolesCount >= 3;
      const d1 = Math.floor(Math.random() * 20) + 1;
      const d2 = Math.floor(Math.random() * 20) + 1;
      const d20 = conDesventaja ? Math.min(d1, d2) : d1;
      const total = d20 + mod;
      const exito = total >= FORCED_MARCH_CD;
      let nivelesCansancio = 0;
      if (!exito) {
        const margen = FORCED_MARCH_CD - total;
        nivelesCansancio = margen >= 10 ? 3 : margen >= 5 ? 2 : 1;
      }
      if (nivelesCansancio > 0) {
        const fatigaActual = Number(char.fatiga || 0);
        const nuevaFatiga = Math.min(6, fatigaActual + nivelesCansancio);
        try {
          await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: nuevaFatiga });
          setCharacters(prev => prev.map(c => c.id === miembro.id ? { ...c, fatiga: nuevaFatiga } : c));
        } catch (e) {
          console.error('Error aplicando fatiga marcha forzada:', e);
        }
        const sufijo = conDesventaja ? ` (desventaja: 2d20=${d1}/${d2}→${d20})` : '';
        toast.error(`⚡ Marcha forzada (día ${dia}): ${char.nombre} falla CON ${total} vs CD ${FORCED_MARCH_CD}${sufijo} → +${nivelesCansancio} nivel${nivelesCansancio === 1 ? '' : 'es'}`);
      } else {
        const sufijo = conDesventaja ? ` (desventaja: 2d20=${d1}/${d2}→${d20})` : '';
        toast.success(`⚡ Marcha forzada (día ${dia}): ${char.nombre} supera CON ${total} vs CD ${FORCED_MARCH_CD}${sufijo}`);
      }
      results.push({ charId: miembro.id, total, exito, niveles: nivelesCansancio, desventaja: conDesventaja });
    }
    return results;
  }, [characters, setCharacters, config]);

  /** Reset al iniciar un viaje nuevo. */
  const resetFatigueSystem = useCallback(() => {
    setGlobalFatigaCD(10);
    setFatigaCdBreakdown([]);
    setLastFatigueSaves({});
    setFatigueChanges({});
    setFatigueSaveLog([]);
    setForcedMarchActive(false);
  }, []);

  return {
    // state
    globalFatigaCD, setGlobalFatigaCD,
    fatigaCdBreakdown, setFatigaCdBreakdown,
    lastFatigueSaves, setLastFatigueSaves,
    fatigueChanges, setFatigueChanges,
    fatigueSaveLog, setFatigueSaveLog,
    forcedMarchActive, setForcedMarchActive,
    // actions
    addCdModifier,
    applyForcedMarchExtraConsumption,
    applyForcedMarchSaves,
    resetFatigueSystem,
  };
};

export default useFatigueSystem;
