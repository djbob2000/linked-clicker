import {
  AppConfiguration,
  ConfigurationValidationResult,
} from '../types/configuration';

export class ConfigurationService {
  private config: AppConfiguration | null = null;

  /**
   * Gets the current configuration
   */
  public getConfiguration(): AppConfiguration {
    if (!this.config) {
      return this.loadConfiguration();
    }
    return this.config;
  }

  /**
   * Loads and parses configuration from environment variables
   */
  public loadConfiguration(): AppConfiguration {
    if (this.config) {
      return this.config;
    }

    this.config = {
      linkedinUsername: process.env.LINKEDIN_USERNAME || '',
      linkedinPassword: process.env.LINKEDIN_PASSWORD || '',
      minMutualConnections: parseInt(
        process.env.MIN_MUTUAL_CONNECTIONS || '0',
        10
      ),
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100', 10),
      headless: process.env.HEADLESS !== 'false', // Default to true unless explicitly set to false
      timeout: parseInt(process.env.TIMEOUT || '30000', 10), // Default 30 seconds
    };

    return this.config;
  }

  /**
   * Validates the current configuration
   */
  public validateConfiguration(): ConfigurationValidationResult {
    const config = this.loadConfiguration();
    const errors: string[] = [];

    // Validate required LinkedIn credentials
    if (!config.linkedinUsername) {
      errors.push('LINKEDIN_USERNAME environment variable is required');
    }

    if (!config.linkedinPassword) {
      errors.push('LINKEDIN_PASSWORD environment variable is required');
    }

    // Validate numeric values
    if (isNaN(config.minMutualConnections) || config.minMutualConnections < 0) {
      errors.push('MIN_MUTUAL_CONNECTIONS must be a valid non-negative number');
    }

    if (isNaN(config.maxConnections) || config.maxConnections <= 0) {
      errors.push('MAX_CONNECTIONS must be a valid positive number');
    }

    if (isNaN(config.timeout) || config.timeout <= 0) {
      errors.push('TIMEOUT must be a valid positive number (in milliseconds)');
    }

    // Validate logical constraints
    if (config.maxConnections > 1000) {
      errors.push('MAX_CONNECTIONS should not exceed 1000 for safety reasons');
    }

    if (config.minMutualConnections > 500) {
      errors.push('MIN_MUTUAL_CONNECTIONS seems unreasonably high (>500)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets LinkedIn credentials from configuration
   */
  public getLinkedInCredentials(): { username: string; password: string } {
    const config = this.loadConfiguration();
    return {
      username: config.linkedinUsername,
      password: config.linkedinPassword,
    };
  }

  /**
   * Gets minimum mutual connections threshold
   */
  public getMinMutualConnections(): number {
    const config = this.loadConfiguration();
    return config.minMutualConnections;
  }

  /**
   * Gets maximum connections limit
   */
  public getMaxConnections(): number {
    const config = this.loadConfiguration();
    return config.maxConnections;
  }

  /**
   * Gets browser headless setting
   */
  public isHeadless(): boolean {
    const config = this.loadConfiguration();
    return config.headless;
  }

  /**
   * Gets timeout setting in milliseconds
   */
  public getTimeout(): number {
    const config = this.loadConfiguration();
    return config.timeout;
  }

  /**
   * Validates configuration and throws error if invalid
   */
  public validateOrThrow(): void {
    const validation = this.validateConfiguration();
    if (!validation.isValid) {
      const errorMessage = `Configuration validation failed:\n${validation.errors.join(
        '\n'
      )}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Resets cached configuration (useful for testing)
   */
  public resetConfiguration(): void {
    this.config = null;
  }
}
