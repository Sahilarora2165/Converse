import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistory, sendMessageAPI } from "../services/api";
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

  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  const currentRoom = rooms.find(r => String(r.id) === String(chatId));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initial rooms fetch
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await getChatRooms();
        setRooms(data);
      } catch (err) {
        console.error("Failed to fetch rooms", err);
      }
    };
    fetchRooms();
  }, []);

  // Chat-specific load + subscription
  useEffect(() => {
    if (!chatId) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    setMessages([]);

    const loadChat = async () => {
      try {
        const { data } = await getChatHistory(chatId);
        setMessages(data);
        setTimeout(scrollToBottom, 50);

        subscriptionRef.current = subscribeToRoom(chatId, (message) => {
          setMessages((prev) => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          setTimeout(scrollToBottom, 10);
        });
      } catch (err) {
        console.error("Failed to load chat", err);
      }
    };

    loadChat();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [chatId, subscribeToRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    try {
      sendMessage(chatId, newMessage);
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleChatCreated = (newChat) => {
    setRooms((prev) => {
      const exists = prev.find((r) => r.id === newChat.id);
      if (exists) return prev;
      return [newChat, ...prev];
    });

    setShowNewChatModal(false);
    navigate(`/chat/${newChat.id}`);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      <ChatSidebar
        rooms={rooms}
        setRooms={setRooms}
        currentChatId={chatId}
        onNewChat={() => setShowNewChatModal(true)}
        user={user}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        {chatId && currentRoom ? (
          <>
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-white">
                  {currentRoom.isGroupChat
                    ? currentRoom.name
                    : currentRoom.participants.find(p => String(p.id) !== String(user?.id))?.username || "Unknown"}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span,span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Secure Channel</span>
                </div>
              </div>
            </div>

            {/* Message Area - FIXED ALIGNMENT + KEY + GROUP SENDER NAME */}
            <div className="flex-1 overflow-yczki-auto p-6 space-y-4 custom-scrollbar">
              {messages.map((msg) => {
                const isMe = String(msg.sender?.id) === String(user?.id);

                return (
                  <div
                    key={msg.id || msg.timestamp}  // Stable key prevents re-renders
                    className={`flex w-full mb-4 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700"
                      }`}
                    >
                      {/* Show sender name in group chats for non-owned messages */}
                      {!isMe && currentRoom?.isGroupChat && msg.sender?.username && (
                        <p className="text-xs opacity-70 mb-1">{msg.sender.username}</p>
                      )}
                      <p className="text-sm">{msg.content}</p>
                      <span className="text-[10px] opacity-50 block mt-1 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-slate-900/50 border-t border-slate-800">
              <form onSubmit={handleSendMessage} className="flex space-x-3 max-w-5xl mx-auto">
                <input
                  type="text"
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
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
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 animate-pulse">📡</div>
            <p className="text-xs font-bold tracking-widest uppercase">Select a conversation</p>
          </div>
        )}
      </div>

      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleChatCreated}
        />
      )}
    </div>
  );
};

export default Chat;