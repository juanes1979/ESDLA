/**
 * VirtueEditor — modal para crear/editar virtudes desde Reglas → Virtudes.
 * Cubre todos los campos del esquema real de la colección `virtues`.
 */
import { useState } from 'react';
import { X, Save, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/services/api';

const STATS = [
  { key: 'fuerza', label: 'FUERZA' },
  { key: 'destreza', label: 'DESTREZA' },
  { key: 'constitucion', label: 'CONSTITUCIÓN' },
  { key: 'inteligencia', label: 'INTELIGENCIA' },
  { key: 'sabiduria', label: 'SABIDURÍA' },
  { key: 'carisma', label: 'CARISMA' },
];

const CHAR_OPTIONS = ['FUERZA', 'DESTREZA', 'CONSTITUCIÓN', 'INTELIGENCIA', 'SABIDURÍA', 'CARISMA'];
const SAVE_OPTIONS = ['FUERZA', 'DESTREZA', 'CONSTITUCIÓN', 'INTELIGENCIA', 'SABIDURÍA', 'CARISMA'];

const listToText = (arr) => (Array.isArray(arr) ? arr.join(', ') : (arr || ''));
const textToList = (txt) =>
  (txt || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const VirtueEditor = ({ virtue, onSave, onClose }) => {
  const isNew = !virtue;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    nombre: virtue?.nombre || '',
    cultura: virtue?.cultura || '',
    es_comun: virtue?.es_comun || false,
    descripcion: virtue?.descripcion || '',
    rasgos: virtue?.rasgos || '',
    aumenta_fuerza: virtue?.aumenta_fuerza || false,
    aumenta_destreza: virtue?.aumenta_destreza || false,
    aumenta_constitucion: virtue?.aumenta_constitucion || false,
    aumenta_inteligencia: virtue?.aumenta_inteligencia || false,
    aumenta_sabiduria: virtue?.aumenta_sabiduria || false,
    aumenta_carisma: virtue?.aumenta_carisma || false,
    elegir_caracteristica: virtue?.elegir_caracteristica || [],
    elegir_salvacion: virtue?.elegir_salvacion || [],
    bonus_puntos_golpe: virtue?.bonus_puntos_golpe || '',
    bonus_comunidad: virtue?.bonus_comunidad || '',
    bonus_ca: virtue?.bonus_ca || '',
    elegir_habilidad: listToText(virtue?.elegir_habilidad),
    elegir_herramienta: listToText(virtue?.elegir_herramienta),
  }));

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleInList = (key, opt) =>
    setForm((p) => {
      const cur = p[key] || [];
      return { ...p, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error('La virtud necesita un nombre');
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      cultura: form.cultura.trim() || null,
      es_comun: form.es_comun,
      descripcion: form.descripcion.trim() || null,
      rasgos: form.rasgos.trim() || null,
      aumenta_fuerza: form.aumenta_fuerza,
      aumenta_destreza: form.aumenta_destreza,
      aumenta_constitucion: form.aumenta_constitucion,
      aumenta_inteligencia: form.aumenta_inteligencia,
      aumenta_sabiduria: form.aumenta_sabiduria,
      aumenta_carisma: form.aumenta_carisma,
      elegir_caracteristica: form.elegir_caracteristica.length ? form.elegir_caracteristica : null,
      elegir_salvacion: form.elegir_salvacion.length ? form.elegir_salvacion : null,
      bonus_puntos_golpe: form.bonus_puntos_golpe ? Number(form.bonus_puntos_golpe) : null,
      bonus_comunidad: form.bonus_comunidad ? Number(form.bonus_comunidad) : null,
      bonus_ca: form.bonus_ca ? Number(form.bonus_ca) : null,
      elegir_habilidad: textToList(form.elegir_habilidad).length ? textToList(form.elegir_habilidad) : null,
      elegir_herramienta: textToList(form.elegir_herramienta).length ? textToList(form.elegir_herramienta) : null,
    };
    try {
      setSaving(true);
      if (isNew) {
        await api.post('/data/virtudes', payload);
        toast.success(`Virtud "${payload.nombre}" creada`);
      } else {
        await api.put(`/data/virtudes/${virtue.id || virtue._id}`, payload);
        toast.success(`Virtud "${payload.nombre}" actualizada`);
      }
      await onSave?.();
      onClose?.();
    } catch (err) {
      toast.error('No se pudo guardar la virtud');
      console.error('VirtueEditor save error', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4"
      data-testid="virtue-editor-modal"
    >
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))/40] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-border/30 sticky top-0 bg-[hsl(var(--background))] z-10">
          <h3 className="font-heading text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {isNew ? 'Nueva Virtud' : `Editar: ${virtue.nombre}`}
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose} data-testid="virtue-editor-close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Basic */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                data-testid="virtue-nombre-input"
              />
            </div>
            <div>
              <Label>Cultura (vacío = común)</Label>
              <Input
                value={form.cultura}
                onChange={(e) => set('cultura', e.target.value)}
                placeholder="p. ej. Hombres de Bree"
                data-testid="virtue-cultura-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/20 p-3 rounded">
            <Checkbox
              checked={form.es_comun}
              onCheckedChange={(c) => set('es_comun', !!c)}
              data-testid="virtue-comun-checkbox"
            />
            <Label>Es una virtud común (disponible para todas las culturas que lo permitan)</Label>
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              rows={2}
              data-testid="virtue-descripcion-input"
            />
          </div>

          <div>
            <Label>Rasgos a indicar en la ficha</Label>
            <Textarea
              value={form.rasgos}
              onChange={(e) => set('rasgos', e.target.value)}
              rows={2}
              data-testid="virtue-rasgos-input"
            />
          </div>

          {/* Fixed stat increases */}
          <div className="bg-black/20 p-3 rounded">
            <Label className="mb-2 block text-[hsl(var(--gold))]">Aumento fijo +1 (marca las que suban seguro)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {STATS.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={form[`aumenta_${s.key}`]}
                    onCheckedChange={(c) => set(`aumenta_${s.key}`, !!c)}
                    data-testid={`virtue-aumenta-${s.key}`}
                  />
                  <Label className="text-xs">{s.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Choose characteristic */}
          <div className="bg-black/20 p-3 rounded">
            <Label className="mb-2 block text-[hsl(var(--torch-orange))]">Elegir +1 entre (el jugador escoge una)</Label>
            <div className="flex flex-wrap gap-2">
              {CHAR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleInList('elegir_caracteristica', opt)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    form.elegir_caracteristica.includes(opt)
                      ? 'bg-[hsl(var(--torch-orange))] text-black border-[hsl(var(--torch-orange))]'
                      : 'border-[hsl(var(--torch-orange))/40] text-[hsl(var(--torch-orange))]'
                  }`}
                  data-testid={`virtue-elegir-char-${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Choose saving throw */}
          <div className="bg-black/20 p-3 rounded">
            <Label className="mb-2 block text-[hsl(var(--magic-blue))]">Elegir competencia en salvación</Label>
            <div className="flex flex-wrap gap-2">
              {SAVE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleInList('elegir_salvacion', opt)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    form.elegir_salvacion.includes(opt)
                      ? 'bg-[hsl(var(--magic-blue))] text-white border-[hsl(var(--magic-blue))]'
                      : 'border-[hsl(var(--magic-blue))/40] text-[hsl(var(--magic-blue))]'
                  }`}
                  data-testid={`virtue-elegir-save-${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric bonuses */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>+ PG</Label>
              <Input
                type="number"
                value={form.bonus_puntos_golpe}
                onChange={(e) => set('bonus_puntos_golpe', e.target.value)}
                data-testid="virtue-bonus-pg"
              />
            </div>
            <div>
              <Label>+ Comunidad</Label>
              <Input
                type="number"
                value={form.bonus_comunidad}
                onChange={(e) => set('bonus_comunidad', e.target.value)}
                data-testid="virtue-bonus-comunidad"
              />
            </div>
            <div>
              <Label>+ CA</Label>
              <Input
                type="number"
                value={form.bonus_ca}
                onChange={(e) => set('bonus_ca', e.target.value)}
                data-testid="virtue-bonus-ca"
              />
            </div>
          </div>

          {/* Skill / tool choices */}
          <div>
            <Label>Elegir competencia en habilidad (separadas por comas)</Label>
            <Input
              value={form.elegir_habilidad}
              onChange={(e) => set('elegir_habilidad', e.target.value)}
              placeholder="Investigación (Int), Naturaleza (Int)"
              data-testid="virtue-elegir-habilidad"
            />
          </div>
          <div>
            <Label>Elegir competencia en herramienta (separadas por comas)</Label>
            <Input
              value={form.elegir_herramienta}
              onChange={(e) => set('elegir_herramienta', e.target.value)}
              placeholder="Herramientas de herrería, Suministros de carpintería"
              data-testid="virtue-elegir-herramienta"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-border/30 sticky bottom-0 bg-[hsl(var(--background))]">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="btn-fantasy" data-testid="virtue-editor-save">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VirtueEditor;
