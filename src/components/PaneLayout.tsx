import { TerminalPane } from "./TerminalPane";
import type { ProjectConfig } from "../types";

interface Props {
  project: ProjectConfig;
  active: boolean;
}

export function PaneLayout({ project, active }: Props) {
  return (
    <div className={`pane-layout ${active ? "active" : ""}`}>
      {project.panes.map((pane, i) => (
        <TerminalPane
          key={`${project.id}-${i}`}
          id={`${project.id}-${i}`}
          cwd={project.path}
          cmd={pane.cmd}
          label={pane.label}
          active={active}
        />
      ))}
    </div>
  );
}
