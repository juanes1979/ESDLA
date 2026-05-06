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
  Globe2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCampaignRun,
  getCampaignContent,
  getCampaignLog,
  activateCampaignRun,
  pauseCampaignRun,
  finishCampaignRun,
} from '@/services/api';
import { Button } from '@/components/ui/button';

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

const InfoTab = ({ run, onAction, onCopyCode, copied }) => (
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

const ContentTab = ({ content, run }) => (
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
            <img
              src={`${BACKEND_URL}/api/storage/download/${m.file_id}`}
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

const Section = ({ title, children, testid }) => (
  <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-5" data-testid={testid}>
    <h3 className="font-heading text-lg text-amber-300 mb-3">{title}</h3>
    <div>{children || <p className="text-sm text-gray-500 italic">— vacío —</p>}</div>
  </div>
);

const PlayersTab = () => (
  <div className="rounded-xl border border-amber-700/40 bg-black/60 backdrop-blur-sm p-8 text-center" data-testid="players-tab">
    <Lock className="w-10 h-10 mx-auto text-amber-300/40 mb-3" />
    <h3 className="font-heading text-xl text-amber-200 mb-2">Próximamente — Fase 3</h3>
    <p className="text-sm text-amber-300/70 max-w-md mx-auto">
      La unión de jugadores por código y la gestión de solicitudes (aceptar / rechazar /
      expulsar) estará disponible en la siguiente fase.
    </p>
  </div>
);

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
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [r, c, l] = await Promise.all([
        getCampaignRun(id),
        getCampaignContent(id),
        getCampaignLog(id),
      ]);
      setRun(r);
      setContent(c);
      setLog(l);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error cargando campaña');
      navigate('/campanas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      await fn(id);
      toast.success(`Campaña ${action === 'activate' ? 'activada' : action === 'pause' ? 'pausada' : 'finalizada'}`);
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
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`hub-tab-${t.id}`}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                tab === t.id
                  ? 'bg-amber-700 text-amber-50'
                  : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/30'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <InfoTab run={run} onAction={handleAction} onCopyCode={handleCopyCode} copied={copied} />
        )}
        {tab === 'content' && <ContentTab content={content} run={run} />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'log' && <LogTab log={log} />}
      </div>
    </div>
  );
};

export default CampaignHubPage;
