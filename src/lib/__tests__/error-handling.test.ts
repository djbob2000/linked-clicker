/**
 * Tests for error handling utilities
 * Verifies comprehensive error handling and recovery mechanisms
 */

import {
  AutomationError,
  LoginError,
  NavigationError,
  ConnectionError,
  BrowserError,
  ConfigurationError,
  RetryManager,
  CircuitBreaker,
  ResourceManager,
  GracefulDegradation,
  ErrorContext,
} from '../error-handling';

describe('Error Classes', () => {
  test('AutomationError should have correct properties', () => {
    const error = new AutomationError('Test message', 'TEST_CODE', true, {
      key: 'value',
    });

    expect(error.name).toBe('AutomationError');
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.recoverable).toBe(true);
    expect(error.context).toEqual({ key: 'value' });
  });

  test('LoginError should extend AutomationError', () => {
    const error = new LoginError('Login failed');

    expect(error).toBeInstanceOf(AutomationError);
    expect(error.name).toBe('LoginError');
    expect(error.code).toBe('LOGIN_ERROR');
    expect(error.recoverable).toBe(false); // Default for login errors
  });

  test('NavigationError should be recoverable by default', () => {
    const error = new NavigationError('Navigation failed');

    expect(error.recoverable).toBe(true);
    expect(error.code).toBe('NAVIGATION_ERROR');
  });

  test('ConfigurationError should not be recoverable', () => {
    const error = new ConfigurationError('Config invalid');

    expect(error.recoverable).toBe(false);
    expect(error.code).toBe('CONFIGURATION_ERROR');
  });
});

describe('RetryManager', () => {
  test('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await RetryManager.withRetry(operation);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should retry on recoverable errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new AutomationError('Timeout', 'TIMEOUT', true))
      .mockResolvedValue('success');

    const result = await RetryManager.withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 10, // Fast for testing
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('should not retry on non-recoverable errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(new AutomationError('Fatal', 'FATAL', false));

    const result = await RetryManager.withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should respect custom retry condition', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Custom error'));

    const result = await RetryManager.withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 10,
      retryCondition: (error) => error.message.includes('timeout'),
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should implement exponential backoff', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const startTime = Date.now();

    const result = await RetryManager.withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 100,
      backoffMultiplier: 2,
    });

    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(duration).toBeGreaterThan(300); // 100 + 200 + processing time
  });
});

describe('CircuitBreaker', () => {
  test('should allow operations when closed', async () => {
    const circuitBreaker = new CircuitBreaker(3, 1000);
    const operation = jest.fn().mockResolvedValue('success');

    const result = await circuitBreaker.execute(operation);

    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  test('should open after failure threshold', async () => {
    const circuitBreaker = new CircuitBreaker(2, 1000);
    const operation = jest.fn().mockRejectedValue(new Error('failure'));

    // First failure
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
    expect(circuitBreaker.getState()).toBe('closed');

    // Second failure - should open circuit
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
    expect(circuitBreaker.getState()).toBe('open');

    // Third attempt should be rejected immediately
    await expect(circuitBreaker.execute(operation)).rejects.toThrow(
      'Circuit breaker is open'
    );
    expect(operation).toHaveBeenCalledTimes(2); // Not called on third attempt
  });

  test('should reset on successful operation', async () => {
    const circuitBreaker = new CircuitBreaker(3, 1000);
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('failure'))
      .mockResolvedValue('success');

    // Failure
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');

    // Success - should reset failure count
    const result = await circuitBreaker.execute(operation);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });
});

describe('ResourceManager', () => {
  test('should execute cleanup functions in reverse order', async () => {
    const resourceManager = new ResourceManager();
    const cleanupOrder: number[] = [];

    resourceManager.register(async () => {
      cleanupOrder.push(1);
    });

    resourceManager.register(async () => {
      cleanupOrder.push(2);
    });

    resourceManager.register(async () => {
      cleanupOrder.push(3);
    });

    await resourceManager.cleanup();

    expect(cleanupOrder).toEqual([3, 2, 1]); // LIFO order
  });

  test('should handle cleanup errors gracefully', async () => {
    const resourceManager = new ResourceManager();
    const successfulCleanup = jest.fn();

    resourceManager.register(async () => {
      throw new Error('Cleanup failed');
    });

    resourceManager.register(successfulCleanup);

    // Should not throw despite cleanup error
    await expect(resourceManager.cleanup()).resolves.toBeUndefined();
    expect(successfulCleanup).toHaveBeenCalled();
  });

  test('should prevent concurrent cleanup', async () => {
    const resourceManager = new ResourceManager();
    const cleanup = jest.fn();

    resourceManager.register(cleanup);

    // Start two cleanup operations
    const cleanup1 = resourceManager.cleanup();
    const cleanup2 = resourceManager.cleanup();

    await Promise.all([cleanup1, cleanup2]);

    expect(cleanup).toHaveBeenCalledTimes(1); // Only called once
  });
});

describe('GracefulDegradation', () => {
  test('should use primary operation when successful', async () => {
    const primary = jest.fn().mockResolvedValue('primary');
    const fallback = jest.fn().mockResolvedValue('fallback');

    const result = await GracefulDegradation.withFallback(primary, fallback);

    expect(result).toBe('primary');
    expect(primary).toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  test('should use fallback when primary fails', async () => {
    const primary = jest.fn().mockRejectedValue(new Error('Primary failed'));
    const fallback = jest.fn().mockResolvedValue('fallback');

    const result = await GracefulDegradation.withFallback(primary, fallback);

    expect(result).toBe('fallback');
    expect(primary).toHaveBeenCalled();
    expect(fallback).toHaveBeenCalled();
  });

  test('should respect fallback condition', async () => {
    const primary = jest.fn().mockRejectedValue(new Error('Critical failure'));
    const fallback = jest.fn().mockResolvedValue('fallback');

    await expect(
      GracefulDegradation.withFallback(
        primary,
        fallback,
        (error) => !error.message.includes('Critical')
      )
    ).rejects.toThrow('Critical failure');

    expect(fallback).not.toHaveBeenCalled();
  });

  test('should handle partial success operations', async () => {
    const operations = [
      jest.fn().mockResolvedValue('success1'),
      jest.fn().mockRejectedValue(new Error('failure')),
      jest.fn().mockResolvedValue('success2'),
    ];

    const result = await GracefulDegradation.withPartialSuccess(operations);

    expect(result.results).toEqual(['success1', 'success2']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('failure');
  });
});

describe('ErrorContext', () => {
  beforeEach(() => {
    ErrorContext.clear();
  });

  test('should store and retrieve context', () => {
    ErrorContext.set('key1', 'value1');
    ErrorContext.set('key2', { nested: 'value' });

    expect(ErrorContext.get('key1')).toBe('value1');
    expect(ErrorContext.get('key2')).toEqual({ nested: 'value' });
  });

  test('should return all context', () => {
    ErrorContext.set('key1', 'value1');
    ErrorContext.set('key2', 'value2');

    const all = ErrorContext.getAll();

    expect(all).toEqual({
      key1: 'value1',
      key2: 'value2',
    });
  });

  test('should create error with context', () => {
    ErrorContext.set('operation', 'test');
    ErrorContext.set('timestamp', '2023-01-01');

    const error = ErrorContext.createError('Test error', 'TEST_CODE');

    expect(error.context).toEqual({
      operation: 'test',
      timestamp: '2023-01-01',
    });
  });

  test('should clear context', () => {
    ErrorContext.set('key', 'value');
    ErrorContext.clear();

    expect(ErrorContext.get('key')).toBeUndefined();
    expect(ErrorContext.getAll()).toEqual({});
  });
});
