import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';

const TypingIndicator = ({ chatRoomId }) => {
  const { getTypingUsers } = useWebSocket();
  const { user } = useAuth();

  const typingUsers = getTypingUsers(chatRoomId);
  
  // Filter out the current user
  const otherTypingUsers = Object.keys(typingUsers).filter(
    (username) => username !== user?.username
  );

  if (otherTypingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (otherTypingUsers.length === 1) {
      return `${otherTypingUsers[0]} is typing...`;
    }
    if (otherTypingUsers.length === 2) {
      return `${otherTypingUsers[0]} and ${otherTypingUsers[1]} are typing...`;
    }
    return `${otherTypingUsers[0]} and ${otherTypingUsers.length - 1} others are typing...`;
  };

  return (
    <div className="px-4 py-2 bg-gray-50 border-t">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>{getTypingText()}</span>
      </div>
    </div>
  );
};

export default TypingIndicator;
