/**
 * Occupation Editor Modal - Create/Edit occupations (admin only)
 */
import { useState } from 'react';
import { X, Save, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Weapon types
const WEAPON_TYPES = [
  'Armas sencillas', 'Armas marciales', 'Espadas', 'Hachas', 'Arcos', 'Dagas',
  'Mazas', 'Lanzas', 'Bastones', 'Ballestas'
];

// Armor types
const ARMOR_TYPES = [
  'Armaduras ligeras', 'Armaduras medias', 'Armaduras pesadas', 'Escudos'
];

// Hit dice options
const HIT_DICE = ['1d6', '1d8', '1d10', '1d12'];

const OccupationEditor = ({ occupation, onSave, onClose, onCopy }) => {
  const isEditing = !!occupation;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    vocacion: occupation?.vocacion || '',
    descripcion_corta: occupation?.descripcion_corta || '',
    descripcion_ocupacion_larga: occupation?.descripcion_ocupacion_larga || '',
    dado_golpe: occupation?.dado_golpe || '1d8',
    puntos_golpe_base: occupation?.puntos_golpe_base || 8,
    caracteristicas_principales: occupation?.caracteristicas_principales || [],
    tiradas_salvacion: occupation?.tiradas_salvacion || [],
    competencia_armas: occupation?.competencia_armas || [],
    competencia_armaduras: occupation?.competencia_armaduras || [],
    habilidades_favorecidas: occupation?.habilidades_favorecidas || [],
    maldicion_nombre: occupation?.maldicion_nombre || '',
    maldicion_descripcion: occupation?.maldicion_descripcion || '',
    especiales_ocupacion1: occupation?.especiales_ocupacion1 || '',
    especiales_ocupacion1_descripcion: occupation?.especiales_ocupacion1_descripcion || '',
    especiales_ocupacion2: occupation?.especiales_ocupacion2 || '',
    especiales_ocupacion2_descripcion: occupation?.especiales_ocupacion2_descripcion || '',
    especiales_ocupacion3: occupation?.especiales_ocupacion3 || '',
    especiales_ocupacion3_descripcion: occupation?.especiales_ocupacion3_descripcion || '',
    especiales_ocupacion4: occupation?.especiales_ocupacion4 || '',
    especiales_ocupacion4_descripcion: occupation?.especiales_ocupacion4_descripcion || '',
    especiales_ocupacion5: occupation?.especiales_ocupacion5 || '',
    especiales_ocupacion5_descripcion: occupation?.especiales_ocupacion5_descripcion || '',
    especiales_ocupacion6: occupation?.especiales_ocupacion6 || '',
    especiales_ocupacion6_descripcion: occupation?.especiales_ocupacion6_descripcion || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    if (!formData.vocacion.trim()) {
      setError('El nombre de la ocupación es obligatorio');
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
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" data-testid="occupation-editor-modal">
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
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
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="bg-destructive/20 text-destructive p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-6">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre de la Ocupación *</Label>
                <Input
                  value={formData.vocacion}
                  onChange={(e) => handleChange('vocacion', e.target.value)}
                  placeholder="Ej: Montaraz"
                  data-testid="occupation-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Dado de Golpe</Label>
                  <Select value={formData.dado_golpe} onValueChange={(v) => handleChange('dado_golpe', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HIT_DICE.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
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
              <Input
                value={formData.descripcion_corta}
                onChange={(e) => handleChange('descripcion_corta', e.target.value)}
              />
            </div>

            <div>
              <Label>Descripción Larga</Label>
              <Textarea
                value={formData.descripcion_ocupacion_larga}
                onChange={(e) => handleChange('descripcion_ocupacion_larga', e.target.value)}
                rows={3}
              />
            </div>

            {/* Main Attributes and Saving Throws */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-border/30 rounded-lg p-4">
                <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Características Principales</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ATTRIBUTES.map(attr => (
                    <div key={attr} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.caracteristicas_principales?.includes(attr)}
                        onCheckedChange={() => toggleArrayItem('caracteristicas_principales', attr)}
                      />
                      <Label className="text-sm">{attr}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border/30 rounded-lg p-4">
                <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Tiradas de Salvación</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ATTRIBUTES.map(attr => (
                    <div key={`save-${attr}`} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.tiradas_salvacion?.includes(attr)}
                        onCheckedChange={() => toggleArrayItem('tiradas_salvacion', attr)}
                      />
                      <Label className="text-sm">{attr}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Weapon Proficiencies */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Competencia en Armas</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {WEAPON_TYPES.map(weapon => (
                  <div key={weapon} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.competencia_armas?.includes(weapon)}
                      onCheckedChange={() => toggleArrayItem('competencia_armas', weapon)}
                    />
                    <Label className="text-xs">{weapon}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Armor Proficiencies */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Competencia en Armaduras</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ARMOR_TYPES.map(armor => (
                  <div key={armor} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.competencia_armaduras?.includes(armor)}
                      onCheckedChange={() => toggleArrayItem('competencia_armaduras', armor)}
                    />
                    <Label className="text-sm">{armor}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Favored Skills */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Habilidades Favorecidas</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {ALL_SKILLS.map(skill => (
                  <div key={skill} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.habilidades_favorecidas?.includes(skill)}
                      onCheckedChange={() => toggleArrayItem('habilidades_favorecidas', skill)}
                    />
                    <Label className="text-xs">{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Shadow Path */}
            <div className="border border-[hsl(var(--destructive))/30] rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--destructive))] mb-3">Senda de la Sombra</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre de la Maldición</Label>
                  <Input
                    value={formData.maldicion_nombre}
                    onChange={(e) => handleChange('maldicion_nombre', e.target.value)}
                    placeholder="Ej: Codicia"
                  />
                </div>
                <div>
                  <Label>Descripción de la Maldición</Label>
                  <Textarea
                    value={formData.maldicion_descripcion}
                    onChange={(e) => handleChange('maldicion_descripcion', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Special Abilities (6 slots) */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Habilidades Especiales</h3>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <div key={num} className="grid md:grid-cols-2 gap-2 p-3 bg-black/20 rounded">
                    <div>
                      <Label className="text-xs">Especial {num} - Nombre</Label>
                      <Input
                        value={formData[`especiales_ocupacion${num}`]}
                        onChange={(e) => handleChange(`especiales_ocupacion${num}`, e.target.value)}
                        placeholder={`Habilidad especial ${num}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Especial {num} - Descripción</Label>
                      <Textarea
                        value={formData[`especiales_ocupacion${num}_descripcion`]}
                        onChange={(e) => handleChange(`especiales_ocupacion${num}_descripcion`, e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
