import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { getMessages, markAllMessagesAsRead } from '../../api/messages';
import { getChatRoomById } from '../../api/chatrooms';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import GroupInfo from '../Group/GroupInfo';
import LoadingSpinner from '../Common/LoadingSpinner';
import Avatar from '../Common/Avatar';
import OnlineStatus from '../Common/OnlineStatus';
import { getChatDisplayName, getOtherParticipant } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ChatWindow = ({ chatRoomId, onChatUpdated }) => {
  const { user } = useAuth();
  const { subscribeToChatRoom, unsubscribeFromChatRoom, isConnected, isUserOnline, setReadReceiptCallback } = useWebSocket();
  
  const [chatRoom, setChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const previousChatRoomIdRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadChatRoom = useCallback(async () => {
    if (!chatRoomId) return;
    
    try {
      const data = await getChatRoomById(chatRoomId);
      setChatRoom(data);
    } catch (error) {
      console.error('Failed to load chat room:', error);
      toast.error('Failed to load chat room');
    }
  }, [chatRoomId]);

  const loadMessages = useCallback(async () => {
    if (!chatRoomId) return;
    
    try {
      setLoading(true);
      const data = await getMessages(chatRoomId);
      setMessages(data);
      // Mark all messages as read when opening the chat
      await markAllMessagesAsRead(chatRoomId);
      if (onChatUpdated) onChatUpdated();
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [chatRoomId, onChatUpdated]);

  const handleNewMessage = useCallback((message) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
    scrollToBottom();
    
    // Mark as read if it's from someone else
    if (message.senderId !== user?.id) {
      markAllMessagesAsRead(chatRoomId);
      if (onChatUpdated) onChatUpdated();
    }
  }, [chatRoomId, user?.id, scrollToBottom, onChatUpdated]);

  const handleReadReceipt = useCallback((receipt) => {
    setMessages((prev) => 
      prev.map((msg) => {
        if (msg.id === receipt.messageId) {
          return {
            ...msg,
            readByUserIds: receipt.readByUserIds || [...(msg.readByUserIds || []), receipt.userId],
          };
        }
        return msg;
      })
    );
  }, []);

  const handleMessageSent = useCallback((message) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
    scrollToBottom();
    if (onChatUpdated) onChatUpdated();
  }, [scrollToBottom, onChatUpdated]);

  // Load chat room and messages when chatRoomId changes
  useEffect(() => {
    if (chatRoomId && chatRoomId !== previousChatRoomIdRef.current) {
      previousChatRoomIdRef.current = chatRoomId;
      loadChatRoom();
      loadMessages();
    }
  }, [chatRoomId, loadChatRoom, loadMessages]);

  // Subscribe to WebSocket when connected
  useEffect(() => {
    if (isConnected && chatRoomId) {
      subscribeToChatRoom(chatRoomId, handleNewMessage);
      setReadReceiptCallback(chatRoomId, handleReadReceipt);
    }

    return () => {
      if (chatRoomId) {
        unsubscribeFromChatRoom(chatRoomId);
      }
    };
  }, [isConnected, chatRoomId, subscribeToChatRoom, unsubscribeFromChatRoom, handleNewMessage, handleReadReceipt, setReadReceiptCallback]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [loading, scrollToBottom]);

  if (!chatRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-gray-700">Welcome to Chatify</h2>
          <p className="text-gray-500 mt-2">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const otherParticipant = !chatRoom?.isGroupChat ? getOtherParticipant(chatRoom, user?.id) : null;
  const isOtherOnline = otherParticipant ? isUserOnline(otherParticipant.id) : false;

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar 
            user={otherParticipant || { username: chatRoom?.name }}
            size="md"
            showStatus={!chatRoom?.isGroupChat}
            isOnline={isOtherOnline}
          />
          <div>
            <h2 className="font-semibold text-gray-800">
              {getChatDisplayName(chatRoom, user?.id)}
            </h2>
            {chatRoom?.isGroupChat ? (
              <p className="text-xs text-gray-500">
                {chatRoom.participants?.length} participants
              </p>
            ) : (
              <OnlineStatus isOnline={isOtherOnline} size="sm" />
            )}
          </div>
        </div>
        
        {chatRoom?.isGroupChat && (
          <button
            onClick={() => setShowGroupInfo(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Group Info"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList messages={messages} currentUserId={user?.id} chatRoom={chatRoom} />
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <TypingIndicator chatRoomId={chatRoomId} />

      {/* Message Input */}
      <MessageInput 
        chatRoomId={chatRoomId} 
        onMessageSent={handleMessageSent}
      />

      {/* Group Info Modal */}
      {showGroupInfo && chatRoom?.isGroupChat && (
        <GroupInfo 
          chatRoom={chatRoom} 
          onClose={() => setShowGroupInfo(false)}
          onChatRoomUpdated={(updated) => {
            setChatRoom(updated);
            if (onChatUpdated) onChatUpdated();
          }}
        />
      )}
    </div>
  );
};

export default ChatWindow;
