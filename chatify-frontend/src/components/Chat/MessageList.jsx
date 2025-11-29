import MessageItem from './MessageItem';

const MessageList = ({ messages, currentUserId, chatRoom }) => {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p>No messages yet</p>
          <p className="text-sm">Start the conversation!</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date}>
          <div className="flex justify-center mb-4">
            <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
              {date}
            </span>
          </div>
          <div className="space-y-2">
            {dateMessages.map((message, index) => {
              const previousMessage = index > 0 ? dateMessages[index - 1] : null;
              const showSender = 
                chatRoom?.isGroupChat && 
                message.senderId !== currentUserId &&
                (!previousMessage || previousMessage.senderId !== message.senderId);
              
              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  isOwnMessage={message.senderId === currentUserId}
                  showSender={showSender}
                  isGroupChat={chatRoom?.isGroupChat}
                  participants={chatRoom?.participants}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;
