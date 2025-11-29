import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_URL } from '../utils/constants';

class WebSocketService {
  constructor() {
    this.client = null;
    this.subscriptions = {};
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.messageQueue = [];
    this.token = null;
    this.onConnectedCallback = null;
    this.onErrorCallback = null;
    this.connectionStateCallbacks = [];
  }

  // Register callback for connection state changes
  onConnectionStateChange(callback) {
    this.connectionStateCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.connectionStateCallbacks = this.connectionStateCallbacks.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners of connection state change
  notifyConnectionStateChange(connected) {
    this.connectionStateCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection state callback:', error);
      }
    });
  }

  connect(token, onConnected, onError) {
    if (this.isConnected) {
      console.log('WebSocket already connected');
      if (onConnected) onConnected();
      return;
    }

    if (this.isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;
    this.token = token;
    this.onConnectedCallback = onConnected;
    this.onErrorCallback = onError;

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        if (import.meta.env.DEV) {
          console.log('STOMP Debug:', str);
        }
      },
      reconnectDelay: this.reconnectDelay,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('WebSocket Connected');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyConnectionStateChange(true);
        
        // Process any queued messages
        this.flushMessageQueue();
        
        if (onConnected) onConnected();
      },
      onDisconnect: () => {
        console.log('WebSocket Disconnected');
        this.isConnected = false;
        this.isConnecting = false;
        this.notifyConnectionStateChange(false);
      },
      onStompError: (frame) => {
        console.error('STOMP Error:', frame.headers.message);
        this.isConnecting = false;
        if (onError) onError(frame.headers.message);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket Error:', error);
        this.isConnecting = false;
        this.handleReconnect();
      },
      onWebSocketClose: () => {
        console.log('WebSocket Closed');
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;
        if (wasConnected) {
          this.notifyConnectionStateChange(false);
          // Attempt to reconnect if we were previously connected
          this.handleReconnect();
        }
      },
    });

    this.client.activate();
  }

  handleReconnect() {
    if (!this.token) {
      console.log('No token available for reconnection');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 3);
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        if (!this.isConnected && !this.isConnecting && this.token) {
          this.connect(this.token, this.onConnectedCallback, this.onErrorCallback);
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      if (this.onErrorCallback) {
        this.onErrorCallback('Connection lost. Please refresh the page.');
      }
    }
  }

  // Reset reconnection attempts (call when user performs action indicating they want to reconnect)
  resetReconnection() {
    this.reconnectAttempts = 0;
  }

  disconnect() {
    this.token = null;
    this.onConnectedCallback = null;
    this.onErrorCallback = null;
    this.messageQueue = [];
    
    if (this.client) {
      // Unsubscribe from all subscriptions
      Object.values(this.subscriptions).forEach((sub) => {
        if (sub) {
          try {
            sub.unsubscribe();
          } catch (error) {
            console.error('Error unsubscribing:', error);
          }
        }
      });
      this.subscriptions = {};
      
      try {
        this.client.deactivate();
      } catch (error) {
        console.error('Error deactivating client:', error);
      }
      
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyConnectionStateChange(false);
      console.log('WebSocket Disconnected');
    }
  }

  subscribe(destination, callback) {
    if (!this.client || !this.isConnected) {
      console.warn('WebSocket not connected, subscription will be pending:', destination);
      return null;
    }

    // Unsubscribe from existing subscription if any
    if (this.subscriptions[destination]) {
      try {
        this.subscriptions[destination].unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from existing subscription:', error);
      }
    }

    try {
      const subscription = this.client.subscribe(destination, (message) => {
        try {
          const body = message.body ? JSON.parse(message.body) : null;
          callback(body);
        } catch {
          // If JSON parsing fails, pass the raw body to the callback
          callback(message.body);
        }
      });

      this.subscriptions[destination] = subscription;
      return subscription;
    } catch (error) {
      console.error('Error subscribing to destination:', destination, error);
      return null;
    }
  }

  unsubscribe(destination) {
    if (this.subscriptions[destination]) {
      try {
        this.subscriptions[destination].unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
      delete this.subscriptions[destination];
    }
  }

  // Queue a message to be sent when connected
  queueMessage(destination, body) {
    this.messageQueue.push({ destination, body });
    console.log('Message queued for later delivery:', destination);
  }

  // Flush the message queue
  flushMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(`Flushing ${this.messageQueue.length} queued messages`);
      const queue = [...this.messageQueue];
      this.messageQueue = [];
      
      queue.forEach(({ destination, body }) => {
        this.send(destination, body, false);
      });
    }
  }

  send(destination, body = {}, queueIfDisconnected = true) {
    if (!this.client || !this.isConnected) {
      if (queueIfDisconnected) {
        this.queueMessage(destination, body);
        return false;
      }
      console.error('WebSocket not connected');
      return false;
    }

    try {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      });
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      if (queueIfDisconnected) {
        this.queueMessage(destination, body);
      }
      return false;
    }
  }

  // Check if the service is connected
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
    };
  }

  // Chat message methods
  sendChatMessage(message) {
    this.send('/app/chat.sendMessage', message);
  }

  sendTypingIndicator(chatRoomId, isTyping) {
    this.send(`/app/chat.typing/${chatRoomId}`, { isTyping });
  }

  markMessageAsRead(messageId) {
    this.send(`/app/chat.read/${messageId}`, {});
  }

  // Presence methods
  updatePresence(status) {
    this.send('/app/presence.update', { status });
  }

  notifyConnected() {
    this.send('/app/presence.connected', {});
  }

  notifyDisconnected() {
    this.send('/app/presence.disconnected', {});
  }

  // Subscribe methods
  subscribeToChatRoom(chatRoomId, onMessage) {
    return this.subscribe(`/topic/chatroom/${chatRoomId}`, onMessage);
  }

  subscribeToTypingIndicator(chatRoomId, onTyping) {
    return this.subscribe(`/topic/chatroom/${chatRoomId}/typing`, onTyping);
  }

  subscribeToReadReceipts(chatRoomId, onRead) {
    return this.subscribe(`/topic/chatroom/${chatRoomId}/read`, onRead);
  }

  subscribeToPresence(onPresence) {
    return this.subscribe('/topic/presence', onPresence);
  }

  subscribeToUserMessages(onMessage) {
    return this.subscribe('/user/queue/messages', onMessage);
  }
}

// Singleton instance
const webSocketService = new WebSocketService();
export default webSocketService;
