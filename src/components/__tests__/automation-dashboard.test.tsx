import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutomationDashboard } from '../automation-dashboard';
import { AutomationStatus } from '../../types/automation-status';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AutomationDashboard', () => {
  const mockStatus: AutomationStatus = {
    isRunning: false,
    currentStep: 'idle',
    connectionsProcessed: 0,
    connectionsSuccessful: 0,
    maxConnections: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatus),
      text: () => Promise.resolve(''),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should render dashboard with initial status', async () => {
    render(<AutomationDashboard />);

    expect(
      screen.getByText('LinkedIn Connection Automation')
    ).toBeInTheDocument();
    expect(screen.getByText('Start Automation')).toBeInTheDocument();
    expect(screen.getByText('Stop Automation')).toBeInTheDocument();

    // Wait for initial status fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/automation/status');
    });
  });

  it('should display correct status information', async () => {
    const runningStatus: AutomationStatus = {
      ...mockStatus,
      isRunning: true,
      currentStep: 'processing-connections',
      connectionsProcessed: 25,
      connectionsSuccessful: 20,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runningStatus),
    });

    render(<AutomationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Processing connections...')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // Processed
      expect(screen.getByText('20')).toBeInTheDocument(); // Successful
      expect(screen.getByText('80')).toBeInTheDocument(); // Remaining
    });
  });

  it('should calculate progress percentage correctly', async () => {
    const statusWithProgress: AutomationStatus = {
      ...mockStatus,
      connectionsSuccessful: 25,
      maxConnections: 100,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(statusWithProgress),
    });

    render(<AutomationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('25% complete')).toBeInTheDocument();
    });
  });

  it('should handle start automation', async () => {
    render(<AutomationDashboard />);

    const startButton = screen.getByText('Start Automation');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/automation/start', {
        method: 'POST',
      });
    });
  });

  it('should handle stop automation', async () => {
    const runningStatus: AutomationStatus = {
      ...mockStatus,
      isRunning: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runningStatus),
    });

    render(<AutomationDashboard />);

    await waitFor(() => {
      const stopButton = screen.getByText('Stop Automation');
      expect(stopButton).not.toBeDisabled();
    });

    const stopButton = screen.getByText('Stop Automation');
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/automation/stop', {
        method: 'POST',
      });
    });
  });

  it('should disable buttons appropriately', async () => {
    const runningStatus: AutomationStatus = {
      ...mockStatus,
      isRunning: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runningStatus),
    });

    render(<AutomationDashboard />);

    await waitFor(() => {
      const startButton = screen.getByText('Start Automation');
      const stopButton = screen.getByText('Stop Automation');

      expect(startButton).toBeDisabled();
      expect(stopButton).not.toBeDisabled();
    });
  });

  it('should display error messages', async () => {
    const errorStatus: AutomationStatus = {
      ...mockStatus,
      currentStep: 'error',
      lastError: 'Failed to login to LinkedIn',
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(errorStatus),
    });

    render(<AutomationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to login to LinkedIn')
      ).toBeInTheDocument();
    });
  });

  it('should display timing information', async () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    const endTime = new Date('2024-01-01T10:05:00Z');

    const statusWithTiming: AutomationStatus = {
      ...mockStatus,
      currentStep: 'completed',
      startTime,
      endTime,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(statusWithTiming),
    });

    render(<AutomationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Started:/)).toBeInTheDocument();
      expect(screen.getByText(/Ended:/)).toBeInTheDocument();
      expect(screen.getByText(/Duration: 300s/)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<AutomationDashboard />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch automation status:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should poll for status updates when running', async () => {
    jest.useFakeTimers();

    const runningStatus: AutomationStatus = {
      ...mockStatus,
      isRunning: true,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(runningStatus),
    });

    render(<AutomationDashboard />);

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time to trigger polling
    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-dashboard-class';
    render(<AutomationDashboard className={customClass} />);

    const dashboard = screen
      .getByText('LinkedIn Connection Automation')
      .closest('div');
    expect(dashboard).toHaveClass(customClass);
  });

  it('should show loading state during operations', async () => {
    render(<AutomationDashboard />);

    const startButton = screen.getByText('Start Automation');
    fireEvent.click(startButton);

    // Should show loading state immediately
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });
});
