import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { PaneLayout } from "./components/PaneLayout";
import type { ProjectConfig } from "./types";

export default function App() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    window.quay.loadConfig().then((config) => {
      setProjects(config.projects);
      if (config.projects.length > 0) {
        setActiveProjectId(config.projects[0].id);
      }
    });
  }, []);

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={setActiveProjectId}
      />
      <main className="main">
        {projects.map((project) => (
          <PaneLayout
            key={project.id}
            project={project}
            active={project.id === activeProjectId}
          />
        ))}
        {projects.length === 0 && (
          <div className="empty">
            <p>No projects configured.</p>
            <p className="hint">Edit quay.config.json to add projects.</p>
          </div>
        )}
      </main>
    </div>
  );
}
