/**
 * CampaignBoardPage — el "Tablón Híbrido" de Fase 5.
 *
 * Tabs:
 *   - Aventuras (listings públicos de campañas) → cualquier rol.
 *   - Jugadores disponibles                     → sólo DJ/Maestro.
 *   - Mis invitaciones                          → recibidas (cualquier rol).
 *   - Disponibilidad                            → activar mis personajes (cualquier rol).
 *
 * Estado visual destacado:
 *   - Cuando un listing está `full`, su `<CampaignBanner full />` ondea y
 *     muestra la cinta dorada "COMPLETA".
 *   - Plazas restantes con contador colorido.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Compass, Users, Mail, Star, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import {
  listCampaignListings,
  requestJoinFromListing,
  listAvailablePlayers,
  myAvailability,
  upsertPlayerAvailability,
  myInvitations,
  respondInvitation,
  listMyCharacters,
  listCampaignRuns,
  createInvitation,
} from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import CampaignBanner from '@/components/adventures/CampaignBanner';

const STAFF_TABS = [
  { id: 'listings', label: 'Aventuras', icon: Compass },
  { id: 'available', label: 'Jugadores disponibles', icon: Users },
  { id: 'invitations', label: 'Invitaciones', icon: Mail },
  { id: 'availability', label: 'Disponibilidad', icon: Star },
];

const PLAYER_TABS = [
  { id: 'listings', label: 'Aventuras', icon: Compass },
  { id: 'invitations', label: 'Invitaciones', icon: Mail },
  { id: 'availability', label: 'Disponibilidad', icon: Star },
];

// ============================================================================
// LISTINGS TAB
// ============================================================================
const ListingCard = ({ listing, onApply }) => {
  const isFull = listing.listing_status === 'full' || listing.slots_available === 0;
  const isClosed = listing.listing_status === 'closed';
  return (
    <div
      className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-4 flex gap-4"
      data-testid={`listing-card-${listing.id}`}
    >
      <div className="shrink-0">
        <CampaignBanner bannerSeed={listing.banner_seed} full={isFull} size={84} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-lg text-amber-200 truncate">
          {listing.adventure_name || '(sin título)'}
        </h3>
        <p className="text-xs text-amber-300/60 mb-1">
          DJ: {listing.dm_name || '—'}
          {listing.region && ` · región ${listing.region}`}
        </p>
        {listing.listing_description && (
          <p className="text-sm text-gray-300/90 line-clamp-2 mb-2">{listing.listing_description}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-amber-300/70 mb-2">
          {(listing.recommended_level_min || listing.recommended_level_max) && (
            <span className="px-2 py-0.5 rounded bg-amber-900/30 border border-amber-700/30">
              Nivel {listing.recommended_level_min ?? '?'}–{listing.recommended_level_max ?? '?'}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded border ${
              isFull
                ? 'bg-rose-900/40 border-rose-700/40 text-rose-200'
                : 'bg-emerald-900/30 border-emerald-700/30 text-emerald-200'
            }`}
          >
            {listing.slots_available} / {listing.max_players} plazas
          </span>
        </div>
        <Button
          size="sm"
          disabled={isFull || isClosed}
          onClick={() => onApply(listing)}
          data-testid={`apply-listing-${listing.id}`}
          className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
        >
          Solicitar unirse
        </Button>
      </div>
    </div>
  );
};

const ListingsView = ({ onApply }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ region: '', level: '' });

  const reload = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.region) params.region = filters.region;
      if (filters.level) {
        params.level_min = Number(filters.level);
        params.level_max = Number(filters.level);
      }
      const list = await listCampaignListings(params);
      setData(list);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.region, filters.level]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={filters.region}
          onChange={(e) => setFilters({ ...filters, region: e.target.value })}
          placeholder="Región (texto)"
          className="px-3 py-1.5 rounded bg-black/50 border border-amber-700/40 text-amber-100 text-sm"
          data-testid="board-filter-region"
        />
        <input
          type="number"
          value={filters.level}
          onChange={(e) => setFilters({ ...filters, level: e.target.value })}
          placeholder="Nivel"
          min={1}
          max={20}
          className="w-24 px-3 py-1.5 rounded bg-black/50 border border-amber-700/40 text-amber-100 text-sm"
          data-testid="board-filter-level"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-amber-300/70">
          <Loader2 className="w-6 h-6 mx-auto animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-center py-10 text-amber-300/60">No hay campañas publicadas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((l) => (
            <ListingCard key={l.id} listing={l} onApply={onApply} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// AVAILABLE PLAYERS (DJ view)
// ============================================================================
const AvailablePlayersView = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, r] = await Promise.all([listAvailablePlayers(), listCampaignRuns('mine', 'active')]);
        setList(a);
        setRuns(r);
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleInvite = async () => {
    if (!selectedRun) {
      toast.error('Selecciona una campaña activa');
      return;
    }
    try {
      await createInvitation({
        campaign_run_id: selectedRun,
        target_user_id: inviting.user_id,
        character_id: inviting.character_id,
        message,
      });
      toast.success('Invitación enviada');
      setInviting(null);
      setMessage('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  if (loading) {
    return <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-300" />;
  }
  if (list.length === 0) {
    return <p className="text-center py-10 text-amber-300/60">Ningún jugador ha marcado un personaje como disponible.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((p) => (
          <div
            key={p.id}
            className="rounded border border-amber-800/30 bg-black/40 p-3 flex justify-between items-center"
            data-testid={`available-${p.id}`}
          >
            <div>
              <div className="text-amber-200 font-medium">{p.character_name}</div>
              <div className="text-xs text-amber-300/60">
                Jugador: {p.user_name || '—'} · nivel {p.character_level ?? '?'}
                {p.character_culture && ` · ${p.character_culture}`}
              </div>
              {p.preferences_text && (
                <div className="text-xs italic text-amber-300/70 mt-1">"{p.preferences_text}"</div>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setInviting(p)}
              data-testid={`invite-${p.id}`}
              className="bg-amber-700 hover:bg-amber-600 text-amber-50"
            >
              Invitar
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!inviting} onOpenChange={(o) => !o && setInviting(null)}>
        <DialogContent className="bg-black/95 border-amber-700/50">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-amber-300">
              Invitar a {inviting?.character_name}
            </DialogTitle>
            <DialogDescription>
              Selecciona una de tus campañas activas y opcionalmente añade un mensaje.
            </DialogDescription>
          </DialogHeader>
          <select
            value={selectedRun}
            onChange={(e) => setSelectedRun(e.target.value)}
            data-testid="invite-run-select"
            className="w-full px-3 py-2 rounded bg-black/60 border border-amber-700/40 text-amber-100"
          >
            <option value="">— elige campaña activa —</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.adventure_name} · {r.campaign_code}
              </option>
            ))}
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mensaje opcional para el jugador"
            rows={3}
            maxLength={300}
            data-testid="invite-message"
            className="w-full px-3 py-2 rounded bg-black/60 border border-amber-700/40 text-amber-100"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviting(null)}>Cancelar</Button>
            <Button onClick={handleInvite} data-testid="send-invite-btn" className="bg-amber-700 hover:bg-amber-600 text-amber-50">
              Enviar invitación
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ============================================================================
// INVITATIONS TAB
// ============================================================================
const InvitationsView = () => {
  const [invs, setInvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [chosenChar, setChosenChar] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      setInvs(await myInvitations());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleAccept = async () => {
    try {
      await respondInvitation(accepting.id, 'accepted', chosenChar || accepting.character_id);
      toast.success('Aceptada — el DJ verá tu solicitud');
      setAccepting(null);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const handleReject = async (inv) => {
    try {
      await respondInvitation(inv.id, 'rejected');
      toast.success('Rechazada');
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  const startAccept = async (inv) => {
    setAccepting(inv);
    setChosenChar(inv.character_id || '');
    try {
      const chars = (await listMyCharacters()).filter((c) => !c.active_campaign_run_id);
      setCharacters(chars);
    } catch {
      setCharacters([]);
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-300" />;
  if (invs.length === 0) {
    return <p className="text-center py-10 text-amber-300/60">No tienes invitaciones recibidas.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {invs.map((i) => (
          <div
            key={i.id}
            className="rounded border border-amber-800/30 bg-black/40 p-3 flex justify-between items-start gap-3"
            data-testid={`invitation-${i.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-amber-200 font-medium">{i.adventure_name}</div>
              <div className="text-xs text-amber-300/60">
                De: {i.dm_name} · estado: {i.status}
              </div>
              {i.message && (
                <p className="text-sm italic text-amber-300/80 mt-1">
                  <MessageSquare className="w-3 h-3 inline mr-1" /> "{i.message}"
                </p>
              )}
            </div>
            {i.status === 'pending' && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => startAccept(i)} data-testid={`accept-inv-${i.id}`} className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50">
                  Aceptar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleReject(i)} data-testid={`reject-inv-${i.id}`} className="border-rose-700/50 text-rose-200">
                  Rechazar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!accepting} onOpenChange={(o) => !o && setAccepting(null)}>
        <DialogContent className="bg-black/95 border-amber-700/50">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-amber-300">
              Aceptar invitación
            </DialogTitle>
            <DialogDescription>
              {accepting?.character_id
                ? `El DJ propuso un personaje. Puedes mantenerlo o cambiarlo.`
                : `Selecciona el personaje con el que te unirás.`}
            </DialogDescription>
          </DialogHeader>
          <select
            value={chosenChar}
            onChange={(e) => setChosenChar(e.target.value)}
            data-testid="accept-char-select"
            className="w-full px-3 py-2 rounded bg-black/60 border border-amber-700/40 text-amber-100"
          >
            <option value="">— elige personaje —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.nivel ? `· nivel ${c.nivel}` : ''}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccepting(null)}>Cancelar</Button>
            <Button onClick={handleAccept} disabled={!chosenChar} data-testid="confirm-accept-btn" className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50">
              Aceptar y solicitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ============================================================================
// AVAILABILITY TAB
// ============================================================================
const AvailabilityView = () => {
  const [chars, setChars] = useState([]);
  const [avail, setAvail] = useState({});
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  const reload = async () => {
    setLoading(true);
    try {
      const [allChars, mine] = await Promise.all([listMyCharacters(), myAvailability()]);
      setChars(allChars);
      const am = {};
      const pm = {};
      mine.forEach((m) => {
        am[m.character_id] = m.is_available;
        pm[m.character_id] = m.preferences_text || '';
      });
      setAvail(am);
      setPrefs(pm);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleSave = async (charId) => {
    setSaving((s) => ({ ...s, [charId]: true }));
    try {
      await upsertPlayerAvailability({
        character_id: charId,
        is_available: !!avail[charId],
        preferences_text: prefs[charId] || null,
      });
      toast.success('Disponibilidad actualizada');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    } finally {
      setSaving((s) => ({ ...s, [charId]: false }));
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-300" />;
  if (chars.length === 0) return <p className="text-center py-10 text-amber-300/60">No tienes personajes.</p>;

  return (
    <div className="space-y-3">
      {chars.map((c) => (
        <div
          key={c.id}
          className="rounded border border-amber-800/30 bg-black/40 p-3"
          data-testid={`avail-row-${c.id}`}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-amber-200 font-medium">{c.nombre}</div>
              <div className="text-xs text-amber-300/60">
                nivel {c.nivel ?? '?'} {c.cultura_nombre && `· ${c.cultura_nombre}`}
                {c.active_campaign_run_id && (
                  <span className="ml-2 text-rose-300/80">en campaña activa</span>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!avail[c.id]}
                disabled={!!c.active_campaign_run_id}
                onChange={(e) => setAvail({ ...avail, [c.id]: e.target.checked })}
                data-testid={`avail-toggle-${c.id}`}
                className="w-4 h-4"
              />
              <span className="text-sm text-amber-200">Disponible</span>
            </label>
          </div>
          <input
            value={prefs[c.id] || ''}
            onChange={(e) => setPrefs({ ...prefs, [c.id]: e.target.value })}
            placeholder="Preferencias (texto): horarios, estilo, regiones…"
            maxLength={300}
            className="w-full mt-2 px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm"
            data-testid={`avail-prefs-${c.id}`}
          />
          <div className="text-right mt-2">
            <Button
              size="sm"
              onClick={() => handleSave(c.id)}
              disabled={saving[c.id]}
              data-testid={`avail-save-${c.id}`}
              className="bg-amber-700 hover:bg-amber-600 text-amber-50"
            >
              Guardar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN PAGE
// ============================================================================
const CampaignBoardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === 'maestro' || user?.role === 'director_de_juego';
  const tabs = useMemo(() => (isStaff ? STAFF_TABS : PLAYER_TABS), [isStaff]);
  const [tab, setTab] = useState('listings');
  const [applyDialog, setApplyDialog] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [chosen, setChosen] = useState('');

  const startApply = async (listing) => {
    setApplyDialog(listing);
    setChosen('');
    try {
      const all = (await listMyCharacters()).filter((c) => !c.active_campaign_run_id);
      setCharacters(all);
    } catch {
      setCharacters([]);
    }
  };

  const handleApplyConfirm = async () => {
    if (!chosen) {
      toast.error('Selecciona un personaje');
      return;
    }
    try {
      await requestJoinFromListing(applyDialog.id, chosen);
      toast.success('Solicitud enviada al DJ');
      setApplyDialog(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error');
    }
  };

  return (
    <div
      className="min-h-screen relative"
      data-testid="campaign-board-page"
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
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-amber-200 hover:bg-amber-900/30"
              data-testid="back-home-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Inicio
            </Button>
            <h1 className="font-heading text-3xl sm:text-4xl text-amber-300 drop-shadow-lg">
              Tablón de Aventureros
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`board-tab-${t.id}`}
                className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1 ${
                  tab === t.id
                    ? 'bg-amber-700 text-amber-50'
                    : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'listings' && <ListingsView onApply={startApply} />}
        {tab === 'available' && isStaff && <AvailablePlayersView />}
        {tab === 'invitations' && <InvitationsView />}
        {tab === 'availability' && <AvailabilityView />}
      </div>

      <Dialog open={!!applyDialog} onOpenChange={(o) => !o && setApplyDialog(null)}>
        <DialogContent className="bg-black/95 border-amber-700/50" data-testid="apply-listing-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl text-amber-300">
              Solicitar unirse
            </DialogTitle>
            <DialogDescription>
              Aventura: <strong>{applyDialog?.adventure_name}</strong>. Selecciona un personaje.
            </DialogDescription>
          </DialogHeader>
          <select
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            data-testid="apply-char-select"
            className="w-full px-3 py-2 rounded bg-black/60 border border-amber-700/40 text-amber-100"
          >
            <option value="">— elige personaje —</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.nivel ? `· nivel ${c.nivel}` : ''}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApplyDialog(null)}>Cancelar</Button>
            <Button onClick={handleApplyConfirm} disabled={!chosen} data-testid="confirm-apply-btn" className="bg-amber-700 hover:bg-amber-600 text-amber-50">
              Enviar solicitud
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignBoardPage;
