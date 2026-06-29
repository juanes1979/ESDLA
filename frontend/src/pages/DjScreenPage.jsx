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
  Image as ImageIcon, Users, NotebookPen, MessageSquare, Skull, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getDjScreen, saveDjScreen, syncDjPlayers,
  getDjChat, postDjChat, getDjChatPeers,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import AuthenticatedImage from '@/components/AuthenticatedImage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const getToken = () =>
  localStorage.getItem('lotr5e_token') || sessionStorage.getItem('lotr5e_token');

const uid = () => `c_${Math.random().toString(36).slice(2, 10)}`;

const BAND_COLOR = {
  ileso: 'text-emerald-300', 'herido leve': 'text-lime-300',
  herido: 'text-amber-300', malherido: 'text-orange-400',
  caído: 'text-rose-500', desconocido: 'text-stone-400',
};

// ---------------------------------------------------------------------------
const CombatantCard = ({ c, idx, isActive, canEdit, onChange, onRemove, runId }) => {
  const [condInput, setCondInput] = useState('');
  const pct = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0;
  const isEnemy = c.type === 'enemy';

  const portraitUrl = c.character_id
    ? `${BACKEND_URL}/api/campaign-runs/${runId}/dj-screen/portrait/${c.character_id}`
    : null;

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors ${
        isActive
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
            {cond}
            {canEdit && (
              <button onClick={() => onChange({ ...c, conditions: c.conditions.filter((x) => x !== cond) })} className="hover:text-white">
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {canEdit && (
          <input
            value={condInput}
            onChange={(e) => setCondInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && condInput.trim()) {
                const v = condInput.trim();
                if (!(c.conditions || []).includes(v)) onChange({ ...c, conditions: [...(c.conditions || []), v] });
                setCondInput('');
              }
            }}
            placeholder="+ estado"
            className="text-[10px] bg-black/40 rounded px-1.5 py-0.5 text-purple-200 placeholder-purple-400/40 outline-none w-20"
            data-testid={`combatant-cond-input-${c.id}`}
          />
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
const ChatPanel = ({ runId, channels, myUserId }) => {
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
    const t = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => clearInterval(t);
  }, [load]);
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
  const notesTimer = useRef(null);
  const screenRef = useRef(null);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // Enemy add form
  const [enemy, setEnemy] = useState({ name: '', hp_max: 10, ac: 12, initiative: 0 });

  const toPayload = (s) => ({
    scene_image_file_id: s.scene_image_file_id || null,
    notes_private: s.notes_private || '',
    combatants: s.combatants || [],
    current_turn_index: s.current_turn_index || 0,
    round_number: s.round_number || 1,
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

  // Players poll the (sanitized) state. DJ is the source of truth and does not poll.
  useEffect(() => {
    if (canEdit) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const data = await getDjScreen(id);
        setScreen(data.state);
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(t);
  }, [canEdit, id]);

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
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      // Build payload from the LATEST state (ref) so a concurrent combat
      // update isn't clobbered by a stale closure.
      saveDjScreen(id, toPayload({ ...(screenRef.current || {}), notes_private: val })).catch(() => {});
    }, 800);
  };

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
      conditions: [], notes: null, has_portrait: false,
    };
    persist({ ...screen, combatants: [...screen.combatants, c] });
    setEnemy({ name: '', hp_max: 10, ac: 12, initiative: 0 });
  };

  const sortByInit = () =>
    persist({ ...screen, combatants: [...screen.combatants].sort((a, b) => b.initiative - a.initiative), current_turn_index: 0 });

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

  const resetCombat = () => persist({ ...screen, current_turn_index: 0, round_number: 1 });

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
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-amber-200 hover:bg-amber-900/30" data-testid="dj-back-btn">
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
                rows={8}
                placeholder="Notas privadas de la sesión…"
                className="w-full bg-black/40 rounded p-2 text-sm text-amber-100 placeholder-amber-500/30 outline-none border border-amber-900/30 resize-y"
                data-testid="dj-notes-textarea"
              />
            </div>
          )}
          <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3 h-[420px]" data-testid="dj-chat-card">
            <h3 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Chat</h3>
            <div className="h-[calc(100%-2rem)]">
              <ChatPanel runId={id} channels={channels} myUserId={user?.id} />
            </div>
          </div>
        </div>

        {/* CENTER — scene + hero cards */}
        <div className="space-y-3 order-1 lg:order-2">
          <div className="rounded-xl border border-amber-700/40 bg-black/50 overflow-hidden" data-testid="dj-scene-card">
            <div className="relative">
              {screen.scene_image_file_id ? (
                <AuthenticatedImage fileId={screen.scene_image_file_id} alt="Escena"
                  className="w-full max-h-[420px] object-contain bg-black" />
              ) : (
                <div className="w-full h-64 flex flex-col items-center justify-center text-amber-300/40 bg-black/30">
                  <ImageIcon className="w-10 h-10 mb-2" />
                  <span className="text-sm">Sin escena</span>
                </div>
              )}
              {canEdit && (
                <label className="absolute bottom-2 right-2 cursor-pointer bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs px-3 py-1.5 rounded flex items-center gap-1" data-testid="scene-upload-label">
                  <ImageIcon className="w-3.5 h-3.5" /> Cambiar escena
                  <input type="file" accept="image/*" className="hidden" onChange={handleSceneUpload} data-testid="scene-upload-input" />
                </label>
              )}
            </div>
          </div>

          {/* Hero cards (jugadores) */}
          <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3" data-testid="hero-cards">
            <h3 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Héroes</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {combatants.filter((c) => c.type === 'player').map((c) => {
                const pct = c.hp_max > 0 ? Math.max(0, Math.min(100, (c.hp_current / c.hp_max) * 100)) : 0;
                const purl = `${BACKEND_URL}/api/campaign-runs/${id}/dj-screen/portrait/${c.character_id}`;
                return (
                  <div key={c.id} className="rounded-lg border border-emerald-800/40 bg-emerald-950/10 p-2 flex flex-col items-center" data-testid={`hero-card-${c.id}`}>
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
          <div className="rounded-xl border border-amber-700/40 bg-black/50 p-3" data-testid="initiative-tracker">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-amber-300 flex items-center gap-1"><Swords className="w-4 h-4" /> Iniciativa</h3>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={sortByInit} className="border-amber-700/50 text-amber-200 h-7 px-2" title="Ordenar por iniciativa" data-testid="sort-init-btn"><ArrowDownWideNarrow className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" onClick={handleSync} disabled={syncing} className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 h-7 px-2 text-xs" data-testid="sync-players-btn">
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              )}
            </div>

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
                <Button size="sm" onClick={addEnemy} className="w-full bg-rose-700 hover:bg-rose-600 text-rose-50 h-7 text-xs" data-testid="add-enemy-btn"><Plus className="w-3.5 h-3.5 mr-1" /> Añadir</Button>
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
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DjScreenPage;
