/**
 * RegisterPage — email + nombre + contraseña.
 * Tras el registro la cuenta queda en estado `pendiente` hasta que el
 * Maestro la apruebe.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, UserPlus, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const RegisterPage = () => {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
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
      await register(email.trim(), name.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al registrar');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/40 p-6">
        <div className="w-full max-w-md card-parchment rounded-lg p-8 shadow-2xl border border-emerald-700/40 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h1 className="text-2xl font-heading text-[hsl(var(--gold))] mb-2">Cuenta creada</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Tu cuenta está <span className="text-amber-300 font-semibold">pendiente de aprobación</span>.
            El Maestro revisará tu solicitud y te asignará un rol. Vuelve a entrar más tarde.
          </p>
          <Button onClick={() => navigate('/login')} className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/90">
            Ir al login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/40 p-6">
      <div className="w-full max-w-md card-parchment rounded-lg p-8 shadow-2xl border border-amber-700/40" data-testid="register-page">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-heading text-[hsl(var(--gold))] mb-1">Solicitar acceso</h1>
          <p className="text-sm text-muted-foreground italic">El Maestro deberá aprobar tu cuenta.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="reg-email">Correo electrónico</Label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              data-testid="register-email-input"
            />
          </div>
          <div>
            <Label htmlFor="reg-name">Nombre / Alias</Label>
            <Input
              id="reg-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              data-testid="register-name-input"
            />
          </div>
          <div>
            <Label htmlFor="reg-password">Contraseña (mín. 4)</Label>
            <Input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              autoComplete="new-password"
              data-testid="register-password-input"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-sm" data-testid="register-error">
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

        <p className="text-sm text-center text-muted-foreground mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-[hsl(var(--gold))] underline hover:text-amber-300">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
