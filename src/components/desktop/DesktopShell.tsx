'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { AmusementParkIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

type SidebarIconProps = { size?: number; className?: string };

type GameDefinition = {
  id: 'iso-city' | 'iso-coaster';
  label: string;
  homeUrl: string;
  Icon: React.ComponentType<SidebarIconProps>;
};

type PaneSession = {
  sessionId: string;
};

type PaneLeaf = {
  id: string;
  type: 'leaf';
  activeGameId: GameDefinition['id'];
  sessions: Partial<Record<GameDefinition['id'], PaneSession>>;
};

type PaneSplit = {
  id: string;
  type: 'split';
  direction: 'vertical' | 'horizontal';
  ratio: number;
  children: [PaneNode, PaneNode];
};

type PaneNode = PaneLeaf | PaneSplit;

type LayoutState = {
  version: number;
  activePaneId: string;
  tree: PaneNode;
};

const LAYOUT_STORAGE_KEY = 'iso-desktop-layout';
const LAYOUT_VERSION = 1;

const GAMES: GameDefinition[] = [
  {
    id: 'iso-city',
    label: 'IsoCity',
    homeUrl: 'https://iso-city.com',
    Icon: Home,
  },
  {
    id: 'iso-coaster',
    label: 'IsoCoaster',
    homeUrl: 'https://iso-coaster.com',
    Icon: AmusementParkIcon,
  },
];

const gameById = Object.fromEntries(GAMES.map((game) => [game.id, game])) as Record<
  GameDefinition['id'],
  GameDefinition
>;

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSession(): PaneSession {
  return { sessionId: createId('session') };
}

function createLeaf(gameId: GameDefinition['id']): PaneLeaf {
  return {
    id: createId('pane'),
    type: 'leaf',
    activeGameId: gameId,
    sessions: {
      [gameId]: createSession(),
    },
  };
}

function findFirstLeafId(node: PaneNode): string {
  if (node.type === 'leaf') return node.id;
  return findFirstLeafId(node.children[0]);
}

function findLeaf(node: PaneNode, id: string): PaneLeaf | null {
  if (node.type === 'leaf') {
    return node.id === id ? node : null;
  }
  return findLeaf(node.children[0], id) || findLeaf(node.children[1], id);
}

function normalizeLeaf(leaf: PaneLeaf): PaneLeaf {
  const activeGameId = gameById[leaf.activeGameId]
    ? leaf.activeGameId
    : GAMES[0].id;
  const sessions = { ...leaf.sessions };
  if (!sessions[activeGameId]) {
    sessions[activeGameId] = createSession();
  }
  return {
    ...leaf,
    activeGameId,
    sessions,
  };
}

function normalizeNode(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    return normalizeLeaf(node);
  }
  return {
    ...node,
    ratio: Number.isFinite(node.ratio) ? Math.min(Math.max(node.ratio, 0.2), 0.8) : 0.5,
    children: [normalizeNode(node.children[0]), normalizeNode(node.children[1])],
  };
}

function createDefaultLayout(): LayoutState {
  const root = createLeaf(GAMES[0].id);
  return {
    version: LAYOUT_VERSION,
    activePaneId: root.id,
    tree: root,
  };
}

function loadLayoutState(): LayoutState {
  if (typeof window === 'undefined') {
    return createDefaultLayout();
  }
  try {
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!stored) return createDefaultLayout();
    const parsed = JSON.parse(stored) as LayoutState;
    if (!parsed?.tree) return createDefaultLayout();
    const normalizedTree = normalizeNode(parsed.tree);
    const activePaneId = findLeaf(normalizedTree, parsed.activePaneId)
      ? parsed.activePaneId
      : findFirstLeafId(normalizedTree);
    return {
      version: LAYOUT_VERSION,
      activePaneId,
      tree: normalizedTree,
    };
  } catch {
    return createDefaultLayout();
  }
}

function saveLayoutState(state: LayoutState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (privacy mode or quota).
  }
}

function updateLeaf(node: PaneNode, targetId: string, updater: (leaf: PaneLeaf) => PaneLeaf): PaneNode {
  if (node.type === 'leaf') {
    if (node.id !== targetId) return node;
    return updater(node);
  }
  const [left, right] = node.children;
  const nextLeft = updateLeaf(left, targetId, updater);
  const nextRight = updateLeaf(right, targetId, updater);
  if (nextLeft === left && nextRight === right) return node;
  return {
    ...node,
    children: [nextLeft, nextRight],
  };
}

function splitLeaf(
  node: PaneNode,
  targetId: string,
  direction: PaneSplit['direction'],
): { tree: PaneNode; newLeafId?: string } {
  if (node.type === 'leaf') {
    if (node.id !== targetId) return { tree: node };
    const sibling = createLeaf(node.activeGameId);
    return {
      tree: {
        id: createId('split'),
        type: 'split',
        direction,
        ratio: 0.5,
        children: [node, sibling],
      },
      newLeafId: sibling.id,
    };
  }
  const [left, right] = node.children;
  const leftResult = splitLeaf(left, targetId, direction);
  if (leftResult.newLeafId) {
    return {
      tree: {
        ...node,
        children: [leftResult.tree, right],
      },
      newLeafId: leftResult.newLeafId,
    };
  }
  const rightResult = splitLeaf(right, targetId, direction);
  if (rightResult.newLeafId) {
    return {
      tree: {
        ...node,
        children: [left, rightResult.tree],
      },
      newLeafId: rightResult.newLeafId,
    };
  }
  return { tree: node };
}

function ensureSession(leaf: PaneLeaf, gameId: GameDefinition['id']) {
  const sessions = { ...leaf.sessions };
  if (!sessions[gameId]) {
    sessions[gameId] = createSession();
  }
  return {
    ...leaf,
    activeGameId: gameId,
    sessions,
  };
}

function SplitVerticalIcon({ size = 14, className }: SidebarIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SplitHorizontalIcon({ size = 14, className }: SidebarIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PaneView({
  pane,
  isActive,
  onFocus,
  onSplit,
}: {
  pane: PaneLeaf;
  isActive: boolean;
  onFocus: () => void;
  onSplit: (direction: PaneSplit['direction']) => void;
}) {
  const activeGame = gameById[pane.activeGameId];
  const sessions = Object.entries(pane.sessions).filter(([, session]) => Boolean(session)) as Array<
    [GameDefinition['id'], PaneSession]
  >;

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col bg-slate-950/95 border',
        isActive ? 'border-sky-400/70 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' : 'border-white/10',
      )}
      onMouseDown={onFocus}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/60 bg-slate-950/80 border-b border-white/10">
        <span className="truncate">{activeGame.label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="h-6 w-6 rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              onSplit('vertical');
            }}
            title="Split vertically"
            aria-label="Split pane vertically"
          >
            <SplitVerticalIcon className="mx-auto" />
          </button>
          <button
            type="button"
            className="h-6 w-6 rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              onSplit('horizontal');
            }}
            title="Split horizontally"
            aria-label="Split pane horizontally"
          >
            <SplitHorizontalIcon className="mx-auto" />
          </button>
        </div>
      </div>
      <div className="relative flex-1 bg-slate-950">
        {sessions.map(([gameId, session]) => {
          const game = gameById[gameId];
          const isVisible = gameId === pane.activeGameId;
          return (
            <iframe
              key={session.sessionId}
              src={game.homeUrl}
              title={`${game.label} pane`}
              className={cn(
                'absolute inset-0 h-full w-full bg-black transition-opacity duration-200',
                isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
              )}
              allow="fullscreen"
            />
          );
        })}
      </div>
    </div>
  );
}

function PaneTree({
  node,
  activePaneId,
  onSelectPane,
  onSplitPane,
}: {
  node: PaneNode;
  activePaneId: string;
  onSelectPane: (id: string) => void;
  onSplitPane: (id: string, direction: PaneSplit['direction']) => void;
}) {
  if (node.type === 'leaf') {
    return (
      <PaneView
        pane={node}
        isActive={node.id === activePaneId}
        onFocus={() => onSelectPane(node.id)}
        onSplit={(direction) => onSplitPane(node.id, direction)}
      />
    );
  }
  const gridStyle =
    node.direction === 'vertical'
      ? { gridTemplateColumns: `${node.ratio * 100}% ${(1 - node.ratio) * 100}%` }
      : { gridTemplateRows: `${node.ratio * 100}% ${(1 - node.ratio) * 100}%` };

  return (
    <div className="grid h-full w-full gap-px bg-white/10" style={gridStyle}>
      <div className="min-h-0 min-w-0">
        <PaneTree
          node={node.children[0]}
          activePaneId={activePaneId}
          onSelectPane={onSelectPane}
          onSplitPane={onSplitPane}
        />
      </div>
      <div className="min-h-0 min-w-0">
        <PaneTree
          node={node.children[1]}
          activePaneId={activePaneId}
          onSelectPane={onSelectPane}
          onSplitPane={onSplitPane}
        />
      </div>
    </div>
  );
}

export default function DesktopShell() {
  const [layoutState, setLayoutState] = useState<LayoutState | null>(null);

  useEffect(() => {
    setLayoutState(loadLayoutState());
  }, []);

  useEffect(() => {
    if (!layoutState) return;
    saveLayoutState(layoutState);
  }, [layoutState]);

  const activePane = useMemo(
    () => (layoutState ? findLeaf(layoutState.tree, layoutState.activePaneId) : null),
    [layoutState],
  );

  const handleSelectPane = useCallback((id: string) => {
    setLayoutState((prev) => (prev ? { ...prev, activePaneId: id } : prev));
  }, []);

  const handleSplitPane = useCallback((id: string, direction: PaneSplit['direction']) => {
    setLayoutState((prev) => {
      if (!prev) return prev;
      const result = splitLeaf(prev.tree, id, direction);
      if (!result.newLeafId) return prev;
      return {
        ...prev,
        tree: result.tree,
        activePaneId: result.newLeafId,
      };
    });
  }, []);

  const handleGameSelect = useCallback((gameId: GameDefinition['id']) => {
    setLayoutState((prev) => {
      if (!prev) return prev;
      const updatedTree = updateLeaf(prev.tree, prev.activePaneId, (leaf) =>
        ensureSession(leaf, gameId),
      );
      return {
        ...prev,
        tree: updatedTree,
      };
    });
  }, []);

  if (!layoutState) {
    return (
      <main className="h-screen w-screen bg-slate-950 text-white/60 flex items-center justify-center">
        Loading desktop shell...
      </main>
    );
  }

  return (
    <main className="h-screen w-screen bg-slate-950 text-white flex">
      <aside className="w-16 border-r border-white/10 bg-slate-950/90 flex flex-col items-center py-4 gap-3">
        <div className="h-10 w-10 rounded-2xl bg-white/10 text-white/80 flex items-center justify-center text-xs font-semibold tracking-[0.2em]">
          ISO
        </div>
        <div className="flex flex-col gap-2">
          {GAMES.map((game) => {
            const isActive = activePane?.activeGameId === game.id;
            return (
              <button
                key={game.id}
                type="button"
                className={cn(
                  'h-10 w-10 rounded-2xl border transition-all duration-150 flex items-center justify-center',
                  isActive
                    ? 'border-white/30 bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]'
                    : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/20',
                )}
                title={game.label}
                aria-label={`Switch active pane to ${game.label}`}
                onClick={() => handleGameSelect(game.id)}
              >
                <game.Icon className="h-5 w-5" size={20} />
              </button>
            );
          })}
        </div>
      </aside>
      <section className="flex-1 min-w-0 min-h-0 p-3">
        <div className="h-full w-full rounded-xl overflow-hidden bg-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <PaneTree
            node={layoutState.tree}
            activePaneId={layoutState.activePaneId}
            onSelectPane={handleSelectPane}
            onSplitPane={handleSplitPane}
          />
        </div>
      </section>
    </main>
  );
}
