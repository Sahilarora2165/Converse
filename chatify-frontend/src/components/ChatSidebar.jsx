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
        // Sort immediately after fetch (most recent first)
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

  // Reset unread count on chat select (optimistic UI update)
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

          // Re-sort after update—bumps active chat to top
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

  // Derived sorted + filtered rooms (stable reference, no re-render loops)
  const sortedFilteredRooms = useMemo(() => {
    let filtered = rooms.filter(room => {
      if (activeTab === 'group') return room.isGroupChat;
      if (activeTab === 'direct') return !room.isGroupChat;
      return true;
    });

    // Ensure sort on every render (fallback to createdAt)
    return [...filtered].sort((a, b) => {
      const timeA = a.lastMessageTimestamp || a.createdAt;
      const timeB = b.lastMessageTimestamp || b.createdAt;
      return new Date(timeB) - new Date(timeA);
    });
  }, [rooms, activeTab]);

  return (
    <div className="w-80 h-full bg-slate-900 flex flex-col border-r border-white/5 shadow-2xl overflow-hidden">
      {/* HEADER */}
      <div className="p-6 bg-slate-900/50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-white tracking-tighter italic">
            CHATI<span className="text-indigo-500">FY</span>
          </h1>
          <button
            onClick={onNewChat}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* TAB SYSTEM */}
        <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
          {['all', 'direct', 'group'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
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

          // Smart preview text with "You:" prefix
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
                  ? 'bg-indigo-600/10 border-indigo-500/50 shadow-inner'
                  : 'hover:bg-white/5 border-transparent'
              }`}
            >
              {/* AVATAR WITH STATUS DOT */}
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-lg group-hover:scale-105 transition-transform overflow-hidden">
                  {room.isGroupChat ? room.name[0].toUpperCase() : (otherUser?.username?.[0].toUpperCase() || '?')}
                </div>

                {/* STATUS DOT */}
                {!room.isGroupChat && otherUser && (
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 shadow-sm transition-colors duration-500 ${
                    otherUser.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'
                  }`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className={`text-sm font-bold truncate transition-colors ${
                    isSelected ? 'text-indigo-200' : 'text-slate-200'
                  }`}>
                    {room.isGroupChat ? room.name : (otherUser?.username || 'Unknown User')}
                  </h3>
                  {room.lastMessageTimestamp && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      {new Date(room.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate font-medium">
                  {previewText}
                </p>
              </div>

              {room.unreadCount > 0 && (
                <div className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-indigo-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-indigo-500/40">
                  {room.unreadCount}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="p-5 bg-black/20 backdrop-blur-md border-t border-white/5">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
          <div className="flex items-center gap-3">
            <div className="relative">
               <div className={`w-3 h-3 rounded-full border-2 border-slate-900 ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`}></div>
               {isConnected && <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                {currentUser?.username || 'User'}
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                {isConnected ? 'Connected' : 'Reconnecting...'}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="text-slate-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
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