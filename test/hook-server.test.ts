import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, request, IncomingMessage, ServerResponse } from 'http';
import type { Server, AddressInfo } from 'http';

function startTestHookServer(): Promise<{
  server: Server;
  port: number;
  events: unknown[];
}> {
  const events: unknown[] = [];
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'POST' && req.url === '/hook') {
        let body = '';
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            events.push(payload);
            res.writeHead(200);
            res.end('ok');
          } catch {
            res.writeHead(400);
            res.end('bad request');
          }
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port, events });
    });
  });
}

function post(port: number, path: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => resolve(res.statusCode!),
    );
    req.on('error', reject);
    req.end(body);
  });
}

function get(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) =>
      resolve(res.statusCode!),
    );
    req.on('error', reject);
    req.end();
  });
}

describe('hook server', () => {
  let server: Server;
  let port: number;
  let events: unknown[];

  beforeAll(async () => {
    ({ server, port, events } = await startTestHookServer());
  });

  afterAll(() => {
    server.close();
  });

  it('accepts valid hook event and stores payload', async () => {
    const payload = {
      pane_id: 'pane-123',
      event: { hook_event_name: 'SessionStart', session_id: 'abc' },
    };
    const status = await post(port, '/hook', JSON.stringify(payload));
    expect(status).toBe(200);
    expect(events).toContainEqual(payload);
  });

  it('returns 400 for malformed JSON', async () => {
    const status = await post(port, '/hook', 'not json{{{');
    expect(status).toBe(400);
  });

  it('returns 404 for unknown routes', async () => {
    const status = await get(port, '/unknown');
    expect(status).toBe(404);
  });

  it('handles all Claude hook event types', async () => {
    const hookEvents = [
      'UserPromptSubmit',
      'Stop',
      'PermissionRequest',
      'Notification',
      'SessionEnd',
    ];
    for (const evt of hookEvents) {
      events.length = 0;
      const payload = {
        pane_id: 'pane-456',
        event: { hook_event_name: evt },
      };
      const status = await post(port, '/hook', JSON.stringify(payload));
      expect(status).toBe(200);
      expect(events[0]).toEqual(payload);
    }
  });

  it('handles notification subtypes', async () => {
    events.length = 0;
    const payload = {
      pane_id: 'pane-789',
      event: {
        hook_event_name: 'Notification',
        notification_type: 'permission_prompt',
      },
    };
    const status = await post(port, '/hook', JSON.stringify(payload));
    expect(status).toBe(200);
    expect(events[0]).toEqual(payload);
  });

  it('routes events by pane_id', async () => {
    events.length = 0;
    const pane1 = { pane_id: 'pane-aaa', event: { hook_event_name: 'SessionStart' } };
    const pane2 = { pane_id: 'pane-bbb', event: { hook_event_name: 'SessionStart' } };
    await post(port, '/hook', JSON.stringify(pane1));
    await post(port, '/hook', JSON.stringify(pane2));
    expect(events).toHaveLength(2);
    expect((events[0] as { pane_id: string }).pane_id).toBe('pane-aaa');
    expect((events[1] as { pane_id: string }).pane_id).toBe('pane-bbb');
  });
});
