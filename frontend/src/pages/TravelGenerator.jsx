/**
 * Travel Generator Component
 * Generates travel events based on LOTR 5e rules
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Map, Users, Compass, CloudRain, Thermometer, Wind, 
  ChevronRight, Play, Save, Trash2, Clock, Mountain,
  Sun, Moon, Snowflake, Leaf, ArrowLeft, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';

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

const TIPOS_TERRENO = [
  { id: "camino", nombre: "Camino", cd: 10, color: "green" },
  { id: "campo_abierto", nombre: "Campo abierto", cd: 15, color: "yellow" },
  { id: "terreno_dificil", nombre: "Terreno difícil", cd: 20, color: "red" },
];

const TIPOS_TIERRA = [
  { id: "fronteriza", nombre: "Tierra Fronteriza", ventaja: true, color: "green" },
  { id: "salvaje", nombre: "Tierra Salvaje", ventaja: false, color: "yellow" },
  { id: "oscura", nombre: "Tierra Oscura", desventaja: true, color: "red" },
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

const TravelGenerator = () => {
  // Data states
  const [regiones, setRegiones] = useState([]);
  const [distancias, setDistancias] = useState({ rutas: [], puntos_interes: [] });
  const [monturas, setMonturas] = useState([]);
  const [viajesGuardados, setViajesGuardados] = useState([]);
  const [climaActual, setClimaActual] = useState(null);
  
  // Form states
  const [modo, setModo] = useState('configurar'); // configurar, generando, resultado
  const [modoDistancia, setModoDistancia] = useState('predefinida'); // predefinida, manual
  
  const [config, setConfig] = useState({
    origen: '',
    destino: '',
    region: '',
    casillas: 5,
    tipo_terreno: 'campo_abierto',
    tipo_tierra: 'salvaje',
    mes: 'Cermië',
    montura: 'A pie',
    velocidad: 30,
    marcha_forzada: false,
    papeles: {
      guia: '',
      cazador: '',
      vigia: '',
      explorador: ''
    },
    heroes_multiples_papeles: []
  });
  
  // Result states
  const [resultado, setResultado] = useState(null);
  const [eventosActuales, setEventosActuales] = useState([]);
  const [eventoIndex, setEventoIndex] = useState(0);
  const [modoGeneracion, setModoGeneracion] = useState('automatico'); // automatico, paso_a_paso
  
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [regionesRes, distanciasRes, monturasRes, viajesRes] = await Promise.all([
          api.get('/data/clima'),
          api.get('/data/distancias'),
          api.get('/data/monturas'),
          api.get('/data/viajes/guardados')
        ]);
        
        setRegiones(regionesRes.data || []);
        setDistancias(distanciasRes.data || { rutas: [], puntos_interes: [] });
        setMonturas(monturasRes.data || []);
        setViajesGuardados(viajesRes.data || []);
      } catch (err) {
        console.error('Error loading travel data:', err);
      }
    };
    loadData();
  }, []);
  
  // Load climate when region/month changes
  useEffect(() => {
    const loadClima = async () => {
      if (config.region && config.mes) {
        try {
          const res = await api.get(`/data/clima/${config.region}`);
          const mesData = res.data?.meses?.[config.mes];
          setClimaActual(mesData);
        } catch (err) {
          console.error('Error loading climate:', err);
        }
      }
    };
    loadClima();
  }, [config.region, config.mes]);
  
  // Update velocity when mount changes
  useEffect(() => {
    const montura = monturas.find(m => m.nombre === config.montura);
    if (montura) {
      setConfig(prev => ({ ...prev, velocidad: montura.velocidad }));
    }
  }, [config.montura, monturas]);
  
  // Handle predefined route selection
  const handleRutaSelect = (ruta) => {
    setConfig(prev => ({
      ...prev,
      origen: ruta.origen,
      destino: ruta.destino,
      casillas: ruta.casillas,
      region: ruta.region,
      tipo_terreno: ruta.tipo_terreno
    }));
    
    // Set tipo_tierra based on destination
    const punto = distancias.puntos_interes?.find(p => p.nombre === ruta.destino);
    if (punto) {
      setConfig(prev => ({ ...prev, tipo_tierra: punto.tipo_tierra }));
    }
  };
  
  // Check if hero has multiple roles
  const checkMultipleRoles = (heroName) => {
    if (!heroName) return false;
    const roles = Object.values(config.papeles).filter(p => p === heroName);
    return roles.length > 1;
  };
  
  // Update heroes with multiple roles
  useEffect(() => {
    const heroesConMultiples = [];
    const heroCount = {};
    
    Object.values(config.papeles).forEach(hero => {
      if (hero) {
        heroCount[hero] = (heroCount[hero] || 0) + 1;
      }
    });
    
    Object.entries(heroCount).forEach(([hero, count]) => {
      if (count > 1) heroesConMultiples.push(hero);
    });
    
    setConfig(prev => ({ ...prev, heroes_multiples_papeles: heroesConMultiples }));
  }, [config.papeles]);
  
  // Generate travel
  const generarViaje = async () => {
    if (!config.origen || !config.destino || !config.region) {
      toast.error('Completa origen, destino y región');
      return;
    }
    
    if (!config.papeles.guia) {
      toast.error('Debe haber al menos un Guía');
      return;
    }
    
    setModo('generando');
    
    try {
      const res = await api.post('/data/viajes/generar', config);
      setResultado(res.data);
      setEventosActuales(res.data.eventos || []);
      setEventoIndex(0);
      
      if (modoGeneracion === 'automatico') {
        setModo('resultado');
      }
    } catch (err) {
      console.error('Error generating travel:', err);
      toast.error('Error al generar el viaje');
      setModo('configurar');
    }
  };
  
  // Save travel
  const guardarViaje = async () => {
    if (!resultado) return;
    
    const nombre = prompt('Nombre para este viaje:', `${config.origen} → ${config.destino}`);
    if (!nombre) return;
    
    try {
      await api.post('/data/viajes/guardar', {
        nombre,
        config: resultado.config,
        eventos: resultado.eventos,
        resultado: resultado.resultado
      });
      
      toast.success('Viaje guardado');
      
      // Reload saved travels
      const res = await api.get('/data/viajes/guardados');
      setViajesGuardados(res.data || []);
    } catch (err) {
      toast.error('Error al guardar');
    }
  };
  
  // Delete saved travel
  const eliminarViaje = async (id) => {
    if (!confirm('¿Eliminar este viaje?')) return;
    
    try {
      await api.delete(`/data/viajes/${id}`);
      setViajesGuardados(prev => prev.filter(v => v.id !== id));
      toast.success('Viaje eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };
  
  // Load saved travel
  const cargarViaje = (viaje) => {
    setResultado({
      config: viaje.config,
      eventos: viaje.eventos,
      resultado: viaje.resultado
    });
    setEventosActuales(viaje.eventos || []);
    setModo('resultado');
  };
  
  // Render configuration form
  const renderConfiguracion = () => (
    <div className="space-y-6">
      {/* Modo de distancia */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={modoDistancia === 'predefinida' ? 'default' : 'outline'}
          onClick={() => setModoDistancia('predefinida')}
          className="flex-1"
        >
          <Map className="w-4 h-4 mr-2" /> Rutas Conocidas
        </Button>
        <Button
          variant={modoDistancia === 'manual' ? 'default' : 'outline'}
          onClick={() => setModoDistancia('manual')}
          className="flex-1"
        >
          <Compass className="w-4 h-4 mr-2" /> Manual
        </Button>
      </div>
      
      {/* Rutas predefinidas */}
      {modoDistancia === 'predefinida' && (
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[hsl(var(--gold))]">Seleccionar Ruta</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {distancias.rutas?.map((ruta, i) => (
                  <button
                    key={i}
                    onClick={() => handleRutaSelect(ruta)}
                    className={`w-full text-left p-2 rounded border transition-all ${
                      config.origen === ruta.origen && config.destino === ruta.destino
                        ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))/20]'
                        : 'border-border/30 hover:border-[hsl(var(--gold))/50]'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{ruta.origen} → {ruta.destino}</span>
                      <Badge variant="outline">{ruta.casillas} casillas</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {ruta.region} • {ruta.tipo_terreno.replace('_', ' ')}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      {/* Configuración manual */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">
            {modoDistancia === 'manual' ? 'Configuración del Viaje' : 'Ruta Seleccionada'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Origen</Label>
              <Input
                value={config.origen}
                onChange={(e) => setConfig(prev => ({ ...prev, origen: e.target.value }))}
                placeholder="Punto de partida"
              />
            </div>
            <div>
              <Label>Destino</Label>
              <Input
                value={config.destino}
                onChange={(e) => setConfig(prev => ({ ...prev, destino: e.target.value }))}
                placeholder="Punto de llegada"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Región</Label>
              <Select value={config.region} onValueChange={(v) => setConfig(prev => ({ ...prev, region: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar región" />
                </SelectTrigger>
                <SelectContent>
                  {regiones.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Casillas</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.casillas}
                onChange={(e) => setConfig(prev => ({ ...prev, casillas: parseInt(e.target.value) || 1 }))}
              />
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
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Terreno</Label>
              <Select value={config.tipo_terreno} onValueChange={(v) => setConfig(prev => ({ ...prev, tipo_terreno: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_TERRENO.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className={`text-${t.color}-400`}>{t.nombre} (CD {t.cd})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tipo de Tierra</Label>
              <Select value={config.tipo_tierra} onValueChange={(v) => setConfig(prev => ({ ...prev, tipo_tierra: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_TIERRA.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className={`text-${t.color}-400`}>
                        {t.nombre} {t.ventaja ? '(Ventaja)' : t.desventaja ? '(Desventaja)' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Clima actual */}
      {climaActual && (
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[hsl(var(--magic-blue))] flex items-center gap-2">
              <CloudRain className="w-5 h-5" /> Clima en {config.region}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-2 bg-black/10 rounded">
                <Thermometer className="w-5 h-5 mx-auto mb-1 text-red-400" />
                <p className="text-2xl font-bold">{climaActual.temp_media}°C</p>
                <p className="text-xs text-muted-foreground">{climaActual.temp_min}° - {climaActual.temp_max}°</p>
              </div>
              <div className="text-center p-2 bg-black/10 rounded">
                <CloudRain className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                <p className="text-2xl font-bold">{climaActual.lluvias_mm}mm</p>
                <p className="text-xs text-muted-foreground">{climaActual.prob_lluvia}% prob.</p>
              </div>
              <div className="text-center p-2 bg-black/10 rounded">
                <Wind className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
                <p className="text-2xl font-bold">{climaActual.viento_kmh} km/h</p>
                <p className="text-xs text-muted-foreground">Dir: {climaActual.dir_viento}</p>
              </div>
              <div className="text-center p-2 bg-black/10 rounded">
                <SeasonIcon estacion={MESES_ELFICOS.find(m => m.id === config.mes)?.estacion} />
                <p className="text-lg font-bold capitalize mt-1">
                  {MESES_ELFICOS.find(m => m.id === config.mes)?.estacion}
                </p>
              </div>
            </div>
            
            {/* Climate warnings */}
            <div className="mt-3 space-y-1">
              {climaActual.lluvias_mm > 70 && (
                <Badge variant="destructive" className="mr-2">⚠️ Lluvia fuerte (+2 CD)</Badge>
              )}
              {(climaActual.temp_media < 0 || climaActual.temp_media > 30) && (
                <Badge variant="destructive" className="mr-2">⚠️ Temp. extrema (+1 CD fatiga)</Badge>
              )}
              {climaActual.viento_kmh > 20 && (
                <Badge variant="outline" className="mr-2">💨 Viento fuerte (Desventaja Explorar)</Badge>
              )}
              {climaActual.temp_media < -10 && (
                <Badge variant="destructive">❄️ Nieve/Hielo (Terreno difícil)</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Montura y opciones */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">🐴 Montura y Opciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Montura</Label>
              <Select value={config.montura} onValueChange={(v) => setConfig(prev => ({ ...prev, montura: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monturas.map(m => (
                    <SelectItem key={m.nombre} value={m.nombre}>
                      {m.nombre} ({m.velocidad} pies) {m.con_montura && `+${m.mod_con} CON`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-black/10 rounded">
              <div>
                <Label>Marcha Forzada</Label>
                <p className="text-xs text-muted-foreground">Velocidad x2, CD fatiga 15/día</p>
              </div>
              <Switch
                checked={config.marcha_forzada}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, marcha_forzada: v }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Papeles de viaje */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">👥 Papeles de Viaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Asigna héroes a cada papel. Un héroe puede tener varios papeles pero sufre -5 en pruebas.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { key: 'guia', nombre: 'Guía', desc: 'Ruta, descanso, suministros' },
              { key: 'cazador', nombre: 'Cazador', desc: 'Encontrar comida' },
              { key: 'vigia', nombre: 'Vigía', desc: 'Vigilancia' },
              { key: 'explorador', nombre: 'Explorador', desc: 'Campamento, caminos' }
            ].map(papel => (
              <div key={papel.key} className={`p-3 rounded border ${
                checkMultipleRoles(config.papeles[papel.key]) 
                  ? 'border-yellow-500 bg-yellow-900/10' 
                  : 'border-border/30'
              }`}>
                <Label className="text-[hsl(var(--gold))]">{papel.nombre}</Label>
                <p className="text-xs text-muted-foreground mb-2">{papel.desc}</p>
                <Input
                  value={config.papeles[papel.key]}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    papeles: { ...prev.papeles, [papel.key]: e.target.value }
                  }))}
                  placeholder="Nombre del héroe"
                />
                {checkMultipleRoles(config.papeles[papel.key]) && (
                  <p className="text-xs text-yellow-400 mt-1">⚠️ Múltiples papeles: -5 en pruebas</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Modo de generación */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">🎲 Modo de Generación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={modoGeneracion === 'automatico' ? 'default' : 'outline'}
              onClick={() => setModoGeneracion('automatico')}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" /> Automático
            </Button>
            <Button
              variant={modoGeneracion === 'paso_a_paso' ? 'default' : 'outline'}
              onClick={() => setModoGeneracion('paso_a_paso')}
              className="flex-1"
            >
              <ChevronRight className="w-4 h-4 mr-2" /> Paso a Paso
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Botón generar */}
      <Button onClick={generarViaje} className="w-full h-12 text-lg" data-testid="generate-travel-btn">
        <Compass className="w-5 h-5 mr-2" /> Iniciar Viaje
      </Button>
    </div>
  );
  
  // Render result
  const renderResultado = () => {
    if (!resultado) return null;
    
    const { eventos, resultado: res } = resultado;
    
    return (
      <div className="space-y-6">
        {/* Summary */}
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
              <Map className="w-6 h-6" /> {config.origen} → {config.destino}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-black/10 rounded">
                <Clock className="w-5 h-5 mx-auto mb-1" />
                <p className="text-2xl font-bold text-[hsl(var(--gold))]">{res.dias_totales}</p>
                <p className="text-xs text-muted-foreground">días totales</p>
              </div>
              <div className="text-center p-3 bg-black/10 rounded">
                <Mountain className="w-5 h-5 mx-auto mb-1" />
                <p className="text-2xl font-bold">{config.casillas}</p>
                <p className="text-xs text-muted-foreground">casillas</p>
              </div>
              <div className="text-center p-3 bg-black/10 rounded">
                <Users className="w-5 h-5 mx-auto mb-1" />
                <p className="text-2xl font-bold text-[hsl(var(--torch-orange))]">{res.eventos_totales}</p>
                <p className="text-xs text-muted-foreground">acontecimientos</p>
              </div>
              <div className="text-center p-3 bg-red-900/20 rounded border border-red-500/30">
                <p className="text-xs text-red-400 mb-1">CD Fatiga</p>
                <p className="text-2xl font-bold text-red-400">{res.cd_fatiga}</p>
                {res.mod_con_montura > 0 && (
                  <p className="text-xs text-green-400">+{res.mod_con_montura} CON montura</p>
                )}
              </div>
            </div>
            
            {/* Climate modifiers */}
            {res.modificadores_clima?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-[hsl(var(--magic-blue))] mb-2">Modificadores del Clima:</p>
                <div className="flex flex-wrap gap-2">
                  {res.modificadores_clima.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {m.tipo}: {m.efecto}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {res.dias_extra !== 0 && (
              <p className={`text-sm ${res.dias_extra > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {res.dias_extra > 0 ? `+${res.dias_extra} días por percances` : `${res.dias_extra} días por atajos`}
              </p>
            )}
          </CardContent>
        </Card>
        
        {/* Events */}
        <Card className="card-parchment">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[hsl(var(--torch-orange))]">📜 Registro del Viaje</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {eventos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    ¡Viaje sin incidentes! La compañía llegó sin problemas.
                  </p>
                ) : (
                  eventos.map((evento, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded border-l-4 ${
                        evento.exito ? 'bg-green-900/10 border-green-500' : 'bg-red-900/10 border-red-500'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <Badge variant="outline" className="mr-2">Casilla {evento.casilla}</Badge>
                          <span className="font-bold text-lg">{evento.acontecimiento}</span>
                        </div>
                        <Badge className={evento.exito ? 'bg-green-600' : 'bg-red-600'}>
                          {evento.exito ? 'Éxito' : 'Fracaso'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">Objetivo:</span>{' '}
                          <span className="text-[hsl(var(--gold))]">{evento.objetivo}</span>
                          {' • '}
                          <span className="text-muted-foreground">Prueba:</span>{' '}
                          {evento.prueba}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Tirada:</span>{' '}
                          <span className="font-mono">{evento.tirada_resolucion}</span>
                          {' vs CD '}
                          <span className="font-mono text-[hsl(var(--torch-orange))]">{evento.cd}</span>
                        </p>
                        
                        {evento.consecuencias?.length > 0 && (
                          <div className="mt-2 p-2 bg-black/20 rounded">
                            <p className="text-xs font-semibold mb-1">Consecuencias:</p>
                            {evento.consecuencias.map((c, ci) => (
                              <p key={ci} className="text-xs">• {c}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={() => setModo('configurar')} variant="outline" className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" /> Nuevo Viaje
          </Button>
          <Button onClick={guardarViaje} className="flex-1" data-testid="save-travel-btn">
            <Save className="w-4 h-4 mr-2" /> Guardar Viaje
          </Button>
        </div>
      </div>
    );
  };
  
  // Render saved travels
  const renderViajesGuardados = () => (
    <Card className="card-parchment">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--magic-blue))]">📚 Viajes Guardados</CardTitle>
      </CardHeader>
      <CardContent>
        {viajesGuardados.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No hay viajes guardados</p>
        ) : (
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {viajesGuardados.map((viaje, i) => (
                <div key={viaje.id || i} className="flex justify-between items-center p-2 bg-black/10 rounded">
                  <div>
                    <p className="font-medium">{viaje.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {viaje.resultado?.dias_totales} días • {viaje.eventos?.length || 0} eventos
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => cargarViaje(viaje)}>
                      Ver
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => eliminarViaje(viaje.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading text-3xl text-[hsl(var(--gold))]">
            🗺️ Generador de Viajes
          </h1>
        </div>
        
        {modo === 'configurar' && (
          <>
            {renderViajesGuardados()}
            <div className="mt-6">
              {renderConfiguracion()}
            </div>
          </>
        )}
        
        {modo === 'generando' && (
          <div className="text-center py-12">
            <Compass className="w-16 h-16 mx-auto animate-spin text-[hsl(var(--gold))]" />
            <p className="mt-4 text-lg">Generando viaje...</p>
          </div>
        )}
        
        {modo === 'resultado' && renderResultado()}
      </div>
    </div>
  );
};

export default TravelGenerator;
