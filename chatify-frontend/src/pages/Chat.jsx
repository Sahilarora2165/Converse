import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistory, sendMessageAPI } from "../services/api";
import NewChatModal from "../components/NewChatModal";
import ChatSidebar from "../components/ChatSidebar";

const Chat = () => {
  const { user, logout } = useAuth();
  const { subscribeToRoom, isConnected } = useWebSocket();
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);

  const currentRoom = rooms.find(r => String(r.id) === chatId);

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

  useEffect(() => {
    if (!currentRoom) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    setMessages([]);

    const loadRoom = async () => {
      try {
        const { data } = await getChatHistory(currentRoom.id);
        setMessages(data);

        if (isConnected) {
          subscriptionRef.current = subscribeToRoom(
            currentRoom.id,
            (incomingMsg) => {
              setMessages(prev => [...prev, incomingMsg]);
            }
          );
        }
      } catch (err) {
        console.error("Failed to load chat room", err);
      }
    };

    loadRoom();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [chatId, isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentRoom) return;

    try {
      await sendMessageAPI({
        content: newMessage,
        chatRoomId: currentRoom.id,
        messageType: "TEXT",
      });
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">

      {/* SIDEBAR */}
      <ChatSidebar rooms={rooms} setRooms={setRooms} />

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col bg-slate-900/50">

        {/* HEADER */}
        <div className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-6">
          <div className="flex flex-col">
            <h2 className="font-bold text-sm tracking-tight text-white uppercase">
              {currentRoom ? (currentRoom.isGroupChat ? `# ${currentRoom.name}` : `direct_message / ${currentRoom.name}`) : "Select a Node"}
            </h2>
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`}></span>
               <span className="text-[10px] text-slate-500 font-mono">{isConnected ? "SYSTEM_READY" : "CONNECTION_LOST"}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="text-xs font-bold border border-slate-700 hover:border-blue-500 px-4 py-1.5 rounded transition-all"
            >
              + NEW COLLAB
            </button>

            <button
              onClick={logout}
              className="text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
            >
              TERMINATE_SESSION
            </button>
          </div>
        </div>

        {/* CONTENT */}
        {currentRoom ? (
          <>
            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.map((msg, index) => {
                const isMe = msg.senderId === user.id;
                return (
                  <div key={index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] group`}>
                      {!isMe && (
                        <div className="text-[10px] font-mono mb-1 text-blue-400 uppercase tracking-widest">
                          {msg.senderEmail.split('@')[0]}
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-4 py-2.5 shadow-sm text-sm leading-relaxed ${
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className={`text-[9px] mt-1 font-mono text-slate-500 ${isMe ? "text-right" : "text-left"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div className="p-4 bg-slate-900 border-t border-slate-800">
              <form onSubmit={handleSend} className="flex gap-3 max-w-5xl mx-auto">
                <input
                  type="text"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
                  placeholder={`Message ${currentRoom.name}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!isConnected || !newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-lg text-xs tracking-widest disabled:opacity-30 transition-all shadow-lg shadow-blue-900/20"
                >
                  SEND
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic font-mono">
            <div className="w-16 h-16 border-2 border-slate-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
               <span className="text-2xl not-italic">⚡</span>
            </div>
            <p className="text-xs uppercase tracking-[0.2em]">Awaiting Data Stream Selection</p>
          </div>
        )}
      </div>

      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={(newRoom) => {
            setRooms(prev => [newRoom, ...prev]);
            navigate(`/chat/${newRoom.id}`);
          }}
        />
      )}
    </div>
  );
};

export default Chat;