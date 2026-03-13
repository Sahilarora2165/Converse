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

  // renders image, video, file, or text based on messageType
  const renderContent = () => {
    const { messageType, fileUrl, fileName, content } = message;

    if (messageType === 'IMAGE' && fileUrl) {
      return (
        <div className="mb-1">
          <img
            src={fileUrl}
            alt={fileName || 'Image'}
            className="max-w-[240px] rounded-lg cursor-pointer"
            onClick={() => window.open(fileUrl, '_blank')}
          />
          {content && <p className="mt-1 break-words">{content}</p>}
        </div>
      );
    }

    if (messageType === 'VIDEO' && fileUrl) {
      return (
        <div className="mb-1">
          <video
            src={fileUrl}
            controls
            className="max-w-[240px] rounded-lg"
          />
          {content && <p className="mt-1 break-words">{content}</p>}
        </div>
      );
    }

    if (messageType === 'FILE' && fileUrl) {
      return (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline underline-offset-2 break-all">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {fileName || 'Download file'}
        </a>
      );
    }

    // default: plain text
    return <p className="break-words">{content}</p>;
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`px-5 py-3 rounded-2xl max-w-[70%] ${isMe ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-black' : 'bg-[#1a1a1a] text-white border border-[#262626]'}`}>
        {renderContent()}
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