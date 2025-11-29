import ChatListItem from './ChatListItem';
import LoadingSpinner from '../Common/LoadingSpinner';

const ChatList = ({ chatRooms, selectedChatRoomId, onSelectChatRoom, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!chatRooms || chatRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 px-4 text-center">
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new chat to begin messaging</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {chatRooms.map((chatRoom) => (
        <ChatListItem
          key={chatRoom.id}
          chatRoom={chatRoom}
          isSelected={chatRoom.id === selectedChatRoomId}
          onClick={() => onSelectChatRoom(chatRoom.id)}
        />
      ))}
    </div>
  );
};

export default ChatList;
