/**
 * CreatureNameConfigEditor — Fase B: edición de las "bases" de los generadores de
 * nombres de criaturas sin raza (Orco/Trol/Huargo y nuevos tipos). Permite añadir
 * o quitar tipos y editar sus diccionarios de sílabas y epítetos. Solo Maestro.
 */
import { useEffect, useState } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const toText = (arr) => (arr || []).join('\n');
const toArr = (txt) => (txt || '').split('\n').map((s) => s.trim()).filter(Boolean);

const CreatureNameConfigEditor = ({ open, onClose, onSaved }) => {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('nombres');
  const [traits, setTraits] = useState(null);      // { orcos:{defectos:[...],...}, ... }
  const [formas, setFormas] = useState('');         // formas de hablar (texto)
  const [selFam, setSelFam] = useState('orcos');

  const FAMILIAS = [['orcos', 'Orcos'], ['trolls', 'Trolls'], ['huargos', 'Huargos'], ['espectros', 'Espectros']];
  const GRUPOS = [['defectos', 'Defectos'], ['obsesiones', 'Obsesiones'], ['miedos', 'Miedos'], ['manias', 'Manías'], ['fortalezas', 'Fortalezas']];

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await api.get('/npc-generator/creature-name-config');
        const d = res.data?.data || {};
        setData(d);
        setSel(Object.keys(d)[0] || '');
      } catch { toast.error('No se pudo cargar la configuración'); }
      try {
        const t = await api.get('/npc-generator/adversary-traits-config');
        setTraits(t.data?.traits || {});
        setFormas((t.data?.formas_habla || []).join('\n'));
      } catch { /* noop */ }
    })();
  }, [open]);

  if (!open) return null;
  const tipos = data ? Object.keys(data) : [];
  const cur = data?.[sel];

  const setField = (field, value) => setData((prev) => ({ ...prev, [sel]: { ...prev[sel], [field]: value } }));

  const addTipo = () => {
    const id = window.prompt('ID del nuevo tipo (sin espacios, p. ej. "espectro-orco"):');
    if (!id) return;
    const key = id.trim().toLowerCase().replace(/\s+/g, '-');
    if (data[key]) { toast.error('Ya existe ese tipo'); return; }
    setData((prev) => ({ ...prev, [key]: { label: id.trim(), usa_sexo: false, ataque: [], nucleo: [], cierre_univ: [], epitetos: [] } }));
    setSel(key);
  };

  const delTipo = () => {
    if (!sel || !window.confirm(`¿Eliminar el tipo «${cur?.label || sel}»?`)) return;
    setData((prev) => { const n = { ...prev }; delete n[sel]; return n; });
    setSel(Object.keys(data).filter((k) => k !== sel)[0] || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/npc-generator/creature-name-config', { data });
      if (traits) {
        await api.put('/npc-generator/adversary-traits-config', {
          traits,
          formas_habla: (formas || '').split('\n').map((s) => s.trim()).filter(Boolean),
        });
      }
      toast.success('Bases de creación guardadas');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  const setTrait = (fam, grupo, txt) => setTraits((prev) => ({
    ...prev, [fam]: { ...(prev?.[fam] || {}), [grupo]: txt.split('\n').map((s) => s.trim()).filter(Boolean) },
  }));

  const ArrayField = ({ label, field }) => (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label} <span className="opacity-60">(uno por línea)</span></label>
      <textarea rows={5} value={toText(cur?.[field])} onChange={(e) => setField(field, toArr(e.target.value))}
        className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y font-mono" data-testid={`cfg-${field}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose} data-testid="creature-config-modal">
      <div className="bg-zinc-900 rounded-xl border border-[hsl(var(--gold))/40] p-4 max-w-2xl w-full max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Bases de creación</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white" data-testid="cfg-close"><X className="w-5 h-5" /></button>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 mb-3 border-b border-border/40 pb-2">
          {[['nombres', 'Nombres / Tipos'], ['rasgos', 'Rasgos de adversario'], ['formas', 'Formas de hablar']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} data-testid={`cfg-tab-${id}`}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${tab === id ? 'bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground'}`}>{label}</button>
          ))}
        </div>

        {!data ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
          <>
            {tab === 'nombres' && (<>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {tipos.map((t) => (
                <button key={t} onClick={() => setSel(t)} data-testid={`cfg-tipo-${t}`}
                  className={`text-xs px-2.5 py-1 rounded-full border ${sel === t ? 'bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground'}`}>
                  {data[t].label}
                </button>
              ))}
              <button onClick={addTipo} className="text-xs px-2 py-1 rounded-full border border-emerald-700/50 text-emerald-300 flex items-center gap-1" data-testid="cfg-add-tipo"><Plus className="w-3 h-3" /> Tipo</button>
            </div>

            {cur && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="cfg-fields">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs text-muted-foreground block mb-1">Nombre visible</label>
                    <Input value={cur.label || ''} onChange={(e) => setField('label', e.target.value)} data-testid="cfg-label" />
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-5">
                    <input type="checkbox" checked={!!cur.usa_sexo} onChange={(e) => setField('usa_sexo', e.target.checked)} data-testid="cfg-usa-sexo" />
                    Cierres por sexo (M/F)
                  </label>
                  <Button size="sm" variant="outline" onClick={delTipo} className="border-rose-700/50 text-rose-300 mt-4" data-testid="cfg-del-tipo"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Descripción física (para los retratos de IA)</label>
                  <textarea rows={3} value={cur.descripcion_visual || ''} onChange={(e) => setField('descripcion_visual', e.target.value)}
                    placeholder="Ej: Orco: piel gris verdosa, colmillos, orejas puntiagudas, cicatrices, ojos amarillos, armadura tosca de cuero y metal..."
                    className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid="cfg-descripcion-visual" />
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Se añade como base al generar el retrato de este tipo de criatura, para que salga más fiel (p. ej. que un orco parezca un orco).</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ArrayField label="Ataque (sílaba inicial)" field="ataque" />
                  <ArrayField label="Núcleo (sílaba central, 70%)" field="nucleo" />
                  {cur.usa_sexo ? (
                    <>
                      <ArrayField label="Cierre masculino" field="cierre_m" />
                      <ArrayField label="Cierre femenino" field="cierre_f" />
                    </>
                  ) : (
                    <ArrayField label="Cierre (universal)" field="cierre_univ" />
                  )}
                  <ArrayField label="Epítetos (25%)" field="epitetos" />
                </div>
              </div>
            )}
            </>)}

            {tab === 'rasgos' && traits && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="cfg-rasgos-editor">
                <div className="flex gap-2 flex-wrap">
                  {FAMILIAS.map(([id, label]) => (
                    <button key={id} onClick={() => setSelFam(id)} data-testid={`cfg-fam-${id}`}
                      className={`text-xs px-2.5 py-1 rounded-full border ${selFam === id ? 'bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground'}`}>{label}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Al generar un adversario se elige 1 aleatorio de cada grupo (uno por línea).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GRUPOS.map(([g, gl]) => (
                    <div key={g}>
                      <label className="text-xs text-muted-foreground block mb-1">{gl} <span className="opacity-60">({(traits[selFam]?.[g] || []).length})</span></label>
                      <textarea rows={6} value={(traits[selFam]?.[g] || []).join('\n')} onChange={(e) => setTrait(selFam, g, e.target.value)}
                        className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid={`cfg-rasgo-${selFam}-${g}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'formas' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1" data-testid="cfg-formas-editor">
                <p className="text-xs text-muted-foreground">Formas de hablar (una por línea). Solo se asignan a Orcos y Trolls.</p>
                <textarea rows={16} value={formas} onChange={(e) => setFormas(e.target.value)}
                  className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid="cfg-formas-textarea" />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={onClose} className="border-border/50">Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-[hsl(var(--gold))] text-black" data-testid="cfg-save">
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreatureNameConfigEditor;
