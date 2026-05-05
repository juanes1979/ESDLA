/**
 * RevelationEpisodeModal — Modal del Episodio de Revelación.
 *
 * Flujo:
 *  1. La barra del Ojo muestra "Disparar Episodio" al superar umbral.
 *  2. Pulsar abre este modal: llama a /api/eye/ai/propose-episode con
 *     contexto del viaje, muestra la propuesta de la IA (event_type,
 *     description, mechanical_effect) en campos editables.
 *  3. El DJ puede:
 *      - Editar texto/efecto antes de aplicar.
 *      - Pulsar "Regenerar" para pedir otra propuesta a la IA.
 *      - Pulsar "Aplicar" → POST /api/eye/ai/apply-episode (resetea Atención
 *        a initial_value y registra el evento en history).
 *      - Pulsar "Cancelar" → cierra sin aplicar (la atención sigue alta).
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, Eye, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

const TONE_OPTIONS = [
  { value: 'subtle', label: 'Sutil' },
  { value: 'ominous', label: 'Ominoso' },
  { value: 'dark', label: 'Oscuro' },
];

const RevelationEpisodeModal = ({ open, onClose, eyeState, journeyContext, onApplied }) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedEffect, setEditedEffect] = useState('');
  const [editedType, setEditedType] = useState('desventaja_global');
  const [editedTone, setEditedTone] = useState('ominous');
  const [episodeTypes, setEpisodeTypes] = useState([]);

  const requestProposal = async () => {
    setLoading(true);
    try {
      const types = await api.get('/eye/ai/episode-types');
      setEpisodeTypes(types.data?.types || []);
      const res = await api.post('/eye/ai/propose-episode', {
        state_id: 'default',
        context: journeyContext || {},
      });
      const d = res.data;
      setProposal(d);
      setEditedDescription(d.description || '');
      setEditedEffect(d.mechanical_effect || '');
      setEditedType(d.event_type || 'desventaja_global');
      setEditedTone(d.tone || 'ominous');
      if (d.fallback_used) {
        toast.warning('La IA no devolvió JSON válido — se usa el episodio por defecto.');
      }
    } catch (err) {
      console.error('Propose episode failed:', err);
      toast.error('Error al pedir propuesta a la IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) requestProposal();
    else { setProposal(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleApply = async () => {
    if (!editedDescription.trim() || !editedEffect.trim()) {
      toast.error('Descripción y efecto son obligatorios');
      return;
    }
    setApplying(true);
    try {
      const res = await api.post('/eye/ai/apply-episode', {
        state_id: 'default',
        event_type: editedType,
        description: editedDescription,
        mechanical_effect: editedEffect,
        tone: editedTone,
      });
      toast.success(`🌑 Episodio aplicado. La Atención cae a ${res.data?.state?.attention_total ?? 0}.`, { duration: 6000 });
      if (onApplied) onApplied(res.data);
      onClose();
    } catch (err) {
      console.error('Apply episode failed:', err);
      toast.error('Error al aplicar el episodio');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl" data-testid="revelation-episode-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-5 h-5" />
            Episodio de Revelación
          </DialogTitle>
          <DialogDescription>
            La Atención del Ojo de Mordor ha superado el Umbral de Caza. El mundo reacciona contra el grupo.
            La IA propone un episodio que el DJ puede revisar, editar o regenerar antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            <p className="text-sm text-muted-foreground">La Sombra invoca el destino…</p>
          </div>
        ) : !proposal ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40" />
            Pulsa &quot;Generar&quot; para pedir una propuesta a la IA.
          </div>
        ) : (
          <div className="space-y-3" data-testid="revelation-episode-form">
            {proposal.fallback_used && (
              <div className="text-[11px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200">
                ⚠️ Fallback: la IA no devolvió JSON válido. Usando episodio por defecto.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de episodio</Label>
                <Select value={editedType} onValueChange={setEditedType}>
                  <SelectTrigger data-testid="revelation-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {episodeTypes.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tono</Label>
                <Select value={editedTone} onValueChange={setEditedTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Narrativa</Label>
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={4}
                className="text-sm"
                data-testid="revelation-description"
              />
            </div>

            <div>
              <Label className="text-xs">Efecto mecánico</Label>
              <Textarea
                value={editedEffect}
                onChange={(e) => setEditedEffect(e.target.value)}
                rows={3}
                className="text-sm"
                data-testid="revelation-mechanical-effect"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Se aplica a discreción del DJ (la app sólo registra el texto en el log).
              </p>
            </div>

            <div className="text-[10px] text-muted-foreground italic">
              Atención actual: <span className="text-red-300 font-bold">{eyeState?.attention_total ?? '?'}</span> / {eyeState?.threshold_info?.threshold ?? '?'}.
              Tras aplicar, vuelve a {eyeState?.initial_value ?? 0}.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={applying} data-testid="revelation-cancel-btn">
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={requestProposal}
            disabled={loading || applying}
            data-testid="revelation-regenerate-btn"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Regenerar
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading || applying || !proposal}
            className="bg-red-700 hover:bg-red-600 text-white"
            data-testid="revelation-apply-btn"
          >
            {applying ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
            Aplicar Episodio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RevelationEpisodeModal;
