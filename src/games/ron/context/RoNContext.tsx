/**
 * Rise of Nations - Game Context
 * 
 * Provides game state management, simulation loop, and actions.
 */
'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { decompressFromUTF16 } from 'lz-string';
import { serializeAndCompressAsync } from '@/lib/saveWorkerManager';
import {
  RoNGameState,
  RoNTool,
  RoNPlayer,
  createInitialRoNGameState,
  AIDifficulty,
} from '../types';
import { Age, AGE_ORDER, AGE_REQUIREMENTS } from '../types/ages';
import { Resources, ResourceType, BASE_GATHER_RATES } from '../types/resources';
import { RoNBuilding, RoNBuildingType, BUILDING_STATS, ECONOMIC_BUILDINGS } from '../types/buildings';
import { Unit, UnitType, UnitTask, UNIT_STATS } from '../types/units';
import { simulateRoNTick } from '../lib/simulation';

// Storage keys for RoN (separate from IsoCity)
const RON_STORAGE_KEY = 'ron-game-state';

/**
 * Load RoN game state from localStorage
 * Supports both compressed (lz-string) and uncompressed (legacy) formats
 */
function loadRoNGameState(): RoNGameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(RON_STORAGE_KEY);
    if (saved) {
      // Try to decompress first (new format)
      let jsonString = decompressFromUTF16(saved);

      // Check if decompression returned valid-looking JSON
      if (!jsonString || !jsonString.startsWith('{')) {
        // Check if the saved string itself looks like JSON (legacy uncompressed format)
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          // Data is corrupted - clear it and return null
          console.error('Corrupted RoN save data detected, clearing...');
          localStorage.removeItem(RON_STORAGE_KEY);
          return null;
        }
      }

      const parsed = JSON.parse(jsonString);
      
      // Validate basic structure
      if (parsed && parsed.grid && parsed.gridSize && parsed.players) {
        return parsed as RoNGameState;
      } else {
        localStorage.removeItem(RON_STORAGE_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to load RoN game state:', e);
    try {
      localStorage.removeItem(RON_STORAGE_KEY);
    } catch (clearError) {
      console.error('Failed to clear corrupted RoN game state:', clearError);
    }
  }
  return null;
}

/**
 * Save RoN game state to localStorage with lz-string compression
 * Uses Web Worker for serialization and compression
 */
async function saveRoNGameStateAsync(state: RoNGameState): Promise<void> {
  if (typeof window === 'undefined') return;

  // Validate state before saving
  if (!state || !state.grid || !state.gridSize || !state.players) {
    console.error('Invalid RoN game state, cannot save');
    return;
  }

  try {
    // Serialize + Compress using Web Worker
    const compressed = await serializeAndCompressAsync(state);

    // Check size limit (5MB)
    if (compressed.length > 5 * 1024 * 1024) {
      console.error('Compressed RoN game state too large to save:', compressed.length, 'chars');
      return;
    }

    // Write to localStorage
    try {
      localStorage.setItem(RON_STORAGE_KEY, compressed);
    } catch (quotaError) {
      if (quotaError instanceof DOMException && (quotaError.code === 22 || quotaError.code === 1014)) {
        console.warn('localStorage quota exceeded for RoN');
      }
    }
  } catch (e) {
    console.error('Failed to save RoN game state:', e);
  }
}

/**
 * Clear RoN saved game state
 */
function clearRoNGameState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RON_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear RoN game state:', e);
  }
}

interface RoNContextValue {
  state: RoNGameState;
  latestStateRef: React.RefObject<RoNGameState>;
  
  // SEPARATE building selection state (not affected by simulation)
  selectedBuildingPos: { x: number; y: number } | null;
  
  // Tool actions
  setTool: (tool: RoNTool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setActivePanel: (panel: RoNGameState['activePanel']) => void;
  
  // Unit actions
  selectUnits: (unitIds: string[]) => void;
  selectUnitsInArea: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
  moveSelectedUnits: (x: number, y: number) => void;
  assignTask: (task: UnitTask, target?: { x: number; y: number } | string) => void;
  attackTarget: (targetId: string | { x: number; y: number }) => void;
  
  // Building actions
  selectBuilding: (pos: { x: number; y: number } | null) => void;
  placeBuilding: (x: number, y: number, buildingType: RoNBuildingType) => boolean;
  queueUnit: (buildingPos: { x: number; y: number }, unitType: UnitType) => boolean;
  
  // Age advancement
  advanceAge: () => boolean;
  canAdvanceAge: () => boolean;
  
  // Game control
  newGame: (config: {
    gridSize: number;
    playerConfigs: Array<{
      name: string;
      type: 'human' | 'ai';
      difficulty?: AIDifficulty;
      color: string;
    }>;
  }) => void;
  
  // Helpers
  getCurrentPlayer: () => RoNPlayer | undefined;
  getPlayerById: (id: string) => RoNPlayer | undefined;
  
  // Debug
  debugAddResources: () => void;
}

const RoNContext = createContext<RoNContextValue | null>(null);

export function RoNProvider({ children }: { children: React.ReactNode }) {

  // SEPARATE state for building selection - NOT touched by simulation at all
  const [selectedBuildingPos, setSelectedBuildingPos] = useState<{ x: number; y: number } | null>(null);

  // Track if we've loaded from localStorage
  const [isStateReady, setIsStateReady] = useState(false);
  const hasLoadedRef = useRef(false);

  // Initialize with a default 2-player game (1 human vs 1 AI)
  const [state, setState] = useState<RoNGameState>(() =>
    createInitialRoNGameState(50, [
      { name: 'Player', type: 'human', color: '#3b82f6' },
      { name: 'AI Opponent', type: 'ai', difficulty: 'medium', color: '#ef4444' },
    ])
  );

  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  // Track state changes for auto-save
  const stateChangedRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const skipNextSaveRef = useRef(false);

  // Load game state from localStorage on mount
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const saved = loadRoNGameState();
    if (saved) {
      skipNextSaveRef.current = true; // Don't save immediately after loading
      setState(saved);
    }
    setIsStateReady(true);
  }, []);

  // Auto-save game state periodically
  useEffect(() => {
    if (!isStateReady) return;
    
    // Mark state as changed
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    stateChangedRef.current = true;
  }, [state, isStateReady]);

  // Save loop - save every 5 seconds if state changed
  useEffect(() => {
    if (!isStateReady) return;

    const saveInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastSave = now - lastSaveTimeRef.current;
      
      // Only save if state changed and at least 5 seconds since last save
      if (stateChangedRef.current && !saveInProgressRef.current && timeSinceLastSave >= 5000) {
        stateChangedRef.current = false;
        saveInProgressRef.current = true;
        
        saveRoNGameStateAsync(latestStateRef.current).finally(() => {
          lastSaveTimeRef.current = Date.now();
          saveInProgressRef.current = false;
        });
      }
    }, 1000);

    return () => clearInterval(saveInterval);
  }, [isStateReady]);
  
  // Simulation loop
  useEffect(() => {
    if (state.gameSpeed === 0) return;
    
    // Fast simulation for 40-minute game across all ages
    // At speed 1: 200ms tick = 5 ticks/second = 300 ticks/minute
    // 40 min game = 12000 ticks at speed 1
    const intervals = {
      1: 200,  // Normal
      2: 100,  // Fast
      3: 50,   // Very fast
    };
    
    const interval = intervals[state.gameSpeed as 1 | 2 | 3];
    
    const timer = setInterval(() => {
      setState(currentState => {
        // Capture current UI state BEFORE simulation
        const currentSelectedUnits = currentState.selectedUnitIds;
        const currentTool = currentState.selectedTool;
        const currentPanel = currentState.activePanel;
        const currentCamera = currentState.cameraOffset;
        const currentZoom = currentState.zoom;
        
        // Run simulation on current state
        const simulatedState = simulateRoNTick(currentState);
        
        // Restore UI state that simulation shouldn't touch
        // NOTE: selectedBuildingPos is now in SEPARATE state, not affected by this
        const newState = {
          ...simulatedState,
          selectedUnitIds: currentSelectedUnits,
          selectedTool: currentTool,
          activePanel: currentPanel,
          cameraOffset: currentCamera,
          zoom: currentZoom,
        };
        latestStateRef.current = newState;
        return newState;
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [state.gameSpeed]);
  
  // Tool actions
  const setTool = useCallback((tool: RoNTool) => {
    setState(prev => ({ ...prev, selectedTool: tool }));
  }, []);
  
  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState(prev => ({ ...prev, gameSpeed: speed }));
  }, []);
  
  const setActivePanel = useCallback((panel: RoNGameState['activePanel']) => {
    setState(prev => ({ ...prev, activePanel: panel }));
  }, []);
  
  // Unit selection
  const selectUnits = useCallback((unitIds: string[]) => {
    setState(prev => {
      const updatedUnits = prev.units.map(u => ({
        ...u,
        isSelected: unitIds.includes(u.id),
      }));
      return {
        ...prev,
        units: updatedUnits,
        selectedUnitIds: unitIds,
        selectedBuildingPos: null, // Clear building selection
      };
    });
  }, []);
  
  const selectUnitsInArea = useCallback((start: { x: number; y: number }, end: { x: number; y: number }) => {
    setState(prev => {
      const currentPlayer = prev.players.find(p => p.id === prev.currentPlayerId);
      if (!currentPlayer) return prev;
      
      // Use min/max but add generous buffer for fractional unit positions
      // Units can be at positions like (9.5, 11) so we need extra buffer
      const minX = Math.min(start.x, end.x) - 1;
      const maxX = Math.max(start.x, end.x) + 1;
      const minY = Math.min(start.y, end.y) - 1;
      const maxY = Math.max(start.y, end.y) + 1;
      
      const selectedIds: string[] = [];
      const updatedUnits = prev.units.map(u => {
        const inArea = u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
        const isOwned = u.ownerId === currentPlayer.id;
        const isSelected = inArea && isOwned;
        
        if (isSelected) {
          selectedIds.push(u.id);
        }
        
        return { ...u, isSelected };
      });
      
      return {
        ...prev,
        units: updatedUnits,
        selectedUnitIds: selectedIds,
        isSelectingArea: false,
        selectionStart: null,
        selectionEnd: null,
      };
    });
  }, []);
  
  // Unit movement - offset units in a formation so they don't stack
  const moveSelectedUnits = useCallback((x: number, y: number) => {
    setState(prev => {
      // Get all selected units
      const selectedUnits = prev.units.filter(u => u.isSelected);
      const numSelected = selectedUnits.length;
      
      let unitIndex = 0;
      const updatedUnits = prev.units.map(u => {
        if (!u.isSelected) return u;

        // Calculate offset for formation (spiral pattern around target)
        let offsetX = 0;
        let offsetY = 0;
        
        if (numSelected > 1) {
          // Spread units in a rough grid/circle formation
          const spreadRadius = 0.6; // How far apart units spread
          if (unitIndex === 0) {
            // First unit goes to exact target
            offsetX = 0;
            offsetY = 0;
          } else {
            // Other units spread in a circle around the target
            const angle = (unitIndex - 1) * (Math.PI * 2 / Math.max(1, numSelected - 1));
            const ring = Math.floor((unitIndex - 1) / 6) + 1; // Which ring (6 units per ring)
            offsetX = Math.cos(angle) * spreadRadius * ring;
            offsetY = Math.sin(angle) * spreadRadius * ring;
          }
        }
        
        unitIndex++;

        return {
          ...u,
          isMoving: true,
          targetX: x + offsetX,
          targetY: y + offsetY,
          task: 'move' as UnitTask,
        };
      });

      return { ...prev, units: updatedUnits };
    });
  }, []);
  
  // Task assignment - spread units around target
  const assignTask = useCallback((task: UnitTask, target?: { x: number; y: number } | string) => {
    setState(prev => {
      // Get all selected units for formation calculation
      const selectedUnits = prev.units.filter(u => u.isSelected);
      const numSelected = selectedUnits.length;
      
      let unitIndex = 0;
      const updatedUnits = prev.units.map(u => {
        if (!u.isSelected) return u;

        const newUnit = { ...u, task, taskTarget: target };

        // If task requires movement to target position
        if (target && typeof target === 'object' && 'x' in target) {
          // Calculate offset for formation
          let offsetX = 0;
          let offsetY = 0;
          
          if (numSelected > 1) {
            const spreadRadius = 0.6;
            if (unitIndex === 0) {
              offsetX = 0;
              offsetY = 0;
            } else {
              const angle = (unitIndex - 1) * (Math.PI * 2 / Math.max(1, numSelected - 1));
              const ring = Math.floor((unitIndex - 1) / 6) + 1;
              offsetX = Math.cos(angle) * spreadRadius * ring;
              offsetY = Math.sin(angle) * spreadRadius * ring;
            }
          }
          
          newUnit.targetX = target.x + offsetX;
          newUnit.targetY = target.y + offsetY;
          newUnit.isMoving = true;
        }
        
        unitIndex++;

        return newUnit;
      });

      return { ...prev, units: updatedUnits };
    });
  }, []);
  
  // Attack target
  const attackTarget = useCallback((targetId: string | { x: number; y: number }) => {
    setState(prev => {
      const updatedUnits = prev.units.map(u => {
        if (!u.isSelected) return u;
        
        return {
          ...u,
          task: 'attack' as UnitTask,
          taskTarget: targetId,
          isMoving: typeof targetId === 'object',
          targetX: typeof targetId === 'object' ? targetId.x : undefined,
          targetY: typeof targetId === 'object' ? targetId.y : undefined,
        };
      });
      
      return { ...prev, units: updatedUnits };
    });
  }, []);
  
  // Building selection - uses SEPARATE state that simulation can't touch
  const selectBuilding = useCallback((pos: { x: number; y: number } | null) => {
    // Update the separate building selection state
    setSelectedBuildingPos(pos);
    
    // Also update main state for unit deselection
    if (pos) {
      setState(prev => ({
        ...prev,
        selectedUnitIds: [],
        units: prev.units.map(u => ({ ...u, isSelected: false })),
      }));
    }
  }, []);
  
  // Place building
  const placeBuilding = useCallback((x: number, y: number, buildingType: RoNBuildingType): boolean => {
    let success = false;
    
    setState(prev => {
      const currentPlayer = prev.players.find(p => p.id === prev.currentPlayerId);
      if (!currentPlayer) return prev;
      
      const stats = BUILDING_STATS[buildingType];
      if (!stats) return prev;
      
      // Check age requirement
      const ageIndex = AGE_ORDER.indexOf(currentPlayer.age);
      const requiredAgeIndex = AGE_ORDER.indexOf(stats.minAge);
      if (ageIndex < requiredAgeIndex) return prev;
      
      // Check resources
      const cost = stats.cost;
      for (const [resource, amount] of Object.entries(cost)) {
        if (amount && currentPlayer.resources[resource as ResourceType] < amount) {
          return prev;
        }
      }
      
      // Check if tile is available
      const tile = prev.grid[y]?.[x];
      if (!tile || tile.building || tile.terrain === 'water') return prev;
      
      // Check building size
      const size = stats.size;
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const checkTile = prev.grid[y + dy]?.[x + dx];
          if (!checkTile || checkTile.building || checkTile.terrain === 'water') {
            return prev;
          }
        }
      }
      
      // Deduct resources
      const newResources = { ...currentPlayer.resources };
      for (const [resource, amount] of Object.entries(cost)) {
        if (amount) {
          newResources[resource as ResourceType] -= amount;
        }
      }
      
      // Create building
      // Docks are instant placement (no construction), other buildings start at 0
      const isInstantBuilding = buildingType === 'dock';
      const newBuilding: RoNBuilding = {
        type: buildingType,
        level: 1,
        ownerId: currentPlayer.id,
        health: stats.maxHealth,
        maxHealth: stats.maxHealth,
        constructionProgress: isInstantBuilding ? 100 : 0, // Docks are instant, others need to be built
        queuedUnits: [],
        productionProgress: 0,
        garrisonedUnits: [],
      };
      
      // Update grid
      const newGrid = prev.grid.map((row, gy) =>
        row.map((tile, gx) => {
          if (gx >= x && gx < x + size.width && gy >= y && gy < y + size.height) {
            return {
              ...tile,
              building: gx === x && gy === y ? newBuilding : null, // Only main tile has building
              ownerId: currentPlayer.id,
            };
          }
          return tile;
        })
      );
      
      // Update player resources
      const newPlayers = prev.players.map(p =>
        p.id === currentPlayer.id ? { ...p, resources: newResources } : p
      );
      
      success = true;
      
      return {
        ...prev,
        grid: newGrid,
        players: newPlayers,
      };
    });
    
    return success;
  }, []);
  
  // Queue unit production
  const queueUnit = useCallback((buildingPos: { x: number; y: number }, unitType: UnitType): boolean => {
    let success = false;
    
    setState(prev => {
      const tile = prev.grid[buildingPos.y]?.[buildingPos.x];
      if (!tile?.building) return prev;
      
      const building = tile.building;
      const currentPlayer = prev.players.find(p => p.id === building.ownerId);
      if (!currentPlayer || currentPlayer.id !== prev.currentPlayerId) return prev;
      
      const unitStats = UNIT_STATS[unitType];
      if (!unitStats) return prev;
      
      // Check age requirement
      const ageIndex = AGE_ORDER.indexOf(currentPlayer.age);
      const requiredAgeIndex = AGE_ORDER.indexOf(unitStats.minAge);
      if (ageIndex < requiredAgeIndex) return prev;
      
      // Check population cap
      if (currentPlayer.population >= currentPlayer.populationCap) return prev;
      
      // Check resources
      const cost = unitStats.cost;
      for (const [resource, amount] of Object.entries(cost)) {
        if (amount && currentPlayer.resources[resource as ResourceType] < amount) {
          return prev;
        }
      }
      
      // Deduct resources
      const newResources = { ...currentPlayer.resources };
      for (const [resource, amount] of Object.entries(cost)) {
        if (amount) {
          newResources[resource as ResourceType] -= amount;
        }
      }
      
      // Add to queue
      const newBuilding = {
        ...building,
        queuedUnits: [...building.queuedUnits, unitType],
      };
      
      // Update grid
      const newGrid = prev.grid.map((row, gy) =>
        row.map((tile, gx) => {
          if (gx === buildingPos.x && gy === buildingPos.y) {
            return { ...tile, building: newBuilding };
          }
          return tile;
        })
      );
      
      // Update player
      const newPlayers = prev.players.map(p =>
        p.id === currentPlayer.id ? { ...p, resources: newResources } : p
      );
      
      success = true;
      
      return {
        ...prev,
        grid: newGrid,
        players: newPlayers,
      };
    });
    
    return success;
  }, []);
  
  // Age advancement
  const canAdvanceAge = useCallback((): boolean => {
    const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
    if (!currentPlayer) return false;
    
    const currentAgeIndex = AGE_ORDER.indexOf(currentPlayer.age);
    if (currentAgeIndex >= AGE_ORDER.length - 1) return false;
    
    const nextAge = AGE_ORDER[currentAgeIndex + 1];
    const requirements = AGE_REQUIREMENTS[nextAge];
    if (!requirements) return false;
    
    // Check all resources
    for (const [resource, amount] of Object.entries(requirements)) {
      if (currentPlayer.resources[resource as ResourceType] < amount) {
        return false;
      }
    }
    
    return true;
  }, [state.players, state.currentPlayerId]);
  
  const advanceAge = useCallback((): boolean => {
    let success = false;
    
    setState(prev => {
      const currentPlayer = prev.players.find(p => p.id === prev.currentPlayerId);
      if (!currentPlayer) return prev;
      
      const currentAgeIndex = AGE_ORDER.indexOf(currentPlayer.age);
      if (currentAgeIndex >= AGE_ORDER.length - 1) return prev;
      
      const nextAge = AGE_ORDER[currentAgeIndex + 1];
      const requirements = AGE_REQUIREMENTS[nextAge];
      if (!requirements) return prev;
      
      // Check and deduct resources
      const newResources = { ...currentPlayer.resources };
      for (const [resource, amount] of Object.entries(requirements)) {
        if (newResources[resource as ResourceType] < amount) {
          return prev;
        }
        newResources[resource as ResourceType] -= amount;
      }
      
      // Update player
      const newPlayers = prev.players.map(p =>
        p.id === currentPlayer.id 
          ? { ...p, age: nextAge, resources: newResources } 
          : p
      );
      
      success = true;
      
      return { ...prev, players: newPlayers };
    });
    
    return success;
  }, []);
  
  // New game
  const newGame = useCallback((config: {
    gridSize: number;
    playerConfigs: Array<{
      name: string;
      type: 'human' | 'ai';
      difficulty?: AIDifficulty;
      color: string;
    }>;
  }) => {
    // Clear saved state when starting a new game
    clearRoNGameState();
    
    const newState = createInitialRoNGameState(config.gridSize, config.playerConfigs);
    skipNextSaveRef.current = true; // Will save on next state change cycle
    setState(newState);
  }, []);
  
  // Helpers
  const getCurrentPlayer = useCallback((): RoNPlayer | undefined => {
    return state.players.find(p => p.id === state.currentPlayerId);
  }, [state.players, state.currentPlayerId]);
  
  const getPlayerById = useCallback((id: string): RoNPlayer | undefined => {
    return state.players.find(p => p.id === id);
  }, [state.players]);

  // Debug: Add 50 of each resource to current player
  const debugAddResources = useCallback(() => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === prev.currentPlayerId
          ? {
              ...p,
              resources: {
                food: p.resources.food + 50,
                wood: p.resources.wood + 50,
                metal: p.resources.metal + 50,
                gold: p.resources.gold + 50,
                knowledge: p.resources.knowledge + 50,
                oil: p.resources.oil + 50,
              }
            }
          : p
      ),
    }));
  }, []);

  const value: RoNContextValue = {
    state,
    latestStateRef,
    selectedBuildingPos,  // SEPARATE state for building selection
    setTool,
    setSpeed,
    setActivePanel,
    selectUnits,
    selectUnitsInArea,
    moveSelectedUnits,
    assignTask,
    attackTarget,
    selectBuilding,
    placeBuilding,
    queueUnit,
    advanceAge,
    canAdvanceAge,
    newGame,
    getCurrentPlayer,
    getPlayerById,
    debugAddResources,
  };
  
  return (
    <RoNContext.Provider value={value}>
      {children}
    </RoNContext.Provider>
  );
}

export function useRoN() {
  const context = useContext(RoNContext);
  if (!context) {
    throw new Error('useRoN must be used within RoNProvider');
  }
  return context;
}
