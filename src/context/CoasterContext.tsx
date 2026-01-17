/**
 * Coaster Tycoon Game Context
 * Manages all game state for the theme park simulation
 */
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import {
  CoasterGameState,
  ParkTile,
  TerrainType,
  CoasterTool,
  TOOL_INFO,
  Notification,
  SavedParkMeta,
  DEFAULT_GRID_SIZE,
  Finances,
  Research,
  ParkInfo,
  Weather,
  FinancialRecord,
} from '@/games/coaster/types/game';
import {
  Guest,
  Staff,
  createGuest,
  createStaff,
  StaffType,
} from '@/games/coaster/types/guests';
import {
  Ride,
  TrackPieceType,
  generateRideId,
  generateRideName,
  createEmptyStats,
} from '@/games/coaster/types/rides';
import {
  RideType,
  ShopType,
  Shop,
  SceneryType,
  RIDE_DEFINITIONS,
  SHOP_DEFINITIONS,
  SCENERY_DEFINITIONS,
  PathSurface,
} from '@/games/coaster/types/buildings';
import { calculateTrackEnd, canPlaceTrackPiece, calculateRideStats, TRACK_PIECES, isCircuitComplete } from '@/components/coaster/systems/trackBuilder';
import { updateAllGuests, processGuestInteractions } from '@/components/coaster/systems/guestAI';
import { updateRides } from '@/components/coaster/systems/rideSystem';

// Storage keys
const STORAGE_KEY = 'coaster-game-state';
const SAVED_PARKS_INDEX_KEY = 'coaster-saved-parks-index';
const SAVED_PARK_PREFIX = 'coaster-park-';

// =============================================================================
// CONTEXT VALUE TYPE
// =============================================================================

interface CoasterContextValue {
  state: CoasterGameState;
  latestStateRef: React.RefObject<CoasterGameState>;
  
  // Tool management
  setTool: (tool: CoasterTool) => void;
  setSelectedRideType: (rideType: RideType | undefined) => void;
  setSelectedShopType: (shopType: ShopType | undefined) => void;
  setSelectedSceneryType: (sceneryType: SceneryType | undefined) => void;
  
  // Game speed
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  
  // Panel management
  setActivePanel: (panel: CoasterGameState['activePanel']) => void;
  
  // Building actions
  placeAtTile: (x: number, y: number) => void;
  bulldozeTile: (x: number, y: number) => void;
  placePath: (x: number, y: number, surface: PathSurface, isQueue: boolean, rideId?: string) => void;
  placeRide: (x: number, y: number, rideType: RideType) => void;
  placeShop: (x: number, y: number, shopType: ShopType) => void;
  placeScenery: (x: number, y: number, sceneryType: SceneryType) => void;
  
  // Terrain actions
  raiseTerrain: (x: number, y: number) => void;
  lowerTerrain: (x: number, y: number) => void;
  
  // Ride management
  openRide: (rideId: string) => void;
  closeRide: (rideId: string) => void;
  setRidePrice: (rideId: string, price: number) => void;
  renameRide: (rideId: string, name: string) => void;
  startTrackBuild: (rideId: string) => void;
  stopTrackBuild: () => void;
  addTrackPiece: (piece: TrackPieceType) => void;
  undoTrackPiece: () => void;
  setSelectedTrackPiece: (piece?: TrackPieceType) => void;
  
  // Staff management
  hireStaff: (type: StaffType, x: number, y: number) => void;
  fireStaff: (staffId: number) => void;
  
  // Park management
  setParkEntranceFee: (fee: number) => void;
  setParkName: (name: string) => void;
  
  // Finances
  takeLoan: (amount: number) => void;
  repayLoan: (amount: number) => void;
  
  // Game lifecycle
  newPark: (name?: string, size?: number) => void;
  loadState: (stateString: string) => boolean;
  exportState: () => string;
  
  // Persistence
  hasExistingGame: boolean;
  isStateReady: boolean;
  isSaving: boolean;
  savedParks: SavedParkMeta[];
  savePark: () => void;
  loadSavedPark: (parkId: string) => boolean;
  deleteSavedPark: (parkId: string) => void;
  
  // Notifications
  addNotification: (title: string, message: string, type: Notification['type']) => void;
  dismissNotification: (id: string) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const CoasterContext = createContext<CoasterContextValue | null>(null);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function createEmptyFinancialRecord(year: number, month: number): FinancialRecord {
  return {
    year,
    month,
    parkEntranceFees: 0,
    rideTickets: 0,
    shopSales: 0,
    facilityUsage: 0,
    rideRunning: 0,
    shopRunning: 0,
    staffWages: 0,
    marketing: 0,
    research: 0,
    loanInterest: 0,
    construction: 0,
    totalIncome: 0,
    totalExpenses: 0,
    profit: 0,
  };
}

function createInitialFinances(): Finances {
  return {
    cash: 10000,
    loan: 0,
    maxLoan: 100000,
    loanInterestRate: 10,
    parkValue: 0,
    companyValue: 10000,
    currentMonthRecord: createEmptyFinancialRecord(1, 3), // March Year 1
    history: [],
  };
}

function createInitialResearch(): Research {
  return {
    currentItem: undefined,
    progress: 0,
    funding: 0,
    unlockedRides: [
      // Start with basic rides unlocked
      'carousel',
      'ferris_wheel',
      'spiral_slide',
      'merry_go_round',
      'dodgems',
      'swinging_ship',
      'junior_coaster',
      'wooden_coaster',
      'log_flume',
      'miniature_railway',
    ],
    unlockedShops: [
      'burger_stall',
      'drink_stall',
      'ice_cream_stall',
      'balloon_stall',
      'information_kiosk',
      'restrooms',
    ],
    unlockedScenery: [
      'tree_oak',
      'tree_pine',
      'bush',
      'flower_bed',
      'bench',
      'trash_bin',
      'lamp_post',
      'fence_wood',
    ],
    priorities: ['roller_coasters', 'thrill_rides', 'gentle_rides', 'water_rides', 'shops', 'scenery', 'transport'],
  };
}

function createInitialParkInfo(name: string, gridSize: number): ParkInfo {
  const center = Math.floor(gridSize / 2);
  return {
    name,
    entranceX: center,
    entranceY: gridSize - 2,
    entranceFee: 10,
    openingHour: 8,
    closingHour: 22,
    isOpen: true,
    parkRating: 0,
    parkRatingHistory: [],
  };
}

function createInitialWeather(): Weather {
  return {
    current: 'sunny',
    temperature: 20,
    windSpeed: 10,
  };
}

function createInitialTile(x: number, y: number, owned: boolean): ParkTile {
  return {
    x,
    y,
    terrain: 'grass',
    height: 0,
    owned,
    forSale: !owned,
    purchasePrice: owned ? 0 : 100,
  };
}

function createInitialGrid(size: number): ParkTile[][] {
  const grid: ParkTile[][] = [];
  const parkRadius = Math.floor(size * 0.35); // 35% of grid is initially owned
  const center = Math.floor(size / 2);
  
  for (let y = 0; y < size; y++) {
    const row: ParkTile[] = [];
    for (let x = 0; x < size; x++) {
      // Calculate if this tile is within the initial park area
      const distFromCenter = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));
      const owned = distFromCenter <= parkRadius;
      
      row.push(createInitialTile(x, y, owned));
    }
    grid.push(row);
  }
  
  return grid;
}

function createInitialGameState(size: number = DEFAULT_GRID_SIZE, parkName: string = 'My Theme Park'): CoasterGameState {
  const parkInfo = createInitialParkInfo(parkName, size);
  const center = Math.floor(size / 2);
  const parkRadius = Math.floor(size * 0.35);
  
  // Place park entrance
  const grid = createInitialGrid(size);
  const entranceY = parkInfo.entranceY;
  const entranceX = parkInfo.entranceX;
  
  // Mark entrance tile
  if (grid[entranceY] && grid[entranceY][entranceX]) {
    grid[entranceY][entranceX].building = {
      type: 'park_entrance',
      orientation: 0,
    };
    grid[entranceY][entranceX].owned = true;
    
    // Add path from entrance into park
    for (let py = entranceY - 1; py >= 0; py--) {
      if (grid[py] && grid[py][entranceX]) {
        const distFromCenter = Math.sqrt(
          Math.pow(entranceX - center, 2) + Math.pow(py - center, 2)
        );
        const reachedPark = distFromCenter <= parkRadius;

        grid[py][entranceX].owned = true;
        grid[py][entranceX].forSale = false;
        grid[py][entranceX].purchasePrice = 0;
        grid[py][entranceX].path = {
          surface: 'tarmac',
          type: 'standard',
          connections: {
            north: !reachedPark,
            south: true,
            east: false,
            west: false,
          },
          litter: 0,
          vomit: false,
        };

        if (reachedPark) {
          break;
        }
      }
    }
  }
  
  return {
    id: generateUUID(),
    grid,
    gridSize: size,
    year: 1,
    month: 3, // March
    day: 1,
    hour: 8,
    minute: 0,
    tick: 0,
    speed: 1,
    park: parkInfo,
    weather: createInitialWeather(),
    guests: [],
    staff: [],
    rides: [],
    shops: [],
    finances: createInitialFinances(),
    research: createInitialResearch(),
    activeCampaigns: [],
    awards: [],
    selectedTool: 'select',
    selectedRideType: undefined,
    selectedShopType: undefined,
    selectedSceneryType: undefined,
    trackBuildRideId: undefined,
    selectedTrackPiece: undefined,
    trackBuildError: undefined,
    activePanel: 'none',
    notifications: [],
    gameVersion: 1,
  };
}

// =============================================================================
// LOAD / SAVE FUNCTIONS
// =============================================================================

function loadGameState(): CoasterGameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      let jsonString = decompressFromUTF16(saved);
      if (!jsonString || !jsonString.startsWith('{')) {
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }
      
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.grid && parsed.gridSize && parsed.park) {
        if (!parsed.shops) parsed.shops = [];
        if (!parsed.selectedShopType) parsed.selectedShopType = undefined;
        if (!parsed.trackBuildRideId) parsed.trackBuildRideId = undefined;
        if (!parsed.selectedTrackPiece) parsed.selectedTrackPiece = undefined;
        if (!parsed.trackBuildError) parsed.trackBuildError = undefined;
        return parsed as CoasterGameState;
      }
    }
  } catch (e) {
    console.error('Failed to load coaster game state:', e);
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

async function saveGameStateAsync(state: CoasterGameState): Promise<void> {
  if (typeof window === 'undefined') return;
  
  if (!state || !state.grid || !state.gridSize || !state.park) {
    console.error('Invalid coaster game state, cannot save');
    return;
  }
  
  try {
    const jsonString = JSON.stringify(state);
    const compressed = compressToUTF16(jsonString);
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (e) {
    console.error('Failed to save coaster game state:', e);
  }
}

function loadSavedParksIndex(): SavedParkMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_PARKS_INDEX_KEY);
    if (saved) {
      return JSON.parse(saved) as SavedParkMeta[];
    }
  } catch (e) {
    console.error('Failed to load saved parks index:', e);
  }
  return [];
}

function saveSavedParksIndex(parks: SavedParkMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_PARKS_INDEX_KEY, JSON.stringify(parks));
  } catch (e) {
    console.error('Failed to save parks index:', e);
  }
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export function CoasterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CoasterGameState>(() => createInitialGameState());
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  
  const hasLoadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const stateChangedRef = useRef(false);
  const guestIdRef = useRef(0);
  const staffIdRef = useRef(0);
  
  // Load state on mount
  useEffect(() => {
    const saved = loadGameState();
    if (saved) {
      skipNextSaveRef.current = true;
      setState(saved);
      setHasExistingGame(true);
      
      // Find highest guest/staff IDs
      guestIdRef.current = Math.max(0, ...saved.guests.map(g => g.id)) + 1;
      staffIdRef.current = Math.max(0, ...saved.staff.map(s => s.id)) + 1;
    }
    
    setSavedParks(loadSavedParksIndex());
    hasLoadedRef.current = true;
    setIsStateReady(true);
  }, []);
  
  // Mark state as changed when it updates
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    stateChangedRef.current = true;
  }, [state]);
  
  // Auto-save interval
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (!stateChangedRef.current) return;
      
      stateChangedRef.current = false;
      setIsSaving(true);
      
      saveGameStateAsync(latestStateRef.current).then(() => {
        setHasExistingGame(true);
        setIsSaving(false);
      });
    }, 5000);
    
    return () => clearInterval(saveInterval);
  }, []);
  
  // Simulation loop
  useEffect(() => {
    if (state.speed === 0) return;
    
    const interval = state.speed === 1 ? 500 : state.speed === 2 ? 250 : 100;
    
    const timer = setInterval(() => {
      setState(prev => simulateTick(prev));
    }, interval);
    
    return () => clearInterval(timer);
  }, [state.speed]);
  
  // =============================================================================
  // SIMULATION
  // =============================================================================
  
  const simulateTick = useCallback((prev: CoasterGameState): CoasterGameState => {
    let next = { ...prev, tick: prev.tick + 1 };
    
    // Advance time
    next.minute += 1;
    if (next.minute >= 60) {
      next.minute = 0;
      next.hour += 1;
      
      if (next.hour >= 24) {
        next.hour = 0;
        next.day += 1;
        
        // Month progression
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (next.day > daysInMonth[next.month - 1]) {
          next.day = 1;
          next.month += 1;
          
          if (next.month > 12) {
            next.month = 1;
            next.year += 1;
          }
          
          // Monthly financial update
          next = processMonthlyFinances(next);
        }
      }
    }
    
    // Guest spawning (during open hours)
    if (next.hour >= next.park.openingHour && next.hour < next.park.closingHour) {
      if (next.tick % 10 === 0 && next.guests.length < 100) {
        // Spawn rate based on park rating
        const spawnChance = 0.3 + (next.park.parkRating / 999) * 0.5;
        if (Math.random() < spawnChance) {
          const newGuest = createGuest(
            guestIdRef.current++,
            next.park.entranceX,
            next.park.entranceY
          );
          newGuest.cash -= next.park.entranceFee;
          next.finances.cash += next.park.entranceFee;
          next.finances.currentMonthRecord.parkEntranceFees += next.park.entranceFee;
          next.guests = [...next.guests, newGuest];
        }
      }
    }
    
    // Update park rating
    if (next.tick % 100 === 0) {
      next = updateParkRating(next);
    }
    
    // Update guests using AI system
    next.guests = updateAllGuests(next);

    // Process guest interactions (shops, queues)
    next = processGuestInteractions(next);

    // Update ride operations
    next = updateRides(next);
    
    return next;
  }, []);
  
  const processMonthlyFinances = useCallback((state: CoasterGameState): CoasterGameState => {
    const next = { ...state };
    const record = { ...next.finances.currentMonthRecord };
    
    // Calculate staff wages
    record.staffWages = next.staff.reduce((sum, s) => sum + s.salary, 0);

    // Calculate running costs based on open hours
    const openHoursPerDay = Math.max(0, next.park.closingHour - next.park.openingHour);
    const hoursInMonth = openHoursPerDay * 30;
    record.rideRunning = next.rides.reduce((sum, ride) => {
      if (ride.status !== 'open') return sum;
      const def = RIDE_DEFINITIONS[ride.type];
      return sum + (def?.runningCostPerHour ?? 0) * hoursInMonth;
    }, 0);

    record.shopRunning = next.shops.reduce((sum, shop) => {
      if (shop.status !== 'open') return sum;
      return sum + shop.runningCostPerHour * hoursInMonth;
    }, 0);
    
    // Calculate totals
    record.totalIncome = record.parkEntranceFees + record.rideTickets + record.shopSales + record.facilityUsage;
    record.totalExpenses = record.rideRunning + record.shopRunning + record.staffWages + 
                           record.marketing + record.research + record.loanInterest + record.construction;
    record.profit = record.totalIncome - record.totalExpenses;
    
    // Apply to cash
    next.finances.cash += record.profit;
    
    // Save to history
    next.finances.history = [...next.finances.history, record];
    if (next.finances.history.length > 24) {
      next.finances.history = next.finances.history.slice(-24);
    }
    
    // Start new month
    next.finances.currentMonthRecord = createEmptyFinancialRecord(next.year, next.month);
    
    return next;
  }, []);
  
  const updateParkRating = useCallback((state: CoasterGameState): CoasterGameState => {
    const next = { ...state };
    
    // Rating factors
    let rating = 500; // Base rating
    
    // Guest happiness contribution
    if (next.guests.length > 0) {
      const avgHappiness = next.guests.reduce((sum, g) => sum + g.happiness, 0) / next.guests.length;
      rating += (avgHappiness / 255) * 300;
    }
    
    // Ride variety
    rating += Math.min(next.rides.filter(r => r.status === 'open').length * 20, 150);
    
    // Cleanliness (simplified)
    rating += 50; // Placeholder
    
    // Clamp to 0-999
    next.park.parkRating = Math.max(0, Math.min(999, Math.floor(rating)));
    
    return next;
  }, []);
  
  // =============================================================================
  // ACTIONS
  // =============================================================================
  
  const setTool = useCallback((tool: CoasterTool) => {
    setState(prev => ({ ...prev, selectedTool: tool }));
  }, []);
  
  const setSelectedRideType = useCallback((rideType: RideType | undefined) => {
    setState(prev => ({ ...prev, selectedRideType: rideType }));
  }, []);
  
  const setSelectedShopType = useCallback((shopType: ShopType | undefined) => {
    setState(prev => ({ ...prev, selectedShopType: shopType }));
  }, []);

  const setSelectedSceneryType = useCallback((sceneryType: SceneryType | undefined) => {
    setState(prev => ({ ...prev, selectedSceneryType: sceneryType }));
  }, []);
  
  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState(prev => ({ ...prev, speed }));
  }, []);
  
  const setActivePanel = useCallback((panel: CoasterGameState['activePanel']) => {
    setState(prev => ({ ...prev, activePanel: panel }));
  }, []);
  
  const placePath = useCallback((x: number, y: number, surface: PathSurface, isQueue: boolean, rideId?: string) => {
    setState(prev => {
      const tile = prev.grid[y]?.[x];
      if (!tile || !tile.owned || tile.building) return prev;
      
      const cost = TOOL_INFO[isQueue ? 'path_queue' : 'path_standard'].cost;
      if (prev.finances.cash < cost) return prev;
      
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));
      newGrid[y][x].path = {
        surface,
        type: isQueue ? 'queue' : 'standard',
        connections: { north: false, east: false, south: false, west: false },
        queueRideId: rideId,
        litter: 0,
        vomit: false,
      };
      
      // Update connections
      const updateConnections = (tx: number, ty: number) => {
        const t = newGrid[ty]?.[tx];
        if (!t?.path) return;
        t.path.connections = {
          north: !!newGrid[ty - 1]?.[tx]?.path,
          south: !!newGrid[ty + 1]?.[tx]?.path,
          east: !!newGrid[ty]?.[tx + 1]?.path,
          west: !!newGrid[ty]?.[tx - 1]?.path,
        };
      };
      
      updateConnections(x, y);
      updateConnections(x - 1, y);
      updateConnections(x + 1, y);
      updateConnections(x, y - 1);
      updateConnections(x, y + 1);
      
      return {
        ...prev,
        grid: newGrid,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - cost,
          currentMonthRecord: {
            ...prev.finances.currentMonthRecord,
            construction: prev.finances.currentMonthRecord.construction + cost,
          },
        },
      };
    });
  }, []);
  
  const placeRide = useCallback((x: number, y: number, rideType: RideType) => {
    setState(prev => {
      const def = RIDE_DEFINITIONS[rideType];
      if (!def) return prev;
      
      // Check if we can afford it
      if (prev.finances.cash < def.buildCost) return prev;
      
      // Check if the area is clear and owned
      for (let dy = 0; dy < def.size.height; dy++) {
        for (let dx = 0; dx < def.size.width; dx++) {
          const tile = prev.grid[y + dy]?.[x + dx];
          if (!tile || !tile.owned || tile.building || tile.path) return prev;
        }
      }
      
      const rideId = generateRideId();
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));
      
      // Mark tiles as occupied
      const rideTiles: { x: number; y: number }[] = [];
      for (let dy = 0; dy < def.size.height; dy++) {
        for (let dx = 0; dx < def.size.width; dx++) {
          newGrid[y + dy][x + dx].building = {
            type: rideType,
            rideId,
            orientation: 0,
          };
          rideTiles.push({ x: x + dx, y: y + dy });
        }
      }
      
      // Create the ride
      const newRide: Ride = {
        id: rideId,
        type: rideType,
        name: generateRideName(rideType),
        customName: false,
        entranceX: x,
        entranceY: y + def.size.height,
        exitX: x + def.size.width - 1,
        exitY: y + def.size.height,
        track: [],
        tiles: rideTiles,
        status: def.isTracked ? 'building' : 'open',
        operatingMode: 'normal',
        trains: [],
        numTrains: 1,
        carsPerTrain: def.defaultCapacity,
        queuePath: [],
        queueLength: 0,
        maxQueueLength: 100,
        guestsInQueue: [],
        guestsOnRide: [],
        cycleTimer: 0,
        isRunning: false,
        stats: createEmptyStats(),
        price: 2,
        minWaitTime: 30,
        maxWaitTime: 60,
        inspectionInterval: 60,
        lastInspection: 0,
        totalRiders: 0,
        totalRevenue: 0,
        buildCost: def.buildCost,
        age: 0,
        reliability: 100,
        downtime: 0,
        breakdowns: 0,
      };
      
      return {
        ...prev,
        grid: newGrid,
        rides: [...prev.rides, newRide],
        trackBuildRideId: def.isTracked ? rideId : prev.trackBuildRideId,
        selectedTrackPiece: def.isTracked ? 'station' : prev.selectedTrackPiece,
        trackBuildError: undefined,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - def.buildCost,
          currentMonthRecord: {
            ...prev.finances.currentMonthRecord,
            construction: prev.finances.currentMonthRecord.construction + def.buildCost,
          },
        },
      };
    });
  }, []);

  const placeShop = useCallback((x: number, y: number, shopType: ShopType) => {
    setState(prev => {
      const def = SHOP_DEFINITIONS[shopType];
      if (!def) return prev;

      if (prev.finances.cash < def.buildCost) return prev;

      // Check if the area is clear and owned
      for (let dy = 0; dy < def.size.height; dy++) {
        for (let dx = 0; dx < def.size.width; dx++) {
          const tile = prev.grid[y + dy]?.[x + dx];
          if (!tile || !tile.owned || tile.building || tile.path) return prev;
        }
      }

      const shopId = generateUUID();
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));

      // Mark tiles as occupied
      for (let dy = 0; dy < def.size.height; dy++) {
        for (let dx = 0; dx < def.size.width; dx++) {
          newGrid[y + dy][x + dx].building = {
            type: shopType,
            shopId,
            orientation: 0,
          };
        }
      }

      const newShop: Shop = {
        id: shopId,
        type: shopType,
        name: def.name,
        x,
        y,
        status: 'open',
        price: def.defaultPrice,
        totalSales: 0,
        totalRevenue: 0,
        runningCostPerHour: def.runningCostPerHour,
      };

      return {
        ...prev,
        grid: newGrid,
        shops: [...prev.shops, newShop],
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - def.buildCost,
          currentMonthRecord: {
            ...prev.finances.currentMonthRecord,
            construction: prev.finances.currentMonthRecord.construction + def.buildCost,
          },
        },
      };
    });
  }, []);
  
  const placeScenery = useCallback((x: number, y: number, sceneryType: SceneryType) => {
    setState(prev => {
      const def = SCENERY_DEFINITIONS[sceneryType];
      if (!def) return prev;
      
      const tile = prev.grid[y]?.[x];
      if (!tile || !tile.owned || tile.building) return prev;
      if (prev.finances.cash < def.buildCost) return prev;
      
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));
      newGrid[y][x].building = {
        type: sceneryType,
        orientation: 0,
      };
      
      return {
        ...prev,
        grid: newGrid,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - def.buildCost,
          currentMonthRecord: {
            ...prev.finances.currentMonthRecord,
            construction: prev.finances.currentMonthRecord.construction + def.buildCost,
          },
        },
      };
    });
  }, []);
  
  const bulldozeTile = useCallback((x: number, y: number) => {
    setState(prev => {
      const tile = prev.grid[y]?.[x];
      if (!tile || (!tile.building && !tile.path)) return prev;
      
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));
      
      // Remove building
      if (tile.building) {
        // If it's part of a ride, remove the whole ride
        if (tile.building.rideId) {
          const ride = prev.rides.find(r => r.id === tile.building?.rideId);
          if (ride) {
            ride.tiles.forEach(({ x: tx, y: ty }) => {
              if (newGrid[ty]?.[tx]) {
                newGrid[ty][tx].building = undefined;
              }
            });
          }
          return {
            ...prev,
            grid: newGrid,
            rides: prev.rides.filter(r => r.id !== tile.building?.rideId),
          };
        }

        // If it's a shop, remove the whole shop footprint
        const shopType = tile.building.type as ShopType;
        if (SHOP_DEFINITIONS[shopType]) {
          const shopId = tile.building.shopId;
          if (shopId) {
            for (let ty = 0; ty < prev.gridSize; ty++) {
              for (let tx = 0; tx < prev.gridSize; tx++) {
                if (newGrid[ty]?.[tx]?.building?.shopId === shopId) {
                  newGrid[ty][tx].building = undefined;
                }
              }
            }
          } else {
            newGrid[y][x].building = undefined;
          }
          return {
            ...prev,
            grid: newGrid,
            shops: prev.shops.filter(shop => shop.id !== shopId && !(shop.x === x && shop.y === y)),
          };
        }
        
        newGrid[y][x].building = undefined;
      }
      
      // Remove path
      if (tile.path) {
        newGrid[y][x].path = undefined;
        
        // Update neighboring connections
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
          const neighbor = newGrid[y + dy]?.[x + dx];
          if (neighbor?.path) {
            neighbor.path.connections = {
              north: !!newGrid[y + dy - 1]?.[x + dx]?.path,
              south: !!newGrid[y + dy + 1]?.[x + dx]?.path,
              east: !!newGrid[y + dy]?.[x + dx + 1]?.path,
              west: !!newGrid[y + dy]?.[x + dx - 1]?.path,
            };
          }
        });
      }
      
      return { ...prev, grid: newGrid };
    });
  }, []);
  
  const placeAtTile = useCallback((x: number, y: number) => {
    const tool = latestStateRef.current.selectedTool;
    
    switch (tool) {
      case 'path_standard':
        placePath(x, y, 'tarmac', false);
        break;
      case 'path_queue':
        placePath(x, y, 'tarmac', true);
        break;
      case 'bulldoze':
        bulldozeTile(x, y);
        break;
      case 'place_ride':
        if (latestStateRef.current.selectedRideType) {
          placeRide(x, y, latestStateRef.current.selectedRideType);
        }
        break;
      case 'place_shop':
        if (latestStateRef.current.selectedShopType) {
          placeShop(x, y, latestStateRef.current.selectedShopType);
        }
        break;
      case 'place_scenery':
        if (latestStateRef.current.selectedSceneryType) {
          placeScenery(x, y, latestStateRef.current.selectedSceneryType);
        }
        break;
      case 'terrain_raise':
        raiseTerrain(x, y);
        break;
      case 'terrain_lower':
        lowerTerrain(x, y);
        break;
    }
  }, [placePath, bulldozeTile, placeRide, placeShop, placeScenery]);
  
  const raiseTerrain = useCallback((x: number, y: number) => {
    setState(prev => {
      const tile = prev.grid[y]?.[x];
      if (!tile || !tile.owned || tile.height >= 15) return prev;
      if (prev.finances.cash < TOOL_INFO.terrain_raise.cost) return prev;
      
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));
      newGrid[y][x].height += 1;
      
      return {
        ...prev,
        grid: newGrid,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - TOOL_INFO.terrain_raise.cost,
        },
      };
    });
  }, []);
  
  const lowerTerrain = useCallback((x: number, y: number) => {
    setState(prev => {
      const tile = prev.grid[y]?.[x];
      if (!tile || !tile.owned || tile.height <= 0) return prev;
      if (prev.finances.cash < TOOL_INFO.terrain_lower.cost) return prev;
      
      const newGrid = prev.grid.map(row => row.map(t => ({ ...t })));
      newGrid[y][x].height -= 1;
      
      return {
        ...prev,
        grid: newGrid,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - TOOL_INFO.terrain_lower.cost,
        },
      };
    });
  }, []);
  
  const openRide = useCallback((rideId: string) => {
    setState(prev => ({
      ...prev,
      rides: prev.rides.map(r => r.id === rideId ? { ...r, status: 'open' as const } : r),
    }));
  }, []);
  
  const closeRide = useCallback((rideId: string) => {
    setState(prev => ({
      ...prev,
      rides: prev.rides.map(r => r.id === rideId ? { ...r, status: 'closed' as const } : r),
    }));
  }, []);
  
  const setRidePrice = useCallback((rideId: string, price: number) => {
    setState(prev => ({
      ...prev,
      rides: prev.rides.map(r => r.id === rideId ? { ...r, price } : r),
    }));
  }, []);
  
  const renameRide = useCallback((rideId: string, name: string) => {
    setState(prev => ({
      ...prev,
      rides: prev.rides.map(r => r.id === rideId ? { ...r, name, customName: true } : r),
    }));
  }, []);

  const startTrackBuild = useCallback((rideId: string) => {
    setState(prev => ({
      ...prev,
      trackBuildRideId: rideId,
      selectedTrackPiece: 'station',
      trackBuildError: undefined,
    }));
  }, []);

  const stopTrackBuild = useCallback(() => {
    setState(prev => ({
      ...prev,
      trackBuildRideId: undefined,
      selectedTrackPiece: undefined,
      trackBuildError: undefined,
    }));
  }, []);

  const setSelectedTrackPiece = useCallback((piece?: TrackPieceType) => {
    setState(prev => ({
      ...prev,
      selectedTrackPiece: piece,
      trackBuildError: undefined,
    }));
  }, []);

  const addTrackPiece = useCallback((piece: TrackPieceType) => {
    setState(prev => {
      if (!prev.trackBuildRideId) return prev;
      const rideIndex = prev.rides.findIndex(r => r.id === prev.trackBuildRideId);
      if (rideIndex < 0) return prev;

      const ride = prev.rides[rideIndex];
      const def = RIDE_DEFINITIONS[ride.type];
      if (!def?.isTracked) {
        return { ...prev, trackBuildError: 'Track building is only available for tracked rides.' };
      }

      const newTrack = [...ride.track];
      if (newTrack.length === 0 && piece !== 'station') {
        return { ...prev, trackBuildError: 'Track must start with a station.' };
      }

      let nextElement: { type: TrackPieceType; x: number; y: number; height: number; direction: 0 | 1 | 2 | 3 } | null = null;

      if (newTrack.length === 0) {
        const tileHeight = prev.grid[ride.entranceY]?.[ride.entranceX]?.height ?? 0;
        nextElement = {
          type: piece,
          x: ride.entranceX,
          y: Math.max(0, ride.entranceY - 1),
          height: tileHeight,
          direction: 0,
        };
      } else {
        const last = newTrack[newTrack.length - 1];
        const lastDef = TRACK_PIECES[last.type];
        if (!lastDef) return prev;
        const end = calculateTrackEnd(last, lastDef);
        const validation = canPlaceTrackPiece(newTrack, piece, end.x, end.y, end.height, end.direction, prev.gridSize);
        if (!validation.valid) {
          return { ...prev, trackBuildError: validation.error ?? 'Invalid track placement' };
        }
        nextElement = {
          type: piece,
          x: end.x,
          y: end.y,
          height: end.height,
          direction: end.direction,
        };
      }

      if (!nextElement) return prev;
      newTrack.push(nextElement);

      const updatedRide: Ride = {
        ...ride,
        track: newTrack,
        stats: def.category === 'coaster' ? calculateRideStats(newTrack, ride.type as any) : ride.stats,
        status: isCircuitComplete(newTrack) ? 'open' : ride.status,
      };

      const newRides = [...prev.rides];
      newRides[rideIndex] = updatedRide;

      return {
        ...prev,
        rides: newRides,
        trackBuildError: undefined,
      };
    });
  }, []);

  const undoTrackPiece = useCallback(() => {
    setState(prev => {
      if (!prev.trackBuildRideId) return prev;
      const rideIndex = prev.rides.findIndex(r => r.id === prev.trackBuildRideId);
      if (rideIndex < 0) return prev;

      const ride = prev.rides[rideIndex];
      if (ride.track.length === 0) return prev;

      const newTrack = ride.track.slice(0, -1);
      const updatedRide: Ride = {
        ...ride,
        track: newTrack,
        status: newTrack.length === 0 ? 'building' : ride.status,
      };

      const newRides = [...prev.rides];
      newRides[rideIndex] = updatedRide;

      return {
        ...prev,
        rides: newRides,
        trackBuildError: undefined,
      };
    });
  }, []);
  
  const hireStaff = useCallback((type: StaffType, x: number, y: number) => {
    setState(prev => {
      const staff = createStaff(staffIdRef.current++, type, x, y);
      return {
        ...prev,
        staff: [...prev.staff, staff],
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - 500, // Hiring bonus
        },
      };
    });
  }, []);
  
  const fireStaff = useCallback((staffId: number) => {
    setState(prev => ({
      ...prev,
      staff: prev.staff.filter(s => s.id !== staffId),
    }));
  }, []);
  
  const setParkEntranceFee = useCallback((fee: number) => {
    setState(prev => ({
      ...prev,
      park: { ...prev.park, entranceFee: Math.max(0, fee) },
    }));
  }, []);
  
  const setParkName = useCallback((name: string) => {
    setState(prev => ({
      ...prev,
      park: { ...prev.park, name },
    }));
  }, []);
  
  const takeLoan = useCallback((amount: number) => {
    setState(prev => {
      const maxLoanable = prev.finances.maxLoan - prev.finances.loan;
      const actualAmount = Math.min(amount, maxLoanable);
      return {
        ...prev,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash + actualAmount,
          loan: prev.finances.loan + actualAmount,
        },
      };
    });
  }, []);
  
  const repayLoan = useCallback((amount: number) => {
    setState(prev => {
      const actualAmount = Math.min(amount, prev.finances.loan, prev.finances.cash);
      return {
        ...prev,
        finances: {
          ...prev.finances,
          cash: prev.finances.cash - actualAmount,
          loan: prev.finances.loan - actualAmount,
        },
      };
    });
  }, []);
  
  const newPark = useCallback((name?: string, size?: number) => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = createInitialGameState(size ?? DEFAULT_GRID_SIZE, name || 'My Theme Park');
    setState(fresh);
    guestIdRef.current = 0;
    staffIdRef.current = 0;
  }, []);
  
  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      if (parsed && parsed.grid && parsed.gridSize && parsed.park) {
        if (!parsed.shops) parsed.shops = [];
        if (!parsed.selectedShopType) parsed.selectedShopType = undefined;
        if (!parsed.trackBuildRideId) parsed.trackBuildRideId = undefined;
        if (!parsed.selectedTrackPiece) parsed.selectedTrackPiece = undefined;
        if (!parsed.trackBuildError) parsed.trackBuildError = undefined;
        skipNextSaveRef.current = true;
        setState(parsed as CoasterGameState);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);
  
  const exportState = useCallback((): string => {
    return JSON.stringify(state);
  }, [state]);
  
  const savePark = useCallback(() => {
    const parkMeta: SavedParkMeta = {
      id: state.id,
      parkName: state.park.name,
      guestCount: state.guests.length,
      cash: state.finances.cash,
      parkRating: state.park.parkRating,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };
    
    // Save the park state
    const jsonString = JSON.stringify(state);
    const compressed = compressToUTF16(jsonString);
    localStorage.setItem(SAVED_PARK_PREFIX + state.id, compressed);
    
    // Update the index
    setSavedParks(prev => {
      const existingIndex = prev.findIndex(p => p.id === state.id);
      let newParks: SavedParkMeta[];
      
      if (existingIndex >= 0) {
        newParks = [...prev];
        newParks[existingIndex] = parkMeta;
      } else {
        newParks = [parkMeta, ...prev];
      }
      
      newParks.sort((a, b) => b.savedAt - a.savedAt);
      saveSavedParksIndex(newParks);
      return newParks;
    });
  }, [state]);
  
  const loadSavedPark = useCallback((parkId: string): boolean => {
    try {
      const saved = localStorage.getItem(SAVED_PARK_PREFIX + parkId);
      if (!saved) return false;
      
      let jsonString = decompressFromUTF16(saved);
      if (!jsonString || !jsonString.startsWith('{')) {
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          return false;
        }
      }
      
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.grid && parsed.gridSize && parsed.park) {
        if (!parsed.shops) parsed.shops = [];
        if (!parsed.selectedShopType) parsed.selectedShopType = undefined;
        if (!parsed.trackBuildRideId) parsed.trackBuildRideId = undefined;
        if (!parsed.selectedTrackPiece) parsed.selectedTrackPiece = undefined;
        if (!parsed.trackBuildError) parsed.trackBuildError = undefined;
        skipNextSaveRef.current = true;
        setState(parsed as CoasterGameState);
        saveGameStateAsync(parsed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);
  
  const deleteSavedPark = useCallback((parkId: string) => {
    localStorage.removeItem(SAVED_PARK_PREFIX + parkId);
    setSavedParks(prev => {
      const newParks = prev.filter(p => p.id !== parkId);
      saveSavedParksIndex(newParks);
      return newParks;
    });
  }, []);
  
  const addNotification = useCallback((title: string, message: string, type: Notification['type']) => {
    setState(prev => ({
      ...prev,
      notifications: [
        {
          id: `notif-${Date.now()}-${Math.random()}`,
          type,
          title,
          message,
          timestamp: Date.now(),
          read: false,
        },
        ...prev.notifications.slice(0, 19),
      ],
    }));
  }, []);
  
  const dismissNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  }, []);
  
  // =============================================================================
  // CONTEXT VALUE
  // =============================================================================
  
  const value: CoasterContextValue = {
    state,
    latestStateRef,
    setTool,
    setSelectedRideType,
    setSelectedShopType,
    setSelectedSceneryType,
    setSpeed,
    setActivePanel,
    placeAtTile,
    bulldozeTile,
    placePath,
    placeRide,
    placeShop,
    placeScenery,
    raiseTerrain,
    lowerTerrain,
    openRide,
    closeRide,
    setRidePrice,
    renameRide,
    startTrackBuild,
    stopTrackBuild,
    addTrackPiece,
    undoTrackPiece,
    setSelectedTrackPiece,
    hireStaff,
    fireStaff,
    setParkEntranceFee,
    setParkName,
    takeLoan,
    repayLoan,
    newPark,
    loadState,
    exportState,
    hasExistingGame,
    isStateReady,
    isSaving,
    savedParks,
    savePark,
    loadSavedPark,
    deleteSavedPark,
    addNotification,
    dismissNotification,
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
  const ctx = useContext(CoasterContext);
  if (!ctx) {
    throw new Error('useCoaster must be used within a CoasterProvider');
  }
  return ctx;
}
