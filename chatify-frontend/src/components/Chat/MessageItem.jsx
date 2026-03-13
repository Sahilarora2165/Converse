import React from 'react';

// Double tick SVG — reused for SENT/DELIVERED/SEEN
const DoubleTick = ({ color = 'currentColor' }) => (
  <span className="inline-flex items-center relative" style={{ width: 18, height: 12 }}>
    {/* First tick */}
    <svg style={{ position: 'absolute', left: 0 }} width="12" height="12" viewBox="0 0 20 20" fill={color}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
    {/* Second tick offset right */}
    <svg style={{ position: 'absolute', left: 5 }} width="12" height="12" viewBox="0 0 20 20" fill={color}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  </span>
);

const SingleTick = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const MessageStatus = ({ message, isOwnMessage }) => {
  if (!isOwnMessage) return null;

  const isSeen = message.status === 'SEEN';
  const isDelivered = message.status === 'DELIVERED';

  if (isSeen) return <DoubleTick color="#34d399" />;       // emerald — seen
  if (isDelivered) return <DoubleTick color="#6b7280" />;  // gray — delivered
  return <SingleTick />;                                    // gray single — sent
};

const MessageItem = ({
  message,
  isOwnMessage,
  isMe,
  currentUserId,
  showSender,
  isGroupChat,
  participants,
  isFirstInSequence,
  isLastInSequence,
}) => {
  // Support both prop names for backward compat
  const own = isOwnMessage ?? isMe ?? false;

  const renderContent = () => {
    const { messageType, fileUrl, fileName, content } = message;

    if (messageType === 'IMAGE' && fileUrl) {
      return (
        <div className="mb-1">
          <img
            src={fileUrl}
            alt={fileName || 'Image'}
            className="max-w-[220px] rounded-xl cursor-pointer object-cover"
            style={{ maxHeight: 260 }}
            onClick={() => window.open(fileUrl, '_blank')}
          />
          {content && (
            <p className="mt-1.5 text-sm leading-relaxed break-words">{content}</p>
          )}
        </div>
      );
    }

    if (messageType === 'VIDEO' && fileUrl) {
      return (
        <div className="mb-1">
          <video
            src={fileUrl}
            controls
            className="max-w-[220px] rounded-xl"
            style={{ maxHeight: 260 }}
          />
          {content && (
            <p className="mt-1.5 text-sm leading-relaxed break-words">{content}</p>
          )}
        </div>
      );
    }

    if (messageType === 'FILE' && fileUrl) {
      return (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 text-sm underline underline-offset-2 break-all"
        >
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </span>
          {fileName || 'Download file'}
        </a>
      );
    }

    // Plain text
    return (
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{content}</p>
    );
  };

  // Sender name color — derive from participant id for consistent color per user
  const getSenderColor = (senderId) => {
    const colors = [
      '#f87171', '#fb923c', '#facc15', '#4ade80',
      '#34d399', '#38bdf8', '#a78bfa', '#f472b6',
    ];
    return colors[senderId % colors.length];
  };

  // Bubble radius — tighter radius on connected bubbles in a sequence
  const bubbleRadius = own
    ? [
        isFirstInSequence ? '18px' : '6px',  // top-left
        isFirstInSequence ? '18px' : '18px', // top-right
        isLastInSequence  ? '4px'  : '18px', // bottom-right (tail side)
        isLastInSequence  ? '18px' : '18px', // bottom-left
      ].join(' ')
    : [
        isFirstInSequence ? '18px' : '18px', // top-left
        isFirstInSequence ? '18px' : '6px',  // top-right
        isLastInSequence  ? '18px' : '18px', // bottom-right
        isLastInSequence  ? '4px'  : '18px', // bottom-left (tail side)
      ].join(' ');

  return (
    <div
      className={`flex ${own ? 'justify-end' : 'justify-start'} px-2`}
      style={{ marginBottom: isLastInSequence ? 6 : 2 }}
    >
      <div
        className={`
          relative max-w-[72%] px-3.5 py-2.5
          ${own
            ? 'bg-emerald-600 text-white'
            : 'bg-[#1e1e1e] text-gray-100 border border-[#2a2a2a]'
          }
        `}
        style={{ borderRadius: bubbleRadius }}
      >
        {/* Sender name in group chats */}
        {showSender && (
          <p
            className="text-[11px] font-semibold mb-1 leading-none"
            style={{ color: getSenderColor(message.senderId) }}
          >
            {participants?.find((p) => p.id === message.senderId)?.username || 'Unknown'}
          </p>
        )}

        {renderContent()}

        {/* Timestamp + status row */}
        <div className={`flex items-center gap-1 mt-1 ${own ? 'justify-end' : 'justify-end'}`}>
          <span
            className={`text-[10px] leading-none ${
              own ? 'text-emerald-200/70' : 'text-gray-500'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {own && (
            <span className={`${message.status === 'SEEN' ? 'text-emerald-300' : 'text-gray-400'}`}>
              <MessageStatus message={message} isOwnMessage={own} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;