import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { getMessages, markAllMessagesAsRead } from '../../api/messages';
import { getChatRoomById } from '../../api/chatrooms';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import GroupInfo from '../Group/GroupInfo';
import LoadingSpinner from '../Common/LoadingSpinner';
import Avatar from '../Common/Avatar';
import OnlineStatus from '../Common/OnlineStatus';
import { getChatDisplayName, getOtherParticipant } from '../../utils/helpers';
import toast from 'react-hot-toast';

const NEAR_BOTTOM_THRESHOLD = 120; // px from bottom to consider "near bottom"

const ChatWindow = ({ chatRoomId, onChatUpdated }) => {
  const { user } = useAuth();
  const {
    subscribeToChatRoom,
    unsubscribeFromChatRoom,
    isConnected,
    isUserOnline,
    setReadReceiptCallback,
  } = useWebSocket();

  const [chatRoom, setChatRoom]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isSubscribed, setIsSubscribed]   = useState(false);

  const scrollContainerRef  = useRef(null); // the scrollable div
  const bottomAnchorRef     = useRef(null); // invisible div at end of list
  const loadedIdsRef        = useRef(new Set());
  const isLoadingRef        = useRef(false);
  const shouldScrollRef     = useRef(true);  // true = always snap to bottom on initial load

  // ─── Scroll helpers ─────────────────────────────────────────────────────────
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  // Instant jump — used on initial load
  const scrollToBottomInstant = useCallback(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, []);

  // Smooth scroll — used for new incoming messages when user is near bottom
  const scrollToBottomSmooth = useCallback(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  // ─── Load data ───────────────────────────────────────────────────────────────
  const loadChatRoom = useCallback(async () => {
    if (!chatRoomId) return;
    try {
      const data = await getChatRoomById(chatRoomId);
      setChatRoom(data);
    } catch {
      toast.error('Failed to load chat room');
    }
  }, [chatRoomId]);

  const loadMessages = useCallback(async () => {
    if (!chatRoomId || isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      setLoading(true);
      shouldScrollRef.current = true; // force snap on fresh load

      const data = await getMessages(chatRoomId);
      loadedIdsRef.current = new Set(data.map((m) => m.id));
      setMessages(data);

      await markAllMessagesAsRead(chatRoomId);
      if (onChatUpdated) onChatUpdated();
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [chatRoomId, onChatUpdated]);

  // ─── Scroll to bottom after messages render ──────────────────────────────────
  // This runs after every messages state change.
  // shouldScrollRef.current = true  → instant jump (initial load / room switch)
  // isNearBottom()           = true → smooth scroll (new message arrived)
  useEffect(() => {
    if (loading || messages.length === 0) return;

    if (shouldScrollRef.current) {
      // Use rAF to ensure DOM has painted before measuring
      requestAnimationFrame(() => {
        scrollToBottomInstant();
        shouldScrollRef.current = false;
      });
    } else if (isNearBottom()) {
      scrollToBottomSmooth();
    }
  }, [messages, loading, isNearBottom, scrollToBottomInstant, scrollToBottomSmooth]);

  // ─── WebSocket handlers ──────────────────────────────────────────────────────
  const handleNewMessage = useCallback((message) => {
    if (!message?.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id) || loadedIdsRef.current.has(message.id)) {
        return prev;
      }
      loadedIdsRef.current.add(message.id);
      return [...prev, message];
    });

    if (message.senderId !== user?.id) {
      markAllMessagesAsRead(chatRoomId).catch(console.error);
      if (onChatUpdated) onChatUpdated();
    }
  }, [chatRoomId, user?.id, onChatUpdated]);

  const handleReadReceipt = useCallback((receipt) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === receipt.messageId
          ? {
              ...msg,
              readByUserIds: receipt.readByUserIds ||
                [...(msg.readByUserIds || []), receipt.userId],
            }
          : msg
      )
    );
  }, []);

  const handleMessageSent = useCallback((message) => {
    if (!message?.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id) || loadedIdsRef.current.has(message.id)) {
        return prev;
      }
      loadedIdsRef.current.add(message.id);
      return [...prev, message];
    });
    if (onChatUpdated) onChatUpdated();
  }, [onChatUpdated]);

  // ─── Reset on room switch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatRoomId) return;
    // Reset state for new room
    setMessages([]);
    setChatRoom(null);
    setIsSubscribed(false);
    loadedIdsRef.current = new Set();
    shouldScrollRef.current = true;

    loadChatRoom();
    loadMessages();
  }, [chatRoomId]); // intentionally only chatRoomId — not loadChatRoom/loadMessages

  // ─── Subscribe after load ────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatRoomId || loading || isSubscribed) return;
    if (!isLoadingRef.current) {
      subscribeToChatRoom(chatRoomId, handleNewMessage);
      setReadReceiptCallback(chatRoomId, handleReadReceipt);
      setIsSubscribed(true);
    }
    return () => {
      if (chatRoomId && isSubscribed) {
        unsubscribeFromChatRoom(chatRoomId);
        setIsSubscribed(false);
      }
    };
  }, [chatRoomId, loading, isSubscribed, subscribeToChatRoom, unsubscribeFromChatRoom,
      handleNewMessage, handleReadReceipt, setReadReceiptCallback]);

  // Re-subscribe on reconnect
  useEffect(() => {
    if (isConnected && chatRoomId && !isSubscribed && !loading) {
      subscribeToChatRoom(chatRoomId, handleNewMessage);
      setReadReceiptCallback(chatRoomId, handleReadReceipt);
      setIsSubscribed(true);
    }
  }, [isConnected, chatRoomId, isSubscribed, loading, subscribeToChatRoom,
      handleNewMessage, handleReadReceipt, setReadReceiptCallback]);

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (!chatRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-gray-300">Welcome to Chatify</h2>
          <p className="text-gray-500 mt-2">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const otherParticipant = !chatRoom?.isGroupChat
    ? getOtherParticipant(chatRoom, user?.id)
    : null;
  const isOtherOnline = otherParticipant ? isUserOnline(otherParticipant.id) : false;

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-[#111111] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Avatar
            user={otherParticipant || { username: chatRoom?.name }}
            size="md"
            showStatus={!chatRoom?.isGroupChat}
            isOnline={isOtherOnline}
          />
          <div>
            <h2 className="font-semibold text-gray-100 text-sm">
              {getChatDisplayName(chatRoom, user?.id)}
            </h2>
            {chatRoom?.isGroupChat ? (
              <p className="text-xs text-gray-500">
                {chatRoom.participants?.length} participants
              </p>
            ) : (
              <OnlineStatus isOnline={isOtherOnline} size="sm" />
            )}
          </div>
        </div>

        {chatRoom?.isGroupChat && (
          <button
            onClick={() => setShowGroupInfo(true)}
            className="p-2 text-gray-500 hover:text-gray-300 hover:bg-[#1f1f1f] rounded-full transition-colors"
            title="Group Info"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Messages scroll area ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
        style={{ overflowAnchor: 'none' }} // disable browser's own scroll anchor — we control it
      >
        <MessageList
          messages={messages}
          currentUserId={user?.id}
          chatRoom={chatRoom}
        />
        {/* Invisible anchor — scrollIntoView targets this */}
        <div ref={bottomAnchorRef} style={{ height: 1 }} />
      </div>

      {/* ── Typing indicator ── */}
      <TypingIndicator chatRoomId={chatRoomId} />

      {/* ── Input ── */}
      <MessageInput
        chatRoomId={chatRoomId}
        onMessageSent={handleMessageSent}
      />

      {/* ── Group Info Modal ── */}
      {showGroupInfo && chatRoom?.isGroupChat && (
        <GroupInfo
          chatRoom={chatRoom}
          onClose={() => setShowGroupInfo(false)}
          onChatRoomUpdated={(updated) => {
            setChatRoom(updated);
            if (onChatUpdated) onChatUpdated();
          }}
        />
      )}
    </div>
  );
};

export default ChatWindow;