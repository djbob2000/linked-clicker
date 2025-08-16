import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../../lib/application-startup';
import { getConfigurationService } from '../../../../lib/dependency-injection';

export async function GET() {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    const configService = getConfigurationService();
    const config = configService.loadConfiguration();

    // Return non-sensitive configuration information
    return NextResponse.json({
      minMutualConnections: config.minMutualConnections,
      maxConnections: config.maxConnections,
      headless: config.headless,
      timeout: config.timeout,
      hasCredentials: !!(config.linkedinUsername && config.linkedinPassword),
    });
  } catch (error) {
    console.error('Failed to get configuration:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}
