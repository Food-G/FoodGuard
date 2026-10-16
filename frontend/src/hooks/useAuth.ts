import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { decodeToken } from '../utils/jwt';

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [user, setUser] = useState<any>(() => {
    const initialToken = authService.getToken();
    return initialToken ? decodeToken(initialToken) : null;
  });

  useEffect(() => {
    const currentToken = authService.getToken();
    if (currentToken) {
      const decoded = decodeToken(currentToken);
      if (decoded) {
        setUser(decoded);
        setToken(currentToken);
      } else {
        authService.logout();
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    const decoded = decodeToken(newToken);
    setToken(newToken);
    setUser(decoded);
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
  };

  return { token, user, login, logout, isLoggedIn: !!token && !!user };
};
