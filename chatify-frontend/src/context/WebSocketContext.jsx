import React, { createContext, useRef, useEffect, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import useAuth from '../hooks/useAuth';
import { WS_URL } from '../utils/constants';

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const stompClientRef = useRef(null);

    useEffect(() => {
        if (!token || !user) return;

        const socket = new SockJS(WS_URL);
        const client = Stomp.over(socket);

        client.connect(
            { 'Authorization': 'Bearer ' + token },
            (frame) => {
                setIsConnected(true);
                stompClientRef.current = client;
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

    const subscribeToPresence = useCallback((roomId, callback) => {
        if (!stompClientRef.current || !isConnected) return null;
        return stompClientRef.current.subscribe(`/topic/chatroom/${roomId}/presence`, (msg) => {
            callback(JSON.parse(msg.body));
        });
    }, [isConnected]);

    // Subscribe to delivery status updates
    const subscribeToDelivery = useCallback((roomId, callback) => {
        if (!stompClientRef.current || !isConnected) return null;
        return stompClientRef.current.subscribe(`/topic/chatroom/${roomId}/delivery`, (msg) => {
            callback(JSON.parse(msg.body));
        });
    }, [isConnected]);

    // Subscribe to seen status updates
    const subscribeToSeen = useCallback((roomId, callback) => {
        if (!stompClientRef.current || !isConnected) return null;
        return stompClientRef.current.subscribe(`/topic/chatroom/${roomId}/seen`, (msg) => {
            callback(JSON.parse(msg.body));
        });
    }, [isConnected]);

    const sendMessage = useCallback((roomId, content) => {
        if (stompClientRef.current?.connected) {
            stompClientRef.current.send(`/app/chat/${roomId}/sendMessage`, {}, JSON.stringify({ content, chatRoomId: roomId }));
        }
    }, []);

    // Send delivery acknowledgment
    const sendDeliveryAck = useCallback((chatRoomId, lastDeliveredMessageId) => {
        if (stompClientRef.current?.connected) {
            stompClientRef.current.send('/app/chat.delivered', {}, JSON.stringify({
                chatRoomId,
                lastDeliveredMessageId
            }));
        }
    }, []);

    // Send seen acknowledgment
    const sendSeenAck = useCallback((chatRoomId, lastSeenMessageId) => {
        if (stompClientRef.current?.connected) {
            stompClientRef.current.send('/app/chat.seen', {}, JSON.stringify({
                chatRoomId,
                lastSeenMessageId
            }));
        }
    }, []);

    return (
        <WebSocketContext.Provider value={{
            isConnected,
            subscribeToRoom,
            subscribeToPresence,
            subscribeToDelivery,
            subscribeToSeen,
            sendMessage,
            sendDeliveryAck,
            sendSeenAck
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};