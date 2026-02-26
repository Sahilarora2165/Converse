import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistory } from "../services/api";
import api from "../services/api";
import NewChatModal from "../components/NewChatModal";
import ChatSidebar from "../components/ChatSidebar";
import MessageItem from "../components/Chat/MessageItem";

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

  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);
  const deliverySubRef = useRef(null);
  const seenSubRef = useRef(null);
  const isChatActiveRef = useRef(false);

  const currentRoom = rooms?.find(r => String(r.id) === String(chatId));

  const otherUser = currentRoom && !currentRoom?.isGroupChat
    ? currentRoom?.participants?.find(p => String(p.id) !== String(user?.id))
    : null;

  const isOtherUserOnline = otherUser?.status === 'ONLINE';

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

    if (msgDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (msgDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      return msgDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const groupMessagesByDate = (messages) => {
    const grouped = [];
    let lastDate = null;

    messages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toDateString();

      if (msgDate !== lastDate) {
        grouped.push({
          type: 'date-separator',
          date: msg.timestamp,
          id: `date-${msgDate}`
        });
        lastDate = msgDate;
      }

      grouped.push({ type: 'message', ...msg });
    });

    return grouped;
  };

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await getChatRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to load rooms", err);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  // Track chat focus for seen status
  useEffect(() => {
    const handleFocus = () => {
      isChatActiveRef.current = true;
      if (chatId && messages.length > 0 && sendSeenAck) {
        const lastMessageId = messages[messages.length - 1]?.id;
        if (lastMessageId) {
          sendSeenAck(parseInt(chatId), lastMessageId);
        }
      }
    };

    const handleBlur = () => {
      isChatActiveRef.current = false;
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    isChatActiveRef.current = true;

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [chatId, messages, sendSeenAck]);

  // Load history + subscribe to updates
  useEffect(() => {
    // CRITICAL: Don't proceed if WebSocket is not connected - subscriptions will fail
    if (!chatId || !isConnected) {
      if (!chatId) {
        setMessages([]);
        subscriptionRef.current?.unsubscribe();
        deliverySubRef.current?.unsubscribe();
        seenSubRef.current?.unsubscribe();
      }
      // If just not connected yet, wait - effect will re-run when isConnected changes
      return;
    }

    const loadHistoryAndSubscribe = async () => {
      try {
        console.log('[HISTORY] Loading chat history for room:', chatId);

        // STEP 1: Load message history
        const { data } = await getChatHistory(chatId);
        setMessages(data || []);
        scrollToBottom('auto');

        // STEP 2: Mark all messages as read in backend
        await api.put(`/messages/chatroom/${chatId}/read-all`);

        // STEP 3: Send delivery ACK ONLY for OTHER people's messages
        if (data && data.length > 0 && sendDeliveryAck) {
          const otherMessages = data.filter(m => m.senderId !== user?.id);
          if (otherMessages.length > 0) {
            const lastOtherId = otherMessages[otherMessages.length - 1]?.id;
            if (lastOtherId) {
              sendDeliveryAck(parseInt(chatId), lastOtherId);
            }
          }
        }

        // STEP 4: Send seen ACK if chat is active
        if (data && data.length > 0 && sendSeenAck && isChatActiveRef.current) {
          const otherMessages = data.filter(m => m.senderId !== user?.id);
          if (otherMessages.length > 0) {
            const lastOtherId = otherMessages[otherMessages.length - 1]?.id;
            if (lastOtherId) {
              sendSeenAck(parseInt(chatId), lastOtherId);
            }
          }
        }

        // STEP 5: Subscribe to new messages
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToRoom(chatId, (message) => {

          setMessages(prev => [...prev, message]);
          scrollToBottom();

          // Auto-send delivery ACK for incoming messages
          if (sendDeliveryAck && message.senderId !== user?.id) {
            sendDeliveryAck(parseInt(chatId), message.id);
          }

          // Auto-send seen ACK if chat is active
          if (sendSeenAck && message.senderId !== user?.id && isChatActiveRef.current) {
            sendSeenAck(parseInt(chatId), message.id);
          }
        });

        // STEP 6: Subscribe to delivery status updates
        deliverySubRef.current?.unsubscribe();
        if (subscribeToDelivery) {
          deliverySubRef.current = subscribeToDelivery(chatId, (update) => {
            console.log('[DELIVERY UPDATE] Will update messages ≤', update.lastDeliveredMessageId);

            setMessages(prev => {
              const updated = prev.map(msg => {
                const shouldUpdate = msg.senderId === user?.id &&
                  msg.id <= update.lastDeliveredMessageId &&
                  msg.status === 'SENT';

                if (shouldUpdate) {
                  console.log('[DELIVERY UPDATE] Updating message', msg.id, 'from SENT to DELIVERED');
                }

                return shouldUpdate ? { ...msg, status: 'DELIVERED' } : msg;
              });

              console.log('[DELIVERY UPDATE] Updated message statuses:',
                updated.filter(m => m.senderId === user?.id).map(m => ({ id: m.id, status: m.status }))
              );

              return updated;
            });
          });
        }

        // STEP 7: Subscribe to seen status updates
        seenSubRef.current?.unsubscribe();
        if (subscribeToSeen) {
          console.log('[SUBSCRIBE] Subscribing to seen updates for room:', chatId);
          seenSubRef.current = subscribeToSeen(chatId, (update) => {
            console.log('[SEEN UPDATE] Received:', update);
            console.log('[SEEN UPDATE] Will update messages ≤', update.lastSeenMessageId);

            setMessages(prev => {
              const updated = prev.map(msg => {
                const shouldUpdate = msg.senderId === user?.id &&
                  msg.id <= update.lastSeenMessageId &&
                  (msg.status === 'SENT' || msg.status === 'DELIVERED');

                if (shouldUpdate) {
                  console.log('[SEEN UPDATE] Updating message', msg.id, 'from', msg.status, 'to SEEN');
                }

                return shouldUpdate ? { ...msg, status: 'SEEN' } : msg;
              });

              console.log('[SEEN UPDATE] Updated message statuses:',
                updated.filter(m => m.senderId === user?.id).map(m => ({ id: m.id, status: m.status }))
              );

              return updated;
            });
          });
        }

        console.log('[INIT] All subscriptions complete for room:', chatId);

      } catch (err) {
        console.error("[ERROR] Failed to load chat history or subscribe", err);
        setMessages([]);
      }
    };

    loadHistoryAndSubscribe();

    return () => {
      console.log('[CLEANUP] Unsubscribing from room:', chatId);
      subscriptionRef.current?.unsubscribe();
      deliverySubRef.current?.unsubscribe();
      seenSubRef.current?.unsubscribe();
    };
  }, [chatId, isConnected, subscribeToRoom, subscribeToDelivery, subscribeToSeen, sendDeliveryAck, sendSeenAck, scrollToBottom, user?.id]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    console.log('[SEND] Sending message:', newMessage.trim());
    sendMessage(chatId, newMessage.trim());
    setNewMessage("");
  };

  const groupedMessages = groupMessagesByDate(messages);

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
                  <MessageItem
                    key={item.id}
                    message={item}
                    isMe={isMe}
                    currentUserId={user?.id}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <form onSubmit={handleSendMessage} className="p-6 bg-gradient-to-r from-[#1a1a1a] to-[#141414] border-t border-[#2a2a2a] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex gap-3">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!isConnected}
                  placeholder="Type a message…"
                  className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-5 py-3.5 text-[#e8e8e8] placeholder-[#5a5a5a] focus:outline-none focus:border-[#c9a961] focus:shadow-[0_0_0_3px_rgba(201,169,97,0.1)] transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || !isConnected}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-br from-[#c9a961] via-[#b8955a] to-[#a8865a] text-[#0a0a0a] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_4px_20px_rgba(201,169,97,0.4)] active:scale-95 transition-all"
                >
                  Send
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