'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LogEntry, LogLevel } from '../types/logging';

// Hook to prevent hydration mismatch with dates
function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

interface LogDisplayProps {
  className?: string;
  maxEntries?: number;
  autoScroll?: boolean;
}

export function LogDisplay({
  className = '',
  maxEntries = 100,
  autoScroll = true,
}: LogDisplayProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  // Fetch existing logs
  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/logs');
      if (response.ok) {
        const data = await response.json();
        // Handle the API response format { logs: [], total: number, limit: number }
        const logsArray = Array.isArray(data) ? data : data.logs || [];
        setLogs(logsArray.slice(-maxEntries));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, [maxEntries]);

  // Set up Server-Sent Events for real-time logs
  useEffect(() => {
    let eventSource: EventSource;

    const connectToLogs = () => {
      eventSource = new EventSource('/api/automation/logs/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const logEntry: LogEntry = JSON.parse(event.data);
          setLogs((prevLogs) => {
            const newLogs = [...prevLogs, logEntry];
            return newLogs.slice(-maxEntries); // Keep only the last maxEntries
          });
        } catch (error) {
          console.error('Failed to parse log entry:', error);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        // Reconnect after a delay
        setTimeout(connectToLogs, 3000);
      };
    };

    // Initial log fetch
    fetchLogs();

    // Connect to real-time stream
    connectToLogs();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [maxEntries, fetchLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs based on selected level
  const filteredLogs = logs.filter(
    (log) => filter === 'all' || log.level === filter
  );

  // Get log level styling
  const getLogLevelStyle = (level: LogLevel) => {
    switch (level) {
      case 'debug':
        return 'text-gray-600 bg-gray-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // Get log level icon
  const getLogLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'debug':
        return '🔍';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Automation Logs
            </h3>
            <div
              className={`flex items-center gap-2 text-sm ${
                isConnected ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Log Level Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>

            {/* Clear Button */}
            <button
              onClick={clearLogs}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={logContainerRef}
        className="h-96 overflow-y-auto p-4 space-y-2 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getLogLevelStyle(log.level)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{getLogLevelIcon(log.level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium uppercase text-xs">
                      {log.level}
                    </span>
                    {isClient && (
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-900 break-words">{log.message}</div>

                  {/* Context Information */}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                      <div className="font-medium text-gray-700 mb-1">
                        Context:
                      </div>
                      <pre className="text-gray-600 whitespace-pre-wrap">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error Details */}
                  {log.error && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                      <div className="font-medium text-red-700 mb-1">
                        Error:
                      </div>
                      <div className="text-red-600">{log.error.message}</div>
                      {log.error.stack && (
                        <pre className="text-red-500 mt-1 text-xs whitespace-pre-wrap">
                          {log.error.stack}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            Showing {filteredLogs.length} of {logs.length} entries
          </span>
          <span>Auto-scroll: {autoScroll ? 'On' : 'Off'}</span>
        </div>
      </div>
    </div>
  );
}
