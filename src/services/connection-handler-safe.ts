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
   * Process connections in the modal dialog with safe infinite scroll
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
      let processedCardIds = new Set<string>(); // Track processed cards to avoid duplicates
      let scrollAttempts = 0;
      const maxScrollAttempts = 3; // Limit scroll attempts to avoid infinite loops

      console.log(
        `Starting connection processing: target ${maxConnections} connections, min ${minMutualConnections} mutual connections`
      );

      // Main processing loop with safe infinite scroll
      while (
        connectionsSuccessful < maxConnections &&
        scrollAttempts < maxScrollAttempts
      ) {
        console.log(
          `\n🔄 Processing batch... (${connectionsSuccessful}/${maxConnections} connections made, scroll attempt ${
            scrollAttempts + 1
          }/${maxScrollAttempts})`
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

        // If we haven't reached the target, try to scroll for more cards
        if (connectionsSuccessful < maxConnections) {
          if (eligibleCardsInBatch === 0 && processedCardsInBatch > 0) {
            console.log(
              'No eligible cards in current batch, trying to scroll for more...'
            );
          } else if (processedCardsInBatch === 0) {
            console.log('No new cards found, ending processing');
            break;
          } else {
            console.log(
              'Target not reached, trying to scroll for more cards...'
            );
          }

          // Try to scroll for more cards
          const scrollResult = await this.safeScrollForMoreCards();
          scrollAttempts++;

          if (!scrollResult) {
            console.log(
              'No more cards available after scroll attempt, ending processing'
            );
            break;
          }

          // Wait for new cards to load
          await this.browserService.getPage().waitForTimeout(3000);
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
   * Find all connection cards in the modal (current visible batch)
   * Requirement 3.1: WHEN the modal dialog opens THEN the system SHALL identify all cards with role="listitem"
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
        `Found ${cardElements.length} connection cards in current view`
      );
      return cardElements;
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
   * Safe scroll logic that ONLY scrolls within the modal dialog
   * Uses the most conservative approach to avoid scrolling the main page
   */
  private async safeScrollForMoreCards(): Promise<boolean> {
    try {
      const page = this.browserService.getPage();

      // Get current card count before scrolling
      const cardsBefore = await page.$$('[role="listitem"]');
      const countBefore = cardsBefore.length;

      console.log(
        `Safe scrolling for more cards... (${countBefore} cards currently visible)`
      );

      // Find the modal dialog
      const modal = await page.$('[data-testid="dialog"]');
      if (!modal) {
        console.warn('Could not find modal dialog for scrolling');
        return false;
      }

      // Get modal properties before scrolling
      const modalInfo = await modal.evaluate((element) => ({
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        canScroll: element.scrollHeight > element.clientHeight,
      }));

      console.log(
        `Modal scroll info: ${modalInfo.scrollTop}/${modalInfo.scrollHeight} (client: ${modalInfo.clientHeight}, canScroll: ${modalInfo.canScroll})`
      );

      if (!modalInfo.canScroll) {
        console.log('Modal cannot be scrolled (content fits within view)');
        return false;
      }

      // Try only the safest scroll methods
      let scrollSuccess = false;

      // Method 1: Direct element scroll (safest)
      try {
        console.log('Trying direct modal scroll...');
        await modal.evaluate((element) => {
          const currentScroll = element.scrollTop;
          const maxScroll = element.scrollHeight - element.clientHeight;
          const scrollAmount = Math.min(
            element.clientHeight,
            maxScroll - currentScroll
          );

          if (scrollAmount > 0) {
            element.scrollTop = currentScroll + scrollAmount;
            return true;
          }
          return false;
        });
        scrollSuccess = true;
      } catch (error) {
        console.warn('Direct modal scroll failed:', error);
      }

      // Method 2: Find scrollable container within modal (if direct scroll failed)
      if (!scrollSuccess) {
        try {
          console.log('Trying scrollable container within modal...');
          const scrollableContainer = await modal.$(
            '.overflow-y-auto, .overflow-auto, [style*="overflow"]'
          );

          if (scrollableContainer) {
            await scrollableContainer.evaluate((element) => {
              const currentScroll = element.scrollTop;
              const maxScroll = element.scrollHeight - element.clientHeight;
              const scrollAmount = Math.min(
                element.clientHeight,
                maxScroll - currentScroll
              );

              if (scrollAmount > 0) {
                element.scrollTop = currentScroll + scrollAmount;
                return true;
              }
              return false;
            });
            scrollSuccess = true;
          }
        } catch (error) {
          console.warn('Scrollable container scroll failed:', error);
        }
      }

      if (!scrollSuccess) {
        console.log('No safe scroll method worked');
        return false;
      }

      // Wait for new content to load
      await page.waitForTimeout(4000);

      // Check if new cards were loaded
      const cardsAfter = await page.$$('[role="listitem"]');
      const countAfter = cardsAfter.length;
      const newCards = countAfter - countBefore;

      console.log(
        `After safe scroll: ${countAfter} cards visible (${
          newCards > 0 ? '+' : ''
        }${newCards} new)`
      );

      if (newCards > 0) {
        console.log(`✅ Safe scroll successful! Loaded ${newCards} new cards`);
        return true;
      } else {
        console.log('❌ Safe scroll completed but no new cards loaded');
        return false;
      }
    } catch (error) {
      console.warn('Error in safe scroll:', error);
      return false;
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
   * Requirement 3.2: WHEN processing each card THEN the system SHALL extract text from paragraph with classes containing mutual connections information
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
      console.warn('Error extracting mutual connections text:', error);
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
      console.warn('Error checking for Connect button:', error);
      return false;
    }
  }

  /**
   * Connect with a person by clicking their Connect button
   * Requirement 3.4: IF the mutual connections count is greater than the threshold THEN the system SHALL click the "Connect" button in that card
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
                `🖱️  Clicking Connect button for ${connection.name}...`
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
}
