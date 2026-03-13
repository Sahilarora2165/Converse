import axios from 'axios';
import { API_URL } from '../utils/constants';

const api = axios.create({
    baseURL: API_URL ? `${API_URL}/api` : '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor
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

// ─── Token Refresh State ────────────────────────────────────────────────────
let isRefreshing = false;
let failedRequestsQueue = [];

const processQueue = (error, token = null) => {
    failedRequestsQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedRequestsQueue = [];
};

const forceLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
};

// ─── Response Interceptor ───────────────────────────────────────────────────
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');
        const status = error.response?.status;

        if ((status === 401 || status === 403) && !isAuthEndpoint && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedRequestsQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers['Authorization'] = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');

            if (!refreshToken) {
                isRefreshing = false;
                processQueue(new Error('No refresh token'), null);
                forceLogout();
                return Promise.reject(error);
            }

            try {
                const { data } = await api.post('/auth/refresh', { refreshToken });
                localStorage.setItem('token', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
                processQueue(null, data.accessToken);
                originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                forceLogout();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

// ─── API Methods ────────────────────────────────────────────────────────────
export const loginAPI = (email, password) => api.post('/auth/login', { email, password });
export const registerAPI = (userData) => api.post('/auth/register', userData);
export const refreshTokenAPI = (refreshToken) => api.post('/auth/refresh', { refreshToken });

export const getChatRooms = () => api.get('/chatrooms');
export const getChatHistory = (roomId) => api.get(`/messages/chatroom/${roomId}`);
export const getChatHistoryPaginated = (roomId, page = 0, size = 30) =>
    api.get(`/messages/chatroom/${roomId}/paginated?page=${page}&size=${size}`);
export const searchUsers = (query) => api.get(`/chatrooms/search?query=${query}`);

export const createChatRoom = (name, isGroup, participantIds) =>
    api.post('/chatrooms', {
        name,
        isGroupChat: isGroup,
        participantIds
    });

export const sendMessageAPI = (messageData) => api.post('/messages', messageData);
export const getAllUsers = () => api.get('/users');
export const markMessagesAsRead = (chatId) => api.put(`/messages/chatroom/${chatId}/read-all`);

export default api;