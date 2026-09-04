'use client';

import React from 'react';
import { Box, Grid3x3 } from 'lucide-react';
import { T, useGT } from 'gt-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ViewMode = '2d' | '3d';

export interface ViewModeToggleProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  className?: string;
}

/** Switch between the isometric canvas view and the perspective 3D view. */
export const ViewModeToggle = React.memo(function ViewModeToggle({
  viewMode,
  setViewMode,
  className,
}: ViewModeToggleProps) {
  const gt = useGT();
  return (
    <Card className={`p-1 shadow-lg bg-card/90 border-border/70 ${className ?? ''}`}>
      <div className="flex gap-1">
        <Button
          variant={viewMode === '2d' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2 gap-1.5"
          onClick={() => setViewMode('2d')}
          title={gt('Isometric view')}
        >
          <Grid3x3 className="w-3.5 h-3.5" />
          <T>
            <span className="text-xs">2D</span>
          </T>
        </Button>
        <Button
          variant={viewMode === '3d' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 px-2 gap-1.5"
          onClick={() => setViewMode('3d')}
          title={gt('True 3D view (perspective camera)')}
        >
          <Box className="w-3.5 h-3.5" />
          <T>
            <span className="text-xs">3D</span>
          </T>
        </Button>
      </div>
    </Card>
  );
});
