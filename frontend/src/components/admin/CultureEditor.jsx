/**
 * Culture Editor Modal - Create/Edit cultures (admin only)
 * Extended with backgrounds and virtues configuration
 */
import { useState, useEffect } from 'react';
import { X, Save, Copy, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import api from '@/services/api';
import { ATTRIBUTES } from './culture-editor-sections/cultureEditorConstants';
import CompetenciesSection from './culture-editor-sections/CompetenciesSection';
import VirtuesConfigSection from './culture-editor-sections/VirtuesConfigSection';

// Collapsible Section component
const CollapsibleSection = ({ id, title, isActive, onToggle, children, color = 'gold' }) => (
  <div className="border border-border/30 rounded-lg overflow-hidden">
    <button
      type="button"
      className="w-full flex items-center justify-between p-3 bg-black/20 hover:bg-black/30 transition-colors"
      onClick={() => onToggle(id)}
    >
      <h3 className={`font-heading text-[hsl(var(--${color}))]`}>{title}</h3>
      {isActive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
    {isActive && (
      <div className="p-4">
        {children}
      </div>
    )}
  </div>
);

const CultureEditor = ({ culture, races, onSave, onClose, onCopy }) => {
  const isEditing = !!culture;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('basic');
  
  // Data for selection
  const [allBackgrounds, setAllBackgrounds] = useState([]);
  const [allVirtues, setAllVirtues] = useState([]);
  const [allCultures, setAllCultures] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  
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
    competencia_adicional_categoria: '',  // Category: herramientas, juegos, instrumentos, pipa
    rasgos_fisicos: { ojos: [], piel: [], pelo: [] },
    rasgos_culturales: [],
    pg_extra_nivel: 0,
    capacidad_carga_x2: false,
    tiene_virtud_inicial: false,
    // NEW: Backgrounds associated with this culture
    trasfondos_ids: [],
    // NEW: Virtues configuration
    virtudes_propias: [],  // List of virtue IDs specific to this culture
    copiar_virtudes_de: '',  // Culture ID to copy virtues from
    permite_virtudes_comunes: false,  // Can choose common virtues too
    // NEW (it82): texto base para el prompt del retrato IA. Permite al DJ
    // ajustar a su gusto cómo se describirán los personajes de esta cultura
    // al generar retratos con OpenAI Image. Si está vacío, se usa el
    // diccionario hardcoded del backend.
    prompt_imagen_ia: '',
    ...culture
  });

  // Text inputs for array fields
  const [idiomasText, setIdiomasText] = useState((culture?.idiomas || []).join(', '));
  const [rasgosCulturalesText, setRasgosCulturalesText] = useState((culture?.rasgos_culturales || []).join('\n'));
  const [ojosText, setOjosText] = useState((culture?.rasgos_fisicos?.ojos || []).join(', '));
  const [pielText, setPielText] = useState((culture?.rasgos_fisicos?.piel || []).join(', '));
  const [peloText, setPeloText] = useState((culture?.rasgos_fisicos?.pelo || []).join(', '));

  // Load backgrounds, virtues, and cultures on mount
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [bgRes, virtRes, cultRes] = await Promise.all([
          api.get('/data/backgrounds'),
          api.get('/data/virtues'),
          api.get('/data/cultures')
        ]);
        setAllBackgrounds(bgRes.data.backgrounds || []);
        setAllVirtues(virtRes.data.virtues || []);
        setAllCultures(cultRes.data.cultures || []);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

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

  // Get virtues for a specific culture (by name or tipo)
  const getVirtuesForCulture = (cultureName) => {
    return allVirtues.filter(v => 
      v.tipo === cultureName || 
      v.cultura === cultureName ||
      (v.tipo && v.tipo.toLowerCase().includes(cultureName.toLowerCase()))
    );
  };

  // Get common virtues
  const getCommonVirtues = () => {
    return allVirtues.filter(v => v.es_comun || v.tipo === 'COMUNES');
  };

  // Get available virtues based on configuration
  const getAvailableVirtues = () => {
    let virtues = [];
    
    // If copying from another culture
    if (formData.copiar_virtudes_de) {
      const sourceCulture = allCultures.find(c => c.id === formData.copiar_virtudes_de);
      if (sourceCulture) {
        virtues = [...getVirtuesForCulture(sourceCulture.nombre)];
      }
    }
    
    // Own virtues by IDs
    if (formData.virtudes_propias?.length > 0) {
      const ownVirtues = allVirtues.filter(v => formData.virtudes_propias.includes(v.id));
      virtues = [...virtues, ...ownVirtues];
    }
    
    // Common virtues if allowed
    if (formData.permite_virtudes_comunes) {
      virtues = [...virtues, ...getCommonVirtues()];
    }
    
    // Remove duplicates
    const uniqueIds = new Set();
    return virtues.filter(v => {
      if (uniqueIds.has(v.id)) return false;
      uniqueIds.add(v.id);
      return true;
    });
  };

  // Section toggle helper
  const handleSectionToggle = (id) => {
    setActiveSection(activeSection === id ? null : id);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" data-testid="culture-editor-modal">
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-5xl max-h-[95vh] overflow-hidden">
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
        <ScrollArea className="h-[calc(95vh-140px)]">
          <div className="p-4">
            {error && (
              <div className="bg-destructive/20 text-destructive p-3 rounded mb-4">
                {error}
              </div>
            )}

            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
              </div>
            ) : (
              <div className="grid gap-4">
                {/* BASIC INFO - Always visible */}
                <div className="grid md:grid-cols-2 gap-4 p-4 border border-border/30 rounded-lg">
                  <div>
                    <Label>Nombre de la Cultura *</Label>
                    <Input
                      value={formData.nombre}
                      onChange={(e) => handleChange('nombre', e.target.value)}
                      placeholder="Ej: Hombres de Tharbad"
                      data-testid="culture-name-input"
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
                  <div className="md:col-span-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={formData.descripcion}
                      onChange={(e) => handleChange('descripcion', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                {/* NIVEL DE VIDA */}
                <CollapsibleSection id="vida" title="Nivel de Vida" isActive={activeSection === 'vida'} onToggle={handleSectionToggle}>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nivel de Vida</Label>
                      <Select value={formData.nivel_vida} onValueChange={(v) => handleChange('nivel_vida', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                </CollapsibleSection>

                {/* AI PORTRAIT PROMPT (editable por el DJ) */}
                <CollapsibleSection
                  id="ai-portrait"
                  title="🎨 Texto para imagen IA (retrato)"
                  color="magic-blue"
                  isActive={activeSection === 'ai-portrait'}
                  onToggle={handleSectionToggle}
                >
                  <p className="text-xs text-muted-foreground mb-2">
                    Texto base que se usará al generar retratos con IA para personajes de esta
                    cultura. Si está vacío, se usa la descripción por defecto del sistema.
                    Ejemplo: <em>“a wise Hobbit of the Shire, with curly chestnut hair, hairy
                    bare feet, dressed in a green waistcoat and brown breeches”</em>.
                  </p>
                  <Textarea
                    data-testid="cultura-prompt-imagen-ia"
                    value={formData.prompt_imagen_ia || ''}
                    onChange={(e) => handleChange('prompt_imagen_ia', e.target.value)}
                    placeholder="Descripción visual base en inglés (recomendado por el modelo)…"
                    rows={4}
                  />
                </CollapsibleSection>

                {/* PHYSICAL CHARACTERISTICS */}
                <CollapsibleSection id="physical" title="Características Físicas" isActive={activeSection === 'physical'} onToggle={handleSectionToggle}>
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
                  
                  <div className="grid md:grid-cols-3 gap-4 mt-4">
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
                </CollapsibleSection>

                {/* ATTRIBUTE BONUSES */}
                <CollapsibleSection id="attributes" title="Bonificadores de Características" isActive={activeSection === 'attributes'} onToggle={handleSectionToggle}>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {ATTRIBUTES.map(attr => (
                      <div key={attr}>
                        <Label className="text-xs capitalize">{attr}</Label>
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
                </CollapsibleSection>

                {/* LANGUAGES */}
                <CollapsibleSection id="languages" title="Idiomas" isActive={activeSection === 'languages'} onToggle={handleSectionToggle}>
                  <div>
                    <Label>Idiomas (separados por coma)</Label>
                    <Input
                      value={idiomasText}
                      onChange={(e) => setIdiomasText(e.target.value)}
                      placeholder="Ej: OESTRÓN 5, SINDARIN 5"
                    />
                  </div>
                </CollapsibleSection>

                {/* COMPETENCIES */}
                <CollapsibleSection id="competencies" title="Competencias" isActive={activeSection === 'competencies'} onToggle={handleSectionToggle}>
                  <CompetenciesSection
                    formData={formData}
                    handleChange={handleChange}
                    toggleArrayItem={toggleArrayItem}
                  />
                </CollapsibleSection>

                {/* CULTURAL TRAITS */}
                <CollapsibleSection id="traits" title="Rasgos Culturales" isActive={activeSection === 'traits'} onToggle={handleSectionToggle}>
                  <div>
                    <Label>Rasgos Culturales (uno por línea)</Label>
                    <Textarea
                      value={rasgosCulturalesText}
                      onChange={(e) => setRasgosCulturalesText(e.target.value)}
                      rows={5}
                      placeholder="Sueños élficos: Los elfos no necesitan dormir...&#10;Habilidad élfica: Si no estás desanimado..."
                    />
                  </div>
                </CollapsibleSection>

                {/* SPECIALS */}
                <CollapsibleSection id="specials" title="Especiales de Cultura" color="torch-orange" isActive={activeSection === 'specials'} onToggle={handleSectionToggle}>
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
                </CollapsibleSection>

                {/* BACKGROUNDS - NEW */}
                <CollapsibleSection id="backgrounds" title="Trasfondos de la Cultura" color="magic-blue" isActive={activeSection === 'backgrounds'} onToggle={handleSectionToggle}>
                  <div>
                    <Label className="mb-2 block">Trasfondos asociados a esta cultura</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Selecciona los trasfondos que están disponibles para personajes de esta cultura.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {allBackgrounds.map(bg => (
                        <div key={bg.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.trasfondos_ids?.includes(bg.id)}
                            onCheckedChange={() => toggleArrayItem('trasfondos_ids', bg.id)}
                          />
                          <Label className="text-xs">{bg.nombre}</Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Seleccionados: {formData.trasfondos_ids?.length || 0}
                    </p>
                  </div>
                </CollapsibleSection>

                {/* VIRTUES CONFIGURATION - NEW */}
                {formData.tiene_virtud_inicial && (
                  <CollapsibleSection id="virtues" title="Configuración de Virtudes" color="torch-orange" isActive={activeSection === 'virtues'} onToggle={handleSectionToggle}>
                    <VirtuesConfigSection
                      formData={formData}
                      handleChange={handleChange}
                      toggleArrayItem={toggleArrayItem}
                      allVirtues={allVirtues}
                      allCultures={allCultures}
                      cultureId={culture?.id}
                      getAvailableVirtues={getAvailableVirtues}
                    />
                  </CollapsibleSection>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || loadingData} data-testid="save-culture-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Cultura'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CultureEditor;
