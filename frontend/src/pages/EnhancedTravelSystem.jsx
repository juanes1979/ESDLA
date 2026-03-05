/**
 * Enhanced Travel System Component
 * Implements both Global and Day-by-Day journey modes
 * Uses the new travel rules API with editable configurations
 */
import React, { useState, useEffect, useCallback } from 'react';
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
import { 
  Map, Users, Compass, Play, Save, Clock, Mountain,
  Sun, Moon, Snowflake, Leaf, ArrowLeft, ArrowRight, Plus, MapPin, 
  Route, AlertTriangle, Shield, Footprints, Dice6, Check, X,
  ChevronRight, SkipForward, Flag, Zap, Heart, Eye, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// Elvish months with seasons
const MESES_ELFICOS = [
  { id: "Nénimë", nombre: "Nénimë (Enero)", estacion: "invierno" },
  { id: "Súlimë", nombre: "Súlimë (Febrero)", estacion: "invierno" },
  { id: "Coiviennë", nombre: "Coiviennë (Marzo)", estacion: "primavera" },
  { id: "Víressë", nombre: "Víressë (Abril)", estacion: "primavera" },
  { id: "Lótessë", nombre: "Lótessë (Mayo)", estacion: "primavera" },
  { id: "Nárië", nombre: "Nárië (Junio)", estacion: "verano" },
  { id: "Cermië", nombre: "Cermië (Julio)", estacion: "verano" },
  { id: "Urimë", nombre: "Urimë (Agosto)", estacion: "verano" },
  { id: "Yavannië", nombre: "Yavannië (Septiembre)", estacion: "verano" },
  { id: "Narquelië", nombre: "Narquelië (Octubre)", estacion: "otono" },
  { id: "Hísimë", nombre: "Hísimë (Noviembre)", estacion: "otono" },
  { id: "Ringarë", nombre: "Ringarë (Diciembre)", estacion: "invierno" },
];

const SeasonIcon = ({ estacion }) => {
  switch (estacion) {
    case 'invierno': return <Snowflake className="w-4 h-4 text-blue-400" />;
    case 'primavera': return <Leaf className="w-4 h-4 text-green-400" />;
    case 'verano': return <Sun className="w-4 h-4 text-yellow-400" />;
    case 'otono': return <Leaf className="w-4 h-4 text-orange-400" />;
    default: return null;
  }
};

// Role icons
const ROLE_ICONS = {
  guia: <Compass className="w-4 h-4" />,
  cazador: <Zap className="w-4 h-4" />,
  vigia: <Eye className="w-4 h-4" />,
  explorador: <Map className="w-4 h-4" />
};

const ROLE_INFO = {
  guia: { 
    nombre: 'Guía', 
    desc: 'A cargo de todas las decisiones relativas a la ruta, el descanso y los suministros.', 
    habilidad: 'Viajar',
    habilidad_key: 'viajar',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  cazador: { 
    nombre: 'Cazador', 
    desc: 'Encargado de encontrar comida en la naturaleza.', 
    habilidad: 'Caza',
    habilidad_key: 'caza',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  vigia: { 
    nombre: 'Vigía', 
    desc: 'Responsable de la vigilancia.', 
    habilidad: 'Percepción',
    habilidad_key: 'percepcion',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  },
  explorador: { 
    nombre: 'Explorador', 
    desc: 'Encargado de montar el campamento y de abrir nuevos caminos.', 
    habilidad: 'Explorar',
    habilidad_key: 'explorar',
    atributo: 'sabiduria',
    atributo_nombre: 'Sabiduría'
  }
};

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
    estacion: 'verano',
    horasMarchaForzada: 0,
    miembros: []
  });
  
  // Journey calculation result
  const [journeyCalc, setJourneyCalc] = useState(null);
  const [loadingCalc, setLoadingCalc] = useState(false);
  
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
  
  // Final results
  const [fatigueResults, setFatigueResults] = useState([]);
  
  // PX Application state
  const [applyingPX, setApplyingPX] = useState(false);
  const [pxApplied, setPxApplied] = useState(false);
  const [pxResults, setPxResults] = useState(null);
  
  // =============== LOAD DATA ===============
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [locRes, charRes, mountRes, rulesRes, landsRes, terrainsRes] = await Promise.all([
          api.get('/data/locations'),
          api.get('/characters/'),
          api.get('/data/monturas'),
          api.get('/travel/config/rules'),
          api.get('/travel/config/land-types'),
          api.get('/travel/config/terrains')
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
          papel: m.papel,
          tiene_montura: m.tieneMontura,
          montura_nombre: m.monturaNombre,
          montura_con_bonus: m.monturaConBonus || 0,
          velocidad_base: 30,
          modificador_sabiduria: m.modSabiduria || 0,
          competencias: m.competencias || [],
          nivel: m.nivel || 1
        }))
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
  
  // Recalculate when config changes
  useEffect(() => {
    if (config.origenId && config.destinoId) {
      const timer = setTimeout(() => calculateJourney(), 500);
      return () => clearTimeout(timer);
    }
  }, [config.origenId, config.destinoId, config.ritmo, config.evitarSombra, config.preferirCaminos, calculateJourney]);
  
  // =============== START JOURNEY ===============
  
  const startGlobalJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    if (!config.miembros.some(m => m.papel === 'guia')) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }
    
    setMode('global');
    setEvents([]);
    
    // Generate all events for the journey
    const numEvents = journeyCalc.estimaciones.eventos_esperados;
    const generatedEvents = [];
    
    for (let i = 0; i < numEvents; i++) {
      try {
        const eventRes = await api.post('/travel/generate-event', null, {
          params: {
            tipo_tierra: journeyCalc.ruta.tipo_tierra,
            terreno: journeyCalc.ruta.terreno,
            estacion: config.estacion
          }
        });
        
        if (eventRes.data.success) {
          generatedEvents.push({
            ...eventRes.data,
            casilla: Math.ceil((i + 1) * (journeyCalc.ruta.casillas / numEvents)),
            resuelto: false,
            resultado: null
          });
        }
      } catch (err) {
        console.error('Error generating event:', err);
      }
    }
    
    setEvents(generatedEvents);
    if (generatedEvents.length > 0) {
      setCurrentEvent(generatedEvents[0]);
    }
  };
  
  const startDayByDayJourney = async () => {
    if (!journeyCalc?.success) {
      toast.error('Calcula primero una ruta válida');
      return;
    }
    
    if (!config.miembros.some(m => m.papel === 'guia')) {
      toast.error('Debe haber al menos un Guía asignado');
      return;
    }
    
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
          papel: m.papel,
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
  
  const resolveCurrentEvent = async (tirada) => {
    if (!currentEvent) return;
    
    setResolvingEvent(true);
    
    // Find the character with the target role
    const targetRole = currentEvent.objetivo.papel;
    const targetChar = config.miembros.find(m => m.papel === targetRole);
    
    const cd = currentEvent.resolucion.cd;
    const exito = tirada >= cd;
    
    try {
      const res = await api.post('/travel/resolve-event', null, {
        params: {
          evento_id: currentEvent.evento.id,
          tirada_resolucion: tirada,
          cd: cd,
          exito: exito,
          evento_nombre: currentEvent.evento.nombre,
          objetivo_papel: targetRole,
          personaje_nombre: targetChar?.nombre || 'Desconocido'
        }
      });
      
      // Update event with result
      const updatedEvents = events.map(e => {
        if (e === currentEvent) {
          return {
            ...e,
            resuelto: true,
            resultado: res.data,
            tirada: tirada,
            exito: exito
          };
        }
        return e;
      });
      
      setEvents(updatedEvents);
      
      // Move to next event
      const nextUnresolved = updatedEvents.find(e => !e.resuelto);
      setCurrentEvent(nextUnresolved || null);
      
      if (!nextUnresolved) {
        // All events resolved - show results
        await calculateFatigueResults(updatedEvents);
        setMode('results');
      }
    } catch (err) {
      console.error('Error resolving event:', err);
      toast.error('Error al resolver acontecimiento');
    } finally {
      setResolvingEvent(false);
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
  
  const calculateFatigueResults = async (resolvedEvents) => {
    const results = [];
    
    // Calculate total fatigue CD
    let fatigueCd = travelRules?.fatigue_base_cd || 10;
    resolvedEvents.forEach(e => {
      if (e.resultado?.modificadores?.fatiga_cd_increase) {
        fatigueCd += e.resultado.modificadores.fatiga_cd_increase;
      }
    });
    
    // Calculate for each party member
    for (const member of config.miembros) {
      const char = characters.find(c => c.id === member.id);
      if (!char) continue;
      
      // Get constitution modifier
      const conMod = Math.floor(((char.atributos?.constitucion || 10) - 10) / 2);
      
      // Mount bonus
      const mountBonus = member.tieneMontura ? (member.monturaConBonus || 0) : 0;
      
      try {
        const res = await api.post('/travel/fatigue-save', null, {
          params: {
            personaje_nombre: member.nombre,
            modificador_constitucion: conMod,
            cd_acumulada: fatigueCd,
            dias_con_montura: member.tieneMontura ? journeyCalc?.estimaciones?.dias_estimados || 1 : 0,
            dias_totales: journeyCalc?.estimaciones?.dias_estimados || 1,
            bonus_montura_con: mountBonus
          }
        });
        
        results.push({
          personaje: member.nombre,
          papel: member.papel,
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
    
    setConfig(prev => ({
      ...prev,
      miembros: [...prev.miembros, {
        id: char.id,
        nombre: char.nombre,
        papel: null,
        tieneMontura: false,
        monturaNombre: null,
        monturaConBonus: 0,
        modSabiduria: Math.floor(((char.atributos?.sabiduria || 10) - 10) / 2),
        competencias: char.habilidades || [],
        nivel: char.nivel || 1
      }]
    }));
  };
  
  const addMemberWithRole = (charId, role) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    
    // Remove any existing member with this role
    let newMiembros = config.miembros.map(m => 
      m.papel === role ? { ...m, papel: null } : m
    );
    
    // Check if character is already in the group
    const existingMember = newMiembros.find(m => m.id === charId);
    
    if (existingMember) {
      // Just update their role
      newMiembros = newMiembros.map(m => 
        m.id === charId ? { ...m, papel: role } : m
      );
    } else {
      // Add new member with role
      newMiembros = [...newMiembros, {
        id: char.id,
        nombre: char.nombre,
        papel: role,
        tieneMontura: false,
        monturaNombre: null,
        monturaConBonus: 0,
        modSabiduria: Math.floor(((char.atributos?.sabiduria || 10) - 10) / 2),
        competencias: char.habilidades || [],
        nivel: char.nivel || 1
      }];
    }
    
    setConfig(prev => ({
      ...prev,
      miembros: newMiembros
    }));
  };
  
  const removeMember = (charId) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.filter(m => m.id !== charId)
    }));
  };
  
  const updateMemberRole = (charId, role) => {
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => 
        m.id === charId ? { ...m, papel: role } : m
      )
    }));
  };
  
  const updateMemberMount = (charId, montura) => {
    const mountData = monturas.find(m => m.nombre === montura);
    setConfig(prev => ({
      ...prev,
      miembros: prev.miembros.map(m => 
        m.id === charId ? {
          ...m,
          tieneMontura: montura !== 'A pie',
          monturaNombre: montura,
          monturaConBonus: mountData?.mod_con || 0
        } : m
      )
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
  };
  
  // =============== APPLY PX TO CHARACTERS ===============
  
  const applyPXToCharacters = async () => {
    if (!journeyCalc?.estimaciones?.px_por_personaje) {
      toast.error('No hay PX para aplicar');
      return;
    }
    
    const membersWithRoles = config.miembros.filter(m => m.papel);
    if (membersWithRoles.length === 0) {
      toast.error('No hay personajes con roles asignados');
      return;
    }
    
    setApplyingPX(true);
    
    try {
      const response = await api.post('/travel/apply-px', {
        character_ids: membersWithRoles.map(m => m.id),
        px_amount: journeyCalc.estimaciones.px_por_personaje,
        journey_id: activeJourney?.id || null,
        journey_description: `Viaje de ${config.origenNombre} a ${config.destinoNombre}`
      });
      
      if (response.data.success) {
        setPxApplied(true);
        setPxResults(response.data);
        toast.success(`¡${response.data.px_por_personaje} PX aplicados a ${response.data.exitosos} personajes!`);
      } else {
        toast.error(response.data.message || 'Error al aplicar PX');
      }
    } catch (err) {
      console.error('Error applying PX:', err);
      toast.error('Error al aplicar PX a los personajes');
    } finally {
      setApplyingPX(false);
    }
  };
  
  // =============== RENDER SECTIONS ===============
  
  // Configuration Panel
  const renderConfig = () => (
    <div className="space-y-6">
      {/* Origin & Destination */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Route className="w-5 h-5" /> Origen y Destino
            <Badge variant="outline" className="ml-2">{locations.length} ubicaciones</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Origin */}
            <div>
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-400" /> Origen
              </Label>
              <Select
                value={config.origenId}
                onValueChange={(v) => {
                  const loc = locations.find(l => l.id === v);
                  setConfig(prev => ({
                    ...prev,
                    origenId: v,
                    origenNombre: loc?.nombre || ''
                  }));
                }}
              >
                <SelectTrigger data-testid="travel-select-origen">
                  <SelectValue placeholder="Seleccionar origen">
                    {config.origenNombre && (
                      <span className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> {config.origenNombre}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <ScrollArea className="h-72">
                    {Object.entries(locationsByRegion).map(([region, locs]) => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-[hsl(var(--gold))] font-bold">{region}</SelectLabel>
                        {locs.map(loc => (
                          <SelectItem key={loc.id} value={loc.id} disabled={loc.id === config.destinoId}>
                            <div className="flex items-center gap-2">
                              {loc.refugio && <Shield className="w-3 h-3 text-green-400" />}
                              {loc.nombre}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            
            {/* Destination */}
            <div>
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-400" /> Destino
              </Label>
              <Select
                value={config.destinoId}
                onValueChange={(v) => {
                  const loc = locations.find(l => l.id === v);
                  setConfig(prev => ({
                    ...prev,
                    destinoId: v,
                    destinoNombre: loc?.nombre || ''
                  }));
                }}
              >
                <SelectTrigger data-testid="travel-select-destino">
                  <SelectValue placeholder="Seleccionar destino">
                    {config.destinoNombre && (
                      <span className="flex items-center gap-2">
                        <Flag className="w-3 h-3" /> {config.destinoNombre}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <ScrollArea className="h-72">
                    {Object.entries(locationsByRegion).map(([region, locs]) => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-[hsl(var(--gold))] font-bold">{region}</SelectLabel>
                        {locs.map(loc => (
                          <SelectItem key={loc.id} value={loc.id} disabled={loc.id === config.origenId}>
                            <div className="flex items-center gap-2">
                              {loc.refugio && <Shield className="w-3 h-3 text-green-400" />}
                              {loc.nombre}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Route Options */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.evitarSombra}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, evitarSombra: v }))}
              />
              <Label className="text-sm">Evitar Tierras de la Sombra</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.evitarTierrasOscuras}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, evitarTierrasOscuras: v }))}
              />
              <Label className="text-sm">Evitar Tierras Oscuras</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.preferirCaminos}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, preferirCaminos: v }))}
              />
              <Label className="text-sm">Preferir Caminos</Label>
            </div>
          </div>
          
          {/* Journey Calculation Result */}
          {loadingCalc && (
            <div className="p-4 bg-black/20 rounded animate-pulse">
              <p className="text-muted-foreground">Calculando ruta...</p>
            </div>
          )}
          
          {journeyCalc?.success && !loadingCalc && (
            <div className="p-4 bg-gradient-to-r from-[hsl(var(--gold))/10] to-transparent rounded-lg border border-[hsl(var(--gold))/30]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[hsl(var(--gold))]">Ruta Calculada</h4>
                <div className="flex gap-2">
                  <Badge>{journeyCalc.ruta.tipo_tierra_nombre}</Badge>
                  <Badge variant="outline">{journeyCalc.ruta.terreno_nombre || journeyCalc.ruta.terreno}</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--torch-orange))]">{journeyCalc.ruta.distance_km}</p>
                  <p className="text-xs text-muted-foreground">kilómetros</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--magic-blue))]">{journeyCalc.ruta.casillas}</p>
                  <p className="text-xs text-muted-foreground">casillas</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-[hsl(var(--gold))]">{journeyCalc.estimaciones.dias_estimados}</p>
                  <p className="text-xs text-muted-foreground">días estimados</p>
                </div>
                <div className="bg-black/20 p-2 rounded text-center">
                  <p className="text-2xl font-bold text-green-400">{journeyCalc.estimaciones.px_total}</p>
                  <p className="text-xs text-muted-foreground">PX totales</p>
                </div>
              </div>
              
              {/* PX Breakdown */}
              {journeyCalc.px_desglose && journeyCalc.px_desglose.px_total > 0 && (
                <div className="mt-3 p-3 bg-black/20 rounded text-sm">
                  <p className="text-muted-foreground mb-2">
                    <span className="text-[hsl(var(--gold))]">Desglose PX:</span>
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      Vía: <span className="text-white">{journeyCalc.ruta.tipo_via?.replace('_', ' ')}</span>
                    </span>
                    <span>
                      Base: <span className="text-white">{journeyCalc.px_desglose.px_base_por_casilla} PX/casilla</span>
                    </span>
                    {journeyCalc.px_desglose.px_bonus_terreno_por_casilla > 0 && (
                      <span>
                        Bonus terreno: <span className="text-yellow-400">+{journeyCalc.px_desglose.px_bonus_terreno_por_casilla} PX/casilla</span>
                      </span>
                    )}
                    {journeyCalc.px_desglose.terreno_multiplicador > 1 && (
                      <span>
                        Multiplicador: <span className="text-orange-400">×{journeyCalc.px_desglose.terreno_multiplicador}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mt-3">
                {journeyCalc.modificadores.tiene_ventaja_eventos && (
                  <Badge className="bg-green-600">Ventaja en eventos</Badge>
                )}
                {journeyCalc.modificadores.tiene_desventaja_eventos && (
                  <Badge className="bg-red-600">Desventaja en eventos</Badge>
                )}
                {journeyCalc.modificadores.desventaja_estacion && (
                  <Badge className="bg-blue-600">Desventaja estacional</Badge>
                )}
              </div>
            </div>
          )}
          
          {journeyCalc?.error && (
            <div className="p-4 bg-red-900/20 rounded border border-red-500/30">
              <p className="text-red-400">{journeyCalc.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Travel Settings */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
            <Footprints className="w-5 h-5 inline mr-2" />
            Configuración del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Ritmo de Viaje</Label>
              <Select value={config.ritmo} onValueChange={(v) => setConfig(prev => ({ ...prev, ritmo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lento">🐢 Lento (24 km/día)</SelectItem>
                  <SelectItem value="normal">🚶 Normal (36 km/día)</SelectItem>
                  <SelectItem value="rapido">🏃 Rápido (48 km/día)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Mes</Label>
              <Select value={config.mes} onValueChange={(v) => setConfig(prev => ({ ...prev, mes: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_ELFICOS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <SeasonIcon estacion={m.estacion} />
                        {m.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Marcha Forzada (horas extra)</Label>
              <Select 
                value={config.horasMarchaForzada.toString()} 
                onValueChange={(v) => setConfig(prev => ({ ...prev, horasMarchaForzada: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sin marcha forzada</SelectItem>
                  <SelectItem value="1">+1 hora (CD 11)</SelectItem>
                  <SelectItem value="2">+2 horas (CD 12)</SelectItem>
                  <SelectItem value="3">+3 horas (CD 13)</SelectItem>
                  <SelectItem value="4">+4 horas (CD 14)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Party Roles - 4 Independent Fields */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Users className="w-5 h-5 inline mr-2" />
            Papeles de Viaje
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Asigna un personaje a cada papel. Se mostrará su bonificador relevante para el papel.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role Assignment Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
              const assignedMember = config.miembros.find(m => m.papel === roleKey);
              
              // Calculate bonus for each character for this role
              const getCharBonus = (char) => {
                if (!char) return { total: 0, atributo: 0, habilidad: 0, competente: false };
                const atributoVal = char.atributos?.[roleInfo.atributo] || 10;
                const atributoMod = Math.floor((atributoVal - 10) / 2);
                const competencias = char.habilidades || [];
                const esCompetente = competencias.some(h => 
                  h.toLowerCase().includes(roleInfo.habilidad_key) ||
                  roleInfo.habilidad_key.includes(h.toLowerCase())
                );
                const profBonus = esCompetente ? Math.ceil((char.nivel || 1) / 4) + 1 : 0;
                return {
                  total: atributoMod + profBonus,
                  atributo: atributoMod,
                  habilidad: profBonus,
                  competente: esCompetente
                };
              };
              
              return (
                <Card 
                  key={roleKey} 
                  className={`p-4 ${assignedMember ? 'border-green-500/50 bg-green-900/10' : 'border-border/50'}`}
                >
                  {/* Role Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-full ${
                      roleKey === 'guia' ? 'bg-blue-600' :
                      roleKey === 'cazador' ? 'bg-orange-600' :
                      roleKey === 'vigia' ? 'bg-purple-600' :
                      'bg-green-600'
                    }`}>
                      {ROLE_ICONS[roleKey]}
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--gold))]">{roleInfo.nombre}</h4>
                      <p className="text-xs text-muted-foreground">
                        {roleInfo.atributo_nombre} ({roleInfo.habilidad})
                      </p>
                    </div>
                  </div>
                  
                  {/* Role Description */}
                  <p className="text-xs text-muted-foreground mb-3 italic">
                    {roleInfo.desc}
                  </p>
                  
                  {/* Character Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs">Personaje asignado</Label>
                    <Select 
                      value={assignedMember?.id || '_none_'} 
                      onValueChange={(charId) => {
                        if (charId === '_none_') {
                          // Remove from this role
                          if (assignedMember) {
                            updateMemberRole(assignedMember.id, null);
                          }
                        } else {
                          // First remove any existing role for this character
                          const existingMember = config.miembros.find(m => m.id === charId);
                          if (existingMember) {
                            updateMemberRole(charId, roleKey);
                          } else {
                            // Add new member with this role
                            addMemberWithRole(charId, roleKey);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Seleccionar personaje">
                          {assignedMember ? (
                            <div className="flex items-center justify-between w-full">
                              <span>{assignedMember.nombre}</span>
                              <Badge className="ml-2 bg-[hsl(var(--gold))] text-black">
                                +{getCharBonus(characters.find(c => c.id === assignedMember.id)).total}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Sin asignar</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">
                          <span className="text-muted-foreground">Sin asignar</span>
                        </SelectItem>
                        {characters.map(char => {
                          const bonus = getCharBonus(char);
                          const isAssignedElsewhere = config.miembros.some(m => m.id === char.id && m.papel && m.papel !== roleKey);
                          return (
                            <SelectItem 
                              key={char.id} 
                              value={char.id}
                              disabled={isAssignedElsewhere}
                            >
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className={isAssignedElsewhere ? 'text-muted-foreground' : ''}>
                                  {char.nombre}
                                </span>
                                <div className="flex items-center gap-2">
                                  {bonus.competente && (
                                    <Badge variant="outline" className="text-xs bg-green-900/30 border-green-500/50">
                                      {roleInfo.habilidad}
                                    </Badge>
                                  )}
                                  <Badge className={`${
                                    bonus.total >= 5 ? 'bg-green-600' :
                                    bonus.total >= 2 ? 'bg-yellow-600' :
                                    'bg-red-600'
                                  }`}>
                                    {bonus.total >= 0 ? '+' : ''}{bonus.total}
                                  </Badge>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    
                    {/* Mount selection for assigned member */}
                    {assignedMember && (
                      <div className="mt-2">
                        <Label className="text-xs">Montura</Label>
                        <Select 
                          value={assignedMember.monturaNombre || 'A pie'} 
                          onValueChange={(v) => updateMemberMount(assignedMember.id, v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A pie">A pie</SelectItem>
                            {monturas.map(m => (
                              <SelectItem key={m.nombre} value={m.nombre}>
                                {m.nombre} {m.mod_con > 0 && `(+${m.mod_con} CON)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          
          {/* Summary of assigned roles */}
          <div className="pt-4 border-t border-border/30">
            <div className="flex flex-wrap gap-2">
              {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
                const assigned = config.miembros.find(m => m.papel === roleKey);
                return (
                  <Badge 
                    key={roleKey}
                    className={assigned ? 'bg-green-600' : 'bg-red-600/50'}
                  >
                    {ROLE_ICONS[roleKey]}
                    <span className="ml-1">{roleInfo.nombre}:</span>
                    <span className="ml-1">{assigned ? assigned.nombre : 'Vacante'}</span>
                  </Badge>
                );
              })}
            </div>
          </div>
          
          {/* Warning if no guide */}
          {!config.miembros.some(m => m.papel === 'guia') && (
            <div className="p-2 bg-yellow-900/30 rounded border border-yellow-500/50 text-sm text-yellow-400">
              ⚠️ No hay ningún Guía asignado. Se requiere al menos uno para iniciar el viaje.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Travel Mode Selection */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Play className="w-5 h-5 inline mr-2" />
            Modo de Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={travelMode} onValueChange={setTravelMode}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="global">
                <SkipForward className="w-4 h-4 mr-2" /> Viaje Global
              </TabsTrigger>
              <TabsTrigger value="dayByDay">
                <ChevronRight className="w-4 h-4 mr-2" /> Jornada a Jornada
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="global" className="text-sm text-muted-foreground">
              <p>Ejecuta todo el viaje de una vez. Genera todos los acontecimientos y calcula el resultado final automáticamente.</p>
            </TabsContent>
            
            <TabsContent value="dayByDay" className="text-sm text-muted-foreground">
              <p>Avanza día a día. Permite cambiar el ritmo, los papeles y tomar decisiones cada jornada.</p>
            </TabsContent>
          </Tabs>
          
          <Button 
            onClick={travelMode === 'global' ? startGlobalJourney : startDayByDayJourney}
            disabled={!journeyCalc?.success || config.miembros.length === 0 || !config.miembros.some(m => m.papel === 'guia')}
            className="w-full h-12 text-lg mt-4"
            data-testid="start-journey-btn"
          >
            <Compass className="w-5 h-5 mr-2" />
            Iniciar Viaje ({travelMode === 'global' ? 'Global' : 'Jornada a Jornada'})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
  
  // Global Journey - Event Resolution
  const renderGlobalJourney = () => (
    <div className="space-y-6">
      {/* Journey Progress */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Route className="w-5 h-5 inline mr-2" />
            {config.origenNombre} → {config.destinoNombre}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress 
              value={(events.filter(e => e.resuelto).length / events.length) * 100} 
              className="h-3"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Eventos resueltos: {events.filter(e => e.resuelto).length} / {events.length}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold">{journeyCalc?.ruta?.casillas || 0}</p>
              <p className="text-xs text-muted-foreground">casillas</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold">{journeyCalc?.estimaciones?.dias_estimados || 0}</p>
              <p className="text-xs text-muted-foreground">días</p>
            </div>
            <div className="bg-black/20 p-2 rounded">
              <p className="text-xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
              <p className="text-xs text-muted-foreground">PX</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Current Event */}
      {currentEvent && (
        <Card className={`card-parchment border-2 ${
          currentEvent.evento.fatigue_cd_increase >= 3 ? 'border-red-500' :
          currentEvent.evento.fatigue_cd_increase >= 2 ? 'border-orange-500' :
          'border-yellow-500'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[hsl(var(--gold))]">
                <Dice6 className="w-5 h-5 inline mr-2" />
                Acontecimiento - Casilla {currentEvent.casilla}
              </CardTitle>
              <Badge className={
                currentEvent.evento.fatigue_cd_increase >= 3 ? 'bg-red-600' :
                currentEvent.evento.fatigue_cd_increase >= 2 ? 'bg-orange-600' :
                'bg-yellow-600'
              }>
                +{currentEvent.evento.fatigue_cd_increase} CD Fatiga
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-black/20 rounded">
              <h3 className="text-xl font-bold text-[hsl(var(--torch-orange))] mb-2">
                {currentEvent.evento.nombre}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Tirada d20: <span className="text-[hsl(var(--gold))] font-bold">{currentEvent.tiradas.d20}</span>
                {currentEvent.tiradas.tipo_tirada !== 'normal' && (
                  <span className={currentEvent.tiradas.tipo_tirada === 'ventaja' ? 'text-green-400' : 'text-red-400'}>
                    {' '}({currentEvent.tiradas.tipo_tirada})
                  </span>
                )}
              </p>
            </div>
            
            <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
              <h4 className="font-bold text-[hsl(var(--magic-blue))] mb-2">
                Objetivo: {ROLE_INFO[currentEvent.objetivo.papel]?.nombre || currentEvent.objetivo.papel}
              </h4>
              <p className="text-sm">
                Prueba: <span className="text-[hsl(var(--gold))]">{currentEvent.objetivo.prueba}</span>
              </p>
              <p className="text-sm">
                CD: <span className="text-xl font-bold text-red-400">{currentEvent.resolucion.cd}</span>
              </p>
              {currentEvent.resolucion.desventaja_salvacion && (
                <Badge className="bg-blue-600 mt-2">Desventaja (Otoño/Invierno)</Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-green-900/20 rounded border border-green-500/30">
                <h5 className="font-bold text-green-400 mb-1">✓ Éxito</h5>
                <p className="text-muted-foreground">{currentEvent.evento.consecuencias_exito}</p>
              </div>
              <div className="p-3 bg-red-900/20 rounded border border-red-500/30">
                <h5 className="font-bold text-red-400 mb-1">✗ Fracaso</h5>
                <p className="text-muted-foreground">{currentEvent.evento.consecuencias_fracaso}</p>
              </div>
            </div>
            
            {/* Roll Input */}
            <div className="flex items-center gap-4 pt-4 border-t border-border/30">
              <Label>Resultado de la tirada:</Label>
              <Input
                type="number"
                min={1}
                max={30}
                className="w-24"
                placeholder="1-30"
                id="roll-input"
              />
              <Button 
                onClick={() => {
                  const input = document.getElementById('roll-input');
                  const value = parseInt(input?.value);
                  if (value >= 1) {
                    resolveCurrentEvent(value);
                  } else {
                    toast.error('Introduce un resultado válido');
                  }
                }}
                disabled={resolvingEvent}
              >
                {resolvingEvent ? 'Resolviendo...' : 'Resolver'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Resolved Events */}
      {events.filter(e => e.resuelto).length > 0 && (
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Eventos Resueltos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {events.filter(e => e.resuelto).map((e, i) => (
                  <div 
                    key={i} 
                    className={`p-2 rounded text-sm ${e.exito ? 'bg-green-900/20' : 'bg-red-900/20'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span>Casilla {e.casilla}: {e.evento.nombre}</span>
                      <Badge className={e.exito ? 'bg-green-600' : 'bg-red-600'}>
                        {e.exito ? 'Éxito' : 'Fracaso'} ({e.tirada})
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      <Button variant="outline" onClick={resetJourney}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar Viaje
      </Button>
    </div>
  );
  
  // Day by Day Journey
  const renderDayByDay = () => (
    <div className="space-y-6">
      {/* Journey Header */}
      <Card className="card-parchment bg-gradient-to-r from-[hsl(var(--gold))/10] to-transparent">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[hsl(var(--gold))]">
                {config.origenNombre} → {config.destinoNombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                {journeyCalc?.ruta?.tipo_tierra_nombre} • {journeyCalc?.ruta?.terreno_nombre || journeyCalc?.ruta?.terreno}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-lg px-3 py-1">
                <Clock className="w-4 h-4 mr-1 inline" />
                Día {activeJourney?.dia_actual || 1}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Journey Status */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            <Route className="w-5 h-5 inline mr-2" />
            Progreso del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Progress 
              value={((activeJourney?.casillas_recorridas || 0) / (activeJourney?.casillas_totales || 1)) * 100} 
              className="h-4"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>Casillas: {activeJourney?.casillas_recorridas?.toFixed(1) || 0} / {activeJourney?.casillas_totales || 0}</span>
              <span>{Math.round(((activeJourney?.casillas_recorridas || 0) / (activeJourney?.casillas_totales || 1)) * 100)}%</span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-black/20 p-3 rounded text-center">
              <p className="text-2xl font-bold text-red-400">{activeJourney?.fatiga_cd_total || 10}</p>
              <p className="text-xs text-muted-foreground">CD Fatiga</p>
            </div>
            <div className="bg-black/20 p-3 rounded text-center">
              <p className="text-2xl font-bold text-green-400">{journeyCalc?.estimaciones?.px_total || 0}</p>
              <p className="text-xs text-muted-foreground">PX Totales</p>
            </div>
            <div className="bg-black/20 p-3 rounded text-center">
              <p className="text-2xl font-bold text-blue-400">{events.length}</p>
              <p className="text-xs text-muted-foreground">Eventos</p>
            </div>
          </div>
          
          {/* Day Configuration */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm">Ritmo de hoy</Label>
              <Select 
                value={currentDayConfig.ritmo} 
                onValueChange={(v) => setCurrentDayConfig(prev => ({ ...prev, ritmo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lento">🐢 Lento (24 km)</SelectItem>
                  <SelectItem value="normal">🚶 Normal (36 km)</SelectItem>
                  <SelectItem value="rapido">🏃 Rápido (48 km)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm">Marcha Forzada</Label>
              <Select 
                value={currentDayConfig.marchaForzada.toString()} 
                onValueChange={(v) => setCurrentDayConfig(prev => ({ ...prev, marchaForzada: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sin marcha forzada</SelectItem>
                  <SelectItem value="1">+1 hora (+6 km)</SelectItem>
                  <SelectItem value="2">+2 horas (+12 km)</SelectItem>
                  <SelectItem value="3">+3 horas (+18 km)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            onClick={advanceDay} 
            className="w-full h-11" 
            disabled={currentEvent}
            data-testid="advance-day-btn"
          >
            <ChevronRight className="w-4 h-4 mr-2" />
            {currentEvent 
              ? 'Resuelve el acontecimiento primero' 
              : `Avanzar al Día ${(activeJourney?.dia_actual || 1) + 1}`
            }
          </Button>
        </CardContent>
      </Card>
      
      {/* Party Roles - Quick View */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">
            <Users className="w-5 h-5 inline mr-2" />
            Grupo de Viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(ROLE_INFO).map(([roleKey, roleInfo]) => {
              const member = config.miembros.find(m => m.papel === roleKey);
              return (
                <div 
                  key={roleKey}
                  className={`p-2 rounded text-center text-sm ${
                    member ? 'bg-green-900/20 border border-green-500/30' : 'bg-black/20 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {ROLE_ICONS[roleKey]}
                    <span className="font-bold text-[hsl(var(--gold))]">{roleInfo.nombre}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {member?.nombre || 'Vacante'}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Current Event (if any) */}
      {currentEvent && (
        <Card className={`card-parchment border-2 ${
          currentEvent.evento.fatigue_cd_increase >= 3 ? 'border-red-500' :
          currentEvent.evento.fatigue_cd_increase >= 2 ? 'border-orange-500' :
          'border-yellow-500'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                ¡Acontecimiento!
              </CardTitle>
              <Badge className={
                currentEvent.evento.fatigue_cd_increase >= 3 ? 'bg-red-600' :
                currentEvent.evento.fatigue_cd_increase >= 2 ? 'bg-orange-600' :
                'bg-yellow-600'
              }>
                +{currentEvent.evento.fatigue_cd_increase} CD Fatiga
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-black/20 rounded">
              <h3 className="text-xl font-bold text-[hsl(var(--torch-orange))] mb-2">
                {currentEvent.evento.nombre}
              </h3>
              <p className="text-sm text-muted-foreground">
                Tirada d20: <span className="text-[hsl(var(--gold))] font-bold">{currentEvent.tiradas.d20}</span>
              </p>
            </div>
            
            <div className="p-4 bg-blue-900/20 rounded border border-blue-500/30">
              <h4 className="font-bold text-[hsl(var(--magic-blue))] mb-2">
                Objetivo: {ROLE_INFO[currentEvent.objetivo.papel]?.nombre || currentEvent.objetivo.papel}
              </h4>
              <p className="text-sm">
                Prueba: <span className="text-[hsl(var(--gold))]">{currentEvent.objetivo.prueba}</span>
              </p>
              <p className="text-sm">
                CD: <span className="text-xl font-bold text-red-400">{currentEvent.resolucion.cd}</span>
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-green-900/20 rounded border border-green-500/30">
                <h5 className="font-bold text-green-400 mb-1">✓ Éxito</h5>
                <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_exito}</p>
              </div>
              <div className="p-3 bg-red-900/20 rounded border border-red-500/30">
                <h5 className="font-bold text-red-400 mb-1">✗ Fracaso</h5>
                <p className="text-muted-foreground text-xs">{currentEvent.evento.consecuencias_fracaso}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 pt-4 border-t border-border/30">
              <Label>Resultado de la tirada:</Label>
              <Input
                type="number"
                min={1}
                max={30}
                className="w-24"
                placeholder="1-30"
                id="day-roll-input"
              />
              <Button 
                onClick={() => {
                  const input = document.getElementById('day-roll-input');
                  const value = parseInt(input?.value);
                  if (value >= 1) {
                    resolveCurrentEvent(value);
                  } else {
                    toast.error('Introduce un resultado válido');
                  }
                }}
                disabled={resolvingEvent}
              >
                {resolvingEvent ? 'Resolviendo...' : 'Resolver'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Days Log */}
      {activeJourney?.dias && activeJourney.dias.length > 0 && (
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Registro de Jornadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {activeJourney.dias.map((dia, idx) => (
                  <div key={idx} className="p-2 bg-black/20 rounded text-sm flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[hsl(var(--gold))]">Día {dia.dia}</span>
                      <span className="text-muted-foreground ml-2">{dia.notas}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{dia.distancia_recorrida_km} km</Badge>
                      {dia.eventos?.length > 0 && (
                        <Badge className="bg-yellow-600">{dia.eventos.length} evento(s)</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={resetJourney} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
        </Button>
        <Button 
          onClick={finishDayByDayJourney} 
          className="flex-1 bg-green-600 hover:bg-green-700"
          disabled={!activeJourney || activeJourney.casillas_recorridas < activeJourney.casillas_totales}
          data-testid="finish-journey-btn"
        >
          <Flag className="w-4 h-4 mr-2" /> Finalizar Viaje
        </Button>
      </div>
    </div>
  );
  
  // Results
  const renderResults = () => {
    // Calculate totals
    const totalFatigueCd = travelRules?.fatigue_base_cd || 10;
    let diasExtra = 0;
    let diasReducidos = 0;
    
    events.forEach(e => {
      if (e.resultado?.modificadores) {
        diasExtra += e.resultado.modificadores.dias_extra || 0;
        diasReducidos += e.resultado.modificadores.dias_reducidos || 0;
      }
    });
    
    const diasFinales = (journeyCalc?.estimaciones?.dias_estimados || 0) + diasExtra - diasReducidos;
    const eventosExitosos = events.filter(e => e.exito).length;
    const eventosFracasados = events.filter(e => e.resuelto && !e.exito).length;
    
    return (
      <div className="space-y-6">
        {/* Journey Summary */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-xl text-[hsl(var(--gold))]">
              <Flag className="w-6 h-6 inline mr-2" />
              Viaje Completado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">{config.origenNombre} → {config.destinoNombre}</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-[hsl(var(--gold))]">{diasFinales}</p>
                <p className="text-sm text-muted-foreground">días totales</p>
              </div>
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-green-400">{eventosExitosos}</p>
                <p className="text-sm text-muted-foreground">éxitos</p>
              </div>
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-red-400">{eventosFracasados}</p>
                <p className="text-sm text-muted-foreground">fracasos</p>
              </div>
              <div className="bg-black/20 p-4 rounded text-center">
                <p className="text-3xl font-bold text-[hsl(var(--torch-orange))]">
                  {journeyCalc?.estimaciones?.px_total || 0}
                </p>
                <p className="text-sm text-muted-foreground">PX totales</p>
              </div>
            </div>
            
            {diasExtra > 0 && (
              <Badge className="bg-red-600 mr-2">+{diasExtra} días por percances</Badge>
            )}
            {diasReducidos > 0 && (
              <Badge className="bg-green-600">-{diasReducidos} días por atajos</Badge>
            )}
          </CardContent>
        </Card>
        
        {/* XP Distribution per Character */}
        <Card className="card-parchment border-2 border-green-500/50">
          <CardHeader>
            <CardTitle className="text-lg text-green-400">
              <Sparkles className="w-5 h-5 inline mr-2" />
              Puntos de Experiencia Ganados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {pxApplied 
                ? '¡Los PX han sido aplicados a las fichas de los personajes!'
                : 'Cada personaje recibirá los siguientes PX al finalizar el viaje.'
              }
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              {config.miembros.filter(m => m.papel).map((member) => {
                const memberResult = pxResults?.results?.find(r => r.character_id === member.id);
                return (
                  <Card key={member.id} className={`p-4 ${pxApplied ? 'bg-green-600/20 border-green-400' : 'bg-green-900/20 border-green-500/30'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[hsl(var(--gold))]">{member.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_INFO[member.papel]?.nombre}
                        </p>
                        {memberResult && pxApplied && (
                          <p className="text-xs text-green-400 mt-1">
                            XP Total: {memberResult.xp_nuevo}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-3xl font-bold ${pxApplied ? 'text-green-300' : 'text-green-400'}`}>
                          {pxApplied ? '✓' : '+'}{journeyCalc?.estimaciones?.px_por_personaje || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">PX</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            
            {journeyCalc?.px_desglose && (
              <div className="mt-4 p-3 bg-black/30 rounded text-xs">
                <p className="font-bold mb-2 text-[hsl(var(--gold))]">Desglose del cálculo:</p>
                <div className="space-y-1 text-muted-foreground">
                  <p>Terreno: {journeyCalc.ruta.terreno_nombre || journeyCalc.ruta.terreno}</p>
                  <p>Tipo de Tierra: {journeyCalc.ruta.tipo_tierra_nombre}</p>
                  <p>Vía: {journeyCalc.ruta.tipo_via?.replace('_', ' ')}</p>
                  <p>Casillas: {journeyCalc.ruta.casillas}</p>
                  <p>PX base por casilla: {journeyCalc.px_desglose.px_base_por_casilla}</p>
                  {journeyCalc.px_desglose.px_bonus_terreno_por_casilla > 0 && (
                    <p>Bonus terreno: +{journeyCalc.px_desglose.px_bonus_terreno_por_casilla}/casilla</p>
                  )}
                  <p className="font-bold text-white mt-2">
                    Total: {journeyCalc.px_desglose.px_base} + {journeyCalc.px_desglose.px_terreno_bonus} = {journeyCalc.px_desglose.px_total} PX
                  </p>
                </div>
              </div>
            )}
            
            {/* Apply PX Button */}
            {!pxApplied && (
              <Button 
                onClick={applyPXToCharacters}
                disabled={applyingPX}
                className="w-full mt-4 h-12 text-lg bg-green-600 hover:bg-green-700"
                data-testid="apply-px-btn"
              >
                {applyingPX ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Aplicando PX...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Finalizar Viaje y Repartir PX
                  </>
                )}
              </Button>
            )}
            
            {pxApplied && pxResults && (
              <div className="mt-4 p-3 bg-green-900/30 rounded border border-green-500/50">
                <p className="text-green-400 font-bold flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  {pxResults.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Fatigue Results */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-lg text-red-400">
              <Heart className="w-5 h-5 inline mr-2" />
              Tiradas de Fatiga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {fatigueResults.map((result, i) => (
                  <Card key={i} className={`p-3 ${
                    result.niveles_cansancio === 0 ? 'bg-green-900/20 border-green-500/50' :
                    result.niveles_cansancio === 1 ? 'bg-yellow-900/20 border-yellow-500/50' :
                    result.niveles_cansancio === 2 ? 'bg-orange-900/20 border-orange-500/50' :
                    'bg-red-900/20 border-red-500/50'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{result.personaje}</span>
                        {result.papel && (
                          <Badge variant="outline">{ROLE_INFO[result.papel]?.nombre}</Badge>
                        )}
                      </div>
                      <Badge className={
                        result.resultado === 'éxito' ? 'bg-green-600' :
                        result.resultado === 'fracaso' ? 'bg-yellow-600' :
                        result.resultado === 'fracaso_grave' ? 'bg-orange-600' :
                        'bg-red-600'
                      }>
                        {result.niveles_cansancio} nivel(es) cansancio
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Tirada: <span className="font-mono">{result.tirada?.d20}</span> + 
                        <span className="font-mono">{result.tirada?.modificador_con}</span> CON
                        {result.tirada?.bonus_montura > 0 && (
                          <span className="text-green-400"> + {result.tirada.bonus_montura} montura</span>
                        )}
                        {' = '}<span className="font-bold">{result.tirada?.total}</span>
                        {' vs CD '}<span className="text-red-400 font-bold">{result.cd}</span>
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Events Log */}
        <Card className="card-parchment">
          <CardHeader>
            <CardTitle className="text-lg">Registro de Acontecimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {events.map((e, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded ${e.exito ? 'bg-green-900/10' : 'bg-red-900/10'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="mr-2">Casilla {e.casilla}</Badge>
                        <span className="font-bold">{e.evento.nombre}</span>
                      </div>
                      <Badge className={e.exito ? 'bg-green-600' : 'bg-red-600'}>
                        {e.tirada} vs CD {e.resolucion?.cd}
                      </Badge>
                    </div>
                    {e.resultado?.consecuencias?.map((c, ci) => (
                      <p key={ci} className="text-xs text-muted-foreground mt-1">• {c}</p>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        <Button onClick={resetJourney} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Viaje
        </Button>
      </div>
    );
  };
  
  // =============== MAIN RENDER ===============
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-heading text-[hsl(var(--gold))]">
          <Compass className="w-8 h-8 inline mr-3" />
          Generador de Viajes
        </h1>
        {mode !== 'config' && (
          <Badge variant="outline" className="text-lg">
            {mode === 'global' ? 'Modo Global' : mode === 'dayByDay' ? 'Jornada a Jornada' : 'Resultados'}
          </Badge>
        )}
      </div>
      
      {mode === 'config' && renderConfig()}
      {mode === 'global' && renderGlobalJourney()}
      {mode === 'dayByDay' && renderDayByDay()}
      {mode === 'results' && renderResults()}
    </div>
  );
};

export default EnhancedTravelSystem;
