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

/**
 * ConnectionHandler: single, tidy implementation.
 * Fixes the issue where after the first scroll the page (not the modal)
 * was scrolled by ensuring:
 *  - we always re-resolve the inner scrollable container before performing a scroll
 *  - we scope card counts to the modal/list container instead of the whole page
 *  - we detect detached elements and fall back safely
 */
export class ConnectionHandler {
  private browserService: BrowserService;

  constructor(browserService: BrowserService) {
    this.browserService = browserService;
  }

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
      const processedCardIds = new Set<string>();
      let scrollAttempts = 0;
      const maxScrollAttempts = 12;

      console.log(`🔍 Starting connection processing: target ${maxConnections}`);

      while (connectionsSuccessful < maxConnections && scrollAttempts < maxScrollAttempts) {
        const modal = await this.getModalLocator();
        if (!modal) {
          console.warn('Modal not found, aborting');
          break;
        }

        const connectionCards = await this.findConnectionCardsScoped(modal);
        if (connectionCards.length === 0) {
          // nothing visible; maybe we need to scroll to load
          const scrolled = await this.safeScrollModalForMore(modal);
          if (!scrolled) break;
          scrollAttempts++;
          continue;
        }

        for (let i = 0; i < connectionCards.length && connectionsSuccessful < maxConnections; i++) {
          const cardElement = connectionCards[i];
          try {
            const cardId = await this.generateCardId(cardElement);
            if (processedCardIds.has(cardId)) continue;
            processedCardIds.add(cardId);
            connectionsProcessed++;

            ErrorContext.set('currentCard', connectionsProcessed);

            const result = await GracefulDegradation.withFallback(
              async () => this.processIndividualCard(cardElement, minMutualConnections),
              async () => ({ success: false, reason: 'Processing fallback' }),
              (error) => !error.message.includes('critical')
            );

            if (result.success) connectionsSuccessful++;
            else partialFailures.push(result.reason || 'Unknown reason');
          } catch (error) {
            partialFailures.push(error instanceof Error ? error.message : 'Unknown error');
          }
        }

        if (connectionsSuccessful >= maxConnections) break;

        // Attempt to scroll the modal to load more cards
        const scrolled = await this.safeScrollModalForMore(modal);
        if (!scrolled) break;

        scrollAttempts++;
        // Give time for lazy-loaded content
        await this.browserService.getPage().waitForTimeout(2500);
      }

      return {
        success: true,
        connectionsProcessed,
        connectionsSuccessful,
        partialFailures: partialFailures.length ? partialFailures : undefined,
      };
    } catch (error) {
      const connectionError =
        error instanceof ConnectionError
          ? error
          : new ConnectionError(
              `Connection processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  // Resolve the top-most modal dialog locator
  private async getModalLocator(): Promise<Locator | null> {
    try {
      const page = this.browserService.getPage();
      const modal = page.locator('[data-testid="dialog"]').first();
      const visible = await modal.isVisible().catch(() => false);
      return visible ? modal : null;
    } catch {
      return null;
    }
  }

  // Find connection cards scoped to the modal (avoids counting page-level items)
  private async findConnectionCardsScoped(modal: Locator): Promise<ElementHandle[]> {
    try {
      // Prefer list container inside modal
      const list = modal.locator('[role="list"]');
      const hasList = await list.first().isVisible().catch(() => false);
      if (hasList) {
        const items = await list.locator('[role="listitem"]').elementHandles().catch(() => []);
        return items as ElementHandle[];
      }

      // Fallback: find listitems inside modal
      const items = await modal.locator('[role="listitem"]').elementHandles().catch(() => []);
      return items as ElementHandle[];
    } catch {
      return [];
    }
  }

  // Safely (re)resolve inner scrollable container and scroll it; fallback to modal element.
  private async safeScrollModalForMore(modal: Locator): Promise<boolean> {
    try {
      const page = this.browserService.getPage();

      // Re-resolve inner scrollable container each time to avoid stale handles
      const scrollContainer = await this.findInnerScrollContainer(modal);

      const countBefore = await this.countListItemsInModal(modal);

      if (!scrollContainer) {
        // Try wheel scroll inside modal bounds as a last resort (should not affect main page)
        const box = await modal.boundingBox();
        if (!box) return false;

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        // produce several small wheel events inside modal
        for (let i = 0; i < 8; i++) {
          await page.mouse.wheel(0, 120);
          await page.waitForTimeout(100);
        }

        await page.waitForTimeout(1200);
        const countAfter = await this.countListItemsInModal(modal);
        return countAfter > countBefore;
      }

      // Scroll by adjusting scrollTop to avoid changing page scroll
      const scrolled = await scrollContainer.evaluate((el: HTMLElement) => {
        const max = el.scrollHeight - el.clientHeight;
        const cur = el.scrollTop || 0;
        const amount = Math.min(Math.ceil(el.clientHeight * 0.85), Math.max(100, Math.ceil((max - cur) * 0.5)));
        if (amount <= 0) return false;
        el.scrollTop = cur + amount;
        return true;
      }).catch(() => false);

      if (!scrolled) return false;

      // Wait for lazy loading
      await page.waitForTimeout(1500);

      const countAfter = await this.countListItemsInModal(modal);
      return countAfter > countBefore;
    } catch (error) {
      console.warn('Error scrolling modal:', error);
      return false;
    }
  }

  // Find an inner scrollable container within a given modal locator
  private async findInnerScrollContainer(modal: Locator): Promise<Locator | null> {
    try {
      const scrollSelectors = [
        '.scaffold-finite-scroll__content',
        '.reusable-search__entity-result-list',
        '.search-results-container',
        '.artdeco-modal__content',
        '.overflow-y-auto',
        '.overflow-auto',
        '[style*="overflow-y: auto"]',
        '[style*="overflow: auto"]',
      ];

      for (const sel of scrollSelectors) {
        try {
          const candidate = modal.locator(sel).first();
          const visible = await candidate.isVisible().catch(() => false);
          if (!visible) continue;

          const canScroll = await candidate.evaluate((node: Element) => {
            const el = node as HTMLElement;
            const style = window.getComputedStyle(el);
            const hasOverflow = /auto|scroll/i.test(style.overflow + style.overflowY + style.overflowX);
            const hasScrollableContent = el.scrollHeight > el.clientHeight + 5;
            return hasOverflow && hasScrollableContent;
          }).catch(() => false);

          if (canScroll) return candidate;
        } catch {
          continue;
        }
      }

      // Check modal itself
      const modalCanScroll = await modal.evaluate((node: Element) => {
        const el = node as HTMLElement;
        const style = window.getComputedStyle(el);
        const hasOverflow = /auto|scroll/i.test(style.overflow + style.overflowY + style.overflowX);
        const hasScrollableContent = el.scrollHeight > el.clientHeight + 5;
        return hasOverflow && hasScrollableContent;
      }).catch(() => false);

      if (modalCanScroll) return modal;
      return null;
    } catch {
      return null;
    }
  }

  private async countListItemsInModal(modal: Locator): Promise<number> {
    try {
      const list = modal.locator('[role="list"]');
      const hasList = await list.first().isVisible().catch(() => false);
      if (hasList) return await list.locator('[role="listitem"]').count();
      return await modal.locator('[role="listitem"]').count();
    } catch {
      return 0;
    }
  }

  private async generateCardId(cardElement: ElementHandle): Promise<string> {
    try {
      const text = await cardElement.textContent();
      const name = extractConnectionName(text || '');
      const box = await cardElement.boundingBox();
      const pos = box ? `${Math.round(box.x)}-${Math.round(box.y)}` : 'unknown';
      return `${name || 'unknown'}-${pos}`;
    } catch {
      return `card-${Math.random().toString(36).slice(2, 9)}`;
    }
  }

  private async processIndividualCard(
    cardElement: ElementHandle,
    minMutualConnections: number
  ): Promise<{ success: boolean; reason?: string }> {
    const result = await RetryManager.withRetry(
      async () => {
        const eligibilityResult = await this.checkConnectionEligibility(cardElement, minMutualConnections);
        if (!eligibilityResult.eligible) return { success: false, reason: eligibilityResult.reason || 'Not eligible' };
        if (!eligibilityResult.connection) return { success: false, reason: 'No connection data' };

        const connected = await this.connectWithPerson(eligibilityResult.connection);
        if (!connected) return { success: false, reason: 'Failed to connect' };

        return { success: true };
      },
      {
        maxAttempts: 2,
        baseDelay: 800,
        retryCondition: (error) => (error.message || '').includes('timeout') || (error.message || '').includes('click'),
      }
    );

  if (!result.success) return { success: false, reason: result.error?.message || 'Processing failed' };
    return result.result!;
  }

  private async checkConnectionEligibility(
    cardElement: ElementHandle,
    minMutualConnections: number
  ): Promise<ConnectionEligibilityResult> {
    try {
      const text = await cardElement.textContent();
      if (!text) return { eligible: false, reason: 'No text' };
      const name = extractConnectionName(text);
      if (!name) return { eligible: false, reason: 'No name' };

      const mutualText = await this.extractMutualConnectionsText(cardElement);
      if (!mutualText) return { eligible: false, reason: 'No mutual text' };
      const mutualCount = parseMutualConnectionCount(mutualText);

      const connection: Connection = {
        id: generateConnectionId(name),
        name,
        mutualConnectionsCount: mutualCount,
        cardElement,
      };

      if (mutualCount < minMutualConnections) return { eligible: false, connection, reason: `Only ${mutualCount}` };

      const hasConnect = await this.hasConnectButton(cardElement);
      if (!hasConnect) return { eligible: false, connection, reason: 'No Connect button' };

      return { eligible: true, connection };
    } catch (error) {
      return { eligible: false, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async extractMutualConnectionsText(cardElement: ElementHandle): Promise<string | null> {
    try {
      const allText = await cardElement.textContent();
      if (!allText) return null;
      if (containsMutualConnectionInfo(allText)) {
        const lines = allText.split('\n').map((l) => l.trim());
        for (const line of lines) if (containsMutualConnectionInfo(line)) return line;
        const regex = /([^.]*(?:and\s+\d+\s+other\s+mutual\s+connections?|mutual\s+connections?)[^.]*)/i;
        const match = allText.match(regex);
        if (match) return match[1].trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  private async hasConnectButton(cardElement: ElementHandle): Promise<boolean> {
    try {
      const selectors = ['button:has-text("Connect")', 'button[aria-label*="Connect"]', 'button[data-test-id*="connect"]', '.artdeco-button:has-text("Connect")', '[data-control-name*="connect"]'];
      for (const sel of selectors) {
        try {
          const btn = await cardElement.$(sel);
          if (!btn) continue;
          try {
            const v = await btn.isVisible();
            const e = await btn.isEnabled();
            if (v && e) return true;
          } catch {
            return true; // be permissive if visibility/enabled checks fail
          }
        } catch {
          continue;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private async connectWithPerson(connection: Connection): Promise<boolean> {
    try {
      const selectors = ['button:has-text("Connect")', 'button[aria-label*="Connect"]', 'button[data-test-id*="connect"]', '.artdeco-button:has-text("Connect")', '[data-control-name*="connect"]'];
      for (const sel of selectors) {
        try {
          const btn = await connection.cardElement.$(sel);
          if (!btn) continue;
          try {
            const v = await btn.isVisible();
            const e = await btn.isEnabled();
            if (v && e) {
              await btn.click();
              await this.browserService.getPage().waitForTimeout(1000);
              await this.handleConnectionConfirmation();
              await this.browserService.getPage().waitForTimeout(5000);
              return true;
            }
          } catch {
            // If we can't determine visibility/enabled, try clicking anyway
            try {
              await btn.click();
              await this.browserService.getPage().waitForTimeout(1000);
              await this.handleConnectionConfirmation();
              await this.browserService.getPage().waitForTimeout(5000);
              return true;
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }
      throw new Error('Could not find or click Connect button');
    } catch {
      return false;
    }
  }

  private async handleConnectionConfirmation(): Promise<void> {
    try {
      const page = this.browserService.getPage();
      await page.waitForTimeout(500);
      const selectors = ['button:has-text("Send now")', 'button:has-text("Send")', 'button[aria-label*="Send"]', 'button[data-test-id*="send"]', '.artdeco-button--primary:has-text("Send")'];
      for (const sel of selectors) {
        try {
          const btn = await page.$(sel);
          if (!btn) continue;
          try {
            const v = await btn.isVisible();
            const e = await btn.isEnabled();
            if (v && e) {
              await btn.click();
              await page.waitForTimeout(1000);
              return;
            }
          } catch {
            try {
              await btn.click();
              await page.waitForTimeout(1000);
              return;
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // ignore
    }
  }

  async getCurrentConnectionCount(): Promise<number> {
    try {
      return 0;
    } catch {
      return 0;
    }
  }
}
