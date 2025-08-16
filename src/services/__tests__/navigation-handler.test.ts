import { NavigationHandler, NavigationResult } from '../navigation-handler';
import { BrowserService } from '../browser-service';
import { ElementHandle } from 'playwright';

// Mock BrowserService
jest.mock('../browser-service');

describe('NavigationHandler', () => {
  let navigationHandler: NavigationHandler;
  let mockBrowserService: jest.Mocked<BrowserService>;
  let mockPage: any;

  beforeEach(() => {
    // Create mock page
    mockPage = {
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock browser service
    mockBrowserService = {
      navigateTo: jest.fn().mockResolvedValue(undefined),
      waitForPageLoad: jest.fn().mockResolvedValue(undefined),
      waitForElement: jest.fn().mockResolvedValue({} as ElementHandle),
      clickElement: jest.fn().mockResolvedValue(undefined),
      waitForModal: jest.fn().mockResolvedValue({} as ElementHandle),
      elementExists: jest.fn().mockResolvedValue(true),
      getPage: jest.fn().mockReturnValue(mockPage),
    } as any;

    navigationHandler = new NavigationHandler(mockBrowserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('navigateToNetworkGrowth', () => {
    it('should successfully complete navigation workflow', async () => {
      // Arrange
      mockBrowserService.navigateTo.mockResolvedValue(undefined);
      mockBrowserService.waitForPageLoad.mockResolvedValue(undefined);
      mockBrowserService.waitForElement.mockResolvedValue({} as ElementHandle);
      mockBrowserService.clickElement.mockResolvedValue(undefined);
      mockBrowserService.waitForModal.mockResolvedValue({} as ElementHandle);

      // Act
      const result: NavigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify navigation to network growth page (Requirement 2.1)
      expect(mockBrowserService.navigateTo).toHaveBeenCalledWith(
        'https://www.linkedin.com/mynetwork/grow/'
      );
      expect(mockBrowserService.waitForPageLoad).toHaveBeenCalled();

      // Verify see all button click (Requirement 2.2)
      expect(mockBrowserService.waitForElement).toHaveBeenCalledWith(
        'button[data-view-name="cohort-section-see-all"]',
        {
          visible: true,
          enabled: true,
          timeout: 15000,
        }
      );
      expect(mockBrowserService.clickElement).toHaveBeenCalledWith(
        'button[data-view-name="cohort-section-see-all"]'
      );

      // Verify modal wait (Requirement 2.3)
      expect(mockBrowserService.waitForModal).toHaveBeenCalledWith(
        '[data-testid="dialog"]',
        {
          visible: true,
          timeout: 10000,
        }
      );
    });

    it('should handle navigation failure', async () => {
      // Arrange
      const navigationError = new Error('Navigation failed');
      mockBrowserService.navigateTo.mockRejectedValue(navigationError);

      // Act
      const result: NavigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Failed to navigate to network growth page'
      );
    });

    it('should handle see all button click failure', async () => {
      // Arrange
      mockBrowserService.navigateTo.mockResolvedValue(undefined);
      mockBrowserService.waitForPageLoad.mockResolvedValue(undefined);
      const clickError = new Error('Button not found');
      mockBrowserService.waitForElement.mockRejectedValue(clickError);

      // Act
      const result: NavigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to click see all button');
    });

    it('should retry once when modal fails to appear (Requirement 2.4)', async () => {
      // Arrange
      mockBrowserService.navigateTo.mockResolvedValue(undefined);
      mockBrowserService.waitForPageLoad.mockResolvedValue(undefined);
      mockBrowserService.waitForElement.mockResolvedValue({} as ElementHandle);
      mockBrowserService.clickElement.mockResolvedValue(undefined);

      // First call fails, second call succeeds
      mockBrowserService.waitForModal
        .mockRejectedValueOnce(new Error('Modal timeout'))
        .mockResolvedValueOnce({} as ElementHandle);

      // Act
      const result: NavigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      // Assert
      expect(result.success).toBe(true);
      expect(mockBrowserService.waitForModal).toHaveBeenCalledTimes(2);
      expect(mockBrowserService.clickElement).toHaveBeenCalledTimes(2); // Original + retry
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000); // Retry delay
    });

    it('should fail after maximum retries for modal', async () => {
      // Arrange
      mockBrowserService.navigateTo.mockResolvedValue(undefined);
      mockBrowserService.waitForPageLoad.mockResolvedValue(undefined);
      mockBrowserService.waitForElement.mockResolvedValue({} as ElementHandle);
      mockBrowserService.clickElement.mockResolvedValue(undefined);

      // Both calls fail
      const modalError = new Error('Modal timeout');
      mockBrowserService.waitForModal.mockRejectedValue(modalError);

      // Act
      const result: NavigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Modal dialog did not appear after 2 attempts'
      );
      expect(mockBrowserService.waitForModal).toHaveBeenCalledTimes(2);
    });

    it('should handle retry click failure gracefully', async () => {
      // Arrange
      mockBrowserService.navigateTo.mockResolvedValue(undefined);
      mockBrowserService.waitForPageLoad.mockResolvedValue(undefined);
      mockBrowserService.waitForElement.mockResolvedValue({} as ElementHandle);

      // First click succeeds, retry click fails, but modal eventually appears
      mockBrowserService.clickElement
        .mockResolvedValueOnce(undefined) // First click
        .mockRejectedValueOnce(new Error('Retry click failed')); // Retry click fails

      mockBrowserService.waitForModal
        .mockRejectedValueOnce(new Error('Modal timeout'))
        .mockResolvedValueOnce({} as ElementHandle);

      // Act
      const result: NavigationResult =
        await navigationHandler.navigateToNetworkGrowth();

      // Assert
      expect(result.success).toBe(true);
      expect(mockBrowserService.waitForModal).toHaveBeenCalledTimes(2);
    });
  });

  describe('isModalOpen', () => {
    it('should return true when modal exists', async () => {
      // Arrange
      mockBrowserService.elementExists.mockResolvedValue(true);

      // Act
      const result = await navigationHandler.isModalOpen();

      // Assert
      expect(result).toBe(true);
      expect(mockBrowserService.elementExists).toHaveBeenCalledWith(
        '[data-testid="dialog"]'
      );
    });

    it('should return false when modal does not exist', async () => {
      // Arrange
      mockBrowserService.elementExists.mockResolvedValue(false);

      // Act
      const result = await navigationHandler.isModalOpen();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when elementExists throws error', async () => {
      // Arrange
      mockBrowserService.elementExists.mockRejectedValue(new Error('Error'));

      // Act
      const result = await navigationHandler.isModalOpen();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getModalElement', () => {
    it('should return modal element when found', async () => {
      // Arrange
      const mockElement = {} as ElementHandle;
      mockBrowserService.waitForElement.mockResolvedValue(mockElement);

      // Act
      const result = await navigationHandler.getModalElement();

      // Assert
      expect(result).toBe(mockElement);
      expect(mockBrowserService.waitForElement).toHaveBeenCalledWith(
        '[data-testid="dialog"]',
        {
          visible: true,
          timeout: 5000,
        }
      );
    });

    it('should throw error when modal not found', async () => {
      // Arrange
      const error = new Error('Element not found');
      mockBrowserService.waitForElement.mockRejectedValue(error);

      // Act & Assert
      await expect(navigationHandler.getModalElement()).rejects.toThrow(
        'Modal not found: Element not found'
      );
    });
  });
});
