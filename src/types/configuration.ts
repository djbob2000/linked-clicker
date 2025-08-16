export interface AppConfiguration {
  linkedinUsername: string;
  linkedinPassword: string;
  minMutualConnections: number;
  maxConnections: number;
  headless: boolean;
  timeout: number;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
}
