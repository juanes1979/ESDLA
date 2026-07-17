/**
 * NPC Editor - Create and edit NPCs with structured data
 * Supports weapons, actions, specials, and all combat stats
 */
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Sword, Shield, Heart, Zap, Sparkles, Eye, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';
import { ALL_SKILLS } from '@/components/admin/culture-editor-sections/cultureEditorConstants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NPCEditor = ({ npc, onSave, onClose }) => {
  const isEditing = !!npc?.id;
  
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'malignos',
    descripcion: '',
    tipo: '',
    tamanio: 'Mediano',
    alineamiento: '',
    // Combat
    clase_armadura: 10,
    descripcion_armadura: '',
    puntos_golpe: 1,
    dados_golpe: '',
    velocidad: 9,
    velocidades_especiales: {},
    // Attributes
    atributos: {
      fuerza: 10, destreza: 10, constitucion: 10,
      inteligencia: 10, sabiduria: 10, carisma: 10
    },
    // Saves & Skills
    tiradas_salvacion: {},
    habilidades: {},
    percepcion_pasiva: 10,
    // Resistances
    resistencias: [],
    inmunidades_dano: [],
    inmunidades_estados: [],
    vulnerabilidades: [],
    // Senses
    sentidos: [],
    idiomas: [],
    // Challenge
    desafio: '',
    experiencia: 0,
    bonificador_competencia: 2,
    // Structured data
    especiales: [],
    armas: [],
    acciones: [],
    ataque_multiple: '',
    reacciones: [],
    acciones_legendarias: [],
    // Story
    historia: '',
    // Razas / tipos que puede ocupar (para el creador de adversarios en «PNJs»)
    modo_raza: 'racial',
    razas_permitidas: [],
    tipos_criatura: []
  });

  const [activeTab, setActiveTab] = useState('basico');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Ataque múltiple es opcional: solo se muestra si el PNJ/animal lo tiene.
  const [showMulti, setShowMulti] = useState(false);
  // Fila para añadir una habilidad conocida (desplegable + modificador).
  const [nuevaHab, setNuevaHab] = useState({ skill: '', mod: '' });

  // Sincroniza el interruptor de ataque múltiple cuando se carga un PNJ existente.
  useEffect(() => {
    setShowMulti(!!(npc && npc.ataque_multiple && String(npc.ataque_multiple).trim()));
  }, [npc]);

  // Load NPC data if editing
  useEffect(() => {
    if (npc) {
      setFormData({
        ...formData,
        ...npc,
        atributos: npc.atributos || formData.atributos,
        especiales: npc.especiales || [],
        armas: npc.armas || [],
        acciones: npc.acciones || [],
        reacciones: npc.reacciones || [],
        resistencias: npc.resistencias || [],
        inmunidades_dano: npc.inmunidades_dano || [],
        inmunidades_estados: npc.inmunidades_estados || [],
        vulnerabilidades: npc.vulnerabilidades || [],
        sentidos: Array.isArray(npc.sentidos) ? npc.sentidos : (npc.sentidos ? [npc.sentidos] : []),
        idiomas: npc.idiomas || [],
        modo_raza: npc.modo_raza || 'racial',
        razas_permitidas: Array.isArray(npc.razas_permitidas) ? npc.razas_permitidas : [],
        tipos_criatura: Array.isArray(npc.tipos_criatura) ? npc.tipos_criatura : []
      });
    }
  }, [npc]);

  // Razas y tipos de criatura disponibles para el bloque "Razas que puede ocupar".
  const [razasDisp, setRazasDisp] = useState([]);
  const [tiposDisp, setTiposDisp] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const [m, ct] = await Promise.all([
          api.get('/trading/npc-meta'),
          api.get('/npc-generator/creature-types'),
        ]);
        setRazasDisp(Object.keys(m.data?.razas || {}));
        setTiposDisp(ct.data?.tipos || []);
      } catch { /* noop */ }
    })();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAttrChange = (attr, value) => {
    setFormData(prev => ({
      ...prev,
      atributos: { ...prev.atributos, [attr]: parseInt(value) || 10 }
    }));
  };

  // Array field helpers
  const addArrayItem = (field, defaultItem) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), defaultItem]
    }));
  };

  const updateArrayItem = (field, index, key, value) => {
    setFormData(prev => {
      const arr = [...(prev[field] || [])];
      arr[index] = { ...arr[index], [key]: value };
      return { ...prev, [field]: arr };
    });
  };

  const removeArrayItem = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // String array helpers
  const addStringItem = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), '']
    }));
  };

  const updateStringItem = (field, index, value) => {
    setFormData(prev => {
      const arr = [...(prev[field] || [])];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const removeStringItem = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Habilidades conocidas: objeto { 'Percepción': 3, 'Sigilo': 4 }
  const habilidadesEntries = Object.entries(formData.habilidades || {});
  const habilidadesUsadas = habilidadesEntries.map(([k]) => k);
  const habilidadesDisponibles = ALL_SKILLS.filter((s) => !habilidadesUsadas.includes(s));

  const addHabilidad = () => {
    const skill = nuevaHab.skill;
    if (!skill) return;
    const modNum = parseInt(nuevaHab.mod, 10);
    setFormData(prev => ({
      ...prev,
      habilidades: { ...(prev.habilidades || {}), [skill]: Number.isNaN(modNum) ? 0 : modNum }
    }));
    setNuevaHab({ skill: '', mod: '' });
  };

  const updateHabilidadMod = (skill, value) => {
    const modNum = parseInt(value, 10);
    setFormData(prev => ({
      ...prev,
      habilidades: { ...(prev.habilidades || {}), [skill]: value === '' || value === '-' ? value : (Number.isNaN(modNum) ? 0 : modNum) }
    }));
  };

  const removeHabilidad = (skill) => {
    setFormData(prev => {
      const next = { ...(prev.habilidades || {}) };
      delete next[skill];
      return { ...prev, habilidades: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Normaliza los modificadores de habilidad a enteros antes de guardar.
    const habilidadesNorm = {};
    Object.entries(formData.habilidades || {}).forEach(([k, v]) => {
      const n = parseInt(v, 10);
      habilidadesNorm[k] = Number.isNaN(n) ? 0 : n;
    });
    const payload = { ...formData, habilidades: habilidadesNorm };

    try {
      const method = isEditing ? 'PATCH' : 'POST';
      const url = isEditing 
        ? `${API_URL}/api/data/npcs/${npc.id}`
        : `${API_URL}/api/data/npcs`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Error al guardar');
      }
      
      const saved = await response.json();
      onSave(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getModifier = (value) => {
    const mod = Math.floor((value - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[hsl(var(--parchment-dark))] border-2 border-[hsl(var(--gold))/50] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 bg-black/20">
          <h2 className="text-xl font-bold text-[hsl(var(--gold))]">
            {isEditing ? `Editar: ${npc.nombre}` : 'Crear Nuevo NPC'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/20 text-destructive border-b border-destructive/30">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex flex-wrap gap-1">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="atributos">Atributos</TabsTrigger>
              <TabsTrigger value="defensa">Defensa</TabsTrigger>
              <TabsTrigger value="especiales">Especiales</TabsTrigger>
              <TabsTrigger value="armas">Armas</TabsTrigger>
              <TabsTrigger value="acciones">Acciones</TabsTrigger>
              <TabsTrigger value="historia">Historia</TabsTrigger>
            </TabsList>

            {/* TAB: Básico */}
            <TabsContent value="basico" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input 
                    value={formData.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    placeholder="Nombre del NPC"
                    className="bg-black/20"
                  />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={formData.categoria} onValueChange={(v) => handleChange('categoria', v)}>
                    <SelectTrigger className="bg-black/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="malignos">Malignos</SelectItem>
                      <SelectItem value="pnj">PNJ</SelectItem>
                      <SelectItem value="animales">Animales</SelectItem>
                      <SelectItem value="especiales">Especiales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Input 
                    value={formData.tipo}
                    onChange={(e) => handleChange('tipo', e.target.value)}
                    placeholder="Ej: Humanoide Mediano (orco)"
                    className="bg-black/20"
                  />
                </div>
                <div>
                  <Label>Tamaño</Label>
                  <Select value={formData.tamanio} onValueChange={(v) => handleChange('tamanio', v)}>
                    <SelectTrigger className="bg-black/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diminuto">Diminuto</SelectItem>
                      <SelectItem value="Pequeño">Pequeño</SelectItem>
                      <SelectItem value="Mediano">Mediano</SelectItem>
                      <SelectItem value="Grande">Grande</SelectItem>
                      <SelectItem value="Enorme">Enorme</SelectItem>
                      <SelectItem value="Gargantuesco">Gargantuesco</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(formData.categoria === 'malignos' || formData.categoria === 'pnj') && (
                <div className="rounded-lg border border-[hsl(var(--gold))]/30 bg-black/20 p-3 space-y-2" data-testid="npc-razas-block">
                  <Label className="text-[hsl(var(--gold))]">Razas que puede ocupar este tipo</Label>
                  <p className="text-xs text-muted-foreground">Define qué razas puede tener al crear un adversario/PNJ concreto en «PNJs». Ej.: un frontero hobbit no puede ser elfo.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleChange('modo_raza', 'racial')} data-testid="npc-modo-racial"
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${formData.modo_raza === 'racial' ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground'}`}>Racial (elige razas)</button>
                    <button type="button" onClick={() => handleChange('modo_raza', 'sin_raza')} data-testid="npc-modo-sinraza"
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${formData.modo_raza === 'sin_raza' ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground'}`}>Sin raza (tipos de criatura)</button>
                  </div>
                  {formData.modo_raza === 'racial' ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {razasDisp.map((r) => {
                        const on = (formData.razas_permitidas || []).includes(r);
                        return (
                          <button key={r} type="button" data-testid={`npc-raza-perm-${r}`}
                            onClick={() => handleChange('razas_permitidas', on ? formData.razas_permitidas.filter((x) => x !== r) : [...(formData.razas_permitidas || []), r])}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${on ? 'bg-emerald-900/40 border-emerald-700 text-emerald-200' : 'border-border/50 text-muted-foreground'}`}>{r}</button>
                        );
                      })}
                      {razasDisp.length === 0 && <span className="text-xs text-muted-foreground">Cargando razas…</span>}
                      <span className="text-[11px] text-muted-foreground self-center">{(formData.razas_permitidas || []).length === 0 ? '(ninguna marcada = todas permitidas)' : ''}</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {tiposDisp.map((t) => {
                        const val = t.value || t.id || t;
                        const label = t.label || t.nombre || t;
                        const on = (formData.tipos_criatura || []).includes(val);
                        return (
                          <button key={val} type="button" data-testid={`npc-tipo-crit-${val}`}
                            onClick={() => handleChange('tipos_criatura', on ? formData.tipos_criatura.filter((x) => x !== val) : [...(formData.tipos_criatura || []), val])}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${on ? 'bg-rose-900/40 border-rose-700 text-rose-200' : 'border-border/50 text-muted-foreground'}`}>{label}</button>
                        );
                      })}
                      {tiposDisp.length === 0 && <span className="text-xs text-muted-foreground">Cargando tipos…</span>}
                    </div>
                  )}
                </div>
              )}


              <div>
                <Label>Descripción</Label>
                <Textarea 
                  value={formData.descripcion}
                  onChange={(e) => handleChange('descripcion', e.target.value)}
                  placeholder="Descripción del NPC..."
                  className="bg-black/20"
                  rows={3}
                />
              </div>

              {/* Combat Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-black/10 rounded-lg">
                <div className="text-center">
                  <Shield className="w-6 h-6 mx-auto text-[hsl(var(--magic-blue))] mb-1" />
                  <Label className="text-xs">CA</Label>
                  <Input 
                    type="number"
                    value={formData.clase_armadura}
                    onChange={(e) => handleChange('clase_armadura', parseInt(e.target.value) || 10)}
                    className="bg-black/20 text-center"
                  />
                </div>
                <div className="text-center">
                  <Heart className="w-6 h-6 mx-auto text-red-400 mb-1" />
                  <Label className="text-xs">PG</Label>
                  <Input 
                    type="number"
                    value={formData.puntos_golpe}
                    onChange={(e) => handleChange('puntos_golpe', parseInt(e.target.value) || 1)}
                    className="bg-black/20 text-center"
                  />
                </div>
                <div className="text-center">
                  <Zap className="w-6 h-6 mx-auto text-yellow-400 mb-1" />
                  <Label className="text-xs">Velocidad (m)</Label>
                  <Input 
                    type="number"
                    value={formData.velocidad}
                    onChange={(e) => handleChange('velocidad', parseFloat(e.target.value) || 9)}
                    className="bg-black/20 text-center"
                  />
                </div>
                <div className="text-center">
                  <Sparkles className="w-6 h-6 mx-auto text-[hsl(var(--gold))] mb-1" />
                  <Label className="text-xs">PX</Label>
                  <Input 
                    type="number"
                    value={formData.experiencia}
                    onChange={(e) => handleChange('experiencia', parseInt(e.target.value) || 0)}
                    className="bg-black/20 text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Dados de Golpe</Label>
                  <Input 
                    value={formData.dados_golpe}
                    onChange={(e) => handleChange('dados_golpe', e.target.value)}
                    placeholder="Ej: 2d8 + 4"
                    className="bg-black/20"
                  />
                </div>
                <div>
                  <Label>Armadura (descripción)</Label>
                  <Input 
                    value={formData.descripcion_armadura}
                    onChange={(e) => handleChange('descripcion_armadura', e.target.value)}
                    placeholder="Ej: cota de mallas, escudo"
                    className="bg-black/20"
                  />
                </div>
                <div>
                  <Label>Desafío</Label>
                  <Input 
                    value={formData.desafio}
                    onChange={(e) => handleChange('desafio', e.target.value)}
                    placeholder="Ej: 3 (700 PX)"
                    className="bg-black/20"
                  />
                </div>
                <div>
                  <Label>Percepción Pasiva</Label>
                  <Input 
                    type="number"
                    value={formData.percepcion_pasiva}
                    onChange={(e) => handleChange('percepcion_pasiva', parseInt(e.target.value) || 10)}
                    className="bg-black/20"
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB: Atributos */}
            <TabsContent value="atributos" className="space-y-4">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {[
                  { key: 'fuerza', label: 'FUE', color: 'red' },
                  { key: 'destreza', label: 'DES', color: 'green' },
                  { key: 'constitucion', label: 'CON', color: 'orange' },
                  { key: 'inteligencia', label: 'INT', color: 'blue' },
                  { key: 'sabiduria', label: 'SAB', color: 'purple' },
                  { key: 'carisma', label: 'CAR', color: 'pink' }
                ].map(attr => (
                  <div key={attr.key} className={`bg-${attr.color}-500/10 p-3 rounded text-center`}>
                    <Label className={`text-${attr.color}-400 font-bold text-sm`}>{attr.label}</Label>
                    <Input 
                      type="number"
                      value={formData.atributos[attr.key]}
                      onChange={(e) => handleAttrChange(attr.key, e.target.value)}
                      className="bg-black/20 text-center mt-1"
                    />
                    <p className={`text-sm text-${attr.color}-400 mt-1`}>
                      {getModifier(formData.atributos[attr.key])}
                    </p>
                  </div>
                ))}
              </div>

              {/* Idiomas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Idiomas</Label>
                  <Button variant="ghost" size="sm" onClick={() => addStringItem('idiomas')}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                </div>
                {formData.idiomas.map((idioma, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input 
                      value={idioma}
                      onChange={(e) => updateStringItem('idiomas', i, e.target.value)}
                      placeholder="Idioma"
                      className="bg-black/20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStringItem('idiomas', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Sentidos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Sentidos</Label>
                  <Button variant="ghost" size="sm" onClick={() => addStringItem('sentidos')}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                </div>
                {formData.sentidos.map((sentido, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input 
                      value={sentido}
                      onChange={(e) => updateStringItem('sentidos', i, e.target.value)}
                      placeholder="Ej: Visión en la oscuridad 36 m"
                      className="bg-black/20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStringItem('sentidos', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB: Defensa */}
            <TabsContent value="defensa" className="space-y-4">
              {/* Resistencias */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-blue-400">Resistencias</Label>
                  <Button variant="ghost" size="sm" onClick={() => addStringItem('resistencias')}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                </div>
                {formData.resistencias.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input 
                      value={item}
                      onChange={(e) => updateStringItem('resistencias', i, e.target.value)}
                      placeholder="Tipo de daño"
                      className="bg-black/20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStringItem('resistencias', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Inmunidades Daño */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-green-400">Inmunidades (Daño)</Label>
                  <Button variant="ghost" size="sm" onClick={() => addStringItem('inmunidades_dano')}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                </div>
                {formData.inmunidades_dano.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input 
                      value={item}
                      onChange={(e) => updateStringItem('inmunidades_dano', i, e.target.value)}
                      placeholder="Tipo de daño"
                      className="bg-black/20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStringItem('inmunidades_dano', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Inmunidades Estados */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-purple-400">Inmunidades (Estados)</Label>
                  <Button variant="ghost" size="sm" onClick={() => addStringItem('inmunidades_estados')}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                </div>
                {formData.inmunidades_estados.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input 
                      value={item}
                      onChange={(e) => updateStringItem('inmunidades_estados', i, e.target.value)}
                      placeholder="Estado"
                      className="bg-black/20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStringItem('inmunidades_estados', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Vulnerabilidades */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-red-400">Vulnerabilidades</Label>
                  <Button variant="ghost" size="sm" onClick={() => addStringItem('vulnerabilidades')}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                </div>
                {formData.vulnerabilidades.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input 
                      value={item}
                      onChange={(e) => updateStringItem('vulnerabilidades', i, e.target.value)}
                      placeholder="Tipo de daño"
                      className="bg-black/20"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeStringItem('vulnerabilidades', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Habilidades conocidas (Percepción +3, Sigilo +4, …) */}
              <div className="pt-2 border-t border-border/30">
                <Label className="text-cyan-400">Habilidades</Label>
                <p className="text-xs text-muted-foreground mb-2">Añade habilidades con su modificador (p. ej. Percepción +3).</p>

                {habilidadesEntries.map(([skill, mod]) => (
                  <div key={skill} className="flex gap-2 mb-2 items-center" data-testid={`npc-hab-row-${skill}`}>
                    <span className="flex-1 text-sm px-2 py-1.5 bg-black/20 rounded border border-border/40">{skill}</span>
                    <Input
                      type="number"
                      value={mod}
                      onChange={(e) => updateHabilidadMod(skill, e.target.value)}
                      className="w-20 bg-black/20 text-center"
                      data-testid={`npc-hab-mod-${skill}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeHabilidad(skill)} data-testid={`npc-hab-remove-${skill}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2 items-end mt-2 p-2 bg-black/10 rounded-lg border border-cyan-500/20">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Habilidad</Label>
                    <select
                      value={nuevaHab.skill}
                      onChange={(e) => setNuevaHab((p) => ({ ...p, skill: e.target.value }))}
                      className="w-full bg-black/30 rounded px-2 py-1.5 text-sm outline-none border border-border/50"
                      data-testid="npc-hab-select"
                    >
                      <option value="">— elige —</option>
                      {habilidadesDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-muted-foreground">Modificador</Label>
                    <Input
                      type="number"
                      value={nuevaHab.mod}
                      onChange={(e) => setNuevaHab((p) => ({ ...p, mod: e.target.value }))}
                      placeholder="+3"
                      className="bg-black/30 text-center"
                      data-testid="npc-hab-new-mod"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addHabilidad}
                    disabled={!nuevaHab.skill}
                    data-testid="npc-hab-add"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Añadir habilidad
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Especiales */}
            <TabsContent value="especiales" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg text-[hsl(var(--magic-blue))]">Habilidades Especiales</Label>
                <Button variant="outline" size="sm" onClick={() => addArrayItem('especiales', { nombre: '', descripcion: '' })}>
                  <Plus className="w-4 h-4 mr-1" /> Añadir Especial
                </Button>
              </div>
              
              {formData.especiales.map((esp, i) => (
                <div key={i} className="p-3 bg-black/10 rounded-lg border border-[hsl(var(--magic-blue))/30]">
                  <div className="flex justify-between mb-2">
                    <Input 
                      value={esp.nombre}
                      onChange={(e) => updateArrayItem('especiales', i, 'nombre', e.target.value)}
                      placeholder="Nombre de la habilidad"
                      className="bg-black/20 font-bold"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeArrayItem('especiales', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea 
                    value={esp.descripcion}
                    onChange={(e) => updateArrayItem('especiales', i, 'descripcion', e.target.value)}
                    placeholder="Descripción del efecto..."
                    className="bg-black/20"
                    rows={2}
                  />
                </div>
              ))}
            </TabsContent>

            {/* TAB: Armas */}
            <TabsContent value="armas" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg text-[hsl(var(--destructive))]">Armas / Ataques</Label>
                <Button variant="outline" size="sm" onClick={() => addArrayItem('armas', { 
                  nombre: '', tipo: 'cuerpo a cuerpo', bonificador_impacto: 0, 
                  alcance_metros: '1,5 m', dano: '', tipo_dano: '', efecto: '' 
                })}>
                  <Sword className="w-4 h-4 mr-1" /> Añadir Arma
                </Button>
              </div>

              <div>
                {showMulti ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Ataque Múltiple</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { handleChange('ataque_multiple', ''); setShowMulti(false); }}
                        data-testid="npc-multi-remove"
                      >
                        <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Quitar
                      </Button>
                    </div>
                    <Textarea
                      value={formData.ataque_multiple}
                      onChange={(e) => handleChange('ataque_multiple', e.target.value)}
                      placeholder="Descripción del ataque múltiple..."
                      className="bg-black/20"
                      rows={2}
                      data-testid="npc-multi-text"
                    />
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMulti(true)}
                    data-testid="npc-multi-add"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Añadir ataque múltiple
                  </Button>
                )}
              </div>
              
              {formData.armas.map((arma, i) => (
                <div key={i} className="p-3 bg-black/10 rounded-lg border border-[hsl(var(--destructive))/30]">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Sword className="w-4 h-4 text-[hsl(var(--destructive))]" />
                      <Input 
                        value={arma.nombre}
                        onChange={(e) => updateArrayItem('armas', i, 'nombre', e.target.value)}
                        placeholder="Nombre del arma"
                        className="bg-black/20 font-bold w-48"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeArrayItem('armas', i)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={arma.tipo} onValueChange={(v) => updateArrayItem('armas', i, 'tipo', v)}>
                        <SelectTrigger className="bg-black/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cuerpo a cuerpo">Cuerpo a cuerpo</SelectItem>
                          <SelectItem value="distancia">Distancia</SelectItem>
                          <SelectItem value="cuerpo a cuerpo o distancia">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">+Impacto</Label>
                      <Input 
                        type="number"
                        value={arma.bonificador_impacto}
                        onChange={(e) => updateArrayItem('armas', i, 'bonificador_impacto', parseInt(e.target.value) || 0)}
                        className="bg-black/20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alcance</Label>
                      <Input 
                        value={arma.alcance_metros}
                        onChange={(e) => updateArrayItem('armas', i, 'alcance_metros', e.target.value)}
                        placeholder="1,5 m"
                        className="bg-black/20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Daño</Label>
                      <Input 
                        value={arma.dano}
                        onChange={(e) => updateArrayItem('armas', i, 'dano', e.target.value)}
                        placeholder="1d8 + 3"
                        className="bg-black/20"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo Daño</Label>
                      <Input 
                        value={arma.tipo_dano}
                        onChange={(e) => updateArrayItem('armas', i, 'tipo_dano', e.target.value)}
                        placeholder="cortante"
                        className="bg-black/20"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Efecto Especial</Label>
                      <Input 
                        value={arma.efecto}
                        onChange={(e) => updateArrayItem('armas', i, 'efecto', e.target.value)}
                        placeholder="Efecto adicional al impactar..."
                        className="bg-black/20"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* TAB: Acciones */}
            <TabsContent value="acciones" className="space-y-4">
              {/* Other Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-lg text-[hsl(var(--gold))]">Otras Acciones</Label>
                  <Button variant="outline" size="sm" onClick={() => addArrayItem('acciones', { nombre: '', descripcion: '' })}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir Acción
                  </Button>
                </div>
                
                {(Array.isArray(formData.acciones) ? formData.acciones : []).map((acc, i) => (
                  <div key={i} className="p-3 bg-black/10 rounded-lg border border-[hsl(var(--gold))/30]">
                    <div className="flex justify-between mb-2">
                      <Input 
                        value={acc.nombre}
                        onChange={(e) => updateArrayItem('acciones', i, 'nombre', e.target.value)}
                        placeholder="Nombre de la acción"
                        className="bg-black/20 font-bold"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeArrayItem('acciones', i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea 
                      value={acc.descripcion}
                      onChange={(e) => updateArrayItem('acciones', i, 'descripcion', e.target.value)}
                      placeholder="Descripción..."
                      className="bg-black/20"
                      rows={2}
                    />
                  </div>
                ))}
              </div>

              {/* Reactions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-lg text-[hsl(var(--torch-orange))]">Reacciones</Label>
                  <Button variant="outline" size="sm" onClick={() => addArrayItem('reacciones', { nombre: '', descripcion: '' })}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir Reacción
                  </Button>
                </div>
                
                {formData.reacciones.map((rea, i) => (
                  <div key={i} className="p-3 bg-black/10 rounded-lg border border-[hsl(var(--torch-orange))/30]">
                    <div className="flex justify-between mb-2">
                      <Input 
                        value={rea.nombre}
                        onChange={(e) => updateArrayItem('reacciones', i, 'nombre', e.target.value)}
                        placeholder="Nombre de la reacción"
                        className="bg-black/20 font-bold"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeArrayItem('reacciones', i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea 
                      value={rea.descripcion}
                      onChange={(e) => updateArrayItem('reacciones', i, 'descripcion', e.target.value)}
                      placeholder="Descripción..."
                      className="bg-black/20"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB: Historia */}
            <TabsContent value="historia" className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-[hsl(var(--gold))]" />
                <Label className="text-lg text-[hsl(var(--gold))]">Historia / Trasfondo</Label>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Este campo está preparado para cuando la IA genere historias para los NPCs.
              </p>
              <Textarea 
                value={formData.historia}
                onChange={(e) => handleChange('historia', e.target.value)}
                placeholder="Historia, trasfondo, personalidad, motivaciones del NPC..."
                className="bg-black/20"
                rows={8}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border/30 bg-black/20">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving || !formData.nombre}
            className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
          >
            {saving ? 'Guardando...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Guardar Cambios' : 'Crear NPC'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NPCEditor;
