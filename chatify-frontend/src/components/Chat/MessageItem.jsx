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

    // SENT — single check
    return (
      <svg className="w-4 h-4 text-gray-500 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  const renderContent = () => {
    const { messageType, fileUrl, fileName, content } = message;

    if (messageType === 'IMAGE' && fileUrl) {
      return (
        <div className="mb-1">
          <img
            src={fileUrl}
            alt={fileName || 'Image'}
            className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(fileUrl, '_blank')}
          />
          {content && <p className="mt-2 break-words">{content}</p>}
        </div>
      );
    }

    if (messageType === 'VIDEO' && fileUrl) {
      return (
        <div className="mb-1">
          <video
            src={fileUrl}
            controls
            className="max-w-[280px] rounded-lg"
          />
          {content && <p className="mt-2 break-words">{content}</p>}
        </div>
      );
    }

    if (messageType === 'FILE' && fileUrl) {
      return (
        <div className="mb-1">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-[#c9a961]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="truncate text-sm underline underline-offset-2">{fileName || 'Download file'}</span>
          </a>
          {content && <p className="mt-2 break-words">{content}</p>}
        </div>
      );
    }

    // plain text
    return <p className="break-words">{content}</p>;
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`px-4 py-3 rounded-2xl max-w-[70%] shadow-lg ${
        isMe
          ? 'bg-gradient-to-br from-[#c9a961]/20 to-[#c9a961]/10 border border-[#c9a961]/20 text-[#e8e8e8]'
          : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#d0d0d0]'
      }`}>
        {!isMe && message.senderUsername && (
          <p className="text-xs font-semibold text-[#c9a961] mb-1">{message.senderUsername}</p>
        )}

        {renderContent()}

        <div className="flex items-center justify-end mt-1 gap-1">
          <span className="text-[10px] text-[#6a6a6a]">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {renderStatusIcon()}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;