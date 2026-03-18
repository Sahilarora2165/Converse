import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useWebSocket from "../hooks/useWebSocket";
import { getChatRooms, getChatHistoryPaginated, markMessagesAsRead } from "../services/api";
import NewChatModal from "../components/NewChatModal";
import ChatSidebar from "../components/ChatSidebar";
import MessageItem from "../components/Chat/MessageItem";
import FileUpload from "../components/Chat/FileUpload";
import MetricsDashboard from "../components/MetricsDashboard";
import toast from "react-hot-toast";
import { Send, X, FileText, MessageCircle, Loader2, Sparkles, ShieldCheck, Activity } from "lucide-react";
import VirtualizedMessageList from "../components/Chat/VirtualizedMessageList";

const FILE_LIMITS = {
  "image/jpeg": 5,
  "image/png": 5,
  "image/gif": 5,
  "image/webp": 5,
  "application/pdf": 10,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 10,
  "video/mp4": 50,
  "video/quicktime": 50,
  "video/x-msvideo": 50,
};

const getMessageType = (contentType) => {
  if (contentType?.startsWith("image/")) return "IMAGE";
  if (contentType?.startsWith("video/")) return "VIDEO";
  return "FILE";
};

const PAGE_SIZE = 30;

const Chat = () => {
  const { user } = useAuth();
  const {
    subscribeToRoom,
    sendMessage,
    isConnected,
    subscribeToDelivery,
    subscribeToSeen,
    sendDeliveryAck,
    sendSeenAck,
  } = useWebSocket();

  const { chatId } = useParams();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // file upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sending, setSending] = useState(false);
  const [showMetricsDashboard, setShowMetricsDashboard] = useState(false);

  const inputRef = useRef(null);
  const subscriptionRef = useRef(null);
  const deliverySubRef = useRef(null);
  const seenSubRef = useRef(null);
  const isChatActiveRef = useRef(false);
  const isLoadingRef = useRef(false);
  const previousChatIdRef = useRef(null);

  const currentRoom = rooms?.find((r) => String(r.id) === String(chatId));
  const otherUser =
    currentRoom && !currentRoom?.isGroupChat
      ? currentRoom?.participants?.find((p) => String(p.id) !== String(user?.id))
      : null;
  const isOtherUserOnline = otherUser?.status === "ONLINE";

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
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (dateString) => {
    const msgDate = new Date(dateString);
    const today = new Date();
    const msgDateOnly = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (msgDateOnly.getTime() === todayOnly.getTime()) return "Today";
    return msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const groupMessagesByDate = (msgs) => {
    const grouped = [];
    let lastDate = null;

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== lastDate) {
        grouped.push({ type: "date-separator", date: msg.timestamp, id: `date-${msgDate}` });
        lastDate = msgDate;
      }
      grouped.push({ type: "message", ...msg });
    });

    return grouped;
  };

  // pagination fetch, triggered by VirtualizedMessageList when near top
  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const { data: pageData } = await getChatHistoryPaginated(chatId, page, PAGE_SIZE);
      const olderMsgs = (pageData.content || []).reverse(); // backend: newest-first

      if (olderMsgs.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = olderMsgs.filter((m) => !existingIds.has(m.id));
          return [...unique, ...prev];
        });
        setPage((prev) => prev + 1);
      }

      setHasMore(!pageData.last);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, hasMore, loadingMore, page]);

  // focus/blur for seen ACKs
  useEffect(() => {
    const handleFocus = () => {
      isChatActiveRef.current = true;
      if (chatId && messages.length > 0 && sendSeenAck) {
        const lastId = messages[messages.length - 1]?.id;
        if (lastId) sendSeenAck(parseInt(chatId), lastId);
      }
    };
    const handleBlur = () => {
      isChatActiveRef.current = false;
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    isChatActiveRef.current = true;

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [chatId, messages, sendSeenAck]);

  // initial page load + subscriptions
  useEffect(() => {
    if (!chatId || !isConnected) {
      if (!chatId) setMessages([]);
      return;
    }
    if (previousChatIdRef.current === chatId && !isLoadingRef.current) return;
    previousChatIdRef.current = chatId;

    const loadHistoryAndSubscribe = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setLoading(true);

      setPage(0);
      setHasMore(true);

      try {
        const { data: pageData } = await getChatHistoryPaginated(chatId, 0, PAGE_SIZE);
        const msgs = (pageData.content || []).reverse();

        setMessages(msgs);
        setHasMore(!pageData.last);
        setPage(1);

        await markMessagesAsRead(chatId);
        await fetchRooms();

        // ACK delivered for latest other-user message
        if (msgs.length > 0 && sendDeliveryAck) {
          const others = msgs.filter((m) => m.senderId !== user?.id);
          if (others.length > 0) {
            sendDeliveryAck(parseInt(chatId), others[others.length - 1].id);
          }
        }

        // subscribe: new messages
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeToRoom(chatId, (message) => {
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));

          if (message.senderId !== user?.id) {
            if (sendDeliveryAck) sendDeliveryAck(parseInt(chatId), message.id);
            if (sendSeenAck && isChatActiveRef.current) sendSeenAck(parseInt(chatId), message.id);
          }
        });

        // delivery updates
        deliverySubRef.current?.unsubscribe();
        if (subscribeToDelivery) {
          deliverySubRef.current = subscribeToDelivery(chatId, (update) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.senderId === user?.id &&
                msg.id <= update.lastDeliveredMessageId &&
                msg.status === "SENT"
                  ? { ...msg, status: "DELIVERED" }
                  : msg
              )
            );
          });
        }

        // seen updates
        seenSubRef.current?.unsubscribe();
        if (subscribeToSeen) {
          seenSubRef.current = subscribeToSeen(chatId, (update) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.senderId === user?.id &&
                msg.id <= update.lastSeenMessageId &&
                (msg.status === "SENT" || msg.status === "DELIVERED")
                  ? { ...msg, status: "SEEN" }
                  : msg
              )
            );
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("History failed");
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
    };
  }, [
    chatId,
    isConnected,
    subscribeToRoom,
    subscribeToDelivery,
    subscribeToSeen,
    sendDeliveryAck,
    sendSeenAck,
    user?.id,
    fetchRooms,
  ]);

  const handleFileSelect = (file) => {
    if (!file) return;
    const maxMB = FILE_LIMITS[file.type];
    if (!maxMB) {
      toast.error("Type not allowed");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`Max ${maxMB}MB`);
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !isConnected || sending) return;

    setSending(true);
    try {
      if (selectedFile) {
        const { getPresignedUrl, uploadFileToS3, sendMessage: sendMessageREST } = await import("../api/messages");
        const presignedData = await getPresignedUrl(selectedFile.name, selectedFile.type, selectedFile.size);

        await uploadFileToS3(presignedData.presignedUrl, selectedFile);

        await sendMessageREST({
          chatRoomId: parseInt(chatId),
          content: newMessage || "",
          messageType: getMessageType(selectedFile.type),
          fileUrl: presignedData.fileUrl,
          fileName: selectedFile.name,
        });

        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        sendMessage(chatId, newMessage.trim());
      }

      setNewMessage("");
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast.error("Send failed");
    } finally {
      setSending(false);
    }
  };

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  // Memoize the render item callback to prevent unnecessary re-renders
  const renderItem = useCallback((item) => {
    if (item.type === "date-separator") {
      return (
        <div className="flex justify-center my-5">
          <div className="px-3 py-1 bg-zinc-900/80 backdrop-blur-sm rounded-md border border-white/[0.04]">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              {formatDateSeparator(item.date)}
            </span>
          </div>
        </div>
      );
    }
    const isMe = String(item.senderId) === String(user?.id);
    return (
      <div className="py-1">
        <MessageItem message={item} isMe={isMe} currentUserId={user?.id} />
      </div>
    );
  }, [user?.id]);

  return (
    <div className="flex h-screen bg-zinc-950 font-sans text-zinc-100 overflow-hidden">
      <ChatSidebar rooms={rooms} setRooms={setRooms} onNewChat={() => setShowNewChatModal(true)} />

      <div className="flex-1 flex flex-col relative bg-zinc-950">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-zinc-500/5 blur-[100px] rounded-full pointer-events-none" />

        {currentRoom ? (
          <>
            {/* Header */}
            <header className="relative z-20 px-8 py-5 border-b border-white/[0.03] bg-zinc-950/40 backdrop-blur-2xl flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-zinc-100 font-bold shadow-2xl transition-transform group-hover:scale-105">
                    {currentRoom.isGroupChat ? currentRoom.name[0] : otherUser?.username?.[0] || "?"}
                  </div>
                  {!currentRoom.isGroupChat && (
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-zinc-950 shadow-lg ${
                        isOtherUserOnline ? "bg-amber-400" : "bg-zinc-600"
                      }`}
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-white leading-none">
                      {currentRoom.isGroupChat ? currentRoom.name : otherUser?.username || "Secure Chat"}
                    </h2>
                    {isOtherUserOnline && <Sparkles className="w-3 h-3 text-amber-400 opacity-50" />}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500 mt-1.5 flex items-center gap-2">
                    {currentRoom.isGroupChat
                      ? `${currentRoom.participants?.length} Members`
                      : isOtherUserOnline
                      ? "Connection Live"
                      : `Offline • ${formatRelativeTime(otherUser?.lastSeen)}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowMetricsDashboard(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                  title="View Latency Metrics"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Metrics</span>
                </button>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                </div>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 min-h-0 px-6 py-4 relative">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    <p className="text-xs text-zinc-600 uppercase tracking-widest font-medium">Loading messages</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/[0.04] flex items-center justify-center">
                      <MessageCircle className="w-7 h-7 text-zinc-700" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400 font-medium">No messages yet</p>
                      <p className="text-xs text-zinc-600 mt-1">Send the first message to start the conversation</p>
                    </div>
                  </div>
                </div>
              ) : (
                <VirtualizedMessageList
                  items={groupedMessages}
                  isLoadingMore={loadingMore}
                  onReachTop={loadOlderMessages}
                  renderItem={renderItem}
                />
              )}

              {loadingMore && (
                <div className="absolute left-1/2 -translate-x-1/2 top-[72px] px-3 py-1 rounded-full bg-zinc-900 border border-white/[0.06] text-[10px] text-zinc-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  Loading older…
                </div>
              )}
            </div>

            {/* Footer / Input */}
            <footer className="relative z-20 px-8 pb-8 pt-2">
              {selectedFile && (
                <div className="mb-0 mx-4 p-4 bg-zinc-900/90 backdrop-blur-md rounded-t-3xl border border-white/5 border-b-0 flex items-center gap-4 animate-in slide-in-from-bottom-2">
                  <div className="relative h-14 w-14 group">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="h-full w-full object-cover rounded-xl border border-white/10"
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-800 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-zinc-500" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className={`flex items-center gap-3 p-2 bg-zinc-900/50 backdrop-blur-xl border border-white/5 shadow-2xl transition-all ${
                  selectedFile ? "rounded-b-3xl rounded-t-none" : "rounded-[28px]"
                }`}
              >
                <div className="flex-shrink-0 ml-1">
                  <FileUpload onFileSelect={handleFileSelect} disabled={sending || !isConnected} />
                </div>

                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!isConnected || sending}
                  placeholder={selectedFile ? "Add details to this file..." : "Express yourself..."}
                  className="flex-1 bg-transparent px-2 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedFile) || !isConnected || sending}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-20 disabled:grayscale transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] active:scale-90"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 translate-x-0.5 -translate-y-0.5" />
                  )}
                </button>
              </form>
            </footer>
          </>
        ) : (
          // empty state
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
            <div className="w-24 h-24 mb-8 rounded-[40px] bg-zinc-900 border border-white/5 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-zinc-700" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">Encrypted Terminal</h3>
            <p className="text-sm text-zinc-500 mt-4 max-w-xs leading-relaxed">
              Select a secure communication channel from the sidebar or initiate a new handshake.
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="mt-8 px-8 py-3 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95"
            >
              New Handshake
            </button>
          </div>
        )}
      </div>

      {showNewChatModal && (
        <NewChatModal onClose={() => setShowNewChatModal(false)} onChatCreated={fetchRooms} />
      )}
      
      <MetricsDashboard 
        isOpen={showMetricsDashboard} 
        onClose={() => setShowMetricsDashboard(false)} 
      />
    </div>
  );
};

export default Chat;