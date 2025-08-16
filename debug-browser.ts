#!/usr/bin/env tsx

/**
 * Debug script to diagnose browser navigation issues
 */

import dotenv from 'dotenv';
import { BrowserService } from './src/services/browser-service';

// Load environment variables
dotenv.config();

async function debugBrowser() {
  console.log('🔍 Debugging browser navigation...');

  const browserService = new BrowserService({
    headless: false, // Always visible for debugging
    timeout: 60000,
    userDataDir: process.env.USER_DATA_DIR || './browser-profile',
    useExistingProfile: process.env.USE_EXISTING_PROFILE === 'true',
  });

  try {
    console.log('🚀 Initializing browser...');
    await browserService.initialize();
    console.log('✅ Browser initialized successfully');

    const page = browserService.getPage();

    // Log initial state
    console.log(`📍 Initial URL: ${page.url()}`);

    // Try to navigate to LinkedIn home
    console.log('🔗 Navigating to LinkedIn home...');

    try {
      await page.goto('https://www.linkedin.com/home', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      console.log(`✅ Navigation successful. Current URL: ${page.url()}`);

      // Wait a bit to see what happens
      console.log('⏳ Waiting 5 seconds to observe page behavior...');
      await page.waitForTimeout(5000);

      console.log(`📍 Final URL: ${page.url()}`);

      // Check if we can see the page title
      const title = await page.title();
      console.log(`📄 Page title: ${title}`);

      // Check if we're on a login page
      const hasLoginForm = await page
        .locator('#username')
        .isVisible()
        .catch(() => false);
      const hasSignInButton = await page
        .locator('button:has-text("Sign in")')
        .isVisible()
        .catch(() => false);

      console.log(`🔐 Has login form: ${hasLoginForm}`);
      console.log(`🔐 Has sign in button: ${hasSignInButton}`);

      if (hasLoginForm) {
        console.log('📝 Login form detected - this is expected');
      }

      // Try to navigate to network page directly
      console.log('🌐 Trying direct navigation to network page...');

      await page.goto('https://www.linkedin.com/mynetwork/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      console.log(`📍 Network page URL: ${page.url()}`);

      // Wait and observe
      console.log('⏳ Waiting 10 seconds to observe network page...');
      await page.waitForTimeout(10000);

      console.log(`📍 Final network URL: ${page.url()}`);
    } catch (navError) {
      console.error('❌ Navigation failed:', navError);

      // Try to get current state
      try {
        const currentUrl = page.url();
        const title = await page.title();
        console.log(`📍 Current URL after error: ${currentUrl}`);
        console.log(`📄 Current title after error: ${title}`);
      } catch (stateError) {
        console.error('❌ Could not get current state:', stateError);
      }
    }

    console.log(
      '🎯 Debug session complete. Press Ctrl+C to exit or wait 30 seconds...'
    );
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('💥 Debug failed:', error);
  } finally {
    console.log('🧹 Cleaning up...');
    await browserService.cleanup();
  }
}

// Run the debug
if (require.main === module) {
  debugBrowser()
    .then(() => {
      console.log('🏁 Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Debug crashed:', error);
      process.exit(1);
    });
}
