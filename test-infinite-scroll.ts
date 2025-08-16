#!/usr/bin/env tsx

/**
 * Test script specifically for infinite scroll functionality
 */

import dotenv from 'dotenv';
import { BrowserService } from './src/services/browser-service';
import { LoginHandler } from './src/services/login-handler';
import { NavigationHandler } from './src/services/navigation-handler';
import { ConfigurationService } from './src/services/configuration';

// Load environment variables
dotenv.config();

async function testInfiniteScroll() {
  console.log('🔍 Testing LinkedIn infinite scroll functionality...');

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

    console.log('🔐 Step 2: Logging in...');
    const loginResult = await loginHandler.login();

    if (!loginResult.success) {
      console.error('❌ Login failed:', loginResult.error);
      return;
    }
    console.log('✅ Login successful!');

    console.log('🌐 Step 3: Navigating to network page...');
    const navigationResult = await navigationHandler.navigateToNetworkGrowth();

    if (!navigationResult.success) {
      console.error('❌ Navigation failed:', navigationResult.error);
      return;
    }
    console.log('✅ Navigation successful!');

    console.log('📜 Step 4: Testing infinite scroll...');

    const page = browserService.getPage();

    // Find the modal container
    const modalSelectors = [
      '[data-testid="dialog"]',
      '[role="dialog"]',
      '.artdeco-modal',
      '.modal-dialog',
    ];

    let modalElement = null;
    for (const selector of modalSelectors) {
      try {
        modalElement = await page.$(selector);
        if (modalElement) {
          console.log(`✅ Found modal with selector: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!modalElement) {
      console.error('❌ Could not find modal element');
      return;
    }

    // Test multiple scroll attempts
    for (let scrollAttempt = 1; scrollAttempt <= 5; scrollAttempt++) {
      console.log(`\n🔄 Scroll attempt ${scrollAttempt}:`);

      // Get current card count
      const cardsBefore = await page.$$('[role="listitem"]');
      const countBefore = cardsBefore.length;
      console.log(`   Cards before scroll: ${countBefore}`);

      // Get current scroll position
      const scrollBefore = await modalElement.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));

      console.log(
        `   Scroll position: ${scrollBefore.scrollTop}/${scrollBefore.scrollHeight} (client: ${scrollBefore.clientHeight})`
      );

      // Try different scroll strategies
      if (scrollAttempt === 1) {
        // Strategy 1: Scroll to bottom
        console.log('   Strategy: Scroll to bottom');
        await modalElement.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
      } else if (scrollAttempt === 2) {
        // Strategy 2: Scroll by large amount
        console.log('   Strategy: Scroll by 1000px');
        await modalElement.evaluate((element) => {
          element.scrollBy(0, 1000);
        });
      } else if (scrollAttempt === 3) {
        // Strategy 3: Scroll to specific position
        console.log('   Strategy: Scroll to 80% of height');
        await modalElement.evaluate((element) => {
          element.scrollTop = element.scrollHeight * 0.8;
        });
      } else if (scrollAttempt === 4) {
        // Strategy 4: Multiple small scrolls
        console.log('   Strategy: Multiple small scrolls');
        for (let i = 0; i < 5; i++) {
          await modalElement.evaluate((element) => {
            element.scrollBy(0, 200);
          });
          await page.waitForTimeout(500);
        }
      } else {
        // Strategy 5: Scroll to very bottom with force
        console.log('   Strategy: Force scroll to very bottom');
        await modalElement.evaluate((element) => {
          element.scrollTop = element.scrollHeight + 1000;
        });
      }

      // Wait for potential new content to load
      console.log('   Waiting for new content...');
      await page.waitForTimeout(4000);

      // Check if new cards were loaded
      const cardsAfter = await page.$$('[role="listitem"]');
      const countAfter = cardsAfter.length;
      const newCards = countAfter - countBefore;

      console.log(
        `   Cards after scroll: ${countAfter} (${
          newCards > 0 ? '+' : ''
        }${newCards} new)`
      );

      // Get new scroll position
      const scrollAfter = await modalElement.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));

      console.log(
        `   New scroll position: ${scrollAfter.scrollTop}/${scrollAfter.scrollHeight}`
      );

      if (newCards > 0) {
        console.log(`   ✅ Success! Loaded ${newCards} new cards`);

        // Show some info about new cards
        const newCardElements = cardsAfter.slice(countBefore);
        for (let i = 0; i < Math.min(3, newCardElements.length); i++) {
          const cardText = await newCardElements[i].textContent();
          const name = cardText?.split('\n')[0]?.substring(0, 50) || 'Unknown';
          console.log(`      New card ${i + 1}: ${name}...`);
        }
      } else {
        console.log(`   ❌ No new cards loaded`);

        // Check if we're at the bottom
        const isAtBottom =
          scrollAfter.scrollTop + scrollAfter.clientHeight >=
          scrollAfter.scrollHeight - 10;
        console.log(`   At bottom: ${isAtBottom}`);

        if (isAtBottom && scrollAttempt > 2) {
          console.log("   Seems like we've reached the end of available cards");
          break;
        }
      }
    }

    console.log('\n📊 Final scroll test summary:');
    const finalCards = await page.$$('[role="listitem"]');
    console.log(`   Total cards found: ${finalCards.length}`);

    // Check for loading indicators
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-test-id*="loading"]',
      '.artdeco-spinner',
    ];

    let hasLoadingIndicator = false;
    for (const selector of loadingSelectors) {
      if (await page.$(selector)) {
        hasLoadingIndicator = true;
        console.log(`   Loading indicator found: ${selector}`);
        break;
      }
    }

    if (!hasLoadingIndicator) {
      console.log('   No loading indicators found');
    }

    console.log(
      '⏳ Keeping browser open for 30 seconds for manual inspection...'
    );
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    console.log('🧹 Cleaning up...');
    await browserService.cleanup();
  }
}

// Run the test
if (require.main === module) {
  testInfiniteScroll()
    .then(() => {
      console.log('🏁 Infinite scroll test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Test crashed:', error);
      process.exit(1);
    });
}
