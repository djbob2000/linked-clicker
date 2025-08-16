#!/usr/bin/env tsx

/**
 * Test script to check browser operation with profile
 */

import 'dotenv/config';
import { BrowserService } from './src/services/browser-service';

async function testBrowserProfile() {
  console.log('🚀 Testing browser with separate profile...');

  const browserService = new BrowserService({
    headless: process.env.HEADLESS === 'true',
    timeout: parseInt(process.env.TIMEOUT || '30000'),
    userDataDir: process.env.USER_DATA_DIR || './browser-profile',
    useExistingProfile: process.env.USE_EXISTING_PROFILE === 'true',
    chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH,
    chromeUserDataDir: process.env.CHROME_USER_DATA_DIR,
  });

  try {
    console.log('📂 Initializing browser with profile...');
    console.log(
      `   - Profile: ${process.env.USER_DATA_DIR || './browser-profile'}`
    );
    console.log(`   - Headless: ${process.env.HEADLESS === 'true'}`);
    console.log(
      `   - Use existing profile: ${process.env.USE_EXISTING_PROFILE === 'true'}`
    );

    await browserService.initialize();

    console.log('🌐 Navigating to LinkedIn...');
    await browserService.navigateTo('https://www.linkedin.com');

    console.log('⏱️  Waiting 10 seconds for testing...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log('📸 Taking screenshot...');
    await browserService.takeScreenshot('./test-screenshot.png');

    console.log('✅ Test completed successfully!');
    console.log(
      '📁 Browser profile saved in:',
      process.env.USER_DATA_DIR || './browser-profile'
    );
    console.log('📸 Screenshot saved in ./test-screenshot.png');
    console.log('');
    console.log(
      '💡 If you see LinkedIn in the browser, log into your account.'
    );
    console.log(
      '   On the next application run, you will remain authorized!'
    );
  } catch (error) {
    console.error(
      '❌ Error during testing:',
      error instanceof Error ? error.message : error
    );
    console.error('Full error:', error);
  } finally {
    console.log('🧹 Closing browser...');
    await browserService.cleanup();
  }
}

// Run the test
testBrowserProfile().catch(console.error);