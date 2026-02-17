'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, Tool, Tile } from '@/games/tower/types';
import { TOOL_INFO, TOWER_TOOL_TO_TYPE } from '@/games/tower/types';
import { TOWER_DEFINITIONS } from '@/games/tower/types/towers';
import { isBuildableTileKind } from '@/games/tower/lib/pathing';
import { uuid } from '@/games/tower/lib/math';
import { simulateTowerTick, startWaveState } from '@/games/tower/lib/simulateTick';
import { createInitialTowerGameState } from '@/games/tower/lib/initialState';
import {
  deleteTowerStateFromStorage,
  loadTowerStateFromStorage,
  readSavedRunsIndex,
  removeSavedRunMeta,
  saveRunToIndex,
  saveTowerStateToStorage,
  TOWER_AUTOSAVE_KEY,
  TOWER_SAVED_RUN_PREFIX,
  writeSavedRunsIndex,
} from '@/games/tower/saveUtils';

const SPEED_TICK_INTERVALS = [0, 50, 25, 16] as const; // ms per tick for 0x-3x

type TowerContextValue = {
  state: GameState;
  latestStateRef: React.RefObject<GameState>;
  isStateReady: boolean;
  hasSavedGame: boolean;

  setTool: (tool: Tool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  setSettings: (settings: Partial<GameState['settings']>) => void;

  newGame: (name?: string, gridSize?: number) => void;
  saveRun: () => void;
  loadRun: (id: string) => boolean;
  deleteRun: (id: string) => void;

  exportState: () => string;
  loadState: (stateString: string) => boolean;

  placeAtTile: (x: number, y: number) => void;
  sellTower: (x: number, y: number) => boolean;
  upgradeTower: (x: number, y: number) => boolean;
  startWave: () => void;
};

const TowerContext = createContext<TowerContextValue | null>(null);

export function TowerProvider({
  children,
  startFresh = false,
  loadRunId,
}: {
  children: React.ReactNode;
  startFresh?: boolean;
  loadRunId?: string | null;
}) {
  const [state, setState] = useState<GameState>(() => createInitialTowerGameState());
  const latestStateRef = useRef(state);
  const [isStateReady, setIsStateReady] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);

  // Keep latest state ref synced
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // Initial load (autosave or explicit run)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (startFresh) {
      const fresh = createInitialTowerGameState();
      setState(fresh);
      setIsStateReady(true);
      setHasSavedGame(false);
      return;
    }

    const loaded = loadRunId
      ? loadTowerStateFromStorage(`${TOWER_SAVED_RUN_PREFIX}${loadRunId}`)
      : loadTowerStateFromStorage(TOWER_AUTOSAVE_KEY);

    if (loaded) {
      setState(loaded);
      setHasSavedGame(true);
    } else {
      setHasSavedGame(false);
      setState(createInitialTowerGameState());
    }

    setIsStateReady(true);
  }, [startFresh, loadRunId]);

  const persist = useCallback((next: GameState) => {
    saveTowerStateToStorage(TOWER_AUTOSAVE_KEY, next);
    // Also store by id so the run list can load it.
    saveTowerStateToStorage(`${TOWER_SAVED_RUN_PREFIX}${next.id}`, next);
    saveRunToIndex(next);
    setHasSavedGame(true);
  }, []);

  // Autosave (debounced)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isStateReady) return;
    if (typeof window === 'undefined') return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      persist(latestStateRef.current);
    }, 400);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [state, isStateReady, persist]);

  // Tick loop
  useEffect(() => {
    if (!isStateReady) return;
    const interval = SPEED_TICK_INTERVALS[state.speed];
    if (!interval) return;

    const id = window.setInterval(() => {
      setState((prev) => simulateTowerTick(prev));
    }, interval);

    return () => window.clearInterval(id);
  }, [state.speed, isStateReady]);

  const setTool = useCallback((tool: Tool) => {
    setState((prev) => ({ ...prev, selectedTool: tool }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setActivePanel = useCallback((panel: GameState['activePanel']) => {
    setState((prev) => ({ ...prev, activePanel: panel }));
  }, []);

  const setSettings = useCallback((settingsPatch: Partial<GameState['settings']>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settingsPatch,
      },
    }));
  }, []);

  const newGame = useCallback((name?: string, gridSize?: number) => {
    const fresh = createInitialTowerGameState(name, gridSize);
    setState(fresh);
    setHasSavedGame(false);
    // Persist immediately so Continue works after switching routes.
    persist(fresh);
  }, [persist]);

  const saveRun = useCallback(() => {
    persist(latestStateRef.current);
  }, [persist]);

  const loadRun = useCallback((idToLoad: string): boolean => {
    const loaded = loadTowerStateFromStorage(`${TOWER_SAVED_RUN_PREFIX}${idToLoad}`);
    if (!loaded) return false;
    setState(loaded);
    persist(loaded);
    return true;
  }, [persist]);

  const deleteRun = useCallback((idToDelete: string) => {
    deleteTowerStateFromStorage(`${TOWER_SAVED_RUN_PREFIX}${idToDelete}`);
    const updated = removeSavedRunMeta(idToDelete, readSavedRunsIndex());
    writeSavedRunsIndex(updated);
    // If we deleted the currently-loaded run, also clear autosave.
    if (latestStateRef.current.id === idToDelete) {
      deleteTowerStateFromStorage(TOWER_AUTOSAVE_KEY);
      setHasSavedGame(false);
    }
  }, []);

  const exportState = useCallback(() => {
    return JSON.stringify(latestStateRef.current);
  }, []);

  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      if (parsed?.grid && parsed?.gridSize && parsed?.settings && parsed?.stats) {
        setState(parsed as GameState);
        persist(parsed as GameState);
        return true;
      }
    } catch (e) {
      console.error('Failed to load state string:', e);
    }
    return false;
  }, [persist]);

  const placeAtTile = useCallback((x: number, y: number) => {
    setState((prev) => {
      const tile = prev.grid[y]?.[x];
      if (!tile) return prev;

      // Select tool just selects tile in UI; placement handled by components.
      if (prev.selectedTool === 'select') return prev;

      // Sell tool
      if (prev.selectedTool === 'bulldoze') {
        if (!tile.tower) return prev;
        const def = TOWER_DEFINITIONS[tile.tower.type];
        const refund = Math.floor(tile.tower.totalSpent * def.sellRefundRatio);
        const nextGrid = prev.grid.map((row) => row.map((t) => (t.x === x && t.y === y ? { ...t, tower: null } : t)));
        return {
          ...prev,
          grid: nextGrid,
          money: prev.money + refund,
        };
      }

      // Place tower
      const towerType = TOWER_TOOL_TO_TYPE[prev.selectedTool as Exclude<Tool, 'select' | 'bulldoze'>];
      const toolCost = TOOL_INFO[prev.selectedTool].cost;

      if (prev.money < toolCost) return prev;
      if (tile.terrain !== 'grass') return prev;
      if (!isBuildableTileKind(tile.kind)) return prev;
      if (tile.tower) return prev;

      const def = TOWER_DEFINITIONS[towerType];
      const towerId = uuid(`tower-${towerType}`);

      const nextTile: Tile = {
        ...tile,
        tower: {
          id: towerId,
          type: towerType,
          level: 1,
          targeting: def.defaultTargeting,
          totalSpent: toolCost,
          cooldownRemainingTicks: 0,
        },
      };

      const nextGrid = prev.grid.map((row) => row.map((t) => (t.x === x && t.y === y ? nextTile : t)));
      return {
        ...prev,
        grid: nextGrid,
        money: prev.money - toolCost,
        stats: {
          ...prev.stats,
          moneySpent: prev.stats.moneySpent + toolCost,
        },
      };
    });
  }, []);

  const sellTower = useCallback((x: number, y: number): boolean => {
    const current = latestStateRef.current.grid[y]?.[x];
    if (!current?.tower) return false;

    setState((prev) => {
      const tile = prev.grid[y]?.[x];
      if (!tile?.tower) return prev;
      const def = TOWER_DEFINITIONS[tile.tower.type];
      const refund = Math.floor(tile.tower.totalSpent * def.sellRefundRatio);
      const nextGrid = prev.grid.map((row) =>
        row.map((t) => (t.x === x && t.y === y ? { ...t, tower: null } : t))
      );
      return {
        ...prev,
        grid: nextGrid,
        money: prev.money + refund,
      };
    });

    return true;
  }, []);

  const upgradeTower = useCallback((x: number, y: number): boolean => {
    const current = latestStateRef.current.grid[y]?.[x];
    if (!current?.tower) return false;
    if (current.tower.level >= 3) return false;

    const upgradeCost = Math.floor(TOOL_INFO[`tower_${current.tower.type}` as Tool]?.cost ?? 0);
    if (latestStateRef.current.money < upgradeCost) return false;

    setState((prev) => {
      const tile = prev.grid[y]?.[x];
      if (!tile?.tower) return prev;
      if (tile.tower.level >= 3) return prev;
      if (prev.money < upgradeCost) return prev;
      const nextGrid = prev.grid.map((row) =>
        row.map((t) =>
          t.x === x && t.y === y
            ? {
                ...t,
                tower: {
                  ...t.tower!,
                  level: (t.tower!.level + 1) as 1 | 2 | 3,
                  totalSpent: t.tower!.totalSpent + upgradeCost,
                },
              }
            : t
        )
      );
      return {
        ...prev,
        grid: nextGrid,
        money: prev.money - upgradeCost,
        stats: { ...prev.stats, moneySpent: prev.stats.moneySpent + upgradeCost },
      };
    });

    return true;
  }, []);

  const startWave = useCallback(() => {
    setState((prev) => startWaveState(prev));
  }, []);

  const value: TowerContextValue = useMemo(() => {
    return {
      state,
      latestStateRef,
      isStateReady,
      hasSavedGame,

      setTool,
      setSpeed,
      setActivePanel,
      setSettings,

      newGame,
      saveRun,
      loadRun,
      deleteRun,

      exportState,
      loadState,

      placeAtTile,
      sellTower,
      upgradeTower,
      startWave,
    };
  }, [
    state,
    isStateReady,
    hasSavedGame,
    setTool,
    setSpeed,
    setActivePanel,
    setSettings,
    newGame,
    saveRun,
    loadRun,
    deleteRun,
    exportState,
    loadState,
    placeAtTile,
    sellTower,
    upgradeTower,
    startWave,
  ]);

  return <TowerContext.Provider value={value}>{children}</TowerContext.Provider>;
}

export function useTower() {
  const ctx = useContext(TowerContext);
  if (!ctx) throw new Error('useTower must be used within a TowerProvider');
  return ctx;
}

