import { api } from './api';

export const authService = {
  login: async (credentials: any) => {
    const token = await api.post('/auth/login', credentials);
    localStorage.setItem('token', token);
    return token;
  },
  signup: async (userData: any) => {
    return api.post('/auth/signup', userData);
  },
  logout: () => {
    localStorage.removeItem('token');
  },
  getToken: () => {
    return localStorage.getItem('token');
  },
  isLoggedIn: () => {
    return !!localStorage.getItem('token');
  },
};
