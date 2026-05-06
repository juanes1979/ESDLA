/**
 * NPCStatBlockEditor — full editable bestiary-style stat block.
 *
 * Used inside the Adventure wizard when the DM creates a "PNJ desde 0".
 * Outputs the same shape as backend `NPCCreate` so it can be reused as a
 * combat actor when a campaign run consumes it.
 */
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ATTR_KEYS = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
const ATTR_LABELS = {
  fuerza: 'FUE',
  destreza: 'DES',
  constitucion: 'CON',
  inteligencia: 'INT',
  sabiduria: 'SAB',
  carisma: 'CAR',
};

const Input = (props) => (
  <input
    {...props}
    className={`w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm ${props.className || ''}`}
  />
);

const TextArea = (props) => (
  <textarea
    {...props}
    className={`w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm resize-y ${props.className || ''}`}
  />
);

const Section = ({ title, children }) => (
  <div className="mb-3">
    <div className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">{title}</div>
    {children}
  </div>
);

const NPCStatBlockEditor = ({ value = {}, onChange, idPrefix = 'npc-block' }) => {
  const v = value || {};
  const set = (key, val) => onChange({ ...v, [key]: val });
  const setAttr = (k, val) => onChange({ ...v, atributos: { ...(v.atributos || {}), [k]: val } });

  const updateArrayItem = (key, idx, patch) => {
    const arr = [...(v[key] || [])];
    arr[idx] = { ...arr[idx], ...patch };
    set(key, arr);
  };
  const addArrayItem = (key, blank) => set(key, [...(v[key] || []), blank]);
  const removeArrayItem = (key, idx) => set(key, (v[key] || []).filter((_, i) => i !== idx));

  return (
    <div
      className="rounded border border-amber-800/40 bg-black/30 p-3"
      data-testid={`${idPrefix}-container`}
    >
      <Section title="Identidad">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={v.tipo || ''}
            onChange={(e) => set('tipo', e.target.value)}
            placeholder="Tipo (p. ej. Espectro Mediano)"
            data-testid={`${idPrefix}-tipo`}
          />
          <Input
            value={v.tamanio || ''}
            onChange={(e) => set('tamanio', e.target.value)}
            placeholder="Tamaño (Pequeño, Mediano…)"
            data-testid={`${idPrefix}-tamanio`}
          />
          <Input
            value={v.alineamiento || ''}
            onChange={(e) => set('alineamiento', e.target.value)}
            placeholder="Alineamiento"
            data-testid={`${idPrefix}-alineamiento`}
          />
          <Input
            value={v.desafio || ''}
            onChange={(e) => set('desafio', e.target.value)}
            placeholder="Desafío (p. ej. 5 (1.800 PX))"
            data-testid={`${idPrefix}-desafio`}
          />
        </div>
        <TextArea
          value={v.descripcion || ''}
          onChange={(e) => set('descripcion', e.target.value)}
          placeholder="Descripción breve"
          rows={2}
          data-testid={`${idPrefix}-desc`}
        />
      </Section>

      <Section title="Combate">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input
            type="number"
            value={v.clase_armadura ?? ''}
            onChange={(e) => set('clase_armadura', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="CA"
            data-testid={`${idPrefix}-ca`}
          />
          <Input
            type="number"
            value={v.puntos_golpe ?? ''}
            onChange={(e) => set('puntos_golpe', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="PG"
            data-testid={`${idPrefix}-pg`}
          />
          <Input
            value={v.dados_golpe || ''}
            onChange={(e) => set('dados_golpe', e.target.value)}
            placeholder="Dados PG (p. ej. 8d8)"
            data-testid={`${idPrefix}-dados`}
          />
          <Input
            type="number"
            value={v.velocidad ?? ''}
            onChange={(e) => set('velocidad', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Velocidad (m)"
            data-testid={`${idPrefix}-velocidad`}
          />
        </div>
        <Input
          value={v.descripcion_armadura || ''}
          onChange={(e) => set('descripcion_armadura', e.target.value)}
          placeholder="Descripción armadura (p. ej. cota de mallas, escudo)"
          data-testid={`${idPrefix}-armadura-desc`}
          className="mt-2"
        />
      </Section>

      <Section title="Atributos">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ATTR_KEYS.map((k) => (
            <div key={k}>
              <div className="text-xs text-amber-300/70 mb-0.5">{ATTR_LABELS[k]}</div>
              <Input
                type="number"
                value={v.atributos?.[k] ?? ''}
                onChange={(e) => setAttr(k, e.target.value === '' ? null : Number(e.target.value))}
                placeholder="10"
                data-testid={`${idPrefix}-attr-${k}`}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sentidos & Lenguajes">
        <Input
          value={(v.sentidos || []).join(', ')}
          onChange={(e) => set('sentidos', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="Sentidos (separados por coma): Visión en la oscuridad 60 pies, ..."
          data-testid={`${idPrefix}-sentidos`}
        />
        <Input
          value={(v.idiomas || []).join(', ')}
          onChange={(e) => set('idiomas', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          placeholder="Idiomas: Común, Negro Habla, …"
          data-testid={`${idPrefix}-idiomas`}
          className="mt-2"
        />
      </Section>

      <Section title="Resistencias / Inmunidades / Vulnerabilidades">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={(v.resistencias || []).join(', ')}
            onChange={(e) => set('resistencias', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Resistencias"
            data-testid={`${idPrefix}-resistencias`}
          />
          <Input
            value={(v.inmunidades_dano || []).join(', ')}
            onChange={(e) => set('inmunidades_dano', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Inmunidades a daño"
            data-testid={`${idPrefix}-inm-dano`}
          />
          <Input
            value={(v.inmunidades_estados || []).join(', ')}
            onChange={(e) => set('inmunidades_estados', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Inmunidades a estados"
            data-testid={`${idPrefix}-inm-estados`}
          />
          <Input
            value={(v.vulnerabilidades || []).join(', ')}
            onChange={(e) => set('vulnerabilidades', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Vulnerabilidades"
            data-testid={`${idPrefix}-vulns`}
          />
        </div>
      </Section>

      <Section title="Especiales (Rasgos)">
        {(v.especiales || []).map((it, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-start mb-2 p-2 rounded border border-amber-800/30 bg-black/40"
          >
            <div className="flex-1 space-y-1">
              <Input
                value={it.nombre || ''}
                onChange={(e) => updateArrayItem('especiales', idx, { nombre: e.target.value })}
                placeholder="Nombre del rasgo"
                data-testid={`${idPrefix}-special-name-${idx}`}
              />
              <TextArea
                value={it.descripcion || ''}
                onChange={(e) => updateArrayItem('especiales', idx, { descripcion: e.target.value })}
                placeholder="Descripción"
                rows={2}
                data-testid={`${idPrefix}-special-desc-${idx}`}
              />
            </div>
            <button
              onClick={() => removeArrayItem('especiales', idx)}
              className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700 self-start"
              data-testid={`${idPrefix}-special-remove-${idx}`}
              aria-label="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addArrayItem('especiales', { nombre: '', descripcion: '' })}
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          data-testid={`${idPrefix}-special-add`}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir rasgo
        </Button>
      </Section>

      <Section title="Ataques">
        <Input
          value={v.ataque_multiple || ''}
          onChange={(e) => set('ataque_multiple', e.target.value)}
          placeholder='Ataque múltiple (p. ej. "Lleva a cabo dos ataques cuerpo a cuerpo")'
          data-testid={`${idPrefix}-multiattack`}
          className="mb-2"
        />
        {(v.armas || []).map((a, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start mb-2 p-2 rounded border border-amber-800/30 bg-black/40"
          >
            <Input
              value={a.nombre || ''}
              onChange={(e) => updateArrayItem('armas', idx, { nombre: e.target.value })}
              placeholder="Arma (p. ej. Espada larga)"
              data-testid={`${idPrefix}-arma-name-${idx}`}
            />
            <Input
              value={a.dano || ''}
              onChange={(e) => updateArrayItem('armas', idx, { dano: e.target.value })}
              placeholder="Daño (p. ej. 1d8 + 3)"
              data-testid={`${idPrefix}-arma-dano-${idx}`}
            />
            <div className="flex gap-2">
              <Input
                value={a.alcance || ''}
                onChange={(e) => updateArrayItem('armas', idx, { alcance: e.target.value })}
                placeholder="Alcance"
                data-testid={`${idPrefix}-arma-alcance-${idx}`}
              />
              <button
                onClick={() => removeArrayItem('armas', idx)}
                className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700"
                data-testid={`${idPrefix}-arma-remove-${idx}`}
                aria-label="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            addArrayItem('armas', {
              nombre: '',
              dano: '',
              alcance: '',
              tipo_dano: '',
              tipo_arma: 'cuerpo_a_cuerpo',
            })
          }
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          data-testid={`${idPrefix}-arma-add`}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir ataque
        </Button>
      </Section>

      <Section title="Reacciones">
        {(v.reacciones || []).map((r, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-start mb-2 p-2 rounded border border-amber-800/30 bg-black/40"
          >
            <div className="flex-1 space-y-1">
              <Input
                value={r.nombre || ''}
                onChange={(e) => updateArrayItem('reacciones', idx, { nombre: e.target.value })}
                placeholder="Nombre"
                data-testid={`${idPrefix}-reaccion-name-${idx}`}
              />
              <TextArea
                value={r.descripcion || ''}
                onChange={(e) => updateArrayItem('reacciones', idx, { descripcion: e.target.value })}
                placeholder="Descripción"
                rows={2}
                data-testid={`${idPrefix}-reaccion-desc-${idx}`}
              />
            </div>
            <button
              onClick={() => removeArrayItem('reacciones', idx)}
              className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700 self-start"
              data-testid={`${idPrefix}-reaccion-remove-${idx}`}
              aria-label="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addArrayItem('reacciones', { nombre: '', descripcion: '' })}
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          data-testid={`${idPrefix}-reaccion-add`}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir reacción
        </Button>
      </Section>
    </div>
  );
};

export default NPCStatBlockEditor;
