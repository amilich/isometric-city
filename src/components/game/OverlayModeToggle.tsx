'use client';

import React from 'react';
import { msg } from 'gt-next';
import { useMessages } from 'gt-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CloseIcon,
  PowerIcon,
  WaterIcon,
  FireIcon,
  SafetyIcon,
  HealthIcon,
  EducationIcon,
  SubwayIcon,
} from '@/components/ui/Icons';
import { OverlayMode } from './types';
import { OVERLAY_CONFIG, getOverlayButtonClass } from './overlays';

// ============================================================================
// Types
// ============================================================================

export interface OverlayModeToggleProps {
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

/** Map overlay modes to their icons */
const OVERLAY_ICONS: Record<OverlayMode, React.ReactNode> = {
  none: <CloseIcon size={14} />,
  power: <PowerIcon size={14} />,
  water: <WaterIcon size={14} />,
  fire: <FireIcon size={14} />,
  police: <SafetyIcon size={14} />,
  health: <HealthIcon size={14} />,
  education: <EducationIcon size={14} />,
  subway: <SubwayIcon size={14} />,
};

// ============================================================================
// Translatable Labels
// ============================================================================

const VIEW_OVERLAY_LABEL = msg('View Overlay');

// ============================================================================
// Component
// ============================================================================

/**
 * Overlay mode toggle component.
 * Allows users to switch between different visualization overlays
 * (power grid, water system, service coverage, etc.)
 */
export const OverlayModeToggle = React.memo(function OverlayModeToggle({
  overlayMode,
  setOverlayMode,
}: OverlayModeToggleProps) {
  const m = useMessages();
  
  return (
    <Card className="fixed bottom-4 left-[240px] p-2 shadow-lg bg-card/90 border-border/70 z-50">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        {m(VIEW_OVERLAY_LABEL)}
      </div>
      <div className="flex gap-1">
        {(Object.keys(OVERLAY_CONFIG) as OverlayMode[]).map((mode) => {
          const config = OVERLAY_CONFIG[mode];
          const isActive = overlayMode === mode;
          
          return (
            <Button
              key={mode}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setOverlayMode(mode)}
              className={`h-8 px-3 ${getOverlayButtonClass(mode, isActive)}`}
              title={config.title}
            >
              {OVERLAY_ICONS[mode]}
            </Button>
          );
        })}
      </div>
    </Card>
  );
});
