import { LoggingService } from '../logging-service';
import {
  LogLevel,
  LogEntry,
  ProgressInfo,
  AutomationSummary,
} from '../../types/logging';

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Store original console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

describe('LoggingService', () => {
  let loggingService: LoggingService;

  beforeEach(() => {
    loggingService = new LoggingService();

    // Mock console methods
    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;

    // Clear mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Basic Logging Methods', () => {
    it('should log debug messages', () => {
      const message = 'Debug message';
      const context = { key: 'value' };

      loggingService.debug(message, context);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('debug');
      expect(logs[0].message).toBe(message);
      expect(logs[0].context).toEqual(context);
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      const message = 'Info message';
      const context = { key: 'value' };

      loggingService.info(message, context);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe(message);
      expect(logs[0].context).toEqual(context);
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const message = 'Warning message';
      const context = { key: 'value' };

      loggingService.warn(message, context);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe(message);
      expect(logs[0].context).toEqual(context);
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should log error messages with error objects', () => {
      const message = 'Error message';
      const error = new Error('Test error');
      const context = { key: 'value' };

      loggingService.error(message, error, context);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe(message);
      expect(logs[0].error).toBe(error);
      expect(logs[0].context).toEqual(context);
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('Action Logging (Requirement 5.1)', () => {
    it('should log actions with timestamps', () => {
      const action = 'Login to LinkedIn';
      const context = { username: 'test@example.com' };

      loggingService.logAction(action, context);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe(`Action: ${action}`);
      expect(logs[0].context).toEqual(context);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should log multiple actions in sequence', () => {
      loggingService.logAction('Navigate to LinkedIn');
      loggingService.logAction('Click sign in button');
      loggingService.logAction('Enter credentials');

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Action: Navigate to LinkedIn');
      expect(logs[1].message).toBe('Action: Click sign in button');
      expect(logs[2].message).toBe('Action: Enter credentials');
    });
  });

  describe('Progress Tracking (Requirement 5.2)', () => {
    it('should log progress information with connection counts', () => {
      const progress: ProgressInfo = {
        connectionsProcessed: 10,
        connectionsSuccessful: 8,
        maxConnections: 50,
        remainingConnections: 40,
        percentComplete: 20.0,
      };

      loggingService.logProgress(progress);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain('Progress: 8/10 successful');
      expect(logs[0].message).toContain('40 remaining');
      expect(logs[0].message).toContain('20.0% complete');
      expect(logs[0].context).toEqual(progress);
    });

    it('should format progress percentages correctly', () => {
      const progress: ProgressInfo = {
        connectionsProcessed: 33,
        connectionsSuccessful: 30,
        maxConnections: 100,
        remainingConnections: 67,
        percentComplete: 33.333,
      };

      loggingService.logProgress(progress);

      const logs = loggingService.getLogs();
      expect(logs[0].message).toContain('33.3% complete');
    });
  });

  describe('Detailed Error Logging (Requirement 5.3)', () => {
    it('should log detailed error information', () => {
      const message = 'Failed to click connect button';
      const error = new Error('Element not found');
      error.stack = 'Error stack trace';
      const context = { selector: '.connect-button', timeout: 5000 };

      loggingService.logDetailedError(message, error, context);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe(`Detailed Error: ${message}`);
      expect(logs[0].error).toBe(error);
      expect(logs[0].context).toMatchObject({
        ...context,
        errorName: 'Error',
        errorMessage: 'Element not found',
        errorStack: 'Error stack trace',
        timestamp: expect.any(String),
      });
    });

    it('should include timestamp in error context', () => {
      const error = new Error('Test error');

      loggingService.logDetailedError('Test message', error);

      const logs = loggingService.getLogs();
      expect(logs[0].context?.timestamp).toBeDefined();
      expect(typeof logs[0].context?.timestamp).toBe('string');
    });
  });

  describe('Automation Summary (Requirement 5.4)', () => {
    it('should log completion summary with statistics', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const summary: AutomationSummary = {
        startTime,
        endTime,
        duration: 1800000, // 30 minutes in milliseconds
        totalConnectionsProcessed: 50,
        successfulConnections: 45,
        failedConnections: 5,
        successRate: 90.0,
        errors: ['Connection timeout', 'Rate limit exceeded'],
      };

      loggingService.logSummary(summary);

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain(
        'Automation Complete: 45/50 connections successful'
      );
      expect(logs[0].message).toContain('90.0%');
      expect(logs[0].message).toContain('30.00 minutes');
      expect(logs[0].context).toMatchObject({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: 1800000,
        totalConnectionsProcessed: 50,
        successfulConnections: 45,
        failedConnections: 5,
        successRate: 90.0,
        errors: ['Connection timeout', 'Rate limit exceeded'],
      });
    });

    it('should format duration correctly for different time periods', () => {
      const summary: AutomationSummary = {
        startTime: new Date(),
        endTime: new Date(),
        duration: 90000, // 1.5 minutes
        totalConnectionsProcessed: 10,
        successfulConnections: 10,
        failedConnections: 0,
        successRate: 100.0,
        errors: [],
      };

      loggingService.logSummary(summary);

      const logs = loggingService.getLogs();
      expect(logs[0].message).toContain('1.50 minutes');
    });
  });

  describe('Log Management', () => {
    it('should maintain maximum log entries', () => {
      loggingService.setMaxLogEntries(3);

      loggingService.info('Message 1');
      loggingService.info('Message 2');
      loggingService.info('Message 3');
      loggingService.info('Message 4');

      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Message 2');
      expect(logs[1].message).toBe('Message 3');
      expect(logs[2].message).toBe('Message 4');
    });

    it('should filter logs by level', () => {
      loggingService.info('Info message');
      loggingService.warn('Warning message');
      loggingService.error('Error message');

      const errorLogs = loggingService.getLogsByLevel('error');
      const warnLogs = loggingService.getLogsByLevel('warn');

      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error message');
      expect(warnLogs).toHaveLength(1);
      expect(warnLogs[0].message).toBe('Warning message');
    });

    it('should get recent logs', () => {
      for (let i = 1; i <= 10; i++) {
        loggingService.info(`Message ${i}`);
      }

      const recentLogs = loggingService.getRecentLogs(3);
      expect(recentLogs).toHaveLength(3);
      expect(recentLogs[0].message).toBe('Message 8');
      expect(recentLogs[1].message).toBe('Message 9');
      expect(recentLogs[2].message).toBe('Message 10');
    });

    it('should clear all logs', () => {
      loggingService.info('Message 1');
      loggingService.info('Message 2');

      expect(loggingService.getLogs()).toHaveLength(2);

      loggingService.clearLogs();

      // Should have 1 log (the "Logs cleared" message)
      const logs = loggingService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Logs cleared');
    });

    it('should get error logs for troubleshooting', () => {
      loggingService.info('Info message');
      loggingService.error('Error 1');
      loggingService.warn('Warning message');
      loggingService.error('Error 2');

      const errors = loggingService.getErrors();
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Error 1');
      expect(errors[1].message).toBe('Error 2');
    });

    it('should check if there are errors', () => {
      expect(loggingService.hasErrors()).toBe(false);

      loggingService.info('Info message');
      expect(loggingService.hasErrors()).toBe(false);

      loggingService.error('Error message');
      expect(loggingService.hasErrors()).toBe(true);
    });
  });

  describe('Real-time Monitoring', () => {
    it('should notify listeners of new log entries', () => {
      const listener = jest.fn();
      const unsubscribe = loggingService.onLogEntry(listener);

      loggingService.info('Test message');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
        })
      );

      unsubscribe();
      loggingService.info('Another message');

      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const faultyListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      loggingService.onLogEntry(faultyListener);
      loggingService.onLogEntry(goodListener);

      // Should not throw error and should still call good listener
      expect(() => {
        loggingService.info('Test message');
      }).not.toThrow();

      expect(faultyListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      loggingService.onLogEntry(listener1);
      loggingService.onLogEntry(listener2);

      loggingService.info('Test message');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Console Output Formatting', () => {
    it('should format console output with timestamps and levels', () => {
      loggingService.info('Test message', { key: 'value' });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO  Test message$/
        ),
        { key: 'value' }
      );
    });

    it('should use appropriate console methods for different log levels', () => {
      loggingService.debug('Debug message');
      loggingService.info('Info message');
      loggingService.warn('Warning message');
      loggingService.error('Error message');

      expect(mockConsole.debug).toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });
});
