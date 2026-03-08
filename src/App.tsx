import { useState, useCallback, useMemo, memo } from 'react';
import { useLogData } from './hooks/useLogData';
import { LogList } from './components/LogList';
import { EventChart } from './components/EventChart';

const MemoizedChart = memo(EventChart);

function App() {
  const { days, allEvents, dayStartIndex, loadEarlier, loadLater, loadingEarlier, loadingLater, prependCountRef } = useLogData();
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [scrollToIndex, setScrollToIndex] = useState<number | null>(null);

  const handleVisibleDateChange = useCallback((date: string) => {
    setActiveDate(prev => prev === date ? prev : date);
  }, []);

  const handleDayClick = useCallback(
    (date: string) => {
      const idx = dayStartIndex.get(date);
      if (idx != null) {
        setActiveDate(date); // immediately highlight the clicked day
        setScrollToIndex(idx);
      }
    },
    [dayStartIndex],
  );

  const handleScrollToComplete = useCallback(() => {
    setScrollToIndex(null);
  }, []);

  const dateRange = useMemo(() => {
    if (days.length === 0) return '';
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const fmt = (s: string) =>
      new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    return `${fmt(first)} — ${fmt(last)}`;
  }, [days]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Log Viewer</h1>
          <p className="text-xs text-muted-foreground truncate">
            Bidirectional infinite scroll demo &middot; {allEvents.length.toLocaleString()} events &middot; {dateRange}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Info</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warn</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Error</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Debug</span>
        </div>
      </header>

      {/* Chart — ~30% */}
      <div className="h-[28vh] min-h-[160px] border-b px-4 sm:px-6 py-3 shrink-0">
        <MemoizedChart days={days} activeDate={activeDate} onDayClick={handleDayClick} />
      </div>

      {/* Log list — remaining space */}
      <div className="flex-1 min-h-0">
        <LogList
          events={allEvents}
          loadEarlier={loadEarlier}
          loadLater={loadLater}
          loadingEarlier={loadingEarlier}
          loadingLater={loadingLater}
          prependCountRef={prependCountRef}
          onVisibleDateChange={handleVisibleDateChange}
          scrollToIndex={scrollToIndex}
          onScrollToComplete={handleScrollToComplete}
        />
      </div>
    </div>
  );
}

export default App;
