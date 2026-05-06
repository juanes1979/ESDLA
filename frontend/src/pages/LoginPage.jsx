/**
 * LoginPage — portal del Anillo Único.
 *
 * Composición en dos capas:
 *   1. ANILLO.png  → anillo en llamas, palpita.
 *   2. estatico.png → disco con el formulario (título + labels + inputs
 *      dibujados + botón + textos), inmóvil. Es la imagen oficial del
 *      formulario. Encima posicionamos inputs/checkbox/botón/link
 *      reales (transparentes) para que el formulario sea funcional.
 *
 * Reglas:
 *   - estatico.png NO se mueve.
 *   - ANILLO.png palpita pero su círculo interior nunca se hace mayor
 *     que el disco visible de estatico.png (queda detrás).
 */
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const HOME_BG = 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png';
const RING_FIRE = 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/buvrdsxs_ANILLO.png';
const STATIC_FORM = 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/ov189tfo_estatico.png';

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

      {/* Banda título superior */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
        <div className="px-5 py-1.5 rounded-full border border-amber-700/60 bg-black/70 backdrop-blur-sm">
          <span className="text-[11px] tracking-[0.45em] text-amber-300/85 uppercase font-heading">
            Lord of the Rings · 5e
          </span>
        </div>
      </div>

      <RingPortal>
        <form onSubmit={submit} data-testid="login-page" className="w-full h-full relative">
          {/* Hot-zones alineadas con los elementos dibujados en estatico.png.
              Coordenadas medidas sobre la imagen original. */}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            data-testid="login-email-input"
            aria-label="Correo electrónico"
            className="absolute font-heading text-amber-100 text-center bg-transparent border-0 outline-none focus:ring-0 placeholder:text-transparent"
            style={{
              left: '21%', right: '21%', top: '38%', height: '7%',
              fontSize: 'clamp(11px, 1.1vw, 16px)',
            }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            data-testid="login-password-input"
            aria-label="Contraseña"
            className="absolute font-heading text-amber-100 text-center bg-transparent border-0 outline-none focus:ring-0"
            style={{
              left: '21%', right: '21%', top: '52%', height: '7%',
              fontSize: 'clamp(11px, 1.1vw, 16px)',
            }}
          />

          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            data-testid="login-remember-checkbox"
            aria-label="Recordar sesión 30 días"
            aria-pressed={rememberMe}
            className="absolute rounded-full focus:outline-none transition-colors"
            style={{
              left: '21%', top: '63.5%', width: '4.5%', height: '4.5%',
              background: rememberMe ? 'rgba(251,191,36,0.7)' : 'transparent',
              boxShadow: rememberMe ? '0 0 14px rgba(251,191,36,0.65)' : 'none',
            }}
          />

          <button
            type="submit"
            disabled={busy}
            data-testid="login-submit-btn"
            aria-label="Entrar"
            className="absolute rounded-full cursor-pointer focus:outline-none transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{
              left: '38%', right: '38%', top: '71%', height: '11%',
              background: 'transparent',
            }}
          >
            {busy && (
              <span className="font-heading text-black text-sm animate-pulse">…</span>
            )}
          </button>

          <Link
            to="/register"
            data-testid="login-go-register-link"
            aria-label="Solicita acceso"
            className="absolute"
            style={{ left: '54%', right: '14%', top: '85%', height: '5%' }}
          />

          {error && (
            <div
              className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded border border-rose-500/60 bg-rose-950/90 text-rose-100 text-xs whitespace-nowrap shadow-lg"
              style={{ top: '28%' }}
              data-testid="login-error"
            >
              {error}
            </div>
          )}
        </form>
      </RingPortal>
    </div>
  );
};

/**
 * Layout reusable: anillo palpitante de fondo + área central donde
 * `children` se renderiza dentro del agujero del anillo. Por defecto
 * incluye el disco estático con el formulario de login dibujado
 * (estatico.png); pásale `staticDisc={false}` para usar otro fondo
 * (por ejemplo en RegisterPage donde necesitamos más campos).
 */
export const RingPortal = ({ children, staticDisc = true, contentSize = '64%' }) => (
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

    {/* Capa 2 — Disco estático con el formulario de login dibujado.
        Sólo visible si staticDisc=true. */}
    {staticDisc && (
      <img
        src={STATIC_FORM}
        alt=""
        aria-hidden
        className="absolute select-none pointer-events-none"
        draggable={false}
        style={{
          width: contentSize,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    )}

    {/* Capa 3 — Hot-zones / contenido interactivo. Mismo tamaño que el
        disco para que las posiciones en porcentaje del children sean
        consistentes entre login y register. */}
    <div
      className="absolute"
      style={{
        width: contentSize,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        aspectRatio: '1 / 1',
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
