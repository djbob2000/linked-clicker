/**
 * Parses mutual connection count from LinkedIn text
 * Handles various formats like:
 * - "Vitalii and 58 other mutual connections"
 * - "Serhii and 5 other mutual connections"
 * - "and 5 other mutual connections"
 * - "and 1 other mutual connection"
 * - "5 mutual connections"
 * - "1 mutual connection"
 */
export function parseMutualConnectionCount(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Clean the text - remove extra whitespace and convert to lowercase
  const cleanText = text.trim().toLowerCase();

  console.log(`Parsing mutual connections from: "${cleanText}"`);

  // Pattern 1: "Name and X other mutual connections" (most common format)
  const pattern1 = /\w+\s+and\s+(\d+)\s+other\s+mutual\s+connections?/;
  const match1 = cleanText.match(pattern1);
  if (match1) {
    const count = parseInt(match1[1], 10);
    console.log(`Pattern 1 matched: ${count} mutual connections`);
    return count;
  }

  // Pattern 2: "and X other mutual connections" or "and X other mutual connection"
  const pattern2 = /and\s+(\d+)\s+other\s+mutual\s+connections?/;
  const match2 = cleanText.match(pattern2);
  if (match2) {
    const count = parseInt(match2[1], 10);
    console.log(`Pattern 2 matched: ${count} mutual connections`);
    return count;
  }

  // Pattern 3: "X mutual connections" or "X mutual connection"
  const pattern3 = /(\d+)\s+mutual\s+connections?/;
  const match3 = cleanText.match(pattern3);
  if (match3) {
    const count = parseInt(match3[1], 10);
    console.log(`Pattern 3 matched: ${count} mutual connections`);
    return count;
  }

  // Pattern 4: Just a number followed by "other" (fallback)
  const pattern4 = /(\d+)\s+other/;
  const match4 = cleanText.match(pattern4);
  if (match4) {
    const count = parseInt(match4[1], 10);
    console.log(`Pattern 4 matched: ${count} other connections`);
    return count;
  }

  // If no pattern matches, return 0
  console.log('No mutual connections pattern matched, returning 0');
  return 0;
}

/**
 * Validates that a text contains mutual connection information
 */
export function containsMutualConnectionInfo(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const cleanText = text.trim().toLowerCase();

  // Check for common mutual connection phrases
  const patterns = [
    /mutual\s+connections?/,
    /other\s+mutual/,
    /shared\s+connections?/,
  ];

  return patterns.some((pattern) => pattern.test(cleanText));
}

/**
 * Extracts name from LinkedIn connection card text
 * Attempts to find the person's name from various text formats
 */
export function extractConnectionName(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Split by lines and take the first non-empty line as potential name
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return '';
  }

  // The first line is usually the name
  let name = lines[0];

  // Remove common LinkedIn suffixes/prefixes
  name = name.replace(/^(connect with|view profile of)\s+/i, '');
  name = name.replace(/\s+(connect|view profile)$/i, '');

  // Remove degree indicators like "1st", "2nd", "3rd"
  name = name.replace(/\s+\d+(st|nd|rd|th)\s*$/i, '');

  return name.trim();
}

/**
 * Generates a unique ID for a connection based on name and other identifiers
 */
export function generateConnectionId(
  name: string,
  additionalInfo?: string
): string {
  const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const additional = additionalInfo
    ? `-${additionalInfo.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    : '';

  return `${baseId}${additional}-${timestamp}-${random}`;
}
