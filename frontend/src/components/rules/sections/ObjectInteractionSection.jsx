/**
 * Object Interaction Section
 * Interactive system for breaking/damaging objects (doors, chests, locks, etc.)
 * With vulnerabilities, resistances, and editable materials
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Hammer, Shield, Heart, Dice6, Sparkles, AlertTriangle, 
  Check, X, RotateCcw, Swords, Target, Box, Plus, Trash2,
  Save, Edit, Flame, Snowflake, Zap, Wind
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// =============== DAMAGE TYPES ===============
const DAMAGE_TYPES = [
  { id: 'slashing', nombre: 'Cortante', icon: '⚔️' },
  { id: 'piercing', nombre: 'Perforante', icon: '🗡️' },
  { id: 'bludgeoning', nombre: 'Contundente', icon: '🔨' },
  { id: 'fire', nombre: 'Fuego', icon: '🔥' },
  { id: 'cold', nombre: 'Frío', icon: '❄️' },
  { id: 'lightning', nombre: 'Rayo', icon: '⚡' },
  { id: 'acid', nombre: 'Ácido', icon: '🧪' },
  { id: 'thunder', nombre: 'Trueno', icon: '💥' }
];

// =============== DEFAULT DATA ===============
const DEFAULT_MATERIALS = [
  { 
    id: 'cloth', nombre: 'Tela, papel, cuerda', ca: 11, icon: '📜',
    vulnerable: ['fire', 'slashing'], // ×2 damage
    resistant: [], // ×0.5 damage
    immune: [] // No damage
  },
  { 
    id: 'glass', nombre: 'Cristal, vidrio, hielo', ca: 13, icon: '💎',
    vulnerable: ['bludgeoning', 'thunder'],
    resistant: [],
    immune: ['piercing'] // Piercing shatters but doesn't break through
  },
  { 
    id: 'wood', nombre: 'Madera, hueso', ca: 15, icon: '🪵',
    vulnerable: ['fire'],
    resistant: ['bludgeoning'],
    immune: []
  },
  { 
    id: 'stone', nombre: 'Piedra', ca: 17, icon: '🪨',
    vulnerable: ['thunder'],
    resistant: ['slashing', 'piercing', 'fire'],
    immune: []
  },
  { 
    id: 'iron', nombre: 'Hierro, acero', ca: 19, icon: '⚔️',
    vulnerable: ['acid'],
    resistant: ['slashing', 'piercing'],
    immune: ['fire']
  },
  { 
    id: 'mithril', nombre: 'Mithril', ca: 21, icon: '✨',
    vulnerable: [],
    resistant: ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold'],
    immune: ['acid']
  },
  { 
    id: 'adamantine', nombre: 'Adamantina', ca: 23, icon: '💠',
    vulnerable: [],
    resistant: ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning'],
    immune: ['acid', 'thunder']
  }
];

const DEFAULT_SIZES = [
  { id: 'tiny', nombre: 'Diminuto', ejemplos: 'botella, cerrojo, candado', fragil: '1d4', resistente: '2d4' },
  { id: 'small', nombre: 'Pequeño', ejemplos: 'cofre, laúd, ventana', fragil: '1d6', resistente: '3d6' },
  { id: 'medium', nombre: 'Mediano', ejemplos: 'barril, puerta, lámpara de araña', fragil: '1d8', resistente: '4d8' },
  { id: 'large', nombre: 'Grande', ejemplos: 'carreta, portón, ventana 3x3m', fragil: '1d10', resistente: '5d10' }
];

const DEFAULT_STATES = [
  { id: 'ruined', nombre: 'Ruinoso', descripcion: 'Viejo, podrido, agrietado', modCA: -4, modHP: 0.5 },
  { id: 'worn', nombre: 'Desgastado', descripcion: 'Usado, con signos de edad', modCA: -2, modHP: 0.75 },
  { id: 'normal', nombre: 'Normal', descripcion: 'Estado estándar', modCA: 0, modHP: 1 },
  { id: 'reinforced', nombre: 'Reforzado', descripcion: 'Bien construido, calidad', modCA: 2, modHP: 1.25 },
  { id: 'masterwork', nombre: 'Obra maestra', descripcion: 'Calidad excepcional', modCA: 4, modHP: 1.5 }
];

const DEFAULT_PRESETS = [
  { nombre: 'Cerrojo común', material: 'iron', size: 'tiny', state: 'normal', durability: 'fragile' },
  { nombre: 'Cerrojo reforzado', material: 'iron', size: 'tiny', state: 'reinforced', durability: 'resistant' },
  { nombre: 'Cofre de madera', material: 'wood', size: 'small', state: 'normal', durability: 'resistant' },
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
  if (!match) return { total: 0, rolls: [], notation };
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

// =============== MATERIAL EDITOR COMPONENT ===============
const MaterialEditor = ({ materials, onSave, onClose }) => {
  const [editedMaterials, setEditedMaterials] = useState([...materials]);
  const [newMaterial, setNewMaterial] = useState({
    id: '', nombre: '', ca: 15, icon: '📦',
    vulnerable: [], resistant: [], immune: []
  });
  
  const handleAdd = () => {
    if (!newMaterial.nombre || !newMaterial.id) {
      toast.error('Completa nombre e ID');
      return;
    }
    setEditedMaterials([...editedMaterials, { ...newMaterial }]);
    setNewMaterial({ id: '', nombre: '', ca: 15, icon: '📦', vulnerable: [], resistant: [], immune: [] });
  };
  
  const handleRemove = (id) => {
    setEditedMaterials(editedMaterials.filter(m => m.id !== id));
  };
  
  const handleUpdate = (id, field, value) => {
    setEditedMaterials(editedMaterials.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };
  
  const toggleDamageType = (materialId, category, damageType) => {
    setEditedMaterials(editedMaterials.map(m => {
      if (m.id !== materialId) return m;
      const current = m[category] || [];
      const updated = current.includes(damageType)
        ? current.filter(d => d !== damageType)
        : [...current, damageType];
      return { ...m, [category]: updated };
    }));
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="card-parchment w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span className="text-[hsl(var(--gold))]">Editor de Materiales</span>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4">
              {editedMaterials.map((mat) => (
                <div key={mat.id} className="p-3 bg-black/20 rounded border border-[hsl(var(--gold))/30]">
                  <div className="flex items-center gap-2 mb-2">
                    <Input 
                      value={mat.icon} 
                      onChange={(e) => handleUpdate(mat.id, 'icon', e.target.value)}
                      className="w-12 text-center"
                    />
                    <Input 
                      value={mat.nombre} 
                      onChange={(e) => handleUpdate(mat.id, 'nombre', e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">CA:</Label>
                      <Input 
                        type="number" 
                        value={mat.ca}
                        onChange={(e) => handleUpdate(mat.id, 'ca', parseInt(e.target.value))}
                        className="w-16"
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(mat.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                  
                  {/* Vulnerabilities, Resistances, Immunities */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <Label className="text-red-400 text-xs">Vulnerable (×2)</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {DAMAGE_TYPES.map(dt => (
                          <Badge 
                            key={dt.id}
                            variant={mat.vulnerable?.includes(dt.id) ? 'default' : 'outline'}
                            className={`cursor-pointer text-xs ${mat.vulnerable?.includes(dt.id) ? 'bg-red-600' : ''}`}
                            onClick={() => toggleDamageType(mat.id, 'vulnerable', dt.id)}
                          >
                            {dt.icon}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-blue-400 text-xs">Resistente (×0.5)</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {DAMAGE_TYPES.map(dt => (
                          <Badge 
                            key={dt.id}
                            variant={mat.resistant?.includes(dt.id) ? 'default' : 'outline'}
                            className={`cursor-pointer text-xs ${mat.resistant?.includes(dt.id) ? 'bg-blue-600' : ''}`}
                            onClick={() => toggleDamageType(mat.id, 'resistant', dt.id)}
                          >
                            {dt.icon}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Inmune (×0)</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {DAMAGE_TYPES.map(dt => (
                          <Badge 
                            key={dt.id}
                            variant={mat.immune?.includes(dt.id) ? 'default' : 'outline'}
                            className={`cursor-pointer text-xs ${mat.immune?.includes(dt.id) ? 'bg-gray-600' : ''}`}
                            onClick={() => toggleDamageType(mat.id, 'immune', dt.id)}
                          >
                            {dt.icon}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Add New Material */}
              <div className="p-3 bg-green-500/10 rounded border border-green-500/30">
                <h4 className="text-sm font-bold text-green-400 mb-2">Añadir Nuevo Material</h4>
                <div className="grid grid-cols-4 gap-2">
                  <Input 
                    placeholder="ID (ej: bronze)"
                    value={newMaterial.id}
                    onChange={(e) => setNewMaterial({...newMaterial, id: e.target.value})}
                  />
                  <Input 
                    placeholder="Nombre"
                    value={newMaterial.nombre}
                    onChange={(e) => setNewMaterial({...newMaterial, nombre: e.target.value})}
                  />
                  <Input 
                    type="number"
                    placeholder="CA"
                    value={newMaterial.ca}
                    onChange={(e) => setNewMaterial({...newMaterial, ca: parseInt(e.target.value)})}
                  />
                  <Button onClick={handleAdd}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={() => { onSave(editedMaterials); onClose(); }} className="flex-1">
              <Save className="w-4 h-4 mr-2" /> Guardar Cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// =============== MAIN COMPONENT ===============
const ObjectInteractionSection = () => {
  // Data state (loadable/editable)
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
  const [sizes] = useState(DEFAULT_SIZES);
  const [states] = useState(DEFAULT_STATES);
  const [presets] = useState(DEFAULT_PRESETS);
  const [showMaterialEditor, setShowMaterialEditor] = useState(false);
  
  // Object configuration
  const [objectName, setObjectName] = useState('Objeto');
  const [material, setMaterial] = useState('wood');
  const [size, setSize] = useState('medium');
  const [state, setState] = useState('normal');
  const [durability, setDurability] = useState('resistant');
  const [damageType, setDamageType] = useState('slashing');
  
  // Combat state
  const [objectHP, setObjectHP] = useState(null);
  const [objectMaxHP, setObjectMaxHP] = useState(null);
  const [objectCA, setObjectCA] = useState(null);
  const [combatStarted, setCombatStarted] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  const [currentMaterial, setCurrentMaterial] = useState(null);
  
  // Attack configuration
  const [attackBonus, setAttackBonus] = useState(5);
  const [damageNotation, setDamageNotation] = useState('1d8');
  const [damageBonus, setDamageBonus] = useState(3);
  const [weaponName, setWeaponName] = useState('Espada');
  
  // Load materials from backend
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const res = await api.get('/data/object-materials');
        if (res.data?.materials?.length > 0) {
          setMaterials(res.data.materials);
        }
      } catch (err) {
        // Use defaults if API fails
        console.log('Using default materials');
      }
    };
    loadMaterials();
  }, []);
  
  // Save materials to backend
  const saveMaterials = async (newMaterials) => {
    try {
      await api.put('/data/object-materials', { materials: newMaterials });
      setMaterials(newMaterials);
      toast.success('Materiales guardados');
    } catch (err) {
      // Still update locally even if API fails
      setMaterials(newMaterials);
      toast.info('Materiales actualizados (solo localmente)');
    }
  };
  
  // Calculate object stats
  const calculateObjectStats = useCallback(() => {
    const mat = materials.find(m => m.id === material);
    const siz = sizes.find(s => s.id === size);
    const sta = states.find(s => s.id === state);
    const durDice = durability === 'fragile' ? siz.fragil : siz.resistente;
    
    const finalCA = mat.ca + sta.modCA;
    const hpRoll = rollDice(durDice);
    const baseHP = Math.max(1, Math.round(hpRoll.total * sta.modHP));
    
    return { ca: finalCA, hp: baseHP, hpRoll, material: mat, size: siz, state: sta };
  }, [material, size, state, durability, materials, sizes, states]);
  
  // Start combat
  const startCombat = useCallback(() => {
    const stats = calculateObjectStats();
    setObjectCA(stats.ca);
    setObjectHP(stats.hp);
    setObjectMaxHP(stats.hp);
    setCurrentMaterial(stats.material);
    setCombatStarted(true);
    setCombatLog([{
      type: 'info',
      text: `${objectName} creado: CA ${stats.ca}, PG ${stats.hp} (${stats.hpRoll.notation}: [${stats.hpRoll.rolls.join(', ')}] × ${stats.state.modHP})`
    }]);
    
    // Log vulnerabilities/resistances
    if (stats.material.vulnerable?.length > 0) {
      const vulnNames = stats.material.vulnerable.map(v => DAMAGE_TYPES.find(d => d.id === v)?.nombre).join(', ');
      setCombatLog(prev => [...prev, { type: 'warning', text: `⚠️ Vulnerable a: ${vulnNames} (×2 daño)` }]);
    }
    if (stats.material.resistant?.length > 0) {
      const resNames = stats.material.resistant.map(r => DAMAGE_TYPES.find(d => d.id === r)?.nombre).join(', ');
      setCombatLog(prev => [...prev, { type: 'info', text: `🛡️ Resistente a: ${resNames} (×0.5 daño)` }]);
    }
    if (stats.material.immune?.length > 0) {
      const immNames = stats.material.immune.map(i => DAMAGE_TYPES.find(d => d.id === i)?.nombre).join(', ');
      setCombatLog(prev => [...prev, { type: 'info', text: `✨ Inmune a: ${immNames}` }]);
    }
    
    toast.success(`¡${objectName} listo!`);
  }, [calculateObjectStats, objectName]);
  
  // Reset combat
  const resetCombat = useCallback(() => {
    setCombatStarted(false);
    setObjectHP(null);
    setObjectMaxHP(null);
    setObjectCA(null);
    setCurrentMaterial(null);
    setCombatLog([]);
  }, []);
  
  // Attack the object
  const attackObject = useCallback(() => {
    if (!combatStarted || objectHP <= 0) return;
    
    const d20 = rollD20();
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const totalAttack = d20 + attackBonus;
    
    // Check damage modifiers based on material
    let damageMultiplier = 1;
    let damageModText = '';
    
    if (currentMaterial?.immune?.includes(damageType)) {
      damageMultiplier = 0;
      damageModText = ' [INMUNE - sin daño]';
    } else if (currentMaterial?.vulnerable?.includes(damageType)) {
      damageMultiplier = 2;
      damageModText = ' [VULNERABLE ×2]';
    } else if (currentMaterial?.resistant?.includes(damageType)) {
      damageMultiplier = 0.5;
      damageModText = ' [RESISTENTE ×0.5]';
    }
    
    const dtName = DAMAGE_TYPES.find(d => d.id === damageType)?.nombre || damageType;
    
    let logEntry = {
      type: 'attack',
      d20,
      bonus: attackBonus,
      total: totalAttack,
      ca: objectCA,
      hit: false,
      damage: 0,
      crit: isCrit,
      fumble: isFumble,
      damageType: dtName
    };
    
    if (isFumble) {
      logEntry.text = `🎲 ¡PIFIA! (${d20}) - El golpe falla estrepitosamente...`;
      logEntry.type = 'fumble';
      if (Math.random() < 0.5) {
        logEntry.weaponDamage = true;
        logEntry.text += ` ¡${weaponName} sufre daño!`;
        toast.error(`¡Pifia! ${weaponName} ha sufrido daño.`);
      } else {
        toast.warning('¡Pifia! El golpe falla.');
      }
    } else if (damageMultiplier === 0) {
      // Immune - auto miss regardless of roll
      logEntry.text = `🎲 Tirada: ${d20} + ${attackBonus} = ${totalAttack} (${dtName}) - ¡INMUNE! El ${objectName.toLowerCase()} no sufre daño de tipo ${dtName}.`;
      logEntry.type = 'immune';
      toast.info(`${objectName} es inmune a ${dtName}`);
    } else if (isCrit) {
      const dmgRoll = rollDice(damageNotation);
      const critDmgRoll = rollDice(damageNotation);
      let totalDamage = Math.floor((dmgRoll.total + critDmgRoll.total + damageBonus) * damageMultiplier);
      
      logEntry.hit = true;
      logEntry.damage = totalDamage;
      logEntry.text = `🎲 ¡CRÍTICO! (${d20}) - Daño ${dtName}: ${totalDamage}${damageModText}`;
      logEntry.type = 'crit';
      
      const newHP = Math.max(0, objectHP - totalDamage);
      setObjectHP(newHP);
      
      if (newHP <= 0) {
        logEntry.destroyed = true;
        logEntry.text += ' - ¡DESTRUIDO!';
        toast.success('¡Crítico! ¡Destruido!');
      } else {
        toast.success(`¡Crítico! ${totalDamage} daño.`);
      }
    } else if (totalAttack >= objectCA) {
      const dmgRoll = rollDice(damageNotation);
      let totalDamage = Math.floor((dmgRoll.total + damageBonus) * damageMultiplier);
      
      logEntry.hit = true;
      logEntry.damage = totalDamage;
      logEntry.text = `🎲 ${d20} + ${attackBonus} = ${totalAttack} vs CA ${objectCA} - ¡Impacto! Daño ${dtName}: ${totalDamage}${damageModText}`;
      
      const newHP = Math.max(0, objectHP - totalDamage);
      setObjectHP(newHP);
      
      if (newHP <= 0) {
        logEntry.destroyed = true;
        logEntry.text += ' - ¡DESTRUIDO!';
        toast.success('¡Destruido!');
      }
    } else {
      logEntry.text = `🎲 ${d20} + ${attackBonus} = ${totalAttack} vs CA ${objectCA} - Fallo.`;
      toast.error('El golpe no causa daño.');
    }
    
    setCombatLog(prev => [...prev, logEntry]);
  }, [combatStarted, objectHP, objectCA, attackBonus, damageNotation, damageBonus, weaponName, damageType, currentMaterial, objectName]);
  
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
  
  // Preview stats
  const mat = materials.find(m => m.id === material);
  const siz = sizes.find(s => s.id === size);
  const sta = states.find(s => s.id === state);
  const previewCA = mat && sta ? mat.ca + sta.modCA : 0;
  const previewDice = durability === 'fragile' ? siz?.fragil : siz?.resistente;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-center flex-1">
          <h2 className="text-2xl font-bold text-[hsl(var(--gold))] flex items-center justify-center gap-2">
            <Hammer className="w-6 h-6" />
            Interacciones con Objetos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema para romper puertas, cofres, cerrojos y otros objetos
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowMaterialEditor(true)} data-testid="edit-materials-btn">
          <Edit className="w-4 h-4 mr-2" /> Editar Materiales
        </Button>
      </div>
      
      <Tabs defaultValue="simulator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="simulator">Simulador de Combate</TabsTrigger>
          <TabsTrigger value="reference">Tablas de Referencia</TabsTrigger>
        </TabsList>
        
        <TabsContent value="simulator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Configuration */}
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
                    <ScrollArea className="h-20 mt-1">
                      <div className="flex flex-wrap gap-1">
                        {presets.map((preset, idx) => (
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
                  
                  <div>
                    <Label className="text-sm">Nombre del Objeto</Label>
                    <Input 
                      value={objectName}
                      onChange={(e) => setObjectName(e.target.value)}
                      disabled={combatStarted}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm">Material (CA base)</Label>
                    <Select value={material} onValueChange={setMaterial} disabled={combatStarted}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {materials.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.icon} {m.nombre} (CA {m.ca})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Tamaño</Label>
                      <Select value={size} onValueChange={setSize} disabled={combatStarted}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {sizes.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Durabilidad</Label>
                      <Select value={durability} onValueChange={setDurability} disabled={combatStarted}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fragile">Frágil</SelectItem>
                          <SelectItem value="resistant">Resistente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm">Estado</Label>
                    <Select value={state} onValueChange={setState} disabled={combatStarted}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {states.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre} ({s.modCA >= 0 ? '+' : ''}{s.modCA} CA, ×{s.modHP} PG)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Preview */}
                  {!combatStarted && mat && (
                    <div className="bg-black/20 p-3 rounded border border-[hsl(var(--gold))/30]">
                      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div className="flex items-center gap-1">
                          <Shield className="w-4 h-4 text-blue-400" />
                          CA: <strong>{previewCA}</strong>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-4 h-4 text-red-400" />
                          PG: <strong>{previewDice}</strong>
                        </div>
                      </div>
                      {/* Show vulnerabilities */}
                      <div className="text-xs space-y-1">
                        {mat.vulnerable?.length > 0 && (
                          <p className="text-red-400">
                            Vulnerable: {mat.vulnerable.map(v => DAMAGE_TYPES.find(d => d.id === v)?.icon).join(' ')}
                          </p>
                        )}
                        {mat.resistant?.length > 0 && (
                          <p className="text-blue-400">
                            Resistente: {mat.resistant.map(r => DAMAGE_TYPES.find(d => d.id === r)?.icon).join(' ')}
                          </p>
                        )}
                        {mat.immune?.length > 0 && (
                          <p className="text-gray-400">
                            Inmune: {mat.immune.map(i => DAMAGE_TYPES.find(d => d.id === i)?.icon).join(' ')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!combatStarted ? (
                    <Button onClick={startCombat} className="w-full" data-testid="start-object-combat-btn">
                      <Target className="w-4 h-4 mr-2" /> Crear Objeto
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={resetCombat} className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" /> Reiniciar
                    </Button>
                  )}
                </CardContent>
              </Card>
              
              {/* Attack Config */}
              <Card className="card-parchment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                    <Swords className="w-5 h-5" /> Configurar Ataque
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm">Tipo de Daño</Label>
                    <Select value={damageType} onValueChange={setDamageType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAMAGE_TYPES.map(dt => (
                          <SelectItem key={dt.id} value={dt.id}>
                            {dt.icon} {dt.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Arma</Label>
                      <Input value={weaponName} onChange={(e) => setWeaponName(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-sm">Bonus Ataque</Label>
                      <Input type="number" value={attackBonus} onChange={(e) => setAttackBonus(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Dados Daño</Label>
                      <Select value={damageNotation} onValueChange={setDamageNotation}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1d4">1d4</SelectItem>
                          <SelectItem value="1d6">1d6</SelectItem>
                          <SelectItem value="1d8">1d8</SelectItem>
                          <SelectItem value="1d10">1d10</SelectItem>
                          <SelectItem value="1d12">1d12</SelectItem>
                          <SelectItem value="2d6">2d6</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Bonus Daño</Label>
                      <Input type="number" value={damageBonus} onChange={(e) => setDamageBonus(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* RIGHT: Combat */}
            <div className="space-y-4">
              <Card className={`card-parchment ${objectHP === 0 ? 'border-red-500/50' : ''}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{objectName || 'Objeto'}</CardTitle>
                </CardHeader>
                <CardContent>
                  {combatStarted ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-500/20 p-3 rounded text-center">
                          <Shield className="w-6 h-6 mx-auto text-blue-400 mb-1" />
                          <p className="text-2xl font-bold">{objectCA}</p>
                          <p className="text-xs text-muted-foreground">CA</p>
                        </div>
                        <div className={`p-3 rounded text-center ${objectHP > 0 ? 'bg-red-500/20' : 'bg-gray-500/20'}`}>
                          <Heart className={`w-6 h-6 mx-auto mb-1 ${objectHP > 0 ? 'text-red-400' : 'text-gray-500'}`} />
                          <p className="text-2xl font-bold">{objectHP} / {objectMaxHP}</p>
                          <p className="text-xs text-muted-foreground">PG</p>
                        </div>
                      </div>
                      
                      <Progress value={(objectHP / objectMaxHP) * 100} className="h-4" />
                      
                      <Button 
                        onClick={attackObject}
                        disabled={objectHP <= 0}
                        className="w-full h-12 text-lg"
                        data-testid="attack-object-btn"
                      >
                        <Dice6 className="w-5 h-5 mr-2" />
                        {objectHP > 0 ? '¡Atacar!' : 'Destruido'}
                      </Button>
                      
                      {objectHP <= 0 && (
                        <div className="text-center p-4 bg-green-500/20 rounded border border-green-500/30">
                          <Check className="w-8 h-8 mx-auto text-green-400 mb-2" />
                          <p className="font-bold text-green-400">¡Destruido!</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-6 text-muted-foreground">
                      <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Crea un objeto para comenzar</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Combat Log */}
              <Card className="card-parchment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Dice6 className="w-5 h-5" /> Registro de Combate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-56">
                    {combatLog.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">El registro aparecerá aquí...</p>
                    ) : (
                      <div className="space-y-2">
                        {combatLog.map((entry, idx) => (
                          <div key={idx} className={`p-2 rounded text-sm border-l-2 ${
                            entry.type === 'info' ? 'bg-blue-500/20 border-blue-500' :
                            entry.type === 'warning' ? 'bg-yellow-500/20 border-yellow-500' :
                            entry.type === 'crit' ? 'bg-yellow-500/20 border-yellow-500' :
                            entry.type === 'fumble' ? 'bg-red-500/20 border-red-500' :
                            entry.type === 'immune' ? 'bg-gray-500/20 border-gray-500' :
                            entry.hit ? 'bg-green-500/20 border-green-500' :
                            'bg-gray-500/20 border-gray-500'
                          }`}>
                            <p>{entry.text}</p>
                            {entry.destroyed && <Badge className="mt-1 bg-green-600">DESTRUIDO</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="reference">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Materials Table */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Materiales y Vulnerabilidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {materials.map(m => (
                    <div key={m.id} className="p-2 bg-black/10 rounded">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{m.icon} {m.nombre}</span>
                        <Badge variant="outline">CA {m.ca}</Badge>
                      </div>
                      <div className="text-xs space-x-2">
                        {m.vulnerable?.length > 0 && (
                          <span className="text-red-400">
                            Vuln: {m.vulnerable.map(v => DAMAGE_TYPES.find(d => d.id === v)?.icon).join('')}
                          </span>
                        )}
                        {m.resistant?.length > 0 && (
                          <span className="text-blue-400">
                            Res: {m.resistant.map(r => DAMAGE_TYPES.find(d => d.id === r)?.icon).join('')}
                          </span>
                        )}
                        {m.immune?.length > 0 && (
                          <span className="text-gray-400">
                            Inm: {m.immune.map(i => DAMAGE_TYPES.find(d => d.id === i)?.icon).join('')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Sizes Table */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Heart className="w-5 h-5" /> Tamaños y Puntos de Golpe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sizes.map(s => (
                    <div key={s.id} className="flex justify-between items-center p-2 bg-black/10 rounded">
                      <div>
                        <span className="font-medium">{s.nombre}</span>
                        <p className="text-xs text-muted-foreground">{s.ejemplos}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">Frágil: {s.fragil}</Badge>
                        <Badge className="bg-blue-600">Resist: {s.resistente}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Damage Types */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Tipos de Daño</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {DAMAGE_TYPES.map(dt => (
                    <div key={dt.id} className="text-center p-2 bg-black/10 rounded">
                      <span className="text-2xl">{dt.icon}</span>
                      <p className="text-xs">{dt.nombre}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Special Rules */}
            <Card className="card-parchment">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[hsl(var(--gold))]">Reglas Especiales</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <Badge variant="destructive">1</Badge>
                    <span><strong>Pifia:</strong> Fallo automático. 50% de dañar el arma.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge className="bg-yellow-600">20</Badge>
                    <span><strong>Crítico:</strong> Impacto automático, daño doble.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge className="bg-red-600">×2</Badge>
                    <span><strong>Vulnerable:</strong> El daño se duplica.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge className="bg-blue-600">×0.5</Badge>
                    <span><strong>Resistente:</strong> El daño se reduce a la mitad.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge className="bg-gray-600">×0</Badge>
                    <span><strong>Inmune:</strong> No recibe daño de ese tipo.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Material Editor Modal */}
      {showMaterialEditor && (
        <MaterialEditor 
          materials={materials}
          onSave={saveMaterials}
          onClose={() => setShowMaterialEditor(false)}
        />
      )}
    </div>
  );
};

export default ObjectInteractionSection;
