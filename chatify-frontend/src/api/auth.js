import axios from './axios';

export const register = async (userData) => {
  const response = await axios.post('/api/auth/register', userData);
  return response.data;
};

export const login = async (credentials) => {
  const response = await axios.post('/api/auth/login', credentials);
  return response.data;
};

export const logout = async () => {
  const response = await axios.post('/api/auth/logout');
  return response.data;
};

export const refreshToken = async (refreshToken) => {
  const response = await axios.post('/api/auth/refresh', { refreshToken });
  return response.data;
};
