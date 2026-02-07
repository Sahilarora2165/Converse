import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChatRooms } from "../services/api";
import useAuth from '../hooks/useAuth';
import useWebSocket from '../hooks/useWebSocket';

const ChatSidebar = ({ rooms, setRooms, onNewChat }) => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user: currentUser, logout } = useAuth();
  const { isConnected, subscribeToRoom } = useWebSocket();
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Fetch rooms on mount
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
  }, [setRooms]);

  // Clear unread count when opening a chat
  useEffect(() => {
    if (!chatId) return;

    // Clear unread count for the active chat immediately
    setRooms(prev => prev.map(r =>
      String(r.id) === String(chatId)
        ? { ...r, unreadCount: 0 }
        : r
    ));
  }, [chatId, setRooms]);

  // Subscribe to all rooms for real-time updates
  useEffect(() => {
    if (!isConnected || !subscribeToRoom) return;

    const subscriptions = [];

    rooms.forEach(room => {
      const sub = subscribeToRoom(room.id, (message) => {
        setRooms(prev => prev.map(r => {
          if (r.id === room.id) {
            // Update last message preview
            const updatedRoom = {
              ...r,
              lastMessage: message.content,
              lastMessageTimestamp: message.timestamp,
              lastMessageSenderId: message.senderId,
              // FIX: Use senderUsername from your MessageDTO, not senderName
              lastMessageSenderName: message.senderUsername || 'Unknown'
            };

            // Only increment unread if not viewing this chat
            if (String(room.id) !== String(chatId)) {
              updatedRoom.unreadCount = (r.unreadCount || 0) + 1;
            } else {
              // If viewing this chat, keep unread at 0
              updatedRoom.unreadCount = 0;
            }

            return updatedRoom;
          }
          return r;
        }));
      });
      if (sub) subscriptions.push(sub);
    });

    return () => {
      subscriptions.forEach(sub => sub?.unsubscribe?.());
    };
  }, [isConnected, rooms, chatId, subscribeToRoom, setRooms]);

  // Helper: Get display name
  const getDisplayName = useCallback((room) => {
    if (room.isGroupChat) return room.name;
    const otherUser = room.participants?.find(p => String(p.id) !== String(currentUser?.id));
    return otherUser?.username || 'Unknown User';
  }, [currentUser?.id]);

  // Helper: Get initials
  const getInitials = useCallback((name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }, []);

  // Helper: Get other user for DM
  const getOtherUser = useCallback((room) => {
    if (room.isGroupChat) return null;
    return room.participants?.find(p => String(p.id) !== String(currentUser?.id));
  }, [currentUser?.id]);

  // Helper: Format last message preview (WhatsApp style)
  const getLastMessagePreview = useCallback((room) => {
    if (!room.lastMessage) return null;

    const isSentByMe = String(room.lastMessageSenderId) === String(currentUser?.id);
    const maxLength = 35;
    const truncatedMessage = room.lastMessage.length > maxLength
      ? room.lastMessage.substring(0, maxLength) + '...'
      : room.lastMessage;

    // For group chats, show sender name (or "You:")
    if (room.isGroupChat) {
      const prefix = isSentByMe ? 'You: ' : `${room.lastMessageSenderName || 'Unknown'}: `;
      return prefix + truncatedMessage;
    }

    // For DMs, just show "You:" if you sent it
    return isSentByMe ? 'You: ' + truncatedMessage : truncatedMessage;
  }, [currentUser?.id]);

  // Helper: Format timestamp
  const formatTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      // Show time if today
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      // Show day of week if within a week
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Show date if older
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  // Separate channels and DMs
  const channels = rooms.filter(room => room.isGroupChat);
  const directMessages = rooms.filter(room => !room.isGroupChat);

  return (
    <div className="w-80 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800 font-sans">

      {/* HEADER - BRANDING */}
      <div className="p-5 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">P</span>
          </div>
          <div>
            <h1 className="font-black text-lg text-white tracking-tight">PULSE</h1>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Real-Time Infrastructure</p>
          </div>
        </div>
      </div>

      {/* USER PROFILE SECTION */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-slate-700">
              {getInitials(currentUser?.username || currentUser?.email)}
            </div>
            {/* Connection Status Dot */}
            <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-900 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{currentUser?.username || 'User'}</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CHAT LIST */}
      <div className="overflow-y-auto flex-1 p-3 space-y-6 custom-scrollbar">

        {/* CHANNELS SECTION */}
        {channels.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Channels</h2>
              <span className="text-[9px] font-bold text-slate-600">{channels.length}</span>
            </div>
            <div className="space-y-0.5">
              {channels.map(room => {
                const unread = room.unreadCount || 0;
                const isActive = chatId === String(room.id);
                const hasUnread = unread > 0 && !isActive; // Don't show badge if active
                const lastMessagePreview = getLastMessagePreview(room);
                const timestamp = formatTimestamp(room.lastMessageTimestamp);

                return (
                  <div
                    key={room.id}
                    onClick={() => navigate(`/chat/${room.id}`)}
                    className={`group relative flex items-start px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "hover:bg-slate-800/60 text-slate-400"
                    }`}
                  >
                    {/* Channel Icon */}
                    <div className={`mr-3 text-base mt-0.5 ${isActive ? "text-blue-200" : "text-slate-600 group-hover:text-slate-400"}`}>
                      #
                    </div>

                    {/* Channel Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <p className={`text-sm font-semibold truncate ${hasUnread ? "text-white" : ""}`}>
                          {room.name}
                        </p>
                        {timestamp && (
                          <span className={`text-[10px] ml-2 flex-shrink-0 ${
                            isActive ? 'text-blue-200' : hasUnread ? 'text-blue-400' : 'text-slate-500'
                          }`}>
                            {timestamp}
                          </span>
                        )}
                      </div>

                      {/* Last Message Preview */}
                      {lastMessagePreview && (
                        <p className={`text-[11px] truncate mt-0.5 ${
                          isActive ? 'text-blue-100' : hasUnread ? 'text-white' : 'text-slate-500'
                        }`}>
                          {lastMessagePreview}
                        </p>
                      )}
                    </div>

                    {/* Unread Badge */}
                    {hasUnread && (
                      <div className="ml-2 bg-blue-600 text-white text-[10px] font-black rounded-full px-2 py-0.5 min-w-5 text-center flex-shrink-0 self-start mt-0.5">
                        {unread > 99 ? "99+" : unread}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DIRECT MESSAGES SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Direct Messages</h2>
            <span className="text-[9px] font-bold text-slate-600">{directMessages.length}</span>
          </div>
          <div className="space-y-0.5">
            {directMessages.map(room => {
              const unread = room.unreadCount || 0;
              const isActive = chatId === String(room.id);
              const hasUnread = unread > 0 && !isActive; // Don't show badge if active
              const displayName = getDisplayName(room);
              const otherUser = getOtherUser(room);
              const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
              const lastMessagePreview = getLastMessagePreview(room);
              const timestamp = formatTimestamp(room.lastMessageTimestamp);

              return (
                <div
                  key={room.id}
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`group relative flex items-start px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "hover:bg-slate-800/60 text-slate-400"
                  }`}
                >
                  {/* User Avatar with Online Status */}
                  <div className="relative mr-3 flex-shrink-0 mt-0.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? "bg-blue-700 text-white"
                        : "bg-slate-700 text-white"
                    }`}>
                      {getInitials(displayName)}
                    </div>
                    {/* Online indicator */}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className={`text-sm font-semibold truncate ${hasUnread ? "text-white" : ""}`}>
                        {displayName}
                      </p>
                      {timestamp && (
                        <span className={`text-[10px] ml-2 flex-shrink-0 ${
                          isActive ? 'text-blue-200' : hasUnread ? 'text-blue-400' : 'text-slate-500'
                        }`}>
                          {timestamp}
                        </span>
                      )}
                    </div>

                    {/* Last Message Preview */}
                    {lastMessagePreview && (
                      <p className={`text-[11px] truncate mt-0.5 ${
                        isActive ? 'text-blue-100' : hasUnread ? 'text-white' : 'text-slate-500'
                      }`}>
                        {lastMessagePreview}
                      </p>
                    )}
                  </div>

                  {/* Unread Badge */}
                  {hasUnread && (
                    <div className="ml-2 bg-blue-600 text-white text-[10px] font-black rounded-full px-2 py-0.5 min-w-5 text-center flex-shrink-0 self-start mt-0.5">
                      {unread > 99 ? "99+" : unread}
                    </div>
                  )}
                </div>
              );
            })}
            {directMessages.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-600 italic">No conversations yet</p>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER - ACTIONS */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
        <button
          onClick={onNewChat}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black rounded-lg transition-all uppercase tracking-wider active:scale-95"
        >
          + New Chat
        </button>
        <button
          onClick={logout}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider"
        >
          Logout
        </button>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(15 23 42);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(51 65 85);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(71 85 105);
        }
      `}</style>
    </div>
  );
};

export default ChatSidebar;