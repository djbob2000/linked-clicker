import {
  validateConnection,
  validateAutomationStatus,
} from '../data-validation';
import { Connection } from '../../types/connection';
import { AutomationStatus } from '../../types/automation-status';

// Mock ElementHandle for testing
const mockElementHandle = {} as any;

describe('validateConnection', () => {
  const validConnection: Connection = {
    id: 'test-id',
    name: 'John Doe',
    mutualConnectionsCount: 5,
    profileUrl: 'https://linkedin.com/in/johndoe',
    cardElement: mockElementHandle,
  };

  it('should validate a correct connection object', () => {
    const result = validateConnection(validConnection);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject connection with missing id', () => {
    const invalidConnection = { ...validConnection, id: '' };
    const result = validateConnection(invalidConnection);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Connection ID is required and must be a non-empty string'
    );
  });

  it('should reject connection with missing name', () => {
    const invalidConnection = { ...validConnection, name: '' };
    const result = validateConnection(invalidConnection);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Connection name is required and must be a non-empty string'
    );
  });

  it('should reject connection with negative mutual connections count', () => {
    const invalidConnection = {
      ...validConnection,
      mutualConnectionsCount: -1,
    };
    const result = validateConnection(invalidConnection);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Mutual connections count is required and must be a non-negative number'
    );
  });

  it('should reject connection with missing card element', () => {
    const invalidConnection = {
      ...validConnection,
      cardElement: undefined as any,
    };
    const result = validateConnection(invalidConnection);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Card element is required');
  });

  it('should accept connection without profile URL', () => {
    const connectionWithoutUrl = { ...validConnection };
    delete connectionWithoutUrl.profileUrl;
    const result = validateConnection(connectionWithoutUrl);
    expect(result.isValid).toBe(true);
  });
});

describe('validateAutomationStatus', () => {
  const validStatus: AutomationStatus = {
    isRunning: true,
    currentStep: 'processing-connections',
    connectionsProcessed: 10,
    connectionsSuccessful: 8,
    maxConnections: 100,
    startTime: new Date(),
  };

  it('should validate a correct automation status object', () => {
    const result = validateAutomationStatus(validStatus);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject status with invalid current step', () => {
    const invalidStatus = {
      ...validStatus,
      currentStep: 'invalid-step' as any,
    };
    const result = validateAutomationStatus(invalidStatus);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('currentStep must be one of:');
  });

  it('should reject status with negative connections processed', () => {
    const invalidStatus = { ...validStatus, connectionsProcessed: -1 };
    const result = validateAutomationStatus(invalidStatus);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'connectionsProcessed must be a non-negative number'
    );
  });

  it('should reject status where successful > processed', () => {
    const invalidStatus = {
      ...validStatus,
      connectionsSuccessful: 15,
      connectionsProcessed: 10,
    };
    const result = validateAutomationStatus(invalidStatus);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'connectionsSuccessful cannot be greater than connectionsProcessed'
    );
  });

  it('should reject status with zero max connections', () => {
    const invalidStatus = { ...validStatus, maxConnections: 0 };
    const result = validateAutomationStatus(invalidStatus);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('maxConnections must be a positive number');
  });

  it('should reject status with end time before start time', () => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() - 1000); // 1 second before start
    const invalidStatus = { ...validStatus, startTime, endTime };
    const result = validateAutomationStatus(invalidStatus);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('endTime cannot be before startTime');
  });
});
