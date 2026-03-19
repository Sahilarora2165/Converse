import { useEffect, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChatRooms } from "../services/api";
import useAuth from '../hooks/useAuth';
import useWebSocket from '../hooks/useWebSocket';
import { MessageSquarePlus, LogOut, MessageCircle } from 'lucide-react';

const ChatSidebar = forwardRef(({ rooms, setRooms, onNewChat }, ref) => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: currentUser, logout } = useAuth();
  const { isConnected, subscribeToRoom, subscribeToPresence } = useWebSocket();
  const [activeTab, setActiveTab] = useState('all');

  useImperativeHandle(ref, () => ({ refreshRooms: fetchRooms }));

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await getChatRooms();
      const sorted = [...data].sort((a, b) => {
        const timeA = a.lastMessageTimestamp || a.createdAt;
        const timeB = b.lastMessageTimestamp || b.createdAt;
        return new Date(timeB) - new Date(timeA);
      });
      setRooms(sorted);
    } catch (err) { console.error("Failed to load chat rooms", err); }
  }, [setRooms]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    if (!isConnected || rooms.length === 0 || !subscribeToPresence) return;
    const presenceSubs = rooms.map(room =>
      subscribeToPresence(room.id, (presenceDTO) => {
        setRooms(prevRooms => prevRooms.map(r => {
          if (String(r.id) !== String(room.id)) return r;
          const updatedParticipants = r.participants.map(p =>
            p.id === presenceDTO.userId ? { ...p, status: presenceDTO.status, lastSeen: presenceDTO.lastSeen } : p
          );
          return { ...r, participants: updatedParticipants };
        }));
      })
    );
    return () => presenceSubs.forEach(sub => sub?.unsubscribe());
  }, [isConnected, rooms, subscribeToPresence, setRooms]);

  useEffect(() => {
    if (!chatId) return;
    setRooms(prev => prev.map(r => String(r.id) === String(chatId) ? { ...r, unreadCount: 0 } : r));
  }, [chatId, setRooms]);

  useEffect(() => {
    if (!isConnected || !subscribeToRoom || rooms.length === 0) return;
    const subscriptions = rooms.map(room => subscribeToRoom(room.id, (message) => {
      const isFromCurrentUser = String(message.senderId) === String(currentUser?.id);
      const isActiveChat = String(chatId) === String(room.id);
      setRooms(prev => {
        const updated = prev.map(r => {
          if (String(r.id) === String(room.id)) {
            return {
              ...r, lastMessage: message.content, lastMessageTimestamp: message.timestamp,
              lastMessageSenderId: message.senderId, lastMessageSenderName: message.senderName || 'Unknown',
              unreadCount: (isActiveChat || isFromCurrentUser) ? 0 : (r.unreadCount || 0) + 1
            };
          }
          return r;
        });
        return [...updated].sort((a, b) => new Date(b.lastMessageTimestamp || b.createdAt) - new Date(a.lastMessageTimestamp || a.createdAt));
      });
    }));
    return () => subscriptions.forEach(sub => sub?.unsubscribe());
  }, [isConnected, rooms.length, subscribeToRoom, chatId, currentUser?.id, setRooms]);

  const sortedFilteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (activeTab === 'group') return room.isGroupChat;
      if (activeTab === 'direct') return !room.isGroupChat;
      return true;
    });
  }, [rooms, activeTab]);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'direct', label: 'Direct' },
    { key: 'group', label: 'Groups' },
  ];

  return (
    <div className="w-[340px] h-full bg-black flex flex-col border-r border-white/[0.05] relative z-30">

      {/* ── AMBIENT BACKGROUND GLOW ── */}
      <div className="absolute top-0 left-0 w-full h-40 bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* ── HEADER ── */}
      <div className="px-6 pt-10 pb-6 space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
              <MessageCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Converse</h1>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Messages</p>
            </div>
          </div>
          <button
            onClick={onNewChat}
            className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 transition-all duration-300 active:scale-95"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex p-1 bg-zinc-900/40 rounded-2xl border border-white/[0.03] backdrop-blur-md">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                activeTab === tab.key
                  ? 'bg-zinc-800 text-indigo-400 border border-white/[0.05]'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROOM LIST ── */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar relative z-10">
        {sortedFilteredRooms.map((room) => {
          const otherUser = !room.isGroupChat ? room.participants.find(p => p.id !== currentUser?.id) : null;
          const isSelected = String(chatId) === String(room.id);
          const isOnline = otherUser?.status === 'ONLINE';

          return (
            <div
              key={room.id}
              onClick={() => navigate(`/chat/${room.id}`)}
              className={`group relative flex items-center gap-4 px-4 py-4 rounded-[20px] cursor-pointer transition-all duration-300 ${
                isSelected
                  ? 'bg-indigo-500/5 border border-indigo-500/20 shadow-lg'
                  : 'hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              <div className="relative shrink-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                  isSelected
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-900 text-zinc-600 group-hover:bg-zinc-800'
                }`}>
                  {room.isGroupChat ? room.name[0].toUpperCase() : (otherUser?.username?.[0].toUpperCase() || '?')}
                </div>
                {!room.isGroupChat && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-black ${
                    isOnline ? 'bg-indigo-400' : 'bg-zinc-800'
                  }`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-[13px] font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    {room.isGroupChat ? room.name : (otherUser?.username || 'User')}
                  </span>
                  {room.lastMessageTimestamp && (
                    <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-tighter">
                      {new Date(room.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[11px] truncate leading-none ${room.unreadCount > 0 ? 'text-indigo-300' : 'text-zinc-600'}`}>
                    {room.lastMessage || 'Channel empty'}
                  </p>
                  {room.unreadCount > 0 && (
                    <div className="h-4 min-w-[16px] px-1 bg-indigo-500 text-white text-[9px] font-black rounded-md flex items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                      {room.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── FOOTER ── */}
      <div className="p-4 relative mt-auto">
        <div className="p-4 bg-zinc-900/40 rounded-[24px] border border-white/[0.05] backdrop-blur-xl relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-white text-[10px] font-black border border-white/5">
                  {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-900 ${isConnected ? 'bg-indigo-400' : 'bg-red-500'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{currentUser?.username || 'User'}</p>
                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-0.5">
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ChatSidebar.displayName = 'ChatSidebar';
export default ChatSidebar;