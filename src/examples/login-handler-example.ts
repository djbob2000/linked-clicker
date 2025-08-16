import { BrowserService } from '../services/browser-service';
import { ConfigurationService } from '../services/configuration';
import { LoginHandler } from '../services/login-handler';

/**
 * Example usage of the LoginHandler class
 * This demonstrates how to use the LoginHandler to automate LinkedIn login
 */
async function demonstrateLoginHandler() {
  // Initialize services
  const configService = new ConfigurationService();
  const browserService = new BrowserService({
    headless: false, // Set to true for production
    timeout: 30000,
  });

  const loginHandler = new LoginHandler(browserService, configService);

  try {
    // Validate configuration first
    configService.validateOrThrow();

    // Initialize browser
    await browserService.initialize();

    console.log('Starting LinkedIn login automation...');

    // Perform login
    const result = await loginHandler.login();

    if (result.success) {
      console.log('✅ Login successful!');

      // Take a screenshot to verify we're logged in
      const screenshot = await browserService.takeScreenshot(
        './login-success.png'
      );
      console.log('📸 Screenshot saved to login-success.png');
    } else {
      console.error('❌ Login failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Error during login automation:', error);
  } finally {
    // Always cleanup browser resources
    await browserService.cleanup();
    console.log('🧹 Browser cleanup completed');
  }
}

// Export for use in other modules
export { demonstrateLoginHandler };

// Run example if this file is executed directly
if (require.main === module) {
  demonstrateLoginHandler().catch(console.error);
}
