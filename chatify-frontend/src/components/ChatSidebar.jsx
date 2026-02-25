import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChatRooms } from "../services/api";
import useAuth from '../hooks/useAuth';
import useWebSocket from '../hooks/useWebSocket';

const ChatSidebar = ({ rooms, setRooms, onNewChat }) => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: currentUser, logout } = useAuth();
  const { isConnected, subscribeToRoom, subscribeToPresence } = useWebSocket();

  const [activeTab, setActiveTab] = useState('all');

  // Initial rooms fetch + sort after load
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await getChatRooms();
        const sorted = [...data].sort((a, b) => {
          const timeA = a.lastMessageTimestamp || a.createdAt;
          const timeB = b.lastMessageTimestamp || b.createdAt;
          return new Date(timeB) - new Date(timeA);
        });
        setRooms(sorted);
      } catch (err) {
        console.error("Failed to load chat rooms", err);
      }
    };
    fetchRooms();
  }, [setRooms]);

  // Per-room presence subscriptions
  useEffect(() => {
    if (!isConnected || rooms.length === 0 || !subscribeToPresence) return;

    const presenceSubs = rooms.map(room =>
      subscribeToPresence(room.id, (presenceDTO) => {
        setRooms(prevRooms => prevRooms.map(r => {
          if (String(r.id) !== String(room.id)) return r;

          const updatedParticipants = r.participants.map(p =>
            p.id === presenceDTO.userId
              ? { ...p, status: presenceDTO.status, lastSeen: presenceDTO.lastSeen }
              : p
          );

          return { ...r, participants: updatedParticipants };
        }));
      })
    );

    return () => {
      presenceSubs.forEach(sub => sub?.unsubscribe());
    };
  }, [isConnected, rooms, subscribeToPresence, setRooms]);

  // Reset unread count on chat select
  useEffect(() => {
    if (!chatId) return;
    setRooms(prev => prev.map(r =>
      String(r.id) === String(chatId) ? { ...r, unreadCount: 0 } : r
    ));
  }, [chatId, setRooms]);

  // Message subscriptions + bump on new message
  useEffect(() => {
    if (!isConnected || !subscribeToRoom || rooms.length === 0) return;

    const subscriptions = [];

    rooms.forEach(room => {
      const sub = subscribeToRoom(room.id, (message) => {
        setRooms(prev => {
          const updated = prev.map(r => {
            if (r.id === room.id) {
              return {
                ...r,
                lastMessage: message.content,
                lastMessageTimestamp: message.timestamp,
                lastMessageSenderId: message.senderId,
                lastMessageSenderName: message.senderName || 'Unknown',
                unreadCount: String(chatId) === String(room.id) ? 0 : (r.unreadCount || 0) + 1
              };
            }
            return r;
          });

          return [...updated].sort((a, b) => {
            const timeA = a.lastMessageTimestamp || a.createdAt;
            const timeB = b.lastMessageTimestamp || b.createdAt;
            return new Date(timeB) - new Date(timeA);
          });
        });
      });
      subscriptions.push(sub);
    });

    return () => subscriptions.forEach(sub => sub?.unsubscribe());
  }, [isConnected, rooms.length, subscribeToRoom, chatId, setRooms]);

  // Derived sorted + filtered rooms
  const sortedFilteredRooms = useMemo(() => {
    let filtered = rooms.filter(room => {
      if (activeTab === 'group') return room.isGroupChat;
      if (activeTab === 'direct') return !room.isGroupChat;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const timeA = a.lastMessageTimestamp || a.createdAt;
      const timeB = b.lastMessageTimestamp || b.createdAt;
      return new Date(timeB) - new Date(timeA);
    });
  }, [rooms, activeTab]);

  return (
    <div className="w-80 h-full bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] flex flex-col border-r border-[#2a2a2a] shadow-2xl overflow-hidden">
      {/* HEADER */}
      <div className="p-6 bg-gradient-to-r from-[#1a1a1a] to-[#141414] backdrop-blur-xl border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#e8e8e8] to-[#c9a961] tracking-tighter italic">
            CHATI<span className="text-[#c9a961]">FY</span>
          </h1>
          <button
            onClick={onNewChat}
            className="p-2.5 bg-gradient-to-br from-[#c9a961] via-[#b8955a] to-[#a8865a] hover:shadow-[0_0_20px_rgba(201,169,97,0.4)] text-[#0a0a0a] rounded-xl transition-all shadow-lg active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* TAB SYSTEM */}
        <div className="flex p-1 bg-[#0a0a0a]/60 rounded-xl border border-[#2a2a2a]">
          {['all', 'direct', 'group'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-[#c9a961] to-[#a8865a] text-[#0a0a0a] shadow-lg'
                  : 'text-[#6a6a6a] hover:text-[#c9a961]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ROOM LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {sortedFilteredRooms.map((room) => {
          const otherUser = !room.isGroupChat
            ? room.participants.find(p => p.id !== currentUser?.id)
            : null;

          const isSelected = String(chatId) === String(room.id);

          let previewText = '';
          if (room.lastMessage) {
            if (room.lastMessageSenderId === currentUser?.id) {
              previewText = `You: ${room.lastMessage}`;
            } else if (room.isGroupChat) {
              previewText = `${room.lastMessageSenderName || 'Unknown'}: ${room.lastMessage}`;
            } else {
              previewText = room.lastMessage;
            }
          } else {
            previewText = otherUser?.status === 'ONLINE' ? 'Online' : 'Offline';
          }

          return (
            <div
              key={room.id}
              onClick={() => navigate(`/chat/${room.id}`)}
              className={`group relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-[#c9a961]/30 shadow-[0_0_20px_rgba(201,169,97,0.1)]'
                  : 'hover:bg-[#1a1a1a]/40 border-transparent'
              }`}
            >
              {/* AVATAR WITH STATUS DOT */}
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] flex items-center justify-center text-[#c9a961] font-bold text-lg border border-[#3a3a3a] shadow-lg group-hover:scale-105 transition-transform overflow-hidden">
                  {room.isGroupChat ? room.name[0].toUpperCase() : (otherUser?.username?.[0].toUpperCase() || '?')}
                </div>

                {/* STATUS DOT */}
                {!room.isGroupChat && otherUser && (
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0a0a] shadow-sm transition-colors duration-500 ${
                    otherUser.status === 'ONLINE' ? 'bg-[#c9a961] shadow-[0_0_8px_rgba(201,169,97,0.6)]' : 'bg-[#4a4a4a]'
                  }`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className={`text-sm font-bold truncate transition-colors ${
                    isSelected ? 'text-[#c9a961]' : 'text-[#e8e8e8]'
                  }`}>
                    {room.isGroupChat ? room.name : (otherUser?.username || 'Unknown User')}
                  </h3>
                  {room.lastMessageTimestamp && (
                    <span className="text-[10px] text-[#6a6a6a] font-medium">
                      {new Date(room.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6a6a6a] truncate font-medium">
                  {previewText}
                </p>
              </div>

              {room.unreadCount > 0 && (
                <div className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-gradient-to-r from-[#c9a961] to-[#a8865a] text-[#0a0a0a] text-[10px] font-black rounded-full shadow-lg shadow-[#c9a961]/40">
                  {room.unreadCount}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="p-5 bg-gradient-to-r from-[#1a1a1a] to-[#141414] backdrop-blur-md border-t border-[#2a2a2a]">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0a0a0a]/60 border border-[#2a2a2a] hover:border-[#c9a961]/30 transition-all group">
          <div className="flex items-center gap-3">
            <div className="relative">
               <div className={`w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${isConnected ? 'bg-[#c9a961] shadow-[0_0_8px_rgba(201,169,97,0.6)]' : 'bg-[#8a4a4a]'}`}></div>
               {isConnected && <div className="absolute inset-0 bg-[#c9a961] rounded-full animate-ping opacity-75"></div>}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#e8e8e8] group-hover:text-[#c9a961] transition-colors">
                {currentUser?.username || 'User'}
              </span>
              <span className="text-[10px] text-[#6a6a6a] uppercase tracking-widest">
                {isConnected ? 'Connected' : 'Reconnecting...'}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="text-[#6a6a6a] hover:text-[#c9a961] transition-colors p-2 rounded-lg hover:bg-[#1a1a1a]/60"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;