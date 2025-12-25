'use client';

import React from 'react';
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
  RoadIcon,
  EnvironmentIcon,
  MoneyIcon,
  AlertIcon,
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
  traffic: <RoadIcon size={14} />,
  pollution: <EnvironmentIcon size={14} />,
  landValue: <MoneyIcon size={14} />,
  crime: <AlertIcon size={14} />,
};

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
  const showHeatLegend =
    overlayMode === 'traffic' ||
    overlayMode === 'pollution' ||
    overlayMode === 'crime' ||
    overlayMode === 'landValue';

  const legendGradient =
    overlayMode === 'landValue'
      ? 'bg-gradient-to-r from-red-500 via-yellow-500 to-green-500'
      : 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500';

  return (
    <Card className="absolute bottom-4 left-4 p-2 shadow-lg bg-card/90 border-border/70 z-50">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
        View Overlay
      </div>
      <div className="grid grid-cols-6 gap-1">
        {(Object.keys(OVERLAY_CONFIG) as OverlayMode[]).map((mode) => {
          const config = OVERLAY_CONFIG[mode];
          const isActive = overlayMode === mode;
          
          return (
            <Button
              key={mode}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setOverlayMode(mode)}
              className={`h-8 w-9 px-0 ${getOverlayButtonClass(mode, isActive)}`}
              title={config.title}
            >
              {OVERLAY_ICONS[mode]}
            </Button>
          );
        })}
      </div>

      {showHeatLegend && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Low</span>
            <span>High</span>
          </div>
          <div className={`h-2 w-full rounded ${legendGradient}`} />
        </div>
      )}
    </Card>
  );
});
