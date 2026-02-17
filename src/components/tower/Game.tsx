'use client';

import React, { useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
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
  const { setSpeed, setTool } = useTower();
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

  if (!isStateReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="text-white/60">Loading run...</div>
      </div>
    );
  }

  // Mobile layout (simplified MVP: keep the same shell)
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          <TopBar />
          <div className="flex-1 relative overflow-hidden">
            <TowerGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              isMobile={true}
              onViewportChange={setViewport}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
            />
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
          <TopBar />
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

