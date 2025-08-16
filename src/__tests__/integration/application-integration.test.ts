/**
 * Application Integration Tests
 * Tests the complete application initialization and integration
 */

import { ApplicationStartup } from '../../lib/application-startup';
import { DIContainer, ServiceKeys } from '../../lib/dependency-injection';
import {
  ConfigurationService,
  LoggingService,
  AutomationController,
} from '../../services';

// Mock environment variables for testing
const mockEnvVars = {
  LINKEDIN_USERNAME: 'test@example.com',
  LINKEDIN_PASSWORD: 'testpassword',
  MIN_MUTUAL_CONNECTIONS: '5',
  MAX_CONNECTIONS: '100',
  HEADLESS: 'true',
  TIMEOUT: '30000',
};

describe('Application Integration', () => {
  beforeEach(() => {
    // Reset application state
    ApplicationStartup.reset();

    // Set mock environment variables
    Object.entries(mockEnvVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnvVars).forEach((key) => {
      delete process.env[key];
    });
  });

  describe('Application Startup', () => {
    it('should initialize all services successfully', async () => {
      await ApplicationStartup.initialize();

      expect(ApplicationStartup.isInitialized()).toBe(true);
      expect(ApplicationStartup.getInitializationError()).toBeNull();
    });

    it('should perform health checks successfully', async () => {
      await ApplicationStartup.initialize();

      const healthCheck = await ApplicationStartup.performHealthCheck();

      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.checks).toHaveLength(4); // Configuration, Logging, Environment, Node.js
      expect(healthCheck.checks.every((check) => check.status === 'pass')).toBe(
        true
      );
    });

    it('should fail initialization with invalid configuration', async () => {
      // Remove required environment variable
      delete process.env.LINKEDIN_USERNAME;

      await expect(ApplicationStartup.initialize()).rejects.toThrow();

      expect(ApplicationStartup.isInitialized()).toBe(false);
      expect(ApplicationStartup.getInitializationError()).toBeTruthy();
    });

    it('should handle graceful shutdown', async () => {
      await ApplicationStartup.initialize();

      expect(ApplicationStartup.isInitialized()).toBe(true);

      await ApplicationStartup.shutdown();

      expect(ApplicationStartup.isInitialized()).toBe(false);
    });
  });

  describe('Dependency Injection', () => {
    beforeEach(async () => {
      await ApplicationStartup.initialize();
    });

    it('should register all required services', () => {
      const container = DIContainer.getInstance();

      expect(container.has(ServiceKeys.CONFIGURATION)).toBe(true);
      expect(container.has(ServiceKeys.LOGGING)).toBe(true);
      expect(container.has(ServiceKeys.BROWSER)).toBe(true);
      expect(container.has(ServiceKeys.LOGIN_HANDLER)).toBe(true);
      expect(container.has(ServiceKeys.NAVIGATION_HANDLER)).toBe(true);
      expect(container.has(ServiceKeys.CONNECTION_HANDLER)).toBe(true);
      expect(container.has(ServiceKeys.AUTOMATION_CONTROLLER)).toBe(true);
    });

    it('should provide correct service instances', () => {
      const container = DIContainer.getInstance();

      const configService = container.get<ConfigurationService>(
        ServiceKeys.CONFIGURATION
      );
      const loggingService = container.get<LoggingService>(ServiceKeys.LOGGING);
      const automationController = container.get<AutomationController>(
        ServiceKeys.AUTOMATION_CONTROLLER
      );

      expect(configService).toBeInstanceOf(ConfigurationService);
      expect(loggingService).toBeInstanceOf(LoggingService);
      expect(automationController).toBeInstanceOf(AutomationController);
    });

    it('should maintain singleton instances', () => {
      const container = DIContainer.getInstance();

      const configService1 = container.get<ConfigurationService>(
        ServiceKeys.CONFIGURATION
      );
      const configService2 = container.get<ConfigurationService>(
        ServiceKeys.CONFIGURATION
      );

      expect(configService1).toBe(configService2);
    });

    it('should throw error for unregistered services', () => {
      const container = DIContainer.getInstance();

      expect(() => container.get('nonexistent')).toThrow(
        'Service nonexistent not found in DI container'
      );
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      await ApplicationStartup.initialize();
    });

    it('should have properly configured services', () => {
      const container = DIContainer.getInstance();
      const configService = container.get<ConfigurationService>(
        ServiceKeys.CONFIGURATION
      );

      const config = configService.loadConfiguration();

      expect(config.linkedinUsername).toBe('test@example.com');
      expect(config.linkedinPassword).toBe('testpassword');
      expect(config.minMutualConnections).toBe(5);
      expect(config.maxConnections).toBe(100);
      expect(config.headless).toBe(true);
      expect(config.timeout).toBe(30000);
    });

    it('should have logging service capturing logs', () => {
      const container = DIContainer.getInstance();
      const loggingService = container.get<LoggingService>(ServiceKeys.LOGGING);

      loggingService.info('Test log message');

      const logs = loggingService.getLogs();
      expect(logs.length).toBeGreaterThan(0);

      // Find our test log message
      const testLog = logs.find((log) => log.message === 'Test log message');
      expect(testLog).toBeDefined();
      expect(testLog?.level).toBe('info');
    });

    it('should have automation controller with proper status', () => {
      const container = DIContainer.getInstance();
      const automationController = container.get<AutomationController>(
        ServiceKeys.AUTOMATION_CONTROLLER
      );

      const status = automationController.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.currentStep).toBe('idle');
      expect(status.connectionsProcessed).toBe(0);
      expect(status.connectionsSuccessful).toBe(0);
      expect(status.maxConnections).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      delete process.env.LINKEDIN_USERNAME;
      delete process.env.LINKEDIN_PASSWORD;

      await expect(ApplicationStartup.initialize()).rejects.toThrow(
        /Configuration validation failed/
      );

      const healthCheck = await ApplicationStartup.performHealthCheck();
      expect(healthCheck.status).toBe('unhealthy');

      const configCheck = healthCheck.checks.find(
        (check) => check.name === 'Configuration'
      );
      expect(configCheck?.status).toBe('fail');
      expect(configCheck?.message).toContain('LINKEDIN_USERNAME');
      expect(configCheck?.message).toContain('LINKEDIN_PASSWORD');
    });

    it('should handle invalid configuration values', async () => {
      process.env.MIN_MUTUAL_CONNECTIONS = 'invalid';
      process.env.MAX_CONNECTIONS = '-1';

      await expect(ApplicationStartup.initialize()).rejects.toThrow();

      const healthCheck = await ApplicationStartup.performHealthCheck();
      expect(healthCheck.status).toBe('unhealthy');

      const configCheck = healthCheck.checks.find(
        (check) => check.name === 'Configuration'
      );
      expect(configCheck?.status).toBe('fail');
    });

    it('should handle service initialization failures', async () => {
      // Mock a service that throws during initialization
      const originalInitialize = DIContainer.prototype.initializeServices;
      DIContainer.prototype.initializeServices = jest
        .fn()
        .mockRejectedValue(new Error('Service init failed'));

      await expect(ApplicationStartup.initialize()).rejects.toThrow(
        'Service init failed'
      );

      expect(ApplicationStartup.isInitialized()).toBe(false);
      expect(ApplicationStartup.getInitializationError()).toBeTruthy();

      // Restore original method
      DIContainer.prototype.initializeServices = originalInitialize;
    });
  });

  describe('Production Readiness', () => {
    beforeEach(async () => {
      await ApplicationStartup.initialize();
    });

    it('should validate all required environment variables', () => {
      const container = DIContainer.getInstance();
      const configService = container.get<ConfigurationService>(
        ServiceKeys.CONFIGURATION
      );

      const validation = configService.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should have proper Node.js version support', async () => {
      const healthCheck = await ApplicationStartup.performHealthCheck();

      const nodeCheck = healthCheck.checks.find(
        (check) => check.name === 'Node.js Version'
      );
      expect(nodeCheck?.status).toBe('pass');
    });

    it('should support graceful shutdown', async () => {
      const shutdownSpy = jest.spyOn(ApplicationStartup, 'shutdown');

      await ApplicationStartup.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
      expect(ApplicationStartup.isInitialized()).toBe(false);
    });

    it('should handle multiple initialization attempts', async () => {
      // First initialization
      await ApplicationStartup.initialize();
      expect(ApplicationStartup.isInitialized()).toBe(true);

      // Second initialization should not throw
      await ApplicationStartup.initialize();
      expect(ApplicationStartup.isInitialized()).toBe(true);
    });
  });
});
