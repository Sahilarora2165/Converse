import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChatRooms } from "../services/api";
import useAuth from '../hooks/useAuth';

const ChatSidebar = ({ rooms, setRooms, onNewChat }) => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: currentUser, logout } = useAuth();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await getChatRooms();
        setRooms(data);
      } catch (err) {
        console.error("Failed to load chat rooms", err);
      }
    };

    fetchRooms();
    // Optional: Poll every 30s for background unread updates if no global WS listener
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [setRooms]);

  const channels = rooms.filter(room => room.isGroupChat);
  const directMessages = rooms.filter(room => !room.isGroupChat);

  // Helper: Get display name (DM = other user, Group = room.name)
  const getDisplayName = (room) => {
    if (room.isGroupChat) return room.name;
    const otherUser = room.participants?.find(p => String(p.id) !== String(currentUser?.id));
    return otherUser?.username || 'Unknown User';
  };

  // Helper: Get initials for avatar
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  // Helper: Unread count (safe access)
  const getUnreadCount = (room) => room.unreadCount ?? 0;

  return (
    <div className="w-72 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 font-sans">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 bg-slate-900">
        <h1 className="font-bold text-xl text-white tracking-wider">NEXUS</h1>
        <p className="text-xs text-slate-500 uppercase font-semibold mt-1">Engineering Hub</p>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-8">
        {/* CHANNELS SECTION */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Channels</h2>
          <div className="space-y-1">
            {channels.map(room => {
              const unread = getUnreadCount(room);
              const isActive = chatId === String(room.id);
              const hasUnread = unread > 0;

              return (
                <div
                  key={room.id}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`group flex items-center px-3 py-2 rounded-md cursor-pointer transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                      : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className={`mr-3 text-lg ${isActive ? "text-blue-200" : "text-slate-600 group-hover:text-slate-400"}`}>#</span>
                  <span className={`truncate text-sm font-medium flex-1 ${hasUnread ? "font-bold text-white" : ""}`}>
                    {room.name}
                  </span>
                  {hasUnread && (
                    <span className="ml-auto bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-6 text-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              );
            })}
            {channels.length === 0 && <p className="px-3 text-sm text-slate-600 italic">No channels joined</p>}
          </div>
        </div>

        {/* DIRECT MESSAGES SECTION */}
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Direct Messages</h2>
          <div className="space-y-1">
            {directMessages.map(room => {
              const unread = getUnreadCount(room);
              const isActive = chatId === String(room.id);
              const hasUnread = unread > 0;
              const displayName = getDisplayName(room);

              return (
                <div
                  key={room.id}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`group flex items-center px-3 py-2 rounded-md cursor-pointer transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                      : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {/* Avatar with initials + online dot placeholder (extend later with real status) */}
                  <div className="relative mr-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      {getInitials(displayName)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                  </div>
                  <span className={`truncate text-sm font-medium flex-1 ${hasUnread ? "font-bold text-white" : ""}`}>
                    {displayName}
                  </span>
                  {hasUnread && (
                    <span className="ml-auto bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-6 text-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              );
            })}
            {directMessages.length === 0 && <p className="px-3 text-sm text-slate-600 italic">No recent messages</p>}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
        <button
          onClick={onNewChat}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all border border-slate-700 hover:border-slate-600"
        >
          + NEW COLLABORATION
        </button>
        <button
          onClick={logout}
          className="w-full py-2.5 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all"
        >
          LOGOUT
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;