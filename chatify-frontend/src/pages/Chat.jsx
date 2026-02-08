import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistory } from "../services/api";
import api from "../services/api"; // FIXED: Import api for typing indicator
import NewChatModal from "../components/NewChatModal";
import ChatSidebar from "../components/ChatSidebar";

const Chat = () => {
  const { user } = useAuth();
  const { subscribeToRoom, sendMessage, isConnected } = useWebSocket();
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const subscriptionRef = useRef(null);

  const currentRoom = rooms.find(r => String(r.id) === String(chatId));

  const otherUser = currentRoom && !currentRoom.isGroupChat
    ? currentRoom.participants.find(p => String(p.id) !== String(user?.id))
    : null;

  const isOtherUserOnline = otherUser?.status === 'ONLINE';

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  };

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await getChatRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to load rooms", err);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  // FIXED: Load history + mark as read + subscribe (proper order to avoid race condition)
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      subscriptionRef.current?.unsubscribe();
      return;
    }

    const loadHistoryAndSubscribe = async () => {
      try {
        // STEP 1: Load message history
        const { data } = await getChatHistory(chatId);
        setMessages(data || []);
        scrollToBottom('auto');

        // STEP 2: FIXED - Mark all messages as read in backend (this fixes reload bug)
        await api.put(`/messages/chatroom/${chatId}/read-all`);

        // STEP 3: Subscribe to new messages AFTER history is loaded (prevents race condition)
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToRoom(chatId, (message) => {
          setMessages(prev => [...prev, message]);
          scrollToBottom();
        });

      } catch (err) {
        console.error("Failed to load chat history or subscribe", err);
        setMessages([]);
      }
    };

    loadHistoryAndSubscribe();

    return () => subscriptionRef.current?.unsubscribe();
  }, [chatId, subscribeToRoom, scrollToBottom]);

  const sendTypingIndicator = useCallback((typing) => {
    if (!chatId || !isConnected) return;
    // FIXED: Proper error handling instead of empty catch
    api.post(`/chat/typing/${chatId}`, { isTyping: typing })
      .catch(err => console.error("Typing indicator failed:", err));
  }, [chatId, isConnected]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(false);
    }, 2000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    sendMessage(chatId, newMessage.trim());
    setNewMessage("");
  };

  return (
    <div className="flex h-screen bg-black">
      <ChatSidebar rooms={rooms} setRooms={setRooms} onNewChat={() => setShowNewChatModal(true)} />

      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* HEADER */}
            <div className="p-6 border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">
                  {currentRoom.isGroupChat ? currentRoom.name : otherUser?.username || 'Unknown'}
                </h2>

                {!currentRoom.isGroupChat && otherUser && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${isOtherUserOnline ? "bg-emerald-500" : "bg-stone-600"}`} />
                    <span className={isOtherUserOnline ? "text-emerald-400" : "text-stone-500"}>
                      {isOtherUserOnline ? "Online" : `Last seen ${formatRelativeTime(otherUser.lastSeen)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {messages.map((msg) => {
                const isMe = String(msg.senderId) === String(user?.id);
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`px-5 py-3 rounded-2xl max-w-[65%] ${
                        isMe
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-black"
                          : "bg-[#1a1a1a] text-white border border-[#262626]"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-[#262626] flex gap-3">
              <input
                value={newMessage}
                onChange={handleInputChange}
                disabled={!isConnected}
                placeholder="Type a message…"
                className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-3 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !isConnected}
                className="px-5 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-black font-semibold disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-stone-500">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {showNewChatModal && (
        <NewChatModal onClose={() => setShowNewChatModal(false)} onChatCreated={fetchRooms} />
      )}
    </div>
  );
};

export default Chat;