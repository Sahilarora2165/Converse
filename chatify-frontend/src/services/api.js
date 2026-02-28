import axios from 'axios';
import { API_URL } from '../utils/constants';

const api = axios.create({
    baseURL: API_URL ? `${API_URL}/api` : '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── Request Interceptor ────────────────────────────────────────────────────
// Attaches the current access token to every outgoing request
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
// Prevents multiple simultaneous refresh calls when several requests 401 at once.
// All failed requests queue up and retry once the single refresh resolves.
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
// On 401: silently refresh the access token and retry the original request.
// Only forces logout if the refresh token itself is expired or missing.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Don't intercept auth endpoints — prevents infinite refresh loops
        const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');
        const status = error.response?.status;

        if ((status === 401 || status === 403) && !isAuthEndpoint && !originalRequest._retry) {
            // If a refresh is already in progress, queue this request
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
                // No refresh token stored — user must log in again
                isRefreshing = false;
                processQueue(new Error('No refresh token'), null);
                forceLogout();
                return Promise.reject(error);
            }

            try {
                // Call refresh endpoint — bypasses this interceptor (isAuthEndpoint check above)
                const { data } = await api.post('/auth/refresh', { refreshToken });

                // Store new tokens
                localStorage.setItem('token', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);

                // Update the default header for future requests
                api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;

                // Retry all queued requests with the new token
                processQueue(null, data.accessToken);

                // Retry the original failed request
                originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                // Refresh token is expired or invalid — force full logout
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