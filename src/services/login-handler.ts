import { BrowserService } from './browser-service';
import { ConfigurationService } from './configuration';
import {
  LoginError,
  RetryManager,
  GracefulDegradation,
  ErrorContext,
} from '../lib/error-handling';

export interface LoginResult {
  success: boolean;
  error?: string;
  recoverable?: boolean;
}

export class LoginHandler {
  private browserService: BrowserService;
  private configService: ConfigurationService;

  constructor(
    browserService: BrowserService,
    configService: ConfigurationService
  ) {
    this.browserService = browserService;
    this.configService = configService;
  }

  /**
   * Performs complete LinkedIn login automation with comprehensive error handling
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
   */
  async login(): Promise<LoginResult> {
    ErrorContext.set('loginAttempt', new Date().toISOString());

    try {
      // Validate credentials before attempting login
      const { username, password } =
        this.configService.getLinkedInCredentials();
      if (!username || !password) {
        return {
          success: false,
          error: 'LinkedIn credentials not configured',
          recoverable: false,
        };
      }

      // Execute login workflow with retry logic
      const result = await RetryManager.withRetry(
        async () => {
          // Requirement 1.1: Navigate to LinkedIn home page
          await this.navigateToLinkedInHome();

          // Check if we're already logged in after navigation
          const currentUrl = this.browserService.getPage().url();
          if (
            currentUrl.includes('/feed/') ||
            currentUrl.includes('/in/') ||
            !currentUrl.includes('/login')
          ) {
            console.log('Already logged in, skipping login steps');
            return true;
          }

          // Requirement 1.2: Click the "Sign in with email" button
          await this.clickSignInButton();

          // Requirements 1.3, 1.4: Input credentials
          await this.inputCredentials();

          // Requirement 1.5: Submit the login form
          await this.submitLoginForm();

          // Requirement 1.6: Detect login success/failure
          const loginSuccess = await this.detectLoginSuccess();

          if (!loginSuccess) {
            throw new LoginError(
              'Login failed - invalid credentials or LinkedIn security challenge',
              false // Not recoverable - likely credential issue
            );
          }

          return true;
        },
        {
          maxAttempts: 2, // Limited retries for login to avoid account lockout
          baseDelay: 3000,
          retryCondition: (error) => {
            // Only retry for network/browser issues, not credential issues
            if (error instanceof LoginError) {
              return error.recoverable;
            }
            return (
              error.message.includes('timeout') ||
              error.message.includes('network') ||
              error.message.includes('navigation')
            );
          },
        }
      );

      if (!result.success) {
        const isRecoverable =
          result.error instanceof LoginError ? result.error.recoverable : true;

        return {
          success: false,
          error: result.error?.message || 'Login failed',
          recoverable: isRecoverable,
        };
      }

      ErrorContext.set('loginSuccess', true);

      // Add a brief delay after successful login to ensure page is fully loaded
      await this.browserService.getPage().waitForTimeout(3000);

      // Log the final URL after login for debugging
      const finalUrl = this.browserService.getPage().url();
      console.log(`Login successful. Final URL: ${finalUrl}`);

      return { success: true };
    } catch (error) {
      // Requirement 1.6: Log error and stop execution on failure
      const loginError =
        error instanceof LoginError
          ? error
          : new LoginError(
              `Login process failed: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              true
            );

      ErrorContext.set('loginError', loginError.message);

      return {
        success: false,
        error: loginError.message,
        recoverable: loginError.recoverable,
      };
    }
  }

  /**
   * Navigate to LinkedIn home page with fallback URLs
   * Requirement 1.1: WHEN the application starts THEN the system SHALL navigate to https://www.linkedin.com/home
   */
  private async navigateToLinkedInHome(): Promise<void> {
    // Go directly to login page - more reliable than home page
    const page = this.browserService.getPage();
    console.log('Navigating directly to LinkedIn login page...');

    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for page to load
    await page.waitForTimeout(3000);

    console.log(`Successfully navigated to: ${page.url()}`);
  }

  /**
   * Click the "Sign in with email" button with comprehensive selector fallbacks
   * Requirement 1.2: WHEN on the LinkedIn home page THEN the system SHALL click the "Sign in with email" button
   */
  private async clickSignInButton(): Promise<void> {
    const page = this.browserService.getPage();
    const currentUrl = page.url();

    // If already on login page, skip this step
    if (currentUrl.includes('/login') || currentUrl.includes('/uas/login')) {
      console.log('Already on login page, skipping sign-in button click');
      return;
    }

    // LinkedIn typically has multiple sign-in entry points, try common selectors
    const signInSelectors = [
      'a[data-tracking-control-name="guest_homepage-basic_nav-header-signin"]',
      'a[href*="/login"]',
      '.nav__button-secondary',
      'a:has-text("Sign in")',
      '[data-test-id="sign-in-button"]',
      '.sign-in-link',
      '.nav-item__link[href*="login"]',
      'button:has-text("Sign in")',
    ];

    const result = await RetryManager.withRetry(
      async () => {
        let signInClicked = false;

        for (const selector of signInSelectors) {
          try {
            if (await this.browserService.elementExists(selector)) {
              await this.browserService.clickElement(selector, {
                timeout: 5000,
              });
              signInClicked = true;

              // Wait for navigation to login page
              await this.browserService.waitForPageLoad();

              // Verify we're on a login page
              const newUrl = page.url();
              if (newUrl.includes('/login') || newUrl.includes('/uas/login')) {
                return true;
              }

              break;
            }
          } catch (error) {
            console.warn(`Failed to click selector ${selector}:`, error);
            continue;
          }
        }

        if (!signInClicked) {
          throw new LoginError(
            'Could not find sign-in button on LinkedIn page',
            true,
            { currentUrl, availableSelectors: signInSelectors }
          );
        }

        return true;
      },
      {
        maxAttempts: 2,
        baseDelay: 2000,
      }
    );

    if (!result.success) {
      throw new LoginError(
        `Failed to click sign-in button after ${result.attempts} attempts: ${result.error?.message}`,
        false,
        { currentUrl }
      );
    }
  }

  /**
   * Input username and password credentials
   * Requirements 1.3, 1.4: Input username and password from environment variables
   */
  private async inputCredentials(): Promise<void> {
    try {
      const { username, password } =
        this.configService.getLinkedInCredentials();

      if (!username || !password) {
        throw new Error('LinkedIn credentials not found in configuration');
      }

      // Requirement 1.3: Input username into input with id="username"
      await this.browserService.waitForElement('#username', {
        visible: true,
        enabled: true,
      });
      await this.browserService.typeText('#username', username);

      // Requirement 1.4: Input password into input with id="password"
      await this.browserService.waitForElement('#password', {
        visible: true,
        enabled: true,
      });
      await this.browserService.typeText('#password', password);
    } catch (error) {
      throw new Error(
        `Failed to input credentials: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Submit the login form
   * Requirement 1.5: WHEN credentials are entered THEN the system SHALL submit the login form
   */
  private async submitLoginForm(): Promise<void> {
    try {
      // Common LinkedIn login form submit selectors
      const submitSelectors = [
        'button[type="submit"]',
        'button[data-id="sign-in-form__submit-btn"]',
        '.btn__primary--large',
        'button:has-text("Sign in")',
        '[data-test-id="sign-in-form-submit-button"]',
      ];

      let formSubmitted = false;

      for (const selector of submitSelectors) {
        try {
          if (await this.browserService.elementExists(selector)) {
            await this.browserService.clickElement(selector, { timeout: 5000 });
            formSubmitted = true;
            break;
          }
        } catch {
          // Continue to next selector
          continue;
        }
      }

      if (!formSubmitted) {
        throw new Error('Could not find login form submit button');
      }

      // Wait for form submission to process
      await this.browserService.waitForPageLoad();
    } catch (error) {
      throw new Error(
        `Failed to submit login form: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Detect if login was successful or failed
   * Requirement 1.6: IF login fails THEN the system SHALL log the error and stop execution
   */
  private async detectLoginSuccess(): Promise<boolean> {
    try {
      const page = this.browserService.getPage();

      // Wait a moment for page to settle after login attempt
      await page.waitForTimeout(3000);

      // Check for login success indicators
      const successIndicators = [
        '.global-nav', // LinkedIn main navigation
        '[data-test-id="nav-top-bar"]',
        '.feed-container', // LinkedIn feed
        'a[href*="/in/"]', // Profile link
        '.global-nav__me', // User menu
      ];

      // Check for login failure indicators
      const failureIndicators = [
        '.form__input--error', // Form validation errors
        '.alert', // Error alerts
        '.error-message',
        'div:has-text("Please enter a valid email address")',
        'div:has-text("The password you provided must have")',
        'div:has-text("Hmm, we don\'t recognize that email")',
        '.challenge-page', // Security challenge page
      ];

      // First check for failure indicators
      for (const selector of failureIndicators) {
        if (await this.browserService.elementExists(selector)) {
          return false;
        }
      }

      // Then check for success indicators
      for (const selector of successIndicators) {
        if (await this.browserService.elementExists(selector)) {
          return true;
        }
      }

      // If we're still on a login-related URL, login likely failed
      const currentUrl = page.url();
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/uas/login') ||
        currentUrl.includes('/checkpoint')
      ) {
        return false;
      }

      // If we've navigated away from login pages, assume success
      return !currentUrl.includes('/login');
    } catch (error) {
      // If we can't detect success/failure, assume failure for safety
      throw new Error(
        `Failed to detect login status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
