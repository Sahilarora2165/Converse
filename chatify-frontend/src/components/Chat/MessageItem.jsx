import React, { memo, useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, Reply, X, Check } from 'lucide-react';

// Double tick SVG — reused for SENT/DELIVERED/SEEN
const DoubleTick = ({ color = 'currentColor' }) => (
  <span className="inline-flex items-center relative" style={{ width: 18, height: 12 }}>
    <svg style={{ position: 'absolute', left: 0 }} width="12" height="12" viewBox="0 0 20 20" fill={color}>
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
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

const MessageStatusIndicator = ({ message, isOwnMessage }) => {
  if (!isOwnMessage) return null;

  const isSeen = message.status === 'SEEN';
  const isDelivered = message.status === 'DELIVERED';

  if (isSeen) return <DoubleTick color="#34d399" />;
  if (isDelivered) return <DoubleTick color="#6b7280" />;
  return <SingleTick />;
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
  onReply,
  onEdit,
  onDelete,
  onScrollToMessage,
}) => {
  const own = isOwnMessage ?? isMe ?? false;
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editInputRef = useRef(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing]);

  const handleEditSave = () => {
    if (editContent.trim() && editContent.trim() !== message.content) {
      onEdit?.(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const renderReplyPreview = () => {
    if (!message.replyToId) return null;
    return (
      <div
        className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 cursor-pointer ${
          own
            ? 'bg-emerald-700/40 border-emerald-300/50'
            : 'bg-white/5 border-zinc-500/50'
        }`}
        onClick={() => onScrollToMessage?.(message.replyToId)}
      >
        <p className={`text-[10px] font-semibold ${own ? 'text-emerald-200/80' : 'text-zinc-400'}`}>
          {message.replyToSenderName || 'Unknown'}
        </p>
        <p className={`text-[11px] truncate ${own ? 'text-emerald-100/60' : 'text-zinc-500'}`}>
          {message.replyToContent || '...'}
        </p>
      </div>
    );
  };

  const renderContent = () => {
    if (message.deleted) {
      return (
        <p className="text-sm italic text-zinc-500 leading-relaxed">
          This message was deleted
        </p>
      );
    }

    if (isEditing) {
      return (
        <div className="flex flex-col gap-1.5">
          <textarea
            ref={editInputRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="w-full bg-black/30 text-sm text-white rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-amber-500/50 resize-none"
            rows={Math.min(editContent.split('\n').length, 4)}
          />
          <div className="flex items-center gap-1.5 justify-end">
            <button onClick={handleEditCancel} className="p-1 rounded-md hover:bg-white/10 text-zinc-400">
              <X className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleEditSave} className="p-1 rounded-md hover:bg-white/10 text-emerald-400">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

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

    return (
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{content}</p>
    );
  };

  const getSenderColor = (senderId) => {
    const colors = [
      '#f87171', '#fb923c', '#facc15', '#4ade80',
      '#34d399', '#38bdf8', '#a78bfa', '#f472b6',
    ];
    return colors[senderId % colors.length];
  };

  const bubbleRadius = own
    ? [
        isFirstInSequence ? '18px' : '6px',
        isFirstInSequence ? '18px' : '18px',
        isLastInSequence  ? '4px'  : '18px',
        isLastInSequence  ? '18px' : '18px',
      ].join(' ')
    : [
        isFirstInSequence ? '18px' : '18px',
        isFirstInSequence ? '18px' : '6px',
        isLastInSequence  ? '18px' : '18px',
        isLastInSequence  ? '4px'  : '18px',
      ].join(' ');

  return (
    <div
      className={`flex ${own ? 'justify-end' : 'justify-start'} px-2 group`}
      style={{ marginBottom: isLastInSequence ? 6 : 2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-message-id={message.id}
    >
      {/* Action buttons - shown on hover for non-deleted messages */}
      {isHovered && !message.deleted && !isEditing && (
        <div className={`flex items-center gap-0.5 mx-1 ${own ? 'order-first' : 'order-last'}`}>
          <button
            onClick={() => onReply?.(message)}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          {own && (
            <>
              <button
                onClick={() => {
                  setEditContent(message.content);
                  setIsEditing(true);
                }}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete?.(message.id)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-900/60 text-zinc-400 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

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
        {showSender && (
          <p
            className="text-[11px] font-semibold mb-1 leading-none"
            style={{ color: getSenderColor(message.senderId) }}
          >
            {participants?.find((p) => p.id === message.senderId)?.username || 'Unknown'}
          </p>
        )}

        {renderReplyPreview()}
        {renderContent()}

        {/* Timestamp + edited indicator + status row */}
        <div className={`flex items-center gap-1 mt-1 ${own ? 'justify-end' : 'justify-end'}`}>
          {message.edited && !message.deleted && (
            <span className={`text-[9px] italic ${own ? 'text-emerald-200/50' : 'text-gray-600'}`}>
              edited
            </span>
          )}
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
              <MessageStatusIndicator message={message} isOwnMessage={own} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.edited === nextProps.message.edited &&
    prevProps.message.deleted === nextProps.message.deleted &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.isMe === nextProps.isMe &&
    prevProps.isFirstInSequence === nextProps.isFirstInSequence &&
    prevProps.isLastInSequence === nextProps.isLastInSequence
  );
};

export default memo(MessageItem, arePropsEqual);
