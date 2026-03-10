import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TerminalPane } from './TerminalPane';
import { useDrag } from '../hooks/useDrag';
import { collectIds } from '../tree-utils';
import type { PaneTree, SplitNode, PaneStatus } from '../types';

interface TreeProps {
  tree: PaneTree;
  projectPath: string;
  active: boolean;
  fontSize?: number;
  theme?: 'dark' | 'light';
  onSplit: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (paneId: string) => void;
  onRatioChange: (path: number[], ratio: number) => void;
  onAgentStatus?: (paneId: string, status: PaneStatus) => void;
  onCwdChange?: (paneId: string, cwd: string) => void;
  onClaudeChange?: (paneId: string, running: boolean) => void;
  claudePanesRef?: React.RefObject<Set<string>>;
  path?: number[];
}

interface LayoutProps {
  projectPath: string;
  active: boolean;
  onSplit: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (paneId: string) => void;
  onRatioChange: (path: number[], ratio: number) => void;
  slotRefs: Map<string, HTMLDivElement>;
  path: number[];
}

// Renders the split layout with empty placeholder slots for terminals
function SplitView({
  tree,
  projectPath,
  active,
  onSplit,
  onClose,
  onRatioChange,
  slotRefs,
  path,
}: LayoutProps & { tree: SplitNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVertical = tree.direction === 'vertical';
  const dragStartRatioRef = useRef(tree.ratio);

  const handleDrag = useDrag({
    onStart: () => {
      dragStartRatioRef.current = tree.ratio;
    },
    onDrag: (dx, dy) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const size = isVertical ? rect.height : rect.width;
      const delta = isVertical ? dy : dx;
      const next = dragStartRatioRef.current + (delta / size) * 100;
      onRatioChange(path, Math.min(85, Math.max(15, next)));
    },
    cursor: isVertical ? 'row-resize' : 'col-resize',
  });

  return (
    <div className={`split split-${tree.direction}`} ref={containerRef}>
      <div className="split-child" style={{ flex: `0 0 calc(${tree.ratio}% - 3px)` }}>
        <SlotTree
          tree={tree.children[0]}
          projectPath={projectPath}
          active={active}
          onSplit={onSplit}
          onClose={onClose}
          onRatioChange={onRatioChange}
          slotRefs={slotRefs}
          path={[...path, 0]}
        />
      </div>
      <div
        className={`resize-handle ${isVertical ? 'resize-handle-row' : 'resize-handle-col-inline'}`}
        onMouseDown={handleDrag}
      />
      <div className="split-child" style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <SlotTree
          tree={tree.children[1]}
          projectPath={projectPath}
          active={active}
          onSplit={onSplit}
          onClose={onClose}
          onRatioChange={onRatioChange}
          slotRefs={slotRefs}
          path={[...path, 1]}
        />
      </div>
    </div>
  );
}

// Renders either a placeholder slot (for terminals) or a SplitView
function SlotTree({
  tree,
  projectPath,
  active,
  onSplit,
  onClose,
  onRatioChange,
  slotRefs,
  path,
}: LayoutProps & { tree: PaneTree }) {
  const slotRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (tree.type !== 'terminal') return;
      if (el) {
        slotRefs.set(tree.id, el);
      } else {
        slotRefs.delete(tree.id);
      }
    },
    [tree, slotRefs],
  );

  if (tree.type === 'terminal') {
    return (
      <div
        className="terminal-slot"
        ref={slotRef}
        data-pane-id={tree.id}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }

  return (
    <SplitView
      tree={tree}
      projectPath={projectPath}
      active={active}
      onSplit={onSplit}
      onClose={onClose}
      onRatioChange={onRatioChange}
      slotRefs={slotRefs}
      path={path}
    />
  );
}

// Portal-based terminal that renders into a slot
function PortaledTerminal({
  id,
  cwd,
  cmd,
  active,
  slot,
  fontSize,
  theme,
  onSplit,
  onClose,
  onStatusChange,
  onCwdChange,
  onClaudeChange,
}: {
  id: string;
  cwd: string;
  cmd?: string;
  active: boolean;
  slot: HTMLDivElement;
  fontSize?: number;
  theme?: 'dark' | 'light';
  onSplit: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (paneId: string) => void;
  onStatusChange?: (paneId: string, status: PaneStatus) => void;
  onCwdChange?: (paneId: string, cwd: string) => void;
  onClaudeChange?: (paneId: string, running: boolean) => void;
}) {
  return createPortal(
    <TerminalPane
      id={id}
      cwd={cwd}
      cmd={cmd}
      active={active}
      fontSize={fontSize}
      theme={theme}
      onSplitH={() => onSplit(id, 'horizontal')}
      onSplitV={() => onSplit(id, 'vertical')}
      onClose={() => onClose(id)}
      onStatusChange={onStatusChange}
      onCwdChange={onCwdChange}
      onClaudeChange={onClaudeChange}
    />,
    slot,
  );
}

export function PaneTreeView({
  tree,
  projectPath,
  active,
  fontSize,
  theme,
  onSplit,
  onClose,
  onRatioChange,
  onAgentStatus,
  onCwdChange,
  onClaudeChange,
  claudePanesRef,
  path = [],
}: TreeProps) {
  const [slotRefs] = useState(() => new Map<string, HTMLDivElement>());
  const [, forceUpdate] = useState(0);

  // Force a re-render after the layout mounts so portals can find their slots
  useEffect(() => {
    forceUpdate((n) => n + 1);
  }, [tree]);

  const paneIds = useMemo(() => collectIds(tree), [tree]);

  return (
    <>
      <SlotTree
        tree={tree}
        projectPath={projectPath}
        active={active}
        onSplit={onSplit}
        onClose={onClose}
        onRatioChange={onRatioChange}
        slotRefs={slotRefs}
        path={path}
      />
      {/* eslint-disable-next-line react-hooks/refs -- ref read is intentional; cmd is only consumed once at terminal creation */}
      {paneIds.map((id) => {
        const slot = slotRefs.get(id);
        if (!slot) return null;
        return (
          <PortaledTerminal
            key={id}
            id={id}
            cwd={projectPath}
            cmd={claudePanesRef?.current?.has(id) ? 'claude --continue' : undefined}
            active={active}
            slot={slot}
            fontSize={fontSize}
            theme={theme}
            onSplit={onSplit}
            onClose={onClose}
            onStatusChange={onAgentStatus}
            onCwdChange={onCwdChange}
            onClaudeChange={onClaudeChange}
          />
        );
      })}
    </>
  );
}
