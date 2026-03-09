import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("quay", {
  createTerminal: (id: string, cwd?: string, cmd?: string) =>
    ipcRenderer.invoke("terminal:create", id, cwd, cmd),

  onTerminalData: (id: string, callback: (data: string) => void) => {
    const listener = (_: unknown, data: string) => callback(data);
    ipcRenderer.on(`terminal:data:${id}`, listener);
    return () => {
      ipcRenderer.removeListener(`terminal:data:${id}`, listener);
    };
  },

  sendInput: (id: string, data: string) =>
    ipcRenderer.send("terminal:input", id, data),

  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.send("terminal:resize", id, cols, rows),

  kill: (id: string) => ipcRenderer.send("terminal:kill", id),

  onTerminalExit: (id: string, callback: (code: number) => void) => {
    const listener = (_: unknown, code: number) => callback(code);
    ipcRenderer.on(`terminal:exit:${id}`, listener);
    return () => {
      ipcRenderer.removeListener(`terminal:exit:${id}`, listener);
    };
  },

  loadConfig: () => ipcRenderer.invoke("config:load"),
});
