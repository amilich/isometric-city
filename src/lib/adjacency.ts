// Adjacency checks for buildings (water, roads, utilities)

import {
  Tile,
  BuildingType,
} from '@/types/game';

// Building types that require water adjacency
const WATERFRONT_BUILDINGS: BuildingType[] = ['marina_docks_small', 'pier_large'];

// Check if a building type requires water adjacency
export function requiresWaterAdjacency(buildingType: BuildingType): boolean {
  return WATERFRONT_BUILDINGS.includes(buildingType);
}

// Check if a building footprint is adjacent to water (for multi-tile buildings, any edge touching water counts)
// Returns whether water is found and if the sprite should be flipped to face it
// In isometric view, sprites can only be normal or horizontally mirrored
export function getWaterAdjacency(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  gridSize: number
): { hasWater: boolean; shouldFlip: boolean } {
  // In isometric view (looking from SE toward NW):
  // - The default sprite faces toward the "front" (south-east in world coords)
  // - To face the opposite direction, we flip horizontally
  
  // Check all four edges and track which sides have water
  let waterOnSouthOrEast = false; // "Front" sides - no flip needed
  let waterOnNorthOrWest = false; // "Back" sides - flip needed
  
  // Check south edge (y + height) - front-right in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y + height;
    if (checkY < gridSize && grid[checkY]?.[checkX]?.building.type === 'water') {
      waterOnSouthOrEast = true;
      break;
    }
  }
  
  // Check east edge (x + width) - front-left in isometric view
  if (!waterOnSouthOrEast) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x + width;
      const checkY = y + dy;
      if (checkX < gridSize && grid[checkY]?.[checkX]?.building.type === 'water') {
        waterOnSouthOrEast = true;
        break;
      }
    }
  }
  
  // Check north edge (y - 1) - back-left in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y - 1;
    if (checkY >= 0 && grid[checkY]?.[checkX]?.building.type === 'water') {
      waterOnNorthOrWest = true;
      break;
    }
  }
  
  // Check west edge (x - 1) - back-right in isometric view
  if (!waterOnNorthOrWest) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x - 1;
      const checkY = y + dy;
      if (checkX >= 0 && grid[checkY]?.[checkX]?.building.type === 'water') {
        waterOnNorthOrWest = true;
        break;
      }
    }
  }
  
  const hasWater = waterOnSouthOrEast || waterOnNorthOrWest;
  // Only flip if water is on the back sides and NOT on the front sides
  const shouldFlip = hasWater && waterOnNorthOrWest && !waterOnSouthOrEast;
  
  return { hasWater, shouldFlip };
}

// Check if a building footprint is adjacent to roads and determine flip direction
// Similar to getWaterAdjacency but for roads - makes buildings face the road
export function getRoadAdjacency(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  gridSize: number
): { hasRoad: boolean; shouldFlip: boolean } {
  // In isometric view (looking from SE toward NW):
  // - The default sprite faces toward the "front" (south-east in world coords)
  // - To face the opposite direction, we flip horizontally
  
  // Check all four edges and track which sides have roads
  let roadOnSouthOrEast = false; // "Front" sides - no flip needed
  let roadOnNorthOrWest = false; // "Back" sides - flip needed
  
  // Check south edge (y + height) - front-right in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y + height;
    const checkType = grid[checkY]?.[checkX]?.building.type;
    if (checkY < gridSize && (checkType === 'road' || checkType === 'bridge')) {
      roadOnSouthOrEast = true;
      break;
    }
  }
  
  // Check east edge (x + width) - front-left in isometric view
  if (!roadOnSouthOrEast) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x + width;
      const checkY = y + dy;
      const checkType = grid[checkY]?.[checkX]?.building.type;
      if (checkX < gridSize && (checkType === 'road' || checkType === 'bridge')) {
        roadOnSouthOrEast = true;
        break;
      }
    }
  }
  
  // Check north edge (y - 1) - back-left in isometric view
  for (let dx = 0; dx < width; dx++) {
    const checkX = x + dx;
    const checkY = y - 1;
    const checkType = grid[checkY]?.[checkX]?.building.type;
    if (checkY >= 0 && (checkType === 'road' || checkType === 'bridge')) {
      roadOnNorthOrWest = true;
      break;
    }
  }
  
  // Check west edge (x - 1) - back-right in isometric view
  if (!roadOnNorthOrWest) {
    for (let dy = 0; dy < height; dy++) {
      const checkX = x - 1;
      const checkY = y + dy;
      const checkType = grid[checkY]?.[checkX]?.building.type;
      if (checkX >= 0 && (checkType === 'road' || checkType === 'bridge')) {
        roadOnNorthOrWest = true;
        break;
      }
    }
  }
  
  const hasRoad = roadOnSouthOrEast || roadOnNorthOrWest;
  // Only flip if road is on the back sides and NOT on the front sides
  const shouldFlip = hasRoad && roadOnNorthOrWest && !roadOnSouthOrEast;
  
  return { hasRoad, shouldFlip };
}

// Check if there's a road tile at any edge of the map in a given direction
export function hasRoadAtEdge(grid: Tile[][], gridSize: number, direction: 'north' | 'south' | 'east' | 'west'): boolean {
  switch (direction) {
    case 'north':
      // Check top edge (y = 0)
      for (let x = 0; x < gridSize; x++) {
        const type = grid[0][x].building.type;
        if (type === 'road' || type === 'bridge') return true;
      }
      return false;
    case 'south':
      // Check bottom edge (y = gridSize - 1)
      for (let x = 0; x < gridSize; x++) {
        const type = grid[gridSize - 1][x].building.type;
        if (type === 'road' || type === 'bridge') return true;
      }
      return false;
    case 'east':
      // Check right edge (x = gridSize - 1)
      for (let y = 0; y < gridSize; y++) {
        const type = grid[y][gridSize - 1].building.type;
        if (type === 'road' || type === 'bridge') return true;
      }
      return false;
    case 'west':
      // Check left edge (x = 0)
      for (let y = 0; y < gridSize; y++) {
        const type = grid[y][0].building.type;
        if (type === 'road' || type === 'bridge') return true;
      }
      return false;
  }
}
