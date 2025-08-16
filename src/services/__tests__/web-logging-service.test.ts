import {
  WebLoggingService,
  getWebLoggingService,
} from '../web-logging-service';
import { LogEntry, LogLevel } from '../../types/logging';

// Mock the API route modules
jest.mock('../../app/api/automation/logs/route', () => ({}));

jest.mock('../../app/api/automation/logs/stream/route', () => ({}));

describe('WebLoggingService', () => {
  let webLoggingService: WebLoggingService;
  let mockAddLog: jest.Mock = jest.fn();
  let mockBroadcastLog: jest.Mock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset the global instance
    (global as any).globalWebLoggingService = null;

    webLoggingService = new WebLoggingService();
  });

  describe('constructor', () => {
    it('should initialize with client detection', () => {
      expect(webLoggingService).toBeInstanceOf(WebLoggingService);
    });

    it('should set up log entry listener', () => {
      // Verify that logging works
      expect(() => webLoggingService.info('test message')).not.toThrow();
    });
  });

  describe('sendLogToAPI', () => {
    beforeEach(() => {
      // Mock server-side environment
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });
    });

    it('should send log entry to API when on server-side', async () => {
      const testMessage = 'Test log message';

      webLoggingService.info(testMessage);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAddLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: testMessage,
          timestamp: expect.any(Date),
        })
      );

      expect(mockBroadcastLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: testMessage,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should not send logs when on client-side', async () => {
      // Mock client-side environment
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });

      const clientWebLoggingService = new WebLoggingService();
      clientWebLoggingService.info('Client log message');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockAddLog).not.toHaveBeenCalled();
      expect(mockBroadcastLog).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockAddLog.mockRejectedValue(new Error('API Error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      webLoggingService.error('Test error message');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send log to API:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('logging methods', () => {
    it('should log debug messages', () => {
      const message = 'Debug message';
      const context = { userId: '123' };

      expect(() => webLoggingService.debug(message, context)).not.toThrow();
    });

    it('should log info messages', () => {
      const message = 'Info message';
      const context = { action: 'login' };

      expect(() => webLoggingService.info(message, context)).not.toThrow();
    });

    it('should log warning messages', () => {
      const message = 'Warning message';
      const context = { retryCount: 2 };

      expect(() => webLoggingService.warn(message, context)).not.toThrow();
    });

    it('should log error messages', () => {
      const message = 'Error message';
      const error = new Error('Test error');
      const context = { operation: 'connect' } as any as Error;

      expect(() =>
        webLoggingService.error(message, context, error)
      ).not.toThrow();
    });
  });
});

describe('getWebLoggingService', () => {
  beforeEach(() => {
    // Reset the global instance
    (global as any).globalWebLoggingService = null;
  });

  it('should return a singleton instance', () => {
    const instance1 = getWebLoggingService();
    const instance2 = getWebLoggingService();

    expect(instance1).toBe(instance2);
    expect(instance1).toBeInstanceOf(WebLoggingService);
  });

  it('should create new instance if none exists', () => {
    const instance = getWebLoggingService();
    expect(instance).toBeInstanceOf(WebLoggingService);
  });
});
