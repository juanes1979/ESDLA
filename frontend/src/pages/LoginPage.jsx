/**
 * LoginPage — email + contraseña + Recordar sesión.
 */
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/40 p-6">
      <div className="w-full max-w-md card-parchment rounded-lg p-8 shadow-2xl border border-amber-700/40" data-testid="login-page">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-heading text-[hsl(var(--gold))] mb-1">El Anillo Único</h1>
          <p className="text-sm text-muted-foreground italic">Lord of the Rings 5e — TRPG</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="login-email">Correo electrónico</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              data-testid="login-email-input"
            />
          </div>
          <div>
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              data-testid="login-password-input"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(!!v)}
              data-testid="login-remember-checkbox"
            />
            <span>Recordar sesión (30 días)</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-sm" data-testid="login-error">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black font-semibold"
            data-testid="login-submit-btn"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
            Entrar
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-[hsl(var(--gold))] underline hover:text-amber-300" data-testid="login-go-register-link">
            Solicita acceso
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
