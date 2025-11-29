import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import Avatar from '../Common/Avatar';
import { getChatDisplayName, getOtherParticipant, truncateText, formatTimestamp } from '../../utils/helpers';

const ChatListItem = ({ chatRoom, isSelected, onClick }) => {
  const { user } = useAuth();
  const { isUserOnline } = useWebSocket();

  const otherParticipant = !chatRoom.isGroupChat 
    ? getOtherParticipant(chatRoom, user?.id) 
    : null;
  
  const isOtherOnline = otherParticipant ? isUserOnline(otherParticipant.id) : false;
  const displayName = getChatDisplayName(chatRoom, user?.id);
  
  // Get last message preview (this would need to be added to the API response ideally)
  const lastMessage = chatRoom.lastMessage;
  const unreadCount = chatRoom.unreadCount || 0;

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
        isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
      }`}
    >
      <Avatar
        user={otherParticipant || { username: chatRoom.name }}
        size="md"
        showStatus={!chatRoom.isGroupChat}
        isOnline={isOtherOnline}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className={`font-medium text-sm truncate ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
            {displayName}
          </h3>
          {lastMessage?.timestamp && (
            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
              {formatTimestamp(lastMessage.timestamp)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-0.5">
          <p className={`text-sm truncate ${unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
            {lastMessage ? truncateText(lastMessage.content, 30) : 'No messages yet'}
          </p>
          {unreadCount > 0 && (
            <span className="ml-2 flex-shrink-0 bg-indigo-600 text-white text-xs font-medium rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ChatListItem;
