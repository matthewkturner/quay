import { app, BrowserWindow, ipcMain } from "electron";
import * as pty from "node-pty";
import { readFileSync } from "fs";
import { join } from "path";

const terminals = new Map<string, pty.IPty>();
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#1a1b26",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

function getShell(): string {
  if (process.platform === "win32") return "wsl.exe";
  return process.env.SHELL || "/bin/bash";
}

ipcMain.handle(
  "terminal:create",
  (_, id: string, cwd?: string, cmd?: string) => {
    const shell = getShell();
    const term = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.HOME || "/",
      env: process.env as Record<string, string>,
    });

    terminals.set(id, term);

    term.onData((data) => {
      mainWindow?.webContents.send(`terminal:data:${id}`, data);
    });

    term.onExit(() => {
      terminals.delete(id);
      mainWindow?.webContents.send(`terminal:exit:${id}`);
    });

    if (cmd) {
      setTimeout(() => term.write(cmd + "\r"), 300);
    }

    return { id };
  },
);

ipcMain.on("terminal:input", (_, id: string, data: string) => {
  terminals.get(id)?.write(data);
});

ipcMain.on("terminal:resize", (_, id: string, cols: number, rows: number) => {
  try {
    terminals.get(id)?.resize(cols, rows);
  } catch {
    // resize can throw if terminal is already closed
  }
});

ipcMain.on("terminal:kill", (_, id: string) => {
  terminals.get(id)?.kill();
  terminals.delete(id);
});

ipcMain.handle("config:load", () => {
  try {
    const configPath = join(app.getPath("userData"), "quay.config.json");
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    try {
      const localConfig = join(process.cwd(), "quay.config.json");
      return JSON.parse(readFileSync(localConfig, "utf-8"));
    } catch {
      return { projects: [] };
    }
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  terminals.forEach((t) => t.kill());
  app.quit();
});
