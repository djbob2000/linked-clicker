import { BrowserService } from './browser-service';
import { Connection } from '../types/connection';
import {
  parseMutualConnectionCount,
  containsMutualConnectionInfo,
  extractConnectionName,
  generateConnectionId,
} from '../lib/linkedin-parser';
import { ElementHandle } from 'playwright';
import {
  ConnectionError,
  RetryManager,
  GracefulDegradation,
  ErrorContext,
} from '../lib/error-handling';

// Load environment variables with proper fallback and validation
const CONNECTION_DELAY_MS = (() => {
  const envValue = process.env.CONNECTION_DELAY_MS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    console.warn(`Invalid CONNECTION_DELAY_MS value: ${envValue}, using default 5000ms`);
  }
  return 5000; // Default 5 seconds
})();

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
   * Process connections in the modal dialog with infinite scroll support
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   * Implements graceful degradation for partial failures
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
      const processedCardIds = new Set<string>(); // Track processed cards to avoid duplicates

      console.log(
        `Starting connection processing: target ${maxConnections} connections, min ${minMutualConnections} mutual connections`
      );

      // Main processing loop with infinite scroll
      while (connectionsSuccessful < maxConnections) {
        console.log(
          `\n🔄 Processing batch... (${connectionsSuccessful}/${maxConnections} connections made)`
        );

        // Get current batch of connection cards
        const connectionCards = await this.findConnectionCards();

        if (connectionCards.length === 0) {
          console.log('No connection cards found, ending processing');
          break;
        }

        console.log(
          `Found ${connectionCards.length} connection cards in current batch`
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
              console.log(`Skipping already processed card: ${cardId}`);
              continue;
            }

            processedCardIds.add(cardId);
            connectionsProcessed++;
            processedCardsInBatch++;

            ErrorContext.set('currentCard', connectionsProcessed);

            // Check eligibility and process card
            const result = await GracefulDegradation.withFallback(
              // Primary: Full processing
              async () => {
                return await this.processIndividualCard(
                  cardElement,
                  minMutualConnections,
                  connectionsProcessed
                );
              },
              // Fallback: Skip card and continue
              async () => {
                console.warn(
                  `Skipping card ${connectionsProcessed} due to processing error`
                );
                return { success: false, reason: 'Processing error - skipped' };
              },
              // Condition: fallback for non-critical errors
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
              `Error processing connection card ${connectionsProcessed}:`,
              errorMessage
            );
            continue;
          }
        }

        console.log(
          `Batch complete: ${processedCardsInBatch} cards processed, ${eligibleCardsInBatch} connections made`
        );

        // If we haven't reached the target and no eligible cards were found in this batch, scroll for more
        if (connectionsSuccessful < maxConnections) {
          if (eligibleCardsInBatch === 0 && processedCardsInBatch > 0) {
            console.log(
              'No eligible cards in current batch, scrolling for more...'
            );
          } else if (processedCardsInBatch === 0) {
            console.log('No new cards found, ending processing');
            break;
          } else {
            console.log('Continuing to next batch...');
          }

          // Scroll to load more cards
          const scrollResult = await this.scrollForMoreCards();
          if (!scrollResult) {
            console.log('No more cards available, ending processing');
            break;
          }

          // Wait for new cards to load
          await this.browserService.getPage().waitForTimeout(2000);
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
        `\n🎯 Processing complete: ${connectionsSuccessful}/${maxConnections} connections made from ${connectionsProcessed} cards processed`
      );

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
          `Successfully connected with ${eligibilityResult.connection.name} (${eligibilityResult.connection.mutualConnectionsCount} mutual connections)`
        );

        return { success: true };
      },
      {
        maxAttempts: 2,
        baseDelay: 1000,
        retryCondition: (error) => {
          // Retry for transient connection issues
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
   * Find all connection cards in the modal
   * Requirement 3.1: WHEN the modal dialog opens THEN the system SHALL identify all cards with role="listitem"
   */
  private async findConnectionCards(): Promise<ElementHandle[]> {
    try {
      // Wait for connection cards to load
      await this.browserService.waitForElement('[role="listitem"]', {
        visible: true,
        timeout: 10000,
      });

      // Get all connection cards
      const page = this.browserService.getPage();
      const cardElements = await page.$$('[role="listitem"]');

      console.log(
        `Found ${cardElements.length} connection cards in current view`
      );
      return cardElements || [];
    } catch (error) {
      console.warn('No connection cards found:', error);
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
   * Scroll the modal to load more connection cards
   * Uses smart scrolling approach to find the correct scrollable container
   */
  private async scrollForMoreCards(): Promise<boolean> {
    try {
      const page = this.browserService.getPage();

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
          if (modalElement) break;
        } catch {
          continue;
        }
      }

      if (!modalElement) {
        console.warn('Could not find modal element for scrolling');
        return false;
      }

      // Find the scrollable container within the modal
      const scrollContainer = await this.findScrollContainer(modalElement);
      if (!scrollContainer) {
        console.warn('Could not find scrollable container in modal');
        return false;
      }

      // Get current card count before scrolling
      const cardsBefore = await page.$('[role="listitem"]');
      const countBefore = cardsBefore.length;

      console.log(
        `Scrolling modal... (${countBefore} cards currently visible)`
      );

      // Get scroll information before scrolling
      const beforeScroll = await scrollContainer.evaluate((el: HTMLElement) => ({
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        canScrollMore: el.scrollTop < el.scrollHeight - el.clientHeight - 10,
      }));

      console.log(
        `📜 Scroll info: ${beforeScroll.scrollTop}/${beforeScroll.scrollHeight} (canScrollMore: ${beforeScroll.canScrollMore})`
      );

      if (!beforeScroll.canScrollMore) {
        console.log('❌ Cannot scroll more - already at bottom');
        return false;
      }

      // Scroll the container by its client height
      await scrollContainer.evaluate((el: HTMLElement) => {
        const scrollAmount = Math.min(
          el.clientHeight,
          el.scrollHeight - el.scrollTop - el.clientHeight
        );
        el.scrollTop += scrollAmount;
      });

      // Wait for new content to load (increased timeout)
      await page.waitForTimeout(4000);

      // Check if new cards were loaded
      const cardsAfter = await page.$('[role="listitem"]');
      const countAfter = cardsAfter.length;

      console.log(
        `After scroll: ${countAfter} cards visible (${
          countAfter - countBefore
        } new cards)`
      );

      // Return true if new cards were loaded or position changed
      const scrolled = await scrollContainer.evaluate(
        (el: HTMLElement) => el.scrollTop > beforeScroll.scrollTop
      );
      return scrolled || countAfter > countBefore;
    } catch (error) {
      console.warn('Error scrolling for more cards:', error);
      return false;
    }
  }

  /**
   * Find the scrollable container within the modal
   */
  private async findScrollContainer(modal: ElementHandle): Promise<ElementHandle | null> {
    try {
      // LinkedIn-specific scrollable containers
      const scrollSelectors = [
        // Main scrollable content container
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
        // Fallback selectors
        '.artdeco-modal__content',
        '.modal__content',
        '.relative > div > div', // Common structure in LinkedIn modals
      ];

      // First try to find specific scrollable containers
      for (const selector of scrollSelectors) {
        try {
          const elements = await modal.$(selector);
          for (const element of elements) {
            // Check if element can scroll
            const canScroll = await element.evaluate((el: HTMLElement) => {
              // For elements with explicit overflow styles
              const style = window.getComputedStyle(el);
              const hasExplicitOverflow = 
                style.overflowY === 'auto' || 
                style.overflowY === 'scroll' ||
                style.overflow === 'auto' ||
                style.overflow === 'scroll';
              
              // For elements that are naturally scrollable
              const hasScrollableContent = el.scrollHeight > el.clientHeight;
              const hasHeightSet = el.clientHeight > 0;
              
              return (hasExplicitOverflow && hasScrollableContent) || 
                     (hasScrollableContent && hasHeightSet && el.scrollHeight > 200); // Minimum height threshold
            });

            if (canScroll) {
              console.log(`✅ Found scrollable container: ${selector}`);
              // Check if container has connection cards
              const hasCards = await element.$('[role="listitem"]');
              if (hasCards) {
                console.log(`✅ Container has connection cards`);
                return element;
              }
            }
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      // If no specific container found, try to find any container with cards
      console.log('🔍 Looking for any container with connection cards...');
      try {
        const containersWithCards = await modal.$('.artdeco-list, [role="list"], div');
        if (containersWithCards && Array.isArray(containersWithCards)) {
          for (const container of containersWithCards) {
            try {
              // Check if this container has connection cards
              const cards = await container.$('.artdeco-list-item, [role="listitem"]');
              if (cards.length > 0) {
                // Check if container is scrollable
                const isScrollable = await container.evaluate((el: HTMLElement) => {
                  const style = window.getComputedStyle(el);
                  const hasOverflow = 
                    style.overflowY === 'auto' || 
                    style.overflowY === 'scroll' ||
                    style.overflow === 'auto' ||
                    style.overflow === 'scroll';
                  const hasScrollableContent = el.scrollHeight > el.clientHeight;
                  return (hasOverflow && hasScrollableContent) || el.scrollHeight > el.clientHeight + 50;
                });
                
                if (isScrollable) {
                  console.log('✅ Found scrollable container with connection cards (generic match)');
                  return container;
                }
              }
            } catch {
              continue;
            }
          }
        }
      } catch (error) {
        console.warn('Error searching for containers with cards:', error);
      }

      // Last resort: use the modal itself if it can scroll
      const modalCanScroll = await modal.evaluate((el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        const hasOverflow =
          style.overflowY === 'auto' || style.overflowY === 'scroll';
        const hasScrollableContent = el.scrollHeight > el.clientHeight;
        return hasOverflow && hasScrollableContent;
      });

      if (modalCanScroll) {
        console.log('✅ Using modal dialog as scroll container (fallback)');
        return modal;
      }

      console.warn('❌ No scrollable container found');
      return null;
    } catch (error) {
      console.warn('Error finding scroll container:', error);
      return null;
    }
  }

  /**
   * Check if a connection card is eligible for connection
   * Requirements: 3.2, 3.3
   */
  private async checkConnectionEligibility(
    cardElement: ElementHandle,
    minMutualConnections: number
  ): Promise<ConnectionEligibilityResult> {
    try {
      // Requirement 3.2: Extract text from paragraph with mutual connections information
      const mutualConnectionsText = await this.extractMutualConnectionsText(
        cardElement
      );

      if (!mutualConnectionsText) {
        return {
          eligible: false,
          reason: 'No mutual connections text found',
        };
      }

      // Requirement 3.3: Parse the number of mutual connections using regex pattern
      const mutualConnectionsCount = parseMutualConnectionCount(
        mutualConnectionsText
      );

      // Extract connection name and other details
      const cardText = await cardElement.textContent();
      const connectionName = extractConnectionName(cardText || '');

      if (!connectionName) {
        return {
          eligible: false,
          reason: 'Could not extract connection name',
        };
      }

      // Create connection object
      const connection: Connection = {
        id: generateConnectionId(connectionName),
        name: connectionName,
        mutualConnectionsCount,
        cardElement,
      };

      // Check if meets minimum mutual connections threshold
      if (mutualConnectionsCount < minMutualConnections) {
        return {
          eligible: false,
          connection,
          reason: `Only ${mutualConnectionsCount} mutual connections (minimum: ${minMutualConnections})`,
        };
      }

      // Check if Connect button is available
      const hasConnectButton = await this.hasConnectButton(cardElement);
      if (!hasConnectButton) {
        return {
          eligible: false,
          connection,
          reason: 'No Connect button available',
        };
      }

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
   * Requirement 3.2: WHEN processing each card THEN the system SHALL extract text from paragraph with classes containing mutual connections information
   */
  private async extractMutualConnectionsText(
    cardElement: ElementHandle
  ): Promise<string | null> {
    try {
      // Common selectors for mutual connections text in LinkedIn cards
      const mutualConnectionSelectors = [
        'p:has-text("mutual connection")',
        'p:has-text("other mutual")',
        'span:has-text("mutual connection")',
        'div:has-text("mutual connection")',
        '.artdeco-entity-lockup__subtitle:has-text("mutual")',
        '.artdeco-entity-lockup__caption:has-text("mutual")',
        '[data-test-id*="mutual"]',
        'p', // Fallback to all paragraphs
      ];

      for (const selector of mutualConnectionSelectors) {
        try {
          const elements = await cardElement.$$(selector);

          for (const element of elements) {
            const text = await element.textContent();
            if (text && containsMutualConnectionInfo(text)) {
              return text.trim();
            }
          }
        } catch {
          // Continue to next selector
          continue;
        }
      }

      // Fallback: get all text content and search for mutual connections
      const allText = await cardElement.textContent();
      if (allText && containsMutualConnectionInfo(allText)) {
        // Extract the line containing mutual connections info
        const lines = allText.split('\n').map((line) => line.trim());
        for (const line of lines) {
          if (containsMutualConnectionInfo(line)) {
            return line;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Error extracting mutual connections text:', error);
      return null;
    }
  }

  /**
   * Check if a connection card has a Connect button
   * Scrolls the card into view before checking
   */
  private async hasConnectButton(cardElement: ElementHandle): Promise<boolean> {
    try {
      // Scroll the card into view before checking for the button
      await this.scrollCardIntoView(cardElement);

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
      console.warn('Error checking for Connect button:', error);
      return false;
    }
  }

  /**
   * Scroll a connection card into view
   */
  private async scrollCardIntoView(cardElement: ElementHandle): Promise<void> {
    try {
      // Use the browser service's scrollIntoViewIfNeeded method
      // This ensures the element is scrolled into the visible area of its scrollable ancestor
      await cardElement.scrollIntoViewIfNeeded();
      
      // Wait a moment for the scroll to complete
      await this.browserService.getPage().waitForTimeout(500);
    } catch (error) {
      console.warn('Error scrolling card into view:', error);
      // Don't throw error as this is optional
    }
  }

  /**
   * Connect with a person by clicking their Connect button
   * Requirement 3.4: IF the mutual connections count is greater than the threshold THEN the system SHALL click the "Connect" button in that card
   */
  private async connectWithPerson(connection: Connection): Promise<boolean> {
    try {
      // Scroll the card into view before attempting to click
      await this.scrollCardIntoView(connection.cardElement);

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
              await button.click();

              // Wait a moment for the action to process
              await this.browserService.getPage().waitForTimeout(1000);

              // Check if a "Send now" or similar confirmation button appears
              await this.handleConnectionConfirmation();

              // Add delay between Connect button clicks as configured in environment
              console.log(
                `Waiting ${CONNECTION_DELAY_MS / 1000} seconds before next connection attempt...`
              );
              await this.browserService.getPage().waitForTimeout(CONNECTION_DELAY_MS);

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
        `Failed to connect with ${connection.name}:`,
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
      console.warn('Error handling connection confirmation:', error);
      // Don't throw error as this is optional
    }
  }

  /**
   * Get the current count of processed connections from the UI
   */
  async getCurrentConnectionCount(): Promise<number> {
    try {
      // This would typically parse connection count from LinkedIn's UI
      // For now, return 0 as this would be tracked by the calling service
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Finds eligible connections based on mutual connection criteria
   * Requirements: 3.4
   */
  async findEligibleConnections(minMutualConnections: number, maxConnections: number): Promise<Connection[]> {
    // This would implement the logic to find eligible connections
    // For now, return empty array as this is a placeholder
    return [];
  }
}
