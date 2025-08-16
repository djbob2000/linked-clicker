import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogDisplay } from '../log-display';
import { LogEntry } from '../../types/logging';

// Mock EventSource
class MockEventSource {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {}

  close() {}

  // Helper methods for testing
  simulateOpen() {
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

global.EventSource = MockEventSource as unknown as typeof EventSource;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('LogDisplay', () => {
  const mockLogs: LogEntry[] = [
    {
      level: 'info',
      message: 'Starting automation',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      context: { step: 'initialization' },
    },
    {
      level: 'warn',
      message: 'Rate limit approaching',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      context: { remaining: 5 },
    },
    {
      level: 'error',
      message: 'Connection failed',
      timestamp: new Date('2024-01-01T10:02:00Z'),
      error: {
        name: 'Error',
        message: 'Network timeout',
        stack: 'Error: Network timeout\n    at test.js:1:1',
      },
    },
  ];

  let mockEventSource: MockEventSource;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLogs),
    });

    // Capture the EventSource instance
    const originalEventSource = global.EventSource;
    global.EventSource = jest.fn().mockImplementation((url) => {
      mockEventSource = new MockEventSource(url);
      return mockEventSource;
    }) as unknown as typeof EventSource;
    Object.assign(global.EventSource, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should render log display with initial logs', async () => {
    render(<LogDisplay />);

    expect(screen.getByText('Automation Logs')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/automation/logs');
    });

    await waitFor(() => {
      expect(screen.getByText('Starting automation')).toBeInTheDocument();
      expect(screen.getByText('Rate limit approaching')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('should establish EventSource connection', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      expect(global.EventSource).toHaveBeenCalledWith(
        '/api/automation/logs/stream'
      );
    });
  });

  it('should show connected status when EventSource opens', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      mockEventSource.simulateOpen();
    });

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should show disconnected status on EventSource error', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      mockEventSource.simulateError();
    });

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('should receive and display real-time log entries', async () => {
    render(<LogDisplay />);

    const newLogEntry: LogEntry = {
      level: 'debug',
      message: 'New real-time log',
      timestamp: new Date(),
    };

    await waitFor(() => {
      mockEventSource.simulateMessage(JSON.stringify(newLogEntry));
    });

    await waitFor(() => {
      expect(screen.getByText('New real-time log')).toBeInTheDocument();
    });
  });

  it('should filter logs by level', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Starting automation')).toBeInTheDocument();
    });

    // Filter to only show errors
    const filterSelect = screen.getByDisplayValue('All Levels');
    fireEvent.change(filterSelect, { target: { value: 'error' } });

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.queryByText('Starting automation')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Rate limit approaching')
    ).not.toBeInTheDocument();
  });

  it('should clear logs when clear button is clicked', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Starting automation')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    expect(screen.queryByText('Starting automation')).not.toBeInTheDocument();
    expect(screen.getByText('No logs to display')).toBeInTheDocument();
  });

  it('should display log context information', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Starting automation')).toBeInTheDocument();
    });

    // Check for context display
    expect(screen.getByText('Context:')).toBeInTheDocument();
    expect(screen.getByText(/"step": "initialization"/)).toBeInTheDocument();
  });

  it('should display error details', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    // Check for error details
    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByText(/Error: Network timeout/)).toBeInTheDocument();
  });

  it('should respect maxEntries prop', async () => {
    const manyLogs = Array.from({ length: 150 }, (_, i) => ({
      level: 'info' as const,
      message: `Log entry ${i}`,
      timestamp: new Date(),
    }));

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(manyLogs),
    });

    render(<LogDisplay maxEntries={50} />);

    await waitFor(() => {
      // Should only show the last 50 entries
      expect(screen.getByText('Log entry 149')).toBeInTheDocument();
      expect(screen.getByText('Log entry 100')).toBeInTheDocument();
      expect(screen.queryByText('Log entry 99')).not.toBeInTheDocument();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValue(new Error('Fetch failed'));

    render(<LogDisplay />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch logs:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should handle invalid JSON in EventSource messages', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<LogDisplay />);

    await waitFor(() => {
      mockEventSource.simulateMessage('invalid json');
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse log entry:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-log-display';
    render(<LogDisplay className={customClass} />);

    const logDisplay = screen.getByText('Automation Logs').closest('div');
    expect(logDisplay).toHaveClass(customClass);
  });

  it('should show correct log level icons and styling', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      // Check for different log level icons (emojis)
      expect(screen.getByText('ℹ️')).toBeInTheDocument(); // info
      expect(screen.getByText('⚠️')).toBeInTheDocument(); // warn
      expect(screen.getByText('❌')).toBeInTheDocument(); // error
    });
  });

  it('should display entry count in footer', async () => {
    render(<LogDisplay />);

    await waitFor(() => {
      expect(
        screen.getByText(/Showing \d+ of \d+ entries/)
      ).toBeInTheDocument();
    });
  });

  it('should reconnect on EventSource error after delay', async () => {
    jest.useFakeTimers();

    render(<LogDisplay />);

    // Simulate error
    await waitFor(() => {
      mockEventSource.simulateError();
    });

    // Fast-forward time to trigger reconnection
    jest.advanceTimersByTime(3000);

    // Should create a new EventSource
    expect(global.EventSource).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
