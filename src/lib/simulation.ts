// Simulation engine for IsoCity

import {
  GameState,
  Tile,
  Building,
  BuildingType,
  ZoneType,
  Stats,
  Budget,
  ServiceCoverage,
  AdvisorMessage,
  HistoryPoint,
  Notification,
  AdjacentCity,
  WaterBody,
  BridgeType,
  BridgeOrientation,
  BUILDING_STATS,
  RESIDENTIAL_BUILDINGS,
  COMMERCIAL_BUILDINGS,
  INDUSTRIAL_BUILDINGS,
  TOOL_INFO,
} from '@/types/game';
import { generateCityName, generateWaterName } from './names';
import { isMobile } from 'react-device-detect';

// Default grid size for new games
export const DEFAULT_GRID_SIZE = isMobile ? 50 : 70;

// Check if a factory_small at this position would render as a farm
// This matches the deterministic logic in Game.tsx for farm variant selection
function isFarmBuilding(x: number, y: number, buildingType: string): boolean {
  if (buildingType !== 'factory_small') return false;
  // Same seed calculation as in Game.tsx rendering
  const seed = (x * 31 + y * 17) % 100;
  // ~50% chance to be a farm variant (when seed < 50)
  return seed < 50;
}

// Check if a building is a "starter" type that can operate without utilities
// This includes all factory_small (farms AND small factories), small houses, and small shops
// All starter buildings represent small-scale, self-sufficient operations that don't need
// municipal power/water infrastructure to begin operating
function isStarterBuilding(x: number, y: number, buildingType: string): boolean {
  if (buildingType === 'house_small' || buildingType === 'shop_small') return true;
  // ALL factory_small are starters - they can spawn without utilities
  // Some will render as farms (~50%), others as small factories
  // Both represent small-scale operations that can function off-grid
  if (buildingType === 'factory_small') return true;
  return false;
}

// Perlin-like noise for terrain generation
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

// Generate 2-3 large, round lakes and return water bodies
function generateLakes(grid: Tile[][], size: number, seed: number): WaterBody[] {
  // Use noise to find potential lake centers - look for low points
  const lakeNoise = (x: number, y: number) => perlinNoise(x, y, seed + 1000, 3);
  
  // Find lake seed points (local minimums in noise)
  const lakeCenters: { x: number; y: number; noise: number }[] = [];
  const minDistFromEdge = Math.max(8, Math.floor(size * 0.15)); // Keep lakes away from ocean edges
  const minDistBetweenLakes = Math.max(size * 0.2, 10); // Adaptive but ensure minimum separation
  
  // Collect all potential lake centers with adaptive threshold
  // Start with a lenient threshold and tighten if we find too many
  let threshold = 0.5;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (lakeCenters.length < 2 && attempts < maxAttempts) {
    lakeCenters.length = 0; // Reset for this attempt
    
    for (let y = minDistFromEdge; y < size - minDistFromEdge; y++) {
      for (let x = minDistFromEdge; x < size - minDistFromEdge; x++) {
        const noiseVal = lakeNoise(x, y);
        
        // Check if this is a good lake center (low noise value)
        if (noiseVal < threshold) {
          // Check distance from other lake centers
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
    
    // If we found enough centers, break
    if (lakeCenters.length >= 2) break;
    
    // Otherwise, relax the threshold for next attempt
    threshold += 0.1;
    attempts++;
  }
  
  // If still no centers found, force create at least 2 lakes at strategic positions
  if (lakeCenters.length === 0) {
    // Place lakes at strategic positions, ensuring they're far enough from edges
    const safeZone = minDistFromEdge + 5; // Extra buffer for lake growth
    const quarterSize = Math.max(safeZone, Math.floor(size / 4));
    const threeQuarterSize = Math.min(size - safeZone, Math.floor(size * 3 / 4));
    lakeCenters.push(
      { x: quarterSize, y: quarterSize, noise: 0 },
      { x: threeQuarterSize, y: threeQuarterSize, noise: 0 }
    );
  } else if (lakeCenters.length === 1) {
    // If only one center found, add another at a safe distance
    const existing = lakeCenters[0];
    const safeZone = minDistFromEdge + 5;
    const quarterSize = Math.max(safeZone, Math.floor(size / 4));
    const threeQuarterSize = Math.min(size - safeZone, Math.floor(size * 3 / 4));
    let newX = existing.x > size / 2 ? quarterSize : threeQuarterSize;
    let newY = existing.y > size / 2 ? quarterSize : threeQuarterSize;
    lakeCenters.push({ x: newX, y: newY, noise: 0 });
  }
  
  // Sort by noise value (lowest first) and pick 2-3 best candidates
  lakeCenters.sort((a, b) => a.noise - b.noise);
  const numLakes = 2 + Math.floor(Math.random() * 2); // 2 or 3 lakes
  const selectedCenters = lakeCenters.slice(0, Math.min(numLakes, lakeCenters.length));
  
  const waterBodies: WaterBody[] = [];
  const usedLakeNames = new Set<string>();
  
  // Grow lakes from each center using radial expansion for rounder shapes
  for (const center of selectedCenters) {
    // Target size: 40-80 tiles for bigger lakes
    const targetSize = 40 + Math.floor(Math.random() * 41);
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number; noise: number }[] = [];
    
    // Add initial neighbors as candidates
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= minDistFromEdge && nx < size - minDistFromEdge && 
          ny >= minDistFromEdge && ny < size - minDistFromEdge) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = lakeNoise(nx, ny);
        candidates.push({ x: nx, y: ny, dist, noise });
      }
    }
    
    // Grow lake by adding adjacent tiles, prioritizing:
    // 1. Closer to center (for rounder shape)
    // 2. Lower noise values (for organic shape)
    while (lakeTiles.length < targetSize && candidates.length > 0) {
      // Sort by distance from center first, then noise
      candidates.sort((a, b) => {
        if (Math.abs(a.dist - b.dist) < 0.5) {
          return a.noise - b.noise; // If similar distance, prefer lower noise
        }
        return a.dist - b.dist; // Prefer closer tiles for rounder shape
      });
      
      // Pick from top candidates (closest/lowest noise)
      const pickIndex = Math.floor(Math.random() * Math.min(5, candidates.length));
      const picked = candidates.splice(pickIndex, 1)[0];
      
      // Check if already in lake
      if (lakeTiles.some(t => t.x === picked.x && t.y === picked.y)) continue;
      
      // Check if tile is valid (not already water from another lake)
      if (grid[picked.y][picked.x].building.type === 'water') continue;
      
      lakeTiles.push({ x: picked.x, y: picked.y });
      
      // Add new neighbors as candidates
      for (const [dx, dy] of directions) {
        const nx = picked.x + dx;
        const ny = picked.y + dy;
        if (nx >= minDistFromEdge && nx < size - minDistFromEdge && 
            ny >= minDistFromEdge && ny < size - minDistFromEdge &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          const dist = Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2);
          const noise = lakeNoise(nx, ny);
          candidates.push({ x: nx, y: ny, dist, noise });
        }
      }
    }
    
    // Apply lake tiles to grid
    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].building = createBuilding('water');
      grid[tile.y][tile.x].landValue = 60; // Water increases nearby land value
    }
    
    // Calculate center for labeling
    const avgX = lakeTiles.reduce((sum, t) => sum + t.x, 0) / lakeTiles.length;
    const avgY = lakeTiles.reduce((sum, t) => sum + t.y, 0) / lakeTiles.length;
    
    // Assign a random name to this lake
    let lakeName = generateWaterName('lake');
    while (usedLakeNames.has(lakeName)) {
      lakeName = generateWaterName('lake');
    }
    usedLakeNames.add(lakeName);
    
    // Add to water bodies list
    waterBodies.push({
      id: `lake-${waterBodies.length}`,
      name: lakeName,
      type: 'lake',
      tiles: lakeTiles,
      centerX: Math.round(avgX),
      centerY: Math.round(avgY),
    });
  }
  
  return waterBodies;
}

// Generate ocean connections on map edges (sometimes) with organic coastlines
function generateOceans(grid: Tile[][], size: number, seed: number): WaterBody[] {
  const waterBodies: WaterBody[] = [];
  const oceanChance = 0.4; // 40% chance per edge
  
  // Use noise for coastline variation
  const coastNoise = (x: number, y: number) => perlinNoise(x, y, seed + 2000, 3);
  
  // Check each edge independently
  const edges: Array<{ side: 'north' | 'east' | 'south' | 'west'; tiles: { x: number; y: number }[] }> = [];
  
  // Ocean parameters
  const baseDepth = Math.max(4, Math.floor(size * 0.12));
  const depthVariation = Math.max(4, Math.floor(size * 0.08));
  const maxDepth = Math.floor(size * 0.18);
  
  // Helper to generate organic ocean section along an edge
  const generateOceanEdge = (
    isHorizontal: boolean,
    edgePosition: number, // 0 for north/west, size-1 for south/east
    inwardDirection: 1 | -1 // 1 = increasing coord, -1 = decreasing coord
  ): { x: number; y: number }[] => {
    const tiles: { x: number; y: number }[] = [];
    
    // Randomize the span of the ocean (40-80% of edge, not full length)
    const spanStart = Math.floor(size * (0.05 + Math.random() * 0.25));
    const spanEnd = Math.floor(size * (0.7 + Math.random() * 0.25));
    
    for (let i = spanStart; i < spanEnd; i++) {
      // Use noise to determine depth at this position, with fade at edges
      const edgeFade = Math.min(
        (i - spanStart) / 5,
        (spanEnd - i) / 5,
        1
      );
      
      // Layer two noise frequencies for more interesting coastline
      // Higher frequency noise for fine detail, lower for broad shape
      const coarseNoise = coastNoise(
        isHorizontal ? i * 0.08 : edgePosition * 0.08,
        isHorizontal ? edgePosition * 0.08 : i * 0.08
      );
      const fineNoise = coastNoise(
        isHorizontal ? i * 0.25 : edgePosition * 0.25 + 500,
        isHorizontal ? edgePosition * 0.25 + 500 : i * 0.25
      );
      const noiseVal = coarseNoise * 0.6 + fineNoise * 0.4;
      
      // Depth varies based on noise and fades at the ends
      const rawDepth = baseDepth + (noiseVal - 0.5) * depthVariation * 2.5;
      const localDepth = Math.max(1, Math.min(Math.floor(rawDepth * edgeFade), maxDepth));
      
      // Place water tiles from edge inward
      for (let d = 0; d < localDepth; d++) {
        const x = isHorizontal ? i : (inwardDirection === 1 ? d : size - 1 - d);
        const y = isHorizontal ? (inwardDirection === 1 ? d : size - 1 - d) : i;
        
        if (x >= 0 && x < size && y >= 0 && y < size && grid[y][x].building.type !== 'water') {
          grid[y][x].building = createBuilding('water');
          grid[y][x].landValue = 60;
          tiles.push({ x, y });
        }
      }
    }
    
    return tiles;
  };
  
  // North edge (top, y=0, extends downward)
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(true, 0, 1);
    if (tiles.length > 0) {
      edges.push({ side: 'north', tiles });
    }
  }
  
  // South edge (bottom, y=size-1, extends upward)
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(true, size - 1, -1);
    if (tiles.length > 0) {
      edges.push({ side: 'south', tiles });
    }
  }
  
  // East edge (right, x=size-1, extends leftward)
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(false, size - 1, -1);
    if (tiles.length > 0) {
      edges.push({ side: 'east', tiles });
    }
  }
  
  // West edge (left, x=0, extends rightward)
  if (Math.random() < oceanChance) {
    const tiles = generateOceanEdge(false, 0, 1);
    if (tiles.length > 0) {
      edges.push({ side: 'west', tiles });
    }
  }
  
  // Create water body entries for oceans
  const usedOceanNames = new Set<string>();
  for (const edge of edges) {
    if (edge.tiles.length > 0) {
      const avgX = edge.tiles.reduce((sum, t) => sum + t.x, 0) / edge.tiles.length;
      const avgY = edge.tiles.reduce((sum, t) => sum + t.y, 0) / edge.tiles.length;
      
      let oceanName = generateWaterName('ocean');
      while (usedOceanNames.has(oceanName)) {
        oceanName = generateWaterName('ocean');
      }
      usedOceanNames.add(oceanName);
      
      waterBodies.push({
        id: `ocean-${edge.side}-${waterBodies.length}`,
        name: oceanName,
        type: 'ocean',
        tiles: edge.tiles,
        centerX: Math.round(avgX),
        centerY: Math.round(avgY),
      });
    }
  }
  
  return waterBodies;
}

// Generate adjacent cities - always create one for each direction (undiscovered until road reaches edge)
function generateAdjacentCities(): AdjacentCity[] {
  const cities: AdjacentCity[] = [];
  const directions: Array<'north' | 'south' | 'east' | 'west'> = ['north', 'south', 'east', 'west'];
  const usedNames = new Set<string>();
  
  for (const direction of directions) {
    let name: string;
    do {
      name = generateCityName();
    } while (usedNames.has(name));
    usedNames.add(name);
    
    cities.push({
      id: `city-${direction}`,
      name,
      direction,
      connected: false,
      discovered: false, // Cities are discovered when a road reaches their edge
    });
  }
  
  return cities;
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

// Check all edges and return cities that can be connected (have roads reaching them)
// Returns: { newlyDiscovered: cities just discovered, connectableExisting: already discovered but not connected }
export function checkForDiscoverableCities(
  grid: Tile[][],
  gridSize: number,
  adjacentCities: AdjacentCity[]
): AdjacentCity[] {
  const citiesToShow: AdjacentCity[] = [];
  
  for (const city of adjacentCities) {
    if (!city.connected && hasRoadAtEdge(grid, gridSize, city.direction)) {
      // Include both undiscovered cities (they'll be discovered) and discovered-but-unconnected cities
      if (!city.discovered) {
        // This is a new discovery
        citiesToShow.push(city);
      }
      // Note: We only return undiscovered cities here. For already-discovered cities,
      // the UI can show them in a different way (e.g., a persistent indicator)
    }
  }
  
  return citiesToShow;
}

// Check for cities that are discovered, have roads at their edge, but are not yet connected
// This can be used to remind players they can connect to a city
export function getConnectableCities(
  grid: Tile[][],
  gridSize: number,
  adjacentCities: AdjacentCity[]
): AdjacentCity[] {
  const connectable: AdjacentCity[] = [];
  
  for (const city of adjacentCities) {
    if (city.discovered && !city.connected && hasRoadAtEdge(grid, gridSize, city.direction)) {
      connectable.push(city);
    }
  }
  
  return connectable;
}

// Generate terrain - grass with scattered trees, lakes, and oceans
function generateTerrain(size: number): { grid: Tile[][]; waterBodies: WaterBody[] } {
  const grid: Tile[][] = [];
  const seed = Math.random() * 1000;

  // First pass: create base terrain with grass
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      row.push(createTile(x, y, 'grass'));
    }
    grid.push(row);
  }
  
  // Second pass: add lakes (small contiguous water regions)
  const lakeBodies = generateLakes(grid, size, seed);
  
  // Third pass: add oceans on edges (sometimes)
  const oceanBodies = generateOceans(grid, size, seed);
  
  // Combine all water bodies
  const waterBodies = [...lakeBodies, ...oceanBodies];
  
  // Fourth pass: add scattered trees (avoiding water)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].building.type === 'water') continue; // Don't place trees on water
      
      const treeNoise = perlinNoise(x * 2, y * 2, seed + 500, 2);
      const isTree = treeNoise > 0.72 && Math.random() > 0.65;
      
      // Also add some trees near water for visual appeal
      const nearWater = isNearWater(grid, x, y, size);
      const isTreeNearWater = nearWater && Math.random() > 0.7;

      if (isTree || isTreeNearWater) {
        grid[y][x].building = createBuilding('tree');
      }
    }
  }

  return { grid, waterBodies };
}

// Check if a tile is near water
function isNearWater(grid: Tile[][], x: number, y: number, size: number): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        if (grid[ny][nx].building.type === 'water') {
          return true;
        }
      }
    }
  }
  return false;
}

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

function createTile(x: number, y: number, buildingType: BuildingType = 'grass'): Tile {
  return {
    x,
    y,
    zone: 'none',
    building: createBuilding(buildingType),
    landValue: 50,
    pollution: 0,
    crime: 0,
    traffic: 0,
    hasSubway: false,
  };
}

// Building types that don't require construction (already complete when placed)
const NO_CONSTRUCTION_TYPES: BuildingType[] = ['grass', 'empty', 'water', 'road', 'bridge', 'tree'];

function createBuilding(type: BuildingType): Building {
  // Buildings that don't require construction start at 100% complete
  const constructionProgress = NO_CONSTRUCTION_TYPES.includes(type) ? 100 : 0;
  
  return {
    type,
    level: type === 'grass' || type === 'empty' || type === 'water' ? 0 : 1,
    population: 0,
    jobs: 0,
    powered: false,
    watered: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress,
    abandoned: false,
  };
}

// ============================================================================
// Bridge Detection and Creation
// ============================================================================

/** Maximum width of water a bridge can span */
const MAX_BRIDGE_SPAN = 10;

/** Bridge type thresholds based on span width */
const BRIDGE_TYPE_THRESHOLDS = {
  large: 5,    // 1-5 tiles = truss bridge
  suspension: 10, // 6-10 tiles = suspension bridge
} as const;

/** Get the appropriate bridge type for a given span */
function getBridgeTypeForSpan(span: number): BridgeType {
  // 1-tile bridges are simple bridges without trusses
  if (span === 1) return 'small';
  if (span <= BRIDGE_TYPE_THRESHOLDS.large) return 'large';
  return 'suspension';
}

/** Number of variants per bridge type */
const BRIDGE_VARIANTS: Record<BridgeType, number> = {
  small: 3,
  medium: 3,
  large: 2,
  suspension: 2,
};

/** Generate a deterministic variant based on position */
function getBridgeVariant(x: number, y: number, bridgeType: BridgeType): number {
  const seed = (x * 31 + y * 17) % 100;
  return seed % BRIDGE_VARIANTS[bridgeType];
}

/** Create a bridge building with all metadata */
function createBridgeBuilding(
  bridgeType: BridgeType,
  orientation: BridgeOrientation,
  variant: number,
  position: 'start' | 'middle' | 'end',
  index: number,
  span: number,
  trackType: 'road' | 'rail' = 'road'
): Building {
  return {
    type: 'bridge',
    level: 0,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
    bridgeType,
    bridgeOrientation: orientation,
    bridgeVariant: variant,
    bridgePosition: position,
    bridgeIndex: index,
    bridgeSpan: span,
    bridgeTrackType: trackType,
  };
}

/** Check if a tile at position is water */
function isWaterTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'water';
}

/** Check if a tile at position is a road or bridge */
function isRoadOrBridgeTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type === 'road' || type === 'bridge';
}

/** Bridge opportunity data */
interface BridgeOpportunity {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  orientation: BridgeOrientation;
  span: number;
  bridgeType: BridgeType;
  waterTiles: { x: number; y: number }[];
  trackType: 'road' | 'rail'; // What the bridge carries
}

/** Scan for a bridge opportunity in a specific direction */
function scanForBridgeInDirection(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  orientation: BridgeOrientation,
  trackType: 'road' | 'rail'
): BridgeOpportunity | null {
  const waterTiles: { x: number; y: number }[] = [];
  let x = startX + dx;
  let y = startY + dy;
  
  // Count consecutive water tiles
  while (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    const tile = grid[y][x];
    
    if (tile.building.type === 'water') {
      waterTiles.push({ x, y });
      
      // Check if we've exceeded max bridge span
      if (waterTiles.length > MAX_BRIDGE_SPAN) {
        return null; // Too wide to bridge
      }
    } else if (tile.building.type === trackType) {
      // Found the same track type on the other side - valid bridge opportunity!
      // Note: We only connect to the same track type, NOT to bridges
      // This prevents creating spurious bridges when placing tracks near existing bridges
      if (waterTiles.length > 0) {
        const span = waterTiles.length;
        const bridgeType = getBridgeTypeForSpan(span);
        
        return {
          startX,
          startY,
          endX: x,
          endY: y,
          orientation,
          span,
          bridgeType,
          waterTiles,
          trackType,
        };
      }
      return null;
    } else if (tile.building.type === 'bridge') {
      // Found a bridge - don't create another bridge connecting to it
      return null;
    } else {
      // Found land that's not the same track type - no bridge possible in this direction
      break;
    }
    
    x += dx;
    y += dy;
  }
  
  return null;
}

/** Detect if placing a road or rail creates a bridge opportunity from this tile */
function detectBridgeOpportunity(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  trackType: 'road' | 'rail'
): BridgeOpportunity | null {
  const tile = grid[y]?.[x];
  if (!tile) return null;
  
  // Only check from the specified track type tiles, not bridges
  // Bridges should only be created when dragging across water to another tile of the same type
  if (tile.building.type !== trackType) {
    return null;
  }
  
  // Check each direction for water followed by same track type
  // North (x-1, y stays same in grid coords)
  const northOpp = scanForBridgeInDirection(grid, gridSize, x, y, -1, 0, 'ns', trackType);
  if (northOpp) return northOpp;
  
  // South (x+1, y stays same)
  const southOpp = scanForBridgeInDirection(grid, gridSize, x, y, 1, 0, 'ns', trackType);
  if (southOpp) return southOpp;
  
  // East (x stays, y-1)
  const eastOpp = scanForBridgeInDirection(grid, gridSize, x, y, 0, -1, 'ew', trackType);
  if (eastOpp) return eastOpp;
  
  // West (x stays, y+1)
  const westOpp = scanForBridgeInDirection(grid, gridSize, x, y, 0, 1, 'ew', trackType);
  if (westOpp) return westOpp;
  
  return null;
}

/** Build bridges by converting water tiles to bridge tiles */
function buildBridges(
  grid: Tile[][],
  opportunity: BridgeOpportunity
): void {
  const variant = getBridgeVariant(
    opportunity.waterTiles[0].x,
    opportunity.waterTiles[0].y,
    opportunity.bridgeType
  );
  
  // Sort waterTiles consistently to ensure same result regardless of scan direction
  // For NS orientation (bridges going NW-SE on screen): sort by x first (grid row), then by y
  // For EW orientation (bridges going NE-SW on screen): sort by y first (grid column), then by x
  // This ensures 'start' is always at the NW/NE end and 'end' at the SE/SW end
  const sortedTiles = [...opportunity.waterTiles].sort((a, b) => {
    if (opportunity.orientation === 'ns') {
      // NS bridges: sort by x first (lower x = more NW on screen)
      return a.x !== b.x ? a.x - b.x : a.y - b.y;
    } else {
      // EW bridges: sort by y first (lower y = more NE on screen)
      return a.y !== b.y ? a.y - b.y : a.x - b.x;
    }
  });
  
  const span = sortedTiles.length;
  sortedTiles.forEach((pos, index) => {
    let position: 'start' | 'middle' | 'end';
    if (index === 0) {
      position = 'start';
    } else if (index === sortedTiles.length - 1) {
      position = 'end';
    } else {
      position = 'middle';
    }
    
    grid[pos.y][pos.x].building = createBridgeBuilding(
      opportunity.bridgeType,
      opportunity.orientation,
      variant,
      position,
      index,
      span,
      opportunity.trackType
    );
    // Keep the tile as having no zone
    grid[pos.y][pos.x].zone = 'none';
  });
}

/** Check and create bridges after road or rail placement */
function checkAndCreateBridges(
  grid: Tile[][],
  gridSize: number,
  placedX: number,
  placedY: number,
  trackType: 'road' | 'rail'
): void {
  // Check for bridge opportunities from the placed tile
  const opportunity = detectBridgeOpportunity(grid, gridSize, placedX, placedY, trackType);
  if (opportunity) {
    buildBridges(grid, opportunity);
  }
}

/**
 * Create bridges along a road or rail drag path.
 * This is called after a road/rail drag operation completes to create bridges
 * for any valid water crossings in the path.
 * 
 * IMPORTANT: Bridges are only created if the drag path actually crosses water.
 * This prevents auto-creating bridges when placing individual tiles on
 * opposite sides of water.
 * 
 * @param state - Current game state
 * @param pathTiles - Array of {x, y} coordinates that were part of the drag
 * @param trackType - Whether this is a 'road' or 'rail' bridge
 * @returns Updated game state with bridges created
 */
export function createBridgesOnPath(
  state: GameState,
  pathTiles: { x: number; y: number }[],
  trackType: 'road' | 'rail' = 'road'
): GameState {
  if (pathTiles.length === 0) return state;
  
  // Check if the drag path includes any water tiles
  // This ensures bridges are only created when actually dragging ACROSS water
  const hasWaterInPath = pathTiles.some(tile => {
    const t = state.grid[tile.y]?.[tile.x];
    return t && t.building.type === 'water';
  });
  
  // If no water tiles were crossed, don't create any bridges
  if (!hasWaterInPath) {
    return state;
  }
  
  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Check each tile of the specified track type in the path for bridge opportunities
  for (const tile of pathTiles) {
    // Only check from actual track type tiles (not water or other types)
    if (newGrid[tile.y]?.[tile.x]?.building.type === trackType) {
      checkAndCreateBridges(newGrid, state.gridSize, tile.x, tile.y, trackType);
    }
  }
  
  return { ...state, grid: newGrid };
}

function createInitialBudget(): Budget {
  return {
    police: { name: 'Police', funding: 100, cost: 0 },
    fire: { name: 'Fire', funding: 100, cost: 0 },
    health: { name: 'Health', funding: 100, cost: 0 },
    education: { name: 'Education', funding: 100, cost: 0 },
    transportation: { name: 'Transportation', funding: 100, cost: 0 },
    parks: { name: 'Parks', funding: 100, cost: 0 },
    power: { name: 'Power', funding: 100, cost: 0 },
    water: { name: 'Water', funding: 100, cost: 0 },
  };
}

function createInitialStats(): Stats {
  return {
    population: 0,
    jobs: 0,
    money: 100000,
    income: 0,
    expenses: 0,
    happiness: 50,
    health: 50,
    education: 50,
    safety: 50,
    environment: 75,
    demand: {
      residential: 50,
      commercial: 30,
      industrial: 40,
    },
  };
}

// PERF: Optimized service coverage grid creation
// Uses typed arrays internally for faster operations
function createServiceCoverage(size: number): ServiceCoverage {
  // Pre-allocate arrays with correct size to avoid resizing
  const createGrid = () => {
    const grid: number[][] = new Array(size);
    for (let y = 0; y < size; y++) {
      grid[y] = new Array(size).fill(0);
    }
    return grid;
  };
  
  const createBoolGrid = () => {
    const grid: boolean[][] = new Array(size);
    for (let y = 0; y < size; y++) {
      grid[y] = new Array(size).fill(false);
    }
    return grid;
  };

  return {
    police: createGrid(),
    fire: createGrid(),
    health: createGrid(),
    education: createGrid(),
    power: createBoolGrid(),
    water: createBoolGrid(),
  };
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

export function createInitialGameState(size: number = DEFAULT_GRID_SIZE, cityName: string = 'New City'): GameState {
  const { grid, waterBodies } = generateTerrain(size);
  const adjacentCities = generateAdjacentCities();
  
  // Create a default city covering the entire map
  const defaultCity: import('@/types/game').City = {
    id: generateUUID(),
    name: cityName,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: size - 1,
      maxY: size - 1,
    },
    economy: {
      population: 0,
      jobs: 0,
      income: 0,
      expenses: 0,
      happiness: 50,
      lastCalculated: 0,
    },
    color: '#3b82f6',
  };

  return {
    id: generateUUID(),
    grid,
    gridSize: size,
    cityName,
    year: 2024,
    month: 1,
    day: 1,
    hour: 12, // Start at noon
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 9,
    effectiveTaxRate: 9, // Start matching taxRate
    stats: createInitialStats(),
    budget: createInitialBudget(),
    services: createServiceCoverage(size),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: true,
    adjacentCities,
    waterBodies,
    gameVersion: 0,
    cities: [defaultCity],
  };
}

// Service building configuration - defined once, reused across calls
// Exported so overlay rendering can access radii
const withRange = <R extends number, T extends Record<string, unknown>>(
  range: R,
  extra: T
): { range: R; rangeSquared: number } & T => ({
  range,
  rangeSquared: range * range,
  ...extra,
});

export const SERVICE_CONFIG = {
  police_station: withRange(13, { type: 'police' as const }),
  fire_station: withRange(18, { type: 'fire' as const }),
  hospital: withRange(24, { type: 'health' as const }),
  school: withRange(11, { type: 'education' as const }),
  university: withRange(19, { type: 'education' as const }),
  power_plant: withRange(15, {}),
  water_tower: withRange(12, {}),
} as const;

// Building types that provide services
export const SERVICE_BUILDING_TYPES = new Set([
  'police_station', 'fire_station', 'hospital', 'school', 'university',
  'power_plant', 'water_tower'
]);

// Service building upgrade constants
export const SERVICE_MAX_LEVEL = 5;
export const SERVICE_RANGE_INCREASE_PER_LEVEL = 0.2; // 20% per level (Level 1: 100%, Level 5: 180%)
export const SERVICE_UPGRADE_COST_BASE = 2; // Cost = baseCost * (2 ^ currentLevel)

// Calculate service coverage from service buildings - optimized version
function calculateServiceCoverage(grid: Tile[][], size: number): ServiceCoverage {
  const services = createServiceCoverage(size);
  
  // First pass: collect all service building positions (much faster than checking every tile)
  const serviceBuildings: Array<{ x: number; y: number; type: BuildingType; level: number }> = [];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      
      // Quick check if this is a service building
      if (!SERVICE_BUILDING_TYPES.has(buildingType)) continue;
      
      // Skip buildings under construction
      if (tile.building.constructionProgress !== undefined && tile.building.constructionProgress < 100) {
        continue;
      }
      
      // Skip abandoned buildings
      if (tile.building.abandoned) {
        continue;
      }
      
      serviceBuildings.push({ x, y, type: buildingType, level: tile.building.level });
    }
  }
  
  // Second pass: apply coverage for each service building
  for (const building of serviceBuildings) {
    const { x, y, type, level } = building;
    const config = SERVICE_CONFIG[type as keyof typeof SERVICE_CONFIG];
    if (!config) continue;
    
    // Calculate effective range based on building level
    // Level 1: 100%, Level 2: 120%, Level 3: 140%, Level 4: 160%, Level 5: 180%
    const baseRange = config.range;
    const effectiveRange = baseRange * (1 + (level - 1) * SERVICE_RANGE_INCREASE_PER_LEVEL);
    const range = Math.floor(effectiveRange);
    const rangeSquared = range * range;
    
    // Calculate bounds to avoid checking tiles outside the grid
    const minY = Math.max(0, y - range);
    const maxY = Math.min(size - 1, y + range);
    const minX = Math.max(0, x - range);
    const maxX = Math.min(size - 1, x + range);
    
    // Handle power and water (boolean coverage)
    if (type === 'power_plant') {
      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          // Use squared distance comparison (avoid Math.sqrt)
          if (dx * dx + dy * dy <= rangeSquared) {
            services.power[ny][nx] = true;
          }
        }
      }
    } else if (type === 'water_tower') {
      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          if (dx * dx + dy * dy <= rangeSquared) {
            services.water[ny][nx] = true;
          }
        }
      }
    } else {
      // Handle percentage-based coverage (police, fire, health, education)
      const serviceType = (config as { type: 'police' | 'fire' | 'health' | 'education' }).type;
      const currentCoverage = services[serviceType] as number[][];
      
      for (let ny = minY; ny <= maxY; ny++) {
        for (let nx = minX; nx <= maxX; nx++) {
          const dx = nx - x;
          const dy = ny - y;
          const distSquared = dx * dx + dy * dy;
          
          if (distSquared <= rangeSquared) {
            // Only compute sqrt when we need the actual distance for coverage falloff
            const distance = Math.sqrt(distSquared);
            const coverage = Math.max(0, (1 - distance / range) * 100);
            currentCoverage[ny][nx] = Math.min(100, currentCoverage[ny][nx] + coverage);
          }
        }
      }
    }
  }

  return services;
}

// Upgrade a service building by increasing its level (increases coverage range)
// Returns updated state if successful, null if upgrade fails
export function upgradeServiceBuilding(state: GameState, x: number, y: number): GameState | null {
  const tile = state.grid[y]?.[x];
  if (!tile) return null;
  
  const building = tile.building;
  const buildingType = building.type;
  
  // Check if this is a service building
  if (!SERVICE_BUILDING_TYPES.has(buildingType)) return null;
  
  // Check if building is at max level
  if (building.level >= SERVICE_MAX_LEVEL) return null;
  
  // Check if building construction is complete
  if (building.constructionProgress !== undefined && building.constructionProgress < 100) {
    return null;
  }
  
  // Check if building is abandoned
  if (building.abandoned) return null;
  
  // Get base cost from TOOL_INFO
  const baseCost = TOOL_INFO[buildingType as keyof typeof TOOL_INFO]?.cost;
  if (!baseCost) return null;
  
  // Calculate upgrade cost: baseCost * (SERVICE_UPGRADE_COST_BASE ^ currentLevel)
  const upgradeCost = baseCost * Math.pow(SERVICE_UPGRADE_COST_BASE, building.level);
  
  // Check if player has enough money
  if (state.stats.money < upgradeCost) return null;
  
  // Create updated state with upgraded building
  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].building.level = building.level + 1;
  
  // Deduct money
  const newStats = {
    ...state.stats,
    money: state.stats.money - upgradeCost,
  };
  
  // Recalculate service coverage with new level
  const services = calculateServiceCoverage(newGrid, state.gridSize);
  
  return {
    ...state,
    grid: newGrid,
    stats: newStats,
    services,
  };
}

// Check if a multi-tile building can be SPAWNED at the given position
// This is stricter than canPlaceMultiTileBuilding - it doesn't allow 'empty' tiles
// because those are placeholders for existing multi-tile buildings
function canSpawnMultiTileBuilding(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  zone: ZoneType,
  gridSize: number
): boolean {
  if (x + width > gridSize || y + height > gridSize) {
    return false;
  }
  
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = grid[y + dy]?.[x + dx];
      if (!tile) return false;
      // Must be in the same zone
      if (tile.zone !== zone) return false;
      // Can only spawn on grass or trees
      // NOT 'empty' - those are placeholders for existing multi-tile buildings
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree') {
        return false;
      }
    }
  }
  
  return true;
}

// PERF: Pre-allocated arrays for hasRoadAccess BFS to avoid GC pressure
// Queue stores [x, y, dist] tuples as flat array (3 values per entry)
const roadAccessQueue = new Int16Array(3 * 256); // Max 256 tiles to check (8*8*4 directions)
const roadAccessVisited = new Uint8Array(128 * 128); // Max 128x128 grid, reused between calls

// Check if a tile has road access by looking for a path through the same zone
// within a limited distance. This allows large contiguous zones to develop even
// when only the perimeter touches a road.
function hasRoadAccess(
  grid: Tile[][],
  x: number,
  y: number,
  size: number,
  maxDistance: number = 8
): boolean {
  const startZone = grid[y][x].zone;
  if (startZone === 'none') {
    return false;
  }

  // PERF: Use typed array for visited flags instead of Set<string>
  // Clear only the area we'll actually use (maxDistance radius)
  const minClearX = Math.max(0, x - maxDistance);
  const maxClearX = Math.min(size - 1, x + maxDistance);
  const minClearY = Math.max(0, y - maxDistance);
  const maxClearY = Math.min(size - 1, y + maxDistance);
  for (let cy = minClearY; cy <= maxClearY; cy++) {
    for (let cx = minClearX; cx <= maxClearX; cx++) {
      roadAccessVisited[cy * size + cx] = 0;
    }
  }

  // BFS using flat queue array [x0, y0, dist0, x1, y1, dist1, ...]
  let queueHead = 0;
  let queueTail = 3;
  roadAccessQueue[0] = x;
  roadAccessQueue[1] = y;
  roadAccessQueue[2] = 0;
  roadAccessVisited[y * size + x] = 1;

  while (queueHead < queueTail) {
    const cx = roadAccessQueue[queueHead];
    const cy = roadAccessQueue[queueHead + 1];
    const dist = roadAccessQueue[queueHead + 2];
    queueHead += 3;
    
    if (dist >= maxDistance) {
      continue;
    }

    // Check all 4 directions: [-1,0], [1,0], [0,-1], [0,1]
    const neighbors = [
      [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

      const idx = ny * size + nx;
      if (roadAccessVisited[idx]) continue;
      roadAccessVisited[idx] = 1;

      const neighbor = grid[ny][nx];

      if (neighbor.building.type === 'road' || neighbor.building.type === 'bridge') {
        return true;
      }

      const isPassableZone = neighbor.zone === startZone && neighbor.building.type !== 'water';
      if (isPassableZone && queueTail < roadAccessQueue.length - 3) {
        roadAccessQueue[queueTail] = nx;
        roadAccessQueue[queueTail + 1] = ny;
        roadAccessQueue[queueTail + 2] = dist + 1;
        queueTail += 3;
      }
    }
  }

  return false;
}

// Evolve buildings based on conditions, reserving footprints as density increases
function evolveBuilding(grid: Tile[][], x: number, y: number, services: ServiceCoverage, demand?: { residential: number; commercial: number; industrial: number }): Building {
  const tile = grid[y][x];
  const building = tile.building;
  const zone = tile.zone;

  // Only evolve zoned tiles with real buildings
  if (zone === 'none' || building.type === 'grass' || building.type === 'water' || building.type === 'road' || building.type === 'bridge') {
    return building;
  }

  // Placeholder tiles from multi-tile footprints stay inert but track utilities
  if (building.type === 'empty') {
    building.powered = services.power[y][x];
    building.watered = services.water[y][x];
    building.population = 0;
    building.jobs = 0;
    return building;
  }

  building.powered = services.power[y][x];
  building.watered = services.water[y][x];

  const hasPower = building.powered;
  const hasWater = building.watered;
  const landValue = tile.landValue;
  
  // Starter buildings (farms, house_small, shop_small) don't require power/water
  const isStarter = isStarterBuilding(x, y, building.type);

  if (!isStarter && (!hasPower || !hasWater)) {
    return building;
  }

  // Progress construction if building is not yet complete
  // Construction requires power and water to progress (except farms)
  if (building.constructionProgress !== undefined && building.constructionProgress < 100) {
    // Construction speed scales with building size (larger buildings take longer)
    const constructionSpeed = getConstructionSpeed(building.type);
    building.constructionProgress = Math.min(100, building.constructionProgress + constructionSpeed);
    
    // While under construction, buildings don't generate population or jobs
    building.population = 0;
    building.jobs = 0;
    
    // Don't age or evolve until construction is complete
    return building;
  }

  // Get zone demand for abandonment/recovery logic
  const zoneDemandValue = demand ? (
    zone === 'residential' ? demand.residential :
    zone === 'commercial' ? demand.commercial :
    zone === 'industrial' ? demand.industrial : 0
  ) : 0;

  // === ABANDONMENT MECHANIC ===
  // Buildings can become abandoned when demand is very negative (oversupply)
  // Abandoned buildings produce nothing but can recover when demand returns
  
  if (building.abandoned) {
    // Abandoned building - check for recovery
    // When demand is positive, abandoned buildings have a chance to be cleared
    // The cleared land (zoned grass) can then be redeveloped
    if (zoneDemandValue > 10) {
      // Higher demand = higher chance of clearing abandoned building
      // At demand 30, ~3% chance per tick; at demand 60, ~8% chance
      const clearingChance = Math.min(0.12, (zoneDemandValue - 10) / 600);
      if (Math.random() < clearingChance) {
        // Clear the abandoned building - revert to zoned grass
        // This allows natural redevelopment when demand recovers
        // For multi-tile buildings, clear the entire footprint to avoid orphaned 'empty' tiles
        const size = getBuildingSize(building.type);
        if (size.width > 1 || size.height > 1) {
          // Clear all tiles in the footprint
          for (let dy = 0; dy < size.height; dy++) {
            for (let dx = 0; dx < size.width; dx++) {
              const clearTile = grid[y + dy]?.[x + dx];
              if (clearTile) {
                const clearedBuilding = createBuilding('grass');
                clearedBuilding.powered = services.power[y + dy]?.[x + dx] ?? false;
                clearedBuilding.watered = services.water[y + dy]?.[x + dx] ?? false;
                clearTile.building = clearedBuilding;
              }
            }
          }
        }
        // Return grass for the origin tile
        const clearedBuilding = createBuilding('grass');
        clearedBuilding.powered = building.powered;
        clearedBuilding.watered = building.watered;
        return clearedBuilding;
      }
    }
    
    // Abandoned buildings produce nothing
    building.population = 0;
    building.jobs = 0;
    // Abandoned buildings still age but much slower
    building.age = (building.age || 0) + 0.1;
    return building;
  }
  
  // Check if building should become abandoned (oversupply situation)
  // Only happens when demand is significantly negative and building has been around a while
  // Abandonment is gradual - even at worst conditions, only ~2-3% of buildings abandon per tick
  if (zoneDemandValue < -20 && building.age > 30) {
    // Worse demand = higher chance of abandonment, but capped low for gradual effect
    // At demand -40, ~0.5% chance per tick; at demand -100, ~2% chance
    const abandonmentChance = Math.min(0.02, Math.abs(zoneDemandValue + 20) / 4000);

    // Buildings without power/water are slightly more likely to be abandoned (except starter buildings)
    const utilityPenalty = isStarter ? 0 : ((!hasPower ? 0.005 : 0) + (!hasWater ? 0.005 : 0));

    // Lower-level buildings are slightly more likely to be abandoned
    const levelPenalty = building.level <= 2 ? 0.003 : 0;

    if (Math.random() < abandonmentChance + utilityPenalty + levelPenalty) {
      building.abandoned = true;
      building.population = 0;
      building.jobs = 0;
      return building;
    }
  }

  building.age = (building.age || 0) + 1;

  // Determine target building based on zone and conditions
  const buildingList = zone === 'residential' ? RESIDENTIAL_BUILDINGS :
    zone === 'commercial' ? COMMERCIAL_BUILDINGS :
    zone === 'industrial' ? INDUSTRIAL_BUILDINGS : [];

  // Calculate level based on land value, services, and demand
  const serviceCoverage = (
    services.police[y][x] +
    services.fire[y][x] +
    services.health[y][x] +
    services.education[y][x]
  ) / 4;

  // Get zone demand to factor into level calculation
  const zoneDemandForLevel = demand ? (
    zone === 'residential' ? demand.residential :
    zone === 'commercial' ? demand.commercial :
    zone === 'industrial' ? demand.industrial : 0
  ) : 0;
  
  // High demand increases target level, encouraging densification
  // At demand 60, adds ~0.5 level; at demand 100, adds ~1 level
  const demandLevelBoost = Math.max(0, (zoneDemandForLevel - 30) / 70) * 0.7;

  const targetLevel = Math.min(5, Math.max(1, Math.floor(
    (landValue / 24) + (serviceCoverage / 28) + (building.age / 60) + demandLevelBoost
  )));

  const targetIndex = Math.min(buildingList.length - 1, targetLevel - 1);
  const targetType = buildingList[targetIndex];
  let anchorX = x;
  let anchorY = y;

  // Calculate consolidation probability based on demand
  // Base probability is low to make consolidation gradual
  let consolidationChance = 0.08;
  let allowBuildingConsolidation = false;
  
  // Check if this is a small/medium density building that could consolidate
  const isSmallResidential = zone === 'residential' && 
    (building.type === 'house_small' || building.type === 'house_medium');
  const isSmallCommercial = zone === 'commercial' && 
    (building.type === 'shop_small' || building.type === 'shop_medium');
  const isSmallIndustrial = zone === 'industrial' && 
    building.type === 'factory_small';
  
  // Get relevant demand for this zone
  const zoneDemand = demand ? (
    zone === 'residential' ? demand.residential :
    zone === 'commercial' ? demand.commercial :
    zone === 'industrial' ? demand.industrial : 0
  ) : 0;
  
  if (zoneDemand > 30) {
    if (isSmallResidential || isSmallCommercial || isSmallIndustrial) {
      // Gradual boost based on demand: at demand 60 adds ~10%, at demand 100 adds ~23%
      const demandBoost = Math.min(0.25, (zoneDemand - 30) / 300);
      consolidationChance += demandBoost;
      
      // At very high demand (> 70), allow consolidating existing small buildings
      // but keep the probability increase modest
      if (zoneDemand > 70) {
        consolidationChance += 0.05;
        // Allow consolidating existing small buildings (not just empty land)
        // This enables developed areas to densify
        allowBuildingConsolidation = true;
      }
    }
  }

  // Attempt to upgrade footprint/density when the tile is mature enough
  // Keep consistent age requirement to prevent sudden mass consolidation
  // Consolidation ALWAYS requires utilities (power and water) - no farm exemption
  // because consolidation upgrades buildings to larger types that need utilities
  const ageRequirement = 12;
  const hasUtilitiesForConsolidation = hasPower && hasWater;
  if (hasUtilitiesForConsolidation && building.age > ageRequirement && (targetLevel > building.level || targetType !== building.type) && Math.random() < consolidationChance) {
    const size = getBuildingSize(targetType);
    const footprint = findFootprintIncludingTile(grid, x, y, size.width, size.height, zone, grid.length, allowBuildingConsolidation);

    if (footprint) {
      const anchor = applyBuildingFootprint(grid, footprint.originX, footprint.originY, targetType, zone, targetLevel, services);
      anchor.level = targetLevel;
      anchorX = footprint.originX;
      anchorY = footprint.originY;
    } else if (targetLevel > building.level) {
      // If we can't merge lots, still allow incremental level gain
      building.level = Math.min(targetLevel, building.level + 1);
    }
  }

  // Always refresh stats on the anchor tile
  const anchorTile = grid[anchorY][anchorX];
  const anchorBuilding = anchorTile.building;
  anchorBuilding.powered = services.power[anchorY][anchorX];
  anchorBuilding.watered = services.water[anchorY][anchorX];
  anchorBuilding.level = Math.max(anchorBuilding.level, Math.min(targetLevel, anchorBuilding.level + 1));

  const buildingStats = BUILDING_STATS[anchorBuilding.type];
  const efficiency = (anchorBuilding.powered ? 0.5 : 0) + (anchorBuilding.watered ? 0.5 : 0);

  anchorBuilding.population = buildingStats?.maxPop > 0
    ? Math.floor(buildingStats.maxPop * Math.max(1, anchorBuilding.level) * efficiency * 0.8)
    : 0;
  anchorBuilding.jobs = buildingStats?.maxJobs > 0
    ? Math.floor(buildingStats.maxJobs * Math.max(1, anchorBuilding.level) * efficiency * 0.8)
    : 0;

  return grid[y][x].building;
}

// Calculate city stats
// effectiveTaxRate is the lagged tax rate used for demand calculations
function calculateStats(grid: Tile[][], size: number, budget: Budget, taxRate: number, effectiveTaxRate: number, services: ServiceCoverage): Stats {
  let population = 0;
  let jobs = 0;
  let totalPollution = 0;
  let residentialZones = 0;
  let commercialZones = 0;
  let industrialZones = 0;
  let developedResidential = 0;
  let developedCommercial = 0;
  let developedIndustrial = 0;
  let totalLandValue = 0;
  let treeCount = 0;
  let waterCount = 0;
  let parkCount = 0;
  let subwayTiles = 0;
  let subwayStations = 0;
  let railTiles = 0;
  let railStations = 0;
  
  // Special buildings that affect demand
  let hasAirport = false;
  let hasCityHall = false;
  let hasSpaceProgram = false;
  let stadiumCount = 0;
  let museumCount = 0;
  let hasAmusementPark = false;

  // Count everything
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      const building = tile.building;

      // Apply subway commercial boost to jobs (tiles with subway get 15% boost to commercial jobs)
      let jobsFromTile = building.jobs;
      if (tile.hasSubway && tile.zone === 'commercial') {
        jobsFromTile = Math.floor(jobsFromTile * 1.15);
      }
      
      population += building.population;
      jobs += jobsFromTile;
      totalPollution += tile.pollution;
      totalLandValue += tile.landValue;

      if (tile.zone === 'residential') {
        residentialZones++;
        if (building.type !== 'grass' && building.type !== 'empty') developedResidential++;
      } else if (tile.zone === 'commercial') {
        commercialZones++;
        if (building.type !== 'grass' && building.type !== 'empty') developedCommercial++;
      } else if (tile.zone === 'industrial') {
        industrialZones++;
        if (building.type !== 'grass' && building.type !== 'empty') developedIndustrial++;
      }

      if (building.type === 'tree') treeCount++;
      if (building.type === 'water') waterCount++;
      if (building.type === 'park' || building.type === 'park_large') parkCount++;
      if (building.type === 'tennis') parkCount++; // Tennis courts count as parks
      if (tile.hasSubway) subwayTiles++;
      if (building.type === 'subway_station') subwayStations++;
      if (building.type === 'rail' || tile.hasRailOverlay) railTiles++;
      if (building.type === 'rail_station') railStations++;
      
      // Track special buildings (only count if construction is complete)
      if (building.constructionProgress === undefined || building.constructionProgress >= 100) {
        if (building.type === 'airport') hasAirport = true;
        if (building.type === 'city_hall') hasCityHall = true;
        if (building.type === 'space_program') hasSpaceProgram = true;
        if (building.type === 'stadium') stadiumCount++;
        if (building.type === 'museum') museumCount++;
        if (building.type === 'amusement_park') hasAmusementPark = true;
      }
    }
  }

  // Calculate demand - subway network boosts commercial demand
  // Tax rate affects demand as BOTH a multiplier and additive modifier:
  // - Multiplier: At 100% tax, demand is reduced to 0 regardless of other factors
  // - Additive: Small bonus/penalty around the base rate for fine-tuning
  // Base tax rate is 9%, so we calculate relative to that
  // Uses effectiveTaxRate (lagged) so changes don't impact demand immediately
  
  // Tax multiplier: 1.0 at 0% tax, ~1.0 at 9% tax, 0.0 at 100% tax
  // This ensures high taxes dramatically reduce demand regardless of other factors
  const taxMultiplier = Math.max(0, 1 - (effectiveTaxRate - 9) / 91);
  
  // Small additive modifier for fine-tuning around base rate
  // At 9% tax: 0. At 0% tax: +18. At 20% tax: -22
  const taxAdditiveModifier = (9 - effectiveTaxRate) * 2;
  
  const subwayBonus = Math.min(20, subwayTiles * 0.5 + subwayStations * 3);
  
  // Rail network bonuses - affects commercial (passenger rail, accessibility) and industrial (freight transport)
  // Rail stations have bigger impact than raw track count since they represent actual service
  // Industrial gets a stronger bonus as freight rail is critical for factories/warehouses
  const railCommercialBonus = Math.min(12, railTiles * 0.15 + railStations * 4);
  const railIndustrialBonus = Math.min(18, railTiles * 0.25 + railStations * 6);
  
  // Special building bonuses
  // Airport: Major boost to commercial (business travel) and industrial (cargo/logistics)
  const airportCommercialBonus = hasAirport ? 15 : 0;
  const airportIndustrialBonus = hasAirport ? 10 : 0;
  
  // City Hall: Modest boost to all demand (legitimacy, attracts businesses and residents)
  const cityHallResidentialBonus = hasCityHall ? 8 : 0;
  const cityHallCommercialBonus = hasCityHall ? 10 : 0;
  const cityHallIndustrialBonus = hasCityHall ? 5 : 0;
  
  // Space Program: Big boost to industrial (high-tech sector), modest boost to residential (prestige)
  const spaceProgramResidentialBonus = hasSpaceProgram ? 10 : 0;
  const spaceProgramIndustrialBonus = hasSpaceProgram ? 20 : 0;
  
  // Stadium: Boost to commercial (entertainment, visitors, sports bars)
  const stadiumCommercialBonus = Math.min(20, stadiumCount * 12);
  
  // Museum: Boost to commercial (tourism) and residential (culture/quality of life)
  const museumCommercialBonus = Math.min(15, museumCount * 8);
  const museumResidentialBonus = Math.min(10, museumCount * 5);
  
  // Amusement Park: Big boost to commercial (tourism, entertainment)
  const amusementParkCommercialBonus = hasAmusementPark ? 18 : 0;
  
  // Calculate base demands from economic factors
  const baseResidentialDemand = (jobs - population * 0.7) / 18;
  const baseCommercialDemand = (population * 0.3 - jobs * 0.3) / 4 + subwayBonus;
  const baseIndustrialDemand = (population * 0.35 - jobs * 0.3) / 2.0;
  
  // Add special building bonuses to base demands
  const residentialWithBonuses = baseResidentialDemand + cityHallResidentialBonus + spaceProgramResidentialBonus + museumResidentialBonus;
  const commercialWithBonuses = baseCommercialDemand + airportCommercialBonus + cityHallCommercialBonus + stadiumCommercialBonus + museumCommercialBonus + amusementParkCommercialBonus + railCommercialBonus;
  const industrialWithBonuses = baseIndustrialDemand + airportIndustrialBonus + cityHallIndustrialBonus + spaceProgramIndustrialBonus + railIndustrialBonus;
  
  // Apply tax effect: multiply by tax factor, then add small modifier
  // The multiplier ensures high taxes crush demand; the additive fine-tunes at normal rates
  const residentialDemand = Math.min(100, Math.max(-100, residentialWithBonuses * taxMultiplier + taxAdditiveModifier));
  const commercialDemand = Math.min(100, Math.max(-100, commercialWithBonuses * taxMultiplier + taxAdditiveModifier * 0.8));
  const industrialDemand = Math.min(100, Math.max(-100, industrialWithBonuses * taxMultiplier + taxAdditiveModifier * 0.5));

  // Calculate income and expenses
  const income = Math.floor(population * taxRate * 0.1 + jobs * taxRate * 0.05);
  
  let expenses = 0;
  expenses += Math.floor(budget.police.cost * budget.police.funding / 100);
  expenses += Math.floor(budget.fire.cost * budget.fire.funding / 100);
  expenses += Math.floor(budget.health.cost * budget.health.funding / 100);
  expenses += Math.floor(budget.education.cost * budget.education.funding / 100);
  expenses += Math.floor(budget.transportation.cost * budget.transportation.funding / 100);
  expenses += Math.floor(budget.parks.cost * budget.parks.funding / 100);
  expenses += Math.floor(budget.power.cost * budget.power.funding / 100);
  expenses += Math.floor(budget.water.cost * budget.water.funding / 100);

  // Calculate ratings
  const avgPoliceCoverage = calculateAverageCoverage(services.police);
  const avgFireCoverage = calculateAverageCoverage(services.fire);
  const avgHealthCoverage = calculateAverageCoverage(services.health);
  const avgEducationCoverage = calculateAverageCoverage(services.education);

  const safety = Math.min(100, avgPoliceCoverage * 0.7 + avgFireCoverage * 0.3);
  const health = Math.min(100, avgHealthCoverage * 0.8 + (100 - totalPollution / (size * size)) * 0.2);
  const education = Math.min(100, avgEducationCoverage);
  
  const greenRatio = (treeCount + waterCount + parkCount) / (size * size);
  const pollutionRatio = totalPollution / (size * size * 100);
  const environment = Math.min(100, Math.max(0, greenRatio * 200 - pollutionRatio * 100 + 50));

  const jobSatisfaction = jobs >= population ? 100 : (jobs / (population || 1)) * 100;
  const happiness = Math.min(100, (
    safety * 0.15 +
    health * 0.2 +
    education * 0.15 +
    environment * 0.15 +
    jobSatisfaction * 0.2 +
    (100 - taxRate * 3) * 0.15
  ));

  return {
    population,
    jobs,
    money: 0, // Will be updated from previous state
    income,
    expenses,
    happiness,
    health,
    education,
    safety,
    environment,
    demand: {
      residential: residentialDemand,
      commercial: commercialDemand,
      industrial: industrialDemand,
    },
  };
}

function calculateAverageCoverage(coverage: number[][]): number {
  let total = 0;
  let count = 0;
  for (const row of coverage) {
    for (const value of row) {
      total += value;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

// PERF: Update budget costs based on buildings - single pass through grid
function updateBudgetCosts(grid: Tile[][], budget: Budget): Budget {
  const newBudget = { ...budget };
  
  let policeCount = 0;
  let fireCount = 0;
  let hospitalCount = 0;
  let schoolCount = 0;
  let universityCount = 0;
  let parkCount = 0;
  let powerCount = 0;
  let waterCount = 0;
  let roadCount = 0;
  let subwayTileCount = 0;
  let subwayStationCount = 0;

  // PERF: Single pass through grid instead of two separate loops
  for (const row of grid) {
    for (const tile of row) {
      // Count subway tiles
      if (tile.hasSubway) subwayTileCount++;
      
      // Count building types using switch for jump table optimization
      switch (tile.building.type) {
        case 'police_station': policeCount++; break;
        case 'fire_station': fireCount++; break;
        case 'hospital': hospitalCount++; break;
        case 'school': schoolCount++; break;
        case 'university': universityCount++; break;
        case 'park': parkCount++; break;
        case 'park_large': parkCount++; break;
        case 'tennis': parkCount++; break;
        case 'power_plant': powerCount++; break;
        case 'water_tower': waterCount++; break;
        case 'road': roadCount++; break;
        case 'subway_station': subwayStationCount++; break;
      }
    }
  }

  newBudget.police.cost = policeCount * 50;
  newBudget.fire.cost = fireCount * 50;
  newBudget.health.cost = hospitalCount * 100;
  newBudget.education.cost = schoolCount * 30 + universityCount * 100;
  newBudget.transportation.cost = roadCount * 2 + subwayTileCount * 3 + subwayStationCount * 25;
  newBudget.parks.cost = parkCount * 10;
  newBudget.power.cost = powerCount * 150;
  newBudget.water.cost = waterCount * 75;

  return newBudget;
}

// PERF: Generate advisor messages - single pass through grid for all building counts
function generateAdvisorMessages(stats: Stats, services: ServiceCoverage, grid: Tile[][]): AdvisorMessage[] {
  const messages: AdvisorMessage[] = [];

  // PERF: Single pass through grid to collect all building stats
  let unpoweredBuildings = 0;
  let unwateredBuildings = 0;
  let abandonedBuildings = 0;
  let abandonedResidential = 0;
  let abandonedCommercial = 0;
  let abandonedIndustrial = 0;
  
  for (const row of grid) {
    for (const tile of row) {
      // Only count zoned buildings (not grass)
      if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        if (!tile.building.powered) unpoweredBuildings++;
        if (!tile.building.watered) unwateredBuildings++;
      }
      
      // Count abandoned buildings
      if (tile.building.abandoned) {
        abandonedBuildings++;
        if (tile.zone === 'residential') abandonedResidential++;
        else if (tile.zone === 'commercial') abandonedCommercial++;
        else if (tile.zone === 'industrial') abandonedIndustrial++;
      }
    }
  }

  // Power advisor
  if (unpoweredBuildings > 0) {
    messages.push({
      name: 'Power Advisor',
      icon: 'power',
      messages: [`${unpoweredBuildings} buildings lack power. Build more power plants!`],
      priority: unpoweredBuildings > 10 ? 'high' : 'medium',
    });
  }

  // Water advisor
  if (unwateredBuildings > 0) {
    messages.push({
      name: 'Water Advisor',
      icon: 'water',
      messages: [`${unwateredBuildings} buildings lack water. Build water towers!`],
      priority: unwateredBuildings > 10 ? 'high' : 'medium',
    });
  }

  // Finance advisor
  const netIncome = stats.income - stats.expenses;
  if (netIncome < 0) {
    messages.push({
      name: 'Finance Advisor',
      icon: 'cash',
      messages: [`City is running a deficit of $${Math.abs(netIncome)}/month. Consider raising taxes or cutting services.`],
      priority: netIncome < -500 ? 'critical' : 'high',
    });
  }

  // Safety advisor
  if (stats.safety < 40) {
    messages.push({
      name: 'Safety Advisor',
      icon: 'shield',
      messages: ['Crime is on the rise. Build more police stations to protect citizens.'],
      priority: stats.safety < 20 ? 'critical' : 'high',
    });
  }

  // Health advisor
  if (stats.health < 50) {
    messages.push({
      name: 'Health Advisor',
      icon: 'hospital',
      messages: ['Health services are lacking. Build hospitals to improve citizen health.'],
      priority: stats.health < 30 ? 'high' : 'medium',
    });
  }

  // Education advisor
  if (stats.education < 50) {
    messages.push({
      name: 'Education Advisor',
      icon: 'education',
      messages: ['Education levels are low. Build schools and universities.'],
      priority: stats.education < 30 ? 'high' : 'medium',
    });
  }

  // Environment advisor
  if (stats.environment < 40) {
    messages.push({
      name: 'Environment Advisor',
      icon: 'environment',
      messages: ['Pollution is high. Plant trees and build parks to improve air quality.'],
      priority: stats.environment < 20 ? 'high' : 'medium',
    });
  }

  // Jobs advisor
  const jobRatio = stats.jobs / (stats.population || 1);
  if (stats.population > 100 && jobRatio < 0.8) {
    messages.push({
      name: 'Employment Advisor',
      icon: 'jobs',
      messages: [`Unemployment is high. Zone more commercial and industrial areas.`],
      priority: jobRatio < 0.5 ? 'high' : 'medium',
    });
  }

  // Abandonment advisor (data already collected above)
  if (abandonedBuildings > 0) {
    const details: string[] = [];
    if (abandonedResidential > 0) details.push(`${abandonedResidential} residential`);
    if (abandonedCommercial > 0) details.push(`${abandonedCommercial} commercial`);
    if (abandonedIndustrial > 0) details.push(`${abandonedIndustrial} industrial`);
    
    messages.push({
      name: 'Urban Planning Advisor',
      icon: 'planning',
      messages: [
        `${abandonedBuildings} abandoned building${abandonedBuildings > 1 ? 's' : ''} in your city (${details.join(', ')}).`,
        'Oversupply has caused buildings to become vacant.',
        'Increase demand by growing your city or wait for natural redevelopment.'
      ],
      priority: abandonedBuildings > 10 ? 'high' : abandonedBuildings > 5 ? 'medium' : 'low',
    });
  }

  return messages;
}


// Main simulation tick
export function simulateTick(state: GameState): GameState {
  // Optimized: shallow clone rows, deep clone tiles only when modified
  const size = state.gridSize;
  
  // Pre-calculate service coverage once (read-only operation on original grid)
  const services = calculateServiceCoverage(state.grid, size);
  
  // Track which rows have been modified to avoid unnecessary row cloning
  const modifiedRows = new Set<number>();
  const newGrid: Tile[][] = new Array(size);
  
  // Initialize with references to original rows (will clone on write)
  for (let y = 0; y < size; y++) {
    newGrid[y] = state.grid[y];
  }
  
  // Helper to get a modifiable tile (clones row and tile on first write)
  const getModifiableTile = (x: number, y: number): Tile => {
    if (!modifiedRows.has(y)) {
      // Clone the row on first modification
      newGrid[y] = state.grid[y].map(t => ({ ...t, building: { ...t.building } }));
      modifiedRows.add(y);
    }
    return newGrid[y][x];
  };

  // Process all tiles
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const originalTile = state.grid[y][x];
      const originalBuilding = originalTile.building;
      
      // Fast path: skip tiles that definitely won't change
      // Water tiles are completely static
      if (originalBuilding.type === 'water') {
        continue;
      }
      
      // Check what updates this tile needs
      const newPowered = services.power[y][x];
      const newWatered = services.water[y][x];
      const needsPowerWaterUpdate = originalBuilding.powered !== newPowered ||
                                    originalBuilding.watered !== newWatered;
      
      // PERF: Roads and bridges are static unless bulldozed - skip if no utility update needed
      if ((originalBuilding.type === 'road' || originalBuilding.type === 'bridge') && !needsPowerWaterUpdate) {
        continue;
      }
      
      // Unzoned grass/trees with no pollution change - skip
      if (originalTile.zone === 'none' && 
          (originalBuilding.type === 'grass' || originalBuilding.type === 'tree') &&
          !needsPowerWaterUpdate &&
          originalTile.pollution < 0.01 &&
          (BUILDING_STATS[originalBuilding.type]?.pollution || 0) === 0) {
        continue;
      }
      
      // PERF: Completed service/park buildings with no state changes can skip heavy processing
      // They only need utility updates and pollution decay
      const isCompletedServiceBuilding = originalTile.zone === 'none' && 
          originalBuilding.constructionProgress === 100 &&
          !originalBuilding.onFire &&
          originalBuilding.type !== 'grass' && 
          originalBuilding.type !== 'tree' &&
          originalBuilding.type !== 'empty';
      if (isCompletedServiceBuilding && !needsPowerWaterUpdate && originalTile.pollution < 0.01) {
        continue;
      }
      
      // Get modifiable tile for this position
      const tile = getModifiableTile(x, y);
      
      // Update utilities
      tile.building.powered = newPowered;
      tile.building.watered = newWatered;

      // Progress construction for non-zoned buildings (service buildings, parks, etc.)
      // Zoned buildings handle construction in evolveBuilding
      if (tile.zone === 'none' &&
          tile.building.constructionProgress !== undefined &&
          tile.building.constructionProgress < 100 &&
          !NO_CONSTRUCTION_TYPES.includes(tile.building.type)) {
        const isUtilityBuilding = tile.building.type === 'power_plant' || tile.building.type === 'water_tower';
        const canConstruct = isUtilityBuilding || (tile.building.powered && tile.building.watered);
        
        if (canConstruct) {
          const constructionSpeed = getConstructionSpeed(tile.building.type);
          tile.building.constructionProgress = Math.min(100, tile.building.constructionProgress + constructionSpeed);
        }
      }

      // Cleanup orphaned 'empty' tiles
      if (tile.building.type === 'empty') {
        const origin = findBuildingOrigin(newGrid, x, y, size);
        if (!origin) {
          tile.building = createBuilding('grass');
          tile.building.powered = newPowered;
          tile.building.watered = newWatered;
        }
      }

      // Check for road access and grow buildings in zones
      if (tile.zone !== 'none' && tile.building.type === 'grass') {
        const roadAccess = hasRoadAccess(newGrid, x, y, size);
        const hasPower = newPowered;
        const hasWater = newWatered;

        // Get zone demand to factor into spawn probability
        const zoneDemandForSpawn = state.stats.demand ? (
          tile.zone === 'residential' ? state.stats.demand.residential :
          tile.zone === 'commercial' ? state.stats.demand.commercial :
          tile.zone === 'industrial' ? state.stats.demand.industrial : 0
        ) : 0;
        
        // Spawn probability scales with demand:
        // - At demand >= 50: 5% base chance (normal)
        // - At demand 0: 2.5% chance (reduced)
        // - At demand <= -30: 0% chance (no new buildings when oversupplied)
        // This creates natural market response to taxation and supply/demand
        const baseSpawnChance = 0.05;
        const demandFactor = Math.max(0, Math.min(1, (zoneDemandForSpawn + 30) / 80));
        const spawnChance = baseSpawnChance * demandFactor;

        // Starter buildings (house_small, shop_small, farms) can spawn without power/water
        const buildingList = tile.zone === 'residential' ? RESIDENTIAL_BUILDINGS :
          tile.zone === 'commercial' ? COMMERCIAL_BUILDINGS : INDUSTRIAL_BUILDINGS;
        const candidate = buildingList[0];
        const wouldBeStarter = isStarterBuilding(x, y, candidate);
        const hasUtilities = hasPower && hasWater;
        
        if (roadAccess && (hasUtilities || wouldBeStarter) && Math.random() < spawnChance) {
          const candidateSize = getBuildingSize(candidate);
          if (canSpawnMultiTileBuilding(newGrid, x, y, candidateSize.width, candidateSize.height, tile.zone, size)) {
            // Pre-clone all rows that will be modified by the building footprint
            for (let dy = 0; dy < candidateSize.height && y + dy < size; dy++) {
              if (!modifiedRows.has(y + dy)) {
                newGrid[y + dy] = state.grid[y + dy].map(t => ({ ...t, building: { ...t.building } }));
                modifiedRows.add(y + dy);
              }
            }
            applyBuildingFootprint(newGrid, x, y, candidate, tile.zone, 1, services);
          }
        }
      } else if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        // Evolve existing building - this may modify multiple tiles for multi-tile buildings
        // The evolveBuilding function handles its own row modifications internally
        newGrid[y][x].building = evolveBuilding(newGrid, x, y, services, state.stats.demand);
      }

      // Update pollution from buildings
      const buildingStats = BUILDING_STATS[tile.building.type];
      tile.pollution = Math.max(0, tile.pollution * 0.95 + (buildingStats?.pollution || 0));

      // Fire simulation
      if (state.disastersEnabled && tile.building.onFire) {
        const fireCoverage = services.fire[y][x];
        const fightingChance = fireCoverage / 300;
        
        if (Math.random() < fightingChance) {
          tile.building.onFire = false;
          tile.building.fireProgress = 0;
        } else {
          tile.building.fireProgress += 2/3; // Reduced from 1 to make fires last ~50% longer
          if (tile.building.fireProgress >= 100) {
            tile.building = createBuilding('grass');
            tile.zone = 'none';
          }
        }
      }

      // Fire spread to adjacent buildings
      // Check if any neighboring tile is on fire and spread with a chance reduced by fire coverage
      if (state.disastersEnabled && !tile.building.onFire &&
          tile.building.type !== 'grass' && tile.building.type !== 'water' &&
          tile.building.type !== 'road' && tile.building.type !== 'tree' &&
          tile.building.type !== 'empty' && tile.building.type !== 'bridge' &&
          tile.building.type !== 'rail') {
        // Check 4 adjacent tiles for fires
        const adjacentOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let adjacentFireCount = 0;
        
        for (const [dx, dy] of adjacentOffsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const neighbor = newGrid[ny][nx];
            if (neighbor.building.onFire) {
              adjacentFireCount++;
            }
          }
        }
        
        if (adjacentFireCount > 0) {
          // Base spread chance per adjacent fire: 0.5% per tick (reduced from 1.5%)
          // Fire coverage significantly reduces spread chance
          const fireCoverage = services.fire[y][x];
          const coverageReduction = fireCoverage / 100; // 0-1 based on coverage (100% coverage = 1)
          const baseSpreadChance = 0.005 * adjacentFireCount;
          const spreadChance = baseSpreadChance * (1 - coverageReduction * 0.95); // Fire coverage can reduce spread by up to 95%
          
          if (Math.random() < spreadChance) {
            tile.building.onFire = true;
            tile.building.fireProgress = 0;
          }
        }
      }

      // Random fire start
      if (state.disastersEnabled && !tile.building.onFire && 
          tile.building.type !== 'grass' && tile.building.type !== 'water' && 
          tile.building.type !== 'road' && tile.building.type !== 'tree' &&
          tile.building.type !== 'empty' &&
          Math.random() < 0.00003) {
        tile.building.onFire = true;
        tile.building.fireProgress = 0;
      }
    }
  }

  // Update budget costs
  const newBudget = updateBudgetCosts(newGrid, state.budget);

  // Gradually move effectiveTaxRate toward taxRate
  // This creates a lagging effect so tax changes don't immediately impact demand
  // Rate of change: 3% of difference per tick, so large changes take ~50-80 ticks (~2-3 game days)
  const taxRateDiff = state.taxRate - state.effectiveTaxRate;
  const newEffectiveTaxRate = state.effectiveTaxRate + taxRateDiff * 0.03;

  // Calculate stats (using lagged effectiveTaxRate for demand calculations)
  const newStats = calculateStats(newGrid, size, newBudget, state.taxRate, newEffectiveTaxRate, services);
  newStats.money = state.stats.money;

  // Smooth demand to prevent flickering in large cities
  // Rate of change: 12% of difference per tick, so changes stabilize in ~20-30 ticks (~1 game day)
  // This is faster than tax rate smoothing (3%) to stay responsive, but slow enough to eliminate flicker
  const prevDemand = state.stats.demand;
  if (prevDemand) {
    const smoothingFactor = 0.12;
    newStats.demand.residential = prevDemand.residential + (newStats.demand.residential - prevDemand.residential) * smoothingFactor;
    newStats.demand.commercial = prevDemand.commercial + (newStats.demand.commercial - prevDemand.commercial) * smoothingFactor;
    newStats.demand.industrial = prevDemand.industrial + (newStats.demand.industrial - prevDemand.industrial) * smoothingFactor;
  }

  // Update money on month change
  let newYear = state.year;
  let newMonth = state.month;
  let newDay = state.day;
  let newTick = state.tick + 1;
  
  // Calculate visual hour for day/night cycle (much slower than game time)
  // One full day/night cycle = 15 game days (450 ticks)
  // This makes the cycle atmospheric rather than jarring
  const totalTicks = ((state.year - 2024) * 12 * 30 * 30) + ((state.month - 1) * 30 * 30) + ((state.day - 1) * 30) + newTick;
  const cycleLength = 450; // ticks per visual day (15 game days)
  const newHour = Math.floor((totalTicks % cycleLength) / cycleLength * 24);

  if (newTick >= 30) {
    newTick = 0;
    newDay++;
    // Weekly income/expense (deposit every 7 days at 1/4 monthly rate)
    // Only deposit when day changes to a multiple of 7
    if (newDay % 7 === 0) {
      newStats.money += Math.floor((newStats.income - newStats.expenses) / 4);
    }
  }

  if (newDay > 30) {
    newDay = 1;
    newMonth++;
  }

  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  }

  // Generate advisor messages
  const advisorMessages = generateAdvisorMessages(newStats, services, newGrid);

  // Keep existing notifications
  const newNotifications = [...state.notifications];

  // Keep only recent notifications
  while (newNotifications.length > 10) {
    newNotifications.pop();
  }

  // Update history quarterly
  const history = [...state.history];
  if (newMonth % 3 === 0 && newDay === 1 && newTick === 0) {
    history.push({
      year: newYear,
      month: newMonth,
      population: newStats.population,
      money: newStats.money,
      happiness: newStats.happiness,
    });
    // Keep last 100 entries
    while (history.length > 100) {
      history.shift();
    }
  }

  return {
    ...state,
    grid: newGrid,
    year: newYear,
    month: newMonth,
    day: newDay,
    hour: newHour,
    tick: newTick,
    effectiveTaxRate: newEffectiveTaxRate,
    stats: newStats,
    budget: newBudget,
    services,
    advisorMessages,
    notifications: newNotifications,
    history,
  };
}

// Building sizes for multi-tile buildings (width x height)
const BUILDING_SIZES: Partial<Record<BuildingType, { width: number; height: number }>> = {
  power_plant: { width: 2, height: 2 },
  hospital: { width: 2, height: 2 },
  school: { width: 2, height: 2 },
  stadium: { width: 3, height: 3 },
  museum: { width: 3, height: 3 },
  university: { width: 3, height: 3 },
  airport: { width: 4, height: 4 },
  space_program: { width: 3, height: 3 },
  park_large: { width: 3, height: 3 },
  mansion: { width: 2, height: 2 },
  apartment_low: { width: 2, height: 2 },
  apartment_high: { width: 2, height: 2 },
  office_low: { width: 2, height: 2 },
  office_high: { width: 2, height: 2 },
  mall: { width: 3, height: 3 },
  // Industrial buildings - small is 1x1, medium is 2x2, large is 3x3
  factory_medium: { width: 2, height: 2 },
  factory_large: { width: 3, height: 3 },
  warehouse: { width: 2, height: 2 },
  city_hall: { width: 2, height: 2 },
  amusement_park: { width: 4, height: 4 },
  // Parks (new sprite sheet)
  playground_large: { width: 2, height: 2 },
  baseball_field_small: { width: 2, height: 2 },
  football_field: { width: 2, height: 2 },
  baseball_stadium: { width: 3, height: 3 },
  mini_golf_course: { width: 2, height: 2 },
  go_kart_track: { width: 2, height: 2 },
  amphitheater: { width: 2, height: 2 },
  greenhouse_garden: { width: 2, height: 2 },
  marina_docks_small: { width: 2, height: 2 },
  roller_coaster_small: { width: 2, height: 2 },
  mountain_lodge: { width: 2, height: 2 },
  mountain_trailhead: { width: 3, height: 3 },
  // Transportation
  rail_station: { width: 2, height: 2 },
};

// Get the size of a building (how many tiles it spans)
export function getBuildingSize(buildingType: BuildingType): { width: number; height: number } {
  return BUILDING_SIZES[buildingType] || { width: 1, height: 1 };
}

// Get construction speed for a building type (larger buildings take longer)
// Returns percentage progress per tick
function getConstructionSpeed(buildingType: BuildingType): number {
  const size = getBuildingSize(buildingType);
  const area = size.width * size.height;

  // Base speed: 24-36% per tick for 1x1 buildings (~3-4 ticks to complete)
  // Scale down by sqrt of area so larger buildings take proportionally longer:
  // - 1x1 (1 tile):  24-36% per tick → ~3-4 ticks
  // - 2x2 (4 tiles): 12-18% per tick → ~6-8 ticks
  // - 3x3 (9 tiles): 8-12% per tick → ~9-12 ticks
  // - 4x4 (16 tiles): 6-9% per tick → ~11-16 ticks
  // Construction takes 30% longer overall (speed reduced by 1/1.3)
  const baseSpeed = 24 + Math.random() * 12;
  return (baseSpeed / Math.sqrt(area)) / 1.3;
}

// Check if a multi-tile building can be placed at the given position
function canPlaceMultiTileBuilding(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  gridSize: number
): boolean {
  // Check bounds
  if (x + width > gridSize || y + height > gridSize) {
    return false;
  }

  // Check all tiles are available (grass or tree only - not water, roads, or existing buildings)
  // NOTE: 'empty' tiles are placeholders from multi-tile buildings, so we can't build on them
  // without first bulldozing the entire parent building
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = grid[y + dy]?.[x + dx];
      if (!tile) return false;
      // Can only build on grass or trees - roads must be bulldozed first
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree') {
        return false;
      }
    }
  }

  return true;
}

// Footprint helpers for organic growth and merging
// IMPORTANT: Only allow consolidation of truly empty land (grass, tree).
// Do NOT include 'empty' tiles - those are placeholders for existing multi-tile buildings!
// Including 'empty' would allow buildings to overlap with each other during evolution.
const MERGEABLE_TILE_TYPES = new Set<BuildingType>(['grass', 'tree']);

// Small buildings that can be consolidated into larger ones when demand is high
const CONSOLIDATABLE_BUILDINGS: Record<ZoneType, Set<BuildingType>> = {
  residential: new Set(['house_small', 'house_medium']),
  commercial: new Set(['shop_small', 'shop_medium']),
  industrial: new Set(['factory_small']),
  none: new Set(),
};

function isMergeableZoneTile(
  tile: Tile, 
  zone: ZoneType, 
  excludeTile?: { x: number; y: number },
  allowBuildingConsolidation?: boolean
): boolean {
  // The tile being upgraded is always considered mergeable (it's the source of the evolution)
  if (excludeTile && tile.x === excludeTile.x && tile.y === excludeTile.y) {
    return tile.zone === zone && !tile.building.onFire && 
           tile.building.type !== 'water' && tile.building.type !== 'road';
  }
  
  if (tile.zone !== zone) return false;
  if (tile.building.onFire) return false;
  if (tile.building.type === 'water' || tile.building.type === 'road' || tile.building.type === 'bridge') return false;
  
  // Always allow merging grass and trees - truly unoccupied tiles
  if (MERGEABLE_TILE_TYPES.has(tile.building.type)) {
    return true;
  }
  
  // When demand is high, allow consolidating small buildings into larger ones
  // This enables developed areas to densify without requiring empty land
  if (allowBuildingConsolidation && CONSOLIDATABLE_BUILDINGS[zone]?.has(tile.building.type)) {
    return true;
  }
  
  // 'empty' tiles are placeholders for multi-tile buildings and must NOT be merged
  return false;
}

function footprintAvailable(
  grid: Tile[][],
  originX: number,
  originY: number,
  width: number,
  height: number,
  zone: ZoneType,
  gridSize: number,
  excludeTile?: { x: number; y: number },
  allowBuildingConsolidation?: boolean
): boolean {
  if (originX < 0 || originY < 0 || originX + width > gridSize || originY + height > gridSize) {
    return false;
  }

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = grid[originY + dy][originX + dx];
      if (!isMergeableZoneTile(tile, zone, excludeTile, allowBuildingConsolidation)) {
        return false;
      }
    }
  }
  return true;
}

function scoreFootprint(grid: Tile[][], originX: number, originY: number, width: number, height: number, gridSize: number): number {
  // Prefer footprints that touch roads for access
  let roadScore = 0;
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const gx = originX + dx;
      const gy = originY + dy;
      for (const [ox, oy] of offsets) {
        const nx = gx + ox;
        const ny = gy + oy;
        if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize) {
          const adjacentType = grid[ny][nx].building.type;
          if (adjacentType === 'road' || adjacentType === 'bridge') {
            roadScore++;
          }
        }
      }
    }
  }

  // Smaller footprints and more road contacts rank higher
  return roadScore - width * height * 0.25;
}

function findFootprintIncludingTile(
  grid: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  zone: ZoneType,
  gridSize: number,
  allowBuildingConsolidation?: boolean
): { originX: number; originY: number } | null {
  const candidates: { originX: number; originY: number; score: number }[] = [];
  // The tile at (x, y) is the one being upgraded, so it should be excluded from the "can't merge existing buildings" check
  const excludeTile = { x, y };

  for (let oy = y - (height - 1); oy <= y; oy++) {
    for (let ox = x - (width - 1); ox <= x; ox++) {
      if (!footprintAvailable(grid, ox, oy, width, height, zone, gridSize, excludeTile, allowBuildingConsolidation)) continue;
      if (x < ox || x >= ox + width || y < oy || y >= oy + height) continue;

      const score = scoreFootprint(grid, ox, oy, width, height, gridSize);
      candidates.push({ originX: ox, originY: oy, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { originX: candidates[0].originX, originY: candidates[0].originY };
}

function applyBuildingFootprint(
  grid: Tile[][],
  originX: number,
  originY: number,
  buildingType: BuildingType,
  zone: ZoneType,
  level: number,
  services?: ServiceCoverage
): Building {
  const size = getBuildingSize(buildingType);
  const stats = BUILDING_STATS[buildingType] || { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 };

  for (let dy = 0; dy < size.height; dy++) {
    for (let dx = 0; dx < size.width; dx++) {
      const cell = grid[originY + dy][originX + dx];
      if (dx === 0 && dy === 0) {
        cell.building = createBuilding(buildingType);
        cell.building.level = level;
        cell.building.age = 0;
        if (services) {
          cell.building.powered = services.power[originY + dy][originX + dx];
          cell.building.watered = services.water[originY + dy][originX + dx];
        }
      } else {
        cell.building = createBuilding('empty');
        cell.building.level = 0;
      }
      cell.zone = zone;
      cell.pollution = dx === 0 && dy === 0 ? stats.pollution : 0;
    }
  }

  return grid[originY][originX].building;
}

// Place a building or zone
export function placeBuilding(
  state: GameState,
  x: number,
  y: number,
  buildingType: BuildingType | null,
  zone: ZoneType | null
): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;

  // Can't build on water
  if (tile.building.type === 'water') return state;

  // Can't place roads on existing buildings (only allow on grass, tree, existing roads, or rail - rail+road creates combined tile)
  // Note: 'empty' tiles are part of multi-tile building footprints, so roads can't be placed there either
  if (buildingType === 'road') {
    const allowedTypes: BuildingType[] = ['grass', 'tree', 'road', 'rail'];
    if (!allowedTypes.includes(tile.building.type)) {
      return state; // Can't place road on existing building
    }
  }

  // Can't place rail on existing buildings (only allow on grass, tree, existing rail, or road - rail+road creates combined tile)
  if (buildingType === 'rail') {
    const allowedTypes: BuildingType[] = ['grass', 'tree', 'rail', 'road'];
    if (!allowedTypes.includes(tile.building.type)) {
      return state; // Can't place rail on existing building
    }
  }

  // Roads, bridges, and rail can be combined, but other buildings require clearing first
  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && (tile.building.type === 'road' || tile.building.type === 'bridge')) {
    return state;
  }
  if (buildingType && buildingType !== 'road' && buildingType !== 'rail' && tile.building.type === 'rail') {
    return state;
  }

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));

  if (zone !== null) {
    // De-zoning (zone === 'none') can work on any zoned tile/building
    // Regular zoning can only be applied to grass, tree, or road tiles
    if (zone === 'none') {
      // Check if this tile is part of a multi-tile building (handles both origin and 'empty' tiles)
      const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
      
      if (origin) {
        // Dezone the entire multi-tile building
        const size = getBuildingSize(origin.buildingType);
        for (let dy = 0; dy < size.height; dy++) {
          for (let dx = 0; dx < size.width; dx++) {
            const clearX = origin.originX + dx;
            const clearY = origin.originY + dy;
            if (clearX < state.gridSize && clearY < state.gridSize) {
              newGrid[clearY][clearX].building = createBuilding('grass');
              newGrid[clearY][clearX].zone = 'none';
            }
          }
        }
      } else {
        // Single tile - can only dezone tiles that actually have a zone
        if (tile.zone === 'none') {
          return state;
        }
        // De-zoning resets to grass
        newGrid[y][x].zone = 'none';
        newGrid[y][x].building = createBuilding('grass');
      }
    } else {
      // Can't zone over existing buildings (only allow zoning on grass, tree, or road)
      // NOTE: 'empty' tiles are part of multi-tile buildings, so we can't zone them either
      const allowedTypesForZoning: BuildingType[] = ['grass', 'tree', 'road'];
      if (!allowedTypesForZoning.includes(tile.building.type)) {
        return state; // Can't zone over existing building or part of multi-tile building
      }
      // Setting zone
      newGrid[y][x].zone = zone;
    }
  } else if (buildingType) {
    const size = getBuildingSize(buildingType);
    
    // Check water adjacency requirement for waterfront buildings (marina, pier)
    let shouldFlip = false;
    if (requiresWaterAdjacency(buildingType)) {
      const waterCheck = getWaterAdjacency(newGrid, x, y, size.width, size.height, state.gridSize);
      if (!waterCheck.hasWater) {
        return state; // Waterfront buildings must be placed next to water
      }
      shouldFlip = waterCheck.shouldFlip;
    }
    
    if (size.width > 1 || size.height > 1) {
      // Multi-tile building - check if we can place it
      if (!canPlaceMultiTileBuilding(newGrid, x, y, size.width, size.height, state.gridSize)) {
        return state; // Can't place here
      }
      applyBuildingFootprint(newGrid, x, y, buildingType, 'none', 1);
      // Set flip for waterfront buildings to face the water
      if (shouldFlip) {
        newGrid[y][x].building.flipped = true;
      }
    } else {
      // Single tile building - check if tile is available
      // Can't place on water, existing buildings, or 'empty' tiles (part of multi-tile buildings)
      // Note: 'road' and 'rail' are included here so they can extend over existing roads/rails,
      // but non-road/rail buildings are already blocked from roads/rails by the checks above
      const allowedTypes: BuildingType[] = ['grass', 'tree', 'road', 'rail'];
      if (!allowedTypes.includes(tile.building.type)) {
        return state; // Can't place on existing building or part of multi-tile building
      }
      
      // Handle combined rail+road tiles
      if (buildingType === 'rail' && tile.building.type === 'road') {
        // Placing rail on road: keep as road with rail overlay
        newGrid[y][x].hasRailOverlay = true;
        // Don't change the building type - it stays as road
      } else if (buildingType === 'road' && tile.building.type === 'rail') {
        // Placing road on rail: convert to road with rail overlay
        newGrid[y][x].building = createBuilding('road');
        newGrid[y][x].hasRailOverlay = true;
        newGrid[y][x].zone = 'none';
      } else if (buildingType === 'rail' && tile.hasRailOverlay) {
        // Already has rail overlay, do nothing
      } else if (buildingType === 'road' && tile.hasRailOverlay) {
        // Already has road with rail overlay, do nothing
      } else {
        // Normal placement
        newGrid[y][x].building = createBuilding(buildingType);
        newGrid[y][x].zone = 'none';
        // Clear rail overlay if placing non-combined building
        if (buildingType !== 'road') {
          newGrid[y][x].hasRailOverlay = false;
        }
      }
      // Set flip for waterfront buildings to face the water
      if (shouldFlip) {
        newGrid[y][x].building.flipped = true;
      }
    }
    
    // NOTE: Bridge creation is handled separately during drag operations across water
    // We do NOT auto-create bridges here because placing individual road tiles on opposite
    // sides of water should not automatically create a bridge - only explicit dragging should
  }

  return { ...state, grid: newGrid };
}

// Find the origin tile of a multi-tile building that contains the given tile
// Returns null if the tile is not part of a multi-tile building
function findBuildingOrigin(
  grid: Tile[][],
  x: number,
  y: number,
  gridSize: number
): { originX: number; originY: number; buildingType: BuildingType } | null {
  const tile = grid[y]?.[x];
  if (!tile) return null;
  
  // Special handling for custom buildings - they use a different system
  // All tiles in a custom building have type='custom', but only the origin has customSpriteUrl
  if (tile.building.type === 'custom') {
    // If this tile has the sprite URL, it's the origin
    if (tile.building.customSpriteUrl && tile.building.customSize) {
      return { originX: x, originY: y, buildingType: 'custom' };
    }
    
    // Otherwise, search for the origin tile with the sprite URL
    if (tile.building.customSize && tile.building.customBuildingId) {
      const maxSize = tile.building.customSize;
      // Search in a square around the clicked tile
      for (let dy = -maxSize + 1; dy < maxSize; dy++) {
        for (let dx = -maxSize + 1; dx < maxSize; dx++) {
          const checkX = x + dx;
          const checkY = y + dy;
          if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
            const checkTile = grid[checkY][checkX];
            // Found the origin - it has the sprite URL and matches our building ID
            if (checkTile.building.type === 'custom' &&
                checkTile.building.customSpriteUrl &&
                checkTile.building.customBuildingId === tile.building.customBuildingId) {
              return { originX: checkX, originY: checkY, buildingType: 'custom' };
            }
          }
        }
      }
    }
    return null;
  }
  
  // If this tile has an actual building (not empty), check if it's multi-tile
  if (tile.building.type !== 'empty' && tile.building.type !== 'grass' && 
      tile.building.type !== 'water' && tile.building.type !== 'road' && 
      tile.building.type !== 'bridge' && tile.building.type !== 'rail' && tile.building.type !== 'tree') {
    const size = getBuildingSize(tile.building.type);
    if (size.width > 1 || size.height > 1) {
      return { originX: x, originY: y, buildingType: tile.building.type };
    }
    return null; // Single-tile building
  }
  
  // If this is an 'empty' tile, it might be part of a multi-tile building
  // Search nearby tiles to find the origin
  if (tile.building.type === 'empty') {
    // Check up to 4 tiles away (max building size is 4x4)
    const maxSize = 4;
    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const checkX = x - dx;
        const checkY = y - dy;
        if (checkX >= 0 && checkY >= 0 && checkX < gridSize && checkY < gridSize) {
          const checkTile = grid[checkY][checkX];
          if (checkTile.building.type !== 'empty' && 
              checkTile.building.type !== 'grass' &&
              checkTile.building.type !== 'water' &&
              checkTile.building.type !== 'road' &&
              checkTile.building.type !== 'bridge' &&
              checkTile.building.type !== 'rail' &&
              checkTile.building.type !== 'tree' &&
              checkTile.building.type !== 'custom') { // Skip custom buildings - handled above
            const size = getBuildingSize(checkTile.building.type);
            // Check if this building's footprint includes our original tile
            if (x >= checkX && x < checkX + size.width &&
                y >= checkY && y < checkY + size.height) {
              return { originX: checkX, originY: checkY, buildingType: checkTile.building.type };
            }
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Find all bridge tiles that are part of the same bridge as the tile at (x, y).
 * Bridges are connected along their orientation axis (ns or ew).
 */
function findConnectedBridgeTiles(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { x: number; y: number }[] {
  const tile = grid[y]?.[x];
  if (!tile || tile.building.type !== 'bridge') return [];
  
  const orientation = tile.building.bridgeOrientation || 'ns';
  const bridgeTiles: { x: number; y: number }[] = [{ x, y }];
  
  // Direction vectors based on orientation
  // NS bridges run along the x-axis (grid rows)
  // EW bridges run along the y-axis (grid columns)
  const dx = orientation === 'ns' ? 1 : 0;
  const dy = orientation === 'ns' ? 0 : 1;
  
  // Scan in positive direction
  let cx = x + dx;
  let cy = y + dy;
  while (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize) {
    const t = grid[cy][cx];
    if (t.building.type === 'bridge' && t.building.bridgeOrientation === orientation) {
      bridgeTiles.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    } else {
      break;
    }
  }
  
  // Scan in negative direction
  cx = x - dx;
  cy = y - dy;
  while (cx >= 0 && cx < gridSize && cy >= 0 && cy < gridSize) {
    const t = grid[cy][cx];
    if (t.building.type === 'bridge' && t.building.bridgeOrientation === orientation) {
      bridgeTiles.push({ x: cx, y: cy });
      cx -= dx;
      cy -= dy;
    } else {
      break;
    }
  }
  
  return bridgeTiles;
}

/**
 * Check if a road tile at (x, y) is adjacent to a bridge start/end tile.
 * If so, return all the bridge tiles that should be deleted.
 */
function findAdjacentBridgeTiles(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { x: number; y: number }[] {
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];
  
  for (const { dx, dy } of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
      const neighbor = grid[ny][nx];
      if (neighbor.building.type === 'bridge') {
        const position = neighbor.building.bridgePosition;
        // Check if this bridge tile is a start or end connected to our road
        if (position === 'start' || position === 'end') {
          return findConnectedBridgeTiles(grid, gridSize, nx, ny);
        }
      }
    }
  }
  
  return [];
}

// Bulldoze a tile (or entire multi-tile building if applicable)
export function bulldozeTile(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  if (tile.building.type === 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Special handling for bridges - delete the entire bridge and restore water
  if (tile.building.type === 'bridge') {
    const bridgeTiles = findConnectedBridgeTiles(newGrid, state.gridSize, x, y);
    for (const bt of bridgeTiles) {
      newGrid[bt.y][bt.x].building = createBuilding('water');
      newGrid[bt.y][bt.x].zone = 'none';
      newGrid[bt.y][bt.x].hasRailOverlay = false;
    }
    return { ...state, grid: newGrid };
  }
  
  // Special handling for roads - check if adjacent to a bridge start/end
  if (tile.building.type === 'road') {
    const adjacentBridgeTiles = findAdjacentBridgeTiles(newGrid, state.gridSize, x, y);
    if (adjacentBridgeTiles.length > 0) {
      // Delete the road first
      newGrid[y][x].building = createBuilding('grass');
      newGrid[y][x].zone = 'none';
      newGrid[y][x].hasRailOverlay = false;
      // Then delete all connected bridge tiles
      for (const bt of adjacentBridgeTiles) {
        newGrid[bt.y][bt.x].building = createBuilding('water');
        newGrid[bt.y][bt.x].zone = 'none';
        newGrid[bt.y][bt.x].hasRailOverlay = false;
      }
      return { ...state, grid: newGrid };
    }
  }
  
  // Check if this tile is part of a multi-tile building
  const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
  
  if (origin) {
    // Bulldoze the entire multi-tile building
    // For custom buildings, get size from the origin tile's customSize property
    const originTile = newGrid[origin.originY][origin.originX];
    const size = origin.buildingType === 'custom' && originTile.building.customSize
      ? { width: originTile.building.customSize, height: originTile.building.customSize }
      : getBuildingSize(origin.buildingType);
    for (let dy = 0; dy < size.height; dy++) {
      for (let dx = 0; dx < size.width; dx++) {
        const clearX = origin.originX + dx;
        const clearY = origin.originY + dy;
        if (clearX < state.gridSize && clearY < state.gridSize) {
          newGrid[clearY][clearX].building = createBuilding('grass');
          newGrid[clearY][clearX].zone = 'none';
          newGrid[clearY][clearX].hasRailOverlay = false; // Clear rail overlay
          // Don't remove subway when bulldozing surface buildings
        }
      }
    }
  } else {
    // Single tile bulldoze
    newGrid[y][x].building = createBuilding('grass');
    newGrid[y][x].zone = 'none';
    newGrid[y][x].hasRailOverlay = false; // Clear rail overlay
    // Don't remove subway when bulldozing surface buildings
  }

  return { ...state, grid: newGrid };
}

// Place a subway line underground (doesn't affect surface buildings)
export function placeSubway(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // Can't place subway under water
  if (tile.building.type === 'water') return state;
  
  // Already has subway
  if (tile.hasSubway) return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].hasSubway = true;

  return { ...state, grid: newGrid };
}

// Remove subway from a tile
export function removeSubway(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // No subway to remove
  if (!tile.hasSubway) return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  newGrid[y][x].hasSubway = false;

  return { ...state, grid: newGrid };
}

// Terraform a tile into water
export function placeWaterTerraform(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // Already water - do nothing
  if (tile.building.type === 'water') return state;
  
  // Don't allow terraforming bridges - would break them
  if (tile.building.type === 'bridge') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Check if this tile is part of a multi-tile building
  const origin = findBuildingOrigin(newGrid, x, y, state.gridSize);
  
  if (origin) {
    // Clear the entire multi-tile building first, then place water on this tile
    const size = getBuildingSize(origin.buildingType);
    for (let dy = 0; dy < size.height; dy++) {
      for (let dx = 0; dx < size.width; dx++) {
        const clearX = origin.originX + dx;
        const clearY = origin.originY + dy;
        if (clearX < state.gridSize && clearY < state.gridSize) {
          newGrid[clearY][clearX].building = createBuilding('grass');
          newGrid[clearY][clearX].zone = 'none';
        }
      }
    }
  }
  
  // Now place water on the target tile
  newGrid[y][x].building = createBuilding('water');
  newGrid[y][x].zone = 'none';
  newGrid[y][x].hasSubway = false; // Remove any subway under water

  return { ...state, grid: newGrid };
}

// Terraform a tile into land (grass)
export function placeLandTerraform(state: GameState, x: number, y: number): GameState {
  const tile = state.grid[y]?.[x];
  if (!tile) return state;
  
  // Only works on water tiles
  if (tile.building.type !== 'water') return state;

  const newGrid = state.grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
  
  // Convert water to grass
  newGrid[y][x].building = createBuilding('grass');
  newGrid[y][x].zone = 'none';

  return { ...state, grid: newGrid };
}

// Generate a random advanced city state with developed zones, infrastructure, and buildings
export function generateRandomAdvancedCity(size: number = DEFAULT_GRID_SIZE, cityName: string = 'Metropolis'): GameState {
  // Start with a base state (terrain generation)
  const baseState = createInitialGameState(size, cityName);
  const grid = baseState.grid;
  
  // Helper to check if a region is clear (no water)
  const isRegionClear = (x: number, y: number, w: number, h: number): boolean => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tile = grid[y + dy]?.[x + dx];
        if (!tile || tile.building.type === 'water') return false;
      }
    }
    return true;
  };
  
  // Helper to place a road
  const placeRoad = (x: number, y: number): void => {
    const tile = grid[y]?.[x];
    if (tile && tile.building.type !== 'water') {
      tile.building = createAdvancedBuilding('road');
      tile.zone = 'none';
    }
  };
  
  // Helper to create a completed building
  function createAdvancedBuilding(type: BuildingType): Building {
    return {
      type,
      level: type === 'grass' || type === 'empty' || type === 'water' || type === 'road' || type === 'bridge' ? 0 : Math.floor(Math.random() * 3) + 3,
      population: 0,
      jobs: 0,
      powered: true,
      watered: true,
      onFire: false,
      fireProgress: 0,
      age: Math.floor(Math.random() * 100) + 50,
      constructionProgress: 100, // Fully built
      abandoned: false,
    };
  }
  
  // Helper to place a zone with developed building
  const placeZonedBuilding = (x: number, y: number, zone: ZoneType, buildingType: BuildingType): void => {
    const tile = grid[y]?.[x];
    if (tile && tile.building.type !== 'water' && tile.building.type !== 'road') {
      tile.zone = zone;
      tile.building = createAdvancedBuilding(buildingType);
      tile.building.level = Math.floor(Math.random() * 3) + 3;
      const stats = BUILDING_STATS[buildingType];
      if (stats) {
        tile.building.population = Math.floor(stats.maxPop * tile.building.level * 0.7);
        tile.building.jobs = Math.floor(stats.maxJobs * tile.building.level * 0.7);
      }
    }
  };
  
  // Helper to place a multi-tile building
  const placeMultiTileBuilding = (x: number, y: number, type: BuildingType, zone: ZoneType = 'none'): boolean => {
    const buildingSize = getBuildingSize(type);
    if (!isRegionClear(x, y, buildingSize.width, buildingSize.height)) return false;
    if (x + buildingSize.width > size || y + buildingSize.height > size) return false;
    
    // Check for roads in the way
    for (let dy = 0; dy < buildingSize.height; dy++) {
      for (let dx = 0; dx < buildingSize.width; dx++) {
        const tileType = grid[y + dy][x + dx].building.type;
        if (tileType === 'road' || tileType === 'bridge') return false;
      }
    }
    
    // Place the building
    for (let dy = 0; dy < buildingSize.height; dy++) {
      for (let dx = 0; dx < buildingSize.width; dx++) {
        const tile = grid[y + dy][x + dx];
        tile.zone = zone;
        if (dx === 0 && dy === 0) {
          tile.building = createAdvancedBuilding(type);
          const stats = BUILDING_STATS[type];
          if (stats) {
            tile.building.population = Math.floor(stats.maxPop * tile.building.level * 0.8);
            tile.building.jobs = Math.floor(stats.maxJobs * tile.building.level * 0.8);
          }
        } else {
          tile.building = createAdvancedBuilding('empty');
          tile.building.level = 0;
        }
      }
    }
    return true;
  };
  
  // Define city center (roughly middle of map, avoiding edges)
  const centerX = Math.floor(size / 2);
  const centerY = Math.floor(size / 2);
  const cityRadius = Math.floor(size * 0.35);
  
  // Create main road grid - major arteries
  const roadSpacing = 6 + Math.floor(Math.random() * 3); // 6-8 tile spacing
  
  // Main horizontal roads
  for (let roadY = centerY - cityRadius; roadY <= centerY + cityRadius; roadY += roadSpacing) {
    if (roadY < 2 || roadY >= size - 2) continue;
    for (let x = Math.max(2, centerX - cityRadius); x <= Math.min(size - 3, centerX + cityRadius); x++) {
      placeRoad(x, roadY);
    }
  }
  
  // Main vertical roads
  for (let roadX = centerX - cityRadius; roadX <= centerX + cityRadius; roadX += roadSpacing) {
    if (roadX < 2 || roadX >= size - 2) continue;
    for (let y = Math.max(2, centerY - cityRadius); y <= Math.min(size - 3, centerY + cityRadius); y++) {
      placeRoad(roadX, y);
    }
  }
  
  // Add some diagonal/curved roads for interest (ring road)
  const ringRadius = cityRadius - 5;
  for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
    const rx = Math.round(centerX + Math.cos(angle) * ringRadius);
    const ry = Math.round(centerY + Math.sin(angle) * ringRadius);
    if (rx >= 2 && rx < size - 2 && ry >= 2 && ry < size - 2) {
      placeRoad(rx, ry);
    }
  }
  
  // Place service buildings first (they need good placement)
  const serviceBuildings: Array<{ type: BuildingType; count: number }> = [
    { type: 'power_plant', count: 4 + Math.floor(Math.random() * 3) },
    { type: 'water_tower', count: 8 + Math.floor(Math.random() * 4) },
    { type: 'police_station', count: 6 + Math.floor(Math.random() * 4) },
    { type: 'fire_station', count: 6 + Math.floor(Math.random() * 4) },
    { type: 'hospital', count: 3 + Math.floor(Math.random() * 2) },
    { type: 'school', count: 5 + Math.floor(Math.random() * 3) },
    { type: 'university', count: 2 + Math.floor(Math.random() * 2) },
  ];
  
  for (const service of serviceBuildings) {
    let placed = 0;
    let attempts = 0;
    while (placed < service.count && attempts < 500) {
      const x = centerX - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      const y = centerY - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      if (placeMultiTileBuilding(x, y, service.type)) {
        placed++;
      }
      attempts++;
    }
  }
  
  // Place special/landmark buildings
  const specialBuildings: BuildingType[] = [
    'city_hall', 'stadium', 'museum', 'airport', 'space_program', 'amusement_park',
    'baseball_stadium', 'amphitheater', 'community_center'
  ];
  
  for (const building of specialBuildings) {
    let attempts = 0;
    while (attempts < 200) {
      const x = centerX - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      const y = centerY - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      if (placeMultiTileBuilding(x, y, building)) break;
      attempts++;
    }
  }
  
  // Place parks and recreation throughout
  const parkBuildings: BuildingType[] = [
    'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small', 
    'playground_large', 'swimming_pool', 'skate_park', 'community_garden', 'pond_park'
  ];
  
  for (let i = 0; i < 25 + Math.floor(Math.random() * 15); i++) {
    const parkType = parkBuildings[Math.floor(Math.random() * parkBuildings.length)];
    let attempts = 0;
    while (attempts < 100) {
      const x = centerX - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      const y = centerY - cityRadius + Math.floor(Math.random() * cityRadius * 2);
      if (placeMultiTileBuilding(x, y, parkType)) break;
      attempts++;
    }
  }
  
  // Zone and develop remaining grass tiles within city radius
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      if (tile.building.type !== 'grass' && tile.building.type !== 'tree') continue;
      
      // Check distance from center
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist > cityRadius) continue;
      
      // Skip tiles not near roads
      let nearRoad = false;
      for (let dy = -2; dy <= 2 && !nearRoad; dy++) {
        for (let dx = -2; dx <= 2 && !nearRoad; dx++) {
          const checkTile = grid[y + dy]?.[x + dx];
          const tileType = checkTile?.building.type;
          if (tileType === 'road' || tileType === 'bridge') nearRoad = true;
        }
      }
      if (!nearRoad) continue;
      
      // Determine zone based on distance from center and some randomness
      const normalizedDist = dist / cityRadius;
      let zone: ZoneType;
      let buildingType: BuildingType;
      
      const rand = Math.random();
      
      if (normalizedDist < 0.3) {
        // Downtown - mostly commercial with some high-density residential
        if (rand < 0.6) {
          zone = 'commercial';
          const commercialTypes: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
          buildingType = commercialTypes[Math.floor(Math.random() * commercialTypes.length)];
        } else {
          zone = 'residential';
          const residentialTypes: BuildingType[] = ['apartment_low', 'apartment_high'];
          buildingType = residentialTypes[Math.floor(Math.random() * residentialTypes.length)];
        }
      } else if (normalizedDist < 0.6) {
        // Mid-city - mixed use
        if (rand < 0.5) {
          zone = 'residential';
          const residentialTypes: BuildingType[] = ['house_medium', 'mansion', 'apartment_low'];
          buildingType = residentialTypes[Math.floor(Math.random() * residentialTypes.length)];
        } else if (rand < 0.8) {
          zone = 'commercial';
          const commercialTypes: BuildingType[] = ['shop_small', 'shop_medium', 'office_low'];
          buildingType = commercialTypes[Math.floor(Math.random() * commercialTypes.length)];
        } else {
          zone = 'industrial';
          buildingType = 'factory_small';
        }
      } else {
        // Outer areas - more residential and industrial
        if (rand < 0.5) {
          zone = 'residential';
          const residentialTypes: BuildingType[] = ['house_small', 'house_medium'];
          buildingType = residentialTypes[Math.floor(Math.random() * residentialTypes.length)];
        } else if (rand < 0.7) {
          zone = 'industrial';
          const industrialTypes: BuildingType[] = ['factory_small', 'factory_medium', 'warehouse'];
          buildingType = industrialTypes[Math.floor(Math.random() * industrialTypes.length)];
        } else {
          zone = 'commercial';
          buildingType = 'shop_small';
        }
      }
      
      // Handle multi-tile buildings
      const bSize = getBuildingSize(buildingType);
      if (bSize.width > 1 || bSize.height > 1) {
        placeMultiTileBuilding(x, y, buildingType, zone);
      } else {
        placeZonedBuilding(x, y, zone, buildingType);
      }
    }
  }
  
  // Add some trees in remaining grass areas
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      if (tile.building.type === 'grass' && Math.random() < 0.15) {
        tile.building = createAdvancedBuilding('tree');
      }
    }
  }
  
  // Add subway network in the city center
  for (let y = centerY - Math.floor(cityRadius * 0.6); y <= centerY + Math.floor(cityRadius * 0.6); y++) {
    for (let x = centerX - Math.floor(cityRadius * 0.6); x <= centerX + Math.floor(cityRadius * 0.6); x++) {
      const tile = grid[y]?.[x];
      if (tile && tile.building.type !== 'water') {
        // Place subway along main roads
        const onMainRoad = (x % roadSpacing === centerX % roadSpacing) || (y % roadSpacing === centerY % roadSpacing);
        if (onMainRoad && Math.random() < 0.7) {
          tile.hasSubway = true;
        }
      }
    }
  }
  
  // Place subway stations at key intersections
  const subwayStationSpacing = roadSpacing * 2;
  for (let y = centerY - cityRadius; y <= centerY + cityRadius; y += subwayStationSpacing) {
    for (let x = centerX - cityRadius; x <= centerX + cityRadius; x += subwayStationSpacing) {
      const tile = grid[y]?.[x];
      if (tile && tile.building.type === 'grass' && tile.zone === 'none') {
        tile.building = createAdvancedBuilding('subway_station');
        tile.hasSubway = true;
      }
    }
  }
  
  // Calculate services and stats
  const services = calculateServiceCoverage(grid, size);
  
  // Set power and water for all buildings
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y][x].building.powered = services.power[y][x];
      grid[y][x].building.watered = services.water[y][x];
    }
  }
  
  // Calculate initial stats
  let totalPopulation = 0;
  let totalJobs = 0;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const building = grid[y][x].building;
      totalPopulation += building.population;
      totalJobs += building.jobs;
    }
  }
  
  // Create the final state
  return {
    ...baseState,
    grid,
    cityName,
    year: 2024 + Math.floor(Math.random() * 50), // Random year in future
    month: Math.floor(Math.random() * 12) + 1,
    day: Math.floor(Math.random() * 28) + 1,
    hour: 12,
    tick: 0,
    speed: 1,
    selectedTool: 'select',
    taxRate: 7 + Math.floor(Math.random() * 4), // 7-10%
    effectiveTaxRate: 8,
    stats: {
      population: totalPopulation,
      jobs: totalJobs,
      money: 500000 + Math.floor(Math.random() * 1000000),
      income: Math.floor(totalPopulation * 0.8 + totalJobs * 0.4),
      expenses: Math.floor((totalPopulation + totalJobs) * 0.3),
      happiness: 65 + Math.floor(Math.random() * 20),
      health: 60 + Math.floor(Math.random() * 25),
      education: 55 + Math.floor(Math.random() * 30),
      safety: 60 + Math.floor(Math.random() * 25),
      environment: 50 + Math.floor(Math.random() * 30),
      demand: {
        residential: 20 + Math.floor(Math.random() * 40),
        commercial: 15 + Math.floor(Math.random() * 35),
        industrial: 10 + Math.floor(Math.random() * 30),
      },
    },
    services,
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: true,
  };
}

// Diagnostic function to explain why a zoned tile isn't developing a building
export interface DevelopmentBlocker {
  reason: string;
  details: string;
}

export function getDevelopmentBlockers(
  state: GameState,
  x: number,
  y: number
): DevelopmentBlocker[] {
  const blockers: DevelopmentBlocker[] = [];
  const tile = state.grid[y]?.[x];
  
  if (!tile) {
    blockers.push({ reason: 'Invalid tile', details: `Tile at (${x}, ${y}) does not exist` });
    return blockers;
  }
  
  // Only analyze zoned tiles
  if (tile.zone === 'none') {
    blockers.push({ reason: 'Not zoned', details: 'Tile has no zone assigned' });
    return blockers;
  }
  
  // If it already has a building, no blockers
  if (tile.building.type !== 'grass' && tile.building.type !== 'tree') {
    // It's already developed or is a placeholder for a multi-tile building
    return blockers;
  }
  
  // Check road access
  const roadAccess = hasRoadAccess(state.grid, x, y, state.gridSize);
  if (!roadAccess) {
    blockers.push({
      reason: 'No road access',
      details: 'Tile must be within 8 tiles of a road (through same-zone tiles)'
    });
  }
  
  // Check if multi-tile building can spawn here
  const buildingList = tile.zone === 'residential' ? RESIDENTIAL_BUILDINGS :
    tile.zone === 'commercial' ? COMMERCIAL_BUILDINGS : INDUSTRIAL_BUILDINGS;
  const candidate = buildingList[0];
  
  // Starter buildings (house_small, shop_small, factory_small) don't require power/water
  // They represent small-scale, self-sufficient operations
  const wouldBeStarter = isStarterBuilding(x, y, candidate);
  
  // Check power (not required for starter buildings)
  const hasPower = state.services.power[y][x];
  if (!hasPower && !wouldBeStarter) {
    blockers.push({
      reason: 'No power',
      details: 'Build a power plant nearby to provide electricity'
    });
  }
  
  // Check water (not required for starter buildings)
  const hasWater = state.services.water[y][x];
  if (!hasWater && !wouldBeStarter) {
    blockers.push({
      reason: 'No water',
      details: 'Build a water tower nearby to provide water'
    });
  }
  const candidateSize = getBuildingSize(candidate);
  
  if (candidateSize.width > 1 || candidateSize.height > 1) {
    // Check if the footprint is available
    if (!canSpawnMultiTileBuilding(state.grid, x, y, candidateSize.width, candidateSize.height, tile.zone, state.gridSize)) {
      // Find out specifically why
      const footprintBlockers: string[] = [];
      
      if (x + candidateSize.width > state.gridSize || y + candidateSize.height > state.gridSize) {
        footprintBlockers.push('Too close to map edge');
      }
      
      for (let dy = 0; dy < candidateSize.height && footprintBlockers.length < 3; dy++) {
        for (let dx = 0; dx < candidateSize.width && footprintBlockers.length < 3; dx++) {
          const checkTile = state.grid[y + dy]?.[x + dx];
          if (!checkTile) {
            footprintBlockers.push(`Tile (${x + dx}, ${y + dy}) is out of bounds`);
          } else if (checkTile.zone !== tile.zone) {
            footprintBlockers.push(`Tile (${x + dx}, ${y + dy}) has different zone: ${checkTile.zone}`);
          } else if (checkTile.building.type !== 'grass' && checkTile.building.type !== 'tree') {
            footprintBlockers.push(`Tile (${x + dx}, ${y + dy}) has ${checkTile.building.type}`);
          }
        }
      }
      
      blockers.push({
        reason: 'Footprint blocked',
        details: `${candidate} needs ${candidateSize.width}x${candidateSize.height} tiles. Issues: ${footprintBlockers.join('; ')}`
      });
    }
  }
  
  // If no blockers found, it's just waiting for RNG
  const hasUtilities = hasPower && hasWater;
  if (blockers.length === 0 && roadAccess && (hasUtilities || wouldBeStarter)) {
    blockers.push({
      reason: 'Waiting for development',
      details: wouldBeStarter && !hasUtilities 
        ? 'Starter building can develop here without utilities! (5% chance per tick)' 
        : 'All conditions met! Building will spawn soon (5% chance per tick)'
    });
  }
  
  return blockers;
}

/**
 * Expand the grid by adding tiles on all sides.
 * The expansion is intelligent:
 * - Land edges extend as land (not forced to water)
 * - Water/ocean edges extend as water
 * - Water bodies extend naturally based on proximity
 * - New land areas get grass with scattered trees
 * 
 * @param currentGrid The existing grid
 * @param currentSize The current grid size
 * @param expansion How many tiles to add on EACH side (total new size = currentSize + 2*expansion)
 * @returns New expanded grid
 */
export function expandGrid(
  currentGrid: Tile[][],
  currentSize: number,
  expansion: number = 15
): { grid: Tile[][]; newSize: number } {
  const newSize = currentSize + expansion * 2;
  const grid: Tile[][] = [];
  
  // Helper to check if position is water in the old grid
  const isOldWater = (oldX: number, oldY: number): boolean => {
    if (oldX < 0 || oldY < 0 || oldX >= currentSize || oldY >= currentSize) return false;
    return currentGrid[oldY][oldX].building.type === 'water';
  };
  
  // Helper to check if position is land (not water) in the old grid
  const isOldLand = (oldX: number, oldY: number): boolean => {
    if (oldX < 0 || oldY < 0 || oldX >= currentSize || oldY >= currentSize) return false;
    return currentGrid[oldY][oldX].building.type !== 'water';
  };
  
  // Find the closest edge tile type from the original grid
  // Returns: 'water' | 'land' | 'mixed' depending on what was at the nearest edge
  const getClosestEdgeType = (newX: number, newY: number): 'water' | 'land' | 'mixed' => {
    const oldX = newX - expansion;
    const oldY = newY - expansion;
    
    // Determine which edge(s) we're extending from
    let waterCount = 0;
    let landCount = 0;
    
    // Check a strip along the nearest original edge
    if (oldX < 0) {
      // Left of original grid - check left edge (x=0) of original
      const startY = Math.max(0, oldY - 3);
      const endY = Math.min(currentSize - 1, oldY + 3);
      for (let y = startY; y <= endY; y++) {
        if (isOldWater(0, y)) waterCount++;
        else landCount++;
      }
    } else if (oldX >= currentSize) {
      // Right of original grid - check right edge (x=currentSize-1)
      const startY = Math.max(0, oldY - 3);
      const endY = Math.min(currentSize - 1, oldY + 3);
      for (let y = startY; y <= endY; y++) {
        if (isOldWater(currentSize - 1, y)) waterCount++;
        else landCount++;
      }
    }
    
    if (oldY < 0) {
      // Above original grid - check top edge (y=0)
      const startX = Math.max(0, oldX - 3);
      const endX = Math.min(currentSize - 1, oldX + 3);
      for (let x = startX; x <= endX; x++) {
        if (isOldWater(x, 0)) waterCount++;
        else landCount++;
      }
    } else if (oldY >= currentSize) {
      // Below original grid - check bottom edge (y=currentSize-1)
      const startX = Math.max(0, oldX - 3);
      const endX = Math.min(currentSize - 1, oldX + 3);
      for (let x = startX; x <= endX; x++) {
        if (isOldWater(x, currentSize - 1)) waterCount++;
        else landCount++;
      }
    }
    
    // Corner case: check both edges
    if ((oldX < 0 || oldX >= currentSize) && (oldY < 0 || oldY >= currentSize)) {
      // In a corner - check the corner tile
      const cornerX = oldX < 0 ? 0 : currentSize - 1;
      const cornerY = oldY < 0 ? 0 : currentSize - 1;
      if (isOldWater(cornerX, cornerY)) waterCount += 2;
      else landCount += 2;
    }
    
    if (waterCount === 0 && landCount === 0) return 'mixed';
    if (waterCount > landCount * 2) return 'water';
    if (landCount > waterCount * 2) return 'land';
    return 'mixed';
  };
  
  // Helper to get distance from the original grid boundary (how far into expansion zone)
  const getDistanceFromOriginalBoundary = (newX: number, newY: number): number => {
    const oldX = newX - expansion;
    const oldY = newY - expansion;
    
    // Calculate distance to nearest edge of original grid
    let distToOriginal = 0;
    if (oldX < 0) distToOriginal = Math.max(distToOriginal, -oldX);
    if (oldY < 0) distToOriginal = Math.max(distToOriginal, -oldY);
    if (oldX >= currentSize) distToOriginal = Math.max(distToOriginal, oldX - currentSize + 1);
    if (oldY >= currentSize) distToOriginal = Math.max(distToOriginal, oldY - currentSize + 1);
    
    // For corners, use the max of both distances
    return distToOriginal;
  };
  
  // Helper to find water percentage along the nearest original edge
  // Also returns whether this appears to be a "sea" (large contiguous water along edge)
  const getEdgeWaterInfo = (newX: number, newY: number, sampleRadius: number = 10): { density: number; isSea: boolean } => {
    const oldX = newX - expansion;
    const oldY = newY - expansion;
    
    let waterCount = 0;
    let totalCount = 0;
    let consecutiveWater = 0;
    let maxConsecutive = 0;
    
    // Sample along the nearest edge(s) of the original grid
    if (oldX < 0) {
      // Left of grid - sample left edge (x=0)
      consecutiveWater = 0;
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        const sampleY = Math.max(0, Math.min(currentSize - 1, oldY + dy));
        if (isOldWater(0, sampleY)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    if (oldX >= currentSize) {
      // Right of grid - sample right edge
      consecutiveWater = 0;
      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        const sampleY = Math.max(0, Math.min(currentSize - 1, oldY + dy));
        if (isOldWater(currentSize - 1, sampleY)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    if (oldY < 0) {
      // Above grid - sample top edge
      consecutiveWater = 0;
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const sampleX = Math.max(0, Math.min(currentSize - 1, oldX + dx));
        if (isOldWater(sampleX, 0)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    if (oldY >= currentSize) {
      // Below grid - sample bottom edge
      consecutiveWater = 0;
      for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
        const sampleX = Math.max(0, Math.min(currentSize - 1, oldX + dx));
        if (isOldWater(sampleX, currentSize - 1)) {
          waterCount++;
          consecutiveWater++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveWater);
        } else {
          consecutiveWater = 0;
        }
        totalCount++;
      }
    }
    
    const density = totalCount > 0 ? waterCount / totalCount : 0;
    // A "sea" has high density AND long consecutive water stretches (not just scattered water)
    const isSea = density > 0.7 && maxConsecutive >= sampleRadius;
    
    return { density, isSea };
  };
  
  // Generate a random seed for this expansion (consistent within one expansion call)
  const expansionSeed = Date.now() % 100000;
  
  // First pass: determine terrain type for each new tile
  for (let y = 0; y < newSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < newSize; x++) {
      const oldX = x - expansion;
      const oldY = y - expansion;
      
      // Check if this position was in the old grid
      const wasInOldGrid = oldX >= 0 && oldY >= 0 && oldX < currentSize && oldY < currentSize;
      
      if (wasInOldGrid) {
        // Copy the old tile with updated coordinates
        const oldTile = currentGrid[oldY][oldX];
        row.push({
          ...oldTile,
          x,
          y,
          // Deep copy building to avoid reference issues
          building: { ...oldTile.building },
        });
      } else {
        // New tile - taper OUTWARD from original grid
        const distFromBoundary = getDistanceFromOriginalBoundary(x, y);
        const { density: edgeWaterDensity, isSea } = getEdgeWaterInfo(x, y);
        
        // Use Perlin noise for organic coastline shapes
        const coastNoise = perlinNoise(x * 0.12, y * 0.12, expansionSeed, 3);
        
        let isWater = false;
        
        if (isSea) {
          // This is a SEA - extend all the way to the new map edge with organic coastline
          // Only add slight variation at the very edges for natural look
          const distFromNewEdge = Math.min(x, y, newSize - 1 - x, newSize - 1 - y);
          
          if (distFromNewEdge <= 2) {
            // At the very edge of new map - keep as water with slight variation
            isWater = coastNoise > 0.2;
          } else {
            // Interior - full water
            isWater = true;
          }
        } else if (edgeWaterDensity > 0.3) {
          // Regular water body (lake or small bay) - taper outward
          // Water probability is HIGH near boundary and DECREASES as we go outward
          const maxExpansionDist = expansion * (0.5 + coastNoise * 0.3 + edgeWaterDensity * 0.4);
          
          // Probability = 1 at boundary, tapers to 0 at maxExpansionDist
          const taperRatio = distFromBoundary / maxExpansionDist;
          const waterProb = Math.max(0, 1 - Math.pow(taperRatio, 1.3)) * edgeWaterDensity;
          
          // Add some noise for organic edges
          const noiseThreshold = 0.12 + coastNoise * 0.18;
          isWater = waterProb > noiseThreshold;
        }
        
        if (isWater) {
          row.push(createTile(x, y, 'water'));
        } else {
          // Grass or tree
          const treeProbability = 0.12;
          const treeNoise = perlinNoise(x * 0.3, y * 0.3, expansionSeed + 500, 2);
          
          if (treeNoise < treeProbability) {
            row.push(createTile(x, y, 'tree'));
          } else {
            row.push(createTile(x, y, 'grass'));
          }
        }
      }
    }
    grid.push(row);
  }
  
  // Helper to count water neighbors in a given radius
  const countWaterNeighbors = (cx: number, cy: number, radius: number = 1): number => {
    let count = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < newSize && ny < newSize) {
          if (grid[ny][nx].building.type === 'water') count++;
        }
      }
    }
    return count;
  };
  
  // Helper to check if a tile is in the expansion zone
  const isExpansionTile = (x: number, y: number): boolean => {
    const oldX = x - expansion;
    const oldY = y - expansion;
    return oldX < 0 || oldY < 0 || oldX >= currentSize || oldY >= currentSize;
  };
  
  // Smoothing passes: Use cellular automata rules to create smooth coastlines
  // Run multiple iterations to smooth out jagged edges
  for (let iteration = 0; iteration < 4; iteration++) {
    const changes: { x: number; y: number; toWater: boolean }[] = [];
    
    for (let y = 0; y < newSize; y++) {
      for (let x = 0; x < newSize; x++) {
        if (!isExpansionTile(x, y)) continue;
        
        const isWater = grid[y][x].building.type === 'water';
        const neighbors = countWaterNeighbors(x, y, 1);
        const extendedNeighbors = countWaterNeighbors(x, y, 2);
        
        if (isWater) {
          // Remove isolated water tiles (less than 2 neighbors) or peninsulas (1-2 neighbors surrounded by land)
          if (neighbors <= 1) {
            changes.push({ x, y, toWater: false });
          }
        } else {
          // Fill in bays and smooth concave coastlines (5+ neighbors means surrounded by water)
          if (neighbors >= 5) {
            changes.push({ x, y, toWater: true });
          }
          // Also fill tiles that are nearly surrounded (4 neighbors and many extended)
          else if (neighbors >= 4 && extendedNeighbors >= 16) {
            changes.push({ x, y, toWater: true });
          }
        }
      }
    }
    
    // Apply changes
    for (const change of changes) {
      if (change.toWater) {
        grid[change.y][change.x].building = createBuilding('water');
      } else {
        const treeNoise = perlinNoise(change.x * 0.3, change.y * 0.3, expansionSeed + 1000, 2);
        grid[change.y][change.x].building = createBuilding(treeNoise < 0.15 ? 'tree' : 'grass');
      }
    }
  }
  
  // Final smoothing pass: Remove any remaining single-tile peninsulas or isolated water
  for (let y = 0; y < newSize; y++) {
    for (let x = 0; x < newSize; x++) {
      if (!isExpansionTile(x, y)) continue;
      
      const isWater = grid[y][x].building.type === 'water';
      const neighbors = countWaterNeighbors(x, y, 1);
      
      if (isWater && neighbors <= 1) {
        const treeNoise = perlinNoise(x * 0.3, y * 0.3, expansionSeed + 2000, 2);
        grid[y][x].building = createBuilding(treeNoise < 0.15 ? 'tree' : 'grass');
      } else if (!isWater && neighbors >= 6) {
        grid[y][x].building = createBuilding('water');
      }
    }
  }
  
  // Sixth pass: Generate NEW lakes in expanded land areas
  // Create a mix of big lakes and small ponds
  const lakeNoise = (lx: number, ly: number) => perlinNoise(lx, ly, expansionSeed + 3000, 3);
  const minDistFromEdge = 2;
  const minDistBetweenBigLakes = Math.max(expansion * 0.25, 4);
  const minDistBetweenSmallLakes = Math.max(expansion * 0.15, 3);
  
  // Find potential lake centers for BIG lakes
  const bigLakeCenters: { x: number; y: number; noise: number }[] = [];
  
  for (let y = minDistFromEdge; y < newSize - minDistFromEdge; y++) {
    for (let x = minDistFromEdge; x < newSize - minDistFromEdge; x++) {
      if (!isExpansionTile(x, y)) continue;
      if (grid[y][x].building.type === 'water') continue;
      
      const noiseVal = lakeNoise(x, y);
      
      // Low noise = good for big lakes
      if (noiseVal < 0.35) {
        let tooClose = false;
        for (const center of bigLakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenBigLakes) {
            tooClose = true;
            break;
          }
        }
        
        if (!tooClose) {
          bigLakeCenters.push({ x, y, noise: noiseVal });
        }
      }
    }
  }
  
  // Pick 4-8 big lakes
  bigLakeCenters.sort((a, b) => a.noise - b.noise);
  const numBigLakes = Math.min(bigLakeCenters.length, 4 + Math.floor(Math.random() * 5));
  const selectedBigLakeCenters = bigLakeCenters.slice(0, numBigLakes);
  
  // Find potential centers for SMALL ponds (different noise range)
  const smallLakeCenters: { x: number; y: number; noise: number }[] = [];
  const pondNoise = (px: number, py: number) => perlinNoise(px, py, expansionSeed + 4000, 2);
  
  for (let y = minDistFromEdge; y < newSize - minDistFromEdge; y++) {
    for (let x = minDistFromEdge; x < newSize - minDistFromEdge; x++) {
      if (!isExpansionTile(x, y)) continue;
      if (grid[y][x].building.type === 'water') continue;
      
      const noiseVal = pondNoise(x, y);
      
      // Different noise range for small ponds
      if (noiseVal < 0.45) {
        // Check distance from big lakes
        let tooCloseToBig = false;
        for (const center of selectedBigLakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenBigLakes) {
            tooCloseToBig = true;
            break;
          }
        }
        if (tooCloseToBig) continue;
        
        // Check distance from other small lakes
        let tooClose = false;
        for (const center of smallLakeCenters) {
          const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
          if (dist < minDistBetweenSmallLakes) {
            tooClose = true;
            break;
          }
        }
        
        if (!tooClose) {
          smallLakeCenters.push({ x, y, noise: noiseVal });
        }
      }
    }
  }
  
  // Pick 10-20 small ponds
  smallLakeCenters.sort((a, b) => a.noise - b.noise);
  const numSmallLakes = Math.min(smallLakeCenters.length, 10 + Math.floor(Math.random() * 11));
  const selectedSmallLakeCenters = smallLakeCenters.slice(0, numSmallLakes);
  
  // Combine all lake centers with size info
  const allLakeCenters: { x: number; y: number; noise: number; isBig: boolean }[] = [
    ...selectedBigLakeCenters.map(c => ({ ...c, isBig: true })),
    ...selectedSmallLakeCenters.map(c => ({ ...c, isBig: false })),
  ];
  
  // Grow each lake using flood-fill
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const center of allLakeCenters) {
    // Big lakes: 25-70 tiles, Small ponds: 4-15 tiles
    const targetSize = center.isBig 
      ? 25 + Math.floor(Math.random() * 46)
      : 4 + Math.floor(Math.random() * 12);
    const lakeTiles: { x: number; y: number }[] = [{ x: center.x, y: center.y }];
    const candidates: { x: number; y: number; dist: number; noise: number }[] = [];
    
    for (const [dx, dy] of directions) {
      const nx = center.x + dx;
      const ny = center.y + dy;
      if (nx >= 1 && nx < newSize - 1 &&
          ny >= 1 && ny < newSize - 1 &&
          grid[ny][nx].building.type !== 'water') {
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
      if (grid[picked.y][picked.x].building.type === 'water') continue;
      
      lakeTiles.push({ x: picked.x, y: picked.y });
      
      for (const [dx, dy] of directions) {
        const nx = picked.x + dx;
        const ny = picked.y + dy;
        if (nx >= 1 && nx < newSize - 1 &&
            ny >= 1 && ny < newSize - 1 &&
            grid[ny][nx].building.type !== 'water' &&
            !lakeTiles.some(t => t.x === nx && t.y === ny) &&
            !candidates.some(c => c.x === nx && c.y === ny)) {
          const dist = Math.sqrt((nx - center.x) ** 2 + (ny - center.y) ** 2);
          const noise = lakeNoise(nx, ny);
          candidates.push({ x: nx, y: ny, dist, noise });
        }
      }
    }
    
    // Apply lake tiles to grid
    for (const tile of lakeTiles) {
      grid[tile.y][tile.x].building = createBuilding('water');
      grid[tile.y][tile.x].landValue = 60;
    }
  }
  
  // Seventh pass: Generate rivers in expansion zones
  // Rivers flow from lakes or map edges toward other water bodies
  const riverChance = 0.4; // 40% chance to generate rivers
  if (Math.random() < riverChance) {
    const numRivers = 1 + Math.floor(Math.random() * 3); // 1-3 rivers
    
    for (let r = 0; r < numRivers; r++) {
      // Find a starting point: either from a new lake or from expansion edge
      let startX = 0, startY = 0;
      let endX = 0, endY = 0;
      let foundStart = false;
      
      // Try to start from a lake in expansion zone
      for (let attempts = 0; attempts < 50 && !foundStart; attempts++) {
        const testX = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
        const testY = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
        
        if (isExpansionTile(testX, testY) && grid[testY][testX].building.type === 'water') {
          // Check if this is edge of a water body
          let hasLandNeighbor = false;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = testX + dx;
            const ny = testY + dy;
            if (nx >= 0 && ny >= 0 && nx < newSize && ny < newSize &&
                grid[ny][nx].building.type !== 'water') {
              hasLandNeighbor = true;
              startX = nx;
              startY = ny;
              break;
            }
          }
          if (hasLandNeighbor) {
            foundStart = true;
          }
        }
      }
      
      // If no lake edge found, start from expansion boundary
      if (!foundStart) {
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
          case 0: // Top
            startX = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            startY = minDistFromEdge;
            break;
          case 1: // Bottom
            startX = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            startY = newSize - minDistFromEdge - 1;
            break;
          case 2: // Left
            startX = minDistFromEdge;
            startY = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            break;
          case 3: // Right
            startX = newSize - minDistFromEdge - 1;
            startY = minDistFromEdge + Math.floor(Math.random() * (newSize - 2 * minDistFromEdge));
            break;
        }
        if (!isExpansionTile(startX, startY)) continue;
        foundStart = true;
      }
      
      if (!foundStart) continue;
      
      // Find end point: another water body or opposite edge
      endX = newSize / 2 + (Math.random() - 0.5) * newSize * 0.6;
      endY = newSize / 2 + (Math.random() - 0.5) * newSize * 0.6;
      
      // Draw river using random walk biased toward end point
      let curX = startX;
      let curY = startY;
      const riverLength = 15 + Math.floor(Math.random() * 25); // 15-40 tiles
      const riverWidth = 1 + Math.floor(Math.random() * 2); // 1-2 tiles wide
      
      for (let step = 0; step < riverLength; step++) {
        // Place water at current position (and width)
        for (let w = 0; w < riverWidth; w++) {
          const wx = curX + (w % 2);
          const wy = curY + Math.floor(w / 2);
          if (wx >= 0 && wy >= 0 && wx < newSize && wy < newSize && isExpansionTile(wx, wy)) {
            grid[wy][wx].building = createBuilding('water');
          }
        }
        
        // Move toward end with some randomness (Perlin noise for organic curves)
        const riverNoise = perlinNoise(curX * 0.2, curY * 0.2, expansionSeed + 5000 + r * 100, 2);
        const angle = Math.atan2(endY - curY, endX - curX) + (riverNoise - 0.5) * Math.PI * 0.8;
        
        const nextX = Math.round(curX + Math.cos(angle));
        const nextY = Math.round(curY + Math.sin(angle));
        
        // Stop if we hit existing water or go out of bounds
        if (nextX < 1 || nextY < 1 || nextX >= newSize - 1 || nextY >= newSize - 1) break;
        if (!isExpansionTile(nextX, nextY)) break;
        if (grid[nextY][nextX].building.type === 'water' && step > 5) break; // Connect to water
        
        curX = nextX;
        curY = nextY;
      }
    }
  }
  
  return { grid, newSize };
}

/**
 * Shrink the grid by removing tiles from all sides.
 * The shrink deletes the outer tiles on each edge.
 * 
 * @param currentGrid The existing grid
 * @param currentSize The current grid size
 * @param shrinkAmount How many tiles to remove from EACH side (total reduction = currentSize - 2*shrinkAmount)
 * @returns New shrunken grid, or null if grid would be too small
 */
export function shrinkGrid(
  currentGrid: Tile[][],
  currentSize: number,
  shrinkAmount: number = 15
): { grid: Tile[][]; newSize: number } | null {
  const newSize = currentSize - shrinkAmount * 2;
  
  // Don't allow shrinking below a minimum size
  if (newSize < 20) {
    return null;
  }
  
  const grid: Tile[][] = [];
  
  // Copy tiles from the interior of the old grid
  for (let y = 0; y < newSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < newSize; x++) {
      const oldX = x + shrinkAmount;
      const oldY = y + shrinkAmount;
      const oldTile = currentGrid[oldY][oldX];
      
      // Copy tile with updated coordinates
      row.push({
        ...oldTile,
        x,
        y,
        building: { ...oldTile.building },
      });
    }
    grid.push(row);
  }
  
  return { grid, newSize };
}
