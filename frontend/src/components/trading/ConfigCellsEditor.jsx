/**
 * ConfigCellsEditor — Editor genérico de configuración en CELDAS etiquetadas.
 *
 * Convierte un objeto de configuración (con la forma { clave: {campos…} } o
 * { clave: valor }) en un formulario ordenado con celdas fácilmente editables,
 * en lugar de mostrar JSON crudo. Pensado para las secciones de la pestaña
 * Configuración del sistema de comercio (umbrales, contextos, perfiles, etc.).
 */
import { useState, useEffect } from 'react';

const humanize = (k) =>
  String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Celda numérica con estado local para permitir teclear negativos y decimales.
const NumberCell = ({ value, onChange, disabled }) => {
  const [raw, setRaw] = useState(String(value ?? 0));
  useEffect(() => { setRaw(String(value ?? 0)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (/^-?\d*\.?\d*$/.test(v) || v === '' || v === '-') {
          setRaw(v);
          const n = parseFloat(v);
          if (!Number.isNaN(n)) onChange(n);
          else if (v === '' || v === '-') onChange(0);
        }
      }}
      className={`w-full bg-black/40 border border-border rounded px-2 py-1.5 text-sm text-center font-mono ${disabled ? 'opacity-60' : 'focus:border-[hsl(var(--gold))]'}`}
    />
  );
};

const TextCell = ({ value, onChange, disabled, long }) =>
  long ? (
    <textarea
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-black/40 border border-border rounded px-2 py-1.5 text-sm h-16 ${disabled ? 'opacity-60' : 'focus:border-[hsl(var(--gold))]'}`}
    />
  ) : (
    <input
      type="text"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-black/40 border border-border rounded px-2 py-1.5 text-sm ${disabled ? 'opacity-60' : 'focus:border-[hsl(var(--gold))]'}`}
    />
  );

const BoolCell = ({ value, onChange, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!value)}
    className={`px-3 py-1 rounded text-xs border ${value ? 'bg-green-900/40 border-green-600 text-green-400' : 'bg-black/40 border-border text-muted-foreground'}`}
  >
    {value ? 'Sí' : 'No'}
  </button>
);

const Field = ({ label, value, onChange, disabled }) => {
  const type = typeof value;
  const isLong = type === 'string' && (label.toLowerCase().includes('descrip') || (value || '').length > 40);
  return (
    <div className={isLong ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {type === 'number' && <NumberCell value={value} onChange={onChange} disabled={disabled} />}
      {type === 'boolean' && <BoolCell value={value} onChange={onChange} disabled={disabled} />}
      {type === 'string' && <TextCell value={value} onChange={onChange} disabled={disabled} long={isLong} />}
    </div>
  );
};

// Tarjeta para un sub-objeto de primitivos (p. ej. perfil "codicioso").
const GroupCard = ({ groupKey, obj, onChange, disabled }) => {
  const title = obj.nombre || humanize(groupKey);
  const keys = Object.keys(obj);
  return (
    <div className="bg-black/20 rounded-lg border border-border/30 p-3">
      <div className="text-sm font-medium text-[hsl(var(--gold))] mb-2">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {keys.map((sk) => (
          <Field
            key={sk}
            label={humanize(sk)}
            value={obj[sk]}
            disabled={disabled}
            onChange={(v) => onChange({ ...obj, [sk]: v })}
          />
        ))}
      </div>
    </div>
  );
};

const ConfigCellsEditor = ({ data, onChange, disabled }) => {
  if (!data || typeof data !== 'object') {
    return <p className="text-xs text-muted-foreground">Sin datos de configuración.</p>;
  }
  const keys = Object.keys(data);

  // Caso plano: { clave: número/cadena } → rejilla de celdas.
  const allPrimitive = keys.every((k) => typeof data[k] !== 'object' || data[k] === null);
  if (allPrimitive) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {keys.map((k) => (
          <Field
            key={k}
            label={humanize(k)}
            value={data[k]}
            disabled={disabled}
            onChange={(v) => onChange({ ...data, [k]: v })}
          />
        ))}
      </div>
    );
  }

  // Caso anidado: { clave: {campos…} } → una tarjeta por grupo.
  return (
    <div className="space-y-3">
      {keys.map((k) =>
        data[k] && typeof data[k] === 'object' ? (
          <GroupCard
            key={k}
            groupKey={k}
            obj={data[k]}
            disabled={disabled}
            onChange={(newObj) => onChange({ ...data, [k]: newObj })}
          />
        ) : (
          <Field
            key={k}
            label={humanize(k)}
            value={data[k]}
            disabled={disabled}
            onChange={(v) => onChange({ ...data, [k]: v })}
          />
        )
      )}
    </div>
  );
};

export default ConfigCellsEditor;
