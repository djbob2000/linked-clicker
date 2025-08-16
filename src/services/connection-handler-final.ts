import { BrowserService } from './browser-service';
import { Connection } from '../types/connection';
import {
  parseMutualConnectionCount,
  containsMutualConnectionInfo,
  extractConnectionName,
  generateConnectionId,
} from '../lib/linkedin-parser';
import { ElementHandle, Locator } from 'playwright';
import {
  ConnectionError,
  RetryManager,
  GracefulDegradation,
  ErrorContext,
} from '../lib/error-handling';

export interface ConnectionProcessingResult {
  success: boolean;
  connectionsProcessed: number;
  connectionsSuccessful: number;
  error?: string;
  partialFailures?: string[];
}

export interface ConnectionEligibilityResult {
  eligible: boolean;
  connection?: Connection;
  reason?: string;
}

export class ConnectionHandler {
  private browserService: BrowserService;

  constructor(browserService: BrowserService) {
    this.browserService = browserService;
  }

  /**
   * Process connections in the modal dialog with intelligent scroll detection
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async processConnections(
    minMutualConnections: number,
    maxConnections: number
  ): Promise<ConnectionProcessingResult> {
    ErrorContext.set('connectionProcessing', {
      minMutualConnections,
      maxConnections,
      startTime: new Date().toISOString(),
    });

    try {
      let connectionsProcessed = 0;
      let connectionsSuccessful = 0;
      const partialFailures: string[] = [];
      let processedCardIds = new Set<string>();
      let scrollAttempts = 0;
      const maxScrollAttempts = 5;

      console.log(
        `🎯 Starting connection processing: target ${maxConnections} connections, min ${minMutualConnections} mutual connections`
      );

      // Find and set up the correct scrollable container
      const scrollContainer = await this.findScrollContainer();
      if (!scrollContainer) {
        console.warn(
          '⚠️ Could not find scroll container, processing visible cards only'
        );
      } else {
        console.log('✅ Found scrollable container for infinite scroll');
      }

      // Main processing loop with intelligent scroll
      while (
        connectionsSuccessful < maxConnections &&
        scrollAttempts < maxScrollAttempts
      ) {
        console.log(
          `\n🔄 Processing batch ${
            scrollAttempts + 1
          }... (${connectionsSuccessful}/${maxConnections} connections made)`
        );

        // Get current batch of connection cards
        const connectionCards = await this.findConnectionCards();

        if (connectionCards.length === 0) {
          console.log('❌ No connection cards found, ending processing');
          break;
        }

        console.log(
          `📋 Found ${connectionCards.length} connection cards in current batch`
        );

        // Process cards in current batch
        let eligibleCardsInBatch = 0;
        let processedCardsInBatch = 0;

        for (
          let i = 0;
          i < connectionCards.length && connectionsSuccessful < maxConnections;
          i++
        ) {
          const cardElement = connectionCards[i];

          try {
            // Generate unique ID for this card to avoid reprocessing
            const cardId = await this.generateCardId(cardElement);

            if (processedCardIds.has(cardId)) {
              console.log(`⏭️ Skipping already processed card: ${cardId}`);
              continue;
            }

            processedCardIds.add(cardId);
            connectionsProcessed++;
            processedCardsInBatch++;

            ErrorContext.set('currentCard', connectionsProcessed);

            // Check eligibility and process card
            const result = await GracefulDegradation.withFallback(
              async () => {
                return await this.processIndividualCard(
                  cardElement,
                  minMutualConnections,
                  connectionsProcessed
                );
              },
              async () => {
                console.warn(
                  `⚠️ Skipping card ${connectionsProcessed} due to processing error`
                );
                return { success: false, reason: 'Processing error - skipped' };
              },
              (error) => {
                return (
                  !error.message.includes('critical') &&
                  !error.message.includes('fatal')
                );
              }
            );

            if (result.success) {
              connectionsSuccessful++;
              eligibleCardsInBatch++;
              console.log(
                `✅ Connection ${connectionsSuccessful}/${maxConnections} successful`
              );
            } else {
              partialFailures.push(
                `Card ${connectionsProcessed}: ${result.reason}`
              );
              console.log(`❌ Card ${connectionsProcessed}: ${result.reason}`);
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            partialFailures.push(
              `Card ${connectionsProcessed}: ${errorMessage}`
            );
            console.warn(
              `⚠️ Error processing connection card ${connectionsProcessed}:`,
              errorMessage
            );
            continue;
          }
        }

        console.log(
          `📊 Batch complete: ${processedCardsInBatch} cards processed, ${eligibleCardsInBatch} connections made`
        );

        // If we haven't reached the target, try to scroll for more cards
        if (connectionsSuccessful < maxConnections) {
          if (scrollContainer) {
            console.log('📜 Attempting to scroll for more cards...');
            const scrollResult = await this.intelligentScrollForMoreCards(
              scrollContainer
            );
            scrollAttempts++;

            if (!scrollResult) {
              console.log(
                '❌ No more cards available after scroll attempt, ending processing'
              );
              break;
            }

            // Wait for new cards to load
            console.log('⏳ Waiting for new cards to load...');
            await this.browserService.getPage().waitForTimeout(3000);
          } else {
            console.log('❌ No scroll container available, ending processing');
            break;
          }
        }
      }

      // Final result
      const result: ConnectionProcessingResult = {
        success: true,
        connectionsProcessed,
        connectionsSuccessful,
        partialFailures:
          partialFailures.length > 0 ? partialFailures : undefined,
      };

      console.log(
        `\n🎉 Processing complete: ${connectionsSuccessful}/${maxConnections} connections made from ${connectionsProcessed} cards processed`
      );

      if (connectionsSuccessful < maxConnections) {
        console.log(
          `ℹ️ Target not fully reached. This could be due to insufficient eligible candidates or reaching the end of available cards.`
        );
      }

      ErrorContext.set('connectionResult', result);
      return result;
    } catch (error) {
      const connectionError =
        error instanceof ConnectionError
          ? error
          : new ConnectionError(
              `Connection processing failed: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              true
            );

      return {
        success: false,
        connectionsProcessed: 0,
        connectionsSuccessful: 0,
        error: connectionError.message,
      };
    }
  }

  /**
   * Find the correct scrollable container in the LinkedIn modal window
   */
  private async findScrollContainer(): Promise<Locator | null> {
    try {
      const page = this.browserService.getPage();

      // First find the modal window
      const modal = page.locator('[data-testid="dialog"]').first();
      const modalExists = await modal.isVisible().catch(() => false);

      if (!modalExists) {
        console.warn('❌ Modal dialog not found');
        return null;
      }

      // Look for a scrollable container inside the modal window
      // LinkedIn uses different structures, so we check several variants
      const scrollSelectors = [
        // Main container with search results
        '.scaffold-finite-scroll__content',
        '.reusable-search__entity-result-list',
        '.search-results-container',
        // Containers with overflow
        '[style*="overflow-y: auto"]',
        '[style*="overflow: auto"]',
        '.overflow-y-auto',
        '.overflow-auto',
        // General list containers
        '[role="main"] .artdeco-list',
        '.artdeco-list__container',
      ];

      for (const selector of scrollSelectors) {
        try {
          const elements = await modal.locator(selector).all();

          for (const element of elements) {
            // Check if the element can be scrolled
            const canScroll = await element.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const hasOverflow =
                style.overflowY === 'auto' ||
                style.overflowY === 'scroll' ||
                style.overflow === 'auto' ||
                style.overflow === 'scroll';
              const hasScrollableContent = el.scrollHeight > el.clientHeight;

              return hasOverflow && hasScrollableContent;
            });

            if (canScroll) {
              console.log(`✅ Found scrollable container: ${selector}`);

              // Additional check - does it contain connection cards?
              const hasCards = await element
                .locator('[role="listitem"]')
                .first()
                .isVisible()
                .catch(() => false);
              if (hasCards) {
                console.log(`✅ Container has connection cards`);
                return element;
              }
            }
          }
        } catch (error) {
          // Continue searching
          continue;
        }
      }

      // If we didn't find a specific container, use the modal window itself
      const modalCanScroll = await modal.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const hasOverflow =
          style.overflowY === 'auto' || style.overflowY === 'scroll';
        const hasScrollableContent = el.scrollHeight > el.clientHeight;
        return hasOverflow && hasScrollableContent;
      });

      if (modalCanScroll) {
        console.log('✅ Using modal dialog as scroll container');
        return modal;
      }

      console.warn('❌ No scrollable container found');
      return null;
    } catch (error) {
      console.warn('⚠️ Error finding scroll container:', error);
      return null;
    }
  }

  /**
   * Smart scrolling only within the found container
   */
  private async intelligentScrollForMoreCards(
    scrollContainer: Locator
  ): Promise<boolean> {
    try {
      const page = this.browserService.getPage();

      // Get scroll information before scrolling
      const beforeScroll = await scrollContainer.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScrollMore: el.scrollTop < el.scrollHeight - el.clientHeight - 10,
      }));

      // Get card count before scrolling
      const cardsBefore = await page.locator('[role="listitem"]').all();
      const countBefore = cardsBefore.length;

      console.log(
        `📜 Intelligent scroll: ${beforeScroll.scrollTop}/${beforeScroll.scrollHeight} (${countBefore} cards, canScrollMore: ${beforeScroll.canScrollMore})`
      );

      if (!beforeScroll.canScrollMore) {
        console.log('❌ Cannot scroll more - already at bottom');
        return false;
      }

      // Save the main page scroll position
      const mainPageScrollBefore = await page.evaluate(() => window.scrollY);

      // Scroll only this container
      await scrollContainer.evaluate((el) => {
        // Scroll by the height of the visible area
        const scrollAmount = Math.min(
          el.clientHeight * 0.8,
          el.scrollHeight - el.scrollTop - el.clientHeight
        );
        el.scrollTop += scrollAmount;
      });

      // Wait for new cards to load
      await page.waitForTimeout(4000);

      // Check the result
      const afterScroll = await scrollContainer.evaluate((el) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));

      const cardsAfter = await page.locator('[role="listitem"]').all();
      const countAfter = cardsAfter.length;
      const newCards = countAfter - countBefore;

      // Check that the main page didn't scroll
      const mainPageScrollAfter = await page.evaluate(() => window.scrollY);
      const mainPageMoved = mainPageScrollAfter !== mainPageScrollBefore;

      console.log(
        `📜 After intelligent scroll: ${afterScroll.scrollTop}/${afterScroll.scrollHeight} (${countAfter} cards, +${newCards} new)`
      );

      if (mainPageMoved) {
        console.warn(
          `⚠️ Main page scrolled unexpectedly: ${mainPageScrollBefore} → ${mainPageScrollAfter}`
        );
      }

      // Successful if scroll position changed or new cards appeared
      const scrolled = afterScroll.scrollTop > beforeScroll.scrollTop;
      const gotNewCards = newCards > 0;

      if (scrolled && gotNewCards && !mainPageMoved) {
        console.log(
          `✅ Intelligent scroll successful! Loaded ${newCards} new cards`
        );
        return true;
      } else if (scrolled && !gotNewCards) {
        console.log('⚠️ Scrolled but no new cards loaded - might be at end');
        return false;
      } else if (mainPageMoved) {
        console.log('❌ Scroll failed - main page moved instead of modal');
        return false;
      } else {
        console.log('❌ Intelligent scroll failed - position unchanged');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Error in intelligent scroll:', error);
      return false;
    }
  }

  /**
   * Process an individual connection card with error handling
   */
  private async processIndividualCard(
    cardElement: ElementHandle,
    minMutualConnections: number,
    cardIndex: number
  ): Promise<{ success: boolean; reason?: string }> {
    const result = await RetryManager.withRetry(
      async () => {
        // Check if this connection is eligible
        const eligibilityResult = await this.checkConnectionEligibility(
          cardElement,
          minMutualConnections
        );

        if (!eligibilityResult.eligible) {
          return {
            success: false,
            reason: eligibilityResult.reason || 'Not eligible',
          };
        }

        if (!eligibilityResult.connection) {
          return {
            success: false,
            reason: 'Connection data not available',
          };
        }

        // Requirement 3.4: Click the "Connect" button for eligible candidates
        const connectionResult = await this.connectWithPerson(
          eligibilityResult.connection
        );

        if (!connectionResult) {
          return {
            success: false,
            reason: 'Failed to connect',
          };
        }

        // Requirement 3.5: Log the action and increment counter
        console.log(
          `🤝 Successfully connected with ${eligibilityResult.connection.name} (${eligibilityResult.connection.mutualConnectionsCount} mutual connections)`
        );

        return { success: true };
      },
      {
        maxAttempts: 2,
        baseDelay: 1000,
        retryCondition: (error) => {
          return (
            error.message.includes('timeout') ||
            error.message.includes('click') ||
            error.message.includes('element')
          );
        },
      }
    );

    if (!result.success) {
      return {
        success: false,
        reason: result.error?.message || 'Processing failed',
      };
    }

    return result.result!;
  }

  /**
   * Find all connection cards in the modal (current visible batch)
   */
  private async findConnectionCards(): Promise<ElementHandle[]> {
    try {
      const page = this.browserService.getPage();

      // Wait for connection cards to load
      await this.browserService.waitForElement('[role="listitem"]', {
        visible: true,
        timeout: 10000,
      });

      // Get all currently visible connection cards
      const cardElements = await page.$$('[role="listitem"]');

      console.log(
        `📋 Found ${cardElements.length} connection cards in current view`
      );
      return cardElements;
    } catch (error) {
      console.warn('⚠️ No connection cards found:', error);
      return [];
    }
  }

  /**
   * Generate a unique ID for a connection card to avoid reprocessing
   */
  private async generateCardId(cardElement: ElementHandle): Promise<string> {
    try {
      // Try to get a unique identifier from the card
      const cardText = await cardElement.textContent();
      const name = extractConnectionName(cardText || '');

      // Use name + position as unique identifier
      const boundingBox = await cardElement.boundingBox();
      const position = boundingBox
        ? `${Math.round(boundingBox.x)}-${Math.round(boundingBox.y)}`
        : 'unknown';

      return `${name || 'unknown'}-${position}`;
    } catch (error) {
      // Fallback to a random ID
      return `card-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Check if a connection card is eligible for connection
   */
  private async checkConnectionEligibility(
    cardElement: ElementHandle,
    minMutualConnections: number
  ): Promise<ConnectionEligibilityResult> {
    try {
      // Get all text content from the card
      const cardText = await cardElement.textContent();

      if (!cardText) {
        return {
          eligible: false,
          reason: 'No text content found in card',
        };
      }

      console.log(`\n📋 Checking card: "${cardText.substring(0, 100)}..."`);

      // Extract connection name
      const connectionName = extractConnectionName(cardText);
      if (!connectionName) {
        return {
          eligible: false,
          reason: 'Could not extract connection name',
        };
      }

      console.log(`👤 Name: ${connectionName}`);

      // Look for mutual connections text
      const mutualConnectionsText = await this.extractMutualConnectionsText(
        cardElement
      );

      if (!mutualConnectionsText) {
        return {
          eligible: false,
          reason: 'No mutual connections text found',
        };
      }

      console.log(`🔗 Mutual connections text: "${mutualConnectionsText}"`);

      // Parse the number of mutual connections
      const mutualConnectionsCount = parseMutualConnectionCount(
        mutualConnectionsText
      );

      console.log(
        `🔢 Parsed mutual connections count: ${mutualConnectionsCount}`
      );

      // Create connection object
      const connection: Connection = {
        id: generateConnectionId(connectionName),
        name: connectionName,
        mutualConnectionsCount,
        cardElement,
      };

      // Check if meets minimum mutual connections threshold
      if (mutualConnectionsCount < minMutualConnections) {
        console.log(
          `❌ Not eligible: ${mutualConnectionsCount} < ${minMutualConnections} (minimum)`
        );
        return {
          eligible: false,
          connection,
          reason: `Only ${mutualConnectionsCount} mutual connections (minimum: ${minMutualConnections})`,
        };
      }

      // Check if Connect button is available
      const hasConnectButton = await this.hasConnectButton(cardElement);
      if (!hasConnectButton) {
        console.log(`❌ Not eligible: No Connect button available`);
        return {
          eligible: false,
          connection,
          reason: 'No Connect button available',
        };
      }

      console.log(
        `✅ Eligible: ${mutualConnectionsCount} >= ${minMutualConnections} mutual connections`
      );

      return {
        eligible: true,
        connection,
      };
    } catch (error) {
      return {
        eligible: false,
        reason: `Error checking eligibility: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Extract mutual connections text from a connection card
   */
  private async extractMutualConnectionsText(
    cardElement: ElementHandle
  ): Promise<string | null> {
    try {
      // Get all text content from the card first
      const allText = await cardElement.textContent();

      if (!allText) {
        console.log('No text content found in card');
        return null;
      }

      // Look for mutual connections pattern in the full text
      if (containsMutualConnectionInfo(allText)) {
        // Extract the line containing mutual connections info
        const lines = allText.split('\n').map((line) => line.trim());
        for (const line of lines) {
          if (containsMutualConnectionInfo(line)) {
            console.log(`Found mutual connections text: "${line}"`);
            return line;
          }
        }

        // If we found mutual connection info but not in individual lines,
        // try to extract from the full text
        const mutualConnectionRegex =
          /([^.]*(?:and\s+\d+\s+other\s+mutual\s+connections?|mutual\s+connections?)[^.]*)/i;
        const match = allText.match(mutualConnectionRegex);
        if (match) {
          const extractedText = match[1].trim();
          console.log(`Extracted mutual connections text: "${extractedText}"`);
          return extractedText;
        }
      }

      console.log('No mutual connections information found in card');
      return null;
    } catch (error) {
      console.warn('⚠️ Error extracting mutual connections text:', error);
      return null;
    }
  }

  /**
   * Check if a connection card has a Connect button
   */
  private async hasConnectButton(cardElement: ElementHandle): Promise<boolean> {
    try {
      const connectButtonSelectors = [
        'button:has-text("Connect")',
        'button[aria-label*="Connect"]',
        'button[data-test-id*="connect"]',
        '.artdeco-button:has-text("Connect")',
        '[data-control-name*="connect"]',
      ];

      for (const selector of connectButtonSelectors) {
        try {
          const button = await cardElement.$(selector);
          if (button) {
            // Check if button is visible and enabled
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();
            if (isVisible && isEnabled) {
              return true;
            }
          }
        } catch {
          // Continue to next selector
          continue;
        }
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Error checking for Connect button:', error);
      return false;
    }
  }

  /**
   * Connect with a person by clicking their Connect button
   */
  private async connectWithPerson(connection: Connection): Promise<boolean> {
    try {
      const connectButtonSelectors = [
        'button:has-text("Connect")',
        'button[aria-label*="Connect"]',
        'button[data-test-id*="connect"]',
        '.artdeco-button:has-text("Connect")',
        '[data-control-name*="connect"]',
      ];

      for (const selector of connectButtonSelectors) {
        try {
          const button = await connection.cardElement.$(selector);
          if (button) {
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();

            if (isVisible && isEnabled) {
              console.log(
                `🖱️ Clicking Connect button for ${connection.name}...`
              );
              await button.click();

              // Wait a moment for the action to process
              await this.browserService.getPage().waitForTimeout(1000);

              // Check if a "Send now" or similar confirmation button appears
              await this.handleConnectionConfirmation();

              // Add 5 second delay between Connect button clicks as requested
              console.log(
                '⏳ Waiting 5 seconds before next connection attempt...'
              );
              await this.browserService.getPage().waitForTimeout(5000);

              return true;
            }
          }
        } catch {
          // Continue to next selector
          continue;
        }
      }

      throw new Error('Could not find or click Connect button');
    } catch (error) {
      console.warn(
        `⚠️ Failed to connect with ${connection.name}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    }
  }

  /**
   * Handle connection confirmation dialog if it appears
   */
  private async handleConnectionConfirmation(): Promise<void> {
    try {
      const page = this.browserService.getPage();

      // Common confirmation button selectors
      const confirmationSelectors = [
        'button:has-text("Send now")',
        'button:has-text("Send")',
        'button[aria-label*="Send"]',
        'button[data-test-id*="send"]',
        '.artdeco-button--primary:has-text("Send")',
      ];

      // Wait briefly for confirmation dialog to appear
      await page.waitForTimeout(500);

      for (const selector of confirmationSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();

            if (isVisible && isEnabled) {
              console.log('📤 Clicking confirmation button...');
              await button.click();
              // Wait for confirmation to process
              await page.waitForTimeout(1000);
              return;
            }
          }
        } catch {
          // Continue to next selector
          continue;
        }
      }

      // No confirmation dialog found, which is fine
    } catch (error) {
      console.warn('⚠️ Error handling connection confirmation:', error);
      // Don't throw error as this is optional
    }
  }

  /**
   * Get the current count of processed connections from the UI
   */
  async getCurrentConnectionCount(): Promise<number> {
    try {
      return 0;
    } catch {
      return 0;
    }
  }
}
