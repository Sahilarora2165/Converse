import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import ChatList from './ChatList';
import NewChatModal from './NewChatModal';
import CreateGroupModal from '../Group/CreateGroupModal';
import Avatar from '../Common/Avatar';
import OnlineStatus from '../Common/OnlineStatus';

const Sidebar = ({ chatRooms, selectedChatRoomId, onSelectChatRoom, onChatRoomsUpdated, loading }) => {
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChatRooms = chatRooms?.filter((room) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    if (room.isGroupChat) {
      return room.name?.toLowerCase().includes(query);
    }
    return room.participants?.some(
      (p) => p.id !== user?.id && p.username?.toLowerCase().includes(query)
    );
  });

  const handleChatCreated = (chatRoom) => {
    setShowNewChatModal(false);
    setShowCreateGroupModal(false);
    onChatRoomsUpdated();
    onSelectChatRoom(chatRoom.id);
  };

  return (
    <div className="w-80 bg-white border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} size="md" showStatus isOnline={isConnected} />
            <div>
              <h2 className="font-semibold text-gray-800">{user?.username}</h2>
              <OnlineStatus isOnline={isConnected} size="sm" />
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full px-4 py-2 pl-10 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 flex gap-2">
        <button
          onClick={() => setShowNewChatModal(true)}
          className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
        <button
          onClick={() => setShowCreateGroupModal(true)}
          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Group
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <ChatList
          chatRooms={filteredChatRooms || []}
          selectedChatRoomId={selectedChatRoomId}
          onSelectChatRoom={onSelectChatRoom}
          loading={loading}
        />
      </div>

      {/* Modals */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onChatCreated={handleChatCreated}
        />
      )}

      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={handleChatCreated}
        />
      )}
    </div>
  );
};

export default Sidebar;
