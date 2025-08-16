'use client';

import { useState, useEffect, useCallback } from 'react';
import { AutomationStatus } from '../types/automation-status';
// import { LogEntry } from '../types/logging';

// Hook to prevent hydration mismatch with dates
function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

interface AutomationDashboardProps {
  className?: string;
}

export function AutomationDashboard({
  className = '',
}: AutomationDashboardProps) {
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    currentStep: 'idle',
    connectionsProcessed: 0,
    connectionsSuccessful: 0,
    maxConnections: 100,
  });
  // const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isClient = useIsClient();

  // Fetch current status from API
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/automation/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch automation status:', error);
    }
  }, []);

  // Start automation
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/automation/start', {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
      } else {
        const error = await response.text();
        console.error('Failed to start automation:', error);
      }
    } catch (error) {
      console.error('Failed to start automation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop automation
  const handleStop = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/automation/stop', {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
      } else {
        const error = await response.text();
        console.error('Failed to stop automation:', error);
      }
    } catch (error) {
      console.error('Failed to stop automation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for status updates when running
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status.isRunning) {
      interval = setInterval(fetchStatus, 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status.isRunning, fetchStatus]);

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Calculate progress percentage
  const progressPercentage =
    status.maxConnections > 0
      ? Math.round((status.connectionsSuccessful / status.maxConnections) * 100)
      : 0;

  // Get status display info
  const getStatusInfo = () => {
    switch (status.currentStep) {
      case 'idle':
        return { text: 'Ready', color: 'text-gray-600' };
      case 'logging-in':
        return { text: 'Logging in to LinkedIn...', color: 'text-blue-600' };
      case 'navigating':
        return {
          text: 'Navigating to network section...',
          color: 'text-blue-600',
        };
      case 'processing-connections':
        return { text: 'Processing connections...', color: 'text-green-600' };
      case 'completed':
        return { text: 'Completed', color: 'text-green-600' };
      case 'error':
        return { text: 'Error occurred', color: 'text-red-600' };
      default:
        return { text: 'Unknown', color: 'text-gray-600' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          LinkedIn Connection Automation
        </h2>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 ${statusInfo.color}`}>
            <div
              className={`w-3 h-3 rounded-full ${
                status.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="font-medium">{statusInfo.text}</span>
          </div>
          {status.isRunning && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Connection Progress
          </span>
          <span className="text-sm text-gray-500">
            {status.connectionsSuccessful} / {status.maxConnections}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {progressPercentage}% complete
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">
            {status.connectionsProcessed}
          </div>
          <div className="text-sm text-gray-600">Processed</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">
            {status.connectionsSuccessful}
          </div>
          <div className="text-sm text-gray-600">Successful</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">
            {status.maxConnections - status.connectionsSuccessful}
          </div>
          <div className="text-sm text-gray-600">Remaining</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">
            {status.maxConnections}
          </div>
          <div className="text-sm text-gray-600">Max Limit</div>
        </div>
      </div>

      {/* Error Display */}
      {status.lastError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">Error:</span>
          </div>
          <p className="text-red-700 mt-1">{status.lastError}</p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={status.isRunning || isLoading}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            status.isRunning || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Starting...
            </div>
          ) : (
            'Start Automation'
          )}
        </button>

        <button
          onClick={handleStop}
          disabled={!status.isRunning || isLoading}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            !status.isRunning || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Stopping...
            </div>
          ) : (
            'Stop Automation'
          )}
        </button>
      </div>

      {/* Timing Information */}
      {isClient && (status.startTime || status.endTime) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 space-y-1">
            {status.startTime && (
              <div>Started: {new Date(status.startTime).toLocaleString()}</div>
            )}
            {status.endTime && (
              <div>Ended: {new Date(status.endTime).toLocaleString()}</div>
            )}
            {status.startTime && status.endTime && (
              <div>
                Duration:{' '}
                {Math.round(
                  (new Date(status.endTime).getTime() -
                    new Date(status.startTime).getTime()) /
                    1000
                )}
                s
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
