/**
 * IdiomasSection — catálogo editable de idiomas. Fuente de verdad para
 * los selectores de idiomas en culturas, PNJs, etc.
 *
 * Visible en Reglas → Reglas Varias (todas las cuentas). Edición sólo
 * Maestro/DJ; borrado sólo Maestro.
 *
 * Endpoints: routes/languages_routes.py
 */
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Languages as LanguagesIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  getLanguages,
  createLanguage,
  updateLanguage,
  deleteLanguage,
} from '@/services/api';

const FAMILIA_COLORS = {
  Humanos: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Élficos: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Enanos: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  Hobbits: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  Antiguos: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  Oscuros: 'bg-red-500/10 text-red-300 border-red-500/30',
};

const empty = () => ({ id: null, nombre: '', familia: '', descripcion: '' });

const IdiomasSection = ({ currentRole }) => {
  const isStaff = currentRole === 'maestro' || currentRole === 'director_de_juego';
  const isMaestro = currentRole === 'maestro';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getLanguages();
      setItems(data);
    } catch (e) {
      console.error('Failed to load languages', e);
      toast.error('No se pudieron cargar los idiomas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const grouped = items.reduce((acc, lang) => {
    const fam = lang.familia || 'Otros';
    if (!acc[fam]) acc[fam] = [];
    acc[fam].push(lang);
    return acc;
  }, {});
  const familyOrder = ['Humanos', 'Élficos', 'Enanos', 'Hobbits', 'Antiguos', 'Oscuros', 'Otros'];

  const handleSave = async () => {
    if (!editing.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await updateLanguage(editing.id, {
          nombre: editing.nombre.trim(),
          familia: editing.familia || '',
          descripcion: editing.descripcion || '',
        });
        toast.success('Idioma actualizado');
      } else {
        await createLanguage({
          nombre: editing.nombre.trim(),
          familia: editing.familia || '',
          descripcion: editing.descripcion || '',
        });
        toast.success('Idioma creado');
      }
      setEditing(null);
      await reload();
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Error al guardar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteLanguage(confirmDel.id);
      toast.success(`"${confirmDel.nombre}" eliminado`);
      setConfirmDel(null);
      await reload();
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Error al eliminar';
      toast.error(msg);
    }
  };

  return (
    <div className="card-parchment rounded-lg p-4" data-testid="idiomas-section">
      <div className="flex items-center justify-between mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <LanguagesIcon className="w-5 h-5" />
          IDIOMAS DE LA TIERRA MEDIA
        </h3>
        {isStaff && (
          <Button
            size="sm"
            onClick={() => setEditing(empty())}
            data-testid="new-language-btn"
            className="bg-[hsl(var(--gold))/20] hover:bg-[hsl(var(--gold))/30]"
          >
            <Plus className="w-4 h-4 mr-1" /> Nuevo idioma
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4 italic">
        Tabla maestra de idiomas. Es la fuente de verdad para los selectores
        de idiomas en culturas, PNJs y personajes.
      </p>

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No hay idiomas registrados. {isStaff && 'Pulsa "Nuevo idioma" para añadir.'}
        </p>
      ) : (
        <div className="space-y-4">
          {familyOrder.filter(f => grouped[f]).map((fam) => (
            <div key={fam} data-testid={`language-family-${fam}`}>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                {fam}
              </p>
              <div className="grid md:grid-cols-2 gap-2">
                {grouped[fam].map((lang) => (
                  <div
                    key={lang.id}
                    className={`flex items-start justify-between gap-2 p-2 rounded border ${FAMILIA_COLORS[fam] || 'border-border/30 bg-black/10'}`}
                    data-testid={`language-row-${lang.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{lang.nombre}</p>
                      {lang.descripcion && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {lang.descripcion}
                        </p>
                      )}
                    </div>
                    {isStaff && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditing({ ...lang })}
                          data-testid={`edit-language-${lang.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {isMaestro && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDel(lang)}
                            data-testid={`delete-language-${lang.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing?.id ? 'Editar idioma' : 'Nuevo idioma'}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={editing.nombre}
                  onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                  placeholder="p. ej. Sindarin"
                  data-testid="language-name-input"
                />
              </div>
              <div>
                <Label className="text-xs">Familia</Label>
                <select
                  value={editing.familia || ''}
                  onChange={(e) => setEditing({ ...editing, familia: e.target.value })}
                  className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
                  data-testid="language-family-select"
                >
                  <option value="">— Sin familia —</option>
                  <option value="Humanos">Humanos</option>
                  <option value="Élficos">Élficos</option>
                  <option value="Enanos">Enanos</option>
                  <option value="Hobbits">Hobbits</option>
                  <option value="Antiguos">Antiguos</option>
                  <option value="Oscuros">Oscuros</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Descripción</Label>
                <textarea
                  value={editing.descripcion || ''}
                  onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded border border-input bg-background text-sm resize-none"
                  placeholder="Notas sobre el idioma…"
                  data-testid="language-desc-input"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-language-btn">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(open) => !open && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar idioma?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{confirmDel?.nombre}</strong>. Esta acción
              no se puede deshacer. Los personajes que lo tengan asignado
              conservarán el texto pero no podrá seleccionarse de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="confirm-delete-language"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IdiomasSection;
