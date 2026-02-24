import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthCallback = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token    = params.get('token');
        const id       = params.get('id');
        const username = params.get('username');
        const email    = params.get('email');

        if (!token || !id || !username || !email) {
            navigate('/login');
            return;
        }

        const userData = {
            id: parseInt(id),
            username,
            email,
            accessToken: token
        };

        login(userData, token);
        navigate('/chat');

    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="text-white text-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-400 text-sm">Signing you in...</p>
            </div>
        </div>
    );
};

export default OAuthCallback;