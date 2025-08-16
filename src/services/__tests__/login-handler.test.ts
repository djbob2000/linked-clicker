import { LoginHandler, LoginResult } from '../login-handler';
import { BrowserService } from '../browser-service';
import { ConfigurationService } from '../configuration';

// Mock the dependencies
jest.mock('../browser-service');
jest.mock('../configuration');

describe('LoginHandler', () => {
  let loginHandler: LoginHandler;
  let mockBrowserService: jest.Mocked<BrowserService>;
  let mockConfigService: jest.Mocked<ConfigurationService>;
  let mockPage: any;

  beforeEach(() => {
    // Create mocked instances
    mockBrowserService = new BrowserService() as jest.Mocked<BrowserService>;
    mockConfigService =
      new ConfigurationService() as jest.Mocked<ConfigurationService>;

    // Mock page object
    mockPage = {
      url: jest.fn(),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
    };

    // Setup default mock implementations
    mockBrowserService.navigateTo = jest.fn().mockResolvedValue(undefined);
    mockBrowserService.waitForPageLoad = jest.fn().mockResolvedValue(undefined);
    mockBrowserService.elementExists = jest.fn().mockResolvedValue(false);
    mockBrowserService.clickElement = jest.fn().mockResolvedValue(undefined);
    mockBrowserService.waitForElement = jest.fn().mockResolvedValue({} as any);
    mockBrowserService.typeText = jest.fn().mockResolvedValue(undefined);
    mockBrowserService.getPage = jest.fn().mockReturnValue(mockPage);

    mockConfigService.getLinkedInCredentials = jest.fn().mockReturnValue({
      username: 'test@example.com',
      password: 'testpassword123',
    });

    loginHandler = new LoginHandler(mockBrowserService, mockConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully complete login flow', async () => {
      // Mock successful sign-in button click
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          // Sign-in button exists
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          // Submit button exists
          if (selector === 'button[type="submit"]') {
            return Promise.resolve(true);
          }
          // No failure indicators
          if (
            selector.includes('error') ||
            selector.includes('alert') ||
            selector.includes('challenge')
          ) {
            return Promise.resolve(false);
          }
          // Success indicator exists
          if (selector === '.global-nav') {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        }
      );

      mockPage.url.mockReturnValue('https://www.linkedin.com/feed/');

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify the complete flow was executed
      expect(mockBrowserService.navigateTo).toHaveBeenCalledWith(
        'https://www.linkedin.com/home'
      );
      expect(mockBrowserService.typeText).toHaveBeenCalledWith(
        '#username',
        'test@example.com'
      );
      expect(mockBrowserService.typeText).toHaveBeenCalledWith(
        '#password',
        'testpassword123'
      );
    });

    it('should handle navigation failure', async () => {
      mockBrowserService.navigateTo.mockRejectedValue(
        new Error('Network error')
      );

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to navigate to LinkedIn home');
    });

    it('should handle missing credentials', async () => {
      mockConfigService.getLinkedInCredentials.mockReturnValue({
        username: '',
        password: '',
      });

      // Mock sign-in button exists to get past that step
      mockBrowserService.elementExists.mockResolvedValueOnce(true);

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('LinkedIn credentials not found');
    });

    it('should handle sign-in button not found', async () => {
      mockBrowserService.elementExists.mockResolvedValue(false);

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not find sign-in button');
    });

    it('should handle login form submission failure', async () => {
      // Mock sign-in button exists but no submit button
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        }
      );

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not find login form submit button');
    });

    it('should detect login failure from error indicators', async () => {
      // Mock successful flow until login detection, then error indicator
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          if (selector === 'button[type="submit"]') {
            return Promise.resolve(true);
          }
          if (selector === '.form__input--error') {
            return Promise.resolve(true); // Error indicator exists
          }
          return Promise.resolve(false);
        }
      );

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'invalid credentials or LinkedIn security challenge'
      );
    });

    it('should detect login success from URL navigation', async () => {
      // Mock successful flow with no specific indicators but successful URL
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          if (selector === 'button[type="submit"]') {
            return Promise.resolve(true);
          }
          return Promise.resolve(false); // No error or success indicators
        }
      );

      mockPage.url.mockReturnValue('https://www.linkedin.com/feed/');

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect login failure from URL still containing login', async () => {
      // Mock successful flow until login detection
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          if (selector === 'button[type="submit"]') {
            return Promise.resolve(true);
          }
          return Promise.resolve(false); // No error or success indicators
        }
      );

      mockPage.url.mockReturnValue('https://www.linkedin.com/login');

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'invalid credentials or LinkedIn security challenge'
      );
    });
  });

  describe('credential input', () => {
    it('should wait for username and password fields to be ready', async () => {
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          if (selector === 'button[type="submit"]') {
            return Promise.resolve(true);
          }
          if (selector === '.global-nav') {
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        }
      );

      mockPage.url.mockReturnValue('https://www.linkedin.com/feed/');

      await loginHandler.login();

      expect(mockBrowserService.waitForElement).toHaveBeenCalledWith(
        '#username',
        {
          visible: true,
          enabled: true,
        }
      );
      expect(mockBrowserService.waitForElement).toHaveBeenCalledWith(
        '#password',
        {
          visible: true,
          enabled: true,
        }
      );
    });

    it('should handle credential input field not found', async () => {
      mockBrowserService.elementExists.mockResolvedValueOnce(true); // Sign-in button exists
      mockBrowserService.waitForElement.mockRejectedValue(
        new Error('Element not found')
      );

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to input credentials');
    });
  });

  describe('error handling', () => {
    it('should handle detection errors gracefully', async () => {
      mockBrowserService.elementExists.mockImplementation(
        (selector: string) => {
          if (
            selector.includes('guest_homepage-basic_nav-header-signin') ||
            selector.includes('/login')
          ) {
            return Promise.resolve(true);
          }
          if (selector === 'button[type="submit"]') {
            return Promise.resolve(true);
          }
          // Throw error during detection phase
          throw new Error('Detection error');
        }
      );

      const result: LoginResult = await loginHandler.login();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to detect login status');
    });
  });
});
