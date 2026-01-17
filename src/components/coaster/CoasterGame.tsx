'use client';

import React, { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CoasterCanvasGrid } from '@/components/coaster/CoasterCanvasGrid';
import { CoasterSidebar } from '@/components/coaster/CoasterSidebar';
import { CoasterTopBar } from '@/components/coaster/CoasterTopBar';
import { CoasterMiniMap } from '@/components/coaster/CoasterMiniMap';

export function CoasterGame() {
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
      </div>
    </TooltipProvider>
  );
}
