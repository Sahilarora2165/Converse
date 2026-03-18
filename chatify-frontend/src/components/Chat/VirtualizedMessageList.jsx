import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { VariableSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

/**
 * VirtualizedMessageList - OPTIMIZED
 *
 * - Virtualizes rows using react-window VariableSizeList
 * - Supports variable height rows via ResizeObserver measurements
 * - Scrolls to bottom on initial load and when new messages arrive
 * - Optimized to prevent cascading renders
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
  const isInitialLoadRef = useRef(true);
  const prevItemsLengthRef = useRef(0);
  const userScrolledUpRef = useRef(false);
  const sizeMapRef = useRef(new Map());

  // Stable item key for detecting chat changes
  const firstItemKey = items?.[0]?.id ?? items?.[0]?.type;
  const prevFirstItemKeyRef = useRef(firstItemKey);

  // Reset state when chat changes - use useEffect to avoid render-time ref updates
  useEffect(() => {
    if (prevFirstItemKeyRef.current !== firstItemKey) {
      prevFirstItemKeyRef.current = firstItemKey;
      isInitialLoadRef.current = true;
      userScrolledUpRef.current = false;
      sizeMapRef.current.clear();
      prevItemsLengthRef.current = 0;
    }
  }, [firstItemKey]);

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

  const isNearBottom = useCallback(() => {
    const el = outerRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance < 300;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (listRef.current && items.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToItem(items.length - 1, "end");
      });
    }
  }, [items.length]);

  // Handle initial load - scroll to bottom once
  useEffect(() => {
    if (items?.length > 0 && isInitialLoadRef.current) {
      sizeMapRef.current.clear();
      listRef.current?.resetAfterIndex(0);
      
      const timer = setTimeout(() => {
        scrollToBottom();
        isInitialLoadRef.current = false;
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [items?.length, scrollToBottom]);

  // Handle new messages - scroll to bottom only if user was near bottom
  useEffect(() => {
    if (isInitialLoadRef.current || !items?.length) return;
    
    const prevLength = prevItemsLengthRef.current;
    const newLength = items.length;
    
    if (newLength > prevLength && !userScrolledUpRef.current) {
      scrollToBottom();
    }
    
    prevItemsLengthRef.current = newLength;
  }, [items?.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    
    userScrolledUpRef.current = !isNearBottom();
    
    if (el.scrollTop < 140 && !isLoadingMore) {
      onReachTop?.();
    }
  }, [isLoadingMore, onReachTop, isNearBottom]);

  // Memoize the Row component to prevent unnecessary re-renders
  const Row = useMemo(() => {
    return ({ index, style }) => {
      const item = items[index];
      return (
        <div style={style}>
          <MeasuredRow index={index} setSize={setSize}>
            {renderItem(item)}
          </MeasuredRow>
        </div>
      );
    };
  }, [items, setSize, renderItem]);

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

// Memoized MeasuredRow to prevent re-renders
const MeasuredRow = React.memo(({ index, setSize, children }) => {
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    let rafId = null;
    const measure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const h = el.getBoundingClientRect().height;
        if (h && h > 0) setSize(index, h);
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [index, setSize]);

  return <div ref={rowRef}>{children}</div>;
});

export default VirtualizedMessageList;
