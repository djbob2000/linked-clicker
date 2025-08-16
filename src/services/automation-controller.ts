import { BrowserService } from './browser-service';
import { ConfigurationService } from './configuration';
import { LoginHandler } from './login-handler';
import { NavigationHandler } from './navigation-handler';
import { ConnectionHandler } from './connection-handler';
import { AutomationStatus } from '../types/automation-status';
import { getWebLoggingService } from './web-logging-service';
import {
  AutomationError,
  RetryManager,
  ResourceManager,
  ErrorContext,
  GracefulDegradation,
} from '../lib/error-handling';

export interface AutomationControllerConfig {
  headless?: boolean;
  timeout?: number;
}

export interface AutomationResult {
  success: boolean;
  status: AutomationStatus;
  error?: string;
}

export class AutomationController {
  private browserService: BrowserService;
  private configService: ConfigurationService;
  private loginHandler: LoginHandler;
  private navigationHandler: NavigationHandler;
  private connectionHandler: ConnectionHandler;
  private logger = getWebLoggingService();
  private resourceManager: ResourceManager;

  private status: AutomationStatus;
  private statusCallbacks: ((status: AutomationStatus) => void)[] = [];
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(config: AutomationControllerConfig = {}) {
    // Initialize configuration service
    this.configService = new ConfigurationService();

    // Initialize browser service with configuration including persistent profile
    this.browserService = new BrowserService({
      headless: config.headless ?? this.configService.isHeadless(),
      timeout: config.timeout ?? this.configService.getTimeout(),
      userDataDir: process.env.USER_DATA_DIR,
      useExistingProfile: process.env.USE_EXISTING_PROFILE === 'true',
      chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH,
      chromeUserDataDir: process.env.CHROME_USER_DATA_DIR,
    });

    // Initialize handlers
    this.loginHandler = new LoginHandler(
      this.browserService,
      this.configService
    );
    this.navigationHandler = new NavigationHandler(this.browserService);
    this.connectionHandler = new ConnectionHandler(this.browserService);

    // Initialize resource manager for cleanup
    this.resourceManager = new ResourceManager();

    // Initialize status
    this.status = {
      isRunning: false,
      currentStep: 'idle',
      connectionsProcessed: 0,
      connectionsSuccessful: 0,
      maxConnections: this.configService.getMaxConnections(),
    };

    // Register cleanup handlers
    this.registerCleanupHandlers();
  }

  /**
   * Start the automation process
   * Requirements: 3.6, 3.7, 5.1, 5.2
   */
  async start(): Promise<AutomationResult> {
    try {
      // Validate configuration before starting
      this.configService.validateOrThrow();

      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if already running
      if (this.status.isRunning) {
        return {
          success: false,
          status: this.status,
          error: 'Automation is already running',
        };
      }

      // Start automation workflow
      await this.startAutomationWorkflow();

      return {
        success: true,
        status: this.status,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.updateStatus({
        isRunning: false,
        currentStep: 'error',
        lastError: errorMessage,
        endTime: new Date(),
      });

      return {
        success: false,
        status: this.status,
        error: errorMessage,
      };
    }
  }

  /**
   * Stop the automation process with proper cleanup
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return; // Already shutting down
    }

    this.isShuttingDown = true;

    try {
      this.logger.logAction('Stopping automation process');

      this.updateStatus({
        isRunning: false,
        currentStep: 'idle',
        endTime: new Date(),
      });

      // Always clean up resources
      await this.cleanup();

      this.logger.logAction('Automation process stopped successfully');
    } catch (error) {
      this.logger.error(
        'Error during automation stop',
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Get current automation status
   */
  getStatus(): AutomationStatus {
    return { ...this.status };
  }

  /**
   * Register callback for status changes
   * Requirement 5.1: Status tracking and monitoring
   */
  onStatusChange(callback: (status: AutomationStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Remove status change callback
   */
  removeStatusCallback(callback: (status: AutomationStatus) => void): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  /**
   * Initialize the automation controller
   */
  private async initialize(): Promise<void> {
    try {
      await this.browserService.initialize();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize automation controller: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Execute the complete automation workflow
   * Orchestrates login, navigation, and connection processing
   */
  private async startAutomationWorkflow(): Promise<void> {
    // Update status to running
    this.updateStatus({
      isRunning: true,
      currentStep: 'logging-in',
      startTime: new Date(),
      connectionsProcessed: 0,
      connectionsSuccessful: 0,
      maxConnections: this.configService.getMaxConnections(),
      lastError: undefined,
      endTime: undefined,
    });

    try {
      // Step 1: Login to LinkedIn
      await this.performLogin();

      // Step 2: Navigate to network growth section
      await this.performNavigation();

      // Step 3: Process connections
      await this.performConnectionProcessing();

      // Complete successfully
      this.updateStatus({
        isRunning: false,
        currentStep: 'completed',
        endTime: new Date(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown workflow error';

      this.updateStatus({
        isRunning: false,
        currentStep: 'error',
        lastError: errorMessage,
        endTime: new Date(),
      });

      throw error;
    }
  }

  /**
   * Perform LinkedIn login step with enhanced error handling
   * Requirement 5.1: Action logging with timestamps
   */
  private async performLogin(): Promise<void> {
    this.logger.logAction('Starting LinkedIn login');

    this.updateStatus({
      currentStep: 'logging-in',
    });

    const loginResult = await this.loginHandler.login();

    if (!loginResult.success) {
      const errorMessage = `Login failed: ${loginResult.error}`;
      this.logger.error(errorMessage);

      // Determine if error is recoverable
      const recoverable = loginResult.recoverable ?? true;

      throw new AutomationError(errorMessage, 'LOGIN_FAILED', recoverable, {
        loginResult,
      });
    }

    this.logger.logAction('LinkedIn login successful');
  }

  /**
   * Perform navigation to network growth section with enhanced error handling
   * Requirement 5.1: Action logging with timestamps
   */
  private async performNavigation(): Promise<void> {
    this.logger.logAction('Navigating to network growth section');

    this.updateStatus({
      currentStep: 'navigating',
    });

    try {
      // Log current page before navigation
      const currentUrl = this.browserService.getPage().url();
      this.logger.info(`Current page before navigation: ${currentUrl}`);

      const navigationResult =
        await this.navigationHandler.navigateToNetworkGrowth();

      if (!navigationResult.success) {
        const errorMessage = `Navigation failed: ${navigationResult.error}`;
        this.logger.error(errorMessage);

        // Log final page URL for debugging
        const finalUrl = this.browserService.getPage().url();
        this.logger.error(
          `Final page URL after failed navigation: ${finalUrl}`
        );

        // Determine if error is recoverable
        const recoverable = navigationResult.recoverable ?? true;

        throw new AutomationError(
          errorMessage,
          'NAVIGATION_FAILED',
          recoverable,
          { navigationResult, currentUrl, finalUrl }
        );
      }

      // Log successful navigation
      const finalUrl = this.browserService.getPage().url();
      this.logger.logAction(
        `Navigation to network growth successful. Final URL: ${finalUrl}`
      );
    } catch (error) {
      // Enhanced error logging
      const currentUrl = this.browserService.getPage().url();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown navigation error';

      const errorWithUrl = new Error(`Navigation error: ${errorMessage}`);
      (errorWithUrl as any).currentUrl = currentUrl;
      
      this.logger.error(`Navigation error: ${errorMessage}`, errorWithUrl);

      throw error;
    }
  }

  /**
   * Perform connection processing with enhanced error handling and graceful degradation
   * Requirements: 3.6, 3.7, 5.1, 5.2
   */
  private async performConnectionProcessing(): Promise<void> {
    this.logger.logAction('Starting connection processing');

    this.updateStatus({
      currentStep: 'processing-connections',
    });

    const minMutualConnections = this.configService.getMinMutualConnections();
    const maxConnections = this.configService.getMaxConnections();

    this.logger.info(
      `Processing with criteria: min ${minMutualConnections} mutual connections, max ${maxConnections} total connections`
    );

    // Use graceful degradation for connection processing
    const processingResult = await GracefulDegradation.withFallback(
      // Primary: Full connection processing
      async () => {
        return await this.connectionHandler.processConnections(
          minMutualConnections,
          maxConnections
        );
      },
      // Fallback: Partial processing with reduced expectations
      async () => {
        this.logger.warn(
          'Primary connection processing failed, attempting partial processing'
        );

        // Try with more lenient criteria
        return await this.connectionHandler.processConnections(
          Math.max(0, minMutualConnections - 1), // Reduce minimum by 1
          Math.min(maxConnections, 10) // Limit to 10 connections as fallback
        );
      },
      // Condition: fallback for processing errors but not critical failures
      (error) => {
        return (
          !error.message.includes('critical') &&
          !error.message.includes('no cards found')
        );
      }
    );

    if (!processingResult.success) {
      const errorMessage = `Connection processing failed: ${processingResult.error}`;
      this.logger.error(errorMessage);

      throw new AutomationError(
        errorMessage,
        'CONNECTION_PROCESSING_FAILED',
        true,
        { processingResult }
      );
    }

    // Log partial failures if any
    if (
      processingResult.partialFailures &&
      processingResult.partialFailures.length > 0
    ) {
      this.logger.warn(
        `Connection processing completed with ${processingResult.partialFailures.length} partial failures:`,
        {
          partialFailures: processingResult.partialFailures,
        }
      );
    }

    // Update final connection counts
    this.updateStatus({
      connectionsProcessed: processingResult.connectionsProcessed,
      connectionsSuccessful: processingResult.connectionsSuccessful,
    });

    // Requirement 5.2: Display summary of connections made
    this.logger.logProgress({
      connectionsProcessed: processingResult.connectionsProcessed,
      connectionsSuccessful: processingResult.connectionsSuccessful,
      maxConnections: maxConnections,
      remainingConnections:
        maxConnections - processingResult.connectionsSuccessful,
      percentComplete:
        (processingResult.connectionsSuccessful / maxConnections) * 100,
    });

    this.logger.logAction('Connection processing completed', {
      connectionsProcessed: processingResult.connectionsProcessed,
      connectionsSuccessful: processingResult.connectionsSuccessful,
      remainingConnections:
        maxConnections - processingResult.connectionsSuccessful,
      partialFailures: processingResult.partialFailures?.length || 0,
    });
  }

  /**
   * Update automation status and notify callbacks
   * Requirement 5.1: Status tracking and state management
   */
  private updateStatus(updates: Partial<AutomationStatus>): void {
    this.status = {
      ...this.status,
      ...updates,
    };

    // Requirement 5.2: Real-time status updates
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(this.getStatus());
      } catch (error) {
        console.warn('Error in status callback:', error);
      }
    });
  }

  /**
   * Clean up resources with comprehensive error handling
   * Implements proper cleanup and resource disposal as required
   */
  private async cleanup(): Promise<void> {
    try {
      this.logger.logAction('Starting resource cleanup');

      // Use resource manager for coordinated cleanup
      await this.resourceManager.cleanup();

      // Clean up browser service
      await this.browserService.cleanup();

      // Reset state
      this.isInitialized = false;
      ErrorContext.clear();

      this.logger.logAction('Resource cleanup completed');
    } catch (error) {
      this.logger.error(
        'Error during cleanup',
        error instanceof Error ? error : new Error(String(error))
      );
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Register cleanup handlers for proper resource disposal
   */
  private registerCleanupHandlers(): void {
    // Register browser cleanup
    this.resourceManager.register(async () => {
      await this.browserService.cleanup();
    });

    // Register status reset
    this.resourceManager.register(async () => {
      this.status = {
        isRunning: false,
        currentStep: 'idle',
        connectionsProcessed: 0,
        connectionsSuccessful: 0,
        maxConnections: this.configService.getMaxConnections(),
      };
    });

    // Handle process termination signals
    const handleShutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.stop();
      process.exit(1);
    });
    process.on('unhandledRejection', async (reason) => {
      console.error('Unhandled rejection:', reason);
      await this.stop();
      process.exit(1);
    });
  }

  /**
   * Check if automation is currently running
   */
  isRunning(): boolean {
    return this.status.isRunning;
  }

  /**
   * Get current connection progress
   * Requirement 5.2: Progress tracking for connection counts
   */
  getConnectionProgress(): {
    processed: number;
    successful: number;
    remaining: number;
    maxConnections: number;
  } {
    return {
      processed: this.status.connectionsProcessed,
      successful: this.status.connectionsSuccessful,
      remaining: this.status.maxConnections - this.status.connectionsSuccessful,
      maxConnections: this.status.maxConnections,
    };
  }

  /**
   * Get automation duration
   */
  getDuration(): number | null {
    if (!this.status.startTime) {
      return null;
    }

    const endTime = this.status.endTime || new Date();
    return endTime.getTime() - this.status.startTime.getTime();
  }

  /**
   * Reset automation state (useful for testing)
   */
  reset(): void {
    this.status = {
      isRunning: false,
      currentStep: 'idle',
      connectionsProcessed: 0,
      connectionsSuccessful: 0,
      maxConnections: this.configService.getMaxConnections(),
    };
  }
}
