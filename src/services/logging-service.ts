import {
  LogLevel,
  LogEntry,
  ProgressInfo,
  AutomationSummary,
} from '../types/logging';

export class LoggingService {
  private logs: LogEntry[] = [];
  private maxLogEntries: number = 1000; // Prevent memory issues
  private listeners: ((entry: LogEntry) => void)[] = [];

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  }

  /**
   * Log an automation action with timestamp
   * Requirement 5.1: Log actions with timestamps
   */
  logAction(action: string, context?: Record<string, any>): void {
    this.info(`Action: ${action}`, context);
  }

  /**
   * Log progress information for connection tracking
   * Requirement 5.2: Display connection counts and progress
   */
  logProgress(progress: ProgressInfo): void {
    const message = `Progress: ${progress.connectionsSuccessful}/${
      progress.connectionsProcessed
    } successful, ${
      progress.remainingConnections
    } remaining (${progress.percentComplete.toFixed(1)}% complete)`;
    this.info(message, {
      connectionsProcessed: progress.connectionsProcessed,
      connectionsSuccessful: progress.connectionsSuccessful,
      maxConnections: progress.maxConnections,
      remainingConnections: progress.remainingConnections,
      percentComplete: progress.percentComplete,
    });
  }

  /**
   * Log detailed error information
   * Requirement 5.3: Log detailed error information
   */
  logDetailedError(
    message: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const errorContext = {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    };

    this.error(`Detailed Error: ${message}`, error, errorContext);
  }

  /**
   * Log automation completion summary
   * Requirement 5.4: Display completion summary
   */
  logSummary(summary: AutomationSummary): void {
    const durationMinutes = (summary.duration / 1000 / 60).toFixed(2);
    const message = `Automation Complete: ${summary.successfulConnections}/${
      summary.totalConnectionsProcessed
    } connections successful (${summary.successRate.toFixed(
      1
    )}%) in ${durationMinutes} minutes`;

    this.info(message, {
      startTime: summary.startTime.toISOString(),
      endTime: summary.endTime.toISOString(),
      duration: summary.duration,
      totalConnectionsProcessed: summary.totalConnectionsProcessed,
      successfulConnections: summary.successfulConnections,
      failedConnections: summary.failedConnections,
      successRate: summary.successRate,
      errors: summary.errors,
    });
  }

  /**
   * Core logging method with structured logging capabilities
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    // Add to internal log storage
    this.logs.push(entry);

    // Maintain max log entries to prevent memory issues
    if (this.logs.length > this.maxLogEntries) {
      this.logs.shift();
    }

    // Console output with formatting
    this.outputToConsole(entry);

    // Notify listeners for real-time updates
    this.notifyListeners(entry);
  }

  /**
   * Format and output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const baseMessage = `[${timestamp}] ${level} ${entry.message}`;

    // Console output based on log level
    switch (entry.level) {
      case 'debug':
        console.debug(baseMessage, entry.context || '');
        break;
      case 'info':
        console.info(baseMessage, entry.context || '');
        break;
      case 'warn':
        console.warn(baseMessage, entry.context || '');
        break;
      case 'error':
        console.error(baseMessage, entry.error || '', entry.context || '');
        break;
    }
  }

  /**
   * Notify all registered listeners of new log entries
   */
  private notifyListeners(entry: LogEntry): void {
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    });
  }

  /**
   * Subscribe to log entries for real-time monitoring
   */
  onLogEntry(callback: (entry: LogEntry) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get all log entries
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get recent logs (last n entries)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.info('Logs cleared');
  }

  /**
   * Get error logs for troubleshooting
   */
  getErrors(): LogEntry[] {
    return this.getLogsByLevel('error');
  }

  /**
   * Check if there are any errors in the logs
   */
  hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

  /**
   * Set maximum number of log entries to keep in memory
   */
  setMaxLogEntries(max: number): void {
    this.maxLogEntries = max;

    // Trim existing logs if necessary
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }
}
