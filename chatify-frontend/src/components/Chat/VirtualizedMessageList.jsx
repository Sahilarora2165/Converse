import React, { useEffect, useRef, useCallback } from "react";
import { VariableSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

/**
 * VirtualizedMessageList
 *
 * - Virtualizes rows using react-window VariableSizeList
 * - Supports variable height rows via ResizeObserver measurements
 * - Keeps "scroll to bottom" behavior when new items arrive (only if user is near bottom)
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

  const isNearBottom = useCallback(() => {
    const el = outerRef.current;
    if (!el) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance < 260;
  }, []);

  // auto-scroll to bottom only if user is already near bottom
  useEffect(() => {
    if (!items?.length) return;
    if (!isNearBottom()) return;
    listRef.current?.scrollToItem(items.length - 1, "end");
  }, [items, isNearBottom]);

  const handleScroll = () => {
    const el = outerRef.current;
    if (!el) return;
    if (el.scrollTop < 140 && !isLoadingMore) {
      onReachTop?.();
    }
  };

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