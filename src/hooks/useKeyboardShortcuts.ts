import { useEffect, useRef } from 'react';
import type { ProjectConfig } from '../types';

interface Options {
  projects: ProjectConfig[];
  onAdd: () => void;
  onSelectProject: (id: string) => void;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
}

export function useKeyboardShortcuts({
  projects,
  onAdd,
  onSelectProject,
  onToggleSettings,
  onCloseSettings,
}: Options) {
  const projectsRef = useRef(projects);
  const onAddRef = useRef(onAdd);
  useEffect(() => {
    projectsRef.current = projects;
    onAddRef.current = onAdd;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Block Ctrl+R / Cmd+R refresh
      if (mod && e.key === 'r') {
        e.preventDefault();
        return;
      }

      // Cmd/Ctrl+, to toggle settings
      if (mod && e.key === ',') {
        e.preventDefault();
        onToggleSettings();
        return;
      }

      // Escape to close settings
      if (e.key === 'Escape') {
        onCloseSettings();
        return;
      }

      // Cmd/Ctrl+T to add new project
      if (mod && e.key === 't') {
        e.preventDefault();
        onAddRef.current();
        return;
      }

      // Cmd/Ctrl+1-9 to switch tabs
      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const p = projectsRef.current[index];
        if (p) onSelectProject(p.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectProject, onToggleSettings, onCloseSettings]);
}
