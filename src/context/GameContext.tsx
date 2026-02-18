// Consolidated GameContext for the SimCity-like game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { serializeAndCompressAsync } from '@/lib/saveWorkerManager';
import { simulateTick } from '@/lib/simulation';
import {
  Budget,
  BuildingType,
  GameState,
  SavedCityMeta,
  Tool,
  TOOL_INFO,
  ZoneType,
} from '@/types/game';
import {
  bulldozeTile,
  createInitialGameState,
  DEFAULT_GRID_SIZE,
  expandGrid,
  shrinkGrid,
  placeBuilding,
  placeSubway,
  placeWaterTerraform,
  placeLandTerraform,
  checkForDiscoverableCities,
  generateRandomAdvancedCity,
  createBridgesOnPath,
  upgradeServiceBuilding,
} from '@/lib/simulation';
import {
  SPRITE_PACKS,
  DEFAULT_SPRITE_PACK_ID,
  getSpritePack,
  setActiveSpritePack,
  SpritePack,
} from '@/lib/renderConfig';

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITY_STORAGE_KEY = 'isocity-saved-city'; // For restoring after viewing shared city
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index'; // Index of all saved cities
const SAVED_CITY_PREFIX = 'isocity-city-'; // Prefix for individual saved city states
const SPRITE_PACK_STORAGE_KEY = 'isocity-sprite-pack';
const DAY_NIGHT_MODE_STORAGE_KEY = 'isocity-day-night-mode';

export type DayNightMode = 'auto' | 'day' | 'night';

// Info about a saved city (for restore functionality)
export type SavedCityInfo = {
  cityName: string;
  population: number;
  money: number;
  savedAt: number;
} | null;

// Custom building data for placement
export interface CustomBuildingData {
  id: string;
  name: string;
  spriteUrl: string;
  size: 1 | 2 | 3 | 4;
  cost: number;
  stats: {
    maxPop: number;
    maxJobs: number;
    pollution: number;
    landValue: number;
  };
}

type GameContextValue = {
  state: GameState;
  // PERF: Ref to latest state for real-time access without React re-renders
  // Canvas should use this instead of state.grid for smooth updates
  latestStateRef: React.RefObject<GameState>;
  setTool: (tool: Tool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setTaxRate: (rate: number) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  setBudgetFunding: (key: keyof Budget, funding: number) => void;
  upgradeServiceBuilding: (x: number, y: number) => boolean; // Returns true if upgrade succeeded
  placeAtTile: (x: number, y: number, isRemote?: boolean) => void;
  placeCustomBuilding: (x: number, y: number, customBuilding: CustomBuildingData) => boolean; // Returns true if placed
  setPlaceCallback: (callback: ((args: { x: number; y: number; tool: Tool }) => void) | null) => void;
  finishTrackDrag: (pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote?: boolean) => void; // Create bridges after road/rail drag
  setBridgeCallback: (callback: ((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null) => void;
  connectToCity: (cityId: string) => void;
  discoverCity: (cityId: string) => void;
  checkAndDiscoverCities: (onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void) => void;
  setDisastersEnabled: (enabled: boolean) => void;
  newGame: (name?: string, size?: number) => void;
  loadState: (stateString: string) => boolean;
  exportState: () => string;
  generateRandomCity: () => void;
  expandCity: () => void;
  shrinkCity: () => boolean;
  hasExistingGame: boolean;
  isStateReady: boolean; // True when initial state loading is complete
  isSaving: boolean;
  addMoney: (amount: number) => void;
  addNotification: (title: string, description: string, icon: string) => void;
  // Sprite pack management
  currentSpritePack: SpritePack;
  availableSpritePacks: SpritePack[];
  setSpritePack: (packId: string) => void;
  // Day/night mode override
  dayNightMode: DayNightMode;
  setDayNightMode: (mode: DayNightMode) => void;
  visualHour: number; // The hour to use for rendering (respects day/night mode override)
  // Save/restore city for shared links
  saveCurrentCityForRestore: () => void;
  restoreSavedCity: () => boolean;
  getSavedCityInfo: () => SavedCityInfo;
  clearSavedCity: () => void;
  // Multi-city save system
  savedCities: SavedCityMeta[];
  saveCity: () => void;
  loadSavedCity: (cityId: string) => boolean;
  deleteSavedCity: (cityId: string) => void;
  renameSavedCity: (cityId: string, newName: string) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const toolBuildingMap: Partial<Record<Tool, BuildingType>> = {
  road: 'road',
  rail: 'rail',
  rail_station: 'rail_station',
  tree: 'tree',
  police_station: 'police_station',
  fire_station: 'fire_station',
  hospital: 'hospital',
  school: 'school',
  university: 'university',
  park: 'park',
  park_large: 'park_large',
  tennis: 'tennis',
  power_plant: 'power_plant',
  water_tower: 'water_tower',
  subway_station: 'subway_station',
  stadium: 'stadium',
  museum: 'museum',
  airport: 'airport',
  space_program: 'space_program',
  city_hall: 'city_hall',
  amusement_park: 'amusement_park',
  // New parks
  basketball_courts: 'basketball_courts',
  playground_small: 'playground_small',
  playground_large: 'playground_large',
  baseball_field_small: 'baseball_field_small',
  soccer_field_small: 'soccer_field_small',
  football_field: 'football_field',
  baseball_stadium: 'baseball_stadium',
  community_center: 'community_center',
  office_building_small: 'office_building_small',
  swimming_pool: 'swimming_pool',
  skate_park: 'skate_park',
  mini_golf_course: 'mini_golf_course',
  bleachers_field: 'bleachers_field',
  go_kart_track: 'go_kart_track',
  amphitheater: 'amphitheater',
  greenhouse_garden: 'greenhouse_garden',
  animal_pens_farm: 'animal_pens_farm',
  cabin_house: 'cabin_house',
  campground: 'campground',
  marina_docks_small: 'marina_docks_small',
  pier_large: 'pier_large',
  roller_coaster_small: 'roller_coaster_small',
  community_garden: 'community_garden',
  pond_park: 'pond_park',
  park_gate: 'park_gate',
  mountain_lodge: 'mountain_lodge',
  mountain_trailhead: 'mountain_trailhead',
};

const toolZoneMap: Partial<Record<Tool, ZoneType>> = {
  zone_residential: 'residential',
  zone_commercial: 'commercial',
  zone_industrial: 'industrial',
  zone_dezone: 'none',
};

// Load game state from localStorage
// Supports both compressed (lz-string) and uncompressed (legacy) formats
function loadGameState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Try to decompress first (new format)
      // If it fails or returns null/garbage, fall back to parsing as plain JSON (legacy format)
      let jsonString = decompressFromUTF16(saved);
      
      // Check if decompression returned valid-looking JSON (should start with '{')
      // lz-string can return garbage strings when given invalid input
      if (!jsonString || !jsonString.startsWith('{')) {
        // Check if the saved string itself looks like JSON (legacy uncompressed format)
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          // Data is corrupted - clear it and return null
          console.error('Corrupted save data detected, clearing...');
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }
      
      const parsed = JSON.parse(jsonString);
      // Validate it has essential properties
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        // Migrate park_medium to park_large
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building?.type === 'park_medium') {
                parsed.grid[y][x].building.type = 'park_large';
              }
            }
          }
        }
        // Migrate selectedTool if it's park_medium
        if (parsed.selectedTool === 'park_medium') {
          parsed.selectedTool = 'park_large';
        }
        // Ensure adjacentCities and waterBodies exist for backward compatibility
        if (!parsed.adjacentCities) {
          parsed.adjacentCities = [];
        }
        // Migrate adjacentCities to have 'discovered' property
        for (const city of parsed.adjacentCities) {
          if (city.discovered === undefined) {
            // Old cities that exist are implicitly discovered (they were visible in the old system)
            city.discovered = true;
          }
        }
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          // Create a default city covering the entire map
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure hour exists for day/night cycle
        if (parsed.hour === undefined) {
          parsed.hour = 12; // Default to noon
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9; // Start at current tax rate
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Ensure gameVersion exists for backward compatibility
        if (parsed.gameVersion === undefined) {
          parsed.gameVersion = 0;
        }
        // Migrate to include UUID if missing
        if (!parsed.id) {
          parsed.id = generateUUID();
        }
        return parsed as GameState;
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch (e) {
    console.error('Failed to load game state:', e);
    // Clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (clearError) {
      console.error('Failed to clear corrupted game state:', clearError);
    }
  }
  return null;
}

// Optimize game state for saving by removing unnecessary/transient data
function optimizeStateForSave(state: GameState): GameState {
  // Create a shallow copy to avoid mutating the original
  const optimized = { ...state };
  
  // Clear notifications (they're transient)
  optimized.notifications = [];
  
  // Clear advisor messages (they're regenerated each tick)
  optimized.advisorMessages = [];
  
  // Limit history to last 50 entries (instead of 100)
  if (optimized.history && optimized.history.length > 50) {
    optimized.history = optimized.history.slice(-50);
  }
  
  return optimized;
}

// Try to free up localStorage space by clearing old/unused data
function tryFreeLocalStorageSpace(): void {
  try {
    // Clear any old saved city restore data
    localStorage.removeItem(SAVED_CITY_STORAGE_KEY);
    
    // Clear sprite test data if any
    localStorage.removeItem('isocity_sprite_test');
    
    // Clear any other temporary keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('isocity_temp_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.error('Failed to free localStorage space:', e);
  }
}

// Save game state to localStorage with lz-string compression
// Compression typically reduces size by 60-80%, allowing much larger cities
// PERF: Uses Web Worker for BOTH serialization and compression - no main thread blocking!
async function saveGameStateAsync(state: GameState): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Validate state before saving
  if (!state || !state.grid || !state.gridSize || !state.stats) {
    console.error('Invalid game state, cannot save', { state, hasGrid: !!state?.grid, hasGridSize: !!state?.gridSize, hasStats: !!state?.stats });
    return;
  }
  
  try {
    // Step 1: Optimize state (fast, stays on main thread)
    const optimizedState = optimizeStateForSave(state);
    
    // Step 2: Serialize + Compress using Web Worker (BOTH operations off main thread!)
    const compressed = await serializeAndCompressAsync(optimizedState);
    
    // Check size limit
    if (compressed.length > 5 * 1024 * 1024) {
      console.error('Compressed game state too large to save:', compressed.length, 'chars');
      return;
    }
    
    // Step 3: Write to localStorage (fast)
    try {
      localStorage.setItem(STORAGE_KEY, compressed);
    } catch (quotaError) {
      if (quotaError instanceof DOMException && (quotaError.code === 22 || quotaError.code === 1014)) {
        console.warn('localStorage quota exceeded, trying to free space...');
        tryFreeLocalStorageSpace();
        try {
          localStorage.setItem(STORAGE_KEY, compressed);
        } catch {
          console.error('localStorage still full after cleanup');
        }
      }
    }
  } catch (e) {
    console.error('Failed to save game state:', e);
  }
}

// Wrapper that takes a callback for compatibility with existing code
function saveGameState(state: GameState, callback?: () => void): void {
  saveGameStateAsync(state).finally(() => {
    callback?.();
  });
}

// Clear saved game state
function clearGameState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear game state:', e);
  }
}

// Load sprite pack from localStorage
function loadSpritePackId(): string {
  if (typeof window === 'undefined') return DEFAULT_SPRITE_PACK_ID;
  try {
    const saved = localStorage.getItem(SPRITE_PACK_STORAGE_KEY);
    if (saved && SPRITE_PACKS.some(p => p.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load sprite pack preference:', e);
  }
  return DEFAULT_SPRITE_PACK_ID;
}

// Save sprite pack to localStorage
function saveSpritePackId(packId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPRITE_PACK_STORAGE_KEY, packId);
  } catch (e) {
    console.error('Failed to save sprite pack preference:', e);
  }
}

// Load day/night mode from localStorage
function loadDayNightMode(): DayNightMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(DAY_NIGHT_MODE_STORAGE_KEY);
    if (saved === 'auto' || saved === 'day' || saved === 'night') {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load day/night mode preference:', e);
  }
  return 'auto';
}

// Save day/night mode to localStorage
function saveDayNightMode(mode: DayNightMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAY_NIGHT_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.error('Failed to save day/night mode preference:', e);
  }
}

// Save current city for later restoration (when viewing shared cities)
function saveCityForRestore(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    const savedData = {
      state: state,
      info: {
        cityName: state.cityName,
        population: state.stats.population,
        money: state.stats.money,
        savedAt: Date.now(),
      },
    };
    const compressed = compressToUTF16(JSON.stringify(savedData));
    localStorage.setItem(SAVED_CITY_STORAGE_KEY, compressed);
  } catch (e) {
    console.error('Failed to save city for restore:', e);
  }
}

// Helper to decompress saved city data (supports both compressed and legacy formats)
function decompressSavedCity(saved: string): { state?: GameState; info?: SavedCityInfo } | null {
  // Try to decompress first (new format)
  let jsonString = decompressFromUTF16(saved);
  if (!jsonString) {
    // Legacy uncompressed format
    jsonString = saved;
  }
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

// Load saved city info (just metadata, not full state)
function loadSavedCityInfo(): SavedCityInfo {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = decompressSavedCity(saved);
      if (parsed?.info) {
        return parsed.info as SavedCityInfo;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city info:', e);
  }
  return null;
}

// Load full saved city state
function loadSavedCityState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = decompressSavedCity(saved);
      if (parsed?.state && parsed.state.grid && parsed.state.gridSize && parsed.state.stats) {
        return parsed.state as GameState;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city state:', e);
  }
  return null;
}

// Clear saved city
function clearSavedCityStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_CITY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved city:', e);
  }
}

// Generate a UUID v4
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Load saved cities index from localStorage
function loadSavedCitiesIndex(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as SavedCityMeta[];
      }
    }
  } catch (e) {
    console.error('Failed to load saved cities index:', e);
  }
  return [];
}

// Save saved cities index to localStorage
function saveSavedCitiesIndex(cities: SavedCityMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_CITIES_INDEX_KEY, JSON.stringify(cities));
  } catch (e) {
    console.error('Failed to save cities index:', e);
  }
}

// Save a city state to localStorage with compression
// PERF: Uses Web Worker for BOTH serialization and compression - no main thread blocking!
async function saveCityStateAsync(cityId: string, state: GameState): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Both JSON.stringify and compression happen in the worker
    const compressed = await serializeAndCompressAsync(state);
    
    if (compressed.length > 5 * 1024 * 1024) {
      console.error('Compressed city state too large to save');
      return;
    }
    
    localStorage.setItem(SAVED_CITY_PREFIX + cityId, compressed);
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.code === 1014)) {
      console.error('localStorage quota exceeded');
    } else {
      console.error('Failed to save city state:', e);
    }
  }
}

// Wrapper for compatibility
function saveCityState(cityId: string, state: GameState): void {
  saveCityStateAsync(cityId, state);
}

// Load a saved city state from localStorage (supports compressed and legacy formats)
function loadCityState(cityId: string): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(SAVED_CITY_PREFIX + cityId);
    if (saved) {
      // Try to decompress first (new format)
      // lz-string can return garbage when given invalid input, so check for valid JSON start
      let jsonString = decompressFromUTF16(saved);
      
      // Check if decompression returned valid-looking JSON
      if (!jsonString || !jsonString.startsWith('{')) {
        // Check if saved string itself is JSON (legacy uncompressed format)
        if (saved.startsWith('{')) {
          jsonString = saved;
        } else {
          // Data is corrupted
          console.error('Corrupted city save data for:', cityId);
          return null;
        }
      }
      
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.grid && parsed.gridSize && parsed.stats) {
        return parsed as GameState;
      }
    }
  } catch (e) {
    console.error('Failed to load city state:', e);
  }
  return null;
}

// Delete a saved city from localStorage
function deleteCityState(cityId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SAVED_CITY_PREFIX + cityId);
  } catch (e) {
    console.error('Failed to delete city state:', e);
  }
}

export function GameProvider({ children, startFresh = false }: { children: React.ReactNode; startFresh?: boolean }) {
  // Start with a default state, we'll load from localStorage after mount (unless startFresh is true)
  const [state, setState] = useState<GameState>(() => createInitialGameState(DEFAULT_GRID_SIZE, 'IsoCity'));
  
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
  // Callback for multiplayer action broadcast
  const placeCallbackRef = useRef<((args: { x: number; y: number; tool: Tool }) => void) | null>(null);
  const bridgeCallbackRef = useRef<((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null>(null);
  
  // Sprite pack state
  const [currentSpritePack, setCurrentSpritePack] = useState<SpritePack>(() => getSpritePack(DEFAULT_SPRITE_PACK_ID));
  
  // Day/night mode state
  const [dayNightMode, setDayNightModeState] = useState<DayNightMode>('auto');
  
  // Saved cities state for multi-city save system
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  
  // Load game state and sprite pack from localStorage on mount (client-side only)
  useEffect(() => {
    // Load sprite pack preference
    const savedPackId = loadSpritePackId();
    const pack = getSpritePack(savedPackId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);
    
    // Load day/night mode preference
    const savedDayNightMode = loadDayNightMode();
    setDayNightModeState(savedDayNightMode);
    
    // Load saved cities index
    const cities = loadSavedCitiesIndex();
    setSavedCities(cities);
    
    // Load game state (unless startFresh is true - used for co-op to start with a new city)
    if (!startFresh) {
      const saved = loadGameState();
      if (saved) {
        skipNextSaveRef.current = true; // Set skip flag BEFORE updating state
        setState(saved);
        setHasExistingGame(true);
      } else {
        setHasExistingGame(false);
      }
    } else {
      setHasExistingGame(false);
    }
    // Mark as loaded immediately - the skipNextSaveRef will handle skipping the first save
    hasLoadedRef.current = true;
    // Mark state as ready - consumers should wait for this before using state
    setIsStateReady(true);
  }, [startFresh]);
  
  // Track the state that needs to be saved
  const lastSaveTimeRef = useRef<number>(0);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Update the state to save whenever state changes
  // PERF: Just mark that state has changed - defer expensive deep copy to actual save time
  const stateChangedRef = useRef(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  
  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }
    
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      lastSaveTimeRef.current = Date.now();
      return;
    }
    
    // PERF: Just mark that state changed instead of expensive deep copy every time
    stateChangedRef.current = true;
  }, [state]);
  
  // PERF: Track if a save is in progress to avoid overlapping saves
  const saveInProgressRef = useRef(false);
  
  // Separate effect that actually performs saves on an interval
  useEffect(() => {
    // Wait for initial load - just check once after a short delay
    const checkLoadedTimeout = setTimeout(() => {
      if (!hasLoadedRef.current) {
        return;
      }
      
      // Clear any existing save interval
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      
      // Set up interval to save every 5 seconds
      // PERF: Save operation is broken into chunks internally to avoid blocking
      saveIntervalRef.current = setInterval(() => {
        // Don't save if we just loaded
        if (skipNextSaveRef.current) {
          skipNextSaveRef.current = false;
          return;
        }
        
        // Don't save if a save is already in progress
        if (saveInProgressRef.current) {
          return;
        }
        
        // Don't save if state hasn't changed
        if (!stateChangedRef.current) {
          return;
        }
        
        // Mark save as in progress
        saveInProgressRef.current = true;
        stateChangedRef.current = false;
        setIsSaving(true);
        
        // PERF: No need for structuredClone here - the worker handles everything
        // postMessage internally clones the data when sending to the worker
        saveGameState(latestStateRef.current, () => {
          lastSaveTimeRef.current = Date.now();
          setHasExistingGame(true);
          setIsSaving(false);
          saveInProgressRef.current = false;
        });
      }, 5000); // Save every 5 seconds
    }, 200); // Wait 200ms for initial load
    
    return () => {
      clearTimeout(checkLoadedTimeout);
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // PERF: Track tick count to only sync UI-visible changes to React periodically
  const tickCountRef = useRef(0);
  const lastUiSyncRef = useRef(0);
  
  // Simulation loop - PERF: Runs simulation but throttles React updates aggressively
  // Grid updates go to ref (canvas reads from ref), React only gets UI updates
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    if (state.speed > 0) {
      // Check if running on mobile for performance optimization
      const isMobileDevice = typeof window !== 'undefined' && (
        window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );

      // PERF: Balanced tick intervals
      // Desktop: 500ms, 300ms, 200ms for speeds 1, 2, 3
      // Mobile: 750ms, 450ms, 300ms for speeds 1, 2, 3
      const interval = isMobileDevice
        ? (state.speed === 1 ? 750 : state.speed === 2 ? 450 : 300)
        : (state.speed === 1 ? 500 : state.speed === 2 ? 300 : 200);

      timer = setInterval(() => {
        tickCountRef.current++;
        const now = performance.now();
        
        // PERF: Run simulation and update ref immediately (for canvas)
        const newState = simulateTick(latestStateRef.current);
        latestStateRef.current = newState;
        stateChangedRef.current = true;
        
        // PERF: Only sync to React every 500ms to avoid expensive reconciliation
        // Canvas reads from latestStateRef so it sees updates immediately
        // React state is only needed for UI elements (stats, budget display)
        if (now - lastUiSyncRef.current >= 500) {
          lastUiSyncRef.current = now;
          setState(newState);
        }
      }, interval);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [state.speed]);

  const setTool = useCallback((tool: Tool) => {
    setState((prev) => ({ ...prev, selectedTool: tool, activePanel: 'none' }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setTaxRate = useCallback((rate: number) => {
    setState((prev) => ({ ...prev, taxRate: clamp(rate, 0, 100) }));
  }, []);

  const setActivePanel = useCallback(
    (panel: GameState['activePanel']) => {
      setState((prev) => ({ ...prev, activePanel: panel }));
    },
    [],
  );

  const setBudgetFunding = useCallback(
    (key: keyof Budget, funding: number) => {
      const clamped = clamp(funding, 0, 100);
      setState((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [key]: { ...prev.budget[key], funding: clamped },
        },
      }));
    },
    [],
  );

  const placeAtTile = useCallback((x: number, y: number, isRemote = false) => {
    // For multiplayer broadcast, we need to capture the tool synchronously
    // before React batches the setState. We read from the latest state ref.
    const currentTool = latestStateRef.current.selectedTool;
    
    setState((prev) => {
      const tool = prev.selectedTool;
      if (tool === 'select') return prev;

      const info = TOOL_INFO[tool];
      const cost = info?.cost ?? 0;
      const tile = prev.grid[y]?.[x];

      if (!tile) return prev;
      if (cost > 0 && prev.stats.money < cost) return prev;

      // Prevent wasted spend if nothing would change
      if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
        return prev;
      }

      const building = toolBuildingMap[tool];
      const zone = toolZoneMap[tool];

      if (zone && tile.zone === zone) return prev;
      if (building && tile.building.type === building) return prev;
      
      // Handle subway tool separately (underground placement)
      if (tool === 'subway') {
        // Can't place subway under water
        if (tile.building.type === 'water') return prev;
        // Already has subway
        if (tile.hasSubway) return prev;
        
        const nextState = placeSubway(prev, x, y);
        if (nextState === prev) return prev;
        
        return {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }
      
      // Handle water terraform tool separately
      if (tool === 'zone_water') {
        // Already water - do nothing
        if (tile.building.type === 'water') return prev;
        // Don't allow terraforming bridges - would break them
        if (tile.building.type === 'bridge') return prev;
        
        const nextState = placeWaterTerraform(prev, x, y);
        if (nextState === prev) return prev;
        
        return {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }
      
      // Handle land terraform tool separately
      if (tool === 'zone_land') {
        // Only works on water
        if (tile.building.type !== 'water') return prev;
        
        const nextState = placeLandTerraform(prev, x, y);
        if (nextState === prev) return prev;
        
        return {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      let nextState: GameState;

      if (tool === 'bulldoze') {
        nextState = bulldozeTile(prev, x, y);
      } else if (zone) {
        nextState = placeBuilding(prev, x, y, null, zone);
      } else if (building) {
        nextState = placeBuilding(prev, x, y, building, null);
      } else {
        return prev;
      }

      if (nextState === prev) return prev;

      if (cost > 0) {
        nextState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      return nextState;
    });
    
    // Broadcast to multiplayer if this is a local action (not remote)
    // We use the tool captured before setState since React 18 batches async
    if (!isRemote && currentTool !== 'select' && placeCallbackRef.current) {
      placeCallbackRef.current({ x, y, tool: currentTool });
    }
  }, []);

  // Place a custom AI-generated building
  const placeCustomBuilding = useCallback((x: number, y: number, customBuilding: CustomBuildingData): boolean => {
    let placed = false;
    
    setState((prev) => {
      const { size, cost, spriteUrl, id } = customBuilding;
      
      // Check if we can afford it
      if (prev.stats.money < cost) return prev;
      
      // Check if all tiles in the footprint are valid (grass or tree only)
      // NOTE: 'empty' tiles are placeholders for existing multi-tile buildings, not truly empty
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const tile = prev.grid[y + dy]?.[x + dx];
          if (!tile) return prev; // Out of bounds
          // Only allow placement on grass or tree - matches regular multi-tile building behavior
          const type = tile.building.type;
          if (type !== 'grass' && type !== 'tree') return prev;
        }
      }
      
      // Create new grid with the custom building
      // Only the origin tile (x, y) gets the sprite URL - other tiles just mark as custom
      const newGrid = prev.grid.map((row, rowY) => 
        row.map((tile, colX) => {
          // Check if this tile is within the building's footprint
          if (colX >= x && colX < x + size && rowY >= y && rowY < y + size) {
            const isOrigin = colX === x && rowY === y;
            return {
              ...tile,
              zone: 'none' as const,
              // Apply AI-analyzed environmental stats only to origin tile (matches regular building behavior)
              pollution: isOrigin ? (customBuilding.stats.pollution ?? 0) : 0,
              landValue: isOrigin ? (customBuilding.stats.landValue ?? 0) : 0,
              building: {
                ...tile.building,
                type: 'custom' as BuildingType,
                customBuildingId: id,
                // Only set sprite URL on origin tile - prevents duplicate rendering
                customSpriteUrl: isOrigin ? spriteUrl : undefined,
                customSize: size,
                level: 1,
                population: isOrigin ? (customBuilding.stats.maxPop ?? 0) : 0,
                jobs: isOrigin ? (customBuilding.stats.maxJobs ?? 0) : 0,
                constructionProgress: 100,
                abandoned: false,
              },
            };
          }
          return tile;
        })
      );
      
      placed = true;
      return {
        ...prev,
        grid: newGrid,
        stats: { ...prev.stats, money: prev.stats.money - cost },
      };
    });
    
    return placed;
  }, []);

  const upgradeServiceBuildingHandler = useCallback((x: number, y: number) => {
    let upgradeSucceeded = false;
    setState((prev) => {
      const upgradedState = upgradeServiceBuilding(prev, x, y);
      if (upgradedState) {
        upgradeSucceeded = true;
        return upgradedState;
      }
      return prev;
    });
    return upgradeSucceeded;
  }, []);

  // Called after a road/rail drag operation to create bridges for water crossings
  const finishTrackDrag = useCallback((pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote = false) => {
    setState((prev) => createBridgesOnPath(prev, pathTiles, trackType));
    
    // Broadcast to multiplayer if this is a local action (not remote)
    if (!isRemote && bridgeCallbackRef.current) {
      bridgeCallbackRef.current({ pathTiles, trackType });
    }
  }, []);

  const connectToCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.connected) return prev;

      // Mark city as connected (and discovered if not already) and add trade income
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, connected: true, discovered: true } : c
      );

      // Add trade income bonus (one-time bonus + monthly income)
      const tradeBonus = 5000;
      const tradeIncome = 200; // Monthly income from trade

      return {
        ...prev,
        adjacentCities: updatedCities,
        stats: {
          ...prev.stats,
          money: prev.stats.money + tradeBonus,
          income: prev.stats.income + tradeIncome,
        },
        notifications: [
          {
            id: `city-connect-${Date.now()}`,
            title: 'City Connected!',
            description: `Trade route established with ${city.name}. +$${tradeBonus} bonus and +$${tradeIncome}/month income.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  const discoverCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.discovered) return prev;

      // Mark city as discovered
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, discovered: true } : c
      );

      return {
        ...prev,
        adjacentCities: updatedCities,
        notifications: [
          {
            id: `city-discover-${Date.now()}`,
            title: 'City Discovered!',
            description: `Your road has reached the ${city.direction} border! You can now connect to ${city.name}.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  // Check for cities that should be discovered based on roads reaching edges
  // Calls onDiscover callback with city info if a new city was discovered
  const checkAndDiscoverCities = useCallback((onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void): void => {
    setState((prev) => {
      const newlyDiscovered = checkForDiscoverableCities(prev.grid, prev.gridSize, prev.adjacentCities);
      
      if (newlyDiscovered.length === 0) return prev;
      
      // Discover the first city found
      const cityToDiscover = newlyDiscovered[0];
      
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityToDiscover.id ? { ...c, discovered: true } : c
      );
      
      // Call the callback after state update is scheduled
      if (onDiscover) {
        setTimeout(() => {
          onDiscover({
            id: cityToDiscover.id,
            direction: cityToDiscover.direction,
            name: cityToDiscover.name,
          });
        }, 0);
      }
      
      return {
        ...prev,
        adjacentCities: updatedCities,
      };
    });
  }, []);

  const setDisastersEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, disastersEnabled: enabled }));
  }, []);
  
  const setPlaceCallback = useCallback((callback: ((args: { x: number; y: number; tool: Tool }) => void) | null) => {
    placeCallbackRef.current = callback;
  }, []);

  const setBridgeCallback = useCallback((callback: ((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null) => {
    bridgeCallbackRef.current = callback;
  }, []);

  const setSpritePack = useCallback((packId: string) => {
    const pack = getSpritePack(packId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);
    saveSpritePackId(packId);
  }, []);

  const setDayNightMode = useCallback((mode: DayNightMode) => {
    setDayNightModeState(mode);
    saveDayNightMode(mode);
  }, []);

  // Compute the visual hour based on the day/night mode override
  // This doesn't affect time progression, just the rendering
  const visualHour = dayNightMode === 'auto' 
    ? state.hour 
    : dayNightMode === 'day' 
      ? 12  // Noon - full daylight
      : 22; // Night time

  const newGame = useCallback((name?: string, size?: number) => {
    clearGameState(); // Clear saved state when starting fresh
    const fresh = createInitialGameState(size ?? DEFAULT_GRID_SIZE, name || 'IsoCity');
    // Increment gameVersion from current state to ensure vehicles/entities are cleared
    setState((prev) => ({
      ...fresh,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
  }, []);

  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      // Validate it has essential properties
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        // Ensure new fields exist for backward compatibility
        if (!parsed.adjacentCities) {
          parsed.adjacentCities = [];
        }
        // Migrate adjacentCities to have 'discovered' property
        for (const city of parsed.adjacentCities) {
          if (city.discovered === undefined) {
            // Old cities that exist are implicitly discovered (they were visible in the old system)
            city.discovered = true;
          }
        }
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9;
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Increment gameVersion to clear vehicles/entities when loading a new state
        setState((prev) => ({
          ...(parsed as GameState),
          gameVersion: (prev.gameVersion ?? 0) + 1,
        }));
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

  const generateRandomCity = useCallback(() => {
    clearGameState(); // Clear saved state when generating a new city
    const randomCity = generateRandomAdvancedCity(DEFAULT_GRID_SIZE);
    // Increment gameVersion to ensure vehicles/entities are cleared
    setState((prev) => ({
      ...randomCity,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
  }, []);

  // Expand the city grid by 15 tiles on each side (30x30 total increase)
  const expandCity = useCallback(() => {
    setState((prev) => {
      const { grid: newGrid, newSize } = expandGrid(prev.grid, prev.gridSize, 15);
      
      // Create new service grids with expanded size (all initialized to 0)
      const createServiceGrid = (): number[][] => {
        const grid: number[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(0));
        }
        return grid;
      };
      
      // Create new boolean grids with expanded size (all initialized to false)
      const createBoolGrid = (): boolean[][] => {
        const grid: boolean[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(false));
        }
        return grid;
      };
      
      // Copy old service values to new positions (offset by 15)
      const expandServiceGrid = (oldGrid: number[][]): number[][] => {
        const newServiceGrid = createServiceGrid();
        const offset = 15;
        // Safely iterate through the old grid
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < prev.gridSize; y++) {
            const row = oldGrid[y];
            if (row && Array.isArray(row)) {
              for (let x = 0; x < prev.gridSize; x++) {
                const value = row[x];
                if (typeof value === 'number') {
                  newServiceGrid[y + offset][x + offset] = value;
                }
              }
            }
          }
        }
        return newServiceGrid;
      };
      
      // Copy old boolean grid values to new positions (offset by 15)
      const expandBoolGrid = (oldGrid: boolean[][]): boolean[][] => {
        const newBoolGrid = createBoolGrid();
        const offset = 15;
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < prev.gridSize; y++) {
            const row = oldGrid[y];
            if (row && Array.isArray(row)) {
              for (let x = 0; x < prev.gridSize; x++) {
                const value = row[x];
                if (typeof value === 'boolean') {
                  newBoolGrid[y + offset][x + offset] = value;
                }
              }
            }
          }
        }
        return newBoolGrid;
      };
      
      return {
        ...prev,
        grid: newGrid,
        gridSize: newSize,
        // Expand all service grids
        services: {
          power: expandBoolGrid(prev.services.power),
          water: expandBoolGrid(prev.services.water),
          fire: expandServiceGrid(prev.services.fire),
          police: expandServiceGrid(prev.services.police),
          health: expandServiceGrid(prev.services.health),
          education: expandServiceGrid(prev.services.education),
        },
        // Update bounds
        bounds: {
          minX: 0,
          minY: 0,
          maxX: newSize - 1,
          maxY: newSize - 1,
        },
        // Increment game version to reset vehicles/entities
        gameVersion: (prev.gameVersion ?? 0) + 1,
      };
    });
  }, []);

  // Shrink the city grid by 15 tiles on each side (30x30 total reduction)
  const shrinkCity = useCallback((): boolean => {
    let success = false;
    setState((prev) => {
      const result = shrinkGrid(prev.grid, prev.gridSize, 15);
      
      // If shrink failed (grid too small), return previous state unchanged
      if (!result) {
        return prev;
      }
      
      success = true;
      const { grid: newGrid, newSize } = result;
      
      // Create new service grids with shrunken size
      const createServiceGrid = (): number[][] => {
        const grid: number[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(0));
        }
        return grid;
      };
      
      // Create new boolean grids with shrunken size
      const createBoolGrid = (): boolean[][] => {
        const grid: boolean[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(false));
        }
        return grid;
      };
      
      // Copy old service values from interior positions (offset by 15)
      const shrinkServiceGrid = (oldGrid: number[][]): number[][] => {
        const newServiceGrid = createServiceGrid();
        const offset = 15;
        // Safely iterate through the new grid
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < newSize; y++) {
            const oldRow = oldGrid[y + offset];
            if (oldRow && Array.isArray(oldRow)) {
              for (let x = 0; x < newSize; x++) {
                const value = oldRow[x + offset];
                if (typeof value === 'number') {
                  newServiceGrid[y][x] = value;
                }
              }
            }
          }
        }
        return newServiceGrid;
      };
      
      // Copy old boolean grid values from interior positions (offset by 15)
      const shrinkBoolGrid = (oldGrid: boolean[][]): boolean[][] => {
        const newBoolGrid = createBoolGrid();
        const offset = 15;
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < newSize; y++) {
            const oldRow = oldGrid[y + offset];
            if (oldRow && Array.isArray(oldRow)) {
              for (let x = 0; x < newSize; x++) {
                const value = oldRow[x + offset];
                if (typeof value === 'boolean') {
                  newBoolGrid[y][x] = value;
                }
              }
            }
          }
        }
        return newBoolGrid;
      };
      
      return {
        ...prev,
        grid: newGrid,
        gridSize: newSize,
        // Shrink all service grids
        services: {
          power: shrinkBoolGrid(prev.services.power),
          water: shrinkBoolGrid(prev.services.water),
          fire: shrinkServiceGrid(prev.services.fire),
          police: shrinkServiceGrid(prev.services.police),
          health: shrinkServiceGrid(prev.services.health),
          education: shrinkServiceGrid(prev.services.education),
        },
        // Update bounds
        bounds: {
          minX: 0,
          minY: 0,
          maxX: newSize - 1,
          maxY: newSize - 1,
        },
        // Increment game version to reset vehicles/entities
        gameVersion: (prev.gameVersion ?? 0) + 1,
      };
    });
    return success;
  }, []);

  const addMoney = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + amount,
      },
    }));
  }, []);

  const addNotification = useCallback((title: string, description: string, icon: string) => {
    setState((prev) => {
      const newNotifications = [
        {
          id: `cheat-${Date.now()}-${Math.random()}`,
          title,
          description,
          icon,
          timestamp: Date.now(),
        },
        ...prev.notifications,
      ];
      // Keep only recent notifications
      while (newNotifications.length > 10) {
        newNotifications.pop();
      }
      return {
        ...prev,
        notifications: newNotifications,
      };
    });
  }, []);

  // Save current city for restore (when viewing shared cities)
  const saveCurrentCityForRestore = useCallback(() => {
    saveCityForRestore(state);
  }, [state]);

  // Restore saved city
  const restoreSavedCity = useCallback((): boolean => {
    const savedState = loadSavedCityState();
    if (savedState) {
      skipNextSaveRef.current = true;
      setState(savedState);
      clearSavedCityStorage();
      return true;
    }
    return false;
  }, []);

  // Get saved city info
  const getSavedCityInfo = useCallback((): SavedCityInfo => {
    return loadSavedCityInfo();
  }, []);

  // Clear saved city
  const clearSavedCity = useCallback(() => {
    clearSavedCityStorage();
  }, []);

  // Save current city to the multi-save system
  const saveCity = useCallback(() => {
    const cityMeta: SavedCityMeta = {
      id: state.id,
      cityName: state.cityName,
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };
    
    // Save the city state
    saveCityState(state.id, state);
    
    // Update the index
    setSavedCities((prev) => {
      // Check if this city already exists in the list
      const existingIndex = prev.findIndex((c) => c.id === state.id);
      let newCities: SavedCityMeta[];
      
      if (existingIndex >= 0) {
        // Update existing entry
        newCities = [...prev];
        newCities[existingIndex] = cityMeta;
      } else {
        // Add new entry
        newCities = [...prev, cityMeta];
      }
      
      // Sort by savedAt descending (most recent first)
      newCities.sort((a, b) => b.savedAt - a.savedAt);
      
      // Persist to localStorage
      saveSavedCitiesIndex(newCities);
      
      return newCities;
    });
  }, [state]);

  // Load a saved city from the multi-save system
  const loadSavedCity = useCallback((cityId: string): boolean => {
    const cityState = loadCityState(cityId);
    if (!cityState) return false;
    
    // Ensure the loaded state has an ID
    if (!cityState.id) {
      cityState.id = cityId;
    }
    
    // Perform migrations for backward compatibility
    if (!cityState.adjacentCities) {
      cityState.adjacentCities = [];
    }
    for (const city of cityState.adjacentCities) {
      if (city.discovered === undefined) {
        city.discovered = true;
      }
    }
    if (!cityState.waterBodies) {
      cityState.waterBodies = [];
    }
    // Ensure cities exists for multi-city support
    if (!cityState.cities) {
      cityState.cities = [{
        id: cityState.id || 'default-city',
        name: cityState.cityName || 'City',
        bounds: {
          minX: 0,
          minY: 0,
          maxX: (cityState.gridSize || 50) - 1,
          maxY: (cityState.gridSize || 50) - 1,
        },
        economy: {
          population: cityState.stats?.population || 0,
          jobs: cityState.stats?.jobs || 0,
          income: cityState.stats?.income || 0,
          expenses: cityState.stats?.expenses || 0,
          happiness: cityState.stats?.happiness || 50,
          lastCalculated: 0,
        },
        color: '#3b82f6',
      }];
    }
    if (cityState.effectiveTaxRate === undefined) {
      cityState.effectiveTaxRate = cityState.taxRate ?? 9;
    }
    if (cityState.grid) {
      for (let y = 0; y < cityState.grid.length; y++) {
        for (let x = 0; x < cityState.grid[y].length; x++) {
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.constructionProgress === undefined) {
            cityState.grid[y][x].building.constructionProgress = 100;
          }
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.abandoned === undefined) {
            cityState.grid[y][x].building.abandoned = false;
          }
        }
      }
    }
    
    skipNextSaveRef.current = true;
    setState((prev) => ({
      ...cityState,
      gameVersion: (prev.gameVersion ?? 0) + 1,
    }));
    
    // Also update the current game in local storage
    saveGameState(cityState);
    
    return true;
  }, []);

  // Delete a saved city from the multi-save system
  const deleteSavedCity = useCallback((cityId: string) => {
    // Delete the city state
    deleteCityState(cityId);
    
    // Update the index
    setSavedCities((prev) => {
      const newCities = prev.filter((c) => c.id !== cityId);
      saveSavedCitiesIndex(newCities);
      return newCities;
    });
  }, []);

  // Rename a saved city
  const renameSavedCity = useCallback((cityId: string, newName: string) => {
    // Load the city state, update the name, and save it back
    const cityState = loadCityState(cityId);
    if (cityState) {
      cityState.cityName = newName;
      saveCityState(cityId, cityState);
    }
    
    // Update the index
    setSavedCities((prev) => {
      const newCities = prev.map((c) =>
        c.id === cityId ? { ...c, cityName: newName } : c
      );
      saveSavedCitiesIndex(newCities);
      return newCities;
    });
    
    // If the current game is the one being renamed, update its state too
    if (state.id === cityId) {
      setState((prev) => ({ ...prev, cityName: newName }));
    }
  }, [state.id]);

  const value: GameContextValue = {
    state,
    latestStateRef,
    setTool,
    setSpeed,
    setTaxRate,
    setActivePanel,
    setBudgetFunding,
    placeAtTile,
    placeCustomBuilding,
    upgradeServiceBuilding: upgradeServiceBuildingHandler,
    setPlaceCallback,
    finishTrackDrag,
    setBridgeCallback,
    connectToCity,
    discoverCity,
    checkAndDiscoverCities,
    setDisastersEnabled,
    newGame,
    loadState,
    exportState,
    generateRandomCity,
    expandCity,
    shrinkCity,
    hasExistingGame,
    isStateReady,
    isSaving,
    addMoney,
    addNotification,
    // Sprite pack management
    currentSpritePack,
    availableSpritePacks: SPRITE_PACKS,
    setSpritePack,
    // Day/night mode override
    dayNightMode,
    setDayNightMode,
    visualHour,
    // Save/restore city for shared links
    saveCurrentCityForRestore,
    restoreSavedCity,
    getSavedCityInfo,
    clearSavedCity,
    // Multi-city save system
    savedCities,
    saveCity,
    loadSavedCity,
    deleteSavedCity,
    renameSavedCity,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}
