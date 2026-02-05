/**
 * Race Editor Modal - Create/Edit races (admin only)
 */
import { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/services/api';

const RaceEditor = ({ race, onSave, onClose }) => {
  const isEditing = !!race;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nombre: race?.nombre || '',
    descripcion: race?.descripcion || '',
    imc_min: race?.imc?.min || 18,
    imc_max: race?.imc?.max || 25,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await api.put(`/data/races/${race.id}`, formData);
      } else {
        await api.post('/data/races', formData);
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
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            {isEditing ? `Editar: ${race.nombre}` : 'Crear Nueva Raza'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-destructive/20 text-destructive p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <Label>Nombre de la Raza *</Label>
            <Input
              value={formData.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              placeholder="Ej: Medio Elfos"
            />
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              value={formData.descripcion}
              onChange={(e) => handleChange('descripcion', e.target.value)}
              rows={3}
              placeholder="Descripción de la raza..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>IMC Mínimo</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.imc_min}
                onChange={(e) => handleChange('imc_min', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>IMC Máximo</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.imc_max}
                onChange={(e) => handleChange('imc_max', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RaceEditor;
