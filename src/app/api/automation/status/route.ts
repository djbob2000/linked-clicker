import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../../lib/application-startup';
import { getAutomationController } from '../../../../lib/dependency-injection';

export async function GET() {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    const controller = getAutomationController();
    const status = controller.getStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get automation status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get automation status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
