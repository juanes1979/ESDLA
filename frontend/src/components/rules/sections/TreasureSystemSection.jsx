/**
 * Treasure System Section
 * Complete treasure generation system for LOTR 5e RPG
 * Includes: treasure tiers, magic items, blessings, famous weapons/armor, curses
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
import { Progress } from '@/components/ui/progress';
import { 
  Gem, Crown, Sword, Shield, Sparkles, Skull, Coins, 
  Dice6, Gift, AlertTriangle, Star, Moon, Eye, RefreshCw,
  ChevronDown, ChevronUp, Plus, Trash2, Save, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// =============== TREASURE TIERS ===============
const TREASURE_TIERS = {
  minor: {
    id: 'minor',
    nombre: 'Menor',
    valorBase: 9,
    valorDado: '2d8',
    tiradas: 1,
    cdSombra: 10,
    color: 'bg-green-600'
  },
  major: {
    id: 'major',
    nombre: 'Mayor',
    valorBase: 16,
    valorDado: '3d10',
    cdSombra: 15,
    tiradas: 2,
    color: 'bg-blue-600'
  },
  wondrous: {
    id: 'wondrous',
    nombre: 'Maravilloso',
    valorBase: 26,
    valorDado: '4d12',
    cdSombra: 20,
    tiradas: 3,
    color: 'bg-purple-600'
  }
};

// =============== MAGIC TREASURE TABLE (d20) ===============
const MAGIC_TREASURE_TABLE = [
  { min: 1, max: 14, resultado: 'ninguno', descripcion: 'Ningún tesoro mágico', sombraDado: '1d4-2' },
  { min: 15, max: 17, resultado: 'artefacto', descripcion: 'Artefacto maravilloso (1 bendición)', sombraDado: '1d6-3' },
  { min: 18, max: 19, resultado: 'extraordinario', descripcion: 'Objeto extraordinario (2 bendiciones)', sombraDado: '1d8-4' },
  { min: 20, max: 20, resultado: 'famoso', descripcion: 'Arma o armadura famosa', sombraDado: '1d8-4' }
];

// =============== BLESSINGS TABLE (d20) ===============
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

// =============== PRECIOUS OBJECTS ===============
const JEWELRY_FORMS = [
  { d6: 1, nombre: 'Anillo', precioBase: 200 },
  { d6: 2, nombre: 'Broche', precioBase: 600 },
  { d6: 3, nombre: 'Collar', precioBase: 1200 },
  { d6: 4, nombre: 'Diadema o Corona', precioBase: 3000 },
  { d6: 5, nombre: 'Corona', precioBase: 12000 },
  { d6: 6, nombre: 'Cinturón/Cadena/Brazalete', precioBase: 1000 }
];

const JEWELRY_MATERIALS = [
  { nombre: 'Oro', multiplicador: 1 },
  { nombre: 'Plata', multiplicador: 0.1 },
  { nombre: 'Bronce', multiplicador: 0.05 },
  { nombre: 'Platino', multiplicador: 2 },
  { nombre: 'Mithril', multiplicador: 10 }
];

const GEMSTONES = [
  { d6: 1, nombre: 'Perla', precioExtra: 240 },
  { d6: 2, nombre: 'Zafiro', precioExtra: 480 },
  { d6: 3, nombre: 'Rubí', precioExtra: 600 },
  { d6: 4, nombre: 'Amatista', precioExtra: 360 },
  { d6: 5, nombre: 'Diamante/Gema blanca/Cristal pálido', precioExtra: 400 },
  { d6: 6, nombre: 'Esmeralda/Gema verde/Cristal verde', precioExtra: 350 }
];

const MANUFACTURES = [
  { nombre: 'Humana, de Oesternesse', multiplicador: 1.1 },
  { nombre: 'Élfica, de Eregion', multiplicador: 1.05 },
  { nombre: 'Enana, de Khazad-dûm', multiplicador: 1.1 },
  { nombre: 'Enana, de Erebor', multiplicador: 1 },
  { nombre: 'Enana, de Beleriand', multiplicador: 1 },
  { nombre: 'Élfica, de Beleriand', multiplicador: 1.1 }
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

// Treasure value multipliers by tier
const ART_VALUE_RANGES = {
  minor: { min: 1, max: 5 },    // 1-5 mo
  major: { min: 1, max: 15 },   // 1-15 mo
  wondrous: { min: 1, max: 25 } // 1-25 mo
};

// =============== CURSES ===============
const CURSES = [
  { id: 'weakness', nombre: 'Maldición de la debilidad', descripcion: 'Manifiesta el peor defecto de tu Senda de Sombra' },
  { id: 'darkener', nombre: 'Oscurecedor', descripcion: 'La luz se debilita al exponer el objeto (brillante→tenue→oscuridad)' },
  { id: 'pursued', nombre: 'Perseguido', descripcion: 'Un enemigo percibe su presencia al acercarse' },
  { id: 'bad_luck', nombre: 'Mala suerte', descripcion: 'Si sacas 20, relanzas y usas el nuevo resultado' },
  { id: 'bad_omen', nombre: 'Mal augurio', descripcion: '+5 a la CD de pruebas durante un concilio' },
  { id: 'malign', nombre: 'Maligno', descripcion: '-2 a tiradas de salvación' },
  { id: 'owned', nombre: 'Adueñado', descripcion: 'En presencia del dueño original, el objeto es inútil' },
  { id: 'shadow_marked', nombre: 'Marcado por la Sombra', descripcion: 'Aumenta tu Sombra permanentemente mientras lo lleves' },
  { id: 'debilitating', nombre: 'Debilitante', descripcion: 'Desventaja en pruebas y TS de una característica' }
];

// =============== HELPER FUNCTIONS ===============
const rollDice = (notation) => {
  // Handle notation like "2d8", "3d10", "1d4-2"
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
const rollD6 = () => Math.floor(Math.random() * 6) + 1;

// =============== MAIN COMPONENT ===============
const TreasureSystemSection = () => {
  const [selectedTier, setSelectedTier] = useState('minor');
  const [generatedTreasure, setGeneratedTreasure] = useState(null);
  const [treasureLog, setTreasureLog] = useState([]);
  const [showCurseChance, setShowCurseChance] = useState(false);
  
  // Generate treasure
  const generateTreasure = useCallback(() => {
    const tier = TREASURE_TIERS[selectedTier];
    const valorRoll = rollDice(tier.valorDado);
    const valorTotal = tier.valorBase + valorRoll.total;
    
    // Magic treasure rolls
    const magicRolls = [];
    let totalShadow = 0;
    const magicItems = [];
    
    for (let i = 0; i < tier.tiradas; i++) {
      const d20 = rollD20();
      const tableRow = MAGIC_TREASURE_TABLE.find(row => d20 >= row.min && d20 <= row.max);
      const shadowRoll = rollDice(tableRow.sombraDado);
      
      magicRolls.push({
        d20,
        resultado: tableRow.resultado,
        descripcion: tableRow.descripcion,
        sombra: shadowRoll.total
      });
      
      totalShadow += shadowRoll.total;
      
      // If magic item found, generate it
      if (tableRow.resultado !== 'ninguno') {
        const item = generateMagicItem(tableRow.resultado);
        magicItems.push(item);
      }
    }
    
    // Generate art object (random)
    const artObject = ART_OBJECTS[Math.floor(Math.random() * ART_OBJECTS.length)];
    const artValueRange = ART_VALUE_RANGES[selectedTier];
    const artValue = Math.floor(Math.random() * (artValueRange.max - artValueRange.min + 1)) + artValueRange.min;
    
    // Check for curse (optional)
    let curse = null;
    if (showCurseChance && Math.random() < 0.1) { // 10% chance
      curse = CURSES[Math.floor(Math.random() * CURSES.length)];
    }
    
    const treasure = {
      tier: tier.nombre,
      tierColor: tier.color,
      valorOro: valorTotal,
      valorRoll,
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
    
    return treasure;
  }, [selectedTier, showCurseChance]);
  
  // Generate a magic item based on type
  const generateMagicItem = (tipo) => {
    if (tipo === 'artefacto') {
      // 1 blessing
      const blessingRoll = rollD20();
      let blessing = BLESSINGS.find(b => b.d20 === blessingRoll) || BLESSINGS[0];
      
      // Handle "roll twice"
      if (blessingRoll === 20) {
        const roll1 = Math.min(19, rollD20());
        blessing = BLESSINGS.find(b => b.d20 === roll1) || BLESSINGS[0];
      }
      
      return {
        tipo: 'Artefacto Maravilloso',
        bendiciones: [blessing],
        descripcion: `Objeto con bendición de ${blessing.habilidad}`,
        objetosSugeridos: blessing.objetos
      };
    } else if (tipo === 'extraordinario') {
      // 2 blessings
      const blessings = [];
      while (blessings.length < 2) {
        let roll = rollD20();
        if (roll === 20) roll = Math.min(19, rollD20());
        const blessing = BLESSINGS.find(b => b.d20 === roll) || BLESSINGS[0];
        if (!blessings.find(b => b.habilidad === blessing.habilidad)) {
          blessings.push(blessing);
        }
      }
      
      return {
        tipo: 'Objeto Extraordinario',
        bendiciones: blessings,
        descripcion: `Objeto con bendiciones de ${blessings.map(b => b.habilidad).join(' y ')}`,
        objetosSugeridos: blessings[0].objetos
      };
    } else if (tipo === 'famoso') {
      // Famous weapon/armor
      const isWeapon = Math.random() > 0.3; // 70% weapon, 30% armor
      const manufactures = ['Élfica', 'Enana', 'Númenóreana'];
      const manufacture = manufactures[Math.floor(Math.random() * manufactures.length)];
      
      return {
        tipo: isWeapon ? 'Arma Famosa' : 'Armadura Famosa',
        manufactura: manufacture,
        descripcion: `${isWeapon ? 'Arma' : 'Armadura'} de manufactura ${manufacture}`,
        cualidades: ['Por determinar (ver índice de tesoros)']
      };
    }
    
    return { tipo: 'Desconocido', descripcion: 'Error al generar' };
  };
  
  // Generate precious object (jewelry)
  const generateJewelry = useCallback(() => {
    const form = JEWELRY_FORMS[rollD6() - 1];
    const material = JEWELRY_MATERIALS[Math.floor(Math.random() * JEWELRY_MATERIALS.length)];
    const gem = GEMSTONES[rollD6() - 1];
    const manufacture = MANUFACTURES[Math.floor(Math.random() * MANUFACTURES.length)];
    
    const basePrice = form.precioBase;
    const materialPrice = basePrice * material.multiplicador;
    const gemPrice = gem.precioExtra;
    const finalPrice = Math.round((materialPrice + gemPrice) * manufacture.multiplicador);
    
    return {
      descripcion: `${form.nombre} de ${material.nombre} con ${gem.nombre}`,
      manufactura: manufacture.nombre,
      precioMP: finalPrice,
      detalles: {
        forma: form.nombre,
        material: material.nombre,
        gema: gem.nombre,
        manufactura: manufacture.nombre
      }
    };
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[hsl(var(--gold))] flex items-center justify-center gap-2">
          <Gem className="w-6 h-6" />
          Sistema de Tesoros
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generador de tesoros, objetos mágicos y recompensas
        </p>
      </div>
      
      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generator">Generador</TabsTrigger>
          <TabsTrigger value="magic">Objetos Mágicos</TabsTrigger>
          <TabsTrigger value="jewelry">Joyas y Arte</TabsTrigger>
          <TabsTrigger value="reference">Tablas</TabsTrigger>
        </TabsList>
        
        {/* GENERATOR TAB */}
        <TabsContent value="generator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Controls */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Gift className="w-5 h-5" /> Generar Tesoro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm">Nivel de Tesoro</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {Object.values(TREASURE_TIERS).map(tier => (
                      <Button
                        key={tier.id}
                        variant={selectedTier === tier.id ? 'default' : 'outline'}
                        onClick={() => setSelectedTier(tier.id)}
                        className={selectedTier === tier.id ? tier.color : ''}
                      >
                        {tier.nombre}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Tier info */}
                <div className="bg-black/20 p-3 rounded border border-[hsl(var(--gold))/30]">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Valor base:</p>
                      <p className="font-bold">{TREASURE_TIERS[selectedTier].valorBase} + {TREASURE_TIERS[selectedTier].valorDado} po</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tiradas mágicas:</p>
                      <p className="font-bold">{TREASURE_TIERS[selectedTier].tiradas}d20</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CD Sombra:</p>
                      <p className="font-bold">{TREASURE_TIERS[selectedTier].cdSombra}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="curse-chance"
                    checked={showCurseChance}
                    onCheckedChange={setShowCurseChance}
                  />
                  <Label htmlFor="curse-chance" className="text-sm">
                    Activar posibilidad de maldición (10%)
                  </Label>
                </div>
                
                <Button 
                  onClick={generateTreasure} 
                  className="w-full h-12 text-lg"
                  data-testid="generate-treasure-btn"
                >
                  <Dice6 className="w-5 h-5 mr-2" />
                  ¡Generar Tesoro!
                </Button>
                
                {/* Frequency reminder */}
                <p className="text-xs text-muted-foreground italic text-center">
                  Recomendación: máx. 2 tesoros por fase de aventuras (1 menor + 1 mayor, o 1 maravilloso)
                </p>
              </CardContent>
            </Card>
            
            {/* Right: Results */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">
                  Resultado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedTreasure ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                      <Badge className={generatedTreasure.tierColor}>
                        Tesoro {generatedTreasure.tier}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{generatedTreasure.timestamp}</span>
                    </div>
                    
                    {/* Value */}
                    <div className="bg-yellow-500/20 p-3 rounded border border-yellow-500/30">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <span className="text-xl font-bold">{generatedTreasure.valorOro} po</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({TREASURE_TIERS[selectedTier].valorBase} + [{generatedTreasure.valorRoll.rolls.join('+')}])
                      </p>
                    </div>
                    
                    {/* Art Object */}
                    <div className="bg-purple-500/10 p-2 rounded text-sm">
                      <p className="font-medium">Objeto de arte incluido:</p>
                      <p className="text-muted-foreground">{generatedTreasure.artObject}</p>
                      <p className="text-xs text-yellow-400">Valor: {generatedTreasure.artValue} mo</p>
                    </div>
                    
                    {/* Magic Rolls */}
                    <div>
                      <p className="font-medium text-sm mb-2">Tiradas de Tesoro Mágico:</p>
                      <div className="space-y-2">
                        {generatedTreasure.magicRolls.map((roll, idx) => (
                          <div key={idx} className={`p-2 rounded text-sm ${
                            roll.resultado === 'ninguno' ? 'bg-gray-500/20' :
                            roll.resultado === 'artefacto' ? 'bg-green-500/20' :
                            roll.resultado === 'extraordinario' ? 'bg-blue-500/20' :
                            'bg-purple-500/20'
                          }`}>
                            <div className="flex justify-between">
                              <span>d20: <strong>{roll.d20}</strong></span>
                              <Badge variant="outline">{roll.descripcion}</Badge>
                            </div>
                            {roll.sombra > 0 && (
                              <p className="text-xs text-red-400 mt-1">
                                Sombra (Avaricia): +{roll.sombra} (CD {generatedTreasure.cdSombra} para resistir)
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Magic Items */}
                    {generatedTreasure.magicItems.length > 0 && (
                      <div>
                        <p className="font-medium text-sm mb-2 text-[hsl(var(--gold))]">Objetos Mágicos Encontrados:</p>
                        <div className="space-y-2">
                          {generatedTreasure.magicItems.map((item, idx) => (
                            <div key={idx} className="p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/30]">
                              <p className="font-bold">{item.tipo}</p>
                              <p className="text-sm text-muted-foreground">{item.descripcion}</p>
                              {item.bendiciones && (
                                <div className="mt-2">
                                  {item.bendiciones.map((b, i) => (
                                    <Badge key={i} variant="outline" className="mr-1">
                                      {b.habilidad}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {item.objetosSugeridos && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Objetos sugeridos: {item.objetosSugeridos}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Curse */}
                    {generatedTreasure.curse && (
                      <div className="p-3 bg-red-500/20 rounded border border-red-500/30">
                        <div className="flex items-center gap-2 text-red-400">
                          <Skull className="w-5 h-5" />
                          <span className="font-bold">¡MALDICIÓN!</span>
                        </div>
                        <p className="font-medium mt-1">{generatedTreasure.curse.nombre}</p>
                        <p className="text-sm text-muted-foreground">{generatedTreasure.curse.descripcion}</p>
                      </div>
                    )}
                    
                    {/* Shadow Total */}
                    {generatedTreasure.totalShadow > 0 && (
                      <div className="p-2 bg-black/30 rounded text-center">
                        <p className="text-sm">
                          Sombra total por Avaricia: <strong className="text-red-400">+{generatedTreasure.totalShadow}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cada héroe debe superar CD {generatedTreasure.cdSombra} para resistir
                        </p>
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
          
          {/* History */}
          {treasureLog.length > 0 && (
            <Card className="card-parchment mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Historial de Tesoros</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="flex gap-2 flex-wrap">
                    {treasureLog.map((t, idx) => (
                      <Badge key={idx} className={t.tierColor}>
                        {t.tier}: {t.valorOro}po ({t.magicItems.length} mágicos) - {t.timestamp}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* MAGIC ITEMS TAB */}
        <TabsContent value="magic">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blessings */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> Bendiciones (d20)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Artefacto maravilloso = 1 bendición | Objeto extraordinario = 2 bendiciones
                </p>
                <ScrollArea className="h-64">
                  <div className="space-y-1">
                    {BLESSINGS.map(b => (
                      <div key={b.d20} className="flex justify-between items-center p-1 bg-black/10 rounded text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="w-8 justify-center">{b.d20}</Badge>
                          {b.habilidad}
                        </span>
                        <span className="text-xs text-muted-foreground">{b.objetos}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            
            {/* Blessing Dice */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Dado de Bendición</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Según el bonificador por competencia (PB) del portador:
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-black/10 rounded">
                    <span>PB +2</span><Badge>1d4</Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-black/10 rounded">
                    <span>PB +3</span><Badge>1d6</Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-black/10 rounded">
                    <span>PB +4</span><Badge>1d8</Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-black/10 rounded">
                    <span>PB +5</span><Badge>1d10</Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-black/10 rounded">
                    <span>PB +6</span><Badge>1d12</Badge>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/30]">
                  <p className="font-bold text-sm">Éxito Mágico (usos por descanso largo):</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• Artefacto (1 bendición): PB ÷ 2 usos</li>
                    <li>• Extraordinario (2 bendiciones): PB usos</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            
            {/* Curses */}
            <Card className="card-parchment col-span-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-400 flex items-center gap-2">
                  <Skull className="w-5 h-5" /> Maldiciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  El DM puede introducir una maldición en cualquier tesoro mágico. Pueden ser latentes.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {CURSES.map(curse => (
                    <div key={curse.id} className="p-2 bg-red-500/10 rounded border border-red-500/20">
                      <p className="font-medium text-sm">{curse.nombre}</p>
                      <p className="text-xs text-muted-foreground">{curse.descripcion}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* JEWELRY TAB */}
        <TabsContent value="jewelry">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Crown className="w-5 h-5" /> Generar Joya
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => {
                    const jewelry = generateJewelry();
                    toast.success(jewelry.descripcion);
                    setGeneratedTreasure(prev => prev ? { ...prev, jewelry } : { jewelry });
                  }}
                  className="w-full"
                  data-testid="generate-jewelry-btn"
                >
                  <Dice6 className="w-4 h-4 mr-2" /> Generar Joya Aleatoria
                </Button>
                
                {generatedTreasure?.jewelry && (
                  <div className="p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/30]">
                    <p className="font-bold">{generatedTreasure.jewelry.descripcion}</p>
                    <p className="text-sm text-muted-foreground">Manufactura: {generatedTreasure.jewelry.manufactura}</p>
                    <p className="text-lg font-bold text-yellow-400 mt-2">{generatedTreasure.jewelry.precioMP} mp</p>
                  </div>
                )}
                
                {/* Form prices */}
                <div>
                  <Label className="text-sm">Precios base por forma (mp)</Label>
                  <div className="grid grid-cols-2 gap-1 mt-2 text-sm">
                    {JEWELRY_FORMS.map(f => (
                      <div key={f.d6} className="flex justify-between p-1 bg-black/10 rounded">
                        <span>{f.nombre}</span>
                        <span className="text-yellow-400">{f.precioBase}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Art Objects */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Objetos de Arte</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Valor según nivel de tesoro: Menor (1-5 mo), Mayor (1-15 mo), Maravilloso (1-25 mo)
                </p>
                <ScrollArea className="h-64">
                  <div className="grid grid-cols-1 gap-1">
                    {ART_OBJECTS.slice(0, 25).map((art, idx) => (
                      <div key={idx} className="p-1 bg-black/10 rounded text-sm">
                        {art}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* REFERENCE TAB */}
        <TabsContent value="reference">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Treasure Tiers */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Niveles de Tesoro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.values(TREASURE_TIERS).map(tier => (
                    <div key={tier.id} className="p-3 bg-black/10 rounded">
                      <div className="flex justify-between items-center">
                        <Badge className={tier.color}>{tier.nombre}</Badge>
                        <span className="font-bold">{tier.valorBase} + {tier.valorDado} po</span>
                      </div>
                      <div className="text-sm mt-2 grid grid-cols-2 gap-2">
                        <span>Tiradas: {tier.tiradas}d20</span>
                        <span>CD Sombra: {tier.cdSombra}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Magic Treasure Table */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Tabla de Tesoro Mágico (d20)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MAGIC_TREASURE_TABLE.map((row, idx) => (
                    <div key={idx} className={`p-2 rounded text-sm ${
                      row.resultado === 'ninguno' ? 'bg-gray-500/20' :
                      row.resultado === 'artefacto' ? 'bg-green-500/20' :
                      row.resultado === 'extraordinario' ? 'bg-blue-500/20' :
                      'bg-purple-500/20'
                    }`}>
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">{row.min}-{row.max}</Badge>
                        <span>{row.descripcion}</span>
                      </div>
                      <p className="text-xs text-red-400 mt-1">Sombra: {row.sombraDado}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Materials */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Materiales de Joya</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {JEWELRY_MATERIALS.map((m, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-black/10 rounded text-sm">
                      <span>{m.nombre}</span>
                      <span className="font-bold">{m.multiplicador * 100}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Gemstones */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Gemas (d6)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {GEMSTONES.map((g) => (
                    <div key={g.d6} className="flex justify-between p-2 bg-black/10 rounded text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{g.d6}</Badge>
                        {g.nombre}
                      </span>
                      <span className="text-yellow-400">+{g.precioExtra} mp</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TreasureSystemSection;
