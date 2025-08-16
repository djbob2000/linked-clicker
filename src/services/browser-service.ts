import {
  Browser,
  BrowserContext,
  Page,
  chromium,
  ElementHandle,
} from 'playwright';
import {
  BrowserError,
  RetryManager,
  ResourceManager,
  ErrorContext,
} from '../lib/error-handling';

export interface BrowserServiceConfig {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
  userDataDir?: string;
  useExistingProfile?: boolean;
  chromeExecutablePath?: string;
  chromeUserDataDir?: string;
}

export interface ElementWaitOptions {
  timeout?: number;
  visible?: boolean;
  enabled?: boolean;
}

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Required<BrowserServiceConfig>;
  private resourceManager: ResourceManager;
  private isInitializing: boolean = false;

  constructor(config: BrowserServiceConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      userAgent:
        config.userAgent ??
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: config.viewport ?? { width: 1280, height: 720 },
      userDataDir: config.userDataDir ?? './browser-profile',
      useExistingProfile: config.useExistingProfile ?? false,
      chromeExecutablePath: config.chromeExecutablePath ?? '',
      chromeUserDataDir: config.chromeUserDataDir ?? '',
    };

    this.resourceManager = new ResourceManager();
  }

  /**
   * Initialize browser with proper configuration and error handling
   * Implements retry logic for browser launch failures
   */
  async initialize(): Promise<void> {
    if (this.isInitializing) {
      throw new BrowserError('Browser initialization already in progress');
    }

    if (this.isInitialized()) {
      return; // Already initialized
    }

    this.isInitializing = true;
    ErrorContext.set('browserConfig', this.config);

    try {
      const result = await RetryManager.withRetry(
        async () => {
          await this.initializeBrowser();
        },
        {
          maxAttempts: 3,
          baseDelay: 2000,
          retryCondition: (error) => {
            // Retry for browser launch failures but not for configuration errors
            return (
              !error.message.includes('Invalid') &&
              !error.message.includes('configuration')
            );
          },
        }
      );

      if (!result.success) {
        throw new BrowserError(
          `Failed to initialize browser after ${result.attempts} attempts: ${result.error?.message}`,
          true,
          { attempts: result.attempts, lastError: result.error?.message }
        );
      }

      // Register cleanup with resource manager
      this.resourceManager.register(async () => {
        await this.cleanup();
      });
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal browser initialization logic
   */
  private async initializeBrowser(): Promise<void> {
    try {
      // Determine which user data directory to use
      let userDataDir = this.config.userDataDir;

      // Only use Chrome user data dir if it's explicitly set and not empty
      if (
        this.config.chromeUserDataDir &&
        this.config.chromeUserDataDir.trim() !== ''
      ) {
        userDataDir = this.config.chromeUserDataDir;
      }

      if (userDataDir && this.config.useExistingProfile) {
        // Use launchPersistentContext for persistent profiles
        const contextOptions = {
          headless: this.config.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-extensions-file-access-check',
            '--disable-extensions-http-throttling',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection',
          ],
          userAgent: this.config.userAgent,
          viewport: this.config.viewport,
          ignoreHTTPSErrors: true,
          acceptDownloads: false,
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
          // Only set executablePath if it's explicitly provided and not empty
          ...(this.config.chromeExecutablePath &&
          this.config.chromeExecutablePath.trim() !== ''
            ? { executablePath: this.config.chromeExecutablePath }
            : {}),
        };

        this.context = await chromium.launchPersistentContext(
          userDataDir,
          contextOptions
        );

        if (!this.context) {
          throw new BrowserError('Failed to create persistent browser context');
        }

        // Get the browser instance from the context
        this.browser = this.context.browser();
      } else {
        // Launch browser without persistent profile
        const launchOptions = {
          headless: this.config.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-extensions-file-access-check',
            '--disable-extensions-http-throttling',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-ipc-flooding-protection',
          ],
          // Only set executablePath if it's explicitly provided and not empty
          ...(this.config.chromeExecutablePath &&
          this.config.chromeExecutablePath.trim() !== ''
            ? { executablePath: this.config.chromeExecutablePath }
            : {}),
        };

        this.browser = await chromium.launch(launchOptions);

        if (!this.browser) {
          throw new BrowserError('Browser failed to launch');
        }

        // Create browser context with error handling
        this.context = await this.browser.newContext({
          userAgent: this.config.userAgent,
          viewport: this.config.viewport,
          ignoreHTTPSErrors: true,
          acceptDownloads: false,
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!this.context) {
          throw new BrowserError('Failed to create browser context');
        }
      }

      // Set default timeout for all operations
      this.context.setDefaultTimeout(this.config.timeout);

      // Create new page or get existing page from persistent context
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
      } else {
        this.page = await this.context.newPage();
      }

      if (!this.page) {
        throw new BrowserError('Failed to create browser page');
      }

      // Set page-specific timeouts
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);

      // Add error handlers for page events
      this.page.on('pageerror', (error) => {
        // Filter out chrome-extension related errors
        if (error.message.includes('chrome-extension://')) {
          return;
        }
        console.warn('Page error:', error.message);
        ErrorContext.set('lastPageError', error.message);
      });

      // Handle console messages and filter out chrome-extension errors
      this.page.on('console', (msg) => {
        const text = msg.text();

        // Filter out common LinkedIn tracking/analytics errors that are not relevant
        if (
          text.includes('chrome-extension://') ||
          text.includes('Failed to load resource') ||
          text.includes('net::ERR_FAILED') ||
          text.includes('net::ERR_ABORTED') ||
          text.includes('googletagmanager') ||
          text.includes('google-analytics') ||
          text.includes('linkedin.com/pk') ||
          text.includes('ccm/collect')
        ) {
          return; // Ignore these common errors
        }

        // Log other console messages based on type
        if (msg.type() === 'error') {
          console.warn('Browser console error:', text);
        }
      });

      this.page.on('requestfailed', (request) => {
        const url = request.url();
        const errorText = request.failure()?.errorText;

        // Ignore common tracking/analytics failures that don't affect functionality
        if (
          url.startsWith('chrome-extension://') ||
          url.includes('googletagmanager') ||
          url.includes('google-analytics') ||
          url.includes('linkedin.com/pk') ||
          url.includes('ccm/collect') ||
          url.includes('juggler/content')
        ) {
          return;
        }

        // Only log significant request failures
        if (url.includes('linkedin.com') && !url.includes('/pk')) {
          console.warn('Request failed:', url, errorText);
        }
      });
    } catch (error) {
      // Clean up any partially initialized resources
      await this.cleanup();
      throw error instanceof BrowserError
        ? error
        : new BrowserError(
            `Browser initialization failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            true,
            { originalError: error }
          );
    }
  }

  /**
   * Get the current page instance
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page;
  }

  /**
   * Navigate to a URL with comprehensive error handling and retry logic
   */
  async navigateTo(url: string): Promise<void> {
    const page = this.getPage();
    ErrorContext.set('navigationUrl', url);

    const result = await RetryManager.withRetry(
      async () => {
        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded', // Changed from 'networkidle' to avoid LinkedIn tracking issues
            timeout: this.config.timeout,
          });

          if (!response) {
            throw new BrowserError(`No response received for ${url}`);
          }

          if (!response.ok()) {
            throw new BrowserError(
              `Navigation failed with status ${response.status()}: ${response.statusText()}`,
              true,
              {
                url,
                status: response.status(),
                statusText: response.statusText(),
              }
            );
          }

          // Verify page loaded correctly
          await this.verifyPageLoad(url);
        } catch (error) {
          if (error instanceof BrowserError) {
            throw error;
          }
          throw new BrowserError(
            `Navigation to ${url} failed: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            true,
            { url, originalError: error }
          );
        }
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        retryCondition: (error) => {
          // Retry for network issues but not for 404s or client errors
          if (error instanceof BrowserError && error.context?.status) {
            const status = error.context.status as number;
            return status >= 500 || status === 429; // Server errors or rate limiting
          }
          return true; // Retry other navigation errors
        },
      }
    );

    if (!result.success) {
      throw new BrowserError(
        `Failed to navigate to ${url} after ${result.attempts} attempts: ${result.error?.message}`,
        false,
        { url, attempts: result.attempts, lastError: result.error?.message }
      );
    }
  }

  /**
   * Verify that page loaded correctly
   */
  private async verifyPageLoad(expectedUrl: string): Promise<void> {
    const page = this.getPage();

    try {
      // Wait for page to be in a ready state
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

      const currentUrl = page.url();

      // Basic URL validation (allowing for redirects)
      if (!currentUrl.includes(new URL(expectedUrl).hostname)) {
        throw new BrowserError(
          `Page loaded but URL mismatch. Expected: ${expectedUrl}, Got: ${currentUrl}`,
          true,
          { expectedUrl, currentUrl }
        );
      }
    } catch (error) {
      throw new BrowserError(
        `Page load verification failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        true,
        { expectedUrl }
      );
    }
  }

  /**
   * Wait for an element with comprehensive error handling and retry logic
   */
  async waitForElement(
    selector: string,
    options: ElementWaitOptions = {}
  ): Promise<ElementHandle> {
    const page = this.getPage();
    const timeout = options.timeout ?? this.config.timeout;

    ErrorContext.set('elementSelector', selector);
    ErrorContext.set('elementOptions', options);

    const result = await RetryManager.withRetry(
      async () => {
        try {
          const locator = page.locator(selector).first(); // Use first() to avoid strict mode violation

          // Wait for element to be attached to DOM
          await locator.waitFor({
            state: 'attached',
            timeout,
          });

          // Additional state checks if specified
          if (options.visible) {
            await locator.waitFor({
              state: 'visible',
              timeout,
            });
          }

          if (options.enabled) {
            await locator.waitFor({
              state: 'visible',
              timeout,
            });

            // Check if element is enabled
            await page.waitForFunction(
              (sel) => {
                const element = document.querySelector(sel);
                return element && !element.hasAttribute('disabled');
              },
              selector,
              { timeout: Math.min(timeout, 5000) }
            );
          }

          const element = await page.$(selector);
          if (!element) {
            throw new BrowserError(`Element not found after wait: ${selector}`);
          }

          return element;
        } catch (error) {
          throw new BrowserError(
            `Failed to wait for element "${selector}": ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            true,
            { selector, options, pageUrl: page.url() }
          );
        }
      },
      {
        maxAttempts: 2,
        baseDelay: 1000,
        retryCondition: (error) => {
          // Retry for timeout errors but not for element not found errors
          return (
            error.message.includes('timeout') ||
            error.message.includes('Timeout')
          );
        },
      }
    );

    if (!result.success) {
      throw new BrowserError(
        `Element "${selector}" not found after ${result.attempts} attempts: ${result.error?.message}`,
        false,
        { selector, options, attempts: result.attempts }
      );
    }

    return result.result!;
  }

  /**
   * Click an element with comprehensive error handling and retry logic
   */
  async clickElement(
    selector: string,
    options: ElementWaitOptions = {}
  ): Promise<void> {
    const page = this.getPage();
    ErrorContext.set('clickSelector', selector);

    const result = await RetryManager.withRetry(
      async () => {
        try {
          // Wait for element to be clickable
          await this.waitForElement(selector, {
            ...options,
            visible: true,
            enabled: true,
          });

          // Scroll element into view if needed
          await page.locator(selector).scrollIntoViewIfNeeded();

          // Verify element is still clickable after scrolling
          const element = await page.$(selector);
          if (!element) {
            throw new BrowserError(
              `Element disappeared after scrolling: ${selector}`
            );
          }

          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();

          if (!isVisible) {
            throw new BrowserError(
              `Element not visible for clicking: ${selector}`
            );
          }

          if (!isEnabled) {
            throw new BrowserError(
              `Element not enabled for clicking: ${selector}`
            );
          }

          // Click the element with force option as fallback
          try {
            await page.click(selector, {
              timeout: options.timeout ?? this.config.timeout,
            });
          } catch (clickError) {
            // Try force click as fallback
            console.warn(
              `Normal click failed, trying force click: ${clickError}`
            );
            await page.click(selector, {
              timeout: options.timeout ?? this.config.timeout,
              force: true,
            });
          }

          // Wait a brief moment for any resulting page changes
          await page.waitForTimeout(500);
        } catch (error) {
          throw new BrowserError(
            `Failed to click element "${selector}": ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            true,
            { selector, pageUrl: page.url() }
          );
        }
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryCondition: (error) => {
          // Retry for element interaction issues but not for element not found
          return (
            !error.message.includes('not found') &&
            !error.message.includes('disappeared')
          );
        },
      }
    );

    if (!result.success) {
      throw new BrowserError(
        `Failed to click element "${selector}" after ${result.attempts} attempts: ${result.error?.message}`,
        false,
        { selector, attempts: result.attempts }
      );
    }
  }

  /**
   * Type text into an input field
   */
  async typeText(
    selector: string,
    text: string,
    options: ElementWaitOptions = {}
  ): Promise<void> {
    const page = this.getPage();

    try {
      await this.waitForElement(selector, {
        ...options,
        visible: true,
        enabled: true,
      });

      // Clear existing text and type new text
      await page.fill(selector, text, {
        timeout: options.timeout ?? this.config.timeout,
      });
    } catch (error) {
      throw new Error(
        `Failed to type text into "${selector}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Wait for a modal or dialog to appear
   */
  async waitForModal(
    selector: string,
    options: ElementWaitOptions = {}
  ): Promise<ElementHandle> {
    try {
      return await this.waitForElement(selector, {
        ...options,
        visible: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to wait for modal "${selector}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get all elements matching a selector
   */
  async getAllElements(selector: string): Promise<ElementHandle[]> {
    const page = this.getPage();

    try {
      return await page.$$(selector);
    } catch (error) {
      throw new Error(
        `Failed to get elements "${selector}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get text content from an element
   */
  async getElementText(selector: string): Promise<string> {
    const page = this.getPage();

    try {
      const element = await this.waitForElement(selector, { visible: true });
      const text = await element.textContent();
      return text?.trim() ?? '';
    } catch (error) {
      throw new Error(
        `Failed to get text from element "${selector}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Check if an element exists (without waiting)
   */
  async elementExists(selector: string): Promise<boolean> {
    const page = this.getPage();

    try {
      const element = await page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad(): Promise<void> {
    const page = this.getPage();

    try {
      await page.waitForLoadState('domcontentloaded', {
        timeout: this.config.timeout,
      });

      // Add a small delay to allow for dynamic content
      await page.waitForTimeout(2000);
    } catch (error) {
      throw new Error(
        `Page load timeout: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(path?: string): Promise<Buffer> {
    const page = this.getPage();

    try {
      return await page.screenshot({
        path,
        fullPage: true,
        type: 'png',
      });
    } catch (error) {
      throw new Error(
        `Failed to take screenshot: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Clean up browser resources with comprehensive error handling
   * Implements proper resource disposal as required
   */
  async cleanup(): Promise<void> {
    if (this.resourceManager.isCleaningUpResources()) {
      return; // Already cleaning up
    }

    const errors: Error[] = [];

    try {
      // Close page first
      if (this.page) {
        try {
          await Promise.race([
            this.page.close(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Page close timeout')), 5000)
            ),
          ]);
        } catch (error) {
          errors.push(
            new BrowserError(
              `Failed to close page: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          );
        } finally {
          this.page = null;
        }
      }

      // Close context
      if (this.context) {
        try {
          await Promise.race([
            this.context.close(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Context close timeout')), 5000)
            ),
          ]);
        } catch (error) {
          errors.push(
            new BrowserError(
              `Failed to close context: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          );
        } finally {
          this.context = null;
        }
      }

      // Close browser
      if (this.browser) {
        try {
          await Promise.race([
            this.browser.close(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Browser close timeout')),
                10000
              )
            ),
          ]);
        } catch (error) {
          errors.push(
            new BrowserError(
              `Failed to close browser: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            )
          );
        } finally {
          this.browser = null;
        }
      }

      // Clean up resource manager
      await this.resourceManager.cleanup();
    } catch (error) {
      errors.push(
        new BrowserError(
          `Unexpected error during cleanup: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      );
    }

    // Reset state
    this.isInitializing = false;
    ErrorContext.clear();

    // Log errors but don't throw - cleanup should be best effort
    if (errors.length > 0) {
      console.warn(
        'Errors during browser cleanup:',
        errors.map((e) => e.message)
      );
    }
  }

  /**
   * Check if browser is initialized and ready
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null && this.page !== null;
  }
}
