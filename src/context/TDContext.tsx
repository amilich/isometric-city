'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { GameState, TowerType } from '@/games/td/types';
import { createInitialState } from '@/games/td/lib/initialState';
import { simulateTick, placeTower, sellTower } from '@/games/td/lib/simulation';

// =============================================================================
// CONTEXT
// =============================================================================

interface TDContextValue {
  state: GameState;
  isReady: boolean;
  setTool: (tool: TowerType | 'sell' | null) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  placeTowerAt: (x: number, y: number) => void;
  sellTowerAt: (x: number, y: number) => void;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  setHoveredTile: (tile: { x: number; y: number } | null) => void;
  restart: () => void;
}

const TDContext = createContext<TDContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

const TICK_INTERVAL_MS = 50;

export function TDProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [isReady] = useState(true);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulation loop
  useEffect(() => {
    const runTick = () => {
      const now = performance.now();
      setState((prev) => simulateTick(prev, now));
    };

    tickIntervalRef.current = setInterval(runTick, TICK_INTERVAL_MS);
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, []);

  const setTool = useCallback((tool: TowerType | 'sell' | null) => {
    setState((prev) => ({ ...prev, selectedTool: tool }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const placeTowerAt = useCallback((x: number, y: number) => {
    setState((prev) => {
      const tool = prev.selectedTool;
      if (tool && tool !== 'sell' && tool !== 'upgrade') {
        return placeTower(prev, x, y, tool);
      }
      return prev;
    });
  }, []);

  const sellTowerAt = useCallback((x: number, y: number) => {
    setState((prev) => sellTower(prev, x, y));
  }, []);

  const setSelectedTile = useCallback((tile: { x: number; y: number } | null) => {
    setState((prev) => ({ ...prev, selectedTile: tile }));
  }, []);

  const setHoveredTile = useCallback((tile: { x: number; y: number } | null) => {
    setState((prev) => ({ ...prev, hoveredTile: tile }));
  }, []);

  const restart = useCallback(() => {
    setState(createInitialState());
  }, []);

  const value: TDContextValue = {
    state,
    isReady,
    setTool,
    setSpeed,
    placeTowerAt,
    sellTowerAt,
    setSelectedTile,
    setHoveredTile,
    restart,
  };

  return <TDContext.Provider value={value}>{children}</TDContext.Provider>;
}

export function useTD() {
  const ctx = useContext(TDContext);
  if (!ctx) throw new Error('useTD must be used within TDProvider');
  return ctx;
}
