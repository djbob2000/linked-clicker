#!/usr/bin/env node

/**
 * Simple test script to verify automation functionality
 */

const {
  AutomationController,
} = require('./src/services/automation-controller');

async function testAutomation() {
  console.log('🚀 Starting LinkedIn automation test...');

  const controller = new AutomationController({
    headless: false, // Run in visible mode for debugging
    timeout: 30000,
  });

  try {
    // Register status callback to monitor progress
    controller.onStatusChange((status) => {
      console.log(
        `📊 Status: ${status.currentStep} - Processed: ${status.connectionsProcessed}, Successful: ${status.connectionsSuccessful}`
      );

      if (status.lastError) {
        console.error(`❌ Error: ${status.lastError}`);
      }
    });

    // Start automation
    const result = await controller.start();

    if (result.success) {
      console.log('✅ Automation started successfully');

      // Wait for completion or manual stop
      while (controller.isRunning()) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const currentStatus = controller.getStatus();
        console.log(`⏳ Current step: ${currentStatus.currentStep}`);
      }

      const finalStatus = controller.getStatus();
      console.log('🏁 Automation completed');
      console.log(
        `📈 Final results: ${finalStatus.connectionsSuccessful}/${finalStatus.maxConnections} connections made`
      );
    } else {
      console.error('❌ Failed to start automation:', result.error);
    }
  } catch (error) {
    console.error('💥 Automation error:', error);
  } finally {
    // Clean up
    await controller.stop();
    console.log('🧹 Cleanup completed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

// Run the test
testAutomation().catch(console.error);
