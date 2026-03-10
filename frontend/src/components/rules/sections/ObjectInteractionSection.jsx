/**
 * Object Interaction Section
 * Interactive system for breaking/damaging objects (doors, chests, locks, etc.)
 * Based on LOTR 5e rules
 */
import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Hammer, Shield, Heart, Dice6, Sparkles, AlertTriangle, 
  Check, X, RotateCcw, Swords, Target, Box
} from 'lucide-react';
import { toast } from 'sonner';

// =============== CONSTANTS ===============

const MATERIALS = [
  { id: 'cloth', nombre: 'Tela, papel, cuerda', ca: 11, icon: '📜' },
  { id: 'glass', nombre: 'Cristal, vidrio, hielo', ca: 13, icon: '💎' },
  { id: 'wood', nombre: 'Madera, hueso', ca: 15, icon: '🪵' },
  { id: 'stone', nombre: 'Piedra', ca: 17, icon: '🪨' },
  { id: 'iron', nombre: 'Hierro, acero', ca: 19, icon: '⚔️' },
  { id: 'mithril', nombre: 'Mithril', ca: 21, icon: '✨' },
  { id: 'adamantine', nombre: 'Adamantina', ca: 23, icon: '💠' }
];

const SIZES = [
  { 
    id: 'tiny', 
    nombre: 'Diminuto', 
    ejemplos: 'botella, cerrojo, candado',
    fragil: { dado: '1d4', media: 2 },
    resistente: { dado: '2d4', media: 5 }
  },
  { 
    id: 'small', 
    nombre: 'Pequeño', 
    ejemplos: 'cofre, laúd, ventana',
    fragil: { dado: '1d6', media: 3 },
    resistente: { dado: '3d6', media: 10 }
  },
  { 
    id: 'medium', 
    nombre: 'Mediano', 
    ejemplos: 'barril, puerta, lámpara de araña',
    fragil: { dado: '1d8', media: 4 },
    resistente: { dado: '4d8', media: 18 }
  },
  { 
    id: 'large', 
    nombre: 'Grande', 
    ejemplos: 'carreta, portón, ventana 3x3m',
    fragil: { dado: '1d10', media: 5 },
    resistente: { dado: '5d10', media: 27 }
  }
];

const STATES = [
  { id: 'ruined', nombre: 'Ruinoso', descripcion: 'Viejo, podrido, agrietado', modCA: -4, modHP: 0.5 },
  { id: 'worn', nombre: 'Desgastado', descripcion: 'Usado, con signos de edad', modCA: -2, modHP: 0.75 },
  { id: 'normal', nombre: 'Normal', descripcion: 'Estado estándar', modCA: 0, modHP: 1 },
  { id: 'reinforced', nombre: 'Reforzado', descripcion: 'Bien construido, calidad', modCA: +2, modHP: 1.25 },
  { id: 'masterwork', nombre: 'Obra maestra', descripcion: 'Calidad excepcional, forja élfica/enana', modCA: +4, modHP: 1.5 }
];

const DURABILITIES = [
  { id: 'fragile', nombre: 'Frágil', descripcion: 'Se rompe fácilmente' },
  { id: 'resistant', nombre: 'Resistente', descripcion: 'Sólido y duradero' }
];

// Common objects presets
const PRESETS = [
  { nombre: 'Cerrojo común', material: 'iron', size: 'tiny', state: 'normal', durability: 'fragile' },
  { nombre: 'Cerrojo reforzado', material: 'iron', size: 'tiny', state: 'reinforced', durability: 'resistant' },
  { nombre: 'Cofre de madera', material: 'wood', size: 'small', state: 'normal', durability: 'resistente' },
  { nombre: 'Puerta vieja', material: 'wood', size: 'medium', state: 'worn', durability: 'fragile' },
  { nombre: 'Puerta de castillo', material: 'wood', size: 'medium', state: 'reinforced', durability: 'resistant' },
  { nombre: 'Portón de hierro', material: 'iron', size: 'large', state: 'normal', durability: 'resistant' },
  { nombre: 'Cadenas', material: 'iron', size: 'small', state: 'normal', durability: 'resistant' },
  { nombre: 'Ventana de vidrio', material: 'glass', size: 'small', state: 'normal', durability: 'fragile' },
  { nombre: 'Barril', material: 'wood', size: 'medium', state: 'normal', durability: 'fragile' },
  { nombre: 'Estatua de piedra', material: 'stone', size: 'medium', state: 'normal', durability: 'resistant' },
  { nombre: 'Puerta de Mithril', material: 'mithril', size: 'medium', state: 'masterwork', durability: 'resistant' }
];

// =============== HELPER FUNCTIONS ===============

const rollDice = (notation) => {
  const match = notation.match(/(\d+)d(\d+)/);
  if (!match) return 0;
  const [, count, sides] = match.map(Number);
  let total = 0;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }
  return { total, rolls, notation };
};

const rollD20 = () => Math.floor(Math.random() * 20) + 1;

// =============== MAIN COMPONENT ===============

const ObjectInteractionSection = () => {
  // Object configuration
  const [objectName, setObjectName] = useState('Objeto');
  const [material, setMaterial] = useState('wood');
  const [size, setSize] = useState('medium');
  const [state, setState] = useState('normal');
  const [durability, setDurability] = useState('resistant');
  
  // Combat state
  const [objectHP, setObjectHP] = useState(null);
  const [objectMaxHP, setObjectMaxHP] = useState(null);
  const [objectCA, setObjectCA] = useState(null);
  const [combatStarted, setCombatStarted] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  
  // Attack configuration
  const [attackBonus, setAttackBonus] = useState(5);
  const [damageNotation, setDamageNotation] = useState('1d8');
  const [damageBonus, setDamageBonus] = useState(3);
  const [weaponName, setWeaponName] = useState('Espada');
  
  // Calculate object stats
  const calculateObjectStats = useCallback(() => {
    const mat = MATERIALS.find(m => m.id === material);
    const siz = SIZES.find(s => s.id === size);
    const sta = STATES.find(s => s.id === state);
    const dur = durability === 'fragile' ? siz.fragil : siz.resistente;
    
    // CA = base material + state modifier
    const finalCA = mat.ca + sta.modCA;
    
    // HP = roll dice * state multiplier
    const hpRoll = rollDice(dur.dado);
    const baseHP = Math.max(1, Math.round(hpRoll.total * sta.modHP));
    
    return {
      ca: finalCA,
      hp: baseHP,
      hpRoll,
      material: mat,
      size: siz,
      state: sta,
      durability: dur
    };
  }, [material, size, state, durability]);
  
  // Start combat
  const startCombat = useCallback(() => {
    const stats = calculateObjectStats();
    setObjectCA(stats.ca);
    setObjectHP(stats.hp);
    setObjectMaxHP(stats.hp);
    setCombatStarted(true);
    setCombatLog([{
      type: 'info',
      text: `${objectName} creado: CA ${stats.ca}, PG ${stats.hp} (${stats.hpRoll.notation}: [${stats.hpRoll.rolls.join(', ')}] × ${stats.state.modHP})`
    }]);
    toast.success(`¡${objectName} listo para ser destruido!`);
  }, [calculateObjectStats, objectName]);
  
  // Reset combat
  const resetCombat = useCallback(() => {
    setCombatStarted(false);
    setObjectHP(null);
    setObjectMaxHP(null);
    setObjectCA(null);
    setCombatLog([]);
  }, []);
  
  // Attack the object
  const attackObject = useCallback(() => {
    if (!combatStarted || objectHP <= 0) return;
    
    const d20 = rollD20();
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const totalAttack = d20 + attackBonus;
    
    let logEntry = {
      type: 'attack',
      d20,
      bonus: attackBonus,
      total: totalAttack,
      ca: objectCA,
      hit: false,
      damage: 0,
      crit: isCrit,
      fumble: isFumble
    };
    
    if (isFumble) {
      // FUMBLE! Possible weapon damage
      logEntry.text = `🎲 ¡PIFIA! (${d20}) - El golpe falla estrepitosamente...`;
      logEntry.type = 'fumble';
      
      // 50% chance of weapon damage on fumble
      if (Math.random() < 0.5) {
        logEntry.weaponDamage = true;
        logEntry.text += ` ¡${weaponName} sufre daño! (-1 a tiradas hasta reparar)`;
        toast.error(`¡Pifia! ${weaponName} ha sufrido daño.`);
      } else {
        toast.warning('¡Pifia! El golpe falla completamente.');
      }
    } else if (isCrit) {
      // CRITICAL HIT! Auto-success, double damage
      const dmgRoll = rollDice(damageNotation);
      // Double the dice for crit
      const critDmgRoll = rollDice(damageNotation);
      const totalDamage = dmgRoll.total + critDmgRoll.total + damageBonus;
      
      logEntry.hit = true;
      logEntry.damage = totalDamage;
      logEntry.damageRolls = [dmgRoll.rolls, critDmgRoll.rolls];
      logEntry.text = `🎲 ¡CRÍTICO! (${d20}) - ¡Golpe devastador! Daño: ${totalDamage} ([${dmgRoll.rolls.join('+')}] + [${critDmgRoll.rolls.join('+')}] + ${damageBonus})`;
      logEntry.type = 'crit';
      
      const newHP = Math.max(0, objectHP - totalDamage);
      setObjectHP(newHP);
      
      if (newHP <= 0) {
        logEntry.destroyed = true;
        logEntry.text += ' - ¡DESTRUIDO de un solo golpe!';
        toast.success('¡Crítico! ¡El objeto ha sido destruido!');
      } else {
        toast.success(`¡Crítico! ${totalDamage} de daño.`);
      }
    } else if (totalAttack >= objectCA) {
      // Normal hit
      const dmgRoll = rollDice(damageNotation);
      const totalDamage = dmgRoll.total + damageBonus;
      
      logEntry.hit = true;
      logEntry.damage = totalDamage;
      logEntry.damageRolls = [dmgRoll.rolls];
      logEntry.text = `🎲 Tirada: ${d20} + ${attackBonus} = ${totalAttack} vs CA ${objectCA} - ¡Impacto! Daño: ${totalDamage} ([${dmgRoll.rolls.join('+')}] + ${damageBonus})`;
      
      const newHP = Math.max(0, objectHP - totalDamage);
      setObjectHP(newHP);
      
      if (newHP <= 0) {
        logEntry.destroyed = true;
        logEntry.text += ' - ¡DESTRUIDO!';
        toast.success('¡El objeto ha sido destruido!');
      }
    } else {
      // Miss
      logEntry.text = `🎲 Tirada: ${d20} + ${attackBonus} = ${totalAttack} vs CA ${objectCA} - Fallo. El golpe rebota sin causar daño.`;
      toast.error('El golpe no consigue dañar el objeto.');
    }
    
    setCombatLog(prev => [...prev, logEntry]);
  }, [combatStarted, objectHP, objectCA, attackBonus, damageNotation, damageBonus, weaponName]);
  
  // Load preset
  const loadPreset = useCallback((preset) => {
    setObjectName(preset.nombre);
    setMaterial(preset.material);
    setSize(preset.size);
    setState(preset.state);
    setDurability(preset.durability === 'resistente' ? 'resistant' : preset.durability);
    resetCombat();
    toast.info(`Cargado: ${preset.nombre}`);
  }, [resetCombat]);
  
  // Current stats preview
  const mat = MATERIALS.find(m => m.id === material);
  const siz = SIZES.find(s => s.id === size);
  const sta = STATES.find(s => s.id === state);
  const dur = durability === 'fragile' ? siz?.fragil : siz?.resistente;
  const previewCA = mat && sta ? mat.ca + sta.modCA : 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[hsl(var(--gold))] flex items-center justify-center gap-2">
          <Hammer className="w-6 h-6" />
          Interacciones con Objetos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sistema para romper puertas, cofres, cerrojos y otros objetos
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Object Configuration */}
        <div className="space-y-4">
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                <Box className="w-5 h-5" />
                Configurar Objeto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Presets */}
              <div>
                <Label className="text-sm">Objetos Predefinidos</Label>
                <ScrollArea className="h-24 mt-1">
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map((preset, idx) => (
                      <Badge 
                        key={idx}
                        variant="outline" 
                        className="cursor-pointer hover:bg-[hsl(var(--gold))/20] text-xs"
                        onClick={() => loadPreset(preset)}
                      >
                        {preset.nombre}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Object Name */}
              <div>
                <Label className="text-sm">Nombre del Objeto</Label>
                <Input 
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  placeholder="Ej: Puerta de la taberna"
                  className="mt-1"
                  disabled={combatStarted}
                />
              </div>
              
              {/* Material */}
              <div>
                <Label className="text-sm">Material (CA base)</Label>
                <Select value={material} onValueChange={setMaterial} disabled={combatStarted}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.icon} {m.nombre} (CA {m.ca})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Size */}
              <div>
                <Label className="text-sm">Tamaño (PG base)</Label>
                <Select value={size} onValueChange={setSize} disabled={combatStarted}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} - {s.ejemplos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* State */}
              <div>
                <Label className="text-sm">Estado (modifica CA y PG)</Label>
                <Select value={state} onValueChange={setState} disabled={combatStarted}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} ({s.modCA >= 0 ? '+' : ''}{s.modCA} CA, ×{s.modHP} PG) - {s.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Durability */}
              <div>
                <Label className="text-sm">Durabilidad</Label>
                <Select value={durability} onValueChange={setDurability} disabled={combatStarted}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURABILITIES.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre} - {d.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Preview Stats */}
              {!combatStarted && (
                <div className="bg-black/20 p-3 rounded border border-[hsl(var(--gold))/30]">
                  <p className="text-xs text-muted-foreground mb-2">Vista previa:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span>CA: <strong>{previewCA}</strong></span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span>PG: <strong>{dur?.dado}</strong> (media ~{dur?.media})</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Start/Reset Button */}
              {!combatStarted ? (
                <Button 
                  onClick={startCombat} 
                  className="w-full"
                  data-testid="start-object-combat-btn"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Crear Objeto y Comenzar
                </Button>
              ) : (
                <Button 
                  onClick={resetCombat} 
                  variant="outline"
                  className="w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reiniciar
                </Button>
              )}
            </CardContent>
          </Card>
          
          {/* Attack Configuration */}
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Configurar Ataque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Nombre del Arma</Label>
                <Input 
                  value={weaponName}
                  onChange={(e) => setWeaponName(e.target.value)}
                  placeholder="Ej: Hacha de guerra"
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Bonificador de Ataque</Label>
                  <Input 
                    type="number"
                    value={attackBonus}
                    onChange={(e) => setAttackBonus(parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Dados de Daño</Label>
                  <Select value={damageNotation} onValueChange={setDamageNotation}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d4">1d4 (daga)</SelectItem>
                      <SelectItem value="1d6">1d6 (espada corta)</SelectItem>
                      <SelectItem value="1d8">1d8 (espada larga)</SelectItem>
                      <SelectItem value="1d10">1d10 (alabarda)</SelectItem>
                      <SelectItem value="1d12">1d12 (hacha a dos manos)</SelectItem>
                      <SelectItem value="2d6">2d6 (espada a dos manos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-sm">Bonificador de Daño (FUE/DES)</Label>
                <Input 
                  type="number"
                  value={damageBonus}
                  onChange={(e) => setDamageBonus(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              
              <p className="text-xs text-muted-foreground">
                Daño total: {damageNotation} + {damageBonus}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* RIGHT COLUMN: Combat */}
        <div className="space-y-4">
          {/* Object Status */}
          <Card className={`card-parchment ${objectHP === 0 ? 'border-red-500/50' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[hsl(var(--gold))]">
                {objectName || 'Objeto'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {combatStarted ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-500/20 p-3 rounded text-center">
                      <Shield className="w-6 h-6 mx-auto text-blue-400 mb-1" />
                      <p className="text-2xl font-bold">{objectCA}</p>
                      <p className="text-xs text-muted-foreground">Clase de Armadura</p>
                    </div>
                    <div className={`p-3 rounded text-center ${objectHP > 0 ? 'bg-red-500/20' : 'bg-gray-500/20'}`}>
                      <Heart className={`w-6 h-6 mx-auto mb-1 ${objectHP > 0 ? 'text-red-400' : 'text-gray-500'}`} />
                      <p className="text-2xl font-bold">{objectHP} / {objectMaxHP}</p>
                      <p className="text-xs text-muted-foreground">Puntos de Golpe</p>
                    </div>
                  </div>
                  
                  {/* HP Bar */}
                  <div>
                    <Progress 
                      value={(objectHP / objectMaxHP) * 100} 
                      className="h-4"
                    />
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      {objectHP > 0 
                        ? `${Math.round((objectHP / objectMaxHP) * 100)}% de integridad`
                        : '¡DESTRUIDO!'
                      }
                    </p>
                  </div>
                  
                  {/* Attack Button */}
                  <Button 
                    onClick={attackObject}
                    disabled={objectHP <= 0}
                    className="w-full h-14 text-lg"
                    data-testid="attack-object-btn"
                  >
                    <Dice6 className="w-5 h-5 mr-2" />
                    {objectHP > 0 ? '¡Atacar!' : 'Objeto Destruido'}
                  </Button>
                  
                  {objectHP <= 0 && (
                    <div className="text-center p-4 bg-green-500/20 rounded border border-green-500/30">
                      <Check className="w-8 h-8 mx-auto text-green-400 mb-2" />
                      <p className="font-bold text-green-400">¡Éxito!</p>
                      <p className="text-sm text-muted-foreground">
                        El {objectName.toLowerCase()} ha sido destruido.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Configura y crea un objeto para comenzar</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Combat Log */}
          <Card className="card-parchment">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Dice6 className="w-5 h-5" />
                Registro de Combate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {combatLog.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    El registro aparecerá aquí...
                  </p>
                ) : (
                  <div className="space-y-2">
                    {combatLog.map((entry, idx) => (
                      <div 
                        key={idx}
                        className={`p-2 rounded text-sm ${
                          entry.type === 'info' ? 'bg-blue-500/20 border-l-2 border-blue-500' :
                          entry.type === 'crit' ? 'bg-yellow-500/20 border-l-2 border-yellow-500' :
                          entry.type === 'fumble' ? 'bg-red-500/20 border-l-2 border-red-500' :
                          entry.hit ? 'bg-green-500/20 border-l-2 border-green-500' :
                          'bg-gray-500/20 border-l-2 border-gray-500'
                        }`}
                      >
                        <p>{entry.text}</p>
                        {entry.destroyed && (
                          <Badge className="mt-1 bg-green-600">¡DESTRUIDO!</Badge>
                        )}
                        {entry.weaponDamage && (
                          <Badge variant="destructive" className="mt-1">Arma dañada</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Reference Tables */}
      <Card className="card-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-[hsl(var(--gold))]">
            Tablas de Referencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CA by Material */}
            <div>
              <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
                <Shield className="w-4 h-4" /> Clase de Armadura por Material
              </h4>
              <div className="space-y-1">
                {MATERIALS.map(m => (
                  <div key={m.id} className="flex justify-between items-center text-sm p-1 bg-black/10 rounded">
                    <span>{m.icon} {m.nombre}</span>
                    <Badge variant="outline">CA {m.ca}</Badge>
                  </div>
                ))}
              </div>
            </div>
            
            {/* HP by Size */}
            <div>
              <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
                <Heart className="w-4 h-4" /> Puntos de Golpe por Tamaño
              </h4>
              <div className="space-y-1">
                {SIZES.map(s => (
                  <div key={s.id} className="flex justify-between items-center text-sm p-1 bg-black/10 rounded">
                    <span>{s.nombre}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">Frágil: {s.fragil.dado}</Badge>
                      <Badge className="text-xs bg-blue-600">Resist: {s.resistente.dado}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Special Rules */}
          <div className="mt-4 p-3 bg-black/20 rounded border border-[hsl(var(--gold))/30]">
            <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
              <Sparkles className="w-4 h-4" /> Reglas Especiales
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• <strong>1 Natural (Pifia):</strong> Fallo automático. 50% de probabilidad de dañar el arma.</li>
              <li>• <strong>20 Natural (Crítico):</strong> Impacto automático con daño doble. Puede destruir el objeto de un golpe.</li>
              <li>• <strong>Inmunidades:</strong> Los objetos son inmunes a veneno y daño psíquico.</li>
              <li>• <strong>Resistencias:</strong> Algunos materiales resisten ciertos tipos de daño (ej: adamantina vs cortante).</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ObjectInteractionSection;
