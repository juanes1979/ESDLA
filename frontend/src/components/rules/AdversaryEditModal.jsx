/**
 * AdversaryEditModal — edición de un ADVERSARIO o PNJ del Bestiario ya guardado
 * en «PNJs existentes» (trading_npcs). Edita los datos propios (nombre, ubicación,
 * apariencia, historia, notas, relaciones, rasgos) y el bloque de combate completo
 * (vía AdversaryBlockEditor). NO usa el modal de comerciantes para no corromper el
 * bloque de combate. Guarda con PUT /trading/npcs/{id} a través de onSave.
 */
import { useEffect, useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import AdversaryBlockEditor from './AdversaryBlockEditor';

const inp = "w-full bg-black/40 rounded px-2 py-1.5 text-sm outline-none border border-border/50";

const AdversaryEditModal = ({ npc, onSave, onClose }) => {
  const [form, setForm] = useState({ ...npc });
  const [ubicaciones, setUbicaciones] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bloque, setBloque] = useState({
    clase_armadura: npc.clase_armadura ?? npc.ca ?? 10,
    puntos_golpe: npc.puntos_golpe ?? npc.pg ?? 0,
    velocidad: npc.velocidad ?? 9,
    percepcion_pasiva: npc.percepcion_pasiva ?? 10,
    ataque_multiple: npc.ataque_multiple || '',
    atributos: { ...(npc.atributos || npc.caracteristicas || {}) },
    armas: (npc.armas || []).map((a) => ({ ...a })),
    especiales: (npc.especiales || []).map((a) => ({ ...a })),
    acciones: Array.isArray(npc.acciones) ? npc.acciones.map((a) => ({ ...a })) : [],
    reacciones: (npc.reacciones || []).map((a) => ({ ...a })),
  });
  const [rasgosTxt, setRasgosTxt] = useState((Array.isArray(npc.rasgos) ? npc.rasgos : []).join('\n'));

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  useEffect(() => {
    (async () => {
      try {
        const l = await api.get('/data/locations');
        setUbicaciones((l.data?.locations || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')));
      } catch { /* noop */ }
    })();
  }, []);

  const onUbicacion = (id) => {
    const loc = ubicaciones.find((u) => u.id === id);
    set({ ubicacion_id: id, ubicacion: loc?.nombre || '', region: loc?.region || form.region });
  };

  const handleSave = async () => {
    if (!form.nombre?.trim()) { toast.error('El nombre no puede estar vacío'); return; }
    setSaving(true);
    const rasgos = rasgosTxt.split('\n').map((s) => s.trim()).filter(Boolean);
    const doc = {
      ...form,
      ...bloque,
      ca: bloque.clase_armadura,
      pg: bloque.puntos_golpe,
      caracteristicas: bloque.atributos,
      rasgos,
    };
    try {
      await onSave(doc);
    } finally { setSaving(false); }
  };

  const esAdv = !!npc.es_adversario;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" data-testid="adversary-edit-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-card border border-[hsl(var(--destructive))]/40 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">Editar {esAdv ? 'adversario' : 'PNJ'}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" data-testid="adv-edit-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">Nombre
            <Input value={form.nombre || ''} onChange={(e) => set({ nombre: e.target.value })} data-testid="adv-edit-nombre" />
          </label>
          <label className="text-xs text-muted-foreground">Apodo
            <Input value={form.apodo || ''} onChange={(e) => set({ apodo: e.target.value })} data-testid="adv-edit-apodo" />
          </label>
          <label className="text-xs text-muted-foreground">Ubicación
            <select value={form.ubicacion_id || ''} onChange={(e) => onUbicacion(e.target.value)} className={inp} data-testid="adv-edit-ubicacion">
              <option value="">{form.ubicacion || '— elige —'}</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.region ? ` (${u.region})` : ''}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Sexo
            <select value={form.sexo || ''} onChange={(e) => set({ sexo: e.target.value })} className={inp} data-testid="adv-edit-sexo">
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Edad
            <Input value={form.edad || ''} onChange={(e) => set({ edad: e.target.value })} data-testid="adv-edit-edad" />
          </label>
          <label className="text-xs text-muted-foreground">Nivel / Desafío
            <Input value={form.desafio || ''} onChange={(e) => set({ desafio: e.target.value })} data-testid="adv-edit-desafio" />
          </label>
        </div>

        <label className="text-xs text-muted-foreground block">Apariencia / rasgos físicos
          <textarea rows={2} value={form.apariencia || ''} onChange={(e) => set({ apariencia: e.target.value })} className={`${inp} resize-y`} data-testid="adv-edit-apariencia" />
        </label>

        <label className="text-xs text-muted-foreground block">Rasgos (uno por línea)
          <textarea rows={3} value={rasgosTxt} onChange={(e) => setRasgosTxt(e.target.value)} className={`${inp} resize-y`} data-testid="adv-edit-rasgos" />
        </label>
        <label className="text-xs text-muted-foreground block">Forma de hablar
          <Input value={form.modo_hablar || ''} onChange={(e) => set({ modo_hablar: e.target.value })} data-testid="adv-edit-modohablar" />
        </label>

        <div>
          <p className="text-xs font-bold text-[hsl(var(--destructive))] mb-1">Bloque de combate</p>
          <AdversaryBlockEditor bloque={bloque} onChange={setBloque} />
        </div>

        <label className="text-xs text-muted-foreground block">Historia / Trasfondo
          <textarea rows={4} value={form.historia || ''} onChange={(e) => set({ historia: e.target.value })} className={`${inp} resize-y`} data-testid="adv-edit-historia" />
        </label>
        <label className="text-xs text-muted-foreground block">Relaciones con personajes (notas del DJ)
          <textarea rows={2} value={form.relaciones_dj || ''} onChange={(e) => set({ relaciones_dj: e.target.value })} className={`${inp} resize-y`} data-testid="adv-edit-relaciones" />
        </label>
        <label className="text-xs text-muted-foreground block">Notas del DJ
          <textarea rows={2} value={form.notas || ''} onChange={(e) => set({ notas: e.target.value })} className={`${inp} resize-y`} data-testid="adv-edit-notas" />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} data-testid="adv-edit-cancel">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[hsl(var(--destructive))] text-white" data-testid="adv-edit-save">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdversaryEditModal;
