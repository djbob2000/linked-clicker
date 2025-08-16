import { LoggingService } from '../services/logging-service';
import {
  createProgressInfo,
  createAutomationSummary,
} from '../lib/logging-utils';

/**
 * Example demonstrating how to use the LoggingService
 * This shows all the logging capabilities required by the specifications
 */
export function demonstrateLoggingService(): void {
  const logger = new LoggingService();

  console.log('=== LinkedIn Connection Automation Logging Demo ===\n');

  // Requirement 5.1: Log actions with timestamps
  logger.logAction('Starting LinkedIn automation');
  logger.logAction('Navigating to LinkedIn home page', {
    url: 'https://www.linkedin.com/home',
  });
  logger.logAction('Clicking sign in button');
  logger.logAction('Entering credentials', { username: 'user@example.com' });

  // Basic logging methods
  logger.info('Successfully logged into LinkedIn');
  logger.debug('Browser session established', { sessionId: 'abc123' });

  // Requirement 5.2: Display connection counts and progress
  const progress1 = createProgressInfo(10, 8, 50);
  logger.logProgress(progress1);

  const progress2 = createProgressInfo(25, 22, 50);
  logger.logProgress(progress2);

  const progress3 = createProgressInfo(50, 45, 50);
  logger.logProgress(progress3);

  // Requirement 5.3: Log detailed error information
  try {
    throw new Error('Element not found: .connect-button');
  } catch (error) {
    logger.logDetailedError(
      'Failed to click connect button for user profile',
      error as Error,
      {
        selector: '.connect-button',
        timeout: 5000,
        userProfile: 'John Doe',
        mutualConnections: 15,
      }
    );
  }

  // More error examples
  logger.warn('Rate limit detected, pausing automation', {
    pauseDuration: 30000,
  });

  try {
    throw new Error('Network timeout');
  } catch (error) {
    logger.logDetailedError(
      'Network request failed during connection attempt',
      error as Error,
      {
        url: 'https://www.linkedin.com/mynetwork/grow/',
        method: 'POST',
        statusCode: 408,
      }
    );
  }

  // Requirement 5.4: Display completion summary
  const startTime = new Date(Date.now() - 1800000); // 30 minutes ago
  const endTime = new Date();
  const summary = createAutomationSummary(startTime, endTime, 50, 45, [
    'Connection timeout',
    'Rate limit exceeded',
    'Element not found',
  ]);
  logger.logSummary(summary);

  // Demonstrate real-time monitoring
  console.log('\n=== Real-time Monitoring Demo ===');

  const unsubscribe = logger.onLogEntry((entry) => {
    console.log(`[LISTENER] ${entry.level.toUpperCase()}: ${entry.message}`);
  });

  logger.info('This message will trigger the listener');
  logger.warn('This warning will also trigger the listener');

  unsubscribe();
  logger.info('This message will NOT trigger the listener (unsubscribed)');

  // Demonstrate log management
  console.log('\n=== Log Management Demo ===');

  console.log(`Total logs: ${logger.getLogs().length}`);
  console.log(`Error logs: ${logger.getErrors().length}`);
  console.log(`Has errors: ${logger.hasErrors()}`);

  const recentLogs = logger.getRecentLogs(5);
  console.log(`Recent logs (last 5):`);
  recentLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. [${log.level.toUpperCase()}] ${log.message}`);
  });

  // Demonstrate filtering
  const errorLogs = logger.getLogsByLevel('error');
  console.log(`\nError logs found: ${errorLogs.length}`);
  errorLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. ${log.message}`);
  });

  console.log('\n=== Logging Demo Complete ===');
}

/**
 * Example of integrating LoggingService with automation workflow
 */
export class AutomationWithLogging {
  private logger: LoggingService;
  private startTime?: Date;
  private connectionsProcessed = 0;
  private connectionsSuccessful = 0;
  private maxConnections = 100;
  private errors: string[] = [];

  constructor() {
    this.logger = new LoggingService();
  }

  async startAutomation(): Promise<void> {
    this.startTime = new Date();
    this.logger.logAction('Starting LinkedIn connection automation');

    try {
      await this.login();
      await this.navigateToNetworkGrowth();
      await this.processConnections();
      await this.completeAutomation();
    } catch (error) {
      this.logger.logDetailedError(
        'Automation failed with critical error',
        error as Error
      );
      throw error;
    }
  }

  private async login(): Promise<void> {
    this.logger.logAction('Logging into LinkedIn');

    // Simulate login process
    await this.delay(1000);

    this.logger.info('Successfully logged into LinkedIn');
  }

  private async navigateToNetworkGrowth(): Promise<void> {
    this.logger.logAction('Navigating to network growth page');

    // Simulate navigation
    await this.delay(500);

    this.logger.info('Arrived at network growth page');
  }

  private async processConnections(): Promise<void> {
    this.logger.logAction('Starting connection processing');

    for (let i = 0; i < this.maxConnections; i++) {
      try {
        await this.processConnection(i + 1);
        this.connectionsProcessed++;
        this.connectionsSuccessful++;

        // Log progress every 10 connections
        if (this.connectionsProcessed % 10 === 0) {
          const progress = createProgressInfo(
            this.connectionsProcessed,
            this.connectionsSuccessful,
            this.maxConnections
          );
          this.logger.logProgress(progress);
        }
      } catch (error) {
        this.connectionsProcessed++;
        const errorMessage = `Failed to connect with user ${i + 1}`;
        this.errors.push(errorMessage);

        this.logger.logDetailedError(errorMessage, error as Error, {
          userIndex: i + 1,
        });
      }

      // Simulate delay between connections
      await this.delay(100);
    }
  }

  private async processConnection(userIndex: number): Promise<void> {
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      // 10% failure rate
      throw new Error(`Connection failed for user ${userIndex}`);
    }

    this.logger.debug(`Successfully connected with user ${userIndex}`);
  }

  private async completeAutomation(): Promise<void> {
    if (!this.startTime) {
      throw new Error('Start time not set');
    }

    const endTime = new Date();
    const summary = createAutomationSummary(
      this.startTime,
      endTime,
      this.connectionsProcessed,
      this.connectionsSuccessful,
      this.errors
    );

    this.logger.logSummary(summary);
    this.logger.logAction('LinkedIn connection automation completed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getLogger(): LoggingService {
    return this.logger;
  }
}

// Example usage
if (require.main === module) {
  demonstrateLoggingService();

  console.log('\n' + '='.repeat(50));
  console.log('Running automation with logging example...\n');

  const automation = new AutomationWithLogging();
  automation.startAutomation().catch(console.error);
}
