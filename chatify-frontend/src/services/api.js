import axios from 'axios';
import { API_URL } from '../utils/constants';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attaches Token to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handles 401 (Unauthorized) errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthEndpoint = error.config?.url?.startsWith('/auth/');
        const status = error.response?.status;

        // Only force-logout on 401/403 for non-auth endpoints
        // (auth endpoints like /login already handle their own errors)
        if ((status === 401 || status === 403) && !isAuthEndpoint) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth Helper Functions
export const loginAPI = (email, password) => api.post('/auth/login', { email, password });
export const registerAPI = (userData) => api.post('/auth/register', userData);

export const getChatRooms = () => api.get('/chatrooms');
export const getChatHistory = (roomId) => api.get(`/messages/chatroom/${roomId}`);
export const searchUsers = (query) => api.get(`/chatrooms/search?query=${query}`);

export const createChatRoom = (name, isGroup, participantIds) =>
    api.post('/chatrooms', {
        name,
        isGroupChat: isGroup,
        participantIds
    });

export const sendMessageAPI = (messageData) => api.post('/messages', messageData);
export const getAllUsers = () => api.get('/users');

export default api;