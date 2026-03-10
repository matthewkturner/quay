import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import type { Server, AddressInfo } from 'http';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const scriptSrc = join(__dirname, '..', 'electron', 'quay-hook.sh');

function run(
  cmd: string,
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { env, timeout: 5000 }, (err, stdout, stderr) => {
      if (err && err.killed) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

describe('quay-hook.sh', () => {
  let server: Server;
  let port: number;
  let received: unknown[];
  let homeDir: string;
  let quayDir: string;

  beforeAll(async () => {
    homeDir = join(tmpdir(), `quay-test-home-${Date.now()}`);
    quayDir = join(homeDir, '.quay');
    mkdirSync(join(quayDir, 'panes'), { recursive: true });

    received = [];
    await new Promise<void>((resolve) => {
      server = createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/hook') {
          let body = '';
          req.on('data', (c: string) => (body += c));
          req.on('end', () => {
            try {
              received.push(JSON.parse(body));
            } catch {
              // ignore malformed JSON in tests
            }
            res.writeHead(200);
            res.end('ok');
          });
          return;
        }
        res.writeHead(404);
        res.end();
      });
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    writeFileSync(join(quayDir, 'hook-port'), String(port));
  });

  afterAll(() => {
    server.close();
    rmSync(homeDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    received.length = 0;
    for (const f of readdirSync(quayDir)) {
      if (f.startsWith('cache-')) rmSync(join(quayDir, f), { force: true });
    }
  });

  function runHook(event: object, extraEnv: Record<string, string> = {}) {
    const input = JSON.stringify(event).replace(/'/g, "'\\''");
    return run(`echo '${input}' | bash ${scriptSrc}`, {
      PATH: process.env.PATH || '/usr/bin:/bin',
      HOME: homeDir,
      ...extraEnv,
    });
  }

  it('exits silently when no port file and no env var', async () => {
    const emptyHome = join(tmpdir(), `quay-empty-${Date.now()}`);
    mkdirSync(emptyHome, { recursive: true });
    try {
      await run(`echo '{}' | bash ${scriptSrc}`, {
        PATH: process.env.PATH || '/usr/bin:/bin',
        HOME: emptyHome,
      });
      expect(received).toHaveLength(0);
    } finally {
      rmSync(emptyHome, { recursive: true, force: true });
    }
  });

  it('sends event using env vars (legacy mode)', async () => {
    const event = { hook_event_name: 'SessionStart', session_id: 'test-1' };
    await runHook(event, { QUAY_HOOK_PORT: String(port), QUAY_PANE_ID: 'pane-legacy' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ pane_id: 'pane-legacy', event });
  });

  it('sends event using file-based port and PID lookup', async () => {
    // PID 1 (init) is always an ancestor in the PID tree walk
    writeFileSync(join(quayDir, 'panes', '1'), 'pane-file-based');

    const event = { hook_event_name: 'UserPromptSubmit' };
    await runHook(event);
    expect(received).toHaveLength(1);
    expect((received[0] as { pane_id: string }).pane_id).toBe('pane-file-based');
  });

  it('sends correct event payload for all hook types', async () => {
    writeFileSync(join(quayDir, 'panes', '1'), 'pane-types');
    const events = [
      { hook_event_name: 'SessionStart' },
      { hook_event_name: 'UserPromptSubmit' },
      { hook_event_name: 'Stop' },
      { hook_event_name: 'PermissionRequest' },
      { hook_event_name: 'Notification', notification_type: 'idle_prompt' },
      { hook_event_name: 'SessionEnd' },
    ];

    for (const event of events) {
      received.length = 0;
      await runHook(event);
      expect(received).toHaveLength(1);
      expect((received[0] as { event: object }).event).toEqual(event);
    }
  });

  it('caches PID lookup result', async () => {
    writeFileSync(join(quayDir, 'panes', '1'), 'pane-cached');
    await runHook({ hook_event_name: 'SessionStart' });

    const files = readdirSync(quayDir);
    const cacheFiles = files.filter((f) => f.startsWith('cache-'));
    expect(cacheFiles.length).toBeGreaterThan(0);
    expect(readFileSync(join(quayDir, cacheFiles[0]), 'utf-8')).toBe('pane-cached');
  });
});
