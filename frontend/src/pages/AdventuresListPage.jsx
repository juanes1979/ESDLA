/**
 * Adventures List Page — Fase 1 del Sistema de Aventuras & Campañas.
 *
 * Tabs:
 *   - "Mis Aventuras" (todas las que creó el usuario, públicas o privadas)
 *   - "Públicas"      (públicas creadas por OTROS DJs — clonables)
 *
 * Acciones:
 *   - Nueva aventura  → POST mínimo + redirige al wizard
 *   - Editar          → /aventuras/:id
 *   - Clonar          → POST /clone → toast + recarga
 *   - Eliminar        → DELETE con confirm
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, Pencil, Trash2, Globe2, Lock, Loader2, Compass } from 'lucide-react';
import { toast } from 'sonner';
import {
  listAdventures,
  createAdventure,
  cloneAdventure,
  deleteAdventure,
} from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
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

const AdventureCard = ({ adv, isMine, onEdit, onClone, onDelete }) => (
  <div
    className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-5 hover:border-amber-500/60 transition-colors"
    data-testid={`adventure-card-${adv.id}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {adv.is_public ? (
            <Globe2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-300/80 shrink-0" />
          )}
          <h3 className="font-heading text-lg text-amber-200 truncate" title={adv.name}>
            {adv.name}
          </h3>
        </div>
        <p className="text-xs text-amber-300/60 mb-2">
          DJ: {adv.creator_name || '—'} · Jugadores máx.: {adv.max_players}
          {adv.recommended_level_min || adv.recommended_level_max ? (
            <> · Nivel {adv.recommended_level_min ?? '?'}–{adv.recommended_level_max ?? '?'}</>
          ) : null}
        </p>
        {adv.description ? (
          <p className="text-sm text-gray-300/90 line-clamp-3">{adv.description}</p>
        ) : (
          <p className="text-sm italic text-gray-500">(sin descripción)</p>
        )}
      </div>
    </div>

    <div className="flex flex-wrap gap-2 mt-4">
      {isMine ? (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(adv)}
            data-testid={`edit-adventure-${adv.id}`}
            className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onClone(adv)}
            data-testid={`clone-adventure-${adv.id}`}
            className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/30"
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Clonar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(adv)}
            data-testid={`delete-adventure-${adv.id}`}
            className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onClone(adv)}
          data-testid={`clone-adventure-${adv.id}`}
          className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/30"
        >
          <Copy className="w-3.5 h-3.5 mr-1" /> Clonar para editar
        </Button>
      )}
    </div>
  </div>
);

const AdventuresListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('mine'); // 'mine' | 'public'
  const [adventures, setAdventures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const isStaff = user?.role === 'maestro' || user?.role === 'director_de_juego';

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listAdventures(tab === 'public' ? 'public' : 'mine');
      setAdventures(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error cargando aventuras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const list = useMemo(() => {
    if (tab === 'public') {
      // exclude my own public ones in the public tab — they already show in "Mine"
      return adventures.filter((a) => a.creator_dm_id !== user?.id);
    }
    return adventures;
  }, [adventures, tab, user]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const adv = await createAdventure({
        name: 'Nueva aventura',
        max_players: 4,
        is_public: false,
      });
      toast.success('Aventura creada');
      navigate(`/aventuras/${adv.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo crear la aventura');
    } finally {
      setCreating(false);
    }
  };

  const handleClone = async (adv) => {
    try {
      const newAdv = await cloneAdventure(adv.id);
      toast.success(`Clonada como "${newAdv.name}"`);
      setTab('mine');
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo clonar');
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteAdventure(toDelete.id);
      toast.success('Aventura eliminada');
      setToDelete(null);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo eliminar');
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      data-testid="adventures-list-page"
      style={{
        backgroundImage:
          'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              data-testid="back-to-home-btn"
              className="text-amber-200 hover:bg-amber-900/30"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Inicio
            </Button>
            <h1 className="font-heading text-3xl sm:text-4xl text-amber-300 drop-shadow-lg">
              Aventuras
            </h1>
          </div>
          {isStaff && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => navigate('/campanas')}
                variant="outline"
                data-testid="goto-campaigns-btn"
                className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
              >
                <Compass className="w-4 h-4 mr-2" /> Mis Campañas
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                data-testid="new-adventure-btn"
                className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Nueva aventura
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-amber-700/30">
          <button
            onClick={() => setTab('mine')}
            data-testid="tab-mine"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'mine'
                ? 'text-amber-300 border-b-2 border-amber-500'
                : 'text-amber-300/50 hover:text-amber-200'
            }`}
          >
            Mis Aventuras
          </button>
          <button
            onClick={() => setTab('public')}
            data-testid="tab-public"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'public'
                ? 'text-amber-300 border-b-2 border-amber-500'
                : 'text-amber-300/50 hover:text-amber-200'
            }`}
          >
            Públicas
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-amber-300/70">
            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-3" />
            Cargando aventuras…
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-amber-300/60" data-testid="empty-state">
            {tab === 'mine' ? (
              <>
                <p className="text-lg mb-2">Aún no has creado ninguna aventura.</p>
                {isStaff && (
                  <p className="text-sm">
                    Pulsa <span className="text-amber-300">"Nueva aventura"</span> para empezar.
                  </p>
                )}
              </>
            ) : (
              <p className="text-lg">No hay aventuras públicas todavía.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((adv) => (
              <AdventureCard
                key={adv.id}
                adv={adv}
                isMine={adv.creator_dm_id === user?.id || user?.role === 'maestro'}
                onEdit={(a) => navigate(`/aventuras/${a.id}`)}
                onClone={handleClone}
                onDelete={setToDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar aventura</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar <strong>{toDelete?.name}</strong>? Esta acción
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-adventure"
              onClick={handleConfirmDelete}
              className="bg-rose-700 hover:bg-rose-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdventuresListPage;
