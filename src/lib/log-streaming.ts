import { LogEntry } from '../types/logging';

// Global log subscribers for Server-Sent Events
const logSubscribers = new Set<(entry: LogEntry) => void>();

export function broadcastLog(entry: LogEntry) {
  logSubscribers.forEach((callback) => {
    try {
      callback(entry);
    } catch (error) {
      console.error('Error broadcasting log:', error);
    }
  });
}

export function addLogSubscriber(
  callback: (entry: LogEntry) => void
): () => void {
  logSubscribers.add(callback);

  // Return unsubscribe function
  return () => {
    logSubscribers.delete(callback);
  };
}

export function getSubscriberCount(): number {
  return logSubscribers.size;
}
