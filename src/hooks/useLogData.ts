import { useState, useCallback, useRef, useMemo } from 'react';
import type { LogEvent, DayData } from '../types';

const SERVICES = ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'notification-service', 'scheduler'];
const LEVELS: LogEvent['level'][] = ['info', 'warn', 'error', 'debug'];
const LEVEL_WEIGHTS = [50, 20, 10, 20]; // probability weights

const MESSAGES: Record<LogEvent['level'], string[]> = {
  info: [
    'Request processed successfully',
    'User session started',
    'Cache refreshed',
    'Health check passed',
    'Configuration reloaded',
    'Database connection pool initialized',
    'Scheduled task completed',
    'Metrics exported',
  ],
  warn: [
    'Response time exceeded threshold (>2s)',
    'Rate limit approaching for client',
    'Disk usage above 80%',
    'Deprecated API endpoint called',
    'Certificate expires in 7 days',
    'Memory usage above 75%',
  ],
  error: [
    'Connection timeout to downstream service',
    'Failed to process payment',
    'Authentication token expired',
    'Database query failed: deadlock detected',
    'Unhandled exception in request handler',
    'Circuit breaker opened',
  ],
  debug: [
    'Entering request middleware',
    'Cache miss for key',
    'SQL query executed in 45ms',
    'WebSocket connection established',
    'Retry attempt 2/3',
    'Serializing response payload',
  ],
};

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDetails(level: LogEvent['level'], service: string): Record<string, unknown> | undefined {
  if (Math.random() > 0.4) return undefined;
  const base: Record<string, unknown> = {
    traceId: crypto.randomUUID().slice(0, 8),
    service,
    host: `${service}-${Math.floor(Math.random() * 5) + 1}.prod.internal`,
  };
  if (level === 'error') {
    base.statusCode = pick([500, 502, 503, 504]);
    base.stack = `Error: ${pick(MESSAGES.error)}\n    at processRequest (${service}/handler.ts:${Math.floor(Math.random() * 200)})\n    at Router.dispatch (router.ts:42)`;
  }
  if (level === 'warn') {
    base.metric = pick(['cpu_percent', 'memory_mb', 'disk_percent', 'latency_ms']);
    base.value = Math.floor(Math.random() * 100);
    base.threshold = 80;
  }
  if (level === 'info') {
    base.duration_ms = Math.floor(Math.random() * 500);
    base.requestId = crypto.randomUUID().slice(0, 12);
  }
  return base;
}

function generateEventsForDay(dateStr: string): LogEvent[] {
  const count = 10 + Math.floor(Math.random() * 41); // 10-50
  const events: LogEvent[] = [];
  const date = new Date(dateStr + 'T00:00:00');

  for (let i = 0; i < count; i++) {
    const level = pickWeighted(LEVELS, LEVEL_WEIGHTS);
    const service = pick(SERVICES);
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    const ts = new Date(date);
    ts.setHours(hour, minute, second, Math.floor(Math.random() * 1000));

    events.push({
      id: `${dateStr}-${i}-${crypto.randomUUID().slice(0, 6)}`,
      timestamp: ts,
      level,
      service,
      message: pick(MESSAGES[level]),
      details: generateDetails(level, service),
    });
  }

  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return events;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateDays(startDate: Date, count: number): DayData[] {
  const days: DayData[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);
    days.push({ date: dateStr, events: generateEventsForDay(dateStr) });
  }
  return days;
}

export function useLogData() {
  const [days, setDays] = useState<DayData[]>(() => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return generateDays(start, 30);
  });

  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadingLater, setLoadingLater] = useState(false);
  const prependCountRef = useRef(0);

  const loadEarlier = useCallback(() => {
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    setTimeout(() => {
      setDays(prev => {
        const earliest = new Date(prev[0].date);
        earliest.setDate(earliest.getDate() - 15);
        const newDays = generateDays(earliest, 15);
        prependCountRef.current = newDays.reduce((sum, d) => sum + d.events.length, 0);
        return [...newDays, ...prev];
      });
      setLoadingEarlier(false);
    }, 500);
  }, [loadingEarlier]);

  const loadLater = useCallback(() => {
    if (loadingLater) return;
    setLoadingLater(true);
    setTimeout(() => {
      setDays(prev => {
        const latest = new Date(prev[prev.length - 1].date);
        latest.setDate(latest.getDate() + 1);
        const newDays = generateDays(latest, 15);
        return [...prev, ...newDays];
      });
      setLoadingLater(false);
    }, 500);
  }, [loadingLater]);

  const allEvents = useMemo(() => days.flatMap(d => d.events), [days]);

  // Pre-computed map: date string → index of first event for that date
  const dayStartIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < allEvents.length; i++) {
      const date = formatDate(allEvents[i].timestamp);
      if (!map.has(date)) map.set(date, i);
    }
    return map;
  }, [allEvents]);

  return {
    days,
    allEvents,
    dayStartIndex,
    loadEarlier,
    loadLater,
    loadingEarlier,
    loadingLater,
    prependCountRef,
  };
}
