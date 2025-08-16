import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AutomationController } from '../../services/automation-controller';
import { BrowserService } from '../../services/browser-service';
import { ConfigurationService } from '../../services/configuration';
import { LoginHandler } from '../../services/login-handler';
import { NavigationHandler } from '../../services/navigation-handler';
import { ConnectionHandler } from '../../services/connection-handler';
import { LoggingService } from '../../services/logging-service';
import {
  MOCK_PAGE_CONFIGS,
  MOCK_CONNECTION_DATA,
} from '../mocks/linkedin-pages';

describe('LinkedIn Automation End-to-End Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let mockServer: any;
  let automationController: AutomationController;

  beforeAll(async () => {
    // Launch browser for E2E testing
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Create new context and page for each test
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();

    // Set up mock server responses
    await page.route('**/*', (route) => {
      const url = route.request().url();

      // Route to appropriate mock page based on URL
      if (url.includes('linkedin.com/home')) {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: MOCK_PAGE_CONFIGS.HOME.html,
        });
      } else if (url.includes('linkedin.com/login')) {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: MOCK_PAGE_CONFIGS.LOGIN.html,
        });
      } else if (url.includes('linkedin.com/feed')) {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: MOCK_PAGE_CONFIGS.FEED.html,
        });
      } else if (url.includes('linkedin.com/mynetwork/grow')) {
        // Check if modal should be shown
        const hasModalParam = url.includes('modal=true');
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: hasModalParam
            ? MOCK_PAGE_CONFIGS.CONNECTION_MODAL.html
            : MOCK_PAGE_CONFIGS.NETWORK_GROWTH.html,
        });
      } else {
        route.continue();
      }
    });

    // Mock configuration
    jest.spyOn(ConfigurationService.prototype, 'loadConfiguration').mockReturnValue({
      linkedinUsername: 'test@example.com',
      linkedinPassword: 'testpassword123',
      minMutualConnections: 5,
      maxConnections: 50,
      headless: true,
      timeout: 30000,
    });

    automationController = new AutomationController();
    // Override browser service to use our test page
    (automationController as any).browserService.page = page;
    (automationController as any).browserService.browser = browser;
    (automationController as any).browserService.context = context;
    (automationController as any).browserService.initialized = true;
  });

  afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  describe('Complete Automation Flow', () => {
    it('should complete full automation workflow with mock LinkedIn pages', async () => {
      // Start automation
      const automationPromise = automationController.start();

      // Wait for navigation to home page
      await page.waitForURL('**/linkedin.com/home');
      expect(await page.textContent('h1')).toContain(
        'Welcome to your professional community'
      );

      // Simulate clicking sign-in button
      await page.click(
        '[data-tracking-control-name="guest_homepage-basic_nav-header-signin"]'
      );

      // Wait for login page
      await page.waitForURL('**/linkedin.com/login');
      expect(await page.textContent('title')).toBe('LinkedIn Login');

      // Verify form fields are filled
      await page.waitForSelector('#username');
      await page.waitForSelector('#password');

      // Simulate form submission by navigating to feed
      await page.goto('https://www.linkedin.com/feed/');

      // Wait for feed page
      await page.waitForURL('**/linkedin.com/feed/');
      expect(await page.textContent('h1')).toBe('LinkedIn Feed');

      // Navigate to network growth page
      await page.goto('https://www.linkedin.com/mynetwork/grow/');
      await page.waitForURL('**/linkedin.com/mynetwork/grow/');

      // Click "See all" button to open modal
      await page.click('[data-view-name="cohort-section-see-all"]');

      // Simulate modal opening by navigating to modal version
      await page.goto('https://www.linkedin.com/mynetwork/grow/?modal=true');

      // Wait for modal to appear
      await page.waitForSelector('[data-testid="dialog"]');

      // Verify connection cards are present
      const connectionCards = await page.$$('[role="listitem"]');
      expect(connectionCards.length).toBe(4);

      // Verify mutual connections parsing
      const mutualConnectionsTexts = await page.$$eval(
        '.entity-result__summary-text',
        (elements) => elements.map((el) => el.textContent || '')
      );

      expect(mutualConnectionsTexts).toEqual([
        'John and 12 other mutual connections',
        'Jane and 8 other mutual connections',
        'Bob and 3 other mutual connections',
        'Alice and 15 other mutual connections',
      ]);

      // Wait for automation to complete
      await automationPromise;

      // Verify final status
      const status = automationController.getStatus();
      expect(status.currentStep).toBe('completed');
      expect(status.connectionsSuccessful).toBeGreaterThan(0);
      expect(status.isRunning).toBe(false);
    }, 30000);

    it('should handle login failure scenario', async () => {
      // Override route to return login error page
      await page.route('**/linkedin.com/login', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: MOCK_PAGE_CONFIGS.LOGIN_ERROR.html,
        });
      });

      await automationController.start();

      const status = automationController.getStatus();
      expect(status.currentStep).toBe('error');
      expect(status.lastError).toContain('invalid credentials');
    });

    it('should respect mutual connection threshold', async () => {
      // Set high threshold to filter connections
      jest.spyOn(ConfigurationService.prototype, 'loadConfiguration').mockReturnValue({
        linkedinUsername: 'test@example.com',
        linkedinPassword: 'testpassword123',
        minMutualConnections: 10, // Only John (12) and Alice (15) qualify
        maxConnections: 50,
        headless: true,
        timeout: 30000,
      });

      // Recreate automation controller with new config
      const filteredAutomationController = new AutomationController();
      (filteredAutomationController as any).browserService.page = page;
      (filteredAutomationController as any).browserService.browser = browser;
      (filteredAutomationController as any).browserService.context = context;
      (filteredAutomationController as any).browserService.initialized = true;

      await filteredAutomationController.start();

      const status = filteredAutomationController.getStatus();
      expect(status.currentStep).toBe('completed');
      // Should only connect with John and Alice (2 connections)
      expect(status.connectionsSuccessful).toBeLessThanOrEqual(2);
    });

    it('should handle connection button interactions', async () => {
      let connectButtonClicked = false;

      // Intercept connect button clicks
      await page.route('**/linkedin.com/**', (route) => {
        if (
          route.request().method() === 'POST' &&
          route.request().url().includes('connect')
        ) {
          connectButtonClicked = true;
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          route.continue();
        }
      });

      await automationController.start();

      // Verify that connect buttons were interacted with
      const status = automationController.getStatus();
      expect(status.currentStep).toBe('completed');
      expect(status.connectionsProcessed).toBeGreaterThan(0);
    });

    it('should handle maximum connection limit', async () => {
      // Set very low max connections
      jest.spyOn(ConfigurationService.prototype, 'loadConfiguration').mockReturnValue({
        linkedinUsername: 'test@example.com',
        linkedinPassword: 'testpassword123',
        minMutualConnections: 1,
        maxConnections: 2, // Only allow 2 connections
        headless: true,
        timeout: 30000,
      });

      // Recreate automation controller
      const limitedAutomationController = new AutomationController();
      (limitedAutomationController as any).browserService.page = page;
      (limitedAutomationController as any).browserService.browser = browser;
      (limitedAutomationController as any).browserService.context = context;
      (limitedAutomationController as any).browserService.initialized = true;

      await limitedAutomationController.start();

      const status = limitedAutomationController.getStatus();
      expect(status.currentStep).toBe('completed');
      expect(status.connectionsSuccessful).toBeLessThanOrEqual(2);
    });

    it('should handle page navigation errors', async () => {
      // Mock network growth page to return 404
      await page.route('**/linkedin.com/mynetwork/grow/', (route) => {
        route.fulfill({
          status: 404,
          contentType: 'text/html',
          body: '<html><body><h1>Page Not Found</h1></body></html>',
        });
      });

      await automationController.start();

      const status = automationController.getStatus();
      expect(status.currentStep).toBe('error');
      expect(status.lastError).toBeDefined();
    });

    it('should provide real-time status updates', async () => {
      const statusUpdates: string[] = [];

      automationController.onStatusChange((status) => {
        statusUpdates.push(status.currentStep);
      });

      await automationController.start();

      // Should have captured multiple status transitions
      expect(statusUpdates.length).toBeGreaterThan(1);
      expect(statusUpdates).toContain('logging-in');
      expect(statusUpdates).toContain('navigating');
      expect(statusUpdates[statusUpdates.length - 1]).toMatch(
        /^(completed|error)$/
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing connection modal', async () => {
      // Override route to not show modal
      await page.route('**/linkedin.com/mynetwork/grow/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: MOCK_PAGE_CONFIGS.NETWORK_GROWTH.html, // No modal
        });
      });

      await automationController.start();

      const status = automationController.getStatus();
      expect(status.currentStep).toBe('error');
      expect(status.lastError).toContain('modal');
    });

    it('should handle empty connection list', async () => {
      // Create empty modal
      const emptyModalHtml = `
        <div class="artdeco-modal" data-testid="dialog">
          <div class="artdeco-modal__content">
            <h2>People you may know</h2>
            <div class="search-results-container">
              <ul class="reusable-search__entity-result-list">
                <!-- No connections -->
              </ul>
            </div>
          </div>
        </div>
      `;

      await page.route(
        '**/linkedin.com/mynetwork/grow/?modal=true',
        (route) => {
          route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: emptyModalHtml,
          });
        }
      );

      await automationController.start();

      const status = automationController.getStatus();
      expect(status.currentStep).toBe('completed');
      expect(status.connectionsProcessed).toBe(0);
      expect(status.connectionsSuccessful).toBe(0);
    });

    it('should handle browser crashes gracefully', async () => {
      // Simulate browser crash by closing context mid-automation
      setTimeout(async () => {
        await context.close();
      }, 1000);

      await automationController.start();

      const status = automationController.getStatus();
      expect(status.currentStep).toBe('error');
      expect(status.isRunning).toBe(false);
    });
  });
});
