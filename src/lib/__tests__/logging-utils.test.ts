import {
  createProgressInfo,
  createAutomationSummary,
  formatDuration,
  formatConnectionStats,
} from '../logging-utils';

describe('Logging Utils', () => {
  describe('createProgressInfo', () => {
    it('should create progress info with correct calculations', () => {
      const progress = createProgressInfo(25, 20, 100);

      expect(progress).toEqual({
        connectionsProcessed: 25,
        connectionsSuccessful: 20,
        maxConnections: 100,
        remainingConnections: 75,
        percentComplete: 25.0,
      });
    });

    it('should handle edge case with zero max connections', () => {
      const progress = createProgressInfo(5, 3, 0);

      expect(progress).toEqual({
        connectionsProcessed: 5,
        connectionsSuccessful: 3,
        maxConnections: 0,
        remainingConnections: 0,
        percentComplete: 0,
      });
    });

    it('should handle case where processed equals max connections', () => {
      const progress = createProgressInfo(50, 45, 50);

      expect(progress).toEqual({
        connectionsProcessed: 50,
        connectionsSuccessful: 45,
        maxConnections: 50,
        remainingConnections: 0,
        percentComplete: 100.0,
      });
    });

    it('should handle case where processed exceeds max connections', () => {
      const progress = createProgressInfo(60, 55, 50);

      expect(progress).toEqual({
        connectionsProcessed: 60,
        connectionsSuccessful: 55,
        maxConnections: 50,
        remainingConnections: 0,
        percentComplete: 100.0,
      });
    });

    it('should ensure remaining connections is never negative', () => {
      const progress = createProgressInfo(75, 70, 50);

      expect(progress.remainingConnections).toBe(0);
      expect(progress.percentComplete).toBe(100.0);
    });
  });

  describe('createAutomationSummary', () => {
    it('should create automation summary with correct calculations', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const errors = ['Connection timeout', 'Rate limit exceeded'];

      const summary = createAutomationSummary(
        startTime,
        endTime,
        50,
        45,
        errors
      );

      expect(summary).toEqual({
        startTime,
        endTime,
        duration: 1800000, // 30 minutes in milliseconds
        totalConnectionsProcessed: 50,
        successfulConnections: 45,
        failedConnections: 5,
        successRate: 90.0,
        errors,
      });
    });

    it('should handle perfect success rate', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:15:00Z');

      const summary = createAutomationSummary(startTime, endTime, 25, 25);

      expect(summary.successRate).toBe(100.0);
      expect(summary.failedConnections).toBe(0);
      expect(summary.errors).toEqual([]);
    });

    it('should handle zero connections processed', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:05:00Z');

      const summary = createAutomationSummary(startTime, endTime, 0, 0);

      expect(summary.successRate).toBe(0);
      expect(summary.failedConnections).toBe(0);
      expect(summary.duration).toBe(300000); // 5 minutes
    });

    it('should calculate duration correctly for different time spans', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T11:30:45Z');

      const summary = createAutomationSummary(startTime, endTime, 10, 8);

      expect(summary.duration).toBe(5445000); // 1 hour, 30 minutes, 45 seconds
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(30000)).toBe('30s');
      expect(formatDuration(59000)).toBe('59s');
    });

    it('should format minutes and seconds correctly', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(3540000)).toBe('59m 0s');
    });

    it('should format hours and minutes correctly', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3900000)).toBe('1h 5m');
      expect(formatDuration(7380000)).toBe('2h 3m');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should handle milliseconds less than a second', () => {
      expect(formatDuration(500)).toBe('0s');
      expect(formatDuration(999)).toBe('0s');
    });
  });

  describe('formatConnectionStats', () => {
    it('should format connection statistics with calculated success rate', () => {
      const result = formatConnectionStats(45, 50);
      expect(result).toBe('45/50 (90.0%)');
    });

    it('should format connection statistics with provided success rate', () => {
      const result = formatConnectionStats(45, 50, 85.5);
      expect(result).toBe('45/50 (85.5%)');
    });

    it('should handle perfect success rate', () => {
      const result = formatConnectionStats(25, 25);
      expect(result).toBe('25/25 (100.0%)');
    });

    it('should handle zero success rate', () => {
      const result = formatConnectionStats(0, 10);
      expect(result).toBe('0/10 (0.0%)');
    });

    it('should handle zero total connections', () => {
      const result = formatConnectionStats(0, 0);
      expect(result).toBe('0/0 (0.0%)');
    });

    it('should format decimal success rates correctly', () => {
      const result = formatConnectionStats(33, 100);
      expect(result).toBe('33/100 (33.0%)');
    });

    it('should round success rates to one decimal place', () => {
      const result = formatConnectionStats(1, 3); // 33.333...%
      expect(result).toBe('1/3 (33.3%)');
    });
  });
});
