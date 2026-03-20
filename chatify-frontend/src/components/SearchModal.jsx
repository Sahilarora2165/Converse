import React, { useState, useEffect, useCallback } from "react";
import { searchMessagesAPI } from "../services/api";
import { X, Search, Loader2 } from "lucide-react";

const SearchModal = ({ chatRoomId, onClose, onSelectMessage }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const search = useCallback(async (searchQuery, pageNum = 0) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await searchMessagesAPI(chatRoomId, searchQuery, pageNum, 20);
      if (pageNum === 0) {
        setResults(data.content || []);
      } else {
        setResults((prev) => [...prev, ...(data.content || [])]);
      }
      setHasMore(!data.last);
      setPage(pageNum);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [chatRoomId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        search(query, 0);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <div className="p-8 text-center text-zinc-500 text-sm">No messages found</div>
          )}
          {results.map((msg) => (
            <div
              key={msg.id}
              onClick={() => {
                onSelectMessage(msg.id);
                onClose();
              }}
              className="px-5 py-3 hover:bg-white/5 cursor-pointer border-b border-white/[0.03] transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-zinc-300">{msg.senderUsername}</span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(msg.timestamp).toLocaleDateString()} {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-zinc-400 truncate">{msg.content}</p>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => search(query, page + 1)}
              className="w-full py-3 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
              disabled={loading}
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
