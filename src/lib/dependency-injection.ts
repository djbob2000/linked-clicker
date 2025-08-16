import {
  AutomationController,
  BrowserService,
  ConfigurationService,
  ConnectionHandler,
  LoginHandler,
  LoggingService,
  NavigationHandler,
} from '../services';

/**
 * Dependency injection container for managing service instances
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, any> = new Map();

  private constructor() {}

  /**
   * Get singleton instance of the DI container
   */
  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Register a service instance
   */
  public register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  /**
   * Get a service instance
   */
  public get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service ${key} not found in DI container`);
    }
    return service;
  }

  /**
   * Check if a service is registered
   */
  public has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Clear all services (useful for testing)
   */
  public clear(): void {
    this.services.clear();
  }

  /**
   * Initialize all services with proper dependencies
   */
  public async initializeServices(): Promise<void> {
    // Initialize configuration service first
    const configService = new ConfigurationService();
    this.register('configurationService', configService);

    // Validate configuration on startup
    configService.validateOrThrow();

    // Initialize logging service
    const loggingService = new LoggingService();
    this.register('loggingService', loggingService);

    // Initialize browser service with proper configuration
    const browserService = new BrowserService({
      headless: configService.isHeadless(),
      timeout: configService.getTimeout(),
      userDataDir: process.env.USER_DATA_DIR,
      useExistingProfile: process.env.USE_EXISTING_PROFILE === 'true',
      chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH,
      chromeUserDataDir: process.env.CHROME_USER_DATA_DIR,
    });
    this.register('browserService', browserService);

    // Initialize handlers with dependencies
    const loginHandler = new LoginHandler(browserService, configService);
    this.register('loginHandler', loginHandler);

    const navigationHandler = new NavigationHandler(browserService);
    this.register('navigationHandler', navigationHandler);

    const connectionHandler = new ConnectionHandler(browserService);
    this.register('connectionHandler', connectionHandler);

    // Initialize automation controller with all dependencies
    const automationController = new AutomationController();
    this.register('automationController', automationController);

    // Log successful initialization
    loggingService.info('All services initialized successfully');
  }

  /**
   * Cleanup all services
   */
  public async cleanup(): Promise<void> {
    const loggingService = this.get<LoggingService>('loggingService');
    const browserService = this.get<BrowserService>('browserService');

    try {
      // Close browser if open
      await browserService.cleanup();
      loggingService.info('Services cleaned up successfully');
    } catch (error) {
      loggingService.error('Error during cleanup', error as Error);
    }
  }
}

/**
 * Service keys for type-safe service retrieval
 */
export const ServiceKeys = {
  CONFIGURATION: 'configurationService',
  LOGGING: 'loggingService',
  BROWSER: 'browserService',
  LOGIN_HANDLER: 'loginHandler',
  NAVIGATION_HANDLER: 'navigationHandler',
  CONNECTION_HANDLER: 'connectionHandler',
  AUTOMATION_CONTROLLER: 'automationController',
} as const;

/**
 * Type-safe service getter functions
 */
export const getConfigurationService = (): ConfigurationService =>
  DIContainer.getInstance().get<ConfigurationService>(
    ServiceKeys.CONFIGURATION
  );

export const getLoggingService = (): LoggingService =>
  DIContainer.getInstance().get<LoggingService>(ServiceKeys.LOGGING);

export const getBrowserService = (): BrowserService =>
  DIContainer.getInstance().get<BrowserService>(ServiceKeys.BROWSER);

export const getAutomationController = (): AutomationController =>
  DIContainer.getInstance().get<AutomationController>(
    ServiceKeys.AUTOMATION_CONTROLLER
  );
