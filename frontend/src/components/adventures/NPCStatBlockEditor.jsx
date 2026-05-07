/**
 * NPCStatBlockEditor — full editable bestiary-style stat block.
 *
 * v2 (it103):
 *  - Cada input lleva su LABEL clara (CA, PG, Velocidad…).
 *  - Modificador de atributo calculado debajo del valor (FUE 18 → +4).
 *  - Cada ataque lleva un campo "Característica especial" (special_text)
 *    para describir efectos extra que el DJ debe ver durante el combate.
 *  - Vista previa estilo libro (NPCStatBlockPreview, ver más abajo) usable
 *    desde el wizard.
 *
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

export const attrModifier = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const v = Number(value);
  if (isNaN(v)) return null;
  return Math.floor((v - 10) / 2);
};

const formatMod = (m) => (m === null ? '—' : m >= 0 ? `+${m}` : `${m}`);

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

const Section = ({ title, children, hint }) => (
  <div className="mb-3">
    <div className="text-xs uppercase tracking-wide text-amber-400/80 mb-1">
      {title}
      {hint && <span className="ml-2 normal-case text-amber-300/40 italic">— {hint}</span>}
    </div>
    {children}
  </div>
);

const Labeled = ({ label, hint, children }) => (
  <label className="text-xs text-amber-300/70 block">
    {label}
    {hint && <span className="text-amber-300/40 italic ml-1">({hint})</span>}
    <div className="mt-0.5">{children}</div>
  </label>
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
          <Labeled label="Tipo" hint="raza/especie">
            <Input
              value={v.tipo || ''}
              onChange={(e) => set('tipo', e.target.value)}
              placeholder="p. ej. Humanoide Mediano (orco)"
              data-testid={`${idPrefix}-tipo`}
            />
          </Labeled>
          <Labeled label="Tamaño">
            <Input
              value={v.tamanio || ''}
              onChange={(e) => set('tamanio', e.target.value)}
              placeholder="Pequeño / Mediano / Grande…"
              data-testid={`${idPrefix}-tamanio`}
            />
          </Labeled>
          <Labeled label="Alineamiento">
            <Input
              value={v.alineamiento || ''}
              onChange={(e) => set('alineamiento', e.target.value)}
              placeholder="Neutral malvado, Caótico bueno…"
              data-testid={`${idPrefix}-alineamiento`}
            />
          </Labeled>
          <Labeled label="Desafío" hint="nivel de reto + PX">
            <Input
              value={v.desafio || ''}
              onChange={(e) => set('desafio', e.target.value)}
              placeholder="p. ej. 5 (1.800 PX)"
              data-testid={`${idPrefix}-desafio`}
            />
          </Labeled>
        </div>
        <Labeled label="Descripción breve">
          <TextArea
            value={v.descripcion || ''}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Aspecto, comportamiento, contexto…"
            rows={2}
            data-testid={`${idPrefix}-desc`}
          />
        </Labeled>
      </Section>

      <Section title="Combate">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Labeled label="Clase de Armadura" hint="CA">
            <Input
              type="number"
              value={v.clase_armadura ?? ''}
              onChange={(e) => set('clase_armadura', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="10"
              data-testid={`${idPrefix}-ca`}
            />
          </Labeled>
          <Labeled label="Puntos de Golpe" hint="PG totales">
            <Input
              type="number"
              value={v.puntos_golpe ?? ''}
              onChange={(e) => set('puntos_golpe', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="11"
              data-testid={`${idPrefix}-pg`}
            />
          </Labeled>
          <Labeled label="Dados de Golpe" hint="fórmula PG">
            <Input
              value={v.dados_golpe || ''}
              onChange={(e) => set('dados_golpe', e.target.value)}
              placeholder="2d8 + 2"
              data-testid={`${idPrefix}-dados`}
            />
          </Labeled>
          <Labeled label="Velocidad" hint="metros / asalto">
            <Input
              type="number"
              value={v.velocidad ?? ''}
              onChange={(e) => set('velocidad', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="9"
              data-testid={`${idPrefix}-velocidad`}
            />
          </Labeled>
        </div>
        <Labeled label="Descripción de armadura">
          <Input
            value={v.descripcion_armadura || ''}
            onChange={(e) => set('descripcion_armadura', e.target.value)}
            placeholder="cota de mallas, escudo, armadura natural…"
            data-testid={`${idPrefix}-armadura-desc`}
          />
        </Labeled>
      </Section>

      <Section title="Atributos" hint="el modificador se calcula automáticamente">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ATTR_KEYS.map((k) => {
            const val = v.atributos?.[k];
            const mod = attrModifier(val);
            return (
              <div key={k} className="text-center">
                <div className="text-xs text-amber-300/80 mb-0.5 font-medium">{ATTR_LABELS[k]}</div>
                <Input
                  type="number"
                  value={val ?? ''}
                  onChange={(e) => setAttr(k, e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="10"
                  data-testid={`${idPrefix}-attr-${k}`}
                  className="text-center"
                />
                <div
                  className={`mt-0.5 text-xs font-medium ${
                    mod === null
                      ? 'text-amber-300/30'
                      : mod >= 0
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                  data-testid={`${idPrefix}-attr-${k}-mod`}
                >
                  {formatMod(mod)}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Sentidos & Lenguajes">
        <Labeled label="Sentidos" hint="separados por coma">
          <Input
            value={(v.sentidos || []).join(', ')}
            onChange={(e) => set('sentidos', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Visión en la oscuridad 60 pies, Percepción pasiva 12…"
            data-testid={`${idPrefix}-sentidos`}
          />
        </Labeled>
        <Labeled label="Idiomas" hint="separados por coma">
          <Input
            value={(v.idiomas || []).join(', ')}
            onChange={(e) => set('idiomas', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="Común, Negro Habla, Élfico…"
            data-testid={`${idPrefix}-idiomas`}
          />
        </Labeled>
      </Section>

      <Section title="Resistencias / Inmunidades / Vulnerabilidades">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Labeled label="Resistencias al daño">
            <Input
              value={(v.resistencias || []).join(', ')}
              onChange={(e) => set('resistencias', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="contundente y cortante de armas no mágicas…"
              data-testid={`${idPrefix}-resistencias`}
            />
          </Labeled>
          <Labeled label="Inmunidades a daño">
            <Input
              value={(v.inmunidades_dano || []).join(', ')}
              onChange={(e) => set('inmunidades_dano', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="veneno, fuego…"
              data-testid={`${idPrefix}-inm-dano`}
            />
          </Labeled>
          <Labeled label="Inmunidades a estados">
            <Input
              value={(v.inmunidades_estados || []).join(', ')}
              onChange={(e) => set('inmunidades_estados', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="petrificado, paralizado…"
              data-testid={`${idPrefix}-inm-estados`}
            />
          </Labeled>
          <Labeled label="Vulnerabilidades">
            <Input
              value={(v.vulnerabilidades || []).join(', ')}
              onChange={(e) => set('vulnerabilidades', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="fuego, ácido…"
              data-testid={`${idPrefix}-vulns`}
            />
          </Labeled>
        </div>
      </Section>

      <Section title="Especiales (Rasgos)" hint="capacidades pasivas o automáticas">
        {(v.especiales || []).map((it, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-start mb-2 p-2 rounded border border-amber-800/30 bg-black/40"
          >
            <div className="flex-1 space-y-1">
              <Labeled label="Nombre del rasgo">
                <Input
                  value={it.nombre || ''}
                  onChange={(e) => updateArrayItem('especiales', idx, { nombre: e.target.value })}
                  placeholder="p. ej. Maldición de la luz del sol"
                  data-testid={`${idPrefix}-special-name-${idx}`}
                />
              </Labeled>
              <Labeled label="Descripción">
                <TextArea
                  value={it.descripcion || ''}
                  onChange={(e) => updateArrayItem('especiales', idx, { descripcion: e.target.value })}
                  placeholder="Queda petrificado si termina su turno a la luz del sol…"
                  rows={2}
                  data-testid={`${idPrefix}-special-desc-${idx}`}
                />
              </Labeled>
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

      <Section title="Ataques" hint="acciones ofensivas durante el combate">
        <Labeled label="Ataque múltiple" hint="opcional, descripción narrativa">
          <Input
            value={v.ataque_multiple || ''}
            onChange={(e) => set('ataque_multiple', e.target.value)}
            placeholder='p. ej. "Lleva a cabo dos ataques cuerpo a cuerpo"'
            data-testid={`${idPrefix}-multiattack`}
          />
        </Labeled>
        {(v.armas || []).map((a, idx) => (
          <div
            key={idx}
            className="mb-2 p-2 rounded border border-amber-800/30 bg-black/40"
            data-testid={`${idPrefix}-arma-${idx}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
              <Labeled label="Nombre del ataque">
                <Input
                  value={a.nombre || ''}
                  onChange={(e) => updateArrayItem('armas', idx, { nombre: e.target.value })}
                  placeholder="Espada larga, Mordisco, Golpetazo…"
                  data-testid={`${idPrefix}-arma-name-${idx}`}
                />
              </Labeled>
              <Labeled label="Daño" hint="dado + tipo">
                <Input
                  value={a.dano || ''}
                  onChange={(e) => updateArrayItem('armas', idx, { dano: e.target.value })}
                  placeholder="1d8 + 3 cortante"
                  data-testid={`${idPrefix}-arma-dano-${idx}`}
                />
              </Labeled>
              <Labeled label="Alcance" hint="metros o pies">
                <div className="flex gap-1">
                  <Input
                    value={a.alcance || ''}
                    onChange={(e) => updateArrayItem('armas', idx, { alcance: e.target.value })}
                    placeholder='5 pies (1,5 m)'
                    data-testid={`${idPrefix}-arma-alcance-${idx}`}
                  />
                  <button
                    onClick={() => removeArrayItem('armas', idx)}
                    className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700 shrink-0"
                    data-testid={`${idPrefix}-arma-remove-${idx}`}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Labeled>
            </div>
            <div className="mt-2">
              <Labeled
                label="Característica especial / efecto adicional"
                hint="visible para el DJ durante el combate"
              >
                <TextArea
                  value={a.special_text || ''}
                  onChange={(e) => updateArrayItem('armas', idx, { special_text: e.target.value })}
                  placeholder='p. ej. "Si el objetivo es Mediano o de menor tamaño, queda agarrado (escapar CD 13)…"'
                  rows={2}
                  data-testid={`${idPrefix}-arma-special-${idx}`}
                />
              </Labeled>
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
              special_text: '',
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

      <Section title="Reacciones" hint="opcional — respuestas en turno de otro">
        {(v.reacciones || []).map((r, idx) => (
          <div
            key={idx}
            className="flex gap-2 items-start mb-2 p-2 rounded border border-amber-800/30 bg-black/40"
          >
            <div className="flex-1 space-y-1">
              <Labeled label="Nombre">
                <Input
                  value={r.nombre || ''}
                  onChange={(e) => updateArrayItem('reacciones', idx, { nombre: e.target.value })}
                  placeholder="p. ej. Parada"
                  data-testid={`${idPrefix}-reaccion-name-${idx}`}
                />
              </Labeled>
              <Labeled label="Descripción">
                <TextArea
                  value={r.descripcion || ''}
                  onChange={(e) => updateArrayItem('reacciones', idx, { descripcion: e.target.value })}
                  placeholder="Cuando ocurre X, puede…"
                  rows={2}
                  data-testid={`${idPrefix}-reaccion-desc-${idx}`}
                />
              </Labeled>
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
