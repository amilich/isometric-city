import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Home, RollerCoaster, SplitSquareHorizontal, SplitSquareVertical, X, Loader2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Start window drag
const startDrag = async () => {
  try {
    await getCurrentWindow().startDragging();
  } catch (e) {
    console.error('Failed to start dragging:', e);
  }
};

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

// Resize handle component
interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const onResizeRef = useRef(onResize);
  const directionRef = useRef(direction);
  
  // Keep callback ref updated (this is fine, refs don't trigger re-renders)
  onResizeRef.current = onResize;
  directionRef.current = direction;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startPosRef.current = directionRef.current === 'horizontal' ? e.clientX : e.clientY;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = directionRef.current === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      if (delta !== 0) {
        onResizeRef.current(delta);
        startPosRef.current = currentPos;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Set cursor styles
    document.body.style.cursor = directionRef.current === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]); // Only depend on isDragging

  return (
    <div
      className={`resize-handle ${direction}${isDragging ? ' dragging' : ''}`}
      onMouseDown={handleMouseDown}
    />
  );
}

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

  // Resize panes within a split
  const resizePanes = useCallback((splitId: string, childIndex: number, delta: number, containerSize: number) => {
    setPaneTree((prevTree) => {
      const updateNode = (node: PaneNode): PaneNode => {
        if (node.type === 'split' && node.id === splitId) {
          const totalSize = node.sizes.reduce((a, b) => a + b, 0);
          const deltaRatio = (delta / containerSize) * totalSize;
          const newSizes = [...node.sizes];
          
          // Adjust the sizes of adjacent panes
          const minSize = 0.1; // minimum 10%
          newSizes[childIndex] = Math.max(minSize, newSizes[childIndex] + deltaRatio);
          newSizes[childIndex + 1] = Math.max(minSize, newSizes[childIndex + 1] - deltaRatio);
          
          return { ...node, sizes: newSizes };
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

    const containerRef = React.createRef<HTMLDivElement>();

    return (
      <div
        key={node.id}
        ref={containerRef}
        className={`pane-container ${node.direction}`}
        style={{ flex: 1 }}
      >
        {node.children.map((child, index) => (
          <React.Fragment key={child.id}>
            <div
              style={{
                flex: node.sizes[index],
                display: 'flex',
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPaneLayout(child)}
            </div>
            {index < node.children.length - 1 && (
              <ResizeHandle
                direction={node.direction}
                onResize={(delta) => {
                  const container = containerRef.current;
                  if (container) {
                    const size = node.direction === 'horizontal' 
                      ? container.offsetWidth 
                      : container.offsetHeight;
                    resizePanes(node.id, index, delta, size);
                  }
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Thin drag strip at top - expands on hover */}
      <div className="top-drag-strip" onMouseDown={startDrag} />
      
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
            <div className="pane-title" style={{ color: '#888' }} onMouseDown={startDrag}>
              <span>Select a Game</span>
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
          <div className="pane-content game-picker-container">
            <GamePicker onSelect={(gameType) => onSelectGame(pane.id, gameType)} />
          </div>
        </div>
      );
    }

    return (
      <div className="pane">
        <div className="pane-header">
          <div className="pane-title" style={{ color: game.color }} onMouseDown={startDrag}>
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
        </button>
      ))}
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
  const observerRef = useRef<ResizeObserver | null>(null);
  const observedElementsRef = useRef<Set<HTMLDivElement>>(new Set());
  
  // Update positions function
  const updatePositions = useCallback(() => {
    const newPositions = new Map<string, DOMRect>();
    paneRefs.current.forEach((el, id) => {
      newPositions.set(id, el.getBoundingClientRect());
    });
    setPositions(newPositions);
  }, [paneRefs]);
  
  // Update positions on resize and when panes change
  useEffect(() => {
    // Create ResizeObserver once
    if (!observerRef.current) {
      observerRef.current = new ResizeObserver(() => {
        updatePositions();
      });
    }
    const observer = observerRef.current;

    // Function to sync observed elements with current refs
    const syncObservedElements = () => {
      const currentElements = new Set(paneRefs.current.values());
      
      // Observe new elements
      currentElements.forEach((el) => {
        if (!observedElementsRef.current.has(el)) {
          observer.observe(el);
          observedElementsRef.current.add(el);
        }
      });
      
      // Unobserve removed elements
      observedElementsRef.current.forEach((el) => {
        if (!currentElements.has(el)) {
          observer.unobserve(el);
          observedElementsRef.current.delete(el);
        }
      });
    };

    // Use requestAnimationFrame to ensure refs are set after React renders
    const rafId = requestAnimationFrame(() => {
      syncObservedElements();
      updatePositions();
    });

    // Listen for window resize
    window.addEventListener('resize', updatePositions);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePositions);
    };
  }, [panes, paneRefs, updatePositions]);
  
  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

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
  
  // Guard: only render if pane has a game selected
  if (!pane.gameType || !position) return null;
  
  const game = GAMES[pane.gameType];

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

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
          <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite' }} />
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
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
      />
    </div>
  );
}

export default App;
