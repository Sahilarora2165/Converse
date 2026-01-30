import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/chat">
          <Route index element={<Chat />} />
          <Route path=":chatId" element={<Chat />} />
        </Route>

        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>

  );
}

export default App;