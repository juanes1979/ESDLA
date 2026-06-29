/**
 * MyCampaignsPage — vista del JUGADOR sobre las campañas en las que
 * participa (cualquier estado). Muestra una tarjeta por entrada de
 * `campaign_players`, con el estado de cada solicitud y permite abandonar
 * voluntariamente las que están aceptadas o pendientes.
 *
 * Botón "Unirme a una campaña" abre <JoinCampaignDialog>.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, LogOut, ScrollText, Eye, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { myCampaigns, leaveCampaign, getRevealedTexts } from '@/services/api';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import JoinCampaignDialog from '@/components/adventures/JoinCampaignDialog';

const STATUS_BADGE = {
  pending: 'bg-amber-700/70 text-amber-100',
  accepted: 'bg-emerald-700/70 text-emerald-100',
  rejected: 'bg-rose-900/70 text-rose-200',
  expelled: 'bg-rose-900/70 text-rose-200',
  abandon: 'bg-stone-700/70 text-stone-200',
  finished: 'bg-stone-700/70 text-stone-200',
};

const RUN_STATUS_LABEL = {
  draft: 'Borrador',
  active: 'Activa',
  paused: 'En pausa',
  finished: 'Finalizada',
};

const Card = ({ row, onLeave, onShowRevealed, onEnterScreen }) => (
  <div
    className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-5"
    data-testid={`my-campaign-${row.id}`}
  >
    <div className="flex items-start justify-between gap-3 mb-2">
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-lg text-amber-200 truncate">
          {row.run.adventure_name || '—'}
        </h3>
        <p className="text-xs text-amber-300/60">
          DJ: {row.run.dm_name || '—'} · Campaña: {RUN_STATUS_LABEL[row.run.status] || row.run.status}
        </p>
        <p className="text-xs text-amber-300/60">
          Personaje: <span className="text-amber-200">{row.character_name}</span>
          {row.character_level && <> · nivel {row.character_level}</>}
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${STATUS_BADGE[row.status]}`}>
        {row.status}
      </span>
    </div>

    {row.run.year && (
      <p className="text-xs text-amber-300/50 mb-2">
        {row.run.year} T.E.{row.run.season ? ` · ${row.run.season}` : ''}
        {row.run.location_name && ` · ${row.run.location_name}`}
      </p>
    )}

    <div className="flex flex-wrap gap-2">
      {row.status === 'accepted' && (row.run.status === 'active' || row.run.status === 'paused') && (
        <Button
          size="sm"
          onClick={() => onEnterScreen(row)}
          data-testid={`enter-screen-${row.id}`}
          className="bg-amber-700 hover:bg-amber-600 text-amber-50"
        >
          <Swords className="w-3.5 h-3.5 mr-1" /> Entrar a la mesa
        </Button>
      )}
      {row.status === 'accepted' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onShowRevealed(row)}
          data-testid={`view-revealed-${row.id}`}
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
        >
          <ScrollText className="w-3.5 h-3.5 mr-1" /> Ver lo revelado por el DJ
        </Button>
      )}
      {(row.status === 'pending' || row.status === 'accepted') && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onLeave(row)}
          data-testid={`leave-btn-${row.id}`}
          className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30"
        >
          <LogOut className="w-3.5 h-3.5 mr-1" />
          {row.status === 'pending' ? 'Cancelar solicitud' : 'Abandonar campaña'}
        </Button>
      )}
    </div>
  </div>
);

const MyCampaignsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [toLeave, setToLeave] = useState(null);
  const [revealedFor, setRevealedFor] = useState(null); // { row, data, loading }

  const handleShowRevealed = async (row) => {
    setRevealedFor({ row, data: null, loading: true });
    try {
      const data = await getRevealedTexts(row.run.id || row.run_id || row.campaign_run_id);
      setRevealedFor({ row, data, loading: false });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cargar lo revelado');
      setRevealedFor(null);
    }
  };

  const reload = async () => {
    setLoading(true);
    try {
      const data = await myCampaigns();
      setRows(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error cargando');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleConfirmLeave = async () => {
    if (!toLeave) return;
    try {
      await leaveCampaign(toLeave.id);
      toast.success('Has salido de la campaña');
      setToLeave(null);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  return (
    <div
      className="min-h-screen relative"
      data-testid="my-campaigns-page"
      style={{
        backgroundImage:
          'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/75" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
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
              Mis Campañas
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/tablon')}
              variant="outline"
              data-testid="goto-board-btn"
              className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
            >
              📜 Tablón
            </Button>
            <Button
              onClick={() => setShowJoin(true)}
              data-testid="join-campaign-btn"
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
            >
              <KeyRound className="w-4 h-4 mr-2" /> Unirme con un código
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-amber-300/70">
            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-3" />
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-amber-300/60" data-testid="empty-my-campaigns">
            <p className="text-lg mb-2">Aún no participas en ninguna campaña.</p>
            <p className="text-sm">
              Pide un código a tu DJ y pulsa <span className="text-amber-300">"Unirme con un código"</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rows.map((r) => (
              <Card key={r.id} row={r} onLeave={setToLeave} onShowRevealed={handleShowRevealed} onEnterScreen={(row) => navigate(`/campanas/${row.run.id}/pantalla`)} />
            ))}
          </div>
        )}
      </div>

      <JoinCampaignDialog open={showJoin} onClose={() => setShowJoin(false)} onJoined={reload} />

      <AlertDialog open={!!toLeave} onOpenChange={(o) => !o && setToLeave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toLeave?.status === 'pending' ? 'Cancelar solicitud' : 'Abandonar campaña'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toLeave?.status === 'accepted'
                ? `Vas a abandonar la campaña con ${toLeave?.character_name}. Si has acumulado XP pendiente, lo perderás.`
                : `Vas a cancelar tu solicitud con ${toLeave?.character_name}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              data-testid="confirm-leave-btn"
              className="bg-rose-700 hover:bg-rose-600"
            >
              {toLeave?.status === 'pending' ? 'Cancelar' : 'Abandonar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!revealedFor} onOpenChange={(o) => !o && setRevealedFor(null)}>
        <DialogContent
          className="max-w-2xl max-h-[88vh] overflow-y-auto bg-black/95 border-amber-700/50"
          data-testid="revealed-modal"
        >
          <DialogHeader>
            <DialogTitle className="text-amber-300 font-heading text-2xl flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-amber-400" />
              {revealedFor?.row?.run?.adventure_name || 'Aventura'} — revelado por el DJ
            </DialogTitle>
          </DialogHeader>
          {revealedFor?.loading ? (
            <div className="py-8 text-center text-amber-300">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {revealedFor?.data?.presentation_text ? (
                <div className="rounded border border-amber-700/40 bg-amber-900/10 p-4">
                  <h3 className="text-xs uppercase tracking-widest text-amber-300/70 mb-2">
                    Presentación
                  </h3>
                  <p className="text-sm text-gray-100 whitespace-pre-wrap italic">
                    {revealedFor.data.presentation_text}
                  </p>
                </div>
              ) : null}

              {(revealedFor?.data?.events || []).length > 0 && (
                <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-4">
                  <h3 className="text-xs uppercase tracking-widest text-emerald-300/70 mb-2">
                    Notas en eventos del viaje
                  </h3>
                  <ul className="space-y-3">
                    {revealedFor.data.events.map((ev) => (
                      <li key={ev.id} data-testid={`revealed-event-${ev.id}`}>
                        <div className="text-amber-200 font-medium">{ev.title || 'Acontecimiento'}</div>
                        <p className="text-sm text-gray-100 whitespace-pre-wrap">{ev.player_notes}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!revealedFor?.data?.presentation_text &&
                (revealedFor?.data?.events || []).length === 0 && (
                  <p className="text-sm italic text-amber-300/60 text-center py-6">
                    El DJ aún no ha revelado nada. Pídele que te lo muestre cuando llegue el momento.
                  </p>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyCampaignsPage;
