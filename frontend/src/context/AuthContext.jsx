/**
 * AuthContext — JWT auth state with "Recordar sesión" support.
 *
 * Storage strategy:
 *   - "Recordar sesión" ON  → token in localStorage (persists 30 days)
 *   - "Recordar sesión" OFF → token in sessionStorage (cleared on tab close)
 *
 * The token is read by `api.js` via interceptor and attached as a
 * Bearer header to every request.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'lotr5e_token';

const readToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

const writeToken = (token, remember) => {
  // Always write to ONE store and clear the other to avoid stale entries.
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
};

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

export const AuthProvider = ({ children }) => {
  // user === undefined  → still checking
  // user === null       → not authenticated
  // user === {...}      → authenticated
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password, rememberMe) => {
    const { data } = await api.post('/auth/login', { email, password, remember_me: rememberMe });
    writeToken(data.token, rememberMe);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, name, password) => {
    const { data } = await api.post('/auth/register', { email, name, password });
    return data; // pending approval
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (_) { /* ignore */ }
    clearToken();
    setUser(null);
  };

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refresh, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

export default AuthContext;
