import { Connection, ConnectionValidationResult } from '../types/connection';
import {
  AutomationStatus,
  AutomationStatusValidationResult,
} from '../types/automation-status';

/**
 * Validates a Connection object
 */
export function validateConnection(
  connection: Partial<Connection>
): ConnectionValidationResult {
  const errors: string[] = [];

  if (
    !connection.id ||
    typeof connection.id !== 'string' ||
    connection.id.trim() === ''
  ) {
    errors.push('Connection ID is required and must be a non-empty string');
  }

  if (
    !connection.name ||
    typeof connection.name !== 'string' ||
    connection.name.trim() === ''
  ) {
    errors.push('Connection name is required and must be a non-empty string');
  }

  if (
    connection.mutualConnectionsCount === undefined ||
    connection.mutualConnectionsCount === null ||
    typeof connection.mutualConnectionsCount !== 'number' ||
    connection.mutualConnectionsCount < 0
  ) {
    errors.push(
      'Mutual connections count is required and must be a non-negative number'
    );
  }

  if (
    connection.profileUrl !== undefined &&
    (typeof connection.profileUrl !== 'string' ||
      connection.profileUrl.trim() === '')
  ) {
    errors.push('Profile URL must be a non-empty string if provided');
  }

  if (!connection.cardElement) {
    errors.push('Card element is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an AutomationStatus object
 */
export function validateAutomationStatus(
  status: Partial<AutomationStatus>
): AutomationStatusValidationResult {
  const errors: string[] = [];

  if (typeof status.isRunning !== 'boolean') {
    errors.push('isRunning must be a boolean value');
  }

  const validSteps = [
    'idle',
    'logging-in',
    'navigating',
    'processing-connections',
    'completed',
    'error',
  ];
  if (!status.currentStep || !validSteps.includes(status.currentStep)) {
    errors.push(`currentStep must be one of: ${validSteps.join(', ')}`);
  }

  if (
    status.connectionsProcessed === undefined ||
    status.connectionsProcessed === null ||
    typeof status.connectionsProcessed !== 'number' ||
    status.connectionsProcessed < 0
  ) {
    errors.push('connectionsProcessed must be a non-negative number');
  }

  if (
    status.connectionsSuccessful === undefined ||
    status.connectionsSuccessful === null ||
    typeof status.connectionsSuccessful !== 'number' ||
    status.connectionsSuccessful < 0
  ) {
    errors.push('connectionsSuccessful must be a non-negative number');
  }

  if (
    status.maxConnections === undefined ||
    status.maxConnections === null ||
    typeof status.maxConnections !== 'number' ||
    status.maxConnections <= 0
  ) {
    errors.push('maxConnections must be a positive number');
  }

  if (
    status.connectionsSuccessful !== undefined &&
    status.connectionsProcessed !== undefined &&
    status.connectionsSuccessful > status.connectionsProcessed
  ) {
    errors.push(
      'connectionsSuccessful cannot be greater than connectionsProcessed'
    );
  }

  if (
    status.lastError !== undefined &&
    (typeof status.lastError !== 'string' || status.lastError.trim() === '')
  ) {
    errors.push('lastError must be a non-empty string if provided');
  }

  if (status.startTime !== undefined && !(status.startTime instanceof Date)) {
    errors.push('startTime must be a Date object if provided');
  }

  if (status.endTime !== undefined && !(status.endTime instanceof Date)) {
    errors.push('endTime must be a Date object if provided');
  }

  if (status.startTime && status.endTime && status.endTime < status.startTime) {
    errors.push('endTime cannot be before startTime');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
