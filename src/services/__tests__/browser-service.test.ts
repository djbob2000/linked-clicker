import { BrowserService, BrowserServiceConfig } from '../browser-service';
import {
  chromium,
  Browser,
  BrowserContext,
  Page,
  ElementHandle,
} from 'playwright';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('BrowserService', () => {
  let browserService: BrowserService;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;
  let mockElement: ElementHandle<HTMLElement>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock objects
    mockElement = {
      textContent: 'mock text',
      scrollIntoViewIfNeeded: jest.fn(),
    } as any as ElementHandle<HTMLElement>;

    mockPage = {
      goto: jest.fn(),
      locator: jest.fn().mockReturnValue({
        waitFor: jest.fn(),
        scrollIntoViewIfNeeded: jest.fn(),
      }),
      $: jest.fn(),
      $$: jest.fn(),
      click: jest.fn(),
      fill: jest.fn(),
      waitForTimeout: jest.fn(),
      waitForFunction: jest.fn(),
      waitForLoadState: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
    } as any;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      setDefaultTimeout: jest.fn(),
      close: jest.fn(),
    } as any;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
    } as any;

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    browserService = new BrowserService();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const service = new BrowserService();
      expect(service).toBeInstanceOf(BrowserService);
    });

    it('should accept custom configuration', () => {
      const config: BrowserServiceConfig = {
        headless: false,
        timeout: 60000,
        userAgent: 'custom-agent',
        viewport: { width: 1920, height: 1080 },
      };

      const service = new BrowserService(config);
      expect(service).toBeInstanceOf(BrowserService);
    });
  });

  describe('initialize', () => {
    it('should successfully initialize browser, context, and page', async () => {
      await browserService.initialize();

      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        userAgent: expect.any(String),
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        acceptDownloads: false,
      });

      expect(mockContext.newPage).toHaveBeenCalled();
      expect(mockContext.setDefaultTimeout).toHaveBeenCalledWith(30000);
      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
      expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(30000);
    });

    it('should handle browser launch failure', async () => {
      const error = new Error('Browser launch failed');
      (chromium.launch as jest.Mock).mockRejectedValue(error);

      await expect(browserService.initialize()).rejects.toThrow(
        'Failed to initialize browser: Browser launch failed'
      );
    });

    it('should cleanup on initialization failure', async () => {
      const error = new Error('Context creation failed');
      mockBrowser.newContext.mockRejectedValue(error);

      await expect(browserService.initialize()).rejects.toThrow(
        'Failed to initialize browser: Context creation failed'
      );
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('getPage', () => {
    it('should return page when initialized', async () => {
      await browserService.initialize();
      const page = browserService.getPage();
      expect(page).toBe(mockPage);
    });

    it('should throw error when not initialized', () => {
      expect(() => browserService.getPage()).toThrow(
        'Browser not initialized. Call initialize() first.'
      );
    });
  });

  describe('navigateTo', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should navigate to URL successfully', async () => {
      const url = 'https://example.com';
      mockPage.goto.mockResolvedValue(null as any);

      await browserService.navigateTo(url);

      expect(mockPage.goto).toHaveBeenCalledWith(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    });

    it('should handle navigation failure', async () => {
      const url = 'https://example.com';
      const error = new Error('Navigation failed');
      mockPage.goto.mockRejectedValue(error);

      await expect(browserService.navigateTo(url)).rejects.toThrow(
        'Failed to navigate to https://example.com: Navigation failed'
      );
    });
  });

  describe('waitForElement', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should wait for element successfully', async () => {
      const selector = '#test-element';
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.locator.mockReturnValue(mockLocator as any);
      mockPage.$.mockResolvedValue(mockElement);

      const result = await browserService.waitForElement(selector);

      expect(mockPage.locator).toHaveBeenCalledWith(selector);
      expect(mockLocator.waitFor).toHaveBeenCalledWith({
        state: 'attached',
        timeout: 30000,
      });
      expect(result).toBe(mockElement);
    });

    it('should wait for visible element when specified', async () => {
      const selector = '#test-element';
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.locator.mockReturnValue(mockLocator as any);
      mockPage.$.mockResolvedValue(mockElement);

      await browserService.waitForElement(selector, { visible: true });

      expect(mockLocator.waitFor).toHaveBeenCalledWith({
        state: 'attached',
        timeout: 30000,
      });
      expect(mockLocator.waitFor).toHaveBeenCalledWith({
        state: 'visible',
        timeout: 30000,
      });
    });

    it('should handle element not found', async () => {
      const selector = '#missing-element';
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.locator.mockReturnValue(mockLocator as any);
      mockPage.$.mockResolvedValue(null);

      await expect(browserService.waitForElement(selector)).rejects.toThrow(
        'Element not found: #missing-element'
      );
    });
  });

  describe('clickElement', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should click element successfully', async () => {
      const selector = '#click-me';
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.locator.mockReturnValue(mockLocator as any);
      mockPage.$.mockResolvedValue(mockElement);
      mockPage.click.mockResolvedValue(undefined);
      mockPage.waitForTimeout.mockResolvedValue(undefined);
      mockPage.waitForFunction.mockResolvedValue(undefined);

      await browserService.clickElement(selector);

      expect(mockLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
      expect(mockPage.click).toHaveBeenCalledWith(selector, { timeout: 30000 });
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
    });
  });

  describe('typeText', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should type text successfully', async () => {
      const selector = '#input-field';
      const text = 'test input';
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.locator.mockReturnValue(mockLocator as any);
      mockPage.$.mockResolvedValue(mockElement);
      mockPage.fill.mockResolvedValue(undefined);
      mockPage.waitForFunction.mockResolvedValue(undefined);

      await browserService.typeText(selector, text);

      expect(mockPage.fill).toHaveBeenCalledWith(selector, text, {
        timeout: 30000,
      });
    });
  });

  describe('getAllElements', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should return all matching elements', async () => {
      const selector = '.list-item';
      const mockElements = [mockElement, mockElement];
      mockPage.$$.mockResolvedValue(mockElements);

      const result = await browserService.getAllElements(selector);

      expect(mockPage.$$).toHaveBeenCalledWith(selector);
      expect(result).toBe(mockElements);
    });
  });

  describe('getElementText', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should return element text content', async () => {
      const selector = '#text-element';
      const expectedText = 'Hello World';
      const mockLocator = {
        waitFor: jest.fn().mockResolvedValue(undefined),
      };

      mockPage.locator.mockReturnValue(mockLocator as any);
      mockPage.$.mockResolvedValue(mockElement);
      Object.defineProperty(mockElement, 'textContent', {
        value: `  ${expectedText}  `,
        writable: true,
      });

      const result = await browserService.getElementText(selector);

      expect(result).toBe(expectedText);
    });
  });

  describe('elementExists', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should return true when element exists', async () => {
      const selector = '#existing-element';
      mockPage.$.mockResolvedValue(mockElement);

      const result = await browserService.elementExists(selector);

      expect(result).toBe(true);
    });

    it('should return false when element does not exist', async () => {
      const selector = '#missing-element';
      mockPage.$.mockResolvedValue(null);

      const result = await browserService.elementExists(selector);

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      await browserService.initialize();

      await browserService.cleanup();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      await browserService.initialize();

      const error = new Error('Cleanup failed');
      mockPage.close.mockRejectedValue(error);

      // Should not throw
      await expect(browserService.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('isInitialized', () => {
    it('should return false when not initialized', () => {
      expect(browserService.isInitialized()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await browserService.initialize();
      expect(browserService.isInitialized()).toBe(true);
    });

    it('should return false after cleanup', async () => {
      await browserService.initialize();
      await browserService.cleanup();
      expect(browserService.isInitialized()).toBe(false);
    });
  });

  describe('takeScreenshot', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should take screenshot successfully', async () => {
      const mockBuffer = Buffer.from('screenshot-data');
      mockPage.screenshot.mockResolvedValue(mockBuffer);

      const result = await browserService.takeScreenshot();

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: undefined,
        fullPage: true,
        type: 'png',
      });
      expect(result).toBe(mockBuffer);
    });
  });

  describe('waitForPageLoad', () => {
    beforeEach(async () => {
      await browserService.initialize();
    });

    it('should wait for page load successfully', async () => {
      mockPage.waitForLoadState.mockResolvedValue(undefined);

      await browserService.waitForPageLoad();

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', {
        timeout: 30000,
      });
    });
  });
});
