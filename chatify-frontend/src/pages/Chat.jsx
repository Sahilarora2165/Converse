import { useState, useEffect, useCallback } from 'react';
import { getChatRooms } from '../api/chatrooms';
import Sidebar from '../components/Sidebar/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import { WebSocketProvider } from '../context/WebSocketContext';
import toast from 'react-hot-toast';

const Chat = () => {
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedChatRoomId, setSelectedChatRoomId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadChatRooms = useCallback(async () => {
    try {
      const data = await getChatRooms();
      setChatRooms(data);
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      toast.error('Failed to load chat rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  const handleSelectChatRoom = (chatRoomId) => {
    setSelectedChatRoomId(chatRoomId);
  };

  const handleChatRoomsUpdated = () => {
    loadChatRooms();
  };

  return (
    <WebSocketProvider>
      <div className="h-full flex">
        <Sidebar
          chatRooms={chatRooms}
          selectedChatRoomId={selectedChatRoomId}
          onSelectChatRoom={handleSelectChatRoom}
          onChatRoomsUpdated={handleChatRoomsUpdated}
          loading={loading}
        />
        <ChatWindow
          chatRoomId={selectedChatRoomId}
          onChatUpdated={handleChatRoomsUpdated}
        />
      </div>
    </WebSocketProvider>
  );
};

export default Chat;
