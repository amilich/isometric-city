import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Home, RollerCoaster, SplitSquareHorizontal, SplitSquareVertical, X, Loader2 } from 'lucide-react';

// Game types
type GameType = 'iso-city' | 'iso-coaster';

interface GameConfig {
  id: GameType;
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
}

const GAMES: Record<GameType, GameConfig> = {
  'iso-city': {
    id: 'iso-city',
    name: 'IsoCity',
    url: 'https://iso-city.com',
    icon: <Home />,
    color: '#3b82f6',
  },
  'iso-coaster': {
    id: 'iso-coaster',
    name: 'IsoCoaster',
    url: 'https://iso-coaster.com',
    icon: <RollerCoaster />,
    color: '#10b981',
  },
};

// Pane tree structure for split views
interface PaneLeaf {
  type: 'leaf';
  id: string;
  gameType: GameType | null; // null = pending selection
}

interface PaneSplit {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  children: PaneNode[];
  sizes: number[];
}

type PaneNode = PaneLeaf | PaneSplit;

// Generate unique IDs
let paneIdCounter = 0;
const generatePaneId = () => `pane-${++paneIdCounter}`;

// Extract all leaf panes from the tree (only those with a game selected)
const collectActiveLeafPanes = (node: PaneNode): PaneLeaf[] => {
  if (node.type === 'leaf') {
    return node.gameType !== null ? [node] : [];
  }
  return node.children.flatMap(collectActiveLeafPanes);
};

function App() {
  const [activeGame, setActiveGame] = useState<GameType>('iso-city');
  const [paneTree, setPaneTree] = useState<PaneNode>({
    type: 'leaf',
    id: generatePaneId(),
    gameType: 'iso-city',
  });
  const [tooltip, setTooltip] = useState<{ text: string; y: number } | null>(null);
  
  // Track pane container refs for positioning iframes
  const paneRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get all leaf panes with games selected for stable iframe rendering
  const leafPanes = useMemo(() => collectActiveLeafPanes(paneTree), [paneTree]);

  // Count total panes
  const countPanes = useCallback((node: PaneNode): number => {
    if (node.type === 'leaf') return 1;
    return node.children.reduce((sum, child) => sum + countPanes(child), 0);
  }, []);

  // Split a pane
  const splitPane = useCallback((paneId: string, direction: 'horizontal' | 'vertical') => {
    setPaneTree((prevTree) => {
      const splitNode = (node: PaneNode): PaneNode => {
        if (node.id === paneId && node.type === 'leaf') {
          // Create the split - keep original pane, add new one with pending selection
          return {
            type: 'split',
            id: generatePaneId(),
            direction,
            children: [
              node, // Keep original pane with same ID
              {
                type: 'leaf',
                id: generatePaneId(),
                gameType: null, // Pending game selection
              },
            ],
            sizes: [50, 50],
          };
        }
        if (node.type === 'split') {
          return {
            ...node,
            children: node.children.map(splitNode),
          };
        }
        return node;
      };
      return splitNode(prevTree);
    });
  }, []);

  // Set game type for a pane (used by game picker)
  const setPaneGameType = useCallback((paneId: string, gameType: GameType) => {
    setPaneTree((prevTree) => {
      const updateNode = (node: PaneNode): PaneNode => {
        if (node.type === 'leaf' && node.id === paneId) {
          return { ...node, gameType };
        }
        if (node.type === 'split') {
          return {
            ...node,
            children: node.children.map(updateNode),
          };
        }
        return node;
      };
      return updateNode(prevTree);
    });
  }, []);

  // Close a pane
  const closePane = useCallback((paneId: string) => {
    setPaneTree((prevTree) => {
      // If it's the root leaf, don't close
      if (prevTree.type === 'leaf' && prevTree.id === paneId) {
        return prevTree;
      }

      const removeFromSplit = (node: PaneNode): PaneNode | null => {
        if (node.type === 'leaf') {
          return node.id === paneId ? null : node;
        }

        const newChildren = node.children
          .map(removeFromSplit)
          .filter((child): child is PaneNode => child !== null);

        if (newChildren.length === 0) {
          return null;
        }
        if (newChildren.length === 1) {
          return newChildren[0];
        }

        // Recalculate sizes
        const totalSize = node.sizes.reduce((sum, s) => sum + s, 0);
        const newSizes = newChildren.map(() => totalSize / newChildren.length);

        return {
          ...node,
          children: newChildren,
          sizes: newSizes,
        };
      };

      const result = removeFromSplit(prevTree);
      return result || prevTree;
    });
  }, []);

  // Handle sidebar game selection - change all panes to that game
  const handleGameSelect = (gameType: GameType) => {
    setActiveGame(gameType);
    // Create a new root pane with the selected game
    setPaneTree({
      type: 'leaf',
      id: generatePaneId(),
      gameType,
    });
  };

  // Render pane layout structure (just the containers, no iframes)
  const renderPaneLayout = (node: PaneNode): React.ReactNode => {
    if (node.type === 'leaf') {
      return (
        <PanePlaceholder
          key={node.id}
          pane={node}
          onSplit={splitPane}
          onClose={closePane}
          onSelectGame={setPaneGameType}
          canClose={countPanes(paneTree) > 1}
          ref={(el) => {
            if (el) {
              paneRefs.current.set(node.id, el);
            } else {
              paneRefs.current.delete(node.id);
            }
          }}
        />
      );
    }

    return (
      <div
        key={node.id}
        className={`pane-container ${node.direction}`}
        style={{ flex: 1 }}
      >
        {node.children.map((child, index) => (
          <div
            key={child.id}
            style={{
              flex: node.sizes[index],
              display: 'flex',
              minWidth: 0,
              minHeight: 0,
            }}
          >
            {renderPaneLayout(child)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        {Object.values(GAMES).map((game) => (
          <div
            key={game.id}
            className={`sidebar-icon ${activeGame === game.id ? 'active' : ''}`}
            onClick={() => handleGameSelect(game.id)}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ text: game.name, y: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            {game.icon}
          </div>
        ))}
        
        <div className="sidebar-divider" />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="tooltip"
          style={{ top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Main Content with Panes */}
      <div className="main-content">
        <div className="pane-container horizontal">
          {renderPaneLayout(paneTree)}
        </div>
        
        {/* Stable iframe container - iframes rendered here won't remount on layout changes */}
        <StableIframeContainer panes={leafPanes} paneRefs={paneRefs} />
      </div>
    </div>
  );
}

// Pane placeholder - just the header and a container for measuring position
interface PanePlaceholderProps {
  pane: PaneLeaf;
  onSplit: (id: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (id: string) => void;
  onSelectGame: (id: string, gameType: GameType) => void;
  canClose: boolean;
}

const PanePlaceholder = React.forwardRef<HTMLDivElement, PanePlaceholderProps>(
  ({ pane, onSplit, onClose, onSelectGame, canClose }, ref) => {
    const game = pane.gameType ? GAMES[pane.gameType] : null;

    // Show game picker if no game selected
    if (!game) {
      return (
        <div className="pane">
          <div className="pane-header">
            <div className="pane-title" style={{ color: '#888' }}>
              <span>Select a Game</span>
            </div>
            <div className="pane-controls">
              {canClose && (
                <button
                  className="pane-control-btn close"
                  onClick={() => onClose(pane.id)}
                  title="Close"
                >
                  <X />
                </button>
              )}
            </div>
          </div>
          <div className="pane-content game-picker-container">
            <GamePicker onSelect={(gameType) => onSelectGame(pane.id, gameType)} />
          </div>
        </div>
      );
    }

    return (
      <div className="pane">
        <div className="pane-header">
          <div className="pane-title" style={{ color: game.color }}>
            {game.icon}
            <span>{game.name}</span>
          </div>
          <div className="pane-controls">
            <button
              className="pane-control-btn"
              onClick={() => onSplit(pane.id, 'horizontal')}
              title="Split Right"
            >
              <SplitSquareHorizontal />
            </button>
            <button
              className="pane-control-btn"
              onClick={() => onSplit(pane.id, 'vertical')}
              title="Split Down"
            >
              <SplitSquareVertical />
            </button>
            {canClose && (
              <button
                className="pane-control-btn close"
                onClick={() => onClose(pane.id)}
                title="Close"
              >
                <X />
              </button>
            )}
          </div>
        </div>
        <div className="pane-content" ref={ref} data-pane-id={pane.id}>
          {/* Iframe will be positioned over this via the stable container */}
        </div>
      </div>
    );
  }
);

// Game picker component shown in new panes
interface GamePickerProps {
  onSelect: (gameType: GameType) => void;
}

function GamePicker({ onSelect }: GamePickerProps) {
  return (
    <div className="game-picker">
      <h2 className="game-picker-title">Choose a Game</h2>
      <div className="game-picker-options">
        {Object.values(GAMES).map((game) => (
          <button
            key={game.id}
            className="game-picker-option"
            onClick={() => onSelect(game.id)}
            style={{ '--game-color': game.color } as React.CSSProperties}
          >
            <div className="game-picker-icon">
              {game.icon}
            </div>
            <div className="game-picker-name">{game.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Stable iframe container - renders iframes in a flat list to prevent remounting
interface StableIframeContainerProps {
  panes: PaneLeaf[];
  paneRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function StableIframeContainer({ panes, paneRefs }: StableIframeContainerProps) {
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());
  
  // Update positions on resize and when panes change
  useEffect(() => {
    const updatePositions = () => {
      const newPositions = new Map<string, DOMRect>();
      paneRefs.current.forEach((el, id) => {
        newPositions.set(id, el.getBoundingClientRect());
      });
      setPositions(newPositions);
    };

    // Initial position calculation
    updatePositions();

    // Listen for resize
    window.addEventListener('resize', updatePositions);
    
    // Use ResizeObserver for more accurate tracking
    const observer = new ResizeObserver(updatePositions);
    paneRefs.current.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener('resize', updatePositions);
      observer.disconnect();
    };
  }, [panes, paneRefs]);

  return (
    <div className="stable-iframe-container">
      {panes.map((pane) => (
        <StableIframe
          key={pane.id}
          pane={pane}
          position={positions.get(pane.id)}
        />
      ))}
    </div>
  );
}

// Individual stable iframe
interface StableIframeProps {
  pane: PaneLeaf;
  position: DOMRect | undefined;
}

function StableIframe({ pane, position }: StableIframeProps) {
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const game = GAMES[pane.gameType];

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  if (!position) return null;

  return (
    <div
      className="stable-iframe-wrapper"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
        pointerEvents: 'auto',
      }}
    >
      {isLoading && (
        <div className="pane-loading">
          {game.icon}
          <div className="pane-loading-text">Loading {game.name}...</div>
          <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={game.url}
        onLoad={handleIframeLoad}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          opacity: isLoading ? 0 : 1,
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-storage-access-by-user-activation"
      />
    </div>
  );
}

export default App;
