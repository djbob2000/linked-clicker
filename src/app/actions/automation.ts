'use server';

import { AutomationController } from '../../services/automation-controller';
import { ConfigurationService } from '../../services/configuration';
import { AutomationStatus } from '../../types/automation-status';

// Global automation controller instance
let automationController: AutomationController | null = null;

function getAutomationController(): AutomationController {
  if (!automationController) {
    automationController = new AutomationController();
  }
  return automationController;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
}

/**
 * Server action to start automation
 */
export async function startAutomation(): Promise<
  ActionResult<AutomationStatus>
> {
  try {
    // Validate configuration before starting
    const configService = new ConfigurationService();
    const validation = configService.validateConfiguration();

    if (!validation.isValid) {
      return {
        success: false,
        error: 'Configuration validation failed',
        details: validation.errors,
      };
    }

    const controller = getAutomationController();

    // Check if already running
    if (controller.isRunning()) {
      return {
        success: false,
        error: 'Automation is already running',
      };
    }

    // Start automation in background
    controller.start().catch((error) => {
      console.error('Automation failed:', error);
    });

    return {
      success: true,
      data: controller.getStatus(),
    };
  } catch (error) {
    console.error('Failed to start automation:', error);
    return {
      success: false,
      error: 'Failed to start automation',
      details: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Server action to stop automation
 */
export async function stopAutomation(): Promise<
  ActionResult<AutomationStatus>
> {
  try {
    const controller = getAutomationController();

    // Check if automation is running
    if (!controller.isRunning()) {
      return {
        success: false,
        error: 'Automation is not currently running',
      };
    }

    await controller.stop();

    return {
      success: true,
      data: controller.getStatus(),
    };
  } catch (error) {
    console.error('Failed to stop automation:', error);
    return {
      success: false,
      error: 'Failed to stop automation',
      details: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Server action to get automation status
 */
export async function getAutomationStatus(): Promise<
  ActionResult<AutomationStatus>
> {
  try {
    const controller = getAutomationController();
    const status = controller.getStatus();

    return {
      success: true,
      data: status,
    };
  } catch (error) {
    console.error('Failed to get automation status:', error);
    return {
      success: false,
      error: 'Failed to get automation status',
      details: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Server action to validate configuration
 */
export async function validateConfiguration(): Promise<
  ActionResult<{ valid: boolean; errors?: string[] }>
> {
  try {
    const configService = new ConfigurationService();
    const validation = configService.validateConfiguration();

    return {
      success: true,
      data: {
        valid: validation.isValid,
        errors: validation.errors,
      },
    };
  } catch (error) {
    console.error('Failed to validate configuration:', error);
    return {
      success: false,
      error: 'Failed to validate configuration',
      details: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
/**
 * Server action to get configuration information (non-sensitive)
 */
export async function getConfigurationInfo(): Promise<
  ActionResult<{
    minMutualConnections: number;
    maxConnections: number;
    headless: boolean;
    timeout: number;
    hasCredentials: boolean;
  }>
> {
  try {
    const configService = new ConfigurationService();
    const config = configService.loadConfiguration();

    return {
      success: true,
      data: {
        minMutualConnections: config.minMutualConnections,
        maxConnections: config.maxConnections,
        headless: config.headless,
        timeout: config.timeout,
        hasCredentials: !!(config.linkedinUsername && config.linkedinPassword),
      },
    };
  } catch (error) {
    console.error('Failed to get configuration info:', error);
    return {
      success: false,
      error: 'Failed to get configuration info',
      details: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
