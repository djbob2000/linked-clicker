#!/usr/bin/env tsx

import { ApplicationStartup } from '../src/lib/application-startup';

async function validateConfig() {
  try {
    await ApplicationStartup.initialize();
    console.log('✅ Configuration valid');
    await ApplicationStartup.shutdown();
    process.exit(0);
  } catch (error) {
    console.error(
      '❌ Configuration invalid:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

validateConfig();
