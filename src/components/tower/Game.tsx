'use client';

import React, { useEffect, useState } from 'react';
import { T, Var } from 'gt-next';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/hooks/useMobile';
import { useTower } from '@/context/TowerContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TowerGrid } from './TowerGrid';
import { MiniMap } from './MiniMap';
import { Panels } from './panels/Panels';
import { TileInfoPanel } from './TileInfoPanel';
import { TowerMobileToolbar } from './mobile/TowerMobileToolbar';

export default function TowerGame({ onExit }: { onExit?: () => void }) {
  const { state, isStateReady } = useTower();
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;

  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);

  // Keyboard shortcuts: escape to deselect, p to pause
  const { setSpeed, setTool, newGame } = useTower();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'Escape') {
        setSelectedTile(null);
        setTool('select');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setSpeed(state.speed === 0 ? 1 : 0);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSpeed, setTool, state.speed]);

  const isGameOver = state.waveState === 'game_over' || state.lives <= 0;
  const isVictory = state.waveState === 'victory';

  if (!isStateReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <T><div className="text-white/60">Loading run...</div></T>
      </div>
    );
  }

  // Mobile layout (simplified MVP: keep the same shell)
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          <TopBar onExit={onExit} />
          <div className="flex-1 relative overflow-hidden">
            <TowerGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              isMobile={true}
              onViewportChange={setViewport}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
            />
            {isVictory && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                <div className="w-[92%] max-w-sm rounded-lg border border-white/10 bg-slate-950/80 p-4 text-white shadow-xl">
                  <T><div className="text-lg font-semibold">Victory</div></T>
                  <T>
                    <div className="mt-1 text-sm text-white/70">
                      You cleared wave <Var>{state.stats.wave}</Var>. Kills: <Var>{state.stats.kills}</Var>. Leaks: <Var>{state.stats.leaks}</Var>.
                    </div>
                  </T>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSelectedTile(null);
                        setTool('select');
                        newGame();
                      }}
                    >
                      <T>New Run</T>
                    </Button>
                    {onExit && (
                      <Button className="flex-1" variant="secondary" onClick={onExit}>
                        <T>Exit</T>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {isGameOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-[92%] max-w-sm rounded-lg border border-white/10 bg-slate-950/80 p-4 text-white shadow-xl">
                  <T><div className="text-lg font-semibold">Game Over</div></T>
                  <T>
                    <div className="mt-1 text-sm text-white/70">
                      You held until wave <Var>{state.stats.wave}</Var>. Kills: <Var>{state.stats.kills}</Var>. Leaks: <Var>{state.stats.leaks}</Var>.
                    </div>
                  </T>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSelectedTile(null);
                        setTool('select');
                        newGame();
                      }}
                    >
                      <T>New Run</T>
                    </Button>
                    {onExit && (
                      <Button className="flex-1" variant="secondary" onClick={onExit}>
                        <T>Exit</T>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selectedTile && state.selectedTool === 'select' && (
              <TileInfoPanel
                tile={state.grid[selectedTile.y]![selectedTile.x]!}
                onClose={() => setSelectedTile(null)}
                isMobile={true}
              />
            )}
            <Panels />
            <TowerMobileToolbar />
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        <Sidebar onExit={onExit} />

        <div className="flex-1 flex flex-col ml-56">
          <TopBar onExit={undefined} />
          <div className="flex-1 relative overflow-visible">
            <TowerGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              onViewportChange={setViewport}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
            />
            <MiniMap
              viewport={viewport}
              onNavigate={(x, y) => setNavigationTarget({ x, y })}
            />
            {isVictory && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                <div className="w-[460px] max-w-[92%] rounded-lg border border-white/10 bg-slate-950/80 p-5 text-white shadow-2xl">
                  <T><div className="text-xl font-semibold">Victory</div></T>
                  <T>
                    <div className="mt-1 text-sm text-white/70">
                      You cleared wave <Var>{state.stats.wave}</Var>. Kills: <Var>{state.stats.kills}</Var>. Leaks: <Var>{state.stats.leaks}</Var>.
                    </div>
                  </T>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSelectedTile(null);
                        setTool('select');
                        newGame();
                      }}
                    >
                      <T>New Run</T>
                    </Button>
                    {onExit && (
                      <Button className="flex-1" variant="secondary" onClick={onExit}>
                        <T>Exit</T>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {isGameOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                <div className="w-[460px] max-w-[92%] rounded-lg border border-white/10 bg-slate-950/80 p-5 text-white shadow-2xl">
                  <T><div className="text-xl font-semibold">Game Over</div></T>
                  <T>
                    <div className="mt-1 text-sm text-white/70">
                      You held until wave <Var>{state.stats.wave}</Var>. Kills: <Var>{state.stats.kills}</Var>. Leaks: <Var>{state.stats.leaks}</Var>.
                    </div>
                  </T>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setSelectedTile(null);
                        setTool('select');
                        newGame();
                      }}
                    >
                      <T>New Run</T>
                    </Button>
                    {onExit && (
                      <Button className="flex-1" variant="secondary" onClick={onExit}>
                        <T>Exit</T>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selectedTile && state.selectedTool === 'select' && (
              <TileInfoPanel tile={state.grid[selectedTile.y]![selectedTile.x]!} onClose={() => setSelectedTile(null)} />
            )}
            <Panels />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

