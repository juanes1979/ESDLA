/**
 * useEventResolution
 *
 * Hook que encapsula `resolveCurrentEvent` — la resolución completa de un
 * acontecimiento de viaje (extraído de `EnhancedTravelSystem.jsx` durante
 * el refactor iter82).
 *
 * Responsabilidades:
 *  - Calcular éxito/fallo vs CD del evento.
 *  - Aplicar XP individual al personaje responsable (vía `addCharacterXP`).
 *  - Llamar a `/api/travel/resolve-event` para registrar la resolución.
 *  - Lanzar la generación de narrativa IA (`/api/travel/generate-narrative`).
 *  - Ejecutar las MECÁNICAS RAW de cada evento (Terrible Desgracia,
 *    Desesperanza, Decisiones Erróneas, Atajo, Percance, Vista agradable).
 *  - Anexar entrada al `dailySummaries` del día.
 *  - Disparar `continueAfterEvent` para seguir con la siguiente orientación.
 */
import { useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/services/api';
import { calculateRollXP } from '@/components/travel/travelHelpers';

export const useEventResolution = ({
  // estado
  currentEvent,
  events,
  config,
  characters,
  journeyCalc,
  journeyWeather,
  activeJourney,
  currentPosition,
  eventDiceRoll,
  gmNotesEvent,
  // setters
  setEvents,
  setCurrentEvent,
  setCharacters,
  setActiveJourney,
  setDailySummaries,
  setResolvingEvent,
  setGlobalFatigaCD,
  setFatigaCdBreakdown,
  // helpers
  addCharacterXP,
  continueAfterEvent,
  // Optional: callback invocado cuando un personaje gana puntos de Sombra
  // durante el viaje. Lo usa el sistema "Ojo de Mordor" para sumar
  // Atención por cada punto de Sombra ganado.
  onShadowGained,
}) => {
  return useCallback(async (tirada) => {
    if (!currentEvent) return;
    setResolvingEvent(true);

    const targetRole = currentEvent.objetivo.papel;
    const targetMember = config.miembros.find((m) => m.papeles?.includes(targetRole));

    const cd = currentEvent.resolucion.cd;
    const exito = tirada >= cd;

    // 1) XP individual al personaje responsable
    if (targetMember) {
      const xpResult = calculateRollXP(
        cd,
        tirada,
        exito,
        journeyCalc?.ruta?.terreno || 'moderado',
        journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
        eventDiceRoll?.d20,
      );
      addCharacterXP(targetMember.id, {
        type: 'evento',
        eventoNombre: currentEvent.evento.nombre,
        cd,
        tirada,
        exito,
        ...xpResult,
        casilla: currentEvent.casilla,
      });
    }

    try {
      const res = await api.post('/travel/resolve-event', null, {
        params: {
          evento_id: currentEvent.evento.id,
          tirada_resolucion: tirada,
          cd,
          exito,
          evento_nombre: currentEvent.evento.nombre,
          objetivo_papel: targetRole,
          personaje_nombre: targetMember?.nombre || 'Desconocido',
        },
      });

      // 2) Narrativa IA (no bloqueante)
      let narrativa = null;
      try {
        const resolvedEvents = events.filter((e) => e.resuelto).length;
        const totalEvents = events.length;
        const eventDay = Math.max(1, currentEvent.casilla || 1);
        const wDay = journeyWeather[Math.min(eventDay - 1, journeyWeather.length - 1)];
        const climaTxt = wDay
          ? `${wDay.estado_label}${wDay.region ? ' en ' + wDay.region : ''}`
          : '';

        const narrativeRes = await api.post('/travel/generate-narrative', null, {
          params: {
            evento_nombre: currentEvent.evento.nombre,
            exito,
            consecuencia: exito
              ? currentEvent.evento.consecuencias_exito
              : currentEvent.evento.consecuencias_fracaso,
            personaje_nombre: targetMember?.nombre || 'El grupo',
            papel: targetRole,
            tirada,
            cd,
            origen: config.origenNombre,
            destino: config.destinoNombre,
            terreno: journeyCalc?.ruta?.terreno || 'campo_abierto',
            evento_numero: resolvedEvents + 1,
            total_eventos: totalEvents,
            dia_actual: currentEvent.casilla || 1,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            notas_maestro: gmNotesEvent || '',
            clima: climaTxt,
          },
        });
        if (narrativeRes.data.success) {
          narrativa = narrativeRes.data.narrative;
        }
      } catch (err) {
        console.warn('Narrative generation skipped:', err);
      }

      // 3) Snapshot del clima del día
      const eventDayN = Math.max(1, currentEvent.casilla || 1);
      const eventWeather = journeyWeather[Math.min(eventDayN - 1, journeyWeather.length - 1)] || null;

      const updatedEvents = events.map((e) => {
        if (e === currentEvent) {
          return {
            ...e,
            resuelto: true,
            resultado: res.data,
            tirada,
            exito,
            narrativa,
            gm_notes: gmNotesEvent || '',
            clima_dia: eventWeather,
          };
        }
        return e;
      });
      setEvents(updatedEvents);

      // 4) Mecánicas RAW del evento
      const eventoId = currentEvent.evento.id;
      const mecanicas = [];

      try {
        // Terrible Desgracia (FALLO)
        if (eventoId === 'event_terrible' && !exito && targetMember) {
          const charDb = characters.find((c) => c.id === targetMember.id);
          if (charDb) {
            const desScore = charDb.atributos?.destreza ?? 10;
            const desMod = Math.floor((desScore - 10) / 2);
            const desventaja = currentEvent?.resolucion?.desventaja_salvacion;
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = desventaja ? Math.floor(Math.random() * 20) + 1 : null;
            const sd20 = desventaja ? Math.min(r1, r2) : r1;
            const sTotal = sd20 + desMod;
            const cdSalv = cd;
            const exitoSalv = sTotal >= cdSalv;
            const pgMax = charDb.puntos_golpe_max || 0;
            const pgActual = charDb.puntos_golpe_actual ?? pgMax;
            const danio = exitoSalv ? Math.floor(pgMax / 2) : pgActual;
            const nuevoPG = Math.max(0, pgActual - danio);
            try {
              await api.patch(`/characters/${targetMember.id}/hp`, { hp_change: -danio });
              setCharacters((prev) =>
                prev.map((c) => (c.id === targetMember.id ? { ...c, puntos_golpe_actual: nuevoPG } : c))
              );
            } catch (e) { console.error('HP update fail:', e); }
            const detalleD = desventaja ? `d20(${r1}/${r2}→${sd20})` : `d20(${sd20})`;
            mecanicas.push(
              `${targetMember.nombre} hace TS DES: ${detalleD}+${desMod}=${sTotal} vs CD ${cdSalv} → ${exitoSalv ? 'éxito (pierde ' + danio + ' PG)' : 'fallo (cae a 0 PG)'}.`
            );
            if (nuevoPG <= 0) {
              mecanicas.push(`⚠️ ${targetMember.nombre} ha caído inconsciente (0 PG). Necesita curación urgente.`);
              toast.error(
                `💀 ${targetMember.nombre} cae INCONSCIENTE (0 PG). Aplica primeros auxilios o un descanso.`,
                {
                  duration: 7000,
                  style: { background: '#7f1d1d', color: '#fecaca', border: '1px solid #f87171' },
                }
              );
            } else {
              toast(
                exitoSalv
                  ? `${targetMember.nombre} pierde ${danio} PG.`
                  : `${targetMember.nombre} cae a ${nuevoPG} PG.`,
                { duration: 4500 }
              );
            }
          }
        }

        // Desesperanza / Decisiones erróneas (FALLO): puntos de Sombra.
        if (!exito && (eventoId === 'event_desesperanza' || eventoId === 'event_decisiones')) {
          const isDesesperanza = eventoId === 'event_desesperanza';
          const atributoSalvacion = isDesesperanza ? 'carisma' : 'sabiduria';
          const atributoLabel = isDesesperanza ? 'CAR' : 'SAB';
          const cdSalv = cd;

          if (isDesesperanza) {
            const inc = 2;
            setGlobalFatigaCD((prev) => (prev || 10) + inc);
            setFatigaCdBreakdown((prev) => [
              ...prev,
              {
                motivo: 'Desesperanza',
                delta: inc,
                dia: activeJourney?.dia_actual || currentPosition + 1,
                casilla: currentPosition,
              },
            ]);
            setActiveJourney((prev) =>
              prev ? { ...prev, fatiga_cd_total: (prev.fatiga_cd_total || 10) + inc } : prev
            );
            if (activeJourney?.id) {
              try {
                await api.patch(`/travel/journey/${activeJourney.id}/fatigue-cd`, null, {
                  params: { delta: inc, reason: 'Desesperanza' },
                });
              } catch (_e) { /* non-fatal */ }
            }
          }

          const personajesAfectados = isDesesperanza
            ? [
                ...(config.miembros || []).filter((m) => m.papeles?.length > 0),
                ...(config.acompanantes || []),
              ]
            : (targetMember ? [targetMember] : []);

          if (isDesesperanza) {
            mecanicas.push(
              `Desesperanza: cada miembro tira TS CAR (CD ${cdSalv}); los que fallen reciben 1d3 puntos de Sombra (individual).`
            );
          }

          for (const m of personajesAfectados) {
            const charDb = characters.find((c) => c.id === m.id);
            if (!charDb) continue;
            const score = charDb.atributos?.[atributoSalvacion] ?? 10;
            const mod = Math.floor((score - 10) / 2);
            const compArr = charDb.competencias_salvacion || charDb.salvaciones_competentes || [];
            const esCompetente = Array.isArray(compArr) && compArr.some(
              (x) => String(x).toLowerCase().startsWith(atributoSalvacion.slice(0, 3)) ||
                     String(x).toLowerCase() === atributoSalvacion
            );
            const nivel = Number(charDb.nivel || 1);
            const profBonus = Math.ceil(nivel / 4) + 1;
            const totalMod = mod + (esCompetente ? profBonus : 0);

            const desventaja = currentEvent?.resolucion?.desventaja_salvacion;
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = desventaja ? Math.floor(Math.random() * 20) + 1 : null;
            const d20 = desventaja ? Math.min(r1, r2) : r1;
            const total = d20 + totalMod;
            const exitoSalv = total >= cdSalv;
            const detalleD = desventaja ? `d20(${r1}/${r2}→${d20})` : `d20(${d20})`;
            const compLabel = esCompetente ? ` (+PB ${profBonus})` : '';
            mecanicas.push(
              `${m.nombre} TS ${atributoLabel}: ${detalleD}+${totalMod}${compLabel}=${total} vs CD ${cdSalv} → ${exitoSalv ? '✓ resiste' : '✗ falla'}.`
            );

            if (!exitoSalv) {
              const sombraValor = isDesesperanza
                ? (Math.floor(Math.random() * 3) + 1)
                : 1;
              try {
                await api.patch(`/characters/${m.id}/shadow`, { shadow_change: sombraValor });
                setCharacters((prev) =>
                  prev.map((c) =>
                    c.id === m.id ? { ...c, puntos_sombra: (c.puntos_sombra || 0) + sombraValor } : c
                  )
                );
                if (onShadowGained) {
                  onShadowGained({
                    characterId: m.id,
                    characterName: m.nombre,
                    delta: sombraValor,
                    descripcion: `${currentEvent?.evento?.nombre || 'Evento'}: ${sombraValor} de Sombra`,
                  });
                }
              } catch (e) { console.error('Shadow update fail:', e); }
              mecanicas.push(`  → ${m.nombre} recibe ${sombraValor} punto${sombraValor === 1 ? '' : 's'} de Sombra.`);
              toast(`${m.nombre}: +${sombraValor} Sombra.`, { duration: 4000 });
            } else {
              toast(`${m.nombre} resiste la Sombra.`, { duration: 3000 });
            }
          }
        }

        // Atajo (ÉXITO)
        if (eventoId === 'event_atajo' && exito) {
          mecanicas.push('La compañía encuentra un atajo: -1 día.');
          toast('Atajo encontrado: -1 día de viaje.', { duration: 4000 });
        }

        // Percance (FALLO): +2 a la CD de fatiga
        if (eventoId === 'event_percance' && !exito) {
          const inc = 2;
          mecanicas.push(`Percance: +1 día y +${inc} a la CD de fatiga.`);
          setGlobalFatigaCD((prev) => (prev || 10) + inc);
          setFatigaCdBreakdown((prev) => [
            ...prev,
            {
              motivo: `Percance (${currentEvent?.evento?.nombre || 'evento'})`,
              delta: inc,
              dia: activeJourney?.dia_actual || currentPosition + 1,
              casilla: currentPosition,
            },
          ]);
          setActiveJourney((prev) =>
            prev ? { ...prev, fatiga_cd_total: (prev.fatiga_cd_total || 10) + inc } : prev
          );
          if (activeJourney?.id) {
            try {
              await api.patch(`/travel/journey/${activeJourney.id}/fatigue-cd`, null, {
                params: { delta: inc, reason: `Percance: ${currentEvent?.evento?.nombre || 'evento'}` },
              });
            } catch (_e) { /* non-fatal */ }
          }
        }

        // Vista agradable (ÉXITO)
        if (eventoId === 'event_vista' && exito) {
          mecanicas.push('Toda la compañía obtiene Inspiración.');
          toast('✨ Inspiración para toda la compañía.', { duration: 4000 });
        }
      } catch (mechErr) {
        console.error('Error aplicando mecánicas del evento:', mechErr);
      }

      // 5) Bitácora del día
      const diaEvento = currentEvent.casilla || 1;
      setDailySummaries((prev) => [
        ...prev,
        {
          dia: diaEvento,
          casilla: currentEvent.casilla,
          tipo: 'evento',
          success: exito,
          eventName: currentEvent.evento?.nombre,
          clima: eventWeather,
          narrativa,
          mecanicas,
          message: `Día ${diaEvento}: ¡${currentEvent.evento?.nombre || 'Acontecimiento'}! ${targetMember?.nombre || 'El grupo'} tira ${tirada} vs CD ${cd} → ${exito ? 'éxito' : 'fracaso'}.${mecanicas.length ? ' ' + mecanicas.join(' ') : ''}`,
        },
      ]);

      setCurrentEvent(null);
      await continueAfterEvent(updatedEvents);
    } catch (err) {
      console.error('Error resolving event:', err);
      toast.error('Error al resolver acontecimiento');
    } finally {
      setResolvingEvent(false);
    }
  }, [
    currentEvent, events, config, characters, journeyCalc, journeyWeather,
    activeJourney, currentPosition, eventDiceRoll, gmNotesEvent,
    setEvents, setCurrentEvent, setCharacters, setActiveJourney,
    setDailySummaries, setResolvingEvent,
    setGlobalFatigaCD, setFatigaCdBreakdown,
    addCharacterXP, continueAfterEvent,
  ]);
};

export default useEventResolution;
