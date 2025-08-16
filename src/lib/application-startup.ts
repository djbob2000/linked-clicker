import { DIContainer } from './dependency-injection';
import { ConfigurationService, LoggingService } from '../services';

/**
 * Application health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
  timestamp: Date;
}

/**
 * Application startup and health management
 */
export class ApplicationStartup {
  private static initialized = false;
  private static initializationError: Error | null = null;

  /**
   * Initialize the application with all services
   */
  public static async initialize(): Promise<void> {
    if (ApplicationStartup.initialized) {
      return;
    }

    try {
      console.log('🚀 Starting LinkedIn Connection Automation...');

      // Load environment variables
      if (typeof window === 'undefined') {
        // Only load dotenv on server side
        const dotenv = await import('dotenv');
        dotenv.config();
      }

      // Initialize DI container and services
      const container = DIContainer.getInstance();
      await container.initializeServices();

      // Run health checks
      const healthCheck = await ApplicationStartup.performHealthCheck();
      if (healthCheck.status === 'unhealthy') {
        const failedChecks = healthCheck.checks
          .filter((check) => check.status === 'fail')
          .map((check) => `${check.name}: ${check.message}`)
          .join('\n');
        throw new Error(`Health check failed:\n${failedChecks}`);
      }

      ApplicationStartup.initialized = true;
      console.log('✅ Application initialized successfully');
    } catch (error) {
      ApplicationStartup.initializationError = error as Error;
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health checks
   */
  public static async performHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = [];
    const timestamp = new Date();

    try {
      // Check if DI container is initialized
      const container = DIContainer.getInstance();

      // Configuration health check
      try {
        const configService = container.get<ConfigurationService>(
          'configurationService'
        );
        const validation = configService.validateConfiguration();

        if (validation.isValid) {
          checks.push({
            name: 'Configuration',
            status: 'pass',
            message: 'All configuration values are valid',
          });
        } else {
          checks.push({
            name: 'Configuration',
            status: 'fail',
            message: validation.errors.join('; '),
          });
        }
      } catch (error) {
        checks.push({
          name: 'Configuration',
          status: 'fail',
          message: `Configuration service error: ${error}`,
        });
      }

      // Logging service health check
      try {
        const loggingService = container.get<LoggingService>('loggingService');
        loggingService.info('Health check: Logging service operational');
        checks.push({
          name: 'Logging',
          status: 'pass',
          message: 'Logging service is operational',
        });
      } catch (error) {
        checks.push({
          name: 'Logging',
          status: 'fail',
          message: `Logging service error: ${error}`,
        });
      }

      // Environment variables check
      const requiredEnvVars = ['LINKEDIN_USERNAME', 'LINKEDIN_PASSWORD'];
      const missingEnvVars = requiredEnvVars.filter(
        (varName) => !process.env[varName]
      );

      if (missingEnvVars.length === 0) {
        checks.push({
          name: 'Environment Variables',
          status: 'pass',
          message: 'All required environment variables are present',
        });
      } else {
        checks.push({
          name: 'Environment Variables',
          status: 'fail',
          message: `Missing required environment variables: ${missingEnvVars.join(
            ', '
          )}`,
        });
      }

      // Node.js version check
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      if (majorVersion >= 18) {
        checks.push({
          name: 'Node.js Version',
          status: 'pass',
          message: `Node.js ${nodeVersion} is supported`,
        });
      } else {
        checks.push({
          name: 'Node.js Version',
          status: 'fail',
          message: `Node.js ${nodeVersion} is not supported. Minimum version: 18.x`,
        });
      }
    } catch (error) {
      checks.push({
        name: 'System',
        status: 'fail',
        message: `System health check failed: ${error}`,
      });
    }

    const hasFailures = checks.some((check) => check.status === 'fail');

    return {
      status: hasFailures ? 'unhealthy' : 'healthy',
      checks,
      timestamp,
    };
  }

  /**
   * Get initialization status
   */
  public static isInitialized(): boolean {
    return ApplicationStartup.initialized;
  }

  /**
   * Get initialization error if any
   */
  public static getInitializationError(): Error | null {
    return ApplicationStartup.initializationError;
  }

  /**
   * Shutdown the application gracefully
   */
  public static async shutdown(): Promise<void> {
    if (!ApplicationStartup.initialized) {
      return;
    }

    try {
      console.log('🛑 Shutting down application...');

      const container = DIContainer.getInstance();
      await container.cleanup();

      ApplicationStartup.initialized = false;
      console.log('✅ Application shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Reset initialization state (useful for testing)
   */
  public static reset(): void {
    ApplicationStartup.initialized = false;
    ApplicationStartup.initializationError = null;
    DIContainer.getInstance().clear();
  }
}

/**
 * Graceful shutdown handler for process signals
 */
export function setupGracefulShutdown(): void {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n📡 Received ${signal}, shutting down gracefully...`);

      try {
        await ApplicationStartup.shutdown();
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);

    try {
      await ApplicationStartup.shutdown();
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError);
    }

    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);

    try {
      await ApplicationStartup.shutdown();
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError);
    }

    process.exit(1);
  });
}
