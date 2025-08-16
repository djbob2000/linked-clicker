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

    // Calculate additional metrics
    const metrics = {
      status: status,
      performance: {
        successRate:
          status.connectionsProcessed > 0
            ? (status.connectionsSuccessful / status.connectionsProcessed) * 100
            : 0,
        remainingConnections:
          status.maxConnections - status.connectionsSuccessful,
        progressPercentage:
          status.maxConnections > 0
            ? (status.connectionsSuccessful / status.maxConnections) * 100
            : 0,
      },
      timing: {
        startTime: status.startTime,
        endTime: status.endTime,
        duration:
          status.startTime && status.endTime
            ? status.endTime.getTime() - status.startTime.getTime()
            : status.startTime
            ? Date.now() - status.startTime.getTime()
            : 0,
      },
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Failed to get automation metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to get automation metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
