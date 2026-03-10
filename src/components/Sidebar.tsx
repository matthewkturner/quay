import { useState, useRef, useEffect, useCallback } from 'react';
import type { ProjectConfig, PaneStatus, GitInfo } from '../types';
import { CloseIcon, PlusIcon, GitBranchIcon } from './Icons';

interface Props {
  projects: ProjectConfig[];
  activeProjectId: string | null;
  statuses: Record<string, PaneStatus>;
  gitInfos: Record<string, GitInfo>;
  width: number;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

function StatusIndicator({
  status,
  confirming,
  onClose,
}: {
  status: PaneStatus;
  confirming?: boolean;
  onClose: (e: React.MouseEvent) => void;
}) {
  return (
    <span className="status-indicator">
      <span className={`status-dot status-${status}`} title={status} />
      <button
        className={`tab-close ${confirming ? 'tab-close-confirm' : ''}`}
        onClick={onClose}
        title={confirming ? 'Click again to confirm' : 'Close project'}
      >
        <CloseIcon size={8} />
      </button>
    </span>
  );
}

function EditableName({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <span className="tab-name" onDoubleClick={() => setEditing(true)}>
        {name}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="tab-name-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (value.trim()) onSave(value.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setEditing(false);
          if (value.trim()) onSave(value.trim());
        }
        if (e.key === 'Escape') {
          setEditing(false);
          setValue(name);
        }
      }}
    />
  );
}

export function Sidebar({
  projects,
  activeProjectId,
  statuses,
  width,
  onSelect,
  gitInfos,
  onRename,
  onReorder,
  onRemove,
  onAdd,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirmRemoveId === id) {
        onRemove(id);
        setConfirmRemoveId(null);
      } else {
        setConfirmRemoveId(id);
        setTimeout(() => setConfirmRemoveId((prev) => (prev === id ? null : prev)), 3000);
      }
    },
    [confirmRemoveId, onRemove],
  );

  return (
    <nav className="sidebar" style={{ width, minWidth: width }}>
      {projects.map((project, index) => {
        const status = statuses[project.id] || 'idle';
        const isActive = project.id === activeProjectId;
        const isDragging = dragIndex === index;
        const isDropTarget = dropIndex === index && dragIndex !== index;
        const git = gitInfos[project.id];

        return (
          <div
            key={project.id}
            className={`sidebar-tab-wrapper ${isDropTarget ? 'drop-target' : ''}`}
            draggable
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropIndex(index);
            }}
            onDragLeave={() => {
              setDropIndex((prev) => (prev === index ? null : prev));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (!isNaN(from) && from !== index) {
                onReorder(from, index);
              }
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
          >
            <button
              className={`sidebar-tab ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
              onClick={() => onSelect(project.id)}
            >
              <div className="tab-top-row">
                <EditableName
                  name={project.name}
                  onSave={(name) => onRename(project.id, name)}
                />
                <StatusIndicator
                  status={status}
                  confirming={confirmRemoveId === project.id}
                  onClose={(e) => handleRemoveClick(e, project.id)}
                />
              </div>
              <span className="tab-path">{project.path}</span>
              {git && (
                <span className="tab-git">
                  <GitBranchIcon />
                  <span className="git-branch-name">{git.branch}</span>
                  {(git.additions > 0 || git.deletions > 0) && (
                    <span className="git-diff">
                      {git.additions > 0 && (
                        <span className="git-add">+{git.additions}</span>
                      )}
                      {git.deletions > 0 && (
                        <span className="git-del">-{git.deletions}</span>
                      )}
                    </span>
                  )}
                </span>
              )}
            </button>
          </div>
        );
      })}
      <button className="sidebar-add" onClick={onAdd}>
        <PlusIcon />
      </button>
      <div className="sidebar-build-info">
        v{__BUILD_VERSION__} {__BUILD_DATE__}
      </div>
    </nav>
  );
}
