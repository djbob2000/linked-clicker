#!/usr/bin/env tsx

/**
 * Test specifically for finding the "Show all" button
 */

import dotenv from 'dotenv';
import { chromium } from 'playwright';

// Load environment variables
dotenv.config();

async function testShowAllButton() {
  console.log('🔍 Testing "Show all" button detection...');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    console.log('🔐 Logging into LinkedIn...');

    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Fill credentials
    const username = process.env.LINKEDIN_USERNAME;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!username || !password) {
      throw new Error(
        'LinkedIn credentials not found in environment variables'
      );
    }

    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Wait for login
    await page.waitForTimeout(5000);

    console.log('🌐 Navigating to network page...');

    await page.goto('https://www.linkedin.com/mynetwork/grow/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for page to load completely
    await page.waitForTimeout(5000);

    console.log(`📍 Current URL: ${page.url()}`);

    // Test all possible selectors for the "Show all" button
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
    ];

    console.log('🔍 Testing selectors:');

    let foundButton = null;
    for (const selector of seeAllSelectors) {
      try {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);

        console.log(
          `   ${selector}: ${isVisible ? '✅ Found' : '❌ Not found'}`
        );

        if (isVisible && !foundButton) {
          foundButton = selector;

          // Get button details
          const buttonText = await element.textContent();
          const ariaLabel = await element.getAttribute('aria-label');

          console.log(`      Text: "${buttonText?.trim()}"`);
          console.log(`      Aria-label: "${ariaLabel}"`);
        }
      } catch (error) {
        console.log(`   ${selector}: ❌ Error - ${error}`);
      }
    }

    if (foundButton) {
      console.log(`🎯 Best selector: ${foundButton}`);

      // Try to click the button
      console.log('🖱️  Attempting to click the button...');

      try {
        await page.locator(foundButton).first().click();
        console.log('✅ Button clicked successfully!');

        // Wait for modal or page change
        await page.waitForTimeout(3000);

        // Check for modal
        const modalSelectors = [
          '[data-testid="dialog"]',
          '[role="dialog"]',
          '.artdeco-modal',
          '.modal-dialog',
        ];

        let modalFound = false;
        for (const modalSelector of modalSelectors) {
          const hasModal = await page
            .locator(modalSelector)
            .isVisible()
            .catch(() => false);
          if (hasModal) {
            console.log(`✅ Modal found with selector: ${modalSelector}`);
            modalFound = true;

            // Check for connection cards
            const cards = await page.locator('[role="listitem"]').count();
            console.log(`📋 Found ${cards} connection cards in modal`);

            break;
          }
        }

        if (!modalFound) {
          console.log('⚠️  No modal detected, checking for page changes...');
          console.log(`📍 New URL: ${page.url()}`);
        }
      } catch (error) {
        console.error('❌ Failed to click button:', error);
      }
    } else {
      console.log('❌ No "Show all" button found with any selector');

      // Let's see what buttons are actually available
      console.log('🔍 Available buttons on page:');

      const allButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        return buttons.slice(0, 20).map((btn) => ({
          tagName: btn.tagName,
          text: btn.textContent?.trim().substring(0, 100),
          ariaLabel: btn.getAttribute('aria-label'),
          dataViewName: btn.getAttribute('data-view-name'),
          className: btn.className.substring(0, 100),
        }));
      });

      allButtons.forEach((btn, i) => {
        console.log(`   ${i + 1}. ${btn.tagName}: "${btn.text}"`);
        if (btn.ariaLabel) console.log(`      aria-label: "${btn.ariaLabel}"`);
        if (btn.dataViewName)
          console.log(`      data-view-name: "${btn.dataViewName}"`);
        console.log(`      class: "${btn.className}"`);
        console.log('');
      });
    }

    console.log('⏳ Keeping browser open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testShowAllButton()
    .then(() => {
      console.log('🏁 Show all button test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Test crashed:', error);
      process.exit(1);
    });
}
