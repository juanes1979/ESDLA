/**
 * Pantalla del DJ — dashboard en vivo de una campaña.
 *
 * Zonas:
 *   - Izquierda: notas privadas del DJ + chat (grupo / privados).
 *   - Centro: lienzo de escena + cartas de héroes.
 *   - Derecha: rastreador de iniciativa (jugadores + enemigos).
 *
 * DJ/Maestro: edición completa y persistente. Jugador aceptado: vista de
 * jugador (sin datos privados), solo lectura. Chat para todos.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Minus, Trash2, Swords, Shield, Heart,
  ChevronRight, ChevronLeft, RotateCcw, ArrowDownWideNarrow, Send,
  Map, Users, NotebookPen, MessageSquare, Skull, X,
  Dices, Compass, Eye, AlertTriangle, Flame, XCircle, BookOpen, MapPin, ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDjScreen, saveDjScreen, syncDjPlayers,
  getDjChat, postDjChat, getDjChatPeers, getBestiary, djAttack,
  djRollInitiative, djTravelEvent, getCampaignEye, djApplyShadow, djEyeIncrement, djRollDice, djShadowEvent,
  getSessions, startSession, closeSession,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import AuthenticatedImage from '@/components/AuthenticatedImage';
import RulesReferenceModal from '@/components/dj-screen/RulesReferenceModal';
import TacticalMap from '@/components/dj-screen/TacticalMap';
import SessionsModal from '@/components/dj-screen/SessionsModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const getToken = () =>
  localStorage.getItem('lotr5e_token') || sessionStorage.getItem('lotr5e_token');

const uid = () => `c_${Math.random().toString(36).slice(2, 10)}`;

const BAND_COLOR = {
  ileso: 'text-emerald-300', 'herido leve': 'text-lime-300',
  herido: 'text-amber-300', malherido: 'text-orange-400',
  caído: 'text-rose-500', desconocido: 'text-stone-400',
};

// Lista CERRADA de condiciones con su efecto (tooltip).
const CONDITIONS = [
  ['cansado', 'Cansado', 'Desventaja en sus ataques'],
  ['inspirado', 'Inspirado', 'Ventaja en su próximo ataque (se consume)'],
  ['aturdido', 'Aturdido', 'No puede actuar; le atacan con ventaja'],
  ['tumbado', 'Tumbado', 'Le atacan (melé) con ventaja'],
  ['apresado', 'Apresado', 'Velocidad 0'],
  ['asustado', 'Asustado', 'Desventaja mientras vea la amenaza'],
  ['envenenado', 'Envenenado', 'Desventaja en ataques y pruebas'],
  ['inconsciente', 'Inconsciente', 'No actúa; golpes cercanos son críticos'],
];
const COND_LABEL = Object.fromEntries(CONDITIONS.map(([k, l]) => [k, l]));

// ---------------------------------------------------------------------------
const CombatantCard = ({ c, idx, isActive, canEdit, onChange, onRemove, runId, isAttacker, isDefender, onSelectAttacker, onSelectDefender }) => {
  const pct = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0;
  const isEnemy = c.type === 'enemy';
  const condsLower = (c.conditions || []).map((x) => String(x).toLowerCase());
  const isDown = c.hp_current <= 0 || condsLower.includes('inconsciente');

  const portraitUrl = c.character_id
    ? `${BACKEND_URL}/api/campaign-runs/${runId}/dj-screen/portrait/${c.character_id}`
    : null;

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors ${
        isDown ? 'border-rose-700 ring-1 ring-rose-700/50 bg-rose-950/30 opacity-70'
        : isAttacker ? 'border-amber-400 ring-2 ring-amber-400/70 bg-amber-900/20'
        : isDefender ? 'border-sky-400 ring-2 ring-sky-400/70 bg-sky-900/20'
        : isActive
          ? 'border-amber-400 bg-amber-900/30 ring-1 ring-amber-400/60'
          : isEnemy ? 'border-rose-800/40 bg-rose-950/20' : 'border-emerald-800/40 bg-emerald-950/10'
      }`}
      data-testid={`combatant-${c.id}`}
    >
      <div className="flex items-center gap-2">
        <div className="shrink-0 w-7 h-7 rounded-full bg-black/60 border border-amber-700/40 flex items-center justify-center font-mono text-xs text-amber-200" title="Iniciativa">
          {canEdit ? (
            <input
              type="number"
              value={c.initiative}
              onChange={(e) => onChange({ ...c, initiative: parseInt(e.target.value || '0', 10) })}
              className="w-7 bg-transparent text-center text-amber-200 outline-none"
              data-testid={`combatant-init-${c.id}`}
            />
          ) : c.initiative}
        </div>
        {portraitUrl && c.has_portrait ? (
          <AuthenticatedImage url={portraitUrl} alt={c.name}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-600/40 shrink-0"
            fallbackClassName="w-8 h-8 rounded-full shrink-0" />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isEnemy ? 'bg-rose-900/50 text-rose-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
            {isEnemy ? <Skull className="w-4 h-4" /> : <Users className="w-4 h-4" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {canEdit ? (
            <input
              value={c.name}
              onChange={(e) => onChange({ ...c, name: e.target.value })}
              className="w-full bg-transparent text-sm font-medium text-amber-100 outline-none border-b border-transparent focus:border-amber-700/40"
              data-testid={`combatant-name-${c.id}`}
            />
          ) : (
            <div className="text-sm font-medium text-amber-100 truncate">{c.name}</div>
          )}
        </div>
        {canEdit && (
          <button onClick={() => onRemove(c.id)} className="text-rose-400/70 hover:text-rose-300" data-testid={`combatant-remove-${c.id}`} title="Eliminar">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selección atacante/defensor + atk/dmg (solo DJ) */}
      {canEdit && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          <button
            onClick={() => onSelectAttacker(c.id)}
            disabled={isDown}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed ${isAttacker ? 'bg-amber-600 text-amber-50' : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/40'}`}
            data-testid={`select-attacker-${c.id}`}
            title={isDown ? 'Caído/inconsciente: no puede atacar' : 'Marcar como atacante'}
          >
            <Swords className="w-3 h-3" /> Atac.
          </button>
          <button
            onClick={() => onSelectDefender(c.id)}
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${isDefender ? 'bg-sky-600 text-sky-50' : 'bg-black/40 text-sky-300/70 hover:bg-sky-900/40'}`}
            data-testid={`select-defender-${c.id}`}
            title="Marcar como defensor"
          >
            <Shield className="w-3 h-3" /> Def.
          </button>
          <span className="text-[10px] text-amber-300/50 ml-1">ATK</span>
          <input
            type="number" value={c.atk_bonus ?? 0}
            onChange={(e) => onChange({ ...c, atk_bonus: parseInt(e.target.value || '0', 10) })}
            className="w-9 bg-black/40 rounded text-center text-amber-200 text-[11px] outline-none"
            data-testid={`combatant-atk-${c.id}`}
          />
          <span className="text-[10px] text-rose-300/50">DAÑO</span>
          <input
            value={c.dmg ?? '1d6'}
            onChange={(e) => onChange({ ...c, dmg: e.target.value })}
            className="w-16 bg-black/40 rounded text-center text-rose-200 text-[11px] outline-none"
            data-testid={`combatant-dmg-${c.id}`}
          />
        </div>
      )}

      {/* HP + AC */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1 text-xs">
          <Shield className="w-3.5 h-3.5 text-sky-300" />
          {canEdit ? (
            <input type="number" value={c.ac}
              onChange={(e) => onChange({ ...c, ac: parseInt(e.target.value || '0', 10) })}
              className="w-9 bg-black/40 rounded text-center text-sky-200 outline-none" data-testid={`combatant-ac-${c.id}`} />
          ) : (isEnemy && !canEdit ? <span className="text-sky-200">—</span> : <span className="text-sky-200">{c.ac}</span>)}
        </div>

        {/* For enemies in player view we only have a band */}
        {!canEdit && isEnemy ? (
          <div className={`flex items-center gap-1 text-xs ${BAND_COLOR[c.hp_band] || 'text-stone-300'}`} data-testid={`combatant-band-${c.id}`}>
            <Heart className="w-3.5 h-3.5" /> {c.hp_band}
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-1">
            <Heart className="w-3.5 h-3.5 text-rose-300 shrink-0" />
            {canEdit && (
              <button onClick={() => onChange({ ...c, hp_current: c.hp_current - 1 })}
                className="px-1 rounded bg-black/50 text-rose-300 hover:bg-rose-900/40" data-testid={`combatant-hp-minus-${c.id}`}>
                <Minus className="w-3 h-3" />
              </button>
            )}
            <div className="flex-1 min-w-[60px]">
              <div className="h-2 rounded-full bg-stone-800 overflow-hidden border border-black/40">
                <div className={`h-full transition-all ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-rose-600'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-center text-stone-300 mt-0.5" data-testid={`combatant-hp-${c.id}`}>
                {c.hp_current}/{c.hp_max}
              </div>
            </div>
            {canEdit && (
              <button onClick={() => onChange({ ...c, hp_current: c.hp_current + 1 })}
                className="px-1 rounded bg-black/50 text-emerald-300 hover:bg-emerald-900/40" data-testid={`combatant-hp-plus-${c.id}`}>
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Conditions */}
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {(c.conditions || []).map((cond) => (
          <span key={cond} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 text-purple-200 border border-purple-700/40" data-testid={`combatant-cond-${c.id}-${cond}`}>
            {COND_LABEL[String(cond).toLowerCase()] || cond}
            {canEdit && (
              <button onClick={() => onChange({ ...c, conditions: c.conditions.filter((x) => x !== cond) })} className="hover:text-white">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {canEdit && (
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v && !condsLower.includes(v)) onChange({ ...c, conditions: [...(c.conditions || []), v] });
            }}
            className="text-[10px] bg-black/40 rounded px-1 py-0.5 text-purple-200 outline-none border border-purple-900/30"
            data-testid={`combatant-cond-select-${c.id}`}
          >
            <option value="">+ estado</option>
            {CONDITIONS.filter(([k]) => !condsLower.includes(k)).map(([k, lbl, eff]) => (
              <option key={k} value={k} title={eff}>{lbl}</option>
            ))}
          </select>
        )}
      </div>

      {canEdit && (
        <input
          value={c.notes || ''}
          onChange={(e) => onChange({ ...c, notes: e.target.value })}
          placeholder="Nota privada del DJ…"
          className="mt-2 w-full text-[11px] bg-black/30 rounded px-2 py-1 text-amber-200/80 placeholder-amber-500/30 outline-none border border-amber-900/30"
          data-testid={`combatant-notes-${c.id}`}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
const ChatPanel = ({ runId, channels, myUserId, chatEvent, wsLive }) => {
  const [channel, setChannel] = useState(channels[0]?.channel || 'group');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const msgs = await getDjChat(runId, channel);
      setMessages(msgs);
    } catch { /* silent */ }
  }, [runId, channel]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // Respaldo de sondeo (WS cubre el tiempo real cuando está vivo).
    const t = setInterval(() => { if (!document.hidden && !wsLive) load(); }, wsLive ? 12000 : 4000);
    return () => clearInterval(t);
  }, [load, wsLive]);

  // Mensaje entrante por WebSocket para el canal activo.
  useEffect(() => {
    if (!chatEvent || chatEvent.channel !== channel) return;
    const m = chatEvent.message;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, [chatEvent, channel]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = await postDjChat(runId, channel, text.trim());
      setMessages((m) => [...m, msg]);
      setText('');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo enviar');
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full" data-testid="dj-chat-panel">
      <div className="flex flex-wrap gap-1 mb-2">
        {channels.map((ch) => (
          <button
            key={ch.channel}
            onClick={() => setChannel(ch.channel)}
            data-testid={`chat-tab-${ch.channel}`}
            className={`px-2 py-1 text-xs rounded ${channel === ch.channel ? 'bg-amber-700 text-amber-50' : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/30'}`}
          >
            {ch.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px]" data-testid="chat-messages">
        {messages.length === 0 && <p className="text-xs text-stone-500 italic">— sin mensajes —</p>}
        {messages.map((m) => {
          const mine = m.sender_id === myUserId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm ${
                m.sender_role === 'dj' ? 'bg-amber-900/40 text-amber-100 border border-amber-700/30'
                : 'bg-stone-800/60 text-stone-100 border border-stone-700/30'}`}>
                <div className="text-[10px] opacity-60 mb-0.5">
                  {m.sender_name} {m.sender_role === 'dj' && '· DJ'}
                </div>
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escribe un mensaje…"
          className="flex-1 bg-black/40 rounded px-2 py-1.5 text-sm text-amber-100 placeholder-amber-500/30 outline-none border border-amber-900/30"
          data-testid="chat-input"
        />
        <Button size="sm" onClick={send} disabled={sending} className="bg-amber-700 hover:bg-amber-600 text-amber-50" data-testid="chat-send-btn">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Gestor de tiradas con runas (d4–d100) + privado/compartido.
const DICE = [4, 6, 8, 10, 12, 20, 100];

const DiceRoller = ({ runId }) => {
  const [shared, setShared] = useState(true);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);

  const roll = async (faces) => {
    setRolling(true);
    try {
      const res = await djRollDice(runId, faces, count, modifier, shared);
      setLast(res);
      if (shared) toast.message(`🎲 ${res.notation} = ${res.total}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al tirar');
    } finally { setRolling(false); }
  };

  return (
    <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3" data-testid="dice-roller">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-amber-300 flex items-center gap-1"><Dices className="w-4 h-4" /> Tiradas</h3>
        <button
          onClick={() => setShared((s) => !s)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${shared ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40' : 'bg-stone-800 text-stone-300 border-stone-600/40'}`}
          data-testid="dice-share-toggle"
          title={shared ? 'La tirada se narra en el chat de grupo' : 'Tirada privada (solo tú la ves)'}
        >{shared ? 'Compartida' : 'Privada'}</button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {DICE.map((f) => (
          <button
            key={f}
            onClick={() => roll(f)}
            disabled={rolling}
            className="aspect-square rounded-lg border border-amber-700/40 bg-gradient-to-b from-amber-950/40 to-black/60 text-amber-200 text-xs font-heading hover:border-amber-500/70 hover:text-amber-100 transition-colors disabled:opacity-40 flex items-center justify-center"
            data-testid={`dice-d${f}`}
          >d{f}</button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-amber-300/70">
        <span>Nº</span>
        <input type="number" min="1" max="20" value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))))}
          className="w-10 bg-black/40 rounded text-center text-amber-100 py-0.5 outline-none border border-amber-900/30" data-testid="dice-count" />
        <span className="ml-1">Mod</span>
        <input type="number" value={modifier}
          onChange={(e) => setModifier(parseInt(e.target.value || '0', 10))}
          className="w-12 bg-black/40 rounded text-center text-amber-100 py-0.5 outline-none border border-amber-900/30" data-testid="dice-mod" />
      </div>
      {last && (
        <div className="mt-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-2 text-center" data-testid="dice-result">
          <div className="text-[10px] text-amber-300/60">{last.notation}</div>
          <div className="text-lg font-heading text-amber-200">{last.total}</div>
          <div className="text-[10px] text-stone-400">[{last.rolls.join(', ')}]{last.modifier ? ` ${last.modifier >= 0 ? '+' : ''}${last.modifier}` : ''}</div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ojo de Mordor + control de Sombra de la Compañía.
const EYE_STYLE = {
  'Ojo dormido': { color: 'text-stone-400', ring: 'ring-stone-600/40', glow: '', bar: 'bg-stone-600' },
  'Ojo entreabierto': { color: 'text-amber-300', ring: 'ring-amber-600/40', glow: '', bar: 'bg-amber-600' },
  'Ojo vigilante': { color: 'text-orange-400', ring: 'ring-orange-600/50', glow: 'shadow-[0_0_12px_rgba(249,115,22,0.4)]', bar: 'bg-orange-500' },
  'Ojo parpadeando': { color: 'text-rose-400', ring: 'ring-rose-600/60', glow: 'shadow-[0_0_16px_rgba(244,63,94,0.5)]', bar: 'bg-rose-500' },
  'La Mirada': { color: 'text-red-500', ring: 'ring-red-500/80', glow: 'shadow-[0_0_24px_rgba(239,68,68,0.7)]', bar: 'bg-red-600' },
};

const EyeShadowPanel = ({ eye, canEdit, busy, onIncrement, onApplyShadow }) => {
  const [shadowAmt, setShadowAmt] = useState(1);
  const [shadowReason, setShadowReason] = useState('');
  const band = eye?.band || 'Ojo dormido';
  const style = EYE_STYLE[band] || EYE_STYLE['Ojo dormido'];
  const ratio = Math.max(0, Math.min(1, eye?.ratio || 0));
  const isWatching = band === 'La Mirada' || band === 'Ojo parpadeando';

  return (
    <div className="rounded-xl border border-red-900/50 bg-gradient-to-b from-black/70 to-red-950/20 p-3" data-testid="eye-panel">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-red-300 flex items-center gap-1"><Eye className="w-4 h-4" /> Ojo de Mordor</h3>
        {canEdit && eye?.will_trigger && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-700 text-red-50 animate-pulse" data-testid="eye-trigger-warn">¡Umbral alcanzado!</span>
        )}
      </div>

      {/* Iris rúnico */}
      <div className="flex flex-col items-center py-2">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-black/60 ring-2 ${style.ring} ${style.glow} ${isWatching ? 'animate-pulse' : ''}`}>
          <Eye className={`w-9 h-9 ${style.color}`} />
        </div>
        <div className={`mt-1.5 text-xs font-heading tracking-wide ${style.color}`} data-testid="eye-band">{band}</div>
      </div>

      {canEdit && eye?.threshold_info && (
        <>
          <div className="text-[11px] text-stone-400 flex items-center justify-between mb-1">
            <span>Atención: <span className="text-red-300 font-mono">{eye.attention_total}</span> / {eye.threshold_info.threshold}</span>
            <span className="capitalize text-stone-500">{eye.threshold_info.region_type}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-800 overflow-hidden border border-black/40 mb-2">
            <div className={`h-full transition-all ${style.bar}`} style={{ width: `${ratio * 100}%` }} />
          </div>
          <div className="flex items-center gap-1 mb-3">
            <span className="text-[10px] text-red-300/60 mr-1">Incrementar Ojo:</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => onIncrement(d)}
                disabled={busy}
                className="flex-1 text-xs px-2 py-1 rounded bg-red-900/40 text-red-200 hover:bg-red-800/60 disabled:opacity-40 border border-red-800/40"
                data-testid={`eye-inc-${d}`}
              >+{d}</button>
            ))}
          </div>
        </>
      )}

      {/* Control de Sombra (solo DJ) */}
      {canEdit && (
        <div className="rounded-lg border border-purple-800/40 bg-purple-950/20 p-2" data-testid="shadow-control">
          <div className="text-[11px] text-purple-200 mb-1.5 flex items-center gap-1">⚫ Sombra a la Compañía</div>
          <div className="flex items-center gap-1 mb-1.5">
            <button onClick={() => setShadowAmt((v) => v - 1)} className="px-1.5 rounded bg-black/50 text-purple-300 hover:bg-purple-900/40" data-testid="shadow-amt-minus"><Minus className="w-3 h-3" /></button>
            <input
              type="number" value={shadowAmt}
              onChange={(e) => setShadowAmt(parseInt(e.target.value || '0', 10))}
              className="w-12 bg-black/40 rounded text-center text-purple-100 text-sm py-1 outline-none border border-purple-900/30"
              data-testid="shadow-amt-input"
            />
            <button onClick={() => setShadowAmt((v) => v + 1)} className="px-1.5 rounded bg-black/50 text-purple-300 hover:bg-purple-900/40" data-testid="shadow-amt-plus"><Plus className="w-3 h-3" /></button>
            <input
              value={shadowReason}
              onChange={(e) => setShadowReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="flex-1 min-w-0 bg-black/40 rounded px-2 py-1 text-xs text-purple-100 placeholder-purple-500/30 outline-none border border-purple-900/30"
              data-testid="shadow-reason-input"
            />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={() => { onApplyShadow(shadowAmt, shadowReason); setShadowReason(''); }}
              disabled={busy || shadowAmt === 0}
              className="flex-1 bg-purple-800 hover:bg-purple-700 text-purple-50 h-7 text-xs disabled:opacity-40"
              data-testid="apply-shadow-btn"
            >Aplicar a la Compañía</Button>
            <Button
              size="sm" variant="outline"
              onClick={() => onApplyShadow(1, 'Prueba de Sombra fallida')}
              disabled={busy}
              className="border-purple-700/50 text-purple-200 hover:bg-purple-900/30 h-7 text-xs"
              title="Aplica +1 Sombra a todos por una prueba fallida"
              data-testid="shadow-test-btn"
            >Prueba de Sombra</Button>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="text-[11px] text-stone-500 italic text-center">La atención del Enemigo se cierne sobre la Compañía…</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
const DjScreenPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [run, setRun] = useState(null);
  const [screen, setScreen] = useState(null);
  const [channels, setChannels] = useState([{ channel: 'group', label: 'Grupo' }]);
  const [syncing, setSyncing] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  const [notesPending, setNotesPending] = useState(false);
  const notesTimer = useRef(null);
  const screenRef = useRef(null);
  const canEditRef = useRef(false);
  const wsRef = useRef(null);
  const [chatEvent, setChatEvent] = useState(null);
  const [wsLive, setWsLive] = useState(false);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { canEditRef.current = canEdit; }, [canEdit]);

  // Enemy add form
  const [enemy, setEnemy] = useState({ name: '', hp_max: 10, ac: 12, initiative: 0 });
  // Bestiary picker
  const [showBestiary, setShowBestiary] = useState(false);
  const [bestiaryCat, setBestiaryCat] = useState('malignos');
  const [bestiarySearch, setBestiarySearch] = useState('');
  const [bestiaryResults, setBestiaryResults] = useState([]);
  const [bestiaryLoading, setBestiaryLoading] = useState(false);
  // Motor de ataque
  const [attackerId, setAttackerId] = useState(null);
  const [defenderId, setDefenderId] = useState(null);
  const [attackMode, setAttackMode] = useState('normal');
  const [attacking, setAttacking] = useState(false);
  // Ojo de Mordor + Sombra
  const [eye, setEye] = useState(null);
  const [eyeBusy, setEyeBusy] = useState(false);
  // Herramientas de encuentro
  const [trap, setTrap] = useState({ name: '', damage: '2d6', cd: 13 });
  const [encBusy, setEncBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [markerLabel, setMarkerLabel] = useState('');
  // Sesiones
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);

  const toPayload = (s) => ({
    scene_image_file_id: s.scene_image_file_id || null,
    notes_private: s.notes_private || '',
    combatants: s.combatants || [],
    current_turn_index: s.current_turn_index || 0,
    round_number: s.round_number || 1,
    combat_active: !!s.combat_active,
    actions_remaining: s.actions_remaining ?? 0,
  });

  const load = useCallback(async () => {
    try {
      const data = await getDjScreen(id);
      setCanEdit(data.can_edit);
      setIsPlayer(data.is_player);
      setRun(data.run);
      setScreen(data.state);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Sin acceso a esta pantalla');
      navigate(-1);
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const loadEye = useCallback(async () => {
    try { setEye(await getCampaignEye(id)); } catch { /* silent */ }
  }, [id]);
  useEffect(() => { loadEye(); }, [loadEye]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await getSessions(id);
      setSessions(data.sessions || []);
      setActiveSession(data.active || null);
    } catch { /* silent */ }
  }, [id]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // WebSocket en vivo: estado del rastreador + chat. El DJ es la fuente de
  // verdad, así que NO se pisa a sí mismo con dj_screen_state entrante.
  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;
    const wsBase = BACKEND_URL.replace(/^http/, 'ws');
    let ws;
    let pingTimer;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`${wsBase}/api/ws/campaign/${id}?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => setWsLive(true);
      ws.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        if (data.type === 'dj_screen_state') {
          if (!canEditRef.current) setScreen(data.state);
        } else if (data.type === 'chat') {
          setChatEvent(data);
        } else if (data.type === 'eye_update') {
          setEye((prev) => ({ ...(prev || {}), ...data }));
        } else if (data.type === 'shadow_applied') {
          if (!canEditRef.current) toast.message('⚫ La Sombra se cierne sobre la Compañía…');
        } else if (data.type === 'session_update') {
          setActiveSession(data.active || null);
          loadSessions();
        }
      };
      ws.onclose = () => {
        setWsLive(false);
        if (!closed) setTimeout(connect, 3000);
      };
      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
      pingTimer = setInterval(() => {
        try { if (ws.readyState === 1) ws.send('ping'); } catch { /* noop */ }
      }, 25000);
    };
    connect();
    return () => {
      closed = true;
      clearInterval(pingTimer);
      try { ws && ws.close(); } catch { /* noop */ }
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Players poll the (sanitized) state. DJ is the source of truth and does not poll.
  useEffect(() => {
    if (canEdit) return undefined;
    const t = setInterval(async () => {
      if (document.hidden || wsLive) return; // WS cubre el tiempo real; poll = respaldo
      try {
        const data = await getDjScreen(id);
        setScreen(data.state);
      } catch { /* silent */ }
    }, 15000);
    return () => clearInterval(t);
  }, [canEdit, id, wsLive]);

  // Load chat peers/channels.
  useEffect(() => {
    (async () => {
      try {
        const res = await getDjChatPeers(id);
        if (res.is_dm) {
          setChannels([
            { channel: 'group', label: 'Grupo' },
            ...res.peers.map((p) => ({ channel: p.channel, label: p.character_name || p.user_name })),
          ]);
        } else {
          setChannels([
            { channel: 'group', label: 'Grupo' },
            { channel: `private:${user?.id}`, label: 'DJ (privado)' },
          ]);
        }
      } catch { /* silent */ }
    })();
  }, [id, user?.id]);

  const persist = async (next) => {
    setScreen(next);
    if (!canEdit) return;
    setSavingFlag(true);
    try { await saveDjScreen(id, toPayload(next)); }
    catch { toast.error('No se pudo guardar'); }
    finally { setSavingFlag(false); }
  };

  const onNotesChange = (val) => {
    setScreen((s) => ({ ...s, notes_private: val }));
    setNotesPending(true);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      // Build payload from the LATEST state (ref) so a concurrent combat
      // update isn't clobbered by a stale closure.
      saveDjScreen(id, toPayload({ ...(screenRef.current || {}), notes_private: val }))
        .catch(() => {})
        .finally(() => setNotesPending(false));
    }, 800);
  };

  // Hay trabajo a medio hacer / guardado en vuelo → avisar al salir.
  const hasPendingWork = canEdit && (savingFlag || notesPending || !!enemy.name.trim());

  const handleBack = () => {
    if (hasPendingWork) {
      const ok = window.confirm(
        'Tienes algo sin guardar o a medio crear (notas, enemigo sin añadir o un guardado en curso). ¿Seguro que quieres salir? Se perderá lo no guardado.',
      );
      if (!ok) return;
    }
    navigate(-1);
  };

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!hasPendingWork) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasPendingWork]);

  const updateCombatant = (next) =>
    persist({ ...screen, combatants: screen.combatants.map((c) => (c.id === next.id ? next : c)) });

  const removeCombatant = (cid) =>
    persist({ ...screen, combatants: screen.combatants.filter((c) => c.id !== cid) });

  const addEnemy = () => {
    if (!enemy.name.trim()) { toast.error('Pon un nombre al enemigo'); return; }
    const c = {
      id: uid(), name: enemy.name.trim(), type: 'enemy', character_id: null,
      initiative: parseInt(enemy.initiative || 0, 10), hp_current: parseInt(enemy.hp_max || 0, 10),
      hp_max: parseInt(enemy.hp_max || 0, 10), ac: parseInt(enemy.ac || 10, 10),
      conditions: [], notes: null, has_portrait: false, atk_bonus: 0, dmg: '1d6',
    };
    persist({ ...screen, combatants: [...screen.combatants, c] });
    setEnemy({ name: '', hp_max: 10, ac: 12, initiative: 0 });
  };

  const sortByInit = () =>
    persist({ ...screen, combatants: [...screen.combatants].sort((a, b) => b.initiative - a.initiative), current_turn_index: 0 });

  // ---- Bestiary picker ----
  const loadBestiary = useCallback(async () => {
    setBestiaryLoading(true);
    try {
      const data = await getBestiary(bestiaryCat, bestiarySearch || null);
      // /data/npcs returns either a grouped dict or a flat list.
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (data && typeof data === 'object') list = data[bestiaryCat] || Object.values(data).flat();
      setBestiaryResults(list);
    } catch { setBestiaryResults([]); }
    finally { setBestiaryLoading(false); }
  }, [bestiaryCat, bestiarySearch]);

  useEffect(() => {
    if (showBestiary) loadBestiary();
  }, [showBestiary, loadBestiary]);

  const addFromBestiary = (npc) => {
    const hp = parseInt(npc.puntos_golpe || npc.pg || 0, 10) || 1;
    const c = {
      id: uid(), name: npc.nombre || 'Criatura', type: 'enemy', character_id: null,
      initiative: 0, hp_current: hp, hp_max: hp,
      ac: parseInt(npc.clase_armadura || npc.ca || 10, 10) || 10,
      conditions: [], notes: npc.categoria ? `Bestiario: ${npc.categoria}` : null, has_portrait: false,
      atk_bonus: parseInt(npc.bonificador_competencia || 0, 10) || 0, dmg: '1d8',
    };
    persist({ ...screen, combatants: [...screen.combatants, c] });
    toast.success(`${c.name} añadido al combate`);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncDjPlayers(id);
      setScreen(res.state);
      toast.success(res.added > 0 ? `${res.added} personaje(s) añadido(s)` : 'Sin nuevos personajes que añadir');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al sincronizar');
    } finally { setSyncing(false); }
  };

  const advanceTurn = (dir) => {
    const n = screen.combatants.length;
    if (n === 0) return;
    let idx = (screen.current_turn_index || 0) + dir;
    let round = screen.round_number || 1;
    if (idx >= n) { idx = 0; round += 1; }
    if (idx < 0) { idx = n - 1; round = Math.max(1, round - 1); }
    persist({ ...screen, current_turn_index: idx, round_number: round });
  };

  const resetCombat = () => persist({ ...screen, current_turn_index: 0, round_number: 1, combat_active: false });

  const doRollInitiative = async () => {
    try {
      const st = await djRollInitiative(id);
      setScreen(st);
      toast.success('Iniciativa tirada — combate iniciado');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al tirar iniciativa');
    }
  };

  // ---- Rastreador de viaje ----
  const [travelParams, setTravelParams] = useState({ tipo_tierra: 'tierras_salvajes', terreno: 'campo_abierto', estacion: 'verano' });
  const [travelEvt, setTravelEvt] = useState(null);
  const [travelLoading, setTravelLoading] = useState(false);

  const genTravelEvent = async () => {
    setTravelLoading(true);
    try {
      const res = await djTravelEvent(id, travelParams);
      setTravelEvt(res);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al generar el acontecimiento');
    } finally {
      setTravelLoading(false);
    }
  };

  const doEyeIncrement = async (delta) => {
    setEyeBusy(true);
    try {
      const res = await djEyeIncrement(id, delta, 'DJ');
      if (res.state) setEye((prev) => ({ ...(prev || {}), attention_total: res.state.attention_total, threshold_info: res.threshold_info, ratio: res.ratio, will_trigger: res.will_trigger }));
      await loadEye();
      toast.success(`Ojo de Mordor +${delta}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo incrementar el Ojo');
    } finally { setEyeBusy(false); }
  };

  const doApplyShadow = async (amount, reason) => {
    setEyeBusy(true);
    try {
      const res = await djApplyShadow(id, amount, reason);
      const n = res.affected?.length || 0;
      toast.success(n > 0 ? `⚫ Sombra ${amount >= 0 ? '+' : ''}${amount} a ${n} héroe(s)` : 'Sin héroes a los que aplicar Sombra');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo aplicar la Sombra');
    } finally { setEyeBusy(false); }
  };

  const fireTrap = async () => {
    const nm = trap.name.trim() || 'Trampa oculta';
    const txt = `⚠️ ¡${nm}! Salvación CD ${trap.cd} o ${trap.damage} de daño.`;
    try {
      await postDjChat(id, { channel: 'group', text: txt });
      toast.message(txt);
    } catch { toast.error('No se pudo disparar la trampa'); }
  };

  const randomShadowEvent = async () => {
    setEncBusy(true);
    try {
      const res = await djShadowEvent(id);
      toast.message(`⚫ ${res.texto}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo generar el suceso');
    } finally { setEncBusy(false); }
  };

  const endEncounter = () => {
    persist({
      ...screen,
      combatants: (screen.combatants || []).filter((c) => c.type === 'player'),
      current_turn_index: 0, round_number: 1, combat_active: false, actions_remaining: 0,
    });
    toast.success('Encuentro terminado: enemigos retirados');
  };

  const setActions = (n) => persist({ ...screen, actions_remaining: Math.max(0, n) });

  // ---- Mapa táctico (tokens) ----
  const moveToken = (tokenId, x, y) =>
    persist({ ...screen, tokens: (screen.tokens || []).map((t) => (t.id === tokenId ? { ...t, x, y } : t)) });

  const placeCombatantTokens = () => {
    const existing = new Set((screen.tokens || []).map((t) => t.ref_id));
    const toAdd = (screen.combatants || []).filter((c) => !existing.has(c.id));
    if (toAdd.length === 0) { toast.message('Todas las fichas ya están en el mapa'); return; }
    const newTokens = toAdd.map((c, i) => ({
      id: uid(), ref_id: c.id, label: c.name,
      x: 0.1 + ((i % 8) * 0.1), y: c.type === 'player' ? 0.85 : 0.15,
      kind: c.type === 'player' ? 'hero' : 'enemy', color: c.type === 'player' ? 'emerald' : 'rose',
    }));
    persist({ ...screen, tokens: [...(screen.tokens || []), ...newTokens] });
    toast.success(`${newTokens.length} ficha(s) colocada(s)`);
  };

  const addMarker = () => {
    const label = (markerLabel || '').trim() || 'Marcador';
    const t = { id: uid(), label, x: 0.5, y: 0.5, kind: 'marker', color: 'amber' };
    persist({ ...screen, tokens: [...(screen.tokens || []), t] });
    setMarkerLabel('');
  };

  const clearTokens = () => persist({ ...screen, tokens: [] });

  const doStartSession = async (titulo) => {
    setSessionBusy(true);
    try {
      await startSession(id, titulo || null);
      await loadSessions();
      toast.success('Sesión iniciada');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo iniciar la sesión');
    } finally { setSessionBusy(false); }
  };

  const doCloseSession = async (sessionId) => {
    setSessionBusy(true);
    try {
      const res = await closeSession(id, sessionId);
      await loadSessions();
      toast.success(res.summary_generated ? 'Sesión cerrada — resumen generado' : 'Sesión cerrada (sin resumen IA)');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo cerrar la sesión');
    } finally { setSessionBusy(false); }
  };

  const doAttack = async () => {
    if (!attackerId || !defenderId || attackerId === defenderId) {
      toast.error('Selecciona atacante y defensor (distintos)');
      return;
    }
    setAttacking(true);
    try {
      const res = await djAttack(id, attackerId, defenderId, attackMode);
      if (res.state) setScreen(res.state);
      if (res.hit) toast.success(res.narrative);
      else toast.message(res.narrative);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error en el ataque');
    } finally {
      setAttacking(false);
    }
  };

  const handleSceneUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'dj_scenes');
    try {
      const res = await fetch(`${BACKEND_URL}/api/storage/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (data.file_id) {
        persist({ ...screen, scene_image_file_id: data.file_id });
        toast.success('Escena actualizada');
      } else throw new Error();
    } catch { toast.error('No se pudo subir la imagen'); }
  };

  if (loading || !screen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const combatants = screen.combatants || [];

  return (
    <div className="min-h-screen bg-stone-950 text-amber-100" data-testid="dj-screen-page">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-amber-700/40 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="text-amber-200 hover:bg-amber-900/30" data-testid="dj-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <div className="min-w-0">
            <h1 className="font-heading text-lg sm:text-xl text-amber-300 truncate flex items-center gap-2">
              <Swords className="w-5 h-5" /> Pantalla del DJ
            </h1>
            <div className="text-xs text-amber-300/60 truncate">{run?.adventure_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-mono px-3 py-1 rounded bg-amber-900/30 border border-amber-700/40" data-testid="round-display">
            Ronda {screen.round_number} {combatants.length > 0 && `· Turno de ${combatants[screen.current_turn_index]?.name || '—'}`}
          </div>
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => advanceTurn(-1)} className="border-amber-700/50 text-amber-200" data-testid="turn-prev-btn"><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" onClick={() => advanceTurn(1)} className="bg-amber-700 hover:bg-amber-600 text-amber-50" data-testid="turn-next-btn">Siguiente <ChevronRight className="w-4 h-4 ml-1" /></Button>
              <Button size="sm" variant="outline" onClick={resetCombat} className="border-amber-700/50 text-amber-200" data-testid="combat-reset-btn"><RotateCcw className="w-4 h-4" /></Button>
              {savingFlag && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
            </>
          )}
          {isPlayer && <span className="text-xs px-2 py-1 rounded bg-stone-800 text-stone-300">Vista de jugador</span>}
          <span
            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${activeSession ? 'bg-emerald-900/40 text-emerald-300' : 'bg-stone-800 text-stone-400'}`}
            data-testid="session-status"
            title={activeSession ? `Sesión activa: ${activeSession.titulo}` : 'Sin sesión activa'}
          >
            <ScrollText className="w-3.5 h-3.5" />
            {activeSession ? (activeSession.titulo || `Sesión ${activeSession.numero}`) : 'Sin sesión'}
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowSessions(true)} className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-8 px-2 text-xs" data-testid="open-sessions-btn"><ScrollText className="w-3.5 h-3.5 mr-1" /> Sesiones</Button>
          <Button size="sm" variant="outline" onClick={() => setShowRules(true)} className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-8 px-2 text-xs" data-testid="open-rules-btn"><BookOpen className="w-3.5 h-3.5 mr-1" /> Reglas</Button>
          <span
            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${wsLive ? 'bg-emerald-900/40 text-emerald-300' : 'bg-stone-800 text-stone-400'}`}
            data-testid="ws-status"
            title={wsLive ? 'Conexión en vivo (WebSocket)' : 'Sin conexión en vivo (respaldo por sondeo)'}
          >
            <span className={`w-2 h-2 rounded-full ${wsLive ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
            {wsLive ? 'En vivo' : 'Reconectando…'}
          </span>
        </div>
      </div>

      {/* Body: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr_20rem] gap-3 p-3">
        {/* LEFT — notes + chat */}
        <div className="space-y-3 order-3 lg:order-1">
          {canEdit && (
            <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3" data-testid="dj-notes-card">
              <h3 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-1"><NotebookPen className="w-4 h-4" /> Notas del DJ</h3>
              <textarea
                value={screen.notes_private}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={6}
                placeholder="Notas privadas de la sesión…"
                className="w-full bg-black/40 rounded p-2 text-sm text-amber-100 placeholder-amber-500/30 outline-none border border-amber-900/30 resize-y"
                data-testid="dj-notes-textarea"
              />
            </div>
          )}

          {canEdit && (
            <div className="rounded-xl border border-emerald-700/40 bg-black/50 p-3" data-testid="travel-tracker">
              <h3 className="text-sm font-medium text-emerald-300 mb-2 flex items-center gap-1"><Compass className="w-4 h-4" /> Rastreador de viaje</h3>
              <div className="grid grid-cols-3 gap-1 mb-2">
                <select value={travelParams.tipo_tierra} onChange={(e) => setTravelParams({ ...travelParams, tipo_tierra: e.target.value })} className="bg-black/40 rounded px-1 py-1 text-[11px] text-emerald-100 outline-none border border-emerald-900/30" data-testid="travel-tierra">
                  <option value="libres">T. libres</option>
                  <option value="fronteras">Fronteras</option>
                  <option value="tierras_salvajes">T. salvajes</option>
                  <option value="tierras_oscuras">T. oscuras</option>
                </select>
                <select value={travelParams.terreno} onChange={(e) => setTravelParams({ ...travelParams, terreno: e.target.value })} className="bg-black/40 rounded px-1 py-1 text-[11px] text-emerald-100 outline-none border border-emerald-900/30" data-testid="travel-terreno">
                  <option value="campo_abierto">Campo abierto</option>
                  <option value="bosque">Bosque</option>
                  <option value="colinas">Colinas</option>
                  <option value="montana">Montaña</option>
                  <option value="pantano">Pantano</option>
                </select>
                <select value={travelParams.estacion} onChange={(e) => setTravelParams({ ...travelParams, estacion: e.target.value })} className="bg-black/40 rounded px-1 py-1 text-[11px] text-emerald-100 outline-none border border-emerald-900/30" data-testid="travel-estacion">
                  <option value="primavera">Primavera</option>
                  <option value="verano">Verano</option>
                  <option value="otono">Otoño</option>
                  <option value="invierno">Invierno</option>
                </select>
              </div>
              <Button size="sm" onClick={genTravelEvent} disabled={travelLoading} className="w-full bg-emerald-700 hover:bg-emerald-600 text-emerald-50 h-7 text-xs" data-testid="gen-travel-event-btn">
                {travelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Compass className="w-3.5 h-3.5 mr-1" /> Generar acontecimiento</>}
              </Button>
              {travelEvt && (
                <div className="mt-2 rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-2 text-[11px]" data-testid="travel-event-card">
                  <div className="text-emerald-200 font-medium">{travelEvt.evento?.nombre}</div>
                  <div className="text-stone-300 mt-0.5">
                    Encargado: <span className="text-amber-300">{travelEvt.objetivo?.papel}</span> · {travelEvt.objetivo?.prueba}
                    {' '}({travelEvt.objetivo?.atributo}/{travelEvt.objetivo?.habilidad}) · CD {travelEvt.cd_prueba}
                  </div>
                  {travelEvt.evento?.consecuencias && <div className="text-stone-400 mt-0.5 italic">{travelEvt.evento.consecuencias}</div>}
                  <div className="flex gap-2 mt-1">
                    {travelEvt.evento?.puntos_sombra > 0 && <span className="text-purple-300">⚫ Sombra +{travelEvt.evento.puntos_sombra}</span>}
                    {travelEvt.evento?.fatigue_cd_increase > 0 && <span className="text-amber-300">💤 Cansancio CD +{travelEvt.evento.fatigue_cd_increase}</span>}
                  </div>
                  <div className="text-[10px] text-emerald-400/60 mt-1">Narrado en el chat de grupo ✓</div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3 h-[420px]" data-testid="dj-chat-card">
            <h3 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Chat</h3>
            <div className="h-[calc(100%-2rem)]">
              <ChatPanel runId={id} channels={channels} myUserId={user?.id} chatEvent={chatEvent} wsLive={wsLive} />
            </div>
          </div>

          <DiceRoller runId={id} />
        </div>

        {/* CENTER — mapa táctico + hero cards */}
        <div className="space-y-3 order-1 lg:order-2">
          <div className="rounded-xl border border-amber-700/40 bg-black/50 overflow-hidden" data-testid="dj-scene-card">
            <div className="flex items-center justify-between px-3 py-2 border-b border-amber-900/30">
              <h3 className="text-sm font-medium text-amber-300 flex items-center gap-1"><Map className="w-4 h-4" /> Mapa táctico</h3>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={placeCombatantTokens} className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/30 h-7 px-2 text-xs" data-testid="place-tokens-btn"><Users className="w-3.5 h-3.5 mr-1" /> Colocar fichas</Button>
                  <input
                    value={markerLabel}
                    onChange={(e) => setMarkerLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMarker()}
                    placeholder="Marcador…"
                    className="w-24 bg-black/40 rounded px-2 h-7 text-xs text-amber-100 placeholder-amber-500/30 outline-none border border-amber-900/30"
                    data-testid="marker-label-input"
                  />
                  <Button size="sm" variant="outline" onClick={addMarker} className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-7 px-2 text-xs" data-testid="add-marker-btn"><MapPin className="w-3.5 h-3.5 mr-1" /> Añadir</Button>
                  {(screen.tokens || []).length > 0 && (
                    <Button size="sm" variant="outline" onClick={clearTokens} className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30 h-7 px-2 text-xs" data-testid="clear-tokens-btn"><Trash2 className="w-3.5 h-3.5" /></Button>
                  )}
                </div>
              )}
            </div>
            <TacticalMap
              fileId={screen.scene_image_file_id}
              tokens={screen.tokens || []}
              canEdit={canEdit}
              onMove={moveToken}
              onUpload={handleSceneUpload}
            />
          </div>

          {/* Hero cards (jugadores) */}
          <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3" data-testid="hero-cards">
            <h3 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Héroes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {combatants.filter((c) => c.type === 'player').map((c) => {
                const pct = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0;
                const purl = `${BACKEND_URL}/api/campaign-runs/${id}/dj-screen/portrait/${c.character_id}`;
                const down = c.hp_current <= 0 || (c.conditions || []).map((x) => String(x).toLowerCase()).includes('inconsciente');
                return (
                  <div key={c.id} className={`rounded-lg border p-2 flex flex-col items-center relative ${down ? 'border-rose-700 bg-rose-950/30 opacity-70' : 'border-emerald-800/40 bg-emerald-950/10'}`} data-testid={`hero-card-${c.id}`}>
                    {down && <span className="absolute top-1 right-1 text-[9px] px-1 rounded bg-rose-700 text-rose-50" data-testid={`hero-down-${c.id}`}>Caído</span>}
                    {c.has_portrait ? (
                      <AuthenticatedImage url={purl} alt={c.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-emerald-600/40" fallbackClassName="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-900/50 text-emerald-300 flex items-center justify-center"><Users className="w-5 h-5" /></div>
                    )}
                    <div className="text-xs font-medium text-emerald-100 mt-1 text-center truncate w-full">{c.name}</div>
                    <div className="flex items-center gap-2 text-[10px] mt-0.5">
                      <span className="text-sky-300 flex items-center gap-0.5"><Shield className="w-3 h-3" />{c.ac}</span>
                      <span className="text-rose-300">{c.hp_current}/{c.hp_max}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden mt-1">
                      <div className={`h-full ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-rose-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {combatants.filter((c) => c.type === 'player').length === 0 && (
                <p className="text-xs text-stone-500 italic col-span-full">
                  {canEdit ? 'Pulsa "Sincronizar jugadores" para cargar los personajes aceptados.' : '— sin héroes —'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — initiative tracker */}
        <div className="space-y-3 order-2 lg:order-3">
          <EyeShadowPanel
            eye={eye}
            canEdit={canEdit}
            busy={eyeBusy}
            onIncrement={doEyeIncrement}
            onApplyShadow={doApplyShadow}
          />

          {canEdit && (
            <div className="rounded-xl border border-orange-800/50 bg-black/50 p-3" data-testid="encounter-tools">
              <h3 className="text-sm font-medium text-orange-300 mb-2 flex items-center gap-1"><Flame className="w-4 h-4" /> Encuentro</h3>

              {/* Acciones restantes */}
              <div className="flex items-center justify-between mb-2 rounded-lg border border-amber-900/40 bg-amber-950/10 px-2 py-1.5">
                <span className="text-[11px] text-amber-300/80">Acciones restantes</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setActions((screen.actions_remaining ?? 0) - 1)} className="px-1.5 rounded bg-black/50 text-amber-300 hover:bg-amber-900/40" data-testid="actions-minus"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center font-mono text-amber-100" data-testid="actions-count">{screen.actions_remaining ?? 0}</span>
                  <button onClick={() => setActions((screen.actions_remaining ?? 0) + 1)} className="px-1.5 rounded bg-black/50 text-emerald-300 hover:bg-emerald-900/40" data-testid="actions-plus"><Plus className="w-3 h-3" /></button>
                </div>
              </div>

              {/* Trampa */}
              <div className="rounded-lg border border-orange-900/40 bg-orange-950/10 p-2 mb-2" data-testid="trap-form">
                <div className="text-[11px] text-orange-200 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Disparar trampa</div>
                <input value={trap.name} onChange={(e) => setTrap({ ...trap, name: e.target.value })} placeholder="Nombre (p. ej. Foso con estacas)"
                  className="w-full bg-black/40 rounded px-2 py-1 text-xs text-amber-100 placeholder-amber-500/30 outline-none border border-orange-900/30 mb-1" data-testid="trap-name" />
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-stone-400">Daño</span>
                  <input value={trap.damage} onChange={(e) => setTrap({ ...trap, damage: e.target.value })} className="w-16 bg-black/40 rounded px-1 py-0.5 text-xs text-center text-rose-200 outline-none border border-orange-900/30" data-testid="trap-damage" />
                  <span className="text-[10px] text-stone-400">CD</span>
                  <input type="number" value={trap.cd} onChange={(e) => setTrap({ ...trap, cd: parseInt(e.target.value || '0', 10) })} className="w-12 bg-black/40 rounded px-1 py-0.5 text-xs text-center text-amber-200 outline-none border border-orange-900/30" data-testid="trap-cd" />
                </div>
                <Button size="sm" onClick={fireTrap} className="w-full bg-orange-700 hover:bg-orange-600 text-orange-50 h-7 text-xs" data-testid="fire-trap-btn"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Disparar</Button>
              </div>

              <div className="flex gap-1">
                <Button size="sm" onClick={randomShadowEvent} disabled={encBusy} className="flex-1 bg-purple-800 hover:bg-purple-700 text-purple-50 h-7 text-xs disabled:opacity-40" data-testid="shadow-event-btn">
                  {encBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>⚫ Suceso de Sombra</>}
                </Button>
                <Button size="sm" variant="outline" onClick={endEncounter} className="flex-1 border-rose-700/50 text-rose-200 hover:bg-rose-900/30 h-7 text-xs" data-testid="end-encounter-btn"><XCircle className="w-3.5 h-3.5 mr-1" /> Terminar</Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3" data-testid="initiative-tracker">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-amber-300 flex items-center gap-1"><Swords className="w-4 h-4" /> Iniciativa</h3>
              {canEdit && (
                <div className="flex gap-1">
                  {screen.combat_active ? (
                    <Button size="sm" variant="outline" onClick={resetCombat} className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30 h-7 px-2 text-xs" data-testid="end-combat-btn">Terminar combate</Button>
                  ) : (
                    <Button size="sm" onClick={doRollInitiative} className="bg-amber-700 hover:bg-amber-600 text-amber-50 h-7 px-2 text-xs" title="Tirar iniciativa (solo al inicio)" data-testid="roll-initiative-btn"><Dices className="w-3.5 h-3.5 mr-1" />Iniciativa</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={sortByInit} className="border-amber-700/50 text-amber-200 h-7 px-2" title="Ordenar por iniciativa" data-testid="sort-init-btn"><ArrowDownWideNarrow className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" onClick={handleSync} disabled={syncing} className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 h-7 px-2 text-xs" data-testid="sync-players-btn">
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )}
            </div>

            {canEdit && combatants.length > 0 && (
              <div className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-2 mb-3" data-testid="attack-bar">
                <div className="text-xs text-amber-300 mb-1 flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> Ataque d20</div>
                <div className="text-[11px] text-stone-300 mb-1.5">
                  <span className="text-amber-300">{combatants.find((c) => c.id === attackerId)?.name || '— atacante —'}</span>
                  <span className="mx-1 text-stone-500">→</span>
                  <span className="text-sky-300">{combatants.find((c) => c.id === defenderId)?.name || '— defensor —'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex rounded overflow-hidden border border-amber-900/40">
                    {[['normal', 'N'], ['advantage', 'Vent.'], ['disadvantage', 'Desv.']].map(([m, lbl]) => (
                      <button
                        key={m}
                        onClick={() => setAttackMode(m)}
                        className={`text-[10px] px-1.5 py-1 ${attackMode === m ? 'bg-amber-700 text-amber-50' : 'bg-black/40 text-amber-300/60 hover:bg-amber-900/30'}`}
                        data-testid={`attack-mode-${m}`}
                      >{lbl}</button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    onClick={doAttack}
                    disabled={attacking || !attackerId || !defenderId || attackerId === defenderId}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-amber-50 h-7 text-xs disabled:opacity-40"
                    data-testid="attack-btn"
                  >
                    {attacking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Swords className="w-3.5 h-3.5 mr-1" /> ¡Atacar!</>}
                  </Button>
                </div>
              </div>
            )}

            {canEdit && (
              <div className="rounded-lg border border-rose-800/40 bg-rose-950/10 p-2 mb-3" data-testid="add-enemy-form">
                <div className="text-xs text-rose-300 mb-1 flex items-center gap-1"><Skull className="w-3.5 h-3.5" /> Añadir enemigo</div>
                <input value={enemy.name} onChange={(e) => setEnemy({ ...enemy, name: e.target.value })} placeholder="Nombre"
                  className="w-full bg-black/40 rounded px-2 py-1 text-sm mb-1 outline-none text-amber-100 placeholder-amber-500/30" data-testid="enemy-name-input" />
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <label className="text-[10px] text-stone-400">PG<input type="number" value={enemy.hp_max} onChange={(e) => setEnemy({ ...enemy, hp_max: e.target.value })} className="w-full bg-black/40 rounded px-1 py-0.5 text-sm text-center outline-none" data-testid="enemy-hp-input" /></label>
                  <label className="text-[10px] text-stone-400">CA<input type="number" value={enemy.ac} onChange={(e) => setEnemy({ ...enemy, ac: e.target.value })} className="w-full bg-black/40 rounded px-1 py-0.5 text-sm text-center outline-none" data-testid="enemy-ac-input" /></label>
                  <label className="text-[10px] text-stone-400">Init<input type="number" value={enemy.initiative} onChange={(e) => setEnemy({ ...enemy, initiative: e.target.value })} className="w-full bg-black/40 rounded px-1 py-0.5 text-sm text-center outline-none" data-testid="enemy-init-input" /></label>
                </div>
                <Button size="sm" onClick={addEnemy} className="w-full bg-rose-700 hover:bg-rose-600 text-rose-50 h-7 text-xs" data-testid="add-enemy-btn"><Plus className="w-3.5 h-3.5 mr-1" /> Añadir manual</Button>
                <Button size="sm" variant="outline" onClick={() => setShowBestiary(true)} className="w-full border-rose-700/50 text-rose-200 hover:bg-rose-900/30 h-7 text-xs mt-1" data-testid="open-bestiary-btn"><Skull className="w-3.5 h-3.5 mr-1" /> Del bestiario…</Button>
              </div>
            )}

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {combatants.length === 0 && <p className="text-xs text-stone-500 italic">— combate vacío —</p>}
              {combatants.map((c, idx) => (
                <CombatantCard
                  key={c.id} c={c} idx={idx}
                  isActive={idx === screen.current_turn_index}
                  canEdit={canEdit}
                  onChange={updateCombatant}
                  onRemove={removeCombatant}
                  runId={id}
                  isAttacker={c.id === attackerId}
                  isDefender={c.id === defenderId}
                  onSelectAttacker={(cid) => setAttackerId((p) => (p === cid ? null : cid))}
                  onSelectDefender={(cid) => setDefenderId((p) => (p === cid ? null : cid))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bestiary picker modal */}
      {showBestiary && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowBestiary(false)} data-testid="bestiary-modal">
          <div className="bg-zinc-900 rounded-xl border border-rose-700/40 p-4 max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading text-lg text-rose-300 flex items-center gap-2"><Skull className="w-5 h-5" /> Bestiario</h3>
              <button onClick={() => setShowBestiary(false)} className="text-stone-400 hover:text-white" data-testid="bestiary-close"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex gap-2 mb-2">
              <select value={bestiaryCat} onChange={(e) => setBestiaryCat(e.target.value)} className="bg-black/50 rounded px-2 py-1.5 text-sm text-amber-100 outline-none border border-amber-900/30" data-testid="bestiary-category">
                <option value="malignos">Malignos</option>
                <option value="pnj">PNJ</option>
                <option value="animales">Animales</option>
                <option value="especiales">Especiales</option>
              </select>
              <input value={bestiarySearch} onChange={(e) => setBestiarySearch(e.target.value)} placeholder="Buscar…" className="flex-1 bg-black/50 rounded px-2 py-1.5 text-sm text-amber-100 placeholder-amber-500/30 outline-none border border-amber-900/30" data-testid="bestiary-search" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {bestiaryLoading && <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-rose-400 mx-auto" /></div>}
              {!bestiaryLoading && bestiaryResults.length === 0 && <p className="text-sm text-stone-500 italic text-center py-6">— sin resultados —</p>}
              {!bestiaryLoading && bestiaryResults.map((npc) => (
                <button key={npc.id} onClick={() => addFromBestiary(npc)} className="w-full text-left rounded border border-rose-800/30 bg-rose-950/10 hover:bg-rose-900/30 p-2 flex items-center justify-between gap-2 transition-colors" data-testid={`bestiary-item-${npc.id}`}>
                  <span className="text-sm text-amber-100 font-medium truncate">{npc.nombre}</span>
                  <span className="text-xs text-stone-300 shrink-0 flex items-center gap-2">
                    <span className="text-sky-300"><Shield className="w-3 h-3 inline" /> {npc.clase_armadura ?? '—'}</span>
                    <span className="text-rose-300"><Heart className="w-3 h-3 inline" /> {npc.puntos_golpe ?? '—'}</span>
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 mt-2">Pulsa una criatura para añadirla al rastreador con sus PG/CA.</p>
          </div>
        </div>
      )}

      {/* d20 de tirada rápida (compartida) */}
      <button
        onClick={async () => {
          try {
            const res = await djRollDice(id, 20, 1, 0, true);
            toast.message(`🎲 d20 = ${res.total}`);
          } catch { toast.error('Error al tirar'); }
        }}
        className="fixed bottom-4 right-4 z-[90] w-14 h-14 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 shadow-lg shadow-black/50 border-2 border-amber-500/50 flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title="Tirar 1d20 (compartido en el chat)"
        data-testid="quick-d20-btn"
      >
        <Dices className="w-5 h-5" />
        <span className="text-[9px] font-heading leading-none mt-0.5">d20</span>
      </button>

      <RulesReferenceModal open={showRules} onClose={() => setShowRules(false)} canOpenFull={canEdit} />
      <SessionsModal
        open={showSessions}
        onClose={() => setShowSessions(false)}
        sessions={sessions}
        active={activeSession}
        canEdit={canEdit}
        onStart={doStartSession}
        onCloseSession={doCloseSession}
        busy={sessionBusy}
      />
    </div>
  );
};

export default DjScreenPage;
