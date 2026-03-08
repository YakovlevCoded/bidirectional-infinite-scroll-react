import { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LogEvent } from '../types';
import { LogItem } from './LogItem';
import { Loader2 } from 'lucide-react';

interface LogListProps {
  events: LogEvent[];
  loadEarlier: () => void;
  loadLater: () => void;
  loadingEarlier: boolean;
  loadingLater: boolean;
  prependCountRef: React.MutableRefObject<number>;
  onVisibleDateChange: (date: string) => void;
  scrollToIndex: number | null;
  onScrollToComplete: () => void;
}

export function LogList({
  events,
  loadEarlier,
  loadLater,
  loadingEarlier,
  loadingLater,
  prependCountRef,
  onVisibleDateChange,
  scrollToIndex,
  onScrollToComplete,
}: LogListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(events.length);
  const throttleRef = useRef(0);
  const suppressDateTrackingUntilRef = useRef(0);

  // Stable refs — so handleScroll never needs to be recreated
  const eventsRef = useRef(events);
  const loadingEarlierRef = useRef(loadingEarlier);
  const loadingLaterRef = useRef(loadingLater);
  const loadEarlierRef = useRef(loadEarlier);
  const loadLaterRef = useRef(loadLater);
  const onVisibleDateChangeRef = useRef(onVisibleDateChange);

  eventsRef.current = events;
  loadingEarlierRef.current = loadingEarlier;
  loadingLaterRef.current = loadingLater;
  loadEarlierRef.current = loadEarlier;
  loadLaterRef.current = loadLater;
  onVisibleDateChangeRef.current = onVisibleDateChange;

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  // Scroll anchoring: when items are prepended, adjust scroll offset
  useEffect(() => {
    const prepended = prependCountRef.current;
    if (prepended > 0 && events.length > prevEventCountRef.current) {
      const currentOffset = virtualizer.scrollOffset ?? 0;
      const addedHeight = prepended * 44;
      virtualizer.scrollToOffset(currentOffset + addedHeight, { align: 'start' });
      prependCountRef.current = 0;
    }
    prevEventCountRef.current = events.length;
  }, [events.length, virtualizer, prependCountRef]);

  // Handle scroll-to from chart click
  useEffect(() => {
    if (scrollToIndex !== null && scrollToIndex >= 0 && scrollToIndex < events.length) {
      // Suppress date tracking for 600ms to prevent scroll handler from
      // overwriting activeDate during the programmatic scroll
      suppressDateTrackingUntilRef.current = Date.now() + 600;
      virtualizer.scrollToIndex(scrollToIndex, { align: 'start' });
      onScrollToComplete();
    }
  }, [scrollToIndex, virtualizer, events.length, onScrollToComplete]);

  // Stable scroll handler — never recreated, reads from refs
  const handleScroll = useCallback(() => {
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return;

    const ev = eventsRef.current;

    // Throttle date tracking + suppress during programmatic scroll
    const now = Date.now();
    if (now - throttleRef.current >= 150 && now > suppressDateTrackingUntilRef.current) {
      throttleRef.current = now;
      const midItem = items[Math.floor(items.length / 2)];
      if (midItem && ev[midItem.index]) {
        const ts = ev[midItem.index].timestamp;
        const date = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}`;
        onVisibleDateChangeRef.current(date);
      }
    }

    // Infinite scroll triggers
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    if (firstItem.index <= 5 && !loadingEarlierRef.current) {
      loadEarlierRef.current();
    }
    if (lastItem.index >= ev.length - 5 && !loadingLaterRef.current) {
      loadLaterRef.current();
    }
  }, [virtualizer]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col h-full">
      {loadingEarlier && (
        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground gap-2 shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading earlier logs...
        </div>
      )}

      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            contain: 'strict',
          }}
        >
          {virtualItems.map(virtualItem => (
            <LogItem
              key={events[virtualItem.index].id}
              event={events[virtualItem.index]}
              virtualIndex={virtualItem.index}
              measureRef={virtualizer.measureElement}
              start={virtualItem.start}
            />
          ))}
        </div>
      </div>

      {loadingLater && (
        <div className="flex items-center justify-center py-2 text-sm text-muted-foreground gap-2 shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading later logs...
        </div>
      )}
    </div>
  );
}
