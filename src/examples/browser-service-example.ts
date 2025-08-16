/**
 * Example usage of BrowserService
 * This file demonstrates how to use the browser automation foundation
 */

import { BrowserService } from '../services/browser-service';

async function demonstrateBrowserService() {
  const browserService = new BrowserService({
    headless: false, // Set to true for production
    timeout: 30000,
  });

  try {
    console.log('Initializing browser...');
    await browserService.initialize();

    console.log('Navigating to LinkedIn...');
    await browserService.navigateTo('https://www.linkedin.com/home');

    console.log('Waiting for page to load...');
    await browserService.waitForPageLoad();

    console.log('Looking for sign-in button...');
    const signInExists = await browserService.elementExists(
      'a[data-tracking-control-name="guest_homepage-basic_nav-header-signin"]'
    );

    if (signInExists) {
      console.log('Sign-in button found!');

      // Take a screenshot for verification
      console.log('Taking screenshot...');
      await browserService.takeScreenshot('./linkedin-homepage.png');
    } else {
      console.log('Sign-in button not found - user might already be logged in');
    }
  } catch (error) {
    console.error('Browser automation error:', error);
  } finally {
    console.log('Cleaning up browser...');
    await browserService.cleanup();
    console.log('Browser service example completed');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  demonstrateBrowserService().catch(console.error);
}

export { demonstrateBrowserService };
