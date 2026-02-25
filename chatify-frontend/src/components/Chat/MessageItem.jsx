import React from 'react';

const MessageItem = ({ message, isMe, currentUserId }) => {
  const renderStatusIcon = () => {
    if (!isMe) return null;

    const isSeen = message.status === 'SEEN' || (message.readBy && message.readBy.includes(currentUserId));

    if (isSeen) {
      return (
        <div className="ml-2 flex-shrink-0 relative w-4 h-4 text-blue-400">
          <svg className="absolute left-0 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <svg className="absolute -right-1.5 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }

    if (message.status === 'DELIVERED') {
      return (
        <div className="ml-2 flex-shrink-0 relative w-4 h-4 text-gray-400">
          <svg className="absolute left-0 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <svg className="absolute -right-1.5 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }

    return (
      <svg className="w-4 h-4 text-gray-500 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`px-5 py-3 rounded-2xl max-w-[70%] ${isMe ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-black" : "bg-[#1a1a1a] text-white border border-[#262626]"}`}>
        <p className="break-words">{message.content}</p>
        <div className="flex items-center justify-end mt-1 gap-1">
          <span className="text-[10px] text-black/60">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {renderStatusIcon()}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;