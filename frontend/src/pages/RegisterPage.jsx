/**
 * RegisterPage — solicitud de acceso bajo el Anillo Único.
 *
 * Reusa el mismo `RingPortal` del login (anillo en llamas palpitando
 * alrededor) pero con un disco oscuro propio porque el formulario
 * tiene más campos: email, alias, contraseña, selector de rol.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2, UserPlus, CheckCircle2, ShieldAlert, Hammer, User as UserIcon, ArrowLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { RingPortal } from './LoginPage';

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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        backgroundImage: `url(${HOME_BG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/70" />

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
        <div className="px-5 py-1.5 rounded-full border border-amber-700/60 bg-black/70 backdrop-blur-sm">
          <span className="text-[11px] tracking-[0.45em] text-amber-300/85 uppercase font-heading">
            Lord of the Rings · 5e
          </span>
        </div>
      </div>

      <RingPortal>
        {/* Disco oscuro propio — necesitamos más alto para los 4 campos. */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgb(28,18,12) 0%, rgb(8,4,2) 65%)',
            boxShadow:
              'inset 0 0 60px 6px rgba(0,0,0,0.95), 0 0 26px rgba(255,120,30,0.30)',
          }}
        >
          {done ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-[14%]">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mb-2" />
              <h2 className="font-heading text-base text-[hsl(var(--gold))] mb-1">
                Solicitud enviada
              </h2>
              <p className="text-[10px] text-amber-100/85 leading-snug mb-3">
                Tu cuenta queda <span className="text-amber-300 font-semibold">pendiente</span>.
                El Maestro decidirá tu rol.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="h-7 px-4 rounded-full bg-[hsl(var(--gold))] text-black hover:bg-amber-300 text-xs"
                data-testid="register-go-login-btn"
              >
                Ir al login
              </Button>
            </div>
          ) : (
            <form
              onSubmit={submit}
              data-testid="register-page"
              className="w-full h-full flex flex-col items-center justify-center text-center"
              style={{ padding: '12% 14%' }}
            >
              <h1
                className="font-heading text-[11px] sm:text-xs text-[hsl(var(--gold))] tracking-wide leading-tight"
                style={{ textShadow: '0 0 14px rgba(251,191,36,0.45)' }}
              >
                Solicitar acceso
              </h1>
              <p className="text-[8px] text-amber-200/60 italic mt-0.5 mb-1.5">
                El Maestro deberá aprobarte
              </p>

              <div className="w-full space-y-1">
                <Field
                  id="reg-email" type="email" label="Correo"
                  value={email} onChange={setEmail} testId="register-email-input"
                />
                <Field
                  id="reg-name" type="text" label="Alias"
                  value={name} onChange={setName} testId="register-name-input"
                  maxLength={80}
                />
                <Field
                  id="reg-password" type="password" label="Contraseña"
                  value={password} onChange={setPassword} testId="register-password-input"
                  minLength={4}
                />

                <div>
                  <Label className="text-amber-100 text-[8px]">¿Cómo quieres unirte?</Label>
                  <div className="grid grid-cols-2 gap-1 mt-0.5">
                    <RoleChoice
                      label="Jugador"
                      icon={<UserIcon className="w-3 h-3" />}
                      selected={requestedRole === 'jugador'}
                      onClick={() => setRequestedRole('jugador')}
                      testId="register-role-jugador"
                    />
                    <RoleChoice
                      label="DJ"
                      icon={<Hammer className="w-3 h-3" />}
                      selected={requestedRole === 'director_de_juego'}
                      onClick={() => setRequestedRole('director_de_juego')}
                      testId="register-role-dj"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-1 mt-1.5 px-2 py-0.5 rounded border border-rose-500/50 bg-rose-950/80 text-rose-200 text-[9px] w-full"
                  data-testid="register-error"
                >
                  <ShieldAlert className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                  <span className="text-left leading-tight">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={busy}
                className="mt-2 h-7 px-4 rounded-full bg-[hsl(var(--gold))] hover:bg-amber-300 text-black font-semibold text-xs shadow-[0_0_22px_rgba(251,191,36,0.6)]"
                data-testid="register-submit-btn"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                Solicitar
              </Button>
            </form>
          )}
        </div>
      </RingPortal>

      {/* Volver al login — fuera del anillo, arriba a la izquierda. */}
      <Link
        to="/login"
        className="absolute top-6 left-6 z-30 inline-flex items-center gap-1 px-3 py-1 rounded-full border border-amber-700/50 text-amber-100 text-xs hover:bg-amber-900/30"
        data-testid="register-back-to-login"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver al login
      </Link>
    </div>
  );
};

const Field = ({ id, type, label, value, onChange, testId, maxLength, minLength }) => (
  <div className="text-left">
    <Label htmlFor={id} className="text-amber-100 text-[8px]">{label}</Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      maxLength={maxLength}
      minLength={minLength}
      autoComplete={type === 'password' ? 'new-password' : type === 'email' ? 'email' : 'off'}
      className="h-6 mt-0.5 bg-black/70 border-amber-700/40 text-amber-50 text-[11px]"
      data-testid={testId}
    />
  </div>
);

const RoleChoice = ({ label, icon, selected, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className={`flex items-center justify-center gap-1 px-1 py-1 rounded border text-[9px] transition-all ${
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
