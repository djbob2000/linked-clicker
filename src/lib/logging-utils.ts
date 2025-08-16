import { ProgressInfo, AutomationSummary } from '../types/logging';

/**
 * Create progress information for logging
 */
export function createProgressInfo(
  connectionsProcessed: number,
  connectionsSuccessful: number,
  maxConnections: number
): ProgressInfo {
  const remainingConnections = maxConnections - connectionsProcessed;
  const percentComplete =
    maxConnections > 0 ? (connectionsProcessed / maxConnections) * 100 : 0;

  return {
    connectionsProcessed,
    connectionsSuccessful,
    maxConnections,
    remainingConnections: Math.max(0, remainingConnections),
    percentComplete: Math.min(100, Math.max(0, percentComplete)),
  };
}

/**
 * Create automation summary for logging
 */
export function createAutomationSummary(
  startTime: Date,
  endTime: Date,
  totalConnectionsProcessed: number,
  successfulConnections: number,
  errors: string[] = []
): AutomationSummary {
  const duration = endTime.getTime() - startTime.getTime();
  const failedConnections = totalConnectionsProcessed - successfulConnections;
  const successRate =
    totalConnectionsProcessed > 0
      ? (successfulConnections / totalConnectionsProcessed) * 100
      : 0;

  return {
    startTime,
    endTime,
    duration,
    totalConnectionsProcessed,
    successfulConnections,
    failedConnections,
    successRate,
    errors,
  };
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format connection statistics for display
 */
export function formatConnectionStats(
  successful: number,
  total: number,
  successRate?: number
): string {
  const rate = successRate ?? (total > 0 ? (successful / total) * 100 : 0);
  return `${successful}/${total} (${rate.toFixed(1)}%)`;
}
