import { BrowserService } from './browser-service';
import {
  NavigationError,
  RetryManager,
  CircuitBreaker,
  ErrorContext,
} from '../lib/error-handling';

export interface NavigationResult {
  success: boolean;
  error?: string;
  recoverable?: boolean;
}

export class NavigationHandler {
  private browserService: BrowserService;
  private circuitBreaker: CircuitBreaker;

  constructor(browserService: BrowserService) {
    this.browserService = browserService;
    this.circuitBreaker = new CircuitBreaker(3, 30000); // 3 failures, 30s recovery
  }

  /**
   * Performs complete LinkedIn network navigation automation with comprehensive error handling
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async navigateToNetworkGrowth(): Promise<NavigationResult> {
    ErrorContext.set('navigationAttempt', new Date().toISOString());

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await RetryManager.withRetry(
          async () => {
            // Requirement 2.1: Navigate to network growth page
            await this.navigateToNetworkGrowthPage();

            // Requirement 2.2: Click cohort-section-see-all button
            await this.clickSeeAllButton();

            // Requirement 2.3: Wait for modal dialog to appear
            await this.waitForModal();

            return true;
          },
          {
            maxAttempts: 2, // Requirement 2.4: retry once
            baseDelay: 3000,
            retryCondition: (error) => {
              // Retry for modal appearance issues and navigation problems
              return (
                error.message.includes('modal') ||
                error.message.includes('button') ||
                error.message.includes('timeout')
              );
            },
          }
        );
      });

      if (!result.success) {
        const isRecoverable =
          result.error instanceof NavigationError
            ? result.error.recoverable
            : true;

        return {
          success: false,
          error: result.error?.message || 'Navigation failed',
          recoverable: isRecoverable,
        };
      }

      ErrorContext.set('navigationSuccess', true);
      return { success: true };
    } catch (error) {
      // Requirement 2.4: Log error and handle failure
      const navigationError =
        error instanceof NavigationError
          ? error
          : new NavigationError(
              `Network navigation failed: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              true
            );

      ErrorContext.set('navigationError', navigationError.message);

      return {
        success: false,
        error: navigationError.message,
        recoverable: navigationError.recoverable,
      };
    }
  }

  /**
   * Navigate to LinkedIn network growth page
   * Requirement 2.1: WHEN login is successful THEN the system SHALL navigate to https://www.linkedin.com/mynetwork/grow/
   */
  private async navigateToNetworkGrowthPage(): Promise<void> {
    try {
      console.log('Navigating to LinkedIn network growth page...');

      const page = this.browserService.getPage();
      const currentUrl = page.url();

      console.log(`Current URL before navigation: ${currentUrl}`);

      // Force navigation to network growth page
      await page.goto('https://www.linkedin.com/mynetwork/grow/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for page to fully load
      await this.browserService.waitForPageLoad();

      // Add additional wait for dynamic content to load
      await page.waitForTimeout(5000);

      // Verify we're on the correct page
      const newUrl = page.url();
      console.log(`URL after navigation: ${newUrl}`);

      if (
        !newUrl.includes('/mynetwork/grow') &&
        !newUrl.includes('/mynetwork/')
      ) {
        console.warn(`Expected network page, got: ${newUrl}`);

        // Try alternative navigation if we're not on the right page
        if (newUrl.includes('/feed/') || newUrl.includes('/in/')) {
          console.log(
            'Attempting alternative navigation via My Network link...'
          );

          // Try to find and click "My Network" navigation link
          const networkNavSelectors = [
            'a[href*="/mynetwork"]',
            'a[data-test-global-nav-link="mynetwork"]',
            '.global-nav__primary-link[href*="mynetwork"]',
            'nav a:has-text("My Network")',
            'a:has-text("My Network")',
          ];

          let networkLinkFound = false;
          for (const selector of networkNavSelectors) {
            try {
              if (await this.browserService.elementExists(selector)) {
                console.log(`Found network link with selector: ${selector}`);
                await this.browserService.clickElement(selector);
                await this.browserService.waitForPageLoad();
                await page.waitForTimeout(3000);
                networkLinkFound = true;
                break;
              }
            } catch (error) {
              console.warn(`Network link selector ${selector} failed:`, error);
              continue;
            }
          }

          if (!networkLinkFound) {
            // Direct navigation as last resort
            console.log('Network link not found, forcing direct navigation...');
            await page.goto('https://www.linkedin.com/mynetwork/', {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });
            await page.waitForTimeout(3000);
          }
        }
      }

      const finalUrl = page.url();
      console.log(`Final URL: ${finalUrl}`);

      // Accept any mynetwork page as success
      if (!finalUrl.includes('/mynetwork')) {
        throw new Error(
          `Navigation failed - still not on network page. Final URL: ${finalUrl}`
        );
      }

      console.log('Successfully navigated to network page');
    } catch (error) {
      throw new Error(
        `Failed to navigate to network growth page: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Finds the "See all" button for connections
   * Requirements: 3.2
   */
  private async findSeeAllConnectionsButton(): Promise<string | null> {
    try {
      console.log('Looking for "See all" connections button...');
      
      // Common selectors for "See all" buttons
      const seeAllSelectors = [
        'button[aria-label*="See all"]',
        'button:has-text("See all")',
        '[data-tracking-control-name="see_all_connections"]',
        '.mn-connections__see-all-button',
        'a:has-text("See all")',
      ];
      
      // Try to find the button
      for (const selector of seeAllSelectors) {
        try {
          if (await this.browserService.elementExists(selector)) {
            console.log(`Found "See all" button with selector: ${selector}`);
            return selector;
          }
        } catch (error) {
          console.warn(`Selector ${selector} failed:`, error);
          continue;
        }
      }
      
      console.warn('Could not find "See all" connections button');
      return null;
    } catch (error) {
      console.error('Error finding "See all" button:', error);
      return null;
    }
  }

  /**
   * Click the cohort-section-see-all button
   * Requirement 2.2: WHEN on the network growth page THEN the system SHALL locate and click button with data-view-name="cohort-section-see-all"
   */
  private async clickSeeAllButton(): Promise<void> {
    try {
      console.log('Looking for "See All" button...');

      const page = this.browserService.getPage();

      // Wait for page content to load first
      await page.waitForTimeout(3000);

      // Multiple selectors for the "See All" button as LinkedIn may change them
      const seeAllSelectors = [
        // Primary selector based on the actual button structure
        'button[data-view-name="cohort-section-see-all"]',
        'button[aria-label*="Show all suggestions"]',
        'button[aria-label*="Show all"]',
        // Alternative selectors
        'a[data-view-name="cohort-section-see-all"]',
        'button:has-text("Show all")',
        'button:has-text("See all")',
        'a:has-text("Show all")',
        'a:has-text("See all")',
        // Class-based selectors (less reliable but useful as fallback)
        'button.a151248f.e8daa707',
        // Generic selectors
        '[data-test-id*="see-all"]',
        '.cohort-section__see-all',
        'button[aria-label*="See all"]',
        'a[aria-label*="See all"]',
        // More generic selectors for people you may know section
        '.mn-community-summary__see-all',
        '.mn-pymk-list__footer button',
        '.mn-pymk-list__footer a',
        'button[data-test-id*="pymk"]',
        'a[data-test-id*="pymk"]',
        // Fallback selectors
        '[data-control-name*="see_all"]',
        '[data-tracking-control-name*="see_all"]',
      ];

      let buttonFound = false;
      let lastError: Error | undefined;

      // First, let's check what's actually on the page
      console.log('Checking page content...');
      const pageContent = await page.content();
      const hasNetworkContent =
        pageContent.includes('People you may know') ||
        pageContent.includes('See all') ||
        pageContent.includes('mynetwork');

      console.log(`Page has network content: ${hasNetworkContent}`);

      if (!hasNetworkContent) {
        console.warn('Page does not appear to contain network content');
      }

      for (const selector of seeAllSelectors) {
        try {
          console.log(`Trying selector: ${selector}`);

          // Check if element exists first
          const elementExists = await this.browserService.elementExists(
            selector
          );
          if (!elementExists) {
            console.log(`Element not found with selector: ${selector}`);
            continue;
          }

          // Wait for the button to be present and clickable
          await this.browserService.waitForElement(selector, {
            visible: true,
            enabled: true,
            timeout: 5000,
          });

          console.log(`Found button with selector: ${selector}`);

          // Click the see all button
          await this.browserService.clickElement(selector);

          buttonFound = true;
          console.log('Successfully clicked "See All" button');
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`Selector ${selector} failed:`, lastError.message);
          continue;
        }
      }

      if (!buttonFound) {
        // Try to find any clickable elements that might be the "See All" button
        console.log('Attempting to find See All button by text content...');

        try {
          // Use page.evaluate to find elements by text content
          const seeAllElement = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a'));
            return elements.find(
              (el) =>
                el.textContent?.toLowerCase().includes('see all') ||
                el.textContent?.toLowerCase().includes('see more') ||
                el.getAttribute('aria-label')?.toLowerCase().includes('see all')
            );
          });

          if (seeAllElement) {
            console.log('Found See All button by text content');
            await page.evaluate((el: Element) => (el as HTMLElement).click(), seeAllElement as Element);
            buttonFound = true;
          }
        } catch (error) {
          console.warn('Text-based search failed:', error);
        }
      }

      if (!buttonFound) {
        // Log available buttons for debugging
        try {
          const availableButtons = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            return buttons.slice(0, 10).map((btn) => ({
              tagName: btn.tagName,
              textContent: btn.textContent?.trim().substring(0, 50),
              className: btn.className,
              id: btn.id,
              dataAttributes: Array.from(btn.attributes)
                .filter((attr) => attr.name.startsWith('data-'))
                .map((attr) => `${attr.name}="${attr.value}"`),
            }));
          });

          console.log(
            'Available buttons on page:',
            JSON.stringify(availableButtons, null, 2)
          );
        } catch (error) {
          console.warn('Could not log available buttons:', error);
        }

        throw new Error(
          `Could not find "See All" button with any selector. Last error: ${lastError?.message}`
        );
      }

      // Wait for any resulting navigation or modal to appear
      await page.waitForTimeout(3000);

      console.log('Waiting for modal or page change after clicking See All...');
    } catch (error) {
      throw new Error(
        `Failed to click see all button: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Wait for modal dialog to appear with enhanced error handling
   * Requirement 2.3: WHEN the button is clicked THEN the system SHALL wait for modal dialog with data-testid="dialog" to appear
   * Requirement 2.4: IF the modal does not appear within timeout THEN the system SHALL log error and retry once
   */
  private async waitForModal(): Promise<void> {
    const modalSelectors = [
      '[data-testid="dialog"]',
      '[role="dialog"]',
      '.artdeco-modal',
      '.modal-dialog',
      '[data-test-modal]',
    ];

    const result = await RetryManager.withRetry(
      async () => {
        let modalFound = false;
        let lastError: Error | undefined;

        // Try multiple modal selectors
        for (const selector of modalSelectors) {
          try {
            await this.browserService.waitForModal(selector, {
              visible: true,
              timeout: 8000, // 8 second timeout per selector
            });

            modalFound = true;
            ErrorContext.set('modalSelector', selector);
            break;
          } catch (error) {
            lastError =
              error instanceof Error ? error : new Error(String(error));
            console.warn(
              `Modal selector ${selector} failed:`,
              lastError.message
            );
            continue;
          }
        }

        if (!modalFound) {
          throw new NavigationError(
            `Modal dialog did not appear with any selector: ${lastError?.message}`,
            true,
            {
              selectors: modalSelectors,
              pageUrl: this.browserService.getPage().url(),
              lastError: lastError?.message,
            }
          );
        }

        // Verify modal is properly loaded
        await this.verifyModalContent();

        return true;
      },
      {
        maxAttempts: 2, // Requirement 2.4: retry once
        baseDelay: 2000,
        retryCondition: (error) => {
          // Retry for modal appearance issues
          return (
            error.message.includes('modal') ||
            error.message.includes('dialog') ||
            error.message.includes('timeout')
          );
        },
      }
    );

    if (!result.success) {
      throw new NavigationError(
        `Modal dialog failed to appear after ${result.attempts} attempts: ${result.error?.message}`,
        false,
        { attempts: result.attempts, selectors: modalSelectors }
      );
    }
  }

  /**
   * Verify modal content is properly loaded
   */
  private async verifyModalContent(): Promise<void> {
    try {
      const page = this.browserService.getPage();

      // Wait for modal content to load
      await page.waitForTimeout(1000);

      // Check for connection cards or loading indicators
      const contentSelectors = [
        '[role="listitem"]',
        '.connection-card',
        '.artdeco-entity-lockup',
        '.loading-indicator',
      ];

      let hasContent = false;
      for (const selector of contentSelectors) {
        if (await this.browserService.elementExists(selector)) {
          hasContent = true;
          break;
        }
      }

      if (!hasContent) {
        console.warn('Modal appeared but no content detected');
        // Don't throw error - modal might still be loading
      }
    } catch (error) {
      console.warn('Modal content verification failed:', error);
      // Don't throw - this is a best-effort check
    }
  }

  /**
   * Check if the modal is currently open
   */
  async isModalOpen(): Promise<boolean> {
    try {
      return await this.browserService.elementExists('[data-testid="dialog"]');
    } catch {
      return false;
    }
  }

  /**
   * Get the modal element if it exists
   */
  /**\n   * Opens the connection modal by navigating to the network page and finding the \"See all\" button\n   * Requirements: 3.2\n   */
  async openConnectionModal(): Promise<void> {
    // Navigate to the network page
    await this.navigateToNetworkGrowthPage();
    
    // Find and click the "See all" button to open the modal
    const seeAllButton = await this.findSeeAllConnectionsButton();
    if (seeAllButton) {
      await this.browserService.clickElement(seeAllButton);
      await this.browserService.waitForPageLoad();
      
      // Wait for modal to appear
      await this.getModalElement();
    } else {
      throw new Error('Could not find "See all" button to open connection modal');
    }
  }

  async getModalElement() {
    try {
      return await this.browserService.waitForElement(
        '[data-testid="dialog"]',
        {
          visible: true,
          timeout: 5000,
        }
      );
    } catch (error) {
      throw new Error(
        `Modal not found: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
