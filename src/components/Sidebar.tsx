import type { ProjectConfig } from "../types";

interface Props {
  projects: ProjectConfig[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ projects, activeProjectId, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">quay</div>
      {projects.map((project) => (
        <button
          key={project.id}
          className={`sidebar-tab ${project.id === activeProjectId ? "active" : ""}`}
          onClick={() => onSelect(project.id)}
        >
          <span className="tab-name">{project.name}</span>
          <span className="tab-path">{project.path.replace(/^.*\//, "")}</span>
        </button>
      ))}
    </nav>
  );
}
