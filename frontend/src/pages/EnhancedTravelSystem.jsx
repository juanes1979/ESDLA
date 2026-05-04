/**
 * Enhanced Travel System Component
 * Implements both Global and Day-by-Day journey modes
 * Uses the new travel rules API with editable configurations
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import api from '@/services/api';
import {
  MESES_ELFICOS,
  getEventCdBonusForRoles,
} from '@/components/travel/travelConstants';
import {
  REST_TYPES,
  calculateRollXP,
} from '@/components/travel/travelHelpers';
import { summarizeProvisions } from '@/components/travel/inventoryProvisions';
import ResultsView from '@/components/travel/views/ResultsView';
import GlobalJourneyView from '@/components/travel/views/GlobalJourneyView';
import DayByDayView from '@/components/travel/views/DayByDayView';
import ConfigView from '@/components/travel/views/ConfigView';
import JourneyHeader from '@/components/travel/views/JourneyHeader';
import JourneyDialogs from '@/components/travel/views/JourneyDialogs';
import { computeMemberSpeed, getRoleModifier as getRoleModifierHelper } from '@/utils/travelSpeed';
import useJourneyProvisions from '@/hooks/useJourneyProvisions';
import useFatigueSystem from '@/hooks/useFatigueSystem';
import useJourneyMembers from '@/hooks/useJourneyMembers';
import useJourneyResults from '@/hooks/useJourneyResults';
import useJourneyAutomation from '@/hooks/useJourneyAutomation';
import useEventResolution from '@/hooks/useEventResolution';


const EnhancedTravelSystem = () => {
  // =============== STATE ===============
  
  // Mode: 'config' | 'global' | 'dayByDay' | 'results'
  const [mode, setMode] = useState('config');
  const [travelMode, setTravelMode] = useState('global'); // 'global' or 'dayByDay'
  
  // Data from API
  const [locations, setLocations] = useState([]);
  // C-6: "Indicar en mapa" — picker target ('origen'|'destino'|null)
  const [mapPickFor, setMapPickFor] = useState(null);
  const [locationsByRegion, setLocationsByRegion] = useState({});
  const [characters, setCharacters] = useState([]);
  const [travelRules, setTravelRules] = useState(null);
  
  // Journey configuration
  const [config, setConfig] = useState({
    origenId: '',
    origenNombre: '',
    destinoId: '',
    destinoNombre: '',
    // Optional explicit coordinates when the user picks a free point on the
    // map (custom: ids). Allow journeys to start/end at any (x, y) %.
    origenX: null,
    origenY: null,
    destinoX: null,
    destinoY: null,
    evitarSombra: false,
    evitarTierrasOscuras: false,
    preferirCaminos: true,
    ritmo: 'normal',
    mes: 'Cermië',
    diaMes: 1,
    anioTe: 2950,
    estacion: 'verano',
    // `horasMarchaForzada` eliminado (Abr 2026): la marcha forzada ahora se
    // decide día a día tras la tirada de orientación (toggle `marchaForzadaHoy`).
    miembros: [],
    // Acompañantes: viajan con el grupo, NO tienen papel ni hacen tiradas de
    // eventos/orientación/fatiga, pero SÍ cuentan para velocidad y provisiones.
    acompanantes: []
  });
  
  // Search filters for origin/destination
  const [origenSearch, setOrigenSearch] = useState('');
  const [destinoSearch, setDestinoSearch] = useState('');
  const [origenOpen, setOrigenOpen] = useState(false);
  const [destinoOpen, setDestinoOpen] = useState(false);
  
  // Journey calculation result
  const [journeyCalc, setJourneyCalc] = useState(null);
  const [loadingCalc, setLoadingCalc] = useState(false);
  
  // Route comparison
  const [routeComparison, setRouteComparison] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  // Map expansion state
  const [mapExpanded, setMapExpanded] = useState(false);
  
  // Active journey (day-by-day mode)
  const [activeJourney, setActiveJourney] = useState(null);
  const [currentDayConfig, setCurrentDayConfig] = useState({
    ritmo: 'normal',
    marchaForzada: false,          // ¿hoy la marcha es forzada?
    marchaForzadaSoloUnDia: false, // ¿la marcha forzada es solo 1 día o hasta el próx. evento?
  });
  // Estado persistente de "bandera de marcha forzada activa" mientras no haya
  // un nuevo evento/orientación. Permite que al pulsar una marcha forzada se
  // mantenga activa durante los siguientes días hasta el próximo evento (y
  // se desactive automáticamente al resolverlo), salvo que el DJ marque
  // "solo un día" (en cuyo caso se apaga tras un sólo día).
  // `forcedMarchActive` se extrae del hook `useFatigueSystem` (más abajo).
  
  // Events for current journey
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [resolvingEvent, setResolvingEvent] = useState(false);
  
  // Dice roll state for event resolution
  const [eventDiceRoll, setEventDiceRoll] = useState(null); // { d20: number, modifier: number, total: number }
  
  // GM notes for AI narrative context (saved with each roll for later AI processing)
  const [gmNotesOrientation, setGmNotesOrientation] = useState('');
  const [gmNotesEvent, setGmNotesEvent] = useState('');
  
  // Final results
  const [fatigueResults, setFatigueResults] = useState([]);
  
  // PX Application state
  const [applyingPX, setApplyingPX] = useState(false);
  const [pxApplied, setPxApplied] = useState(false);
  const [pxResults, setPxResults] = useState(null);
  
  // Individual PX tracking per character based on their rolls
  // { characterId: { total: number, rolls: [{ type, cd, tirada, diff, px, terreno, tierras }] } }
  const [characterXP, setCharacterXP] = useState({});
  
  // Journey narrative state
  const [journeyNarrative, setJourneyNarrative] = useState(null);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  
  // Ref for the map container to capture for PDF
  const mapContainerRef = useRef(null);
  // Saved map image captured when route is calculated
  const [savedMapImage, setSavedMapImage] = useState(null);
  
  // Orientation check state (new system)
  const [orientationChecks, setOrientationChecks] = useState([]); // All orientation checks
  const [currentPosition, setCurrentPosition] = useState(0); // Current position in tiles
  const [nextEventPosition, setNextEventPosition] = useState(0); // Position of next event
  const [awaitingOrientationCheck, setAwaitingOrientationCheck] = useState(false);
  const [lastOrientationResult, setLastOrientationResult] = useState(null);
  
  // Journey Stages system (new)
  const [journeyStages, setJourneyStages] = useState([]); // Completed stages
  const [currentStage, setCurrentStage] = useState(1); // Current stage number
  const [stageDays, setStageDays] = useState(0); // Days in current stage
  const [stageEvents, setStageEvents] = useState([]); // Events in current stage
  const [stageFatigueDC, setStageFatigueDC] = useState(10); // Fatigue DC for current stage
  const [nearbyRefuges, setNearbyRefuges] = useState([]); // Refuges near current position
  
  // =============== PROVISIONS SYSTEM (Food/Water) ===============
  // Estado de display (warnings, food/water catálogo). El estado y la
  // lógica de consumo/forrajeo viven en el hook `useJourneyProvisions`
  // declarado más abajo (con acceso a config, characters, locations y reglas).
  const [foodWaterItems, setFoodWaterItems] = useState({ food_items: [], water_items: [] });
  const [provisionsCheck, setProvisionsCheck] = useState(null); // Result of provisions check
  const [showProvisionsWarning, setShowProvisionsWarning] = useState(false);

  // Camp dialog state
  const [showCampDialog, setShowCampDialog] = useState(false);
  const [travelEvents, setTravelEvents] = useState([]);
  
  // Journey chronicle (single unified narrative) — lifted for PDF export
  const [journeyChronicle, setJourneyChronicle] = useState('');
  const [includeChronicleInPDF, setIncludeChronicleInPDF] = useState(true);
  
  // Provisions shop dialog
  const [showProvisionsShop, setShowProvisionsShop] = useState(false);
  
  // Journey automation (Point 7)
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState(0); // 0-100
  const [autoMessage, setAutoMessage] = useState('');
  const [autoSubtitle, setAutoSubtitle] = useState('');

  // Initial fatigue overrides set by the DJ before starting the journey.
  // Format: { [charId]: { fatiga: number, justificacion: string, original: number } }
  const [initialFatigueOverrides, setInitialFatigueOverrides] = useState({});

  // Bitácora día-a-día de la jornada interactiva. Cada entrada describe un
  // día concreto del viaje: marcha, clima, evento, campamento, etc.
  // Forma: { dia, casilla, tipo: 'orientacion'|'marcha'|'evento'|'campamento'|'forrajeo'|'descanso',
  //          clima, marchaType, message, success, eventName, narrativa }
  const [dailySummaries, setDailySummaries] = useState([]);

  // CD acumulada de fatiga durante la jornada interactiva (modo global sin
  // viaje en BD). Se actualiza con eventos fallidos, acampadas, etc.
  // Fatigue system + forced march (extraído al hook `useFatigueSystem` en Mayo 2026).
  // Todo el estado CD, breakdown, salvaciones, logs, y las acciones de marcha
  // forzada viven ahora en el hook. Aquí solo consumimos las referencias.
  // setForcedMarchActive también se obtiene del hook.
  // (NB: el hook necesita saber el id del viaje activo para persistir la CD
  //  en backend; se actualiza vía un efecto más abajo cuando empieza el viaje.)
  const [journeyIdForFatigue, setJourneyIdForFatigue] = useState(null);
  // State de fatiga extraído al hook `useFatigueSystem` (se invoca más abajo):
  //   - lastFatigueSaves  : última salvación por personaje.
  //   - fatigueSaveLog    : bitácora completa del viaje (para el DJ).
  //   - fatigueChanges    : último cambio de fatiga por personaje (HUD +1/-1).
  //   - forcedMarchActive : ¿la marcha forzada persiste entre orientación y evento?
  //   - globalFatigaCD / fatigaCdBreakdown.

  // Contador de días consecutivos en campamento (sin marcha entre medias).
  // La salvación contra cansancio se OMITE en la 2.ª acampada consecutiva.
  const [consecutiveCampDays, setConsecutiveCampDays] = useState(0);
  // Weather rolled for the entire journey at startGlobalJourney (Markov chain)
  const [journeyWeather, setJourneyWeather] = useState([]);
  const autoStopRef = useRef(false);

  // Provisions: state + actions extraídos al hook `useJourneyProvisions`.
  // Día sin comida/agua a nivel grupo lo gestiona el propio hook.
  const {
    partyProvisions, setPartyProvisions,
    provisionFatigue, setProvisionFatigue,
    diasSinComida, setDiasSinComida,
    diasSinAgua, setDiasSinAgua,
    checkProvisionsForJourney,
    consumeDailyProvisions,
    performForaging: performForagingHook,
  } = useJourneyProvisions({
    config,
    characters,
    locations,
    travelRules,
    onForageDay: () => setStageDays(prev => prev + 1),
  });

  // Fatigue & forced march system (extraído Mayo 2026).
  const {
    globalFatigaCD, setGlobalFatigaCD,
    fatigaCdBreakdown, setFatigaCdBreakdown,
    lastFatigueSaves, setLastFatigueSaves,
    fatigueChanges, setFatigueChanges,
    fatigueSaveLog, setFatigueSaveLog,
    forcedMarchActive, setForcedMarchActive,
    applyForcedMarchExtraConsumption,
    applyForcedMarchSaves,
    resetFatigueSystem,
  } = useFatigueSystem({
    config,
    characters,
    setCharacters,
    travelRules,
    setPartyProvisions,
    journeyId: journeyIdForFatigue,
  });
  
  // Ref usado por el bucle automático (`useJourneyAutomation`) para saber si
  // el componente ya estaba en modo `global` antes de iniciarse.
  const modeRef = useRef('config');
  // Sync mode to ref so async automation loop can see immediate changes
  useEffect(() => { modeRef.current = mode; }, [mode]);
  // Mantiene sincronizado el id de viaje que necesita el hook de fatiga
  // para persistir sus modificaciones de CD en backend.
  useEffect(() => { setJourneyIdForFatigue(activeJourney?.id || null); }, [activeJourney?.id]);
  
  // =============== LOAD DATA ===============
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locRes, charRes, rulesRes, eventsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/characters/'),
          api.get('/travel/config/rules'),
          api.get('/travel/config/events')
        ]);
        
        // Process locations
        const locs = locRes.data?.locations || [];
        setLocations(locs);
        
        // Group by region
        const byRegion = {};
        locs.forEach(loc => {
          const region = loc.region || 'Otros';
          if (!byRegion[region]) byRegion[region] = [];
          byRegion[region].push(loc);
        });
        Object.keys(byRegion).forEach(r => {
          byRegion[r].sort((a, b) => a.nombre.localeCompare(b.nombre));
        });
        setLocationsByRegion(byRegion);
        
        setCharacters(charRes.data?.characters || []);
        setTravelRules(rulesRes.data?.rules || {});
        setTravelEvents(eventsRes.data?.events || []);
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Error al cargar datos');
      }
    };
    loadData();
  }, []);
  
  // Update season when month changes
  useEffect(() => {
    const mes = MESES_ELFICOS.find(m => m.id === config.mes);
    if (mes) {
      setConfig(prev => ({ ...prev, estacion: mes.estacion }));
    }
  }, [config.mes]);

  // ============== AUTO-RECALC GROUP SPEED WHEN "MONTADO" TOGGLES ==============
  // Cuando un viajero cambia su estado montado/a-pie durante el viaje, recalcula
  // la velocidad del grupo en caliente (sin tocar la ruta) y avisa por toast.
  const prevMontadoRef = useRef({});
  // Pure speed helper extracted to /utils/travelSpeed.js. We wrap it in a
  // useCallback so the surrounding useEffect dependency array stays stable.
  const computeMemberSpeed_ = useCallback((char) => computeMemberSpeed(char), []);

  useEffect(() => {
    const journeyActivo = !!activeJourney || mode === 'global' || mode === 'dayByDay';
    const todos = [
      ...(config.miembros || []),
      ...((config.acompanantes || []).map(a => ({ ...a, _esAcompanante: true }))),
    ];
    if (todos.length === 0) return;

    let avisos = [];
    todos.forEach(m => {
      const ch = characters.find(c => c.id === m.id);
      if (!ch) return;
      const prev = prevMontadoRef.current[m.id];
      const cur = !!ch.montado;
      if (prev !== undefined && prev !== cur && journeyActivo) {
        avisos.push({ nombre: ch.nombre || m.nombre, montado: cur });
      }
      prevMontadoRef.current[m.id] = cur;
    });

    if (avisos.length > 0) {
      // Velocidad efectiva del grupo (mínimo entre todos los miembros).
      const speeds = todos
        .map(m => characters.find(c => c.id === m.id))
        .filter(Boolean)
        .map(computeMemberSpeed_)
        .filter(v => v > 0);
      const groupSpeed = speeds.length ? Math.min(...speeds) : 0;
      avisos.forEach(a => {
        toast(
          a.montado
            ? `🐎 ${a.nombre} ha montado: el grupo va ahora a ${groupSpeed.toFixed(1)} m/turno.`
            : `👣 ${a.nombre} ha desmontado: el grupo va ahora a ${groupSpeed.toFixed(1)} m/turno.`,
          { duration: 5000 }
        );
      });
    }
  }, [characters, activeJourney, mode, config.miembros, config.acompanantes, computeMemberSpeed_]);
  
  // =============== JOURNEY CALCULATION ===============
  
  const calculateJourney = useCallback(async () => {
    if (!config.origenId || !config.destinoId) return;
    
    setLoadingCalc(true);
    try {
      // Combine miembros (with travel role) + acompañantes (without role) so the
      // backend can compute the slowest speed of the WHOLE group.
      const todosViajeros = [
        ...config.miembros.filter(m => m.papeles?.length > 0),
        ...((config.acompanantes || []).map(a => ({
          id: a.id,
          nombre: a.nombre,
          papel: null,
          tieneMontura: a.tieneMontura,
          monturaNombre: a.monturaNombre,
          monturaPropia: a.monturaPropia,
          monturaConBonus: 0,
          velocidadBase: a.velocidadBase || 9,
          modSabiduria: a.modSabiduria || 0,
          competencias: [],
          nivel: 1,
        }))),
      ];

      const payload = {
        origen_id: config.origenId,
        origen_nombre: config.origenNombre,
        destino_id: config.destinoId,
        destino_nombre: config.destinoNombre,
        origen_x: config.origenX,
        origen_y: config.origenY,
        destino_x: config.destinoX,
        destino_y: config.destinoY,
        evitar_sombra: config.evitarSombra,
        evitar_tierras_oscuras: config.evitarTierrasOscuras,
        preferir_caminos: config.preferirCaminos,
        ritmo: config.ritmo,
        mes: config.mes,
        estacion: config.estacion,
        // horas_marcha_forzada eliminado (Abr 2026): se decide por día tras orientación.
        miembros: todosViajeros.map(m => {
          // Enriquecer con estorbo y bandera de montura cargando equipo
          // a partir de la ficha del personaje (persistido por la
          // WeightEncumbranceCard de la ficha).
          const char = characters.find(c => c.id === m.id);
          const estorbo = Number(char?.estorbo_metros ?? 0);
          const monturaCarga = !!char?.montura?.transporta_equipo;
          // Carga real sobre la montura: items con portado_por='montura'
          // + montura.equipo[] + (si va montado: peso del jinete + equipo
          // que el jinete lleva sobre sí). La capacidad sale de
          // character.montura.
          let monturaCargaKg = 0;
          let pesoEquipoPersonaje = 0;
          (char?.inventario || []).forEach(it => {
            if (!it) return;
            const peso = Number(it.peso_kg || it.peso || 0) * Number(it.cantidad || 1);
            if (it.portado_por === 'montura') {
              monturaCargaKg += peso;
            } else {
              pesoEquipoPersonaje += peso;
            }
          });
          (char?.montura?.equipo || []).forEach(it => {
            monturaCargaKg += Number(it?.peso_kg || it?.peso || 0) * Number(it?.cantidad || 1);
          });
          // Si va montado, suma peso corporal del jinete + su equipo.
          if (char?.montado) {
            const pesoCorporal = Number(char?.peso_kg || char?.peso || 70);
            monturaCargaKg += pesoCorporal + pesoEquipoPersonaje;
          }
          const monturaCapKg = Number(char?.montura?.capacidad_carga || char?.montura?.carga_kg || 0);
          return {
            personaje_id: m.id,
            nombre: m.nombre,
            papel: m.papel,
            tiene_montura: m.tieneMontura,
            montura_nombre: m.monturaNombre,
            montura_velocidad: m.tieneMontura && m.monturaPropia ? (m.monturaPropia.velocidad || 12) : 0,
            montura_con_bonus: m.monturaConBonus || 0,
            velocidad_base: m.velocidadBase || 9,
            modificador_sabiduria: m.modSabiduria || 0,
            competencias: m.competencias || [],
            nivel: m.nivel || 1,
            estorbo_metros: estorbo,
            montura_carga_equipo: monturaCarga,
            montura_capacidad_kg: monturaCapKg,
            montura_carga_actual_kg: monturaCargaKg,
          };
        })
      };
      
      const res = await api.post('/travel/calculate-journey', payload);
      setJourneyCalc(res.data);
      
      if (res.data.error) {
        toast.error(res.data.message);
      }
    } catch (err) {
      console.error('Error calculating journey:', err);
      toast.error('Error al calcular viaje');
    } finally {
      setLoadingCalc(false);
    }
  }, [config]);
  
  // Compare routes function
  const compareRoutes = useCallback(async () => {
    if (!config.origenId || !config.destinoId) {
      toast.error('Selecciona origen y destino');
      return;
    }
    
    setLoadingComparison(true);
    try {
      const res = await api.post('/travel/compare-routes', {
        origen_id: config.origenId,
        origen_nombre: config.origenNombre,
        destino_id: config.destinoId,
        destino_nombre: config.destinoNombre,
        origen_x: config.origenX,
        origen_y: config.origenY,
        destino_x: config.destinoX,
        destino_y: config.destinoY,
        evitar_sombra: config.evitarSombra || false,
        evitar_tierras_oscuras: config.evitarTierrasOscuras || false,
        ritmo: config.ritmo || 'normal'
      });
      
      if (res.data.success) {
        setRouteComparison(res.data);
        setShowComparison(true);
      } else {
        toast.error(res.data.message || 'Error al comparar rutas');
      }
    } catch (err) {
      console.error('Error comparing routes:', err);
      toast.error('Error al comparar rutas');
    } finally {
      setLoadingComparison(false);
    }
  }, [config]);
  
  // Manual trigger for journey calculation (call this when user clicks button)
  const triggerCalculateJourney = useCallback(async () => {
    if (!config.origenId || !config.destinoId) {
      toast.error('Selecciona origen y destino');
      return;
    }
    await calculateJourney();
    // Pre-cargar clima día a día para que la "Alerta predictiva" pueda
    // mostrar el día más duro sin esperar a iniciar el viaje.
    try {
      // Usamos un valor temporal de días (10) si aún no se ha actualizado
      // el state — la alerta sólo necesita una primera estimación.
      const tentativeDays = 10;
      const orig = (locations || []).find(l => l.id === config.origenId);
      const dest = (locations || []).find(l => l.id === config.destinoId);
      const regions = [];
      for (let i = 0; i < tentativeDays; i++) {
        const ratio = tentativeDays > 1 ? i / (tentativeDays - 1) : 0;
        regions.push(ratio < 0.5 ? (orig?.region || '') : (dest?.region || ''));
      }
      const wRes = await api.post('/weather/simulate', {
        mes: config.mes,
        dia_inicio: config.diaMes || 1,
        num_dias: tentativeDays,
        regiones_por_dia: regions,
      });
      setJourneyWeather(wRes.data?.dias || []);
    } catch (e) {
      // No bloqueante: la alerta funciona sin clima.
      console.warn('No se pudo pre-rodar el clima para la alerta predictiva:', e);
    }
  }, [config.origenId, config.destinoId, config.mes, config.diaMes, locations, calculateJourney]);
  
  // =============== PROVISIONS CHECK ===============
  // `checkProvisionsForJourney` y resto de utilidades de provisiones
  // se obtienen del hook `useJourneyProvisions` (declarado al principio del componente).
  
  // Check provisions when journey is calculated
  useEffect(() => {
    if (journeyCalc?.success && journeyCalc?.estimaciones?.dias_estimados) {
      const check = checkProvisionsForJourney(journeyCalc.estimaciones.dias_estimados);
      setProvisionsCheck(check);
      // Show warning if provisions are insufficient
      if (check && (!check.comidaSuficiente || !check.aguaSuficiente)) {
        setShowProvisionsWarning(true);
      }
    }
  }, [journeyCalc, checkProvisionsForJourney]);
  
  // =============== PX CALCULATION PER ROLL ===============
  // calculateRollXP and calculateGroupMultiplier are imported from travelHelpers.

  // Add XP to a character
  const addCharacterXP = useCallback((characterId, rollData) => {
    setCharacterXP(prev => {
      const charData = prev[characterId] || { total: 0, rolls: [] };
      return {
        ...prev,
        [characterId]: {
          total: charData.total + rollData.pxFinal,
          rolls: [...charData.rolls, rollData]
        }
      };
    });
  }, []);

  // =============== START JOURNEY ===============

  // Aplica los overrides de fatiga inicial: actualiza el personaje en la BD
  // y en el estado local. Devuelve un array con los cambios efectuados (para
  // poder anotarlos en la crónica del viaje). La justificación es opcional;
  // si está vacía, se anota "Ajustado por el DJ" como nota neutra.
  const applyInitialFatigueOverrides = async () => {
    const aplicados = [];
    const entries = Object.entries(initialFatigueOverrides || {});
    if (entries.length === 0) return aplicados;
    for (const [charId, data] of entries) {
      const just = (data?.justificacion || '').trim() || 'Ajuste del DJ antes del viaje.';
      const nueva = Number(data?.fatiga ?? 0);
      const original = Number(data?.original ?? 0);
      if (nueva === original) continue; // sin cambio
      try {
        await api.put(`/characters/${charId}/fatigue`, { fatiga: Math.max(0, Math.min(6, nueva)) });
        setCharacters(prev => prev.map(c => c.id === charId
          ? { ...c, fatiga: Math.max(0, Math.min(6, nueva)) }
          : c
        ));
        const ch = characters.find(c => c.id === charId);
        aplicados.push({
          charId,
          nombre: ch?.nombre || 'Desconocido',
          de: original,
          a: nueva,
          justificacion: just,
        });
      } catch (err) {
        console.error('Error aplicando override de fatiga:', err);
        throw new Error(`No se pudo guardar la fatiga inicial de ${charId}.`);
      }
    }
    return aplicados;
  };

  const startGlobalJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    const guia = config.miembros.find(m => m.papeles?.includes('guia'));
    if (!guia) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }

    // Aplica overrides de fatiga inicial (con justificación obligatoria).
    let fatigaInicialLog = [];
    try {
      fatigaInicialLog = await applyInitialFatigueOverrides();
      if (fatigaInicialLog.length > 0) {
        toast.success(`Fatiga inicial ajustada para ${fatigaInicialLog.length} personaje(s).`);
      }
    } catch (err) {
      toast.error(err.message || 'Error aplicando ajuste de fatiga inicial.');
      return;
    }

    setMode('global');
    setEvents([]);
    setOrientationChecks([]);
    setCurrentPosition(0);
    setNextEventPosition(0);
    setLastOrientationResult(null);
    setCharacterXP({}); // Reset individual XP tracking
    setConsecutiveCampDays(0);
    setDiasSinComida(0);
    setDiasSinAgua(0);
    // Reset completo del sistema de fatiga (CD, breakdown, saves, MF…).
    resetFatigueSystem();
    // Bitácora: día 1 — la compañía parte. Si hubo overrides de fatiga, se anotan.
    const partidaSummaries = [{
      dia: 1,
      casilla: 0,
      tipo: 'partida',
      message: `La compañía parte de ${config.origenNombre} hacia ${config.destinoNombre}.`,
    }];
    if (fatigaInicialLog.length > 0) {
      fatigaInicialLog.forEach(l => {
        partidaSummaries.push({
          dia: 1,
          casilla: 0,
          tipo: 'antecedente',
          message: `${l.nombre} comienza con fatiga ${l.a} (de ${l.de}). Justificación: "${l.justificacion}"`,
        });
      });
    }
    setDailySummaries(partidaSummaries);

    // *** INICIALIZAR PROVISIONES leyendo inventarios reales ***
    // Si el origen es asentamiento conocido, los odres parten LLENOS.
    const origenLoc = (locations || []).find(l => l.id === config.origenId);
    const tipoOrigen = (origenLoc?.tipo || origenLoc?.tipo_lugar || '').toLowerCase();
    const esAsentamientoConocido = !!origenLoc && (
      tipoOrigen.includes('aldea') || tipoOrigen.includes('pueblo') ||
      tipoOrigen.includes('ciudad') || tipoOrigen.includes('refugio') ||
      tipoOrigen.includes('santuario') || tipoOrigen.includes('asentamiento') ||
      tipoOrigen.includes('fortal') || tipoOrigen.includes('castillo') ||
      tipoOrigen.includes('hostal') || tipoOrigen.includes('posada') || !tipoOrigen
    );
    let comidaInicial = 0;
    let aguaInicial = 0;
    const todosViajerosInicio = [
      ...config.miembros.filter(m => m.papeles?.length > 0),
      ...(config.acompanantes || []),
    ];
    todosViajerosInicio.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      const summary = summarizeProvisions(char.inventario);
      comidaInicial += summary.diasComidaTotal || summary.raciones;
      const litrosCharacter = esAsentamientoConocido
        ? summary.odres.length * 10 + summary.aguaSuelta
        : summary.totalLitros;
      aguaInicial += litrosCharacter;
    });
    if (esAsentamientoConocido && todosViajerosInicio.length > 0) {
      toast.success(`Odres rellenados gratis en ${config.origenNombre}.`);
    }
    setPartyProvisions({
      comidaTotal: comidaInicial,
      aguaTotal: aguaInicial,
      comidaConsumida: 0,
      aguaConsumida: 0,
    });
    setProvisionFatigue({});
    
    // Roll weather chain for the entire journey so narrative endpoints can look up
    // the climate for each event/day later. (Markov chain, region per day.)
    try {
      const numDays = Math.max(1, Math.ceil(journeyCalc?.estimaciones?.dias_estimados || journeyCalc?.ruta?.casillas || 7));
      const origRegion = (locations || []).find(l => l.id === config.origenId)?.region || '';
      const destRegion = (locations || []).find(l => l.id === config.destinoId)?.region || '';
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
      setJourneyWeather([]);
    }
    
    // Check if guide has multiple roles (penalty -5)
    const guiaTieneMultiplesRoles = guia.papeles && guia.papeles.length > 1;
    
    // Start with first orientation check
    setAwaitingOrientationCheck(true);
    toast.info(`El Guía (${guia.nombre}) debe realizar la primera tirada de Orientación`);
  };
  
  // Perform orientation check
  const performOrientationCheck = async () => {
    const guia = config.miembros.find(m => m.papeles?.includes('guia'));
    if (!guia) return;
    
    const casillasRestantes = journeyCalc.ruta.casillas - currentPosition;
    const guiaTieneMultiplesRoles = guia.papeles && guia.papeles.length > 1;
    
    try {
      const res = await api.post('/travel/orientation-check', {
        // Use the pre-calculated modifier which includes competencia + pericia
        modificador_sabiduria: guia.modViajar || guia.modSabiduria || 0,
        competencia_viajar: guia.competenciaViajar || false,
        competencia_cartografia: guia.competenciaCartografia || false,
        competencia_navegacion: false,
        tiene_mapa: true,
        viaje_maritimo: false,
        penalizacion_multiples_papeles: guiaTieneMultiplesRoles,
        // Bonus competencia is now included in modViajar, so set to 0 to avoid double counting
        bonus_competencia: 0
      }, {
        params: { casillas_restantes: casillasRestantes }
      });
      
      if (res.data.success) {
        const result = res.data;
        
        // Calculate XP for the Guide's orientation check
        // CD for orientation is always 15, exito is tirada >= CD
        const orientationCD = 15;
        const exito = result.total >= orientationCD;
        const xpResult = calculateRollXP(
          orientationCD,
          result.total,
          exito,
          journeyCalc?.ruta?.terreno || 'moderado',
          journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
          result.d20
        );
        
        const enrichedResult = { ...result, xpResult, guiaId: guia.id, guiaNombre: guia.nombre, gm_notes: gmNotesOrientation };
        setLastOrientationResult(enrichedResult);
        setOrientationChecks(prev => [...prev, {
          ...enrichedResult,
          casilla_actual: currentPosition,
          casillas_restantes: casillasRestantes
        }]);
        
        // Clear GM notes for next roll
        setGmNotesOrientation('');
        
        // Add XP to guide
        addCharacterXP(guia.id, {
          type: 'orientacion',
          cd: orientationCD,
          tirada: result.total,
          exito: exito,
          ...xpResult,
          casilla: currentPosition
        });

        // Bitácora: anota la tirada de orientación realizada en este día.
        const diaOrientacion = currentPosition + 1;
        setDailySummaries(prev => [...prev, {
          dia: diaOrientacion,
          casilla: currentPosition,
          tipo: 'orientacion',
          success: exito,
          message: `${guia.nombre} estudia el horizonte: tirada ${result.total} vs CD 15 → ${exito ? 'éxito' : 'fracaso'}. ${result.detalle || ''}`,
          clima: (journeyWeather || [])[Math.min(currentPosition, (journeyWeather || []).length - 1)] || null,
        }]);

        if (result.viaje_completado) {
          // Journey is complete!
          toast.success(result.detalle);
          setAwaitingOrientationCheck(false);
          // Move to results - calculate fatigue first
          await calculateFatigueResults(events);
          setMode('results');
        } else {
          // Calculate next event position
          const nuevaPosicionEvento = currentPosition + result.casillas_hasta_evento;
          setNextEventPosition(nuevaPosicionEvento);

          // Bitácora: anota los días intermedios sin incidentes (entre la
          // orientación y el evento). Cada casilla = 1 día.
          const marchaEntries = [];
          // Si la marcha forzada está activa (toggle de este turno o ya persistiendo),
          // se aplica durante TODO el tramo hasta el siguiente evento. Consumo extra
          // y salvación CD 15 por día.
          const esMarchaForzadaTramo = !!currentDayConfig.marchaForzada || forcedMarchActive;
          for (let d = currentPosition + 1; d < nuevaPosicionEvento; d++) {
            const dia = d + 1;
            const w = (journeyWeather || [])[Math.min(d, (journeyWeather || []).length - 1)];
            marchaEntries.push({
              dia,
              casilla: d,
              tipo: 'marcha',
              clima: w || null,
              marchaType: config.ritmo,
              marchaForzada: esMarchaForzadaTramo,
              message: `Día ${dia}: ${esMarchaForzadaTramo ? '⚡ marcha FORZADA' : `marcha ${config.ritmo}`} sin incidentes${w?.estado_label ? ` (${w.estado_label})` : ''}.`,
            });
            if (esMarchaForzadaTramo) {
              // Consumo extra + tirada CD 15 de fatiga por cada día de marcha forzada.
              applyForcedMarchExtraConsumption();
              // eslint-disable-next-line no-await-in-loop
              await applyForcedMarchSaves(dia);
            }
          }
          if (marchaEntries.length > 0) {
            setDailySummaries(prev => [...prev, ...marchaEntries]);
          }

          // Gestión de la persistencia de la marcha forzada tras este tramo:
          //   • "Sólo un día" → se apaga tras UN día.
          //   • Resto → persiste hasta el evento (ahora), se apaga al resolverlo.
          if (currentDayConfig.marchaForzada) {
            if (currentDayConfig.marchaForzadaSoloUnDia) {
              setForcedMarchActive(false);
            } else {
              setForcedMarchActive(true);
            }
          }
          setCurrentDayConfig(prev => ({
            ...(prev || {}),
            marchaForzada: false,
            marchaForzadaSoloUnDia: false,
          }));

          // Generate the event at that position
          await generateEventAtPosition(nuevaPosicionEvento, result);
        }
      }
    } catch (err) {
      console.error('Error in orientation check:', err);
      toast.error('Error al realizar la tirada de orientación');
    }
  };
  
  // Generate event at a specific position
  const generateEventAtPosition = async (posicion, orientationResult) => {
    try {
      const eventRes = await api.post('/travel/generate-event', null, {
        params: {
          tipo_tierra: journeyCalc.ruta.tipo_tierra,
          terreno: journeyCalc.ruta.terreno,
          estacion: config.estacion
        }
      });
      
      if (eventRes.data.success) {
        // Climate applied to the event: pull weather of THAT day. If
        // extreme (storm, blizzard, gale, deep frost) → +2 to resolution
        // CD and tag desventaja_clima. If favorable → -1 to CD.
        const dayIdx = Math.max(0, posicion - 1);
        const weather = (journeyWeather || [])[Math.min(dayIdx, (journeyWeather || []).length - 1)] || null;
        const climaLabel = (weather?.estado_label || '').toLowerCase();
        const esExtremo = ['tormenta','vendaval','nieve fuerte','extremo','helada','ventisca','niebla densa']
          .some(k => climaLabel.includes(k));
        const esFavorable = ['despejado','soleado','templado','suave','agradable']
          .some(k => climaLabel.includes(k));
        const cdMod = esExtremo ? 2 : (esFavorable ? -1 : 0);
        // +CD por sobrecarga de papeles (viaje en solitario / desbalanceado).
        const maxRolesAnyMember = (config?.miembros || [])
          .reduce((m, x) => Math.max(m, (x.papeles || []).length), 0);
        const cdRolesBonus = getEventCdBonusForRoles(maxRolesAnyMember);
        const cdAjustada = Math.max(5, (eventRes.data.resolucion?.cd || 15) + cdMod + cdRolesBonus);

        const newEvent = {
          ...eventRes.data,
          resolucion: {
            ...(eventRes.data.resolucion || {}),
            cd: cdAjustada,
            cd_base: eventRes.data.resolucion?.cd || 15,
            cd_clima_mod: cdMod,
            cd_roles_mod: cdRolesBonus,
            roles_max: maxRolesAnyMember,
            desventaja_clima: esExtremo,
            ventaja_clima: esFavorable,
            clima_label: weather?.estado_label || null,
            // Disadvantage on saves applies ONLY when the day's weather is
            // actually adverse — NOT just because the season is autumn /
            // winter. Without bad weather there is no save penalty.
            desventaja_salvacion: esExtremo,
            terreno_categoria: eventRes.data.terreno_categoria,
          },
          clima_dia: weather,
          casilla: posicion,
          resuelto: false,
          resultado: null,
          orientacion: orientationResult // Link to the orientation check
        };
        
        setEvents(prev => [...prev, newEvent]);
        setCurrentEvent(newEvent);
        setAwaitingOrientationCheck(false);

        // Un evento corta la persistencia de la marcha forzada (RAW Abr 2026).
        if (forcedMarchActive) {
          setForcedMarchActive(false);
          toast.info('⚡ Marcha forzada interrumpida — ha surgido un evento.');
        }

        const climaTxt = weather?.estado_label
          ? ` · clima: ${weather.estado_label}${cdMod !== 0 ? ` (CD ${cdMod > 0 ? '+' : ''}${cdMod})` : ''}`
          : '';
        toast.info(`¡Acontecimiento en la casilla ${posicion}! (${orientationResult.detalle})${climaTxt}`);
      }
    } catch (err) {
      console.error('Error generating event:', err);
      toast.error('Error al generar acontecimiento');
    }
  };
  
  // Check if there's a refuge nearby on the route (using calculated route data)
  const checkForNearbyRefuge = useCallback((positionInTiles) => {
    // Use refuges from the calculated route instead of hardcoded list
    const refugiosEnRuta = journeyCalc?.ruta?.refugios_en_ruta || [];
    
    if (refugiosEnRuta.length === 0) {
      return [];
    }
    
    // Find refuges within 2 tiles of current position
    return refugiosEnRuta.filter(r => {
      const distancia = Math.abs(r.casilla - positionInTiles);
      return distancia <= 2;
    });
  }, [journeyCalc?.ruta?.refugios_en_ruta]);
  
  // =============== DAILY CONSUMPTION ===============
  // Consume food and water for each party member, apply fatigue if supplies run out.
  // El consumo base depende de las reglas editables (`travelRules`):
  //   consumo_comida_{ritmo} y consumo_agua_{ritmo} (raciones/día y L/día por personaje).
  //   Si hay marcha forzada (1-4 h), se aplica un % de consumo extra.
  // =============== DAILY CONSUMPTION / REFILL / FORAGING ===============
  // Toda la lógica vive en `useJourneyProvisions` (importado al inicio del
  // componente). Se exponen `consumeDailyProvisions`, `refillWaterNearTown`
  // y `performForagingHook` desde el hook. Aquí mantenemos un alias con el
  // nombre antiguo `performForaging` para no tocar todos los call sites.
  const performForaging = performForagingHook;

  // =============== REST SYSTEM ===============

  // State for rest dialog
  const [showRestDialog, setShowRestDialog] = useState(false);
  const [selectedRestType, setSelectedRestType] = useState('long');
  const [restResults, setRestResults] = useState(null);
  
  // Perform rest action
  const performRest = useCallback(async (restType = 'long', shortRestDice = {}) => {
    const restConfig = REST_TYPES[restType];
    const results = [];

    // El cansancio afecta a TODOS los que viajan (con/sin papel + acompañantes).
    const todosViajeros = [
      ...config.miembros,
      ...((config.acompanantes || []).map(a => ({ ...a, papeles: a.papeles || [] }))),
    ];
    for (const miembro of todosViajeros) {
      const char = characters.find(c => c.id === miembro.id);
      if (!char) continue;
      
      let result = {
        nombre: miembro.nombre,
        tipoDescanso: restConfig.nombre,
        fatigaAntes: char.fatiga || 0,
        fatigaDespues: char.fatiga || 0,
        tirada: null,
        cd: null,
        exito: true,
        pgAntes: char.puntos_golpe_actual ?? char.puntos_golpe_max ?? 0,
        pgDespues: char.puntos_golpe_actual ?? char.puntos_golpe_max ?? 0,
        pgMax: char.puntos_golpe_max ?? 0,
        rolls: [],
        dadosGastados: 0,
        dadosRecuperados: 0,
      };
      
      if (restType === 'short') {
        // Descanso corto: gastar dados de golpe seleccionados.
        const dice = Math.max(0, Number(shortRestDice[miembro.id] || 0));
        if (dice > 0) {
          try {
            const res = await api.post(`/characters/${miembro.id}/rest/short`, { dice_to_spend: dice });
            const d = res.data || {};
            result.pgAntes = d.pg_anterior;
            result.pgDespues = d.pg_actual;
            result.pgMax = d.pg_max;
            result.rolls = d.rolls || [];
            result.dadosGastados = d.dados_gastados || 0;
            result.curacionTotal = d.curacion_total || 0;
            result.exito = (d.curacion_total || 0) > 0;
            setCharacters(prev => prev.map(c => c.id === miembro.id ? {
              ...c,
              puntos_golpe_actual: d.pg_actual,
              dados_golpe_gastados: (d.dados_disponibles_restantes !== undefined && c.nivel)
                ? Math.max(0, c.nivel - d.dados_disponibles_restantes)
                : c.dados_golpe_gastados,
            } : c));
          } catch (err) {
            console.error('Error en descanso corto:', err);
          }
        } else {
          result.exito = true;
          result.curacionTotal = 0;
        }
      } else if (restType === 'sanctuary') {
        // Sanctuary rest removes all fatigue without roll, restores HP and all HD.
        result.fatigaDespues = 0;
        result.exito = true;
        try {
          await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: 0 });
          // Long rest endpoint re-used to restore HP + recover dice; loop until done.
          const lr = await api.post(`/characters/${miembro.id}/rest/long`);
          result.pgAntes = lr.data.pg_anterior;
          result.pgDespues = lr.data.pg_actual;
          result.pgMax = lr.data.pg_max;
          result.curacionTotal = lr.data.curacion_total;
          result.dadosRecuperados = lr.data.dados_recuperados;
          // Recover ALL hit dice (set spent = 0) for sanctuary
          await api.patch(`/characters/${miembro.id}`, { dados_golpe_gastados: 0 });
          setCharacters(prev => prev.map(c => c.id === miembro.id ? {
            ...c, fatiga: 0,
            puntos_golpe_actual: lr.data.pg_actual,
            dados_golpe_gastados: 0,
          } : c));
        } catch (err) {
          console.error('Error en santuario:', err);
        }
      } else if (restType === 'long' && restConfig.requiereTiradaCON) {
        // Long rest: CON save (-1 fatigue if pass) + restore HP + recover half HD.
        const modCON = char.atributos?.constitucion 
          ? Math.floor((char.atributos.constitucion - 10) / 2) 
          : 0;
        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + modCON;
        const cd = restConfig.cdBase + (provisionFatigue[miembro.id]?.sinComida || 0) + (provisionFatigue[miembro.id]?.sinAgua || 0) * 2;
        
        result.tirada = total;
        result.cd = cd;
        result.exito = total >= cd;

        const saveEntry = {
          d20, mod: modCON, total, cd, exito: result.exito,
          charName: char?.nombre || miembro.nombre,
          dia: activeJourney?.dia_actual || null,
        };
        setLastFatigueSaves(prev => ({ ...prev, [miembro.id]: saveEntry }));
        setFatigueSaveLog(prev => [...prev, { id: miembro.id, ...saveEntry }]);
        
        // Apply HP restoration + HD recovery via backend
        try {
          const lr = await api.post(`/characters/${miembro.id}/rest/long`);
          result.pgAntes = lr.data.pg_anterior;
          result.pgDespues = lr.data.pg_actual;
          result.pgMax = lr.data.pg_max;
          result.curacionTotal = lr.data.curacion_total;
          result.dadosRecuperados = lr.data.dados_recuperados;
          // The long endpoint also reduces fatigue by 1; re-apply user logic here
          let fatigaFinal = lr.data.fatiga_nueva;
          if (!result.exito) {
            // CON save fail: revert fatigue reduction (keep original)
            fatigaFinal = char.fatiga || 0;
            await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: fatigaFinal });
          }
          result.fatigaDespues = fatigaFinal;
          setCharacters(prev => prev.map(c => c.id === miembro.id ? {
            ...c,
            puntos_golpe_actual: lr.data.pg_actual,
            dados_golpe_gastados: Math.max(0, (c.dados_golpe_gastados || 0) - lr.data.dados_recuperados),
            fatiga: fatigaFinal,
          } : c));
          setFatigueChanges(prev => ({
            ...prev,
            [miembro.id]: { delta: fatigaFinal - (char.fatiga || 0), casilla: currentPosition },
          }));
        } catch (err) {
          console.error('Error en descanso largo:', err);
        }
      }
      
      results.push(result);
    }
    
    setRestResults(results);
    
    // If resting for long/sanctuary, add time
    if (restType === 'long') {
      setStageDays(prev => prev + 1);
    } else if (restType === 'sanctuary') {
      // Sanctuary rest ends the current stage
      await handleRestAtRefuge({ nombre: 'Santuario' });
    }
    
    // Reset provision fatigue tracking after rest
    if (restType === 'sanctuary' || restType === 'long') {
      setProvisionFatigue({});
    }
    
    return results;
  }, [config.miembros, characters, provisionFatigue]);
  
  // After resolving an event, continue with next orientation check
  const continueAfterEvent = async (updatedEvents = null) => {
    // Update current position to event position
    setCurrentPosition(nextEventPosition);
    setStageDays(prev => prev + 1);

    // Cada avance es una nueva jornada de marcha → resetear contador de
    // acampadas consecutivas (la próxima acampada SÍ rodará salvación).
    setConsecutiveCampDays(0);

    // *** CONSUME DAILY PROVISIONS ***
    consumeDailyProvisions();
    
    // Use passed events or fall back to state (for direct calls)
    const currentEvents = updatedEvents || events;
    
    // Safety check for journeyCalc
    const totalCasillas = journeyCalc?.ruta?.casillas || 0;
    const casillasRestantes = totalCasillas - nextEventPosition;
    
    // Check for nearby refuges
    const refuges = checkForNearbyRefuge(nextEventPosition);
    setNearbyRefuges(refuges);
    
    // Check if we should end the current stage
    const shouldEndStage = 
      stageDays >= 7 || // 7+ days in this stage
      refuges.length > 0 || // Refuge nearby
      casillasRestantes <= 0; // Journey complete
    
    if (casillasRestantes <= 0) {
      // Journey complete - final fatigue check for this stage
      toast.success('¡La compañía ha llegado a su destino!');
      
      // Save current stage
      setJourneyStages(prev => [...prev, {
        numero: currentStage,
        dias: stageDays,
        eventos: [...stageEvents],
        fatigueDC: stageFatigueDC,
        completado: true
      }]);
      
      await calculateFatigueResults(currentEvents);
      setMode('results');
    } else if (shouldEndStage && refuges.length > 0) {
      // Refuge available - offer to rest
      toast.info(`¡Refugio cercano: ${refuges.map(r => r.nombre).join(', ')}! Puedes descansar aquí.`, {
        duration: 5000,
        action: {
          label: 'Descansar',
          onClick: () => handleRestAtRefuge(refuges[0])
        }
      });
      
      // Still continue with orientation check, but show refuge option
      setAwaitingOrientationCheck(true);
      setCurrentEvent(null);
    } else if (stageDays >= 10) {
      // Force stage end after 10 days - fatigue check required
      toast.warning('Han pasado 10 días. Es necesario realizar la tirada de Fatiga de esta etapa.');
      await handleEndStage();
    } else {
      // Continue journey
      setAwaitingOrientationCheck(true);
      setCurrentEvent(null);
      toast.info(`Quedan ${casillasRestantes} casillas (día ${stageDays} de la etapa ${currentStage}).`);
    }
  };
  
  // Handle resting at a refuge
  const handleRestAtRefuge = async (refuge) => {
    // Calculate fatigue for current stage
    await calculateStageFatigue();
    
    // Save completed stage
    setJourneyStages(prev => [...prev, {
      numero: currentStage,
      dias: stageDays,
      eventos: [...stageEvents],
      fatigueDC: stageFatigueDC,
      refugio: refuge.nombre,
      completado: true
    }]);
    
    // Reset for new stage
    setCurrentStage(prev => prev + 1);
    setStageDays(0);
    setStageEvents([]);
    setStageFatigueDC(10);
    
    toast.success(`Descanso en ${refuge.nombre}. La fatiga acumulada se reinicia. Nueva etapa comenzada.`);
    setAwaitingOrientationCheck(true);
  };
  
  // Handle ending a stage (for fatigue calculation)
  const handleEndStage = async () => {
    await calculateStageFatigue();
    
    setJourneyStages(prev => [...prev, {
      numero: currentStage,
      dias: stageDays,
      eventos: [...stageEvents],
      fatigueDC: stageFatigueDC,
      completado: true
    }]);
    
    // Start new stage
    setCurrentStage(prev => prev + 1);
    setStageDays(0);
    setStageEvents([]);
    setStageFatigueDC(10);
    
    setAwaitingOrientationCheck(true);
  };
  
  // Calculate fatigue for current stage only (used only in global journey view)
  const calculateStageFatigue = async () => {
    let cd = 10 + stageDays; // Base + days
    stageEvents.forEach(e => {
      if (!e.exito) cd += 2; // Failed events add to fatigue
    });
    setStageFatigueDC(cd);
    // Note: Actual fatigue rolls happen in calculateFatigueResults at end of journey.
    // Marcha forzada ya no se configura globalmente; se decide por día.
  };
  
  const startDayByDayJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    if (!config.miembros.some(m => m.papeles?.includes('guia'))) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }

    // Aplica overrides de fatiga inicial (con justificación obligatoria).
    try {
      const aplicados = await applyInitialFatigueOverrides();
      if (aplicados.length > 0) {
        toast.success(`Fatiga inicial ajustada para ${aplicados.length} personaje(s).`);
      }
    } catch (err) {
      toast.error(err.message || 'Error aplicando ajuste de fatiga inicial.');
      return;
    }

    // *** INITIALIZE PROVISIONS ***
    // Calcula provisiones iniciales leyendo inventarios reales (raciones + odres).
    // Si el origen es una ubicación conocida, los odres se rellenan gratis al salir.
    const origenLoc = (locations || []).find(l => l.id === config.origenId);
    const tipoOrigen = (origenLoc?.tipo || origenLoc?.tipo_lugar || '').toLowerCase();
    const esAsentamientoConocido = !!origenLoc && (
      tipoOrigen.includes('aldea') || tipoOrigen.includes('pueblo') ||
      tipoOrigen.includes('ciudad') || tipoOrigen.includes('refugio') ||
      tipoOrigen.includes('santuario') || tipoOrigen.includes('asentamiento') ||
      tipoOrigen.includes('fortal') || tipoOrigen.includes('castillo') ||
      tipoOrigen.includes('hostal') || tipoOrigen.includes('posada') || !tipoOrigen
    );

    let comidaInicial = 0;
    let aguaInicial = 0;
    const todosViajerosInicio = [...config.miembros.filter(m => m.papeles?.length > 0), ...(config.acompanantes || [])];
    todosViajerosInicio.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      const summary = summarizeProvisions(char.inventario);
      comidaInicial += summary.diasComidaTotal || summary.raciones;
      // Si origen es asentamiento conocido, todos los odres parten LLENOS (10 L c/u).
      const litrosCharacter = esAsentamientoConocido
        ? summary.odres.length * 10 + summary.aguaSuelta
        : summary.totalLitros;
      aguaInicial += litrosCharacter;
    });

    if (esAsentamientoConocido && (config.acompanantes || []).length + config.miembros.length > 0) {
      toast.success(`Odres rellenados gratis en ${config.origenNombre}.`);
    }

    setPartyProvisions({
      comidaTotal: comidaInicial,
      aguaTotal: aguaInicial,
      comidaConsumida: 0,
      aguaConsumida: 0
    });
    
    // Reset provision fatigue tracking
    setProvisionFatigue({});
    
    try {
      const payload = {
        origen_id: config.origenId,
        origen_nombre: config.origenNombre,
        destino_id: config.destinoId,
        destino_nombre: config.destinoNombre,
        origen_x: config.origenX,
        origen_y: config.origenY,
        destino_x: config.destinoX,
        destino_y: config.destinoY,
        evitar_sombra: config.evitarSombra,
        evitar_tierras_oscuras: config.evitarTierrasOscuras,
        preferir_caminos: config.preferirCaminos,
        ritmo: config.ritmo,
        mes: config.mes,
        estacion: config.estacion,
        // horas_marcha_forzada eliminado (Abr 2026): se decide por día tras orientación.
        miembros: config.miembros.map(m => ({
          personaje_id: m.id,
          nombre: m.nombre,
          papeles: m.papeles || [],
          tiene_montura: m.tieneMontura,
          montura_con_bonus: m.monturaConBonus || 0
        }))
      };
      
      const res = await api.post('/travel/journey/start', payload);
      
      if (res.data.success) {
        setActiveJourney(res.data.journey);
        setMode('dayByDay');
        toast.success('Viaje iniciado');
      } else {
        toast.error(res.data.message || 'Error al iniciar viaje');
      }
    } catch (err) {
      console.error('Error starting journey:', err);
      toast.error('Error al iniciar viaje');
    }
  };
  
  // =============== EVENT RESOLUTION ===============

  // Get the modifier + breakdown for a given target role using precomputed member values
  // Pure helper extracted to /utils/travelSpeed.js. The component still
  // wraps it so the role lookup has direct access to `config.miembros`.
  const getRoleModifier = (targetRole) => getRoleModifierHelper(targetRole, config.miembros);

  // Roll dice for event resolution
  const rollEventDice = () => {
    if (!currentEvent) return;
    const targetRole = currentEvent.objetivo.papel;
    const { modifier, member, roleInfo } = getRoleModifier(targetRole);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + modifier;
    setEventDiceRoll({
      d20,
      modifier,
      total,
      modifierSource: roleInfo?.habilidad || 'Sabiduría',
      targetMemberId: member?.id,
    });
  };
  
  // Clear dice roll + GM notes when event changes
  useEffect(() => {
    setEventDiceRoll(null);
    setGmNotesEvent('');
  }, [currentEvent]);
  
  // =============== EVENT RESOLUTION (hook) ===============
  // `resolveCurrentEvent` vive ahora en `useEventResolution`.
  const resolveCurrentEvent = useEventResolution({
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
    setEvents,
    setCurrentEvent,
    setCharacters,
    setActiveJourney,
    setDailySummaries,
    setResolvingEvent,
    setGlobalFatigaCD,
    setFatigaCdBreakdown,
    addCharacterXP,
    continueAfterEvent,
  });

  // =============== VIAJE GLOBAL (automated end-to-end journey) ===============
  // Bucle independiente que NO depende del estado de React entre iteraciones:
  // tira orientación → calcula posición de evento → genera evento → resuelve →
  // acumula localmente → al final sincroniza estado y muestra resultados.
  // =============== JOURNEY AUTOMATION (hook) ===============
  // `automateJourney`, `advanceDay`, `generateDayEvent`, `finishDayByDayJourney`
  // y `calculateFatigueResults` viven ahora en `useJourneyAutomation`.
  const {
    automateJourney,
    advanceDay,
    generateDayEvent, // eslint-disable-line no-unused-vars -- expuesto por compatibilidad interna
    finishDayByDayJourney,
    calculateFatigueResults, // eslint-disable-line no-unused-vars -- expuesto por compatibilidad interna
  } = useJourneyAutomation({
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
    autoStopRef,
    modeRef,
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
    consumeDailyProvisions,
    applyForcedMarchExtraConsumption,
    applyForcedMarchSaves,
    getRoleModifier,
  });

  // =============== MEMBER MANAGEMENT (hook) ===============

  const {
    addMemberWithRole,
    removeRoleFromMember,
    updateMemberMount,
    addAcompanante,
    removeAcompanante,
    toggleAcompananteMount,
  } = useJourneyMembers({ config, setConfig, characters });

  // =============== RESULTS / FINAL PHASE (hook) ===============

  const {
    resetJourney,
    generateJourneyNarrative,
    printJourneyDocument,
    applyPXToCharacters,
  } = useJourneyResults({
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
  });

  // Capture map image when journeyCalc is available and we have coordinates
  useEffect(() => {
    if (journeyCalc?.ruta?.path_coords && mapContainerRef.current && !savedMapImage) {
      // Wait for the map to render, then capture it
      const timer = setTimeout(async () => {
        try {
          const canvas = await html2canvas(mapContainerRef.current, {
            backgroundColor: '#f4efe6',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            imageTimeout: 15000
          });
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setSavedMapImage(dataUrl);
          console.log('Map image auto-captured');
        } catch (err) {
          console.error('Error auto-capturing map:', err);
        }
      }, 1000); // Wait 1 second for map to fully render
      
      return () => clearTimeout(timer);
    }
  }, [journeyCalc?.ruta?.path_coords, savedMapImage]);
  
  // =============== RENDER SECTIONS ===============
  
  // Filter locations by search term
  const filterLocations = (searchTerm) => {
    if (!searchTerm) return locationsByRegion;
    
    const filtered = {};
    const term = searchTerm.toLowerCase();
    
    Object.entries(locationsByRegion).forEach(([region, locs]) => {
      const matchingLocs = locs.filter(loc => 
        loc.nombre.toLowerCase().includes(term) ||
        loc.nombre_sindarin?.toLowerCase().includes(term) ||
        region.toLowerCase().includes(term)
      );
      if (matchingLocs.length > 0) {
        filtered[region] = matchingLocs;
      }
    });
    
    return filtered;
  };
  
  // Configuration Panel
  
  // Day by Day Journey
  
  // Results
  
  // =============== MAIN RENDER ===============
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <JourneyHeader mode={mode} />
      
      {mode === 'config' && (
        <ConfigView
          config={config}
          locations={locations}
          origenSearch={origenSearch}
          destinoSearch={destinoSearch}
          origenOpen={origenOpen}
          destinoOpen={destinoOpen}
          journeyCalc={journeyCalc}
          loadingCalc={loadingCalc}
          loadingComparison={loadingComparison}
          routeComparison={routeComparison}
          showComparison={showComparison}
          mapExpanded={mapExpanded}
          characters={characters}
          provisionsCheck={provisionsCheck}
          showProvisionsWarning={showProvisionsWarning}
          travelMode={travelMode}
          initialFatigueOverrides={initialFatigueOverrides}
          setInitialFatigueOverrides={setInitialFatigueOverrides}
          journeyWeather={journeyWeather}
          setConfig={setConfig}
          setOrigenSearch={setOrigenSearch}
          setDestinoSearch={setDestinoSearch}
          setOrigenOpen={setOrigenOpen}
          setDestinoOpen={setDestinoOpen}
          setMapExpanded={setMapExpanded}
          setShowComparison={setShowComparison}
          setShowProvisionsShop={setShowProvisionsShop}
          setShowProvisionsWarning={setShowProvisionsWarning}
          setTravelMode={setTravelMode}
          filterLocations={filterLocations}
          triggerCalculateJourney={triggerCalculateJourney}
          compareRoutes={compareRoutes}
          addMemberWithRole={addMemberWithRole}
          removeRoleFromMember={removeRoleFromMember}
          updateMemberMount={updateMemberMount}
          addAcompanante={addAcompanante}
          removeAcompanante={removeAcompanante}
          openMapPicker={(which) => setMapPickFor(which)}
          toggleAcompananteMount={toggleAcompananteMount}
          startGlobalJourney={startGlobalJourney}
          startDayByDayJourney={startDayByDayJourney}
        />
      )}
      {mode === 'global' && (
        <GlobalJourneyView
          config={config}
          currentPosition={currentPosition}
          journeyCalc={journeyCalc}
          events={events}
          awaitingOrientationCheck={awaitingOrientationCheck}
          characters={characters}
          gmNotesOrientation={gmNotesOrientation}
          autoRunning={autoRunning}
          lastOrientationResult={lastOrientationResult}
          currentEvent={currentEvent}
          gmNotesEvent={gmNotesEvent}
          eventDiceRoll={eventDiceRoll}
          resolvingEvent={resolvingEvent}
          dailySummaries={dailySummaries}
          partyProvisions={partyProvisions}
          globalFatigaCD={globalFatigaCD}
          fatigaCdBreakdown={fatigaCdBreakdown}
          forcedMarchActive={forcedMarchActive}
          currentDayConfig={currentDayConfig}
          setCurrentDayConfig={setCurrentDayConfig}
          lastFatigueSaves={lastFatigueSaves}
          fatigueSaveLog={fatigueSaveLog}
          fatigueChanges={fatigueChanges}
          setMode={setMode}
          setGmNotesOrientation={setGmNotesOrientation}
          setGmNotesEvent={setGmNotesEvent}
          setShowCampDialog={setShowCampDialog}
          setShowProvisionsShop={setShowProvisionsShop}
          performForaging={performForaging}
          getRoleModifier={getRoleModifier}
          performOrientationCheck={performOrientationCheck}
          automateJourney={automateJourney}
          rollEventDice={rollEventDice}
          resolveCurrentEvent={resolveCurrentEvent}
        />
      )}
      {mode === 'dayByDay' && (
        <DayByDayView
          config={config}
          journeyCalc={journeyCalc}
          activeJourney={activeJourney}
          events={events}
          partyProvisions={partyProvisions}
          provisionFatigue={provisionFatigue}
          currentDayConfig={currentDayConfig}
          currentEvent={currentEvent}
          gmNotesEvent={gmNotesEvent}
          eventDiceRoll={eventDiceRoll}
          resolvingEvent={resolvingEvent}
          characters={characters}
          showRestDialog={showRestDialog}
          selectedRestType={selectedRestType}
          restResults={restResults}
          nearbyRefuges={nearbyRefuges}
          setShowProvisionsShop={setShowProvisionsShop}
          setShowCampDialog={setShowCampDialog}
          setShowRestDialog={setShowRestDialog}
          setCurrentDayConfig={setCurrentDayConfig}
          setGmNotesEvent={setGmNotesEvent}
          setSelectedRestType={setSelectedRestType}
          setRestResults={setRestResults}
          performForaging={performForaging}
          advanceDay={advanceDay}
          getRoleModifier={getRoleModifier}
          rollEventDice={rollEventDice}
          resolveCurrentEvent={resolveCurrentEvent}
          resetJourney={resetJourney}
          finishDayByDayJourney={finishDayByDayJourney}
          performRest={performRest}
        />
      )}
      {mode === 'results' && (
        <ResultsView
          travelRules={travelRules}
          events={events}
          journeyCalc={journeyCalc}
          config={config}
          orientationChecks={orientationChecks}
          fatigueResults={fatigueResults}
          pxApplied={pxApplied}
          pxResults={pxResults}
          applyingPX={applyingPX}
          characterXP={characterXP}
          journeyChronicle={journeyChronicle}
          journeyNarrative={journeyNarrative}
          generatingNarrative={generatingNarrative}
          includeChronicleInPDF={includeChronicleInPDF}
          currentPosition={currentPosition}
          nextEventPosition={nextEventPosition}
          locations={locations}
          mapContainerRef={mapContainerRef}
          characters={characters}
          setMode={setMode}
          setIncludeChronicleInPDF={setIncludeChronicleInPDF}
          setJourneyChronicle={setJourneyChronicle}
          applyPXToCharacters={applyPXToCharacters}
          generateJourneyNarrative={generateJourneyNarrative}
          printJourneyDocument={printJourneyDocument}
          resetJourney={resetJourney}
        />
      )}
      
      {/* Diálogos flotantes (acampada, tienda, overlay y selector de mapa) */}
      <JourneyDialogs
        // Camp
        showCampDialog={showCampDialog}
        setShowCampDialog={setShowCampDialog}
        miembros={config.miembros}
        acompanantes={config.acompanantes || []}
        characters={characters}
        activeJourney={
          activeJourney ||
          (mode === 'global'
            ? { fatiga_cd_total: globalFatigaCD, config: { tipo_tierra: journeyCalc?.ruta?.tipo_tierra } }
            : null)
        }
        region={journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes'}
        partyProvisions={partyProvisions}
        setPartyProvisions={setPartyProvisions}
        setCharacters={setCharacters}
        travelEvents={travelEvents}
        onJourneyUpdate={(patch) => {
          if (patch?.fatiga_cd_total != null) {
            setGlobalFatigaCD(patch.fatiga_cd_total);
          }
          setActiveJourney((prev) => (prev ? { ...prev, ...patch } : prev));
        }}
        terrenoViaje={journeyCalc?.ruta?.terreno || 'moderado'}
        performForaging={performForaging}
        desgloseVelocidades={journeyCalc?.velocidad_grupo?.desglose_velocidades || []}
        consecutiveCampDays={consecutiveCampDays}
        diasSinComida={diasSinComida}
        diasSinAgua={diasSinAgua}
        currentClima={
          (journeyWeather || [])[Math.min(currentPosition, (journeyWeather || []).length - 1)] || null
        }
        currentTerreno={journeyCalc?.ruta?.tipo_tierra || ''}
        onCampDayCompleted={() => setConsecutiveCampDays((d) => d + 1)}
        onFatigueSave={(charId, save) => {
          setLastFatigueSaves((prev) => ({ ...prev, [charId]: save }));
          setFatigueSaveLog((prev) => [...prev, { id: charId, ...save }]);
        }}
        onFatigueChange={(charId, delta) => {
          setFatigueChanges((prev) => ({ ...prev, [charId]: { delta, casilla: currentPosition } }));
        }}

        // Provisions shop
        showProvisionsShop={showProvisionsShop}
        setShowProvisionsShop={setShowProvisionsShop}
        diasViaje={
          journeyCalc?.estimaciones?.dias_estimados || activeJourney?.config?.dias_estimados || 7
        }
        origenRegionName={(locations || []).find((l) => l.id === config.origenId)?.region || ''}
        terrenoShop={journeyCalc?.ruta?.terreno || ''}
        tipoTierra={journeyCalc?.ruta?.tipo_tierra || ''}
        onPurchaseComplete={() => {
          api
            .get('/characters/')
            .then((res) => {
              if (res.data?.characters) setCharacters(res.data.characters);
            })
            .catch((err) => console.error(err));
        }}

        // Automation overlay
        autoRunning={autoRunning}
        autoProgress={autoProgress}
        autoMessage={autoMessage}
        autoSubtitle={autoSubtitle}
        onAutoCancel={() => {
          autoStopRef.current = true;
        }}

        // Map picker
        mapPickFor={mapPickFor}
        setMapPickFor={setMapPickFor}
        locations={locations}
        onMapPick={(loc) => {
          if (mapPickFor === 'origen') {
            setConfig((prev) => ({
              ...prev,
              origenId: loc.id,
              origenNombre: loc.nombre,
              origenX: loc.custom ? loc.x : null,
              origenY: loc.custom ? loc.y : null,
            }));
            toast.success(`Origen: ${loc.nombre}`);
          } else if (mapPickFor === 'destino') {
            setConfig((prev) => ({
              ...prev,
              destinoId: loc.id,
              destinoNombre: loc.nombre,
              destinoX: loc.custom ? loc.x : null,
              destinoY: loc.custom ? loc.y : null,
            }));
            toast.success(`Destino: ${loc.nombre}`);
          }
        }}
      />
    </div>
  );
};

export default EnhancedTravelSystem;

