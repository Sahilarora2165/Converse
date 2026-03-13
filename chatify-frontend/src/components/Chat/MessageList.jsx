import React from 'react';
import MessageItem from './MessageItem';

const MessageList = ({ messages, currentUserId, chatRoom }) => {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-16">
        <div className="text-center">
          <div className="text-4xl mb-3">👋</div>
          <p className="text-gray-500 text-sm">No messages yet</p>
          <p className="text-gray-600 text-xs mt-1">Start the conversation!</p>
        </div>
      </div>
    );
  }

  // Group messages by calendar date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});

  const formatDateLabel = (dateStr) => {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return dateStr;
  };

  return (
    <div className="space-y-1">
      {Object.entries(groupedMessages).map(([date, dateMessages]) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="flex-1 h-px bg-[#1f1f1f]" />
            <span className="mx-3 text-[11px] text-gray-500 bg-[#111111] px-2 py-0.5 rounded-full border border-[#1f1f1f] whitespace-nowrap">
              {formatDateLabel(date)}
            </span>
            <div className="flex-1 h-px bg-[#1f1f1f]" />
          </div>

          {/* Messages for this date */}
          <div className="space-y-0.5">
            {dateMessages.map((message, index) => {
              const prevMsg = index > 0 ? dateMessages[index - 1] : null;
              const nextMsg = index < dateMessages.length - 1 ? dateMessages[index + 1] : null;

              const isOwn = message.senderId === currentUserId;

              // Show sender name in group chat if first in a sequence from this sender
              const showSender =
                chatRoom?.isGroupChat &&
                !isOwn &&
                (!prevMsg || prevMsg.senderId !== message.senderId);

              // Bubble tail: show only on last message in a consecutive sequence
              const isLastInSequence = !nextMsg || nextMsg.senderId !== message.senderId;
              // Bubble top radius: reduce on continuation bubbles
              const isFirstInSequence = !prevMsg || prevMsg.senderId !== message.senderId;

              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwn}
                  isMe={isOwn}
                  currentUserId={currentUserId}
                  showSender={showSender}
                  isGroupChat={chatRoom?.isGroupChat}
                  participants={chatRoom?.participants}
                  isFirstInSequence={isFirstInSequence}
                  isLastInSequence={isLastInSequence}
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