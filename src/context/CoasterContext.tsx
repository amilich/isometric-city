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
import { ParkFinances, ParkStats, ParkSettings, Guest, Staff, DEFAULT_PRICES } from '@/games/coaster/types/economy';
import { Coaster, CoasterTrain, CoasterCar, TrackDirection, TrackHeight, TrackPiece, TrackPieceType, CoasterType, COASTER_TYPE_STATS, getStrutStyleForCoasterType } from '@/games/coaster/types/tracks';
import { Building, BuildingType } from '@/games/coaster/types/buildings';
import { spawnGuests, updateGuest } from '@/components/coaster/guests';
import {
  COASTER_AUTOSAVE_KEY,
  COASTER_SAVED_PARK_PREFIX,
  buildSavedParkMeta,
  loadCoasterStateFromStorage,
  readSavedParksIndex,
  saveCoasterStateToStorage,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

// =============================================================================
// CONSTANTS
// =============================================================================

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
  if (type === 'turn_left_flat' || type === 'turn_right_flat') {
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
  return collectConnectedTrack(grid, startTile.x, startTile.y, visited);
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
          
          // Create a new coaster for this component
          const newCoaster = createDefaultCoaster(
            newCoasterId,
            stationTile,
            componentPieces.length
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
    train.stateTimer = i === 0 ? (5 + Math.random() * 3) : 0;
    trains.push(train);
  }
  
  return trains;
}

function createDefaultCoaster(id: string, startTile: { x: number; y: number }, trackLength: number = 0): Coaster {
  return {
    id,
    name: 'Custom Coaster',
    type: 'steel_sit_down',
    color: { primary: '#dc2626', secondary: '#f59e0b', supports: '#374151' },
    track: [],
    trackTiles: [],
    stationTileX: startTile.x,
    stationTileY: startTile.y,
    trains: createTrainsForCoaster(trackLength, 'steel_sit_down'),
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
  
  // Auto-save periodically
  useEffect(() => {
    if (!isStateReady) return;
    
    const saveInterval = setInterval(() => {
      try {
        persistCoasterSave(latestStateRef.current);
      } catch (e) {
        console.error('Failed to auto-save:', e);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(saveInterval);
  }, [isStateReady, persistCoasterSave]);
  
  // Simulation tick
  useEffect(() => {
    if (!isStateReady || state.speed === 0) return;
    
    const tickInterval = [0, 100, 50, 25][state.speed]; // ms per tick
    
    const interval = setInterval(() => {
      setState(prev => {
        const newTick = prev.tick + 1;
        let { minute, hour, day, month, year } = prev;
        
        // Time progression - slower at night to make days feel longer
        // During day (7-18): advance 1 minute per tick
        // During night/dawn/dusk: advance 2 minutes per tick (faster to get through night)
        const isDaytime = hour >= 7 && hour < 18;
        const minuteIncrement = isDaytime ? 0.5 : 2; // Slower during day, faster at night
        
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

        // Update coaster trains with state machine and station logic
        // First, filter out coasters whose track no longer exists in the grid
        const validCoasters = prev.coasters.filter(coaster => {
          if (coaster.track.length === 0) return false;
          // Check if at least one track tile exists in grid with this coaster ID
          const hasValidTrack = coaster.trackTiles.some(tile => {
            const gridTile = prev.grid[tile.y]?.[tile.x];
            return gridTile?.coasterTrackId === coaster.id && gridTile?.trackPiece;
          });
          return hasValidTrack;
        });
        
        const updatedCoasters = validCoasters.map(coaster => {
          if (coaster.track.length === 0 || coaster.trains.length === 0) return coaster;
          const trackLength = coaster.track.length;
          
          // Validate that trackTiles and track are synchronized
          if (coaster.trackTiles.length !== trackLength) {
            // Mismatch - recollect the track to fix
            const { tiles: fixedTiles, pieces: fixedPieces } = collectCoasterTrack(prev.grid, coaster.id);
            if (fixedTiles.length > 0) {
              return {
                ...coaster,
                track: fixedPieces,
                trackTiles: fixedTiles,
                trains: createTrainsForCoaster(fixedPieces.length, coaster.type),
              };
            }
            return coaster;
          }
          
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
              stateTimer = 8;
            }
            
            // Get lead car's position
            const leadCar = cars[0];
            const leadProgress = leadCar.trackProgress % trackLength;
            const isAtStation = leadProgress >= stationRange.min && leadProgress <= stationRange.max;
            
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
                // Slow acceleration
                const baseDispatchVelocity = 0.02 + (1 - stateTimer / 2) * 0.04;
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
                  // Normal running speed
                  const baseRunVelocity = hasTrainAhead ? 0.02 : 0.06;
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
                // Slow down approaching station
                const baseBrakeVelocity = hasTrainAhead ? 0.01 : 0.03;
                const leadProgressNow = cars[0].trackProgress % trackLength;
                const atStation = leadProgressNow >= stationRange.min && leadProgressNow <= stationRange.max;
                
                if (atStation && !hasTrainAhead) {
                  state = 'loading';
                  stateTimer = 6 + Math.random() * 4; // 6-10 seconds loading
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
        // When multiple adjacent tracks exist, prefer the one that matches the build path
        let adjacentDirection: TrackDirection | null = null;
        let adjacentHeight = prev.buildingCoasterHeight;
        let connectingToEntry = false; // True if we're feeding INTO adjacent track's entry
        let targetEntryHeight = 0; // The height we need our exit to be at when connecting to entry
        
        const oppositeDir: Record<TrackDirection, TrackDirection> = {
          north: 'south', south: 'north', east: 'west', west: 'east'
        };
        
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
              // Entry is always the side the track comes FROM (opposite of direction)
              // Exit is where the track goes TO (direction for straights, rotated for turns)
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
                  baseDirection: oppositeDir[entryDir],
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
          // For slopes, drawSlopeTrack interprets direction as the EXIT direction:
          // direction='south' → enter from north (at startHeight), exit to south (at endHeight)
          //
          // For slope_up: startHeight < endHeight, so the slope rises toward the exit.
          //
          // When connecting to existing track:
          // - Exit connection: adjacent exits toward us, we receive at our entry
          //   Keep the same direction so train flow continues naturally
          // - Entry connection: we feed into adjacent's entry
          //   Flip direction so our exit faces their entry
          if (adjacentDirection) {
            if (connectingToEntry) {
              // We're feeding into their entry - flip so our exit faces them
              const oppDir: Record<TrackDirection, TrackDirection> = {
                north: 'south', south: 'north', east: 'west', west: 'east'
              };
              startDirection = oppDir[adjacentDirection];
            } else {
              // Receiving from their exit - continue in the same flow direction
              startDirection = adjacentDirection;
            }
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
          // When receiving from adjacent exit, DON'T flip - we continue in same direction but descend
          // When feeding into adjacent entry, we flip so our exit faces their entry
          if (adjacentDirection) {
            if (connectingToEntry) {
              // We're feeding into their entry - flip so our exit (endHeight, lower) faces them
              const oppDir: Record<TrackDirection, TrackDirection> = {
                north: 'south', south: 'north', east: 'west', west: 'east'
              };
              startDirection = oppDir[adjacentDirection];
            } else {
              // Receiving from their exit - continue in the same flow direction
              startDirection = adjacentDirection;
            }
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
        if (tool === 'coaster_build' && lastTile && prev.buildingCoasterLastDirection && deltaDir) {
          if (prev.buildingCoasterLastDirection !== deltaDir) {
            const turnType: TrackPieceType =
              rotateDirection(prev.buildingCoasterLastDirection, 'right') === deltaDir
                ? 'turn_right_flat'
                : 'turn_left_flat';
            const previousTile = newGrid[lastTile.y][lastTile.x];
            // Get coaster type for strut style (use existing coaster's type if available)
            const existingCoasterForStrut = prev.coasters.find(c => c.id === prev.buildingCoasterId);
            const coasterTypeForStrut: CoasterType = existingCoasterForStrut?.type ?? 'steel_sit_down';
            previousTile.trackPiece = {
              type: turnType,
              direction: prev.buildingCoasterLastDirection,
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
        }
        
        // Get coaster type for strut style (use existing coaster's type if available)
        const existingCoasterForStyle = prev.coasters.find(c => c.id === coasterId);
        const coasterTypeForStyle: CoasterType = existingCoasterForStyle?.type ?? 'steel_sit_down';
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
        
        // Find the best station tile (one with adjacent queue or station building)
        const stationTile = findStationTile(newGrid, trackTiles, prev.gridSize) || trackTiles[0] || { x, y };
        
        const coasterIndex = prev.coasters.findIndex(coaster => coaster.id === coasterId);
        const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
        const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, stationTile, trackPieces.length);
        
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
      
      // If track was demolished, update the coaster's track arrays and normalize trains
      let updatedCoasters = prev.coasters;
      if (hadTrack && coasterId) {
        // Recollect all track for this coaster from the updated grid
        const { tiles: trackTiles, pieces: trackPieces } = collectCoasterTrack(newGrid, coasterId);
        
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
            
            // Normalize trains to prevent cars from separating after track edit
            let trains = coaster.trains;
            if (newTrackLength > 0 && oldTrackLength !== newTrackLength) {
              trains = normalizeTrainsForTrackChange(
                coaster.trains,
                oldTrackLength,
                newTrackLength,
                effectiveStationIdx
              );
            }
            
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
      }
      
      // Get coaster type for strut style
      const existingCoasterForLine = prev.coasters.find(c => c.id === coasterId);
      const coasterTypeForLine: CoasterType = existingCoasterForLine?.type ?? 'steel_sit_down';
      const strutStyleForLine = getStrutStyleForCoasterType(coasterTypeForLine);
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
      
      // Find the best station tile (one with adjacent queue or station building)
      const stationTile = findStationTile(newGrid, trackTiles, prev.gridSize) || trackTiles[0] || tiles[0];
      
      const coasterIndex = prev.coasters.findIndex(c => c.id === coasterId);
      const existingCoaster = coasterIndex >= 0 ? prev.coasters[coasterIndex] : null;
      const coasterBase = existingCoaster ?? createDefaultCoaster(coasterId, stationTile, trackPieces.length);
      
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
      const ok = persistCoasterSave(latestStateRef.current);
      if (ok) {
        setHasSavedGame(true);
      }
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }, [persistCoasterSave]);
  
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
