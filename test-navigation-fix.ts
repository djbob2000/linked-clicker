#!/usr/bin/env tsx

/**
 * Test script to verify LinkedIn navigation fix
 */

import dotenv from 'dotenv';
import { AutomationController } from './src/services/automation-controller';

// Load environment variables
dotenv.config();

async function testNavigation() {
  console.log('🚀 Testing LinkedIn navigation fix...');

  const controller = new AutomationController({
    headless: false, // Run in visible mode for debugging
    timeout: 60000,
  });

  try {
    // Register status callback to monitor progress
    controller.onStatusChange((status) => {
      console.log(`📊 Status: ${status.currentStep}`);
      if (status.lastError) {
        console.error(`❌ Error: ${status.lastError}`);
      }
    });

    console.log('🔐 Starting automation (login + navigation only)...');

    // Start the automation
    const result = await controller.start();

    if (result.success) {
      console.log('✅ Navigation test completed successfully!');
      console.log(`📈 Final status: ${result.status.currentStep}`);
    } else {
      console.error('❌ Navigation test failed:', result.error);
    }
  } catch (error) {
    console.error(
      '💥 Test failed with error:',
      error instanceof Error ? error.message : error
    );
  } finally {
    console.log('🧹 Cleaning up...');
    await controller.stop();
  }
}

// Run the test
if (require.main === module) {
  testNavigation()
    .then(() => {
      console.log('🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Test crashed:', error);
      process.exit(1);
    });
}
