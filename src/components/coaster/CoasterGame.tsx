'use client';

import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CoasterCanvasGrid } from '@/components/coaster/CoasterCanvasGrid';
import { CoasterSidebar } from '@/components/coaster/CoasterSidebar';
import { CoasterTopBar } from '@/components/coaster/CoasterTopBar';
import { CoasterMiniMap } from '@/components/coaster/CoasterMiniMap';
import { FinancesPanel } from '@/components/coaster/panels/FinancesPanel';
import { RidesPanel } from '@/components/coaster/panels/RidesPanel';
import { GuestsPanel } from '@/components/coaster/panels/GuestsPanel';
import { SettingsPanel } from '@/components/coaster/panels/SettingsPanel';
import { useCoaster } from '@/context/CoasterContext';

export function CoasterGame() {
  const { state } = useCoaster();
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  } | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);

  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-screen overflow-hidden bg-background flex">
        <CoasterSidebar />

        <div className="flex-1 flex flex-col ml-56">
          <CoasterTopBar />
          <div className="flex-1 relative">
            <CoasterCanvasGrid
              selectedTile={selectedTile}
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={() => setNavigationTarget(null)}
              onViewportChange={setViewport}
            />
            <CoasterMiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />
          </div>
        </div>

        {state.activePanel === 'finances' && <FinancesPanel />}
        {state.activePanel === 'rides' && <RidesPanel />}
        {state.activePanel === 'guests' && <GuestsPanel />}
        {state.activePanel === 'settings' && <SettingsPanel />}
      </div>
    </TooltipProvider>
  );
}
