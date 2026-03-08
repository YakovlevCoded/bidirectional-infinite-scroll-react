export interface LogEvent {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface DayData {
  date: string; // YYYY-MM-DD
  events: LogEvent[];
}
