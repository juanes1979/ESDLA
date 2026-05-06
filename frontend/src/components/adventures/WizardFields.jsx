/**
 * Reusable wizard primitives — used in AdventureWizardPage.
 *
 * Two helpers:
 *   - <Field>     a labeled input (text / number / textarea / select)
 *   - <StepCard>  a section panel with title, optional helper text and footer
 */
import { Loader2 } from 'lucide-react';

export const Field = ({
  label,
  hint,
  children,
  required = false,
  testid,
}) => (
  <label className="block mb-4" data-testid={testid ? `field-${testid}` : undefined}>
    <div className="text-sm font-medium text-amber-200/90 mb-1">
      {label}
      {required && <span className="text-rose-400 ml-1">*</span>}
    </div>
    {children}
    {hint && <p className="text-xs text-amber-300/50 mt-1">{hint}</p>}
  </label>
);

export const TextInput = ({ value, onChange, placeholder, type = 'text', testid, ...rest }) => (
  <input
    type={type}
    value={value ?? ''}
    onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
    placeholder={placeholder}
    data-testid={testid}
    className="w-full px-3 py-2 rounded-md bg-black/50 border border-amber-700/40 text-amber-100 placeholder-amber-300/30 focus:outline-none focus:border-amber-500"
    {...rest}
  />
);

export const TextArea = ({ value, onChange, placeholder, rows = 4, testid, ...rest }) => (
  <textarea
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    data-testid={testid}
    className="w-full px-3 py-2 rounded-md bg-black/50 border border-amber-700/40 text-amber-100 placeholder-amber-300/30 focus:outline-none focus:border-amber-500 resize-y"
    {...rest}
  />
);

export const Select = ({ value, onChange, options, testid, placeholder = 'Selecciona…' }) => (
  <select
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value || null)}
    data-testid={testid}
    className="w-full px-3 py-2 rounded-md bg-black/50 border border-amber-700/40 text-amber-100 focus:outline-none focus:border-amber-500"
  >
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

export const StepCard = ({ title, description, children, footer, saving = false }) => (
  <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6 mb-4">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h2 className="font-heading text-2xl text-amber-300">{title}</h2>
        {description && <p className="text-sm text-amber-300/60 mt-1">{description}</p>}
      </div>
      {saving && (
        <div className="text-xs text-amber-300/60 flex items-center gap-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…
        </div>
      )}
    </div>
    {children}
    {footer && <div className="mt-5 pt-4 border-t border-amber-800/30">{footer}</div>}
  </div>
);
