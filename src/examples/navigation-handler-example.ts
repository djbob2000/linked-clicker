import { BrowserService } from '../services/browser-service';
import { NavigationHandler } from '../services/navigation-handler';
import { ConfigurationService } from '../services/configuration';
import { LoginHandler } from '../services/login-handler';

/**
 * Example usage of NavigationHandler for LinkedIn network navigation
 * This demonstrates the complete workflow from login to network modal opening
 */
async function demonstrateNavigationHandler() {
  const browserService = new BrowserService({
    headless: false, // Set to true for production
    timeout: 30000,
  });

  const configService = new ConfigurationService();
  const loginHandler = new LoginHandler(browserService, configService);
  const navigationHandler = new NavigationHandler(browserService);

  try {
    // Initialize browser
    console.log('Initializing browser...');
    await browserService.initialize();

    // Step 1: Login to LinkedIn
    console.log('Logging into LinkedIn...');
    const loginResult = await loginHandler.login();

    if (!loginResult.success) {
      throw new Error(`Login failed: ${loginResult.error}`);
    }
    console.log('✓ Login successful');

    // Step 2: Navigate to network growth and open modal
    console.log('Navigating to network growth page...');
    const navigationResult = await navigationHandler.navigateToNetworkGrowth();

    if (!navigationResult.success) {
      throw new Error(`Navigation failed: ${navigationResult.error}`);
    }
    console.log('✓ Navigation successful');

    // Step 3: Verify modal is open
    const isModalOpen = await navigationHandler.isModalOpen();
    console.log(`✓ Modal is ${isModalOpen ? 'open' : 'closed'}`);

    if (isModalOpen) {
      const modalElement = await navigationHandler.getModalElement();
      console.log('✓ Modal element retrieved successfully');

      // At this point, the modal is ready for connection processing
      console.log('Ready for connection processing...');
    }
  } catch (error) {
    console.error('Navigation example failed:', error);
  } finally {
    // Clean up browser resources
    console.log('Cleaning up browser...');
    await browserService.cleanup();
  }
}

// Export for use in other modules
export { demonstrateNavigationHandler };

// Run example if this file is executed directly
if (require.main === module) {
  demonstrateNavigationHandler().catch(console.error);
}
