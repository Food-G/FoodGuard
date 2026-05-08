import { api } from './api';

export const authService = {
  login: async (credentials: any) => {
    const token = await api.post('/auth/login', credentials);
    localStorage.setItem('token', token);
    return token;
  },
  signup: async (userData: any) => {
    const payload = { ...userData, name: userData.name ?? userData.userName };
    return api.post('/auth/signup', payload);
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
