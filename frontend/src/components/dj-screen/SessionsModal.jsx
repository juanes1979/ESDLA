/**
 * Sesiones de campaña — Iniciar/Cerrar sesión (DJ) e historial con resúmenes de IA.
 */
import { useState } from 'react';
import { X, ScrollText, Play, Square, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SessionsModal = ({ open, onClose, sessions, active, canEdit, onStart, onCloseSession, busy }) => {
  const [titulo, setTitulo] = useState('');
  const [expanded, setExpanded] = useState(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose} data-testid="sessions-modal">
      <div className="bg-zinc-900 rounded-xl border border-amber-700/40 p-4 max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg text-amber-300 flex items-center gap-2"><ScrollText className="w-5 h-5" /> Sesiones de campaña</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white" data-testid="sessions-close"><X className="w-5 h-5" /></button>
        </div>

        {/* Control (solo DJ) */}
        {canEdit && (
          <div className="rounded-lg border border-amber-800/40 bg-amber-950/10 p-3 mb-3" data-testid="session-control">
            {active ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-amber-200 font-medium truncate">▶️ {active.titulo}</div>
                  <div className="text-[11px] text-stone-400">En curso — al cerrarla se generará un resumen con IA.</div>
                </div>
                <Button size="sm" onClick={() => onCloseSession(active.id)} disabled={busy} className="bg-rose-700 hover:bg-rose-600 text-rose-50 h-8 text-xs shrink-0" data-testid="close-session-btn">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Square className="w-3.5 h-3.5 mr-1" /> Cerrar sesión</>}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onStart(titulo)}
                  placeholder="Título de la sesión (opcional)"
                  className="flex-1 bg-black/40 rounded px-2 py-1.5 text-sm text-amber-100 placeholder-amber-500/30 outline-none border border-amber-900/30"
                  data-testid="session-title-input"
                />
                <Button size="sm" onClick={() => { onStart(titulo); setTitulo(''); }} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 h-8 text-xs shrink-0" data-testid="start-session-btn">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-3.5 h-3.5 mr-1" /> Iniciar sesión</>}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Historial */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {(!sessions || sessions.length === 0) && (
            <p className="text-sm text-stone-500 italic text-center py-6">— aún no hay sesiones —</p>
          )}
          {(sessions || []).map((s) => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="rounded-lg border border-stone-700/40 bg-black/40 overflow-hidden" data-testid={`session-item-${s.numero}`}>
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-800/40 transition-colors"
                  data-testid={`session-toggle-${s.numero}`}
                >
                  <span className="text-sm text-amber-200 font-medium truncate flex items-center gap-2">
                    {s.titulo}
                    {s.status === 'active'
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300">activa</span>
                      : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-stone-700 text-stone-300">cerrada</span>}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 text-[13px] text-stone-300 whitespace-pre-line" data-testid={`session-summary-${s.numero}`}>
                    {s.summary || (s.status === 'active'
                      ? <span className="italic text-stone-500">Sesión en curso. El resumen se generará al cerrarla.</span>
                      : <span className="italic text-stone-500">Sin resumen (la IA no estaba disponible al cerrar).</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SessionsModal;
