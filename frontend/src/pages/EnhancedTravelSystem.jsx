/**
 * Enhanced Travel System Component
 * Implements both Global and Day-by-Day journey modes
 * Uses the new travel rules API with editable configurations
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Compass, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import api from '@/services/api';
import PartyFatiguePanel from '@/components/travel/PartyFatiguePanel';
import CampDialog from '@/components/travel/CampDialog';
import JourneyDiary from '@/components/travel/JourneyDiary';
import ProvisionsShopDialog from '@/components/travel/ProvisionsShopDialog';
import WeatherIndicator from '@/components/travel/WeatherIndicator';
import SauronEyeOverlay from '@/components/travel/SauronEyeOverlay';
import JourneyMiniMap from '@/components/travel/JourneyMiniMap';
import {
  MESES_ELFICOS,
  SeasonIcon,
  ROLE_ICONS,
  ROLE_INFO,
  hasMultipleRoles,
  hasPenalty,
  MULTI_ROLE_PENALTY,
  MAX_ROLES_PER_CHARACTER
} from '@/components/travel/travelConstants';
import {
  REST_TYPES,
  ROLE_MODIFIER_KEY,
  SKILL_ATTRIBUTES,
  calcBonusCompetencia,
  tieneCompetenciaEn,
  tienePericia,
  getModAtributo,
  calcModHabilidad,
  getFatigueBaseCD,
  calculateRollXP,
  calculateGroupMultiplier,
  getForageCD
} from '@/components/travel/travelHelpers';
import { printJourneyDocument as printJourneyDocumentHelper } from '@/components/travel/travelPrint';
import { summarizeProvisions } from '@/components/travel/inventoryProvisions';
import { consumeProportionalFood } from '@/components/travel/proportionalFoodConsumption';
import ResultsView from '@/components/travel/views/ResultsView';
import GlobalJourneyView from '@/components/travel/views/GlobalJourneyView';
import DayByDayView from '@/components/travel/views/DayByDayView';
import ConfigView from '@/components/travel/views/ConfigView';
import MapPickDialog from '@/components/travel/MapPickDialog';
import { computeMemberSpeed, getRoleModifier as getRoleModifierHelper } from '@/utils/travelSpeed';
import useJourneyProvisions from '@/hooks/useJourneyProvisions';
import useFatigueSystem from '@/hooks/useFatigueSystem';


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
  const [monturas, setMonturas] = useState([]);
  const [travelRules, setTravelRules] = useState(null);
  const [landTypes, setLandTypes] = useState([]);
  const [terrainTypes, setTerrainTypes] = useState([]);
  
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
    initializeProvisions,
    consumeDailyProvisions,
    refillWaterNearTown,
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
    addCdModifier,
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
  
  // Refs to access latest state inside the async automation loop (avoid stale closures)
  const currentPositionRef = useRef(currentPosition);
  const currentEventRef = useRef(currentEvent);
  const charactersRef = useRef(characters);
  const modeRef = useRef('config');
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { currentEventRef.current = currentEvent; }, [currentEvent]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  // Sync mode to ref so async automation loop can see immediate changes
  useEffect(() => { modeRef.current = mode; }, [mode]);
  // Mantiene sincronizado el id de viaje que necesita el hook de fatiga
  // para persistir sus modificaciones de CD en backend.
  useEffect(() => { setJourneyIdForFatigue(activeJourney?.id || null); }, [activeJourney?.id]);
  
  // =============== LOAD DATA ===============
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locRes, charRes, mountRes, rulesRes, landsRes, terrainsRes, foodWaterRes, eventsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/characters/'),
          api.get('/data/monturas'),
          api.get('/travel/config/rules'),
          api.get('/travel/config/land-types'),
          api.get('/travel/config/terrains'),
          api.get('/data/equipment-catalog/food-items'),
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
        setMonturas(mountRes.data || []);
        setTravelRules(rulesRes.data?.rules || {});
        setLandTypes(landsRes.data?.land_types || []);
        setTerrainTypes(terrainsRes.data?.terrains || []);
        setFoodWaterItems(foodWaterRes.data || { food_items: [], water_items: [] });
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
        const cdAjustada = Math.max(5, (eventRes.data.resolucion?.cd || 15) + cdMod);

        const newEvent = {
          ...eventRes.data,
          resolucion: {
            ...(eventRes.data.resolucion || {}),
            cd: cdAjustada,
            cd_base: eventRes.data.resolucion?.cd || 15,
            cd_clima_mod: cdMod,
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
  
  // Check if near a water source to refill
  const checkWaterRefill = useCallback((positionInTiles) => {
    // Check refuges near current position for water refill
    const refugiosEnRuta = journeyCalc?.ruta?.refugios_en_ruta || [];
    const nearbyRefuge = refugiosEnRuta.find(r => Math.abs(r.casilla - positionInTiles) <= 1);
    
    if (nearbyRefuge) {
      refillWaterNearTown(nearbyRefuge.nombre);
      return true;
    }
    return false;
  }, [journeyCalc?.ruta?.refugios_en_ruta, refillWaterNearTown]);

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
  
  const resolveCurrentEvent = async (tirada) => {
    if (!currentEvent) return;
    
    setResolvingEvent(true);
    
    // Find the character with the target role
    const targetRole = currentEvent.objetivo.papel;
    const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
    
    const cd = currentEvent.resolucion.cd;
    const exito = tirada >= cd;
    
    // Calculate XP for the character resolving the event
    if (targetMember) {
      const xpResult = calculateRollXP(
        cd,
        tirada,
        exito,
        journeyCalc?.ruta?.terreno || 'moderado',
        journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
        eventDiceRoll?.d20
      );
      
      addCharacterXP(targetMember.id, {
        type: 'evento',
        eventoNombre: currentEvent.evento.nombre,
        cd: cd,
        tirada: tirada,
        exito: exito,
        ...xpResult,
        casilla: currentEvent.casilla
      });
    }
    
    try {
      const res = await api.post('/travel/resolve-event', null, {
        params: {
          evento_id: currentEvent.evento.id,
          tirada_resolucion: tirada,
          cd: cd,
          exito: exito,
          evento_nombre: currentEvent.evento.nombre,
          objetivo_papel: targetRole,
          personaje_nombre: targetMember?.nombre || 'Desconocido'
        }
      });
      
      // Generate AI narrative for the event (non-blocking)
      let narrativa = null;
      try {
        // Calculate event position in journey
        const resolvedEvents = events.filter(e => e.resuelto).length;
        const totalEvents = events.length;
        
        // Look up the climate for the day where this event is happening
        const eventDay = Math.max(1, currentEvent.casilla || 1);
        const wDay = journeyWeather[Math.min(eventDay - 1, journeyWeather.length - 1)];
        const climaTxt = wDay
          ? `${wDay.estado_label}${wDay.region ? ' en ' + wDay.region : ''}`
          : '';
        
        const narrativeRes = await api.post('/travel/generate-narrative', null, {
          params: {
            evento_nombre: currentEvent.evento.nombre,
            exito: exito,
            consecuencia: exito ? currentEvent.evento.consecuencias_exito : currentEvent.evento.consecuencias_fracaso,
            personaje_nombre: targetMember?.nombre || 'El grupo',
            papel: targetRole,
            tirada: tirada,
            cd: cd,
            origen: config.origenNombre,
            destino: config.destinoNombre,
            terreno: journeyCalc?.ruta?.terreno || 'campo_abierto',
            evento_numero: resolvedEvents + 1,
            total_eventos: totalEvents,
            dia_actual: currentEvent.casilla || 1,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            notas_maestro: gmNotesEvent || '',
            clima: climaTxt,
          }
        });
        if (narrativeRes.data.success) {
          narrativa = narrativeRes.data.narrative;
        }
      } catch (err) {
        console.log('Narrative generation skipped:', err);
      }
      
      // Capture the weather snapshot for this event's day
      const eventDayN = Math.max(1, currentEvent.casilla || 1);
      const eventWeather = journeyWeather[Math.min(eventDayN - 1, journeyWeather.length - 1)] || null;
      
      // Update event with result
      const updatedEvents = events.map(e => {
        if (e === currentEvent) {
          return {
            ...e,
            resuelto: true,
            resultado: res.data,
            tirada: tirada,
            exito: exito,
            narrativa: narrativa,
            gm_notes: gmNotesEvent || '',
            clima_dia: eventWeather,
          };
        }
        return e;
      });
      
      setEvents(updatedEvents);

      // ===== APLICAR CONSECUENCIAS MECÁNICAS DEL EVENTO (D&D 5e LOTR) =====
      const eventoId = currentEvent.evento.id;
      const mecanicas = []; // textos para la bitácora

      try {
        // Terrible Desgracia (FALLO): TS de DES; fallo→0 PG, éxito→pierde mitad de PG máx.
        // Desventaja en otoño/invierno (per reglas).
        if (eventoId === 'event_terrible' && !exito && targetMember) {
          const charDb = characters.find(c => c.id === targetMember.id);
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
              setCharacters(prev => prev.map(c => c.id === targetMember.id ? { ...c, puntos_golpe_actual: nuevoPG } : c));
            } catch (e) { console.error('HP update fail:', e); }
            const detalleD = desventaja ? `d20(${r1}/${r2}→${sd20})` : `d20(${sd20})`;
            mecanicas.push(`${targetMember.nombre} hace TS DES: ${detalleD}+${desMod}=${sTotal} vs CD ${cdSalv} → ${exitoSalv ? 'éxito (pierde ' + danio + ' PG)' : 'fallo (cae a 0 PG)'}.`);
            if (nuevoPG <= 0) {
              mecanicas.push(`⚠️ ${targetMember.nombre} ha caído inconsciente (0 PG). Necesita curación urgente.`);
              toast.error(`💀 ${targetMember.nombre} cae INCONSCIENTE (0 PG). Aplica primeros auxilios o un descanso.`, {
                duration: 7000,
                style: { background: '#7f1d1d', color: '#fecaca', border: '1px solid #f87171' },
              });
            } else {
              toast(exitoSalv
                ? `${targetMember.nombre} pierde ${danio} PG.`
                : `${targetMember.nombre} cae a ${nuevoPG} PG.`,
                { duration: 4500 });
            }
          }
        }

        // Desesperanza / Decisiones erróneas (FALLO): puntos de Sombra.
        // Cada personaje afectado hace su propia TS y, si falla, recibe
        // su propio 1d3 aleatorio INDIVIDUAL (Desesperanza, RAW house-rule
        // Mayo 2026) o 1 punto fijo (Decisiones erróneas).
        //   - Desesperanza: TS CARISMA (añade PB si competencia) para resistir.
        //                    afecta a TODA la compañía (miembros + acompañantes).
        //                    1d3 por cada uno que falla la TS.
        //   - Decisiones erróneas: TS SABIDURÍA al objetivo. 1 punto fijo.
        // Además: Desesperanza SUMA +2 a la CD de fatiga final del viaje
        // (mostrado en el widget del grupo).
        if (!exito && (eventoId === 'event_desesperanza' || eventoId === 'event_decisiones')) {
          const isDesesperanza = eventoId === 'event_desesperanza';
          const atributoSalvacion = isDesesperanza ? 'carisma' : 'sabiduria';
          const atributoLabel = isDesesperanza ? 'CAR' : 'SAB';
          const cdSalv = cd;

          // ➕ Aplicar +2 a la CD de fatiga final + breakdown visual.
          if (isDesesperanza) {
            const inc = 2;
            setGlobalFatigaCD((prev) => (prev || 10) + inc);
            setFatigaCdBreakdown(prev => [...prev, {
              motivo: 'Desesperanza',
              delta: inc,
              dia: (activeJourney?.dia_actual || currentPosition + 1),
              casilla: currentPosition,
            }]);
            setActiveJourney((prev) => prev
              ? { ...prev, fatiga_cd_total: (prev.fatiga_cd_total || 10) + inc }
              : prev);
            if (activeJourney?.id) {
              try {
                await api.patch(`/travel/journey/${activeJourney.id}/fatigue-cd`, null, {
                  params: { delta: inc, reason: 'Desesperanza' },
                });
              } catch (e) { /* non-fatal */ }
            }
          }

          // Personajes afectados: Desesperanza → todos (miembros con papel +
          // acompañantes). Decisiones → sólo el objetivo.
          const personajesAfectados = isDesesperanza
            ? [
                ...(config.miembros || []).filter(m => m.papeles?.length > 0),
                ...(config.acompanantes || []),
              ]
            : (targetMember ? [targetMember] : []);

          if (isDesesperanza) {
            mecanicas.push(`Desesperanza: cada miembro tira TS CAR (CD ${cdSalv}); los que fallen reciben 1d3 puntos de Sombra (individual).`);
          }

          for (const m of personajesAfectados) {
            const charDb = characters.find(c => c.id === m.id);
            if (!charDb) continue;
            const score = charDb.atributos?.[atributoSalvacion] ?? 10;
            const mod = Math.floor((score - 10) / 2);
            // Competencia: si el personaje tiene proficiency en TS del
            // atributo (p.ej. Carisma), añade su bonif. de competencia.
            const compArr = charDb.competencias_salvacion || charDb.salvaciones_competentes || [];
            const esCompetente = Array.isArray(compArr) && compArr.some(
              (x) => String(x).toLowerCase().startsWith(atributoSalvacion.slice(0, 3)) ||
                     String(x).toLowerCase() === atributoSalvacion
            );
            const nivel = Number(charDb.nivel || 1);
            const profBonus = Math.ceil(nivel / 4) + 1; // 5e RAW: nv 1-4 = 2, 5-8 = 3, etc.
            const totalMod = mod + (esCompetente ? profBonus : 0);

            const desventaja = currentEvent?.resolucion?.desventaja_salvacion;
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = desventaja ? Math.floor(Math.random() * 20) + 1 : null;
            const d20 = desventaja ? Math.min(r1, r2) : r1;
            const total = d20 + totalMod;
            const exitoSalv = total >= cdSalv;
            const detalleD = desventaja ? `d20(${r1}/${r2}→${d20})` : `d20(${d20})`;
            const compLabel = esCompetente ? ` (+PB ${profBonus})` : '';
            mecanicas.push(`${m.nombre} TS ${atributoLabel}: ${detalleD}+${totalMod}${compLabel}=${total} vs CD ${cdSalv} → ${exitoSalv ? '✓ resiste' : '✗ falla'}.`);

            if (!exitoSalv) {
              // 🎲 1d3 INDIVIDUAL para Desesperanza; 1 fijo para Decisiones.
              const sombraValor = isDesesperanza
                ? (Math.floor(Math.random() * 3) + 1)
                : 1;
              try {
                await api.patch(`/characters/${m.id}/shadow`, { shadow_change: sombraValor });
                setCharacters(prev => prev.map(c => c.id === m.id ? { ...c, puntos_sombra: (c.puntos_sombra || 0) + sombraValor } : c));
              } catch (e) { console.error('Shadow update fail:', e); }
              mecanicas.push(`  → ${m.nombre} recibe ${sombraValor} punto${sombraValor === 1 ? '' : 's'} de Sombra.`);
              toast(`${m.nombre}: +${sombraValor} Sombra.`, { duration: 4000 });
            } else {
              toast(`${m.nombre} resiste la Sombra.`, { duration: 3000 });
            }
          }
        }

        // Atajo (ÉXITO): reducir 1 día / casillas
        if (eventoId === 'event_atajo' && exito) {
          // Avance simbólico: lo registramos y la bitácora muestra "-1 día".
          // (El motor de viaje no soporta saltos arbitrarios, así que se
          // refleja como narrativa + entrada en el log.)
          mecanicas.push('La compañía encuentra un atajo: -1 día.');
          toast('Atajo encontrado: -1 día de viaje.', { duration: 4000 });
        }

        // Percance (FALLO): aplicar +2 a la CD de fatiga en vivo.
        // Antes el comentario decía "ya se aplica vía journey events" pero en
        // la práctica el panel "CD fatiga" se quedaba en 10.0 hasta el final.
        // Aquí actualizamos `globalFatigaCD` y el `activeJourney` localmente
        // para que el HUD lo refleje al instante.
        if (eventoId === 'event_percance' && !exito) {
          const inc = 2;
          mecanicas.push(`Percance: +1 día y +${inc} a la CD de fatiga.`);
          setGlobalFatigaCD((prev) => (prev || 10) + inc);
          setFatigaCdBreakdown(prev => [...prev, {
            motivo: `Percance (${currentEvent?.evento?.nombre || 'evento'})`,
            delta: inc,
            dia: (activeJourney?.dia_actual || currentPosition + 1),
            casilla: currentPosition,
          }]);
          setActiveJourney((prev) => prev
            ? { ...prev, fatiga_cd_total: (prev.fatiga_cd_total || 10) + inc }
            : prev);
          // Persist on backend so it survives a refresh / re-open
          if (activeJourney?.id) {
            try {
              await api.patch(`/travel/journey/${activeJourney.id}/fatigue-cd`, null, {
                params: { delta: inc, reason: `Percance: ${currentEvent?.evento?.nombre || 'evento'}` }
              });
            } catch (e) { /* non-fatal: HUD already updated */ }
          }
        }

        // Vista agradable (ÉXITO): Inspiración (flag visual)
        if (eventoId === 'event_vista' && exito) {
          mecanicas.push('Toda la compañía obtiene Inspiración.');
          toast('✨ Inspiración para toda la compañía.', { duration: 4000 });
        }
      } catch (mechErr) {
        console.error('Error aplicando mecánicas del evento:', mechErr);
      }

      // Bitácora: anota la entrada de evento del día (con mecánicas)
      const diaEvento = (currentEvent.casilla || 1);
      setDailySummaries(prev => [...prev, {
        dia: diaEvento,
        casilla: currentEvent.casilla,
        tipo: 'evento',
        success: exito,
        eventName: currentEvent.evento?.nombre,
        clima: eventWeather,
        narrativa: narrativa,
        mecanicas: mecanicas,
        message: `Día ${diaEvento}: ¡${currentEvent.evento?.nombre || 'Acontecimiento'}! ${targetMember?.nombre || 'El grupo'} tira ${tirada} vs CD ${cd} → ${exito ? 'éxito' : 'fracaso'}.${mecanicas.length ? ' ' + mecanicas.join(' ') : ''}`,
      }]);

      // In the new orientation system, after resolving an event we continue journey
      // No longer looking for "next unresolved" since events are generated one by one
      setCurrentEvent(null);
      
      // Continue with next orientation check - pass updated events explicitly
      // because React state may not be updated yet due to batching
      await continueAfterEvent(updatedEvents);
      
    } catch (err) {
      console.error('Error resolving event:', err);
      toast.error('Error al resolver acontecimiento');
    } finally {
      setResolvingEvent(false);
    }
  };
  
  // =============== VIAJE GLOBAL (automated end-to-end journey) ===============
  // Bucle independiente que NO depende del estado de React entre iteraciones:
  // tira orientación → calcula posición de evento → genera evento → resuelve →
  // acumula localmente → al final sincroniza estado y muestra resultados.
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const automateJourney = async () => {
    if (autoRunning) {
      autoStopRef.current = true;
      return;
    }
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    const guia = config.miembros.find(m => m.papeles?.includes('guia'));
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

    // Estado local que vive sólo dentro del bucle
    let localPos = 0;
    const localEvents = [];
    const localOrientationChecks = [];
    const localCharacterXP = { ...characterXP }; // copia para acumular
    const localSummaries = [...dailySummaries];
    const guiaTieneMultiplesRoles = guia.papeles && guia.papeles.length > 1;

    // Asegúrate de que la página esté en modo "global" para que el overlay
    // lo cubra todo (header se mantiene por z-index).
    if (modeRef.current === 'config') {
      setEvents([]);
      setOrientationChecks([]);
      setCurrentPosition(0);
      setMode('global');
    }

    try {
      // Pre-tira el clima (Markov) si todavía no se hizo
      if (!journeyWeather || journeyWeather.length === 0) {
        try {
          const numDays = Math.max(1, Math.ceil(journeyCalc?.estimaciones?.dias_estimados || totalCasillas));
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
        }
      }

      let safetyIter = 0;
      const safetyMax = totalCasillas + 20;

      while (localPos < totalCasillas && !autoStopRef.current && safetyIter < safetyMax) {
        safetyIter++;

        const casillasRestantes = totalCasillas - localPos;

        // 1) TIRADA DE ORIENTACIÓN ───────────────────────────────────────────
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

        // PX del Guía por la orientación
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

        // Bitácora: orientación
        const diaOri = localPos + 1;
        localSummaries.push({
          dia: diaOri,
          casilla: localPos,
          tipo: 'orientacion',
          success: exitoOri,
          message: `${guia.nombre} estudia el horizonte: tirada ${oData.total} vs CD 15 → ${exitoOri ? 'éxito' : 'fracaso'}. ${oData.detalle || ''}`,
          clima: (journeyWeather || [])[Math.min(localPos, (journeyWeather || []).length - 1)] || null,
        });

        // 2) ¿VIAJE COMPLETADO? ──────────────────────────────────────────────
        if (oData.viaje_completado) {
          localPos = totalCasillas;
          setCurrentPosition(totalCasillas);
          setAutoProgress(100);
          setAutoMessage('¡Destino alcanzado!');
          setAutoSubtitle(oData.detalle || 'La compañía completa el viaje sin más eventos.');
          await sleep(800);
          break;
        }

        // 3) POSICIÓN DEL PRÓXIMO EVENTO ─────────────────────────────────────
        const casillasHasta = Math.max(1, oData.casillas_hasta_evento || 1);
        const eventPos = Math.min(localPos + casillasHasta, totalCasillas);

        // Bitácora: días intermedios sin incidentes
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

        // 4) GENERAR EVENTO EN ESA POSICIÓN ──────────────────────────────────
        setAutoMessage('Generando acontecimiento');
        setAutoSubtitle(`Casilla ${eventPos}`);
        let evData;
        try {
          const evRes = await api.post('/travel/generate-event', null, {
            params: { tipo_tierra: tipoTierra, terreno, estacion: config.estacion },
          });
          evData = evRes.data;
          if (!evData?.success) throw new Error('event failed');
        } catch (e) {
          console.error('Error generando evento (auto):', e);
          // Avanza igualmente para no atascarse
          localPos = eventPos;
          setCurrentPosition(localPos);
          setAutoProgress(Math.min(99, Math.round((localPos / totalCasillas) * 100)));
          continue;
        }

        // 5) AUTO-RESOLVER EVENTO ───────────────────────────────────────────
        const targetRole = evData.objetivo?.papel;
        const { modifier: evMod, member: targetMember } = getRoleModifier(targetRole);
        const d20 = Math.floor(Math.random() * 20) + 1;
        const tirada = d20 + evMod;
        // Aplica el clima del día concreto al CD del evento.
        const wDayPre = (journeyWeather || [])[Math.min(eventPos - 1, (journeyWeather || []).length - 1)] || null;
        const climaLabelPre = (wDayPre?.estado_label || '').toLowerCase();
        const climaExtremoPre = ['tormenta','vendaval','nieve fuerte','extremo','helada','ventisca','niebla densa']
          .some(k => climaLabelPre.includes(k));
        const climaFavPre = ['despejado','soleado','templado','suave','agradable']
          .some(k => climaLabelPre.includes(k));
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

        // PX del personaje por el evento
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

        // Narrativa IA (best-effort; no bloqueante)
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
        } catch { /* narrativa es opcional */ }

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

        // Bitácora: entrada de evento
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

        // 6) AVANZA POSICIÓN ────────────────────────────────────────────────
        localPos = eventPos;
        setCurrentPosition(localPos);
        setAutoProgress(Math.min(99, Math.round((localPos / totalCasillas) * 100)));

        // Pequeña pausa para que el usuario perciba avance del overlay
        await sleep(180);
      }

      // ── Sincroniza estado al terminar ─────────────────────────────────────
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
  };
  
  // =============== DAY BY DAY FUNCTIONS ===============
  
  const advanceDay = async () => {
    if (!activeJourney) return;

    try {
      // Una marcha forzada se mantiene activa desde que se activa hasta el
      // siguiente evento/orientación (o se apaga tras 1 día si el DJ marcó
      // el checkbox "solo un día"). Si el toggle del día dice true, fuerza
      // la marcha aunque no estuviera activa antes.
      const esMarchaForzadaHoy = !!currentDayConfig.marchaForzada || forcedMarchActive;

      const res = await api.post(`/travel/journey/${activeJourney.id}/advance-day`, null, {
        params: {
          ritmo: currentDayConfig.ritmo,
          marcha_forzada_horas: esMarchaForzadaHoy ? 8 : 0,
        },
      });

      if (res.data.success) {
        setActiveJourney(res.data.journey);

        // Consumo diario — base por ritmo + EXTRA si hay marcha forzada.
        //   Reglas Abr 2026: MF añade +50% comida y x3 agua respecto al ritmo
        //   base del viaje. Este extra se aplica POR ENCIMA del consumo del hook.
        consumeDailyProvisions();
        if (esMarchaForzadaHoy) applyForcedMarchExtraConsumption();

        // ⚡ Salvación CD 15 de fatiga por cada día de marcha forzada.
        if (esMarchaForzadaHoy) {
          await applyForcedMarchSaves(res.data.journey?.dia_actual || activeJourney.dia_actual);
        }

        // Gestión de la persistencia del estado de marcha forzada:
        //   • Si hoy se activó y el DJ marcó "solo un día" → la apagamos.
        //   • Si hoy se activó y NO marcó "solo un día"   → persiste hasta el próximo evento.
        //   • Si ya estaba persistiendo, sigue activa.
        if (currentDayConfig.marchaForzada) {
          if (currentDayConfig.marchaForzadaSoloUnDia) {
            setForcedMarchActive(false);
          } else {
            setForcedMarchActive(true);
          }
        }
        // Reset del toggle del día tras aplicarlo (si no es persistente el
        // DJ puede volver a marcarlo mañana). Mantiene la UI limpia.
        setCurrentDayConfig(prev => ({
          ...prev,
          marchaForzada: false,
          marchaForzadaSoloUnDia: false,
        }));

        // Check for event generation (simplified - every 2-3 days)
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
  };

  // `applyForcedMarchExtraConsumption` y `applyForcedMarchSaves` se obtienen
  // ahora del hook `useFatigueSystem` (arriba). Se conservan sus call sites
  // con el mismo nombre — no hay cambio semántico.

  const generateDayEvent = async () => {
    try {
      const res = await api.post('/travel/generate-event', null, {
        params: {
          tipo_tierra: journeyCalc?.ruta?.tipo_tierra || 'tierras_salvajes',
          terreno: journeyCalc?.ruta?.terreno || 'campo_abierto',
          estacion: config.estacion
        }
      });
      
      if (res.data.success) {
        const newEvent = {
          ...res.data,
          casilla: activeJourney?.casillas_recorridas || 0,
          resuelto: false
        };
        setCurrentEvent(newEvent);
        setEvents(prev => [...prev, newEvent]);
        // Un evento corta la persistencia de la marcha forzada (RAW Abr 2026).
        if (forcedMarchActive) {
          setForcedMarchActive(false);
          toast.info('⚡ Marcha forzada interrumpida — ha surgido un evento.');
        }
      }
    } catch (err) {
      console.error('Error generating event:', err);
    }
  };
  
  const finishDayByDayJourney = async () => {
    try {
      const res = await api.post(`/travel/journey/${activeJourney.id}/complete`);
      if (res.data.success) {
        await calculateFatigueResults(events);
        setMode('results');
      }
    } catch (err) {
      console.error('Error finishing journey:', err);
    }
  };
  
  // =============== FATIGUE CALCULATION ===============

  // getFatigueBaseCD is imported from travelHelpers.

  const calculateFatigueResults = async (resolvedEvents) => {
    const results = [];
    
    // CD base por terreno del viaje actual
    const terrenoViaje = journeyCalc?.ruta?.terreno || 'moderado';
    let fatigueCd = getFatigueBaseCD(terrenoViaje);
    
    // Sumar modificadores acumulados de los eventos (terrible desgracia +3, desesperanza +2, etc.)
    resolvedEvents.forEach(e => {
      if (e.resultado?.modificadores?.fatiga_cd_increase) {
        fatigueCd += e.resultado.modificadores.fatiga_cd_increase;
      } else if (e.evento?.fatigue_cd_increase) {
        // Algunos eventos guardan el modificador directamente en el objeto evento
        fatigueCd += e.evento.fatigue_cd_increase;
      }
    });
    
    // Tirada individual de CON por CADA viajero (los con papel + los
    // acompañantes). Todos atraviesan el mismo terreno y sufren la misma
    // fatiga; los acompañantes simplemente no tienen papel asignado.
    const todosLosViajeros = [
      ...config.miembros,
      ...((config.acompanantes || []).map(a => ({ ...a, papeles: a.papeles || [] }))),
    ];
    for (const member of todosLosViajeros) {
      const char = characters.find(c => c.id === member.id);
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
            penalizacion_multiples_papeles: tieneMultiplesPapeles
          }
        });
        
        // Aplicar el nivel al personaje en BD y en estado local
        const nivelesGanados = res.data.niveles_cansancio || 0;
        if (nivelesGanados > 0) {
          const fatigaActual = Number(char.fatiga || 0);
          const nuevaFatiga = Math.min(6, fatigaActual + nivelesGanados);
          try {
            await api.put(`/characters/${member.id}/fatigue`, { fatiga: nuevaFatiga });
            setCharacters(prev => prev.map(c => c.id === member.id ? { ...c, fatiga: nuevaFatiga } : c));
          } catch (e) {
            console.error('Error aplicando fatiga al personaje:', e);
          }
        }
        
        results.push({
          personaje: member.nombre,
          papel: member.papeles?.length ? member.papeles.join(', ') : 'Acompañante',
          cd_base: getFatigueBaseCD(terrenoViaje),
          ...res.data
        });
      } catch (err) {
        console.error('Error calculating fatigue:', err);
      }
    }
    
    setFatigueResults(results);
  };
  
  // =============== MEMBER MANAGEMENT ===============

  const addMember = (charId) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    
    if (config.miembros.some(m => m.id === charId)) {
      toast.error('Este personaje ya está en el grupo');
      return;
    }
    
    // Get character's owned mount (if any)
    const monturaPropia = char.montura ? {
      nombre: char.montura.nombre,
      capacidad: char.montura.capacidad_carga,
      velocidad: char.montura.velocidad || 18,
      constitucion: char.montura.constitucion
    } : null;
    
    // Character base speed in METERS
    const velocidadBase = char.velocidad || 9;
    
    // Calculate skill modifiers for travel roles using correct skill names
    const nivel = char.nivel || 1;
    const bonusCompetencia = calcBonusCompetencia(nivel);
    
    // Use calcModHabilidad with correct skill names
    const modViajar = calcModHabilidad(char, 'Viajar');
    const modCaza = calcModHabilidad(char, 'Cazar');
    const modPercepcion = calcModHabilidad(char, 'Percepción');
    const modExplorar = calcModHabilidad(char, 'Explorar');
    
    setConfig(prev => ({
      ...prev,
      miembros: [...prev.miembros, {
        id: char.id,
        nombre: char.nombre,
        raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
        papeles: [],
        tieneMontura: false,
        monturaNombre: null,
        monturaConBonus: 0,
        monturaPropia: monturaPropia,
        velocidadBase: velocidadBase,
        // Skill modifiers (already include competencia + pericia)
        modViajar: modViajar,
        modCaza: modCaza,
        modPercepcion: modPercepcion,
        modExplorar: modExplorar,
        // For backwards compatibility
        modSabiduria: getModAtributo(char, 'sabiduria'),
        modDestreza: getModAtributo(char, 'destreza'),
        percepcionPasiva: 10 + modPercepcion,
        // Proficiencies (for reference)
        competencias: char.habilidades_competencia || char.habilidades || [],
        pericias: char.pericia_elegida || [],
        competenciaViajar: tieneCompetenciaEn(char, 'Viajar'),
        periciaViajar: tienePericia(char, 'Viajar'),
        competenciaCartografia: tieneCompetenciaEn(char, 'cartograf'),
        // Level and bonus
        nivel: nivel,
        bonusCompetencia: bonusCompetencia
      }]
    }));
  };
  
  const addMemberWithRole = (charId, role) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    
    // Check if character is already in the group
    const existingMember = config.miembros.find(m => m.id === charId);
    
    // Get character's owned mount (if any)
    const monturaPropia = char.montura ? {
      nombre: char.montura.nombre,
      capacidad: char.montura.capacidad_carga,
      velocidad: char.montura.velocidad || 18,
      constitucion: char.montura.constitucion
    } : null;
    
    // Character base speed in METERS
    const velocidadBase = char.velocidad || 9;
    
    if (existingMember) {
      // Add role to existing member (allow multiple roles)
      setConfig(prev => ({
        ...prev,
        miembros: prev.miembros.map(m => {
          if (m.id === charId) {
            if (m.papeles.length >= MAX_ROLES_PER_CHARACTER && !m.papeles.includes(role)) {
              toast.error(`Máximo ${MAX_ROLES_PER_CHARACTER} papeles por personaje`);
              return m;
            }
            const newPapeles = m.papeles.includes(role) 
              ? m.papeles 
              : [...m.papeles, role];
            return { ...m, papeles: newPapeles };
          }
          return m;
        })
      }));
    } else {
      // Calculate skill modifiers for travel roles
      const nivel = char.nivel || 1;
      const bonusCompetencia = calcBonusCompetencia(nivel);
      
      // Use calcModHabilidad with correct skill names (no second parameter)
      const modViajar = calcModHabilidad(char, 'Viajar');
      const modCaza = calcModHabilidad(char, 'Cazar');
      const modPercepcion = calcModHabilidad(char, 'Percepción');
      const modExplorar = calcModHabilidad(char, 'Explorar');
      
      // Add new member with role
      setConfig(prev => ({
        ...prev,
        miembros: [...prev.miembros, {
          id: char.id,
          nombre: char.nombre,
          raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
          papeles: [role],
          tieneMontura: false,
          monturaNombre: null,
          monturaConBonus: 0,
          monturaPropia: monturaPropia,
          velocidadBase: velocidadBase,
          // Skill modifiers (already include competencia + pericia)
          modViajar: modViajar,
          modCaza: modCaza,
          modPercepcion: modPercepcion,
          modExplorar: modExplorar,
          // For backwards compatibility
          modSabiduria: getModAtributo(char, 'sabiduria'),
          modDestreza: getModAtributo(char, 'destreza'),
          percepcionPasiva: 10 + modPercepcion,
          // Proficiencies
          competencias: char.habilidades_competencia || char.habilidades || [],
          pericias: char.pericia_elegida || [],
          competenciaViajar: tieneCompetenciaEn(char, 'Viajar'),
          periciaViajar: tienePericia(char, 'Viajar'),
          competenciaCartografia: tieneCompetenciaEn(char, 'cartograf'),
          // Level and bonus
          nivel: nivel,
          bonusCompetencia: bonusCompetencia
        }]
      }));
    }
  };
  
  const removeMember = (charId) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.filter(m => m.id !== charId)
    }));
  };
  
  // Remove a specific role from a member
  const removeRoleFromMember = (charId, role) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => 
        m.id === charId 
          ? { ...m, papeles: m.papeles.filter(p => p !== role) }
          : m
      )
    }));
  };
  
  // Toggle a role on/off for a member
  const toggleMemberRole = (charId, role) => {
    const member = config.miembros.find(m => m.id === charId);
    if (member && member.papeles.length >= MAX_ROLES_PER_CHARACTER && !member.papeles.includes(role)) {
      toast.error(`Máximo ${MAX_ROLES_PER_CHARACTER} papeles por personaje`);
      return;
    }
    
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => {
        if (m.id !== charId) return m;
        const hasPapel = m.papeles.includes(role);
        return {
          ...m,
          papeles: hasPapel 
            ? m.papeles.filter(p => p !== role)
            : [...m.papeles, role]
        };
      })
    }));
  };
  
  const updateMemberRole = (charId, role) => {
    // Legacy - just adds a role now
    if (!role) return;
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => {
        if (m.id !== charId) return m;
        if (m.papeles.includes(role)) return m;
        return { ...m, papeles: [...m.papeles, role] };
      })
    }));
  };
  
  const updateMemberMount = (charId, useMount) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => {
        if (m.id !== charId) return m;
        
        if (useMount && m.monturaPropia) {
          // Use owned mount. constitucion puede venir como string ("13" o "13 (+1)") o como número.
          const consRaw = m.monturaPropia.constitucion;
          let modCon = 0;
          if (typeof m.monturaPropia.constitucion_mod === 'number') {
            modCon = m.monturaPropia.constitucion_mod;
          } else if (typeof consRaw === 'string') {
            const m2 = consRaw.match(/[+-]?\d+/);
            modCon = m2 ? parseInt(m2[0], 10) : 0;
          } else if (typeof consRaw === 'number') {
            modCon = Math.floor((consRaw - 10) / 2);
          }
          return {
            ...m,
            tieneMontura: true,
            monturaNombre: m.monturaPropia.nombre,
            monturaConBonus: modCon
          };
        } else {
          // Walking
          return {
            ...m,
            tieneMontura: false,
            monturaNombre: null,
            monturaConBonus: 0
          };
        }
      })
    }));
  };

  // =============== COMPANIONS / ACOMPAÑANTES ===============
  // Pasajeros del viaje sin papel asignado.
  // Sí cuentan para velocidad y provisiones; NO hacen tiradas de eventos.
  const MAX_ACOMPANANTES = 10;

  const addAcompanante = (charId) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    if (config.miembros.some(m => m.id === charId)) {
      toast.error('Este personaje ya tiene un papel de viaje asignado.');
      return;
    }
    if ((config.acompanantes || []).some(a => a.id === charId)) {
      toast.error('Este personaje ya está como acompañante.');
      return;
    }
    if ((config.acompanantes || []).length >= MAX_ACOMPANANTES) {
      toast.error(`Máximo ${MAX_ACOMPANANTES} acompañantes.`);
      return;
    }

    const monturaPropia = char.montura ? {
      nombre: char.montura.nombre,
      capacidad: char.montura.capacidad_carga,
      velocidad: char.montura.velocidad || 18,
      constitucion: char.montura.constitucion
    } : null;

    setConfig(prev => ({
      ...prev,
      acompanantes: [
        ...(prev.acompanantes || []),
        {
          id: char.id,
          nombre: char.nombre,
          raza: char.cultura_nombre || char.cultura || char.raza || 'Desconocida',
          velocidadBase: char.velocidad || 9,
          monturaPropia,
          // Si tiene montura propia, por defecto la usa
          tieneMontura: !!monturaPropia,
          monturaNombre: monturaPropia?.nombre || null,
          modSabiduria: getModAtributo(char, 'sabiduria'),
        }
      ]
    }));
  };

  const removeAcompanante = (charId) => {
    setConfig(prev => ({
      ...prev,
      acompanantes: (prev.acompanantes || []).filter(a => a.id !== charId)
    }));
  };

  const toggleAcompananteMount = (charId, useMount) => {
    setConfig(prev => ({
      ...prev,
      acompanantes: (prev.acompanantes || []).map(a => {
        if (a.id !== charId) return a;
        if (useMount && a.monturaPropia) {
          return { ...a, tieneMontura: true, monturaNombre: a.monturaPropia.nombre };
        }
        return { ...a, tieneMontura: false, monturaNombre: null };
      })
    }));
  };

  // =============== RESET ===============
  
  const resetJourney = () => {
    setMode('config');
    setEvents([]);
    setCurrentEvent(null);
    setActiveJourney(null);
    setFatigueResults([]);
    setJourneyCalc(null);
    setPxApplied(false);
    setPxResults(null);
    setJourneyNarrative(null);
    setSavedMapImage(null); // Reset saved map image on new journey
    setDailySummaries([]); // Reset chronicle
  };
  
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
  
  // =============== JOURNEY NARRATIVE & PDF ===============
  
  const generateJourneyNarrative = async () => {
    setGeneratingNarrative(true);
    try {
      const res = await api.post('/travel/generate-journey-summary', {
        origen: config.origenNombre,
        destino: config.destinoNombre,
        dias: journeyCalc?.estimaciones?.dias_estimados || 1,
        // Pasamos el clima REAL del día de cada evento + la narrativa
        // individual ya generada para que la crónica final encaje con cada
        // entrada en lugar de inventar tiempo de paso.
        eventos: events.map(e => ({
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
        // Resumen del clima día a día por si la IA lo necesita.
        clima_por_dia: (journeyWeather || []).map((w, i) => ({
          dia: i + 1,
          estado: w?.estado_label || '',
          region: w?.region || '',
        })),
        personajes: config.miembros.map(m => ({
          nombre: m.nombre,
          papel: m.papeles?.[0] || 'viajero'
        })),
        px_total: journeyCalc?.estimaciones?.px_total || 0,
        terrenos: journeyCalc?.ruta?.terrain_summary,
        // Heridos graves: personajes que cayeron a 0 PG durante el viaje.
        // Detectados a partir del estado actual de characters (los eventos
        // tipo Terrible Desgracia ya aplicaron el daño vía PATCH /hp).
        heridos: (() => {
          const lista = [];
          const todos = [
            ...(config.miembros || []),
            ...((config.acompanantes || []).map(a => ({ ...a, _esAcompanante: true }))),
          ];
          for (const m of todos) {
            const ch = characters.find(c => c.id === m.id);
            if (!ch) continue;
            const pg = Number(ch.puntos_golpe_actual ?? ch.puntos_golpe_max ?? 0);
            const pgMax = Number(ch.puntos_golpe_max ?? 0);
            if (pgMax > 0 && pg <= 0) {
              // Busca el evento "Terrible Desgracia" en el que cayó (si lo hay)
              const eventoCaida = events.find(e => e.evento?.id === 'event_terrible' && !e.exito);
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
  };
  
  
  // =============== PRINT JOURNEY DOCUMENT ===============

  const printJourneyDocument = () => printJourneyDocumentHelper({
    config, journeyCalc, events, orientationChecks,
    currentPosition, nextEventPosition,
    savedMapImage, mapContainerRef,
    characterXP, journeyNarrative, journeyChronicle, includeChronicleInPDF,
    fatigueResults
  });

  // Helper: persistir el consumo de provisiones al inventario de cada viajero.
  // Reparte el consumo total uniformemente entre miembros + acompañantes.
  // Reduce raciones (incl. packs) y vacía los odres del inventario.
  const persistProvisionsToInventory = useCallback(async () => {
    const todosViajeros = [
      ...config.miembros.filter(m => m.papeles?.length > 0),
      ...((config.acompanantes || [])),
    ];
    if (todosViajeros.length === 0) return { ok: 0, fail: 0 };

    const racionesPorViajero = Math.ceil(
      (partyProvisions.comidaConsumida || 0) / todosViajeros.length
    );
    const gramosPorViajero = racionesPorViajero * 500; // 1 ración = 0.5 kg de comida
    const litrosPorViajero = Math.ceil(
      (partyProvisions.aguaConsumida || 0) / todosViajeros.length
    );

    let ok = 0;
    let fail = 0;

    for (const m of todosViajeros) {
      const char = characters.find((c) => c.id === m.id);
      if (!char || !char.inventario) continue;

      // 1) Restar comida PROPORCIONALMENTE a la masa de cada consumible.
      //    Se reparte `gramosPorViajero` entre todos los food items.
      const { inventario: afterFood } = consumeProportionalFood(
        char.inventario,
        gramosPorViajero
      );
      const newInventario = JSON.parse(JSON.stringify(afterFood));

      // 2) Vaciar odres por orden (uno se vacía a la vez)
      let litrosPorRestar = litrosPorViajero;
      for (const item of newInventario) {
        if (litrosPorRestar <= 0) break;
        if (!item || !item.nombre) continue;
        const n = (item.nombre || '').toLowerCase();
        if (!n.includes('odre')) continue;
        // capacidad: si tiene "lleno" o "(N L)" → 10 L por defecto
        const litrosActuales = item.litros_actuales != null
          ? Number(item.litros_actuales)
          : 10;
        const cantidad = Number(item.cantidad || 1);
        // Vaciar uno a uno
        let restantes = cantidad;
        let litrosThisItem = litrosActuales;
        const odresVaciados = [];
        while (restantes > 0 && litrosPorRestar > 0) {
          const take = Math.min(litrosThisItem, litrosPorRestar);
          litrosThisItem -= take;
          litrosPorRestar -= take;
          if (litrosThisItem <= 0) {
            odresVaciados.push(1);
            litrosThisItem = litrosActuales; // siguiente odre lleno
            restantes -= 1;
          }
        }
        // Aplicar cambios: cantidad de odres vaciados → conviértelos a "Odre vacío"
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
        // Si todavía hay litros parciales en el último odre activo, anotarlos
        if (restantes > 0 && litrosThisItem !== litrosActuales) {
          // Renombrar el item: actualizar litros_actuales para los que queden
          // Best-effort: si había varios odres en el item, separamos uno parcial.
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

      // 3) Limpiar items con cantidad 0
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

  // =============== APPLY PX TO CHARACTERS ===============
  
  const applyPXToCharacters = async () => {
    // PX BASE del viaje se reparten entre TODOS los viajeros (con papel +
    // acompañantes). Las PX por TIRADAS sólo las ganan quienes tiraron.
    const allTravellers = [
      ...config.miembros,
      ...((config.acompanantes || []).map(a => ({ ...a, papeles: a.papeles || [] }))),
    ];
    if (allTravellers.length === 0) {
      toast.error('No hay viajeros');
      return;
    }
    
    // Calculate base journey PX divided equally among ALL travellers
    const journeyBasePX = journeyCalc?.estimaciones?.px_total || 0;
    const pxPerMemberFromJourney = Math.round(journeyBasePX / allTravellers.length);
    
    setApplyingPX(true);
    
    try {
      // Calcular multiplicador global por grupo (Tabla 2)
      const allRolls = Object.values(characterXP).flatMap(c => c.rolls || []);
      const aciertos = allRolls.filter(r => r.exito).length;
      const fallos = allRolls.length - aciertos;
      const groupMult = calculateGroupMultiplier(aciertos, fallos);
      
      // Build array of {character_id, px_amount} for ALL travellers.
      // Acompañantes reciben sólo PX viaje (no tiraron, así que PX rolls = 0).
      const characterPXList = allTravellers.map(m => {
        const rollsXP = characterXP[m.id]?.total || 0;
        const rollsXPAjustado = Math.floor(rollsXP * groupMult.multiplicador);
        const totalXP = Math.max(0, pxPerMemberFromJourney + rollsXPAjustado);
        return {
          character_id: m.id,
          character_name: m.nombre,
          px_amount: totalXP,
          px_journey: pxPerMemberFromJourney,
          px_rolls: rollsXPAjustado
        };
      });
      
      const response = await api.post('/travel/apply-px-individual', {
        characters: characterPXList,
        journey_id: activeJourney?.id || null,
        journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`
      });
      
      if (response.data.success) {
        setPxApplied(true);
        setPxResults(response.data);
        toast.success(`¡PX aplicados a ${response.data.exitosos} personajes!`);
        // Persist provisions consumption to each character's inventory.
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
      // Fallback to old method if new endpoint doesn't exist
      try {
        const totalRollsXP = Object.values(characterXP).reduce((sum, c) => sum + (c.total || 0), 0);
        const avgPX = Math.round((journeyBasePX + totalRollsXP) / allTravellers.length);
        const response = await api.post('/travel/apply-px', {
          character_ids: allTravellers.map(m => m.id),
          px_amount: avgPX,
          journey_id: activeJourney?.id || null,
          journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`
        });
        
        if (response.data.success) {
          setPxApplied(true);
          setPxResults(response.data);
          toast.success(`¡PX aplicados a ${response.data.exitosos} personajes!`);
        } else {
          toast.error(response.data.message || 'Error al aplicar PX');
        }
      } catch (fallbackErr) {
        toast.error('Error al aplicar PX a los personajes');
      }
    } finally {
      setApplyingPX(false);
    }
  };
  
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-white">
            <a href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Inicio
            </a>
          </Button>
          <h1 className="text-3xl font-heading text-[hsl(var(--gold))]">
            <Compass className="w-8 h-8 inline mr-3" />
            Generador de Viajes
          </h1>
        </div>
        {mode !== 'config' && (
          <Badge variant="outline" className="text-lg">
            {mode === 'global' ? 'Jornada a Jornada' : mode === 'dayByDay' ? 'Jornada a Jornada' : 'Resultados'}
          </Badge>
        )}
      </div>
      
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
      
      {/* Camp Dialog */}
      <CampDialog
        open={showCampDialog}
        onClose={() => setShowCampDialog(false)}
        miembros={config.miembros}
        acompanantes={config.acompanantes || []}
        characters={characters}
        activeJourney={activeJourney || (mode === 'global' ? { fatiga_cd_total: globalFatigaCD, config: { tipo_tierra: journeyCalc?.ruta?.tipo_tierra } } : null)}
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
        onForage={performForaging}
        desgloseVelocidades={journeyCalc?.velocidad_grupo?.desglose_velocidades || []}
        consecutiveCampDays={consecutiveCampDays}
        diasSinComida={diasSinComida}
        diasSinAgua={diasSinAgua}
        currentClima={
          (journeyWeather || [])[Math.min(currentPosition, (journeyWeather || []).length - 1)] || null
        }
        currentTerreno={journeyCalc?.ruta?.tipo_tierra || ''}
        onCampDayCompleted={() => setConsecutiveCampDays(d => d + 1)}
        onFatigueSave={(charId, save) => {
          setLastFatigueSaves(prev => ({ ...prev, [charId]: save }));
          // Append al log diario completo. Si la salvación trae los
          // motivos extra (clima/sombra/saveExtra) los conservamos para
          // que el DJ pueda ver la evolución.
          setFatigueSaveLog(prev => [
            ...prev,
            { id: charId, ...save },
          ]);
        }}
        onFatigueChange={(charId, delta) => {
          setFatigueChanges(prev => ({ ...prev, [charId]: { delta, casilla: currentPosition } }));
        }}
      />
      
      {/* Provisions Shop Dialog */}
      <ProvisionsShopDialog
        open={showProvisionsShop}
        onClose={() => setShowProvisionsShop(false)}
        miembros={config.miembros}
        acompanantes={config.acompanantes || []}
        characters={characters}
        diasViaje={journeyCalc?.estimaciones?.dias_estimados || activeJourney?.config?.dias_estimados || 7}
        origenRegionName={(locations || []).find(l => l.id === config.origenId)?.region || ''}
        terreno={journeyCalc?.ruta?.terreno || ''}
        tipoTierra={journeyCalc?.ruta?.tipo_tierra || ''}
        onPurchaseComplete={() => {
          // Reload characters to reflect new inventory/money
          api.get('/characters/').then(res => {
            if (res.data?.characters) setCharacters(res.data.characters);
          }).catch(err => console.error(err));
        }}
      />

      {/* Sauron's Eye overlay during automated journey */}
      <SauronEyeOverlay
        visible={autoRunning}
        percent={autoProgress}
        message={autoMessage}
        subtitle={autoSubtitle}
        onCancel={() => { autoStopRef.current = true; }}
      />

      {/* C-6: Map-based origin/destination picker */}
      <MapPickDialog
        open={!!mapPickFor}
        onClose={() => setMapPickFor(null)}
        target={mapPickFor || 'origen'}
        locations={locations}
        onPick={(loc) => {
          if (mapPickFor === 'origen') {
            setConfig(prev => ({
              ...prev,
              origenId: loc.id,
              origenNombre: loc.nombre,
              origenX: loc.custom ? loc.x : null,
              origenY: loc.custom ? loc.y : null,
            }));
            toast.success(`Origen: ${loc.nombre}`);
          } else if (mapPickFor === 'destino') {
            setConfig(prev => ({
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

