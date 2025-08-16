#!/usr/bin/env tsx

/**
 * Full workflow debug script to test the complete LinkedIn automation
 */

import dotenv from 'dotenv';
import { BrowserService } from './src/services/browser-service';
import { LoginHandler } from './src/services/login-handler';
import { NavigationHandler } from './src/services/navigation-handler';
import { ConfigurationService } from './src/services/configuration';

// Load environment variables
dotenv.config();

async function debugFullWorkflow() {
  console.log('🔍 Debugging full LinkedIn automation workflow...');

  const configService = new ConfigurationService();

  // Validate configuration first
  try {
    configService.validateOrThrow();
    console.log('✅ Configuration is valid');
  } catch (error) {
    console.error('❌ Configuration error:', error);
    return;
  }

  const browserService = new BrowserService({
    headless: false, // Always visible for debugging
    timeout: 60000,
    userDataDir: process.env.USER_DATA_DIR || './browser-profile',
    useExistingProfile: process.env.USE_EXISTING_PROFILE === 'true',
  });

  const loginHandler = new LoginHandler(browserService, configService);
  const navigationHandler = new NavigationHandler(browserService);

  try {
    console.log('🚀 Step 1: Initializing browser...');
    await browserService.initialize();
    console.log('✅ Browser initialized successfully');

    const page = browserService.getPage();
    console.log(`📍 Initial URL: ${page.url()}`);

    console.log('🔐 Step 2: Attempting login...');
    const loginResult = await loginHandler.login();

    if (loginResult.success) {
      console.log('✅ Login successful!');
      console.log(`📍 URL after login: ${page.url()}`);

      console.log('🌐 Step 3: Navigating to network growth page...');
      const navigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      if (navigationResult.success) {
        console.log('✅ Navigation successful!');
        console.log(`📍 Final URL: ${page.url()}`);

        console.log('🔍 Step 4: Looking for "See All" button...');

        // Check if we can find the See All button
        const seeAllSelectors = [
          'button[data-view-name="cohort-section-see-all"]',
          'button[aria-label*="Show all suggestions"]',
          'button[aria-label*="Show all"]',
          'a[data-view-name="cohort-section-see-all"]',
          'button:has-text("Show all")',
          'button:has-text("See all")',
          'a:has-text("Show all")',
          'a:has-text("See all")',
          'button.a151248f.e8daa707',
          '.mn-community-summary__see-all',
          '.mn-pymk-list__footer button',
        ];

        let buttonFound = false;
        for (const selector of seeAllSelectors) {
          const exists = await browserService.elementExists(selector);
          console.log(
            `   ${selector}: ${exists ? '✅ Found' : '❌ Not found'}`
          );
          if (exists && !buttonFound) {
            buttonFound = true;
            console.log(`🎯 Will use selector: ${selector}`);
          }
        }

        if (buttonFound) {
          console.log('✅ See All button found - automation should work!');
        } else {
          console.log(
            '⚠️  See All button not found - may need to adjust selectors'
          );

          // Let's see what buttons are actually available
          console.log('🔍 Available buttons on page:');
          const buttons = await page.evaluate(() => {
            const allButtons = Array.from(
              document.querySelectorAll('button, a')
            );
            return allButtons.slice(0, 20).map((btn) => ({
              tagName: btn.tagName,
              text: btn.textContent?.trim().substring(0, 50),
              className: btn.className,
              dataAttributes: Array.from(btn.attributes)
                .filter((attr) => attr.name.startsWith('data-'))
                .map((attr) => `${attr.name}="${attr.value}"`)
                .join(' '),
            }));
          });

          buttons.forEach((btn, i) => {
            console.log(
              `   ${i + 1}. ${btn.tagName}: "${btn.text}" (${btn.className}) [${
                btn.dataAttributes
              }]`
            );
          });
        }
      } else {
        console.error('❌ Navigation failed:', navigationResult.error);
      }
    } else {
      console.error('❌ Login failed:', loginResult.error);
    }

    console.log(
      '⏳ Keeping browser open for 30 seconds for manual inspection...'
    );
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('💥 Workflow failed:', error);
  } finally {
    console.log('🧹 Cleaning up...');
    await browserService.cleanup();
  }
}

// Run the debug
if (require.main === module) {
  debugFullWorkflow()
    .then(() => {
      console.log('🏁 Full workflow debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Debug crashed:', error);
      process.exit(1);
    });
}
