/**
 * Background Editor Modal - Create/Edit backgrounds (admin only)
 */
import { useState, useEffect } from 'react';
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

const BackgroundEditor = ({ background, onSave, onClose, onCopy }) => {
  const isEditing = !!background;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cultures, setCultures] = useState([]);
  const [loadingCultures, setLoadingCultures] = useState(true);
  
  const [formData, setFormData] = useState({
    nombre: background?.nombre || '',
    descripcion: background?.descripcion || '',
    cultura: background?.cultura || '',
    competencias_habilidades_auto: background?.competencias_habilidades_auto || [],
    competencias_habilidades_elegir: background?.competencias_habilidades_elegir || [],
    competencias_herramientas_1: background?.competencias_herramientas_1 || [],
    competencias_herramientas_2: background?.competencias_herramientas_2 || [],
    rasgos_descripciones: background?.rasgos_descripciones || [],
  });

  // Load available cultures
  useEffect(() => {
    const loadCultures = async () => {
      try {
        const res = await api.get('/data/cultures');
        setCultures(res.data.cultures || []);
      } catch (err) {
        console.error('Error loading cultures:', err);
      } finally {
        setLoadingCultures(false);
      }
    };
    loadCultures();
  }, []);

  // Text areas for array fields
  const [rasgosText, setRasgosText] = useState((background?.rasgos_descripciones || []).join('\n'));

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
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dataToSend = {
        ...formData,
        rasgos_descripciones: rasgosText.split('\n').map(s => s.trim()).filter(s => s),
      };

      if (isEditing) {
        await api.put(`/data/backgrounds/${background.id}`, dataToSend);
      } else {
        await api.post('/data/backgrounds', dataToSend);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" data-testid="background-editor-modal">
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            {isEditing ? `Editar: ${background.nombre}` : 'Crear Nuevo Trasfondo'}
          </h2>
          <div className="flex gap-2">
            {isEditing && onCopy && (
              <Button variant="outline" size="sm" onClick={() => onCopy(background)}>
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
            <div>
              <Label>Nombre del Trasfondo *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                placeholder="Ej: Cazador de recompensas"
                data-testid="background-name-input"
              />
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                rows={3}
              />
            </div>

            {/* Culture Selection */}
            <div className="border border-border/30 rounded-lg p-4 bg-[hsl(var(--gold))/5]">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Subcultura Asociada *</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Selecciona la subcultura a la que pertenece este trasfondo
              </p>
              {loadingCultures ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando culturas...
                </div>
              ) : (
                <Select 
                  value={formData.cultura || ''} 
                  onValueChange={(value) => handleChange('cultura', value)}
                >
                  <SelectTrigger className="w-full" data-testid="culture-select">
                    <SelectValue placeholder="Selecciona una subcultura" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {cultures.map(culture => (
                      <SelectItem key={culture.id} value={culture.nombre}>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">
                            {culture.categoria || 'Sin categoría'}
                          </span>
                          <span>→</span>
                          <span>{culture.nombre}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Automatic Skill Competencies */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Competencias en Habilidades (Automáticas)</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {ALL_SKILLS.map(skill => (
                  <div key={skill} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.competencias_habilidades_auto?.includes(skill)}
                      onCheckedChange={() => toggleArrayItem('competencias_habilidades_auto', skill)}
                    />
                    <Label className="text-xs">{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills to Choose */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Habilidades a Elegir (1 de estas)</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {ALL_SKILLS.map(skill => (
                  <div key={`choose-${skill}`} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.competencias_habilidades_elegir?.includes(skill)}
                      onCheckedChange={() => toggleArrayItem('competencias_habilidades_elegir', skill)}
                    />
                    <Label className="text-xs">{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tool Competencies */}
            <div className="border border-border/30 rounded-lg p-4">
              <h3 className="font-heading text-[hsl(var(--gold))] mb-3">Competencias en Herramientas</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">Opción 1</Label>
                  <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
                    {ALL_TOOLS.map(tool => (
                      <div key={`t1-${tool}`} className="flex items-center gap-1">
                        <Checkbox
                          checked={formData.competencias_herramientas_1?.includes(tool)}
                          onCheckedChange={() => toggleArrayItem('competencias_herramientas_1', tool)}
                        />
                        <Label className="text-xs">{tool}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Opción 2</Label>
                  <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
                    {ALL_TOOLS.map(tool => (
                      <div key={`t2-${tool}`} className="flex items-center gap-1">
                        <Checkbox
                          checked={formData.competencias_herramientas_2?.includes(tool)}
                          onCheckedChange={() => toggleArrayItem('competencias_herramientas_2', tool)}
                        />
                        <Label className="text-xs">{tool}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Traits */}
            <div>
              <Label>Rasgos del Trasfondo (uno por línea)</Label>
              <Textarea
                value={rasgosText}
                onChange={(e) => setRasgosText(e.target.value)}
                rows={5}
                placeholder="Rasgo 1: Descripción del rasgo...&#10;Rasgo 2: Otro rasgo..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="save-background-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? 'Guardar' : 'Crear Trasfondo'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BackgroundEditor;
