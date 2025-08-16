import { ConnectionHandler } from '../connection-handler';
import { BrowserService } from '../browser-service';
import { Connection } from '../../types/connection';
import { ElementHandle, Page } from 'playwright';

// Mock the BrowserService
jest.mock('../browser-service');
const MockedBrowserService = BrowserService as jest.MockedClass<
  typeof BrowserService
>;

// Mock the linkedin-parser functions
jest.mock('../../lib/linkedin-parser', () => ({
  parseMutualConnectionCount: jest.fn(),
  containsMutualConnectionInfo: jest.fn(),
  extractConnectionName: jest.fn(),
  generateConnectionId: jest.fn(),
}));

import {
  parseMutualConnectionCount,
  containsMutualConnectionInfo,
  extractConnectionName,
  generateConnectionId,
} from '../../lib/linkedin-parser';

const mockedParseMutualConnectionCount =
  parseMutualConnectionCount as jest.MockedFunction<
    typeof parseMutualConnectionCount
  >;
const mockedContainsMutualConnectionInfo =
  containsMutualConnectionInfo as jest.MockedFunction<
    typeof containsMutualConnectionInfo
  >;
const mockedExtractConnectionName =
  extractConnectionName as jest.MockedFunction<typeof extractConnectionName>;
const mockedGenerateConnectionId = generateConnectionId as jest.MockedFunction<
  typeof generateConnectionId
>;

describe('ConnectionHandler', () => {
  let connectionHandler: ConnectionHandler;
  let mockBrowserService: jest.Mocked<BrowserService>;
  let mockPage: jest.Mocked<Page>;
  let mockElementHandle: ElementHandle<HTMLElement>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockBrowserService =
      new MockedBrowserService() as jest.Mocked<BrowserService>;
    mockPage = {
      $$: jest.fn(),
      $: jest.fn(),
      waitForTimeout: jest.fn(),
    } as any;
    mockElementHandle = {
      $: jest.fn(),
      $: jest.fn(),
      textContent: jest.fn(),
      isVisible: jest.fn(),
      isEnabled: jest.fn(),
      click: jest.fn(),
      boundingBox: jest.fn(),
    } as any;

    // Setup browser service mocks
    mockBrowserService.getPage.mockReturnValue(mockPage);
    mockBrowserService.waitForElement.mockResolvedValue(mockElementHandle);

    // Create connection handler instance
    connectionHandler = new ConnectionHandler(mockBrowserService);

    // Setup default mock implementations
    mockedContainsMutualConnectionInfo.mockReturnValue(true);
    mockedExtractConnectionName.mockReturnValue('John Doe');
    mockedGenerateConnectionId.mockReturnValue('john-doe-123');
    mockedParseMutualConnectionCount.mockReturnValue(5);
  });

  describe('processConnections', () => {
    it('should process connections successfully when eligible candidates are found', async () => {
      // Arrange
      const minMutualConnections = 3;
      const maxConnections = 10;

      // Mock finding connection cards
      mockPage.$.mockResolvedValue([mockElementHandle, mockElementHandle] as any);

      // Mock connection eligibility check
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]); // For mutual connections text extraction
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(mockElementHandle); // Connect button found
      (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        maxConnections
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.connectionsProcessed).toBe(2);
      expect(result.connectionsSuccessful).toBe(2);
      expect(mockElementHandle.click).toHaveBeenCalledTimes(2);
    });

    it('should stop processing when maximum connections limit is reached', async () => {
      // Arrange
      const minMutualConnections = 3;
      const maxConnections = 1; // Low limit to test stopping

      // Mock finding multiple connection cards
      mockPage.$$.mockResolvedValue([
        mockElementHandle,
        mockElementHandle,
        mockElementHandle,
      ]);

      // Mock connection eligibility check
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]);
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(mockElementHandle);
      (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        maxConnections
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.connectionsProcessed).toBe(1); // Should stop after reaching max
      expect(result.connectionsSuccessful).toBe(1);
      expect(mockElementHandle.click).toHaveBeenCalledTimes(1);
    });

    it('should skip connections that do not meet minimum mutual connections threshold', async () => {
      // Arrange
      const minMutualConnections = 10;
      const maxConnections = 5;

      // Mock finding connection cards
      mockPage.$$.mockResolvedValue([mockElementHandle]);

      // Mock low mutual connections count
      mockedParseMutualConnectionCount.mockReturnValue(2); // Below threshold
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n2 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        maxConnections
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.connectionsProcessed).toBe(1);
      expect(result.connectionsSuccessful).toBe(0); // Should be 0 due to low mutual connections
      expect(mockElementHandle.click).not.toHaveBeenCalled();
    });

    it('should handle case when no connection cards are found', async () => {
      // Arrange
      const minMutualConnections = 3;
      const maxConnections = 10;

      // Mock no connection cards found
      mockPage.$$.mockResolvedValue([]);

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        maxConnections
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.connectionsProcessed).toBe(0);
      expect(result.connectionsSuccessful).toBe(0);
      expect(result.error).toBe('No connection cards found');
    });

    it('should handle errors gracefully and continue processing other cards', async () => {
      // Arrange
      const minMutualConnections = 3;
      const maxConnections = 10;

      // Create separate mock elements for each card
      const errorElement = {
        $$: jest.fn(),
        $: jest.fn(),
        textContent: jest.fn().mockRejectedValue(new Error('Element error')),
        isVisible: jest.fn(),
        isEnabled: jest.fn(),
        click: jest.fn(),
      } as any;

      const successElement = {
        $$: jest.fn().mockResolvedValue([mockElementHandle]),
        $: jest.fn().mockResolvedValue(mockElementHandle),
        textContent: jest
          .fn()
          .mockResolvedValue('Jane Doe\n5 mutual connections'),
        isVisible: jest.fn().mockResolvedValue(true),
        isEnabled: jest.fn().mockResolvedValue(true),
        click: jest.fn(),
      } as any;

      mockPage.$$.mockResolvedValue([errorElement, successElement]);

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        maxConnections
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.connectionsProcessed).toBe(2);
      expect(result.connectionsSuccessful).toBe(1); // Only second one succeeded
    });

    it('should handle browser service errors', async () => {
      // Arrange
      const minMutualConnections = 3;
      const maxConnections = 10;

      // Mock browser service error when waiting for elements
      mockBrowserService.waitForElement.mockRejectedValue(
        new Error('Browser error')
      );

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        maxConnections
      );

      // Assert
      expect(result.success).toBe(true); // Should still succeed but with 0 connections
      expect(result.connectionsProcessed).toBe(0);
      expect(result.connectionsSuccessful).toBe(0);
    });
  });

  describe('connection eligibility checking', () => {
    it('should correctly identify eligible connections', async () => {
      // Arrange
      const minMutualConnections = 3;
      mockPage.$.mockResolvedValue([mockElementHandle]);
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]);
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(mockElementHandle);
      (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.connectionsSuccessful).toBe(1);
      expect(mockedParseMutualConnectionCount).toHaveBeenCalled();
      expect(mockedExtractConnectionName).toHaveBeenCalled();
    });

    it('should reject connections without Connect button', async () => {
      // Arrange
      const minMutualConnections = 3;
      mockPage.$.mockResolvedValue([mockElementHandle]);
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]);
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(null); // No Connect button
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.connectionsSuccessful).toBe(0);
    });

    it('should reject connections with disabled Connect button', async () => {
      // Arrange
      const minMutualConnections = 3;
      mockPage.$.mockResolvedValue([mockElementHandle]);
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]);
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(mockElementHandle);
      (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(false); // Disabled button
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.connectionsSuccessful).toBe(0);
    });
  });

  describe('mutual connections text extraction', () => {
    it('should extract mutual connections text from various selectors', async () => {
      // Arrange
      const minMutualConnections = 3;
      mockPage.$.mockResolvedValue([mockElementHandle]);
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\nSoftware Engineer\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockImplementation((selector) => {
        if (selector.includes('mutual')) {
          const mutualElement = {
            textContent: jest.fn().mockResolvedValue('5 mutual connections'),
          } as any;
          return Promise.resolve([mutualElement]);
        }
        return Promise.resolve([]);
      });
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(mockElementHandle);
      (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.connectionsSuccessful).toBe(1);
      expect(mockedContainsMutualConnectionInfo).toHaveBeenCalled();
    });

    it('should handle missing mutual connections text', async () => {
      // Arrange
      const minMutualConnections = 3;
      mockPage.$.mockResolvedValue([mockElementHandle]);
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\nSoftware Engineer'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([]);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });
      mockedContainsMutualConnectionInfo.mockReturnValue(false);

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.connectionsSuccessful).toBe(0);
    });
  });

  describe('connection confirmation handling', () => {
    it('should handle connection confirmation dialog', async () => {
      // Arrange
      const minMutualConnections = 3;
      mockPage.$.mockResolvedValue([mockElementHandle]);
      (mockElementHandle.textContent as jest.Mock).mockResolvedValue(
        'John Doe\n5 mutual connections'
      );
      (mockElementHandle.$ as jest.Mock).mockResolvedValue([mockElementHandle]);
      (mockElementHandle.$ as jest.Mock).mockResolvedValue(mockElementHandle);
      (mockElementHandle.isVisible as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.isEnabled as jest.Mock).mockResolvedValue(true);
      (mockElementHandle.boundingBox as jest.Mock).mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 });

      // Mock confirmation dialog
      const confirmButton = {
        isVisible: jest.fn().mockResolvedValue(true),
        isEnabled: jest.fn().mockResolvedValue(true),
        click: jest.fn(),
      } as any;

      (mockPage.$ as jest.Mock).mockImplementation((selector) => {
        if (selector.includes('Send')) {
          return Promise.resolve(confirmButton);
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.connectionsSuccessful).toBe(1);
      expect(confirmButton.click).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue processing when individual connection fails', async () => {
      // Arrange
      const minMutualConnections = 3;

      const failingElement = {
        $$: jest.fn().mockResolvedValue([mockElementHandle]),
        $: jest.fn().mockResolvedValue(mockElementHandle),
        textContent: jest
          .fn()
          .mockResolvedValue('John Doe\n5 mutual connections'),
        isVisible: jest.fn().mockResolvedValue(true),
        isEnabled: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockRejectedValue(new Error('Click failed')),
      } as any;

      const successElement = {
        $$: jest.fn().mockResolvedValue([mockElementHandle]),
        $: jest.fn().mockResolvedValue(mockElementHandle),
        textContent: jest
          .fn()
          .mockResolvedValue('Jane Doe\n7 mutual connections'),
        isVisible: jest.fn().mockResolvedValue(true),
        isEnabled: jest.fn().mockResolvedValue(true),
        click: jest.fn(),
      } as any;

      mockPage.$$.mockResolvedValue([failingElement, successElement]);

      // Act
      const result = await connectionHandler.processConnections(
        minMutualConnections,
        10
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.connectionsProcessed).toBe(2);
      expect(result.connectionsSuccessful).toBe(1); // Only second one succeeded
    });
  });
});
