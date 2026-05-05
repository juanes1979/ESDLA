/**
 * EyeAIPromptEditor — Editor del prompt de sistema usado por la IA
 * para generar Episodios de Revelación del Ojo de Mordor.
 *
 * Sólo administradores pueden editar. Botón "Restaurar default"
 * vuelve al prompt original. Persistencia vía POST /api/eye/ai/prompt.
 */
import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/services/api';

const EyeAIPromptEditor = ({ isAdmin = false }) => {
  const [prompt, setPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/eye/ai/prompt');
      setPrompt(res.data?.system_prompt || '');
      setDefaultPrompt(res.data?.default_prompt || '');
      setDirty(false);
    } catch (err) {
      console.error('Eye AI prompt load fail:', err);
      toast.error('Error al cargar el prompt de la IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/eye/ai/prompt', { system_prompt: prompt });
      toast.success('Prompt guardado.');
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar el prompt');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('¿Restaurar el prompt al valor por defecto? Esto sobreescribe lo que tengas guardado.')) return;
    setSaving(true);
    try {
      const res = await api.post('/eye/ai/prompt/reset');
      setPrompt(res.data.system_prompt || '');
      setDirty(false);
      toast.success('Prompt restaurado al valor por defecto');
    } catch (err) {
      toast.error('No se pudo restaurar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="card-parchment rounded-lg p-4 border border-amber-700/40" data-testid="eye-ai-prompt-editor">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div>
          <h3 className="font-heading text-base text-amber-300 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Prompt de IA para Episodios del Ojo de Mordor
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Texto enviado como <span className="text-amber-200">system message</span> a GPT-4o cuando se dispara un Episodio de Revelación. La IA debe devolver JSON con <code className="text-amber-200">event_type</code>, <code className="text-amber-200">description</code>, <code className="text-amber-200">mechanical_effect</code>, <code className="text-amber-200">tone</code>.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={saving} data-testid="eye-ai-prompt-reset-btn">
              <RotateCcw className="w-3 h-3 mr-1" />
              Restaurar default
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving || !dirty}
              className="bg-amber-600 hover:bg-amber-500 text-black font-semibold"
              data-testid="eye-ai-prompt-save-btn"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Guardar
            </Button>
          </div>
        )}
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); setDirty(true); }}
        rows={14}
        className="font-mono text-[12px] leading-relaxed bg-black/30"
        readOnly={!isAdmin}
        data-testid="eye-ai-prompt-textarea"
      />

      {dirty && (
        <p className="text-[10px] text-amber-300 mt-2 italic">
          Cambios sin guardar.
        </p>
      )}

      <details className="mt-3 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer hover:text-amber-300 select-none flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Variables que recibe la IA en el `user_prompt`
        </summary>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li><code>UBICACIÓN</code>: nombre del lugar/destino del viaje</li>
          <li><code>AMENAZA ACTUAL</code>: nombre del evento actual del viaje (si existe)</li>
          <li><code>OBJETIVO DEL GRUPO</code>: viaje origen → destino</li>
          <li><code>FATIGA DEL GRUPO</code>: Baja / Moderada / Alta</li>
          <li><code>SOMBRA</code>: Baja / Moderada / Alta</li>
          <li><code>ACCIONES RECIENTES</code>: últimos 5 eventos del viaje</li>
          <li><code>INFLUENCIA DEL ENEMIGO</code>: low / medium / high (según tipo de región)</li>
        </ul>
      </details>

      <details className="mt-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer hover:text-amber-300 select-none">
          Tipos de evento permitidos (event_type)
        </summary>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li><b>desventaja_global</b>: todas las tiradas con desventaja</li>
          <li><b>rechazo_social</b>: dificultad social ↑</li>
          <li><b>tentacion</b>: +3 sombra al más débil</li>
          <li><b>traicion</b>: NPC aliado se vuelve hostil</li>
          <li><b>fatiga_sobrenatural</b>: +1 nivel de cansancio a todos</li>
          <li><b>escape_imposible</b>: enemigo escapa o perseguidor alcanza</li>
          <li><b>emboscada_inevitable</b>: detección automática</li>
          <li><b>buff_enemigo</b>: refuerzos hostiles</li>
        </ul>
      </details>
    </div>
  );
};

export default EyeAIPromptEditor;
