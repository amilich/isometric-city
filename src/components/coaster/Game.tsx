'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { useMobile } from '@/hooks/useMobile';
import { useCoasterMultiplayerSync } from '@/hooks/useCoasterMultiplayerSync';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CoasterGrid } from './CoasterGrid';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MiniMap } from './MiniMap';
import { Panels } from './panels/Panels';
import { CoasterCommandMenu } from '@/components/coaster/CommandMenu';
import { CoasterMobileTopBar, CoasterMobileToolbar } from './mobile';
import { CoasterShareModal } from '@/components/coaster/multiplayer/CoasterShareModal';
import { MultiplayerRoomBadge } from '@/components/multiplayer/MultiplayerRoomBadge';
import { AudioToggleButton, MusicControls } from '@/lib/audio/AudioProvider';
import { emitGlitchBehaviorEvent } from '@/lib/glitch/behaviorEvents';
import { useGlitchGameServices } from '@/hooks/useGlitchGameServices';

interface GameProps {
  onExit?: () => void;
}

function bucketNumber(value: number, bucketSize: number): number {
  return Math.floor(Math.max(0, value) / bucketSize) * bucketSize;
}

export default function CoasterGame({ onExit }: GameProps) {
  const { state, isStateReady, setTool, setSpeed, setActivePanel } = useCoaster();
  const { isMultiplayer, roomCode, players } = useCoasterMultiplayerSync();
  const multiplayer = useMultiplayerOptional();
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const gameplayStartedAtRef = useRef<number | null>(null);
  const gameplayAnalyticsSnapshotRef = useRef({
    gridSize: state.gridSize,
    guestsInPark: state.stats.guestsInPark,
    cash: state.finances.cash,
    multiplayerConnected: multiplayer?.connectionState === 'connected',
  });
  const lastTrackedToolRef = useRef<string | null>(null);
  const lastTrackedPanelRef = useRef<string | null>(null);
  const lastGuestMilestoneRef = useRef(0);
  const lastCashMilestoneRef = useRef(0);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const hasShownShareModalRef = useRef(false);
  const glitchMetadata = useMemo(() => ({
    game: 'coaster',
    park_id: state.id,
    park_name: state.settings.name,
    guests_in_park: state.stats.guestsInPark,
    guests_total: state.stats.guestsTotal,
    park_rating: state.stats.parkRating,
    cash: state.finances.cash,
    year: state.year,
    month: state.month,
    grid_size: state.gridSize,
  }), [state.finances.cash, state.gridSize, state.id, state.month, state.settings.name, state.stats.guestsInPark, state.stats.guestsTotal, state.stats.parkRating, state.year]);

  useGlitchGameServices({
    slotName: state.settings.name || 'IsoCoaster Autosave',
    state,
    metadata: glitchMetadata,
  });

  useEffect(() => {
    gameplayAnalyticsSnapshotRef.current = {
      gridSize: state.gridSize,
      guestsInPark: state.stats.guestsInPark,
      cash: state.finances.cash,
      multiplayerConnected: multiplayer?.connectionState === 'connected',
    };
  }, [multiplayer?.connectionState, state.finances.cash, state.gridSize, state.stats.guestsInPark]);

  useEffect(() => {
    gameplayStartedAtRef.current = Date.now();
    const initialSnapshot = gameplayAnalyticsSnapshotRef.current;
    emitGlitchBehaviorEvent('gameplay', 'start', {
      game: 'coaster',
      grid_size: initialSnapshot.gridSize,
      multiplayer: initialSnapshot.multiplayerConnected,
    });
    return () => {
      const finalSnapshot = gameplayAnalyticsSnapshotRef.current;
      const startedAt = gameplayStartedAtRef.current ?? Date.now();
      emitGlitchBehaviorEvent('gameplay', 'end', {
        game: 'coaster',
        duration_seconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        guests_bucket: bucketNumber(finalSnapshot.guestsInPark, 250),
        cash_bucket: bucketNumber(finalSnapshot.cash, 10000),
      });
    };
  }, []);

  useEffect(() => {
    if (lastTrackedToolRef.current === state.selectedTool) return;
    lastTrackedToolRef.current = state.selectedTool;
    emitGlitchBehaviorEvent('toolbox', 'select_tool', {
      game: 'coaster',
      tool: state.selectedTool,
      multiplayer: multiplayer?.connectionState === 'connected',
    });
  }, [multiplayer?.connectionState, state.selectedTool]);

  useEffect(() => {
    if (state.activePanel === 'none' || lastTrackedPanelRef.current === state.activePanel) return;
    lastTrackedPanelRef.current = state.activePanel;
    emitGlitchBehaviorEvent('panel', 'open', {
      game: 'coaster',
      panel: state.activePanel,
    });
  }, [state.activePanel]);

  useEffect(() => {
    emitGlitchBehaviorEvent('simulation', state.speed === 0 ? 'pause' : 'set_speed', {
      game: 'coaster',
      speed: state.speed,
    });
  }, [state.speed]);

  useEffect(() => {
    const guestMilestone = bucketNumber(state.stats.guestsInPark, 250);
    if (guestMilestone > lastGuestMilestoneRef.current) {
      lastGuestMilestoneRef.current = guestMilestone;
      emitGlitchBehaviorEvent('progression', 'guest_milestone', {
        game: 'coaster',
        guests_bucket: guestMilestone,
      });
    }
  }, [state.stats.guestsInPark]);

  useEffect(() => {
    const cashMilestone = bucketNumber(state.finances.cash, 50000);
    if (cashMilestone > lastCashMilestoneRef.current) {
      lastCashMilestoneRef.current = cashMilestone;
      emitGlitchBehaviorEvent('economy', 'cash_milestone', {
        game: 'coaster',
        cash_bucket: cashMilestone,
      });
    }
  }, [state.finances.cash]);

  useEffect(() => {
    if (!isMobile) return;
    const isHost = multiplayer?.connectionState === 'connected' && multiplayer?.roomCode && !multiplayer?.initialState;
    if (isHost && !hasShownShareModalRef.current) {
      hasShownShareModalRef.current = true;
      const frame = requestAnimationFrame(() => setShowShareModal(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [isMobile, multiplayer?.connectionState, multiplayer?.roomCode, multiplayer?.initialState]);
  
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
            onShare={multiplayer ? () => setShowShareModal(true) : undefined}
            onExit={onExit}
          />

          {multiplayer && (
            <CoasterShareModal
              open={showShareModal}
              onOpenChange={setShowShareModal}
            />
          )}
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CoasterGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              isMobile={true}
            />

            {isMultiplayer && (
              <div className="absolute top-2 right-2 z-20">
                <MultiplayerRoomBadge roomCode={roomCode} players={players} copyPath="coaster/coop" compact />
              </div>
            )}
            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2">
              <MusicControls className="relative" />
              <AudioToggleButton className="h-9 w-9 inline-flex items-center justify-center rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors" />
            </div>
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

            {isMultiplayer && (
              <div className="absolute top-4 right-4 z-20">
                <MultiplayerRoomBadge roomCode={roomCode} players={players} copyPath="coaster/coop" />
              </div>
            )}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <MusicControls className="relative" />
              <AudioToggleButton className="h-10 w-10 inline-flex items-center justify-center rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors" />
            </div>

            {/* Panels */}
            <Panels />
          </div>
        </div>
        <CoasterCommandMenu />
      </div>
    </TooltipProvider>
  );
}
