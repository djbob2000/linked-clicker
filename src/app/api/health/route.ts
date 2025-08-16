import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../lib/application-startup';

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET() {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    // Perform health check
    const healthCheck = await ApplicationStartup.performHealthCheck();

    // Return appropriate status code based on health
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    return NextResponse.json(healthCheck, { status: statusCode });
  } catch (error) {
    // Return error response for initialization failures
    return NextResponse.json(
      {
        status: 'unhealthy',
        checks: [
          {
            name: 'Application Initialization',
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        timestamp: new Date(),
      },
      { status: 503 }
    );
  }
}
