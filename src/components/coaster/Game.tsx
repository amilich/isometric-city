'use client';

import React, { useState, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CoasterGrid } from './CoasterGrid';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MiniMap } from './MiniMap';
import { Panels } from './panels/Panels';
import { useGT } from 'gt-next';

interface GameProps {
  onExit?: () => void;
}

export default function CoasterGame({ onExit }: GameProps) {
  const gt = useGT();
  const { state, isStateReady, setTool } = useCoaster();
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  
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
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);
  
  if (!isStateReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950">
        <div className="text-white/60">{gt('Loading park...')}</div>
      </div>
    );
  }
  
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
      </div>
    </TooltipProvider>
  );
}
