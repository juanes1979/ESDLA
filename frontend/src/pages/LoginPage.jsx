/**
 * LoginPage — entrada al portal de la Tierra Media.
 *
 * Estilo: parche de pergamino sobre el mismo fondo épico del Home,
 * rótulo dorado, vignette inferior, marco rúnico simple.
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
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{
        backgroundImage: `url(${HOME_BG})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Velo oscuro para contraste */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/70" />

      {/* Resplandor dorado tenue de fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(251,191,36,0.10) 0%, transparent 55%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Anillo dorado giratorio sutil sobre el cuadro */}
        <div className="text-center mb-4">
          <div className="inline-block px-4 py-1 rounded-full border border-amber-700/60 bg-black/40 backdrop-blur-sm">
            <span className="text-[11px] tracking-[0.4em] text-amber-300/80 uppercase">
              Lord of the Rings · 5e
            </span>
          </div>
        </div>

        <div
          className="rounded-lg p-8 shadow-2xl border border-amber-700/60 bg-stone-950/80 backdrop-blur-md"
          data-testid="login-page"
          style={{
            boxShadow:
              '0 0 60px -10px rgba(251,191,36,0.25), 0 25px 50px -12px rgba(0,0,0,0.8)',
          }}
        >
          <div className="text-center mb-6">
            <h1
              className="font-heading text-4xl text-[hsl(var(--gold))] tracking-wider"
              style={{ textShadow: '0 0 18px rgba(251,191,36,0.35)' }}
            >
              El Anillo Único
            </h1>
            <p className="text-xs text-amber-200/60 italic mt-2">
              Un Anillo para gobernarlos a todos…
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="login-email" className="text-amber-100">Correo electrónico</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-black/40 border-amber-800/40 text-amber-50"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label htmlFor="login-password" className="text-amber-100">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-black/40 border-amber-800/40 text-amber-50"
                data-testid="login-password-input"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-amber-100/90">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(!!v)}
                data-testid="login-remember-checkbox"
              />
              <span>Recordar sesión (30 días)</span>
            </label>

            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded border border-rose-500/40 bg-rose-950/40 text-rose-200 text-sm"
                data-testid="login-error"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-[hsl(var(--gold))] hover:bg-amber-300 text-black font-semibold tracking-wide"
              data-testid="login-submit-btn"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
              Entrar
            </Button>
          </form>

          <p className="text-sm text-center text-amber-200/70 mt-6">
            ¿No tienes cuenta?{' '}
            <Link
              to="/register"
              className="text-[hsl(var(--gold))] underline hover:text-amber-300"
              data-testid="login-go-register-link"
            >
              Solicita acceso
            </Link>
          </p>
        </div>

        <p className="text-center text-[10px] tracking-[0.3em] text-amber-200/40 mt-6 uppercase">
          La Tierra Media te espera
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
