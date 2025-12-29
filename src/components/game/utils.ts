import { Tile } from '@/types/game';
import { CarDirection, TILE_WIDTH, TILE_HEIGHT } from './types';
import { OPPOSITE_DIRECTION } from './constants';

// PERF: Pre-allocated typed arrays for BFS pathfinding to reduce GC pressure
// Max path length of 2048 nodes should be sufficient for most city sizes
const MAX_PATH_LENGTH = 2048;
const BFS_QUEUE_X = new Int16Array(MAX_PATH_LENGTH);
const BFS_QUEUE_Y = new Int16Array(MAX_PATH_LENGTH);
const BFS_PARENT_X = new Int16Array(MAX_PATH_LENGTH); // Parent index for path reconstruction
const BFS_PARENT_Y = new Int16Array(MAX_PATH_LENGTH);
const BFS_VISITED = new Uint8Array(256 * 256); // Max 256x256 grid size

// Get opposite direction
export function getOppositeDirection(direction: CarDirection): CarDirection {
  return OPPOSITE_DIRECTION[direction];
}

// Check if a tile is a road or road bridge (vehicles can traverse both)
// Rail bridges are NOT valid for cars
export function isRoadTile(gridData: Tile[][], gridSizeValue: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSizeValue || y >= gridSizeValue) return false;
  const tile = gridData[y][x];
  const type = tile.building.type;
  // Road bridges are valid, rail bridges are not
  if (type === 'bridge') {
    return tile.building.bridgeTrackType !== 'rail';
  }
  return type === 'road';
}

// Check if a car can enter a tile from a given direction
// Bridges can only be entered along their orientation (ns bridges: north/south, ew bridges: east/west)
function canEnterTileFromDirection(gridData: Tile[][], gridSizeValue: number, x: number, y: number, direction: CarDirection): boolean {
  if (x < 0 || y < 0 || x >= gridSizeValue || y >= gridSizeValue) return false;
  const tile = gridData[y]?.[x];
  if (!tile) return false;
  
  // If it's a bridge, check if the direction matches the bridge orientation
  if (tile.building.type === 'bridge') {
    // Rail bridges are not valid for cars
    if (tile.building.bridgeTrackType === 'rail') return false;
    
    const orientation = tile.building.bridgeOrientation;
    // ns bridges only allow north/south travel
    if (orientation === 'ns' && (direction === 'north' || direction === 'south')) return true;
    // ew bridges only allow east/west travel
    if (orientation === 'ew' && (direction === 'east' || direction === 'west')) return true;
    // Direction doesn't match bridge orientation - can't enter
    return false;
  }
  
  // Regular road tiles can be entered from any direction
  return tile.building.type === 'road';
}

// Get available direction options from a tile
export function getDirectionOptions(gridData: Tile[][], gridSizeValue: number, x: number, y: number): CarDirection[] {
  const options: CarDirection[] = [];
  if (isRoadTile(gridData, gridSizeValue, x - 1, y)) options.push('north');
  if (isRoadTile(gridData, gridSizeValue, x, y - 1)) options.push('east');
  if (isRoadTile(gridData, gridSizeValue, x + 1, y)) options.push('south');
  if (isRoadTile(gridData, gridSizeValue, x, y + 1)) options.push('west');
  return options;
}

// Pick next direction for vehicle movement
// On bridges, cars can only go straight (no turning)
// Cars can only enter bridges from valid directions matching the bridge orientation
export function pickNextDirection(
  previousDirection: CarDirection,
  gridData: Tile[][],
  gridSizeValue: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getDirectionOptions(gridData, gridSizeValue, x, y);
  if (options.length === 0) return null;
  
  // Check if current tile is a bridge - if so, only allow going straight
  const currentTile = gridData[y]?.[x];
  if (currentTile?.building.type === 'bridge') {
    // On a bridge, only continue in the same direction (no turning)
    if (options.includes(previousDirection)) {
      return previousDirection;
    }
    // If we can't continue straight, fall back to normal behavior
  }
  
  // Filter out directions that would enter a bridge from an invalid angle
  // For each direction, check if the target tile can be entered from that direction
  const directionOffsets: Record<CarDirection, { dx: number; dy: number }> = {
    'north': { dx: -1, dy: 0 },
    'south': { dx: 1, dy: 0 },
    'east': { dx: 0, dy: -1 },
    'west': { dx: 0, dy: 1 },
  };
  
  const validOptions = options.filter(dir => {
    const offset = directionOffsets[dir];
    const targetX = x + offset.dx;
    const targetY = y + offset.dy;
    return canEnterTileFromDirection(gridData, gridSizeValue, targetX, targetY, dir);
  });
  
  if (validOptions.length === 0) return null;
  
  const incoming = getOppositeDirection(previousDirection);
  const filtered = validOptions.filter(dir => dir !== incoming);
  const pool = filtered.length > 0 ? filtered : validOptions;
  return pool[Math.floor(Math.random() * pool.length)];
}

// PERF: Pre-allocated arrays for findNearestRoadToBuilding BFS
const ROAD_BFS_MAX_SIZE = 4096; // Max tiles to check
const ROAD_BFS_QUEUE_X = new Int16Array(ROAD_BFS_MAX_SIZE);
const ROAD_BFS_QUEUE_Y = new Int16Array(ROAD_BFS_MAX_SIZE);
const ROAD_BFS_QUEUE_DIST = new Int16Array(ROAD_BFS_MAX_SIZE);
const ROAD_BFS_VISITED = new Uint8Array(256 * 256); // Max 256x256 grid

// Direction offsets for 8-directional search
const ADJ_DX = [-1, 1, 0, 0, -1, -1, 1, 1];
const ADJ_DY = [0, 0, -1, 1, -1, 1, -1, 1];

// Find the nearest road tile adjacent to a building
// PERF: Uses pre-allocated typed arrays and numeric visited keys
export function findNearestRoadToBuilding(
  gridData: Tile[][],
  gridSizeValue: number,
  buildingX: number,
  buildingY: number
): { x: number; y: number } | null {
  // Check adjacent tiles first (distance 1) - including diagonals
  for (let d = 0; d < 8; d++) {
    const nx = buildingX + ADJ_DX[d];
    const ny = buildingY + ADJ_DY[d];
    if (isRoadTile(gridData, gridSizeValue, nx, ny)) {
      return { x: nx, y: ny };
    }
  }
  
  // For larger grids or edge cases, use optimized BFS
  const maxIdx = gridSizeValue * gridSizeValue;
  if (maxIdx > ROAD_BFS_VISITED.length) {
    // Fallback to string-based Set for very large grids
    return findNearestRoadLegacy(gridData, gridSizeValue, buildingX, buildingY);
  }
  
  // Clear visited array for the area we need
  for (let i = 0; i < maxIdx; i++) {
    ROAD_BFS_VISITED[i] = 0;
  }
  
  // BFS using pre-allocated arrays
  let queueHead = 0;
  let queueTail = 1;
  ROAD_BFS_QUEUE_X[0] = buildingX;
  ROAD_BFS_QUEUE_Y[0] = buildingY;
  ROAD_BFS_QUEUE_DIST[0] = 0;
  ROAD_BFS_VISITED[buildingY * gridSizeValue + buildingX] = 1;
  
  while (queueHead < queueTail && queueTail < ROAD_BFS_MAX_SIZE) {
    const cx = ROAD_BFS_QUEUE_X[queueHead];
    const cy = ROAD_BFS_QUEUE_Y[queueHead];
    const dist = ROAD_BFS_QUEUE_DIST[queueHead];
    queueHead++;
    
    if (dist > 20) break; // Max search distance
    
    for (let d = 0; d < 8; d++) {
      const nx = cx + ADJ_DX[d];
      const ny = cy + ADJ_DY[d];
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      
      const visitedIdx = ny * gridSizeValue + nx;
      if (ROAD_BFS_VISITED[visitedIdx]) continue;
      ROAD_BFS_VISITED[visitedIdx] = 1;
      
      if (isRoadTile(gridData, gridSizeValue, nx, ny)) {
        return { x: nx, y: ny };
      }
      
      ROAD_BFS_QUEUE_X[queueTail] = nx;
      ROAD_BFS_QUEUE_Y[queueTail] = ny;
      ROAD_BFS_QUEUE_DIST[queueTail] = dist + 1;
      queueTail++;
    }
  }
  
  return null;
}

// Legacy fallback for very large grids
function findNearestRoadLegacy(
  gridData: Tile[][],
  gridSizeValue: number,
  buildingX: number,
  buildingY: number
): { x: number; y: number } | null {
  const queue: { x: number; y: number; dist: number }[] = [{ x: buildingX, y: buildingY, dist: 0 }];
  const visited = new Set<number>(); // PERF: Use numeric keys
  visited.add(buildingY * gridSizeValue + buildingX);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.dist > 20) break;
    
    for (let d = 0; d < 8; d++) {
      const nx = current.x + ADJ_DX[d];
      const ny = current.y + ADJ_DY[d];
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      
      const key = ny * gridSizeValue + nx;
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (isRoadTile(gridData, gridSizeValue, nx, ny)) {
        return { x: nx, y: ny };
      }
      
      queue.push({ x: nx, y: ny, dist: current.dist + 1 });
    }
  }
  
  return null;
}

// BFS pathfinding on road network - finds path from start to a tile adjacent to target
// PERF: Uses pre-allocated typed arrays to avoid GC pressure from path copying
export function findPathOnRoads(
  gridData: Tile[][],
  gridSizeValue: number,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): { x: number; y: number }[] | null {
  // Find the nearest road tile to the target (since buildings aren't on roads)
  const targetRoad = findNearestRoadToBuilding(gridData, gridSizeValue, targetX, targetY);
  if (!targetRoad) return null;
  
  // Find the nearest road tile to the start (station)
  const startRoad = findNearestRoadToBuilding(gridData, gridSizeValue, startX, startY);
  if (!startRoad) return null;
  
  // If start and target roads are the same, return a simple path
  if (startRoad.x === targetRoad.x && startRoad.y === targetRoad.y) {
    return [{ x: startRoad.x, y: startRoad.y }];
  }
  
  // PERF: Clear visited array only for the area we need (faster than full clear)
  // Using numeric keys: index = y * gridSize + x
  const maxIdx = gridSizeValue * gridSizeValue;
  if (maxIdx > BFS_VISITED.length) {
    // Fallback to old method for very large grids
    return findPathOnRoadsLegacy(gridData, gridSizeValue, startRoad, targetRoad);
  }
  
  // Clear visited (only the portion we'll use)
  for (let i = 0; i < maxIdx; i++) {
    BFS_VISITED[i] = 0;
  }
  
  // BFS using pre-allocated arrays
  let queueHead = 0;
  let queueTail = 1;
  BFS_QUEUE_X[0] = startRoad.x;
  BFS_QUEUE_Y[0] = startRoad.y;
  BFS_PARENT_X[0] = -1; // -1 indicates start node
  BFS_PARENT_Y[0] = -1;
  BFS_VISITED[startRoad.y * gridSizeValue + startRoad.x] = 1;
  
  // Direction offsets
  const DX = [-1, 1, 0, 0];
  const DY = [0, 0, -1, 1];
  
  let foundIdx = -1;
  
  while (queueHead < queueTail && queueTail < MAX_PATH_LENGTH) {
    const cx = BFS_QUEUE_X[queueHead];
    const cy = BFS_QUEUE_Y[queueHead];
    const currentIdx = queueHead;
    queueHead++;
    
    // Check if we reached the target road
    if (cx === targetRoad.x && cy === targetRoad.y) {
      foundIdx = currentIdx;
      break;
    }
    
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      
      const visitedIdx = ny * gridSizeValue + nx;
      if (BFS_VISITED[visitedIdx]) continue;
      if (!isRoadTile(gridData, gridSizeValue, nx, ny)) continue;
      
      BFS_VISITED[visitedIdx] = 1;
      BFS_QUEUE_X[queueTail] = nx;
      BFS_QUEUE_Y[queueTail] = ny;
      BFS_PARENT_X[queueTail] = cx;
      BFS_PARENT_Y[queueTail] = cy;
      queueTail++;
    }
  }
  
  if (foundIdx === -1) return null;
  
  // Reconstruct path by walking back through parents
  const pathReverse: { x: number; y: number }[] = [];
  let idx = foundIdx;
  
  // Walk back through the BFS tree to reconstruct path
  while (idx >= 0) {
    pathReverse.push({ x: BFS_QUEUE_X[idx], y: BFS_QUEUE_Y[idx] });
    
    // Find parent index by searching queue
    const px = BFS_PARENT_X[idx];
    const py = BFS_PARENT_Y[idx];
    
    if (px === -1) break; // Reached start
    
    // Search backwards for parent position in queue
    let parentIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (BFS_QUEUE_X[i] === px && BFS_QUEUE_Y[i] === py) {
        parentIdx = i;
        break;
      }
    }
    idx = parentIdx;
  }
  
  // Reverse to get path from start to target
  return pathReverse.reverse();
}

// Legacy implementation for very large grids (fallback)
function findPathOnRoadsLegacy(
  gridData: Tile[][],
  gridSizeValue: number,
  startRoad: { x: number; y: number },
  targetRoad: { x: number; y: number }
): { x: number; y: number }[] | null {
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startRoad.x, y: startRoad.y, path: [{ x: startRoad.x, y: startRoad.y }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startRoad.x},${startRoad.y}`);
  
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.x === targetRoad.x && current.y === targetRoad.y) {
      return current.path;
    }
    
    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      if (visited.has(key)) continue;
      if (!isRoadTile(gridData, gridSizeValue, nx, ny)) continue;
      
      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        path: [...current.path, { x: nx, y: ny }],
      });
    }
  }
  
  return null;
}

// Get direction from current tile to next tile
export function getDirectionToTile(fromX: number, fromY: number, toX: number, toY: number): CarDirection | null {
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  if (dx === -1 && dy === 0) return 'north';
  if (dx === 1 && dy === 0) return 'south';
  if (dx === 0 && dy === -1) return 'east';
  if (dx === 0 && dy === 1) return 'west';
  
  return null;
}

// Convert grid coordinates to screen coordinates (isometric)
export function gridToScreen(x: number, y: number, offsetX: number, offsetY: number): { screenX: number; screenY: number } {
  const screenX = (x - y) * (TILE_WIDTH / 2) + offsetX;
  const screenY = (x + y) * (TILE_HEIGHT / 2) + offsetY;
  return { screenX, screenY };
}

// Convert screen coordinates to grid coordinates
export function screenToGrid(screenX: number, screenY: number, offsetX: number, offsetY: number): { gridX: number; gridY: number } {
  // Adjust for the fact that tile centers are offset by half a tile from gridToScreen coordinates
  // gridToScreen returns the top-left corner of the bounding box, but the visual center of the
  // diamond tile is at (screenX + TILE_WIDTH/2, screenY + TILE_HEIGHT/2)
  const adjustedX = screenX - offsetX - TILE_WIDTH / 2;
  const adjustedY = screenY - offsetY - TILE_HEIGHT / 2;
  
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  
  // Use Math.round for accurate tile selection - this gives us the tile whose center is closest
  return { gridX: Math.round(gridX), gridY: Math.round(gridY) };
}
