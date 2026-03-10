import { contextBridge, ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add(`platform-${process.platform}`);
});

contextBridge.exposeInMainWorld('quay', {
  createTerminal: (
    id: string,
    cwd?: string,
    cmd?: string,
    cols?: number,
    rows?: number,
  ) => ipcRenderer.invoke('terminal:create', id, cwd, cmd, cols, rows),

  onTerminalData: (id: string, callback: (data: string) => void) => {
    const listener = (_: unknown, data: string) => callback(data);
    ipcRenderer.on(`terminal:data:${id}`, listener);
    return () => {
      ipcRenderer.removeListener(`terminal:data:${id}`, listener);
    };
  },

  onHookEvent: (callback: (payload: unknown) => void) => {
    const listener = (_: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on('hook:event', listener);
    return () => {
      ipcRenderer.removeListener('hook:event', listener);
    };
  },

  updateTheme: (theme: string) => ipcRenderer.send('theme:update', theme),

  sendInput: (id: string, data: string) => ipcRenderer.send('terminal:input', id, data),

  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', id, cols, rows),

  kill: (id: string) => ipcRenderer.send('terminal:kill', id),

  loadWorkspace: () => ipcRenderer.invoke('workspace:load'),
  saveWorkspace: (state: unknown) =>
    ipcRenderer.send('workspace:save', JSON.stringify(state)),

  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  startResize: (direction: string, x: number, y: number) =>
    ipcRenderer.send('window:resize-start', direction, x, y),
  resizeMove: (x: number, y: number) => ipcRenderer.send('window:resize-move', x, y),
  resizeEnd: () => ipcRenderer.send('window:resize-end'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
