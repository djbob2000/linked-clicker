import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../../lib/application-startup';
import { getAutomationController } from '../../../../lib/dependency-injection';

export async function POST() {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    const controller = getAutomationController();

    // Check if automation is running
    if (!controller.isRunning()) {
      return NextResponse.json(
        { error: 'Automation is not currently running' },
        { status: 400 }
      );
    }

    await controller.stop();

    return NextResponse.json({
      message: 'Automation stopped successfully',
      status: controller.getStatus(),
    });
  } catch (error) {
    console.error('Failed to stop automation:', error);
    return NextResponse.json(
      {
        error: 'Failed to stop automation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
