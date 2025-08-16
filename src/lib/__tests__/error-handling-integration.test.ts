/**
 * Integration tests for error handling functionality
 * Verifies that error handling works correctly in practice
 */

import { AutomationError, RetryManager } from '../error-handling';

describe('Error Handling Integration', () => {
  test('should handle automation errors correctly', () => {
    const error = new AutomationError('Test error', 'TEST_CODE', true);

    expect(error.name).toBe('AutomationError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.recoverable).toBe(true);
  });

  test('should retry operations with exponential backoff', async () => {
    let attempts = 0;
    const operation = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    const result = await RetryManager.withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 10,
      backoffMultiplier: 2,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(attempts).toBe(3);
  });

  test('should handle non-recoverable errors', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(new AutomationError('Fatal error', 'FATAL', false));

    const result = await RetryManager.withRetry(operation, {
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
