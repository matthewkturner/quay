import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { PaneTreeView } from './components/PaneLayout';
import { Settings } from './components/Settings';
import { destroyTerminal } from './components/TerminalPane';
import { MinimizeIcon, MaximizeIcon, CloseIcon } from './components/Icons';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDrag } from './hooks/useDrag';
import {
  createDefaultProject,
  splitPaneInTree,
  closePaneInTree,
  updateRatioInTree,
  collectIds,
} from './tree-utils';
import type {
  ProjectConfig,
  PaneStatus,
  PaneTree,
  WorkspaceState,
  GitInfo,
  QuaySettings,
} from './types';
import { DEFAULT_SETTINGS } from './types';

const STATUS_PRIORITY: Record<PaneStatus, number> = {
  idle: 0,
  busy: 1,
  running: 2,
  attention: 3,
};

export default function App() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PaneStatus>>({});
  const paneStatusesRef = useRef<Record<string, Record<string, PaneStatus>>>({});
  const [trees, setTrees] = useState<Record<string, PaneTree>>({});
  const [gitInfos, setGitInfos] = useState<Record<string, GitInfo>>({});
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [settings, setSettings] = useState<QuaySettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const claudePanesRef = useRef<Set<string>>(new Set());

  const readyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.quay.loadWorkspace().then((ws) => {
      if (ws && ws.projects.length > 0) {
        setProjects(ws.projects);
        setTrees(ws.trees);
        setActiveProjectId(ws.activeProjectId);
        setSidebarWidth(ws.sidebarWidth);
        if (ws.settings) setSettings({ ...DEFAULT_SETTINGS, ...ws.settings });
        if (ws.claudePanes) {
          claudePanesRef.current = new Set(ws.claudePanes);
        }
      } else {
        const { project, tree } = createDefaultProject();
        setProjects([project]);
        setTrees({ [project.id]: tree });
        setActiveProjectId(project.id);
      }
      readyRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const state: WorkspaceState = {
        projects,
        trees,
        activeProjectId,
        sidebarWidth,
        settings,
        claudePanes: [...claudePanesRef.current],
      };
      window.quay.saveWorkspace(state);
    }, 500);
  }, [projects, trees, activeProjectId, sidebarWidth, settings]);

  useEffect(() => {
    window.quay.updateTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (projects.length === 0) return;
    const poll = () => {
      projects.forEach((p) => {
        window.quay.gitStatus(p.path).then((info) => {
          if (info) {
            setGitInfos((prev) => {
              const existing = prev[p.id];
              if (
                existing &&
                existing.branch === info.branch &&
                existing.additions === info.additions &&
                existing.deletions === info.deletions &&
                existing.dirty === info.dirty
              )
                return prev;
              return { ...prev, [p.id]: info };
            });
          }
        });
      });
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [projects]);

  const handleRename = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const handleReorder = useCallback((from: number, to: number) => {
    setProjects((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handlePaneStatus = useCallback(
    (projectId: string, paneId: string, status: PaneStatus) => {
      if (!paneStatusesRef.current[projectId]) {
        paneStatusesRef.current[projectId] = {};
      }
      paneStatusesRef.current[projectId][paneId] = status;

      const paneStatuses = Object.values(paneStatusesRef.current[projectId]);
      const best = paneStatuses.reduce((a, b) =>
        STATUS_PRIORITY[b] > STATUS_PRIORITY[a] ? b : a,
      );
      setStatuses((prev) => {
        if (prev[projectId] === best) return prev;
        return { ...prev, [projectId]: best };
      });
    },
    [],
  );

  const handleSplit = useCallback(
    (projectId: string, paneId: string, direction: 'horizontal' | 'vertical') => {
      setTrees((prev) => {
        const tree = prev[projectId];
        if (!tree) return prev;
        return {
          ...prev,
          [projectId]: splitPaneInTree(tree, paneId, direction),
        };
      });
    },
    [],
  );

  const handleClose = useCallback((projectId: string, paneId: string) => {
    destroyTerminal(paneId);
    setTrees((prev) => {
      const tree = prev[projectId];
      if (!tree) return prev;
      const result = closePaneInTree(tree, paneId);
      if (!result) return prev;
      return { ...prev, [projectId]: result };
    });
  }, []);

  const handleRatioChange = useCallback(
    (projectId: string, path: number[], ratio: number) => {
      setTrees((prev) => {
        const tree = prev[projectId];
        if (!tree) return prev;
        return { ...prev, [projectId]: updateRatioInTree(tree, path, ratio) };
      });
    },
    [],
  );

  const handleAdd = useCallback(() => {
    const { project, tree } = createDefaultProject();
    setProjects((prev) => [...prev, project]);
    setTrees((prev) => ({ ...prev, [project.id]: tree }));
    setActiveProjectId(project.id);
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      setTrees((prev) => {
        const tree = prev[id];
        if (tree) {
          collectIds(tree).forEach(destroyTerminal);
        }
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setActiveProjectId((prev) => {
        if (prev !== id) return prev;
        const remaining = projects.filter((p) => p.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    },
    [projects],
  );

  const handleCwdChange = useCallback(
    (projectId: string, paneId: string, cwd: string) => {
      if (paneId !== `${projectId}-0`) return;
      const display = cwd.startsWith('/home/')
        ? '~' + cwd.replace(/^\/home\/[^/]+/, '')
        : cwd;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId && p.path !== display ? { ...p, path: display } : p,
        ),
      );
    },
    [],
  );

  const handleClaudeChange = useCallback((paneId: string, running: boolean) => {
    if (running) {
      claudePanesRef.current.add(paneId);
    } else {
      claudePanesRef.current.delete(paneId);
    }
  }, []);

  useKeyboardShortcuts({
    projects,
    onAdd: handleAdd,
    onSelectProject: setActiveProjectId,
    onToggleSettings: useCallback(() => setShowSettings((prev) => !prev), []),
    onCloseSettings: useCallback(() => setShowSettings(false), []),
  });

  const dragStartWidthRef = useRef(sidebarWidth);

  const handleSidebarDrag = useDrag({
    onStart: () => {
      dragStartWidthRef.current = sidebarWidth;
    },
    onDrag: (dx) => {
      const next = dragStartWidthRef.current + dx;
      setSidebarWidth(Math.min(400, Math.max(150, next)));
    },
  });

  return (
    <>
      <div className="resize-edges">
        {['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].map((dir) => (
          <div
            key={dir}
            className={`resize-edge resize-${dir}`}
            onMouseDown={(e) => {
              e.preventDefault();
              window.quay.startResize(dir, e.screenX, e.screenY);
              const onMove = (ev: MouseEvent) =>
                window.quay.resizeMove(ev.screenX, ev.screenY);
              const onUp = () => {
                window.quay.resizeEnd();
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />
        ))}
      </div>
      <div className={`app theme-${settings.theme}`}>
        <div className="titlebar">
          <span className="titlebar-label">quay</span>
          <div className="window-controls">
            <button className="win-btn" onClick={() => window.quay.minimize()}>
              <MinimizeIcon />
            </button>
            <button className="win-btn" onClick={() => window.quay.maximize()}>
              <MaximizeIcon />
            </button>
            <button className="win-btn win-btn-close" onClick={() => window.quay.close()}>
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="app-body">
          <Sidebar
            projects={projects}
            activeProjectId={activeProjectId}
            statuses={statuses}
            gitInfos={gitInfos}
            width={sidebarWidth}
            onSelect={setActiveProjectId}
            onRename={handleRename}
            onReorder={handleReorder}
            onRemove={handleRemove}
            onAdd={handleAdd}
          />
          <div className="sidebar-resize-handle" onMouseDown={handleSidebarDrag} />
          <main className="main">
            {projects.map((project) => {
              const tree = trees[project.id];
              if (!tree) return null;
              const isActive = project.id === activeProjectId;
              return (
                <div
                  key={project.id}
                  className={`pane-layout ${isActive ? 'active' : ''}`}
                >
                  <PaneTreeView
                    tree={tree}
                    projectPath={project.path}
                    active={isActive}
                    fontSize={settings.fontSize}
                    theme={settings.theme}
                    onSplit={(paneId, dir) => handleSplit(project.id, paneId, dir)}
                    onClose={(paneId) => handleClose(project.id, paneId)}
                    onRatioChange={(path, ratio) =>
                      handleRatioChange(project.id, path, ratio)
                    }
                    onAgentStatus={(paneId, status) =>
                      handlePaneStatus(project.id, paneId, status)
                    }
                    onCwdChange={(paneId, cwd) =>
                      handleCwdChange(project.id, paneId, cwd)
                    }
                    onClaudeChange={handleClaudeChange}
                    claudePanesRef={claudePanesRef}
                  />
                </div>
              );
            })}
            {projects.length === 0 && (
              <div className="empty">
                <p>No projects yet.</p>
                <p className="hint">Click + to add a project.</p>
              </div>
            )}
          </main>
          {showSettings && (
            <Settings
              settings={settings}
              onChange={setSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      </div>
    </>
  );
}
