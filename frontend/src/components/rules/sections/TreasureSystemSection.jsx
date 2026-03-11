/**
 * Treasure System Section - Complete Implementation with Editable Configuration
 * Includes: treasure tiers, magic items, blessings, famous weapons/armor, 
 * perditions (banes), enchanted qualities, pricing system, DM treasure index
 * NOW FULLY EDITABLE: coin types, dice rolls per tier, magic roll counts
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { 
  Gem, Crown, Sword, Shield, Sparkles, Skull, Coins, 
  Dice6, Gift, AlertTriangle, Star, Moon, Eye, RefreshCw,
  Plus, Trash2, Save, BookOpen, Edit, Hammer, ChevronDown,
  Settings, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// =============== DEFAULT TREASURE TIERS ===============
const DEFAULT_TREASURE_TIERS = {
  minor: {
    id: 'minor',
    nombre: 'Menor',
    tiradas: 1,
    cdSombra: 10,
    color: 'bg-green-600',
    monedas: [
      { id: 'tin', dado: '3d6', activo: true },
      { id: 'copper', dado: '2d8', activo: true },
      { id: 'silver', dado: '1d6', activo: true },
      { id: 'gold', dado: '0', activo: false },
      { id: 'mithril', dado: '0', activo: false }
    ]
  },
  major: {
    id: 'major',
    nombre: 'Mayor',
    cdSombra: 15,
    tiradas: 2,
    color: 'bg-blue-600',
    monedas: [
      { id: 'tin', dado: '0', activo: false },
      { id: 'copper', dado: '3d10', activo: true },
      { id: 'silver', dado: '2d8', activo: true },
      { id: 'gold', dado: '1d6', activo: true },
      { id: 'mithril', dado: '0', activo: false }
    ]
  },
  wondrous: {
    id: 'wondrous',
    nombre: 'Maravilloso',
    cdSombra: 20,
    tiradas: 3,
    color: 'bg-purple-600',
    monedas: [
      { id: 'tin', dado: '0', activo: false },
      { id: 'copper', dado: '0', activo: false },
      { id: 'silver', dado: '4d10', activo: true },
      { id: 'gold', dado: '2d8', activo: true },
      { id: 'mithril', dado: '1d4', activo: true }
    ]
  }
};

// =============== DEFAULT COIN TYPES ===============
// Tasa de cambio estándar:
// 10 estaño = 1 cobre | 10 cobre = 1 plata | 100 plata = 1 oro | 100 oro = 1 mithril
const DEFAULT_COIN_TYPES = [
  { id: 'tin', nombre: 'Estaño', abrev: 'me', color: 'bg-gray-500', valorEnOro: 0.0001 },
  { id: 'copper', nombre: 'Cobre', abrev: 'mc', color: 'bg-orange-700', valorEnOro: 0.001 },
  { id: 'silver', nombre: 'Plata', abrev: 'mp', color: 'bg-slate-400', valorEnOro: 0.01 },
  { id: 'gold', nombre: 'Oro', abrev: 'mo', color: 'bg-yellow-500', valorEnOro: 1 },
  { id: 'mithril', nombre: 'Mithril', abrev: 'mm', color: 'bg-cyan-400', valorEnOro: 100 }
];

// =============== MAGIC TREASURE TABLE ===============
const MAGIC_TREASURE_TABLE = [
  { min: 1, max: 14, resultado: 'ninguno', descripcion: 'Ningún tesoro mágico', sombraDado: '1d4-2' },
  { min: 15, max: 17, resultado: 'artefacto', descripcion: 'Artefacto maravilloso (1 bendición)', sombraDado: '1d6-3' },
  { min: 18, max: 19, resultado: 'extraordinario', descripcion: 'Objeto extraordinario (2 bendiciones)', sombraDado: '1d8-4' },
  { min: 20, max: 20, resultado: 'famoso', descripcion: 'Arma o armadura famosa', sombraDado: '1d8-4' }
];

// =============== BLESSINGS (with prices) ===============
const BLESSINGS = [
  { d20: 1, habilidad: 'Acertijos', objetos: 'diadema, pipa, anillo', coste: { 2: 2, 3: 5, 4: 10 } },
  { d20: 2, habilidad: 'Acrobacias', objetos: 'botas, capa, anillo', coste: { 2: 3, 3: 7, 4: 14 } },
  { d20: 3, habilidad: 'Atletismo', objetos: 'cinturón, botas, anillo', coste: { 2: 3, 3: 7, 4: 14 } },
  { d20: 4, habilidad: 'Cazar', objetos: 'botas, capa, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 5, habilidad: 'Engaño', objetos: 'amuleto, diadema, anillo', coste: { 2: 2, 3: 5, 4: 9 } },
  { d20: 6, habilidad: 'Explorar', objetos: 'botas, anillo, bastón', coste: { 2: 2, 3: 4, 4: 8 } },
  { d20: 7, habilidad: 'Interpretación', objetos: 'instrumento, pipa, anillo', coste: { 2: 2, 3: 5, 4: 9 } },
  { d20: 8, habilidad: 'Intimidación', objetos: 'capa, cuerno, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 9, habilidad: 'Investigación', objetos: 'amuleto, diadema, anillo', coste: { 2: 2, 3: 5, 4: 10 } },
  { d20: 10, habilidad: 'Juego de manos', objetos: 'capa, guantes, anillo', coste: { 2: 3, 3: 7, 4: 14 } },
  { d20: 11, habilidad: 'Medicina', objetos: 'equipo sanador, herboristería, anillo', coste: { 2: 2, 3: 5, 4: 10 } },
  { d20: 12, habilidad: 'Naturaleza', objetos: 'libro, diadema, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 13, habilidad: 'Percepción', objetos: 'amuleto, diadema, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 14, habilidad: 'Perspicacia', objetos: 'diadema, pipa, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 15, habilidad: 'Persuasión', objetos: 'amuleto, diadema, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 16, habilidad: 'Saber antiguo', objetos: 'libro, diadema, anillo', coste: { 2: 4, 3: 8, 4: 16 } },
  { d20: 17, habilidad: 'Sigilo', objetos: 'botas, capa, anillo', coste: { 2: 3, 3: 6, 4: 12 } },
  { d20: 18, habilidad: 'Trato con animales', objetos: 'diadema, anillo, bastón', coste: { 2: 2, 3: 5, 4: 10 } },
  { d20: 19, habilidad: 'Viajar', objetos: 'botas, anillo, bastón', coste: { 2: 1, 3: 3, 4: 6 } },
  { d20: 20, habilidad: 'Tira dos veces', objetos: 'especial', coste: { 2: 0, 3: 0, 4: 0 } }
];

// =============== MANUFACTURES ===============
const MANUFACTURES = [
  { id: 'numenorean', nombre: 'Númenóreana (Oesternesse)', tipo: 'humana', multiplicadorPrecio: 1.1 },
  { id: 'elven_eregion', nombre: 'Élfica (Eregion)', tipo: 'elfica', multiplicadorPrecio: 1.05 },
  { id: 'elven_beleriand', nombre: 'Élfica (Beleriand)', tipo: 'elfica', multiplicadorPrecio: 1.1 },
  { id: 'dwarven_khazad', nombre: 'Enana (Khazad-dûm)', tipo: 'enana', multiplicadorPrecio: 1.1 },
  { id: 'dwarven_erebor', nombre: 'Enana (Erebor)', tipo: 'enana', multiplicadorPrecio: 1.0 },
  { id: 'dwarven_beleriand', nombre: 'Enana (Beleriand - Nogrod/Belegost)', tipo: 'enana', multiplicadorPrecio: 1.0 }
];

// =============== PERDITIONS (BANES) ===============
const PERDITIONS = {
  numenorean: [
    { id: 'orcs', nombre: 'Letal contra los orcos', coste: 3 },
    { id: 'trolls', nombre: 'Exterminadora de troles', coste: 4 },
    { id: 'wolves', nombre: 'Cazadora de lobos', coste: 2 },
    { id: 'evil_men', nombre: 'Pesadilla de los hombres malignos', coste: 3 },
    { id: 'undead', nombre: 'Rompe espíritus impuros de los muertos vivientes', coste: 4 },
    { id: 'all_evil', nombre: 'Exterminadora de todos los sirvientes del maligno', coste: 5 }
  ],
  elven: [
    { id: 'orcs', nombre: 'Destroza orcos', coste: 3 },
    { id: 'wolves', nombre: 'Perseguidora de lobos', coste: 2 },
    { id: 'spiders', nombre: 'Destripa arañas', coste: 4 },
    { id: 'all_evil', nombre: 'Exterminadora de todos los sirvientes del maligno', coste: 5 }
  ]
};

// =============== WEAPON ENCHANTED QUALITIES ===============
const WEAPON_QUALITIES = [
  { id: 'afilada', nombre: 'Afilada', manufactura: ['numenorean'], multiplicador: 4, descripcion: '+1 ataque y daño' },
  { id: 'aplastante', nombre: 'Aplastante', manufactura: ['numenorean'], multiplicador: 4, descripcion: '+1 ataque/daño, TS Fue CD 8+PB+Fue o derribado' },
  { id: 'cruel', nombre: 'Cruel', manufactura: ['numenorean'], multiplicador: 4, descripcion: '+1 ataque y daño' },
  { id: 'dolorosa', nombre: 'Dolorosa', manufactura: ['numenorean'], multiplicador: 4, descripcion: '+1 ataque y daño' },
  { id: 'rasgadora', nombre: 'Rasgadora', manufactura: ['numenorean'], multiplicador: 8, descripcion: 'Ataque cuerpo a cuerpo como acción adicional' },
  { id: 'cruel_mayor', nombre: 'Cruel Mayor', manufactura: ['numenorean'], multiplicador: 8, descripcion: '+1 ataque/daño, crítico +4 dados vs perdición' },
  { id: 'dolorosa_mayor', nombre: 'Dolorosa Mayor', manufactura: ['numenorean'], multiplicador: 8, descripcion: '+1 ataque/daño, +3 daño vs perdición' },
  { id: 'exterminadora', nombre: 'Exterminadora de Enemigos', manufactura: ['numenorean', 'elven_eregion', 'elven_beleriand'], multiplicador: 8, descripcion: '+2 dados de daño vs perdición' },
  { id: 'afilada_elfica', nombre: 'Afilada', manufactura: ['elven_eregion', 'elven_beleriand'], multiplicador: 4, descripcion: '+1 ataque y daño' },
  { id: 'cruel_elfica', nombre: 'Cruel', manufactura: ['elven_eregion', 'elven_beleriand'], multiplicador: 4, descripcion: '+1 ataque y daño' },
  { id: 'afilada_mayor', nombre: 'Afilada Mayor', manufactura: ['elven_eregion', 'elven_beleriand'], multiplicador: 8, descripcion: '+1 ataque/daño, crítico 18-20 vs perdición' },
  { id: 'cruel_mayor_elfica', nombre: 'Cruel Mayor', manufactura: ['elven_eregion', 'elven_beleriand'], multiplicador: 8, descripcion: '+1 ataque/daño, crítico +3 dados' },
  { id: 'dardo_hiriente', nombre: 'Dardo Hiriente', manufactura: ['elven_eregion', 'elven_beleriand'], multiplicador: 8, tipo: 'distancia', descripcion: '+1 ataque/daño, desventaja en ataques del objetivo vs perdición' },
  { id: 'luminiscencia', nombre: 'Luminiscencia', manufactura: ['elven_eregion', 'elven_beleriand'], multiplicador: 8, descripcion: '+1 ataque/daño, brilla cerca de perdición, ventaja iniciativa' },
  { id: 'afilada_enana', nombre: 'Afilada', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 3, descripcion: '+1 ataque y daño' },
  { id: 'aplastante_enana', nombre: 'Aplastante', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 3, descripcion: '+1 ataque/daño, TS Fue o derribado' },
  { id: 'cruel_enana', nombre: 'Cruel', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 3, descripcion: '+1 ataque y daño' },
  { id: 'dolorosa_enana', nombre: 'Dolorosa', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 3, descripcion: '+1 ataque y daño' },
  { id: 'rasgadora_enana', nombre: 'Rasgadora', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 3, descripcion: 'Ataque adicional cada turno' },
  { id: 'afilada_mayor_enana', nombre: 'Afilada Mayor', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 6, descripcion: '+1 ataque/daño, crítico 19-20' },
  { id: 'arma_runica', nombre: 'Arma Rúnica', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 6, descripcion: '+1 ataque/daño, +1 salvaciones' },
  { id: 'dolorosa_mayor_enana', nombre: 'Dolorosa Mayor', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 6, descripcion: '+1 ataque/daño, +2 daño' },
  { id: 'llama_esperanza', nombre: 'Llama de Esperanza', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 6, descripcion: 'Aura 10 pies, bonus Car a salvaciones en combate' },
  { id: 'resplandor_terror', nombre: 'Resplandor de Terror', manufactura: ['dwarven_khazad', 'dwarven_erebor', 'dwarven_beleriand'], multiplicador: 6, descripcion: '+1 ataque/daño, luz solar, daño radiante' },
  { id: 'trayectoria_recta', nombre: 'Trayectoria Recta', manufactura: ['any'], multiplicador: 4, tipo: 'distancia', descripcion: '+1 ataque/daño, ignora cobertura' },
  { id: 'acero_hueco', nombre: 'Acero Hueco', manufactura: ['numenorean'], multiplicador: 8, tipo: 'distancia', descripcion: 'Ataque a distancia como acción adicional' }
];

// =============== ARMOR QUALITIES ===============
const ARMOR_QUALITIES = [
  { id: 'ajustada', nombre: 'Ajustada', coste: 320, descripcion: 'Los críticos contra ti se convierten en normales' },
  { id: 'habilmente_fabricada', nombre: 'Hábilmente Fabricada', coste: 320, descripcion: 'Pesa la mitad, no desventaja fatiga, +1 DEX máx a CA' },
  { id: 'armadura_runica', nombre: 'Armadura Rúnica', coste: 400, descripcion: '+1 CA y +1 salvaciones' },
  { id: 'ajustada_antiguos', nombre: 'Ajustada por los Antiguos', coste: 600, descripcion: '+1 CA, críticos contra ti se convierten en normales' },
  { id: 'habilmente_antiguos', nombre: 'Hábilmente Fabricada por los Antiguos', coste: 1200, descripcion: '+1 CA, mitad peso, no desventaja, +1 DEX máx' },
  { id: 'armadura_mithril', nombre: 'Armadura de Mithril', coste: 30, tipo: 'camisote', descripcion: 'Mitad peso, CA 14+DEX(máx 4), bajo ropa, competencia ligera' }
];

// =============== SHIELD QUALITIES ===============
const SHIELD_QUALITIES = [
  { id: 'reforzado', nombre: 'Reforzado', multiplicador: 3, descripcion: '+1 CA además del bonificador normal' },
  { id: 'runico', nombre: 'Rúnico', multiplicador: 3.6, descripcion: '+1 CA y +1 salvaciones (además del escudo)' },
  { id: 'reforzado_mayor_enano', nombre: 'Reforzado Mayor (Enano)', multiplicador: 9, descripcion: '+2 CA además del bonificador normal' },
  { id: 'reforzado_mayor_elfico', nombre: 'Reforzado Mayor (Élfico)', multiplicador: 7.5, descripcion: '+2 CA (+2 contra perdición) además del bonificador' },
  { id: 'reforzado_mayor_numenoreano', nombre: 'Reforzado Mayor (Númenóreano)', multiplicador: 8.5, descripcion: '+3 CA (+3 contra perdición) además del bonificador' }
];

// =============== CURSES ===============
const CURSES = [
  { id: 'weakness', nombre: 'Maldición de la debilidad', descripcion: 'Manifiesta el peor defecto de tu Senda de Sombra' },
  { id: 'darkener', nombre: 'Oscurecedor', descripcion: 'La luz se debilita (brillante→tenue→oscuridad)' },
  { id: 'pursued', nombre: 'Perseguido', descripcion: 'Un enemigo percibe tu presencia al acercarse' },
  { id: 'bad_luck', nombre: 'Mala suerte', descripcion: 'Si sacas 20, relanzas y usas el nuevo resultado' },
  { id: 'bad_omen', nombre: 'Mal augurio', descripcion: '+5 CD de pruebas durante un concilio' },
  { id: 'malign', nombre: 'Maligno', descripcion: '-2 a tiradas de salvación' },
  { id: 'owned', nombre: 'Adueñado', descripcion: 'En presencia del dueño original, el objeto es inútil' },
  { id: 'shadow_marked', nombre: 'Marcado por la Sombra', descripcion: 'Aumenta tu Sombra permanentemente' },
  { id: 'debilitating', nombre: 'Debilitante', descripcion: 'Desventaja en pruebas/TS de una característica' }
];

// =============== ART OBJECTS ===============
const ART_OBJECTS = [
  'Zafiro negro translúcido', 'Diamante azul-blanco', 'Jacinto naranja fuego', 'Rubí rojo profundo',
  'Máscara de terciopelo bordada en plata', 'Cáliz de cobre con filigrana de plata',
  'Dados de hueso grabados', 'Espejos con marco pintado', 'Pañuelo de seda bordado',
  'Relicario con retrato pintado', 'Anillo de oro con jaspe sanguíneo', 'Estatuilla de marfil tallada',
  'Brazalete de oro grande', 'Collar de plata con colgante', 'Corona de bronce',
  'Bata de seda bordada en oro', 'Tapiz grande y de calidad', 'Jarra de latón con jade',
  'Figuritas de turquesa', 'Jaula de pájaro de oro con electro', 'Cáliz de plata con piedras de luna',
  'Espada revestida en plata con azabache', 'Arpa de madera con marfil y zirconitas',
  'Ídolo de oro pequeño', 'Peine dorado en forma de dragón con granates',
  'Tapón de vino con amatistas', 'Daga ceremonial de electro con perla negra',
  'Broche de oro y plata', 'Estatuilla de obsidiana con oro', 'Máscara de guerra de oro pintada',
  'Cadena de oro fino con ópalo de fuego', 'Obra maestra de pintura antigua',
  'Manto de terciopelo con piedras de luna', 'Brazalete de platino con zafiro',
  'Guante bordado con gemas', 'Ajorca de tobillo enjoyada', 'Caja de música de oro',
  'Diadema con aguamarinas', 'Parche de ojo con zafiro y piedras de luna',
  'Collar de perlas rosas', 'Corona de oro con piedras preciosas', 'Anillo de platino con gemas',
  'Estatuilla de oro con rubíes', 'Copa de oro con esmeraldas', 'Joyero de oro con platino',
  'Sarcófago de niño pintado en oro', 'Tablero de jade con piezas de oro',
  'Cuerno de marfil con piedras preciosas'
];

// =============== HELPER FUNCTIONS ===============
const rollDice = (notation) => {
  if (!notation || notation === '0') return { total: 0, rolls: [], notation };
  const parts = notation.split(/([+-])/);
  let total = 0;
  let rolls = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part === '+' || part === '-') continue;
    const sign = i > 0 && parts[i-1] === '-' ? -1 : 1;
    if (part.includes('d')) {
      const [count, sides] = part.split('d').map(Number);
      for (let j = 0; j < count; j++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll * sign;
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) total += num * sign;
    }
  }
  return { total: Math.max(0, total), rolls, notation };
};

const rollD20 = () => Math.floor(Math.random() * 20) + 1;
const generateId = () => Math.random().toString(36).substr(2, 9);

// Deep clone helper
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

// =============== MAIN COMPONENT ===============
const TreasureSystemSection = () => {
  const [selectedTier, setSelectedTier] = useState('minor');
  const [generatedTreasure, setGeneratedTreasure] = useState(null);
  const [treasureLog, setTreasureLog] = useState([]);
  const [showCurseChance, setShowCurseChance] = useState(false);
  
  // Editable configuration - CORE STATE
  const [treasureTiers, setTreasureTiers] = useState(deepClone(DEFAULT_TREASURE_TIERS));
  const [coinTypes, setCoinTypes] = useState(deepClone(DEFAULT_COIN_TYPES));
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [configModified, setConfigModified] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // DM Treasure Index
  const [treasureIndex, setTreasureIndex] = useState([]);
  
  // Famous weapon builder
  const [weaponBuilder, setWeaponBuilder] = useState({
    nombre: '',
    tipo: 'arma',
    manufactura: 'dwarven_khazad',
    cualidades: [],
    perdiciones: [],
    historia: '',
    precioBase: 100
  });
  
  // Load configuration from backend on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [configRes, indexRes] = await Promise.all([
          api.get('/data/treasure-config'),
          api.get('/data/treasure-index')
        ]);
        
        // Load custom config if exists
        if (configRes.data?.tiers) {
          setTreasureTiers(configRes.data.tiers);
        }
        if (configRes.data?.coinTypes) {
          setCoinTypes(configRes.data.coinTypes);
        }
        
        // Load treasure index
        if (indexRes.data?.items) {
          setTreasureIndex(indexRes.data.items);
        }
      } catch (err) {
        console.log('Loading default treasure config');
      } finally {
        setLoadingConfig(false);
      }
    };
    loadConfig();
  }, []);
  
  // Save configuration to backend
  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.put('/data/treasure-config', {
        tiers: treasureTiers,
        coinTypes: coinTypes
      });
      setConfigModified(false);
      toast.success('Configuración de tesoros guardada');
    } catch (err) {
      toast.error('Error al guardar la configuración');
    } finally {
      setSavingConfig(false);
    }
  };
  
  // Reset configuration to defaults
  const resetConfig = async () => {
    if (!window.confirm('¿Restablecer toda la configuración de tesoros a los valores por defecto?')) return;
    
    try {
      await api.delete('/data/treasure-config');
      setTreasureTiers(deepClone(DEFAULT_TREASURE_TIERS));
      setCoinTypes(deepClone(DEFAULT_COIN_TYPES));
      setConfigModified(false);
      toast.success('Configuración restablecida');
    } catch (err) {
      toast.error('Error al restablecer');
    }
  };
  
  // Save treasure index
  const saveIndex = async () => {
    try {
      await api.put('/data/treasure-index', { items: treasureIndex });
      toast.success('Índice de tesoros guardado');
    } catch (err) {
      toast.error('Error al guardar');
    }
  };
  
  // Update tier configuration
  const updateTierConfig = (tierId, field, value) => {
    setTreasureTiers(prev => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [field]: value
      }
    }));
    setConfigModified(true);
  };
  
  // Update coin config for a specific tier
  const updateTierCoin = (tierId, coinId, field, value) => {
    setTreasureTiers(prev => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        monedas: prev[tierId].monedas.map(c => 
          c.id === coinId ? { ...c, [field]: value } : c
        )
      }
    }));
    setConfigModified(true);
  };
  
  // Update global coin type
  const updateCoinType = (coinId, field, value) => {
    setCoinTypes(prev => prev.map(c => 
      c.id === coinId ? { ...c, [field]: value } : c
    ));
    setConfigModified(true);
  };
  
  // Add new coin type
  const addCoinType = () => {
    const newId = `custom_${generateId()}`;
    const newCoin = {
      id: newId,
      nombre: 'Nueva Moneda',
      abrev: 'nm',
      color: 'bg-purple-500',
      valorEnOro: 0.5
    };
    setCoinTypes(prev => [...prev, newCoin]);
    
    // Add to all tiers
    setTreasureTiers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(tierId => {
        updated[tierId] = {
          ...updated[tierId],
          monedas: [...updated[tierId].monedas, { id: newId, dado: '0', activo: false }]
        };
      });
      return updated;
    });
    setConfigModified(true);
  };
  
  // Remove coin type
  const removeCoinType = (coinId) => {
    // Don't allow removing default coins
    if (['tin', 'copper', 'silver', 'gold'].includes(coinId)) {
      toast.error('No se pueden eliminar las monedas predefinidas');
      return;
    }
    
    setCoinTypes(prev => prev.filter(c => c.id !== coinId));
    setTreasureTiers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(tierId => {
        updated[tierId] = {
          ...updated[tierId],
          monedas: updated[tierId].monedas.filter(c => c.id !== coinId)
        };
      });
      return updated;
    });
    setConfigModified(true);
  };
  
  // Calculate weapon price
  const calculateWeaponPrice = useCallback((weapon) => {
    let precio = weapon.precioBase || 100;
    
    weapon.cualidades?.forEach(qualId => {
      const qual = WEAPON_QUALITIES.find(q => q.id === qualId);
      if (qual) precio *= (qual.multiplicador / 100);
    });
    
    const manufactura = MANUFACTURES.find(m => m.id === weapon.manufactura);
    const perditionList = manufactura?.tipo === 'elfica' ? PERDITIONS.elven : PERDITIONS.numenorean;
    weapon.perdiciones?.forEach(perdId => {
      const perd = perditionList?.find(p => p.id === perdId);
      if (perd) precio += perd.coste;
    });
    
    if (manufactura) precio *= manufactura.multiplicadorPrecio;
    
    return Math.round(precio);
  }, []);
  
  // Add item to index
  const addToIndex = useCallback(() => {
    if (!weaponBuilder.nombre) {
      toast.error('Introduce un nombre');
      return;
    }
    
    const newItem = {
      id: generateId(),
      ...weaponBuilder,
      precio: calculateWeaponPrice(weaponBuilder),
      createdAt: new Date().toISOString()
    };
    
    setTreasureIndex(prev => [...prev, newItem]);
    setWeaponBuilder({
      nombre: '', tipo: 'arma', manufactura: 'dwarven_khazad',
      cualidades: [], perdiciones: [], historia: '', precioBase: 100
    });
    toast.success(`"${newItem.nombre}" añadido al índice`);
  }, [weaponBuilder, calculateWeaponPrice]);
  
  // Remove from index
  const removeFromIndex = (id) => {
    setTreasureIndex(prev => prev.filter(item => item.id !== id));
    toast.info('Objeto eliminado del índice');
  };
  
  // Generate treasure using current configuration
  const generateTreasure = useCallback(() => {
    const tier = treasureTiers[selectedTier];
    if (!tier) return;
    
    // Roll coins based on tier configuration
    const coinResults = [];
    let totalValue = 0;
    
    tier.monedas.forEach(coinConfig => {
      if (coinConfig.activo && coinConfig.dado && coinConfig.dado !== '0') {
        const roll = rollDice(coinConfig.dado);
        const coinType = coinTypes.find(c => c.id === coinConfig.id);
        
        coinResults.push({
          tipo: coinType?.nombre || coinConfig.id,
          abrev: coinType?.abrev || coinConfig.id,
          color: coinType?.color || 'bg-gray-500',
          dado: coinConfig.dado,
          rolls: roll.rolls,
          total: roll.total
        });
        
        // Convert to gold equivalent
        const multiplier = coinType?.valorEnOro || 0.1;
        totalValue += roll.total * multiplier;
      }
    });
    
    // Magic treasure rolls
    const magicRolls = [];
    let totalShadow = 0;
    const magicItems = [];
    
    for (let i = 0; i < tier.tiradas; i++) {
      const d20 = rollD20();
      const tableRow = MAGIC_TREASURE_TABLE.find(row => d20 >= row.min && d20 <= row.max);
      const shadowRoll = rollDice(tableRow.sombraDado);
      
      magicRolls.push({ d20, resultado: tableRow.resultado, descripcion: tableRow.descripcion, sombra: shadowRoll.total });
      totalShadow += shadowRoll.total;
      
      if (tableRow.resultado !== 'ninguno') {
        const item = generateMagicItem(tableRow.resultado);
        magicItems.push(item);
      }
    }
    
    const artObject = ART_OBJECTS[Math.floor(Math.random() * ART_OBJECTS.length)];
    const artValue = Math.floor(Math.random() * (selectedTier === 'wondrous' ? 25 : selectedTier === 'major' ? 15 : 5)) + 1;
    
    let curse = null;
    if (showCurseChance && Math.random() < 0.1) {
      curse = CURSES[Math.floor(Math.random() * CURSES.length)];
    }
    
    const treasure = {
      tier: tier.nombre, 
      tierColor: tier.color, 
      coinResults,
      totalValueGold: Math.round(totalValue * 100) / 100,
      magicRolls, 
      magicItems, 
      totalShadow, 
      cdSombra: tier.cdSombra,
      artObject, 
      artValue, 
      curse, 
      timestamp: new Date().toLocaleTimeString()
    };
    
    setGeneratedTreasure(treasure);
    setTreasureLog(prev => [treasure, ...prev.slice(0, 9)]);
    toast.success(`¡Tesoro ${tier.nombre} generado!`);
  }, [selectedTier, treasureTiers, coinTypes, showCurseChance, treasureIndex]);
  
  const generateMagicItem = (tipo) => {
    if (tipo === 'artefacto') {
      const blessingRoll = Math.min(19, rollD20());
      const blessing = BLESSINGS.find(b => b.d20 === blessingRoll) || BLESSINGS[0];
      return { tipo: 'Artefacto Maravilloso', bendiciones: [blessing], descripcion: `Bendición de ${blessing.habilidad}` };
    } else if (tipo === 'extraordinario') {
      const blessings = [];
      while (blessings.length < 2) {
        let roll = Math.min(19, rollD20());
        const blessing = BLESSINGS.find(b => b.d20 === roll);
        if (blessing && !blessings.find(b => b.habilidad === blessing.habilidad)) {
          blessings.push(blessing);
        }
      }
      return { tipo: 'Objeto Extraordinario', bendiciones: blessings, descripcion: `Bendiciones de ${blessings.map(b => b.habilidad).join(' y ')}` };
    } else if (tipo === 'famoso') {
      if (treasureIndex.length > 0 && Math.random() < 0.5) {
        const randomItem = treasureIndex[Math.floor(Math.random() * treasureIndex.length)];
        return { tipo: 'Del Índice del DM', ...randomItem };
      }
      const isWeapon = Math.random() > 0.3;
      const manufacture = MANUFACTURES[Math.floor(Math.random() * MANUFACTURES.length)];
      return { tipo: isWeapon ? 'Arma Famosa' : 'Armadura Famosa', manufactura: manufacture.nombre, descripcion: `De manufactura ${manufacture.nombre}` };
    }
    return { tipo: 'Desconocido' };
  };
  
  // Get available qualities for selected manufacture
  const getAvailableQualities = () => {
    return WEAPON_QUALITIES.filter(q => 
      q.manufactura.includes('any') || q.manufactura.includes(weaponBuilder.manufactura)
    );
  };
  
  // Get available perditions
  const getAvailablePerditions = () => {
    const manufactura = MANUFACTURES.find(m => m.id === weaponBuilder.manufactura);
    if (manufactura?.tipo === 'elfica') return PERDITIONS.elven;
    if (manufactura?.tipo === 'humana') return PERDITIONS.numenorean;
    return [];
  };
  
  // Get current tier configuration
  const currentTier = treasureTiers[selectedTier] || DEFAULT_TREASURE_TIERS[selectedTier];
  
  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
        <span className="ml-3 text-muted-foreground">Cargando configuración...</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[hsl(var(--gold))] flex items-center justify-center gap-2">
          <Gem className="w-6 h-6" /> Sistema de Tesoros
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generador completo con configuración editable
        </p>
        {configModified && (
          <Badge variant="destructive" className="mt-2">
            Cambios sin guardar
          </Badge>
        )}
      </div>
      
      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="generator">Generador</TabsTrigger>
          <TabsTrigger value="config" className="relative">
            Configurar
            {configModified && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </TabsTrigger>
          <TabsTrigger value="famous">Armas Famosas</TabsTrigger>
          <TabsTrigger value="index">Índice DM</TabsTrigger>
          <TabsTrigger value="prices">Precios</TabsTrigger>
          <TabsTrigger value="reference">Tablas</TabsTrigger>
        </TabsList>
        
        {/* GENERATOR TAB */}
        <TabsContent value="generator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Gift className="w-5 h-5" /> Generar Tesoro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tier Selection */}
                <div>
                  <Label className="text-sm">Nivel de Tesoro</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {Object.values(treasureTiers).map(tier => (
                      <Button key={tier.id} variant={selectedTier === tier.id ? 'default' : 'outline'}
                        onClick={() => setSelectedTier(tier.id)} className={selectedTier === tier.id ? tier.color : ''}>
                        {tier.nombre}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Current Configuration Summary */}
                <div className="bg-black/20 p-3 rounded text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[hsl(var(--gold))]">Configuración Actual: {currentTier.nombre}</span>
                    <Badge variant="outline">{currentTier.tiradas}d20</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Monedas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentTier.monedas.filter(c => c.activo && c.dado !== '0').map(c => {
                          const coinType = coinTypes.find(ct => ct.id === c.id);
                          return (
                            <Badge key={c.id} className={`${coinType?.color} text-xs`}>
                              {c.dado} {coinType?.abrev}
                            </Badge>
                          );
                        })}
                        {currentTier.monedas.filter(c => c.activo && c.dado !== '0').length === 0 && (
                          <span className="text-muted-foreground text-xs">Ninguna</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CD Sombra:</span> <strong>{currentTier.cdSombra}</strong>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox id="curse" checked={showCurseChance} onCheckedChange={setShowCurseChance} />
                  <Label htmlFor="curse" className="text-sm">Posibilidad de maldición (10%)</Label>
                </div>
                
                <Button onClick={generateTreasure} className="w-full h-12" data-testid="generate-treasure-btn">
                  <Dice6 className="w-5 h-5 mr-2" /> ¡Generar Tesoro!
                </Button>
              </CardContent>
            </Card>
            
            {/* Result Card */}
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Resultado</CardTitle></CardHeader>
              <CardContent>
                {generatedTreasure ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Badge className={generatedTreasure.tierColor}>Tesoro {generatedTreasure.tier}</Badge>
                      <span className="text-xs text-muted-foreground">{generatedTreasure.timestamp}</span>
                    </div>
                    
                    {/* Coin Results */}
                    {generatedTreasure.coinResults?.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-sm">Monedas encontradas:</p>
                        {generatedTreasure.coinResults.map((coin, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-black/20 rounded">
                            <div className="flex items-center gap-2">
                              <Badge className={coin.color}>{coin.abrev}</Badge>
                              <span className="text-sm">{coin.tipo}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-lg">{coin.total}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({coin.dado}: [{coin.rolls.join('+')}])
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="text-right text-sm text-muted-foreground">
                          ≈ <strong className="text-yellow-400">{generatedTreasure.totalValueGold} mo</strong> equivalente
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-purple-500/10 p-2 rounded text-sm">
                      <p className="text-muted-foreground">{generatedTreasure.artObject}</p>
                      <p className="text-xs text-yellow-400">Valor: {generatedTreasure.artValue} mo</p>
                    </div>
                    
                    {generatedTreasure.magicRolls.map((roll, idx) => (
                      <div key={idx} className={`p-2 rounded text-sm ${
                        roll.resultado === 'ninguno' ? 'bg-gray-500/20' : 'bg-green-500/20'
                      }`}>
                        <div className="flex justify-between">
                          <span>d20: <strong>{roll.d20}</strong></span>
                          <Badge variant="outline">{roll.descripcion}</Badge>
                        </div>
                      </div>
                    ))}
                    
                    {generatedTreasure.magicItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/30]">
                        <p className="font-bold">{item.tipo}</p>
                        <p className="text-sm text-muted-foreground">{item.descripcion}</p>
                        {item.bendiciones && <div className="mt-1">{item.bendiciones.map((b,i) => <Badge key={i} variant="outline" className="mr-1">{b.habilidad}</Badge>)}</div>}
                        {item.nombre && <p className="text-sm font-medium text-[hsl(var(--gold))] mt-1">"{item.nombre}"</p>}
                      </div>
                    ))}
                    
                    {generatedTreasure.curse && (
                      <div className="p-3 bg-red-500/20 rounded border border-red-500/30">
                        <div className="flex items-center gap-2 text-red-400"><Skull className="w-4 h-4" /><span className="font-bold">MALDICIÓN</span></div>
                        <p className="font-medium">{generatedTreasure.curse.nombre}</p>
                        <p className="text-sm text-muted-foreground">{generatedTreasure.curse.descripcion}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Genera un tesoro para ver el resultado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* CONFIGURATION TAB - NEW! */}
        <TabsContent value="config">
          <div className="space-y-6">
            {/* Save/Reset Buttons */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[hsl(var(--gold))] flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Configuración del Generador
                </h3>
                <p className="text-sm text-muted-foreground">
                  Personaliza los tipos de moneda, dados y tiradas mágicas por nivel
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetConfig} data-testid="reset-config-btn">
                  <RefreshCw className="w-4 h-4 mr-2" /> Restablecer
                </Button>
                <Button 
                  onClick={saveConfig} 
                  disabled={!configModified || savingConfig}
                  className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/90"
                  data-testid="save-config-btn"
                >
                  {savingConfig ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar Cambios
                </Button>
              </div>
            </div>
            
            {/* Coin Types Editor */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                    <Coins className="w-5 h-5" /> Tipos de Moneda
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addCoinType}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir Moneda
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coinTypes.map(coin => (
                    <div key={coin.id} className="flex items-center gap-3 p-3 bg-black/20 rounded">
                      <Badge className={coin.color}>{coin.abrev}</Badge>
                      <Input 
                        value={coin.nombre}
                        onChange={(e) => updateCoinType(coin.id, 'nombre', e.target.value)}
                        className="w-40"
                        placeholder="Nombre"
                      />
                      <Input 
                        value={coin.abrev}
                        onChange={(e) => updateCoinType(coin.id, 'abrev', e.target.value)}
                        className="w-20"
                        placeholder="Abrev"
                      />
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Valor (mo):</Label>
                        <Input 
                          type="number"
                          step="0.001"
                          value={coin.valorEnOro}
                          onChange={(e) => updateCoinType(coin.id, 'valorEnOro', parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                      <Select 
                        value={coin.color} 
                        onValueChange={(v) => updateCoinType(coin.id, 'color', v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bg-gray-500">Gris</SelectItem>
                          <SelectItem value="bg-orange-700">Bronce</SelectItem>
                          <SelectItem value="bg-slate-400">Plata</SelectItem>
                          <SelectItem value="bg-yellow-500">Oro</SelectItem>
                          <SelectItem value="bg-cyan-400">Cyan</SelectItem>
                          <SelectItem value="bg-purple-500">Púrpura</SelectItem>
                          <SelectItem value="bg-cyan-500">Cyan Oscuro</SelectItem>
                          <SelectItem value="bg-pink-500">Rosa</SelectItem>
                          <SelectItem value="bg-emerald-500">Esmeralda</SelectItem>
                        </SelectContent>
                      </Select>
                      {!['tin', 'copper', 'silver', 'gold'].includes(coin.id) && (
                        <Button variant="ghost" size="sm" onClick={() => removeCoinType(coin.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Tier Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Object.entries(treasureTiers).map(([tierId, tier]) => (
                <Card key={tierId} className="card-parchment">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge className={tier.color}>{tier.nombre}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tier Settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tiradas Mágicas (d20)</Label>
                        <Input 
                          type="number"
                          min="0"
                          max="10"
                          value={tier.tiradas}
                          onChange={(e) => updateTierConfig(tierId, 'tiradas', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CD Sombra</Label>
                        <Input 
                          type="number"
                          min="5"
                          max="30"
                          value={tier.cdSombra}
                          onChange={(e) => updateTierConfig(tierId, 'cdSombra', parseInt(e.target.value) || 10)}
                        />
                      </div>
                    </div>
                    
                    {/* Coin Rolls for this Tier */}
                    <div>
                      <Label className="text-xs font-bold text-[hsl(var(--gold))]">Tiradas de Monedas</Label>
                      <div className="space-y-2 mt-2">
                        {tier.monedas.map(coinConfig => {
                          const coinType = coinTypes.find(c => c.id === coinConfig.id);
                          if (!coinType) return null;
                          return (
                            <div key={coinConfig.id} className="flex items-center gap-2">
                              <Checkbox 
                                checked={coinConfig.activo}
                                onCheckedChange={(checked) => updateTierCoin(tierId, coinConfig.id, 'activo', checked)}
                              />
                              <Badge className={`${coinType.color} w-12 justify-center`}>
                                {coinType.abrev}
                              </Badge>
                              <Input 
                                value={coinConfig.dado}
                                onChange={(e) => updateTierCoin(tierId, coinConfig.id, 'dado', e.target.value)}
                                placeholder="ej: 2d8"
                                className="flex-1 h-8"
                                disabled={!coinConfig.activo}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Help Text */}
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-4">
                <h4 className="font-medium text-blue-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Ayuda
                </h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• <strong>Formato de dados:</strong> Usa notación estándar como <code>2d8</code>, <code>3d6+5</code>, <code>1d10-2</code></li>
                  <li>• <strong>Tasa de cambio:</strong> 10 me = 1 mc | 10 mc = 1 mp | 100 mp = 1 mo | 100 mo = 1 mm</li>
                  <li>• <strong>Tiradas mágicas:</strong> Cuántas veces se tira en la tabla de tesoro mágico</li>
                  <li>• <strong>CD Sombra:</strong> Dificultad de la prueba de Avaricia al encontrar el tesoro</li>
                  <li>• Los cambios se guardan en la base de datos y persisten entre sesiones</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* FAMOUS WEAPONS TAB */}
        <TabsContent value="famous">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Sword className="w-5 h-5" /> Crear Arma/Armadura Famosa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={weaponBuilder.nombre} onChange={(e) => setWeaponBuilder({...weaponBuilder, nombre: e.target.value})} placeholder="Ej: Glamdring, Orcrist, Andúril" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={weaponBuilder.tipo} onValueChange={(v) => setWeaponBuilder({...weaponBuilder, tipo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arma">Arma</SelectItem>
                        <SelectItem value="armadura">Armadura</SelectItem>
                        <SelectItem value="escudo">Escudo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Precio Base (mp)</Label>
                    <Input type="number" value={weaponBuilder.precioBase} onChange={(e) => setWeaponBuilder({...weaponBuilder, precioBase: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                
                <div>
                  <Label>Manufactura</Label>
                  <Select value={weaponBuilder.manufactura} onValueChange={(v) => setWeaponBuilder({...weaponBuilder, manufactura: v, cualidades: [], perdiciones: []})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MANUFACTURES.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {weaponBuilder.tipo === 'arma' && (
                  <>
                    <div>
                      <Label className="text-sm">Cualidades Encantadas (máx. 3)</Label>
                      <ScrollArea className="h-32 mt-2 border rounded p-2">
                        {getAvailableQualities().map(qual => (
                          <div key={qual.id} className="flex items-center gap-2 py-1">
                            <Checkbox 
                              checked={weaponBuilder.cualidades.includes(qual.id)}
                              disabled={!weaponBuilder.cualidades.includes(qual.id) && weaponBuilder.cualidades.length >= 3}
                              onCheckedChange={(checked) => {
                                if (checked) setWeaponBuilder({...weaponBuilder, cualidades: [...weaponBuilder.cualidades, qual.id]});
                                else setWeaponBuilder({...weaponBuilder, cualidades: weaponBuilder.cualidades.filter(q => q !== qual.id)});
                              }}
                            />
                            <span className="text-sm flex-1">{qual.nombre}</span>
                            <Badge variant="outline" className="text-xs">×{qual.multiplicador}%</Badge>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                    
                    {getAvailablePerditions().length > 0 && (
                      <div>
                        <Label className="text-sm">Perdiciones (Banes)</Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {getAvailablePerditions().map(perd => (
                            <Badge 
                              key={perd.id}
                              variant={weaponBuilder.perdiciones.includes(perd.id) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                if (weaponBuilder.perdiciones.includes(perd.id)) {
                                  setWeaponBuilder({...weaponBuilder, perdiciones: weaponBuilder.perdiciones.filter(p => p !== perd.id)});
                                } else {
                                  setWeaponBuilder({...weaponBuilder, perdiciones: [...weaponBuilder.perdiciones, perd.id]});
                                }
                              }}
                            >
                              {perd.nombre} (+{perd.coste} mo)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {weaponBuilder.tipo === 'armadura' && (
                  <div>
                    <Label className="text-sm">Cualidades de Armadura</Label>
                    <ScrollArea className="h-32 mt-2 border rounded p-2">
                      {ARMOR_QUALITIES.map(qual => (
                        <div key={qual.id} className="flex items-center gap-2 py-1">
                          <Checkbox 
                            checked={weaponBuilder.cualidades.includes(qual.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setWeaponBuilder({...weaponBuilder, cualidades: [...weaponBuilder.cualidades, qual.id]});
                              else setWeaponBuilder({...weaponBuilder, cualidades: weaponBuilder.cualidades.filter(q => q !== qual.id)});
                            }}
                          />
                          <span className="text-sm flex-1">{qual.nombre}</span>
                          <Badge variant="outline" className="text-xs">+{qual.coste} mp</Badge>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
                
                {weaponBuilder.tipo === 'escudo' && (
                  <div>
                    <Label className="text-sm">Cualidades de Escudo</Label>
                    <div className="space-y-1 mt-2">
                      {SHIELD_QUALITIES.map(qual => (
                        <div key={qual.id} className="flex items-center gap-2 p-1 bg-black/10 rounded">
                          <Checkbox 
                            checked={weaponBuilder.cualidades.includes(qual.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setWeaponBuilder({...weaponBuilder, cualidades: [qual.id]});
                              else setWeaponBuilder({...weaponBuilder, cualidades: []});
                            }}
                          />
                          <span className="text-sm flex-1">{qual.nombre}</span>
                          <Badge variant="outline" className="text-xs">×{qual.multiplicador * 100}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div>
                  <Label>Historia/Notas</Label>
                  <Textarea value={weaponBuilder.historia} onChange={(e) => setWeaponBuilder({...weaponBuilder, historia: e.target.value})} placeholder="Historia del objeto, cómo fue forjado, quién lo empuñó..." className="h-20" />
                </div>
                
                <div className="bg-yellow-500/20 p-3 rounded border border-yellow-500/30">
                  <div className="flex justify-between items-center">
                    <span>Precio estimado:</span>
                    <span className="text-xl font-bold text-yellow-400">{calculateWeaponPrice(weaponBuilder)} mo</span>
                  </div>
                </div>
                
                <Button onClick={addToIndex} className="w-full" data-testid="add-to-index-btn">
                  <Plus className="w-4 h-4 mr-2" /> Añadir al Índice del DM
                </Button>
              </CardContent>
            </Card>
            
            {/* Reference Tables */}
            <div className="space-y-4">
              <Card className="card-parchment">
                <CardHeader className="pb-2"><CardTitle className="text-lg">Latencia por Nivel</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">Las cualidades se revelan según el nivel del héroe:</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between p-2 bg-black/10 rounded"><span>Nivel 1-4</span><Badge>1 cualidad</Badge></div>
                    <div className="flex justify-between p-2 bg-black/10 rounded"><span>Nivel 5-8</span><Badge>2 cualidades</Badge></div>
                    <div className="flex justify-between p-2 bg-black/10 rounded"><span>Nivel 9+</span><Badge>3 cualidades</Badge></div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="card-parchment">
                <CardHeader className="pb-2"><CardTitle className="text-lg">Perdiciones por Manufactura</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-blue-500/10 rounded">
                      <p className="font-bold text-blue-400">Élfica (Eregion/Beleriand)</p>
                      <p className="text-xs text-muted-foreground">1 perdición: orcos, lobos, arañas, o todos</p>
                    </div>
                    <div className="p-2 bg-yellow-500/10 rounded">
                      <p className="font-bold text-yellow-400">Númenóreana (Oesternesse)</p>
                      <p className="text-xs text-muted-foreground">2 perdiciones: orcos, troles, lobos, hombres malignos, muertos vivientes</p>
                    </div>
                    <div className="p-2 bg-orange-500/10 rounded">
                      <p className="font-bold text-orange-400">Enana</p>
                      <p className="text-xs text-muted-foreground">Sin perdiciones típicas, pero cualidades rúnicas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* DM INDEX TAB */}
        <TabsContent value="index">
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Índice de Tesoros del DM
                </CardTitle>
                <Button onClick={saveIndex} variant="outline" data-testid="save-index-btn">
                  <Save className="w-4 h-4 mr-2" /> Guardar Índice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Pre-crea objetos mágicos específicos para tu campaña. Cuando se genere un tesoro con "Arma/Armadura Famosa", 
                hay 50% de probabilidad de que aparezca algo de este índice.
              </p>
              
              {treasureIndex.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed rounded-lg">
                  <Sword className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No hay objetos en el índice</p>
                  <p className="text-sm text-muted-foreground mt-1">Crea uno en la pestaña "Armas Famosas"</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {treasureIndex.map(item => (
                      <div key={item.id} className="p-4 bg-black/20 rounded border border-[hsl(var(--gold))/30] group">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-[hsl(var(--gold))]">{item.nombre}</h4>
                            <p className="text-sm text-muted-foreground">
                              {item.tipo === 'arma' ? '⚔️ Arma' : item.tipo === 'armadura' ? '🛡️ Armadura' : '🔰 Escudo'} • 
                              {MANUFACTURES.find(m => m.id === item.manufactura)?.nombre || item.manufactura}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-600">{item.precio} mo</Badge>
                            <Button variant="ghost" size="sm" onClick={() => removeFromIndex(item.id)} className="opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                        
                        {item.cualidades?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.cualidades.map((qId, idx) => {
                              const qual = [...WEAPON_QUALITIES, ...ARMOR_QUALITIES, ...SHIELD_QUALITIES].find(q => q.id === qId);
                              return <Badge key={idx} variant="outline" className="text-xs">{qual?.nombre || qId}</Badge>;
                            })}
                          </div>
                        )}
                        
                        {item.perdiciones?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.perdiciones.map((pId, idx) => {
                              const perd = [...PERDITIONS.elven, ...PERDITIONS.numenorean].find(p => p.id === pId);
                              return <Badge key={idx} variant="destructive" className="text-xs">{perd?.nombre || pId}</Badge>;
                            })}
                          </div>
                        )}
                        
                        {item.historia && <p className="text-xs text-muted-foreground mt-2 italic">"{item.historia}"</p>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* PRICES TAB */}
        <TabsContent value="prices">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Bendiciones (Coste en mo)</CardTitle></CardHeader>
              <CardContent>
                <div className="text-xs mb-2 text-muted-foreground">Según modificador PB (+2, +3, +4)</div>
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left"><th>Habilidad</th><th>+2</th><th>+3</th><th>+4</th></tr></thead>
                    <tbody>
                      {BLESSINGS.filter(b => b.d20 !== 20).map(b => (
                        <tr key={b.d20} className="border-t border-white/10">
                          <td>{b.habilidad}</td>
                          <td>{b.coste[2]}</td>
                          <td>{b.coste[3]}</td>
                          <td>{b.coste[4]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Cualidades de Arma (×% precio base)</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-1 text-sm">
                    {WEAPON_QUALITIES.slice(0, 15).map(q => (
                      <div key={q.id} className="flex justify-between p-1 bg-black/10 rounded">
                        <span>{q.nombre}</span>
                        <Badge variant="outline">×{q.multiplicador * 100}%</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Cualidades de Armadura (+ mp)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {ARMOR_QUALITIES.map(q => (
                    <div key={q.id} className="flex justify-between p-2 bg-black/10 rounded">
                      <span>{q.nombre}</span>
                      <Badge variant="outline">+{q.coste} mp</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Cualidades de Escudo (×%)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {SHIELD_QUALITIES.map(q => (
                    <div key={q.id} className="flex justify-between p-2 bg-black/10 rounded">
                      <span>{q.nombre}</span>
                      <Badge variant="outline">×{q.multiplicador * 100}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* REFERENCE TAB */}
        <TabsContent value="reference">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Niveles de Tesoro (Actuales)</CardTitle></CardHeader>
              <CardContent>
                {Object.values(treasureTiers).map(tier => (
                  <div key={tier.id} className="p-3 bg-black/10 rounded mb-2">
                    <Badge className={tier.color}>{tier.nombre}</Badge>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <span>Tiradas: {tier.tiradas}d20</span>
                      <span>CD: {tier.cdSombra}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tier.monedas.filter(c => c.activo && c.dado !== '0').map(c => {
                        const coinType = coinTypes.find(ct => ct.id === c.id);
                        return (
                          <Badge key={c.id} variant="outline" className="text-xs">
                            {c.dado} {coinType?.abrev}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Tesoro Mágico (d20)</CardTitle></CardHeader>
              <CardContent>
                {MAGIC_TREASURE_TABLE.map((row, idx) => (
                  <div key={idx} className={`p-2 rounded mb-1 text-sm ${row.resultado === 'ninguno' ? 'bg-gray-500/20' : 'bg-green-500/20'}`}>
                    <div className="flex justify-between">
                      <Badge variant="outline">{row.min}-{row.max}</Badge>
                      <span>{row.descripcion}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Maldiciones</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {CURSES.map(c => (
                    <div key={c.id} className="p-2 bg-red-500/10 rounded mb-1">
                      <p className="font-medium text-sm">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">{c.descripcion}</p>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card className="card-parchment">
              <CardHeader className="pb-2"><CardTitle className="text-lg text-[hsl(var(--gold))]">Bendiciones (d20)</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {BLESSINGS.map(b => (
                    <div key={b.d20} className="flex justify-between p-1 bg-black/10 rounded mb-1 text-sm">
                      <span><Badge variant="outline" className="mr-2">{b.d20}</Badge>{b.habilidad}</span>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TreasureSystemSection;
