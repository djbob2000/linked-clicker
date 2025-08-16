export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export interface ProgressInfo {
  connectionsProcessed: number;
  connectionsSuccessful: number;
  maxConnections: number;
  remainingConnections: number;
  percentComplete: number;
}

export interface AutomationSummary {
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  totalConnectionsProcessed: number;
  successfulConnections: number;
  failedConnections: number;
  successRate: number; // percentage
  errors: string[];
}
