import React, { createContext, useRef, useEffect, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import useAuth from '../hooks/useAuth';

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const stompClientRef = useRef(null);

    useEffect(() => {
        if (!token || !user) return;

        const socket = new SockJS('http://localhost:8080/ws');
        const client = Stomp.over(socket);

        client.connect(
            { 'Authorization': 'Bearer ' + token },
            (frame) => {
                setIsConnected(true);
                stompClientRef.current = client;
                // REMOVED: Global presence sub—no longer used.
            },
            (error) => {
                setIsConnected(false);
                console.error('WebSocket error:', error);
            }
        );

        return () => {
            if (client.connected) {
                client.disconnect();
                setIsConnected(false);
            }
        };
    }, [token, user]);

    const subscribeToRoom = useCallback((roomId, callback) => {
        if (!stompClientRef.current || !isConnected) return null;
        return stompClientRef.current.subscribe(`/topic/chatroom/${roomId}`, (msg) => {
            callback(JSON.parse(msg.body));
        });
    }, [isConnected]);

    // NEW: Dedicated presence sub per room.
    const subscribeToPresence = useCallback((roomId, callback) => {
        if (!stompClientRef.current || !isConnected) return null;
        return stompClientRef.current.subscribe(`/topic/chatroom/${roomId}/presence`, (msg) => {
            callback(JSON.parse(msg.body));
        });
    }, [isConnected]);

    const sendMessage = useCallback((roomId, content) => {
        if (stompClientRef.current?.connected) {
            stompClientRef.current.send(`/app/chat/${roomId}/sendMessage`, {}, JSON.stringify({ content, chatRoomId: roomId }));
        }
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, subscribeToRoom, subscribeToPresence, sendMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};