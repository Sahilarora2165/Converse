import React, { createContext, useRef, useEffect, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import useAuth from '../hooks/useAuth';
import { refreshTokenAPI } from '../services/api';
import { WS_URL } from '../utils/constants';

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { token, user, login, logout } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef(null);
  const tokenRef = useRef(token); // always holds the latest token without re-creating the client

  // Keep tokenRef in sync with auth state
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * On success: updates AuthContext + localStorage via login().
   * On failure: logs the user out.
   * Returns the new access token, or null if refresh failed.
   */
  const tryRefreshToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      logout();
      return null;
    }
    try {
      const { data } = await refreshTokenAPI(refreshToken);
      // Persist new tokens — login() updates both context state and localStorage
      const storedUser = JSON.parse(localStorage.getItem('user'));
      login(storedUser, data.accessToken, data.refreshToken);
      tokenRef.current = data.accessToken;
      return data.accessToken;
    } catch (err) {
      console.error('Token refresh failed, logging out:', err);
      logout();
      return null;
    }
  }, [login, logout]);

  useEffect(() => {
    if (!token || !user) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),

      // connectHeaders is called fresh on every connect attempt,
      // so reconnects always use the latest token from tokenRef.
      connectHeaders: { Authorization: `Bearer ${tokenRef.current}` },

      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      debug: (str) => {
        if (import.meta.env.DEV) console.log(str);
      },

      onConnect: () => {
        setIsConnected(true);
        clientRef.current = client;
      },

      onDisconnect: () => {
        setIsConnected(false);
      },

      onStompError: async (frame) => {
        setIsConnected(false);
        const msg = frame.headers?.message || '';

        // JWT expired → refresh token then reconnect with new token
        if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('jwt')) {
          console.warn('JWT expired on STOMP error — refreshing token...');
          const newToken = await tryRefreshToken();
          if (newToken && clientRef.current) {
            // Update connect headers with fresh token before STOMP reconnects
            clientRef.current.connectHeaders = { Authorization: `Bearer ${newToken}` };
          }
          // STOMP will auto-reconnect after reconnectDelay using updated headers
        } else {
          console.error('STOMP error:', msg, frame.body);
        }
      },

      onWebSocketClose: async (evt) => {
        setIsConnected(false);

        // Code 1008 = policy violation (server rejected connection — likely expired JWT)
        if (evt?.code === 1008 || evt?.reason?.toLowerCase().includes('expired')) {
          console.warn('WebSocket closed due to auth error — refreshing token...');
          const newToken = await tryRefreshToken();
          if (newToken && clientRef.current) {
            clientRef.current.connectHeaders = { Authorization: `Bearer ${newToken}` };
          }
        }
      },

      onWebSocketError: (evt) => {
        setIsConnected(false);
        console.error('WebSocket error:', evt);
      },
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
  }, [token, user, tryRefreshToken]);

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
    const sentAt = new Date().toISOString();
    clientRef.current.publish({
      destination: `/app/chat/${roomId}/sendMessage`,
      body: JSON.stringify({ content, chatRoomId: roomId, sentAt }),
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
      sendSeenAck,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};