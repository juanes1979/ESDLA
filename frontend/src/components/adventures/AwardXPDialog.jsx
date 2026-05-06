/**
 * AwardXPDialog — el DJ otorga PX a un personaje aceptado.
 * No usa selector de personaje: se invoca con `player` ya preseleccionado
 * desde la fila correspondiente.
 */
import { useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { awardXP } from '@/services/api';

const QUICK_AMOUNTS = [25, 50, 100, 200, 500];

const AwardXPDialog = ({ open, onClose, runId, player, onAwarded }) => {
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(50);
      setReason('');
    }
  }, [open]);

  if (!player) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount < 1) {
      toast.error('Cantidad inválida');
      return;
    }
    setSubmitting(true);
    try {
      await awardXP(runId, {
        characterId: player.character_id,
        xpAmount: Number(amount),
        reason: reason.trim() || null,
      });
      toast.success(`+${amount} PX otorgados a ${player.character_name}`);
      onAwarded?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error otorgando PX');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-black/95 border-amber-700/50 max-w-md"
        data-testid="award-xp-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-amber-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Otorgar PX
          </DialogTitle>
          <DialogDescription className="text-amber-300/60 text-xs">
            Para <span className="text-amber-200">{player.character_name}</span>{' '}
            (jugador: {player.user_name || '—'}). Pendiente actual:{' '}
            <strong>{player.xp_pending_total || 0} PX</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm text-amber-200 mb-1">Cantidad</label>
            <input
              type="number"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              min={1}
              max={10000}
              data-testid="award-amount-input"
              className="w-full px-3 py-2 rounded-md bg-black/60 border border-amber-700/40 text-amber-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  data-testid={`quick-${v}`}
                  className="px-2 py-0.5 rounded bg-amber-900/30 text-amber-200 text-xs border border-amber-700/40 hover:bg-amber-800/50"
                >
                  +{v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-amber-200 mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Derrotaron al troll, salvaron al alcalde…"
              maxLength={120}
              data-testid="award-reason-input"
              className="w-full px-3 py-2 rounded-md bg-black/60 border border-amber-700/40 text-amber-100 placeholder-amber-300/30 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="text-xs text-amber-300/60 italic px-2">
            La PX queda como <strong>pendiente</strong>. Se consolidará en el personaje al
            finalizar la campaña.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !amount}
              data-testid="award-submit-btn"
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              Otorgar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AwardXPDialog;
