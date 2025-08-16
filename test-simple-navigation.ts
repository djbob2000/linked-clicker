#!/usr/bin/env tsx

/**
 * Simple navigation test to verify LinkedIn access
 */

import dotenv from 'dotenv';
import { chromium } from 'playwright';

// Load environment variables
dotenv.config();

async function testSimpleNavigation() {
  console.log('🔍 Testing simple LinkedIn navigation...');

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
    console.log('🌐 Navigating to LinkedIn...');

    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log(`✅ Navigation successful! URL: ${page.url()}`);

    // Check if login form is present
    const hasUsernameField = await page
      .locator('#username')
      .isVisible()
      .catch(() => false);
    const hasPasswordField = await page
      .locator('#password')
      .isVisible()
      .catch(() => false);

    console.log(
      `🔐 Username field: ${hasUsernameField ? '✅ Found' : '❌ Not found'}`
    );
    console.log(
      `🔐 Password field: ${hasPasswordField ? '✅ Found' : '❌ Not found'}`
    );

    if (hasUsernameField && hasPasswordField) {
      console.log('🎯 Login form detected - ready for automation!');

      // Try to fill credentials if available
      const username = process.env.LINKEDIN_USERNAME;
      const password = process.env.LINKEDIN_PASSWORD;

      if (username && password) {
        console.log('🔑 Filling credentials...');

        await page.fill('#username', username);
        await page.fill('#password', password);

        console.log('✅ Credentials filled');

        // Find and click submit button
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible()) {
          console.log('🚀 Clicking submit...');
          await submitButton.click();

          // Wait for navigation
          await page.waitForTimeout(5000);

          console.log(`📍 After login URL: ${page.url()}`);

          // Check if we're logged in
          const isLoggedIn =
            page.url().includes('/feed/') ||
            page.url().includes('/in/') ||
            !page.url().includes('/login');

          if (isLoggedIn) {
            console.log('✅ Login successful!');

            // Try to navigate to network page
            console.log('🌐 Navigating to network page...');

            await page.goto('https://www.linkedin.com/mynetwork/', {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });

            await page.waitForTimeout(3000);

            console.log(`📍 Network page URL: ${page.url()}`);

            // Check for "See All" or similar buttons
            const seeAllButtons = await page.evaluate(() => {
              const buttons = Array.from(
                document.querySelectorAll('button, a')
              );
              return buttons
                .filter(
                  (btn) =>
                    btn.textContent?.toLowerCase().includes('see all') ||
                    btn.textContent?.toLowerCase().includes('see more')
                )
                .map((btn) => ({
                  text: btn.textContent?.trim(),
                  tagName: btn.tagName,
                  className: btn.className,
                }));
            });

            console.log('🔍 Found "See All" buttons:', seeAllButtons);
          } else {
            console.log('❌ Login failed or requires additional verification');
          }
        }
      }
    }

    console.log('⏳ Keeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testSimpleNavigation()
    .then(() => {
      console.log('🏁 Simple navigation test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Test crashed:', error);
      process.exit(1);
    });
}
