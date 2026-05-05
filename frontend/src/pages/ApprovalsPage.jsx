/**
 * ApprovalsPage — panel del Maestro para aprobar/rechazar usuarios y
 * cambiar roles.
 */
import { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, RefreshCw, UserMinus, Shield, Hammer, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/button';

const ROLE_OPTIONS = [
  { value: 'jugador', label: 'Jugador', icon: UserIcon },
  { value: 'director_de_juego', label: 'Director de Juego', icon: Hammer },
  { value: 'maestro', label: 'Maestro', icon: Shield },
];

const STATUS_BADGE = {
  pendiente: 'bg-amber-700/40 text-amber-100 border-amber-500/50',
  aprobado: 'bg-emerald-800/40 text-emerald-100 border-emerald-500/50',
  rechazado: 'bg-rose-800/40 text-rose-100 border-rose-500/50',
};

const ApprovalsPage = () => {
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

  const pending = users.filter(u => u.status === 'pendiente');
  const others = users.filter(u => u.status !== 'pendiente');

  return (
    <div className="container mx-auto p-6 max-w-5xl" data-testid="approvals-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-[hsl(var(--gold))]">Cuentas y roles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aprueba nuevos accesos y asigna rol (Maestro / DJ / Jugador).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {/* Pending */}
      <section className="mb-8">
        <h2 className="font-heading text-xl text-amber-300 mb-3">Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-2">
            {pending.map(u => (
              <UserRow
                key={u.id}
                user={u}
                onApprove={(role) => patch(u.id, { status: 'aprobado', role })}
                onReject={() => patch(u.id, { status: 'rechazado' })}
                onRoleChange={(role) => patch(u.id, { role })}
                onDelete={() => remove(u.id, u.name)}
                busy={busyId === u.id}
                pending
              />
            ))}
          </div>
        )}
      </section>

      {/* Others */}
      <section>
        <h2 className="font-heading text-xl text-amber-300 mb-3">Cuentas activas ({others.length})</h2>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        ) : (
          <div className="space-y-2">
            {others.map(u => (
              <UserRow
                key={u.id}
                user={u}
                onApprove={(role) => patch(u.id, { status: 'aprobado', role })}
                onReject={() => patch(u.id, { status: 'rechazado' })}
                onRoleChange={(role) => patch(u.id, { role })}
                onDelete={() => remove(u.id, u.name)}
                busy={busyId === u.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const UserRow = ({ user, onApprove, onReject, onRoleChange, onDelete, busy, pending = false }) => {
  const [role, setRole] = useState(user.role || 'jugador');
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md border border-border/40 bg-black/30"
      data-testid={`user-row-${user.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-amber-100 truncate">{user.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[user.status] || ''}`}>
            {user.status}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
      </div>

      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-8 px-2 text-xs bg-background border border-border rounded"
        disabled={busy}
        data-testid={`user-role-select-${user.id}`}
      >
        {ROLE_OPTIONS.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {pending ? (
        <>
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
        </>
      ) : (
        <>
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
