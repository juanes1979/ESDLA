/**
 * CampaignActivatedDialog — pantalla post-creación con la animación
 * "anillo forjado" + el código y las 3 acciones que el spec pide:
 *   - Copiar código
 *   - Publicar en tablón (Fase 5 — placeholder por ahora)
 *   - Ir al panel de campaña
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, ExternalLink, Megaphone, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ForgedRingReveal from './ForgedRingReveal';

const CampaignActivatedDialog = ({ run, open, onClose }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!run) return null;

  const code = run.campaign_code || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Código copiado al portapapeles');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('No se pudo copiar — selecciona el texto manualmente');
    }
  };

  const handlePublish = () => {
    toast.message('El tablón estará disponible en la Fase 5');
  };

  const handleGoToHub = () => {
    onClose();
    navigate(`/campanas/${run.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-xl bg-gradient-to-b from-black to-[#1a0d05] border-amber-700/60"
        data-testid="campaign-activated-dialog"
      >
        <DialogTitle className="font-heading text-3xl text-center text-amber-300 tracking-widest">
          CAMPAÑA ACTIVADA
        </DialogTitle>

        <div className="text-center text-sm text-amber-300/70 -mt-1">
          Aventura base: <span className="text-amber-200">«{run.adventure_name}»</span>
        </div>

        <ForgedRingReveal code={code} />

        <p className="text-xs text-center text-amber-300/60 px-6 -mt-3">
          Comparte este código <strong>de forma discreta</strong> con tus jugadores. Sólo
          quien lo conoce puede unirse.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5 px-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            data-testid="copy-code-btn"
            className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          >
            {copied ? (
              <Check className="w-4 h-4 mr-1 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 mr-1" />
            )}
            {copied ? 'Copiado' : 'Copiar código'}
          </Button>
          <Button
            variant="outline"
            onClick={handlePublish}
            data-testid="publish-btn"
            className="border-amber-700/50 text-amber-200/70 hover:bg-amber-900/30"
            disabled
            title="Disponible en la Fase 5 (Tablón)"
          >
            <Megaphone className="w-4 h-4 mr-1" /> Publicar (pronto)
          </Button>
          <Button
            onClick={handleGoToHub}
            data-testid="go-to-hub-btn"
            className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
          >
            <ExternalLink className="w-4 h-4 mr-1" /> Ir al panel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignActivatedDialog;
