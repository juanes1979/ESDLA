/**
 * LoginPage — el Anillo Único como portal de entrada.
 *
 * El anillo grabado en élfico arde con un fuego que late, y dentro
 * de su círculo oscuro vive el formulario.
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
const RING_PORTAL = 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/6icqwqj5_ENTRADA.png';

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
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Velo oscuro para contraste */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/65 to-black/75" />

      {/* Resplandor naranja palpitante (halo del fuego) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="ring-halo" />
      </div>

      {/* Banda con título superior */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div className="px-5 py-1.5 rounded-full border border-amber-700/60 bg-black/70 backdrop-blur-sm">
          <span className="text-[11px] tracking-[0.45em] text-amber-300/85 uppercase font-heading">
            Lord of the Rings · 5e
          </span>
        </div>
      </div>

      {/* Portal Anillo */}
      <div className="relative z-10 w-full max-w-[720px] aspect-square mx-auto">
        {/* La imagen del Anillo en llamas, palpitando.
            Máscara radial con fade muy gradual: el anillo se funde con
            el fondo sin bordes duros y sin altar. NO usamos drop-shadow
            sobre el PNG porque dibujaría un halo cuadrado siguiendo la
            silueta original del archivo en lugar de la máscara. */}
        <div
          className="ring-portal absolute inset-0"
          data-testid="login-page"
          style={{
            backgroundImage: `url(${RING_PORTAL})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            WebkitMaskImage:
              'radial-gradient(circle at 50% 46%, #000 36%, rgba(0,0,0,0.85) 46%, transparent 60%)',
            maskImage:
              'radial-gradient(circle at 50% 46%, #000 36%, rgba(0,0,0,0.85) 46%, transparent 60%)',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        />

        {/* Disco oscuro que tapa el texto incrustado del anillo y aloja el form.
            Palpita SINCRONIZADO con el anillo (misma animación ringPulse) para
            que el agujero central del anillo y el disco coincidan en todo
            momento. */}
        <div
          className="ring-portal-inner absolute rounded-full overflow-hidden"
          style={{
            // Diámetro = 54% del cuadro, centrado. Suficiente para cubrir
            // el texto "Basado en El señor de los anillos 5e" del centro
            // de la imagen del anillo.
            top: '23%', left: '23%', right: '23%', bottom: '23%',
            background: 'rgb(8,4,2)',
            boxShadow:
              'inset 0 0 60px 6px rgba(0,0,0,0.95), 0 0 26px rgba(255,120,30,0.30)',
          }}
        >
          <form
            onSubmit={submit}
            className="w-full h-full flex flex-col items-center justify-center text-center"
            style={{ padding: '8% 14%' }}
          >
            <h1
              className="font-heading text-base sm:text-lg text-[hsl(var(--gold))] tracking-wide leading-tight px-2"
              style={{ textShadow: '0 0 14px rgba(251,191,36,0.45)' }}
            >
              Basado en El señor de los anillos 5e
            </h1>

            <div className="w-full space-y-1.5 mt-3">
              <div className="text-left">
                <Label htmlFor="login-email" className="text-amber-100 text-[10px]">
                  Correo electrónico
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-7 mt-0.5 bg-black/70 border-amber-700/40 text-amber-50 text-xs"
                  data-testid="login-email-input"
                />
              </div>
              <div className="text-left">
                <Label htmlFor="login-password" className="text-amber-100 text-[10px]">
                  Contraseña
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-7 mt-0.5 bg-black/70 border-amber-700/40 text-amber-50 text-xs"
                  data-testid="login-password-input"
                />
              </div>

              <label className="flex items-center justify-center gap-2 text-[10px] text-amber-100/85 cursor-pointer pt-0.5 select-none">
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
                className="flex items-start gap-1.5 mt-2 px-2 py-1 rounded border border-rose-500/50 bg-rose-950/80 text-rose-200 text-[10px] w-full"
                data-testid="login-error"
              >
                <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                <span className="text-left leading-tight">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="mt-2.5 h-8 px-5 rounded-full bg-[hsl(var(--gold))] hover:bg-amber-300 text-black font-semibold tracking-wide text-sm shadow-[0_0_22px_rgba(251,191,36,0.6)]"
              data-testid="login-submit-btn"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-3.5 h-3.5 mr-1.5" />}
              Entrar
            </Button>

            <p className="text-[10px] text-amber-200/70 mt-1.5">
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
      </div>

      {/* Pie */}
      <p className="absolute bottom-6 left-0 right-0 text-center text-[10px] tracking-[0.4em] text-amber-200/55 uppercase z-10">
        La Tierra Media te espera
      </p>

      {/* Animaciones del fuego — pulso + flicker. */}
      <style>{`
        @keyframes ringPulse {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1) saturate(1.05);
          }
          50% {
            transform: scale(1.025);
            filter: brightness(1.18) saturate(1.25);
          }
        }
        @keyframes ringFlicker {
          0%, 100% { opacity: 1; }
          37%      { opacity: 0.92; }
          63%      { opacity: 0.97; }
          78%      { opacity: 0.88; }
        }
        @keyframes haloPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.55;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.85;
          }
        }
        .ring-portal {
          animation: ringPulse 3.4s ease-in-out infinite,
                     ringFlicker 0.45s steps(2, end) infinite;
          transform-origin: center;
          will-change: transform, filter, opacity;
          /* IMPORTANTE: NO usamos filter:drop-shadow aquí porque pintaría
             un halo siguiendo la silueta CUADRADA del PNG, creando un
             marco visible al palpitar. El resplandor naranja se hace
             con .ring-halo y un radial-gradient detrás. */
        }
        /* El disco interior palpita en sincronía con el anillo para que el
           agujero central no se "desencuadre" durante la animación. Sólo
           replica el scale, no el flicker ni el cambio de brillo. */
        .ring-portal-inner {
          animation: ringPulse 3.4s ease-in-out infinite;
          transform-origin: center;
          will-change: transform;
        }
        .ring-halo {
          width: 760px;
          height: 760px;
          max-width: 90vmin;
          max-height: 90vmin;
          border-radius: 9999px;
          background:
            radial-gradient(circle,
              rgba(255,140,40,0.55) 0%,
              rgba(255,90,20,0.32) 30%,
              rgba(255,70,10,0.18) 48%,
              rgba(180,40,0,0.05) 60%,
              transparent 75%);
          filter: blur(34px);
          animation: haloPulse 3.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ring-portal, .ring-portal-inner, .ring-halo { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
