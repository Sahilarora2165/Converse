import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_URL } from '../utils/constants';

class WebSocketService {
  constructor() {
    this.client = null;
    this.subscriptions = {};
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect(token, onConnected, onError) {
    if (this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        console.log('STOMP Debug:', str);
      },
      reconnectDelay: this.reconnectDelay,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('WebSocket Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (onConnected) onConnected();
      },
      onDisconnect: () => {
        console.log('WebSocket Disconnected');
        this.isConnected = false;
      },
      onStompError: (frame) => {
        console.error('STOMP Error:', frame.headers.message);
        if (onError) onError(frame.headers.message);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket Error:', error);
        this.handleReconnect(token, onConnected, onError);
      },
      onWebSocketClose: () => {
        console.log('WebSocket Closed');
        this.isConnected = false;
      },
    });

    this.client.activate();
  }

  handleReconnect(token, onConnected, onError) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => {
        this.connect(token, onConnected, onError);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      if (onError) onError('Connection lost. Please refresh the page.');
    }
  }

  disconnect() {
    if (this.client && this.isConnected) {
      // Unsubscribe from all subscriptions
      Object.values(this.subscriptions).forEach((sub) => {
        if (sub) sub.unsubscribe();
      });
      this.subscriptions = {};
      this.client.deactivate();
      this.isConnected = false;
      console.log('WebSocket Disconnected');
    }
  }

  subscribe(destination, callback) {
    if (!this.client || !this.isConnected) {
      console.error('WebSocket not connected');
      return null;
    }

    // Unsubscribe from existing subscription if any
    if (this.subscriptions[destination]) {
      this.subscriptions[destination].unsubscribe();
    }

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const body = message.body ? JSON.parse(message.body) : null;
        callback(body);
      } catch {
        callback(message.body);
      }
    });

    this.subscriptions[destination] = subscription;
    return subscription;
  }

  unsubscribe(destination) {
    if (this.subscriptions[destination]) {
      this.subscriptions[destination].unsubscribe();
      delete this.subscriptions[destination];
    }
  }

  send(destination, body = {}) {
    if (!this.client || !this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
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
