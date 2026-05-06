/**
 * ApprovalsPage — panel del Maestro para aprobar/rechazar usuarios y
 * cambiar roles. Vista organizada en 4 bloques (Pendientes / Maestro /
 * DJ / Jugador) con las ilustraciones de rol como cabecera.
 *
 * Reglas de negocio aplicadas:
 *   - Sólo se puede asignar el rol "jugador" o "director_de_juego"
 *     (nunca "maestro" desde la UI).
 *   - El Maestro Supremo (semilla MAESTRO_EMAIL → flag is_protected) no
 *     se puede modificar ni eliminar: aparece bloqueado con badge.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, UserMinus,
  ArrowLeft, ShieldCheck, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/button';

// Las 3 ilustraciones de rol (suministradas por el usuario).
const ROLE_ART = {
  maestro: 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/bjm5u1qq_Maestro%20del%20Saber.png',
  director_de_juego: 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/rs2rjagb_Director%20de%20Juego.png',
  jugador: 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/79cbxatu_Jugador.png',
};

const ROLE_LABEL = {
  maestro: 'Maestro del Saber',
  director_de_juego: 'Director de Juego',
  jugador: 'Jugador',
};

// Sólo estos dos roles son asignables vía API (jamás "maestro").
const ASSIGNABLE_ROLES = [
  { value: 'jugador', label: 'Jugador' },
  { value: 'director_de_juego', label: 'Director de Juego' },
];

const STATUS_BADGE = {
  pendiente: 'bg-amber-700/40 text-amber-100 border-amber-500/50',
  aprobado: 'bg-emerald-800/40 text-emerald-100 border-emerald-500/50',
  rechazado: 'bg-rose-800/40 text-rose-100 border-rose-500/50',
};

const ApprovalsPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id, body) => {
    setBusyId(id);
    try {
      await api.patch(`/auth/users/${id}`, body);
      await load();
      toast.success('Usuario actualizado');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al actualizar');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`¿Eliminar la cuenta de "${name}"? Esta acción no se puede deshacer.`)) return;
    setBusyId(id);
    try {
      await api.delete(`/auth/users/${id}`);
      await load();
      toast.success('Cuenta eliminada');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar');
    } finally {
      setBusyId(null);
    }
  };

  // Particionar por rol/estado.
  const pending = users.filter(u => u.status === 'pendiente');
  const maestros = users.filter(u => u.status !== 'pendiente' && u.role === 'maestro');
  const djs = users.filter(u => u.status !== 'pendiente' && u.role === 'director_de_juego');
  const jugadores = users.filter(u => u.status !== 'pendiente' && u.role === 'jugador');

  return (
    <div
      className="min-h-screen relative"
      data-testid="approvals-page"
      style={{
        backgroundImage: 'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 container mx-auto p-6 max-w-6xl">
        {/* Header con botón Volver */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="border-amber-700/50 text-amber-100 hover:bg-amber-900/30"
              data-testid="approvals-back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-heading text-[hsl(var(--gold))]">Cuentas y roles</h1>
              <p className="text-sm text-amber-200/70 mt-1 italic">
                Aprueba accesos y asigna rol — Director de Juego o Jugador.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>

        {loading && users.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        )}

        {/* Pendientes */}
        <RoleSection
          title={`Pendientes (${pending.length})`}
          subtitle="Usuarios esperando ser aprobados por el Maestro."
          accent="amber"
          users={pending}
          renderRow={(u) => (
            <PendingRow
              key={u.id}
              user={u}
              busy={busyId === u.id}
              onApprove={(role) => patch(u.id, { status: 'aprobado', role })}
              onReject={() => patch(u.id, { status: 'rechazado' })}
              onDelete={() => remove(u.id, u.name)}
            />
          )}
        />

        {/* Maestro del Saber */}
        <RoleSection
          title={`Maestro del Saber (${maestros.length})`}
          art={ROLE_ART.maestro}
          subtitle="El Maestro Supremo guarda el saber. Su rol no puede cambiarse."
          accent="indigo"
          users={maestros}
          renderRow={(u) => (
            <ActiveRow
              key={u.id}
              user={u}
              busy={busyId === u.id}
              onRoleChange={(role) => patch(u.id, { role })}
              onDelete={() => remove(u.id, u.name)}
            />
          )}
        />

        {/* Director de Juego */}
        <RoleSection
          title={`Director de Juego (${djs.length})`}
          art={ROLE_ART.director_de_juego}
          subtitle="Conducen las aventuras y campañas."
          accent="emerald"
          users={djs}
          renderRow={(u) => (
            <ActiveRow
              key={u.id}
              user={u}
              busy={busyId === u.id}
              onRoleChange={(role) => patch(u.id, { role })}
              onDelete={() => remove(u.id, u.name)}
            />
          )}
        />

        {/* Jugadores */}
        <RoleSection
          title={`Jugadores (${jugadores.length})`}
          art={ROLE_ART.jugador}
          subtitle="Héroes que recorren la Tierra Media."
          accent="orange"
          users={jugadores}
          renderRow={(u) => (
            <ActiveRow
              key={u.id}
              user={u}
              busy={busyId === u.id}
              onRoleChange={(role) => patch(u.id, { role })}
              onDelete={() => remove(u.id, u.name)}
            />
          )}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

const ACCENT_BORDER = {
  amber: 'border-amber-700/60',
  indigo: 'border-indigo-700/60',
  emerald: 'border-emerald-700/60',
  orange: 'border-orange-700/60',
};

const ACCENT_RING = {
  amber: 'ring-amber-500/40',
  indigo: 'ring-indigo-500/40',
  emerald: 'ring-emerald-500/40',
  orange: 'ring-orange-500/40',
};

const RoleSection = ({ title, subtitle, art, accent = 'amber', users, renderRow }) => (
  <section className={`mb-8 rounded-lg border ${ACCENT_BORDER[accent]} bg-black/55 backdrop-blur-sm p-5`}>
    <div className="flex items-center gap-4 mb-4">
      {art && (
        <img
          src={art}
          alt=""
          className={`w-16 h-16 rounded-full object-cover ring-2 ${ACCENT_RING[accent]}`}
        />
      )}
      <div className="min-w-0">
        <h2 className="font-heading text-2xl text-[hsl(var(--gold))] leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-amber-200/60 mt-0.5">{subtitle}</p>}
      </div>
    </div>

    {users.length === 0 ? (
      <p className="text-amber-200/40 text-sm italic px-2 py-3">— Sin usuarios en esta categoría —</p>
    ) : (
      <div className="space-y-2">{users.map(renderRow)}</div>
    )}
  </section>
);

// Format a stored ISO date as "DD/MM/YYYY HH:MM" or return em-dash.
const fmtAccess = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '—';
  }
};

const UserHeader = ({ user }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-medium text-amber-100 truncate">{user.name}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[user.status] || ''}`}>
        {user.status}
      </span>
      {user.is_protected && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/60 bg-yellow-900/40 text-yellow-100 flex items-center gap-1"
          title="Maestro Supremo — protegido"
        >
          <ShieldCheck className="w-3 h-3" />
          Maestro Supremo
        </span>
      )}
      {user.requested_role && user.status === 'pendiente' && (
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-500/40 bg-sky-900/30 text-sky-100">
          Solicita: {ROLE_LABEL[user.requested_role] || user.requested_role}
        </span>
      )}
    </div>
    <div className="text-xs text-amber-200/60 truncate">{user.email}</div>
    <div
      className="text-[10px] text-amber-200/45 mt-0.5"
      title={user.last_access || 'Sin registros de acceso'}
      data-testid={`user-last-access-${user.id}`}
    >
      Último acceso: <span className="text-amber-200/70">{fmtAccess(user.last_access)}</span>
    </div>
  </div>
);

const PendingRow = ({ user, busy, onApprove, onReject, onDelete }) => {
  // El rol inicial sugerido es el que el usuario solicitó al registrarse.
  const initialRole = user.requested_role && ASSIGNABLE_ROLES.some(r => r.value === user.requested_role)
    ? user.requested_role : 'jugador';
  const [role, setRole] = useState(initialRole);

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-amber-700/30 bg-black/40"
      data-testid={`user-row-${user.id}`}
    >
      <UserHeader user={user} />

      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-8 px-2 text-xs bg-background border border-border rounded"
        disabled={busy}
        data-testid={`user-role-select-${user.id}`}
      >
        {ASSIGNABLE_ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <Button
        size="sm"
        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white"
        onClick={() => onApprove(role)}
        disabled={busy}
        data-testid={`approve-btn-${user.id}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        Aprobar
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 border-rose-500/40 text-rose-300 hover:bg-rose-900/30"
        onClick={onReject}
        disabled={busy}
        data-testid={`reject-btn-${user.id}`}
      >
        <XCircle className="w-3.5 h-3.5 mr-1" />
        Rechazar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-rose-300 hover:bg-rose-900/30"
        onClick={onDelete}
        disabled={busy}
        data-testid={`delete-user-btn-${user.id}`}
        title="Eliminar cuenta"
      >
        <UserMinus className="w-3.5 h-3.5" />
      </Button>
      {busy && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
    </div>
  );
};

const ActiveRow = ({ user, busy, onRoleChange, onDelete }) => {
  const protectedUser = !!user.is_protected;
  // Sólo "maestro" es no-asignable. Para el resto, permitimos cambiar.
  // Si el user actual es maestro (protegido), bloqueamos todo.
  const [role, setRole] = useState(
    ASSIGNABLE_ROLES.some(r => r.value === user.role) ? user.role : 'jugador'
  );

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border/40 bg-black/40"
      data-testid={`user-row-${user.id}`}
    >
      <UserHeader user={user} />

      {protectedUser ? (
        <span className="flex items-center gap-1 text-xs text-yellow-200/80 italic">
          <Lock className="w-3.5 h-3.5" />
          Inmutable
        </span>
      ) : (
        <>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-8 px-2 text-xs bg-background border border-border rounded"
            disabled={busy}
            data-testid={`user-role-select-${user.id}`}
          >
            {ASSIGNABLE_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => onRoleChange(role)}
            disabled={busy || role === user.role}
            data-testid={`update-role-btn-${user.id}`}
          >
            Guardar rol
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-rose-300 hover:bg-rose-900/30"
            onClick={onDelete}
            disabled={busy}
            data-testid={`delete-user-btn-${user.id}`}
            title="Eliminar cuenta"
          >
            <UserMinus className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
      {busy && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
    </div>
  );
};

export default ApprovalsPage;
