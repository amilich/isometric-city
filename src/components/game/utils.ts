import { Tile } from '@/types/game';
import { CarDirection, TILE_WIDTH, TILE_HEIGHT } from './types';
import { OPPOSITE_DIRECTION } from './constants';

// Get opposite direction
export function getOppositeDirection(direction: CarDirection): CarDirection {
  return OPPOSITE_DIRECTION[direction];
}

// Check if a tile is a road
export function isRoadTile(gridData: Tile[][], gridSizeValue: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSizeValue || y >= gridSizeValue) return false;
  return gridData[y][x].building.type === 'road';
}

// Check if a tile is a rail (tracks or station)
export function isRailTile(gridData: Tile[][], gridSizeValue: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSizeValue || y >= gridSizeValue) return false;
  const type = gridData[y][x].building.type;
  return type === 'rail' || type === 'rail_station';
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

// Get rail direction options
export function getRailDirectionOptions(gridData: Tile[][], gridSizeValue: number, x: number, y: number): CarDirection[] {
  const options: CarDirection[] = [];
  if (isRailTile(gridData, gridSizeValue, x - 1, y)) options.push('north');
  if (isRailTile(gridData, gridSizeValue, x, y - 1)) options.push('east');
  if (isRailTile(gridData, gridSizeValue, x + 1, y)) options.push('south');
  if (isRailTile(gridData, gridSizeValue, x, y + 1)) options.push('west');
  return options;
}

// Pick next direction for vehicle movement
export function pickNextDirection(
  previousDirection: CarDirection,
  gridData: Tile[][],
  gridSizeValue: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getDirectionOptions(gridData, gridSizeValue, x, y);
  if (options.length === 0) return null;
  const incoming = getOppositeDirection(previousDirection);
  const filtered = options.filter(dir => dir !== incoming);
  const pool = filtered.length > 0 ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Find the nearest road tile adjacent to a building
export function findNearestRoadToBuilding(
  gridData: Tile[][],
  gridSizeValue: number,
  buildingX: number,
  buildingY: number
): { x: number; y: number } | null {
  // Check adjacent tiles first (distance 1) - including diagonals
  const adjacentOffsets = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 1 },
  ];
  
  for (const { dx, dy } of adjacentOffsets) {
    const nx = buildingX + dx;
    const ny = buildingY + dy;
    if (isRoadTile(gridData, gridSizeValue, nx, ny)) {
      return { x: nx, y: ny };
    }
  }
  
  // BFS to find nearest road within reasonable distance (increased to 20)
  const queue: { x: number; y: number; dist: number }[] = [{ x: buildingX, y: buildingY, dist: 0 }];
  const visited = new Set<string>();
  visited.add(`${buildingX},${buildingY}`);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.dist > 20) break; // Increased max search distance
    
    for (const { dx, dy } of adjacentOffsets) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
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
  
  // BFS from start road to target road
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
    
    // Check if we reached the target road
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
  
  return null; // No path found
}

// BFS pathfinding directly on rail network between two rail tiles
export function findPathOnRails(
  gridData: Tile[][],
  gridSizeValue: number,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number
): { x: number; y: number }[] | null {
  if (!isRailTile(gridData, gridSizeValue, startX, startY)) return null;
  if (!isRailTile(gridData, gridSizeValue, targetX, targetY)) return null;

  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: startX, y: startY, path: [{ x: startX, y: startY }] },
  ];
  const visited = new Set<string>([`${startX},${startY}`]);
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === targetX && current.y === targetY) {
      return current.path;
    }

    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= gridSizeValue || ny >= gridSizeValue) continue;
      if (visited.has(key)) continue;
      if (!isRailTile(gridData, gridSizeValue, nx, ny)) continue;
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
