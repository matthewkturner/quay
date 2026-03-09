import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  id: string;
  cwd?: string;
  cmd?: string;
  label: string;
  active: boolean;
}

export function TerminalPane({ id, cwd, cmd, label, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const term = new Terminal({
      fontSize: 14,
      fontFamily: "JetBrains Mono, Cascadia Code, Menlo, monospace",
      theme: {
        background: "#1a1b26",
        foreground: "#a9b1d6",
        cursor: "#c0caf5",
        selectionBackground: "#33467c",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);
    fitAddon.fit();

    window.quay.createTerminal(id, cwd, cmd);

    const removeDataListener = window.quay.onTerminalData(id, (data) => {
      term.write(data);
    });

    term.onData((data) => {
      window.quay.sendInput(id, data);
    });

    term.onResize(({ cols, rows }) => {
      window.quay.resize(id, cols, rows);
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      removeDataListener();
      resizeObserver.disconnect();
      term.dispose();
      window.quay.kill(id);
    };
  }, [mounted]);

  useEffect(() => {
    if (active && fitAddonRef.current) {
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    }
  }, [active]);

  if (!mounted) {
    return (
      <div className="terminal-pane">
        <div className="pane-header">{label}</div>
      </div>
    );
  }

  return (
    <div className="terminal-pane">
      <div className="pane-header">{label}</div>
      <div className="pane-body" ref={containerRef} />
    </div>
  );
}
