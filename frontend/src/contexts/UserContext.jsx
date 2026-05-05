/**
 * User Context — bridge to AuthContext.
 *
 * Exposes the legacy `{ user, isAdmin, login, logout, toggleRole }` shape
 * that older components consume (e.g. `useUser().isAdmin`). This is now
 * derived from `AuthContext` so RBAC stays in a single source of truth.
 *
 * `isAdmin` is true for staff (maestro / director_de_juego). Pure
 * `jugador` users will see read-only UI.
 */
import { createContext, useContext } from 'react';
import { useAuth } from '@/context/AuthContext';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const { user: authUser, logout: authLogout } = useAuth();

  const user = authUser
    ? {
        id: authUser.id,
        username: authUser.name,
        role: authUser.role === 'jugador' ? 'user' : 'admin',
        isAdmin: authUser.role !== 'jugador',
        realRole: authUser.role,
        email: authUser.email,
      }
    : null;

  const isAdmin = !!user?.isAdmin;

  // Legacy login / toggleRole are no-ops now (AuthContext owns it).
  const login = () => {};
  const logout = () => authLogout();
  const toggleRole = () => {};

  return (
    <UserContext.Provider value={{ user, isAdmin, login, logout, toggleRole }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
