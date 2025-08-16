import { ConfigurationService } from '../configuration';

describe('ConfigurationService', () => {
  let configService: ConfigurationService;
  const originalEnv = process.env;

  beforeEach(() => {
    configService = new ConfigurationService();
    // Reset environment variables before each test
    process.env = { ...originalEnv };
    configService.resetConfiguration();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfiguration', () => {
    it('should load configuration from environment variables', () => {
      process.env.LINKEDIN_USERNAME = 'test@example.com';
      process.env.LINKEDIN_PASSWORD = 'testpass';
      process.env.MIN_MUTUAL_CONNECTIONS = '10';
      process.env.MAX_CONNECTIONS = '50';
      process.env.HEADLESS = 'false';
      process.env.TIMEOUT = '60000';

      const config = configService.loadConfiguration();

      expect(config.linkedinUsername).toBe('test@example.com');
      expect(config.linkedinPassword).toBe('testpass');
      expect(config.minMutualConnections).toBe(10);
      expect(config.maxConnections).toBe(50);
      expect(config.headless).toBe(false);
      expect(config.timeout).toBe(60000);
    });

    it('should use default values when environment variables are not set', () => {
      const config = configService.loadConfiguration();

      expect(config.linkedinUsername).toBe('');
      expect(config.linkedinPassword).toBe('');
      expect(config.minMutualConnections).toBe(0);
      expect(config.maxConnections).toBe(100);
      expect(config.headless).toBe(true);
      expect(config.timeout).toBe(30000);
    });
  });

  describe('validateConfiguration', () => {
    it('should return valid result when all required fields are present', () => {
      process.env.LINKEDIN_USERNAME = 'test@example.com';
      process.env.LINKEDIN_PASSWORD = 'testpass';
      process.env.MIN_MUTUAL_CONNECTIONS = '5';

      const result = configService.validateConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when required fields are missing', () => {
      const result = configService.validateConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'LINKEDIN_USERNAME environment variable is required'
      );
      expect(result.errors).toContain(
        'LINKEDIN_PASSWORD environment variable is required'
      );
    });

    it('should validate numeric constraints', () => {
      process.env.LINKEDIN_USERNAME = 'test@example.com';
      process.env.LINKEDIN_PASSWORD = 'testpass';
      process.env.MIN_MUTUAL_CONNECTIONS = '-1';
      process.env.MAX_CONNECTIONS = '0';
      process.env.TIMEOUT = 'invalid';

      const result = configService.validateConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'MIN_MUTUAL_CONNECTIONS must be a valid non-negative number'
      );
      expect(result.errors).toContain(
        'MAX_CONNECTIONS must be a valid positive number'
      );
      expect(result.errors).toContain(
        'TIMEOUT must be a valid positive number (in milliseconds)'
      );
    });
  });

  describe('helper methods', () => {
    beforeEach(() => {
      process.env.LINKEDIN_USERNAME = 'test@example.com';
      process.env.LINKEDIN_PASSWORD = 'testpass';
      process.env.MIN_MUTUAL_CONNECTIONS = '10';
      process.env.MAX_CONNECTIONS = '50';
    });

    it('should return LinkedIn credentials', () => {
      const credentials = configService.getLinkedInCredentials();
      expect(credentials.username).toBe('test@example.com');
      expect(credentials.password).toBe('testpass');
    });

    it('should return minimum mutual connections', () => {
      expect(configService.getMinMutualConnections()).toBe(10);
    });

    it('should return maximum connections', () => {
      expect(configService.getMaxConnections()).toBe(50);
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw when configuration is valid', () => {
      process.env.LINKEDIN_USERNAME = 'test@example.com';
      process.env.LINKEDIN_PASSWORD = 'testpass';

      expect(() => configService.validateOrThrow()).not.toThrow();
    });

    it('should throw when configuration is invalid', () => {
      expect(() => configService.validateOrThrow()).toThrow(
        'Configuration validation failed'
      );
    });
  });
});
