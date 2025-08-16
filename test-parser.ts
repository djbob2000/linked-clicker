#!/usr/bin/env tsx

/**
 * Test script for LinkedIn parser
 */

import {
  parseMutualConnectionCount,
  containsMutualConnectionInfo,
} from './src/lib/linkedin-parser';

function testParser() {
  console.log('🔍 Testing LinkedIn parser...');

  const testCases = [
    'Vitalii and 58 other mutual connections',
    'Serhii and 5 other mutual connections',
    'Anna and 123 other mutual connections',
    'and 42 other mutual connections',
    'and 1 other mutual connection',
    '15 mutual connections',
    '1 mutual connection',
    'No mutual connections',
    'Some random text',
    'John Doe\nSoftware Engineer\nVitalii and 58 other mutual connections\nConnect',
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    console.log(`Input: "${testCase}"`);

    const hasMutualInfo = containsMutualConnectionInfo(testCase);
    console.log(`Contains mutual info: ${hasMutualInfo}`);

    if (hasMutualInfo) {
      const count = parseMutualConnectionCount(testCase);
      console.log(`Parsed count: ${count}`);
      console.log(`Eligible (>= 100): ${count >= 100 ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('No mutual connections info found');
    }
  });
}

// Run the test
if (require.main === module) {
  testParser();
}
