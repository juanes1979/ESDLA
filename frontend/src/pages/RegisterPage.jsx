/**
 * RegisterPage — solicitud de acceso.
 *
 * Campos:
 *   - email + nombre/alias + contraseña
 *   - "¿Cómo quieres unirte?" → Director de Juego o Jugador
 *     (informativo: el Maestro decidirá al aprobar)
 *
 * Tras enviarse, la cuenta queda "pendiente" hasta aprobación.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2, UserPlus, CheckCircle2, ShieldAlert, Hammer, User as UserIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const HOME_BG = 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png';

const RegisterPage = () => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState('jugador');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await register(email.trim(), name.trim(), password, requestedRole);
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al registrar');
    } finally {
      setBusy(false);
    }
  };

  // Wrapper común — fondo Tierra Media a pantalla completa.
  const Wrapper = ({ children }) => (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{
        backgroundImage: `url(${HOME_BG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/70" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );

  if (done) {
    return (
      <Wrapper>
        <div className="rounded-lg p-8 shadow-2xl border border-emerald-700/50 bg-stone-950/80 backdrop-blur-md text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h1 className="text-2xl font-heading text-[hsl(var(--gold))] mb-2">Solicitud enviada</h1>
          <p className="text-sm text-amber-100/80 mb-6">
            Tu cuenta está <span className="text-amber-300 font-semibold">pendiente de aprobación</span>.
            El Maestro revisará tu solicitud y te asignará un rol.
            Vuelve a entrar más tarde.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/90"
            data-testid="register-go-login-btn"
          >
            Ir al login
          </Button>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div
        className="rounded-lg p-8 shadow-2xl border border-amber-700/50 bg-stone-950/80 backdrop-blur-md"
        data-testid="register-page"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl font-heading text-[hsl(var(--gold))] mb-1 tracking-wider">
            Solicitar acceso
          </h1>
          <p className="text-sm text-amber-200/70 italic">
            El Maestro deberá aprobar tu cuenta.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="reg-email" className="text-amber-100">Correo electrónico</Label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="bg-black/40 border-amber-800/40 text-amber-50"
              data-testid="register-email-input"
            />
          </div>
          <div>
            <Label htmlFor="reg-name" className="text-amber-100">Nombre / Alias</Label>
            <Input
              id="reg-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="bg-black/40 border-amber-800/40 text-amber-50"
              data-testid="register-name-input"
            />
          </div>
          <div>
            <Label htmlFor="reg-password" className="text-amber-100">Contraseña (mín. 4)</Label>
            <Input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              autoComplete="new-password"
              className="bg-black/40 border-amber-800/40 text-amber-50"
              data-testid="register-password-input"
            />
          </div>

          {/* Selector de rol solicitado */}
          <div>
            <Label className="text-amber-100">¿Cómo quieres unirte?</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <RoleChoice
                value="jugador"
                label="Jugador"
                icon={<UserIcon className="w-4 h-4" />}
                selected={requestedRole === 'jugador'}
                onClick={() => setRequestedRole('jugador')}
                testId="register-role-jugador"
              />
              <RoleChoice
                value="director_de_juego"
                label="Director de Juego"
                icon={<Hammer className="w-4 h-4" />}
                selected={requestedRole === 'director_de_juego'}
                onClick={() => setRequestedRole('director_de_juego')}
                testId="register-role-dj"
              />
            </div>
            <p className="text-[11px] text-amber-200/60 mt-1 italic">
              Es una solicitud — el Maestro decide el rol final al aprobar tu cuenta.
            </p>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded border border-rose-500/40 bg-rose-950/40 text-rose-200 text-sm"
              data-testid="register-error"
            >
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black font-semibold"
            data-testid="register-submit-btn"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Crear cuenta
          </Button>
        </form>

        <p className="text-sm text-center text-amber-200/70 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-[hsl(var(--gold))] underline hover:text-amber-300">
            Entrar
          </Link>
        </p>
      </div>
    </Wrapper>
  );
};

const RoleChoice = ({ label, icon, selected, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm transition-all ${
      selected
        ? 'border-amber-400 bg-amber-900/50 text-amber-100 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]'
        : 'border-amber-800/40 bg-black/30 text-amber-200/70 hover:bg-amber-900/30'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default RegisterPage;
