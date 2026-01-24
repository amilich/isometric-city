'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import {
  GameState,
  Tool,
  Tile,
  Notification,
  createEmptyTile,
  createEmptyBuilding,
  TOOL_INFO,
} from '@/games/coaster/types';
import { ParkFinances, ParkStats, ParkSettings, Guest, Staff, DEFAULT_PRICES, WeatherState, WeatherType, WEATHER_EFFECTS, WEATHER_TRANSITIONS, getSeasonalWeatherBias, GuestThought } from '@/games/coaster/types/economy';
import { Coaster, CoasterTrain, CoasterCar, TrackDirection, TrackHeight, TrackPiece, TrackPieceType, CoasterType, COASTER_TYPE_STATS, getStrutStyleForCoasterType, getCoasterCategory, areCoasterTypesCompatible } from '@/games/coaster/types/tracks';
import { Building, BuildingType } from '@/games/coaster/types/buildings';
import { spawnGuests, updateGuest } from '@/components/coaster/guests';
import {
  COASTER_AUTOSAVE_KEY,
  COASTER_SAVED_PARK_PREFIX,
  buildSavedParkMeta,
  loadCoasterStateFromStorage,
  readSavedParksIndex,
  saveCoasterStateToStorage,
  saveCoasterStateToStorageAsync,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_GRID_SIZE = 60;

// Weather change interval in ticks (roughly every 2-4 in-game hours)
const WEATHER_CHANGE_MIN_TICKS = 120; // ~2 hours at normal speed
const WEATHER_CHANGE_MAX_TICKS = 240; // ~4 hours at normal speed

// =============================================================================
// WEATHER SIMULATION
// =============================================================================

function createInitialWeather(month: number): WeatherState {
  const initialWeather = pickNextWeather('sunny', month);
  return {
    current: initialWeather,
    temperature: getTemperatureForWeather(initialWeather, month),
    nextChange: Math.floor(Math.random() * (WEATHER_CHANGE_MAX_TICKS - WEATHER_CHANGE_MIN_TICKS)) + WEATHER_CHANGE_MIN_TICKS,
    forecast: [
      pickNextWeather(initialWeather, month),
      pickNextWeather(initialWeather, month),
      pickNextWeather(initialWeather, month),
    ],
  };
}

function pickNextWeather(current: WeatherType, month: number): WeatherType {
  const transitions = WEATHER_TRANSITIONS[current];
  const seasonBias = getSeasonalWeatherBias(month);
  
  // Build weighted probability list
  const options: { weather: WeatherType; weight: number }[] = [];
  for (const [weather, baseWeight] of Object.entries(transitions)) {
    const bias = seasonBias[weather as WeatherType] ?? 1.0;
    options.push({ weather: weather as WeatherType, weight: (baseWeight ?? 0) * bias });
  }
  
  // Normalize weights
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  const random = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const option of options) {
    cumulative += option.weight;
    if (random <= cumulative) {
      return option.weather;
    }
  }
  
  return options[options.length - 1]?.weather ?? 'sunny';
}

function getTemperatureForWeather(weather: WeatherType, month: number): number {
  // Base temperature by season (Celsius)
  let baseTemp: number;
  if (month >= 6 && month <= 8) baseTemp = 28; // Summer
  else if (month >= 3 && month <= 5) baseTemp = 18; // Spring
  else if (month >= 9 && month <= 11) baseTemp = 14; // Fall
  else baseTemp = 5; // Winter
  
  // Adjust by weather type
  switch (weather) {
    case 'hot': return baseTemp + 8 + Math.random() * 5;
    case 'sunny': return baseTemp + 3 + Math.random() * 3;
    case 'partly_cloudy': return baseTemp + Math.random() * 2;
    case 'cloudy': return baseTemp - 2 + Math.random() * 2;
    case 'rain': return baseTemp - 4 + Math.random() * 2;
    case 'storm': return baseTemp - 5 + Math.random() * 3;
    case 'cold': return baseTemp - 10 + Math.random() * 3;
    default: return baseTemp;
  }
}

function simulateWeather(weather: WeatherState, tick: number, month: number): WeatherState {
  if (tick < weather.nextChange) {
    return weather;
  }
  
  // Time for weather change!
  const newWeather = weather.forecast[0];
  const nextChangeIn = Math.floor(Math.random() * (WEATHER_CHANGE_MAX_TICKS - WEATHER_CHANGE_MIN_TICKS)) + WEATHER_CHANGE_MIN_TICKS;
  
  // Shift forecast and add new prediction
  const newForecast = [
    weather.forecast[1],
    weather.forecast[2],
    pickNextWeather(weather.forecast[2], month),
  ];
  
  return {
    current: newWeather,
    temperature: getTemperatureForWeather(newWeather, month),
    nextChange: tick + nextChangeIn,
    forecast: newForecast,
  };
}

// Apply weather effects to a guest
function applyWeatherEffectsToGuest(guest: Guest, weather: WeatherType): Guest {
  const effects = WEATHER_EFFECTS[weather];
  
  // Clone guest to avoid mutation
  const updatedGuest = { ...guest };
  
  // Apply thirst modifier
  updatedGuest.thirst = Math.min(100, Math.max(0, updatedGuest.thirst + effects.thirstModifier));
  
  // Apply energy modifier (weather affects tiredness)
  updatedGuest.energy = Math.max(0, updatedGuest.energy - effects.energyModifier);
  
  // Apply happiness modifier
  updatedGuest.happiness = Math.min(100, Math.max(0, updatedGuest.happiness + effects.happinessModifier));
  
  // Add weather-related thoughts occasionally
  if (Math.random() < 0.01) { // 1% chance per tick
    const newThoughts = [...updatedGuest.thoughts];
    let weatherThought: GuestThought | null = null;
    
    switch (weather) {
      case 'sunny':
      case 'partly_cloudy':
        if (Math.random() < 0.5) weatherThought = 'weather_great';
        else weatherThought = 'perfect_day';
        break;
      case 'rain':
        weatherThought = 'getting_wet';
        break;
      case 'storm':
        weatherThought = 'need_shelter';
        break;
      case 'hot':
        weatherThought = 'too_hot';
        break;
      case 'cold':
        weatherThought = 'too_cold';
        break;
    }
    
    if (weatherThought && !newThoughts.includes(weatherThought)) {
      newThoughts.push(weatherThought);
      // Keep only last 5 thoughts
      if (newThoughts.length > 5) {
        newThoughts.shift();
      }
      updatedGuest.thoughts = newThoughts;
    }
  }
  
  return updatedGuest;
}

// Check if a guest decides to leave due to weather
// This is called every tick, so the chance must be VERY low
function shouldGuestLeaveForWeather(guest: Guest, weather: WeatherType): boolean {
  const effects = WEATHER_EFFECTS[weather];

  // Base leave chance (extremely low - this is per tick!)
  // With 100ms ticks at normal speed, this runs ~10 times per second
  const baseChance = 0.0001;

  // Only check in bad weather (storms)
  if (weather !== 'storm' && weather !== 'rain') {
    return false;
  }

  // Apply weather multiplier
  let leaveChance = baseChance * effects.leaveChanceMultiplier;

  // Only very unhappy guests consider leaving due to weather
  if (guest.happiness >= 40) {
    return false;
  }
  
  // Even then, give them a further reduction
  leaveChance *= 0.5;

  // Guests who just arrived are much less likely to leave
  if (guest.timeInPark < 600) { // Less than 10 minutes
    leaveChance *= 0.1;
  }
  
  return Math.random() < leaveChance;
}

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
  clearGuests: () => void;
  addNotification: (title: string, description: string, icon: Notification['icon']) => void;
  
  // Save/Load
  saveGame: () => void;
  loadGame: () => boolean;
  newGame: (name?: string) => void;
  hasSavedGame: boolean;
  
  // Export/Import (for settings panel)
  exportState: () => string;
  loadState: (stateString: string) => boolean;
  
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
const OPPOSITE_DIRECTION: Record<TrackDirection, TrackDirection> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

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

/**
 * Find the best station tile for a coaster - prioritizes tiles with adjacent queue lines
 * Falls back to first track tile if no queue-adjacent tile is found
 */
function findStationTile(
  grid: Tile[][],
  trackTiles: { x: number; y: number }[],
  gridSize: number
): { x: number; y: number } | null {
  if (trackTiles.length === 0) return null;
  
  const adjacentOffsets = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  // First, look for a track tile with an adjacent queue
  for (const trackTile of trackTiles) {
    for (const { dx, dy } of adjacentOffsets) {
      const adjX = trackTile.x + dx;
      const adjY = trackTile.y + dy;
      if (adjX >= 0 && adjY >= 0 && adjX < gridSize && adjY < gridSize) {
        const adjTile = grid[adjY]?.[adjX];
        if (adjTile?.queue) {
          return trackTile;
        }
      }
    }
  }
  
  // Second, look for a track tile with an adjacent station building
  for (const trackTile of trackTiles) {
    for (const { dx, dy } of adjacentOffsets) {
      const adjX = trackTile.x + dx;
      const adjY = trackTile.y + dy;
      if (adjX >= 0 && adjY >= 0 && adjX < gridSize && adjY < gridSize) {
        const adjTile = grid[adjY]?.[adjX];
        if (adjTile?.building?.type?.startsWith('station_')) {
          return trackTile;
        }
      }
    }
  }
  
  // Fall back to first track tile
  return trackTiles[0];
}

// =============================================================================
// TERRAIN GENERATION
// =============================================================================

// Perlin-like noise for terrain generation (shared with IsoCity style)
function noise2D(x: number, y: number, seed: number = 42): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const corners = (noise2D(x - 1, y - 1, seed) + noise2D(x + 1, y - 1, seed) +
    noise2D(x - 1, y + 1, seed) + noise2D(x + 1, y + 1, seed)) / 16;
  const sides = (noise2D(x - 1, y, seed) + noise2D(x + 1, y, seed) +
    noise2D(x, y - 1, seed) + noise2D(x, y + 1, seed)) / 8;
  const center = noise2D(x, y, seed) / 4;
  return corners + sides + center;
}

function interpolatedNoise(x: number, y: number, seed: number): number {
  const intX = Math.floor(x);
  const fracX = x - intX;
  const intY = Math.floor(y);
  const fracY = y - intY;

  const v1 = smoothNoise(intX, intY, seed);
  const v2 = smoothNoise(intX + 1, intY, seed);
  const v3 = smoothNoise(intX, intY + 1, seed);
  const v4 = smoothNoise(intX + 1, intY + 1, seed);

  const i1 = v1 * (1 - fracX) + v2 * fracX;
  const i2 = v3 * (1 - fracX) + v4 * fracX;

  return i1 * (1 - fracY) + i2 * fracY;
}

function perlinNoise(x: number, y: number, seed: number, octaves: number = 4): number {
  let total = 0;
  let frequency = 0.05;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += interpolatedNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / maxValue;
}

function generateRandomLakes(grid: Tile[][], size: number, seed: number): void {
  const lakeNoise = (x: number, y: number) => perlinNoise(x, y, seed + 1000, 3);
  const lakeCenters: { x: number; y: number; noise: number }[] = [];
  const minDistFromEdge = Math.max(8, Math.floor(size * 0.15));
  const safeEdge = Math.min(minDistFromEdge, Math.max(1, Math.floor(size / 2) - 1));
  const minDistBetweenLakes = Math.max(size * 0.2, 10);

  let threshold = 0.5;
  let attempts = 0;
  const maxAttempts = 3;

  while (lakeCenters.length < 2 && attempts < maxAttempts) {
    lakeCenters.length = 0;

    for (let y = safeEdge; y < size - safeEdge; y++) {
      for (let x = safeEdge; x < size - safeEdge; x++) {
        const noiseVal = lakeNoise(x, y);
        if (noiseVal < threshold) {
          let tooClose = false;
          for (const center of lakeCenters) {
            const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
            if (dist < minDistBetweenLakes) {
              tooClose = true;
              break;
            }
          }

          if (!tooClose) {
            lakeCenters.push({ x, y, noise: noiseVal });
          }
        }
      }
    }

    if (lakeCenters.length >= 2) break;
    threshold += 0.1;
    attempts++;
  }

  if (lakeCenters.length === 0) {
    const safeZone = safeEdge + 5;
    const quarterSize = Math.max(safeZone, Math.floor(size / 4));
    const threeQuarterSize = Math.min(size - safeZone, Math.floor(size * 3 / 4));
    lakeCenters.push(
      { x: quarterSize, y: quarterSize, noise: 0 },
      { x: threeQuarterSize, y: threeQuarterSize, noise: 0 }
    );
  } else if (lakeCenters.length === 1) {
    const existing = lakeCenters[0];
    const safeZone = safeEdge + 5;
    const quarterSize = Math.max(safeZone, Math.floor(size / 4));
    const threeQuarterSize = Math.min(size - safeZone, Math.floor(size * 3 / 4));
    const newX = existing.x > size / 2 ? quarterSize : threeQuarterSize;
    const newY = existing.y > size / 2 ? quarterSize : threeQuarterSize;
    lakeCenters.push({ x: newX, y: newY, noise: 0 });
  }

  lakeCenters.sort((a, b) => a.noise - b.noise);
  const numLakes = 2 + Math.floor(Math.random() * 2);
  const selectedCenters = lakeCenters.slice(0, Math.min(numLakes, lakeCenters.length));

  for (const center of selectedCenters) {
    const targetSize = 40 + Math.floor(Math.random() * 41);
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number; noise: number }[] = [];

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= safeEdge && nx < size - safeEdge && ny >= safeEdge && ny < size - safeEdge) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = lakeNoise(nx, ny);
        candidates.push({ x: nx, y: ny, dist, noise });
      }
    }

    while (lakeTiles.length < targetSize && candidates.length > 0) {
      candidates.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) < 0.5) {
          return a.noise - b.noise;
        }
        return a.dist - b.dist;
      });

      const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
      const picked = candidates.splice(pickIndex, 1)[0];

      if (lakeTiles.some(t => t.x === picked.x && t.y === picked.y)) continue;
      if (grid[picked.y][picked.x].terrain === 'water') continue;

      lakeTiles.push({ x: picked.x, y: picked.y });

      for (const [dx, dy] of directions) {
        const nx = picked.x + dx;
        const ny = picked.y + dy;
        if (nx >= safeEdge && nx < size - safeEdge &&
            ny >= safeEdge && ny < size - safeEdge &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          const dist = Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2);
          const noise = lakeNoise(nx, ny);
          candidates.push({ x: nx, y: ny, dist, noise });
        }
      }
    }

    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].terrain = 'water';
      grid[tile.y][tile.x].building = { ...createEmptyBuilding(), type: 'water' };
    }
  }
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
  
  const terrainSeed = Math.random() * 1000;
  generateRandomLakes(grid, gridSize, terrainSeed);
  
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
    
    // Weather
    weather: createInitialWeather(3), // March - spring opening
    
    selectedTool: 'select',
    activePanel: 'none',
    notifications: [],
    
    buildingCoasterId: null,
    buildingCoasterPath: [],
    buildingCoasterHeight: 0,
    buildingCoasterLastDirection: null,
    buildingCoasterType: null,
    
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

  // Recollect track tiles and pieces from the grid to fix any incorrect track order
  // This ensures cars travel in the correct direction through all track pieces
  const normalizedCoasters = state.coasters.map(coaster => {
    // Collect the track from the grid using the improved algorithm
    const { tiles: collectedTiles, pieces: collectedPieces } = collectCoasterTrack(normalizedGrid, coaster.id);
    
    // If we couldn't collect any tiles, this coaster has no valid track
    // Return null to filter it out later
    if (collectedTiles.length === 0) {
      return null;
    }
    
    // Find station tile (with adjacent queue or station building)
    const stationTile = findStationTile(normalizedGrid, collectedTiles, state.gridSize) || collectedTiles[0];
    const stationIdx = collectedTiles.findIndex(t => t.x === stationTile.x && t.y === stationTile.y);
    const effectiveStationIdx = stationIdx >= 0 ? stationIdx : 0;
    
    return {
      ...coaster,
      track: collectedPieces,
      trackTiles: collectedTiles,
      stationTileX: stationTile.x,
      stationTileY: stationTile.y,
      // Regenerate trains with proper multi-train configuration and station position
      trains: createTrainsForCoaster(collectedPieces.length, coaster.type).map((train, trainIndex) => {
        // Position trains evenly around the track, starting from station
        const trainOffset = (trainIndex * collectedPieces.length) / Math.max(1, createTrainsForCoaster(collectedPieces.length, coaster.type).length);
        const baseProgress = (effectiveStationIdx + trainOffset) % collectedPieces.length;
        return {
          ...train,
          cars: train.cars.map((car, carIndex) => ({
            ...car,
            trackProgress: (baseProgress + carIndex * 0.18) % collectedPieces.length,
          })),
        };
      }),
    };
  }).filter((coaster): coaster is NonNullable<typeof coaster> => coaster !== null);

  // Ensure weather state exists (backward compatibility)
  const normalizedWeather = state.weather ?? createInitialWeather(state.month ?? 3);

  return {
    ...state,
    grid: normalizedGrid,
    coasters: normalizedCoasters,
    guests: state.guests.map(guest => ({
      ...guest,
      lastState: guest.lastState ?? guest.state,
      queueTimer: guest.queueTimer ?? 0,
      decisionCooldown: guest.decisionCooldown ?? 0,
      targetBuildingId: guest.targetBuildingId ?? null,
      targetBuildingKind: guest.targetBuildingKind ?? null,
    })),
    weather: normalizedWeather,
    buildingCoasterId: state.buildingCoasterId ?? null,
    buildingCoasterPath: state.buildingCoasterPath ?? [],
    buildingCoasterHeight: state.buildingCoasterHeight ?? 0,
    buildingCoasterLastDirection: state.buildingCoasterLastDirection ?? null,
    buildingCoasterType: state.buildingCoasterType ?? null,
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
  
  if (type === 'turn_right_flat' || type === 'turn_right_large_flat') {
    // Right turn: north->east, east->south, south->west, west->north
    const rightTurn: Record<TrackDirection, TrackDirection> = {
      north: 'east', east: 'south', south: 'west', west: 'north'
    };
    return rightTurn[direction];
  }
  
  if (type === 'turn_left_flat' || type === 'turn_left_large_flat') {
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
 * Calculate the correct direction for a straight track piece based on the actual tile flow.
 * This fixes pieces that have incorrect stored directions.
 */
function calculateCorrectDirection(
  prevTile: { x: number; y: number } | null,
  currTile: { x: number; y: number },
  nextTile: { x: number; y: number } | null,
  piece: TrackPiece
): TrackPiece {
  const { type } = piece;
  
  // For turns, we need to calculate based on entry direction
  if (type === 'turn_left_flat' || type === 'turn_right_flat' || type === 'turn_left_large_flat' || type === 'turn_right_large_flat') {
    if (prevTile) {
      // Calculate entry direction (where we came FROM)
      const dx = currTile.x - prevTile.x;
      const dy = currTile.y - prevTile.y;
      
      let entryDir: TrackDirection;
      if (dx === 1 && dy === 0) entryDir = 'north';      // came from north (lower x)
      else if (dx === -1 && dy === 0) entryDir = 'south'; // came from south (higher x)
      else if (dx === 0 && dy === 1) entryDir = 'east';   // came from east (lower y)
      else if (dx === 0 && dy === -1) entryDir = 'west';  // came from west (higher y)
      else return piece; // Can't determine, keep original
      
      // For turns, direction field = entry direction
      if (piece.direction !== entryDir) {
        return { ...piece, direction: entryDir };
      }
    }
    return piece;
  }
  
  // For straights, slopes, and loops, calculate based on exit direction
  if (nextTile) {
    const dx = nextTile.x - currTile.x;
    const dy = nextTile.y - currTile.y;
    
    let exitDir: TrackDirection;
    if (dx === 1 && dy === 0) exitDir = 'south';      // going to south (higher x)
    else if (dx === -1 && dy === 0) exitDir = 'north'; // going to north (lower x)
    else if (dx === 0 && dy === 1) exitDir = 'west';   // going to west (higher y)
    else if (dx === 0 && dy === -1) exitDir = 'east';  // going to east (lower y)
    else return piece; // Can't determine, keep original
    
    // For straights and slopes, direction field = exit/travel direction
    if (piece.direction !== exitDir) {
      // Check if direction is being flipped 180 degrees (not rotated 90 degrees)
      const isDirectionFlipped = 
        (piece.direction === 'north' && exitDir === 'south') ||
        (piece.direction === 'south' && exitDir === 'north') ||
        (piece.direction === 'east' && exitDir === 'west') ||
        (piece.direction === 'west' && exitDir === 'east');
      
      // For slopes, if direction is flipped, swap startHeight and endHeight
      // This ensures the train goes from the correct height to the correct height
      // based on which edge it enters/exits
      if (isDirectionFlipped && (type === 'slope_up_small' || type === 'slope_down_small')) {
        return { 
          ...piece, 
          direction: exitDir,
          startHeight: piece.endHeight,
          endHeight: piece.startHeight,
        };
      }
      
      return { ...piece, direction: exitDir };
    }
  }
  
  return piece;
}

/**
 * Collect a single connected component of track tiles starting from a given tile.
 * Returns tiles in connected order following track connections.
 * Also fixes track piece directions to match the actual flow.
 */
function collectConnectedTrack(
  grid: Tile[][],
  startX: number,
  startY: number,
  visited: Set<string>
): { tiles: { x: number; y: number }[]; pieces: TrackPiece[] } {
  const gridSize = grid.length;
  const orderedTiles: { x: number; y: number }[] = [];
  const collectedPieces: TrackPiece[] = [];
  
  const startTile = grid[startY]?.[startX];
  if (!startTile?.trackPiece) {
    return { tiles: [], pieces: [] };
  }
  
  let current: { x: number; y: number; piece: TrackPiece } = {
    x: startX,
    y: startY,
    piece: startTile.trackPiece,
  };
  
  while (current && !visited.has(`${current.x},${current.y}`)) {
    visited.add(`${current.x},${current.y}`);
    orderedTiles.push({ x: current.x, y: current.y });
    collectedPieces.push(current.piece);
    
    // Find the next tile based on exit direction
    const exitDir = getExitDirection(current.piece);
    const offset = getDirectionOffset(exitDir);
    const nx = current.x + offset.dx;
    const ny = current.y + offset.dy;
    const key = `${nx},${ny}`;
    
    let found = false;
    
    // First priority: tile in our exit direction
    if (!visited.has(key) && nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize) {
      const nextTile = grid[ny]?.[nx];
      if (nextTile?.trackPiece) {
        current = { x: nx, y: ny, piece: nextTile.trackPiece };
        found = true;
      }
    }
    
    // Fallback: try all adjacent unvisited tiles (for legacy tracks with imperfect directions)
    if (!found) {
      const adjacentOffsets = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      ];
      
      for (const { dx, dy } of adjacentOffsets) {
        const adjX = current.x + dx;
        const adjY = current.y + dy;
        const adjKey = `${adjX},${adjY}`;
        
        if (!visited.has(adjKey) && adjX >= 0 && adjY >= 0 && adjX < gridSize && adjY < gridSize) {
          const adjTile = grid[adjY]?.[adjX];
          if (adjTile?.trackPiece) {
            current = { x: adjX, y: adjY, piece: adjTile.trackPiece };
            found = true;
            break;
          }
        }
      }
    }
    
    if (!found) break;
  }
  
  // Now fix the directions of all collected pieces to match the actual flow
  const orderedPieces: TrackPiece[] = collectedPieces.map((piece, i) => {
    const prevTile = i > 0 ? orderedTiles[i - 1] : 
                     (orderedTiles.length > 1 ? orderedTiles[orderedTiles.length - 1] : null);
    const currTile = orderedTiles[i];
    const nextTile = i < orderedTiles.length - 1 ? orderedTiles[i + 1] :
                     (orderedTiles.length > 1 ? orderedTiles[0] : null);
    
    return calculateCorrectDirection(prevTile, currTile, nextTile, piece);
  });
  
  return { tiles: orderedTiles, pieces: orderedPieces };
}

/**
 * Check if a track forms a complete loop (closed circuit).
 * A track is complete if the last piece's exit connects back to the first piece's entry.
 */
function isTrackComplete(
  tiles: { x: number; y: number }[],
  pieces: TrackPiece[]
): boolean {
  if (tiles.length < 4 || pieces.length < 4) {
    // Need at least 4 pieces to form a loop
    return false;
  }
  
  const firstTile = tiles[0];
  const lastTile = tiles[tiles.length - 1];
  const lastPiece = pieces[pieces.length - 1];
  
  // Get where the last piece exits to
  const exitDir = getExitDirection(lastPiece);
  const offset = getDirectionOffset(exitDir);
  const exitX = lastTile.x + offset.dx;
  const exitY = lastTile.y + offset.dy;
  
  // Check if the exit leads back to the first tile
  return exitX === firstTile.x && exitY === firstTile.y;
}

/**
 * Collect all track tiles for a coaster from the grid.
 * Returns tiles in connected order following the track direction.
 */
function collectCoasterTrack(grid: Tile[][], coasterId: string): { tiles: { x: number; y: number }[]; pieces: TrackPiece[] } {
  const gridSize = grid.length;

  // First, find all tiles with this coaster ID
  const coasterTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (tile.coasterTrackId === coasterId && tile.trackPiece) {
        coasterTiles.push({ x, y });
      }
    }
  }
  
  if (coasterTiles.length === 0) {
    return { tiles: [], pieces: [] };
  }
  
  // Try to find the best starting tile:
  // 1. Prefer a tile with an adjacent queue (station area)
  // 2. Prefer a tile with an adjacent station building
  // 3. Fall back to first tile found
  const adjacentOffsets = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  let startTile = coasterTiles[0];
  
  // Look for a tile with adjacent queue
  for (const { x, y } of coasterTiles) {
    let hasAdjacentQueue = false;
    for (const { dx, dy } of adjacentOffsets) {
      const adjX = x + dx;
      const adjY = y + dy;
      if (adjX >= 0 && adjY >= 0 && adjX < gridSize && adjY < gridSize) {
        const adjTile = grid[adjY]?.[adjX];
        if (adjTile?.queue) {
          hasAdjacentQueue = true;
          break;
        }
      }
    }
    if (hasAdjacentQueue) {
      startTile = { x, y };
      break;
    }
  }
  
  // If no queue found, look for adjacent station building
  if (startTile === coasterTiles[0]) {
    for (const { x, y } of coasterTiles) {
      let hasAdjacentStation = false;
      for (const { dx, dy } of adjacentOffsets) {
        const adjX = x + dx;
        const adjY = y + dy;
        if (adjX >= 0 && adjY >= 0 && adjX < gridSize && adjY < gridSize) {
          const adjTile = grid[adjY]?.[adjX];
          if (adjTile?.building?.type?.startsWith('station_')) {
            hasAdjacentStation = true;
            break;
          }
        }
      }
      if (hasAdjacentStation) {
        startTile = { x, y };
        break;
      }
    }
  }

  const visited = new Set<string>();
  const result = collectConnectedTrack(grid, startTile.x, startTile.y, visited);
  
  // Check if track needs to be reversed based on slope directions
  // For slopes, the original piece's direction and heights define "correct" travel direction
  // If we're traveling through most slopes in the wrong direction, reverse the whole track
  if (result.tiles.length >= 4) {
    let slopesCorrect = 0;  // We travel in the direction that matches original piece
    let slopesReversed = 0; // We travel opposite to original piece direction
    
    for (let i = 0; i < result.tiles.length; i++) {
      const tile = result.tiles[i];
      const originalPiece = grid[tile.y]?.[tile.x]?.trackPiece;
      
      // Only check slope pieces - they have clear directionality
      if (originalPiece && (originalPiece.type === 'slope_up_small' || originalPiece.type === 'slope_down_small')) {
        // Get the next tile to determine our travel direction through this piece
        const nextIdx = (i + 1) % result.tiles.length;
        if (nextIdx === 0 && i === result.tiles.length - 1) {
          // Last tile wrapping to first - only valid for closed loops
          // Skip this check if track might not be a closed loop
          continue;
        }
        const nextTile = result.tiles[nextIdx];
        const travelDx = nextTile.x - tile.x;
        const travelDy = nextTile.y - tile.y;
        
        // Get the original piece's exit direction (where train SHOULD exit for correct travel)
        const originalExitDir = getExitDirection(originalPiece);
        const originalExitOffset = getDirectionOffset(originalExitDir);
        
        // Check if we're traveling in the original's intended direction
        if (travelDx === originalExitOffset.dx && travelDy === originalExitOffset.dy) {
          slopesCorrect++;
        } else {
          slopesReversed++;
        }
      }
    }
    
    // If more slopes are reversed than correct, we need to reverse the whole track
    const needsReverse = slopesReversed > slopesCorrect;
    
    if (needsReverse) {
      // Reverse the track so slopes are traversed correctly
      // Use the ORIGINAL pieces from the grid and re-correct them for the new direction
      const reversedTiles = [...result.tiles].reverse();
      
      // Get original pieces from grid in reversed order
      const originalPiecesReversed = reversedTiles.map(tile => {
        const origPiece = grid[tile.y]?.[tile.x]?.trackPiece;
        if (!origPiece) throw new Error('Missing track piece');
        return { ...origPiece }; // Clone to avoid mutation
      });
      
      // Now correct each piece's direction for the new (reversed) travel order
      const reversedPieces = originalPiecesReversed.map((piece, i) => {
        const prevTile = i > 0 ? reversedTiles[i - 1] : 
                         (reversedTiles.length > 1 ? reversedTiles[reversedTiles.length - 1] : null);
        const currTile = reversedTiles[i];
        const nextTile = i < reversedTiles.length - 1 ? reversedTiles[i + 1] :
                         (reversedTiles.length > 1 ? reversedTiles[0] : null);
        
        return calculateCorrectDirection(prevTile, currTile, nextTile, piece);
      });
      
      return { tiles: reversedTiles, pieces: reversedPieces };
    }
  }
  
  return result;
}

/**
 * Find all disconnected track components on the grid and ensure each has its own coaster.
 * This fixes cases where multiple separate tracks share the same coasterTrackId.
 * Returns updated grid and coasters array.
 */
function ensureAllTracksHaveCoasters(
  grid: Tile[][],
  coasters: Coaster[]
): { grid: Tile[][]; coasters: Coaster[]; changed: boolean } {
  const gridSize = grid.length;
  const visited = new Set<string>();
  const newGrid = grid.map(row => row.map(tile => ({ ...tile })));
  let newCoasters = [...coasters];
  let changed = false;
  
  // Find all connected track components
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = newGrid[y][x];
      const key = `${x},${y}`;
      
      if (tile.trackPiece && !visited.has(key)) {
        // Found a track tile that hasn't been visited - collect its connected component
        const { tiles: componentTiles, pieces: componentPieces } = collectConnectedTrack(newGrid, x, y, visited);
        
        if (componentTiles.length === 0) continue;
        
        // Get the coaster ID from the first tile
        const firstTile = newGrid[componentTiles[0].y][componentTiles[0].x];
        const existingCoasterId = firstTile.coasterTrackId;
        
        // Check if there's already a coaster that matches this component
        let matchingCoaster = existingCoasterId 
          ? newCoasters.find(c => c.id === existingCoasterId)
          : null;
        
        // Check if the matching coaster's trackTiles match our component
        // (if not, there might be another disconnected component with the same ID)
        if (matchingCoaster) {
          const coasterTileSet = new Set(matchingCoaster.trackTiles.map(t => `${t.x},${t.y}`));
          const componentTileSet = new Set(componentTiles.map(t => `${t.x},${t.y}`));
          
          // If the sets don't match, we have a disconnected component
          const tilesMatch = coasterTileSet.size === componentTileSet.size &&
            [...coasterTileSet].every(k => componentTileSet.has(k));
          
          if (!tilesMatch) {
            // This component is disconnected from the coaster's main track
            // Create a new coaster for it
            matchingCoaster = null;
          }
        }
        
        if (!matchingCoaster) {
          // No matching coaster - create a new one
          const newCoasterId = generateUUID();
          changed = true;
          
          // Update all tiles in this component to use the new coaster ID
          for (const { x: tx, y: ty } of componentTiles) {
            newGrid[ty][tx].coasterTrackId = newCoasterId;
          }
          
          // Find the best station tile (one with adjacent queue or station building)
          const stationTile = findStationTile(newGrid, componentTiles, gridSize) || componentTiles[0];
          
          // Try to inherit the coaster type from the original coaster (if this is a split)
          const originalCoaster = existingCoasterId ? newCoasters.find(c => c.id === existingCoasterId) : null;
          const inheritedType: CoasterType = originalCoaster?.type ?? 'steel_sit_down';
          
          // Create a new coaster for this component
          const newCoaster = createDefaultCoaster(
            newCoasterId,
            stationTile,
            componentPieces.length,
            inheritedType
          );
          newCoaster.track = componentPieces;
          newCoaster.trackTiles = componentTiles;
          newCoaster.stationTileX = stationTile.x;
          newCoaster.stationTileY = stationTile.y;
          newCoaster.trains = createTrainsForCoaster(componentPieces.length, newCoaster.type);
          
          newCoasters.push(newCoaster);
        }
      }
    }
  }
  
  // Clean up coasters that no longer have any track
  const coasterIdsWithTrack = new Set<string>();
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = newGrid[y][x];
      if (tile.trackPiece && tile.coasterTrackId) {
        coasterIdsWithTrack.add(tile.coasterTrackId);
      }
    }
  }
  
  const filteredCoasters = newCoasters.filter(c => coasterIdsWithTrack.has(c.id));
  if (filteredCoasters.length !== newCoasters.length) {
    changed = true;
    newCoasters = filteredCoasters;
  }
  
  return { grid: newGrid, coasters: newCoasters, changed };
}

// Configuration for train creation
interface TrainConfig {
  numCars?: number;
  carSpacing?: number;
  startProgress?: number;
  guestsPerCar?: number;
}

/**
 * Normalize train positions when track length changes.
 * Ensures cars maintain proper spacing and positions are valid for the new track length.
 * Resets trains to station if track changed significantly.
 */
function normalizeTrainsForTrackChange(
  trains: CoasterTrain[],
  oldTrackLength: number,
  newTrackLength: number,
  stationIndex: number = 0
): CoasterTrain[] {
  if (newTrackLength === 0) return trains;
  
  const carSpacing = 0.18;
  
  return trains.map((train, trainIndex) => {
    // If track length changed, reset train to station to prevent weird positioning
    // This keeps behavior predictable when editing tracks
    const trainOffset = trainIndex * 8; // Space trains apart on the track
    const baseProgress = (stationIndex + trainOffset) % newTrackLength;
    
    const normalizedCars = train.cars.map((car, carIndex) => {
      // Reset each car to proper spacing from the train's base position
      let newProgress = (baseProgress + carIndex * carSpacing) % newTrackLength;
      if (newProgress < 0) newProgress += newTrackLength;
      
      return {
        ...car,
        trackProgress: newProgress,
        velocity: 0, // Stop the train when track is edited
      };
    });
    
    return {
      ...train,
      cars: normalizedCars,
      state: 'loading' as const, // Reset to loading state at station
      stateTimer: 3 + Math.random() * 2, // Short loading time after reset
    };
  });
}

function createDefaultTrain(config: TrainConfig = {}): CoasterTrain {
  const numCars = config.numCars ?? 6;
  const carSpacing = config.carSpacing ?? 0.18; // Spacing between cars
  const startProgress = config.startProgress ?? 0;
  const guestsPerCar = config.guestsPerCar ?? 4;
  const baseVelocity = 0.06;
  
  const cars: CoasterCar[] = [];
  for (let i = 0; i < numCars; i++) {
    cars.push({
      trackProgress: startProgress + i * carSpacing,
      velocity: baseVelocity,
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      screenX: 0,
      screenY: 0,
      screenZ: 0,
      guests: [], // Will be filled during loading
    });
  }

  return {
    id: generateUUID(),
    cars,
    state: 'loading', // Start in loading state at station
    stateTimer: 5 + Math.random() * 3, // 5-8 seconds loading time
  };
}

/**
 * Create multiple trains for a coaster based on track length and coaster type
 * Uses the coaster type stats to determine min/max trains and scales by track length
 */
function createTrainsForCoaster(trackLength: number, coasterType: string = 'steel_sit_down'): CoasterTrain[] {
  if (trackLength === 0) return [createDefaultTrain()];
  
  // Get coaster type stats for train limits
  const typeStats = COASTER_TYPE_STATS[coasterType as CoasterType];
  const minTrains = typeStats?.trainsPerTrack?.min ?? 1;
  const maxTrains = typeStats?.trainsPerTrack?.max ?? 3;
  const minCars = typeStats?.trainLength?.min ?? 4;
  const maxCars = typeStats?.trainLength?.max ?? 8;
  
  // Calculate number of trains based on track length
  // Scale linearly from min at 8 tiles to max at 30+ tiles
  let numTrains: number;
  if (trackLength <= 8) {
    numTrains = minTrains;
  } else if (trackLength >= 30) {
    numTrains = maxTrains;
  } else {
    // Linear interpolation between min and max
    const t = (trackLength - 8) / (30 - 8);
    numTrains = Math.round(minTrains + t * (maxTrains - minTrains));
  }
  
  // Clamp to coaster type limits
  numTrains = Math.max(minTrains, Math.min(maxTrains, numTrains));
  
  // Ensure minimum spacing between trains (at least 12 tiles per train for safety)
  const minSpacingPerTrain = 12;
  const maxTrainsForSpacing = Math.max(1, Math.floor(trackLength / minSpacingPerTrain));
  numTrains = Math.min(numTrains, maxTrainsForSpacing);
  
  // Calculate cars per train based on track length (longer tracks = longer trains)
  // Use smaller trains for better visual appearance
  let numCars: number;
  if (trackLength <= 15) {
    numCars = Math.max(2, minCars - 2); // Smaller trains for short tracks
  } else if (trackLength >= 50) {
    numCars = Math.min(6, maxCars); // Cap at 6 cars even for long tracks
  } else {
    const t = (trackLength - 15) / (50 - 15);
    numCars = Math.round(2 + t * 4); // Scale from 2 to 6 cars
  }
  numCars = Math.max(2, Math.min(6, numCars));
  
  const trains: CoasterTrain[] = [];
  for (let i = 0; i < numTrains; i++) {
    // Space trains evenly around the track
    const startProgress = (i * trackLength) / numTrains;
    const train = createDefaultTrain({ 
      startProgress,
      numCars,
    });
    // First train starts loading, others running
    train.state = i === 0 ? 'loading' : 'running';
    train.stateTimer = i === 0 ? (5 + Math.random() * 3) : 0; // 5-8 second stop at station for loading
    trains.push(train);
  }
  
  return trains;
}

/** Unique colors for each coaster type - gives each coaster its own distinct look */
const COASTER_TYPE_COLORS: Record<CoasterType, { primary: string; secondary: string; supports: string }> = {
  // Wooden coasters - natural wood tones
  wooden_classic: { primary: '#8B4513', secondary: '#D2691E', supports: '#5C3317' },    // Classic brown wood
  wooden_twister: { primary: '#A0522D', secondary: '#CD853F', supports: '#654321' },    // Sienna/tan wood
  
  // Steel coasters - vibrant modern colors
  steel_sit_down: { primary: '#dc2626', secondary: '#fbbf24', supports: '#374151' },    // Classic red/yellow
  steel_standup: { primary: '#7c3aed', secondary: '#c084fc', supports: '#4c1d95' },     // Purple/violet
  steel_inverted: { primary: '#2563eb', secondary: '#60a5fa', supports: '#1e3a8a' },    // Blue scheme
  steel_floorless: { primary: '#059669', secondary: '#34d399', supports: '#064e3b' },   // Emerald green
  steel_wing: { primary: '#ea580c', secondary: '#fb923c', supports: '#7c2d12' },        // Orange/flame
  steel_flying: { primary: '#0891b2', secondary: '#22d3ee', supports: '#164e63' },      // Cyan/sky
  steel_4d: { primary: '#be123c', secondary: '#fb7185', supports: '#881337' },          // Rose/magenta
  steel_spinning: { primary: '#65a30d', secondary: '#a3e635', supports: '#365314' },    // Lime green
  launch_coaster: { primary: '#e11d48', secondary: '#fda4af', supports: '#9f1239' },    // Hot pink/red
  hyper_coaster: { primary: '#0d9488', secondary: '#5eead4', supports: '#134e4a' },     // Teal
  giga_coaster: { primary: '#4f46e5', secondary: '#a5b4fc', supports: '#312e81' },      // Indigo
  
  // Water coaster - aquatic blues
  water_coaster: { primary: '#0ea5e9', secondary: '#38bdf8', supports: '#0c4a6e' },     // Sky blue
  
  // Specialty coasters - themed colors
  mine_train: { primary: '#92400e', secondary: '#fcd34d', supports: '#451a03' },        // Rust/gold (mining theme)
  bobsled: { primary: '#1d4ed8', secondary: '#93c5fd', supports: '#1e3a8a' },           // Ice blue
  suspended: { primary: '#b45309', secondary: '#fcd34d', supports: '#78350f' },         // Amber/bronze
};

function createDefaultCoaster(
  id: string, 
  startTile: { x: number; y: number }, 
  trackLength: number = 0,
  coasterType: CoasterType = 'steel_sit_down'
): Coaster {
  const colors = COASTER_TYPE_COLORS[coasterType] ?? COASTER_TYPE_COLORS.steel_sit_down;
  const typeStats = COASTER_TYPE_STATS[coasterType];
  
  return {
    id,
    name: typeStats?.name ?? 'Custom Coaster',
    type: coasterType,
    color: colors,
    track: [],
    trackTiles: [],
    stationTileX: startTile.x,
    stationTileY: startTile.y,
    trains: createTrainsForCoaster(trackLength, coasterType),
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

export function CoasterProvider({
  children,
  startFresh = false,
  loadParkId = null,
}: {
  children: React.ReactNode;
  startFresh?: boolean;
  loadParkId?: string | null;
}) {
  const [state, setState] = useState<GameState>(() => createInitialGameState());
  const [isStateReady, setIsStateReady] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const latestStateRef = useRef<GameState>(state);
  
  // Keep ref in sync
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);
  
  // Async version that uses Web Worker for compression (no main thread blocking)
  const persistCoasterSaveAsync = useCallback(async (stateToSave: GameState): Promise<boolean> => {
    try {
      const [autosaveOk, parkOk] = await Promise.all([
        saveCoasterStateToStorageAsync(COASTER_AUTOSAVE_KEY, stateToSave),
        saveCoasterStateToStorageAsync(`${COASTER_SAVED_PARK_PREFIX}${stateToSave.id}`, stateToSave),
      ]);
      if (!autosaveOk && !parkOk) return false;

      const meta = buildSavedParkMeta(stateToSave);
      const updatedIndex = upsertSavedParkMeta(meta, readSavedParksIndex());
      writeSavedParksIndex(updatedIndex);
      return true;
    } catch (e) {
      console.error('Failed to persist coaster save:', e);
      return false;
    }
  }, []);

  // Sync version for immediate saves (fallback, used on initial load)
  const persistCoasterSave = useCallback((stateToSave: GameState): boolean => {
    const autosaveOk = saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, stateToSave);
    const parkOk = saveCoasterStateToStorage(`${COASTER_SAVED_PARK_PREFIX}${stateToSave.id}`, stateToSave);
    if (!autosaveOk && !parkOk) return false;

    const meta = buildSavedParkMeta(stateToSave);
    const updatedIndex = upsertSavedParkMeta(meta, readSavedParksIndex());
    writeSavedParksIndex(updatedIndex);
    return true;
  }, []);

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
        const preferredKey = loadParkId
          ? `${COASTER_SAVED_PARK_PREFIX}${loadParkId}`
          : COASTER_AUTOSAVE_KEY;
        let parsed = loadCoasterStateFromStorage(preferredKey);

        if (!parsed && loadParkId) {
          parsed = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
        }

        if (parsed && parsed.grid && parsed.gridSize) {
          const normalizedState = normalizeLoadedState(parsed);
          // Fix any disconnected tracks that share the same coasterTrackId
          const { grid: fixedGrid, coasters: fixedCoasters } = ensureAllTracksHaveCoasters(
            normalizedState.grid,
            normalizedState.coasters
          );
          const finalState = {
            ...normalizedState,
            grid: fixedGrid,
            coasters: fixedCoasters,
          };
          setState(finalState);
          setHasSavedGame(true);
          // Ensure this save appears in the saved parks index
          persistCoasterSave(finalState);
        }
      } catch (e) {
        console.error('Failed to load coaster game state:', e);
      }
      
      setIsStateReady(true);
    };
    
    checkSaved();
  }, [startFresh, loadParkId, persistCoasterSave]);
  
  // Fix disconnected tracks after state is ready (handles existing sessions)
  useEffect(() => {
    if (!isStateReady) return;
    
    setState(prev => {
      const { grid: fixedGrid, coasters: fixedCoasters, changed } = ensureAllTracksHaveCoasters(
        prev.grid,
        prev.coasters
      );
      
      if (changed) {
        console.log('Fixed disconnected coaster tracks');
        return {
          ...prev,
          grid: fixedGrid,
          coasters: fixedCoasters,
        };
      }
      return prev;
    });
  }, [isStateReady]);
  
  // Auto-save periodically using async worker-based save (no stuttering!)
  useEffect(() => {
    if (!isStateReady) return;
    
    const saveInterval = setInterval(() => {
      // Use async save to avoid blocking main thread during compression
      persistCoasterSaveAsync(latestStateRef.current).catch((e) => {
        console.error('Failed to auto-save:', e);
      });
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(saveInterval);
  }, [isStateReady, persistCoasterSaveAsync]);
  
  // Simulation tick
  useEffect(() => {
    if (!isStateReady || state.speed === 0) return;
    
    const tickInterval = [0, 100, 50, 25][state.speed]; // ms per tick
    
    const interval = setInterval(() => {
      setState(prev => {
        const newTick = prev.tick + 1;
        let { minute, hour, day, month, year } = prev;
        
        // Time progression - slower during day to make daytime last longer
        // During day (7-18): advance 0.25 minutes per tick (longer days)
        // During night/dawn/dusk: advance 3 minutes per tick (faster to get through night)
        const isDaytime = hour >= 7 && hour < 18;
        const minuteIncrement = isDaytime ? 0.25 : 3; // Much slower during day, faster at night
        
        minute += minuteIncrement;
        if (minute >= 60) {
          minute = minute - 60;
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
        
        // Update weather
        const newWeather = simulateWeather(prev.weather, newTick, month);
        const weatherEffects = WEATHER_EFFECTS[newWeather.current];
        
        // Update guests with weather effects
        const deltaTime = 1; // 1 game minute per tick
        const updatedGuestsBase = prev.guests.map(guest => updateGuest(guest, prev.grid, deltaTime));
        
        // Apply weather effects to guests and check if they want to leave
        const updatedGuests = updatedGuestsBase.map(guest => {
          const weatheredGuest = applyWeatherEffectsToGuest(guest, newWeather.current);
          
          // Check if guest decides to leave due to weather (rare)
          // Only affects walking guests who are already unhappy
          if (weatheredGuest.state === 'walking' && shouldGuestLeaveForWeather(weatheredGuest, newWeather.current)) {
            return {
              ...weatheredGuest,
              state: 'leaving' as const,
              thoughts: [...weatheredGuest.thoughts.slice(-4), 'want_to_go_home' as const],
            };
          }
          
          return weatheredGuest;
        }); // Don't filter out guests here - let them leave naturally through the exit
        
        // Spawn guests (affected by weather)
        const baseSpawnedGuests = spawnGuests(prev.grid, updatedGuests, prev.stats.parkRating, hour);

        // Apply weather spawn multiplier probabilistically
        // Since spawns are typically 0-1 guests, we need to treat the multiplier as a probability
        // e.g., multiplier of 0.85 means 85% chance to keep each spawned guest
        const spawnedGuestsRaw = baseSpawnedGuests.filter(() => 
          Math.random() < weatherEffects.guestSpawnMultiplier
        );
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

        // Update coaster trains with state machine and station logic
        // First, aggressively clean up coasters - recollect track from grid to get current state
        const cleanedCoasters: Coaster[] = [];
        for (const coaster of prev.coasters) {
          // Always recollect from grid to ensure we have current data
          const { tiles: currentTiles, pieces: currentPieces } = collectCoasterTrack(prev.grid, coaster.id);
          
          // If no valid track exists, skip this coaster entirely
          if (currentTiles.length === 0) continue;
          
          // Check if track changed - if so, regenerate trains
          const trackChanged = currentTiles.length !== coaster.trackTiles.length ||
            currentTiles.some((t, i) => t.x !== coaster.trackTiles[i]?.x || t.y !== coaster.trackTiles[i]?.y);
          
          if (trackChanged) {
            // Track changed - regenerate everything
            const stationTile = findStationTile(prev.grid, currentTiles, prev.gridSize) || currentTiles[0];
            const stationIdx = currentTiles.findIndex(t => t.x === stationTile.x && t.y === stationTile.y);
            const effectiveStationIdx = stationIdx >= 0 ? stationIdx : 0;
            
            const newTrains = createTrainsForCoaster(currentPieces.length, coaster.type).map((train, trainIndex) => {
              const trainOffset = (trainIndex * currentPieces.length) / Math.max(1, createTrainsForCoaster(currentPieces.length, coaster.type).length);
              const baseProgress = (effectiveStationIdx + trainOffset) % currentPieces.length;
              return {
                ...train,
                cars: train.cars.map((car, carIndex) => ({
                  ...car,
                  trackProgress: (baseProgress + carIndex * 0.18) % currentPieces.length,
                })),
              };
            });
            
            cleanedCoasters.push({
              ...coaster,
              track: currentPieces,
              trackTiles: currentTiles,
              stationTileX: stationTile.x,
              stationTileY: stationTile.y,
              trains: newTrains,
            });
          } else {
            cleanedCoasters.push(coaster);
          }
        }
        
        const updatedCoasters = cleanedCoasters.map(coaster => {
          if (coaster.track.length === 0 || coaster.trains.length === 0) return coaster;
          const trackLength = coaster.track.length;
          
          // Only run trains if the track forms a complete loop
          const trackComplete = isTrackComplete(coaster.trackTiles, coaster.track);
          if (!trackComplete) {
            // Track is incomplete - reset all trains to proper positions at start of track
            // This prevents "stuck" cars from appearing in random positions
            const carSpacing = 0.18;
            const resetTrains = coaster.trains.map((train, trainIndex) => {
              const trainOffset = (trainIndex * trackLength) / Math.max(1, coaster.trains.length);
              return {
                ...train,
                state: 'loading' as const,
                stateTimer: 8,
                cars: train.cars.map((car, carIndex) => ({
                  ...car,
                  trackProgress: (trainOffset + carIndex * carSpacing) % trackLength,
                  velocity: 0,
                })),
              };
            });
            return { ...coaster, trains: resetTrains };
          }
          
          // Find station position - the tile with an adjacent queue
          const stationIndex = coaster.trackTiles.findIndex(
            t => t.x === coaster.stationTileX && t.y === coaster.stationTileY
          );
          const effectiveStationIndex = stationIndex >= 0 ? stationIndex : 0;
          const stationRange = { min: effectiveStationIndex, max: effectiveStationIndex + 1.5 }; // Train is "at station" if lead car is in this range
          
          // Helper function to check if a position is within the station range (handles wrap-around)
          const isPositionAtStation = (progress: number): boolean => {
            const normalizedProgress = ((progress % trackLength) + trackLength) % trackLength;
            // Check if within range directly
            if (normalizedProgress >= stationRange.min && normalizedProgress <= stationRange.max) {
              return true;
            }
            // Handle wrap-around case: station spans across track boundary (e.g., station at index 0)
            if (stationRange.min < 2) {
              // Check if we're at the end of the track, close enough to wrap to station
              const distanceToStationViaWrap = trackLength - normalizedProgress + stationRange.min;
              if (distanceToStationViaWrap <= 0.5 && distanceToStationViaWrap >= 0) {
                return true;
              }
            }
            return false;
          };
          
          const updatedTrains = coaster.trains.map((train, trainIndex) => {
            let { state, stateTimer, cars } = train;
            stateTimer -= deltaTime;
            
            const carSpacing = 0.18;
            
            // Validate all car positions - fix any invalid values
            let hasInvalidCar = false;
            for (const car of cars) {
              if (!Number.isFinite(car.trackProgress) || car.trackProgress < 0 || car.trackProgress > trackLength * 10) {
                hasInvalidCar = true;
                break;
              }
            }
            
            if (hasInvalidCar) {
              // Reset all cars to proper positions at station
              cars = cars.map((car, idx) => ({
                ...car,
                trackProgress: (effectiveStationIndex + idx * carSpacing) % trackLength,
                velocity: 0,
              }));
              state = 'loading';
              stateTimer = 5 + Math.random() * 3; // 5-8 second stop at station
            }
            
            // Get lead car's position
            const leadCar = cars[0];
            const leadProgress = leadCar.trackProgress % trackLength;
            const isAtStation = isPositionAtStation(leadProgress);
            
            // Check for other trains ahead (collision avoidance)
            const hasTrainAhead = coaster.trains.some((otherTrain, idx) => {
              if (idx === trainIndex) return false;
              const otherLead = otherTrain.cars[0].trackProgress % trackLength;
              const distance = (otherLead - leadProgress + trackLength) % trackLength;
              return distance < 4 && distance > 0; // Within 4 tiles ahead
            });
            
            // Validate car spacing - if cars have drifted apart, reset them
            const maxCarDrift = carSpacing * 1.5; // Allow 50% variance before resetting
            let needsSpacingReset = false;
            for (let i = 1; i < cars.length; i++) {
              const prevCar = cars[i - 1];
              const currCar = cars[i];
              const expectedDiff = carSpacing;
              const actualDiff = (currCar.trackProgress - prevCar.trackProgress + trackLength) % trackLength;
              // If difference is more than half the track, the car wrapped around
              const normalizedDiff = actualDiff > trackLength / 2 ? trackLength - actualDiff : actualDiff;
              if (Math.abs(normalizedDiff - expectedDiff) > maxCarDrift) {
                needsSpacingReset = true;
                break;
              }
            }
            
            if (needsSpacingReset) {
              // Reset cars to proper spacing from lead car
              const leadProgress = cars[0].trackProgress;
              cars = cars.map((car, idx) => ({
                ...car,
                trackProgress: (leadProgress + idx * carSpacing) % trackLength,
                velocity: car.velocity,
              }));
            }
            
            // State machine for train operation
            switch (state) {
              case 'loading':
                // Stay at station loading guests
                if (stateTimer <= 0) {
                  state = 'dispatching';
                  stateTimer = 2; // 2 second dispatch
                }
                // Keep train stationary at station - maintain proper car positions
                cars = cars.map((car, idx) => ({
                  ...car,
                  trackProgress: (effectiveStationIndex + idx * carSpacing) % trackLength,
                  velocity: 0,
                }));
                break;
                
              case 'dispatching':
                // Accelerating from station
                if (stateTimer <= 0) {
                  state = 'running';
                  stateTimer = 0;
                }
                // Slow acceleration - boost velocity at higher game speeds for visual feedback
                const speedBoostDispatch = [1, 1, 1.5, 2.0][prev.speed];
                const baseDispatchVelocity = (0.02 + (1 - stateTimer / 2) * 0.04) * speedBoostDispatch;
                cars = cars.map(car => {
                  // Check if car is on a loop - slow down on loops
                  const carTrackIdx = Math.floor(car.trackProgress % trackLength);
                  const trackPiece = coaster.track[carTrackIdx];
                  const isOnLoop = trackPiece?.type === 'loop_vertical';
                  const velocityMultiplier = isOnLoop ? 0.5 : 1.0;
                  const dispatchVelocity = baseDispatchVelocity * velocityMultiplier;
                  
                  let nextProgress = car.trackProgress + dispatchVelocity * deltaTime;
                  nextProgress = nextProgress % trackLength;
                  if (nextProgress < 0) nextProgress += trackLength;
                  return { ...car, trackProgress: nextProgress, velocity: dispatchVelocity };
                });
                break;
                
              case 'running':
                // Check if approaching station and should brake
                const distanceToStation = (effectiveStationIndex - leadProgress + trackLength) % trackLength;
                const shouldBrake = distanceToStation < 3 && distanceToStation > 0.5;
                
                if (shouldBrake || hasTrainAhead) {
                  state = 'braking';
                  stateTimer = 0;
                } else {
                  // Normal running speed - boost velocity at higher game speeds for visual feedback
                  const speedBoostRun = [1, 1, 1.5, 2.0][prev.speed];
                  const baseRunVelocity = (hasTrainAhead ? 0.02 : 0.06) * speedBoostRun;
                  cars = cars.map(car => {
                    // Check if car is on a loop - loops are much longer so slow down
                    const carTrackIdx = Math.floor(car.trackProgress % trackLength);
                    const trackPiece = coaster.track[carTrackIdx];
                    const isOnLoop = trackPiece?.type === 'loop_vertical';
                    // Loops are ~3x longer than straight, so reduce speed
                    const velocityMultiplier = isOnLoop ? 0.5 : 1.0;
                    const runVelocity = baseRunVelocity * velocityMultiplier;
                    
                    let nextProgress = car.trackProgress + runVelocity * deltaTime;
                    nextProgress = nextProgress % trackLength;
                    if (nextProgress < 0) nextProgress += trackLength;
                    return { ...car, trackProgress: nextProgress, velocity: runVelocity };
                  });
                }
                break;
                
              case 'braking':
                // Slow down approaching station - boost velocity at higher game speeds for visual feedback
                const speedBoostBrake = [1, 1, 1.5, 2.0][prev.speed];
                const baseBrakeVelocity = (hasTrainAhead ? 0.01 : 0.03) * speedBoostBrake;
                const leadProgressNow = cars[0].trackProgress % trackLength;
                const atStation = isPositionAtStation(leadProgressNow);
                
                if (atStation && !hasTrainAhead) {
                  state = 'loading';
                  stateTimer = 5 + Math.random() * 3; // 5-8 seconds stop at station for loading
                  // Snap to station position (use actual station index, not always 0)
                  cars = cars.map((car, idx) => ({
                    ...car,
                    trackProgress: (effectiveStationIndex + idx * 0.18) % trackLength,
                    velocity: 0,
                  }));
                } else if (hasTrainAhead) {
                  // Wait for train ahead to clear
                  cars = cars.map(car => ({ ...car, velocity: 0 }));
                } else {
                  cars = cars.map(car => {
                    // Check if car is on a loop - slow down on loops
                    const carTrackIdx = Math.floor(car.trackProgress % trackLength);
                    const trackPiece = coaster.track[carTrackIdx];
                    const isOnLoop = trackPiece?.type === 'loop_vertical';
                    const velocityMultiplier = isOnLoop ? 0.5 : 1.0;
                    const brakeVelocity = baseBrakeVelocity * velocityMultiplier;
                    
                    let nextProgress = car.trackProgress + brakeVelocity * deltaTime;
                    nextProgress = nextProgress % trackLength;
                    if (nextProgress < 0) nextProgress += trackLength;
                    return { ...car, trackProgress: nextProgress, velocity: brakeVelocity };
                  });
                }
                break;
                
              case 'returning':
                // Legacy state - treat as running
                state = 'running';
                break;
            }
            
            return { ...train, state, stateTimer, cars };
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
          weather: newWeather,
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
      
      // Get tool info for cost
      const toolInfo = TOOL_INFO[tool];
      if (!toolInfo) return prev;
      
      // Check if we can afford it
      if (prev.finances.cash < toolInfo.cost) return prev;
      
      // Handle water terraform - turn land into water
      if (tool === 'zone_water') {
        // Already water - do nothing
        if (tile.terrain === 'water') return prev;
        // Don't terraform if there's a building/path/track
        if (tile.building.type !== 'empty' && tile.building.type !== 'grass') return prev;
        if (tile.path || tile.queue || tile.hasCoasterTrack) return prev;
        
        tile.terrain = 'water';
        tile.building = { ...createEmptyBuilding(), type: 'water' };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      // Handle land terraform - turn water into land
      if (tool === 'zone_land') {
        // Only works on water
        if (tile.terrain !== 'water') return prev;
        
        tile.terrain = 'grass';
        tile.building = { ...createEmptyBuilding(), type: 'grass' };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      // Don't build on water (except for some specific things)
      if (tile.terrain === 'water') return prev;
      
      // Handle path placement
      if (tool === 'path') {
        // Don't place path on existing buildings, tracks, or footprints
        const existingType = tile.building?.type;
        if (existingType && existingType !== 'empty' && existingType !== 'grass' && existingType !== 'path') return prev;
        if (tile.trackPiece || tile.hasCoasterTrack) return prev;
        
        tile.path = true;
        tile.building = { ...createEmptyBuilding(), type: 'path' };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      // Handle queue placement
      if (tool === 'queue') {
        // Don't place queue on existing buildings, tracks, or footprints
        const existingType = tile.building?.type;
        if (existingType && existingType !== 'empty' && existingType !== 'grass' && existingType !== 'queue') return prev;
        if (tile.trackPiece || tile.hasCoasterTrack) return prev;
        
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
        // When multiple adjacent tracks exist, prefer the one that matches the build path
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
        
        type AdjacentCandidate = {
          adjX: number;
          adjY: number;
          baseDirection: TrackDirection;
          baseHeight: number;
          connectingToEntry: boolean;
          targetEntryHeight: number;
          isExitConnection: boolean;
        };
        
        const candidates: AdjacentCandidate[] = [];
        
        for (const { dx, dy } of adjacentOffsets) {
          const adjX = x + dx;
          const adjY = y + dy;
          if (adjX >= 0 && adjY >= 0 && adjX < prev.gridSize && adjY < prev.gridSize) {
            const adjTile = prev.grid[adjY]?.[adjX];
            if (adjTile?.trackPiece) {
              const adjPiece = adjTile.trackPiece;
              
              // Calculate entry and exit directions for the adjacent piece
              // Turns store entry direction; straights/slopes store exit direction.
              const isFlatTurn =
                adjPiece.type === 'turn_left_flat' ||
                adjPiece.type === 'turn_right_flat' ||
                adjPiece.type === 'turn_left_large_flat' ||
                adjPiece.type === 'turn_right_large_flat';
              const entryDir = isFlatTurn ? adjPiece.direction : OPPOSITE_DIRECTION[adjPiece.direction];
              
              // Exit direction depends on track type
              let exitDir = adjPiece.direction;
              if (adjPiece.type === 'turn_left_flat' || adjPiece.type === 'turn_left_large_flat') {
                exitDir = rotateDirection(adjPiece.direction, 'left');
              } else if (adjPiece.type === 'turn_right_flat' || adjPiece.type === 'turn_right_large_flat') {
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
                candidates.push({
                  adjX,
                  adjY,
                  baseDirection: exitDir,
                  baseHeight: adjPiece.endHeight,
                  connectingToEntry: false,
                  targetEntryHeight: adjPiece.startHeight,
                  isExitConnection: true,
                });
              } else if (entryPointsToUs) {
                candidates.push({
                  adjX,
                  adjY,
                  baseDirection: OPPOSITE_DIRECTION[entryDir],
                  baseHeight: adjPiece.startHeight,
                  connectingToEntry: true,
                  targetEntryHeight: adjPiece.startHeight,
                  isExitConnection: false,
                });
              }
            }
          }
        }
        
        if (candidates.length > 0) {
          const lastTileMatch = lastTile
            ? candidates.find(candidate =>
                candidate.adjX === lastTile.x &&
                candidate.adjY === lastTile.y &&
                candidate.isExitConnection
              )
            : null;
          
          const directionMatch = deltaDir
            ? candidates.find(candidate =>
                candidate.baseDirection === deltaDir && candidate.isExitConnection
              )
            : null;
          
          const exitCandidates = candidates.filter(candidate => candidate.isExitConnection);
          const heightSorted = (list: AdjacentCandidate[]) =>
            list.slice().sort((a, b) =>
              Math.abs(a.baseHeight - prev.buildingCoasterHeight) -
              Math.abs(b.baseHeight - prev.buildingCoasterHeight)
            );
          
          const chosen = lastTileMatch
            ?? directionMatch
            ?? heightSorted(exitCandidates)[0]
            ?? heightSorted(candidates)[0];
          
          adjacentDirection = chosen.baseDirection;
          adjacentHeight = chosen.baseHeight;
          connectingToEntry = chosen.connectingToEntry;
          targetEntryHeight = chosen.targetEntryHeight;
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
              startDirection = OPPOSITE_DIRECTION[adjacentDirection];
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
              startDirection = OPPOSITE_DIRECTION[adjacentDirection];
            }
          }
          endDirection = rotateDirection(startDirection, 'right');
        } else if (tool === 'coaster_slope_up') {
          pieceType = 'slope_up_small';
          // For slopes, drawSlopeTrack interprets direction as the EXIT direction:
          // direction='south' → enter from north (at startHeight), exit to south (at endHeight)
          //
          // For slope_up: startHeight < endHeight, so the slope rises toward the exit.
          //
          // When connecting to existing track:
          // - Exit connection: adjacent exits toward us, we receive at our entry
          // - Entry connection: we feed into adjacent's entry
          // adjacentDirection already matches travel direction in both cases.
          if (adjacentDirection) {
            // For both entry/exit connections, adjacentDirection already matches travel direction.
            startDirection = adjacentDirection;
          }
          if (connectingToEntry && targetEntryHeight > 0) {
            endHeight = targetEntryHeight;
            startHeight = clampHeight(targetEntryHeight - 1);
          } else {
            endHeight = clampHeight(startHeight + 1);
          }
          chainLift = true;
        } else if (tool === 'coaster_slope_down') {
          pieceType = 'slope_down_small';
          // For slope_down, direction logic is the SAME as slope_up:
          // adjacentDirection already matches travel direction for entry/exit connections.
          if (adjacentDirection) {
            // For both entry/exit connections, adjacentDirection already matches travel direction.
            startDirection = adjacentDirection;
          }
          if (connectingToEntry && targetEntryHeight < 10) {
            endHeight = targetEntryHeight;
            startHeight = clampHeight(targetEntryHeight + 1);
          } else {
            // Going down: start high, end low
            endHeight = clampHeight(startHeight - 1);
          }
          chainLift = false;
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
        if (tool === 'coaster_build' && lastTile && deltaDir && buildPath.length > 1) {
          const prevPathTile = buildPath[buildPath.length - 2];
          const incomingDir = directionFromDelta(lastTile.x - prevPathTile.x, lastTile.y - prevPathTile.y);
          if (incomingDir && incomingDir !== deltaDir) {
            const entryDir = OPPOSITE_DIRECTION[incomingDir];
            const turnType: TrackPieceType =
              rotateDirection(entryDir, 'right') === deltaDir
                ? 'turn_right_flat'
                : 'turn_left_flat';
            const previousTile = newGrid[lastTile.y][lastTile.x];
            // Get coaster type for strut style - prefer buildingCoasterType, fall back to existing coaster
            const existingCoasterForStrut = prev.coasters.find(c => c.id === prev.buildingCoasterId);
            const coasterTypeForStrut: CoasterType = prev.buildingCoasterType ?? existingCoasterForStrut?.type ?? 'steel_sit_down';
            previousTile.trackPiece = {
              type: turnType,
              direction: entryDir,
              startHeight: clampHeight(prev.buildingCoasterHeight),
              endHeight: clampHeight(prev.buildingCoasterHeight),
              bankAngle: 0,
              chainLift: false,
              boosted: false,
              strutStyle: getStrutStyleForCoasterType(coasterTypeForStrut),
            };
            previousTile.hasCoasterTrack = true;
          }
        }
        
        // Determine if this tile is connected to any existing track with buildingCoasterId
        // If not connected and buildingCoasterId exists, we're starting a NEW track - generate new ID
        let coasterId = prev.buildingCoasterId ?? generateUUID();
        let startedNewCoaster = false;
        
        if (prev.buildingCoasterId) {
          // Check if this tile is adjacent to any existing track with this coaster ID
          const hasConnectedTrack = adjacentOffsets.some(({ dx, dy }) => {
            const adjX = x + dx;
            const adjY = y + dy;
            if (adjX >= 0 && adjY >= 0 && adjX < prev.gridSize && adjY < prev.gridSize) {
              const adjTile = prev.grid[adjY]?.[adjX];
              return adjTile?.coasterTrackId === prev.buildingCoasterId;
            }
            return false;
          });
          
          // Also check if we're on the building path (continuing from where we left off)
          const isOnBuildingPath = prev.buildingCoasterPath.some(p => {
            // Check if this tile is adjacent to any tile on the path
            return adjacentOffsets.some(({ dx, dy }) => {
              return p.x === x + dx && p.y === y + dy;
            });
          }) || prev.buildingCoasterPath.length === 0;
          
          // If not connected to existing track AND not continuing the building path, start a NEW coaster
          if (!hasConnectedTrack && !isOnBuildingPath) {
            coasterId = generateUUID();
            startedNewCoaster = true;
          }
          
          // Check if we're trying to extend an existing coaster with an incompatible type
          // If the buildingCoasterType is set and differs from the existing coaster's category, start new
          if (!startedNewCoaster && prev.buildingCoasterType) {
            const existingCoaster = prev.coasters.find(c => c.id === coasterId);
            if (existingCoaster && !areCoasterTypesCompatible(prev.buildingCoasterType, existingCoaster.type)) {
              // Incompatible coaster types - start a new coaster
              coasterId = generateUUID();
              startedNewCoaster = true;
            }
          }
        }
        
        // Get coaster type for strut style - prefer buildingCoasterType, fall back to existing coaster
        const existingCoasterForStyle = prev.coasters.find(c => c.id === coasterId);
        const coasterTypeForStyle: CoasterType = prev.buildingCoasterType ?? existingCoasterForStyle?.type ?? 'steel_sit_down';
        const trackPiece: TrackPiece = {
          type: pieceType,
          direction: startDirection,
          startHeight: clampHeight(startHeight),
          endHeight: clampHeight(endHeight),
          bankAngle: 0,
          chainLift,
          boosted: false,
          strutStyle: getStrutStyleForCoasterType(coasterTypeForStyle),
        };
        
        tile.trackPiece = trackPiece;
        tile.hasCoasterTrack = true;
        tile.coasterTrackId = coasterId;
        
        // If we started a new coaster, reset the path; otherwise append to existing path
        const updatedPath = startedNewCoaster
          ? [{ x, y }]
          : (buildPath.some(point => point.x === x && point.y === y)
              ? buildPath
              : [...buildPath, { x, y }]);
        
        // Collect ALL track tiles for this coaster from the grid (not just building path)
        const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);
        
        // IMPORTANT: Unify coaster IDs when connecting separate tracks
        // collectConnectedTrack follows physical connections regardless of coasterTrackId,
        // so the collected tiles may have different IDs. We need to:
        // 1. Unify all tiles in the connected component to use our coasterId
        // 2. Track which other coaster IDs were absorbed so we can remove their coasters
        const absorbedCoasterIds = new Set<string>();
        for (const { x: tx, y: ty } of trackTiles) {
          const gridTile = newGrid[ty][tx];
          if (gridTile.coasterTrackId && gridTile.coasterTrackId !== coasterId) {
            absorbedCoasterIds.add(gridTile.coasterTrackId);
            gridTile.coasterTrackId = coasterId;
          }
        }
        
        // Find the best station tile (one with adjacent queue or station building)
        const stationTile = findStationTile(newGrid, trackTiles, prev.gridSize) || trackTiles[0] || { x, y };
        
        const coasterIndex = prev.coasters.findIndex(coaster => coaster.id === coasterId);
        const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
        const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, stationTile, trackPieces.length, prev.buildingCoasterType ?? 'steel_sit_down');
        
        // Find station index for train positioning
        const stationIdx = trackTiles.findIndex(t => t.x === stationTile.x && t.y === stationTile.y);
        const effectiveStationIdx = stationIdx >= 0 ? stationIdx : 0;
        
        // Determine if we need new trains or just normalize existing ones
        const oldTrackLength = existingCoaster?.track.length ?? 0;
        const needsNewTrains = !existingCoaster || Math.abs(oldTrackLength - trackPieces.length) > 5;
        
        // Always normalize train positions when track changes to prevent cars from separating
        let trains: CoasterTrain[];
        if (needsNewTrains) {
          trains = createTrainsForCoaster(trackPieces.length, coasterBase.type);
        } else if (oldTrackLength !== trackPieces.length) {
          // Track changed but not enough for new trains - normalize positions
          trains = normalizeTrainsForTrackChange(
            coasterBase.trains,
            oldTrackLength,
            trackPieces.length,
            effectiveStationIdx
          );
        } else {
          trains = coasterBase.trains;
        }
        
        const coaster: Coaster = {
          ...coasterBase,
          track: trackPieces,
          trackTiles,
          // Update station tile in case a queue was added adjacent to track
          stationTileX: stationTile.x,
          stationTileY: stationTile.y,
          trains,
        };
        
        // Remove absorbed coasters (those whose tracks were merged into this one)
        // and add/update our coaster
        let updatedCoasters = prev.coasters.filter(c => !absorbedCoasterIds.has(c.id));
        const existingIdx = updatedCoasters.findIndex(c => c.id === coasterId);
        if (existingIdx >= 0) {
          updatedCoasters[existingIdx] = coaster;
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
      
      // Check if the tool is a scenery tool (flowers, bushes, trees)
      const sceneryTools = [
        // Trees
        'tree_oak', 'tree_maple', 'tree_birch', 'tree_elm', 'tree_willow',
        'tree_pine', 'tree_spruce', 'tree_fir', 'tree_cedar', 'tree_redwood',
        'tree_palm', 'tree_banana', 'tree_bamboo', 'tree_coconut', 'tree_tropical',
        'tree_cherry', 'tree_magnolia', 'tree_dogwood', 'tree_jacaranda', 'tree_wisteria',
        // Bushes
        'bush_hedge', 'bush_flowering',
        // Topiaries
        'topiary_ball', 'topiary_spiral', 'topiary_animal',
        // Flowers
        'flowers_bed', 'flowers_planter', 'flowers_hanging', 'flowers_wild', 'ground_cover',
      ];
      
      // For scenery tools, check if tile already has a structure
      if (sceneryTools.includes(tool)) {
        const existingBuildingType = tile.building?.type;
        // Allow placement only on empty/grass tiles (not on paths, queues, other buildings, or track)
        const canPlace = !existingBuildingType || existingBuildingType === 'empty' || existingBuildingType === 'grass';
        if (!canPlace || tile.trackPiece || tile.hasCoasterTrack) {
          return prev; // Can't place scenery on top of existing structures
        }
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
        // Fountains
        'fountain_small_1': 'fountain_small_1',
        'fountain_small_2': 'fountain_small_2',
        'fountain_small_3': 'fountain_small_3',
        'fountain_small_4': 'fountain_small_4',
        'fountain_small_5': 'fountain_small_5',
        'fountain_medium_1': 'fountain_medium_1',
        'fountain_medium_2': 'fountain_medium_2',
        'fountain_medium_3': 'fountain_medium_3',
        'fountain_medium_4': 'fountain_medium_4',
        'fountain_medium_5': 'fountain_medium_5',
        'fountain_large_1': 'fountain_large_1',
        'fountain_large_2': 'fountain_large_2',
        'fountain_large_3': 'fountain_large_3',
        'fountain_large_4': 'fountain_large_4',
        'fountain_large_5': 'fountain_large_5',
        // Ponds
        'pond_small': 'pond_small',
        'pond_medium': 'pond_medium',
        'pond_large': 'pond_large',
        'pond_koi': 'pond_koi',
        'pond_lily': 'pond_lily',
        // Water features
        'splash_pad': 'splash_pad',
        'water_jets': 'water_jets',
        'mist_fountain': 'mist_fountain',
        'interactive_fountain': 'interactive_fountain',
        'dancing_fountain': 'dancing_fountain',
        // Food - American
        'food_hotdog': 'food_hotdog',
        'food_burger': 'food_burger',
        'food_fries': 'food_fries',
        'food_corndog': 'food_corndog',
        'food_pretzel': 'food_pretzel',
        // Food - Sweet Treats
        'food_icecream': 'food_icecream',
        'food_cotton_candy': 'food_cotton_candy',
        'food_candy_apple': 'food_candy_apple',
        'food_churros': 'food_churros',
        'food_funnel_cake': 'food_funnel_cake',
        // Food - Drinks
        'drink_soda': 'drink_soda',
        'drink_lemonade': 'drink_lemonade',
        'drink_smoothie': 'drink_smoothie',
        'drink_coffee': 'drink_coffee',
        'drink_slushie': 'drink_slushie',
        // Food - Snacks
        'snack_popcorn': 'snack_popcorn',
        'snack_nachos': 'snack_nachos',
        'snack_pizza': 'snack_pizza',
        'snack_cookies': 'snack_cookies',
        'snack_donuts': 'snack_donuts',
        // Food - International
        'food_tacos': 'food_tacos',
        'food_noodles': 'food_noodles',
        'food_kebab': 'food_kebab',
        'food_crepes': 'food_crepes',
        'food_waffles': 'food_waffles',
        // Food - Themed Carts
        'cart_pirate': 'cart_pirate',
        'cart_space': 'cart_space',
        'cart_medieval': 'cart_medieval',
        'cart_western': 'cart_western',
        'cart_tropical': 'cart_tropical',
        
        // Shops - Gift shops
        'shop_souvenir': ['shop_souvenir_1', 'shop_souvenir_2'],
        'shop_emporium': 'shop_souvenir_2',
        'shop_photo': 'shop_photo',
        'shop_ticket': 'shop_ticket',
        'shop_collectibles': 'shop_collectibles',
        // Shops - Toy shops
        'shop_toys': 'shop_toys',
        'shop_plush': 'shop_plush',
        'shop_apparel': 'shop_apparel',
        'shop_bricks': 'shop_bricks',
        'shop_rc': 'shop_rc',
        // Shops - Candy
        'shop_candy': 'shop_candy',
        'shop_fudge': 'shop_fudge',
        'shop_jewelry': 'shop_jewelry',
        'shop_popcorn_shop': 'shop_popcorn',
        'shop_soda_fountain': 'shop_soda_fountain',
        // Shops - Games
        'game_ring_toss': 'game_ring_toss',
        'game_balloon': 'game_balloon',
        'game_shooting': 'game_shooting',
        'game_darts': 'game_darts',
        'game_basketball': 'game_basketball',
        // Shops - Entertainment
        'arcade_building': 'arcade_building',
        'vr_experience': 'vr_experience',
        'photo_booth': 'photo_booth',
        'caricature': 'caricature',
        'face_paint': 'face_paint',
        // Shops - Services
        'restroom': 'restroom',
        'first_aid': 'first_aid',
        'lockers': 'lockers',
        'stroller_rental': 'stroller_rental',
        'atm': 'atm',
        
        // Rides Small - Kiddie
        'ride_kiddie_coaster': 'ride_kiddie_coaster',
        'ride_kiddie_train': 'ride_kiddie_train',
        'ride_kiddie_planes': 'ride_kiddie_planes',
        'ride_kiddie_boats': 'ride_kiddie_boats',
        'ride_kiddie_cars': 'ride_kiddie_cars',
        // Rides Small - Spinning
        'ride_teacups': 'ride_teacups',
        'ride_scrambler': 'ride_scrambler',
        'ride_tilt_a_whirl': 'ride_tilt_a_whirl',
        'ride_spinning_apples': 'ride_spinning_apples',
        'ride_whirlwind': 'ride_whirlwind',
        // Rides Small - Classic
        'ride_carousel': 'ride_carousel',
        'ride_antique_cars': 'ride_antique_cars',
        'ride_monorail_car': 'ride_monorail_car',
        'ride_sky_ride_car': 'ride_sky_ride_car',
        'ride_train_car': 'ride_train_car',
        // Rides Small - Driving/Theater
        'ride_bumper_cars': 'ride_bumper_cars',
        'ride_go_karts': 'ride_go_karts',
        'ride_simulator': 'ride_simulator',
        'ride_motion_theater': 'ride_motion_theater',
        'ride_4d_theater': 'ride_4d_theater',
        // Rides Small - Water
        'ride_bumper_boats': 'ride_bumper_boats',
        'ride_paddle_boats': 'ride_paddle_boats',
        'ride_lazy_river': 'ride_lazy_river',
        'ride_water_play': 'ride_water_play',
        'ride_splash_zone': 'ride_splash_zone',
        // Rides Small - Dark Rides
        'ride_haunted_house': 'ride_haunted_house',
        'ride_ghost_train': 'ride_ghost_train',
        'ride_dark_ride': 'ride_dark_ride',
        'ride_tunnel': 'ride_tunnel',
        'ride_themed_facade': 'ride_themed_facade',
        
        // Rides Large - Ferris Wheels
        'ride_ferris_classic': 'ride_ferris_classic',
        'ride_ferris_modern': 'ride_ferris_modern',
        'ride_ferris_observation': 'ride_ferris_observation',
        'ride_ferris_double': 'ride_ferris_double',
        'ride_ferris_led': 'ride_ferris_led',
        // Rides Large - Drop/Tower
        'ride_drop_tower': 'ride_drop_tower',
        'ride_space_shot': 'ride_space_shot',
        'ride_observation_tower': 'ride_observation_tower',
        'ride_sky_swing': 'ride_sky_swing',
        'ride_star_flyer': 'ride_star_flyer',
        // Rides Large - Swing
        'ride_swing_ride': 'ride_swing_ride',
        'ride_wave_swinger': 'ride_wave_swinger',
        'ride_flying_scooters': 'ride_flying_scooters',
        'ride_enterprise': 'ride_enterprise',
        'ride_loop_o_plane': 'ride_loop_o_plane',
        // Rides Large - Thrill
        'ride_top_spin': 'ride_top_spin',
        'ride_frisbee': 'ride_frisbee',
        'ride_afterburner': 'ride_afterburner',
        'ride_inversion': 'ride_inversion',
        'ride_meteorite': 'ride_meteorite',
        // Rides Large - Transport/Water
        'ride_log_flume': 'ride_log_flume',
        'ride_rapids': 'ride_rapids',
        'ride_train_station': 'ride_train_station',
        'ride_monorail_station': 'ride_monorail_station',
        'ride_chairlift': 'ride_chairlift',
        // Rides Large - Shows
        'show_4d': 'show_4d',
        'show_stunt': 'show_stunt',
        'show_dolphin': 'show_dolphin',
        'show_amphitheater': 'show_amphitheater',
        'show_parade_float': 'show_parade_float',
        // Coaster stations - handled specially below based on track direction
        // 'coaster_station' is NOT included here - see special handling
        // Infrastructure
        'park_entrance': 'infra_main_entrance',
        'staff_building': 'infra_office',
      };
      
      // Special handling for coaster_station - select correct rotation based on adjacent track
      if (tool === 'coaster_station') {
        // Validate tile is buildable (coaster_station is 2x1)
        const stationSize = toolInfo.size ?? { width: 2, height: 1 };
        for (let dy = 0; dy < stationSize.height; dy++) {
          for (let dx = 0; dx < stationSize.width; dx++) {
            const checkX = x + dx;
            const checkY = y + dy;
            if (checkX >= prev.gridSize || checkY >= prev.gridSize) return prev;
            const checkTile = prev.grid[checkY]?.[checkX];
            if (!checkTile) return prev;
            if (checkTile.terrain === 'water') return prev;
            if (checkTile.building?.type && checkTile.building.type !== 'empty' && checkTile.building.type !== 'grass') return prev;
            if (checkTile.path || checkTile.queue || checkTile.hasCoasterTrack || checkTile.trackPiece) return prev;
          }
        }
        
        // Check adjacent tiles for track to determine station orientation
        const adjacentOffsets = [
          { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
          { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        ];
        
        let trackDirection: TrackDirection | null = null;
        for (const { dx, dy } of adjacentOffsets) {
          const adjX = x + dx;
          const adjY = y + dy;
          if (adjX >= 0 && adjY >= 0 && adjX < prev.gridSize && adjY < prev.gridSize) {
            const adjTile = prev.grid[adjY]?.[adjX];
            if (adjTile?.trackPiece) {
              trackDirection = adjTile.trackPiece.direction;
              break;
            }
          }
        }
        
        // Select station type randomly
        const stationTypes = ['wooden', 'steel', 'inverted', 'water'];
        const stationType = stationTypes[Math.floor(Math.random() * stationTypes.length)];
        
        // Select rotation based on track direction:
        // - _1, _2: For north/south track direction (NE-SW orientation on screen)
        // - _3, _4: For east/west track direction (NW-SE orientation on screen)
        let rotationSuffix: string;
        if (trackDirection === 'east' || trackDirection === 'west') {
          rotationSuffix = Math.random() > 0.5 ? '_3' : '_4';
        } else {
          // Default to north/south orientation (or if no adjacent track)
          rotationSuffix = Math.random() > 0.5 ? '_1' : '_2';
        }
        
        const stationBuildingType = `station_${stationType}${rotationSuffix}`;
        tile.building = { 
          ...createEmptyBuilding(), 
          type: stationBuildingType as BuildingType,
          constructionProgress: 100,
        };
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      const buildingEntry = toolToBuildingType[tool];
      const buildingType = Array.isArray(buildingEntry)
        ? buildingEntry[Math.floor(Math.random() * buildingEntry.length)]
        : buildingEntry;
      
      if (buildingType) {
        // Check if this is a multi-tile building
        const buildingSize = toolInfo.size ?? { width: 1, height: 1 };
        
        // Validate all tiles in the footprint
        for (let dy = 0; dy < buildingSize.height; dy++) {
          for (let dx = 0; dx < buildingSize.width; dx++) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            // Check bounds
            if (checkX >= prev.gridSize || checkY >= prev.gridSize) {
              return prev; // Can't place here
            }
            
            const checkTile = newGrid[checkY][checkX];
            
            // Check if tile is buildable (not water, not already built on, no tracks)
            if (checkTile.terrain === 'water') return prev;
            if (checkTile.building.type !== 'empty' && checkTile.building.type !== 'grass') return prev;
            if (checkTile.path || checkTile.queue || checkTile.hasCoasterTrack || checkTile.trackPiece) return prev;
          }
        }
        
        // Place the building on all footprint tiles
        for (let dy = 0; dy < buildingSize.height; dy++) {
          for (let dx = 0; dx < buildingSize.width; dx++) {
            const placeX = x + dx;
            const placeY = y + dy;
            const placeTile = newGrid[placeY][placeX];
            
            if (dx === 0 && dy === 0) {
              // Origin tile - full building
              placeTile.building = { 
                ...createEmptyBuilding(), 
                type: buildingType,
                constructionProgress: 100,
              };
            } else {
              // Non-origin tile - mark as part of building footprint
              // Use 'empty' type but set a special marker in the building
              placeTile.building = { 
                ...createEmptyBuilding(), 
                type: `${buildingType}_footprint` as BuildingType,
                constructionProgress: 100,
              };
            }
          }
        }
        
        return { ...prev, grid: newGrid, finances: { ...prev.finances, cash: prev.finances.cash - toolInfo.cost } };
      }
      
      return prev;
    });
  }, []);
  
  const bulldozeTile = useCallback((x: number, y: number) => {
    setState(prev => {
      const newGrid = prev.grid.map(row => row.map(tile => ({ ...tile })));
      const tile = newGrid[y][x];
      
      // Check if we're bulldozing a multi-tile building (origin or footprint tile)
      const buildingType = tile.building?.type;
      if (buildingType && (buildingType.endsWith('_footprint') || TOOL_INFO[buildingType as Tool]?.size)) {
        // Find the origin tile and clear all footprint tiles
        const originType = buildingType.endsWith('_footprint') 
          ? buildingType.replace('_footprint', '') 
          : buildingType;
        const toolInfo = TOOL_INFO[originType as Tool];
        const buildingSize = toolInfo?.size ?? { width: 1, height: 1 };
        
        // Find the origin by searching nearby tiles
        for (let searchY = Math.max(0, y - buildingSize.height + 1); searchY <= y; searchY++) {
          for (let searchX = Math.max(0, x - buildingSize.width + 1); searchX <= x; searchX++) {
            const searchTile = newGrid[searchY]?.[searchX];
            if (searchTile?.building?.type === originType) {
              // Found the origin - clear all footprint tiles
              for (let dy = 0; dy < buildingSize.height; dy++) {
                for (let dx = 0; dx < buildingSize.width; dx++) {
                  const clearX = searchX + dx;
                  const clearY = searchY + dy;
                  if (clearX < prev.gridSize && clearY < prev.gridSize) {
                    const clearTile = newGrid[clearY][clearX];
                    clearTile.building = createEmptyBuilding();
                  }
                }
              }
              return { ...prev, grid: newGrid };
            }
          }
        }
      }
      
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
      
      // If track was demolished, update the coaster's track arrays and normalize trains
      let updatedCoasters = prev.coasters;
      if (hadTrack && coasterId) {
        // Recollect all track for this coaster from the updated grid
        const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);

        // If no track tiles remain, remove the coaster entirely
        if (trackTiles.length === 0) {
          updatedCoasters = prev.coasters.filter(c => c.id !== coasterId);
        } else {
          updatedCoasters = prev.coasters.map(coaster => {
            if (coaster.id === coasterId) {
              const oldTrackLength = coaster.track.length;
              const newTrackLength = trackPieces.length;

              // Find the best station tile for the updated track
              const stationTile = findStationTile(newGrid, trackTiles, prev.gridSize) || trackTiles[0];
              const stationIdx = stationTile
                ? trackTiles.findIndex(t => t.x === stationTile.x && t.y === stationTile.y)
                : 0;
              const effectiveStationIdx = stationIdx >= 0 ? stationIdx : 0;

              // Always regenerate trains when track changes to prevent orphaned cars
              const trains = createTrainsForCoaster(newTrackLength, coaster.type).map((train, trainIndex) => {
                const trainOffset = (trainIndex * newTrackLength) / Math.max(1, createTrainsForCoaster(newTrackLength, coaster.type).length);
                const baseProgress = (effectiveStationIdx + trainOffset) % newTrackLength;
                return {
                  ...train,
                  cars: train.cars.map((car, carIndex) => ({
                    ...car,
                    trackProgress: (baseProgress + carIndex * 0.18) % newTrackLength,
                  })),
                };
              });

              return {
                ...coaster,
                track: trackPieces,
                trackTiles,
                stationTileX: stationTile?.x ?? coaster.stationTileX,
                stationTileY: stationTile?.y ?? coaster.stationTileY,
                trains,
              };
            }
            return coaster;
          });
        }
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
      buildingCoasterType: coasterType as CoasterType,
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
      buildingCoasterType: null,
    }));
  }, []);
  
  const cancelCoasterBuild = useCallback(() => {
    setState(prev => ({
      ...prev,
      buildingCoasterId: null,
      buildingCoasterPath: [],
      buildingCoasterHeight: 0,
      buildingCoasterLastDirection: null,
      buildingCoasterType: null,
    }));
  }, []);
  
  // Place a line of track tiles (for drag-to-draw functionality)
  const placeTrackLine = useCallback((tiles: { x: number; y: number }[]) => {
    if (tiles.length === 0) return;
    
    setState(prev => {
      const newGrid = prev.grid.map(row => row.map(tile => ({ ...tile })));
      
      // Determine if the first tile is connected to existing track with buildingCoasterId
      // If not, we're starting a NEW track - generate new ID
      let coasterId = prev.buildingCoasterId ?? generateUUID();
      let startedNewCoaster = false;
      
      if (tiles.length > 0 && prev.buildingCoasterId) {
        const firstTile = tiles[0];
        const adjacentOffsets = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];
        
        // Check if first tile is adjacent to any existing track with this coaster ID
        const hasConnectedTrack = adjacentOffsets.some(({ dx, dy }) => {
          const adjX = firstTile.x + dx;
          const adjY = firstTile.y + dy;
          if (adjX >= 0 && adjY >= 0 && adjX < prev.gridSize && adjY < prev.gridSize) {
            const adjTile = prev.grid[adjY]?.[adjX];
            return adjTile?.coasterTrackId === prev.buildingCoasterId;
          }
          return false;
        });
        
        // Also check if we're continuing from the building path
        const isOnBuildingPath = prev.buildingCoasterPath.some(p => {
          return adjacentOffsets.some(({ dx, dy }) => {
            return p.x === firstTile.x + dx && p.y === firstTile.y + dy;
          });
        }) || prev.buildingCoasterPath.length === 0;
        
        // If not connected, start a new coaster
        if (!hasConnectedTrack && !isOnBuildingPath) {
          coasterId = generateUUID();
          startedNewCoaster = true;
        }
        
        // Check if we're trying to extend an existing coaster with an incompatible type
        // If the buildingCoasterType is set and differs from the existing coaster's category, start new
        if (!startedNewCoaster && prev.buildingCoasterType) {
          const existingCoaster = prev.coasters.find(c => c.id === coasterId);
          if (existingCoaster && !areCoasterTypesCompatible(prev.buildingCoasterType, existingCoaster.type)) {
            // Incompatible coaster types - start a new coaster
            coasterId = generateUUID();
            startedNewCoaster = true;
          }
        }
      }
      
      // Get coaster type for strut style - prefer buildingCoasterType, fall back to existing coaster
      const existingCoasterForLine = prev.coasters.find(c => c.id === coasterId);
      const coasterTypeForLine: CoasterType = prev.buildingCoasterType ?? existingCoasterForLine?.type ?? 'steel_sit_down';
      const strutStyleForLine = getStrutStyleForCoasterType(coasterTypeForLine);
      const directionFromLineDelta = (dx: number, dy: number) => directionFromDelta(dx, dy);
      let currentHeight = startedNewCoaster ? 0 : prev.buildingCoasterHeight;
      let lastDirection: TrackDirection | null = startedNewCoaster ? null : prev.buildingCoasterLastDirection;
      const updatedPath = startedNewCoaster ? [] : [...prev.buildingCoasterPath];
      
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
          const nextDir = directionFromLineDelta(dx, dy);
          if (nextDir) direction = nextDir;
        } else if (updatedPath.length > 0) {
          const prevTile = updatedPath[updatedPath.length - 1];
          const dx = x - prevTile.x;
          const dy = y - prevTile.y;
          const nextDir = directionFromLineDelta(dx, dy);
          if (nextDir) direction = nextDir;
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
              // Determine turn type based on entry->exit directions
              const entryDir = OPPOSITE_DIRECTION[lastDirection];
              const turnType: TrackPieceType =
                rotateDirection(entryDir, 'right') === direction
                  ? 'turn_right_flat'
                  : 'turn_left_flat';
              prevTile.trackPiece = {
                ...prevTile.trackPiece,
                type: turnType,
                direction: entryDir,
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
          strutStyle: strutStyleForLine,
        };
        
        tile.trackPiece = trackPiece;
        tile.hasCoasterTrack = true;
        tile.coasterTrackId = coasterId;
        
        updatedPath.push({ x, y });
        lastDirection = direction;
      }
      
      // Collect ALL track tiles for this coaster from the grid (not just building path)
      const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);
      
      // IMPORTANT: Unify coaster IDs when connecting separate tracks
      // collectConnectedTrack follows physical connections regardless of coasterTrackId,
      // so the collected tiles may have different IDs. We need to:
      // 1. Unify all tiles in the connected component to use our coasterId
      // 2. Track which other coaster IDs were absorbed so we can remove their coasters
      const absorbedCoasterIds = new Set<string>();
      for (const { x: tx, y: ty } of trackTiles) {
        const tile = newGrid[ty][tx];
        if (tile.coasterTrackId && tile.coasterTrackId !== coasterId) {
          absorbedCoasterIds.add(tile.coasterTrackId);
          tile.coasterTrackId = coasterId;
        }
      }
      
      // Clean up any disconnected fragments that have this coasterTrackId but aren't
      // part of the connected component - these would otherwise render as orphan tracks
      const connectedTileSet = new Set(trackTiles.map(t => `${t.x},${t.y}`));
      for (let y = 0; y < prev.gridSize; y++) {
        for (let x = 0; x < prev.gridSize; x++) {
          const tile = newGrid[y][x];
          if (tile.coasterTrackId === coasterId && !connectedTileSet.has(`${x},${y}`)) {
            // This tile has the coaster ID but isn't connected - clean it up
            tile.trackPiece = null;
            tile.hasCoasterTrack = false;
            tile.coasterTrackId = null;
          }
        }
      }
      
      // Find the best station tile (one with adjacent queue or station building)
      const stationTile = findStationTile(newGrid, trackTiles, prev.gridSize) || trackTiles[0] || tiles[0];
      
      const coasterIndex = prev.coasters.findIndex(c => c.id === coasterId);
      const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
      const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, stationTile, trackPieces.length, prev.buildingCoasterType ?? 'steel_sit_down');
      
      // Find station index for train positioning
      const stationIdx = trackTiles.findIndex(t => t.x === stationTile.x && t.y === stationTile.y);
      const effectiveStationIdx = stationIdx >= 0 ? stationIdx : 0;
      
      // Determine if we need new trains or just normalize existing ones
      const oldTrackLength = existingCoaster?.track.length ?? 0;
      const needsNewTrains = !existingCoaster || Math.abs(oldTrackLength - trackPieces.length) > 5;
      
      // Always normalize train positions when track changes to prevent cars from separating
      let trains: CoasterTrain[];
      if (needsNewTrains) {
        trains = createTrainsForCoaster(trackPieces.length, coasterBase.type);
      } else if (oldTrackLength !== trackPieces.length) {
        // Track changed but not enough for new trains - normalize positions
        trains = normalizeTrainsForTrackChange(
          coasterBase.trains,
          oldTrackLength,
          trackPieces.length,
          effectiveStationIdx
        );
      } else {
        trains = coasterBase.trains;
      }
      
      const coaster: Coaster = {
        ...coasterBase,
        track: trackPieces,
        trackTiles,
        // Update station tile in case a queue was added adjacent to track
        stationTileX: stationTile.x,
        stationTileY: stationTile.y,
        trains,
      };
      
      // Remove absorbed coasters (those whose tracks were merged into this one)
      // and add/update our coaster
      let updatedCoasters = prev.coasters.filter(c => !absorbedCoasterIds.has(c.id));
      const existingIdx = updatedCoasters.findIndex(c => c.id === coasterId);
      if (existingIdx >= 0) {
        updatedCoasters[existingIdx] = coaster;
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

  const clearGuests = useCallback(() => {
    setState(prev => ({
      ...prev,
      guests: [],
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
    // Use async worker-based save to avoid blocking main thread
    persistCoasterSaveAsync(latestStateRef.current)
      .then((ok) => {
        if (ok) {
          setHasSavedGame(true);
        }
      })
      .catch((e) => {
        console.error('Failed to save game:', e);
      });
  }, [persistCoasterSaveAsync]);
  
  const loadGame = useCallback((): boolean => {
    try {
      const parsed = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
      if (parsed && parsed.grid && parsed.gridSize) {
        const normalizedState = normalizeLoadedState(parsed);
        // Fix any disconnected tracks that share the same coasterTrackId
        const { grid: fixedGrid, coasters: fixedCoasters } = ensureAllTracksHaveCoasters(
          normalizedState.grid,
          normalizedState.coasters
        );
        const finalState = {
          ...normalizedState,
          grid: fixedGrid,
          coasters: fixedCoasters,
        };
        setState(finalState);
        persistCoasterSave(finalState);
        return true;
      }
    } catch (e) {
      console.error('Failed to load game:', e);
    }
    return false;
  }, [persistCoasterSave]);
  
  const newGame = useCallback((name?: string) => {
    setState(createInitialGameState(name));
    setHasSavedGame(false);
  }, []);
  
  const exportState = useCallback((): string => {
    return JSON.stringify(latestStateRef.current);
  }, []);
  
  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      if (parsed && parsed.grid && parsed.gridSize) {
        const normalizedState = normalizeLoadedState(parsed);
        // Fix any disconnected tracks that share the same coasterTrackId
        const { grid: fixedGrid, coasters: fixedCoasters } = ensureAllTracksHaveCoasters(
          normalizedState.grid,
          normalizedState.coasters
        );
        const finalState = {
          ...normalizedState,
          grid: fixedGrid,
          coasters: fixedCoasters,
        };
        setState(finalState);
        persistCoasterSave(finalState);
        return true;
      }
    } catch (e) {
      console.error('Failed to load state from string:', e);
    }
    return false;
  }, [persistCoasterSave]);
  
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
    clearGuests,
    addNotification,
    
    saveGame,
    loadGame,
    newGame,
    hasSavedGame,
    
    exportState,
    loadState,
    
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
