'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { useMobile } from '@/hooks/useMobile';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CoasterCanvas } from './CoasterCanvas';
import { CoasterSidebar } from './CoasterSidebar';
import { CoasterTopBar } from './CoasterTopBar';
import { CoasterMiniMap } from './CoasterMiniMap';
import { RidesPanel } from './panels/RidesPanel';
import { FinancesPanel } from './panels/FinancesPanel';
import { GuestsPanel } from './panels/GuestsPanel';
import { ParkPanel } from './panels/ParkPanel';
import { SettingsPanel } from './panels/SettingsPanel';

interface CoasterGameProps {
  onExit?: () => void;
}

export function CoasterGame({ onExit }: CoasterGameProps) {
  const { state, setActivePanel, setSpeed } = useCoaster();
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  } | null>(null);
  
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (state.activePanel !== 'none') {
          setActivePanel('none');
        } else if (selectedTile) {
          setSelectedTile(null);
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setSpeed(state.speed === 0 ? 1 : 0);
      } else if (e.key === '1') {
        setSpeed(1);
      } else if (e.key === '2') {
        setSpeed(2);
      } else if (e.key === '3') {
        setSpeed(3);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activePanel, state.speed, selectedTile, setActivePanel, setSpeed]);

  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-gradient-to-br from-green-900 to-green-950 flex flex-col">
          {/* Mobile Top Bar */}
          <CoasterTopBar isMobile={true} onExit={onExit} />
          
          {/* Main canvas area */}
          <div className="flex-1 relative overflow-hidden">
            <CoasterCanvas 
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              isMobile={true}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
            />
          </div>
          
          {/* Mobile toolbar would go here */}
          
          {/* Panels */}
          {state.activePanel === 'rides' && <RidesPanel />}
          {state.activePanel === 'guests' && <GuestsPanel />}
          {state.activePanel === 'finances' && <FinancesPanel />}
          {state.activePanel === 'park' && <ParkPanel />}
          {state.activePanel === 'settings' && <SettingsPanel onExit={onExit} />}
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-gradient-to-br from-green-900 to-green-950 flex">
        <CoasterSidebar onExit={onExit} />
        
        <div className="flex-1 flex flex-col ml-56">
          <CoasterTopBar onExit={onExit} />
          
          <div className="flex-1 relative overflow-visible">
            <CoasterCanvas 
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
            />
            
            <CoasterMiniMap 
              onNavigate={(x, y) => setNavigationTarget({ x, y })} 
              viewport={viewport}
            />
          </div>
        </div>
        
        {/* Panels */}
        {state.activePanel === 'rides' && <RidesPanel />}
        {state.activePanel === 'guests' && <GuestsPanel />}
        {state.activePanel === 'finances' && <FinancesPanel />}
        {state.activePanel === 'park' && <ParkPanel />}
        {state.activePanel === 'settings' && <SettingsPanel onExit={onExit} />}
      </div>
    </TooltipProvider>
  );
}
