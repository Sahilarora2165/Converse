import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const OAuthCallback = () => {
    const navigate   = useNavigate();
    const { login }  = useAuth();
    const calledRef  = useRef(false); // Prevent double-call in React StrictMode

    useEffect(() => {
        if (calledRef.current) return;
        calledRef.current = true;

        const exchangeToken = async () => {
            // Check if backend signalled an error via query param
            const params = new URLSearchParams(window.location.search);
            const error  = params.get('error');
            if (error) {
                navigate('/login?error=' + error);
                return;
            }

            try {
                // Exchange the HttpOnly cookie for JWT tokens.
                // The cookie (oauth2_pending) was set by OAuth2SuccessHandler and is
                // automatically sent by the browser with this request.
                // withCredentials: true ensures cookies are sent cross-origin if needed.
                const response = await api.get('/auth/oauth2/token', {
                    withCredentials: true
                });

                const { accessToken, refreshToken, username, email, id } = response.data;

                if (!accessToken || !refreshToken) {
                    navigate('/login?error=oauth2_failed');
                    return;
                }

                const userData = { id, username, email };
                login(userData, accessToken, refreshToken);
                navigate('/chat');

            } catch (err) {
                console.error('OAuth2 token exchange failed:', err);
                navigate('/login?error=oauth2_failed');
            }
        };

        exchangeToken();
    }, [login, navigate]);

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