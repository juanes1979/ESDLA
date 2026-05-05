/**
 * EyeAttentionBar — barra visual de Atención del Ojo durante viaje.
 *
 * Diseño: oscuro, llamativo, con tooltip que muestra desglose de las
 * últimas entradas del historial y umbral según región actual. Aparece
 * también un botón "+1 manual" para que el DJ registre eventos
 * (magia visible, etc.) sin abandonar la pantalla del viaje.
 */
import { useState } from 'react';
import { Eye, Plus, AlertTriangle, History, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SOURCE_LABELS } from '@/hooks/useEyeOfMordor';

const SEVERITY_COLOR = (ratio) => {
  if (ratio < 0.4) return { bar: 'bg-amber-600', glow: 'shadow-amber-500/30', text: 'text-amber-300' };
  if (ratio < 0.75) return { bar: 'bg-orange-600', glow: 'shadow-orange-500/40', text: 'text-orange-300' };
  return { bar: 'bg-red-600', glow: 'shadow-red-500/60', text: 'text-red-300' };
};

const EyeAttentionBar = ({ state, onIncrement, onTriggerEpisode, compact = false }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [source, setSource] = useState('manual');
  const [deltaInput, setDeltaInput] = useState('');
  const [descInput, setDescInput] = useState('');

  if (!state) {
    return null;
  }

  const total = Number(state.attention_total || 0);
  const threshold = Number(state.threshold_info?.threshold || 16);
  const ratio = Math.min(1, total / threshold);
  const colors = SEVERITY_COLOR(ratio);
  const willTrigger = state.will_trigger;

  const handleAdd = async () => {
    const payload = {
      source,
      descripcion: descInput,
    };
    if (deltaInput && Number(deltaInput) > 0) payload.delta = Number(deltaInput);
    const res = await onIncrement(payload);
    if (res?.will_trigger) {
      // El caller (EyeAttentionBar usa la prop onIncrement) recibirá la
      // respuesta y abrirá el modal de episodio si procede.
    }
    setShowAddModal(false);
    setDeltaInput('');
    setDescInput('');
    setSource('manual');
  };

  const quickMagic = async (level) => {
    // level: 'minor' | 'major' | 'powerful'
    const map = { minor: 'magic_minor', major: 'magic_major', powerful: 'magic_powerful' };
    const labels = { minor: 'magia menor', major: 'magia mayor', powerful: 'magia poderosa' };
    await onIncrement({ source: map[level], descripcion: `Uso rápido de ${labels[level]}` });
  };

  const recentHistory = (state.history || []).slice(-5).reverse();
  const fullHistory = [...(state.history || [])].reverse();
  const filteredHistory = fullHistory.filter(h => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'magic') return (h.source || '').startsWith('magic_');
    if (historyFilter === 'episode') return h.source === 'episode_applied' || h.source === 'episode_reset';
    return h.source === historyFilter;
  });

  return (
    <>
      <div
        className={`relative card-parchment rounded-lg p-3 border ${
          willTrigger ? 'border-red-500 animate-pulse' : 'border-amber-700/40'
        } ${colors.glow} shadow-lg`}
        data-testid="eye-attention-bar"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className={`w-5 h-5 ${colors.text} shrink-0`} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
                Ojo de Mordor
              </p>
              <p className={`font-bold text-sm truncate ${colors.text}`} data-testid="eye-attention-value">
                {total} / {threshold}{' '}
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({state.threshold_info?.region_type || 'salvaje'})
                </span>
              </p>
            </div>
          </div>
          {!compact && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                title="Magia menor (+1)"
                className="h-7 px-2 text-[11px] gap-1 border-amber-700/50 hover:bg-amber-900/30"
                onClick={() => quickMagic('minor')}
                data-testid="eye-magic-minor-btn"
              >
                <Zap className="w-3 h-3" />+1
              </Button>
              <Button
                size="sm"
                variant="outline"
                title="Magia mayor (+2)"
                className="h-7 px-2 text-[11px] gap-1 border-orange-700/50 hover:bg-orange-900/30"
                onClick={() => quickMagic('major')}
                data-testid="eye-magic-major-btn"
              >
                <Zap className="w-3 h-3" />+2
              </Button>
              <Button
                size="sm"
                variant="outline"
                title="Magia poderosa (+3)"
                className="h-7 px-2 text-[11px] gap-1 border-red-700/50 hover:bg-red-900/30"
                onClick={() => quickMagic('powerful')}
                data-testid="eye-magic-powerful-btn"
              >
                <Zap className="w-3 h-3" />+3
              </Button>
              <Button
                size="sm"
                variant="outline"
                title="Historial completo"
                className="h-7 px-2 text-[11px] gap-1"
                onClick={() => setShowHistoryModal(true)}
                data-testid="eye-history-btn"
              >
                <History className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setShowAddModal(true)}
                data-testid="eye-add-attention-button"
              >
                <Plus className="w-3 h-3" />
                Sumar
              </Button>
            </div>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="mt-2 h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full transition-all duration-700 ${colors.bar}`}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
            data-testid="eye-attention-progress"
          />
        </div>

        {willTrigger && (
          <button
            type="button"
            onClick={onTriggerEpisode}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-500/60 transition-colors"
            data-testid="eye-trigger-episode-button"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            ¡La Sombra os ha encontrado! · Disparar Episodio
          </button>
        )}

        {!compact && recentHistory.length > 0 && (
          <details className="mt-2 text-[11px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-amber-300 select-none">
              Últimas señales ({recentHistory.length})
            </summary>
            <ul className="mt-1.5 space-y-1 pl-2">
              {recentHistory.map((h) => (
                <li key={h.id} className="flex justify-between gap-2 text-muted-foreground">
                  <span className="truncate">
                    <span className="text-amber-400">{SOURCE_LABELS[h.source] || h.source}</span>
                    {h.character_name ? ` · ${h.character_name}` : ''}
                    {h.descripcion ? `: ${h.descripcion}` : ''}
                  </span>
                  <span className={h.delta > 0 ? 'text-red-300' : 'text-emerald-300'}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent data-testid="eye-add-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-400" />
              Sumar Atención al Ojo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Fuente</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger data-testid="eye-source-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="magic_minor">Magia menor (+1)</SelectItem>
                  <SelectItem value="magic_major">Magia mayor (+2)</SelectItem>
                  <SelectItem value="magic_powerful">Magia poderosa (+3)</SelectItem>
                  <SelectItem value="object">Objeto notable revelado (+2)</SelectItem>
                  <SelectItem value="manual">Ajuste manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Delta personalizado (opcional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Dejar vacío para usar el valor por defecto"
                value={deltaInput}
                onChange={(e) => setDeltaInput(e.target.value)}
                data-testid="eye-delta-input"
              />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea
                placeholder="Ej: Gandalf invoca un haz de luz para asustar a los Trasgos."
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                rows={2}
                data-testid="eye-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} data-testid="eye-confirm-add-button">
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-3xl" data-testid="eye-history-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Historial del Ojo de Mordor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Label className="text-xs">Filtro:</Label>
              {[
                { v: 'all', label: 'Todo' },
                { v: 'nat1', label: 'Natural 1s' },
                { v: 'shadow_gain', label: 'Sombra ganada' },
                { v: 'magic', label: 'Magia (todas)' },
                { v: 'object', label: 'Objetos' },
                { v: 'manual', label: 'Manual' },
                { v: 'episode', label: 'Episodios' },
              ].map(f => (
                <Button
                  key={f.v}
                  size="sm"
                  variant={historyFilter === f.v ? 'default' : 'outline'}
                  className={`h-7 text-[11px] ${historyFilter === f.v ? 'bg-amber-600 hover:bg-amber-500 text-black' : ''}`}
                  onClick={() => setHistoryFilter(f.v)}
                  data-testid={`eye-history-filter-${f.v}`}
                >
                  {f.label}
                </Button>
              ))}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {filteredHistory.length} de {fullHistory.length} entradas
              </span>
            </div>
            <ScrollArea className="h-[55vh] border border-border/40 rounded">
              {filteredHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground italic p-4 text-center">
                  No hay entradas que coincidan con el filtro.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-black/40 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 w-32">Fecha</th>
                      <th className="px-2 py-1.5 w-32">Fuente</th>
                      <th className="px-2 py-1.5 w-12 text-right">Δ</th>
                      <th className="px-2 py-1.5">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(h => {
                      const isEpisode = h.source === 'episode_applied' || h.source === 'episode_reset';
                      const ts = h.ts ? new Date(h.ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                      return (
                        <tr
                          key={h.id || `${h.ts}-${h.source}`}
                          className={`border-t border-border/20 ${isEpisode ? 'bg-rose-950/20' : ''}`}
                          data-testid={`eye-history-row-${h.id || h.ts}`}
                        >
                          <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{ts}</td>
                          <td className="px-2 py-1.5 text-amber-300">
                            {h.event_label || SOURCE_LABELS[h.source] || h.source}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-bold ${(h.delta || 0) > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                            {h.delta > 0 ? `+${h.delta}` : h.delta || 0}
                          </td>
                          <td className="px-2 py-1.5">
                            {h.character_name && <span className="text-cyan-300 mr-1">{h.character_name}</span>}
                            {isEpisode && h.description && (
                              <div className="text-rose-200 italic mt-0.5">{h.description}</div>
                            )}
                            {isEpisode && h.mechanical_effect && (
                              <div className="text-rose-300/80 text-[10px] mt-0.5">⚙ {h.mechanical_effect}</div>
                            )}
                            {!isEpisode && h.descripcion && (
                              <span className="text-muted-foreground">{h.descripcion}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EyeAttentionBar;

