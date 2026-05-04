import { useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import {
  calculateRollXP,
  getFatigueBaseCD,
} from '@/components/travel/travelHelpers';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Hook que agrupa toda la lógica de automatización del viaje:
 *   • `automateJourney`       → bucle global (orientación → evento → avance)
 *   • `advanceDay`            → avance día a día con consumo + marcha forzada
 *   • `generateDayEvent`      → genera un evento para el día actual
 *   • `finishDayByDayJourney` → cierra el viaje día a día
 *   • `calculateFatigueResults` → salvaciones de CON del viaje
 *
 * Recibe el estado + setters + helpers de otros hooks (provisions, fatigue)
 * del contenedor principal. No posee estado propio — delega todo al padre.
 */
const useJourneyAutomation = ({
  // Estado
  config,
  journeyCalc,
  journeyWeather,
  locations,
  characters,
  characterXP,
  dailySummaries,
  activeJourney,
  events,
  currentDayConfig,
  forcedMarchActive,
  autoRunning,
  // Refs
  autoStopRef,
  modeRef,
  // Setters
  setAutoRunning,
  setAutoProgress,
  setAutoMessage,
  setAutoSubtitle,
  setEvents,
  setOrientationChecks,
  setCurrentPosition,
  setMode,
  setJourneyWeather,
  setLastOrientationResult,
  setCharacterXP,
  setDailySummaries,
  setActiveJourney,
  setForcedMarchActive,
  setCurrentDayConfig,
  setCurrentEvent,
  setCharacters,
  setFatigueResults,
  // Helpers from other hooks
  consumeDailyProvisions,
  applyForcedMarchExtraConsumption,
  applyForcedMarchSaves,
  // Utility
  getRoleModifier,
  // Eye of Mordor helpers (opcional). Se usa para reset/init al
  // iniciar el viaje y garantizar que la barra refleje el initial_value
  // (ej. Dúnedain → +2) sin esperar al polling.
  eye,
}) => {
  // =============== FATIGUE CALCULATION ===============
  const calculateFatigueResults = useCallback(async (resolvedEvents) => {
    const results = [];

    const terrenoViaje = journeyCalc?.ruta?.terreno || 'moderado';
    let fatigueCd = getFatigueBaseCD(terrenoViaje);

    resolvedEvents.forEach((e) => {
      if (e.resultado?.modificadores?.fatiga_cd_increase) {
        fatigueCd += e.resultado.modificadores.fatiga_cd_increase;
      } else if (e.evento?.fatigue_cd_increase) {
        fatigueCd += e.evento.fatigue_cd_increase;
      }
    });

    const todosLosViajeros = [
      ...config.miembros,
      ...((config.acompanantes || []).map((a) => ({ ...a, papeles: a.papeles || [] }))),
    ];
    for (const member of todosLosViajeros) {
      const char = characters.find((c) => c.id === member.id);
      if (!char) continue;

      const conMod = Math.floor(((char.atributos?.constitucion || 10) - 10) / 2);
      const mountBonus = member.tieneMontura ? (member.monturaConBonus || 0) : 0;
      const tieneMultiplesPapeles = (member.papeles?.length || 0) > 1;

      try {
        const res = await api.post('/travel/fatigue-save', null, {
          params: {
            personaje_nombre: member.nombre,
            modificador_constitucion: conMod,
            cd_acumulada: fatigueCd,
            dias_con_montura: member.tieneMontura ? journeyCalc?.estimaciones?.dias_estimados || 1 : 0,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            bonus_montura_con: mountBonus,
            penalizacion_multiples_papeles: tieneMultiplesPapeles,
          },
        });

        const nivelesGanados = res.data.niveles_cansancio || 0;
        if (nivelesGanados > 0) {
          const fatigaActual = Number(char.fatiga || 0);
          const nuevaFatiga = Math.min(6, fatigaActual + nivelesGanados);
          try {
            await api.put(`/characters/${member.id}/fatigue`, { fatiga: nuevaFatiga });
            setCharacters((prev) => prev.map((c) => (c.id === member.id ? { ...c, fatiga: nuevaFatiga } : c)));
          } catch (e) {
            console.error('Error aplicando fatiga al personaje:', e);
          }
        }

        results.push({
          personaje: member.nombre,
          papel: member.papeles?.length ? member.papeles.join(', ') : 'Acompañante',
          cd_base: getFatigueBaseCD(terrenoViaje),
          ...res.data,
        });
      } catch (err) {
        console.error('Error calculating fatigue:', err);
      }
    }

    setFatigueResults(results);
  }, [config, journeyCalc, characters, setCharacters, setFatigueResults]);

  // =============== DAY BY DAY FUNCTIONS ===============
  const generateDayEvent = useCallback(async () => {
    try {
      const res = await api.post('/travel/generate-event', null, {
        params: {
          tipo_tierra: journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
          terreno: journeyCalc?.ruta?.terreno || 'campo_abierto',
          tipo_via: journeyCalc?.ruta?.tipo_via || undefined,
          estacion: config.estacion,
        },
      });

      if (res.data.success) {
        const newEvent = {
          ...res.data,
          casilla: activeJourney?.casillas_recorridas || 0,
          resuelto: false,
        };
        setCurrentEvent(newEvent);
        setEvents((prev) => [...prev, newEvent]);
        if (forcedMarchActive) {
          setForcedMarchActive(false);
          toast.info('⚡ Marcha forzada interrumpida — ha surgido un evento.');
        }
      }
    } catch (err) {
      console.error('Error generating event:', err);
    }
  }, [journeyCalc, config.estacion, activeJourney, forcedMarchActive, setCurrentEvent, setEvents, setForcedMarchActive]);

  const finishDayByDayJourney = useCallback(async () => {
    try {
      const res = await api.post(`/travel/journey/${activeJourney.id}/complete`);
      if (res.data.success) {
        await calculateFatigueResults(events);
        setMode('results');
      }
    } catch (err) {
      console.error('Error finishing journey:', err);
    }
  }, [activeJourney, events, calculateFatigueResults, setMode]);

  const advanceDay = useCallback(async () => {
    if (!activeJourney) return;

    try {
      const esMarchaForzadaHoy = !!currentDayConfig.marchaForzada || forcedMarchActive;

      const res = await api.post(`/travel/journey/${activeJourney.id}/advance-day`, null, {
        params: {
          ritmo: currentDayConfig.ritmo,
          marcha_forzada_horas: esMarchaForzadaHoy ? 8 : 0,
        },
      });

      if (res.data.success) {
        setActiveJourney(res.data.journey);

        consumeDailyProvisions();
        if (esMarchaForzadaHoy) applyForcedMarchExtraConsumption();

        if (esMarchaForzadaHoy) {
          await applyForcedMarchSaves(res.data.journey?.dia_actual || activeJourney.dia_actual);
        }

        if (currentDayConfig.marchaForzada) {
          setForcedMarchActive(!currentDayConfig.marchaForzadaSoloUnDia);
        }
        setCurrentDayConfig((prev) => ({
          ...prev,
          marchaForzada: false,
          marchaForzadaSoloUnDia: false,
        }));

        if (res.data.journey.dia_actual % 2 === 0) {
          await generateDayEvent();
        }

        if (res.data.completado) {
          await finishDayByDayJourney();
        }
      }
    } catch (err) {
      console.error('Error advancing day:', err);
      toast.error('Error al avanzar día');
    }
  }, [
    activeJourney, currentDayConfig, forcedMarchActive,
    setActiveJourney, setForcedMarchActive, setCurrentDayConfig,
    consumeDailyProvisions, applyForcedMarchExtraConsumption, applyForcedMarchSaves,
    generateDayEvent, finishDayByDayJourney,
  ]);

  // =============== GLOBAL AUTOMATION ===============
  const automateJourney = useCallback(async () => {
    if (autoRunning) {
      autoStopRef.current = true;
      return;
    }
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    const guia = config.miembros.find((m) => m.papeles?.includes('guia'));
    if (!guia) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }

    setAutoRunning(true);
    autoStopRef.current = false;
    setAutoProgress(0);
    setAutoMessage('Iniciando viaje global…');
    setAutoSubtitle('Rodando tirada de orientación inicial');

    const totalCasillas = journeyCalc.ruta.casillas || 1;
    const terreno = journeyCalc?.ruta?.terreno || 'moderado';
    const tipoTierra = journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes';

    let localPos = 0;
    const localEvents = [];
    const localOrientationChecks = [];
    const localCharacterXP = { ...characterXP };
    const localSummaries = [...dailySummaries];
    const guiaTieneMultiplesRoles = guia.papeles && guia.papeles.length > 1;

    if (modeRef.current === 'config') {
      setEvents([]);
      setOrientationChecks([]);
      setCurrentPosition(0);
      setMode('global');
    }

    // Reset + init del Ojo de Mordor para este viaje. Cada viaje empieza
    // desde su `initial_value` (calculado por party). Los incrementos
    // automáticos (nat-1, sombra) se aplicarán durante el bucle global.
    try {
      const partyIds = [
        ...(config.miembros || []).map((m) => m.id),
        ...((config.acompanantes || []).map((a) => a.id)),
      ].filter(Boolean);
      if (eye?.reset) {
        await eye.reset();
        if (partyIds.length > 0 && eye.initParty) {
          await eye.initParty(partyIds);
        }
      } else {
        // Fallback sin hook (no debería pasar)
        await api.post('/eye/reset?state_id=default');
        if (partyIds.length > 0) {
          await api.post('/eye/init?state_id=default', { party_member_ids: partyIds });
        }
      }
    } catch (errEye) {
      console.warn('[automateJourney] Eye reset/init fallo (no bloqueante):', errEye);
    }

    try {
      if (!journeyWeather || journeyWeather.length === 0) {
        try {
          const numDays = Math.max(1, Math.ceil(journeyCalc?.estimaciones?.dias_estimados || totalCasillas));
          const origRegion = (locations || []).find((l) => l.id === config.origenId)?.region || '';
          const destRegion = (locations || []).find((l) => l.id === config.destinoId)?.region || '';
          const regionsByDay = [];
          for (let i = 0; i < numDays; i++) {
            const ratio = numDays > 1 ? i / (numDays - 1) : 0;
            regionsByDay.push(ratio < 0.5 ? origRegion : destRegion);
          }
          const wRes = await api.post('/weather/simulate', {
            mes: config.mes,
            dia_inicio: config.diaMes || 1,
            num_dias: numDays,
            regiones_por_dia: regionsByDay,
          });
          setJourneyWeather(wRes.data?.dias || []);
        } catch (err) {
          console.warn('No se pudo rodar el clima del viaje al inicio:', err);
        }
      }

      let safetyIter = 0;
      const safetyMax = totalCasillas + 20;

      while (localPos < totalCasillas && !autoStopRef.current && safetyIter < safetyMax) {
        safetyIter++;
        const casillasRestantes = totalCasillas - localPos;

        // 1) ORIENTACIÓN
        setAutoMessage('Tirada de orientación');
        setAutoSubtitle(`Casilla ${localPos} de ${totalCasillas}`);
        let oData;
        try {
          const oRes = await api.post('/travel/orientation-check', {
            modificador_sabiduria: guia.modViajar || guia.modSabiduria || 0,
            competencia_viajar: guia.competenciaViajar || false,
            competencia_cartografia: guia.competenciaCartografia || false,
            competencia_navegacion: false,
            tiene_mapa: true,
            viaje_maritimo: false,
            penalizacion_multiples_papeles: guiaTieneMultiplesRoles,
            bonus_competencia: 0,
          }, { params: { casillas_restantes: casillasRestantes } });
          oData = oRes.data;
          if (!oData?.success) throw new Error('orientation failed');
        } catch (e) {
          console.error('Error orientación (auto):', e);
          toast.error('Fallo en tirada de orientación. Viaje global interrumpido.');
          break;
        }

        const exitoOri = oData.total >= 15;
        const xpOri = calculateRollXP(15, oData.total, exitoOri, terreno, tipoTierra, oData.d20);
        const guiaPrev = localCharacterXP[guia.id] || { total: 0, rolls: [] };
        localCharacterXP[guia.id] = {
          total: guiaPrev.total + xpOri.pxFinal,
          rolls: [...guiaPrev.rolls, {
            type: 'orientacion', cd: 15, tirada: oData.total,
            exito: exitoOri, ...xpOri, casilla: localPos,
          }],
        };
        localOrientationChecks.push({
          ...oData, xpResult: xpOri,
          guiaId: guia.id, guiaNombre: guia.nombre,
          casilla_actual: localPos, casillas_restantes: casillasRestantes,
        });
        setLastOrientationResult({
          ...oData, xpResult: xpOri,
          guiaId: guia.id, guiaNombre: guia.nombre,
        });

        const diaOri = localPos + 1;
        localSummaries.push({
          dia: diaOri,
          casilla: localPos,
          tipo: 'orientacion',
          success: exitoOri,
          message: `${guia.nombre} estudia el horizonte: tirada ${oData.total} vs CD 15 → ${exitoOri ? 'éxito' : 'fracaso'}. ${oData.detalle || ''}`,
          clima: (journeyWeather || [])[Math.min(localPos, (journeyWeather || []).length - 1)] || null,
        });

        // 2) ¿COMPLETADO?
        if (oData.viaje_completado) {
          localPos = totalCasillas;
          setCurrentPosition(totalCasillas);
          setAutoProgress(100);
          setAutoMessage('¡Destino alcanzado!');
          setAutoSubtitle(oData.detalle || 'La compañía completa el viaje sin más eventos.');
          await sleep(800);
          break;
        }

        // 3) PRÓXIMA POSICIÓN DE EVENTO
        const casillasHasta = Math.max(1, oData.casillas_hasta_evento || 1);
        const eventPos = Math.min(localPos + casillasHasta, totalCasillas);

        for (let d = localPos + 1; d < eventPos; d++) {
          const dia = d + 1;
          const w = (journeyWeather || [])[Math.min(d, (journeyWeather || []).length - 1)];
          localSummaries.push({
            dia,
            casilla: d,
            tipo: 'marcha',
            clima: w || null,
            marchaType: config.ritmo,
            message: `Día ${dia}: marcha ${config.ritmo} sin incidentes${w?.estado_label ? ` (${w.estado_label})` : ''}.`,
          });
        }

        // 4) EVENTO
        setAutoMessage('Generando acontecimiento');
        setAutoSubtitle(`Casilla ${eventPos}`);
        let evData;
        try {
          const evRes = await api.post('/travel/generate-event', null, {
            params: {
              tipo_tierra: tipoTierra,
              terreno,
              tipo_via: journeyCalc?.ruta?.tipo_via || undefined,
              estacion: config.estacion,
            },
          });
          evData = evRes.data;
          if (!evData?.success) throw new Error('event failed');
        } catch (e) {
          console.error('Error generando evento (auto):', e);
          localPos = eventPos;
          setCurrentPosition(localPos);
          setAutoProgress(Math.min(99, Math.round((localPos / totalCasillas) * 100)));
          continue;
        }

        // 5) RESOLUCIÓN
        const targetRole = evData.objetivo?.papel;
        const { modifier: evMod, member: targetMember } = getRoleModifier(targetRole);
        const d20 = Math.floor(Math.random() * 20) + 1;
        const tirada = d20 + evMod;
        const wDayPre = (journeyWeather || [])[Math.min(eventPos - 1, (journeyWeather || []).length - 1)] || null;
        const climaLabelPre = (wDayPre?.estado_label || '').toLowerCase();
        const climaExtremoPre = ['tormenta','vendaval','nieve fuerte','extremo','helada','ventisca','niebla densa']
          .some((k) => climaLabelPre.includes(k));
        const climaFavPre = ['despejado','soleado','templado','suave','agradable']
          .some((k) => climaLabelPre.includes(k));
        const climaCdMod = climaExtremoPre ? 2 : (climaFavPre ? -1 : 0);
        const cd = Math.max(5, (evData.resolucion?.cd || 12) + climaCdMod);
        const exitoEv = tirada >= cd;

        setAutoMessage(`Resolviendo "${evData.evento?.nombre || 'acontecimiento'}"`);
        setAutoSubtitle(`${targetMember?.nombre || 'Grupo'} · d20=${d20}+${evMod}=${tirada} vs CD ${cd}`);

        try {
          await api.post('/travel/resolve-event', null, {
            params: {
              evento_id: evData.evento.id,
              tirada_resolucion: tirada,
              cd, exito: exitoEv,
              evento_nombre: evData.evento.nombre,
              objetivo_papel: targetRole,
              personaje_nombre: targetMember?.nombre || 'Desconocido',
            },
          });
        } catch (e) {
          console.warn('resolve-event falló (auto), seguimos:', e);
        }

        if (targetMember) {
          const xpEv = calculateRollXP(cd, tirada, exitoEv, terreno, tipoTierra, d20);
          const prev = localCharacterXP[targetMember.id] || { total: 0, rolls: [] };
          localCharacterXP[targetMember.id] = {
            total: prev.total + xpEv.pxFinal,
            rolls: [...prev.rolls, {
              type: 'evento', eventoNombre: evData.evento.nombre,
              cd, tirada, exito: exitoEv, ...xpEv, casilla: eventPos,
            }],
          };
        }

        let narrativa = null;
        try {
          const wDay = (journeyWeather || [])[Math.min(eventPos - 1, (journeyWeather || []).length - 1)];
          const climaTxt = wDay
            ? `${wDay.estado_label}${wDay.region ? ' en ' + wDay.region : ''}`
            : '';
          const nRes = await api.post('/travel/generate-narrative', null, {
            params: {
              evento_nombre: evData.evento.nombre,
              exito: exitoEv,
              consecuencia: exitoEv ? evData.evento.consecuencias_exito : evData.evento.consecuencias_fracaso,
              personaje_nombre: targetMember?.nombre || 'El grupo',
              papel: targetRole,
              tirada, cd,
              origen: config.origenNombre,
              destino: config.destinoNombre,
              terreno,
              evento_numero: localEvents.length + 1,
              total_eventos: localEvents.length + 1,
              dia_actual: eventPos,
              dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
              notas_maestro: '',
              clima: climaTxt,
            },
          });
          if (nRes.data?.success) narrativa = nRes.data.narrative;
        } catch { /* narrativa opcional */ }

        const wDay = (journeyWeather || [])[Math.min(eventPos - 1, (journeyWeather || []).length - 1)] || null;
        localEvents.push({
          ...evData,
          casilla: eventPos,
          resuelto: true,
          tirada,
          exito: exitoEv,
          narrativa,
          orientacion: oData,
          clima_dia: wDay,
        });

        localSummaries.push({
          dia: eventPos,
          casilla: eventPos,
          tipo: 'evento',
          success: exitoEv,
          eventName: evData.evento?.nombre,
          clima: wDay,
          narrativa,
          message: `Día ${eventPos}: ¡${evData.evento?.nombre || 'Acontecimiento'}! ${targetMember?.nombre || 'El grupo'} tira ${tirada} vs CD ${cd} → ${exitoEv ? 'éxito' : 'fracaso'}.`,
        });

        // 6) AVANZA
        localPos = eventPos;
        setCurrentPosition(localPos);
        setAutoProgress(Math.min(99, Math.round((localPos / totalCasillas) * 100)));

        await sleep(180);
      }

      // Sincroniza estado
      setEvents(localEvents);
      setOrientationChecks(localOrientationChecks);
      setCharacterXP(localCharacterXP);
      setCurrentPosition(localPos);
      setDailySummaries(localSummaries);

      if (autoStopRef.current) {
        toast.warning('Viaje global detenido por el usuario.');
      } else if (localPos >= totalCasillas) {
        setAutoProgress(100);
        setAutoMessage('Compilando crónica…');
        setAutoSubtitle('Calculando fatiga y narrativa final');
        try {
          await calculateFatigueResults(localEvents);
        } catch (e) {
          console.error('Error calculando fatiga final:', e);
        }

        // Sincroniza ubicación de los personajes al destino del viaje.
        // El modo global no usa `active_journeys`, así que llamamos al
        // endpoint genérico /travel/arrival con los IDs del config.
        try {
          const partyIds = [
            ...(config.miembros || []).map((m) => m.id),
            ...((config.acompanantes || []).map((a) => a.id)),
          ].filter(Boolean);
          if (partyIds.length && config.destinoId) {
            await api.post('/travel/arrival', {
              character_ids: partyIds,
              destination_id: config.destinoId,
              destination_nombre: config.destinoNombre,
              destination_x: config.destinoX,
              destination_y: config.destinoY,
            });
            // Actualiza el state local para que la ficha refleje el cambio
            // sin requerir un refetch manual.
            setCharacters((prev) => prev.map((c) => {
              if (!partyIds.includes(c.id)) return c;
              return {
                ...c,
                ubicacion_actual: {
                  id: config.destinoId,
                  nombre: config.destinoNombre,
                  x: config.destinoX,
                  y: config.destinoY,
                },
              };
            }));
          }
        } catch (errArr) {
          console.warn('No se pudo sincronizar ubicación tras viaje global:', errArr);
        }

        toast.success(`Viaje global completado: ${localEvents.length} acontecimientos.`);
        setMode('results');
        await sleep(700);
      } else {
        toast.warning(`Viaje global interrumpido en la casilla ${localPos}/${totalCasillas}.`);
      }
    } catch (e) {
      console.error('Error en viaje global:', e);
      toast.error('Error inesperado en el viaje global.');
    } finally {
      setAutoRunning(false);
      autoStopRef.current = false;
      setTimeout(() => {
        setAutoProgress(0);
        setAutoMessage('');
        setAutoSubtitle('');
      }, 600);
    }
  }, [
    autoRunning, journeyCalc, config, characterXP, dailySummaries, journeyWeather, locations,
    autoStopRef, modeRef,
    setAutoRunning, setAutoProgress, setAutoMessage, setAutoSubtitle,
    setEvents, setOrientationChecks, setCurrentPosition, setMode,
    setJourneyWeather, setLastOrientationResult, setCharacterXP, setDailySummaries,
    getRoleModifier, calculateFatigueResults,
  ]);

  return {
    automateJourney,
    advanceDay,
    generateDayEvent,
    finishDayByDayJourney,
    calculateFatigueResults,
  };
};

export default useJourneyAutomation;
