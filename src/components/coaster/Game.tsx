'use client';

import React, { useState, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { useMobile } from '@/hooks/useMobile';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CoasterGrid } from './CoasterGrid';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MiniMap } from './MiniMap';
import { Panels } from './panels/Panels';
import { CoasterCommandMenu } from '@/components/coaster/CommandMenu';
import { CoasterMobileTopBar, CoasterMobileToolbar } from './mobile';

interface GameProps {
  onExit?: () => void;
}

export default function CoasterGame({ onExit }: GameProps) {
  const { state, isStateReady, setTool, setSpeed, setActivePanel } = useCoaster();
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTool('select');
        setSelectedTile(null);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Toggle pause/unpause: if paused (speed 0), resume to normal (speed 1)
        // If running, pause (speed 0)
        setSpeed(state.speed === 0 ? 1 : 0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, setSpeed, state.speed]);
  
  if (!isStateReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950">
        <div className="text-white/60">Loading park...</div>
      </div>
    );
  }
  
  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          {/* Mobile Top Bar */}
          <CoasterMobileTopBar 
            selectedTile={selectedTile ? state.grid[selectedTile.y][selectedTile.x] : null}
            onCloseTile={() => setSelectedTile(null)}
            onExit={onExit}
          />
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CoasterGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              isMobile={true}
            />
          </div>
          
          {/* Mobile Bottom Toolbar */}
          <CoasterMobileToolbar 
            onOpenPanel={(panel) => setActivePanel(panel)}
          />
          
          {/* Panels - render as fullscreen modals on mobile */}
          <Panels />
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        {/* Sidebar */}
        <Sidebar onExit={onExit} />
        
        {/* Main content */}
        <div className="flex-1 flex flex-col ml-56">
          {/* Top bar */}
          <TopBar />
          
          {/* Canvas area */}
          <div className="flex-1 relative overflow-visible">
            <CoasterGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
            />
            
            {/* Minimap */}
            <MiniMap
              onNavigate={(x, y) => setNavigationTarget({ x, y })}
              viewport={viewport}
            />

            {/* Panels */}
            <Panels />
          </div>
        </div>
        <CoasterCommandMenu />
      </div>
    </TooltipProvider>
  );
}
