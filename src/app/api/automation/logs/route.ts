import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../../lib/application-startup';
import { getLoggingService } from '../../../../lib/dependency-injection';

export async function GET(request: Request) {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    const loggingService = getLoggingService();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const level = url.searchParams.get('level');

    // Get logs from logging service
    const logs = loggingService.getLogs();
    let filteredLogs = logs;

    // Filter by log level if specified
    if (level) {
      filteredLogs = logs.filter((log) => log.level === level);
    }

    // Apply limit
    const limitedLogs = filteredLogs.slice(-Math.max(1, Math.min(1000, limit)));

    return NextResponse.json({
      logs: limitedLogs,
      total: filteredLogs.length,
      limit: limit,
    });
  } catch (error) {
    console.error('Failed to get logs:', error);
    return NextResponse.json(
      {
        error: 'Failed to get logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
