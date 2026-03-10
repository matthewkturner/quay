import { app, BrowserWindow, ipcMain } from 'electron';
import * as pty from 'node-pty';
import { readFileSync } from 'fs';
import { writeFile, chmod, mkdir } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import type { Server } from 'http';

const isWin = process.platform === 'win32';
if (!isWin) {
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
  const currentPath = process.env.PATH || '';
  process.env.PATH = [...extraPaths, currentPath].join(':');
}
const terminals = new Map<string, pty.IPty>();
let mainWindow: BrowserWindow | null = null;
let hookPort = 0;
let hookServer: Server | null = null;

const QUAY_HOOK_MARKER = '# quay-hook';
const HOOK_EVENTS = [
  'Stop',
  'Notification',
  'PermissionRequest',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
];

function startHookServer(): Promise<number> {
  return new Promise((resolve) => {
    hookServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'POST' && req.url === '/hook') {
        let body = '';
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('hook:event', payload);
            }
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
    hookServer.listen(0, '127.0.0.1', () => {
      const addr = hookServer!.address();
      hookPort = (addr as { port: number }).port;
      resolve(hookPort);
    });
  });
}

async function installHookScript(): Promise<string> {
  const quayDir = join(process.env.HOME || '/', '.quay');
  await mkdir(quayDir, { recursive: true });
  const dest = join(quayDir, 'quay-hook.sh');
  const src = join(__dirname, 'quay-hook.sh');
  const content = readFileSync(src, 'utf-8');
  await writeFile(dest, content, 'utf-8');
  await chmod(dest, 0o755);
  return dest;
}

async function registerHooks(scriptPath: string) {
  const claudeDir = join(process.env.HOME || '/', '.claude');
  const settingsPath = join(claudeDir, 'settings.json');
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    await mkdir(claudeDir, { recursive: true });
  }

  const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
  settings.hooks = hooks;

  const hookCmd = `${scriptPath} ${QUAY_HOOK_MARKER}`;
  const noMatcherEvents = new Set(['Stop', 'UserPromptSubmit']);

  for (const event of HOOK_EVENTS) {
    if (!hooks[event]) hooks[event] = [];
    const arr = hooks[event] as {
      matcher?: string;
      hooks?: { command?: string }[];
    }[];
    const entry: {
      matcher?: string;
      hooks: { type: string; command: string }[];
    } = {
      hooks: [{ type: 'command', command: hookCmd }],
    };
    if (!noMatcherEvents.has(event)) {
      entry.matcher = '*';
    }
    const existing = arr.findIndex((e) =>
      e.hooks?.some(
        (h) => typeof h.command === 'string' && h.command.includes(QUAY_HOOK_MARKER),
      ),
    );
    if (existing >= 0) {
      arr[existing] = entry;
    } else {
      arr.push(entry);
    }
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

function expandHome(p: string): string {
  if (p.startsWith('~')) {
    return (process.env.HOME || '/') + p.slice(1);
  }
  return p;
}

function createWindow() {
  const iconPath = join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: iconPath,
    ...(isWin
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#0f0f1a',
            symbolColor: '#94a3b8',
            height: 40,
          },
          backgroundColor: '#0f0f1a',
        }
      : { frame: false, transparent: true }),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

function getShell(): string {
  if (isWin) return 'wsl.exe';
  return process.env.SHELL || '/bin/bash';
}

ipcMain.handle(
  'terminal:create',
  (_, id: string, cwd?: string, cmd?: string, cols?: number, rows?: number) => {
    const shell = getShell();
    const env = {
      ...process.env,
      QUAY_TERMINAL: '1',
      QUAY_HOOK_PORT: String(hookPort),
      QUAY_PANE_ID: id,
    } as Record<string, string>;
    const resolvedCwd = isWin ? undefined : expandHome(cwd || '~');
    const term = pty.spawn(shell, isWin ? [] : ['-l'], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      ...(resolvedCwd ? { cwd: resolvedCwd } : {}),
      env,
    });

    terminals.set(id, term);

    term.onData((data) => {
      if (!mainWindow?.isDestroyed()) {
        mainWindow?.webContents.send(`terminal:data:${id}`, data);
      }
    });

    term.onExit(() => {
      terminals.delete(id);
    });

    if (isWin) {
      // wsl.exe ignores cwd from spawn, so cd after shell is ready
      const targetDir = cwd || '~';
      setTimeout(() => {
        term.write(`cd ${targetDir} && clear\r`);
        if (cmd) {
          setTimeout(() => term.write(cmd + '\r'), 200);
        }
      }, 500);
    } else if (cmd) {
      setTimeout(() => term.write(cmd + '\r'), 300);
    }

    return { id };
  },
);

ipcMain.on('terminal:input', (_, id: string, data: string) => {
  terminals.get(id)?.write(data);
});

ipcMain.on('terminal:resize', (_, id: string, cols: number, rows: number) => {
  try {
    terminals.get(id)?.resize(cols, rows);
  } catch {
    // resize can throw if terminal is already closed
  }
});

ipcMain.on('terminal:kill', (_, id: string) => {
  terminals.get(id)?.kill();
  terminals.delete(id);
});

let _workspacePath: string;
function getWorkspacePath() {
  _workspacePath ??= join(app.getPath('userData'), 'workspace.json');
  return _workspacePath;
}

ipcMain.handle('workspace:load', () => {
  try {
    return JSON.parse(readFileSync(getWorkspacePath(), 'utf-8'));
  } catch {
    return null;
  }
});

ipcMain.on('workspace:save', (_, state: string) => {
  writeFile(getWorkspacePath(), state, 'utf-8').catch((err) =>
    console.error('Failed to save workspace:', err),
  );
});

ipcMain.on(
  'window:resize-start',
  (_, direction: string, mouseX: number, mouseY: number) => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    const [w, h] = mainWindow.getSize();

    const onMouseMove = (_e: unknown, cx: number, cy: number) => {
      if (!mainWindow) return;
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      let nx = x,
        ny = y,
        nw = w,
        nh = h;

      if (direction.includes('e')) nw = Math.max(400, w + dx);
      if (direction.includes('s')) nh = Math.max(300, h + dy);
      if (direction.includes('w')) {
        nw = Math.max(400, w - dx);
        nx = x + w - nw;
      }
      if (direction.includes('n')) {
        nh = Math.max(300, h - dy);
        ny = y + h - nh;
      }

      mainWindow.setBounds({ x: nx, y: ny, width: nw, height: nh });
    };

    const onMouseUp = () => {
      ipcMain.removeListener('window:resize-move', onMouseMove);
      ipcMain.removeListener('window:resize-end', onMouseUp);
    };

    ipcMain.on('window:resize-move', onMouseMove);
    ipcMain.on('window:resize-end', onMouseUp);
  },
);

function runGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (isWin) {
      // Replace ~ with $HOME so shell expands it (single quotes prevent tilde expansion)
      const expanded = cwd.startsWith('~') ? '$HOME' + cwd.slice(1) : cwd;
      const cdTarget = `"${expanded}"`;
      execFile(
        'wsl.exe',
        ['-e', 'sh', '-c', `cd ${cdTarget} && git ${args.join(' ')}`],
        (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        },
      );
    } else {
      execFile('git', args, { cwd: expandHome(cwd) }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      });
    }
  });
}

ipcMain.handle('git:status', async (_, cwd: string) => {
  try {
    const [branch, diffStat, stagedStat] = await Promise.all([
      runGitCommand(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      runGitCommand(cwd, ['diff', '--shortstat']).catch(() => ''),
      runGitCommand(cwd, ['diff', '--cached', '--shortstat']).catch(() => ''),
    ]);
    const parse = (s: string) => {
      const ins = s.match(/(\d+) insertion/);
      const del = s.match(/(\d+) deletion/);
      return {
        additions: ins ? parseInt(ins[1]) : 0,
        deletions: del ? parseInt(del[1]) : 0,
      };
    };
    const unstaged = parse(diffStat);
    const staged = parse(stagedStat);
    return {
      branch: branch.trim(),
      additions: unstaged.additions + staged.additions,
      deletions: unstaged.deletions + staged.deletions,
      dirty: diffStat.trim().length > 0 || stagedStat.trim().length > 0,
    };
  } catch {
    return null;
  }
});

ipcMain.on('theme:update', (_, theme: string) => {
  if (!mainWindow || !isWin) return;
  const isDark = theme === 'dark';
  mainWindow.setTitleBarOverlay({
    color: isDark ? '#0f0f1a' : '#f8f9fb',
    symbolColor: isDark ? '#94a3b8' : '#64748b',
  });
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

const BANNER = `
    ,o888888o.     8 8888      88        .8.   \`8.\`8888.      ,8'
 . 8888     \`88.   8 8888      88       .888.   \`8.\`8888.    ,8'
,8 8888       \`8b  8 8888      88      :88888.   \`8.\`8888.  ,8'
88 8888        \`8b 8 8888      88     . \`88888.   \`8.\`8888.,8'
88 8888         88 8 8888      88    .8. \`88888.   \`8.\`88888'
88 8888     \`8. 88 8 8888      88   .8\`8. \`88888.   \`8. 8888
88 8888      \`8,8P 8 8888      88  .8' \`8. \`88888.   \`8 8888
\`8 8888       ;8P  \` 8888     ,8P .8'   \`8. \`88888.   8 8888
 \` 8888     ,88'8.   8888   ,d8P .888888888. \`88888.  8 8888
    \`8888888P'  \`8.   \`Y88888P' .8'       \`8. \`88888. 8 8888
`;

app.whenReady().then(async () => {
  console.log(BANNER);
  await startHookServer();
  try {
    const scriptPath = await installHookScript();
    await registerHooks(scriptPath);
  } catch (err) {
    console.error('Failed to register Claude hooks:', err);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  terminals.forEach((t) => t.kill());
  if (hookServer) hookServer.close();
  app.quit();
});
