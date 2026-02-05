/**
 * User Context - Manages current user state
 * For development: Admin user "Maestro" is active by default
 */
import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

// Default admin user for development (no login required)
const DEFAULT_ADMIN_USER = {
  id: 'maestro-admin',
  username: 'Maestro',
  role: 'admin', // 'admin' = Director de juego, 'user' = Usuario
  isAdmin: true,
};

export const UserProvider = ({ children }) => {
  // Start with admin user active by default
  const [user, setUser] = useState(DEFAULT_ADMIN_USER);
  
  const isAdmin = user?.isAdmin || user?.role === 'admin';
  
  // For future login implementation
  const login = (userData) => {
    setUser({
      ...userData,
      isAdmin: userData.role === 'admin',
    });
  };
  
  const logout = () => {
    // For development, reset to admin user instead of null
    setUser(DEFAULT_ADMIN_USER);
  };
  
  // Toggle between admin and regular user for testing
  const toggleRole = () => {
    setUser(prev => ({
      ...prev,
      role: prev.role === 'admin' ? 'user' : 'admin',
      isAdmin: prev.role !== 'admin',
      username: prev.role === 'admin' ? 'Usuario' : 'Maestro',
    }));
  };
  
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
