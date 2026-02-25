import axios from 'axios';

// Ensure this matches your Spring Boot port
const API_URL = '/api';

const api = axios.create({
    baseURL: API_URL,
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
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            // Token likely expired - force logout (optional: clear storage)
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Redirect to login if not already there
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

// Matches MessageController.java: @RequestMapping("/api/messages") + @GetMapping("/chatroom/{chatRoomId}")
export const getChatHistory = (roomId) => api.get(`/messages/chatroom/${roomId}`);
export const searchUsers = (query) => api.get(`/chatrooms/search?query=${query}`);

export const createChatRoom = (name, isGroup, participantIds) =>
    api.post('/chatrooms', {
        name,
        isGroupChat: isGroup, // Backend expects "isGroupChat"
        participantIds
    });

export const sendMessageAPI = (messageData) => api.post('/messages', messageData);
// Helper to get all users (useful for starting new chats)
export const getAllUsers = () => api.get('/users');
export default api;