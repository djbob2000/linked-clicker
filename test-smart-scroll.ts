import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

async function testSmartScroll() {
  console.log('🚀 Testing smart scroll of LinkedIn modal window');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  try {
    const page = await browser.newPage();

    // Navigate to LinkedIn
    console.log('📱 Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/login');

    // Wait for manual login
    console.log(
      '🔐 Please log into LinkedIn and navigate to the people search page'
    );
    console.log(
      '📋 Open the "See all" modal window and press Enter in the console...'
    );

    // Wait for Enter key press
    await new Promise((resolve) => {
      process.stdin.once('data', () => resolve(undefined));
    });

    console.log('\n🔍 Looking for scrollable container...');

    // Find the modal window
    const modal = await page.$('[data-testid="dialog"]');
    if (!modal) {
      console.error('❌ Modal window not found');
      return;
    }

    console.log('✅ Modal window found');

    // Find scrollable container
    const scrollContainer = await findScrollContainer(page, modal);

    if (!scrollContainer) {
      console.error('❌ Scrollable container not found');
      return;
    }

    console.log('✅ Scrollable container found');

    // Test scrolling
    await testScrolling(page, scrollContainer);
  } catch (error) {
    console.error('❌ Error in test:', error);
  } finally {
    console.log(
      '\n🔄 Browser will remain open for result verification. Close manually when finished.'
    );
  }
}

async function findScrollContainer(page: any, modal: any) {
  const scrollSelectors = [
    '.scaffold-finite-scroll__content',
    '.reusable-search__entity-result-list',
    '.search-results-container',
    '[style*="overflow-y: auto"]',
    '[style*="overflow: auto"]',
    '.overflow-y-auto',
    '.overflow-auto',
  ];

  for (const selector of scrollSelectors) {
    try {
      const elements = await modal.$$(selector);

      for (const element of elements) {
        // Check if the element can be scrolled
        const scrollInfo = await element.evaluate((el: HTMLElement) => {
          const style = window.getComputedStyle(el);
          const hasOverflow =
            style.overflowY === 'auto' ||
            style.overflowY === 'scroll' ||
            style.overflow === 'auto' ||
            style.overflow === 'scroll';
          const hasScrollableContent = el.scrollHeight > el.clientHeight;

          return {
            hasOverflow,
            hasScrollableContent,
            canScroll: hasOverflow && hasScrollableContent,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollTop: el.scrollTop,
          };
        });

        console.log(`📊 Checking ${selector}:`, scrollInfo);

        if (scrollInfo.canScroll) {
          // Additional check - does it contain connection cards?
          const hasCards = await element.$('[role="listitem"]');
          if (hasCards) {
            console.log(
              `✅ Found scrollable container with cards: ${selector}`
            );
            return element;
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️ Error checking ${selector}:`, error.message);
      continue;
    }
  }

  // If we didn't find a specific container, check the modal window itself
  const modalScrollInfo = await modal.evaluate((el: HTMLElement) => {
    const style = window.getComputedStyle(el);
    const hasOverflow =
      style.overflowY === 'auto' || style.overflowY === 'scroll';
    const hasScrollableContent = el.scrollHeight > el.clientHeight;
    return {
      hasOverflow,
      hasScrollableContent,
      canScroll: hasOverflow && hasScrollableContent,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  });

  console.log('📊 Checking modal window:', modalScrollInfo);

  if (modalScrollInfo.canScroll) {
    console.log('✅ Using modal window as scrollable container');
    return modal;
  }

  return null;
}

async function testScrolling(page: any, scrollContainer: any) {
  console.log('\n🧪 Starting scroll test...');

  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Scroll test ${i} ---`);

    // Get state before scrolling
    const beforeScroll = await scrollContainer.evaluate((el: HTMLElement) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    const cardsBefore = await page.$$('[role="listitem"]');

    console.log(
      `📊 Before scroll: ${beforeScroll.scrollTop}/${beforeScroll.scrollHeight} (${cardsBefore.length} cards)`
    );

    // Check main page scroll position
    const mainPageScrollBefore = await page.evaluate(() => window.scrollY);
    console.log(`📍 Main page scroll before: ${mainPageScrollBefore}`);

    // Scroll the container
    await scrollContainer.evaluate((el: HTMLElement) => {
      const scrollAmount = Math.min(
        el.clientHeight,
        el.scrollHeight - el.scrollTop - el.clientHeight
      );
      console.log(`Scrolling by ${scrollAmount}px`);
      el.scrollTop += scrollAmount;
    });

    // Wait for loading
    await page.waitForTimeout(3000);

    // Get state after scrolling
    const afterScroll = await scrollContainer.evaluate((el: HTMLElement) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    const cardsAfter = await page.$$('[role="listitem"]');
    const mainPageScrollAfter = await page.evaluate(() => window.scrollY);

    console.log(
      `📊 After scroll: ${afterScroll.scrollTop}/${afterScroll.scrollHeight} (${cardsAfter.length} cards)`
    );
    console.log(`📍 Main page scroll after: ${mainPageScrollAfter}`);

    // Analyze results
    const scrolled = afterScroll.scrollTop > beforeScroll.scrollTop;
    const newCards = cardsAfter.length - cardsBefore.length;
    const mainPageMoved = mainPageScrollAfter !== mainPageScrollBefore;

    console.log(`✅ Container scrolled: ${scrolled}`);
    console.log(`📈 New cards: ${newCards}`);
    console.log(`⚠️ Main page moved: ${mainPageMoved}`);

    if (scrolled && !mainPageMoved) {
      console.log('🎉 Scrolling works correctly!');
    } else if (mainPageMoved) {
      console.log('❌ PROBLEM: Main page scrolled!');
    } else if (!scrolled) {
      console.log('⚠️ Container did not scroll - possibly reached the end');
      break;
    }

    await page.waitForTimeout(2000);
  }
}

// Run the test
testSmartScroll().catch(console.error);