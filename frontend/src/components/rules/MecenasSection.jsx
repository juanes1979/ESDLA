/**
 * MecenasSection — catálogo editable de mecenas (patrons).
 *
 * Lista los mecenas, permite editar campos narrativos + bloque de juego
 * (community_bonus_static, ability, meeting_bonus, restricción) y crear
 * nuevos. Sólo Maestro o DJ. Sólo el Maestro puede eliminar.
 *
 * Modelo de datos: `routes/patrons_routes.py`.
 */
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Crown, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getPatrons, createPatron, updatePatron, deletePatron } from '@/services/api';

const ABILITY_TRIGGERS = [
  { v: '', label: '— Ninguno —' },
  { v: 'after_attack_roll_before_resolution', label: 'Tras tirada de ataque (antes de resolver)' },
  { v: 'after_saving_throw_before_resolution', label: 'Tras tirada de salvación' },
  { v: 'after_attribute_test_before_resolution', label: 'Tras prueba de atributo' },
  { v: 'journey_start', label: 'Al iniciar viaje' },
  { v: 'on_demand_within_patron_domain', label: 'A demanda (dentro del dominio)' },
];

const ABILITY_EFFECTS = [
  { v: '', label: '— Ninguno —' },
  { v: 'extra_d20_choose_one', label: 'Tirar d20 adicional, elegir uno' },
  { v: 'travel_event_alt_d20_loremaster_choice', label: 'D20 alternativo en evento de viaje (DJ elige)' },
  { v: 'request_intervention', label: 'Pedir intervención narrativa' },
];

const MEETING_BONUS_TYPES = [
  { v: '', label: '— Ninguno —' },
  { v: 'temp_community_score', label: 'Puntuación de comunidad temporal' },
  { v: 'grant_rumor', label: 'Otorga rumor' },
];

const labelFor = (opts, value) =>
  (opts.find((o) => o.v === value) || {}).label || value || '—';

const empty = () => ({
  slug: '',
  display_name: '',
  entity_type: '',
  occupation: '',
  distinctive_traits: [],
  languages: [],
  where_to_find_text: '',
  patron_role_text: '',
  community_bonus_static: 0,
  ability: { name: '', cost_type: 'community_points', cost_value: '', trigger: '', effect: '', restriction: '' },
  meeting_bonus: { type: '', value: '', duration: '' },
  is_complete_ruleset: false,
  source_reference: '',
});

const PatronEditor = ({ open, onClose, initial, onSaved }) => {
  const [draft, setDraft] = useState(empty());
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (initial) {
      setDraft({
        ...empty(),
        ...initial,
        ability: { ...empty().ability, ...(initial.ability || {}) },
        meeting_bonus: { ...empty().meeting_bonus, ...(initial.meeting_bonus || {}) },
      });
    } else {
      setDraft(empty());
    }
  }, [initial, open]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setAbility = (k, v) =>
    setDraft((d) => ({ ...d, ability: { ...d.ability, [k]: v } }));
  const setMeeting = (k, v) =>
    setDraft((d) => ({ ...d, meeting_bonus: { ...d.meeting_bonus, [k]: v } }));

  const save = async () => {
    if (!draft.display_name?.trim() && !draft.nombre?.trim()) {
      toast.error('Nombre obligatorio');
      return;
    }
    setSaving(true);
    try {
      // Strip empty sub-objects
      const payload = { ...draft };
      if (!payload.ability?.name && !payload.ability?.trigger && !payload.ability?.effect) {
        payload.ability = null;
      }
      if (!payload.meeting_bonus?.type) {
        payload.meeting_bonus = null;
      }
      let saved;
      if (isEdit) {
        saved = await updatePatron(initial.id, payload);
      } else {
        saved = await createPatron(payload);
      }
      toast.success(isEdit ? 'Mecenas actualizado' : 'Mecenas creado');
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[88vh] overflow-y-auto bg-black/95 border-amber-700/50"
        data-testid="mecenas-editor-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-amber-300 font-heading text-2xl">
            {isEdit ? `Editar mecenas: ${initial.display_name || initial.nombre}` : 'Nuevo mecenas'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={draft.display_name || ''}
              onChange={(e) => set('display_name', e.target.value)}
              placeholder="Nombre visible (display_name)"
              data-testid="mec-input-name"
            />
            <Input
              value={draft.slug || ''}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="Slug (auto si vacío)"
              data-testid="mec-input-slug"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={draft.entity_type || ''}
              onChange={(e) => set('entity_type', e.target.value)}
              placeholder="Tipo (p. ej. Humanoide Mediano (enano))"
              data-testid="mec-input-entity"
            />
            <Input
              value={draft.occupation || ''}
              onChange={(e) => set('occupation', e.target.value)}
              placeholder="Ocupación"
              data-testid="mec-input-occupation"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={(draft.distinctive_traits || []).join(', ')}
              onChange={(e) =>
                set(
                  'distinctive_traits',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
              placeholder="Rasgos distintivos (coma)"
              data-testid="mec-input-traits"
            />
            <Input
              value={(draft.languages || []).join(', ')}
              onChange={(e) =>
                set(
                  'languages',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
              placeholder="Idiomas (coma)"
              data-testid="mec-input-langs"
            />
          </div>
          <textarea
            value={draft.where_to_find_text || ''}
            onChange={(e) => set('where_to_find_text', e.target.value)}
            placeholder="Dónde encontrarlo"
            rows={2}
            data-testid="mec-textarea-where"
            className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm resize-y"
          />
          <textarea
            value={draft.patron_role_text || ''}
            onChange={(e) => set('patron_role_text', e.target.value)}
            placeholder="Rol como mecenas"
            rows={3}
            data-testid="mec-textarea-role"
            className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm resize-y"
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-amber-300/70">
              Bonus comunidad estático
              <Input
                type="number"
                value={draft.community_bonus_static ?? 0}
                onChange={(e) => set('community_bonus_static', Number(e.target.value))}
                data-testid="mec-input-bonus"
              />
            </label>
            <label className="text-xs text-amber-300/70">
              Referencia de fuente
              <Input
                value={draft.source_reference || ''}
                onChange={(e) => set('source_reference', e.target.value)}
                data-testid="mec-input-source"
              />
            </label>
          </div>

          <div className="rounded border border-amber-800/40 p-2">
            <div className="text-amber-300 font-medium mb-2">Habilidad activable</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={draft.ability?.name || ''}
                onChange={(e) => setAbility('name', e.target.value)}
                placeholder="Nombre de la habilidad"
                data-testid="mec-ab-name"
              />
              <Input
                value={draft.ability?.cost_value || ''}
                onChange={(e) => setAbility('cost_value', e.target.value)}
                placeholder='Coste (p. ej. "1" o "all_remaining")'
                data-testid="mec-ab-cost"
              />
              <select
                value={draft.ability?.trigger || ''}
                onChange={(e) => setAbility('trigger', e.target.value)}
                data-testid="mec-ab-trigger"
                className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm"
              >
                {ABILITY_TRIGGERS.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
              <select
                value={draft.ability?.effect || ''}
                onChange={(e) => setAbility('effect', e.target.value)}
                data-testid="mec-ab-effect"
                className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm"
              >
                {ABILITY_EFFECTS.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
            </div>
            <Input
              value={draft.ability?.restriction || ''}
              onChange={(e) => setAbility('restriction', e.target.value)}
              placeholder="Restricción (p. ej. former_arnor, tom_country)"
              data-testid="mec-ab-restriction"
              className="mt-2"
            />
          </div>

          <div className="rounded border border-amber-800/40 p-2">
            <div className="text-amber-300 font-medium mb-2">Bonus al ser elegido principal</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={draft.meeting_bonus?.type || ''}
                onChange={(e) => setMeeting('type', e.target.value)}
                data-testid="mec-mb-type"
                className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm"
              >
                {MEETING_BONUS_TYPES.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
              <Input
                value={draft.meeting_bonus?.value || ''}
                onChange={(e) => setMeeting('value', e.target.value)}
                placeholder="Valor"
                data-testid="mec-mb-value"
              />
              <Input
                value={draft.meeting_bonus?.duration || ''}
                onChange={(e) => setMeeting('duration', e.target.value)}
                placeholder="Duración"
                data-testid="mec-mb-duration"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            data-testid="mec-cancel-btn"
          >
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-amber-700 hover:bg-amber-600 text-black"
            data-testid="mec-save-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MecenasSection = ({ isAdmin, currentRole }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getPatrons();
      setList(data);
    } catch {
      toast.error('No se pudieron cargar los mecenas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const canEdit = isAdmin || currentRole === 'director_de_juego' || currentRole === 'maestro';
  const canDelete = currentRole === 'maestro';

  const onSaved = (saved) => {
    setList((curr) => {
      const idx = curr.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...curr, saved];
      const next = [...curr];
      next[idx] = saved;
      return next;
    });
  };

  const onDelete = async () => {
    if (!toDelete) return;
    try {
      await deletePatron(toDelete.id);
      toast.success('Mecenas eliminado');
      setList((c) => c.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-amber-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando mecenas…
      </div>
    );
  }

  return (
    <div data-testid="mecenas-section">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Catálogo de mecenas. Cada mecenas afecta a la <strong>puntuación de Comunidad</strong> y
          puede activar habilidades a coste de <strong>puntos de Comunidad</strong>. Al elegir un
          mecenas en una aventura, se enlazará automáticamente a los personajes aceptados como
          relación de mecenazgo.
        </p>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-amber-700 hover:bg-amber-600 text-black"
            data-testid="mec-new-btn"
          >
            <Plus className="w-4 h-4 mr-1" /> Nuevo mecenas
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {list.map((p) => {
          const name = p.display_name || p.nombre;
          return (
            <div
              key={p.id}
              className="rounded-lg border border-amber-700/40 bg-black/60 p-4 hover:border-amber-500/60 transition-colors"
              data-testid={`mec-card-${p.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <h4 className="font-heading text-amber-200 text-lg truncate">{name}</h4>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-200">
                      +{p.community_bonus_static ?? p.puntos_comunidad ?? 0}
                    </span>
                  </div>
                  {p.entity_type && (
                    <p className="text-xs text-amber-300/60">{p.entity_type}</p>
                  )}
                  {p.occupation && (
                    <p className="text-xs text-amber-300/50 italic">{p.occupation}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {canEdit && (
                    <button
                      onClick={() => setEditing(p)}
                      className="p-1.5 rounded hover:bg-amber-900/30 text-amber-300"
                      data-testid={`mec-edit-${p.id}`}
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setToDelete(p)}
                      className="p-1.5 rounded hover:bg-rose-900/30 text-rose-300"
                      data-testid={`mec-del-${p.id}`}
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {p.where_to_find_text && (
                <p className="text-xs text-gray-300/80 mt-2">
                  <span className="text-amber-300/70">Dónde:</span> {p.where_to_find_text}
                </p>
              )}
              {p.patron_role_text && (
                <p className="text-xs text-gray-300/80 mt-1">
                  <span className="text-amber-300/70">Como mecenas:</span>{' '}
                  {p.patron_role_text}
                </p>
              )}

              {p.ability?.name && (
                <div className="mt-2 p-2 rounded bg-amber-900/15 border border-amber-800/30 text-xs">
                  <div className="text-amber-200 font-medium">⚡ {p.ability.name}</div>
                  <div className="text-amber-300/70">
                    Coste: {p.ability.cost_value || '?'} pto(s)
                    {' · '}
                    Trigger: {labelFor(ABILITY_TRIGGERS, p.ability.trigger)}
                    {' · '}
                    Efecto: {labelFor(ABILITY_EFFECTS, p.ability.effect)}
                    {p.ability.restriction && (
                      <span className="text-rose-300"> · Restricción: {p.ability.restriction}</span>
                    )}
                  </div>
                </div>
              )}

              {p.meeting_bonus?.type && (
                <div className="mt-2 text-xs text-emerald-300/80">
                  ✦ Al elegirlo principal: {labelFor(MEETING_BONUS_TYPES, p.meeting_bonus.type)}
                  {p.meeting_bonus.value && ` (${p.meeting_bonus.value})`}
                  {p.meeting_bonus.duration && ` · ${p.meeting_bonus.duration}`}
                </div>
              )}

              {p.ventaja_adicional && !p.ability?.name && (
                <p className="mt-2 text-xs text-amber-200/80 italic">
                  {p.ventaja_adicional}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <PatronEditor
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSaved={onSaved}
      />
      <PatronEditor
        open={creating}
        onClose={() => setCreating(false)}
        initial={null}
        onSaved={onSaved}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-black/95 border-rose-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mecenas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará a "{toDelete?.display_name || toDelete?.nombre}". Las relaciones
              existentes mecenas↔PJ no se borran automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-rose-600 hover:bg-rose-500 text-white"
              data-testid="mec-confirm-delete-btn"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MecenasSection;
