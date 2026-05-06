/**
 * Campaigns List Page — gestiona campañas activas (instancias) del DJ.
 * Filtros por estado: draft / active / paused / finished.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Play, Pause, Flag, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  listCampaignRuns,
  activateCampaignRun,
  pauseCampaignRun,
  finishCampaignRun,
  deleteCampaignRun,
} from '@/services/api';
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

const STATUS_META = {
  draft: { label: 'Borrador', color: 'bg-stone-700 text-stone-200' },
  active: { label: 'Activa', color: 'bg-emerald-700/80 text-emerald-100' },
  paused: { label: 'En pausa', color: 'bg-amber-700/80 text-amber-100' },
  finished: { label: 'Finalizada', color: 'bg-rose-900/70 text-rose-200' },
};

const RunCard = ({ run, onAction, onDelete, onOpen }) => {
  const meta = STATUS_META[run.status] || STATUS_META.draft;
  return (
    <div
      className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-5"
      data-testid={`campaign-card-${run.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-lg text-amber-200 truncate">
            {run.adventure_name || '(sin nombre)'}
          </h3>
          <p className="text-xs text-amber-300/60">
            DJ: {run.dm_name} · Jugadores máx.: {run.max_players}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
      </div>

      <div className="font-mono text-sm tracking-widest text-amber-300 mb-3 select-all">
        {run.campaign_code}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpen(run)}
          data-testid={`open-campaign-${run.id}`}
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Panel
        </Button>
        {run.status === 'draft' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(run, 'activate')}
            data-testid={`activate-${run.id}`}
            className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/30"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Activar
          </Button>
        )}
        {run.status === 'active' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(run, 'pause')}
            data-testid={`pause-${run.id}`}
            className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          >
            <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
          </Button>
        )}
        {run.status === 'paused' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(run, 'activate')}
            data-testid={`resume-${run.id}`}
            className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/30"
          >
            <Play className="w-3.5 h-3.5 mr-1" /> Reanudar
          </Button>
        )}
        {run.status !== 'finished' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(run, 'finish')}
            data-testid={`finish-${run.id}`}
            className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30"
          >
            <Flag className="w-3.5 h-3.5 mr-1" /> Finalizar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(run)}
          data-testid={`delete-${run.id}`}
          className="border-rose-700/50 text-rose-300 hover:bg-rose-900/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

const CampaignsListPage = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [filter, setFilter] = useState('all'); // all|draft|active|paused|finished
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listCampaignRuns(
        'mine',
        filter === 'all' ? null : filter,
      );
      setRuns(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error cargando campañas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleAction = async (run, action) => {
    try {
      const fn = {
        activate: activateCampaignRun,
        pause: pauseCampaignRun,
        finish: finishCampaignRun,
      }[action];
      await fn(run.id);
      toast.success(`Campaña ${action === 'activate' ? 'activada' : action === 'pause' ? 'pausada' : 'finalizada'}`);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteCampaignRun(toDelete.id);
      toast.success('Campaña eliminada');
      setToDelete(null);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      data-testid="campaigns-list-page"
      style={{
        backgroundImage:
          'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/75" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-amber-200 hover:bg-amber-900/30"
              data-testid="back-home-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Inicio
            </Button>
            <h1 className="font-heading text-3xl sm:text-4xl text-amber-300 drop-shadow-lg">
              Campañas Activas
            </h1>
          </div>
          <Button
            onClick={() => navigate('/aventuras')}
            variant="outline"
            className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
            data-testid="back-to-adventures-btn"
          >
            ← Aventuras
          </Button>
        </div>

        <div className="flex flex-wrap gap-1 mb-5">
          {[
            ['all', 'Todas'],
            ['draft', 'Borrador'],
            ['active', 'Activas'],
            ['paused', 'En pausa'],
            ['finished', 'Finalizadas'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-testid={`filter-${k}`}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === k
                  ? 'bg-amber-700 text-amber-50'
                  : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-amber-300/70">
            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-3" />
            Cargando…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-16 text-amber-300/60" data-testid="empty-runs">
            <p className="text-lg mb-2">No tienes campañas {filter !== 'all' ? `con estado "${filter}"` : ''}.</p>
            <p className="text-sm">
              Crea una desde el wizard de una aventura — botón{' '}
              <span className="text-amber-300">"Generar Campaña"</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {runs.map((r) => (
              <RunCard
                key={r.id}
                run={r}
                onAction={handleAction}
                onDelete={setToDelete}
                onOpen={(run) => navigate(`/campanas/${run.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar campaña</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminarás la campaña <strong>{toDelete?.adventure_name}</strong> con código{' '}
              <code>{toDelete?.campaign_code}</code> y todo su contenido (PNJs, entornos,
              mapas, log). La aventura original NO se verá afectada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-campaign"
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

export default CampaignsListPage;
