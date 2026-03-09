export interface PaneConfig {
  label: string;
  cmd?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  panes: PaneConfig[];
}

export interface Config {
  projects: ProjectConfig[];
}

export interface QuayAPI {
  createTerminal: (
    id: string,
    cwd?: string,
    cmd?: string,
  ) => Promise<{ id: string }>;
  onTerminalData: (id: string, callback: (data: string) => void) => () => void;
  sendInput: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  onTerminalExit: (id: string, callback: (code: number) => void) => () => void;
  loadConfig: () => Promise<Config>;
}

declare global {
  interface Window {
    quay: QuayAPI;
  }
}
