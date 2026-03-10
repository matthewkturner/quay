import type { PaneTree, ProjectConfig } from './types';

let counter = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${counter++}`;
}

export function buildInitialTree(projectId: string, paneCount: number): PaneTree {
  if (paneCount <= 1) {
    return { type: 'terminal', id: `${projectId}-0` };
  }
  if (paneCount === 2) {
    return {
      type: 'split',
      direction: 'vertical',
      ratio: 50,
      children: [
        { type: 'terminal', id: `${projectId}-0` },
        { type: 'terminal', id: `${projectId}-1` },
      ],
    };
  }
  return {
    type: 'split',
    direction: 'vertical',
    ratio: 50,
    children: [
      { type: 'terminal', id: `${projectId}-0` },
      {
        type: 'split',
        direction: 'horizontal',
        ratio: 50,
        children: [
          { type: 'terminal', id: `${projectId}-1` },
          { type: 'terminal', id: `${projectId}-2` },
        ],
      },
    ],
  };
}

export function createDefaultProject(): {
  project: ProjectConfig;
  tree: PaneTree;
} {
  const id = uid('project');
  const project: ProjectConfig = {
    id,
    name: 'New Project',
    path: '~',
  };
  return { project, tree: buildInitialTree(id, 3) };
}

export function splitPaneInTree(
  tree: PaneTree,
  paneId: string,
  direction: 'horizontal' | 'vertical',
): PaneTree {
  if (tree.type === 'terminal') {
    if (tree.id === paneId) {
      const newId = uid('pane');
      return {
        type: 'split',
        direction,
        ratio: 50,
        children: [tree, { type: 'terminal', id: newId }],
      };
    }
    return tree;
  }
  return {
    ...tree,
    children: [
      splitPaneInTree(tree.children[0], paneId, direction),
      splitPaneInTree(tree.children[1], paneId, direction),
    ],
  };
}

export function closePaneInTree(tree: PaneTree, paneId: string): PaneTree | null {
  if (tree.type === 'terminal') {
    return tree.id === paneId ? null : tree;
  }
  const left = closePaneInTree(tree.children[0], paneId);
  const right = closePaneInTree(tree.children[1], paneId);
  if (left === null) return right;
  if (right === null) return left;
  return { ...tree, children: [left, right] };
}

export function updateRatioInTree(
  tree: PaneTree,
  path: number[],
  ratio: number,
): PaneTree {
  if (tree.type !== 'split') return tree;
  if (path.length === 0) {
    return { ...tree, ratio };
  }
  const [head, ...rest] = path;
  const newChildren: [PaneTree, PaneTree] = [tree.children[0], tree.children[1]];
  newChildren[head] = updateRatioInTree(tree.children[head], rest, ratio);
  return { ...tree, children: newChildren };
}

export function collectIds(tree: PaneTree): string[] {
  if (tree.type === 'terminal') return [tree.id];
  return [...collectIds(tree.children[0]), ...collectIds(tree.children[1])];
}
