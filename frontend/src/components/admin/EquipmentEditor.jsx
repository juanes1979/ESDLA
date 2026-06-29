/**
 * Equipment Editor - Modal for creating new equipment items
 * Dynamically shows fields based on selected category
 */
import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/services/api';

// Equipment categories with their field definitions
const EQUIPMENT_CATEGORIES = [
  {
    key: 'armas_sencillas_cc',
    name: 'Armas Sencillas (Cuerpo a Cuerpo)',
    fields: ['nombre', 'precio', 'moneda', 'dano', 'modificador', 'herida', 'peso_kg']
  },
  {
    key: 'armas_sencillas_distancia',
    name: 'Armas Sencillas (Distancia)',
    fields: ['nombre', 'precio', 'moneda', 'dano', 'alcance', 'herida', 'peso_kg']
  },
  {
    key: 'armas_marciales_cc',
    name: 'Armas Marciales (Cuerpo a Cuerpo)',
    fields: ['nombre', 'precio', 'moneda', 'dano', 'modificador', 'herida', 'peso_kg']
  },
  {
    key: 'armas_marciales_distancia',
    name: 'Armas Marciales (Distancia)',
    fields: ['nombre', 'precio', 'moneda', 'dano', 'alcance', 'herida', 'peso_kg']
  },
  {
    key: 'armaduras_ligeras',
    name: 'Armaduras Ligeras',
    fields: ['nombre', 'precio', 'moneda', 'ca', 'comentarios', 'peso_kg']
  },
  {
    key: 'armaduras_medias',
    name: 'Armaduras Medias',
    fields: ['nombre', 'precio', 'moneda', 'ca', 'comentarios', 'peso_kg']
  },
  {
    key: 'armaduras_pesadas',
    name: 'Armaduras Pesadas',
    fields: ['nombre', 'precio', 'moneda', 'ca', 'comentarios', 'peso_kg']
  },
  {
    key: 'escudos',
    name: 'Escudos',
    fields: ['nombre', 'precio', 'moneda', 'ca', 'peso_kg']
  },
  {
    key: 'equipo_general',
    name: 'Equipo General',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg']
  },
  {
    key: 'herramientas',
    name: 'Herramientas',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg']
  },
  {
    key: 'juegos',
    name: 'Juegos',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg']
  },
  {
    key: 'instrumentos_musicales',
    name: 'Instrumentos Musicales',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg']
  },
  {
    key: 'consumibles',
    name: 'Consumibles y Alimentación',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg', 'es_comida', 'es_agua', 'porcentaje_racion', 'litros']
  },
  {
    key: 'comida_posadas',
    name: 'Comida en Posadas',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg', 'es_comida', 'es_agua', 'porcentaje_racion', 'litros']
  },
  {
    key: 'hierbas',
    name: 'Hierbas Medicinales y Pociones',
    fields: ['nombre', 'precio', 'moneda', 'forma_preparacion', 'efecto', 'peso_kg']
  },
  {
    key: 'venenos',
    name: 'Venenos',
    fields: ['nombre', 'precio', 'moneda', 'forma_preparacion', 'efecto', 'peso_kg']
  },
  {
    key: 'monturas',
    name: 'Monturas',
    fields: ['nombre', 'precio', 'moneda', 'capacidad_carga', 'constitucion', 'velocidad', 'capacidad_pequeno', 'capacidad_mediano']
  },
  {
    key: 'accesorios_monturas',
    name: 'Accesorios de Monturas',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg']
  },
  {
    key: 'transporte_terrestre',
    name: 'Transporte Terrestre',
    fields: ['nombre', 'precio', 'moneda', 'capacidad_kg']
  },
  {
    key: 'transporte_maritimo',
    name: 'Transporte Marítimo',
    fields: ['nombre', 'precio', 'moneda', 'capacidad_kg']
  },
  {
    key: 'recursos_desarrollo',
    name: 'Recursos de Desarrollo',
    fields: ['nombre', 'precio', 'moneda', 'peso_kg', 'm2']
  }
];

// Field labels and types
const FIELD_CONFIG = {
  nombre: { label: 'Nombre', type: 'text', required: true },
  precio: { label: 'Precio', type: 'number', step: '0.01' },
  moneda: { label: 'Moneda', type: 'select', options: ['mp', 'mo', 'mc'] },
  peso_kg: { label: 'Peso (Kg)', type: 'number', step: '0.1' },
  dano: { label: 'Daño', type: 'text', placeholder: 'Ej: 1d6' },
  modificador: { label: 'Tipo/Modificador', type: 'text' },
  herida: { label: 'Herida', type: 'number' },
  alcance: { label: 'Alcance', type: 'text', placeholder: 'Ej: 24/96' },
  ca: { label: 'CA (Clase de Armadura)', type: 'number' },
  comentarios: { label: 'Modificadores/Comentarios', type: 'textarea' },
  forma_preparacion: { label: 'Forma de Preparación', type: 'text', placeholder: 'Ej: ingestión, contacto' },
  efecto: { label: 'Efecto', type: 'textarea' },
  capacidad_carga: { label: 'Capacidad de Carga', type: 'number' },
  constitucion: { label: 'Constitución', type: 'text', placeholder: 'Ej: 13 (+1)' },
  velocidad: { label: 'Velocidad', type: 'number' },
  capacidad_pequeno: { label: 'Capacidad Pequeño', type: 'checkbox' },
  capacidad_mediano: { label: 'Capacidad Mediano', type: 'checkbox' },
  capacidad_kg: { label: 'Capacidad (Kg)', type: 'number' },
  m2: { label: 'Metros²', type: 'text' },
  posicion: { label: 'Posición (cabeza/cuerpo…)', type: 'select', options: ['cabeza', 'cuerpo', 'brazos', 'piernas', 'pies'] },
  // Food/Water fields
  es_comida: { label: '¿Es Comida?', type: 'checkbox' },
  es_agua: { label: '¿Es Agua?', type: 'checkbox' },
  porcentaje_racion: { label: '% Ración Diaria', type: 'number', placeholder: '100 = ración completa, 50 = media ración', step: 1 },
  litros: { label: 'Litros (si es agua)', type: 'number', step: 0.1 }
};

const EquipmentEditor = ({ onClose, onSave }) => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);

  // Carga los grupos personalizados (creados por el Maestro) para poder
  // añadirles objetos también desde "Crear Equipo".
  useEffect(() => {
    api.get('/data/equipment-custom-categories')
      .then(r => setCustomCategories(r.data?.custom_categories || []))
      .catch(() => {});
  }, []);

  const allCategories = [
    ...EQUIPMENT_CATEGORIES,
    ...customCategories.map(cc => ({
      key: cc.key,
      name: `🧩 ${cc.name}`,
      fields: ['nombre', 'precio', 'moneda', ...(cc.fields || []).filter(f => !['nombre', 'precio', 'moneda'].includes(f))],
    })),
  ];

  // Get current category config
  const categoryConfig = allCategories.find(c => c.key === selectedCategory);

  const handleCategoryChange = (value) => {
    setSelectedCategory(value);
    // Reset form but keep nombre if exists
    setFormData({ moneda: 'mp' });
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!selectedCategory) {
      toast.error('Selecciona una categoría');
      return;
    }
    if (!formData.nombre?.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      await api.post('/data/equipment', {
        categoria: selectedCategory,
        ...formData,
        // Si se asigna una posición corporal, marcar la pieza como equipo corporal.
        es_corporal: formData.posicion ? true : (formData.es_corporal || undefined),
        // Convert numeric fields
        precio: formData.precio ? parseFloat(formData.precio) : null,
        peso_kg: formData.peso_kg ? parseFloat(formData.peso_kg) : null,
        herida: formData.herida ? parseInt(formData.herida) : null,
        ca: formData.ca ? parseInt(formData.ca) : null,
        capacidad_carga: formData.capacidad_carga ? parseInt(formData.capacidad_carga) : null,
        velocidad: formData.velocidad ? parseInt(formData.velocidad) : null,
        capacidad_kg: formData.capacidad_kg ? parseInt(formData.capacidad_kg) : null
      });
      toast.success(`${formData.nombre} añadido a ${categoryConfig?.name}`);
      onSave?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (fieldKey) => {
    const config = FIELD_CONFIG[fieldKey];
    if (!config) return null;

    const value = formData[fieldKey] || '';

    if (config.type === 'select') {
      return (
        <div key={fieldKey} className="space-y-1">
          <Label className="text-sm">{config.label}</Label>
          <Select value={value} onValueChange={(v) => handleFieldChange(fieldKey, v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {config.options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (config.type === 'textarea') {
      return (
        <div key={fieldKey} className="space-y-1 col-span-2">
          <Label className="text-sm">{config.label}</Label>
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            placeholder={config.placeholder}
            rows={3}
            className="bg-black/20"
          />
        </div>
      );
    }

    if (config.type === 'checkbox') {
      return (
        <div key={fieldKey} className="flex items-center gap-2">
          <input
            type="checkbox"
            id={fieldKey}
            checked={!!formData[fieldKey]}
            onChange={(e) => handleFieldChange(fieldKey, e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor={fieldKey} className="text-sm cursor-pointer">{config.label}</Label>
        </div>
      );
    }

    return (
      <div key={fieldKey} className="space-y-1">
        <Label className="text-sm">
          {config.label}
          {config.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          type={config.type}
          step={config.step}
          value={value}
          onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
          placeholder={config.placeholder}
          className="bg-black/20"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card-parchment rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-heading text-xl text-[hsl(var(--gold))]">Crear Nuevo Equipo</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Category Selection */}
          <div className="mb-6">
            <Label className="text-sm font-bold mb-2 block">1. Selecciona el tipo de equipo</Label>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="bg-black/20">
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat.key} value={cat.key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Fields */}
          {categoryConfig && (
            <div className="space-y-4">
              <Label className="text-sm font-bold block">2. Completa la información</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryConfig.fields.map(field => renderField(field))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/30">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !selectedCategory}
              className="btn-fantasy"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentEditor;
