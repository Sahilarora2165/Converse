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

// Message Edit & Delete
export const editMessageAPI = (messageId, newContent) =>
    api.put(`/messages/${messageId}`, { messageId, newContent });
export const deleteMessageAPI = (messageId) => api.delete(`/messages/${messageId}`);

// Search Messages
export const searchMessagesAPI = (chatRoomId, query, page = 0, size = 20) =>
    api.get(`/messages/search?chatRoomId=${chatRoomId}&query=${encodeURIComponent(query)}&page=${page}&size=${size}`);

// User Profiles
export const getUserProfile = (userId) => api.get(`/users/${userId}/profile`);
export const getOwnProfile = () => api.get('/users/me/profile');
export const updateOwnProfile = (profileData) => api.put('/users/me/profile', profileData);

// Group Chat Management
export const getGroupInfo = (chatRoomId) => api.get(`/chatrooms/${chatRoomId}/info`);
export const updateGroupName = (chatRoomId, name) => api.put(`/chatrooms/${chatRoomId}/name`, { name });
export const removeParticipant = (chatRoomId, userId) => api.delete(`/chatrooms/${chatRoomId}/participants/${userId}`);
export const leaveGroup = (chatRoomId) => api.post(`/chatrooms/${chatRoomId}/leave`);
export const transferAdmin = (chatRoomId, newAdminId) => api.post(`/chatrooms/${chatRoomId}/transfer-admin/${newAdminId}`);

// Latency Metrics API
export const getLatencyMetrics = (windowMinutes = 5) => 
    api.get(`/metrics/latency/current?windowMinutes=${windowMinutes}`);
export const getLatencyHistory = (windowMinutes = 5) => 
    api.get(`/metrics/latency/history?windowMinutes=${windowMinutes}`);
export const getLatencySummary = () => api.get('/metrics/latency/summary');

export default api;