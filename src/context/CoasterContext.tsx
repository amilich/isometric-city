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
import { Coaster, CoasterTrain, CoasterCar, TrackDirection, TrackHeight, TrackPiece, TrackPieceType } from '@/games/coaster/types/tracks';
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
  
  // Track line placement (for drag-to-draw)
  placeTrackLine: (tiles: { x: number; y: number }[]) => void;
  
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
    coasters: state.coasters.map(coaster => ({
      ...coaster,
      trackTiles: coaster.trackTiles ?? [],
      // Regenerate trains with updated car configuration
      trains: coaster.trains.length > 0 
        ? coaster.trains.map(() => createDefaultTrain())
        : [createDefaultTrain()],
    })),
    guests: state.guests.map(guest => ({
      ...guest,
      lastState: guest.lastState ?? guest.state,
      queueTimer: guest.queueTimer ?? 0,
      decisionCooldown: guest.decisionCooldown ?? 0,
      targetBuildingId: guest.targetBuildingId ?? null,
      targetBuildingKind: guest.targetBuildingKind ?? null,
    })),
    buildingCoasterId: state.buildingCoasterId ?? null,
    buildingCoasterPath: state.buildingCoasterPath ?? [],
    buildingCoasterHeight: state.buildingCoasterHeight ?? 0,
    buildingCoasterLastDirection: state.buildingCoasterLastDirection ?? null,
  };
}

function isRideBuilding(type: string) {
  return type.startsWith('ride_') || type.startsWith('show_') || type.startsWith('station_');
}

function calculateMonthlyUpkeep(grid: Tile[][]): { upkeep: number; buildingCount: number; rideCount: number; trackCount: number } {
  let buildingCount = 0;
  let rideCount = 0;
  let trackCount = 0;
  
  for (const row of grid) {
    for (const tile of row) {
      if (tile.trackPiece) trackCount += 1;
      const type = tile.building?.type;
      if (!type || type === 'empty' || type === 'grass' || type === 'water' || type === 'path' || type === 'queue') {
        continue;
      }
      buildingCount += 1;
      if (isRideBuilding(type)) rideCount += 1;
    }
  }
  
  const upkeep = buildingCount * 5 + rideCount * 20 + trackCount * 2;
  return { upkeep, buildingCount, rideCount, trackCount };
}

function calculateStaffWages(staff: Staff[]): number {
  const wageMap: Record<Staff['type'], number> = {
    handyman: DEFAULT_PRICES.handymanWage,
    mechanic: DEFAULT_PRICES.mechanicWage,
    security: DEFAULT_PRICES.securityWage,
    entertainer: DEFAULT_PRICES.entertainerWage,
  };
  return staff.reduce((sum, member) => sum + (wageMap[member.type] ?? 0), 0);
}

/**
 * Get the exit direction for a track piece.
 * For straight pieces, exit direction = entry direction.
 * For curves, exit direction is rotated based on turn type.
 */
function getExitDirection(piece: TrackPiece): TrackDirection {
  const { type, direction } = piece;
  
  if (type === 'turn_right_flat') {
    // Right turn: north->east, east->south, south->west, west->north
    const rightTurn: Record<TrackDirection, TrackDirection> = {
      north: 'east', east: 'south', south: 'west', west: 'north'
    };
    return rightTurn[direction];
  }
  
  if (type === 'turn_left_flat') {
    // Left turn: north->west, west->south, south->east, east->north
    const leftTurn: Record<TrackDirection, TrackDirection> = {
      north: 'west', west: 'south', south: 'east', east: 'north'
    };
    return leftTurn[direction];
  }
  
  // Straight pieces, slopes, loops - exit in same direction
  return direction;
}

/**
 * Get the grid offset to the next tile based on direction.
 * In our isometric grid:
 * - North: x-1, y unchanged (moving up-left visually)
 * - South: x+1, y unchanged (moving down-right visually)  
 * - East: y-1, x unchanged (moving up-right visually)
 * - West: y+1, x unchanged (moving down-left visually)
 */
function getDirectionOffset(dir: TrackDirection): { dx: number; dy: number } {
  const offsets: Record<TrackDirection, { dx: number; dy: number }> = {
    north: { dx: -1, dy: 0 },
    south: { dx: 1, dy: 0 },
    east: { dx: 0, dy: -1 },
    west: { dx: 0, dy: 1 },
  };
  return offsets[dir];
}

/**
 * Collect all track tiles for a coaster from the grid.
 * Returns tiles in connected order following the track direction.
 */
function collectCoasterTrack(grid: Tile[][], coasterId: string): { tiles: { x: number; y: number }[]; pieces: TrackPiece[] } {
  const gridSize = grid.length;
  const allTrackTiles: { x: number; y: number; piece: TrackPiece }[] = [];
  
  // First, collect all tiles with this coaster's track
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.coasterTrackId === coasterId && tile.trackPiece) {
        allTrackTiles.push({ x, y, piece: tile.trackPiece });
      }
    }
  }
  
  if (allTrackTiles.length === 0) {
    return { tiles: [], pieces: [] };
  }
  
  // Order the tiles by following track connections
  const visited = new Set<string>();
  const orderedTiles: { x: number; y: number }[] = [];
  const orderedPieces: TrackPiece[] = [];
  
  // Start from the first tile found
  let current = allTrackTiles[0];
  
  while (current && !visited.has(`${current.x},${current.y}`)) {
    visited.add(`${current.x},${current.y}`);
    orderedTiles.push({ x: current.x, y: current.y });
    orderedPieces.push(current.piece);
    
    // Find the next tile based on exit direction
    const exitDir = getExitDirection(current.piece);
    const offset = getDirectionOffset(exitDir);
    const nx = current.x + offset.dx;
    const ny = current.y + offset.dy;
    const key = `${nx},${ny}`;
    
    let found = false;
    if (!visited.has(key)) {
      const next = allTrackTiles.find(t => t.x === nx && t.y === ny);
      if (next) {
        current = next;
        found = true;
      }
    }
    
    // If primary direction didn't work, try all adjacent unvisited tiles
    if (!found) {
      const adjacentOffsets = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      ];
      
      for (const { dx, dy } of adjacentOffsets) {
        const adjX = current.x + dx;
        const adjY = current.y + dy;
        const adjKey = `${adjX},${adjY}`;
        
        if (!visited.has(adjKey)) {
          const next = allTrackTiles.find(t => t.x === adjX && t.y === adjY);
          if (next) {
            current = next;
            found = true;
            break;
          }
        }
      }
    }
    
    if (!found) break;
  }
  
  return { tiles: orderedTiles, pieces: orderedPieces };
}

function createDefaultTrain(): CoasterTrain {
  // Create multiple cars for a realistic train
  const numCars = 6;
  const carSpacing = 0.18; // Spacing between cars - smaller value keeps cars closer together
  const baseVelocity = 0.03;
  
  const cars: CoasterCar[] = [];
  for (let i = 0; i < numCars; i++) {
    // Use positive offset - lead car is ahead, trailing cars follow behind at increasing offsets
    // On a circular track, a car at offset 0.18 is 0.18 tiles behind the car at offset 0
    cars.push({
      trackProgress: i * carSpacing,
      velocity: baseVelocity,
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      screenX: 0,
      screenY: 0,
      screenZ: 0,
      guests: [],
    });
  }

  return {
    id: generateUUID(),
    cars,
    state: 'running',
    stateTimer: 0,
  };
}

function createDefaultCoaster(id: string, startTile: { x: number; y: number }): Coaster {
  return {
    id,
    name: 'Custom Coaster',
    type: 'steel_sit_down',
    color: { primary: '#dc2626', secondary: '#f59e0b', supports: '#374151' },
    track: [],
    trackTiles: [],
    stationTileX: startTile.x,
    stationTileY: startTile.y,
    trains: [createDefaultTrain()],
    operating: true,
    broken: false,
    excitement: 0,
    intensity: 0,
    nausea: 0,
    ridersTotal: 0,
    income: 0,
    upkeep: 0,
  };
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export function CoasterProvider({ children, startFresh = false }: { children: React.ReactNode; startFresh?: boolean }) {
  const [state, setState] = useState<GameState>(() => createInitialGameState());
  const [isStateReady, setIsStateReady] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const latestStateRef = useRef<GameState>(state);
  
  // Keep ref in sync
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);
  
  // Load saved game on mount (unless startFresh is true)
  useEffect(() => {
    const checkSaved = () => {
      if (typeof window === 'undefined') return;
      
      // If startFresh, skip loading saved game and just start fresh
      if (startFresh) {
        setIsStateReady(true);
        return;
      }
      
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
  }, [startFresh]);
  
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
        const spawnedGuestsRaw = spawnGuests(prev.grid, updatedGuests, prev.stats.parkRating, hour);
        const entranceFee = prev.settings.payPerRide ? 0 : prev.settings.entranceFee;
        const admissionRevenue = spawnedGuestsRaw.reduce((sum, guest) => sum + Math.min(guest.cash, entranceFee), 0);
        const spawnedGuests = spawnedGuestsRaw.map(guest => {
          const fee = Math.min(guest.cash, entranceFee);
          return {
            ...guest,
            cash: guest.cash - fee,
            totalSpent: guest.totalSpent + fee,
          };
        });

        const rideTicket = prev.settings.payPerRide ? DEFAULT_PRICES.rideTicket : 0;
        let rideRevenue = 0;
        let foodRevenue = 0;
        let shopRevenue = 0;
        let rideCompletions = 0;
        const guests = updatedGuests.map(guest => {
          let nextGuest = guest;

          if (guest.state === 'riding' && guest.lastState === 'queuing' && rideTicket > 0) {
            const fee = Math.min(guest.cash, rideTicket);
            if (fee > 0) {
              rideRevenue += fee;
              nextGuest = { ...nextGuest, cash: nextGuest.cash - fee, totalSpent: nextGuest.totalSpent + fee };
            }
          }

          if (guest.state === 'eating' && guest.lastState !== 'eating') {
            const price = guest.thirst > guest.hunger ? DEFAULT_PRICES.drinkItem : DEFAULT_PRICES.foodItem;
            const fee = Math.min(nextGuest.cash, price);
            if (fee > 0) {
              foodRevenue += fee;
              nextGuest = { ...nextGuest, cash: nextGuest.cash - fee, totalSpent: nextGuest.totalSpent + fee };
            }
          }

          if (guest.state === 'shopping' && guest.lastState !== 'shopping') {
            const fee = Math.min(nextGuest.cash, DEFAULT_PRICES.shopItem);
            if (fee > 0) {
              shopRevenue += fee;
              nextGuest = { ...nextGuest, cash: nextGuest.cash - fee, totalSpent: nextGuest.totalSpent + fee };
            }
          }

          if (guest.state === 'walking' && guest.lastState === 'riding') {
            rideCompletions += 1;
          }

          return nextGuest;
        }).concat(spawnedGuests);

        
        const guestsInPark = guests.length;
        const guestsSatisfied = guests.filter(guest => guest.happiness >= 70).length;
        const guestsUnsatisfied = guests.filter(guest => guest.happiness <= 40).length;
        const avgHappiness = guestsInPark > 0
          ? guests.reduce((sum, guest) => sum + guest.happiness, 0) / guestsInPark
          : 0;
        
        const parkRating = Math.min(1000, Math.round(avgHappiness * 10));

        // Update coaster trains
        const updatedCoasters = prev.coasters.map(coaster => {
          if (coaster.track.length === 0 || coaster.trains.length === 0) return coaster;
          const trackLength = coaster.track.length;
          
          const updatedTrains = coaster.trains.map(train => {
            const updatedCars = train.cars.map(car => {
              let nextProgress = car.trackProgress + car.velocity * deltaTime;
              // Properly wrap around for both positive and negative values
              nextProgress = nextProgress % trackLength;
              if (nextProgress < 0) nextProgress += trackLength;
              return { ...car, trackProgress: nextProgress };
            });
            return { ...train, cars: updatedCars };
          });
          
          return { ...coaster, trains: updatedTrains };
        });
        
        const incomeAdmissions = prev.finances.incomeAdmissions + admissionRevenue;
        const incomeRides = prev.finances.incomeRides + rideRevenue;
        const incomeFood = prev.finances.incomeFood + foodRevenue;
        const incomeShops = prev.finances.incomeShops + shopRevenue;
        const incomeTotal = incomeAdmissions + incomeRides + incomeFood + incomeShops;
        const expenseTotal = prev.finances.expenseWages + prev.finances.expenseUpkeep + prev.finances.expenseMarketing + prev.finances.expenseResearch;
        const profit = incomeTotal - expenseTotal;

        const monthChanged = month !== prev.month || year !== prev.year;
        let finances = {
          ...prev.finances,
          cash: prev.finances.cash + admissionRevenue + rideRevenue + foodRevenue + shopRevenue,
          incomeAdmissions,
          incomeRides,
          incomeFood,
          incomeShops,
          incomeTotal,
          expenseTotal,
          profit,
        };

        if (monthChanged) {
          const { upkeep } = calculateMonthlyUpkeep(prev.grid);
          const wages = calculateStaffWages(prev.staff);
          const monthlyExpenses = upkeep + wages + prev.finances.expenseMarketing + prev.finances.expenseResearch;
          const monthlyProfit = incomeTotal - monthlyExpenses;

          finances = {
            ...prev.finances,
            cash: prev.finances.cash + admissionRevenue + rideRevenue + foodRevenue + shopRevenue - monthlyExpenses,
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
            history: [
              ...prev.finances.history,
              {
                month: prev.month,
                year: prev.year,
                income: incomeTotal,
                expenses: monthlyExpenses,
                profit: monthlyProfit,
                guests: guestsInPark,
                parkValue: prev.stats.parkValue,
              },
            ].slice(-24),
          };
        }

        return {
          ...prev,
          tick: newTick,
          minute,
          hour,
          day,
          month,
          year,
          guests,
          coasters: updatedCoasters,
          stats: {
            ...prev.stats,
            guestsInPark,
            guestsTotal: prev.stats.guestsTotal + spawnedGuests.length,
            guestsSatisfied,
            guestsUnsatisfied,
            averageHappiness: avgHappiness,
            parkRating,
            totalRidesRidden: prev.stats.totalRidesRidden + rideCompletions,
          },
          finances,
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
        
        // ALWAYS check for adjacent existing track to inherit direction and height
        // This is the most reliable way to connect to existing track
        let adjacentDirection: TrackDirection | null = null;
        let adjacentHeight = prev.buildingCoasterHeight;
        let connectingToEntry = false; // True if we're feeding INTO adjacent track's entry
        let targetEntryHeight = 0; // The height we need our exit to be at when connecting to entry
        
        const adjacentOffsets = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        
        for (const { dx, dy } of adjacentOffsets) {
          const adjX = x + dx;
          const adjY = y + dy;
          if (adjX >= 0 && adjY >= 0 && adjX < prev.gridSize && adjY < prev.gridSize) {
            const adjTile = prev.grid[adjY]?.[adjX];
            if (adjTile?.trackPiece) {
              const adjPiece = adjTile.trackPiece;
              
              // Calculate entry and exit directions for the adjacent piece
              // Entry is always the side the track comes FROM (opposite of direction)
              // Exit is where the track goes TO (direction for straights, rotated for turns)
              const oppositeDir: Record<TrackDirection, TrackDirection> = {
                north: 'south', south: 'north', east: 'west', west: 'east'
              };
              
              // All tracks enter from the opposite side of their direction
              // direction 'south' means heading south, so entering from north
              const entryDir = oppositeDir[adjPiece.direction];
              
              // Exit direction depends on track type
              let exitDir = adjPiece.direction;
              if (adjPiece.type === 'turn_left_flat') {
                exitDir = rotateDirection(adjPiece.direction, 'left');
              } else if (adjPiece.type === 'turn_right_flat') {
                exitDir = rotateDirection(adjPiece.direction, 'right');
              }
              
              // Check if adjacent track's EXIT points toward us (we connect to receive from it)
              // Adjacent is at (x + dx, y + dy) relative to our new tile at (x, y)
              const exitPointsToUs = (
                (exitDir === 'south' && dx === -1) ||
                (exitDir === 'north' && dx === 1) ||
                (exitDir === 'west' && dy === -1) ||
                (exitDir === 'east' && dy === 1)
              );
              
              // Check if adjacent track's ENTRY points toward us (we connect to feed into it)
              const entryPointsToUs = (
                (entryDir === 'south' && dx === -1) ||
                (entryDir === 'north' && dx === 1) ||
                (entryDir === 'west' && dy === -1) ||
                (entryDir === 'east' && dy === 1)
              );
              
              if (exitPointsToUs) {
                // Adjacent track exits toward us - we continue in that direction
                // Our startHeight should match their endHeight
                adjacentDirection = exitDir;
                adjacentHeight = adjPiece.endHeight;
                connectingToEntry = false;
                targetEntryHeight = adjPiece.startHeight; // In case we need it
                break;
              } else if (entryPointsToUs) {
                // Adjacent track's entry is toward us - we feed into it
                // Our endHeight should match their startHeight
                adjacentDirection = oppositeDir[entryDir];
                adjacentHeight = adjPiece.startHeight; // This is what our END height needs to be
                connectingToEntry = true;
                targetEntryHeight = adjPiece.startHeight;
                break;
              }
            }
          }
        }
        
        // Determine track directions
        // Priority: adjacentDirection (from existing track) > deltaDir (from drag) > lastDirection > default
        const baseDirection = adjacentDirection ?? deltaDir ?? prev.buildingCoasterLastDirection ?? 'south';
        let startDirection: TrackDirection = baseDirection;
        let endDirection: TrackDirection = baseDirection;
        let pieceType: TrackPieceType = 'straight_flat';
        let startHeight = adjacentHeight;
        let endHeight = adjacentHeight;
        let chainLift = false;
        
        if (tool === 'coaster_turn_left') {
          pieceType = 'turn_left_flat';
          // For turns, the drawing code interprets direction as "entering FROM" (not traveling TO)
          if (adjacentDirection) {
            if (connectingToEntry) {
              // Feeding into adjacent's entry - our EXIT must go toward adjacent
              // adjacentDirection is where we need to exit TO
              // For turn_left: exit = rotateDirection(entry, 'left')
              // So: entry = rotateDirection(exit, 'right')
              startDirection = rotateDirection(adjacentDirection, 'right');
            } else {
              // Receiving from adjacent's exit - we enter FROM the opposite of where they're going
              const oppositeDir: Record<TrackDirection, TrackDirection> = {
                north: 'south', south: 'north', east: 'west', west: 'east'
              };
              startDirection = oppositeDir[adjacentDirection];
            }
          }
          endDirection = rotateDirection(startDirection, 'left');
        } else if (tool === 'coaster_turn_right') {
          pieceType = 'turn_right_flat';
          if (adjacentDirection) {
            if (connectingToEntry) {
              // For turn_right: exit = rotateDirection(entry, 'right')
              // So: entry = rotateDirection(exit, 'left')
              startDirection = rotateDirection(adjacentDirection, 'left');
            } else {
              const oppositeDir: Record<TrackDirection, TrackDirection> = {
                north: 'south', south: 'north', east: 'west', west: 'east'
              };
              startDirection = oppositeDir[adjacentDirection];
            }
          }
          endDirection = rotateDirection(startDirection, 'right');
        } else if (tool === 'coaster_slope_up') {
          pieceType = 'slope_up_small';
          if (connectingToEntry) {
            // Our exit needs to match adjacent's entry height
            // For slope_up: endHeight = startHeight + 1
            // So: startHeight = targetEntryHeight - 1
            endHeight = targetEntryHeight;
            startHeight = clampHeight(targetEntryHeight - 1);
          } else {
            endHeight = clampHeight(startHeight + 1);
          }
          chainLift = true; // Chain lift pulls coaster UP
        } else if (tool === 'coaster_slope_down') {
          pieceType = 'slope_down_small';
          if (connectingToEntry) {
            // Our exit needs to match adjacent's entry height
            // For slope_down: endHeight = startHeight - 1
            // So: startHeight = targetEntryHeight + 1
            endHeight = targetEntryHeight;
            startHeight = clampHeight(targetEntryHeight + 1);
          } else {
            endHeight = clampHeight(startHeight - 1);
          }
          chainLift = false; // No chain on downward slopes - gravity does the work
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
        
        // Collect ALL track tiles for this coaster from the grid (not just building path)
        const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);
        
        const coasterIndex = prev.coasters.findIndex(coaster => coaster.id === coasterId);
        const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
        const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, trackTiles[0] || { x, y });
        
        // Only create fresh train if this is a new coaster or track changed significantly
        const needsNewTrain = !existingCoaster || existingCoaster.track.length !== trackPieces.length;
        const coaster: Coaster = {
          ...coasterBase,
          track: trackPieces,
          trackTiles,
          trains: needsNewTrain ? [createDefaultTrain()] : coasterBase.trains,
        };
        
        const updatedCoasters = [...prev.coasters];
        if (coasterIndex >= 0) {
          updatedCoasters[coasterIndex] = coaster;
        } else {
          updatedCoasters.push(coaster);
        }
        
        return {
          ...prev,
          grid: newGrid,
          finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost },
          buildingCoasterId: coasterId,
          buildingCoasterPath: updatedPath,
          buildingCoasterHeight: endHeight,
          buildingCoasterLastDirection: endDirection,
          coasters: updatedCoasters,
        };
      }
      
      // Map tools to building types (tool name is often the building type)
      const toolToBuildingType: Record<string, BuildingType | BuildingType[]> = {
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
        // Shops
        'shop_souvenir': ['shop_souvenir_1', 'shop_souvenir_2'],
        'shop_toys': 'shop_toys',
        'shop_photo': 'shop_photo',
        'restroom': 'restroom',
        'first_aid': 'first_aid',
        // Rides
        'ride_carousel': 'ride_carousel',
        'ride_teacups': 'ride_teacups',
        'ride_ferris_wheel': ['ride_ferris_classic', 'ride_ferris_modern', 'ride_ferris_led'],
        'ride_drop_tower': 'ride_drop_tower',
        'ride_swing_ride': 'ride_swing_ride',
        'ride_bumper_cars': 'ride_bumper_cars',
        'ride_go_karts': 'ride_go_karts',
        'ride_haunted_house': 'ride_haunted_house',
        'ride_log_flume': 'ride_log_flume',
        // Coaster stations
        'coaster_station': ['station_wooden_1', 'station_steel_1', 'station_inverted_1', 'station_water_1'],
        // Infrastructure
        'park_entrance': 'infra_main_entrance',
        'staff_building': 'infra_office',
      };
      
      const buildingEntry = toolToBuildingType[tool];
      const buildingType = Array.isArray(buildingEntry)
        ? buildingEntry[Math.floor(Math.random() * buildingEntry.length)]
        : buildingEntry;
      
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
      
      // Check if we're bulldozing track and get the coaster ID
      const hadTrack = tile.hasCoasterTrack || tile.trackPiece;
      const coasterId = tile.coasterTrackId;
      
      // Reset tile
      tile.building = createEmptyBuilding();
      tile.path = false;
      tile.queue = false;
      tile.queueRideId = null;
      tile.hasCoasterTrack = false;
      tile.coasterTrackId = null;
      tile.trackPiece = null;
      
      // If track was demolished, update the coaster's track arrays
      let updatedCoasters = prev.coasters;
      if (hadTrack && coasterId) {
        // Recollect all track for this coaster from the updated grid
        const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);
        
        updatedCoasters = prev.coasters.map(coaster => {
          if (coaster.id === coasterId) {
            return {
              ...coaster,
              track: trackPieces,
              trackTiles,
            };
          }
          return coaster;
        });
      }
      
      // If track was demolished, reset the coaster building state
      if (hadTrack) {
        return { 
          ...prev, 
          grid: newGrid,
          coasters: updatedCoasters,
          buildingCoasterHeight: 0,
          buildingCoasterLastDirection: null,
          buildingCoasterPath: [],
        };
      }
      
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
  
  // Place a line of track tiles (for drag-to-draw functionality)
  const placeTrackLine = useCallback((tiles: { x: number; y: number }[]) => {
    if (tiles.length === 0) return;
    
    setState(prev => {
      const newGrid = prev.grid.map(row => row.map(tile => ({ ...tile })));
      const coasterId = prev.buildingCoasterId ?? generateUUID();
      let currentHeight = prev.buildingCoasterHeight;
      let lastDirection: TrackDirection | null = prev.buildingCoasterLastDirection;
      const updatedPath = [...prev.buildingCoasterPath];
      
      // If continuing from existing path, inherit height from the last track piece
      if (updatedPath.length > 0) {
        const lastPathTile = updatedPath[updatedPath.length - 1];
        const lastTrackPiece = prev.grid[lastPathTile.y]?.[lastPathTile.x]?.trackPiece;
        if (lastTrackPiece) {
          currentHeight = lastTrackPiece.endHeight;
          lastDirection = lastTrackPiece.direction;
        }
      }
      
      // Also check if first tile we're placing is adjacent to existing track
      if (tiles.length > 0 && updatedPath.length === 0) {
        const firstTile = tiles[0];
        // Check all 4 adjacent tiles for existing track
        const adjacentOffsets = [
          { dx: -1, dy: 0, fromDir: 'west' as TrackDirection },
          { dx: 1, dy: 0, fromDir: 'east' as TrackDirection },
          { dx: 0, dy: -1, fromDir: 'north' as TrackDirection },
          { dx: 0, dy: 1, fromDir: 'south' as TrackDirection },
        ];
        for (const { dx, dy, fromDir } of adjacentOffsets) {
          const adjX = firstTile.x + dx;
          const adjY = firstTile.y + dy;
          if (adjX >= 0 && adjY >= 0 && adjX < prev.gridSize && adjY < prev.gridSize) {
            const adjTile = prev.grid[adjY]?.[adjX];
            if (adjTile?.trackPiece) {
              currentHeight = adjTile.trackPiece.endHeight;
              
              // Determine the exit direction of the adjacent track piece
              const adjPiece = adjTile.trackPiece;
              let exitDir = adjPiece.direction;
              
              // For turns, calculate the actual exit direction
              if (adjPiece.type === 'turn_left_flat') {
                exitDir = rotateDirection(adjPiece.direction, 'left');
              } else if (adjPiece.type === 'turn_right_flat') {
                exitDir = rotateDirection(adjPiece.direction, 'right');
              }
              
              // Check if this adjacent track's exit points toward us
              // Adjacent is at (x + dx, y + dy) relative to our tile at (x, y)
              // dx = -1 means adjacent is north of us (at x-1), so it should exit 'south' to point toward us
              // dx = 1 means adjacent is south of us (at x+1), so it should exit 'north' to point toward us
              // dy = -1 means adjacent is east of us (at y-1), so it should exit 'west' to point toward us
              // dy = 1 means adjacent is west of us (at y+1), so it should exit 'east' to point toward us
              const exitPointsToUs = (
                (exitDir === 'south' && dx === -1) ||
                (exitDir === 'north' && dx === 1) ||
                (exitDir === 'west' && dy === -1) ||
                (exitDir === 'east' && dy === 1)
              );
              
              if (exitPointsToUs) {
                // We should continue in the OPPOSITE direction (away from the adjacent track)
                // If adjacent exits west toward us, we continue west (same direction)
                lastDirection = exitDir;
                break;
              }
            }
          }
        }
      }
      
      for (let i = 0; i < tiles.length; i++) {
        const { x, y } = tiles[i];
        
        // Skip if out of bounds
        if (x < 0 || y < 0 || x >= prev.gridSize || y >= prev.gridSize) continue;
        
        // Skip if already has track
        const tile = newGrid[y][x];
        if (tile.hasCoasterTrack) continue;
        
        // Determine direction from previous tile
        let direction: TrackDirection = lastDirection ?? 'south';
        if (i > 0) {
          const prev = tiles[i - 1];
          const dx = x - prev.x;
          const dy = y - prev.y;
          if (dx === 1 && dy === 0) direction = 'east';
          else if (dx === -1 && dy === 0) direction = 'west';
          else if (dx === 0 && dy === 1) direction = 'south';
          else if (dx === 0 && dy === -1) direction = 'north';
        } else if (updatedPath.length > 0) {
          const prevTile = updatedPath[updatedPath.length - 1];
          const dx = x - prevTile.x;
          const dy = y - prevTile.y;
          if (dx === 1 && dy === 0) direction = 'east';
          else if (dx === -1 && dy === 0) direction = 'west';
          else if (dx === 0 && dy === 1) direction = 'south';
          else if (dx === 0 && dy === -1) direction = 'north';
        }
        
        // Determine track piece type
        let pieceType: TrackPieceType = 'straight_flat';
        
        // Check if we need a turn from the previous direction
        if (lastDirection && lastDirection !== direction) {
          // Update the PREVIOUS tile to be a turn
          const prevTileCoord = i > 0 ? tiles[i - 1] : updatedPath[updatedPath.length - 1];
          if (prevTileCoord) {
            const prevTile = newGrid[prevTileCoord.y]?.[prevTileCoord.x];
            if (prevTile && prevTile.trackPiece) {
              // Determine turn type based on direction change
              const turnType: TrackPieceType = 
                rotateDirection(lastDirection, 'right') === direction
                  ? 'turn_right_flat'
                  : 'turn_left_flat';
              prevTile.trackPiece = {
                ...prevTile.trackPiece,
                type: turnType,
              };
            }
          }
        }
        
        // Create track piece for current tile
        const trackPiece: TrackPiece = {
          type: pieceType,
          direction: direction,
          startHeight: clampHeight(currentHeight),
          endHeight: clampHeight(currentHeight),
          bankAngle: 0,
          chainLift: false,
          boosted: false,
        };
        
        tile.trackPiece = trackPiece;
        tile.hasCoasterTrack = true;
        tile.coasterTrackId = coasterId;
        
        updatedPath.push({ x, y });
        lastDirection = direction;
      }
      
      // Collect ALL track tiles for this coaster from the grid (not just building path)
      const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);
      
      const coasterIndex = prev.coasters.findIndex(c => c.id === coasterId);
      const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
      const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, trackTiles[0] || tiles[0]);
      
      // Only create fresh train if this is a new coaster or track changed significantly
      const needsNewTrain = !existingCoaster || existingCoaster.track.length !== trackPieces.length;
      const coaster: Coaster = {
        ...coasterBase,
        track: trackPieces,
        trackTiles,
        trains: needsNewTrain ? [createDefaultTrain()] : coasterBase.trains,
      };
      
      const updatedCoasters = [...prev.coasters];
      if (coasterIndex >= 0) {
        updatedCoasters[coasterIndex] = coaster;
      } else {
        updatedCoasters.push(coaster);
      }
      
      return {
        ...prev,
        grid: newGrid,
        buildingCoasterId: coasterId,
        buildingCoasterPath: updatedPath,
        buildingCoasterHeight: currentHeight,
        buildingCoasterLastDirection: lastDirection,
        coasters: updatedCoasters,
      };
    });
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
    placeTrackLine,

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
