'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool } from '@/types/game';
import { useMobile } from '@/hooks/useMobile';
import { MobileToolbar } from '@/components/mobile/MobileToolbar';
import { MobileTopBar } from '@/components/mobile/MobileTopBar';

// Import shadcn components
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCheatCodes } from '@/hooks/useCheatCodes';
import { VinnieDialog } from '@/components/VinnieDialog';
import { CommandMenu } from '@/components/ui/CommandMenu';
import { NotificationsToasts } from '@/components/NotificationsToasts';

// Import game components
import { OverlayMode } from '@/components/game/types';
import { getOverlayForTool, OVERLAY_MODES } from '@/components/game/overlays';
import { OverlayModeToggle } from '@/components/game/OverlayModeToggle';
import { Sidebar } from '@/components/game/Sidebar';
import {
  BudgetPanel,
  StatisticsPanel,
  SettingsPanel,
  AdvisorsPanel,
  HelpPanel,
} from '@/components/game/panels';
import { MiniMap } from '@/components/game/MiniMap';
import { TopBar, StatsPanel } from '@/components/game/TopBar';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';

// Cargo type names for notifications
const CARGO_TYPE_NAMES = ['containers', 'bulk materials', 'oil'];

export default function Game({ onExit }: { onExit?: () => void }) {
  const {
    state,
    setTool,
    setActivePanel,
    addMoney,
    addNotification,
    setSpeed,
    undo,
    redo,
    canUndo,
    canRedo,
    saveCity,
  } = useGame();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const isInitialMount = useRef(true);
  const lastNonZeroSpeedRef = useRef<0 | 1 | 2 | 3>(1);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  
  // Cheat code system
  const {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  } = useCheatCodes();
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

      const mod = e.metaKey || e.ctrlKey;

      // Undo / Redo
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Quick save snapshot (Cmd/Ctrl+S)
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveCity();
        addNotification('City saved', 'Snapshot added to your saved cities list.', '💾');
        return;
      }

      // Avoid hijacking browser shortcuts (Cmd/Ctrl + ...)
      if (mod) return;

      // Help panel
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setActivePanel(state.activePanel === 'help' ? 'none' : 'help');
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
        return;
      }

      // Pause / resume (Space or P)
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (state.speed === 0) {
          setSpeed(lastNonZeroSpeedRef.current || 1);
        } else {
          lastNonZeroSpeedRef.current = state.speed;
          setSpeed(0);
        }
        return;
      }

      // Tool hotkeys (no modifiers)
      switch (e.key) {
        case '1':
          setTool('select');
          return;
        case '2':
          setTool('road');
          return;
        case '3':
          setTool('rail');
          return;
        case '4':
          setTool('subway');
          return;
      }

      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setTool('tree');
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setTool('zone_residential');
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setTool('zone_commercial');
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setTool('zone_industrial');
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setTool('zone_dezone');
        return;
      }

      if (e.key === 'o' || e.key === 'O') {
        // Cycle overlay mode (Shift reverses)
        e.preventDefault();
        const idx = OVERLAY_MODES.indexOf(overlayMode);
        const delta = e.shiftKey ? -1 : 1;
        const next = OVERLAY_MODES[(idx + delta + OVERLAY_MODES.length) % OVERLAY_MODES.length];
        setOverlayMode(next);
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        setSpeed(Math.max(0, state.speed - 1));
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        setSpeed(Math.min(3, state.speed + 1));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.activePanel,
    state.selectedTool,
    state.speed,
    selectedTile,
    overlayMode,
    canUndo,
    canRedo,
    undo,
    redo,
    setActivePanel,
    setSelectedTile,
    setTool,
    setSpeed,
    saveCity,
    addNotification,
  ]);

  // Handle cheat code triggers
useEffect(() => {
  if (!triggeredCheat) return;

  const fmt = (amount: number) => `$${amount.toLocaleString()}`;

  switch (triggeredCheat.type) {
    case 'konami': {
      const amount = triggeredCheat.amount;
      addMoney(amount);
      addNotification(
        'Retro Cheat Activated!',
        `Your accountants are confused but not complaining. You received ${fmt(amount)}!`,
        'trophy'
      );
      clearTriggeredCheat();
      break;
    }

    case 'motherlode': {
      const amount = triggeredCheat.amount;
      addMoney(amount);
      addNotification(
        'Motherlode!',
        `Your treasury just got a lot heavier. You received ${fmt(amount)}!`,
        'trophy'
      );
      clearTriggeredCheat();
      break;
    }

    case 'fund': {
      const amount = triggeredCheat.amount;
      addMoney(amount);
      addNotification(
        'Funds Secured',
        `A small grant came through. You received ${fmt(amount)}!`,
        'trophy'
      );
      clearTriggeredCheat();
      break;
    }

    case 'vinnie':
      // Vinnie dialog is handled by VinnieDialog component
      clearTriggeredCheat();
      break;
  }
}, [triggeredCheat, addMoney, addNotification, clearTriggeredCheat]);
// Track barge deliveries to show occasional notifications
  const bargeDeliveryCountRef = useRef(0);
  
  // Handle barge cargo delivery - adds money to the city treasury
  const handleBargeDelivery = useCallback((cargoValue: number, cargoType: number) => {
    addMoney(cargoValue);
    bargeDeliveryCountRef.current++;
    
    // Show a notification every 5 deliveries to avoid spam
    if (bargeDeliveryCountRef.current % 5 === 1) {
      const cargoName = CARGO_TYPE_NAMES[cargoType] || 'cargo';
      addNotification(
        'Cargo Delivered',
        `A shipment of ${cargoName} has arrived at the marina. +$${cargoValue} trade revenue.`,
        'ship'
      );
    }
  }, [addMoney, addNotification]);

  // Mobile layout
  if (isMobile) {
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          <NotificationsToasts isMobile={true} />
          {/* Mobile Top Bar */}
          <MobileTopBar 
            selectedTile={selectedTile && state.selectedTool === 'select' ? state.grid[selectedTile.y][selectedTile.x] : null}
            services={state.services}
            onCloseTile={() => setSelectedTile(null)}
            onExit={onExit}
          />
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: '72px', paddingBottom: '76px' }}>
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              isMobile={true}
              onBargeDelivery={handleBargeDelivery}
            />
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
        {state.activePanel === 'help' && <HelpPanel />}
          {state.activePanel === 'help' && <HelpPanel />}
          
          <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        <NotificationsToasts isMobile={false} />
        <Sidebar onExit={onExit} />
        
        <div className="flex-1 flex flex-col">
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
          </div>
        </div>
        
        {state.activePanel === 'budget' && <BudgetPanel />}
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        {state.activePanel === 'advisors' && <AdvisorsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        {state.activePanel === 'help' && <HelpPanel />}
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        <CommandMenu onNavigateToTile={(x, y) => setNavigationTarget({ x, y })} />
      </div>
    </TooltipProvider>
  );
}
