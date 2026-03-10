export type PaneStatus = 'idle' | 'busy' | 'attention' | 'running';

export interface ClaudeHookPayload {
  pane_id: string;
  event: {
    hook_event_name: string;
    notification_type?: string;
    session_id?: string;
    [key: string]: unknown;
  };
}

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
}

export interface TerminalNode {
  type: 'terminal';
  id: string;
}

export interface SplitNode {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  ratio: number;
  children: [PaneTree, PaneTree];
}

export type PaneTree = TerminalNode | SplitNode;

export interface QuaySettings {
  fontSize: number;
  theme: 'dark' | 'light';
}

export const DEFAULT_SETTINGS: QuaySettings = {
  fontSize: 12,
  theme: 'dark',
};

export interface WorkspaceState {
  projects: ProjectConfig[];
  trees: Record<string, PaneTree>;
  activeProjectId: string | null;
  sidebarWidth: number;
  claudePanes?: string[];
  settings?: QuaySettings;
}

export interface GitInfo {
  branch: string;
  additions: number;
  deletions: number;
  dirty: boolean;
}

export interface QuayAPI {
  createTerminal: (
    id: string,
    cwd?: string,
    cmd?: string,
    cols?: number,
    rows?: number,
  ) => Promise<{ id: string }>;
  onTerminalData: (id: string, callback: (data: string) => void) => () => void;
  onHookEvent: (callback: (payload: ClaudeHookPayload) => void) => () => void;
  updateTheme: (theme: string) => void;
  sendInput: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  gitStatus: (cwd: string) => Promise<GitInfo | null>;
  loadWorkspace: () => Promise<WorkspaceState | null>;
  saveWorkspace: (state: WorkspaceState) => void;
  startResize: (direction: string, x: number, y: number) => void;
  resizeMove: (x: number, y: number) => void;
  resizeEnd: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
}

declare global {
  interface Window {
    quay: QuayAPI;
  }
}
