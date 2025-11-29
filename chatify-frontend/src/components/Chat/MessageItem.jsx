import { formatTime, isImageFile } from '../../utils/helpers';
import { API_URL, MESSAGE_TYPES } from '../../utils/constants';

const MessageItem = ({ 
  message, 
  isOwnMessage, 
  showSender,
  participants 
}) => {
  const { content, messageType, fileUrl, fileName, senderUsername, timestamp, readByUserIds } = message;

  const renderReadReceipt = () => {
    if (!isOwnMessage) return null;

    const readCount = readByUserIds?.length || 0;
    const totalOthers = participants?.length ? participants.length - 1 : 0;

    if (totalOthers === 0) return null;

    const allRead = readCount >= totalOthers;
    const someRead = readCount > 0;

    return (
      <span className="ml-1 text-xs">
        {allRead ? (
          <span className="text-blue-500" title="Read by all">✓✓</span>
        ) : someRead ? (
          <span className="text-gray-400" title={`Read by ${readCount}`}>✓✓</span>
        ) : (
          <span className="text-gray-400" title="Delivered">✓</span>
        )}
      </span>
    );
  };

  const renderContent = () => {
    if (messageType === MESSAGE_TYPES.IMAGE && fileUrl) {
      return (
        <div className="space-y-2">
          <a href={`${API_URL}${fileUrl}`} target="_blank" rel="noopener noreferrer">
            <img
              src={`${API_URL}${fileUrl}`}
              alt={fileName || 'Image'}
              className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          </a>
          {content && <p className="text-sm">{content}</p>}
        </div>
      );
    }

    if (messageType === MESSAGE_TYPES.FILE && fileUrl) {
      const extension = fileName?.split('.').pop()?.toLowerCase() || '';
      const isImage = isImageFile(`image/${extension}`);

      if (isImage) {
        return (
          <div className="space-y-2">
            <a href={`${API_URL}${fileUrl}`} target="_blank" rel="noopener noreferrer">
              <img
                src={`${API_URL}${fileUrl}`}
                alt={fileName || 'Image'}
                className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
            {content && <p className="text-sm">{content}</p>}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          <a
            href={`${API_URL}${fileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="font-medium text-sm truncate max-w-[150px]">{fileName || 'File'}</p>
              <p className="text-xs opacity-75">Click to download</p>
            </div>
          </a>
          {content && <p className="text-sm">{content}</p>}
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {showSender && (
          <p className="text-xs text-gray-500 mb-1 ml-3">{senderUsername}</p>
        )}
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwnMessage
              ? 'bg-indigo-600 text-white rounded-br-md'
              : 'bg-white text-gray-800 shadow-sm rounded-bl-md'
          }`}
        >
          {renderContent()}
        </div>
        <div className={`flex items-center mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'} px-2`}>
          <span className="text-xs text-gray-400">{formatTime(timestamp)}</span>
          {renderReadReceipt()}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
