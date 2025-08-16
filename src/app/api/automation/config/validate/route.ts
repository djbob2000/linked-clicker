import { NextResponse } from 'next/server';
import { ApplicationStartup } from '../../../../../lib/application-startup';
import { getConfigurationService } from '../../../../../lib/dependency-injection';

export async function GET() {
  try {
    // Ensure application is initialized
    if (!ApplicationStartup.isInitialized()) {
      await ApplicationStartup.initialize();
    }

    const configService = getConfigurationService();
    const validation = configService.validateConfiguration();

    if (validation.isValid) {
      return NextResponse.json({
        valid: true,
        message: 'Configuration is valid',
      });
    } else {
      return NextResponse.json(
        {
          valid: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to validate configuration:', error);
    return NextResponse.json(
      {
        valid: false,
        error: 'Failed to validate configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
