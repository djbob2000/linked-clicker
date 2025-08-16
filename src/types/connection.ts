import { ElementHandle } from 'playwright';

export interface Connection {
  id: string;
  name: string;
  mutualConnectionsCount: number;
  profileUrl?: string;
  cardElement: ElementHandle;
}

export interface ConnectionValidationResult {
  isValid: boolean;
  errors: string[];
}
