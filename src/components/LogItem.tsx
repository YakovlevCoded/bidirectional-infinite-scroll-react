import { useState, useCallback, useRef, useLayoutEffect, memo } from 'react';
import type { LogEvent } from '../types';
import { cn } from '../lib/utils';
import { ChevronRight } from 'lucide-react';

const levelStyles: Record<LogEvent['level'], string> = {
  error: 'bg-red-100 text-red-700 border-red-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  debug: 'bg-gray-100 text-gray-600 border-gray-200',
};

const levelDotStyles: Record<LogEvent['level'], string> = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-blue-500',
  debug: 'bg-gray-400',
};

// Cached formatters — Intl.DateTimeFormat construction is expensive
const timeFmt = new Intl.DateTimeFormat('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

interface LogItemProps {
  event: LogEvent;
  virtualIndex: number;
  measureRef: (node: HTMLDivElement | null) => void;
  start: number;
}

export const LogItem = memo(function LogItem({ event, virtualIndex, measureRef, start }: LogItemProps) {
  const [expanded, setExpanded] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const time = timeFmt.format(event.timestamp);
  const date = dateFmt.format(event.timestamp);

  // Only call measureElement when expanded state changes (not on every mount)
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      measureRef(node);
    },
    [measureRef],
  );

  useLayoutEffect(() => {
    if (nodeRef.current) measureRef(nodeRef.current);
  }, [expanded, measureRef]);

  return (
    <div
      ref={setRef}
      data-index={virtualIndex}
      className="absolute left-0 w-full px-2 sm:px-3 py-0.5"
      style={{
        transform: `translateY(${start}px)`,
        contain: 'layout style',
        willChange: 'transform',
      }}
    >
      <div
        className={cn(
          'rounded-lg border px-2 sm:px-3 py-2 overflow-hidden',
          'hover:bg-muted/50 cursor-pointer select-none',
          expanded && 'bg-muted/30'
        )}
        onClick={() => event.details && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 sm:gap-3 text-sm min-w-0">
          <span className="text-muted-foreground font-mono text-xs whitespace-nowrap shrink-0 hidden sm:inline">
            {date} {time}
          </span>
          <span className="text-muted-foreground font-mono text-xs whitespace-nowrap shrink-0 sm:hidden">
            {time}
          </span>

          <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-xs font-medium border shrink-0', levelStyles[event.level])}>
            <span className={cn('w-1.5 h-1.5 rounded-full', levelDotStyles[event.level])} />
            <span className="hidden sm:inline">{event.level.toUpperCase()}</span>
          </span>

          <span className="text-muted-foreground text-xs font-mono shrink-0 hidden md:inline">
            {event.service}
          </span>

          <span className="truncate text-foreground min-w-0">
            {event.message}
          </span>

          {event.details && (
            <ChevronRight
              className={cn(
                'w-4 h-4 shrink-0 text-muted-foreground ml-auto',
                expanded && 'rotate-90'
              )}
            />
          )}
        </div>

        {expanded && event.details && (
          <pre className="mt-2 p-3 rounded-md bg-gray-950 text-gray-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(event.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
});
