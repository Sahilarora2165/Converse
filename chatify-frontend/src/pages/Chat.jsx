import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistory, markMessagesAsRead } from "../services/api";
import { getPresignedUrl, uploadFileToS3, sendMessage as sendMessageREST } from "../api/messages";
import NewChatModal from "../components/NewChatModal";
import ChatSidebar from "../components/ChatSidebar";
import MessageItem from "../components/Chat/MessageItem";
import FileUpload from "../components/Chat/FileUpload";
import { ALLOWED_FILE_TYPES, MESSAGE_TYPES } from "../utils/constants";
import toast from 'react-hot-toast';

const Chat = () => {
  const { user } = useAuth();
  const {
    subscribeToRoom,
    sendMessage,
    isConnected,
    subscribeToDelivery,
    subscribeToSeen,
    sendDeliveryAck,
    sendSeenAck
  } = useWebSocket();

  const { chatId } = useParams();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // file upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);
  const deliverySubRef = useRef(null);
  const seenSubRef = useRef(null);
  const isChatActiveRef = useRef(false);
  const isLoadingRef = useRef(false);
  const previousChatIdRef = useRef(null);

  const currentRoom = rooms?.find(r => String(r.id) === String(chatId));
  const otherUser = currentRoom && !currentRoom?.isGroupChat
    ? currentRoom?.participants?.find(p => String(p.id) !== String(user?.id))
    : null;
  const isOtherUserOnline = otherUser?.status === 'ONLINE';

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await getChatRooms();
      const sorted = [...data].sort((a, b) => {
        const timeA = a.lastMessageTimestamp || a.createdAt;
        const timeB = b.lastMessageTimestamp || b.createdAt;
        return new Date(timeB) - new Date(timeA);
      });
      setRooms(sorted);
    } catch (err) {
      console.error("Failed to load rooms", err);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  };

  const formatDateSeparator = (dateString) => {
    const msgDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (msgDateOnly.getTime() === todayOnly.getTime()) return 'Today';
    if (msgDateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';
    return msgDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const groupMessagesByDate = (messages) => {
    const grouped = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== lastDate) {
        grouped.push({ type: 'date-separator', date: msg.timestamp, id: `date-${msgDate}` });
        lastDate = msgDate;
      }
      grouped.push({ type: 'message', ...msg });
    });
    return grouped;
  };

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // determine message type from file content type
  const getMessageType = (contentType) => {
    if (contentType?.startsWith('image/')) return MESSAGE_TYPES.IMAGE;
    if (contentType?.startsWith('video/')) return MESSAGE_TYPES.VIDEO;
    return MESSAGE_TYPES.FILE;
  };

  // file selection handler
  const handleFileSelect = (file) => {
    if (!file) return;

    const typeConfig = ALLOWED_FILE_TYPES[file.type];
    if (!typeConfig) {
      toast.error('File type not allowed');
      return;
    }

    if (file.size > typeConfig.maxMB * 1024 * 1024) {
      toast.error(`Max size for this type is ${typeConfig.maxMB}MB`);
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // focus/blur for seen status
  useEffect(() => {
    const handleFocus = () => {
      isChatActiveRef.current = true;
      if (chatId && messages.length > 0 && sendSeenAck) {
        const lastMessageId = messages[messages.length - 1]?.id;
        if (lastMessageId) sendSeenAck(parseInt(chatId), lastMessageId);
      }
    };
    const handleBlur = () => { isChatActiveRef.current = false; };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    isChatActiveRef.current = true;

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [chatId, messages, sendSeenAck]);

  // load history + subscribe
  useEffect(() => {
    if (!chatId || !isConnected) {
      if (!chatId) {
        setMessages([]);
        subscriptionRef.current?.unsubscribe();
        deliverySubRef.current?.unsubscribe();
        seenSubRef.current?.unsubscribe();
      }
      return;
    }

    if (previousChatIdRef.current === chatId && !isLoadingRef.current) return;
    previousChatIdRef.current = chatId;

    const loadHistoryAndSubscribe = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setLoading(true);

      try {
        const { data } = await getChatHistory(chatId);
        setMessages(data || []);
        scrollToBottom('auto');

        await markMessagesAsRead(chatId);
        await fetchRooms();

        if (data && data.length > 0 && sendDeliveryAck) {
          const otherMessages = data.filter(m => m.senderId !== user?.id);
          if (otherMessages.length > 0) {
            const lastOtherId = otherMessages[otherMessages.length - 1]?.id;
            if (lastOtherId) sendDeliveryAck(parseInt(chatId), lastOtherId);
          }
        }

        if (data && data.length > 0 && sendSeenAck && isChatActiveRef.current) {
          const otherMessages = data.filter(m => m.senderId !== user?.id);
          if (otherMessages.length > 0) {
            const lastOtherId = otherMessages[otherMessages.length - 1]?.id;
            if (lastOtherId) sendSeenAck(parseInt(chatId), lastOtherId);
          }
        }

        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToRoom(chatId, (message) => {
          setMessages(prev => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
          scrollToBottom();

          if (sendDeliveryAck && message.senderId !== user?.id) {
            sendDeliveryAck(parseInt(chatId), message.id);
          }
          if (sendSeenAck && message.senderId !== user?.id && isChatActiveRef.current) {
            sendSeenAck(parseInt(chatId), message.id);
          }
        });

        deliverySubRef.current?.unsubscribe();
        if (subscribeToDelivery) {
          deliverySubRef.current = subscribeToDelivery(chatId, (update) => {
            setMessages(prev => prev.map(msg => {
              const shouldUpdate = msg.senderId === user?.id &&
                msg.id <= update.lastDeliveredMessageId && msg.status === 'SENT';
              return shouldUpdate ? { ...msg, status: 'DELIVERED' } : msg;
            }));
          });
        }

        seenSubRef.current?.unsubscribe();
        if (subscribeToSeen) {
          seenSubRef.current = subscribeToSeen(chatId, (update) => {
            setMessages(prev => prev.map(msg => {
              const shouldUpdate = msg.senderId === user?.id &&
                msg.id <= update.lastSeenMessageId &&
                (msg.status === 'SENT' || msg.status === 'DELIVERED');
              return shouldUpdate ? { ...msg, status: 'SEEN' } : msg;
            }));
          });
        }

      } catch (err) {
        console.error("[ERROR] Failed to load chat history", err);
        toast.error('Failed to load chat history');
        setMessages([]);
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadHistoryAndSubscribe();

    return () => {
      subscriptionRef.current?.unsubscribe();
      deliverySubRef.current?.unsubscribe();
      seenSubRef.current?.unsubscribe();
      isLoadingRef.current = false;
    };
  }, [chatId, isConnected, subscribeToRoom, subscribeToDelivery, subscribeToSeen,
      sendDeliveryAck, sendSeenAck, scrollToBottom, user?.id, fetchRooms]);

  // send message — handles both text-only and file messages
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !isConnected) return;
    if (sending) return;

    setSending(true);

    try {
      if (selectedFile) {
        // file message — go through REST (presigned URL → S3 → save message)
        const presignedData = await getPresignedUrl(
          selectedFile.name,
          selectedFile.type,
          selectedFile.size
        );

        await uploadFileToS3(presignedData.presignedUrl, selectedFile);

        // save message via REST — backend will also broadcast via WebSocket
        await sendMessageREST({
          chatRoomId: parseInt(chatId),
          content: newMessage || '',
          messageType: getMessageType(selectedFile.type),
          fileUrl: presignedData.fileUrl,
          fileName: selectedFile.name,
        });

        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        // text-only — send via WebSocket as before
        sendMessage(chatId, newMessage.trim());
      }

      setNewMessage("");
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (loading && chatId) {
    return (
      <div className="flex h-screen bg-[#0a0a0a]">
        <ChatSidebar rooms={rooms} setRooms={setRooms} onNewChat={() => setShowNewChatModal(true)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#c9a961] text-lg font-medium">Loading messages...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <ChatSidebar rooms={rooms} setRooms={setRooms} onNewChat={() => setShowNewChatModal(true)} />

      <div className="flex-1 flex flex-col">
        {currentRoom ? (
          <>
            {/* HEADER */}
            <div className="p-6 bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-b border-[#2a2a2a] shadow-2xl backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-[#e8e8e8] tracking-wide">
                  {currentRoom.isGroupChat ? currentRoom.name : otherUser?.username || 'Unknown'}
                </h2>
                {!currentRoom.isGroupChat && otherUser && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${isOtherUserOnline ? "bg-[#c9a961] shadow-[0_0_8px_rgba(201,169,97,0.6)]" : "bg-[#4a4a4a]"}`} />
                    <span className={isOtherUserOnline ? "text-[#c9a961]" : "text-[#6a6a6a]"}>
                      {isOtherUserOnline ? "Online" : `Last seen ${formatRelativeTime(otherUser.lastSeen)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-8 space-y-2 bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a]">
              {groupedMessages.map((item) => {
                if (item.type === 'date-separator') {
                  return (
                    <div key={item.id} className="flex justify-center my-6">
                      <div className="px-4 py-1.5 bg-[#1a1a1a]/80 backdrop-blur-md rounded-full border border-[#2a2a2a] shadow-lg">
                        <span className="text-xs font-medium text-[#8a8a8a] uppercase tracking-wider">
                          {formatDateSeparator(item.date)}
                        </span>
                      </div>
                    </div>
                  );
                }
                const isMe = String(item.senderId) === String(user?.id);
                return (
                  <MessageItem key={item.id} message={item} isMe={isMe} currentUserId={user?.id} />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* FILE PREVIEW BAR */}
            {selectedFile && (
              <div className="px-6 py-3 bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center gap-3">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-[#3a3a3a]" />
                ) : (
                  <div className="h-14 w-14 bg-[#2a2a2a] rounded-lg flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#6a6a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#e8e8e8] truncate">{selectedFile.name}</p>
                  <p className="text-xs text-[#6a6a6a]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={handleRemoveFile} className="p-1.5 text-[#6a6a6a] hover:text-red-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* INPUT */}
            <form onSubmit={handleSendMessage} className="p-6 bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-t border-[#2a2a2a] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3">
                <FileUpload onFileSelect={handleFileSelect} disabled={sending || !isConnected} />
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!isConnected || sending}
                  placeholder={selectedFile ? "Add a caption (optional)…" : "Type a message…"}
                  className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-5 py-3.5 text-[#e8e8e8] placeholder-[#5a5a5a] focus:outline-none focus:border-[#c9a961] focus:shadow-[0_0_0_3px_rgba(201,169,97,0.1)] transition-all"
                />
                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedFile) || !isConnected || sending}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-br from-[#c9a961] via-[#b8955a] to-[#a8865a] text-[#0a0a0a] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_4px_20px_rgba(201,169,97,0.4)] active:scale-95 transition-all"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#5a5a5a]">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {showNewChatModal && (
        <NewChatModal onClose={() => setShowNewChatModal(false)} onChatCreated={fetchRooms} />
      )}
    </div>
  );
};

export default Chat;