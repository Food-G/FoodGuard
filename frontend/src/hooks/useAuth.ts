import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { decodeToken } from '../utils/jwt';

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      setUser(decoded);
    } else {
      setUser(null);
    }
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    authService.logout();
    setToken(null);
  };

  return { token, user, login, logout, isLoggedIn: !!token };
};
