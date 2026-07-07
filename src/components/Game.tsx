'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool } from '@/types/game';
import { useMobile } from '@/hooks/useMobile';
import { MobileToolbar } from '@/components/mobile/MobileToolbar';
import { MobileTopBar } from '@/components/mobile/MobileTopBar';
import { msg, useMessages, useGT } from 'gt-next';

// Import shadcn components
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCheatCodes } from '@/hooks/useCheatCodes';
import { VinnieDialog } from '@/components/VinnieDialog';
import { CommandMenu } from '@/components/ui/CommandMenu';
import { TipToast } from '@/components/ui/TipToast';
import { useTipSystem } from '@/hooks/useTipSystem';
import { useMultiplayerSync } from '@/hooks/useMultiplayerSync';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { ShareModal } from '@/components/multiplayer/ShareModal';
import { MultiplayerRoomBadge } from '@/components/multiplayer/MultiplayerRoomBadge';
import { AudioToggleButton, MusicControls } from '@/lib/audio/AudioProvider';
import { emitGlitchBehaviorEvent } from '@/lib/glitch/behaviorEvents';
import { useGlitchGameServices } from '@/hooks/useGlitchGameServices';

// Import game components
import { OverlayMode } from '@/components/game/types';
import { getOverlayForTool } from '@/components/game/overlays';
import { OverlayModeToggle } from '@/components/game/OverlayModeToggle';
import { Sidebar } from '@/components/game/Sidebar';
import {
  BudgetPanel,
  StatisticsPanel,
  SettingsPanel,
  AdvisorsPanel,
} from '@/components/game/panels';
import { MiniMap } from '@/components/game/MiniMap';
import { TopBar, StatsPanel } from '@/components/game/TopBar';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';

// Cargo type names for notifications
const CARGO_TYPE_NAMES = [msg('containers'), msg('bulk materials'), msg('oil')];

function bucketNumber(value: number, bucketSize: number): number {
  return Math.floor(Math.max(0, value) / bucketSize) * bucketSize;
}

export default function Game({ onExit }: { onExit?: () => void }) {
  const gt = useGT();
  const m = useMessages();
  const { state, setTool, setActivePanel, addMoney, addNotification, setSpeed } = useGame();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const isInitialMount = useRef(true);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const [showShareModal, setShowShareModal] = useState(false);
  const multiplayer = useMultiplayerOptional();
  const gameplayStartedAtRef = useRef<number | null>(null);
  const gameplayAnalyticsSnapshotRef = useRef({
    gridSize: state.gridSize,
    population: state.stats.population,
    money: state.stats.money,
    multiplayerConnected: multiplayer?.connectionState === 'connected',
  });
  const lastTrackedToolRef = useRef<string | null>(null);
  const lastTrackedPanelRef = useRef<string | null>(null);
  const lastPopulationMilestoneRef = useRef(0);
  const lastMoneyMilestoneRef = useRef(0);
  const glitchMetadata = useMemo(() => ({
    game: 'isocity',
    city_id: state.id,
    city_name: state.cityName,
    population: state.stats.population,
    money: state.stats.money,
    year: state.year,
    month: state.month,
    grid_size: state.gridSize,
  }), [state.cityName, state.gridSize, state.id, state.month, state.stats.money, state.stats.population, state.year]);

  useGlitchGameServices({
    slotName: state.cityName || 'IsoCity Autosave',
    state,
    metadata: glitchMetadata,
  });

  useEffect(() => {
    gameplayAnalyticsSnapshotRef.current = {
      gridSize: state.gridSize,
      population: state.stats.population,
      money: state.stats.money,
      multiplayerConnected: multiplayer?.connectionState === 'connected',
    };
  }, [multiplayer?.connectionState, state.gridSize, state.stats.money, state.stats.population]);

  useEffect(() => {
    gameplayStartedAtRef.current = Date.now();
    const initialSnapshot = gameplayAnalyticsSnapshotRef.current;
    emitGlitchBehaviorEvent('gameplay', 'start', {
      game: 'isocity',
      grid_size: initialSnapshot.gridSize,
      multiplayer: initialSnapshot.multiplayerConnected,
    });
    return () => {
      const finalSnapshot = gameplayAnalyticsSnapshotRef.current;
      const startedAt = gameplayStartedAtRef.current ?? Date.now();
      emitGlitchBehaviorEvent('gameplay', 'end', {
        game: 'isocity',
        duration_seconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        population_bucket: bucketNumber(finalSnapshot.population, 500),
        money_bucket: bucketNumber(finalSnapshot.money, 10000),
      });
    };
  }, []);

  useEffect(() => {
    if (lastTrackedToolRef.current === state.selectedTool) return;
    lastTrackedToolRef.current = state.selectedTool;
    emitGlitchBehaviorEvent('toolbox', 'select_tool', {
      game: 'isocity',
      tool: state.selectedTool,
      multiplayer: multiplayer?.connectionState === 'connected',
    });
  }, [multiplayer?.connectionState, state.selectedTool]);

  useEffect(() => {
    if (state.activePanel === 'none' || lastTrackedPanelRef.current === state.activePanel) return;
    lastTrackedPanelRef.current = state.activePanel;
    emitGlitchBehaviorEvent('panel', 'open', {
      game: 'isocity',
      panel: state.activePanel,
    });
  }, [state.activePanel]);

  useEffect(() => {
    emitGlitchBehaviorEvent('simulation', state.speed === 0 ? 'pause' : 'set_speed', {
      game: 'isocity',
      speed: state.speed,
    });
  }, [state.speed]);

  useEffect(() => {
    const populationMilestone = bucketNumber(state.stats.population, 1000);
    if (populationMilestone > lastPopulationMilestoneRef.current) {
      lastPopulationMilestoneRef.current = populationMilestone;
      emitGlitchBehaviorEvent('progression', 'population_milestone', {
        game: 'isocity',
        population_bucket: populationMilestone,
      });
    }
  }, [state.stats.population]);

  useEffect(() => {
    const moneyMilestone = bucketNumber(state.stats.money, 50000);
    if (moneyMilestone > lastMoneyMilestoneRef.current) {
      lastMoneyMilestoneRef.current = moneyMilestone;
      emitGlitchBehaviorEvent('economy', 'money_milestone', {
        game: 'isocity',
        money_bucket: moneyMilestone,
      });
    }
  }, [state.stats.money]);
  
  // Cheat code system
  const {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  } = useCheatCodes();
  
  // Tip system for helping new players
  const {
    currentTip,
    isVisible: isTipVisible,
    onContinue: onTipContinue,
    onSkipAll: onTipSkipAll,
  } = useTipSystem(state);
  
  // Multiplayer sync
  const {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    players,
    broadcastPlace,
    leaveRoom,
  } = useMultiplayerSync();
  
  const initialSelectedToolRef = useRef<Tool | null>(null);
  const previousSelectedToolRef = useRef<Tool | null>(null);
  const hasCapturedInitialTool = useRef(false);
  const currentSelectedToolRef = useRef<Tool>(state.selectedTool);
  
  // Keep currentSelectedToolRef in sync with state
  useEffect(() => {
    currentSelectedToolRef.current = state.selectedTool;
  }, [state.selectedTool]);
  
  // Track the initial selectedTool after localStorage loads (with a small delay to allow state to load)
  useEffect(() => {
    if (!hasCapturedInitialTool.current) {
      // Use a timeout to ensure localStorage state has loaded
      const timeoutId = setTimeout(() => {
        initialSelectedToolRef.current = currentSelectedToolRef.current;
        previousSelectedToolRef.current = currentSelectedToolRef.current;
        hasCapturedInitialTool.current = true;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run once on mount
  
  // Auto-set overlay when selecting utility tools (but not on initial page load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Select tool always resets overlay to none (user is explicitly switching to select)
    if (state.selectedTool === 'select') {
      setTimeout(() => {
        setOverlayMode('none');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Subway tool sets overlay when actively selected (not on page load)
    if (state.selectedTool === 'subway' || state.selectedTool === 'subway_station') {
      setTimeout(() => {
        setOverlayMode('subway');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Don't auto-set overlay until we've captured the initial tool
    if (!hasCapturedInitialTool.current) {
      return;
    }
    
    // Don't auto-set overlay if this matches the initial tool from localStorage
    if (initialSelectedToolRef.current !== null && 
        initialSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Don't auto-set overlay if tool hasn't changed
    if (previousSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Update previous tool reference
    previousSelectedToolRef.current = state.selectedTool;
    
    setTimeout(() => {
      setOverlayMode(getOverlayForTool(state.selectedTool));
    }, 0);
  }, [state.selectedTool]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (overlayMode !== 'none') {
          setOverlayMode('none');
        } else if (state.activePanel !== 'none') {
          setActivePanel('none');
        } else if (selectedTile) {
          setSelectedTile(null);
        } else if (state.selectedTool !== 'select') {
          setTool('select');
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Toggle pause/unpause: if paused (speed 0), resume to normal (speed 1)
        // If running, pause (speed 0)
        setSpeed(state.speed === 0 ? 1 : 0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activePanel, state.selectedTool, state.speed, selectedTile, setActivePanel, setTool, setSpeed, overlayMode]);

  // Handle cheat code triggers
  useEffect(() => {
    if (!triggeredCheat) return;

    switch (triggeredCheat.type) {
      case 'konami':
        addMoney(triggeredCheat.amount);
        addNotification(
          gt('Retro Cheat Activated!'),
          gt('Your accountants are confused but not complaining. You received $50,000!'),
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'motherlode':
        addMoney(triggeredCheat.amount);
        addNotification(
          gt('Motherlode!'),
          gt('Your treasury just got a lot heavier. You received $1,000,000!'),
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'vinnie':
        // Vinnie dialog is handled by VinnieDialog component
        clearTriggeredCheat();
        break;
    }
  }, [triggeredCheat, addMoney, addNotification, clearTriggeredCheat, gt]);
  
  // Track barge deliveries to show occasional notifications
  const bargeDeliveryCountRef = useRef(0);
  
  // Handle barge cargo delivery - adds money to the city treasury
  const handleBargeDelivery = useCallback((cargoValue: number, cargoType: number) => {
    addMoney(cargoValue);
    bargeDeliveryCountRef.current++;

    // Show a notification every 5 deliveries to avoid spam
    if (bargeDeliveryCountRef.current % 5 === 1) {
      const cargoName = CARGO_TYPE_NAMES[cargoType] || msg('cargo');
      addNotification(
        gt('Cargo Delivered'),
        gt('A shipment of {cargoName} has arrived at the marina. +${cargoValue} trade revenue.', { cargoName: m(cargoName), cargoValue }),
        'ship'
      );
    }
  }, [addMoney, addNotification, gt, m]);

  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          {/* Mobile Top Bar */}
          <MobileTopBar 
            selectedTile={selectedTile && state.selectedTool === 'select' ? state.grid[selectedTile.y][selectedTile.x] : null}
            services={state.services}
            onCloseTile={() => setSelectedTile(null)}
            onShare={() => setShowShareModal(true)}
            onExit={onExit}
          />
          
          {/* Share Modal for mobile co-op */}
          {multiplayer && (
            <ShareModal
              open={showShareModal}
              onOpenChange={setShowShareModal}
            />
          )}
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              isMobile={true}
              onBargeDelivery={handleBargeDelivery}
            />
            
            {/* Multiplayer Players Indicator - Mobile */}
            {isMultiplayer && (
              <div className="absolute top-2 right-2 z-20">
                <MultiplayerRoomBadge roomCode={roomCode} players={players} copyPath="coop" statusColorClassName="bg-green-500" compact />
              </div>
            )}
            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2">
              <MusicControls className="relative" />
              <AudioToggleButton className="h-9 w-9 inline-flex items-center justify-center rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors" />
            </div>
          </div>
          
          {/* Mobile Bottom Toolbar */}
          <MobileToolbar 
            onOpenPanel={(panel) => setActivePanel(panel)}
            overlayMode={overlayMode}
            setOverlayMode={setOverlayMode}
          />
          
          {/* Panels - render as fullscreen modals on mobile */}
          {state.activePanel === 'budget' && <BudgetPanel />}
          {state.activePanel === 'statistics' && <StatisticsPanel />}
          {state.activePanel === 'advisors' && <AdvisorsPanel />}
          {state.activePanel === 'settings' && <SettingsPanel />}
          
          <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
          
          {/* Tip Toast for helping new players */}
          <TipToast
            message={currentTip || ''}
            isVisible={isTipVisible}
            onContinue={onTipContinue}
            onSkipAll={onTipSkipAll}
          />
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
          <StatsPanel />
          <div className="flex-1 relative overflow-visible">
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
              onBargeDelivery={handleBargeDelivery}
            />
            <OverlayModeToggle overlayMode={overlayMode} setOverlayMode={setOverlayMode} />
            <MiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />
            
            {/* Multiplayer Players Indicator */}
            {isMultiplayer && (
              <div className="absolute top-4 right-4 z-20">
                <MultiplayerRoomBadge roomCode={roomCode} players={players} copyPath="coop" statusColorClassName="bg-green-500" />
              </div>
            )}
            <div className="absolute bottom-24 left-4 z-20 flex items-center gap-2">
              <MusicControls className="relative" />
              <AudioToggleButton className="h-10 w-10 inline-flex items-center justify-center rounded bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors" />
            </div>
          </div>
        </div>
        
        {state.activePanel === 'budget' && <BudgetPanel />}
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        {state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        <CommandMenu />
        
        {/* Tip Toast for helping new players */}
        <TipToast
          message={currentTip || ''}
          isVisible={isTipVisible}
          onContinue={onTipContinue}
          onSkipAll={onTipSkipAll}
        />
      </div>
    </TooltipProvider>
  );
}
