'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { TOOL_INFO } from '@/types/game';

export const ModeIndicator = React.memo(function ModeIndicator() {
  const { state } = useGame();
  const tool = state.selectedTool;
  const info = TOOL_INFO[tool];

  if (!info) return null;

  return (
    <div className="flex items-center px-3 py-1 bg-secondary/50 rounded-md border border-border/50">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">Mode</span>
      <span className="text-xs font-bold text-foreground w-[120px] truncate">{info.name}</span>
    </div>
  );
});
