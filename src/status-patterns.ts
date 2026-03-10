import type { PaneStatus } from './types';

// Claude is waiting for user input (tool approval, questions, prompt)
export const ATTENTION_PATTERNS = [
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /y\/n\]?\s*$/i,
  /press enter/i,
  /Do you want to proceed/i,
  /waiting for your/i,
  /\? \(y\)es/i,
  /approve|deny|reject/i,
  /\? .*\(Use arrow/i,
  /\d+\.\s+.*\n.*\d+\.\s+/,
  /enter a number/i,
  /choose.*:/i,
  /Allow\s+\w+/i,
  /\(Y\)es.*\(N\)o/,
  /\(A\)lways allow/,
];

// Claude's input prompt — it's done and waiting for your next message
export const CLAUDE_PROMPT_PATTERNS = [/╰─[>$]\s*$/, /Human:\s*$/, /You:\s*$/];

// Shell prompt returned — process exited back to shell
export const DONE_PATTERNS = [/❯\s*$/, /\$\s*$/, /total cost/i, /session ended/i];

// Long-running process (dev server, watcher, etc.)
export const RUNNING_PATTERNS = [
  /listening on/i,
  /server running/i,
  /watching for/i,
  /ready in \d/i,
  /compiled successfully/i,
  /localhost:\d{4}/i,
  /started server/i,
  /hot reload/i,
];

export function detectStatus(buf: string, currentStatus: PaneStatus): PaneStatus | null {
  const isAttention =
    ATTENTION_PATTERNS.some((p) => p.test(buf)) ||
    CLAUDE_PROMPT_PATTERNS.some((p) => p.test(buf));

  if (isAttention) return 'attention';
  if (currentStatus === 'attention') return null; // sticky — no change
  if (RUNNING_PATTERNS.some((p) => p.test(buf))) return 'running';
  if (DONE_PATTERNS.some((p) => p.test(buf))) return 'idle';
  return 'busy';
}
