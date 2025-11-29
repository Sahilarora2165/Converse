import axios from './axios';

export const getAllUsers = async () => {
  const response = await axios.get('/api/users');
  return response.data;
};

export const getUserById = async (id) => {
  const response = await axios.get(`/api/users/${id}`);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await axios.get('/api/users/me');
  return response.data;
};

export const searchUsers = async (query) => {
  const response = await axios.get('/api/users/search', { params: { query } });
  return response.data;
};

export const updateUserStatus = async (id, status) => {
  const response = await axios.put(`/api/users/${id}/status`, { status });
  return response.data;
};

export const getUserPresence = async (id) => {
  const response = await axios.get(`/api/users/${id}/presence`);
  return response.data;
};

export const getOnlineUsers = async () => {
  const response = await axios.get('/api/users/online');
  return response.data;
};
