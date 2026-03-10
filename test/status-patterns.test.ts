import { describe, it, expect } from 'vitest';
import {
  ATTENTION_PATTERNS,
  CLAUDE_PROMPT_PATTERNS,
  DONE_PATTERNS,
  RUNNING_PATTERNS,
  detectStatus,
} from '../src/status-patterns';

describe('ATTENTION_PATTERNS', () => {
  const cases = [
    '[Y/n]',
    '[y/N]',
    'Do you want to proceed?',
    'press enter to continue',
    'waiting for your response',
    '? (y)es',
    'approve this change',
    '? Select an option (Use arrow keys)',
    'Enter a number:',
    'Choose an option:',
    'Allow Edit to /tmp/file.ts',
    '(Y)es / (N)o',
    '(A)lways allow for this session',
  ];

  for (const text of cases) {
    it(`matches: "${text}"`, () => {
      expect(ATTENTION_PATTERNS.some((p) => p.test(text))).toBe(true);
    });
  }

  it('does not match normal output', () => {
    expect(ATTENTION_PATTERNS.some((p) => p.test('Compiling main.ts...'))).toBe(false);
    expect(ATTENTION_PATTERNS.some((p) => p.test('Done in 3.2s'))).toBe(false);
  });
});

describe('CLAUDE_PROMPT_PATTERNS', () => {
  const cases = ['╰─> ', '╰─$ ', 'Human: ', 'You: '];

  for (const text of cases) {
    it(`matches: "${text.trim()}"`, () => {
      expect(CLAUDE_PROMPT_PATTERNS.some((p) => p.test(text))).toBe(true);
    });
  }
});

describe('DONE_PATTERNS', () => {
  const cases = ['❯ ', '$ ', 'Total cost: $0.42', 'Session ended'];

  for (const text of cases) {
    it(`matches: "${text.trim()}"`, () => {
      expect(DONE_PATTERNS.some((p) => p.test(text))).toBe(true);
    });
  }
});

describe('RUNNING_PATTERNS', () => {
  const cases = [
    'Listening on port 3000',
    'Server running at http://localhost:8080',
    'Watching for file changes',
    'ready in 245ms',
    'Compiled successfully',
    'http://localhost:5173',
    'Started server on 0.0.0.0:3000',
    'Hot reload enabled',
  ];

  for (const text of cases) {
    it(`matches: "${text}"`, () => {
      expect(RUNNING_PATTERNS.some((p) => p.test(text))).toBe(true);
    });
  }
});

describe('detectStatus', () => {
  it('returns attention for Y/n prompt', () => {
    expect(detectStatus('Continue? [Y/n]', 'busy')).toBe('attention');
  });

  it('returns attention for Claude prompt', () => {
    expect(detectStatus('some output\n╰─> ', 'busy')).toBe('attention');
  });

  it('attention is sticky — returns null when current is attention and no new attention signal', () => {
    expect(detectStatus('some random output', 'attention')).toBeNull();
  });

  it('attention overrides sticky attention (re-confirms attention)', () => {
    expect(detectStatus('Allow Edit to file? [Y/n]', 'attention')).toBe('attention');
  });

  it('returns running for dev server output', () => {
    expect(detectStatus('Listening on http://localhost:3000', 'busy')).toBe('running');
  });

  it('returns idle for shell prompt', () => {
    expect(detectStatus('❯ ', 'busy')).toBe('idle');
  });

  it('returns idle for session ended', () => {
    expect(detectStatus('Session ended. Total cost: $0.15', 'busy')).toBe('idle');
  });

  it('returns busy for unknown output', () => {
    expect(detectStatus('Reading file src/main.ts...', 'idle')).toBe('busy');
  });

  it('running does not override attention', () => {
    expect(detectStatus('listening on localhost:3000', 'attention')).toBeNull();
  });

  it('done does not override attention (sticky)', () => {
    expect(detectStatus('❯ ', 'attention')).toBeNull();
  });
});
