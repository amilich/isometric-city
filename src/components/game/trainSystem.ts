/**
 * Train System - Manages train spawning, movement, and rendering
 * Supports multi-carriage trains (passenger and freight)
 */

import { Tile } from '@/types/game';
import { Train, TrainCarriage, CarriageType, TrainType, CarDirection, TILE_WIDTH, TILE_HEIGHT } from './types';
import { DIRECTION_META, OPPOSITE_DIRECTION } from './constants';
import {
  isRailTile,
  isRailStationTile,
  getRailDirectionOptions,
  getAdjacentRail,
  getTrackType,
  getTrackSide,
  findRailStations,
  countRailTiles,
  LOCOMOTIVE_COLORS,
  FREIGHT_COLORS,
  PASSENGER_COLORS,
  TRAIN_CAR,
  TRACK_SEPARATION_RATIO,
  TrackType,
} from './railSystem';
import { gridToScreen } from './utils';

// ============================================================================
// Curve Interpolation Helpers
// ============================================================================

/** Isometric axis directions (normalized) */
const ISO_NS = { x: 0.894427, y: 0.447214 };
const ISO_EW = { x: -0.894427, y: 0.447214 };

/** Get curve endpoints and control point for a curve track type */
function getCurveGeometry(
  trackType: TrackType,
  screenX: number,
  screenY: number
): { from: { x: number; y: number }; to: { x: number; y: number }; control: { x: number; y: number }; fromAngle: number; toAngle: number } | null {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = screenX + w / 2;
  const cy = screenY + h / 2;

  // Edge midpoints (tile corners in isometric view)
  const northEdge = { x: screenX + w * 0.25, y: screenY + h * 0.25 };
  const eastEdge = { x: screenX + w * 0.75, y: screenY + h * 0.25 };
  const southEdge = { x: screenX + w * 0.75, y: screenY + h * 0.75 };
  const westEdge = { x: screenX + w * 0.25, y: screenY + h * 0.75 };
  const center = { x: cx, y: cy };

  // Angles for each direction (matching DIRECTION_META)
  const angles = {
    north: Math.atan2(-TILE_HEIGHT / 2, -TILE_WIDTH / 2),
    east: Math.atan2(-TILE_HEIGHT / 2, TILE_WIDTH / 2),
    south: Math.atan2(TILE_HEIGHT / 2, TILE_WIDTH / 2),
    west: Math.atan2(TILE_HEIGHT / 2, -TILE_WIDTH / 2),
  };

  switch (trackType) {
    case 'curve_ne':
      return { from: northEdge, to: eastEdge, control: center, fromAngle: angles.south, toAngle: angles.west };
    case 'curve_nw':
      return { from: northEdge, to: westEdge, control: center, fromAngle: angles.south, toAngle: angles.east };
    case 'curve_se':
      return { from: southEdge, to: eastEdge, control: center, fromAngle: angles.north, toAngle: angles.west };
    case 'curve_sw':
      return { from: southEdge, to: westEdge, control: center, fromAngle: angles.north, toAngle: angles.east };
    default:
      return null;
  }
}

/** Determine which way a train enters and exits a curve based on direction */
function getCurveTraversalDirection(
  trackType: TrackType,
  enterDirection: CarDirection
): { entryT: number; exitT: number } | null {
  // Map: which edge the train enters from based on its travel direction
  // north direction = train came from south edge, heading to north edge
  // east direction = train came from west edge, heading to east edge
  // etc.
  
  switch (trackType) {
    case 'curve_ne':
      // Curve connects north and east edges
      if (enterDirection === 'north') return { entryT: 1, exitT: 0 }; // Enter from east, exit to north
      if (enterDirection === 'east') return { entryT: 0, exitT: 1 }; // Enter from north, exit to east
      break;
    case 'curve_nw':
      // Curve connects north and west edges
      if (enterDirection === 'north') return { entryT: 1, exitT: 0 }; // Enter from west, exit to north
      if (enterDirection === 'west') return { entryT: 0, exitT: 1 }; // Enter from north, exit to west
      break;
    case 'curve_se':
      // Curve connects south and east edges
      if (enterDirection === 'south') return { entryT: 1, exitT: 0 }; // Enter from east, exit to south
      if (enterDirection === 'east') return { entryT: 0, exitT: 1 }; // Enter from south, exit to east
      break;
    case 'curve_sw':
      // Curve connects south and west edges
      if (enterDirection === 'south') return { entryT: 1, exitT: 0 }; // Enter from west, exit to south
      if (enterDirection === 'west') return { entryT: 0, exitT: 1 }; // Enter from south, exit to west
      break;
  }
  return null;
}

/** Calculate position and angle on a quadratic bezier curve */
function bezierPositionAndAngle(
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  t: number
): { x: number; y: number; angle: number } {
  const u = 1 - t;
  
  // Position on bezier curve
  const x = u * u * from.x + 2 * u * t * control.x + t * t * to.x;
  const y = u * u * from.y + 2 * u * t * control.y + t * t * to.y;
  
  // Derivative (tangent direction) at t
  const dx = 2 * u * (control.x - from.x) + 2 * t * (to.x - control.x);
  const dy = 2 * u * (control.y - from.y) + 2 * t * (to.y - control.y);
  
  // Angle from tangent
  const angle = Math.atan2(dy, dx);
  
  return { x, y, angle };
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum rail tiles required to spawn trains */
export const MIN_RAIL_TILES_FOR_TRAINS = 10;

/** Maximum trains per rail network size */
export const TRAINS_PER_RAIL_TILES = 12; // 1 train per 12 rail tiles

/** Maximum trains in the city */
export const MAX_TRAINS = 20;

/** Train spawn interval in seconds */
export const TRAIN_SPAWN_INTERVAL = 3.0;

/** Station stop duration in seconds */
export const STATION_STOP_DURATION = 2.0;

/** Train maximum age in seconds */
export const TRAIN_MAX_AGE = 60;

/** Carriage count for train types */
export const TRAIN_CARRIAGE_COUNTS = {
  passenger: { min: 5, max: 8 },
  freight: { min: 6, max: 10 },
};

/** Carriage spacing (in tile progress units) - spacing between carriages */
export const CARRIAGE_SPACING = 0.28;

// ============================================================================
// Train Creation Functions
// ============================================================================

/**
 * Create a new passenger train with carriages
 */
function createPassengerTrain(
  id: number,
  tileX: number,
  tileY: number,
  direction: CarDirection
): Train {
  const numCarriages = TRAIN_CARRIAGE_COUNTS.passenger.min + 
    Math.floor(Math.random() * (TRAIN_CARRIAGE_COUNTS.passenger.max - TRAIN_CARRIAGE_COUNTS.passenger.min + 1));
  
  const locomotiveColor = LOCOMOTIVE_COLORS[Math.floor(Math.random() * LOCOMOTIVE_COLORS.length)];
  const passengerColor = PASSENGER_COLORS[Math.floor(Math.random() * PASSENGER_COLORS.length)];
  
  const carriages: TrainCarriage[] = [];
  
  // Locomotive
  carriages.push({
    type: 'locomotive',
    color: locomotiveColor,
    tileX,
    tileY,
    progress: 0,
    direction,
  });
  
  // Passenger cars
  for (let i = 1; i < numCarriages - 1; i++) {
    carriages.push({
      type: 'passenger',
      color: passengerColor,
      tileX,
      tileY,
      progress: -i * CARRIAGE_SPACING,
      direction,
    });
  }
  
  // Caboose/end car
  if (numCarriages > 1) {
    carriages.push({
      type: 'caboose',
      color: locomotiveColor,
      tileX,
      tileY,
      progress: -(numCarriages - 1) * CARRIAGE_SPACING,
      direction,
    });
  }
  
  return {
    id,
    type: 'passenger',
    carriages,
    tileX,
    tileY,
    direction,
    progress: 0,
    speed: 0.25 + Math.random() * 0.1, // Moderate speed
    path: [{ x: tileX, y: tileY }],
    pathIndex: 0,
    age: 0,
    maxAge: TRAIN_MAX_AGE + Math.random() * 30,
    color: locomotiveColor,
    atStation: false,
    stationWaitTimer: 0,
  };
}

/**
 * Create a new freight train with carriages
 */
function createFreightTrain(
  id: number,
  tileX: number,
  tileY: number,
  direction: CarDirection
): Train {
  const numCarriages = TRAIN_CARRIAGE_COUNTS.freight.min + 
    Math.floor(Math.random() * (TRAIN_CARRIAGE_COUNTS.freight.max - TRAIN_CARRIAGE_COUNTS.freight.min + 1));
  
  const locomotiveColor = LOCOMOTIVE_COLORS[Math.floor(Math.random() * LOCOMOTIVE_COLORS.length)];
  
  const carriages: TrainCarriage[] = [];
  
  // Locomotive
  carriages.push({
    type: 'locomotive',
    color: locomotiveColor,
    tileX,
    tileY,
    progress: 0,
    direction,
  });
  
  // Freight cars (random types)
  const freightTypes: CarriageType[] = ['freight_box', 'freight_tank', 'freight_flat'];
  for (let i = 1; i < numCarriages - 1; i++) {
    const freightType = freightTypes[Math.floor(Math.random() * freightTypes.length)];
    const freightColor = FREIGHT_COLORS[Math.floor(Math.random() * FREIGHT_COLORS.length)];
    carriages.push({
      type: freightType,
      color: freightColor,
      tileX,
      tileY,
      progress: -i * CARRIAGE_SPACING,
      direction,
    });
  }
  
  // Caboose
  if (numCarriages > 1) {
    carriages.push({
      type: 'caboose',
      color: '#8B0000', // Traditional red caboose
      tileX,
      tileY,
      progress: -(numCarriages - 1) * CARRIAGE_SPACING,
      direction,
    });
  }
  
  return {
    id,
    type: 'freight',
    carriages,
    tileX,
    tileY,
    direction,
    progress: 0,
    speed: 0.18 + Math.random() * 0.08, // Slower than passenger
    path: [{ x: tileX, y: tileY }],
    pathIndex: 0,
    age: 0,
    maxAge: TRAIN_MAX_AGE + Math.random() * 40,
    color: locomotiveColor,
    atStation: false,
    stationWaitTimer: 0,
  };
}

// ============================================================================
// Train Spawning
// ============================================================================

/**
 * Spawn a new train on the rail network
 */
export function spawnTrain(
  grid: Tile[][],
  gridSize: number,
  trainIdRef: { current: number }
): Train | null {
  // Find all rail tiles
  const railTileCount = countRailTiles(grid, gridSize);
  if (railTileCount < MIN_RAIL_TILES_FOR_TRAINS) return null;
  
  // Find stations to spawn from
  const stations = findRailStations(grid, gridSize);
  
  // Try to spawn from a station if available
  let spawnX: number;
  let spawnY: number;
  let direction: CarDirection;
  
  if (stations.length > 0 && Math.random() < 0.7) {
    // Spawn from a station
    const station = stations[Math.floor(Math.random() * stations.length)];
    // Find adjacent rail tile to the station
    const adjacentRail = findAdjacentRailToStation(grid, gridSize, station.x, station.y);
    if (!adjacentRail) return null;
    
    spawnX = adjacentRail.x;
    spawnY = adjacentRail.y;
    direction = adjacentRail.direction;
  } else {
    // Spawn from random rail tile
    const railTile = findRandomRailTile(grid, gridSize);
    if (!railTile) return null;
    
    spawnX = railTile.x;
    spawnY = railTile.y;
    
    const options = getRailDirectionOptions(grid, gridSize, spawnX, spawnY);
    if (options.length === 0) return null;
    direction = options[Math.floor(Math.random() * options.length)];
  }
  
  // Create train (50/50 passenger/freight)
  const trainType: TrainType = Math.random() < 0.5 ? 'passenger' : 'freight';
  const train = trainType === 'passenger'
    ? createPassengerTrain(trainIdRef.current++, spawnX, spawnY, direction)
    : createFreightTrain(trainIdRef.current++, spawnX, spawnY, direction);
  
  return train;
}

/**
 * Find adjacent rail tile to a station
 */
function findAdjacentRailToStation(
  grid: Tile[][],
  gridSize: number,
  stationX: number,
  stationY: number
): { x: number; y: number; direction: CarDirection } | null {
  const directions: { dx: number; dy: number; dir: CarDirection }[] = [
    { dx: -1, dy: 0, dir: 'south' },  // Rail to north, train heads south
    { dx: 0, dy: -1, dir: 'west' },   // Rail to east, train heads west
    { dx: 1, dy: 0, dir: 'north' },   // Rail to south, train heads north
    { dx: 0, dy: 1, dir: 'east' },    // Rail to west, train heads east
  ];
  
  // Check for rail_station which is 2x2, so check around the building
  for (const { dx, dy, dir } of directions) {
    const nx = stationX + dx;
    const ny = stationY + dy;
    if (isRailTile(grid, gridSize, nx, ny)) {
      return { x: nx, y: ny, direction: dir };
    }
  }
  
  // Also check diagonals for 2x2 building
  const diagonals = [
    { dx: -1, dy: -1 }, { dx: -1, dy: 1 },
    { dx: 1, dy: -1 }, { dx: 1, dy: 1 },
    { dx: 2, dy: 0 }, { dx: 0, dy: 2 },
    { dx: -2, dy: 0 }, { dx: 0, dy: -2 },
  ];
  
  for (const { dx, dy } of diagonals) {
    const nx = stationX + dx;
    const ny = stationY + dy;
    if (isRailTile(grid, gridSize, nx, ny)) {
      const options = getRailDirectionOptions(grid, gridSize, nx, ny);
      if (options.length > 0) {
        return { x: nx, y: ny, direction: options[Math.floor(Math.random() * options.length)] };
      }
    }
  }
  
  return null;
}

/**
 * Find a random rail tile for spawning
 */
function findRandomRailTile(
  grid: Tile[][],
  gridSize: number
): { x: number; y: number } | null {
  const railTiles: { x: number; y: number }[] = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (isRailTile(grid, gridSize, x, y)) {
        // Prefer tiles with multiple connections (not dead ends)
        const options = getRailDirectionOptions(grid, gridSize, x, y);
        if (options.length >= 2) {
          railTiles.push({ x, y });
        }
      }
    }
  }
  
  if (railTiles.length === 0) {
    // Fall back to any rail tile
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (isRailTile(grid, gridSize, x, y)) {
          railTiles.push({ x, y });
        }
      }
    }
  }
  
  if (railTiles.length === 0) return null;
  return railTiles[Math.floor(Math.random() * railTiles.length)];
}

// ============================================================================
// Train Movement
// ============================================================================

/**
 * Pick next direction for train based on track geometry
 * Trains can only turn at curve tiles - at junctions they must go straight
 */
function pickNextDirection(
  previousDirection: CarDirection,
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getRailDirectionOptions(grid, gridSize, x, y);
  if (options.length === 0) return null;
  
  // Get the track type to determine valid movement
  const connections = getAdjacentRail(grid, gridSize, x, y);
  const trackType = getTrackType(connections);
  
  // Don't reverse direction (prefer continuing forward or turning)
  const incoming = OPPOSITE_DIRECTION[previousDirection];
  const filtered = options.filter(dir => dir !== incoming);
  
  // If we can only go back, do so
  if (filtered.length === 0) {
    return incoming;
  }
  
  // Handle based on track type
  switch (trackType) {
    // Straight tracks - must continue in same direction
    case 'straight_ns':
    case 'straight_ew':
      // Continue straight
      if (filtered.includes(previousDirection)) {
        return previousDirection;
      }
      // If can't continue straight (shouldn't happen on straights), pick any valid
      return filtered[0];
    
    // Curve tiles - must turn (only 2 connections, neither is straight through)
    case 'curve_ne':
    case 'curve_nw':
    case 'curve_se':
    case 'curve_sw':
      // At curves, take the only available direction (the turn)
      return filtered[0];
    
    // T-junctions - trains must go straight through, no turning
    case 'junction_t_n':
    case 'junction_t_e':
    case 'junction_t_s':
    case 'junction_t_w':
      // Must continue straight if possible
      if (filtered.includes(previousDirection)) {
        return previousDirection;
      }
      // If entering from the branch of the T, must turn onto the main line
      // Pick the direction that's NOT the incoming direction and NOT the branch
      // For T-junctions, there are 3 connections; 2 are the "through" line
      return filtered[0];
    
    // Cross intersection - must go straight through
    case 'junction_cross':
      // Must continue straight
      if (filtered.includes(previousDirection)) {
        return previousDirection;
      }
      // If somehow can't go straight, pick any
      return filtered[0];
    
    // Terminus - must reverse
    case 'terminus_n':
    case 'terminus_e':
    case 'terminus_s':
    case 'terminus_w':
      return incoming;
    
    // Single/isolated - shouldn't happen but handle it
    case 'single':
    default:
      return filtered[0] || incoming;
  }
}

/**
 * Get direction from one tile to the next
 */
function getDirectionToTile(fromX: number, fromY: number, toX: number, toY: number): CarDirection | null {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  if (dx === -1 && dy === 0) return 'north';
  if (dx === 1 && dy === 0) return 'south';
  if (dx === 0 && dy === -1) return 'east';
  if (dx === 0 && dy === 1) return 'west';
  
  return null;
}

/**
 * Update a single train's position and state
 */
export function updateTrain(
  train: Train,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  // Update age
  train.age += delta * speedMultiplier;
  if (train.age > train.maxAge) {
    return false; // Train expired
  }
  
  // Handle station stop
  if (train.atStation) {
    train.stationWaitTimer -= delta * speedMultiplier;
    if (train.stationWaitTimer <= 0) {
      train.atStation = false;
    }
    return true;
  }
  
  // Check if current tile is still valid
  if (!isRailTile(grid, gridSize, train.tileX, train.tileY) &&
      !isRailStationTile(grid, gridSize, train.tileX, train.tileY)) {
    return false; // Track was removed
  }
  
  // Update progress
  train.progress += train.speed * delta * speedMultiplier;
  
  // Move to next tile when progress >= 1
  while (train.progress >= 1) {
    const meta = DIRECTION_META[train.direction];
    const newTileX = train.tileX + meta.step.x;
    const newTileY = train.tileY + meta.step.y;
    
    // Check if next tile is valid rail
    if (!isRailTile(grid, gridSize, newTileX, newTileY) &&
        !isRailStationTile(grid, gridSize, newTileX, newTileY)) {
      // Try to find alternative direction
      const altDir = pickNextDirection(train.direction, grid, gridSize, train.tileX, train.tileY);
      if (!altDir) {
        // Dead end - reverse direction
        train.direction = OPPOSITE_DIRECTION[train.direction];
        train.progress = 0.5;
        break;
      }
      train.direction = altDir;
      train.progress = 0.1;
      break;
    }
    
    // Move to new tile
    train.tileX = newTileX;
    train.tileY = newTileY;
    train.progress -= 1;
    
    // Check for station stop
    if (isRailStationTile(grid, gridSize, newTileX, newTileY) && train.type === 'passenger') {
      train.atStation = true;
      train.stationWaitTimer = STATION_STOP_DURATION;
    }
    
    // Pick next direction
    const nextDir = pickNextDirection(train.direction, grid, gridSize, train.tileX, train.tileY);
    if (nextDir) {
      train.direction = nextDir;
    }
    
    // Update path
    train.path.push({ x: newTileX, y: newTileY });
    train.pathIndex++;
    
    // Keep path limited to avoid memory issues
    // Need enough history for longest possible train (10 carriages * 0.28 spacing = 2.8 tiles back)
    // Plus buffer for smooth transitions, so keep 80 tiles of history
    if (train.path.length > 80) {
      train.path.shift();
      train.pathIndex--;
    }
  }
  
  // Update carriage positions (follow the locomotive with delay)
  updateCarriagePositions(train, grid, gridSize);
  
  return true;
}

/**
 * Update positions of all carriages to follow the locomotive
 */
function updateCarriagePositions(
  train: Train,
  grid: Tile[][],
  gridSize: number
): void {
  // For newly spawned trains, start carriages behind the locomotive at the spawn point
  // They will gradually spread out as the train moves
  const spawnTile = train.path[0];
  
  for (let i = 0; i < train.carriages.length; i++) {
    const carriage = train.carriages[i];
    
    if (i === 0) {
      // Locomotive follows the train position directly
      carriage.tileX = train.tileX;
      carriage.tileY = train.tileY;
      carriage.progress = train.progress;
      carriage.direction = train.direction;
    } else {
      // Other carriages follow with offset
      const targetProgress = train.progress - i * CARRIAGE_SPACING;
      
      // Calculate which tile this carriage should be on
      let carriageTileX = train.tileX;
      let carriageTileY = train.tileY;
      let carriageProgress = targetProgress;
      let carriageDirection = train.direction;
      
      // Walk back along the path to find carriage position
      let pathIdx = train.pathIndex;
      let foundValidPosition = false;
      
      while (carriageProgress < 0 && pathIdx > 0) {
        pathIdx--;
        carriageProgress += 1;
        
        if (pathIdx >= 0 && pathIdx < train.path.length) {
          const prevTile = train.path[pathIdx];
          carriageTileX = prevTile.x;
          carriageTileY = prevTile.y;
          foundValidPosition = true;
          
          // Determine direction from this tile to next
          if (pathIdx + 1 < train.path.length) {
            const nextTile = train.path[pathIdx + 1];
            const dir = getDirectionToTile(prevTile.x, prevTile.y, nextTile.x, nextTile.y);
            if (dir) carriageDirection = dir;
          }
        }
      }
      
      // If we couldn't find enough path history (new train), stack carriages at spawn point
      // with increasing progress offset to simulate "arriving" from off-map
      if (!foundValidPosition && carriageProgress < 0) {
        carriageTileX = spawnTile.x;
        carriageTileY = spawnTile.y;
        // Keep them just behind the spawn with negative progress clamped to 0
        carriageProgress = 0;
      }
      
      // Clamp progress to valid range
      carriageProgress = Math.max(0, Math.min(0.99, carriageProgress));
      
      carriage.tileX = carriageTileX;
      carriage.tileY = carriageTileY;
      carriage.progress = carriageProgress;
      carriage.direction = carriageDirection;
    }
  }
}

// ============================================================================
// Train Drawing
// ============================================================================

/**
 * Draw a single train carriage on the correct track based on direction
 * Handles curve interpolation for smooth movement on curved tracks
 */
function drawCarriage(
  ctx: CanvasRenderingContext2D,
  carriage: TrainCarriage,
  zoom: number,
  grid: Tile[][],
  gridSize: number
): void {
  const { screenX, screenY } = gridToScreen(carriage.tileX, carriage.tileY, 0, 0);
  
  // Get track type for this tile to check if we're on a curve
  let trackType: TrackType = 'straight_ns';
  if (carriage.tileX >= 0 && carriage.tileX < gridSize && 
      carriage.tileY >= 0 && carriage.tileY < gridSize) {
    const connections = getAdjacentRail(grid, gridSize, carriage.tileX, carriage.tileY);
    trackType = getTrackType(connections);
  }
  
  // Calculate track offset based on direction
  const trackSide = getTrackSide(carriage.direction);
  const trackOffset = TILE_WIDTH * TRACK_SEPARATION_RATIO / 2;
  const offsetMultiplier = trackSide === 0 ? 1 : -1;
  
  let carX: number, carY: number, carAngle: number;
  
  // Check if we're on a curve and should interpolate
  const curveGeometry = getCurveGeometry(trackType, screenX, screenY);
  const curveTraversal = curveGeometry ? getCurveTraversalDirection(trackType, carriage.direction) : null;
  
  if (curveGeometry && curveTraversal) {
    // We're on a curve - interpolate position and angle along the bezier
    const { from, to, control } = curveGeometry;
    const { entryT, exitT } = curveTraversal;
    
    // Map progress (0-1) to curve parameter t
    // entryT tells us where we start, exitT where we end
    const t = entryT + (exitT - entryT) * carriage.progress;
    
    // Get perpendicular offset for the track separation
    // For curves, we need to offset perpendicular to the curve tangent
    const bezierResult = bezierPositionAndAngle(from, control, to, t);
    
    // Calculate perpendicular to the tangent at this point
    const tangentAngle = bezierResult.angle;
    const perpAngle = tangentAngle + Math.PI / 2;
    const perpX = Math.cos(perpAngle);
    const perpY = Math.sin(perpAngle);
    
    // Apply track offset
    carX = bezierResult.x + perpX * trackOffset * offsetMultiplier;
    carY = bezierResult.y + perpY * trackOffset * offsetMultiplier;
    carAngle = bezierResult.angle;
  } else {
    // Straight track or unknown - use linear interpolation
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[carriage.direction];
    
    // Get perpendicular direction for offset
    let perpX = 0, perpY = 0;
    if (carriage.direction === 'north' || carriage.direction === 'south') {
      perpX = ISO_EW.x;
      perpY = ISO_EW.y;
    } else {
      perpX = ISO_NS.x;
      perpY = ISO_NS.y;
    }
    
    const offsetX = perpX * trackOffset * offsetMultiplier;
    const offsetY = perpY * trackOffset * offsetMultiplier;
    
    carX = centerX + meta.vec.dx * carriage.progress + offsetX;
    carY = centerY + meta.vec.dy * carriage.progress + offsetY;
    carAngle = meta.angle;
  }
  
  ctx.save();
  ctx.translate(carX, carY);
  ctx.rotate(carAngle);
  
  // Bigger scale for better visibility
  const scale = zoom >= 0.8 ? 0.65 : 0.55;
  
  switch (carriage.type) {
    case 'locomotive':
      drawLocomotive(ctx, carriage.color, scale);
      break;
    case 'passenger':
      drawPassengerCar(ctx, carriage.color, scale);
      break;
    case 'freight_box':
      drawBoxCar(ctx, carriage.color, scale);
      break;
    case 'freight_tank':
      drawTankCar(ctx, carriage.color, scale);
      break;
    case 'freight_flat':
      drawFlatCar(ctx, carriage.color, scale);
      break;
    case 'caboose':
      drawCaboose(ctx, carriage.color, scale);
      break;
  }
  
  ctx.restore();
}

/**
 * Draw locomotive
 */
function drawLocomotive(ctx: CanvasRenderingContext2D, color: string, scale: number): void {
  const len = TRAIN_CAR.LOCOMOTIVE_LENGTH * scale;
  const wid = TRAIN_CAR.CAR_WIDTH * scale;
  
  // Main body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-len * 0.4, -wid);
  ctx.lineTo(len * 0.5, -wid);
  ctx.lineTo(len * 0.6, -wid * 0.5);
  ctx.lineTo(len * 0.6, wid * 0.5);
  ctx.lineTo(len * 0.5, wid);
  ctx.lineTo(-len * 0.4, wid);
  ctx.closePath();
  ctx.fill();
  
  // Cab (darker)
  ctx.fillStyle = darkenColor(color, 0.2);
  ctx.fillRect(-len * 0.4, -wid * 0.8, len * 0.35, wid * 1.6);
  
  // Windows
  ctx.fillStyle = 'rgba(135, 206, 250, 0.8)';
  ctx.fillRect(-len * 0.35, -wid * 0.5, len * 0.15, wid);
  
  // Front light
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(len * 0.55, 0, wid * 0.2, 0, Math.PI * 2);
  ctx.fill();
  
  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-len * 0.35, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.1, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(-len * 0.35, -wid * 1.2, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.1, -wid * 1.2, len * 0.15, wid * 0.3);
}

/**
 * Draw passenger car
 */
function drawPassengerCar(ctx: CanvasRenderingContext2D, color: string, scale: number): void {
  const len = TRAIN_CAR.CAR_LENGTH * scale;
  const wid = TRAIN_CAR.CAR_WIDTH * scale;
  
  // Main body
  ctx.fillStyle = color;
  ctx.fillRect(-len * 0.45, -wid, len * 0.9, wid * 2);
  
  // Roof (darker)
  ctx.fillStyle = darkenColor(color, 0.15);
  ctx.fillRect(-len * 0.45, -wid * 1.1, len * 0.9, wid * 0.3);
  
  // Windows
  ctx.fillStyle = 'rgba(135, 206, 250, 0.7)';
  for (let i = 0; i < 4; i++) {
    const wx = -len * 0.35 + i * len * 0.2;
    ctx.fillRect(wx, -wid * 0.6, len * 0.1, wid * 1.2);
  }
  
  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-len * 0.4, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.25, wid * 0.9, len * 0.15, wid * 0.3);
}

/**
 * Draw box car
 */
function drawBoxCar(ctx: CanvasRenderingContext2D, color: string, scale: number): void {
  const len = TRAIN_CAR.CAR_LENGTH * scale;
  const wid = TRAIN_CAR.CAR_WIDTH * scale;
  
  // Main body
  ctx.fillStyle = color;
  ctx.fillRect(-len * 0.45, -wid, len * 0.9, wid * 2);
  
  // Door
  ctx.fillStyle = darkenColor(color, 0.2);
  ctx.fillRect(-len * 0.15, -wid * 0.8, len * 0.3, wid * 1.6);
  
  // Door track
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-len * 0.2, -wid * 0.85);
  ctx.lineTo(len * 0.2, -wid * 0.85);
  ctx.stroke();
  
  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-len * 0.4, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.25, wid * 0.9, len * 0.15, wid * 0.3);
}

/**
 * Draw tank car
 */
function drawTankCar(ctx: CanvasRenderingContext2D, color: string, scale: number): void {
  const len = TRAIN_CAR.CAR_LENGTH * scale;
  const wid = TRAIN_CAR.CAR_WIDTH * scale;
  
  // Base frame
  ctx.fillStyle = '#333';
  ctx.fillRect(-len * 0.45, wid * 0.7, len * 0.9, wid * 0.4);
  
  // Tank body (elliptical)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.4, wid * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Tank highlights
  ctx.fillStyle = lightenColor(color, 0.2);
  ctx.beginPath();
  ctx.ellipse(0, -wid * 0.3, len * 0.35, wid * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-len * 0.4, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.25, wid * 0.9, len * 0.15, wid * 0.3);
}

/**
 * Draw flat car
 */
function drawFlatCar(ctx: CanvasRenderingContext2D, color: string, scale: number): void {
  const len = TRAIN_CAR.CAR_LENGTH * scale;
  const wid = TRAIN_CAR.CAR_WIDTH * scale;
  
  // Flat bed
  ctx.fillStyle = color;
  ctx.fillRect(-len * 0.45, -wid * 0.3, len * 0.9, wid * 0.6);
  
  // Edge rails
  ctx.fillStyle = darkenColor(color, 0.3);
  ctx.fillRect(-len * 0.45, -wid, len * 0.9, wid * 0.2);
  ctx.fillRect(-len * 0.45, wid * 0.8, len * 0.9, wid * 0.2);
  
  // Optional cargo (random boxes)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(-len * 0.3, -wid * 0.2, len * 0.25, wid * 0.4);
  ctx.fillRect(len * 0.1, -wid * 0.15, len * 0.2, wid * 0.3);
  
  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-len * 0.4, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.25, wid * 0.9, len * 0.15, wid * 0.3);
}

/**
 * Draw caboose
 */
function drawCaboose(ctx: CanvasRenderingContext2D, color: string, scale: number): void {
  const len = TRAIN_CAR.CAR_LENGTH * scale * 0.9;
  const wid = TRAIN_CAR.CAR_WIDTH * scale;
  
  // Main body
  ctx.fillStyle = color;
  ctx.fillRect(-len * 0.45, -wid, len * 0.9, wid * 2);
  
  // Cupola (observation deck on top)
  ctx.fillStyle = darkenColor(color, 0.1);
  ctx.fillRect(-len * 0.15, -wid * 1.3, len * 0.3, wid * 0.5);
  
  // Windows
  ctx.fillStyle = 'rgba(135, 206, 250, 0.7)';
  ctx.fillRect(-len * 0.35, -wid * 0.5, len * 0.15, wid);
  ctx.fillRect(len * 0.2, -wid * 0.5, len * 0.15, wid);
  
  // Cupola windows
  ctx.fillRect(-len * 0.1, -wid * 1.2, len * 0.08, wid * 0.3);
  ctx.fillRect(len * 0.02, -wid * 1.2, len * 0.08, wid * 0.3);
  
  // Rear platform
  ctx.fillStyle = darkenColor(color, 0.2);
  ctx.fillRect(-len * 0.55, -wid * 0.5, len * 0.1, wid);
  
  // Railing
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-len * 0.55, -wid * 0.6, len * 0.12, wid * 1.2);
  
  // Wheels
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-len * 0.35, wid * 0.9, len * 0.15, wid * 0.3);
  ctx.fillRect(len * 0.2, wid * 0.9, len * 0.15, wid * 0.3);
}

/**
 * Draw all trains
 */
export function drawTrains(
  ctx: CanvasRenderingContext2D,
  trains: Train[],
  offset: { x: number; y: number },
  zoom: number,
  canvasSize: { width: number; height: number },
  grid: Tile[][],
  gridSize: number
): void {
  const dpr = window.devicePixelRatio || 1;
  
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  // Calculate viewport bounds for culling
  const viewWidth = canvasSize.width / (dpr * zoom);
  const viewHeight = canvasSize.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
  
  // Sort trains by depth for proper rendering order
  const sortedTrains = [...trains].sort((a, b) => {
    const depthA = a.tileX + a.tileY;
    const depthB = b.tileX + b.tileY;
    return depthA - depthB;
  });
  
  for (const train of sortedTrains) {
    // Draw carriages from back to front
    for (let i = train.carriages.length - 1; i >= 0; i--) {
      const carriage = train.carriages[i];
      
      // Viewport culling
      const { screenX, screenY } = gridToScreen(carriage.tileX, carriage.tileY, 0, 0);
      if (screenX < viewLeft || screenX > viewRight || 
          screenY < viewTop || screenY > viewBottom) {
        continue;
      }
      
      drawCarriage(ctx, carriage, zoom, grid, gridSize);
    }
  }
  
  ctx.restore();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Darken a color by a percentage
 */
function darkenColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
  const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Lighten a color by a percentage
 */
function lightenColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + (255 - parseInt(hex.substr(0, 2), 16)) * amount);
  const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + (255 - parseInt(hex.substr(2, 2), 16)) * amount);
  const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + (255 - parseInt(hex.substr(4, 2), 16)) * amount);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
