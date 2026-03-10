import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { PaneStatus, ClaudeHookPayload } from '../types';
import { detectStatus } from '../status-patterns';
import { CloseIcon, SplitHorizontalIcon, SplitVerticalIcon } from './Icons';

interface Props {
  id: string;
  cwd?: string;
  cmd?: string;
  active: boolean;
  fontSize?: number;
  theme?: 'dark' | 'light';
  onStatusChange?: (paneId: string, status: PaneStatus) => void;
  onCwdChange?: (paneId: string, cwd: string) => void;
  onClaudeChange?: (paneId: string, running: boolean) => void;
  onSplitH: () => void;
  onSplitV: () => void;
  onClose: () => void;
}

// eslint-disable-next-line no-control-regex
const OSC7_REGEX = /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*)\x07/;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, '');
}

const DARK_THEME = {
  background: '#0f0f1a',
  foreground: '#f8fafc',
  cursor: '#a78bfa',
  selectionBackground: '#334155',
  black: '#0f0f1a',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#a78bfa',
  cyan: '#22d3ee',
  white: '#f8fafc',
  brightBlack: '#475569',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#c4b5fd',
  brightCyan: '#67e8f9',
  brightWhite: '#ffffff',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1e293b',
  cursor: '#7c3aed',
  selectionBackground: '#c7d2fe',
  black: '#1e293b',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#7c3aed',
  cyan: '#0891b2',
  white: '#f8fafc',
  brightBlack: '#64748b',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#8b5cf6',
  brightCyan: '#06b6d4',
  brightWhite: '#ffffff',
};

// Persist terminal instances across React remounts (portal target changes on split/close)
const terminalCache = new Map<
  string,
  { term: Terminal; fitAddon: FitAddon; cleanup: () => void }
>();

// eslint-disable-next-line react-refresh/only-export-components
export function destroyTerminal(paneId: string) {
  const cached = terminalCache.get(paneId);
  if (cached) {
    cached.cleanup();
    cached.term.dispose();
    terminalCache.delete(paneId);
  }
  window.quay.kill(paneId);
}

export function TerminalPane({
  id,
  cwd,
  cmd,
  active,
  fontSize = 12,
  theme = 'dark',
  onStatusChange,
  onCwdChange,
  onClaudeChange,
  onSplitH,
  onSplitV,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('shell');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStatusRef = useRef<PaneStatus>('idle');
  const outputBufferRef = useRef('');
  const hookActiveRef = useRef(false);
  const claudeRunningRef = useRef(false);

  const emitStatus = useCallback(
    (status: PaneStatus) => {
      if (status !== lastStatusRef.current) {
        lastStatusRef.current = status;
        onStatusChange?.(id, status);
      }
    },
    [id, onStatusChange],
  );

  useEffect(() => {
    let hookWatchdog: ReturnType<typeof setTimeout> | null = null;

    const resetWatchdog = () => {
      if (hookWatchdog) clearTimeout(hookWatchdog);
      hookWatchdog = setTimeout(() => {
        if (hookActiveRef.current && !claudeRunningRef.current) {
          hookActiveRef.current = false;
        }
      }, 60000);
    };

    const removeHookListener = window.quay.onHookEvent((payload: ClaudeHookPayload) => {
      if (payload.pane_id !== id) return;
      hookActiveRef.current = true;
      resetWatchdog();

      const evt = payload.event?.hook_event_name;
      if (!evt) return;

      switch (evt) {
        case 'SessionStart':
        case 'UserPromptSubmit':
          emitStatus('busy');
          break;
        case 'Stop':
        case 'PermissionRequest':
          emitStatus('attention');
          break;
        case 'Notification': {
          const ntype = payload.event.notification_type;
          if (
            ntype === 'idle_prompt' ||
            ntype === 'elicitation_dialog' ||
            ntype === 'permission_prompt'
          ) {
            emitStatus('attention');
          }
          break;
        }
        case 'SessionEnd':
          emitStatus('idle');
          hookActiveRef.current = false;
          if (hookWatchdog) clearTimeout(hookWatchdog);
          break;
      }
    });
    return () => {
      removeHookListener();
      if (hookWatchdog) clearTimeout(hookWatchdog);
    };
  }, [id, emitStatus]);

  useEffect(() => {
    const cached = terminalCache.get(id);
    if (cached) {
      cached.term.options.fontSize = fontSize;
      if (active) cached.fitAddon.fit();
    }
  }, [id, fontSize, active]);

  useEffect(() => {
    const cached = terminalCache.get(id);
    if (cached) {
      cached.term.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    }
  }, [id, theme]);

  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const cached = terminalCache.get(id);
    if (cached) {
      const { term, fitAddon } = cached;
      fitAddonRef.current = fitAddon;
      containerRef.current.appendChild(term.element!);
      requestAnimationFrame(() => fitAddon.fit());

      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => fitAddon.fit());
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }

    const term = new Terminal({
      fontSize,
      fontFamily: 'JetBrains Mono, Cascadia Code, Menlo, monospace',
      theme: theme === 'light' ? LIGHT_THEME : DARK_THEME,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);
    term.loadAddon(new WebLinksAddon());
    fitAddon.fit();

    term.onTitleChange((t) => {
      setTitle(t);
      const isClaudeRunning = /claude/i.test(t);
      if (isClaudeRunning !== claudeRunningRef.current) {
        claudeRunningRef.current = isClaudeRunning;
        onClaudeChange?.(id, isClaudeRunning);
        if (isClaudeRunning) {
          emitStatus('busy');
        } else {
          hookActiveRef.current = false;
          emitStatus('idle');
          outputBufferRef.current = '';
        }
      }
    });

    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    });

    window.quay.createTerminal(id, cwd, cmd, term.cols, term.rows);

    const removeDataListener = window.quay.onTerminalData(id, (data) => {
      const atBottom = term.buffer.active.viewportY >= term.buffer.active.baseY - 1;
      term.write(data, () => {
        if (atBottom) term.scrollToBottom();
      });

      const osc7Match = data.match(OSC7_REGEX);
      if (osc7Match) {
        const rawPath = decodeURIComponent(osc7Match[1]);
        onCwdChange?.(id, rawPath);
      }

      if (!hookActiveRef.current) {
        outputBufferRef.current = (outputBufferRef.current + data).slice(-500);
        const buf = stripAnsi(outputBufferRef.current);
        const status = detectStatus(buf, lastStatusRef.current);

        if (status) {
          emitStatus(status);
          if (status === 'idle') outputBufferRef.current = '';
        }

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (!claudeRunningRef.current) {
          idleTimerRef.current = setTimeout(() => {
            if (lastStatusRef.current === 'busy') {
              emitStatus('idle');
            }
          }, 15000);
        }
      }
    });

    term.onData((data) => {
      window.quay.sendInput(id, data);
      // User typed — clear attention state and buffer
      if (lastStatusRef.current === 'attention') {
        outputBufferRef.current = '';
        emitStatus('busy');
      }
    });

    term.onResize(({ cols, rows }) => {
      window.quay.resize(id, cols, rows);
    });

    const cleanup = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      removeDataListener();
    };

    terminalCache.set(id, { term, fitAddon, cleanup });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
    // Terminal is created once on mount — deps intentionally limited
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (active && fitAddonRef.current) {
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    }
  }, [active]);

  const header = (
    <div className="pane-header">
      <span className="pane-title">{title}</span>
      <div className="pane-actions">
        <button className="pane-btn" title="Split horizontal" onClick={onSplitH}>
          <SplitHorizontalIcon />
        </button>
        <button className="pane-btn" title="Split vertical" onClick={onSplitV}>
          <SplitVerticalIcon />
        </button>
        <button className="pane-btn pane-btn-close" title="Close pane" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );

  if (!mounted) {
    return <div className="terminal-pane">{header}</div>;
  }

  return (
    <div className="terminal-pane">
      {header}
      <div className="pane-body" ref={containerRef} />
    </div>
  );
}
