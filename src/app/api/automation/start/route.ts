import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../../lib/application-startup';
import {
  getAutomationController,
  getConfigurationService,
} from '../../../../lib/dependency-injection';

export async function POST() {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    // Validate configuration before starting
    const configService = getConfigurationService();
    const validation = configService.validateConfiguration();

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Configuration validation failed',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const controller = getAutomationController();

    // Check if already running
    if (controller.isRunning()) {
      return NextResponse.json(
        { error: 'Automation is already running' },
        { status: 400 }
      );
    }

    // Start automation in background
    controller.start().catch((error) => {
      console.error('Automation failed:', error);
    });

    return NextResponse.json({
      message: 'Automation started successfully',
      status: controller.getStatus(),
    });
  } catch (error) {
    console.error('Failed to start automation:', error);
    return NextResponse.json(
      {
        error: 'Failed to start automation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
