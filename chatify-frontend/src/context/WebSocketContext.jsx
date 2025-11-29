/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import webSocketService from '../services/websocket';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const messageCallbacksRef = useRef({});
  const readReceiptCallbacksRef = useRef({});
  const typingTimeoutsRef = useRef({});
  const pendingSubscriptionsRef = useRef([]);
  const hasShownConnectionErrorRef = useRef(false);

  const handlePresenceUpdate = useCallback((presence) => {
    if (presence && presence.userId) {
      setOnlineUsers((prev) => ({
        ...prev,
        [presence.userId]: {
          status: presence.status,
          lastSeen: presence.lastSeen,
        },
      }));
    }
  }, []);

  const handleTypingIndicator = useCallback((chatRoomId, typing) => {
    if (!typing || !typing.username) return;

    const key = `${chatRoomId}-${typing.username}`;

    if (typing.isTyping) {
      setTypingUsers((prev) => ({
        ...prev,
        [chatRoomId]: {
          ...prev[chatRoomId],
          [typing.username]: true,
        },
      }));

      // Clear existing timeout
      if (typingTimeoutsRef.current[key]) {
        clearTimeout(typingTimeoutsRef.current[key]);
      }

      // Auto-remove typing indicator after 3 seconds
      typingTimeoutsRef.current[key] = setTimeout(() => {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          if (updated[chatRoomId]) {
            delete updated[chatRoomId][typing.username];
            if (Object.keys(updated[chatRoomId]).length === 0) {
              delete updated[chatRoomId];
            }
          }
          return updated;
        });
      }, 3000);
    } else {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        if (updated[chatRoomId]) {
          delete updated[chatRoomId][typing.username];
          if (Object.keys(updated[chatRoomId]).length === 0) {
            delete updated[chatRoomId];
          }
        }
        return updated;
      });

      if (typingTimeoutsRef.current[key]) {
        clearTimeout(typingTimeoutsRef.current[key]);
        delete typingTimeoutsRef.current[key];
      }
    }
  }, []);

  // Helper function to subscribe to chat room channels
  const subscribeToChatRoomChannels = useCallback((chatRoomId) => {
    webSocketService.subscribeToChatRoom(chatRoomId, (message) => {
      if (messageCallbacksRef.current[chatRoomId]) {
        messageCallbacksRef.current[chatRoomId](message);
      }
    });

    webSocketService.subscribeToTypingIndicator(chatRoomId, (typing) => {
      handleTypingIndicator(chatRoomId, typing);
    });

    webSocketService.subscribeToReadReceipts(chatRoomId, (receipt) => {
      if (readReceiptCallbacksRef.current[chatRoomId]) {
        readReceiptCallbacksRef.current[chatRoomId](receipt);
      }
    });
  }, [handleTypingIndicator]);

  // Process any pending subscriptions after reconnection
  const processPendingSubscriptions = useCallback(() => {
    const pending = [...pendingSubscriptionsRef.current];
    pendingSubscriptionsRef.current = [];
    
    pending.forEach(({ chatRoomId }) => {
      if (messageCallbacksRef.current[chatRoomId]) {
        subscribeToChatRoomChannels(chatRoomId);
      }
    });
  }, [subscribeToChatRoomChannels]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        hasShownConnectionErrorRef.current = false;
        
        // Listen for connection state changes from the service
        const unsubscribeState = webSocketService.onConnectionStateChange((connected) => {
          setIsConnected(connected);
          setIsConnecting(webSocketService.isConnecting);
          
          if (connected) {
            hasShownConnectionErrorRef.current = false;
            // Re-subscribe to pending subscriptions after reconnection
            processPendingSubscriptions();
          }
        });

        webSocketService.connect(
          token,
          () => {
            setIsConnected(true);
            setIsConnecting(false);
            webSocketService.notifyConnected();
            // Subscribe to global presence updates
            webSocketService.subscribeToPresence(handlePresenceUpdate);
            // Subscribe to user-specific messages
            webSocketService.subscribeToUserMessages((message) => {
              if (message && message.senderUsername) {
                toast(`New message from ${message.senderUsername}`, { icon: '💬' });
              }
            });
          },
          (error) => {
            setIsConnected(false);
            setIsConnecting(false);
            if (!hasShownConnectionErrorRef.current) {
              hasShownConnectionErrorRef.current = true;
              toast.error(error || 'WebSocket connection error');
            }
          }
        );

        return () => {
          unsubscribeState();
          webSocketService.notifyDisconnected();
          webSocketService.disconnect();
          setIsConnected(false);
          setIsConnecting(false);
        };
      }
    }

    return () => {
      if (isAuthenticated) {
        webSocketService.notifyDisconnected();
        webSocketService.disconnect();
        setIsConnected(false);
        setIsConnecting(false);
      }
    };
  }, [isAuthenticated, user, handlePresenceUpdate, processPendingSubscriptions]);

  const subscribeToChatRoom = useCallback((chatRoomId, onMessage) => {
    messageCallbacksRef.current[chatRoomId] = onMessage;
    
    if (!isConnected) {
      // Store for later subscription when connected
      pendingSubscriptionsRef.current.push({ chatRoomId, onMessage });
      return null;
    }

    subscribeToChatRoomChannels(chatRoomId);
  }, [isConnected, subscribeToChatRoomChannels]);

  const unsubscribeFromChatRoom = useCallback((chatRoomId) => {
    webSocketService.unsubscribe(`/topic/chatroom/${chatRoomId}`);
    webSocketService.unsubscribe(`/topic/chatroom/${chatRoomId}/typing`);
    webSocketService.unsubscribe(`/topic/chatroom/${chatRoomId}/read`);
    delete messageCallbacksRef.current[chatRoomId];
    delete readReceiptCallbacksRef.current[chatRoomId];
    // Remove from pending subscriptions if present
    pendingSubscriptionsRef.current = pendingSubscriptionsRef.current.filter(
      (sub) => sub.chatRoomId !== chatRoomId
    );
  }, []);

  const sendMessage = useCallback((message) => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }
    webSocketService.sendChatMessage(message);
  }, [isConnected]);

  const sendTypingIndicator = useCallback((chatRoomId, isTyping) => {
    if (!isConnected) return;
    webSocketService.sendTypingIndicator(chatRoomId, isTyping);
  }, [isConnected]);

  const markMessageAsRead = useCallback((messageId) => {
    if (!isConnected) return;
    webSocketService.markMessageAsRead(messageId);
  }, [isConnected]);

  const updatePresence = useCallback((status) => {
    if (!isConnected) return;
    webSocketService.updatePresence(status);
  }, [isConnected]);

  const setReadReceiptCallback = useCallback((chatRoomId, callback) => {
    readReceiptCallbacksRef.current[chatRoomId] = callback;
  }, []);

  const getTypingUsers = useCallback((chatRoomId) => {
    return typingUsers[chatRoomId] || {};
  }, [typingUsers]);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers[userId]?.status === 'ONLINE';
  }, [onlineUsers]);

  const value = {
    isConnected,
    isConnecting,
    typingUsers,
    onlineUsers,
    subscribeToChatRoom,
    unsubscribeFromChatRoom,
    sendMessage,
    sendTypingIndicator,
    markMessageAsRead,
    updatePresence,
    setReadReceiptCallback,
    getTypingUsers,
    isUserOnline,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
