'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import {
  GameState,
  Tool,
  Tile,
  Notification,
  createEmptyTile,
  createEmptyBuilding,
  TOOL_INFO,
} from '@/games/coaster/types';
import { ParkFinances, ParkStats, ParkSettings, Guest, Staff, DEFAULT_PRICES } from '@/games/coaster/types/economy';
import { Coaster, TrackDirection, TrackHeight, TrackPiece, TrackPieceType } from '@/games/coaster/types/tracks';
import { Building, BuildingType } from '@/games/coaster/types/buildings';
import { spawnGuests, updateGuest } from '@/components/coaster/guests';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'coaster-tycoon-state';
const DEFAULT_GRID_SIZE = 60;

// =============================================================================
// CONTEXT TYPE
// =============================================================================

interface CoasterContextValue {
  state: GameState;
  latestStateRef: React.RefObject<GameState>;
  
  // Tools
  setTool: (tool: Tool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  
  // Placement
  placeAtTile: (x: number, y: number) => void;
  bulldozeTile: (x: number, y: number) => void;
  
  // Coaster building
  startCoasterBuild: (coasterType: string) => void;
  addCoasterTrack: (x: number, y: number) => void;
  finishCoasterBuild: () => void;
  cancelCoasterBuild: () => void;
  
  // Park management
  setParkSettings: (settings: Partial<ParkSettings>) => void;
  addMoney: (amount: number) => void;
  addNotification: (title: string, description: string, icon: Notification['icon']) => void;
  
  // Save/Load
  saveGame: () => void;
  loadGame: () => boolean;
  newGame: (name?: string) => void;
  hasSavedGame: boolean;
  
  // State flags
  isStateReady: boolean;
}

const CoasterContext = createContext<CoasterContextValue | null>(null);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DIRECTION_ORDER: TrackDirection[] = ['north', 'east', 'south', 'west'];

function rotateDirection(direction: TrackDirection, turn: 'left' | 'right'): TrackDirection {
  const index = DIRECTION_ORDER.indexOf(direction);
  const delta = turn === 'right' ? 1 : -1;
  return DIRECTION_ORDER[(index + delta + DIRECTION_ORDER.length) % DIRECTION_ORDER.length];
}

function directionFromDelta(dx: number, dy: number): TrackDirection | null {
  if (dx === 1 && dy === 0) return 'south';
  if (dx === -1 && dy === 0) return 'north';
  if (dx === 0 && dy === 1) return 'west';
  if (dx === 0 && dy === -1) return 'east';
  return null;
}

function clampHeight(height: number): TrackHeight {
  if (height <= 0) return 0;
  if (height >= 10) return 10;
  return height as TrackHeight;
}

function createInitialGameState(parkName: string = 'My Theme Park', gridSize: number = DEFAULT_GRID_SIZE): GameState {
  // Create empty grid
  const grid: Tile[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push(createEmptyTile(x, y));
    }
    grid.push(row);
  }
  
  // Add some water tiles for variety (a small lake in the corner)
  const lakeX = Math.floor(gridSize * 0.7);
  const lakeY = Math.floor(gridSize * 0.7);
  const lakeRadius = 5;
  for (let y = lakeY - lakeRadius; y <= lakeY + lakeRadius; y++) {
    for (let x = lakeX - lakeRadius; x <= lakeX + lakeRadius; x++) {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        const dist = Math.sqrt(Math.pow(x - lakeX, 2) + Math.pow(y - lakeY, 2));
        if (dist <= lakeRadius) {
          grid[y][x].terrain = 'water';
          grid[y][x].building = { ...createEmptyBuilding(), type: 'water' };
        }
      }
    }
  }
  
  return {
    id: generateUUID(),
    
    grid,
    gridSize,
    
    year: 1,
    month: 3, // March - spring opening
    day: 1,
    hour: 8,
    minute: 0,
    tick: 0,
    speed: 1,
    
    settings: {
      name: parkName,
      entranceFee: DEFAULT_PRICES.parkEntrance,
      payPerRide: false,
      openHour: 9,
      closeHour: 22,
      loanInterest: 0.1,
      landCost: 100,
      objectives: [],
    },
    
    stats: {
      guestsInPark: 0,
      guestsTotal: 0,
      guestsSatisfied: 0,
      guestsUnsatisfied: 0,
      averageHappiness: 0,
      totalRides: 0,
      totalRidesRidden: 0,
      averageQueueTime: 0,
      parkValue: 0,
      companyValue: 10000,
      parkRating: 0,
    },
    
    finances: {
      cash: 10000,
      incomeAdmissions: 0,
      incomeRides: 0,
      incomeFood: 0,
      incomeShops: 0,
      incomeTotal: 0,
      expenseWages: 0,
      expenseUpkeep: 0,
      expenseMarketing: 0,
      expenseResearch: 0,
      expenseTotal: 0,
      profit: 0,
      history: [],
    },
    
    guests: [],
    staff: [],
    coasters: [],
    
    selectedTool: 'select',
    activePanel: 'none',
    notifications: [],
    
    buildingCoasterId: null,
    buildingCoasterPath: [],
    buildingCoasterHeight: 0,
    buildingCoasterLastDirection: null,
    
    gameVersion: 1,
  };
}

function normalizeLoadedState(state: GameState): GameState {
  const normalizedGrid = state.grid.map(row =>
    row.map(tile => ({
      ...tile,
      trackPiece: tile.trackPiece ?? null,
      hasCoasterTrack: tile.hasCoasterTrack || Boolean(tile.trackPiece),
    }))
  );
  
  return {
    ...state,
    grid: normalizedGrid,
    buildingCoasterId: state.buildingCoasterId ?? null,
    buildingCoasterPath: state.buildingCoasterPath ?? [],
    buildingCoasterHeight: state.buildingCoasterHeight ?? 0,
    buildingCoasterLastDirection: state.buildingCoasterLastDirection ?? null,
  };
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export function CoasterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => createInitialGameState());
  const [isStateReady, setIsStateReady] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const latestStateRef = useRef<GameState>(state);
  
  // Keep ref in sync
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);
  
  // Load saved game on mount
  useEffect(() => {
    const checkSaved = () => {
      if (typeof window === 'undefined') return;
      
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          let jsonString = decompressFromUTF16(saved);
          if (!jsonString || !jsonString.startsWith('{')) {
            if (saved.startsWith('{')) {
              jsonString = saved;
            } else {
              setIsStateReady(true);
              return;
            }
          }
          
          const parsed = JSON.parse(jsonString);
          if (parsed && parsed.grid && parsed.gridSize) {
            setState(normalizeLoadedState(parsed));
            setHasSavedGame(true);
          }
        }
      } catch (e) {
        console.error('Failed to load coaster game state:', e);
      }
      
      setIsStateReady(true);
    };
    
    checkSaved();
  }, []);
  
  // Auto-save periodically
  useEffect(() => {
    if (!isStateReady) return;
    
    const saveInterval = setInterval(() => {
      try {
        const compressed = compressToUTF16(JSON.stringify(latestStateRef.current));
        localStorage.setItem(STORAGE_KEY, compressed);
      } catch (e) {
        console.error('Failed to auto-save:', e);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(saveInterval);
  }, [isStateReady]);
  
  // Simulation tick
  useEffect(() => {
    if (!isStateReady || state.speed === 0) return;
    
    const tickInterval = [0, 100, 50, 25][state.speed]; // ms per tick
    
    const interval = setInterval(() => {
      setState(prev => {
        const newTick = prev.tick + 1;
        let { minute, hour, day, month, year } = prev;
        
        // Time progression (1 tick = 1 game minute at speed 1)
        minute += 1;
        if (minute >= 60) {
          minute = 0;
          hour += 1;
          if (hour >= 24) {
            hour = 0;
            day += 1;
            if (day > 30) {
              day = 1;
              month += 1;
              if (month > 12) {
                month = 1;
                year += 1;
              }
            }
          }
        }
        
        // Update guests
        const deltaTime = 1; // 1 game minute per tick
        const updatedGuests = prev.guests.map(guest => updateGuest(guest, prev.grid, deltaTime));
        const spawnedGuests = spawnGuests(prev.grid, updatedGuests, prev.stats.parkRating, hour);
        const guests = [...updatedGuests, ...spawnedGuests];
        
        const guestsInPark = guests.length;
        const guestsSatisfied = guests.filter(guest => guest.happiness >= 70).length;
        const guestsUnsatisfied = guests.filter(guest => guest.happiness <= 40).length;
        const avgHappiness = guestsInPark > 0
          ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guestsInPark
          : 0;
        
        const parkRating = Math.min(1000, Math.round(avgHappiness * 10));
        
        return {
          ...prev,
          tick: newTick,
          minute,
          hour,
          day,
          month,
          year,
          guests,
          stats: {
            ...prev.stats,
            guestsInPark,
            guestsTotal: prev.stats.guestsTotal + spawnedGuests.length,
            guestsSatisfied,
            guestsUnsatisfied,
            averageHappiness: avgHappiness,
            parkRating,
          },
        };
      });
    }, tickInterval);
    
    return () => clearInterval(interval);
  }, [isStateReady, state.speed]);
  
  // =============================================================================
  // ACTIONS
  // =============================================================================
  
  const setTool = useCallback((tool: Tool) => {
    setState(prev => ({ ...prev, selectedTool: tool }));
  }, []);
  
  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState(prev => ({ ...prev, speed }));
  }, []);
  
  const setActivePanel = useCallback((panel: GameState['activePanel']) => {
    setState(prev => ({ ...prev, activePanel: panel }));
  }, []);
  
  const placeAtTile = useCallback((x: number, y: number) => {
    setState(prev => {
      const tool = prev.selectedTool;
      if (tool === 'select' || tool === 'bulldoze') return prev;
      
      // Clone grid
      const newGrid = prev.grid.map(row => row.map(tile => ({ ...tile })));
      const tile = newGrid[y][x];
      
      // Don't build on water (except for some specific things)
      if (tile.terrain === 'water') return prev;
      
      // Get tool info for cost
      const toolInfo = TOOL_INFO[tool];
      if (!toolInfo) return prev;
      
      // Check if we can afford it
      if (prev.finances.cash < toolInfo.cost) return prev;
      
      // Handle path placement
      if (tool === 'path') {
        tile.path = true;
        tile.building = { ...createEmptyBuilding(), type: 'path' };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      // Handle queue placement
      if (tool === 'queue') {
        tile.queue = true;
        tile.building = { ...createEmptyBuilding(), type: 'queue' };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      const trackTools: Tool[] = [
        'coaster_build',
        'coaster_track',
        'coaster_turn_left',
        'coaster_turn_right',
        'coaster_slope_up',
        'coaster_slope_down',
        'coaster_loop',
      ];
      
      if (trackTools.includes(tool)) {
        const buildPath = prev.buildingCoasterPath;
        const lastTile = buildPath.length > 0 ? buildPath[buildPath.length - 1] : null;
        const deltaDir = lastTile ? directionFromDelta(x - lastTile.x, y - lastTile.y) : null;
        
        // For auto-build mode, require adjacency
        if (tool === 'coaster_build' && lastTile && !deltaDir) return prev;
        
        // Determine track directions
        const baseDirection = prev.buildingCoasterLastDirection ?? deltaDir ?? 'south';
        let startDirection: TrackDirection = baseDirection;
        let endDirection: TrackDirection = baseDirection;
        let pieceType: TrackPieceType = 'straight_flat';
        let startHeight = prev.buildingCoasterHeight;
        let endHeight = prev.buildingCoasterHeight;
        let chainLift = false;
        
        if (tool === 'coaster_turn_left') {
          pieceType = 'turn_left_flat';
          endDirection = rotateDirection(startDirection, 'left');
        } else if (tool === 'coaster_turn_right') {
          pieceType = 'turn_right_flat';
          endDirection = rotateDirection(startDirection, 'right');
        } else if (tool === 'coaster_slope_up') {
          pieceType = 'slope_up_small';
          endHeight = clampHeight(startHeight + 1);
          chainLift = true;
        } else if (tool === 'coaster_slope_down') {
          pieceType = 'slope_down_small';
          endHeight = clampHeight(startHeight - 1);
        } else if (tool === 'coaster_loop') {
          pieceType = 'loop_vertical';
        } else if (tool === 'coaster_build') {
          if (deltaDir) {
            startDirection = deltaDir;
            endDirection = deltaDir;
          }
          pieceType = 'straight_flat';
        } else {
          pieceType = 'straight_flat';
        }
        
        // Update previous tile for auto-build turns
        if (tool === 'coaster_build' && lastTile && prev.buildingCoasterLastDirection && deltaDir) {
          if (prev.buildingCoasterLastDirection !== deltaDir) {
            const turnType: TrackPieceType =
              rotateDirection(prev.buildingCoasterLastDirection, 'right') === deltaDir
                ? 'turn_right_flat'
                : 'turn_left_flat';
            const previousTile = newGrid[lastTile.y][lastTile.x];
            previousTile.trackPiece = {
              type: turnType,
              direction: prev.buildingCoasterLastDirection,
              startHeight: clampHeight(prev.buildingCoasterHeight),
              endHeight: clampHeight(prev.buildingCoasterHeight),
              bankAngle: 0,
              chainLift: false,
              boosted: false,
            };
            previousTile.hasCoasterTrack = true;
          }
        }
        
        const coasterId = prev.buildingCoasterId ?? generateUUID();
        const trackPiece: TrackPiece = {
          type: pieceType,
          direction: startDirection,
          startHeight: clampHeight(startHeight),
          endHeight: clampHeight(endHeight),
          bankAngle: 0,
          chainLift,
          boosted: false,
        };
        
        tile.trackPiece = trackPiece;
        tile.hasCoasterTrack = true;
        tile.coasterTrackId = coasterId;
        
        const updatedPath = buildPath.some(point => point.x === x && point.y === y)
          ? buildPath
          : [...buildPath, { x, y }];
        
        return {
          ...prev,
          grid: newGrid,
          finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost },
          buildingCoasterId: coasterId,
          buildingCoasterPath: updatedPath,
          buildingCoasterHeight: endHeight,
          buildingCoasterLastDirection: endDirection,
        };
      }
      
      // Map tools to building types (tool name is often the building type)
      const toolToBuildingType: Record<string, BuildingType> = {
        // Trees
        'tree_oak': 'tree_oak',
        'tree_maple': 'tree_maple',
        'tree_birch': 'tree_birch',
        'tree_elm': 'tree_elm',
        'tree_willow': 'tree_willow',
        'tree_pine': 'tree_pine',
        'tree_spruce': 'tree_spruce',
        'tree_fir': 'tree_fir',
        'tree_cedar': 'tree_cedar',
        'tree_redwood': 'tree_redwood',
        'tree_palm': 'tree_palm',
        'tree_banana': 'tree_banana',
        'tree_bamboo': 'tree_bamboo',
        'tree_coconut': 'tree_coconut',
        'tree_tropical': 'tree_tropical',
        'tree_cherry': 'tree_cherry',
        'tree_magnolia': 'tree_magnolia',
        'tree_dogwood': 'tree_dogwood',
        'tree_jacaranda': 'tree_jacaranda',
        'tree_wisteria': 'tree_wisteria',
        'bush_hedge': 'bush_hedge',
        'bush_flowering': 'bush_flowering',
        'topiary_ball': 'topiary_ball',
        'topiary_spiral': 'topiary_spiral',
        'topiary_animal': 'topiary_animal',
        'flowers_bed': 'flowers_bed',
        'flowers_planter': 'flowers_planter',
        'flowers_hanging': 'flowers_hanging',
        'flowers_wild': 'flowers_wild',
        'ground_cover': 'ground_cover',
        // Furniture
        'bench_wooden': 'bench_wooden',
        'bench_metal': 'bench_metal',
        'bench_ornate': 'bench_ornate',
        'bench_modern': 'bench_modern',
        'bench_rustic': 'bench_rustic',
        'lamp_victorian': 'lamp_victorian',
        'lamp_modern': 'lamp_modern',
        'lamp_themed': 'lamp_themed',
        'lamp_double': 'lamp_double',
        'lamp_pathway': 'lamp_pathway',
        'trash_can_basic': 'trash_can_basic',
        'trash_can_fancy': 'trash_can_fancy',
        'trash_can_themed': 'trash_can_themed',
        // Food
        'food_hotdog': 'food_hotdog',
        'food_burger': 'food_burger',
        'food_icecream': 'food_icecream',
        'food_cotton_candy': 'food_cotton_candy',
        'food_popcorn': 'snack_popcorn',
      };
      
      const buildingType = toolToBuildingType[tool];
      if (buildingType) {
        tile.building = { 
          ...createEmptyBuilding(), 
          type: buildingType,
          constructionProgress: 100,
        };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      return prev;
    });
  }, []);
  
  const bulldozeTile = useCallback((x: number, y: number) => {
    setState(prev => {
      const newGrid = prev.grid.map(row => row.map(tile => ({ ...tile })));
      const tile = newGrid[y][x];
      
      // Reset tile
      tile.building = createEmptyBuilding();
      tile.path = false;
      tile.queue = false;
      tile.queueRideId = null;
      tile.hasCoasterTrack = false;
      tile.coasterTrackId = null;
      tile.trackPiece = null;
      
      return { ...prev, grid: newGrid };
    });
  }, []);
  
  const startCoasterBuild = useCallback((coasterType: string) => {
    setState(prev => ({
      ...prev,
      buildingCoasterId: generateUUID(),
      buildingCoasterPath: [],
      buildingCoasterHeight: 0,
      buildingCoasterLastDirection: null,
    }));
  }, []);
  
  const addCoasterTrack = useCallback((x: number, y: number) => {
    placeAtTile(x, y);
  }, [placeAtTile]);
  
  const finishCoasterBuild = useCallback(() => {
    setState(prev => ({
      ...prev,
      buildingCoasterId: null,
      buildingCoasterPath: [],
      buildingCoasterHeight: 0,
      buildingCoasterLastDirection: null,
    }));
  }, []);
  
  const cancelCoasterBuild = useCallback(() => {
    setState(prev => ({
      ...prev,
      buildingCoasterId: null,
      buildingCoasterPath: [],
      buildingCoasterHeight: 0,
      buildingCoasterLastDirection: null,
    }));
  }, []);
  
  const setParkSettings = useCallback((settings: Partial<ParkSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  }, []);
  
  const addMoney = useCallback((amount: number) => {
    setState(prev => ({
      ...prev,
      finances: { ...prev.finances, cash: prev.finances.cash + amount },
    }));
  }, []);
  
  const addNotification = useCallback((title: string, description: string, icon: Notification['icon']) => {
    const notification: Notification = {
      id: generateUUID(),
      title,
      description,
      icon,
      timestamp: Date.now(),
    };
    
    setState(prev => ({
      ...prev,
      notifications: [notification, ...prev.notifications].slice(0, 50),
    }));
  }, []);
  
  const saveGame = useCallback(() => {
    try {
      const compressed = compressToUTF16(JSON.stringify(latestStateRef.current));
      localStorage.setItem(STORAGE_KEY, compressed);
      setHasSavedGame(true);
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }, []);
  
  const loadGame = useCallback((): boolean => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        let jsonString = decompressFromUTF16(saved);
        if (!jsonString || !jsonString.startsWith('{')) {
          if (saved.startsWith('{')) {
            jsonString = saved;
          } else {
            return false;
          }
        }
        
        const parsed = JSON.parse(jsonString);
        if (parsed && parsed.grid && parsed.gridSize) {
          setState(normalizeLoadedState(parsed));
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to load game:', e);
    }
    return false;
  }, []);
  
  const newGame = useCallback((name?: string) => {
    setState(createInitialGameState(name));
    setHasSavedGame(false);
  }, []);
  
  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================
  
  const value: CoasterContextValue = {
    state,
    latestStateRef,
    
    setTool,
    setSpeed,
    setActivePanel,
    
    placeAtTile,
    bulldozeTile,
    
    startCoasterBuild,
    addCoasterTrack,
    finishCoasterBuild,
    cancelCoasterBuild,
    
    setParkSettings,
    addMoney,
    addNotification,
    
    saveGame,
    loadGame,
    newGame,
    hasSavedGame,
    
    isStateReady,
  };
  
  return (
    <CoasterContext.Provider value={value}>
      {children}
    </CoasterContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useCoaster() {
  const context = useContext(CoasterContext);
  if (!context) {
    throw new Error('useCoaster must be used within a CoasterProvider');
  }
  return context;
}
