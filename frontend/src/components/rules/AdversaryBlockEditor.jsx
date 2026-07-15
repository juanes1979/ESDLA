/**
 * AdversaryBlockEditor — edición del bloque de combate de un adversario
 * mientras se crea (armas, ataques, habilidades especiales, acciones,
 * reacciones, CA/PG/velocidad y atributos). Permite personalizar lo que
 * hereda del Bestiario antes de guardarlo como PNJ concreto.
 */
import { Plus, Trash2, Swords, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ATTRS = [['fuerza', 'FUE'], ['destreza', 'DES'], ['constitucion', 'CON'], ['inteligencia', 'INT'], ['sabiduria', 'SAB'], ['carisma', 'CAR']];
const inp = "w-full bg-black/40 rounded px-2 py-1 text-xs outline-none border border-border/50";

const AdversaryBlockEditor = ({ bloque, onChange }) => {
  const b = bloque || {};
  const set = (patch) => onChange({ ...b, ...patch });
  const setAttr = (k, v) => set({ atributos: { ...(b.atributos || {}), [k]: parseInt(v, 10) || 0 } });

  const setArr = (field, i, key, v) => {
    const arr = [...(b[field] || [])];
    arr[i] = { ...arr[i], [key]: v };
    set({ [field]: arr });
  };
  const addArr = (field, empty) => set({ [field]: [...(b[field] || []), empty] });
  const delArr = (field, i) => set({ [field]: (b[field] || []).filter((_, j) => j !== i) });

  const NamedList = ({ field, title, icon: Icon, color, testid }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold flex items-center gap-1" style={{ color }}><Icon className="w-3.5 h-3.5" /> {title}</p>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => addArr(field, { nombre: '', descripcion: '' })} data-testid={`${testid}-add`}>
          <Plus className="w-3 h-3 mr-1" /> Añadir
        </Button>
      </div>
      {(b[field] || []).map((it, i) => (
        <div key={i} className="rounded border border-border/40 bg-black/20 p-2 space-y-1" data-testid={`${testid}-${i}`}>
          <div className="flex items-center gap-1">
            <input value={it.nombre || ''} onChange={(e) => setArr(field, i, 'nombre', e.target.value)} placeholder="Nombre" className={inp} />
            <button type="button" onClick={() => delArr(field, i)} className="text-red-400 px-1" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <textarea rows={2} value={it.descripcion || ''} onChange={(e) => setArr(field, i, 'descripcion', e.target.value)} placeholder="Descripción" className={`${inp} resize-y`} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-black/20 p-3 space-y-3" data-testid="adv-block-editor">
      {/* CA / PG / Velocidad / Ataque múltiple */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-xs text-muted-foreground">CA
          <input type="number" value={b.clase_armadura ?? ''} onChange={(e) => set({ clase_armadura: parseInt(e.target.value, 10) || 0 })} className={inp} data-testid="advb-ca" />
        </label>
        <label className="text-xs text-muted-foreground">PG
          <input type="number" value={b.puntos_golpe ?? ''} onChange={(e) => set({ puntos_golpe: parseInt(e.target.value, 10) || 0 })} className={inp} data-testid="advb-pg" />
        </label>
        <label className="text-xs text-muted-foreground">Velocidad (m)
          <input type="number" value={b.velocidad ?? ''} onChange={(e) => set({ velocidad: parseInt(e.target.value, 10) || 0 })} className={inp} data-testid="advb-vel" />
        </label>
        <label className="text-xs text-muted-foreground">Percepción
          <input type="number" value={b.percepcion_pasiva ?? ''} onChange={(e) => set({ percepcion_pasiva: parseInt(e.target.value, 10) || 0 })} className={inp} data-testid="advb-perc" />
        </label>
      </div>

      {/* Atributos */}
      <div>
        <p className="text-xs font-bold text-[hsl(var(--gold))] mb-1">Atributos</p>
        <div className="grid grid-cols-6 gap-1.5">
          {ATTRS.map(([k, lab]) => (
            <label key={k} className="text-[10px] text-muted-foreground text-center">{lab}
              <input type="number" value={(b.atributos || {})[k] ?? ''} onChange={(e) => setAttr(k, e.target.value)} className={`${inp} text-center`} data-testid={`advb-attr-${k}`} />
            </label>
          ))}
        </div>
      </div>

      {/* Ataque múltiple */}
      <label className="text-xs text-muted-foreground block">Ataque múltiple
        <input value={b.ataque_multiple || ''} onChange={(e) => set({ ataque_multiple: e.target.value })} placeholder="Ej: 2 ataques con arma cuerpo a cuerpo" className={inp} data-testid="advb-multiataque" />
      </label>

      {/* Armas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold flex items-center gap-1 text-[hsl(var(--destructive))]"><Swords className="w-3.5 h-3.5" /> Ataques / Armas</p>
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => addArr('armas', { nombre: '', tipo: '', bonificador_impacto: 0, alcance_metros: '', dano: '', tipo_dano: '', efecto: '' })} data-testid="advb-arma-add">
            <Plus className="w-3 h-3 mr-1" /> Añadir arma
          </Button>
        </div>
        {(b.armas || []).map((arma, i) => (
          <div key={i} className="rounded border border-border/40 bg-black/20 p-2 space-y-1" data-testid={`advb-arma-${i}`}>
            <div className="flex items-center gap-1">
              <input value={arma.nombre || ''} onChange={(e) => setArr('armas', i, 'nombre', e.target.value)} placeholder="Nombre (p. ej. Espada de hoja ancha)" className={inp} data-testid={`advb-arma-nombre-${i}`} />
              <button type="button" onClick={() => delArr('armas', i)} className="text-red-400 px-1" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              <input value={arma.tipo || ''} onChange={(e) => setArr('armas', i, 'tipo', e.target.value)} placeholder="Tipo (c/c, distancia)" className={inp} />
              <input type="number" value={arma.bonificador_impacto ?? ''} onChange={(e) => setArr('armas', i, 'bonificador_impacto', parseInt(e.target.value, 10) || 0)} placeholder="+Impacto" className={inp} />
              <input value={arma.alcance_metros || ''} onChange={(e) => setArr('armas', i, 'alcance_metros', e.target.value)} placeholder="Alcance" className={inp} />
              <input value={arma.dano || ''} onChange={(e) => setArr('armas', i, 'dano', e.target.value)} placeholder="Daño (1d8+2)" className={inp} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <input value={arma.tipo_dano || ''} onChange={(e) => setArr('armas', i, 'tipo_dano', e.target.value)} placeholder="Tipo de daño (cortante…)" className={inp} />
              <input value={arma.efecto || ''} onChange={(e) => setArr('armas', i, 'efecto', e.target.value)} placeholder="Efecto adicional (opcional)" className={inp} />
            </div>
          </div>
        ))}
      </div>

      <NamedList field="especiales" title="Habilidades especiales" icon={Sparkles} color="rgb(192 132 252)" testid="advb-especial" />
      <NamedList field="acciones" title="Otras acciones" icon={Zap} color="hsl(var(--gold))" testid="advb-accion" />
      <NamedList field="reacciones" title="Reacciones" icon={Zap} color="hsl(var(--torch-orange))" testid="advb-reaccion" />
    </div>
  );
};

export default AdversaryBlockEditor;
