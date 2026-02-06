/**
 * Occupation Editor Modal - Complete version
 * Create/Edit occupations with all required fields
 */
import { useState, useEffect } from 'react';
import { X, Save, Copy, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/services/api';

// All available skills
const ALL_SKILLS = [
  'Acertijos', 'Acrobacias', 'Atletismo', 'Cazar', 'Engaño', 'Explorar',
  'Interpretación', 'Intimidación', 'Investigación', 'Juego de manos',
  'Medicina', 'Naturaleza', 'Percepción', 'Perspicacia', 'Persuasión',
  'Saber antiguo', 'Sigilo', 'Trato con animales', 'Viajar'
];

// Attributes
const ATTRIBUTES = ['Fuerza', 'Destreza', 'Constitución', 'Inteligencia', 'Sabiduría', 'Carisma'];

// Hit dice options
const HIT_DICE = ['1d6', '1d8', '1d10', '1d12'];

// Collapsible Section Component
const Section = ({ title, children, defaultOpen = true, color = 'gold' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colorClass = color === 'destructive' ? 'hsl(var(--destructive))' : 
                     color === 'magic-blue' ? 'hsl(var(--magic-blue))' : 
                     color === 'torch-orange' ? 'hsl(var(--torch-orange))' : 'hsl(var(--gold))';
  
  return (
    <div className={`border border-[${colorClass}]/30 rounded-lg overflow-hidden`}>
      <button
        type="button"
        className={`w-full flex items-center justify-between p-4 bg-black/20 hover:bg-black/30 transition-colors`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className={`font-heading text-[${colorClass}]`}>{title}</h3>
        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};

const OccupationEditor = ({ occupation, onSave, onClose, onCopy }) => {
  const isEditing = !!occupation;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [equipmentLists, setEquipmentLists] = useState({ armas: [], armaduras: [], herramientas: [], juegos: [], instrumentos: [] });
  
  // Load equipment lists
  useEffect(() => {
    const loadEquipment = async () => {
      try {
        const catalog = await api.get('/data/equipment-catalog');
        const lists = await api.get('/data/equipment-lists');
        setEquipmentLists({
          armas_sencillas_cc: catalog.data.armas_sencillas_cc || [],
          armas_sencillas_distancia: catalog.data.armas_sencillas_distancia || [],
          armas_marciales_cc: catalog.data.armas_marciales_cc || [],
          armas_marciales_distancia: catalog.data.armas_marciales_distancia || [],
          armaduras_ligeras: catalog.data.armaduras_ligeras || [],
          armaduras_medias: catalog.data.armaduras_medias || [],
          armaduras_pesadas: catalog.data.armaduras_pesadas || [],
          escudos: catalog.data.escudos || [],
          herramientas: catalog.data.herramientas || [],
          juegos: lists.data.juegos || [],
          instrumentos: lists.data.instrumentos_musicales || [],
        });
      } catch (err) {
        console.error('Error loading equipment:', err);
      }
    };
    loadEquipment();
  }, []);

  const [formData, setFormData] = useState({
    // Basic info
    vocacion: occupation?.vocacion || '',
    descripcion_corta: occupation?.descripcion_corta || '',
    descripcion_ocupacion_larga: occupation?.descripcion_ocupacion_larga || '',
    dado_golpe: occupation?.dado_golpe || '1d8',
    puntos_golpe_base: occupation?.puntos_golpe_base || 8,
    
    // Main attributes (max 2)
    caracteristicas_principales: occupation?.caracteristicas_principales || [],
    
    // Saving throws (max 2)
    tiradas_salvacion: occupation?.tiradas_salvacion || [],
    
    // Favored skills (max 3)
    habilidades_favorecidas: occupation?.habilidades_favorecidas || [],
    
    // Weapon/armor proficiencies
    competencia_armas_sencillas: occupation?.competencia_armas_sencillas ?? true,
    competencia_armas_marciales: occupation?.competencia_armas_marciales ?? false,
    competencia_armaduras_ligeras: occupation?.competencia_armaduras_ligeras ?? true,
    competencia_armaduras_medias: occupation?.competencia_armaduras_medias ?? false,
    competencia_armaduras_pesadas: occupation?.competencia_armaduras_pesadas ?? false,
    competencia_escudos: occupation?.competencia_escudos ?? false,
    
    // Shadow Path with 4 defects
    senda_sombra: {
      nombre: occupation?.senda_sombra?.nombre || occupation?.maldicion_nombre || '',
      descripcion: occupation?.senda_sombra?.descripcion || occupation?.maldicion_descripcion || '',
      defectos: occupation?.senda_sombra?.defectos?.length === 4 
        ? occupation.senda_sombra.defectos 
        : [
            { nombre: '', descripcion: '', efecto_juego: '' },
            { nombre: '', descripcion: '', efecto_juego: '' },
            { nombre: '', descripcion: '', efecto_juego: '' },
            { nombre: '', descripcion: '', efecto_juego: '' }
          ]
    },
    
    // Equipment blocks
    equipo_herramientas_juegos_instrumentos: occupation?.equipo_herramientas_juegos_instrumentos || {
      opciones: [], // list of tools/games/instruments to choose from
      cantidad_elegir: 1
    },
    
    equipo_habilidades_elegir: occupation?.equipo_habilidades_elegir || {
      opciones: [], // list of skills
      cantidad_elegir: 2
    },
    
    equipo_opcion_ab_armaduras_armas: occupation?.equipo_opcion_ab_armaduras_armas || {
      opcion_a: { armaduras: [], armas: [] },
      opcion_b: { armaduras: [], armas: [] }
    },
    
    equipo_herramienta_fija: occupation?.equipo_herramienta_fija || '',
    
    equipo_herramientas_elegir: occupation?.equipo_herramientas_elegir || {
      opciones: [],
      cantidad_elegir: 1
    },
    
    equipo_armas_disponibles: occupation?.equipo_armas_disponibles || {
      opciones: [],
      cantidad_elegir: 1
    },
    
    equipo_armas_elegir: occupation?.equipo_armas_elegir || {
      opciones: [],
      cantidad_elegir: 1
    },
    
    equipo_opcion_ab_armas: occupation?.equipo_opcion_ab_armas || {
      opcion_a: [],
      opcion_b: { armas: [], cantidad_elegir: 1 }
    },
    
    equipo_opcion_ab_armas_escudo: occupation?.equipo_opcion_ab_armas_escudo || {
      opcion_a: { armas: [], incluye_escudo: true },
      opcion_b: { bloque1: [], bloque2: [] }
    },
    
    // Profession paths (specializations)
    caminos: {
      nombre_especialidad: occupation?.caminos?.nombre_especialidad || '',
      nivel_especializacion: occupation?.caminos?.nivel_especializacion || 3,
      especialidades: occupation?.caminos?.especialidades?.length === 2 
        ? occupation.caminos.especialidades.map(esp => ({
            nombre: esp?.nombre || '',
            descripcion: esp?.descripcion || '',
            caracteristicas: esp?.caracteristicas?.length === 3 
              ? esp.caracteristicas 
              : ['', '', '']
          }))
        : [
            { nombre: '', descripcion: '', caracteristicas: ['', '', ''] },
            { nombre: '', descripcion: '', caracteristicas: ['', '', ''] }
          ]
    },
    
    // Virtue and Art levels
    niveles_virtudes: occupation?.niveles_virtudes || '4, 6, 8',
    niveles_artes: occupation?.niveles_artes || '6',
    descripcion_virtudes: occupation?.descripcion_virtudes || '',
    descripcion_artes: occupation?.descripcion_artes || '',
    
    // Special abilities
    especiales_ocupacion: occupation?.especiales_ocupacion || [],
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (field, subfield, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [subfield]: value
      }
    }));
  };

  const toggleArrayItem = (field, item, maxItems = null) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter(i => i !== item) };
      } else {
        if (maxItems && arr.length >= maxItems) {
          toast.error(`Máximo ${maxItems} selecciones permitidas`);
          return prev;
        }
        return { ...prev, [field]: [...arr, item] };
      }
    });
  };

  const updateDefect = (index, field, value) => {
    setFormData(prev => {
      const newDefectos = [...prev.senda_sombra.defectos];
      newDefectos[index] = { ...newDefectos[index], [field]: value };
      return {
        ...prev,
        senda_sombra: { ...prev.senda_sombra, defectos: newDefectos }
      };
    });
  };

  const updateEspecialidad = (index, field, value) => {
    setFormData(prev => {
      const newEspecialidades = [...prev.caminos.especialidades];
      newEspecialidades[index] = { ...newEspecialidades[index], [field]: value };
      return {
        ...prev,
        caminos: { ...prev.caminos, especialidades: newEspecialidades }
      };
    });
  };

  const updateEspecialidadCaracteristica = (espIndex, carIndex, value) => {
    setFormData(prev => {
      const newEspecialidades = [...prev.caminos.especialidades];
      const newCaracteristicas = [...newEspecialidades[espIndex].caracteristicas];
      newCaracteristicas[carIndex] = value;
      newEspecialidades[espIndex] = { ...newEspecialidades[espIndex], caracteristicas: newCaracteristicas };
      return {
        ...prev,
        caminos: { ...prev.caminos, especialidades: newEspecialidades }
      };
    });
  };

  const addSpecialAbility = () => {
    setFormData(prev => ({
      ...prev,
      especiales_ocupacion: [...prev.especiales_ocupacion, { nombre: '', descripcion: '' }]
    }));
  };

  const removeSpecialAbility = (index) => {
    setFormData(prev => ({
      ...prev,
      especiales_ocupacion: prev.especiales_ocupacion.filter((_, i) => i !== index)
    }));
  };

  const updateSpecialAbility = (index, field, value) => {
    setFormData(prev => {
      const newAbilities = [...prev.especiales_ocupacion];
      newAbilities[index] = { ...newAbilities[index], [field]: value };
      return { ...prev, especiales_ocupacion: newAbilities };
    });
  };

  const handleSubmit = async () => {
    if (!formData.vocacion.trim()) {
      setError('El nombre de la ocupación es obligatorio');
      return;
    }

    if (formData.caracteristicas_principales.length !== 2) {
      setError('Debes seleccionar exactamente 2 características principales');
      return;
    }

    if (formData.tiradas_salvacion.length !== 2) {
      setError('Debes seleccionar exactamente 2 tiradas de salvación');
      return;
    }

    if (formData.habilidades_favorecidas.length !== 3) {
      setError('Debes seleccionar exactamente 3 habilidades favorecidas');
      return;
    }

    // Validate shadow path defects
    const defectsValid = formData.senda_sombra.defectos.every(d => d.nombre.trim());
    if (!defectsValid) {
      setError('Debes rellenar los 4 defectos de la senda de la sombra');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await api.put(`/data/occupations/${occupation.id}`, formData);
      } else {
        await api.post('/data/occupations', formData);
      }
      
      // Also update the shadow path in sombra_rules if new defects
      if (formData.senda_sombra.nombre) {
        try {
          await api.post('/data/sombra/sendas', {
            ocupacion: formData.vocacion,
            senda: formData.senda_sombra.nombre,
            descripcion: formData.senda_sombra.descripcion,
            defectos: formData.senda_sombra.defectos
          });
        } catch (err) {
          console.warn('Could not update shadow paths:', err);
        }
      }
      
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Get all weapons from equipment lists
  const getAllWeapons = () => {
    const weapons = [];
    ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia'].forEach(cat => {
      (equipmentLists[cat] || []).forEach(w => {
        if (w.nombre) weapons.push(w.nombre);
      });
    });
    return weapons;
  };

  const getAllArmors = () => {
    const armors = [];
    ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos'].forEach(cat => {
      (equipmentLists[cat] || []).forEach(a => {
        if (a.nombre) armors.push(a.nombre);
      });
    });
    return armors;
  };

  const getAllTools = () => {
    return [
      ...(equipmentLists.herramientas || []).map(h => h.nombre),
      ...(equipmentLists.juegos || []),
      ...(equipmentLists.instrumentos || [])
    ].filter(Boolean);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" data-testid="occupation-editor-modal">
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            {isEditing ? `Editar: ${occupation.vocacion}` : 'Crear Nueva Ocupación'}
          </h2>
          <div className="flex gap-2">
            {isEditing && onCopy && (
              <Button variant="outline" size="sm" onClick={() => onCopy(occupation)}>
                <Copy className="w-4 h-4 mr-2" /> Copiar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto max-h-[calc(95vh-140px)]">
          {error && (
            <div className="bg-destructive/20 text-destructive p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* === BASIC INFO === */}
            <Section title="📋 Información Básica" defaultOpen={true}>
              <div className="grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre de la Ocupación *</Label>
                    <Input
                      value={formData.vocacion}
                      onChange={(e) => handleChange('vocacion', e.target.value)}
                      placeholder="Ej: Montaraz"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Dado de Golpe</Label>
                      <Select value={formData.dado_golpe} onValueChange={(v) => handleChange('dado_golpe', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HIT_DICE.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>PG Base</Label>
                      <Input
                        type="number"
                        value={formData.puntos_golpe_base}
                        onChange={(e) => handleChange('puntos_golpe_base', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Descripción Corta</Label>
                  <Input value={formData.descripcion_corta} onChange={(e) => handleChange('descripcion_corta', e.target.value)} />
                </div>
                <div>
                  <Label>Descripción Larga</Label>
                  <Textarea value={formData.descripcion_ocupacion_larga} onChange={(e) => handleChange('descripcion_ocupacion_larga', e.target.value)} rows={3} />
                </div>
              </div>
            </Section>

            {/* === CHARACTERISTICS (max 2) === */}
            <Section title={`⚡ Características Principales (${formData.caracteristicas_principales.length}/2)`}>
              <p className="text-xs text-muted-foreground mb-3">Selecciona exactamente 2 características principales</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {ATTRIBUTES.map(attr => (
                  <div key={attr} className={`flex items-center gap-2 p-2 rounded border ${formData.caracteristicas_principales.includes(attr) ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))/10]' : 'border-border/30'}`}>
                    <Checkbox
                      checked={formData.caracteristicas_principales.includes(attr)}
                      onCheckedChange={() => toggleArrayItem('caracteristicas_principales', attr, 2)}
                    />
                    <Label className="text-sm cursor-pointer">{attr}</Label>
                  </div>
                ))}
              </div>
            </Section>

            {/* === SAVING THROWS (max 2) === */}
            <Section title={`🛡️ Tiradas de Salvación (${formData.tiradas_salvacion.length}/2)`}>
              <p className="text-xs text-muted-foreground mb-3">Selecciona exactamente 2 tiradas de salvación</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {ATTRIBUTES.map(attr => (
                  <div key={`save-${attr}`} className={`flex items-center gap-2 p-2 rounded border ${formData.tiradas_salvacion.includes(attr) ? 'border-[hsl(var(--magic-blue))] bg-[hsl(var(--magic-blue))/10]' : 'border-border/30'}`}>
                    <Checkbox
                      checked={formData.tiradas_salvacion.includes(attr)}
                      onCheckedChange={() => toggleArrayItem('tiradas_salvacion', attr, 2)}
                    />
                    <Label className="text-sm cursor-pointer">{attr}</Label>
                  </div>
                ))}
              </div>
            </Section>

            {/* === FAVORED SKILLS (max 3) === */}
            <Section title={`📚 Habilidades Favorecidas (${formData.habilidades_favorecidas.length}/3)`}>
              <p className="text-xs text-muted-foreground mb-3">Selecciona exactamente 3 habilidades favorecidas</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {ALL_SKILLS.map(skill => (
                  <div key={skill} className={`flex items-center gap-2 p-2 rounded border text-sm ${formData.habilidades_favorecidas.includes(skill) ? 'border-[hsl(var(--torch-orange))] bg-[hsl(var(--torch-orange))/10]' : 'border-border/30'}`}>
                    <Checkbox
                      checked={formData.habilidades_favorecidas.includes(skill)}
                      onCheckedChange={() => toggleArrayItem('habilidades_favorecidas', skill, 3)}
                    />
                    <Label className="text-xs cursor-pointer">{skill}</Label>
                  </div>
                ))}
              </div>
            </Section>

            {/* === WEAPON/ARMOR PROFICIENCIES === */}
            <Section title="⚔️ Competencias en Armas y Armaduras">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Armas</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.competencia_armas_sencillas} onCheckedChange={(v) => handleChange('competencia_armas_sencillas', v)} />
                    <Label>Armas Sencillas</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.competencia_armas_marciales} onCheckedChange={(v) => handleChange('competencia_armas_marciales', v)} />
                    <Label>Armas Marciales</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Armaduras</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.competencia_armaduras_ligeras} onCheckedChange={(v) => handleChange('competencia_armaduras_ligeras', v)} />
                    <Label>Ligeras</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.competencia_armaduras_medias} onCheckedChange={(v) => handleChange('competencia_armaduras_medias', v)} />
                    <Label>Medias</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.competencia_armaduras_pesadas} onCheckedChange={(v) => handleChange('competencia_armaduras_pesadas', v)} />
                    <Label>Pesadas</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={formData.competencia_escudos} onCheckedChange={(v) => handleChange('competencia_escudos', v)} />
                    <Label>Escudos</Label>
                  </div>
                </div>
              </div>
            </Section>

            {/* === SHADOW PATH === */}
            <Section title="💀 Senda de la Sombra" color="destructive">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre de la Senda *</Label>
                    <Input
                      value={formData.senda_sombra.nombre}
                      onChange={(e) => handleNestedChange('senda_sombra', 'nombre', e.target.value)}
                      placeholder="Ej: Atracción de los secretos"
                    />
                  </div>
                  <div>
                    <Label>Descripción de la Senda</Label>
                    <Textarea
                      value={formData.senda_sombra.descripcion}
                      onChange={(e) => handleNestedChange('senda_sombra', 'descripcion', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-[hsl(var(--destructive))]">4 Defectos de la Senda (obligatorios)</Label>
                  {formData.senda_sombra.defectos.map((defecto, idx) => (
                    <div key={idx} className="p-3 bg-[hsl(var(--destructive))/10] rounded border border-[hsl(var(--destructive))/30]">
                      <Label className="text-xs text-muted-foreground mb-2 block">Defecto {idx + 1}</Label>
                      <div className="grid md:grid-cols-3 gap-2">
                        <Input
                          placeholder="Nombre del defecto *"
                          value={defecto.nombre}
                          onChange={(e) => updateDefect(idx, 'nombre', e.target.value)}
                        />
                        <Input
                          placeholder="Descripción"
                          value={defecto.descripcion}
                          onChange={(e) => updateDefect(idx, 'descripcion', e.target.value)}
                        />
                        <Input
                          placeholder="Efecto en el juego"
                          value={defecto.efecto_juego}
                          onChange={(e) => updateDefect(idx, 'efecto_juego', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* === EQUIPMENT - TOOLS/GAMES/INSTRUMENTS === */}
            <Section title="🎒 Equipo Inicial - Herramientas/Juegos/Instrumentos" color="torch-orange">
              <p className="text-xs text-muted-foreground mb-3">Primera opción: selecciona herramientas, juegos o instrumentos entre los que el jugador podrá elegir</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad a elegir</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.equipo_herramientas_juegos_instrumentos.cantidad_elegir}
                    onChange={(e) => handleNestedChange('equipo_herramientas_juegos_instrumentos', 'cantidad_elegir', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Opciones disponibles</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_herramientas_juegos_instrumentos.opciones || [];
                      if (!current.includes(v)) {
                        handleNestedChange('equipo_herramientas_juegos_instrumentos', 'opciones', [...current, v]);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir opción..." /></SelectTrigger>
                    <SelectContent>
                      {getAllTools().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.equipo_herramientas_juegos_instrumentos.opciones || []).map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[hsl(var(--torch-orange))/20] rounded text-xs flex items-center gap-1">
                    {opt}
                    <button onClick={() => {
                      const newOpts = formData.equipo_herramientas_juegos_instrumentos.opciones.filter((_, i) => i !== idx);
                      handleNestedChange('equipo_herramientas_juegos_instrumentos', 'opciones', newOpts);
                    }}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Section>

            {/* === EQUIPMENT - SKILLS TO CHOOSE === */}
            <Section title="📖 Equipo - Habilidades con Competencia a Elegir" color="magic-blue">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad a elegir</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.equipo_habilidades_elegir.cantidad_elegir}
                    onChange={(e) => handleNestedChange('equipo_habilidades_elegir', 'cantidad_elegir', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Habilidades disponibles</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_habilidades_elegir.opciones || [];
                      if (!current.includes(v)) {
                        handleNestedChange('equipo_habilidades_elegir', 'opciones', [...current, v]);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir habilidad..." /></SelectTrigger>
                    <SelectContent>
                      {ALL_SKILLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.equipo_habilidades_elegir.opciones || []).map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[hsl(var(--magic-blue))/20] rounded text-xs flex items-center gap-1">
                    {opt}
                    <button onClick={() => {
                      const newOpts = formData.equipo_habilidades_elegir.opciones.filter((_, i) => i !== idx);
                      handleNestedChange('equipo_habilidades_elegir', 'opciones', newOpts);
                    }}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Section>

            {/* === EQUIPMENT - FIXED TOOL === */}
            <Section title="🔧 Herramienta Fija (sin elegir)">
              <Select
                value={formData.equipo_herramienta_fija}
                onValueChange={(v) => handleChange('equipo_herramienta_fija', v === 'ninguna' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar herramienta fija..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Ninguna</SelectItem>
                  {getAllTools().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Section>

            {/* === EQUIPMENT - TOOLS TO CHOOSE === */}
            <Section title="🔨 Herramientas a Elegir">
              <p className="text-xs text-muted-foreground mb-3">Herramientas entre las que el jugador puede elegir</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad a elegir</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.equipo_herramientas_elegir.cantidad_elegir}
                    onChange={(e) => handleNestedChange('equipo_herramientas_elegir', 'cantidad_elegir', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Añadir herramienta</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_herramientas_elegir.opciones || [];
                      if (!current.includes(v)) {
                        handleNestedChange('equipo_herramientas_elegir', 'opciones', [...current, v]);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir..." /></SelectTrigger>
                    <SelectContent>
                      {getAllTools().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.equipo_herramientas_elegir.opciones || []).map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-[hsl(var(--gold))/20] rounded text-xs flex items-center gap-1">
                    {opt}
                    <button onClick={() => {
                      const newOpts = formData.equipo_herramientas_elegir.opciones.filter((_, i) => i !== idx);
                      handleNestedChange('equipo_herramientas_elegir', 'opciones', newOpts);
                    }}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Section>

            {/* === EQUIPMENT - WEAPONS AVAILABLE === */}
            <Section title="⚔️ Armas Disponibles a Elegir">
              <p className="text-xs text-muted-foreground mb-3">Armas disponibles de las que el jugador puede elegir</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad a elegir</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.equipo_armas_disponibles.cantidad_elegir}
                    onChange={(e) => handleNestedChange('equipo_armas_disponibles', 'cantidad_elegir', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Añadir arma</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_armas_disponibles.opciones || [];
                      if (!current.includes(v)) {
                        handleNestedChange('equipo_armas_disponibles', 'opciones', [...current, v]);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir arma..." /></SelectTrigger>
                    <SelectContent>
                      {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.equipo_armas_disponibles.opciones || []).map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs flex items-center gap-1">
                    {opt}
                    <button onClick={() => {
                      const newOpts = formData.equipo_armas_disponibles.opciones.filter((_, i) => i !== idx);
                      handleNestedChange('equipo_armas_disponibles', 'opciones', newOpts);
                    }}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Section>

            {/* === EQUIPMENT - WEAPONS TO CHOOSE === */}
            <Section title="🗡️ Armas a Elegir">
              <p className="text-xs text-muted-foreground mb-3">Otro bloque de armas a elegir</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad a elegir</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.equipo_armas_elegir.cantidad_elegir}
                    onChange={(e) => handleNestedChange('equipo_armas_elegir', 'cantidad_elegir', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Añadir arma</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_armas_elegir.opciones || [];
                      if (!current.includes(v)) {
                        handleNestedChange('equipo_armas_elegir', 'opciones', [...current, v]);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir arma..." /></SelectTrigger>
                    <SelectContent>
                      {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.equipo_armas_elegir.opciones || []).map((opt, idx) => (
                  <span key={idx} className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs flex items-center gap-1">
                    {opt}
                    <button onClick={() => {
                      const newOpts = formData.equipo_armas_elegir.opciones.filter((_, i) => i !== idx);
                      handleNestedChange('equipo_armas_elegir', 'opciones', newOpts);
                    }}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </Section>

            {/* === EQUIPMENT - OPTION A/B ARMORS AND WEAPONS === */}
            <Section title="🛡️⚔️ Opción A o B: Armaduras y Armas" color="magic-blue">
              <p className="text-xs text-muted-foreground mb-3">El jugador elige entre Opción A u Opción B</p>
              
              {/* Option A */}
              <div className="p-3 bg-[hsl(var(--magic-blue))/10] rounded border border-[hsl(var(--magic-blue))/30] mb-4">
                <Label className="text-[hsl(var(--magic-blue))] font-bold mb-2 block">OPCIÓN A</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Armaduras en Opción A</Label>
                    <Select
                      onValueChange={(v) => {
                        const current = formData.equipo_opcion_ab_armaduras_armas.opcion_a.armaduras || [];
                        if (!current.includes(v)) {
                          handleChange('equipo_opcion_ab_armaduras_armas', {
                            ...formData.equipo_opcion_ab_armaduras_armas,
                            opcion_a: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_a, armaduras: [...current, v] }
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Añadir armadura..." /></SelectTrigger>
                      <SelectContent>
                        {getAllArmors().map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(formData.equipo_opcion_ab_armaduras_armas.opcion_a.armaduras || []).map((a, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs flex items-center gap-1">
                          {a}
                          <button onClick={() => {
                            const newArr = formData.equipo_opcion_ab_armaduras_armas.opcion_a.armaduras.filter((_, idx) => idx !== i);
                            handleChange('equipo_opcion_ab_armaduras_armas', {
                              ...formData.equipo_opcion_ab_armaduras_armas,
                              opcion_a: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_a, armaduras: newArr }
                            });
                          }}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Armas en Opción A</Label>
                    <Select
                      onValueChange={(v) => {
                        const current = formData.equipo_opcion_ab_armaduras_armas.opcion_a.armas || [];
                        if (!current.includes(v)) {
                          handleChange('equipo_opcion_ab_armaduras_armas', {
                            ...formData.equipo_opcion_ab_armaduras_armas,
                            opcion_a: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_a, armas: [...current, v] }
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Añadir arma..." /></SelectTrigger>
                      <SelectContent>
                        {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(formData.equipo_opcion_ab_armaduras_armas.opcion_a.armas || []).map((w, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs flex items-center gap-1">
                          {w}
                          <button onClick={() => {
                            const newArr = formData.equipo_opcion_ab_armaduras_armas.opcion_a.armas.filter((_, idx) => idx !== i);
                            handleChange('equipo_opcion_ab_armaduras_armas', {
                              ...formData.equipo_opcion_ab_armaduras_armas,
                              opcion_a: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_a, armas: newArr }
                            });
                          }}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Option B */}
              <div className="p-3 bg-[hsl(var(--torch-orange))/10] rounded border border-[hsl(var(--torch-orange))/30]">
                <Label className="text-[hsl(var(--torch-orange))] font-bold mb-2 block">OPCIÓN B</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Armaduras en Opción B</Label>
                    <Select
                      onValueChange={(v) => {
                        const current = formData.equipo_opcion_ab_armaduras_armas.opcion_b.armaduras || [];
                        if (!current.includes(v)) {
                          handleChange('equipo_opcion_ab_armaduras_armas', {
                            ...formData.equipo_opcion_ab_armaduras_armas,
                            opcion_b: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_b, armaduras: [...current, v] }
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Añadir armadura..." /></SelectTrigger>
                      <SelectContent>
                        {getAllArmors().map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(formData.equipo_opcion_ab_armaduras_armas.opcion_b.armaduras || []).map((a, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs flex items-center gap-1">
                          {a}
                          <button onClick={() => {
                            const newArr = formData.equipo_opcion_ab_armaduras_armas.opcion_b.armaduras.filter((_, idx) => idx !== i);
                            handleChange('equipo_opcion_ab_armaduras_armas', {
                              ...formData.equipo_opcion_ab_armaduras_armas,
                              opcion_b: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_b, armaduras: newArr }
                            });
                          }}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Armas en Opción B</Label>
                    <Select
                      onValueChange={(v) => {
                        const current = formData.equipo_opcion_ab_armaduras_armas.opcion_b.armas || [];
                        if (!current.includes(v)) {
                          handleChange('equipo_opcion_ab_armaduras_armas', {
                            ...formData.equipo_opcion_ab_armaduras_armas,
                            opcion_b: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_b, armas: [...current, v] }
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Añadir arma..." /></SelectTrigger>
                      <SelectContent>
                        {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(formData.equipo_opcion_ab_armaduras_armas.opcion_b.armas || []).map((w, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs flex items-center gap-1">
                          {w}
                          <button onClick={() => {
                            const newArr = formData.equipo_opcion_ab_armaduras_armas.opcion_b.armas.filter((_, idx) => idx !== i);
                            handleChange('equipo_opcion_ab_armaduras_armas', {
                              ...formData.equipo_opcion_ab_armaduras_armas,
                              opcion_b: { ...formData.equipo_opcion_ab_armaduras_armas.opcion_b, armas: newArr }
                            });
                          }}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* === EQUIPMENT - OPTION A/B WEAPONS ONLY === */}
            <Section title="⚔️ Opción A o B: Solo Armas" color="torch-orange">
              <p className="text-xs text-muted-foreground mb-3">Opción A: lista de armas | Opción B: armas a elegir con cantidad</p>
              
              {/* Option A */}
              <div className="p-3 bg-[hsl(var(--magic-blue))/10] rounded border border-[hsl(var(--magic-blue))/30] mb-4">
                <Label className="text-[hsl(var(--magic-blue))] font-bold mb-2 block">OPCIÓN A - Armas fijas</Label>
                <Select
                  onValueChange={(v) => {
                    const current = formData.equipo_opcion_ab_armas.opcion_a || [];
                    if (!current.includes(v)) {
                      handleChange('equipo_opcion_ab_armas', {
                        ...formData.equipo_opcion_ab_armas,
                        opcion_a: [...current, v]
                      });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Añadir arma..." /></SelectTrigger>
                  <SelectContent>
                    {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(formData.equipo_opcion_ab_armas.opcion_a || []).map((w, i) => (
                    <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs flex items-center gap-1">
                      {w}
                      <button onClick={() => {
                        const newArr = formData.equipo_opcion_ab_armas.opcion_a.filter((_, idx) => idx !== i);
                        handleChange('equipo_opcion_ab_armas', {
                          ...formData.equipo_opcion_ab_armas,
                          opcion_a: newArr
                        });
                      }}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Option B */}
              <div className="p-3 bg-[hsl(var(--torch-orange))/10] rounded border border-[hsl(var(--torch-orange))/30]">
                <Label className="text-[hsl(var(--torch-orange))] font-bold mb-2 block">OPCIÓN B - Armas a elegir</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Cantidad a elegir</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.equipo_opcion_ab_armas.opcion_b?.cantidad_elegir || 1}
                      onChange={(e) => handleChange('equipo_opcion_ab_armas', {
                        ...formData.equipo_opcion_ab_armas,
                        opcion_b: { ...formData.equipo_opcion_ab_armas.opcion_b, cantidad_elegir: parseInt(e.target.value) || 1 }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Armas disponibles</Label>
                    <Select
                      onValueChange={(v) => {
                        const current = formData.equipo_opcion_ab_armas.opcion_b?.armas || [];
                        if (!current.includes(v)) {
                          handleChange('equipo_opcion_ab_armas', {
                            ...formData.equipo_opcion_ab_armas,
                            opcion_b: { ...formData.equipo_opcion_ab_armas.opcion_b, armas: [...current, v] }
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Añadir arma..." /></SelectTrigger>
                      <SelectContent>
                        {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(formData.equipo_opcion_ab_armas.opcion_b?.armas || []).map((w, i) => (
                    <span key={i} className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs flex items-center gap-1">
                      {w}
                      <button onClick={() => {
                        const newArr = formData.equipo_opcion_ab_armas.opcion_b.armas.filter((_, idx) => idx !== i);
                        handleChange('equipo_opcion_ab_armas', {
                          ...formData.equipo_opcion_ab_armas,
                          opcion_b: { ...formData.equipo_opcion_ab_armas.opcion_b, armas: newArr }
                        });
                      }}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            </Section>

            {/* === EQUIPMENT - OPTION A/B WEAPONS WITH SHIELD === */}
            <Section title="🛡️ Opción A o B: Armas + Escudo" color="gold">
              <p className="text-xs text-muted-foreground mb-3">
                Opción A: Elegir 1 arma de la lista + Escudo incluido<br/>
                Opción B: Elegir 1 arma del Bloque 1 + 1 arma del Bloque 2
              </p>
              
              {/* Option A - Weapons + Shield */}
              <div className="p-3 bg-[hsl(var(--magic-blue))/10] rounded border border-[hsl(var(--magic-blue))/30] mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[hsl(var(--magic-blue))] font-bold">OPCIÓN A - Arma (elegir 1) + Escudo</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={formData.equipo_opcion_ab_armas_escudo.opcion_a?.incluye_escudo ?? true}
                      onCheckedChange={(v) => handleChange('equipo_opcion_ab_armas_escudo', {
                        ...formData.equipo_opcion_ab_armas_escudo,
                        opcion_a: { ...formData.equipo_opcion_ab_armas_escudo.opcion_a, incluye_escudo: v }
                      })}
                    />
                    <Label className="text-xs">Incluye escudo</Label>
                  </div>
                </div>
                <Select
                  onValueChange={(v) => {
                    const current = formData.equipo_opcion_ab_armas_escudo.opcion_a?.armas || [];
                    if (!current.includes(v)) {
                      handleChange('equipo_opcion_ab_armas_escudo', {
                        ...formData.equipo_opcion_ab_armas_escudo,
                        opcion_a: { ...formData.equipo_opcion_ab_armas_escudo.opcion_a, armas: [...current, v] }
                      });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Añadir arma a elegir..." /></SelectTrigger>
                  <SelectContent>
                    {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(formData.equipo_opcion_ab_armas_escudo.opcion_a?.armas || []).map((w, i) => (
                    <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs flex items-center gap-1">
                      {w}
                      <button onClick={() => {
                        const newArr = formData.equipo_opcion_ab_armas_escudo.opcion_a.armas.filter((_, idx) => idx !== i);
                        handleChange('equipo_opcion_ab_armas_escudo', {
                          ...formData.equipo_opcion_ab_armas_escudo,
                          opcion_a: { ...formData.equipo_opcion_ab_armas_escudo.opcion_a, armas: newArr }
                        });
                      }}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {formData.equipo_opcion_ab_armas_escudo.opcion_a?.incluye_escudo && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">+ Escudo</span>
                  )}
                </div>
              </div>
              
              {/* Option B - Two weapon blocks */}
              <div className="p-3 bg-[hsl(var(--torch-orange))/10] rounded border border-[hsl(var(--torch-orange))/30]">
                <Label className="text-[hsl(var(--torch-orange))] font-bold mb-3 block">OPCIÓN B - Dos bloques de armas (elegir 1 de cada)</Label>
                
                {/* Block 1 */}
                <div className="p-2 bg-black/20 rounded mb-3">
                  <Label className="text-xs text-muted-foreground mb-1 block">Bloque 1 - Elegir 1 arma</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_opcion_ab_armas_escudo.opcion_b?.bloque1 || [];
                      if (!current.includes(v)) {
                        handleChange('equipo_opcion_ab_armas_escudo', {
                          ...formData.equipo_opcion_ab_armas_escudo,
                          opcion_b: { ...formData.equipo_opcion_ab_armas_escudo.opcion_b, bloque1: [...current, v] }
                        });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir arma al Bloque 1..." /></SelectTrigger>
                    <SelectContent>
                      {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(formData.equipo_opcion_ab_armas_escudo.opcion_b?.bloque1 || []).map((w, i) => (
                      <span key={i} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs flex items-center gap-1">
                        {w}
                        <button onClick={() => {
                          const newArr = formData.equipo_opcion_ab_armas_escudo.opcion_b.bloque1.filter((_, idx) => idx !== i);
                          handleChange('equipo_opcion_ab_armas_escudo', {
                            ...formData.equipo_opcion_ab_armas_escudo,
                            opcion_b: { ...formData.equipo_opcion_ab_armas_escudo.opcion_b, bloque1: newArr }
                          });
                        }}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Block 2 */}
                <div className="p-2 bg-black/20 rounded">
                  <Label className="text-xs text-muted-foreground mb-1 block">Bloque 2 - Elegir 1 arma</Label>
                  <Select
                    onValueChange={(v) => {
                      const current = formData.equipo_opcion_ab_armas_escudo.opcion_b?.bloque2 || [];
                      if (!current.includes(v)) {
                        handleChange('equipo_opcion_ab_armas_escudo', {
                          ...formData.equipo_opcion_ab_armas_escudo,
                          opcion_b: { ...formData.equipo_opcion_ab_armas_escudo.opcion_b, bloque2: [...current, v] }
                        });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Añadir arma al Bloque 2..." /></SelectTrigger>
                    <SelectContent>
                      {getAllWeapons().map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(formData.equipo_opcion_ab_armas_escudo.opcion_b?.bloque2 || []).map((w, i) => (
                      <span key={i} className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs flex items-center gap-1">
                        {w}
                        <button onClick={() => {
                          const newArr = formData.equipo_opcion_ab_armas_escudo.opcion_b.bloque2.filter((_, idx) => idx !== i);
                          handleChange('equipo_opcion_ab_armas_escudo', {
                            ...formData.equipo_opcion_ab_armas_escudo,
                            opcion_b: { ...formData.equipo_opcion_ab_armas_escudo.opcion_b, bloque2: newArr }
                          });
                        }}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* === PROFESSION PATHS === */}
            <Section title="🛤️ Caminos de la Profesión (Especialidades)" color="gold">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre de la Especialidad</Label>
                    <Input
                      value={formData.caminos.nombre_especialidad}
                      onChange={(e) => handleNestedChange('caminos', 'nombre_especialidad', e.target.value)}
                      placeholder="Ej: Especialidad de Explorador"
                    />
                  </div>
                  <div>
                    <Label>Nivel de Especialización</Label>
                    <Input
                      type="number"
                      value={formData.caminos.nivel_especializacion}
                      onChange={(e) => handleNestedChange('caminos', 'nivel_especializacion', parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <Label className="text-sm font-bold">Dos Especialidades</Label>
                {formData.caminos.especialidades.map((esp, espIdx) => (
                  <div key={espIdx} className="p-3 bg-black/20 rounded border border-border/30">
                    <Label className="text-xs text-muted-foreground mb-2 block">Especialidad {espIdx + 1}</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="Nombre (ej: Saqueador)"
                        value={esp.nombre}
                        onChange={(e) => updateEspecialidad(espIdx, 'nombre', e.target.value)}
                      />
                      <Textarea
                        placeholder="Descripción"
                        value={esp.descripcion}
                        onChange={(e) => updateEspecialidad(espIdx, 'descripcion', e.target.value)}
                        rows={2}
                      />
                      <Label className="text-xs">3 Características de esta especialidad:</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {esp.caracteristicas.map((car, carIdx) => (
                          <Input
                            key={carIdx}
                            placeholder={`Característica ${carIdx + 1}`}
                            value={car}
                            onChange={(e) => updateEspecialidadCaracteristica(espIdx, carIdx, e.target.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* === VIRTUE AND ART LEVELS === */}
            <Section title="✨ Niveles de Virtudes y Artes">
              <div className="space-y-4">
                <div>
                  <Label>Niveles para elegir Virtudes</Label>
                  <Input
                    value={formData.niveles_virtudes}
                    onChange={(e) => handleChange('niveles_virtudes', e.target.value)}
                    placeholder="Ej: 4, 6, 8"
                  />
                  <Textarea
                    className="mt-2"
                    value={formData.descripcion_virtudes}
                    onChange={(e) => handleChange('descripcion_virtudes', e.target.value)}
                    placeholder="Descripción de las virtudes (ej: A nivel 4, y de nuevo a nivel 6 y 8, puedes elegir una virtud...)"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Niveles para elegir Artes</Label>
                  <Input
                    value={formData.niveles_artes}
                    onChange={(e) => handleChange('niveles_artes', e.target.value)}
                    placeholder="Ej: 6"
                  />
                  <Textarea
                    className="mt-2"
                    value={formData.descripcion_artes}
                    onChange={(e) => handleChange('descripcion_artes', e.target.value)}
                    placeholder="Descripción de las artes (ej: A nivel 6, en lugar de elegir una virtud, puedes obtener...)"
                    rows={2}
                  />
                </div>
              </div>
            </Section>

            {/* === SPECIAL ABILITIES === */}
            <Section title="⭐ Habilidades Especiales">
              <div className="space-y-3">
                {formData.especiales_ocupacion.map((ability, idx) => (
                  <div key={idx} className="grid md:grid-cols-2 gap-2 p-3 bg-black/20 rounded relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 text-destructive"
                      onClick={() => removeSpecialAbility(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div>
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        value={ability.nombre}
                        onChange={(e) => updateSpecialAbility(idx, 'nombre', e.target.value)}
                        placeholder="Nombre de la habilidad"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Descripción</Label>
                      <Textarea
                        value={ability.descripcion}
                        onChange={(e) => updateSpecialAbility(idx, 'descripcion', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addSpecialAbility}>
                  <Plus className="w-4 h-4 mr-2" /> Añadir Habilidad Especial
                </Button>
              </div>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="save-occupation-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? 'Guardar' : 'Crear Ocupación'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OccupationEditor;
