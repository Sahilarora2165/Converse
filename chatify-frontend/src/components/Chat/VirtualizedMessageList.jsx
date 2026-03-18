import React, { useEffect, useRef, useCallback, useState } from "react";
import { VariableSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

/**
 * VirtualizedMessageList
 *
 * - Virtualizes rows using react-window VariableSizeList
 * - Supports variable height rows via ResizeObserver measurements
 * - Scrolls to bottom on initial load and when new messages arrive (if user is near bottom)
 * - Calls onReachTop when user scrolls near top
 */
const VirtualizedMessageList = ({
  items,
  renderItem,
  onReachTop,
  isLoadingMore,
  overscanCount = 10,
}) => {
  const listRef = useRef(null);
  const outerRef = useRef(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevItemsLengthRef = useRef(0);
  const userScrolledUpRef = useRef(false);

  // cache heights
  const sizeMapRef = useRef(new Map());

  const setSize = useCallback((index, size) => {
    const current = sizeMapRef.current.get(index);
    if (current !== size) {
      sizeMapRef.current.set(index, size);
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const getSize = useCallback(
    (index) => {
      const item = items[index];
      if (!item) return 72;

      const measured = sizeMapRef.current.get(index);
      if (measured) return measured;

      if (item.type === "date-separator") return 48;

      if (item.messageType === "IMAGE") return 280;
      if (item.messageType === "VIDEO") return 340;
      if (item.messageType === "FILE") return 130;

      return 96;
    },
    [items]
  );

  // Check if user is near bottom (within 300px)
  const isNearBottom = useCallback(() => {
    const el = outerRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance < 300;
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    if (listRef.current && items.length > 0) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(items.length - 1, "end");
      });
    }
  }, [items.length]);

  // Handle initial load - always scroll to bottom
  useEffect(() => {
    if (items?.length > 0 && isInitialLoad) {
      // Clear size cache on initial load
      sizeMapRef.current.clear();
      listRef.current?.resetAfterIndex(0);
      
      // Scroll to bottom after a short delay to ensure list is rendered
      const timer = setTimeout(() => {
        scrollToBottom();
        setIsInitialLoad(false);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [items?.length, isInitialLoad, scrollToBottom]);

  // Handle new messages - scroll to bottom only if user was near bottom
  useEffect(() => {
    if (isInitialLoad || !items?.length) return;
    
    const prevLength = prevItemsLengthRef.current;
    const newLength = items.length;
    
    // Only react to new messages being added
    if (newLength > prevLength) {
      // If user hasn't scrolled up (was near bottom), scroll to bottom
      if (!userScrolledUpRef.current) {
        scrollToBottom();
      }
    }
    
    prevItemsLengthRef.current = newLength;
  }, [items?.length, isInitialLoad, scrollToBottom]);

  // Track user scroll behavior
  const handleScroll = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    
    // Check if user scrolled up (not near bottom)
    const nearBottom = isNearBottom();
    userScrolledUpRef.current = !nearBottom;
    
    // Load older messages when near top
    if (el.scrollTop < 140 && !isLoadingMore) {
      onReachTop?.();
    }
  }, [isLoadingMore, onReachTop, isNearBottom]);

  // Reset when items are completely replaced (e.g., switching chats)
  useEffect(() => {
    setIsInitialLoad(true);
    userScrolledUpRef.current = false;
    sizeMapRef.current.clear();
    prevItemsLengthRef.current = 0;
  }, [items?.[0]?.id]); // Reset when first item changes (different chat)

  const Row = ({ index, style }) => {
    const item = items[index];
    return (
      <div style={style}>
        <MeasuredRow index={index} setSize={setSize}>
          {renderItem(item)}
        </MeasuredRow>
      </div>
    );
  };

  return (
    <div className="h-full w-full">
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            outerRef={outerRef}
            height={height}
            width={width}
            itemCount={items.length}
            itemSize={getSize}
            overscanCount={overscanCount}
            onScroll={handleScroll}
            className="messages-scroll"
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};

const MeasuredRow = ({ index, setSize, children }) => {
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h && h > 0) setSize(index, h);
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => ro.disconnect();
  }, [index, setSize]);

  return <div ref={rowRef}>{children}</div>;
};

export default VirtualizedMessageList;
