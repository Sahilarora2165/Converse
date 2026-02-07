import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistory } from "../services/api";
import api from "../services/api";
import NewChatModal from "../components/NewChatModal";
import ChatSidebar from "../components/ChatSidebar";

const Chat = () => {
  const { user, logout } = useAuth();
  const { subscribeToRoom, sendMessage, isConnected } = useWebSocket();
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const subscriptionRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSubscriptionRef = useRef(null);

  const currentRoom = rooms.find(r => String(r.id) === String(chatId));

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Handle scroll position to show/hide scroll button
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    setShowScrollButton(!isNearBottom);
  }, []);

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const { data } = await getChatRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchRooms();
  }, []);

  // Send typing indicator
  const sendTypingIndicator = useCallback((typing) => {
    if (!chatId || !isConnected) return;

    // Send via WebSocket using your existing sendMessage infrastructure
    // Backend will broadcast this to /topic/chatroom/{chatId}/typing
    try {
      // Option 1: Use REST endpoint
      api.post(`/chat/typing/${chatId}`, { isTyping: typing });

      // Option 2: Or use WebSocket directly if you have the method
      // stompClient.send(`/app/chat/typing/${chatId}`, {}, JSON.stringify({ isTyping: typing }));
    } catch (err) {
      // Silently fail - typing indicators aren't critical
    }
  }, [chatId, isConnected]);

  // Handle input change with typing indicator
  const handleInputChange = useCallback((e) => {
    setNewMessage(e.target.value);

    // Send typing indicator
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  }, [isTyping, sendTypingIndicator]);

  // Chat load + subscriptions
  useEffect(() => {
    if (!chatId) return;

    // Unsubscribe from previous subscriptions
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    if (typingSubscriptionRef.current) {
      typingSubscriptionRef.current.unsubscribe();
      typingSubscriptionRef.current = null;
    }

    setMessages([]);
    setTypingUsers(new Set());

    const loadChat = async () => {
      try {
        const { data } = await getChatHistory(chatId);
        setMessages(data);
        setTimeout(() => scrollToBottom("auto"), 50);

        // Mark all as read
        try {
          await api.put(`/messages/chatroom/${chatId}/read-all`);
          await fetchRooms();
        } catch (err) {
          console.error("Failed to mark all as read", err);
        }

        // Subscribe to messages
        subscriptionRef.current = subscribeToRoom(chatId, (message) => {
          setMessages((prev) => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });

          // Auto-scroll if near bottom
          setTimeout(() => {
            if (messagesContainerRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
              if (isNearBottom) {
                scrollToBottom();
              }
            }
          }, 10);
        });

        // Subscribe to typing indicators
        // This assumes your backend broadcasts to: /topic/chatroom/{chatId}/typing
        try {
          typingSubscriptionRef.current = subscribeToRoom(`${chatId}/typing`, (data) => {
            const { userId, username, isTyping } = data;

            // Don't show own typing indicator
            if (String(userId) === String(user?.id)) return;

            setTypingUsers(prev => {
              const newSet = new Set(prev);
              if (isTyping) {
                newSet.add(username || `User ${userId}`);
              } else {
                newSet.delete(username || `User ${userId}`);
              }
              return newSet;
            });
          });
        } catch (err) {
          console.log("Typing indicators not available yet");
        }
      } catch (err) {
        console.error("Failed to load chat", err);
      }
    };

    loadChat();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (typingSubscriptionRef.current) {
        typingSubscriptionRef.current.unsubscribe();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Send final typing stop
      if (isTyping) {
        sendTypingIndicator(false);
      }
    };
  }, [chatId, subscribeToRoom, scrollToBottom, user?.id, sendTypingIndicator, isTyping]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    sendTypingIndicator(false);

    sendMessage(chatId, newMessage);
    setNewMessage("");
  };

  const handleChatCreated = (newChat) => {
    setRooms((prev) => {
      if (prev.some(r => r.id === newChat.id)) return prev;
      return [newChat, ...prev];
    });
    setShowNewChatModal(false);
    navigate(`/chat/${newChat.id}`);
  };

  // Group messages by date
  const groupMessagesByDate = useCallback((messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const messageDate = new Date(msg.timestamp);
      const dateKey = messageDate.toDateString();

      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({
          type: 'date',
          date: messageDate,
          dateKey
        });
      }

      groups.push({
        type: 'message',
        ...msg
      });
    });

    return groups;
  }, []);

  // Format date separator
  const formatDateSeparator = useCallback((date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = date.toDateString();
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';

    // Format as "January 15, 2024"
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }, []);

  const groupedMessages = groupMessagesByDate(messages);
  const typingUsersArray = Array.from(typingUsers);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      <ChatSidebar
        rooms={rooms}
        setRooms={setRooms}
        onNewChat={() => setShowNewChatModal(true)}
      />

      <div className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        {chatId && currentRoom ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-sm font-bold tracking-widest uppercase text-white">
                  {currentRoom.isGroupChat
                    ? currentRoom.name
                    : currentRoom.participants.find(p => String(p.id) !== String(user?.id))?.username || "Unknown"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {typingUsersArray.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-[10px] text-blue-400 font-semibold">
                        {typingUsersArray.length === 1
                          ? `${typingUsersArray[0]} is typing...`
                          : `${typingUsersArray.length} people are typing...`}
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                        {currentRoom.isGroupChat
                          ? `${currentRoom.participants?.length || 0} members`
                          : 'Online'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-1 custom-scrollbar"
            >
              {groupedMessages.map((item, index) => {
                if (item.type === 'date') {
                  return (
                    <div key={`date-${item.dateKey}`} className="flex items-center justify-center my-4">
                      <div className="bg-slate-800/50 px-3 py-1 rounded-full">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                          {formatDateSeparator(item.date)}
                        </span>
                      </div>
                    </div>
                  );
                }

                const msg = item;
                const isMe = String(msg.senderId) === String(user?.id);
                const showSender = !isMe && currentRoom.isGroupChat;

                return (
                  <div
                    key={msg.id}
                    className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Sender name for group chats - uses senderUsername from your DTO */}
                      {showSender && (
                        <span className="text-[10px] text-slate-400 font-semibold mb-1 px-2">
                          {msg.senderUsername || 'Unknown'}
                        </span>
                      )}

                      {/* Message bubble */}
                      <div
                        className={`p-3 rounded-2xl shadow-sm ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700"
                        }`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] opacity-50">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {/* Message status indicators - uses your existing status enum */}
                          {isMe && msg.status && (
                            <span className="text-[10px] opacity-70">
                              {msg.status === 'DELIVERED' && '✓✓'}
                              {msg.status === 'READ' && '✓✓'}
                              {msg.status === 'SENT' && '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <button
                onClick={() => scrollToBottom()}
                className="absolute bottom-24 right-8 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-full shadow-lg transition-all z-10 border border-slate-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}

            {/* Input */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800">
              <form onSubmit={handleSendMessage} className="flex space-x-3 max-w-5xl mx-auto">
                <input
                  type="text"
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleInputChange}
                  disabled={!isConnected}
                />
                <button
                  type="submit"
                  disabled={!isConnected || !newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-xl text-xs tracking-widest disabled:opacity-30 transition-all active:scale-95"
                >
                  SEND
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <p className="text-xs font-bold tracking-widest uppercase">Select a conversation</p>
            <p className="text-[10px] text-slate-600 mt-2">Choose a chat to start messaging</p>
          </div>
        )}
      </div>

      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleChatCreated}
        />
      )}

      {/* Custom Scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(15 23 42);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(51 65 85);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(71 85 105);
        }
      `}</style>
    </div>
  );
};

export default Chat;