import { AutomationController } from '../services/automation-controller';

/**
 * Example demonstrating how to use the AutomationController
 * This example shows the complete workflow orchestration
 */
async function runAutomationExample() {
  // Create automation controller with custom configuration
  const controller = new AutomationController({
    headless: false, // Set to true for production
    timeout: 30000, // 30 second timeout
  });

  // Set up status monitoring
  controller.onStatusChange((status) => {
    console.log(`Status Update: ${status.currentStep}`);
    console.log(`Running: ${status.isRunning}`);
    console.log(
      `Connections: ${status.connectionsSuccessful}/${status.maxConnections}`
    );

    if (status.lastError) {
      console.error(`Error: ${status.lastError}`);
    }
  });

  try {
    console.log('Starting LinkedIn automation...');

    // Start the automation workflow
    const result = await controller.start();

    if (result.success) {
      console.log('Automation completed successfully!');

      // Get final progress
      const progress = controller.getConnectionProgress();
      console.log(`Final Results:`);
      console.log(`- Processed: ${progress.processed} connections`);
      console.log(`- Successful: ${progress.successful} connections`);
      console.log(`- Remaining: ${progress.remaining} connections`);

      // Get duration
      const duration = controller.getDuration();
      if (duration) {
        console.log(`- Duration: ${Math.round(duration / 1000)} seconds`);
      }
    } else {
      console.error('Automation failed:', result.error);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // Always stop and cleanup
    await controller.stop();
    console.log('Automation stopped and cleaned up');
  }
}

/**
 * Example of monitoring automation progress in real-time
 */
async function monitorAutomationProgress() {
  const controller = new AutomationController();

  // Set up detailed progress monitoring
  controller.onStatusChange((status) => {
    switch (status.currentStep) {
      case 'logging-in':
        console.log('🔐 Logging into LinkedIn...');
        break;
      case 'navigating':
        console.log('🧭 Navigating to network growth section...');
        break;
      case 'processing-connections':
        console.log('🤝 Processing connections...');
        console.log(
          `   Progress: ${status.connectionsSuccessful}/${status.maxConnections}`
        );
        break;
      case 'completed':
        console.log('✅ Automation completed successfully!');
        break;
      case 'error':
        console.log('❌ Automation failed:', status.lastError);
        break;
    }
  });

  // Start automation
  const result = await controller.start();

  // Clean up
  await controller.stop();

  return result;
}

/**
 * Example of handling automation errors and retries
 */
async function automationWithRetry(maxRetries = 3) {
  const controller = new AutomationController();
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`Automation attempt ${attempt}/${maxRetries}`);

    try {
      const result = await controller.start();

      if (result.success) {
        console.log('Automation succeeded!');
        await controller.stop();
        return result;
      } else {
        console.warn(`Attempt ${attempt} failed:`, result.error);

        if (attempt < maxRetries) {
          console.log('Retrying in 5 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Reset controller state
          controller.reset();
        }
      }
    } catch (error) {
      console.error(`Attempt ${attempt} threw error:`, error);
    } finally {
      await controller.stop();
    }
  }

  throw new Error(`Automation failed after ${maxRetries} attempts`);
}

// Export examples for use in other files
export { runAutomationExample, monitorAutomationProgress, automationWithRetry };

// Example usage (uncomment to run):
// runAutomationExample().catch(console.error);
