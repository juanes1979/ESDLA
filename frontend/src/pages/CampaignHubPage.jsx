/**
 * Campaign Hub Page — panel principal del DJ para una campaña activa.
 *
 * Tabs:
 *  - Información   → datos generales + código + estado + transitions.
 *  - Contenido     → PNJs / entornos / intrigas / mapas (clonados).
 *  - Jugadores     → (placeholder: Fase 3).
 *  - Registro      → log cronológico.
 *
 * Sólo el DM y el Maestro pueden acceder.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Play,
  Pause,
  Flag,
  UserCheck,
  UserX,
  UserMinus,
  Sparkles,
  Megaphone,
  MegaphoneOff,
  Eye,
  EyeOff,
  ScrollText,
  Swords,
  UserPlus,
  Send,
  Clock,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCampaignRun,
  getCampaignContent,
  getCampaignLog,
  activateCampaignRun,
  pauseCampaignRun,
  finishCampaignRun,
  listCampaignPlayers,
  updatePlayerStatus,
  createCampaignListing,
  deleteCampaignListing,
  listCampaignListings,
  getXpStats,
  revealText,
  listAvailablePlayers,
  createInvitation,
  sentInvitations,
  cancelInvitation,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import RuneIgniteOverlay from '@/components/adventures/RuneIgniteOverlay';
import AwardXPDialog from '@/components/adventures/AwardXPDialog';
import ScrollOfDeedsReveal from '@/components/adventures/ScrollOfDeedsReveal';
import AuthenticatedImage from '@/components/AuthenticatedImage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_BADGE = {
  draft: 'bg-stone-700 text-stone-200',
  active: 'bg-emerald-700/80 text-emerald-100',
  paused: 'bg-amber-700/80 text-amber-100',
  finished: 'bg-rose-900/70 text-rose-200',
};

const TABS = [
  { id: 'info', label: 'Información' },
  { id: 'content', label: 'Contenido' },
  { id: 'players', label: 'Jugadores' },
  { id: 'log', label: 'Registro' },
];

const InfoTab = ({
  run,
  onAction,
  onCopyCode,
  copied,
  listing,
  onPublish,
  onUnpublish,
  xpStats,
  isPresRevealed,
  onTogglePresentation,
  togglingPresentation,
}) => (
  <div className="space-y-5">
    <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-amber-300/60 mb-1">
            Código de campaña
          </div>
          <div className="font-mono text-3xl tracking-[0.4em] text-amber-300 select-all" data-testid="campaign-code-display">
            {run.campaign_code}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyCode}
          data-testid="copy-code-hub-btn"
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
        >
          {copied ? <Check className="w-4 h-4 mr-1 text-emerald-400" /> : <Copy className="w-4 h-4 mr-1" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <p className="text-xs text-amber-300/60 mt-3">
        Este código <strong>no se publica</strong> nunca en el tablón. Compártelo solo
        con quien quieras que pueda unirse.
      </p>
    </div>

    {/* Tablón */}
    <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-xl text-amber-300 mb-1">Tablón público</h3>
          <p className="text-xs text-amber-300/60">
            {listing
              ? `Publicado · ${listing.slots_available}/${listing.max_players} plazas · estado ${listing.listing_status}`
              : 'Esta campaña no está publicada en el tablón.'}
          </p>
        </div>
        {listing ? (
          <Button
            onClick={onUnpublish}
            variant="outline"
            data-testid="unpublish-btn"
            className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30"
          >
            <MegaphoneOff className="w-4 h-4 mr-1" /> Despublicar
          </Button>
        ) : (
          <Button
            onClick={onPublish}
            disabled={run.status !== 'active'}
            data-testid="publish-hub-btn"
            className="bg-amber-700 hover:bg-amber-600 text-amber-50"
          >
            <Megaphone className="w-4 h-4 mr-1" /> Publicar en tablón
          </Button>
        )}
      </div>
    </div>

    <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6">
      <h3 className="font-heading text-xl text-amber-300 mb-3">Datos de la campaña</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
        <div><dt className="text-amber-300/60">Aventura base</dt><dd className="text-amber-100">{run.adventure_name || '—'}</dd></div>
        <div><dt className="text-amber-300/60">DJ</dt><dd className="text-amber-100">{run.dm_name || '—'}</dd></div>
        <div><dt className="text-amber-300/60">Cuándo</dt><dd className="text-amber-100">{run.year ? `${run.year} T.E.` : '—'}{run.season ? ` · ${run.season}` : ''}</dd></div>
        <div><dt className="text-amber-300/60">Dónde</dt><dd className="text-amber-100">{run.location_name || run.region || '—'}</dd></div>
        <div><dt className="text-amber-300/60">Jugadores</dt><dd className="text-amber-100">máx. {run.max_players}{run.allow_multi_characters ? ` · multi-personaje (${run.max_characters_per_player ?? '?'})` : ''}</dd></div>
        <div><dt className="text-amber-300/60">Nivel sugerido</dt><dd className="text-amber-100">{run.recommended_level_min ?? '?'}–{run.recommended_level_max ?? '?'}</dd></div>
      </dl>
      {run.description && (
        <div className="mt-4 pt-4 border-t border-amber-800/30">
          <h4 className="text-xs uppercase tracking-widest text-amber-300/60 mb-1">Premisa</h4>
          <p className="text-sm text-gray-200">{run.description}</p>
        </div>
      )}
    </div>

    {/* Texto de presentación a los jugadores */}
    {run.presentation_text && (
      <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6" data-testid="presentation-card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-heading text-xl text-amber-300 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-amber-400" /> Texto para presentar a los jugadores
          </h3>
          <Button
            onClick={onTogglePresentation}
            disabled={togglingPresentation}
            data-testid="toggle-presentation-btn"
            className={
              isPresRevealed
                ? 'bg-rose-700 hover:bg-rose-600 text-rose-50'
                : 'bg-emerald-700 hover:bg-emerald-600 text-emerald-50'
            }
            size="sm"
          >
            {togglingPresentation ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : isPresRevealed ? (
              <EyeOff className="w-4 h-4 mr-1" />
            ) : (
              <Eye className="w-4 h-4 mr-1" />
            )}
            {isPresRevealed ? 'Ocultar a jugadores' : '📜 Mostrar a jugadores'}
          </Button>
        </div>
        <p className="text-sm text-gray-200 whitespace-pre-wrap italic border-l-2 border-amber-700/40 pl-3">
          {run.presentation_text}
        </p>
        {isPresRevealed && (
          <p className="text-xs text-emerald-300/80 mt-2">
            ✓ Visible para los jugadores aceptados.
          </p>
        )}
      </div>
    )}

    {/* XP pool */}
    {xpStats && xpStats.pool && xpStats.pool > 0 && (
      <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6" data-testid="xp-pool-card">
        <h3 className="font-heading text-xl text-amber-300 mb-2">Bote de PX de la aventura</h3>
        <div className="flex items-baseline gap-4 mb-2">
          <div className="text-3xl font-bold text-amber-100" data-testid="xp-remaining">
            {xpStats.remaining}
          </div>
          <div className="text-sm text-amber-300/70">
            PX restantes de <strong className="text-amber-200">{xpStats.pool}</strong>
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-stone-800 overflow-hidden border border-amber-800/40">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
            style={{
              width: `${Math.min(100, (xpStats.used / xpStats.pool) * 100)}%`,
            }}
            data-testid="xp-progress-bar"
          />
        </div>
        <div className="flex justify-between text-xs text-amber-300/60 mt-1">
          <span>Repartidos: {xpStats.used}</span>
          <span>
            (pendientes {xpStats.pending_total} · consolidados {xpStats.consolidated_total})
          </span>
        </div>
      </div>
    )}

    <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-6">
      <h3 className="font-heading text-xl text-amber-300 mb-3">Estado de la campaña</h3>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs px-3 py-1 rounded ${STATUS_BADGE[run.status]}`} data-testid="status-badge">
          {run.status}
        </span>
        {run.activated_at && <span className="text-xs text-amber-300/60">Activada: {new Date(run.activated_at).toLocaleString('es-ES')}</span>}
        {run.finished_at && <span className="text-xs text-rose-300/70">Finalizada: {new Date(run.finished_at).toLocaleString('es-ES')}</span>}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {run.status === 'draft' && (
          <Button onClick={() => onAction('activate')} data-testid="activate-hub-btn" className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50">
            <Play className="w-4 h-4 mr-1" /> Activar campaña
          </Button>
        )}
        {run.status === 'active' && (
          <Button onClick={() => onAction('pause')} data-testid="pause-hub-btn" className="bg-amber-700 hover:bg-amber-600 text-amber-50">
            <Pause className="w-4 h-4 mr-1" /> Pausar
          </Button>
        )}
        {run.status === 'paused' && (
          <Button onClick={() => onAction('activate')} data-testid="resume-hub-btn" className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50">
            <Play className="w-4 h-4 mr-1" /> Reanudar
          </Button>
        )}
        {run.status !== 'finished' && (
          <Button onClick={() => onAction('finish')} variant="outline" data-testid="finish-hub-btn" className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30">
            <Flag className="w-4 h-4 mr-1" /> Finalizar
          </Button>
        )}
      </div>
    </div>
  </div>
);

const ContentTab = ({ content, run, revealedKeys, onToggleEvent, togglingEventId }) => {
  const events = content.travel_events || [];
  const revealed = new Set(revealedKeys || []);
  return (
  <div className="space-y-4">
    <Section title={`PNJs (${content.npcs.length})`} testid="content-npcs">
      {content.npcs.map((n) => (
        <div key={n.id} className="border border-amber-800/30 rounded p-3 bg-black/40">
          <div className="font-medium text-amber-200">{n.name} {n.bestiary_categoria && <span className="text-xs text-amber-300/50">· {n.bestiary_categoria}</span>}</div>
          {n.history && <p className="text-sm text-gray-300 mt-1">{n.history}</p>}
          {n.special && <p className="text-sm italic text-amber-300/80 mt-1">⚡ {n.special}</p>}
        </div>
      ))}
    </Section>
    {events.length > 0 && (
      <Section title={`Acontecimientos de viaje (${events.length})`} testid="content-events">
        <ul className="space-y-3">
          {events.map((ev) => {
            const isRevealed = revealed.has(`event:${ev.id}`);
            return (
              <li key={ev.id} className="border border-amber-800/30 rounded p-3 bg-black/40" data-testid={`content-event-${ev.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-amber-200 font-medium">{ev.title || 'Acontecimiento'}</div>
                    {ev.description && (
                      <p className="text-gray-300/90 text-sm mt-1">{ev.description}</p>
                    )}
                  </div>
                  {ev.player_notes && (
                    <Button
                      size="sm"
                      onClick={() => onToggleEvent(ev.id, !isRevealed)}
                      disabled={togglingEventId === ev.id}
                      data-testid={`toggle-event-reveal-${ev.id}`}
                      className={
                        isRevealed
                          ? 'bg-rose-700 hover:bg-rose-600 text-rose-50'
                          : 'bg-emerald-700 hover:bg-emerald-600 text-emerald-50'
                      }
                    >
                      {togglingEventId === ev.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : isRevealed ? (
                        <EyeOff className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 mr-1" />
                      )}
                      {isRevealed ? 'Ocultar' : '📜 Mostrar'}
                    </Button>
                  )}
                </div>
                {ev.player_notes && (
                  <div className="mt-2 pt-2 border-t border-amber-800/30">
                    <div className="text-xs uppercase tracking-wide text-emerald-300/70 mb-1">
                      Notas para los personajes:
                    </div>
                    <p className="text-sm text-emerald-100/90 whitespace-pre-wrap italic">
                      {ev.player_notes}
                    </p>
                    {isRevealed && (
                      <p className="text-xs text-emerald-300/80 mt-1">✓ Visible para los jugadores</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    )}
    <Section title={`Entornos (${content.environments.length})`} testid="content-environments">
      <ol className="list-decimal pl-5 space-y-2">
        {content.environments.map((e) => (
          <li key={e.id}>
            <span className="text-amber-200 font-medium">{e.title}</span>
            {e.description && <p className="text-gray-300/90 text-sm">{e.description}</p>}
          </li>
        ))}
      </ol>
    </Section>
    <Section title={`Intrigas (${content.intrigues.length})`} testid="content-intrigues">
      <ul className="list-disc pl-5 space-y-1">
        {content.intrigues.map((p) => (
          <li key={p.id} className="text-gray-200">
            {p.description}
            {p.linked_plot && <span className="text-amber-300/60"> — {p.linked_plot}</span>}
          </li>
        ))}
      </ul>
    </Section>
    <Section title={`Mapas (${content.maps.length})`} testid="content-maps">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {content.maps.map((m) => (
          <div key={m.id} className="rounded border border-amber-800/40 overflow-hidden">
            <AuthenticatedImage
              fileId={m.file_id}
              alt={m.description || 'mapa'}
              className="w-full h-32 object-cover"
            />
            {m.description && <div className="text-xs p-1 text-amber-300/80">{m.description}</div>}
          </div>
        ))}
      </div>
    </Section>
    <p className="text-xs text-amber-300/50 italic">
      Este contenido es un clon de la aventura «{run.adventure_name}» — puedes modificarlo
      sin tocar el original (próxima fase añadirá edición inline).
    </p>
  </div>
  );
};

const Section = ({ title, children, testid }) => (
  <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-5" data-testid={testid}>
    <h3 className="font-heading text-lg text-amber-300 mb-3">{title}</h3>
    <div>{children || <p className="text-sm text-gray-500 italic">— vacío —</p>}</div>
  </div>
);

const STATUS_PLAYER_BADGE = {
  pending: 'bg-amber-700/70 text-amber-100',
  accepted: 'bg-emerald-700/70 text-emerald-100',
  rejected: 'bg-rose-900/70 text-rose-200',
  expelled: 'bg-rose-900/70 text-rose-200',
  abandon: 'bg-stone-700/70 text-stone-200',
  finished: 'bg-stone-700/70 text-stone-200',
};

const ORIGIN_LABEL = {
  code: 'código',
  listing: 'tablón',
  invitation: 'invitación',
};

const INV_STATUS_BADGE = {
  pending: 'bg-amber-700/70 text-amber-100',
  accepted: 'bg-emerald-700/70 text-emerald-100',
  rejected: 'bg-rose-900/70 text-rose-200',
  expired: 'bg-stone-700/70 text-stone-300',
  cancelled: 'bg-stone-700/70 text-stone-300',
};

const PlayersTab = ({ players, onAct, igniteId, onAwardXP, availablePlayers, sentInvites, onInvite, onCancelInvite, invitingId }) => {
  const pending = players.filter((p) => p.status === 'pending');
  const accepted = players.filter((p) => p.status === 'accepted');
  const closed = players.filter((p) => !['pending', 'accepted'].includes(p.status));

  // Hide players who already have a pending invitation or are already in the run.
  const busyUserChars = new Set(players.filter((p) => ['pending', 'accepted'].includes(p.status)).map((p) => p.character_id));
  const pendingInvChars = new Set((sentInvites || []).filter((i) => i.status === 'pending').map((i) => i.character_id));
  const invitable = (availablePlayers || []).filter(
    (a) => !busyUserChars.has(a.character_id) && !pendingInvChars.has(a.character_id),
  );

  const renderRow = (p, showAccept = false, showReject = false, showExpel = false, showXP = false) => (
    <div
      key={p.id}
      className="relative rounded border border-amber-800/30 bg-black/40 p-3"
      data-testid={`player-row-${p.id}`}
    >
      {igniteId === p.id && <RuneIgniteOverlay onDone={() => {}} />}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-amber-200 font-medium">
            {p.character_name || '(personaje sin nombre)'}{' '}
            <span className="text-xs text-amber-300/60">· nivel {p.character_level ?? '?'}</span>
            {p.status === 'accepted' && (p.xp_pending_total > 0) && (
              <span
                className="ml-2 px-2 py-0.5 text-xs rounded bg-emerald-900/50 text-emerald-200"
                data-testid={`xp-pending-${p.id}`}
                title="PX pendientes — se consolidan al finalizar"
              >
                +{p.xp_pending_total} PX pend.
              </span>
            )}
          </div>
          <div className="text-xs text-amber-300/60">
            Jugador: {p.user_name || '—'}
            {p.character_culture && <> · {p.character_culture}</>}
            <> · origen: {ORIGIN_LABEL[p.join_origin] || p.join_origin}</>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_PLAYER_BADGE[p.status]}`}>
          {p.status}
        </span>
        <div className="flex gap-1">
          {showAccept && (
            <Button
              size="sm"
              onClick={() => onAct(p, 'accepted')}
              data-testid={`accept-player-${p.id}`}
              className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" /> Aceptar
            </Button>
          )}
          {showReject && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAct(p, 'rejected')}
              data-testid={`reject-player-${p.id}`}
              className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30"
            >
              <UserX className="w-3.5 h-3.5 mr-1" /> Rechazar
            </Button>
          )}
          {showXP && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAwardXP(p)}
              data-testid={`award-xp-${p.id}`}
              className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Otorgar PX
            </Button>
          )}
          {showExpel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAct(p, 'expelled')}
              data-testid={`expel-player-${p.id}`}
              className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30"
            >
              <UserMinus className="w-3.5 h-3.5 mr-1" /> Expulsar
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="players-tab">
      {/* Invitar jugadores disponibles */}
      <Section
        title={`Invitar jugadores disponibles${invitable.length > 0 ? ` (${invitable.length})` : ''}`}
        testid="section-invitable"
      >
        {invitable.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            — no hay jugadores con personaje marcado como "disponible" ahora mismo —
          </p>
        ) : (
          <div className="space-y-2">
            {invitable.map((a) => (
              <div key={a.character_id} className="flex items-center justify-between gap-3 flex-wrap rounded border border-amber-800/30 bg-black/40 p-3" data-testid={`invitable-${a.character_id}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-amber-200 font-medium">
                    {a.character_name || '(personaje)'}{' '}
                    <span className="text-xs text-amber-300/60">· nivel {a.character_level ?? '?'}</span>
                  </div>
                  <div className="text-xs text-amber-300/60">
                    Jugador: {a.user_name || '—'}{a.character_culture && <> · {a.character_culture}</>}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onInvite(a)}
                  disabled={invitingId === a.character_id}
                  data-testid={`invite-player-${a.character_id}`}
                  className="bg-amber-700 hover:bg-amber-600 text-amber-50"
                >
                  {invitingId === a.character_id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                  Invitar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Invitaciones enviadas */}
      {(sentInvites || []).length > 0 && (
        <Section title={`Invitaciones enviadas (${sentInvites.length})`} testid="section-sent-invites">
          <div className="space-y-2">
            {sentInvites.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 flex-wrap rounded border border-amber-800/30 bg-black/40 p-3" data-testid={`sent-invite-${i.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-amber-200 text-sm">
                    <Send className="w-3.5 h-3.5 inline mr-1 text-amber-300/70" />
                    {i.character_name || i.target_user_name || 'Jugador'}
                    {i.character_name && i.target_user_name && <span className="text-xs text-amber-300/60"> · {i.target_user_name}</span>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${INV_STATUS_BADGE[i.status] || 'bg-stone-700/70 text-stone-200'}`}>
                  {i.status === 'pending' && <Clock className="w-3 h-3 inline mr-1" />}
                  {i.status}
                </span>
                {i.status === 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => onCancelInvite(i)} data-testid={`cancel-invite-${i.id}`} className="border-rose-700/50 text-rose-200 hover:bg-rose-900/30">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={
          <>
            Solicitudes pendientes{' '}
            {pending.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-rose-700 text-rose-50 align-middle">
                {pending.length}
              </span>
            )}
          </>
        }
        testid="section-pending"
      >
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500 italic">— sin solicitudes pendientes —</p>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => renderRow(p, true, true))}
          </div>
        )}
      </Section>

      <Section
        title={`En la campaña (${accepted.length})`}
        testid="section-accepted"
      >
        {accepted.length === 0 ? (
          <p className="text-sm text-gray-500 italic">— aún no hay personajes aceptados —</p>
        ) : (
          <div className="space-y-2">
            {accepted.map((p) => renderRow(p, false, false, true, true))}
          </div>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title={`Histórico (${closed.length})`} testid="section-closed">
          <div className="space-y-2">{closed.map((p) => renderRow(p))}</div>
        </Section>
      )}
    </div>
  );
};

const LogTab = ({ log }) => (
  <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-5">
    <h3 className="font-heading text-lg text-amber-300 mb-3">Registro de la campaña</h3>
    {log.length === 0 ? (
      <p className="text-sm text-gray-500 italic">Aún no hay eventos registrados.</p>
    ) : (
      <ul className="space-y-2">
        {log.map((e) => (
          <li key={e.id} className="flex gap-3 text-sm" data-testid={`log-entry-${e.id}`}>
            <span className="text-amber-300/50 shrink-0 font-mono text-xs">
              {new Date(e.created_at).toLocaleString('es-ES')}
            </span>
            <span className="text-gray-200">{e.description}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const CampaignHubPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [content, setContent] = useState({ environments: [], intrigues: [], npcs: [], maps: [] });
  const [log, setLog] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [igniteId, setIgniteId] = useState(null);
  const [pendingSeen, setPendingSeen] = useState(0);
  const [awardingFor, setAwardingFor] = useState(null);
  const [scrollEntries, setScrollEntries] = useState(null);
  const [listing, setListing] = useState(null);
  const [xpStats, setXpStats] = useState(null);
  const [togglingPresentation, setTogglingPresentation] = useState(false);
  const [togglingEventId, setTogglingEventId] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [invitingId, setInvitingId] = useState(null);

  const reload = async () => {
    try {
      const [r, c, l, p, lst, xs] = await Promise.all([
        getCampaignRun(id),
        getCampaignContent(id),
        getCampaignLog(id),
        listCampaignPlayers(id),
        listCampaignListings({ only_open: false }).catch(() => []),
        getXpStats(id).catch(() => null),
      ]);
      setRun(r);
      setContent(c);
      setLog(l);
      setPlayers(p);
      setXpStats(xs);
      // Available players to invite + invitations already sent (DJ-side).
      listAvailablePlayers().then(setAvailablePlayers).catch(() => setAvailablePlayers([]));
      sentInvitations().then((all) => setSentInvites((all || []).filter((i) => i.campaign_run_id === id))).catch(() => setSentInvites([]));
      // find listing for THIS run (if any)
      const mine = (lst || []).find((x) => x.campaign_run_id === id);
      setListing(mine || null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error cargando campaña');
      navigate('/campanas');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePresentation = async () => {
    if (!run) return;
    const isRevealed = (run.revealed_keys || []).includes('presentation');
    setTogglingPresentation(true);
    try {
      const res = await revealText(id, 'presentation', !isRevealed);
      setRun((prev) => ({ ...prev, revealed_keys: res.revealed_keys }));
      toast.success(isRevealed ? 'Texto ocultado a los jugadores' : 'Texto visible para los jugadores');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cambiar la visibilidad');
    } finally {
      setTogglingPresentation(false);
    }
  };

  const handleToggleEventReveal = async (eventId, revealed) => {
    setTogglingEventId(eventId);
    try {
      const res = await revealText(id, `event:${eventId}`, revealed);
      setRun((prev) => ({ ...prev, revealed_keys: res.revealed_keys }));
      toast.success(revealed ? 'Notas visibles para los jugadores' : 'Notas ocultadas');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cambiar la visibilidad');
    } finally {
      setTogglingEventId(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll players every 8s for new requests (only while page is visible).
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const p = await listCampaignPlayers(id);
        setPlayers(p);
      } catch {
        /* silent */
      }
    };
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [id]);

  // Track new pending requests → trigger toast/notification when new ones arrive
  // and the player is NOT currently viewing the players tab.
  const pendingCount = players.filter((p) => p.status === 'pending').length;
  useEffect(() => {
    if (tab === 'players') {
      // Mark current count as seen
      setPendingSeen(pendingCount);
      return;
    }
    if (pendingCount > pendingSeen) {
      const delta = pendingCount - pendingSeen;
      toast.message(
        `🔔 ${delta} nueva${delta > 1 ? 's' : ''} solicitud${delta > 1 ? 'es' : ''} de unión`,
        { description: 'Pulsa la pestaña Jugadores para revisarla.' },
      );
      setPendingSeen(pendingCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, tab]);

  const newPendingCount = tab === 'players' ? 0 : Math.max(0, pendingCount - pendingSeen);
  const hasUnseenPending = newPendingCount > 0 || (tab !== 'players' && pendingCount > 0);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(run.campaign_code);
      setCopied(true);
      toast.success('Código copiado');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleAction = async (action) => {
    try {
      const fn = {
        activate: activateCampaignRun,
        pause: pauseCampaignRun,
        finish: finishCampaignRun,
      }[action];
      const result = await fn(id);
      toast.success(`Campaña ${action === 'activate' ? 'activada' : action === 'pause' ? 'pausada' : 'finalizada'}`);
      // On finish, the response includes xp_consolidation → trigger scroll animation
      if (action === 'finish' && Array.isArray(result?.xp_consolidation) && result.xp_consolidation.length > 0) {
        setScrollEntries(result.xp_consolidation);
      }
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const handlePublish = async () => {
    try {
      await createCampaignListing(id, {
        description: run.description ? run.description.slice(0, 250) : null,
        levelMin: run.recommended_level_min,
        levelMax: run.recommended_level_max,
      });
      toast.success('Campaña publicada en el tablón');
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const handleUnpublish = async () => {
    if (!listing) return;
    try {
      await deleteCampaignListing(listing.id);
      toast.success('Campaña retirada del tablón');
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const handleInvite = async (avail) => {
    setInvitingId(avail.character_id);
    try {
      await createInvitation({
        campaign_run_id: id,
        target_user_id: avail.user_id,
        character_id: avail.character_id,
      });
      toast.success(`Invitación enviada a ${avail.character_name || avail.user_name}`);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo invitar');
    } finally {
      setInvitingId(null);
    }
  };

  const handleCancelInvite = async (inv) => {
    try {
      await cancelInvitation(inv.id);
      toast.message('Invitación cancelada');
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const handlePlayerAct = async (player, status) => {
    try {
      await updatePlayerStatus(player.id, status);
      if (status === 'accepted') {
        // Trigger the "rune ignites" overlay on this row
        setIgniteId(player.id);
        setTimeout(() => setIgniteId(null), 1800);
        toast.success(`${player.character_name} aceptado en la campaña`);
      } else if (status === 'rejected') {
        toast.message('Solicitud rechazada');
      } else if (status === 'expelled') {
        toast.message('Personaje expulsado');
      }
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  if (loading || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative"
      data-testid="campaign-hub-page"
      style={{
        backgroundImage:
          'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-amber-700/40 -mx-4 px-4 py-3 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/campanas')}
                className="text-amber-200 hover:bg-amber-900/30 shrink-0"
                data-testid="back-to-campaigns-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Campañas
              </Button>
              <div className="min-w-0">
                <h1 className="font-heading text-xl sm:text-2xl text-amber-300 truncate" data-testid="hub-title">
                  {run.adventure_name}
                </h1>
                <div className="text-xs text-amber-300/60 truncate">
                  Código: <span className="font-mono text-amber-300">{run.campaign_code}</span>
                  {' · '}
                  <span className={`px-2 py-0.5 rounded ${STATUS_BADGE[run.status]}`}>{run.status}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/campanas/${id}/pantalla`)}
              data-testid="open-dj-screen-btn"
              className="bg-amber-700 hover:bg-amber-600 text-amber-50 shrink-0"
            >
              <Swords className="w-4 h-4 mr-1" /> Pantalla del DJ
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {TABS.map((t) => {
            const isPlayersTab = t.id === 'players';
            const showBadge = isPlayersTab && hasUnseenPending;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`hub-tab-${t.id}`}
                className={`relative px-3 py-1.5 text-sm rounded transition-colors ${
                  tab === t.id
                    ? 'bg-amber-700 text-amber-50'
                    : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/30'
                }`}
              >
                {t.label}
                {showBadge && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-rose-50 text-[10px] font-bold pending-badge"
                    data-testid="pending-badge"
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'info' && (
          <InfoTab
            run={run}
            onAction={handleAction}
            onCopyCode={handleCopyCode}
            copied={copied}
            listing={listing}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            xpStats={xpStats}
            isPresRevealed={(run.revealed_keys || []).includes('presentation')}
            onTogglePresentation={handleTogglePresentation}
            togglingPresentation={togglingPresentation}
          />
        )}
        {tab === 'content' && (
          <ContentTab
            content={content}
            run={run}
            revealedKeys={run.revealed_keys || []}
            onToggleEvent={handleToggleEventReveal}
            togglingEventId={togglingEventId}
          />
        )}
        {tab === 'players' && (
          <PlayersTab
            players={players}
            onAct={handlePlayerAct}
            igniteId={igniteId}
            onAwardXP={(p) => setAwardingFor(p)}
            availablePlayers={availablePlayers}
            sentInvites={sentInvites}
            onInvite={handleInvite}
            onCancelInvite={handleCancelInvite}
            invitingId={invitingId}
          />
        )}
        {tab === 'log' && <LogTab log={log} />}
      </div>

      <AwardXPDialog
        open={!!awardingFor}
        onClose={() => setAwardingFor(null)}
        runId={id}
        player={awardingFor}
        onAwarded={reload}
      />

      <ScrollOfDeedsReveal
        entries={scrollEntries}
        open={!!scrollEntries}
        onClose={() => setScrollEntries(null)}
      />

      <style>{`
        @keyframes pendingPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); }
          50%      { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(244, 63, 94, 0); }
        }
        .pending-badge {
          animation: pendingPulse 1.4s ease-out infinite;
        }
      `}</style>
    </div>
  );
};

export default CampaignHubPage;
