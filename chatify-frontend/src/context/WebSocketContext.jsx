import React, { createContext, useRef, useEffect, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import useAuth from '../hooks/useAuth';
import { WS_URL } from '../utils/constants';

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    if (!token || !user) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => {
        // silence in prod
        if (import.meta.env.DEV) console.log(str);
      },
      onConnect: () => {
        setIsConnected(true);
        clientRef.current = client;
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: (frame) => {
        setIsConnected(false);
        console.error('STOMP error:', frame.headers?.message, frame.body);
      },
      onWebSocketClose: () => {
        setIsConnected(false);
      },
      onWebSocketError: (evt) => {
        setIsConnected(false);
        console.error('WebSocket error:', evt);
      }
    });

    client.activate();

    return () => {
      try {
        client.deactivate();
      } catch (e) {
        // ignore
      }
      setIsConnected(false);
      clientRef.current = null;
    };
  }, [token, user]);

  const subscribeToRoom = useCallback((roomId, callback) => {
    if (!clientRef.current || !isConnected) return null;
    return clientRef.current.subscribe(`/topic/chatroom/${roomId}`, (msg) => {
      callback(JSON.parse(msg.body));
    });
  }, [isConnected]);

  const subscribeToPresence = useCallback((roomId, callback) => {
    if (!clientRef.current || !isConnected) return null;
    return clientRef.current.subscribe(`/topic/chatroom/${roomId}/presence`, (msg) => {
      callback(JSON.parse(msg.body));
    });
  }, [isConnected]);

  const subscribeToDelivery = useCallback((roomId, callback) => {
    if (!clientRef.current || !isConnected) return null;
    return clientRef.current.subscribe(`/topic/chatroom/${roomId}/delivery`, (msg) => {
      callback(JSON.parse(msg.body));
    });
  }, [isConnected]);

  const subscribeToSeen = useCallback((roomId, callback) => {
    if (!clientRef.current || !isConnected) return null;
    return clientRef.current.subscribe(`/topic/chatroom/${roomId}/seen`, (msg) => {
      callback(JSON.parse(msg.body));
    });
  }, [isConnected]);

  const sendMessage = useCallback((roomId, content) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: `/app/chat/${roomId}/sendMessage`,
      body: JSON.stringify({ content, chatRoomId: roomId }),
    });
  }, []);

  const sendDeliveryAck = useCallback((chatRoomId, lastDeliveredMessageId) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: '/app/chat.delivered',
      body: JSON.stringify({ chatRoomId, lastDeliveredMessageId }),
    });
  }, []);

  const sendSeenAck = useCallback((chatRoomId, lastSeenMessageId) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: '/app/chat.seen',
      body: JSON.stringify({ chatRoomId, lastSeenMessageId }),
    });
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