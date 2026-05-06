/**
 * LoginPage — portal del Anillo Único.
 *
 * IMPORTANTE: ANILLO.png y estatico.png están diseñadas para coincidir
 * EXACTAMENTE cuando se renderizan al MISMO tamaño. El agujero del
 * anillo se alinea pixel a pixel con el disco oscuro del estatico.
 * Por eso ambas imágenes ocupan inset-0 (100% del cuadro contenedor).
 */
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';

const HOME_BG = 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png';
const RING_FIRE = 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/buvrdsxs_ANILLO.png';

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al iniciar sesión');
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
        {/* Disco oscuro propio (HTML, no imagen) que llena exactamente el
            agujero del anillo. Mismo approach que RegisterPage. */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgb(28,18,12) 0%, rgb(8,4,2) 65%)',
            boxShadow:
              'inset 0 0 60px 6px rgba(0,0,0,0.95), 0 0 26px rgba(255,120,30,0.30)',
          }}
        >
          <form
            onSubmit={submit}
            data-testid="login-page"
            className="w-full h-full flex flex-col items-center justify-center text-center"
            style={{ padding: '12% 14%' }}
          >
            <h1
              className="font-heading text-[11px] sm:text-xs text-[hsl(var(--gold))] tracking-wide leading-tight"
              style={{ textShadow: '0 0 14px rgba(251,191,36,0.45)' }}
            >
              Basado en El señor de los anillos 5e
            </h1>
            <p className="text-[8px] text-amber-200/60 italic mt-0.5 mb-2">
              Un Anillo para gobernarlos a todos…
            </p>

            <div className="w-full space-y-1">
              <div className="text-left">
                <Label htmlFor="login-email" className="text-amber-100 text-[9px]">
                  Correo electrónico
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-6 mt-0.5 bg-black/70 border-amber-700/40 text-amber-50 text-[11px]"
                  data-testid="login-email-input"
                />
              </div>
              <div className="text-left">
                <Label htmlFor="login-password" className="text-amber-100 text-[9px]">
                  Contraseña
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-6 mt-0.5 bg-black/70 border-amber-700/40 text-amber-50 text-[11px]"
                  data-testid="login-password-input"
                />
              </div>

              <label className="flex items-center justify-center gap-2 text-[9px] text-amber-100/85 cursor-pointer pt-0.5 select-none">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(!!v)}
                  data-testid="login-remember-checkbox"
                  className="h-3 w-3"
                />
                <span>Recordar sesión (30 días)</span>
              </label>
            </div>

            {error && (
              <div
                className="flex items-start gap-1 mt-1.5 px-2 py-0.5 rounded border border-rose-500/50 bg-rose-950/80 text-rose-200 text-[9px] w-full"
                data-testid="login-error"
              >
                <ShieldAlert className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                <span className="text-left leading-tight">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="mt-2 h-7 px-4 rounded-full bg-[hsl(var(--gold))] hover:bg-amber-300 text-black font-semibold text-xs shadow-[0_0_22px_rgba(251,191,36,0.6)]"
              data-testid="login-submit-btn"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <LogIn className="w-3 h-3 mr-1" />}
              Entrar
            </Button>

            <p className="text-[9px] text-amber-200/70 mt-1.5">
              ¿No tienes cuenta?{' '}
              <Link
                to="/register"
                className="text-[hsl(var(--gold))] underline hover:text-amber-300"
                data-testid="login-go-register-link"
              >
                Solicita acceso
              </Link>
            </p>
          </form>
        </div>
      </RingPortal>
    </div>
  );
};

/**
 * Layout reusable: anillo palpitante + área central que CALZA EXACTAMENTE
 * con el agujero del anillo. El `children` se renderiza en un wrapper
 * absoluto cuyas dimensiones son las medidas reales del agujero
 * (66.5% × 62.3% del lienzo del anillo, centrado en (50.2%, 47.7%)).
 *
 * El consumidor pasa su propio "disco oscuro" (HTML, no imagen) como
 * children, así no hay desajustes de padding interno entre PNG y disco.
 */
export const RingPortal = ({ children }) => (
  <div className="relative z-10 w-full max-w-[640px] aspect-square mx-auto">
    {/* Halo naranja palpitante detrás del anillo. */}
    <div
      aria-hidden
      className="ring-halo absolute inset-0 m-auto pointer-events-none"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(255,140,40,0.55) 0%, rgba(255,90,20,0.32) 30%, rgba(180,40,0,0.10) 55%, transparent 72%)',
        filter: 'blur(28px)',
      }}
    />

    {/* Capa 1 — ANILLO en llamas (palpita). */}
    <img
      src={RING_FIRE}
      alt=""
      aria-hidden
      className="ring-fire absolute inset-0 w-full h-full select-none pointer-events-none"
      draggable={false}
    />

    {/* Capa 2 — Wrapper interno calibrado al agujero del anillo
        (medidas obtenidas por análisis pixel-perfect del PNG). El
        consumidor pinta su disco oscuro y form como children. */}
    <div
      className="absolute"
      style={{
        width: '66.5%',
        height: '62.3%',
        left: '16.95%',
        top: '16.55%',
      }}
    >
      {children}
    </div>

    <style>{`
      @keyframes ringFirePulse {
        0%, 100% {
          transform: scale(1);
          filter: brightness(1) saturate(1.05);
          opacity: 1;
        }
        50% {
          transform: scale(1.022);
          filter: brightness(1.18) saturate(1.25);
          opacity: 0.96;
        }
      }
      @keyframes ringFireFlicker {
        0%, 100% { opacity: 1; }
        37% { opacity: 0.92; }
        63% { opacity: 0.97; }
        78% { opacity: 0.88; }
      }
      @keyframes haloPulse {
        0%, 100% { transform: scale(1); opacity: 0.55; }
        50%      { transform: scale(1.10); opacity: 0.85; }
      }
      .ring-fire {
        animation: ringFirePulse 3.4s ease-in-out infinite,
                   ringFireFlicker 0.45s steps(2, end) infinite;
        transform-origin: center;
        will-change: transform, filter, opacity;
      }
      .ring-halo {
        animation: haloPulse 3.4s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .ring-fire, .ring-halo { animation: none !important; }
      }
    `}</style>
  </div>
);

export default LoginPage;
