import { useState, useCallback, useRef, useEffect } from 'react';
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
  gameType: GameType;
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

function App() {
  const [activeGame, setActiveGame] = useState<GameType>('iso-city');
  const [paneTree, setPaneTree] = useState<PaneNode>({
    type: 'leaf',
    id: generatePaneId(),
    gameType: 'iso-city',
  });
  const [tooltip, setTooltip] = useState<{ text: string; y: number } | null>(null);

  // Find a pane by ID in the tree
  const findPane = useCallback((node: PaneNode, id: string): PaneNode | null => {
    if (node.id === id) return node;
    if (node.type === 'split') {
      for (const child of node.children) {
        const found = findPane(child, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

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
          // Create the split
          return {
            type: 'split',
            id: generatePaneId(),
            direction,
            children: [
              node,
              {
                type: 'leaf',
                id: generatePaneId(),
                gameType: node.gameType, // Same game type as parent
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

  // Render pane tree
  const renderPaneTree = (node: PaneNode): React.ReactNode => {
    if (node.type === 'leaf') {
      return <GamePane
        key={node.id}
        pane={node}
        onSplit={splitPane}
        onClose={closePane}
        canClose={countPanes(paneTree) > 1}
      />;
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
            {renderPaneTree(child)}
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
          {renderPaneTree(paneTree)}
        </div>
      </div>
    </div>
  );
}

// Individual game pane component
interface GamePaneProps {
  pane: PaneLeaf;
  onSplit: (id: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (id: string) => void;
  canClose: boolean;
}

function GamePane({ pane, onSplit, onClose, canClose }: GamePaneProps) {
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const game = GAMES[pane.gameType];

  useEffect(() => {
    // Reset loading state when game changes
    setIsLoading(true);
  }, [pane.gameType]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

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
      <div className="pane-content">
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
          style={{ opacity: isLoading ? 0 : 1 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-storage-access-by-user-activation"
        />
      </div>
    </div>
  );
}

export default App;
