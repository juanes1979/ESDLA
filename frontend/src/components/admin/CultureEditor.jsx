/**
 * Culture Editor Modal - Create/Edit cultures (admin only)
 */
import { useState, useEffect } from 'react';
import { X, Save, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/services/api';

// All available skills
const ALL_SKILLS = [
  'Acertijos', 'Acrobacias', 'Atletismo', 'Cazar', 'Engaño', 'Explorar',
  'Interpretación', 'Intimidación', 'Investigación', 'Juego de manos',
  'Medicina', 'Naturaleza', 'Percepción', 'Perspicacia', 'Persuasión',
  'Saber antiguo', 'Sigilo', 'Trato con animales', 'Viajar'
];

// Available tools
const ALL_TOOLS = [
  'Herramientas de carpintería', 'Herramientas de herrero', 'Herramientas de alfarero',
  'Herramientas de joyero', 'Herramientas de curtidor', 'Herramientas de zapatero',
  'Herramientas de tejedor', 'Herramientas de albañil', 'Herramientas de cartógrafo',
  'Herramientas de cocinero', 'Herramientas de cervecero', 'Herramientas de pintor',
  'Instrumentos musicales', 'Juegos', 'Vehículos acuáticos', 'Vehículos terrestres',
  'Kit de herborista', 'Kit de disfraz', 'Kit de falsificador', 'Kit de navegante',
  'Suministros de calígrafo', 'Útiles de soplador de vidrio'
];

// Attributes
const ATTRIBUTES = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];

const CultureEditor = ({ culture, races, onSave, onClose, onCopy }) => {
  const isEditing = !!culture;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    raza: '',
    descripcion: '',
    descripcion_riqueza: '',
    nivel_vida: 'Común',
    edad_min: 20,
    edad_max: 80,
    altura_min: 150,
    altura_max: 190,
    velocidad: 9,
    descanso: 8,
    tamanio: 'Mediano',
    mod_peso: 0,
    bonificadores_caracteristicas: {
      fuerza: 0, destreza: 0, constitucion: 0,
      inteligencia: 0, sabiduria: 0, carisma: 0
    },
    bonificador_a_eleccion: false,
    idiomas: [],
    competencias_habilidades: [],
    competencia_herramienta_elegir_1: [],
    competencia_herramienta_elegir_2: [],
    competencia_habilidad_elegir: [],
    competencia_adicional: '',
    rasgos_fisicos: { ojos: [], piel: [], pelo: [] },
    rasgos_culturales: [],
    pg_extra_nivel: 0,
    capacidad_carga_x2: false,
    tiene_virtud_inicial: false,
    ...culture
  });

  // Text inputs for array fields
  const [idiomasText, setIdiomasText] = useState((culture?.idiomas || []).join(', '));
  const [rasgosCulturalesText, setRasgosCulturalesText] = useState((culture?.rasgos_culturales || []).join('\n'));
  const [ojosText, setOjosText] = useState((culture?.rasgos_fisicos?.ojos || []).join(', '));
  const [pielText, setPielText] = useState((culture?.rasgos_fisicos?.piel || []).join(', '));
  const [peloText, setPeloText] = useState((culture?.rasgos_fisicos?.pelo || []).join(', '));

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAttrChange = (attr, value) => {
    setFormData(prev => ({
      ...prev,
      bonificadores_caracteristicas: {
        ...prev.bonificadores_caracteristicas,
        [attr]: parseInt(value) || 0
      }
    }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter(i => i !== item) };
      } else {
        return { ...prev, [field]: [...arr, item] };
      }
    });
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!formData.raza) {
      setError('La raza base es obligatoria');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Parse text fields to arrays
      const dataToSend = {
        ...formData,
        idiomas: idiomasText.split(',').map(s => s.trim()).filter(s => s),
        rasgos_culturales: rasgosCulturalesText.split('\n').map(s => s.trim()).filter(s => s),
        rasgos_fisicos: {
          ojos: ojosText.split(',').map(s => s.trim()).filter(s => s),
          piel: pielText.split(',').map(s => s.trim()).filter(s => s),
          pelo: peloText.split(',').map(s => s.trim()).filter(s => s),
        }
      };

      if (isEditing) {
        await api.put(`/data/cultures/${culture.id}`, dataToSend);
      } else {
        await api.post('/data/cultures', dataToSend);
      }
      
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            {isEditing ? `Editar: ${culture.nombre}` : 'Crear Nueva Cultura'}
          </h2>
          <div className="flex gap-2">
            {isEditing && onCopy && (
              <Button variant="outline" size="sm" onClick={() => onCopy(culture)}>
                <Copy className="w-4 h-4 mr-2" /> Copiar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="bg-destructive/20 text-destructive p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="grid gap-6">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre de la Cultura *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  placeholder="Ej: Hombres de Tharbad"
                />
              </div>
              <div>
                <Label>Raza Base *</Label>
                <Select value={formData.raza} onValueChange={(v) => handleChange('raza', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una raza" />
                  </SelectTrigger>
                  <SelectContent>
                    {races.map(r => (
                      <SelectItem key={r.id} value={r.nombre}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                rows={3}
              />
            </div>

            {/* Nivel de Vida */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nivel de Vida</Label>
                <Select value={formData.nivel_vida} onValueChange={(v) => handleChange('nivel_vida', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pobre">Pobre</SelectItem>
                    <SelectItem value="Frugal">Frugal</SelectItem>
                    <SelectItem value="Común">Común</SelectItem>
                    <SelectItem value="Próspero">Próspero</SelectItem>
                    <SelectItem value="Rico">Rico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descripción del Nivel de Vida</Label>
                <Input
                  value={formData.descripcion_riqueza}
                  onChange={(e) => handleChange('descripcion_riqueza', e.target.value)}
                />
              </div>
            </div>

            {/* Physical Characteristics */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Características Físicas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Edad Mín</Label>
                  <Input type="number" value={formData.edad_min} onChange={(e) => handleChange('edad_min', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>Edad Máx</Label>
                  <Input type="number" value={formData.edad_max} onChange={(e) => handleChange('edad_max', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>Altura Mín (cm)</Label>
                  <Input type="number" value={formData.altura_min} onChange={(e) => handleChange('altura_min', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>Altura Máx (cm)</Label>
                  <Input type="number" value={formData.altura_max} onChange={(e) => handleChange('altura_max', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>Velocidad (m)</Label>
                  <Input type="number" value={formData.velocidad} onChange={(e) => handleChange('velocidad', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>Descanso (h)</Label>
                  <Input type="number" value={formData.descanso} onChange={(e) => handleChange('descanso', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label>Tamaño</Label>
                  <Select value={formData.tamanio} onValueChange={(v) => handleChange('tamanio', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pequeño">Pequeño</SelectItem>
                      <SelectItem value="Mediano">Mediano</SelectItem>
                      <SelectItem value="Grande">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mod. Peso (%)</Label>
                  <Input type="number" value={formData.mod_peso} onChange={(e) => handleChange('mod_peso', parseInt(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Attribute Bonuses */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Bonificadores de Características</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {ATTRIBUTES.map(attr => (
                  <div key={attr}>
                    <Label className="text-xs">{attr.charAt(0).toUpperCase() + attr.slice(1)}</Label>
                    <Input
                      type="number"
                      value={formData.bonificadores_caracteristicas?.[attr] || 0}
                      onChange={(e) => handleAttrChange(attr, e.target.value)}
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Checkbox
                  checked={formData.bonificador_a_eleccion}
                  onCheckedChange={(c) => handleChange('bonificador_a_eleccion', c)}
                />
                <Label className="text-sm">Puede elegir +1 en una característica adicional</Label>
              </div>
            </div>

            {/* Languages */}
            <div>
              <Label>Idiomas (separados por coma)</Label>
              <Input
                value={idiomasText}
                onChange={(e) => setIdiomasText(e.target.value)}
                placeholder="Ej: OESTRÓN 5, SINDARIN 5"
              />
            </div>

            {/* Skill Competencies */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Competencias en Habilidades</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {ALL_SKILLS.map(skill => (
                  <div key={skill} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.competencias_habilidades?.includes(skill)}
                      onCheckedChange={() => toggleArrayItem('competencias_habilidades', skill)}
                    />
                    <Label className="text-xs">{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tool Options */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Competencias a Elegir (Herramientas)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Opción 1</Label>
                  <div className="grid grid-cols-2 gap-1 mt-2 max-h-40 overflow-y-auto">
                    {ALL_TOOLS.map(tool => (
                      <div key={`t1-${tool}`} className="flex items-center gap-1">
                        <Checkbox
                          checked={formData.competencia_herramienta_elegir_1?.includes(tool)}
                          onCheckedChange={() => toggleArrayItem('competencia_herramienta_elegir_1', tool)}
                        />
                        <Label className="text-xs">{tool}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Opción 2</Label>
                  <div className="grid grid-cols-2 gap-1 mt-2 max-h-40 overflow-y-auto">
                    {ALL_TOOLS.map(tool => (
                      <div key={`t2-${tool}`} className="flex items-center gap-1">
                        <Checkbox
                          checked={formData.competencia_herramienta_elegir_2?.includes(tool)}
                          onCheckedChange={() => toggleArrayItem('competencia_herramienta_elegir_2', tool)}
                        />
                        <Label className="text-xs">{tool}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Skill Options to Choose */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Habilidades a Elegir</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {ALL_SKILLS.map(skill => (
                  <div key={`choose-${skill}`} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.competencia_habilidad_elegir?.includes(skill)}
                      onCheckedChange={() => toggleArrayItem('competencia_habilidad_elegir', skill)}
                    />
                    <Label className="text-xs">{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Competency */}
            <div>
              <Label>Competencia Adicional</Label>
              <Input
                value={formData.competencia_adicional}
                onChange={(e) => handleChange('competencia_adicional', e.target.value)}
                placeholder="Ej: Competencia en armaduras ligeras"
              />
            </div>

            {/* Physical Traits */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Rasgos Físicos</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Ojos (separados por coma)</Label>
                  <Input value={ojosText} onChange={(e) => setOjosText(e.target.value)} placeholder="Azul, Gris, Verde" />
                </div>
                <div>
                  <Label>Piel (separados por coma)</Label>
                  <Input value={pielText} onChange={(e) => setPielText(e.target.value)} placeholder="Clara, Pálida" />
                </div>
                <div>
                  <Label>Pelo (separados por coma)</Label>
                  <Input value={peloText} onChange={(e) => setPeloText(e.target.value)} placeholder="Rubio, Castaño, Negro" />
                </div>
              </div>
            </div>

            {/* Cultural Traits */}
            <div>
              <Label>Rasgos Culturales (uno por línea)</Label>
              <Textarea
                value={rasgosCulturalesText}
                onChange={(e) => setRasgosCulturalesText(e.target.value)}
                rows={5}
                placeholder="Sueños élficos: Los elfos no necesitan dormir...&#10;Habilidad élfica: Si no estás desanimado..."
              />
            </div>

            {/* Specials */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Especiales de Cultura</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>PG Extra por Nivel</Label>
                  <Input
                    type="number"
                    value={formData.pg_extra_nivel}
                    onChange={(e) => handleChange('pg_extra_nivel', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col gap-2 justify-center">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.capacidad_carga_x2}
                      onCheckedChange={(c) => handleChange('capacidad_carga_x2', c)}
                    />
                    <Label>Capacidad de carga x2</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.tiene_virtud_inicial}
                      onCheckedChange={(c) => handleChange('tiene_virtud_inicial', c)}
                    />
                    <Label>Virtud al nivel 1</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Cultura'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CultureEditor;
