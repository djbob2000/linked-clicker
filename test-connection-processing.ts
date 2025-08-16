#!/usr/bin/env tsx

/**
 * Test script for connection processing with infinite scroll
 */

import dotenv from 'dotenv';
import { BrowserService } from './src/services/browser-service';
import { LoginHandler } from './src/services/login-handler';
import { NavigationHandler } from './src/services/navigation-handler';
import { ConnectionHandler } from './src/services/connection-handler-safe';
import { ConfigurationService } from './src/services/configuration';

// Load environment variables
dotenv.config();

async function testConnectionProcessing() {
  console.log(
    '🔍 Testing LinkedIn connection processing with infinite scroll...'
  );

  const configService = new ConfigurationService();

  // Validate configuration first
  try {
    configService.validateOrThrow();
    console.log('✅ Configuration is valid');
  } catch (error) {
    console.error('❌ Configuration error:', error);
    return;
  }

  const browserService = new BrowserService({
    headless: false, // Always visible for debugging
    timeout: 60000,
    userDataDir: process.env.USER_DATA_DIR || './browser-profile',
    useExistingProfile: process.env.USE_EXISTING_PROFILE === 'true',
  });

  const loginHandler = new LoginHandler(browserService, configService);
  const navigationHandler = new NavigationHandler(browserService);
  const connectionHandler = new ConnectionHandler(browserService);

  try {
    console.log('🚀 Step 1: Initializing browser...');
    await browserService.initialize();
    console.log('✅ Browser initialized successfully');

    console.log('🔐 Step 2: Logging in...');
    const loginResult = await loginHandler.login();

    if (!loginResult.success) {
      console.error('❌ Login failed:', loginResult.error);
      return;
    }
    console.log('✅ Login successful!');

    console.log('🌐 Step 3: Navigating to network page...');
    const navigationResult = await navigationHandler.navigateToNetworkGrowth();

    if (!navigationResult.success) {
      console.error('❌ Navigation failed:', navigationResult.error);
      return;
    }
    console.log('✅ Navigation successful!');

    console.log('🔗 Step 4: Processing connections...');

    // Get configuration values
    const minMutualConnections = configService.getMinMutualConnections();
    const maxConnections = Math.min(configService.getMaxConnections(), 5); // Limit to 5 for testing

    console.log(
      `Configuration: min ${minMutualConnections} mutual connections, max ${maxConnections} connections`
    );

    // Process connections
    const processingResult = await connectionHandler.processConnections(
      minMutualConnections,
      maxConnections
    );

    if (processingResult.success) {
      console.log('✅ Connection processing completed!');
      console.log(`📊 Results:`);
      console.log(
        `   - Cards processed: ${processingResult.connectionsProcessed}`
      );
      console.log(
        `   - Connections made: ${processingResult.connectionsSuccessful}`
      );
      console.log(
        `   - Success rate: ${Math.round(
          (processingResult.connectionsSuccessful /
            processingResult.connectionsProcessed) *
            100
        )}%`
      );

      if (
        processingResult.partialFailures &&
        processingResult.partialFailures.length > 0
      ) {
        console.log(
          `   - Partial failures: ${processingResult.partialFailures.length}`
        );
        processingResult.partialFailures.forEach((failure, i) => {
          console.log(`     ${i + 1}. ${failure}`);
        });
      }
    } else {
      console.error('❌ Connection processing failed:', processingResult.error);
    }

    console.log('⏳ Keeping browser open for 30 seconds for inspection...');
    await browserService.getPage().waitForTimeout(30000);
  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    console.log('🧹 Cleaning up...');
    await browserService.cleanup();
  }
}

// Run the test
if (require.main === module) {
  testConnectionProcessing()
    .then(() => {
      console.log('🏁 Connection processing test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Test crashed:', error);
      process.exit(1);
    });
}
