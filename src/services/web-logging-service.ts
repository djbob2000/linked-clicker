import { LoggingService } from './logging-service';
import { LogEntry } from '../types/logging';

/**
 * Web-integrated logging service that extends the base logging service
 * to send logs to the web interface via API
 */
export class WebLoggingService extends LoggingService {
  private isClient: boolean;

  constructor() {
    super();
    this.isClient = typeof window !== 'undefined';

    // Set up listener to send logs to API
    this.onLogEntry((entry) => {
      this.sendLogToAPI(entry);
    });
  }

  /**
   * Send log entry to the API for web interface display
   */
  private async sendLogToAPI(entry: LogEntry): Promise<void> {
    // Only send logs from server-side or when running in Node.js environment
    if (this.isClient) {
      return;
    }

    try {
      // Import the log streaming utility
      const { broadcastLog } = await import('../lib/log-streaming');

      // Broadcast to connected clients
      broadcastLog(entry);
    } catch (error) {
      // Fallback to console if API is not available
      console.error('Failed to send log to API:', error);
    }
  }
}

// Global instance for use across the application
let globalWebLoggingService: WebLoggingService | null = null;

export function getWebLoggingService(): WebLoggingService {
  if (!globalWebLoggingService) {
    globalWebLoggingService = new WebLoggingService();
  }
  return globalWebLoggingService;
}
