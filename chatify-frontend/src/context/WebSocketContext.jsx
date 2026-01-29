import React, { createContext, useRef, useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import useAuth from '../hooks/useAuth';

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const stompClientRef = useRef(null);

    useEffect(() => {
        // Only connect if we have a user and a token
        if (!token || !user) return;

        console.log("🔄 Attempting WebSocket Connection...");

        // 1. Create the connection
        const socket = new SockJS('http://localhost:8080/ws');
        const client = Stomp.over(socket);

        // Optional: Disable huge debug logs in console
        // client.debug = () => {}; 

        // 2. Connect with Auth Header
        client.connect(
            { 'Authorization': 'Bearer ' + token },
            (frame) => {
                console.log('✅ WebSocket Connected Successfully!');
                setIsConnected(true);
                stompClientRef.current = client;
            },
            (error) => {
                console.error('❌ WebSocket Error:', error);
                setIsConnected(false);
            }
        );

        // Cleanup on unmount or logout
        return () => {
            if (client && client.connected) {
                client.disconnect();
                console.log("🔌 WebSocket Disconnected");
            }
        };
    }, [token, user]);

    // Function to Subscribe to a specific Chat Room
    const subscribeToRoom = (roomId, callback) => {
        if (!stompClientRef.current || !isConnected) return null;

        return stompClientRef.current.subscribe(`/topic/chatroom/${roomId}`, (message) => {
            const parsedMessage = JSON.parse(message.body);
            callback(parsedMessage);
        });
    };

    // Function to Send a Message
    const sendMessage = (roomId, content) => {
        if (stompClientRef.current && isConnected) {
            const payload = {
                content: content,
                chatRoomId: roomId
                // Sender ID is handled by Backend via Token
            };
            
            stompClientRef.current.send(
                `/app/chat/${roomId}/sendMessage`,
                {},
                JSON.stringify(payload)
            );
        } else {
            console.error("Cannot send message: WebSocket not connected");
        }
    };

    return (
        <WebSocketContext.Provider value={{ isConnected, subscribeToRoom, sendMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};