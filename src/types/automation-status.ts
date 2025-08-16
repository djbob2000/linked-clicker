export interface AutomationStatus {
  isRunning: boolean;
  currentStep:
    | 'idle'
    | 'logging-in'
    | 'navigating'
    | 'processing-connections'
    | 'completed'
    | 'error';
  connectionsProcessed: number;
  connectionsSuccessful: number;
  maxConnections: number;
  lastError?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface AutomationStatusValidationResult {
  isValid: boolean;
  errors: string[];
}
