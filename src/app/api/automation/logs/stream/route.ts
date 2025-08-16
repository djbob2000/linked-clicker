import { NextRequest } from 'next/server';
import { LogEntry } from '../../../../../types/logging';
import { addLogSubscriber } from '../../../../../lib/log-streaming';

export async function GET(request: NextRequest) {
  // Set up Server-Sent Events
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const data = `data: ${JSON.stringify({
        timestamp: new Date(),
        level: 'info',
        message: 'Connected to log stream',
      })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // Set up log subscriber
      const subscriber = (entry: LogEntry) => {
        const data = `data: ${JSON.stringify(entry)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream might be closed
          unsubscribe();
        }
      };

      const unsubscribe = addLogSubscriber(subscriber);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
