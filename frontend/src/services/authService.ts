import { api } from './api';

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    // 백엔드가 { token, userId, email, userName, role } 객체를 반환
    const token = typeof response === 'string' ? response : response.token;
    if (!token) throw new Error('토큰을 받지 못했습니다.');
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
