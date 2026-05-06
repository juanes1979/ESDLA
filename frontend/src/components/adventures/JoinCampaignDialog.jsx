/**
 * JoinCampaignDialog — el jugador introduce un código de campaña y selecciona
 * uno de sus personajes. POST /api/campaign-runs/join-by-code.
 *
 * Validaciones del lado cliente: código mínimo 4 chars, personaje seleccionado.
 * Backend valida lock, capacidad, multi-character, etc.
 */
import { useEffect, useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { joinByCode, listMyCharacters } from '@/services/api';

const JoinCampaignDialog = ({ open, onClose, onJoined }) => {
  const [code, setCode] = useState('');
  const [characters, setCharacters] = useState([]);
  const [characterId, setCharacterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setCharacterId('');
    setLoading(true);
    listMyCharacters()
      .then((chars) => {
        // Filter out characters already locked in another run
        const eligible = chars.filter((c) => !c.active_campaign_run_id);
        setCharacters(eligible);
        if (eligible.length === 1) setCharacterId(eligible[0].id);
      })
      .catch(() => toast.error('No se pudieron cargar tus personajes'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase().replace(/\s+/g, '');
    if (cleaned.length < 4) {
      toast.error('Código demasiado corto');
      return;
    }
    if (!characterId) {
      toast.error('Selecciona un personaje');
      return;
    }
    setSubmitting(true);
    try {
      const player = await joinByCode(cleaned, characterId);
      toast.success('Solicitud enviada al DJ — esperando aprobación');
      onJoined?.(player);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-black/95 border-amber-700/50 max-w-md"
        data-testid="join-campaign-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-amber-300 flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> Unirse a campaña
          </DialogTitle>
          <DialogDescription className="text-amber-300/60 text-xs">
            Introduce el código que te ha dado tu DJ y elige un personaje.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="block text-sm text-amber-200 mb-1">Código de campaña</label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="P. ej. K7F3X9A2"
              data-testid="join-code-input"
              maxLength={16}
              className="w-full px-3 py-2 rounded-md bg-black/60 border border-amber-700/40 text-amber-100 placeholder-amber-300/30 focus:outline-none focus:border-amber-500 font-mono tracking-widest uppercase"
            />
            <p className="text-xs text-amber-300/50 mt-1">
              No distingue mayúsculas/minúsculas.
            </p>
          </div>

          <div>
            <label className="block text-sm text-amber-200 mb-1">Personaje</label>
            {loading ? (
              <div className="text-amber-300/60 text-sm">
                <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Cargando…
              </div>
            ) : characters.length === 0 ? (
              <p className="text-sm text-amber-300/70 italic">
                No tienes personajes disponibles. Crea uno o termina los que ya tienes en
                otras campañas.
              </p>
            ) : (
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                data-testid="join-character-select"
                className="w-full px-3 py-2 rounded-md bg-black/60 border border-amber-700/40 text-amber-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">— elige uno —</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.nivel ? `· nivel ${c.nivel}` : ''}{' '}
                    {c.cultura_nombre ? `· ${c.cultura_nombre}` : ''}
                  </option>
                ))}
              </select>
            )}
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
              disabled={submitting || !characterId || code.trim().length < 4}
              data-testid="join-submit-btn"
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 mr-1" />
              )}
              Enviar solicitud
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JoinCampaignDialog;
