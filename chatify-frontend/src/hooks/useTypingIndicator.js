import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

const TYPING_DEBOUNCE_MS = 2000;
const TYPING_TIMEOUT_MS = 3000;

export const useTypingIndicator = (chatRoomId) => {
  const { sendTypingIndicator, getTypingUsers } = useWebSocket();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const typingUsers = getTypingUsers(chatRoomId);

  const stopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(chatRoomId, false);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [chatRoomId, isTyping, sendTypingIndicator]);

  const startTyping = useCallback(() => {
    const now = Date.now();
    
    // Debounce: only send typing indicator every TYPING_DEBOUNCE_MS
    if (now - lastTypingSentRef.current >= TYPING_DEBOUNCE_MS) {
      if (!isTyping) {
        setIsTyping(true);
        sendTypingIndicator(chatRoomId, true);
        lastTypingSentRef.current = now;
      }
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after TYPING_TIMEOUT_MS
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_TIMEOUT_MS);
  }, [chatRoomId, isTyping, sendTypingIndicator, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        sendTypingIndicator(chatRoomId, false);
      }
    };
  }, [chatRoomId, isTyping, sendTypingIndicator]);

  return {
    isTyping,
    typingUsers,
    startTyping,
    stopTyping,
  };
};

export default useTypingIndicator;
