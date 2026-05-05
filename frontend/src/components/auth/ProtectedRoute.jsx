/**
 * ProtectedRoute — guards routes from unauthenticated users.
 *
 * Usage:
 *   <ProtectedRoute>             // any logged-in user
 *     <CharacterSheet />
 *   </ProtectedRoute>
 *
 *   <ProtectedRoute roles={['maestro', 'director_de_juego']}>
 *     <RulesPage />
 *   </ProtectedRoute>
 */
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ProtectedRoute = ({ children, roles = null }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl font-heading text-rose-400 mb-3">Acceso restringido</h1>
        <p className="text-muted-foreground max-w-md">
          Esta sección está reservada para roles: {roles.join(', ')}. Tu rol actual es{' '}
          <span className="text-amber-300 font-semibold">{user.role}</span>.
        </p>
      </div>
    );
  }
  return children;
};

export default ProtectedRoute;
