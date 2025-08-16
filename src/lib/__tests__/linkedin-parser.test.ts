import {
  parseMutualConnectionCount,
  containsMutualConnectionInfo,
  extractConnectionName,
  generateConnectionId,
} from '../linkedin-parser';

describe('LinkedIn Parser', () => {
  describe('parseMutualConnectionCount', () => {
    it('should parse mutual connections count from standard format', () => {
      const text = 'John and 12 other mutual connections';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(12);
    });

    it('should parse mutual connections count from alternative format', () => {
      const text = '8 mutual connections';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(8);
    });

    it('should handle single mutual connection', () => {
      const text = 'Bob and 1 other mutual connection';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(1);
    });

    it('should handle no mutual connections text', () => {
      const text = 'No mutual connections';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(0);
    });

    it('should handle empty or invalid text', () => {
      expect(parseMutualConnectionCount('')).toBe(0);
      expect(parseMutualConnectionCount('Invalid text')).toBe(0);
      expect(parseMutualConnectionCount('Some random text')).toBe(0);
    });

    it('should handle large numbers', () => {
      const text = 'Alice and 500 other mutual connections';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(500);
    });

    it('should handle text with multiple numbers', () => {
      const text =
        'Connected to 5 people including John and 12 other mutual connections';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(12);
    });

    it('should handle fallback pattern with just number and other', () => {
      const text = '15 other connections';
      const result = parseMutualConnectionCount(text);
      expect(result).toBe(15);
    });
  });

  describe('containsMutualConnectionInfo', () => {
    it('should return true for text with mutual connections', () => {
      expect(containsMutualConnectionInfo('5 mutual connections')).toBe(true);
      expect(
        containsMutualConnectionInfo('and 10 other mutual connections')
      ).toBe(true);
      expect(
        containsMutualConnectionInfo('shared connections with this person')
      ).toBe(true);
    });

    it('should return false for text without mutual connection info', () => {
      expect(containsMutualConnectionInfo('Software Engineer')).toBe(false);
      expect(containsMutualConnectionInfo('Works at Google')).toBe(false);
      expect(containsMutualConnectionInfo('')).toBe(false);
    });

    it('should handle null and undefined inputs', () => {
      expect(containsMutualConnectionInfo(null)).toBe(false);
      expect(containsMutualConnectionInfo(undefined)).toBe(false);
    });
  });

  describe('extractConnectionName', () => {
    it('should extract name from simple text', () => {
      const text = 'John Doe\nSoftware Engineer at Google';
      const result = extractConnectionName(text);
      expect(result).toBe('John Doe');
    });

    it('should extract name from single line', () => {
      const text = 'Jane Smith';
      const result = extractConnectionName(text);
      expect(result).toBe('Jane Smith');
    });

    it('should remove LinkedIn prefixes', () => {
      const text = 'Connect with John Doe';
      const result = extractConnectionName(text);
      expect(result).toBe('John Doe');
    });

    it('should remove LinkedIn suffixes', () => {
      const text = 'John Doe Connect';
      const result = extractConnectionName(text);
      expect(result).toBe('John Doe');
    });

    it('should remove degree indicators', () => {
      const text = 'John Doe 1st';
      const result = extractConnectionName(text);
      expect(result).toBe('John Doe');
    });

    it('should handle empty or invalid text', () => {
      expect(extractConnectionName('')).toBe('');
      expect(extractConnectionName('   ')).toBe('');
      expect(extractConnectionName(null)).toBe('');
      expect(extractConnectionName(undefined)).toBe('');
    });

    it('should handle multiline text with empty lines', () => {
      const text = '\n\nJohn Doe\n\nSoftware Engineer\n\n';
      const result = extractConnectionName(text);
      expect(result).toBe('John Doe');
    });
  });

  describe('generateConnectionId', () => {
    it('should generate unique ID from name', () => {
      const id1 = generateConnectionId('John Doe');
      const id2 = generateConnectionId('John Doe');

      expect(id1).toMatch(/^john-doe-/);
      expect(id2).toMatch(/^john-doe-/);
      expect(id1).not.toBe(id2); // Should be unique
    });

    it('should handle names with special characters', () => {
      const id = generateConnectionId("María José O'Connor");
      expect(id).toMatch(/^mar-a-jos--o-connor-/);
    });

    it('should include additional info when provided', () => {
      const id = generateConnectionId('John Doe', 'Software Engineer');
      expect(id).toMatch(/^john-doe-software-engineer-/);
    });

    it('should handle empty name', () => {
      const id = generateConnectionId('');
      expect(id).toMatch(/^-/);
    });

    it('should generate different IDs for same input called at different times', () => {
      const id1 = generateConnectionId('Test User');
      // Small delay to ensure different timestamp
      const id2 = generateConnectionId('Test User');

      expect(id1).not.toBe(id2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(parseMutualConnectionCount(null)).toBe(0);
      expect(parseMutualConnectionCount(undefined)).toBe(0);
      expect(extractConnectionName(null)).toBe('');
      expect(extractConnectionName(undefined)).toBe('');
    });

    it('should handle very long text inputs', () => {
      const longText = 'A'.repeat(1000) + ' and 15 other mutual connections';
      const count = parseMutualConnectionCount(longText);
      expect(count).toBe(15);
    });

    it('should handle text with special characters and emojis', () => {
      const text = '🚀 John Doe 👨‍💻 and 8 other mutual connections 🔗';
      const count = parseMutualConnectionCount(text);
      expect(count).toBe(8);
    });

    it('should handle different number formats', () => {
      // Test with different number formats
      const texts = [
        'John and 1,234 other mutual connections', // Should not parse comma
        'Jane and 5.5 other mutual connections', // Should parse as 5
        'Bob and twelve other mutual connections', // Should not parse
      ];

      expect(parseMutualConnectionCount(texts[0])).toBe(234); // Comma parsed as part of number
      expect(parseMutualConnectionCount(texts[1])).toBe(5); // Decimal truncated
      expect(parseMutualConnectionCount(texts[2])).toBe(0); // Non-numeric
    });

    it('should handle case insensitive matching', () => {
      const text = 'JOHN AND 10 OTHER MUTUAL CONNECTIONS';
      const count = parseMutualConnectionCount(text);
      expect(count).toBe(10);
    });

    it('should handle extra whitespace', () => {
      const text = '   John   and   5   other   mutual   connections   ';
      const count = parseMutualConnectionCount(text);
      expect(count).toBe(5);
    });
  });
});
