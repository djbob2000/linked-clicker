/**
 * Error handling utilities for LinkedIn automation
 * Implements comprehensive error handling and recovery mechanisms
 * Requirements: 1.6, 2.4, 3.7
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

export class AutomationError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    recoverable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.recoverable = recoverable;
    this.context = context;
  }
}

export class LoginError extends AutomationError {
  constructor(
    message: string,
    recoverable: boolean = false,
    context?: Record<string, any>
  ) {
    super(message, 'LOGIN_ERROR', recoverable, context);
    this.name = 'LoginError';
  }
}

export class NavigationError extends AutomationError {
  constructor(
    message: string,
    recoverable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, 'NAVIGATION_ERROR', recoverable, context);
    this.name = 'NavigationError';
  }
}

export class ConnectionError extends AutomationError {
  constructor(
    message: string,
    recoverable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, 'CONNECTION_ERROR', recoverable, context);
    this.name = 'ConnectionError';
  }
}

export class BrowserError extends AutomationError {
  constructor(
    message: string,
    recoverable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message, 'BROWSER_ERROR', recoverable, context);
    this.name = 'BrowserError';
  }
}

export class ConfigurationError extends AutomationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', false, context);
    this.name = 'ConfigurationError';
  }
}

/**
 * Retry utility with exponential backoff
 * Implements retry logic for transient failures
 */
export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      // Default: retry for recoverable automation errors and network-related errors
      if (error instanceof AutomationError) {
        return error.recoverable;
      }

      // Retry for common transient errors
      const retryableMessages = [
        'timeout',
        'network',
        'connection',
        'element not found',
        'page not loaded',
        'navigation failed',
      ];

      return retryableMessages.some((msg) =>
        error.message.toLowerCase().includes(msg)
      );
    },
  };

  /**
   * Execute a function with retry logic and exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;
    let delay = config.baseDelay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry this error
        if (!config.retryCondition!(lastError)) {
          return {
            success: false,
            error: lastError,
            attempts: attempt,
          };
        }

        // Don't wait after the last attempt
        if (attempt < config.maxAttempts) {
          console.warn(
            `Attempt ${attempt} failed, retrying in ${delay}ms:`,
            lastError.message
          );
          await this.sleep(delay);

          // Calculate next delay with exponential backoff
          delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: config.maxAttempts,
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000 // 1 minute
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new AutomationError(
          'Circuit breaker is open - too many recent failures',
          'CIRCUIT_BREAKER_OPEN',
          false
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}

/**
 * Resource cleanup manager for proper disposal
 */
export class ResourceManager {
  private resources: Array<() => Promise<void>> = [];
  private isCleaningUp: boolean = false;

  /**
   * Register a cleanup function
   */
  register(cleanup: () => Promise<void>): void {
    this.resources.push(cleanup);
  }

  /**
   * Execute all cleanup functions
   */
  async cleanup(): Promise<void> {
    if (this.isCleaningUp) {
      return;
    }

    this.isCleaningUp = true;
    const errors: Error[] = [];

    // Execute cleanup functions in reverse order (LIFO)
    for (const cleanup of this.resources.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.resources = [];
    this.isCleaningUp = false;

    if (errors.length > 0) {
      console.warn('Errors during cleanup:', errors);
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Check if cleanup is in progress
   */
  isCleaningUpResources(): boolean {
    return this.isCleaningUp;
  }
}

/**
 * Graceful degradation handler for partial failures
 */
export class GracefulDegradation {
  /**
   * Execute operation with graceful degradation
   * If operation fails, execute fallback
   */
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    condition?: (error: Error) => boolean
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      const shouldFallback = condition
        ? condition(error instanceof Error ? error : new Error(String(error)))
        : true;

      if (shouldFallback) {
        console.warn('Primary operation failed, using fallback:', error);
        return await fallback();
      }

      throw error;
    }
  }

  /**
   * Execute operation with partial success handling
   * Returns results and errors separately
   */
  static async withPartialSuccess<T>(
    operations: Array<() => Promise<T>>
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = [];
    const errors: Error[] = [];

    await Promise.allSettled(
      operations.map(async (operation, index) => {
        try {
          const result = await operation();
          results[index] = result;
        } catch (error) {
          errors[index] =
            error instanceof Error ? error : new Error(String(error));
        }
      })
    );

    return {
      results: results.filter((r) => r !== undefined),
      errors: errors.filter((e) => e !== undefined),
    };
  }
}

/**
 * Error context collector for debugging
 */
export class ErrorContext {
  private static context: Record<string, any> = {};

  static set(key: string, value: any): void {
    this.context[key] = value;
  }

  static get(key: string): any {
    return this.context[key];
  }

  static getAll(): Record<string, unknown> {
    return { ...this.context };
  }

  static clear(): void {
    this.context = {};
  }

  static createError(
    message: string,
    code: string,
    recoverable: boolean = true
  ): AutomationError {
    return new AutomationError(message, code, recoverable, this.getAll());
  }
}
