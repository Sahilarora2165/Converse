import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import OAuthCallback from './pages/OAuthCallback';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const toastOptions = {
    duration: 3000,
    style: {
      background: '#1a1a1a',
      color: '#e8e8e8',
      border: '1px solid #2a2a2a',
    },
    success: {
      iconTheme: {
        primary: '#c9a961',
        secondary: '#0a0a0a',
      },
    },
    error: {
      iconTheme: {
        primary: '#dc2626',
        secondary: '#0a0a0a',
      },
    },
  };

  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          {/* ✅ Toaster with options defined separately */}
          <Toaster position="top-right" toastOptions={toastOptions} />

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />

            <Route path="/chat">
              <Route
                index
                element={
                  <PrivateRoute>
                    <Chat />
                  </PrivateRoute>
                }
              />
              <Route
                path=":chatId"
                element={
                  <PrivateRoute>
                    <Chat />
                  </PrivateRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;