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

function createDefaultTrain(): CoasterTrain {
  const car: CoasterCar = {
    trackProgress: 0,
    velocity: 0.015,
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    screenX: 0,
    screenY: 0,
    screenZ: 0,
    guests: [],
  };
  
  return {
    id: generateUUID(),
    cars: [car],
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
              const nextProgress = (car.trackProgress + car.velocity * deltaTime) % trackLength;
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
        
        const trackEntries = updatedPath
          .map(point => {
            const piece = newGrid[point.y][point.x].trackPiece;
            return piece ? { point, piece } : null;
          })
          .filter((entry): entry is { point: { x: number; y: number }; piece: TrackPiece } => Boolean(entry));
        const trackPieces = trackEntries.map(entry => entry.piece);
        const trackTiles = trackEntries.map(entry => entry.point);
        
        const coasterIndex = prev.coasters.findIndex(coaster => coaster.id === coasterId);
        const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
        const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, updatedPath[0]);
        const coaster: Coaster = {
          ...coasterBase,
          track: trackPieces,
          trackTiles,
          trains: coasterBase.trains.length > 0 ? coasterBase.trains : [createDefaultTrain()],
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
