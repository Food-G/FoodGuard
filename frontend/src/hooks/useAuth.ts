import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { decodeToken } from '../utils/jwt';

// 만료된 토큰은 로그인하지 않은 것으로 본다
const validUser = (token: string | null) => {
  if (!token) return null;
  const decoded = decodeToken(token);
  return decoded && (!decoded.exp || decoded.exp * 1000 > Date.now()) ? decoded : null;
};

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [user, setUser] = useState<any>(() => {
    return validUser(authService.getToken());
  });

  useEffect(() => {
    const currentToken = authService.getToken();
    if (currentToken) {
      const decoded = validUser(currentToken);
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
