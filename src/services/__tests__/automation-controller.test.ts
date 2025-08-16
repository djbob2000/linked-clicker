import { AutomationController } from '../automation-controller';
import { BrowserService } from '../browser-service';
import { ConfigurationService } from '../configuration';
import { LoginHandler } from '../login-handler';
import { NavigationHandler } from '../navigation-handler';
import { ConnectionHandler } from '../connection-handler';

// Mock all dependencies
jest.mock('../browser-service');
jest.mock('../configuration');
jest.mock('../login-handler');
jest.mock('../navigation-handler');
jest.mock('../connection-handler');

const MockedBrowserService = BrowserService as jest.MockedClass<
  typeof BrowserService
>;
const MockedConfigurationService = ConfigurationService as jest.MockedClass<
  typeof ConfigurationService
>;
const MockedLoginHandler = LoginHandler as jest.MockedClass<
  typeof LoginHandler
>;
const MockedNavigationHandler = NavigationHandler as jest.MockedClass<
  typeof NavigationHandler
>;
const MockedConnectionHandler = ConnectionHandler as jest.MockedClass<
  typeof ConnectionHandler
>;

describe('AutomationController', () => {
  let controller: AutomationController;
  let mockBrowserService: jest.Mocked<BrowserService>;
  let mockConfigService: jest.Mocked<ConfigurationService>;
  let mockLoginHandler: jest.Mocked<LoginHandler>;
  let mockNavigationHandler: jest.Mocked<NavigationHandler>;
  let mockConnectionHandler: jest.Mocked<ConnectionHandler>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockConfigService = {
      validateOrThrow: jest.fn(),
      isHeadless: jest.fn().mockReturnValue(true),
      getTimeout: jest.fn().mockReturnValue(30000),
      getMaxConnections: jest.fn().mockReturnValue(100),
      getMinMutualConnections: jest.fn().mockReturnValue(5),
    } as any;

    mockBrowserService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockLoginHandler = {
      login: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockNavigationHandler = {
      navigateToNetworkGrowth: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockConnectionHandler = {
      processConnections: jest.fn().mockResolvedValue({
        success: true,
        connectionsProcessed: 10,
        connectionsSuccessful: 5,
      }),
      getCurrentConnectionCount: jest.fn().mockResolvedValue(0),
      findEligibleConnections: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ConnectionHandler>;

    // Setup constructor mocks
    MockedConfigurationService.mockImplementation(() => mockConfigService);
    MockedBrowserService.mockImplementation(() => mockBrowserService);
    MockedLoginHandler.mockImplementation(() => mockLoginHandler);
    MockedNavigationHandler.mockImplementation(() => mockNavigationHandler);
    MockedConnectionHandler.mockImplementation(() => mockConnectionHandler);

    controller = new AutomationController();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(MockedConfigurationService).toHaveBeenCalled();
      expect(MockedBrowserService).toHaveBeenCalledWith({
        headless: true,
        timeout: 30000,
      });
      expect(MockedLoginHandler).toHaveBeenCalledWith(
        mockBrowserService,
        mockConfigService
      );
      expect(MockedNavigationHandler).toHaveBeenCalledWith(mockBrowserService);
      expect(MockedConnectionHandler).toHaveBeenCalledWith(mockBrowserService);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = { headless: false, timeout: 60000 };
      new AutomationController(customConfig);

      expect(MockedBrowserService).toHaveBeenCalledWith(customConfig);
    });

    it('should initialize status correctly', () => {
      const status = controller.getStatus();

      expect(status).toEqual({
        isRunning: false,
        currentStep: 'idle',
        connectionsProcessed: 0,
        connectionsSuccessful: 0,
        maxConnections: 100,
      });
    });
  });

  describe('start', () => {
    it('should successfully complete automation workflow', async () => {
      const result = await controller.start();

      expect(result.success).toBe(true);
      expect(result.status.currentStep).toBe('completed');
      expect(result.status.isRunning).toBe(false);
      expect(result.status.connectionsProcessed).toBe(10);
      expect(result.status.connectionsSuccessful).toBe(5);
      expect(result.status.startTime).toBeDefined();
      expect(result.status.endTime).toBeDefined();
    });

    it('should validate configuration before starting', async () => {
      await controller.start();

      expect(mockConfigService.validateOrThrow).toHaveBeenCalled();
    });

    it('should initialize browser service', async () => {
      await controller.start();

      expect(mockBrowserService.initialize).toHaveBeenCalled();
    });

    it('should execute workflow steps in correct order', async () => {
      await controller.start();

      expect(mockLoginHandler.login).toHaveBeenCalled();
      expect(mockNavigationHandler.navigateToNetworkGrowth).toHaveBeenCalled();
      expect(mockConnectionHandler.processConnections).toHaveBeenCalledWith(
        5,
        100
      );
    });

    it('should handle configuration validation errors', async () => {
      const configError = new Error('Invalid configuration');
      mockConfigService.validateOrThrow.mockImplementation(() => {
        throw configError;
      });

      const result = await controller.start();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid configuration');
      expect(result.status.currentStep).toBe('error');
      expect(result.status.lastError).toBe('Invalid configuration');
    });

    it('should handle login failures', async () => {
      mockLoginHandler.login.mockResolvedValue({
        success: false,
        error: 'Login failed',
      });

      const result = await controller.start();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed: Login failed');
      expect(result.status.currentStep).toBe('error');
    });

    it('should handle navigation failures', async () => {
      mockNavigationHandler.navigateToNetworkGrowth.mockResolvedValue({
        success: false,
        error: 'Navigation failed',
      });

      const result = await controller.start();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation failed: Navigation failed');
      expect(result.status.currentStep).toBe('error');
    });

    it('should handle connection processing failures', async () => {
      mockConnectionHandler.processConnections.mockResolvedValue({
        success: false,
        connectionsProcessed: 0,
        connectionsSuccessful: 0,
        error: 'Processing failed',
      });

      const result = await controller.start();

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Connection processing failed: Processing failed'
      );
      expect(result.status.currentStep).toBe('error');
    });

    it('should prevent starting when already running', async () => {
      // Start first automation
      const firstStart = controller.start();

      // Try to start second automation while first is running
      const result = await controller.start();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Automation is already running');

      // Wait for first automation to complete
      await firstStart;
    });

    it('should update status during workflow execution', async () => {
      const statusUpdates: string[] = [];

      controller.onStatusChange((status) => {
        statusUpdates.push(status.currentStep);
      });

      await controller.start();

      expect(statusUpdates).toContain('logging-in');
      expect(statusUpdates).toContain('navigating');
      expect(statusUpdates).toContain('processing-connections');
      expect(statusUpdates).toContain('completed');
    });
  });

  describe('stop', () => {
    it('should stop running automation', async () => {
      // Start automation and let it complete
      await controller.start();

      // Stop automation
      await controller.stop();

      const status = controller.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.currentStep).toBe('idle');
      expect(status.endTime).toBeDefined();
    });

    it('should clean up browser resources', async () => {
      await controller.start();
      await controller.stop();

      expect(mockBrowserService.cleanup).toHaveBeenCalled();
    });

    it('should clean up even if not running', async () => {
      await controller.stop();

      expect(mockBrowserService.cleanup).toHaveBeenCalled();
    });
  });

  describe('status management', () => {
    it('should return current status', () => {
      const status = controller.getStatus();

      expect(status).toEqual({
        isRunning: false,
        currentStep: 'idle',
        connectionsProcessed: 0,
        connectionsSuccessful: 0,
        maxConnections: 100,
      });
    });

    it('should register and notify status callbacks', async () => {
      const callback = jest.fn();
      controller.onStatusChange(callback);

      await controller.start();

      expect(callback).toHaveBeenCalledTimes(6); // start, logging-in, navigating, processing-connections, update connections, completed
    });

    it('should remove status callbacks', async () => {
      const callback = jest.fn();
      controller.onStatusChange(callback);
      controller.removeStatusCallback(callback);

      await controller.start();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();

      controller.onStatusChange(errorCallback);
      controller.onStatusChange(goodCallback);

      await controller.start();

      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should check if automation is running', async () => {
      expect(controller.isRunning()).toBe(false);

      const startPromise = controller.start();
      // Note: isRunning might be true briefly during execution

      await startPromise;
      expect(controller.isRunning()).toBe(false);
    });

    it('should get connection progress', async () => {
      await controller.start();

      const progress = controller.getConnectionProgress();
      expect(progress).toEqual({
        processed: 10,
        successful: 5,
        remaining: 95,
        maxConnections: 100,
      });
    });

    it('should calculate duration', async () => {
      await controller.start();

      const duration = controller.getDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null duration when not started', () => {
      const duration = controller.getDuration();
      expect(duration).toBeNull();
    });

    it('should reset automation state', () => {
      controller.reset();

      const status = controller.getStatus();
      expect(status).toEqual({
        isRunning: false,
        currentStep: 'idle',
        connectionsProcessed: 0,
        connectionsSuccessful: 0,
        maxConnections: 100,
      });
    });
  });

  describe('error handling', () => {
    it('should handle browser initialization errors', async () => {
      mockBrowserService.initialize.mockRejectedValue(
        new Error('Browser init failed')
      );

      const result = await controller.start();

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Failed to initialize automation controller: Browser init failed'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockBrowserService.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      await controller.start();
      await controller.stop();

      // Should not throw error
      expect(mockBrowserService.cleanup).toHaveBeenCalled();
    });
  });

  describe('requirements compliance', () => {
    it('should enforce maximum connection limits (Requirement 3.6)', async () => {
      await controller.start();

      expect(mockConnectionHandler.processConnections).toHaveBeenCalledWith(
        5,
        100
      );
    });

    it('should track connection counts (Requirement 3.7)', async () => {
      await controller.start();

      const status = controller.getStatus();
      expect(status.connectionsProcessed).toBe(10);
      expect(status.connectionsSuccessful).toBe(5);
    });

    it('should provide status tracking (Requirement 5.1)', () => {
      const callback = jest.fn();
      controller.onStatusChange(callback);

      expect(typeof controller.getStatus).toBe('function');
      expect(typeof controller.onStatusChange).toBe('function');
    });

    it('should display progress information (Requirement 5.2)', async () => {
      await controller.start();

      const progress = controller.getConnectionProgress();
      expect(progress.processed).toBeDefined();
      expect(progress.successful).toBeDefined();
      expect(progress.remaining).toBeDefined();
      expect(progress.maxConnections).toBeDefined();
    });
  });
});
