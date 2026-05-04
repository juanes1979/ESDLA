import { useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import { calculateGroupMultiplier } from '@/components/travel/travelHelpers';
import { printJourneyDocument as printJourneyDocumentHelper } from '@/components/travel/travelPrint';
import { consumeProportionalFood } from '@/components/travel/proportionalFoodConsumption';

/**
 * Hook que agrupa toda la lógica de "cierre del viaje":
 * - `resetJourney`       → vuelve al modo configuración y limpia resultados.
 * - `generateJourneyNarrative` → IA narrativa final.
 * - `printJourneyDocument`     → imprime PDF via helper.
 * - `persistProvisionsToInventory` → persiste el consumo en el inventario real.
 * - `applyPXToCharacters`      → aplica PX individuales + persiste provisiones.
 *
 * Recibe sólo estado + setters del contenedor principal para mantener el
 * mismo comportamiento que tenía inline en `EnhancedTravelSystem.jsx`.
 */
const useJourneyResults = ({
  // Estado principal
  config,
  characters,
  journeyCalc,
  events,
  partyProvisions,
  journeyChronicle,
  journeyNarrative,
  includeChronicleInPDF,
  characterXP,
  activeJourney,
  journeyWeather,
  currentPosition,
  nextEventPosition,
  savedMapImage,
  mapContainerRef,
  orientationChecks,
  fatigueResults,
  // Setters
  setMode,
  setEvents,
  setCurrentEvent,
  setActiveJourney,
  setFatigueResults,
  setJourneyCalc,
  setPxApplied,
  setPxResults,
  setJourneyNarrative,
  setSavedMapImage,
  setDailySummaries,
  setGeneratingNarrative,
  setApplyingPX,
}) => {
  // =============== RESET ===============
  const resetJourney = useCallback(() => {
    setMode('config');
    setEvents([]);
    setCurrentEvent(null);
    setActiveJourney(null);
    setFatigueResults([]);
    setJourneyCalc(null);
    setPxApplied(false);
    setPxResults(null);
    setJourneyNarrative(null);
    setSavedMapImage(null);
    setDailySummaries([]);
  }, [
    setMode, setEvents, setCurrentEvent, setActiveJourney, setFatigueResults,
    setJourneyCalc, setPxApplied, setPxResults, setJourneyNarrative,
    setSavedMapImage, setDailySummaries,
  ]);

  // =============== NARRATIVA FINAL (IA) ===============
  const generateJourneyNarrative = useCallback(async () => {
    setGeneratingNarrative(true);
    try {
      const res = await api.post('/travel/generate-journey-summary', {
        origen: config.origenNombre,
        destino: config.destinoNombre,
        dias: journeyCalc?.estimaciones?.dias_estimados || 1,
        eventos: events.map((e) => ({
          dia: e.casilla,
          nombre: e.evento?.nombre,
          exito: e.exito,
          tirada: e.tirada,
          cd: e.resolucion?.cd,
          consecuencia: e.exito
            ? e.evento?.consecuencias_exito
            : e.evento?.consecuencias_fracaso,
          narrativa_individual: e.narrativa || '',
          clima: e.clima_dia
            ? `${e.clima_dia.estado_label || ''}${e.clima_dia.region ? ' (' + e.clima_dia.region + ')' : ''}`.trim()
            : '',
        })),
        clima_por_dia: (journeyWeather || []).map((w, i) => ({
          dia: i + 1,
          estado: w?.estado_label || '',
          region: w?.region || '',
        })),
        personajes: config.miembros.map((m) => ({
          nombre: m.nombre,
          papel: m.papeles?.[0] || 'viajero',
        })),
        px_total: journeyCalc?.estimaciones?.px_total || 0,
        terrenos: journeyCalc?.ruta?.terrain_summary,
        heridos: (() => {
          const lista = [];
          const todos = [
            ...(config.miembros || []),
            ...((config.acompanantes || []).map((a) => ({ ...a, _esAcompanante: true }))),
          ];
          for (const m of todos) {
            const ch = characters.find((c) => c.id === m.id);
            if (!ch) continue;
            const pg = Number(ch.puntos_golpe_actual ?? ch.puntos_golpe_max ?? 0);
            const pgMax = Number(ch.puntos_golpe_max ?? 0);
            if (pgMax > 0 && pg <= 0) {
              const eventoCaida = events.find(
                (e) => e.evento?.id === 'event_terrible' && !e.exito
              );
              lista.push({
                nombre: ch.nombre || m.nombre,
                dia: eventoCaida?.casilla || null,
                evento: eventoCaida?.evento?.nombre || 'un acontecimiento del viaje',
                pg_max: pgMax,
              });
            }
          }
          return lista;
        })(),
      });

      if (res.data.success) {
        setJourneyNarrative(res.data.narrative);
      }
    } catch (err) {
      console.error('Error generating narrative:', err);
      toast.error('Error al generar narrativa');
    } finally {
      setGeneratingNarrative(false);
    }
  }, [
    config, characters, events, journeyCalc, journeyWeather,
    setJourneyNarrative, setGeneratingNarrative,
  ]);

  // =============== IMPRIMIR PDF ===============
  const printJourneyDocument = useCallback(() => printJourneyDocumentHelper({
    config,
    journeyCalc,
    events,
    orientationChecks,
    currentPosition,
    nextEventPosition,
    savedMapImage,
    mapContainerRef,
    characterXP,
    journeyNarrative,
    journeyChronicle,
    includeChronicleInPDF,
    fatigueResults,
  }), [
    config, journeyCalc, events, orientationChecks, currentPosition,
    nextEventPosition, savedMapImage, mapContainerRef, characterXP,
    journeyNarrative, journeyChronicle, includeChronicleInPDF, fatigueResults,
  ]);

  // =============== PERSISTIR PROVISIONES AL INVENTARIO ===============
  const persistProvisionsToInventory = useCallback(async () => {
    const todosViajeros = [
      ...config.miembros.filter((m) => m.papeles?.length > 0),
      ...((config.acompanantes || [])),
    ];
    if (todosViajeros.length === 0) return { ok: 0, fail: 0 };

    const racionesPorViajero = Math.ceil(
      (partyProvisions.comidaConsumida || 0) / todosViajeros.length
    );
    const gramosPorViajero = racionesPorViajero * 500;
    const litrosPorViajero = Math.ceil(
      (partyProvisions.aguaConsumida || 0) / todosViajeros.length
    );

    let ok = 0;
    let fail = 0;

    for (const m of todosViajeros) {
      const char = characters.find((c) => c.id === m.id);
      if (!char || !char.inventario) continue;

      const { inventario: afterFood } = consumeProportionalFood(
        char.inventario,
        gramosPorViajero
      );
      const newInventario = JSON.parse(JSON.stringify(afterFood));

      let litrosPorRestar = litrosPorViajero;
      for (const item of newInventario) {
        if (litrosPorRestar <= 0) break;
        if (!item || !item.nombre) continue;
        const n = (item.nombre || '').toLowerCase();
        if (!n.includes('odre')) continue;
        const litrosActuales = item.litros_actuales != null
          ? Number(item.litros_actuales)
          : 10;
        const cantidad = Number(item.cantidad || 1);
        let restantes = cantidad;
        let litrosThisItem = litrosActuales;
        const odresVaciados = [];
        while (restantes > 0 && litrosPorRestar > 0) {
          const take = Math.min(litrosThisItem, litrosPorRestar);
          litrosThisItem -= take;
          litrosPorRestar -= take;
          if (litrosThisItem <= 0) {
            odresVaciados.push(1);
            litrosThisItem = litrosActuales;
            restantes -= 1;
          }
        }
        const nVaciados = odresVaciados.length;
        if (nVaciados > 0) {
          item.cantidad = (item.cantidad || 1) - nVaciados;
          newInventario.push({
            nombre: 'Odre vacío',
            cantidad: nVaciados,
            categoria: 'equipo_general',
            peso_kg: 0.5,
            litros_actuales: 0,
          });
        }
        if (restantes > 0 && litrosThisItem !== litrosActuales) {
          item.cantidad = (item.cantidad || 1) - 1;
          newInventario.push({
            nombre: `Odre semilleno (${litrosThisItem} L)`,
            cantidad: 1,
            categoria: 'equipo_general',
            peso_kg: 0.5 + litrosThisItem,
            litros_actuales: litrosThisItem,
          });
        }
      }

      const cleaned = newInventario.filter(
        (it) => it && (it.cantidad == null || Number(it.cantidad) > 0)
      );

      try {
        await api.patch(`/characters/${m.id}`, { inventario: cleaned });
        ok += 1;
      } catch (err) {
        console.error(`Error guardando inventario de ${m.nombre}:`, err);
        fail += 1;
      }
    }

    return { ok, fail };
  }, [config.miembros, config.acompanantes, characters, partyProvisions]);

  // =============== APLICAR PX A PERSONAJES ===============
  const applyPXToCharacters = useCallback(async () => {
    const allTravellers = [
      ...config.miembros,
      ...((config.acompanantes || []).map((a) => ({ ...a, papeles: a.papeles || [] }))),
    ];
    if (allTravellers.length === 0) {
      toast.error('No hay viajeros');
      return;
    }

    const journeyBasePX = journeyCalc?.estimaciones?.px_total || 0;
    const pxPerMemberFromJourney = Math.round(journeyBasePX / allTravellers.length);

    setApplyingPX(true);

    try {
      const allRolls = Object.values(characterXP).flatMap((c) => c.rolls || []);
      const aciertos = allRolls.filter((r) => r.exito).length;
      const fallos = allRolls.length - aciertos;
      const groupMult = calculateGroupMultiplier(aciertos, fallos);

      const characterPXList = allTravellers.map((m) => {
        const rollsXP = characterXP[m.id]?.total || 0;
        const rollsXPAjustado = Math.floor(rollsXP * groupMult.multiplicador);
        const totalXP = Math.max(0, pxPerMemberFromJourney + rollsXPAjustado);
        return {
          character_id: m.id,
          character_name: m.nombre,
          px_amount: totalXP,
          px_journey: pxPerMemberFromJourney,
          px_rolls: rollsXPAjustado,
        };
      });

      const response = await api.post('/travel/apply-px-individual', {
        characters: characterPXList,
        journey_id: activeJourney?.id || null,
        journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`,
      });

      if (response.data.success) {
        setPxApplied(true);
        setPxResults(response.data);
        toast.success(`¡PX aplicados a ${response.data.exitosos} personajes!`);
        try {
          const persisted = await persistProvisionsToInventory();
          if (persisted.ok > 0) {
            toast.success(
              `Inventarios actualizados: raciones consumidas restadas a ${persisted.ok} viajero(s).`
            );
          }
          if (persisted.fail > 0) {
            toast.error(`No se pudieron actualizar ${persisted.fail} inventario(s).`);
          }
        } catch (provErr) {
          console.error('Error persisting provisions:', provErr);
        }
      } else {
        toast.error(response.data.message || 'Error al aplicar PX');
      }
    } catch (err) {
      console.error('Error applying PX:', err);
      try {
        const totalRollsXP = Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0);
        const avgPX = Math.round((journeyBasePX + totalRollsXP) / allTravellers.length);
        const response = await api.post('/travel/apply-px', {
          character_ids: allTravellers.map((m) => m.id),
          px_amount: avgPX,
          journey_id: activeJourney?.id || null,
          journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`,
        });

        if (response.data.success) {
          setPxApplied(true);
          setPxResults(response.data);
          toast.success(`¡PX aplicados a ${response.data.exitosos} personajes!`);
        } else {
          toast.error(response.data.message || 'Error al aplicar PX');
        }
      } catch (_fallbackErr) {
        toast.error('Error al aplicar PX a los personajes');
      }
    } finally {
      setApplyingPX(false);
    }
  }, [
    config, journeyCalc, characterXP, activeJourney,
    setApplyingPX, setPxApplied, setPxResults, persistProvisionsToInventory,
  ]);

  return {
    resetJourney,
    generateJourneyNarrative,
    printJourneyDocument,
    persistProvisionsToInventory,
    applyPXToCharacters,
  };
};

export default useJourneyResults;
