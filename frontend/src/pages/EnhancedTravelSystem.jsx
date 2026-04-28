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
import ResultsView from '@/components/travel/views/ResultsView';
import GlobalJourneyView from '@/components/travel/views/GlobalJourneyView';
import DayByDayView from '@/components/travel/views/DayByDayView';
import ConfigView from '@/components/travel/views/ConfigView';


const EnhancedTravelSystem = () => {
  // =============== STATE ===============
  
  // Mode: 'config' | 'global' | 'dayByDay' | 'results'
  const [mode, setMode] = useState('config');
  const [travelMode, setTravelMode] = useState('global'); // 'global' or 'dayByDay'
  
  // Data from API
  const [locations, setLocations] = useState([]);
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
    evitarSombra: false,
    evitarTierrasOscuras: false,
    preferirCaminos: true,
    ritmo: 'normal',
    mes: 'Cermië',
    diaMes: 1,
    estacion: 'verano',
    horasMarchaForzada: 0,
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
    marchaForzada: 0
  });
  
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
  const [foodWaterItems, setFoodWaterItems] = useState({ food_items: [], water_items: [] });
  const [provisionsCheck, setProvisionsCheck] = useState(null); // Result of provisions check
  const [showProvisionsWarning, setShowProvisionsWarning] = useState(false);
  // Party provisions tracking during journey
  const [partyProvisions, setPartyProvisions] = useState({
    comidaTotal: 0, // Total food rations available
    aguaTotal: 0,   // Total liters of water
    comidaConsumida: 0,
    aguaConsumida: 0
  });
  // Fatigue from lack of provisions
  const [provisionFatigue, setProvisionFatigue] = useState({}); // { charId: { sinComida: days, sinAgua: days } }
  
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
  const [globalFatigaCD, setGlobalFatigaCD] = useState(10);
  // Última tirada de salvación contra cansancio (panel del grupo).
  // Forma: { [charId]: { d20, mod, total, cd, exito } }
  const [lastFatigueSaves, setLastFatigueSaves] = useState({});
  // Último cambio de fatiga registrado por personaje (para mostrar +1/-1 en el panel).
  // Forma: { [charId]: { delta: number, casilla: number } }
  const [fatigueChanges, setFatigueChanges] = useState({});

  // Contador de días consecutivos en campamento (sin marcha entre medias).
  // La salvación contra cansancio se OMITE en la 2.ª acampada consecutiva.
  const [consecutiveCampDays, setConsecutiveCampDays] = useState(0);
  // Días consecutivos sin comida/agua a nivel grupo (suben la CD).
  const [diasSinComida, setDiasSinComida] = useState(0);
  const [diasSinAgua, setDiasSinAgua] = useState(0);
  // Weather rolled for the entire journey at startGlobalJourney (Markov chain)
  const [journeyWeather, setJourneyWeather] = useState([]);
  const autoStopRef = useRef(false);
  
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
        evitar_sombra: config.evitarSombra,
        evitar_tierras_oscuras: config.evitarTierrasOscuras,
        preferir_caminos: config.preferirCaminos,
        ritmo: config.ritmo,
        mes: config.mes,
        estacion: config.estacion,
        horas_marcha_forzada: config.horasMarchaForzada,
        miembros: todosViajeros.map(m => {
          // Enriquecer con estorbo y bandera de montura cargando equipo
          // a partir de la ficha del personaje (persistido por la
          // WeightEncumbranceCard de la ficha).
          const char = characters.find(c => c.id === m.id);
          const estorbo = Number(char?.estorbo_metros ?? 0);
          const monturaCarga = !!char?.montura?.transporta_equipo;
          return {
            personaje_id: m.id,
            nombre: m.nombre,
            papel: m.papel,
            tiene_montura: m.tieneMontura,
            montura_nombre: m.monturaNombre,
            montura_velocidad: m.tieneMontura && m.monturaPropia ? (m.monturaPropia.velocidad || 60) : 0,
            montura_con_bonus: m.monturaConBonus || 0,
            velocidad_base: m.velocidadBase || 9,
            modificador_sabiduria: m.modSabiduria || 0,
            competencias: m.competencias || [],
            nivel: m.nivel || 1,
            estorbo_metros: estorbo,
            montura_carga_equipo: monturaCarga,
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
  }, [config.origenId, config.destinoId, calculateJourney]);
  
  // =============== PROVISIONS CHECK ===============
  // Check if party has enough food and water for the journey
  const checkProvisionsForJourney = useCallback((diasViaje) => {
    if (!config.miembros.length || !diasViaje) return null;
    
    // Sólo cuentan los que viajan (con papel) + acompañantes; los miembros sin papel
    // están añadidos al grupo pero no parten de viaje, no consumen provisiones.
    const numPersonajes = config.miembros.filter(m => m.papeles?.length > 0).length + (config.acompanantes || []).length;

    // Requirements: 1 ration/day per person, 2L water/day per person
    const comidaNecesaria = numPersonajes * diasViaje; // in rations
    const aguaNecesaria = numPersonajes * diasViaje * 2; // in liters
    
    // Calculate total provisions from party inventory
    // This would need to check each character's inventory
    let comidaDisponible = 0;
    let aguaDisponible = 0;
    
    // For each viajero (miembros + acompañantes), check their character's inventory
    const todosViajeros = [...config.miembros.filter(m => m.papeles?.length > 0), ...(config.acompanantes || [])];
    todosViajeros.forEach(miembro => {
      const char = characters.find(c => c.id === miembro.id);
      if (!char?.inventario) return;
      // Detect rations (incl. packs) and odres in the character's inventory.
      const summary = summarizeProvisions(char.inventario);
      comidaDisponible += summary.raciones;
      aguaDisponible += summary.totalLitros;
    });
    
    return {
      comidaNecesaria,
      aguaNecesaria,
      comidaDisponible,
      aguaDisponible,
      comidaSuficiente: comidaDisponible >= comidaNecesaria,
      aguaSuficiente: aguaDisponible >= aguaNecesaria,
      diasComida: numPersonajes > 0 ? comidaDisponible / numPersonajes : 0,
      diasAgua: numPersonajes > 0 ? aguaDisponible / (numPersonajes * 2) : 0,
      faltaComida: Math.max(0, comidaNecesaria - comidaDisponible),
      faltaAgua: Math.max(0, aguaNecesaria - aguaDisponible)
    };
  }, [config.miembros, config.acompanantes, characters]);
  
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
      comidaInicial += summary.raciones;
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
          for (let d = currentPosition + 1; d < nuevaPosicionEvento; d++) {
            const dia = d + 1;
            const w = (journeyWeather || [])[Math.min(d, (journeyWeather || []).length - 1)];
            marchaEntries.push({
              dia,
              casilla: d,
              tipo: 'marcha',
              clima: w || null,
              marchaType: config.ritmo,
              message: `Día ${dia}: marcha ${config.ritmo} sin incidentes${w?.estado_label ? ` (${w.estado_label})` : ''}.`,
            });
          }
          if (marchaEntries.length > 0) {
            setDailySummaries(prev => [...prev, ...marchaEntries]);
          }

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
        const newEvent = {
          ...eventRes.data,
          casilla: posicion,
          resuelto: false,
          resultado: null,
          orientacion: orientationResult // Link to the orientation check
        };
        
        setEvents(prev => [...prev, newEvent]);
        setCurrentEvent(newEvent);
        setAwaitingOrientationCheck(false);
        
        toast.info(`¡Acontecimiento en la casilla ${posicion}! (${orientationResult.detalle})`);
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
  // Consume food and water for each party member, apply fatigue if supplies run out
  const consumeDailyProvisions = useCallback(() => {
    // Acompañantes consume the same as miembros
    const todosViajeros = [...config.miembros.filter(m => m.papeles?.length > 0), ...(config.acompanantes || [])];
    const numPersonajes = todosViajeros.length;
    const comidaConsumidaHoy = numPersonajes; // 1 ration per person
    const aguaConsumidaHoy = numPersonajes * 2; // 2L per person

    setPartyProvisions(prev => {
      const nuevaComidaDisponible = prev.comidaTotal - prev.comidaConsumida - comidaConsumidaHoy;
      const nuevaAguaDisponible = prev.aguaTotal - prev.aguaConsumida - aguaConsumidaHoy;
      
      // Track provision fatigue per character (only miembros con papel acumulan fatiga
      // efectiva en el sistema; los acompañantes pasan hambre pero no se gestionan).
      const newProvisionFatigue = { ...provisionFatigue };
      
      config.miembros.forEach(miembro => {
        if (!newProvisionFatigue[miembro.id]) {
          newProvisionFatigue[miembro.id] = { sinComida: 0, sinAgua: 0 };
        }
        
        // If no food available, increment days without food
        if (nuevaComidaDisponible < 0) {
          newProvisionFatigue[miembro.id].sinComida += 1;
        }
        
        // If no water available, increment days without water
        if (nuevaAguaDisponible < 0) {
          newProvisionFatigue[miembro.id].sinAgua += 1;
        }
      });
      
      setProvisionFatigue(newProvisionFatigue);
      
      // Show warnings if running low
      if (nuevaComidaDisponible < numPersonajes && nuevaComidaDisponible >= 0) {
        toast.warning(`¡Comida escasa! Queda para ${Math.floor(nuevaComidaDisponible / numPersonajes)} día(s).`);
      } else if (nuevaComidaDisponible < 0) {
        toast.error(`¡Sin comida! +1 nivel de fatiga para cada miembro.`);
      }
      
      if (nuevaAguaDisponible < numPersonajes * 2 && nuevaAguaDisponible >= 0) {
        toast.warning(`¡Agua escasa! Queda para ${Math.floor(nuevaAguaDisponible / (numPersonajes * 2))} día(s).`);
      } else if (nuevaAguaDisponible < 0) {
        toast.error(`¡Sin agua! +2 niveles de fatiga para cada miembro.`);
      }
      
      return {
        ...prev,
        comidaConsumida: prev.comidaConsumida + comidaConsumidaHoy,
        aguaConsumida: prev.aguaConsumida + aguaConsumidaHoy
      };
    });
  }, [config.miembros, config.acompanantes, provisionFatigue]);
  
  // Refill water near towns/rivers
  const refillWaterNearTown = useCallback((townName) => {
    const numPersonajes = config.miembros.filter(m => m.papeles?.length > 0).length + (config.acompanantes || []).length;
    const aguaNecesaria = numPersonajes * 2 * 3; // 3 days of water
    
    setPartyProvisions(prev => ({
      ...prev,
      aguaTotal: prev.aguaTotal + aguaNecesaria,
    }));
    
    toast.success(`Agua rellenada cerca de ${townName}. +${aguaNecesaria}L disponibles.`);
  }, [config.miembros]);
  
  // Foraging action - costs time, success depends on Survival check
  const performForaging = useCallback(async (characterId) => {
    const char = config.miembros.find(m => m.id === characterId);
    if (!char) return;
    
    // Roll d20 + Wisdom modifier + proficiency if applicable
    const d20 = Math.floor(Math.random() * 20) + 1;
    const modifier = char.modSabiduria || 0;
    const total = d20 + modifier;
    const cd = 15; // Survival DC for foraging
    const exito = total >= cd;
    
    if (exito) {
      // 2d4 raciones y 3d4 litros de agua según las reglas (texto del diálogo).
      const comidaEncontrada =
        (Math.floor(Math.random() * 4) + 1) + (Math.floor(Math.random() * 4) + 1);
      const aguaEncontrada =
        (Math.floor(Math.random() * 4) + 1) +
        (Math.floor(Math.random() * 4) + 1) +
        (Math.floor(Math.random() * 4) + 1);

      setPartyProvisions(prev => ({
        ...prev,
        comidaTotal: prev.comidaTotal + comidaEncontrada,
        aguaTotal: prev.aguaTotal + aguaEncontrada
      }));

      toast.success(`¡${char.nombre} encontró ${comidaEncontrada} raciones y ${aguaEncontrada}L de agua! (Tirada: ${total} vs CD ${cd})`);
    } else {
      toast.error(`${char.nombre} no encontró nada comestible. (Tirada: ${total} vs CD ${cd})`);
    }
    
    // Foraging takes time - add 1 to stage days
    setStageDays(prev => prev + 1);
    
    return { exito, tirada: total, cd };
  }, [config.miembros]);
  
  // =============== REST SYSTEM ===============

  // State for rest dialog
  const [showRestDialog, setShowRestDialog] = useState(false);
  const [selectedRestType, setSelectedRestType] = useState('long');
  const [restResults, setRestResults] = useState(null);
  
  // Perform rest action
  const performRest = useCallback(async (restType = 'long') => {
    const restConfig = REST_TYPES[restType];
    const results = [];
    
    for (const miembro of config.miembros) {
      const char = characters.find(c => c.id === miembro.id);
      if (!char) continue;
      
      let result = {
        nombre: miembro.nombre,
        tipoDescanso: restConfig.nombre,
        fatigaAntes: char.fatiga || 0,
        fatigaDespues: char.fatiga || 0,
        tirada: null,
        cd: null,
        exito: true
      };
      
      if (restType === 'sanctuary') {
        // Sanctuary rest removes all fatigue without roll
        result.fatigaDespues = 0;
        result.exito = true;
        
        // Update character fatigue in database
        try {
          await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: 0 });
          setCharacters(prev => prev.map(c => c.id === miembro.id ? { ...c, fatiga: 0 } : c));
        } catch (err) {
          console.error('Error updating fatigue:', err);
        }
      } else if (restType === 'long' && restConfig.requiereTiradaCON) {
        // Long rest requires CON check
        const modCON = char.atributos?.constitucion 
          ? Math.floor((char.atributos.constitucion - 10) / 2) 
          : 0;
        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + modCON;
        const cd = restConfig.cdBase + (provisionFatigue[miembro.id]?.sinComida || 0) + (provisionFatigue[miembro.id]?.sinAgua || 0) * 2;
        
        result.tirada = total;
        result.cd = cd;
        result.exito = total >= cd;

        // Registra la salvación en el panel del grupo.
        setLastFatigueSaves(prev => ({
          ...prev,
          [miembro.id]: { d20, mod: modCON, total, cd, exito: result.exito },
        }));
        
        if (result.exito) {
          result.fatigaDespues = Math.max(0, (char.fatiga || 0) - 1);
          try {
            await api.put(`/characters/${miembro.id}/fatigue`, { fatiga: result.fatigaDespues });
            setCharacters(prev => prev.map(c => c.id === miembro.id ? { ...c, fatiga: result.fatigaDespues } : c));
            setFatigueChanges(prev => ({
              ...prev,
              [miembro.id]: { delta: -1, casilla: currentPosition },
            }));
          } catch (err) {
            console.error('Error updating fatigue:', err);
          }
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
  
  // Calculate fatigue for current stage only
  const calculateStageFatigue = async () => {
    // Calculate CD based on stage events
    let cd = 10 + stageDays; // Base + days
    stageEvents.forEach(e => {
      if (!e.exito) cd += 2; // Failed events add to fatigue
    });
    
    // Apply marcha forzada if used
    if (config.horasMarchaForzada > 0) {
      cd += config.horasMarchaForzada * 2;
    }
    
    setStageFatigueDC(cd);
    // Note: Actual fatigue rolls happen in calculateFatigueResults
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
      comidaInicial += summary.raciones;
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
        evitar_sombra: config.evitarSombra,
        evitar_tierras_oscuras: config.evitarTierrasOscuras,
        preferir_caminos: config.preferirCaminos,
        ritmo: config.ritmo,
        mes: config.mes,
        estacion: config.estacion,
        horas_marcha_forzada: config.horasMarchaForzada,
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
  const getRoleModifier = (targetRole) => {
    const targetMember = config.miembros.find(m => m.papeles?.includes(targetRole));
    const roleInfo = ROLE_INFO[targetRole];
    if (!targetMember || !roleInfo) {
      return { modifier: 0, breakdown: [], member: null, roleInfo };
    }
    const key = ROLE_MODIFIER_KEY[targetRole];
    const baseMod = (key && typeof targetMember[key] === 'number') ? targetMember[key] : (targetMember.modSabiduria || 0);
    const hasMultipleRoles = targetMember.papeles?.length > 1;
    const modifier = baseMod + (hasMultipleRoles ? MULTI_ROLE_PENALTY : 0);
    const breakdown = [
      `${roleInfo.habilidad} (${roleInfo.atributo_nombre.slice(0, 3)}): ${baseMod >= 0 ? '+' : ''}${baseMod}`,
    ];
    if (hasMultipleRoles) breakdown.push(`Múltiples papeles: ${MULTI_ROLE_PENALTY}`);
    return { modifier, breakdown, member: targetMember, roleInfo };
  };

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

      // Bitácora: anota la entrada de evento del día
      const diaEvento = (currentEvent.casilla || 1);
      setDailySummaries(prev => [...prev, {
        dia: diaEvento,
        casilla: currentEvent.casilla,
        tipo: 'evento',
        success: exito,
        eventName: currentEvent.evento?.nombre,
        clima: eventWeather,
        narrativa: narrativa,
        message: `Día ${diaEvento}: ¡${currentEvent.evento?.nombre || 'Acontecimiento'}! ${targetMember?.nombre || 'El grupo'} tira ${tirada} vs CD ${cd} → ${exito ? 'éxito' : 'fracaso'}.`,
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
        const cd = evData.resolucion?.cd || 12;
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
      const res = await api.post(`/travel/journey/${activeJourney.id}/advance-day`, null, {
        params: {
          ritmo: currentDayConfig.ritmo,
          marcha_forzada_horas: currentDayConfig.marchaForzada
        }
      });
      
      if (res.data.success) {
        setActiveJourney(res.data.journey);
        
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
    
    // Tirada individual de CON por cada miembro (regla: fallo = +1 nivel exacto)
    for (const member of config.miembros) {
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
          papel: member.papeles?.join(', ') || '',
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
          // Use owned mount
          const modCon = parseInt(m.monturaPropia.constitucion?.match(/[+-]?\d+/)?.[1] || '0');
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
        terrenos: journeyCalc?.ruta?.terrain_summary
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
    const litrosPorViajero = Math.ceil(
      (partyProvisions.aguaConsumida || 0) / todosViajeros.length
    );

    let ok = 0;
    let fail = 0;

    for (const m of todosViajeros) {
      const char = characters.find((c) => c.id === m.id);
      if (!char || !char.inventario) continue;

      const newInventario = JSON.parse(JSON.stringify(char.inventario));

      // 1) Restar raciones
      let racionesPorRestar = racionesPorViajero;
      for (const item of newInventario) {
        if (racionesPorRestar <= 0) break;
        if (!item || !item.nombre) continue;
        const n = (item.nombre || '').toLowerCase();
        if (!n.includes('raci')) continue;
        const packMatch = n.match(/\((\d+)\s*raciones?\)/);
        const packSize = packMatch ? parseInt(packMatch[1], 10) : 1;
        const rEnEsteItem = (item.cantidad || 1) * packSize;
        if (rEnEsteItem <= racionesPorRestar) {
          racionesPorRestar -= rEnEsteItem;
          item.cantidad = 0; // se elimina después
        } else {
          // Solo gastamos lo necesario: si es pack y queda parcial, lo dejamos
          // como ración suelta restante (best effort). Aproximación: si packSize=1,
          // restamos cantidad. Si packSize>1, abrimos un pack y dejamos sueltos.
          if (packSize === 1) {
            item.cantidad -= racionesPorRestar;
            racionesPorRestar = 0;
          } else {
            // Abrir un pack: rebajar cantidad en 1 y guardar las que sobran como ración suelta
            const packsAUsar = Math.ceil(racionesPorRestar / packSize);
            const racionesUsadasReales = packsAUsar * packSize;
            const sobrantes = racionesUsadasReales - racionesPorRestar;
            item.cantidad = Math.max(0, (item.cantidad || 1) - packsAUsar);
            if (sobrantes > 0) {
              newInventario.push({
                nombre: 'Raciones sueltas',
                cantidad: sobrantes,
                categoria: 'equipo_general',
                peso_kg: 0.45 * sobrantes,
              });
            }
            racionesPorRestar = 0;
          }
        }
      }

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
    const membersWithRoles = config.miembros.filter(m => m.papeles?.length > 0);
    if (membersWithRoles.length === 0) {
      toast.error('No hay personajes con roles asignados');
      return;
    }
    
    // Calculate base journey PX divided equally
    const journeyBasePX = journeyCalc?.estimaciones?.px_total || 0;
    const pxPerMemberFromJourney = Math.round(journeyBasePX / membersWithRoles.length);
    
    setApplyingPX(true);
    
    try {
      // Calcular multiplicador global por grupo (Tabla 2)
      const allRolls = Object.values(characterXP).flatMap(c => c.rolls || []);
      const aciertos = allRolls.filter(r => r.exito).length;
      const fallos = allRolls.length - aciertos;
      const groupMult = calculateGroupMultiplier(aciertos, fallos);
      
      // Build array of {character_id, px_amount} with TOTAL = journey share + individual rolls (ajustado) — mínimo 0 por PJ
      const characterPXList = membersWithRoles.map(m => {
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
        const avgPX = Math.round((journeyBasePX + totalRollsXP) / membersWithRoles.length);
        const response = await api.post('/travel/apply-px', {
          character_ids: membersWithRoles.map(m => m.id),
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
          lastFatigueSaves={lastFatigueSaves}
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
    </div>
  );
};

export default EnhancedTravelSystem;

